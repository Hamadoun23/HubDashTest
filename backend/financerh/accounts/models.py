from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone

from core.constants import Role
from core.models import TimeStampedModel


class Departement(TimeStampedModel):
    code = models.CharField(max_length=12, unique=True)
    nom = models.CharField(max_length=120)
    responsable = models.ForeignKey(
        "accounts.Utilisateur",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="departements_diriges",
    )

    class Meta:
        ordering = ["nom"]
        verbose_name = "Departement"
        verbose_name_plural = "Departements"

    def __str__(self):
        return f"{self.code} - {self.nom}"

    @property
    def effectif(self):
        return self.agents.filter(is_active=True).count()


class TypeContrat(models.TextChoices):
    CDI = "CDI", "CDI"
    CDD = "CDD", "CDD"
    STAGE = "STAGE", "Stage"
    PRESTATAIRE = "PRESTATAIRE", "Prestataire"


class MotifSortie(models.TextChoices):
    DEMISSION = "DEMISSION", "Demission"
    LICENCIEMENT = "LICENCIEMENT", "Licenciement"
    FIN_CONTRAT = "FIN_CONTRAT", "Fin de contrat"
    RETRAITE = "RETRAITE", "Retraite"
    AUTRE = "AUTRE", "Autre"


class Utilisateur(AbstractUser, TimeStampedModel):
    """Agent de l'entreprise. Sert a la fois de compte applicatif et de fiche agent.

    Aucune donnee sensible (salaire, dossier disciplinaire, medical) n'est
    stockee ici : le perimetre de la V1 s'arrete aux donnees non confidentielles.
    """

    matricule = models.CharField(max_length=20, unique=True)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.SALARIE)
    departement = models.ForeignKey(
        Departement, null=True, blank=True, on_delete=models.SET_NULL, related_name="agents"
    )
    manager = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.SET_NULL, related_name="equipe"
    )
    poste = models.CharField(max_length=120, blank=True)
    telephone = models.CharField(max_length=30, blank=True)
    type_contrat = models.CharField(
        max_length=15, choices=TypeContrat.choices, default=TypeContrat.CDI
    )
    date_embauche = models.DateField(null=True, blank=True)
    date_sortie = models.DateField(null=True, blank=True)
    motif_sortie = models.CharField(
        max_length=15, choices=MotifSortie.choices, blank=True
    )

    class Meta:
        ordering = ["last_name", "first_name"]
        verbose_name = "Utilisateur"
        verbose_name_plural = "Utilisateurs"

    def __str__(self):
        return f"{self.get_full_name() or self.username} ({self.matricule})"

    def get_full_name(self):
        return f"{self.first_name} {self.last_name}".strip() or self.username

    def save(self, *args, **kwargs):
        if not self.matricule:
            self.matricule = f"AG{timezone.now().strftime('%y%m%d%H%M%S')}"
        super().save(*args, **kwargs)

    @property
    def anciennete_mois(self):
        if not self.date_embauche:
            return 0
        fin = self.date_sortie or timezone.localdate()
        return (fin.year - self.date_embauche.year) * 12 + (fin.month - self.date_embauche.month)

    @property
    def est_encadrant(self):
        """Des agents lui sont rattaches : il valide leurs demandes."""
        return self.equipe.exists()

    @property
    def est_back_office_rh(self):
        from core.constants import ROLES_RH

        return self.role in ROLES_RH

    @property
    def est_back_office_finance(self):
        from core.constants import ROLES_FINANCE

        return self.role in ROLES_FINANCE
