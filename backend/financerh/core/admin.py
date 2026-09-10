from django.contrib import admin

from core.models import CompteurDocument, EtapeValidation, SeuilValidation


@admin.register(SeuilValidation)
class SeuilValidationAdmin(admin.ModelAdmin):
    list_display = (
        "libelle",
        "type_document",
        "ordre",
        "montant_min",
        "montant_max",
        "role_valideur",
        "valideur_hierarchique",
        "valideur_designe",
        "nature",
        "actif",
    )
    list_filter = ("type_document", "role_valideur", "actif")
    search_fields = ("libelle",)
    ordering = ("type_document", "ordre")


@admin.register(EtapeValidation)
class EtapeValidationAdmin(admin.ModelAdmin):
    list_display = ("libelle", "content_type", "object_id", "ordre", "decision", "decide_par")
    list_filter = ("decision", "role_valideur")
    readonly_fields = ("content_type", "object_id")


admin.site.register(CompteurDocument)
