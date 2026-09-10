"""Le circuit de validation, partage par tous les services de GDA Hub.

Repris de FinanceRH/backend/core, avec une transformation de fond : le moteur
et les etapes vivent desormais **dans la base de chaque service**. Une demande
de conge et un bon d'engagement suivent le meme parcours, mais aucune decision
ne traverse le reseau — le service qui porte le dossier porte aussi ses
etapes.

**La cle qui traverse tout l'ERP, c'est l'identifiant de connexion.** Les
numeros de compte vivent chez identity, les numeros d'agent chez organisation,
et un service metier ne connait ni les uns ni les autres de facon fiable.
L'identifiant, lui, est le meme partout : c'est celui que le jeton porte, et
c'est donc lui qu'une etape retient quand elle vise une personne. Les numeros
sont conserves a cote, pour l'affichage et les jointures futures, jamais comme
cle de decision.

Trois regles de conception heritees, qui expliquent la forme des tables :

1. Un dossier recopie l'instantane de son demandeur a la creation — nom,
   departement, responsable. Ensuite il ne demande plus rien a l'annuaire, ni
   pour s'afficher, ni pour savoir a qui il remonte.
2. Les etapes ne s'enchainent pas : toutes sont ouvertes des la soumission, et
   chaque valideur se prononce quand il veut. Attendre son tour ne ferait que
   ralentir un dossier sans rien ajouter a la piste d'audit.
3. Un dossier reste entre les mains de son auteur tant que personne ne s'est
   prononce. C'est le premier geste d'un responsable qui le fige, pas la
   soumission.
"""

from django.contrib.contenttypes.fields import GenericForeignKey, GenericRelation
from django.contrib.contenttypes.models import ContentType
from django.core.validators import MinValueValidator
from django.db import models, transaction
from django.utils import timezone

from gdahub_common.constantes import (
    Decision,
    Devise,
    NatureEtape,
    StatutDocument,
    TypeDocument,
)


class Horodate(models.Model):
    cree_le = models.DateTimeField("Cree le", auto_now_add=True)
    modifie_le = models.DateTimeField("Modifie le", auto_now=True)

    class Meta:
        abstract = True


class CompteurDocument(models.Model):
    """Compteur atomique par prefixe et par annee, pour la numerotation."""

    prefixe = models.CharField("Prefixe", max_length=16)
    annee = models.PositiveIntegerField("Annee")
    valeur = models.PositiveIntegerField("Valeur", default=0)

    class Meta:
        db_table = "compteur_document"
        constraints = [
            models.UniqueConstraint(
                fields=["prefixe", "annee"], name="un_compteur_par_prefixe_et_annee"
            )
        ]
        verbose_name = "Compteur de document"
        verbose_name_plural = "Compteurs de documents"

    def __str__(self):
        return f"{self.prefixe}-{self.annee} : {self.valeur}"


def generer_numero(prefixe: str) -> str:
    """Un numero unique et lisible, du type « ABS-2026-0007 ».

    Le verrou de ligne est indispensable : deux demandes deposees en meme
    temps recevraient sinon le meme numero, et le second enregistrement
    echouerait sous les yeux d'un utilisateur qui n'y peut rien.
    """
    annee = timezone.localdate().year
    with transaction.atomic():
        compteur, _ = CompteurDocument.objects.select_for_update().get_or_create(
            prefixe=prefixe, annee=annee
        )
        compteur.valeur += 1
        compteur.save(update_fields=["valeur"])
    return f"{prefixe}-{annee}-{compteur.valeur:04d}"


class RegleCircuit(Horodate):
    """Qui doit valider, pour quel montant, dans quel ordre.

    Le circuit d'un document est la liste des regles actives dont la fourchette
    de montant contient son montant, triees par `ordre`.

    **Pourquoi ces regles vivent dans chaque service** plutot que dans un
    service central : ce sont des regles *sur ses propres documents*, et les
    lire ailleurs ferait dependre chaque soumission d'un appel reseau. Le
    service `direction` les administre a travers l'API de chaque service, avec
    le jeton du directeur — les droits voyagent avec la personne, pas avec une
    authentification de service a inventer.
    """

    libelle = models.CharField("Libelle", max_length=120)
    type_document = models.CharField(
        "Type de document",
        max_length=20,
        choices=TypeDocument.choices,
        default=TypeDocument.TOUS,
    )
    montant_min = models.DecimalField(
        "Montant minimum",
        max_digits=14,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
    )
    montant_max = models.DecimalField(
        "Montant maximum",
        max_digits=14,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Vide = pas de plafond.",
    )
    role_valideur = models.CharField(
        "Role attendu",
        max_length=40,
        blank=True,
        help_text="Code de role sur cette application : gestionnaire, direction...",
    )
    ordre = models.PositiveSmallIntegerField(
        "Ordre", default=1, help_text="Position dans le circuit (1 = premier)."
    )
    valideur_hierarchique = models.BooleanField(
        "Revient au responsable du demandeur",
        default=False,
        help_text="L'etape revient au responsable du departement du demandeur, "
        "ou a defaut a son rattachement direct.",
    )
    valideur_identifiant = models.CharField(
        "Valideur designe",
        max_length=150,
        blank=True,
        help_text="Identifiant de connexion d'une personne nommement chargee "
        "de cette etape. Prioritaire sur le valideur hierarchique et sur le role.",
    )
    valideur_nom = models.CharField("Nom du valideur designe", max_length=150, blank=True)
    nature = models.CharField(
        "Nature",
        max_length=12,
        choices=NatureEtape.choices,
        default=NatureEtape.DECISION,
        help_text="Decision : un refus arrete le dossier. Avis : un refus est "
        "consigne puis transmis a l'etape suivante. Information : l'etape est "
        "franchie a la soumission, le service est seulement tenu au courant.",
    )
    actif = models.BooleanField("Regle active", default=True)

    class Meta:
        db_table = "regle_circuit"
        ordering = ["type_document", "ordre", "montant_min"]
        verbose_name = "Regle de circuit"
        verbose_name_plural = "Regles de circuit"

    def __str__(self):
        plafond = f"{self.montant_max:,.0f}" if self.montant_max is not None else "∞"
        return f"[{self.ordre}] {self.libelle} ({self.montant_min:,.0f} - {plafond})"

    def couvre(self, montant) -> bool:
        if montant is None:
            montant = 0
        if montant < self.montant_min:
            return False
        return self.montant_max is None or montant <= self.montant_max


class EtapeValidation(Horodate):
    """Une etape du circuit, rattachee a n'importe quel document du service."""

    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveBigIntegerField()
    document = GenericForeignKey("content_type", "object_id")

    ordre = models.PositiveSmallIntegerField("Ordre", default=1)
    libelle = models.CharField("Libelle", max_length=120)
    role_valideur = models.CharField("Role attendu", max_length=40, blank=True)

    #: Qui est attendu, quand l'etape vise une personne plutot qu'un role.
    #: L'identifiant fait foi ; le nom n'est la que pour l'affichage.
    valideur_identifiant = models.CharField(
        "Valideur attendu", max_length=150, blank=True, db_index=True
    )
    valideur_nom = models.CharField("Nom du valideur", max_length=150, blank=True)

    nature = models.CharField(
        "Nature",
        max_length=12,
        choices=NatureEtape.choices,
        default=NatureEtape.DECISION,
        help_text="Recopiee de la regle au moment ou le circuit est construit.",
    )
    decision = models.CharField(
        "Decision", max_length=12, choices=Decision.choices, default=Decision.EN_ATTENTE
    )
    decide_par_identifiant = models.CharField(
        "Decide par", max_length=150, blank=True
    )
    decide_par_nom = models.CharField("Nom du decideur", max_length=150, blank=True)
    date_decision = models.DateTimeField("Date de decision", null=True, blank=True)
    commentaire = models.TextField("Commentaire", blank=True)

    class Meta:
        db_table = "etape_validation"
        ordering = ["ordre", "id"]
        indexes = [models.Index(fields=["content_type", "object_id"])]
        verbose_name = "Etape de validation"
        verbose_name_plural = "Etapes de validation"

    def __str__(self):
        return f"{self.libelle} - {self.get_decision_display()}"

    def peut_etre_decidee_par(self, utilisateur, document=None) -> bool:
        """Aucun role ne court-circuite le circuit, direction comprise.

        La direction n'intervient que sur les etapes qui lui reviennent :
        laisser un profil sauter des etapes viderait la piste d'audit de son
        sens. Elle reste le valideur de repli des etapes hierarchiques d'un
        demandeur sans responsable, via `role_valideur`.
        """
        if self.decision != Decision.EN_ATTENTE:
            return False

        # Nul ne tranche sur son propre dossier. La construction du circuit
        # ecarte deja ces etapes ; ce garde-fou couvre les circuits construits
        # avant un changement de rattachement.
        dossier = document if document is not None else self.document
        if dossier is not None and dossier.demandeur_identifiant == utilisateur.identifiant:
            return False

        if self.valideur_identifiant:
            return self.valideur_identifiant == utilisateur.identifiant
        if not self.role_valideur:
            return False
        return utilisateur.a_role(self.role_valideur)


class DocumentValidable(Horodate):
    """Base de tout document soumis a un circuit de validation.

    Le demandeur n'est pas une cle etrangere : il vit dans deux autres bases.
    Ce qui est conserve ici, c'est l'instantane que `organisation` renvoie a la
    creation — assez pour afficher, filtrer et router, jamais assez pour
    devenir un second annuaire.
    """

    PREFIXE_NUMERO = "DOC"
    TYPE_DOCUMENT = TypeDocument.TOUS

    numero = models.CharField("Numero", max_length=32, unique=True, editable=False)

    #: Le demandeur, fige a la creation. L'identifiant est la cle de decision ;
    #: les numeros servent aux rapprochements et a l'affichage.
    demandeur_identifiant = models.CharField(
        "Demandeur", max_length=150, db_index=True
    )
    demandeur_compte_id = models.PositiveBigIntegerField(
        "Compte du demandeur", null=True, blank=True, db_index=True
    )
    demandeur_agent_id = models.PositiveBigIntegerField(
        "Agent demandeur", null=True, blank=True
    )
    demandeur_nom = models.CharField("Nom du demandeur", max_length=150, blank=True)
    demandeur_departement_id = models.PositiveBigIntegerField(
        "Departement du demandeur", null=True, blank=True, db_index=True
    )
    demandeur_departement_nom = models.CharField(
        "Nom du departement", max_length=120, blank=True
    )

    #: Le responsable du demandeur au moment du depot. C'est lui que vise
    #: l'etape hierarchique, et c'est par lui qu'un encadrant retrouve les
    #: dossiers de son equipe sans jamais interroger l'annuaire.
    responsable_identifiant = models.CharField(
        "Responsable du demandeur", max_length=150, blank=True, db_index=True
    )
    responsable_nom = models.CharField(
        "Nom du responsable", max_length=150, blank=True
    )

    statut = models.CharField(
        "Statut",
        max_length=15,
        choices=StatutDocument.choices,
        default=StatutDocument.BROUILLON,
    )
    date_soumission = models.DateTimeField("Date de soumission", null=True, blank=True)
    motif_rejet = models.TextField("Motif du rejet", blank=True)
    etapes = GenericRelation(EtapeValidation)

    class Meta:
        abstract = True
        ordering = ["-cree_le"]

    def __str__(self):
        return self.numero or f"{self.PREFIXE_NUMERO} (brouillon)"

    def save(self, *args, **kwargs):
        if not self.numero:
            self.numero = generer_numero(self.PREFIXE_NUMERO)
        super().save(*args, **kwargs)

    def appliquer_contexte(self, contexte: dict) -> None:
        """Recopie l'instantane renvoye par `organisation/mon-contexte`."""
        responsable = contexte.get("responsable") or {}
        self.demandeur_identifiant = contexte.get("identifiant", "")
        self.demandeur_compte_id = contexte.get("compte_id")
        self.demandeur_agent_id = contexte.get("agent_id")
        self.demandeur_nom = contexte.get("nom_complet", "")
        self.demandeur_departement_id = contexte.get("departement_id")
        self.demandeur_departement_nom = contexte.get("departement_nom", "")
        self.responsable_identifiant = responsable.get("identifiant", "")
        self.responsable_nom = responsable.get("nom_complet", "")

    @property
    def montant_controle(self):
        """Montant sur lequel s'applique le routage par seuils."""
        return getattr(self, "montant", 0) or 0

    @property
    def etape_courante(self):
        return self.etapes.filter(decision=Decision.EN_ATTENTE).order_by("ordre").first()


class DocumentFinancier(DocumentValidable):
    """Document validable portant un engagement financier."""

    devise = models.CharField(
        "Devise", max_length=3, choices=Devise.choices, default=Devise.XOF
    )

    class Meta(DocumentValidable.Meta):
        abstract = True
