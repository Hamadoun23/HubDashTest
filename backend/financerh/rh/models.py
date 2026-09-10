from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone

from core.constants import TypeDocument
from core.models import DocumentValidable, TimeStampedModel

AGENT = settings.AUTH_USER_MODEL


# ---------------------------------------------------------------------------
# Conges, absences, retards et permissions
# ---------------------------------------------------------------------------


class CategorieAbsence(models.TextChoices):
    CONGE = "CONGE", "Conge"
    ABSENCE = "ABSENCE", "Absence"
    RETARD = "RETARD", "Retard"
    PERMISSION = "PERMISSION", "Permission"


class TypeAbsence(TimeStampedModel):
    code = models.CharField(max_length=16, unique=True)
    libelle = models.CharField(max_length=120)
    categorie = models.CharField(max_length=12, choices=CategorieAbsence.choices)
    decompte_solde = models.BooleanField(
        default=True, help_text="Deduit du solde de conges annuel."
    )
    duree_max_jours = models.PositiveSmallIntegerField(null=True, blank=True)
    justificatif_requis = models.BooleanField(default=False)
    actif = models.BooleanField(default=True)

    class Meta:
        ordering = ["categorie", "libelle"]
        verbose_name = "Type d'absence"
        verbose_name_plural = "Types d'absence"

    def __str__(self):
        return self.libelle


class SoldeConge(TimeStampedModel):
    agent = models.ForeignKey(AGENT, on_delete=models.CASCADE, related_name="soldes_conges")
    annee = models.PositiveIntegerField()
    jours_acquis = models.DecimalField(max_digits=5, decimal_places=1, default=Decimal("30.0"))
    jours_reportes = models.DecimalField(max_digits=5, decimal_places=1, default=Decimal("0.0"))
    jours_pris = models.DecimalField(max_digits=5, decimal_places=1, default=Decimal("0.0"))

    class Meta:
        unique_together = ("agent", "annee")
        ordering = ["-annee", "agent"]
        verbose_name = "Solde de conges"
        verbose_name_plural = "Soldes de conges"

    def __str__(self):
        return f"{self.agent} - {self.annee} : {self.jours_restants} j"

    @property
    def jours_restants(self):
        return self.jours_acquis + self.jours_reportes - self.jours_pris


class DemandeAbsence(DocumentValidable):
    """Demande de conge, absence, retard ou permission.

    Passe par le meme moteur de validation que les documents finance, avec
    les regles configurees sur le type de document ``ABSENCE``.
    """

    PREFIXE_NUMERO = "ABS"
    TYPE_DOCUMENT = TypeDocument.ABSENCE

    type_absence = models.ForeignKey(
        TypeAbsence, on_delete=models.PROTECT, related_name="demandes"
    )
    date_debut = models.DateField()
    date_fin = models.DateField()
    demi_journee = models.BooleanField(
        default=False, help_text="Absence d'une demi-journee seulement."
    )
    heure_debut = models.TimeField(
        null=True, blank=True, help_text="Pour les retards et permissions horaires."
    )
    heure_fin = models.TimeField(null=True, blank=True)
    nb_jours = models.DecimalField(max_digits=5, decimal_places=1, default=Decimal("0.0"))
    motif = models.TextField()
    justificatif = models.FileField(upload_to="justificatifs/absences/", null=True, blank=True)
    remplacant = models.ForeignKey(
        AGENT, null=True, blank=True, on_delete=models.SET_NULL, related_name="remplacements"
    )

    class Meta(DocumentValidable.Meta):
        verbose_name = "Demande d'absence"
        verbose_name_plural = "Demandes d'absence"

    def calculer_nb_jours(self):
        if self.demi_journee:
            return Decimal("0.5")
        jours = (self.date_fin - self.date_debut).days + 1
        return Decimal(max(jours, 0))

    def save(self, *args, **kwargs):
        self.nb_jours = self.calculer_nb_jours()
        super().save(*args, **kwargs)

    def apres_approbation(self):
        """Repercute l'absence approuvee sur le solde et le suivi des presences."""
        if self.type_absence.decompte_solde:
            solde, _ = SoldeConge.objects.get_or_create(
                agent=self.demandeur, annee=self.date_debut.year
            )
            solde.jours_pris += self.nb_jours
            solde.save(update_fields=["jours_pris", "modifie_le"])

        if self.type_absence.categorie == CategorieAbsence.RETARD:
            return

        statut = (
            StatutPresence.CONGE
            if self.type_absence.categorie == CategorieAbsence.CONGE
            else StatutPresence.ABSENT
        )
        jour = self.date_debut
        while jour <= self.date_fin:
            Presence.objects.update_or_create(
                agent=self.demandeur,
                date=jour,
                defaults={
                    "statut": statut,
                    "commentaire": f"{self.type_absence.libelle} ({self.numero})",
                },
            )
            jour += timedelta(days=1)


# ---------------------------------------------------------------------------
# Suivi des presences
# ---------------------------------------------------------------------------


class StatutPresence(models.TextChoices):
    PRESENT = "PRESENT", "Present"
    RETARD = "RETARD", "En retard"
    ABSENT = "ABSENT", "Absent"
    CONGE = "CONGE", "En conge"
    MISSION = "MISSION", "En mission"
    TELETRAVAIL = "TELETRAVAIL", "Teletravail"
    REPOS = "REPOS", "Repos / ferie"


class Presence(TimeStampedModel):
    HEURE_REFERENCE_ARRIVEE = "08:00"

    agent = models.ForeignKey(AGENT, on_delete=models.CASCADE, related_name="presences")
    date = models.DateField(default=timezone.localdate)
    heure_arrivee = models.TimeField(null=True, blank=True)
    heure_depart = models.TimeField(null=True, blank=True)
    statut = models.CharField(
        max_length=12, choices=StatutPresence.choices, default=StatutPresence.PRESENT
    )
    retard_minutes = models.PositiveIntegerField(default=0)
    commentaire = models.CharField(max_length=255, blank=True)
    saisi_par = models.ForeignKey(
        AGENT, null=True, blank=True, on_delete=models.SET_NULL, related_name="pointages_saisis"
    )

    class Meta:
        unique_together = ("agent", "date")
        ordering = ["-date", "agent"]
        verbose_name = "Presence"
        verbose_name_plural = "Presences"

    def __str__(self):
        return f"{self.agent} - {self.date} ({self.get_statut_display()})"

    @property
    def heures_travaillees(self):
        if not (self.heure_arrivee and self.heure_depart):
            return Decimal("0.0")
        debut = timedelta(hours=self.heure_arrivee.hour, minutes=self.heure_arrivee.minute)
        fin = timedelta(hours=self.heure_depart.hour, minutes=self.heure_depart.minute)
        heures = (fin - debut).total_seconds() / 3600
        return Decimal(str(round(max(heures, 0), 2)))


# ---------------------------------------------------------------------------
# Evaluations et performance
# ---------------------------------------------------------------------------


class StatutCampagne(models.TextChoices):
    PREPARATION = "PREPARATION", "En preparation"
    OUVERTE = "OUVERTE", "Ouverte"
    CLOTUREE = "CLOTUREE", "Cloturee"


class CampagneEvaluation(TimeStampedModel):
    libelle = models.CharField(max_length=150)
    periode_debut = models.DateField()
    periode_fin = models.DateField()
    date_limite = models.DateField(null=True, blank=True)
    statut = models.CharField(
        max_length=12, choices=StatutCampagne.choices, default=StatutCampagne.PREPARATION
    )
    consignes = models.TextField(blank=True)

    class Meta:
        ordering = ["-periode_debut"]
        verbose_name = "Campagne d'evaluation"
        verbose_name_plural = "Campagnes d'evaluation"

    def __str__(self):
        return self.libelle


class CritereEvaluation(TimeStampedModel):
    campagne = models.ForeignKey(
        CampagneEvaluation, on_delete=models.CASCADE, related_name="criteres"
    )
    libelle = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    poids = models.PositiveSmallIntegerField(
        default=1, validators=[MinValueValidator(1), MaxValueValidator(10)]
    )

    class Meta:
        ordering = ["id"]
        verbose_name = "Critere d'evaluation"
        verbose_name_plural = "Criteres d'evaluation"

    def __str__(self):
        return self.libelle


class StatutEvaluation(models.TextChoices):
    A_FAIRE = "A_FAIRE", "A faire"
    AUTO_EVALUATION = "AUTO_EVALUATION", "Auto-evaluation en cours"
    EVALUEE = "EVALUEE", "Evaluee par le manager"
    VALIDEE = "VALIDEE", "Validee RH"


class Evaluation(TimeStampedModel):
    campagne = models.ForeignKey(
        CampagneEvaluation, on_delete=models.CASCADE, related_name="evaluations"
    )
    agent = models.ForeignKey(AGENT, on_delete=models.CASCADE, related_name="evaluations")
    evaluateur = models.ForeignKey(
        AGENT, null=True, blank=True, on_delete=models.SET_NULL, related_name="evaluations_menees"
    )
    statut = models.CharField(
        max_length=16, choices=StatutEvaluation.choices, default=StatutEvaluation.A_FAIRE
    )
    note_globale = models.DecimalField(
        max_digits=4, decimal_places=2, null=True, blank=True,
        help_text="Note ponderee sur 5, calculee a partir des criteres.",
    )
    points_forts = models.TextField(blank=True)
    axes_amelioration = models.TextField(blank=True)
    objectifs = models.TextField(blank=True)
    commentaire_agent = models.TextField(blank=True)
    date_entretien = models.DateField(null=True, blank=True)

    class Meta:
        unique_together = ("campagne", "agent")
        ordering = ["-campagne__periode_debut", "agent"]
        verbose_name = "Evaluation"
        verbose_name_plural = "Evaluations"

    def __str__(self):
        return f"{self.agent} - {self.campagne}"

    def recalculer_note(self):
        notes = list(self.notes.select_related("critere"))
        total_poids = sum(note.critere.poids for note in notes)
        if not total_poids:
            self.note_globale = None
        else:
            pondere = sum(Decimal(note.note) * note.critere.poids for note in notes)
            self.note_globale = (pondere / total_poids).quantize(Decimal("0.01"))
        self.save(update_fields=["note_globale", "modifie_le"])
        return self.note_globale


class NoteCritere(TimeStampedModel):
    evaluation = models.ForeignKey(Evaluation, on_delete=models.CASCADE, related_name="notes")
    critere = models.ForeignKey(CritereEvaluation, on_delete=models.CASCADE, related_name="notes")
    note = models.DecimalField(
        max_digits=3,
        decimal_places=1,
        validators=[MinValueValidator(0), MaxValueValidator(5)],
        help_text="Note de 0 a 5.",
    )
    commentaire = models.TextField(blank=True)

    class Meta:
        unique_together = ("evaluation", "critere")
        ordering = ["critere_id"]
        verbose_name = "Note par critere"
        verbose_name_plural = "Notes par critere"

    def __str__(self):
        return f"{self.critere} : {self.note}/5"


# ---------------------------------------------------------------------------
# Planning des formations
# ---------------------------------------------------------------------------


class StatutFormation(models.TextChoices):
    PLANIFIEE = "PLANIFIEE", "Planifiee"
    EN_COURS = "EN_COURS", "En cours"
    TERMINEE = "TERMINEE", "Terminee"
    ANNULEE = "ANNULEE", "Annulee"


class Formation(TimeStampedModel):
    titre = models.CharField(max_length=180)
    categorie = models.CharField(max_length=80, blank=True)
    description = models.TextField(blank=True)
    formateur = models.CharField(max_length=150, blank=True)
    organisme = models.CharField(max_length=150, blank=True)
    lieu = models.CharField(max_length=150, blank=True)
    date_debut = models.DateField()
    date_fin = models.DateField()
    places = models.PositiveSmallIntegerField(default=20)
    obligatoire = models.BooleanField(default=False)
    departements_cibles = models.ManyToManyField(
        "accounts.Departement", blank=True, related_name="formations"
    )
    statut = models.CharField(
        max_length=12, choices=StatutFormation.choices, default=StatutFormation.PLANIFIEE
    )

    class Meta:
        ordering = ["date_debut"]
        verbose_name = "Formation"
        verbose_name_plural = "Formations"

    def __str__(self):
        return self.titre

    @property
    def places_restantes(self):
        prises = self.inscriptions.exclude(statut=StatutInscription.REFUSE).count()
        return max(self.places - prises, 0)


class StatutInscription(models.TextChoices):
    DEMANDE = "DEMANDE", "Demande"
    CONFIRME = "CONFIRME", "Confirmee"
    REFUSE = "REFUSE", "Refusee"
    PRESENT = "PRESENT", "Presence confirmee"
    ABSENT = "ABSENT", "Absent"


class InscriptionFormation(TimeStampedModel):
    formation = models.ForeignKey(
        Formation, on_delete=models.CASCADE, related_name="inscriptions"
    )
    agent = models.ForeignKey(AGENT, on_delete=models.CASCADE, related_name="formations_suivies")
    statut = models.CharField(
        max_length=10, choices=StatutInscription.choices, default=StatutInscription.DEMANDE
    )
    note_satisfaction = models.PositiveSmallIntegerField(
        null=True, blank=True, validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    commentaire = models.TextField(blank=True)

    class Meta:
        unique_together = ("formation", "agent")
        ordering = ["-cree_le"]
        verbose_name = "Inscription a une formation"
        verbose_name_plural = "Inscriptions aux formations"

    def __str__(self):
        return f"{self.agent} -> {self.formation}"
