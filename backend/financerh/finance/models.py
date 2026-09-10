from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import Sum

from core.constants import Devise, StatutDocument, TypeDocument
from core.models import DocumentFinancier, TimeStampedModel

AGENT = settings.AUTH_USER_MODEL
MONTANT = {"max_digits": 14, "decimal_places": 2}


class Priorite(models.TextChoices):
    BASSE = "BASSE", "Basse"
    NORMALE = "NORMALE", "Normale"
    HAUTE = "HAUTE", "Haute"
    URGENTE = "URGENTE", "Urgente"


class ModePaiement(models.TextChoices):
    ESPECES = "ESPECES", "Especes"
    CHEQUE = "CHEQUE", "Cheque"
    VIREMENT = "VIREMENT", "Virement bancaire"
    MOBILE = "MOBILE", "Mobile money"


# ---------------------------------------------------------------------------
# Referentiels
# ---------------------------------------------------------------------------


class Fournisseur(TimeStampedModel):
    code = models.CharField(max_length=20, unique=True)
    raison_sociale = models.CharField(max_length=180)
    categorie = models.CharField(max_length=80, blank=True)
    contact = models.CharField(max_length=120, blank=True)
    telephone = models.CharField(max_length=30, blank=True)
    email = models.EmailField(blank=True)
    adresse = models.CharField(max_length=255, blank=True)
    numero_fiscal = models.CharField(max_length=50, blank=True)
    actif = models.BooleanField(default=True)

    class Meta:
        ordering = ["raison_sociale"]
        verbose_name = "Fournisseur"
        verbose_name_plural = "Fournisseurs"

    def __str__(self):
        return self.raison_sociale


class CategorieDepense(TimeStampedModel):
    code = models.CharField(max_length=20, unique=True)
    libelle = models.CharField(max_length=120)
    imputation = models.CharField(
        max_length=40, blank=True, help_text="Compte ou rubrique budgetaire."
    )
    actif = models.BooleanField(default=True)

    class Meta:
        ordering = ["libelle"]
        verbose_name = "Categorie de depense"
        verbose_name_plural = "Categories de depense"

    def __str__(self):
        return self.libelle


# ---------------------------------------------------------------------------
# Requisitions
# ---------------------------------------------------------------------------


class Requisition(DocumentFinancier):
    PREFIXE_NUMERO = "REQ"
    TYPE_DOCUMENT = TypeDocument.REQUISITION

    objet = models.CharField(max_length=200)
    departement = models.ForeignKey(
        "accounts.Departement", null=True, blank=True, on_delete=models.SET_NULL,
        related_name="requisitions",
    )
    justification = models.TextField(blank=True)
    date_besoin = models.DateField(null=True, blank=True)
    priorite = models.CharField(
        max_length=10, choices=Priorite.choices, default=Priorite.NORMALE
    )
    montant = models.DecimalField(default=Decimal("0"), **MONTANT)

    class Meta(DocumentFinancier.Meta):
        verbose_name = "Requisition"
        verbose_name_plural = "Requisitions"

    def recalculer_montant(self):
        total = self.lignes.aggregate(total=Sum("montant"))["total"] or Decimal("0")
        if total != self.montant:
            self.montant = total
            self.save(update_fields=["montant", "modifie_le"])
        return self.montant


class LigneRequisition(TimeStampedModel):
    requisition = models.ForeignKey(
        Requisition, on_delete=models.CASCADE, related_name="lignes"
    )
    designation = models.CharField(max_length=200)
    quantite = models.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal("1"),
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    unite = models.CharField(max_length=20, blank=True)
    prix_unitaire = models.DecimalField(default=Decimal("0"), **MONTANT)
    montant = models.DecimalField(default=Decimal("0"), editable=False, **MONTANT)

    class Meta:
        ordering = ["id"]
        verbose_name = "Ligne de requisition"
        verbose_name_plural = "Lignes de requisition"

    def __str__(self):
        return f"{self.designation} x{self.quantite}"

    def save(self, *args, **kwargs):
        self.montant = (self.quantite or 0) * (self.prix_unitaire or 0)
        super().save(*args, **kwargs)
        self.requisition.recalculer_montant()

    def delete(self, *args, **kwargs):
        requisition = self.requisition
        super().delete(*args, **kwargs)
        requisition.recalculer_montant()


# ---------------------------------------------------------------------------
# Demandes de prix et achats
# ---------------------------------------------------------------------------


class StatutDemandePrix(models.TextChoices):
    OUVERTE = "OUVERTE", "Ouverte"
    EN_ANALYSE = "EN_ANALYSE", "En analyse"
    ATTRIBUEE = "ATTRIBUEE", "Attribuee"
    INFRUCTUEUSE = "INFRUCTUEUSE", "Infructueuse"


class DemandePrix(TimeStampedModel):
    numero = models.CharField(max_length=32, unique=True, editable=False)
    requisition = models.ForeignKey(
        Requisition, null=True, blank=True, on_delete=models.SET_NULL,
        related_name="demandes_prix",
    )
    objet = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    date_lancement = models.DateField(null=True, blank=True)
    date_limite = models.DateField(null=True, blank=True)
    critere_attribution = models.CharField(
        max_length=120, default="Mieux-disant (prix et delai)"
    )
    statut = models.CharField(
        max_length=14, choices=StatutDemandePrix.choices, default=StatutDemandePrix.OUVERTE
    )
    acheteur = models.ForeignKey(
        AGENT, null=True, blank=True, on_delete=models.SET_NULL, related_name="demandes_prix"
    )

    class Meta:
        ordering = ["-cree_le"]
        verbose_name = "Demande de prix"
        verbose_name_plural = "Demandes de prix"

    def __str__(self):
        return f"{self.numero} - {self.objet}"

    def save(self, *args, **kwargs):
        if not self.numero:
            from core.models import generer_numero

            self.numero = generer_numero("DP")
        super().save(*args, **kwargs)

    @property
    def offre_retenue(self):
        return self.offres.filter(retenue=True).first()


class OffreFournisseur(TimeStampedModel):
    demande_prix = models.ForeignKey(
        DemandePrix, on_delete=models.CASCADE, related_name="offres"
    )
    fournisseur = models.ForeignKey(
        Fournisseur, on_delete=models.PROTECT, related_name="offres"
    )
    montant = models.DecimalField(**MONTANT)
    devise = models.CharField(max_length=3, choices=Devise.choices, default=Devise.XOF)
    delai_livraison_jours = models.PositiveSmallIntegerField(default=0)
    conditions_paiement = models.CharField(max_length=150, blank=True)
    note_technique = models.PositiveSmallIntegerField(
        default=0, help_text="Appreciation technique sur 20."
    )
    retenue = models.BooleanField(default=False)
    commentaire = models.TextField(blank=True)

    class Meta:
        unique_together = ("demande_prix", "fournisseur")
        ordering = ["montant"]
        verbose_name = "Offre fournisseur"
        verbose_name_plural = "Offres fournisseurs"

    def __str__(self):
        return f"{self.fournisseur} - {self.montant}"


class BonCommande(DocumentFinancier):
    PREFIXE_NUMERO = "BC"
    TYPE_DOCUMENT = TypeDocument.BON_COMMANDE

    requisition = models.ForeignKey(
        Requisition, null=True, blank=True, on_delete=models.SET_NULL,
        related_name="bons_commande",
    )
    demande_prix = models.ForeignKey(
        DemandePrix, null=True, blank=True, on_delete=models.SET_NULL,
        related_name="bons_commande",
    )
    fournisseur = models.ForeignKey(
        Fournisseur, on_delete=models.PROTECT, related_name="bons_commande"
    )
    objet = models.CharField(max_length=200)
    montant = models.DecimalField(**MONTANT)
    date_livraison_prevue = models.DateField(null=True, blank=True)
    date_livraison_reelle = models.DateField(null=True, blank=True)
    conditions = models.TextField(blank=True)

    class Meta(DocumentFinancier.Meta):
        verbose_name = "Bon de commande"
        verbose_name_plural = "Bons de commande"


# ---------------------------------------------------------------------------
# Caisse et depenses
# ---------------------------------------------------------------------------


class Caisse(TimeStampedModel):
    code = models.CharField(max_length=20, unique=True)
    libelle = models.CharField(max_length=120)
    responsable = models.ForeignKey(
        AGENT, null=True, blank=True, on_delete=models.SET_NULL, related_name="caisses"
    )
    devise = models.CharField(max_length=3, choices=Devise.choices, default=Devise.XOF)
    solde_initial = models.DecimalField(default=Decimal("0"), **MONTANT)
    plafond_alerte = models.DecimalField(
        default=Decimal("0"), help_text="Seuil declenchant une alerte de reapprovisionnement.",
        **MONTANT,
    )
    actif = models.BooleanField(default=True)

    class Meta:
        ordering = ["libelle"]
        verbose_name = "Caisse"
        verbose_name_plural = "Caisses"

    def __str__(self):
        return f"{self.code} - {self.libelle}"

    @property
    def total_decaisse(self):
        return self.sorties.filter(statut=StatutDocument.CLOTURE).aggregate(
            total=Sum("montant")
        )["total"] or Decimal("0")

    @property
    def total_approvisionne(self):
        return self.approvisionnements.aggregate(total=Sum("montant"))["total"] or Decimal("0")

    @property
    def solde_actuel(self):
        return self.solde_initial + self.total_approvisionne - self.total_decaisse

    @property
    def sous_alerte(self):
        return self.solde_actuel <= self.plafond_alerte


class ApprovisionnementCaisse(TimeStampedModel):
    caisse = models.ForeignKey(
        Caisse, on_delete=models.CASCADE, related_name="approvisionnements"
    )
    montant = models.DecimalField(**MONTANT)
    date_operation = models.DateField()
    reference = models.CharField(max_length=60, blank=True)
    commentaire = models.CharField(max_length=255, blank=True)
    enregistre_par = models.ForeignKey(
        AGENT, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )

    class Meta:
        ordering = ["-date_operation"]
        verbose_name = "Approvisionnement de caisse"
        verbose_name_plural = "Approvisionnements de caisse"

    def __str__(self):
        return f"{self.caisse} + {self.montant}"


class SortieCaisse(DocumentFinancier):
    PREFIXE_NUMERO = "SC"
    TYPE_DOCUMENT = TypeDocument.SORTIE_CAISSE

    caisse = models.ForeignKey(Caisse, on_delete=models.PROTECT, related_name="sorties")
    categorie = models.ForeignKey(
        CategorieDepense, null=True, blank=True, on_delete=models.SET_NULL,
        related_name="sorties_caisse",
    )
    beneficiaire = models.CharField(max_length=180)
    beneficiaire_agent = models.ForeignKey(
        AGENT, null=True, blank=True, on_delete=models.SET_NULL, related_name="sorties_recues"
    )
    motif = models.TextField()
    montant = models.DecimalField(**MONTANT)
    date_sortie = models.DateField()
    piece_justificative = models.FileField(
        upload_to="justificatifs/caisse/", null=True, blank=True
    )
    date_decaissement = models.DateTimeField(null=True, blank=True)
    decaisse_par = models.ForeignKey(
        AGENT, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )

    class Meta(DocumentFinancier.Meta):
        verbose_name = "Sortie de caisse"
        verbose_name_plural = "Sorties de caisse"


class Depense(DocumentFinancier):
    PREFIXE_NUMERO = "DEP"
    TYPE_DOCUMENT = TypeDocument.DEPENSE

    categorie = models.ForeignKey(
        CategorieDepense, on_delete=models.PROTECT, related_name="depenses"
    )
    departement = models.ForeignKey(
        "accounts.Departement", null=True, blank=True, on_delete=models.SET_NULL,
        related_name="depenses",
    )
    fournisseur = models.ForeignKey(
        Fournisseur, null=True, blank=True, on_delete=models.SET_NULL, related_name="depenses"
    )
    libelle = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    montant = models.DecimalField(**MONTANT)
    date_depense = models.DateField()
    mode_paiement = models.CharField(
        max_length=10, choices=ModePaiement.choices, default=ModePaiement.VIREMENT
    )
    reference_paiement = models.CharField(max_length=80, blank=True)
    piece_justificative = models.FileField(
        upload_to="justificatifs/depenses/", null=True, blank=True
    )

    class Meta(DocumentFinancier.Meta):
        verbose_name = "Depense"
        verbose_name_plural = "Depenses"


# ---------------------------------------------------------------------------
# Missions, perdiems et frais
# ---------------------------------------------------------------------------


class ZoneMission(models.TextChoices):
    LOCALE = "LOCALE", "Locale (meme ville)"
    NATIONALE = "NATIONALE", "Nationale"
    SOUS_REGION = "SOUS_REGION", "Sous-region"
    INTERNATIONALE = "INTERNATIONALE", "Internationale"


class BaremePerdiem(TimeStampedModel):
    """Montant journalier de perdiem par zone et par niveau de responsabilite."""

    libelle = models.CharField(max_length=120)
    zone = models.CharField(max_length=15, choices=ZoneMission.choices)
    role_agent = models.CharField(
        max_length=20, blank=True, help_text="Vide = applicable a tous les roles."
    )
    montant_jour = models.DecimalField(**MONTANT)
    devise = models.CharField(max_length=3, choices=Devise.choices, default=Devise.XOF)
    actif = models.BooleanField(default=True)

    class Meta:
        ordering = ["zone", "-montant_jour"]
        verbose_name = "Bareme de perdiem"
        verbose_name_plural = "Baremes de perdiem"

    def __str__(self):
        return f"{self.libelle} ({self.montant_jour}/jour)"


class Mission(DocumentFinancier):
    PREFIXE_NUMERO = "MIS"
    TYPE_DOCUMENT = TypeDocument.MISSION

    objet = models.CharField(max_length=200)
    destination = models.CharField(max_length=150)
    zone = models.CharField(
        max_length=15, choices=ZoneMission.choices, default=ZoneMission.NATIONALE
    )
    date_depart = models.DateField()
    date_retour = models.DateField()
    moyen_transport = models.CharField(max_length=80, blank=True)
    participants = models.ManyToManyField(
        AGENT, blank=True, related_name="missions_participees"
    )
    bareme = models.ForeignKey(
        BaremePerdiem, null=True, blank=True, on_delete=models.SET_NULL, related_name="missions"
    )
    nb_jours = models.PositiveSmallIntegerField(default=1)
    montant_perdiem = models.DecimalField(default=Decimal("0"), **MONTANT)
    frais_transport = models.DecimalField(default=Decimal("0"), **MONTANT)
    frais_hebergement = models.DecimalField(default=Decimal("0"), **MONTANT)
    autres_frais = models.DecimalField(default=Decimal("0"), **MONTANT)
    montant = models.DecimalField(default=Decimal("0"), editable=False, **MONTANT)
    rapport = models.TextField(blank=True)
    date_rapport = models.DateField(null=True, blank=True)

    class Meta(DocumentFinancier.Meta):
        verbose_name = "Mission"
        verbose_name_plural = "Missions"

    def save(self, *args, **kwargs):
        self.nb_jours = max((self.date_retour - self.date_depart).days + 1, 1)
        if self.bareme:
            self.montant_perdiem = self.bareme.montant_jour * self.nb_jours
        self.montant = (
            self.montant_perdiem
            + self.frais_transport
            + self.frais_hebergement
            + self.autres_frais
        )
        super().save(*args, **kwargs)


class LigneFraisMission(TimeStampedModel):
    """Justificatif de depense engage pendant la mission, saisi au retour."""

    mission = models.ForeignKey(Mission, on_delete=models.CASCADE, related_name="frais")
    libelle = models.CharField(max_length=180)
    categorie = models.ForeignKey(
        CategorieDepense, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    montant = models.DecimalField(**MONTANT)
    date_depense = models.DateField()
    justificatif = models.FileField(upload_to="justificatifs/missions/", null=True, blank=True)
    valide = models.BooleanField(default=False)

    class Meta:
        ordering = ["date_depense"]
        verbose_name = "Ligne de frais de mission"
        verbose_name_plural = "Lignes de frais de mission"

    def __str__(self):
        return f"{self.libelle} - {self.montant}"


class Prestation(DocumentFinancier):
    PREFIXE_NUMERO = "PRE"
    TYPE_DOCUMENT = TypeDocument.PRESTATION

    prestataire = models.ForeignKey(
        Fournisseur, on_delete=models.PROTECT, related_name="prestations"
    )
    objet = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    date_debut = models.DateField()
    date_fin = models.DateField(null=True, blank=True)
    montant = models.DecimalField(**MONTANT)
    livrables = models.TextField(blank=True)
    taux_execution = models.PositiveSmallIntegerField(
        default=0, help_text="Avancement de la prestation en pourcentage."
    )

    class Meta(DocumentFinancier.Meta):
        verbose_name = "Prestation"
        verbose_name_plural = "Prestations"


# ---------------------------------------------------------------------------
# Forfaits de communication
# ---------------------------------------------------------------------------


class TypeForfait(models.TextChoices):
    VOIX = "VOIX", "Voix"
    DATA = "DATA", "Internet / data"
    MIXTE = "MIXTE", "Voix + data"


class ForfaitCommunication(TimeStampedModel):
    agent = models.ForeignKey(AGENT, on_delete=models.CASCADE, related_name="forfaits")
    operateur = models.CharField(max_length=60)
    numero_ligne = models.CharField(max_length=30)
    type_forfait = models.CharField(
        max_length=6, choices=TypeForfait.choices, default=TypeForfait.MIXTE
    )
    montant_mensuel = models.DecimalField(**MONTANT)
    devise = models.CharField(max_length=3, choices=Devise.choices, default=Devise.XOF)
    date_debut = models.DateField()
    date_fin = models.DateField(null=True, blank=True)
    actif = models.BooleanField(default=True)

    class Meta:
        ordering = ["agent"]
        verbose_name = "Forfait de communication"
        verbose_name_plural = "Forfaits de communication"

    def __str__(self):
        return f"{self.agent} - {self.numero_ligne}"


class ConsommationCommunication(TimeStampedModel):
    forfait = models.ForeignKey(
        ForfaitCommunication, on_delete=models.CASCADE, related_name="consommations"
    )
    mois = models.DateField(help_text="Premier jour du mois concerne.")
    montant_consomme = models.DecimalField(**MONTANT)
    commentaire = models.CharField(max_length=255, blank=True)

    class Meta:
        unique_together = ("forfait", "mois")
        ordering = ["-mois"]
        verbose_name = "Consommation communication"
        verbose_name_plural = "Consommations communication"

    def __str__(self):
        return f"{self.forfait} - {self.mois:%m/%Y}"

    @property
    def depassement(self):
        return max(self.montant_consomme - self.forfait.montant_mensuel, Decimal("0"))
