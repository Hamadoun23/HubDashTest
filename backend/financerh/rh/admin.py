from django.contrib import admin

from rh.models import (
    CampagneEvaluation,
    CritereEvaluation,
    DemandeAbsence,
    Evaluation,
    Formation,
    InscriptionFormation,
    NoteCritere,
    Presence,
    SoldeConge,
    TypeAbsence,
)


@admin.register(TypeAbsence)
class TypeAbsenceAdmin(admin.ModelAdmin):
    list_display = ("code", "libelle", "categorie", "decompte_solde", "actif")
    list_filter = ("categorie", "actif")


@admin.register(SoldeConge)
class SoldeCongeAdmin(admin.ModelAdmin):
    list_display = ("agent", "annee", "jours_acquis", "jours_pris", "jours_restants")
    list_filter = ("annee",)
    search_fields = ("agent__last_name", "agent__matricule")


@admin.register(DemandeAbsence)
class DemandeAbsenceAdmin(admin.ModelAdmin):
    list_display = (
        "numero",
        "demandeur",
        "type_absence",
        "date_debut",
        "date_fin",
        "nb_jours",
        "statut",
    )
    list_filter = ("statut", "type_absence")
    search_fields = ("numero", "demandeur__last_name")
    date_hierarchy = "date_debut"


@admin.register(Presence)
class PresenceAdmin(admin.ModelAdmin):
    list_display = ("agent", "date", "statut", "heure_arrivee", "heure_depart", "retard_minutes")
    list_filter = ("statut", "date")
    search_fields = ("agent__last_name", "agent__matricule")
    date_hierarchy = "date"


class CritereInline(admin.TabularInline):
    model = CritereEvaluation
    extra = 1


@admin.register(CampagneEvaluation)
class CampagneEvaluationAdmin(admin.ModelAdmin):
    list_display = ("libelle", "periode_debut", "periode_fin", "statut")
    list_filter = ("statut",)
    inlines = [CritereInline]


class NoteCritereInline(admin.TabularInline):
    model = NoteCritere
    extra = 0


@admin.register(Evaluation)
class EvaluationAdmin(admin.ModelAdmin):
    list_display = ("agent", "campagne", "evaluateur", "statut", "note_globale")
    list_filter = ("statut", "campagne")
    search_fields = ("agent__last_name",)
    inlines = [NoteCritereInline]


class InscriptionInline(admin.TabularInline):
    model = InscriptionFormation
    extra = 0


@admin.register(Formation)
class FormationAdmin(admin.ModelAdmin):
    list_display = ("titre", "date_debut", "date_fin", "lieu", "places", "statut")
    list_filter = ("statut", "obligatoire", "categorie")
    search_fields = ("titre", "formateur", "organisme")
    inlines = [InscriptionInline]


@admin.register(InscriptionFormation)
class InscriptionFormationAdmin(admin.ModelAdmin):
    list_display = ("agent", "formation", "statut", "note_satisfaction")
    list_filter = ("statut",)
