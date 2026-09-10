"""Serialiseurs du service Chantiers."""
from rest_framework import serializers

from .models import (
    MiseAJourJournaliere,
    Phase,
    Photo,
    Project,
    Rapport,
    SousPhase,
    Tache,
    TaskProgressNote,
)

STATUT_LABELS = {
    "non_demarre": "Non demarre",
    "en_cours": "En cours",
    "termine": "Termine",
    "annule": "Annule",
}


def status_label(status: str) -> str:
    return STATUT_LABELS.get(status, status)


class ProjectSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    overall_progress = serializers.SerializerMethodField()
    progress_by_phase = serializers.SerializerMethodField()
    tasks_count = serializers.SerializerMethodField()
    # `Project.user_names` est stocke en base comme un dict {id_utilisateur:
    # nom} (cf. models.py, cle d'un instantane d'affichage indexe par id).
    # Le frontend attend un simple tableau de noms (`user_names: string[]`,
    # `Detail.tsx` appelle `.length`/`.join` dessus) : renvoyer le dict brut
    # ne plantait pas (`.length` sur un objet vaut `undefined`, donc
    # silencieusement traite comme vide) mais l'equipe assignee ne s'affichait
    # jamais. Champ recalcule a la lecture ; `perform_create` continue
    # d'ecrire le dict directement sur le modele via `serializer.save(...)`,
    # en dehors de ce champ.
    user_names = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = [
            "id", "name", "description", "client", "start_date", "end_date",
            "status", "status_display", "sort_order", "user_ids", "user_names",
            "overall_progress", "progress_by_phase", "tasks_count",
            "created_at", "updated_at",
        ]
        read_only_fields = ["sort_order", "created_at", "updated_at"]

    def get_overall_progress(self, obj):
        return obj.overall_progress()

    def get_progress_by_phase(self, obj):
        return obj.progress_by_phase()

    def get_tasks_count(self, obj):
        return obj.tasks_count()

    def get_user_names(self, obj):
        return list((obj.user_names or {}).values())


class PhaseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Phase
        fields = ["id", "projet", "name", "sort_order", "hidden_from_partner"]


class SousPhaseSerializer(serializers.ModelSerializer):
    class Meta:
        model = SousPhase
        fields = ["id", "phase", "name", "sort_order", "hidden_from_partner"]


class TaskProgressNoteSerializer(serializers.ModelSerializer):
    """La note de justification d'une avancee.

    `user_name` et `created_at` sont retires pour un partenaire : ce sont des
    details de gestion interne (qui a decide, quand), pas une information
    destinee a un client externe. Fidele a `PartnerVisibility` (Laravel).
    """

    class Meta:
        model = TaskProgressNote
        fields = ["id", "tache", "user_id", "user_name", "daily_update_id",
                  "progress", "previous_progress", "body", "created_at"]

    def to_representation(self, instance):
        donnees = super().to_representation(instance)
        requete = self.context.get("request")
        if requete is not None and getattr(requete.user, "est_partenaire", False):
            donnees.pop("user_name", None)
            donnees.pop("created_at", None)
            donnees.pop("user_id", None)
        return donnees


class TacheSerializer(serializers.ModelSerializer):
    # `sous_phase_id` (ci-dessous) est la forme lue par le frontend ; la
    # creation doit pourtant bien passer par le vrai champ du modele. Sans
    # cette declaration explicite, `sous_phase` n'apparaissait dans aucune des
    # deux directions : la creation d'une tache echouait en erreur
    # d'integrite (colonne obligatoire jamais transmise), un defaut herite
    # tel quel de la reecriture d'origine — jamais eprouve en ecriture.
    sous_phase = serializers.PrimaryKeyRelatedField(queryset=SousPhase.objects.all(), write_only=True)
    sous_phase_id = serializers.SerializerMethodField()
    phase_id = serializers.SerializerMethodField()
    phase = serializers.SerializerMethodField()
    subphase = serializers.SerializerMethodField()
    progress = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    status_label = serializers.SerializerMethodField()
    status_comment = serializers.SerializerMethodField()
    progress_notes_count = serializers.SerializerMethodField()
    progress_notes = serializers.SerializerMethodField()

    class Meta:
        model = Tache
        fields = [
            "id", "sous_phase", "sous_phase_id", "phase_id", "phase", "subphase", "activity",
            "start_day", "duration_days", "sort_order", "hidden_from_partner",
            "progress", "status", "status_label", "status_comment",
            "progress_notes_count", "progress_notes",
        ]

    def get_sous_phase_id(self, obj):
        return obj.sous_phase_id

    def get_phase_id(self, obj):
        return obj.sous_phase.phase_id

    def get_phase(self, obj):
        return obj.sous_phase.phase.name

    def get_subphase(self, obj):
        return obj.sous_phase.name

    # Les trois methodes ci-dessous partagent `latest_daily_update()`, qui se
    # met lui-meme en cache par instance (cf. models.py) : un seul aller a la
    # base par tache serialisee, pas un par methode.
    def get_progress(self, obj):
        latest = obj.latest_daily_update()
        return latest.progress if latest else 0

    def get_status(self, obj):
        latest = obj.latest_daily_update()
        return latest.status if latest else "non_demarre"

    def get_status_label(self, obj):
        return status_label(self.get_status(obj))

    def get_status_comment(self, obj):
        latest = obj.latest_daily_update()
        if latest and latest.status == "annule":
            return latest.comment
        return None

    def get_progress_notes_count(self, obj):
        return obj.progress_notes.count()

    def get_progress_notes(self, obj):
        notes = obj.progress_notes.order_by("-created_at")[:100]
        return TaskProgressNoteSerializer(notes, many=True, context=self.context).data


class TacheDetailSerializer(TacheSerializer):
    """Le detail complet d'une tache : l'historique en plus de l'etat courant."""

    daily_updates = serializers.SerializerMethodField()

    class Meta(TacheSerializer.Meta):
        fields = TacheSerializer.Meta.fields + ["daily_updates"]

    def get_daily_updates(self, obj):
        updates = obj.mises_a_jour.order_by("-report_date", "-id")
        return MiseAJourJournaliereSerializer(updates, many=True).data


class MiseAJourJournaliereSerializer(serializers.ModelSerializer):
    task_id = serializers.SerializerMethodField()
    status_label = serializers.SerializerMethodField()

    class Meta:
        model = MiseAJourJournaliere
        fields = ["id", "tache", "task_id", "user_id", "user_name", "report_date",
                  "progress", "status", "status_label", "comment"]

    def get_task_id(self, obj):
        return obj.tache_id

    def get_status_label(self, obj):
        return status_label(obj.status)


class PhotoSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source="get_category_display", read_only=True)
    url = serializers.CharField(read_only=True)

    class Meta:
        model = Photo
        fields = ["id", "projet", "user_id", "user_name", "category", "category_display",
                  "file", "url", "original_name", "caption", "taken_at", "file_size",
                  "created_at"]
        # `projet` en lecture seule : la vue le deduit du projet actif
        # (`active_project`, cf. views.py) et l'injecte a `serializer.save()`.
        # Ecrivible, DRF l'exigeait dans le corps de la requete avant meme que
        # la vue n'ait la main — televerser une photo echouait toujours en
        # « Ce champ est obligatoire », jamais eprouve par la reecriture
        # d'origine.
        read_only_fields = ["projet", "user_id", "user_name", "original_name", "file_size"]


class RapportSerializer(serializers.ModelSerializer):
    class Meta:
        model = Rapport
        fields = ["id", "projet", "user_id", "user_name", "report_date", "temperature",
                  "weather", "page_number", "overall_progress", "notes", "generated_at"]
        read_only_fields = ["user_id", "user_name", "generated_at"]


class DashboardChartSerializer(serializers.Serializer):
    """Forme des donnees de graphiques renvoyees par `DashboardViewSet`."""

    status_counts = serializers.DictField(child=serializers.IntegerField())
    progress_by_phase = serializers.ListField(child=serializers.DictField())
    progress_by_subphase = serializers.ListField(child=serializers.DictField())
    activities_chart = serializers.ListField(child=serializers.DictField())
