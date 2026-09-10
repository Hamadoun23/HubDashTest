"""Modeles du service Planning — port fidele des modeles Eloquent de Planning-main.

Aucune cle etrangere vers un modele Utilisateur local : les comptes vivent
uniquement dans le hub (voir `planning/hub.py`). Les champs de statut, les
choix de jours et les methodes de detection (jour non recommande, en retard,
a venir...) reproduisent exactement `app/Models/*.php` de l'application
Laravel d'origine.
"""

from __future__ import annotations

from django.db import models
from django.utils import timezone

JOURS_FR = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]


def jour_semaine_fr(date_ou_datetime) -> str:
    """Meme correspondance que `getDayOfWeekInFrench()` cote Laravel."""
    return JOURS_FR[date_ou_datetime.weekday()]


class ClientPlanning(models.Model):
    """Un client de l'entreprise, pour son planning de contenu (`Client` Laravel)."""

    nom_entreprise = models.CharField(max_length=255, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["nom_entreprise"]
        verbose_name = "Client planning"
        verbose_name_plural = "Clients planning"

    def __str__(self):
        return self.nom_entreprise

    def is_day_not_recommended(self, day_of_week: str) -> bool:
        return self.regles.filter(day_of_week=day_of_week).exists()

    def get_period_stats(self, start_date, end_date):
        """Statistiques sur une periode — fusion de `ClientController::show/dashboard/getStats`."""
        tournages = self.tournages.filter(date__date__gte=start_date, date__date__lte=end_date)
        publications = self.publications.filter(date__date__gte=start_date, date__date__lte=end_date)
        return {
            "total_shootings": tournages.count(),
            "total_publications": publications.count(),
            "pending_shootings": tournages.filter(status="pending").count(),
            "completed_shootings": tournages.filter(status="completed").count(),
            "cancelled_shootings": tournages.filter(status="cancelled").count(),
            "non_realises_shootings": tournages.filter(status__in=["not_realized", "cancelled"]).count(),
            "pending_publications": publications.filter(status="pending").count(),
            "completed_publications": publications.filter(status="completed").count(),
            "cancelled_publications": publications.filter(status="cancelled").count(),
            "non_realises_publications": publications.filter(status__in=["not_realized", "cancelled"]).count(),
            "publication_rules": self.regles.count(),
        }


class ContentIdea(models.Model):
    """Idee de contenu, globale et partagee entre tous les clients."""

    TYPE_CHOICES = [
        ("vidéo", "Vidéo"),
        ("image", "Image"),
        ("texte", "Texte"),
    ]

    titre = models.CharField(max_length=255)
    type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["titre"]
        verbose_name = "Idée de contenu"
        verbose_name_plural = "Idées de contenu"

    def __str__(self):
        return self.titre


STATUT_CHOICES = [
    ("pending", "En attente"),
    ("completed", "Complété"),
    ("cancelled", "Annulé"),
    ("not_realized", "Non réalisé"),
    ("rescheduled", "Reprogrammé"),
]

STATUTS_NECESSITANT_RAISON = {"not_realized", "cancelled", "rescheduled"}


class Shooting(models.Model):
    """Tournage planifie (`Shooting` Laravel)."""

    client = models.ForeignKey(ClientPlanning, on_delete=models.CASCADE, related_name="tournages")
    date = models.DateTimeField()
    status = models.CharField(max_length=20, choices=STATUT_CHOICES, default="pending")
    status_reason = models.TextField(blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    content_ideas = models.ManyToManyField(ContentIdea, related_name="tournages", blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date"]
        verbose_name = "Tournage"
        verbose_name_plural = "Tournages"

    def __str__(self):
        return f"{self.client.nom_entreprise} - {self.date:%d/%m/%Y}"

    def is_overdue(self) -> bool:
        return self.status == "pending" and self.date < timezone.now()

    def is_upcoming(self) -> bool:
        jours = (self.date - timezone.now()).days
        return self.status == "pending" and 0 <= jours <= 3

    def is_completed(self) -> bool:
        return self.status == "completed"

    def requires_action(self) -> bool:
        return self.status in {"not_realized", "cancelled", "rescheduled"}

    def can_be_linked_to_publication(self) -> bool:
        return not self.publications.exists() and self.status not in {"cancelled", "not_realized"}


class Publication(models.Model):
    """Publication planifiee (`Publication` Laravel)."""

    client = models.ForeignKey(ClientPlanning, on_delete=models.CASCADE, related_name="publications")
    date = models.DateTimeField()
    content_idea = models.ForeignKey(
        ContentIdea, on_delete=models.SET_NULL, null=True, related_name="publications"
    )
    shooting = models.ForeignKey(
        Shooting, on_delete=models.SET_NULL, null=True, blank=True, related_name="publications"
    )
    status = models.CharField(max_length=20, choices=STATUT_CHOICES, default="pending")
    status_reason = models.TextField(blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date"]
        verbose_name = "Publication"
        verbose_name_plural = "Publications"

    def __str__(self):
        return f"{self.client.nom_entreprise} - {self.date:%d/%m/%Y}"

    def is_overdue(self) -> bool:
        return self.status == "pending" and self.date < timezone.now()

    def is_upcoming(self) -> bool:
        jours = (self.date - timezone.now()).days
        return self.status == "pending" and 0 <= jours <= 3

    def is_completed(self) -> bool:
        return self.status == "completed"

    def requires_action(self) -> bool:
        return self.status in {"not_realized", "cancelled", "rescheduled"}

    def is_day_not_recommended(self) -> bool:
        return self.client.is_day_not_recommended(jour_semaine_fr(self.date))

    def get_day_not_recommended_warning(self) -> str | None:
        if self.is_day_not_recommended():
            jour = jour_semaine_fr(self.date)
            return (
                f"Attention : {jour.capitalize()} est un jour non recommandé "
                "pour les publications de ce client."
            )
        return None


class PublicationRule(models.Model):
    """Regle de publication par client — un jour de la semaine non recommande."""

    JOURS_CHOICES = [(j, j.capitalize()) for j in JOURS_FR]

    client = models.ForeignKey(ClientPlanning, on_delete=models.CASCADE, related_name="regles")
    day_of_week = models.CharField(max_length=20, choices=JOURS_CHOICES)

    class Meta:
        unique_together = ("client", "day_of_week")
        verbose_name = "Règle de publication"
        verbose_name_plural = "Règles de publication"

    def __str__(self):
        return f"{self.client.nom_entreprise} - {self.get_day_of_week_display()}"


def chemin_rapport_client(instance: "ClientReport", nom_fichier: str) -> str:
    return f"rapports/{instance.client_id}/{nom_fichier}"


class ClientReport(models.Model):
    """Rapport PDF televerse pour un client (`ClientReport` Laravel).

    A la difference de la reecriture stagiaire (qui generait un HTML stocke en
    base), l'original est un vrai fichier PDF depose par un membre de
    l'equipe : c'est ce comportement qui est reproduit ici.
    """

    TYPE_CHOICES = [("monthly", "Mensuel"), ("annual", "Annuel")]

    client = models.ForeignKey(ClientPlanning, on_delete=models.CASCADE, related_name="rapports")
    report_type = models.CharField(max_length=10, choices=TYPE_CHOICES)
    report_date = models.DateField()
    file = models.FileField(upload_to=chemin_rapport_client)
    original_filename = models.CharField(max_length=255)
    file_size = models.PositiveIntegerField()
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-uploaded_at"]
        verbose_name = "Rapport client"
        verbose_name_plural = "Rapports clients"

    def __str__(self):
        return f"Rapport {self.client.nom_entreprise} - {self.report_date}"
