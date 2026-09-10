from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey, GenericRelation
from django.contrib.contenttypes.models import ContentType
from django.core.validators import MinValueValidator
from django.db import models, transaction
from django.utils import timezone

from core.constants import (
    Decision,
    Devise,
    NatureEtape,
    Role,
    StatutDocument,
    TypeDocument,
)


class TimeStampedModel(models.Model):
    cree_le = models.DateTimeField(auto_now_add=True)
    modifie_le = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class CompteurDocument(models.Model):
    """Compteur atomique par prefixe et par annee pour la numerotation metier."""

    prefixe = models.CharField(max_length=16)
    annee = models.PositiveIntegerField()
    valeur = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = ("prefixe", "annee")
        verbose_name = "Compteur de document"
        verbose_name_plural = "Compteurs de documents"

    def __str__(self):
        return f"{self.prefixe}-{self.annee}: {self.valeur}"


def generer_numero(prefixe: str) -> str:
    """Retourne un numero unique du type ``REQ-2026-0007``."""
    annee = timezone.localdate().year
    with transaction.atomic():
        compteur, _ = CompteurDocument.objects.select_for_update().get_or_create(
            prefixe=prefixe, annee=annee
        )
        compteur.valeur += 1
        compteur.save(update_fields=["valeur"])
    return f"{prefixe}-{annee}-{compteur.valeur:04d}"


class SeuilValidation(TimeStampedModel):
    """Regle de routage : qui doit valider, pour quel montant, dans quel ordre.

    Le circuit d'un document est la liste des seuils actifs dont la fourchette
    de montant contient le montant du document, tries par ``ordre``.
    """

    libelle = models.CharField(max_length=120)
    type_document = models.CharField(
        max_length=20, choices=TypeDocument.choices, default=TypeDocument.TOUS
    )
    montant_min = models.DecimalField(
        max_digits=14, decimal_places=2, default=0, validators=[MinValueValidator(0)]
    )
    montant_max = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Vide = pas de plafond.",
    )
    role_valideur = models.CharField(max_length=20, choices=Role.choices)
    ordre = models.PositiveSmallIntegerField(
        default=1, help_text="Position dans le circuit (1 = premier valideur)."
    )
    valideur_hierarchique = models.BooleanField(
        default=False,
        help_text=(
            "Si coche, l'etape revient au responsable du departement du "
            "demandeur, ou a defaut a son manager direct."
        ),
    )
    valideur_designe = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
        help_text=(
            "Personne nommement chargee de cette etape, par exemple le "
            "Directeur General pour un dernier mot. Prioritaire sur le "
            "valideur hierarchique et sur le role."
        ),
    )
    nature = models.CharField(
        max_length=12,
        choices=NatureEtape.choices,
        default=NatureEtape.DECISION,
        help_text=(
            "Decision : un refus arrete le dossier. Avis : un refus est "
            "consigne puis transmis a l'etape suivante, qui tranche. "
            "Information : l'etape est franchie a la soumission, le service "
            "est seulement tenu au courant."
        ),
    )
    actif = models.BooleanField(default=True)

    class Meta:
        ordering = ["type_document", "ordre", "montant_min"]
        verbose_name = "Seuil de validation"
        verbose_name_plural = "Seuils de validation"

    def __str__(self):
        plafond = f"{self.montant_max:,.0f}" if self.montant_max is not None else "∞"
        return f"[{self.ordre}] {self.libelle} ({self.montant_min:,.0f} - {plafond})"

    def couvre(self, montant) -> bool:
        if montant is None:
            montant = 0
        if montant < self.montant_min:
            return False
        return self.montant_max is None or montant <= self.montant_max


class EtapeValidation(TimeStampedModel):
    """Une etape du circuit, rattachee a n'importe quel document validable."""

    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    document = GenericForeignKey("content_type", "object_id")

    ordre = models.PositiveSmallIntegerField(default=1)
    libelle = models.CharField(max_length=120)
    role_valideur = models.CharField(max_length=20, choices=Role.choices)
    valideur_attendu = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="etapes_a_valider",
        help_text="Renseigne pour les etapes hierarchiques (manager direct).",
    )
    nature = models.CharField(
        max_length=12,
        choices=NatureEtape.choices,
        default=NatureEtape.DECISION,
        help_text="Recopie du seuil au moment ou le circuit est construit.",
    )
    decision = models.CharField(
        max_length=12, choices=Decision.choices, default=Decision.EN_ATTENTE
    )
    decide_par = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="etapes_decidees",
    )
    date_decision = models.DateTimeField(null=True, blank=True)
    commentaire = models.TextField(blank=True)

    class Meta:
        ordering = ["ordre", "id"]
        indexes = [models.Index(fields=["content_type", "object_id"])]
        verbose_name = "Etape de validation"
        verbose_name_plural = "Etapes de validation"

    def __str__(self):
        return f"{self.libelle} - {self.get_decision_display()}"

    def peut_etre_decidee_par(self, user) -> bool:
        """Aucun role ne court-circuite le circuit, Direction comprise.

        La Direction n'intervient que sur les etapes qui lui reviennent :
        laisser un profil sauter des etapes viderait la piste d'audit de son
        sens. Elle reste le valideur de repli des etapes hierarchiques d'un
        demandeur sans responsable, via ``role_valideur``.
        """
        if self.decision != Decision.EN_ATTENTE:
            return False
        # Nul ne tranche sur son propre dossier. La construction du circuit
        # ecarte deja ces etapes ; ce garde-fou couvre les circuits construits
        # avant un changement de role ou de rattachement.
        document = self.document
        if document is not None and document.demandeur_id == user.id:
            return False
        if self.valideur_attendu_id:
            return self.valideur_attendu_id == user.id
        return user.role == self.role_valideur


class DocumentValidable(TimeStampedModel):
    """Base de tout document soumis a un circuit de validation."""

    PREFIXE_NUMERO = "DOC"
    TYPE_DOCUMENT = TypeDocument.TOUS

    numero = models.CharField(max_length=32, unique=True, editable=False)
    demandeur = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+"
    )
    statut = models.CharField(
        max_length=15, choices=StatutDocument.choices, default=StatutDocument.BROUILLON
    )
    date_soumission = models.DateTimeField(null=True, blank=True)
    motif_rejet = models.TextField(blank=True)
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

    @property
    def montant_controle(self):
        """Montant sur lequel s'applique le routage par seuils."""
        return getattr(self, "montant", 0) or 0

    @property
    def etape_courante(self):
        return self.etapes.filter(decision=Decision.EN_ATTENTE).order_by("ordre").first()


class DocumentFinancier(DocumentValidable):
    """Document validable portant un engagement financier."""

    devise = models.CharField(max_length=3, choices=Devise.choices, default=Devise.XOF)

    class Meta(DocumentValidable.Meta):
        abstract = True
