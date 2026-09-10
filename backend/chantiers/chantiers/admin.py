"""Administration Django — outillage d'exploitation, pas un chemin utilisateur."""
from django.contrib import admin

from .models import (
    ActivityLog,
    MiseAJourJournaliere,
    Phase,
    Photo,
    Project,
    Rapport,
    SousPhase,
    Tache,
    TaskProgressNote,
)


class PhaseInline(admin.TabularInline):
    model = Phase
    extra = 0
    fields = ["name", "sort_order", "hidden_from_partner"]


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ["name", "client", "status", "sort_order", "updated_at"]
    list_filter = ["status"]
    search_fields = ["name", "client"]
    inlines = [PhaseInline]


@admin.register(Phase)
class PhaseAdmin(admin.ModelAdmin):
    list_display = ["name", "projet", "sort_order", "hidden_from_partner"]
    list_filter = ["projet"]


@admin.register(SousPhase)
class SousPhaseAdmin(admin.ModelAdmin):
    list_display = ["name", "phase", "sort_order", "hidden_from_partner"]


@admin.register(Tache)
class TacheAdmin(admin.ModelAdmin):
    list_display = ["activity", "sous_phase", "sort_order"]
    search_fields = ["activity"]


@admin.register(MiseAJourJournaliere)
class MiseAJourJournaliereAdmin(admin.ModelAdmin):
    list_display = ["tache", "report_date", "progress", "status", "user_name"]
    list_filter = ["status"]
    date_hierarchy = "report_date"


@admin.register(Photo)
class PhotoAdmin(admin.ModelAdmin):
    list_display = ["projet", "category", "user_name", "created_at"]
    list_filter = ["category"]


@admin.register(Rapport)
class RapportAdmin(admin.ModelAdmin):
    list_display = ["projet", "report_date", "overall_progress", "user_name"]


@admin.register(TaskProgressNote)
class TaskProgressNoteAdmin(admin.ModelAdmin):
    list_display = ["tache", "progress", "previous_progress", "user_name", "created_at"]


@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    list_display = ["action", "user_name", "project_id", "created_at"]
    list_filter = ["action"]
    search_fields = ["description", "user_name"]
