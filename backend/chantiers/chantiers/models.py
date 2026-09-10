"""Modeles du service Chantiers — fidelite au schema DailyGda (Laravel).

Repris du modele Laravel dailygda :
- Project (name, description, client, dates, status, sort_order, equipe)
- Phase -> SousPhase -> Tache (hasManyThrough, `progress()`)
- MiseAJourJournaliere unique par (tache, date), `status_from_progress`
- Photo (categorie, fichier, legende, prise le)
- Rapport (temperature, meteo, page, avancement global, notes)
- TaskProgressNote (justification d'avancee saisie par un admin)
- ActivityLog (journal des actions)

Aucune cle etrangere vers un modele utilisateur : ce service n'a pas de
compte local (voir config/settings.py). Une personne y est designee par
l'identifiant que porte son jeton du hub — un entier et un nom, jamais une
relation vivante vers une autre base. C'est la meme regle qui gouverne les
autres services du hub : aucune cle etrangere ne traverse une frontiere de
service.
"""
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class Project(models.Model):
    """Projet de chantier."""

    STATUT_CHOICES = [
        ("planifie", "Planifie"),
        ("en_cours", "En cours"),
        ("termine", "Termine"),
        ("suspendu", "Suspendu"),
    ]

    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    client = models.CharField(max_length=255, blank=True)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUT_CHOICES, default="planifie")
    sort_order = models.IntegerField(default=0)
    # Source de verite de l'equipe assignee : des identifiants de comptes du
    # hub, pas une relation Django. `user_ids` decide qui a acces (cf.
    # chantiers/services.py) ; `user_names` n'est qu'un instantane d'affichage,
    # remis a jour a chaque changement d'equipe.
    user_ids = models.JSONField(default=list, blank=True)
    user_names = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

    def overall_progress(self) -> int:
        """Moyenne des derniers progress enregistres par tache (sans historique = 0)."""
        tasks = Tache.objects.filter(sous_phase__phase__projet=self).select_related("sous_phase__phase")
        if not tasks.exists():
            return 0
        total = 0
        count = 0
        for t in tasks:
            latest = t.latest_daily_update()
            total += latest.progress if latest else 0
            count += 1
        return int(round(total / count)) if count else 0

    def progress_by_phase(self) -> dict:
        """{nom_phase: progression} trie par sort_order."""
        out = {}
        for phase in self.phases.order_by("sort_order"):
            out[phase.name] = phase.progress()
        return out

    def tasks_count(self) -> int:
        return Tache.objects.filter(sous_phase__phase__projet=self).count()

    class Meta:
        ordering = ["sort_order", "id"]
        verbose_name = "Projet"
        verbose_name_plural = "Projets"


class Phase(models.Model):
    """Phase d'un projet."""

    projet = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="phases")
    name = models.CharField(max_length=255)
    sort_order = models.IntegerField(default=0)
    hidden_from_partner = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.name} ({self.projet.name})"

    def tasks(self):
        """HasManyThrough equivalent : taches des sous-phases de cette phase."""
        return Tache.objects.filter(sous_phase__phase=self)

    def progress(self) -> int:
        tasks = self.tasks().select_related("sous_phase__phase")
        if not tasks.exists():
            return 0
        total = 0
        count = 0
        for t in tasks:
            latest = t.latest_daily_update()
            total += latest.progress if latest else 0
            count += 1
        return int(round(total / count)) if count else 0

    class Meta:
        ordering = ["sort_order", "id"]
        verbose_name = "Phase"
        verbose_name_plural = "Phases"


class SousPhase(models.Model):
    """Sous-phase rattachee a une phase."""

    phase = models.ForeignKey(Phase, on_delete=models.CASCADE, related_name="sous_phases")
    name = models.CharField(max_length=255)
    sort_order = models.IntegerField(default=0)
    hidden_from_partner = models.BooleanField(default=False)

    def __str__(self):
        return self.name

    class Meta:
        ordering = ["sort_order", "id"]
        verbose_name = "Sous-phase"
        verbose_name_plural = "Sous-phases"


class Tache(models.Model):
    """Tache (activite) d'une sous-phase."""

    sous_phase = models.ForeignKey(SousPhase, on_delete=models.CASCADE, related_name="taches")
    activity = models.CharField(max_length=500)
    start_day = models.IntegerField(default=1)
    duration_days = models.IntegerField(default=1)
    sort_order = models.IntegerField(default=0)
    hidden_from_partner = models.BooleanField(default=False)

    def __str__(self):
        return self.activity

    def latest_daily_update(self):
        """La derniere mise a jour connue, mise en cache le temps de la requete.

        Les serialiseurs l'appellent plusieurs fois par tache (progression,
        statut, commentaire) : sans ce cache, chacun de ces appels declenchait
        sa propre requete SQL — jusqu'a trois fois plus de requetes qu'il n'y
        a de taches affichees.
        """
        if not hasattr(self, "_derniere_maj_cache"):
            self._derniere_maj_cache = self.mises_a_jour.order_by("-report_date", "-id").first()
        return self._derniere_maj_cache

    def progress_on_date(self, date):
        return self.mises_a_jour.filter(report_date=date).first()

    def get_complete_history(self):
        """Historique complet : mises a jour journalieres et notes de progression."""
        daily_updates = self.mises_a_jour.order_by("-report_date", "-id")
        progress_notes = self.progress_notes.order_by("-created_at")

        return {
            "task": {
                "id": self.id,
                "activity": self.activity,
                "phase": self.sous_phase.phase.name,
                "subphase": self.sous_phase.name,
                "start_day": self.start_day,
                "duration_days": self.duration_days,
                "hidden_from_partner": self.hidden_from_partner,
                "sort_order": self.sort_order,
            },
            "daily_updates": [
                {
                    "id": du.id,
                    "report_date": du.report_date,
                    "progress": du.progress,
                    "status": du.status,
                    "status_label": du.get_status_display(),
                    "comment": du.comment,
                    "user_name": du.user_name,
                    "created_at": du.created_at,
                    "updated_at": du.updated_at,
                }
                for du in daily_updates
            ],
            "progress_notes": [
                {
                    "id": note.id,
                    "progress": note.progress,
                    "previous_progress": note.previous_progress,
                    "body": note.body,
                    "user_name": note.user_name,
                    "created_at": note.created_at,
                    "daily_update_id": note.daily_update_id,
                }
                for note in progress_notes
            ],
            "latest_daily_update": self.latest_daily_update(),
            "progress_notes_count": progress_notes.count(),
        }

    class Meta:
        ordering = ["sort_order", "id"]
        verbose_name = "Tache"
        verbose_name_plural = "Taches"


class MiseAJourJournaliere(models.Model):
    """Mise a jour quotidienne d'une tache (progression, statut, commentaire)."""

    STATUT_CHOICES = [
        ("non_demarre", "Non demarre"),
        ("en_cours", "En cours"),
        ("termine", "Termine"),
        ("annule", "Annule"),
    ]

    tache = models.ForeignKey(Tache, on_delete=models.CASCADE, related_name="mises_a_jour")
    user_id = models.PositiveBigIntegerField(null=True, blank=True)
    user_name = models.CharField(max_length=200, blank=True)
    report_date = models.DateField()
    progress = models.IntegerField(default=0, validators=[MinValueValidator(0), MaxValueValidator(100)])
    status = models.CharField(max_length=20, choices=STATUT_CHOICES, default="non_demarre")
    comment = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @staticmethod
    def status_from_progress(progress: int) -> str:
        if progress >= 100:
            return "termine"
        if progress > 0:
            return "en_cours"
        return "non_demarre"

    def __str__(self):
        return f"{self.tache.activity} - {self.report_date}"

    class Meta:
        unique_together = ("tache", "report_date")
        ordering = ["-report_date", "-id"]
        verbose_name = "Mise a jour journaliere"
        verbose_name_plural = "Mises a jour journalieres"


class Photo(models.Model):
    """Photo d'un chantier, classee par categorie."""

    CATEGORIE_CHOICES = [
        ("avant", "Avant"),
        ("pendant", "Pendant"),
        ("apres", "Apres"),
        ("securite", "Securite"),
        ("qualite", "Qualite"),
    ]

    projet = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="photos")
    user_id = models.PositiveBigIntegerField(null=True, blank=True)
    user_name = models.CharField(max_length=200, blank=True)
    category = models.CharField(max_length=20, choices=CATEGORIE_CHOICES)
    # Sans le prefixe "chantiers/" : MEDIA_URL le porte deja (/media/chantiers/).
    # Le repeter ici doublait le segment dans l'URL servie — le fichier
    # existait bien sur le disque, a l'endroit attendu par la passerelle,
    # mais l'URL renvoyee au client pointait un niveau plus loin : 404.
    file = models.FileField(upload_to="photos/%Y/%m/", blank=True, null=True)
    original_name = models.CharField(max_length=255, blank=True)
    caption = models.CharField(max_length=255, blank=True)
    taken_at = models.DateField(null=True, blank=True)
    file_size = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    @property
    def url(self) -> str:
        if self.file:
            return self.file.url
        if self.pk:
            return f"/api/chantiers/photos/{self.pk}/file/"
        return ""

    def __str__(self):
        return f"{self.get_category_display()} - {self.projet.name}"

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Photo"
        verbose_name_plural = "Photos"


class Rapport(models.Model):
    """Rapport de chantier genere."""

    projet = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="rapports")
    user_id = models.PositiveBigIntegerField(null=True, blank=True)
    user_name = models.CharField(max_length=200, blank=True)
    report_date = models.DateField()
    # CharField, pas DecimalField : le frontend saisit ce champ en texte libre
    # (placeholder « 28°C »), pas comme un nombre — un DecimalField refusait
    # toute valeur non strictement numerique avec une `ValidationError`
    # Django non rattrapee par DRF (500, pas un 400 propre), des la premiere
    # unite ou symbole tape. Le contrat frontend (`NouveauRapport.temperature
    # ?: string`) attend deja une chaine.
    temperature = models.CharField(max_length=20, null=True, blank=True)
    weather = models.CharField(max_length=100, blank=True)
    page_number = models.CharField(max_length=20, blank=True)
    overall_progress = models.IntegerField(default=0)
    notes = models.TextField(blank=True, null=True)
    generated_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Rapport {self.pk} - {self.projet.name}"

    class Meta:
        ordering = ["-report_date"]
        verbose_name = "Rapport"
        verbose_name_plural = "Rapports"


class TaskProgressNote(models.Model):
    """Note de progression enregistree lors d'une avancee de tache."""

    tache = models.ForeignKey(Tache, on_delete=models.CASCADE, related_name="progress_notes")
    user_id = models.PositiveBigIntegerField(null=True, blank=True)
    user_name = models.CharField(max_length=200, blank=True)
    daily_update_id = models.PositiveBigIntegerField(null=True, blank=True)
    progress = models.IntegerField(default=0)
    previous_progress = models.IntegerField(default=0)
    body = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Note {self.progress}% - {self.tache.activity}"

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Note de progression"
        verbose_name_plural = "Notes de progression"


class ActivityLog(models.Model):
    """Journal d'activite (actions utilisateurs)."""

    user_id = models.PositiveBigIntegerField(null=True, blank=True)
    user_name = models.CharField(max_length=200, blank=True)
    action = models.CharField(max_length=100)
    subject_type = models.CharField(max_length=100, blank=True)
    subject_id = models.PositiveBigIntegerField(null=True, blank=True)
    project_id = models.PositiveBigIntegerField(null=True, blank=True)
    description = models.TextField(blank=True)
    properties = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.action} - {self.user_name}"

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Journal d'activite"
        verbose_name_plural = "Journaux d'activite"
