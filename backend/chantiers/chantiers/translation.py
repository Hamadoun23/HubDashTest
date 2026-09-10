"""Configuration django-modeltranslation pour le module chantiers.

Enregistre les champs a traduire pour chaque modele. Les champs traduits ont
automatiquement des versions `_fr` et `_en` en base.
"""
from modeltranslation.translator import TranslationOptions, register

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


@register(Project)
class ProjectTranslationOptions(TranslationOptions):
    fields = ("name", "description", "client")
    required_languages = {"fr": ("name",)}


@register(Phase)
class PhaseTranslationOptions(TranslationOptions):
    fields = ("name",)
    required_languages = {"fr": ("name",)}


@register(SousPhase)
class SousPhaseTranslationOptions(TranslationOptions):
    fields = ("name",)
    required_languages = {"fr": ("name",)}


@register(Tache)
class TacheTranslationOptions(TranslationOptions):
    fields = ("activity",)
    required_languages = {"fr": ("activity",)}


@register(MiseAJourJournaliere)
class MiseAJourJournaliereTranslationOptions(TranslationOptions):
    fields = ("comment",)


@register(Photo)
class PhotoTranslationOptions(TranslationOptions):
    fields = ("caption",)


@register(Rapport)
class RapportTranslationOptions(TranslationOptions):
    fields = ("weather", "notes")


@register(TaskProgressNote)
class TaskProgressNoteTranslationOptions(TranslationOptions):
    fields = ("body",)
    required_languages = {"fr": ("body",)}


@register(ActivityLog)
class ActivityLogTranslationOptions(TranslationOptions):
    fields = ("action", "description")
    required_languages = {"fr": ("action",)}
