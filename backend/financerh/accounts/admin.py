from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from accounts.models import Departement, Utilisateur


@admin.register(Departement)
class DepartementAdmin(admin.ModelAdmin):
    list_display = ("code", "nom", "responsable", "effectif")
    search_fields = ("code", "nom")


@admin.register(Utilisateur)
class UtilisateurAdmin(UserAdmin):
    list_display = (
        "matricule",
        "get_full_name",
        "role",
        "departement",
        "poste",
        "type_contrat",
        "is_active",
    )
    list_filter = ("role", "departement", "type_contrat", "is_active")
    search_fields = ("matricule", "first_name", "last_name", "email", "username")
    ordering = ("last_name", "first_name")
    fieldsets = UserAdmin.fieldsets + (
        (
            "Fiche agent",
            {
                "fields": (
                    "matricule",
                    "role",
                    "departement",
                    "manager",
                    "poste",
                    "telephone",
                    "type_contrat",
                    "date_embauche",
                    "date_sortie",
                    "motif_sortie",
                )
            },
        ),
    )
    add_fieldsets = UserAdmin.add_fieldsets + (
        ("Fiche agent", {"fields": ("matricule", "role", "departement", "poste")}),
    )
