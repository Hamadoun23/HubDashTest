"""Administration Django du service identity.

Elle sert de filet en developpement et pour les depannages ; l'usage courant
passe par l'API et le shell React.
"""

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from comptes.forms import (
    FormulaireCreationUtilisateur,
    FormulaireModificationUtilisateur,
)
from comptes.models import (
    Application,
    Habilitation,
    JournalConnexion,
    SessionJeton,
    Utilisateur,
)


class HabilitationEnLigne(admin.TabularInline):
    model = Habilitation
    fk_name = "utilisateur"
    extra = 0
    autocomplete_fields = ["application"]


@admin.register(Utilisateur)
class AdminUtilisateur(UserAdmin):
    add_form = FormulaireCreationUtilisateur
    form = FormulaireModificationUtilisateur
    model = Utilisateur
    inlines = [HabilitationEnLigne]
    list_display = ["identifiant", "nom_complet", "fonction", "est_actif", "derniere_connexion"]
    list_filter = ["est_actif", "is_superuser"]
    search_fields = ["identifiant", "nom", "prenom", "email", "telephone"]
    ordering = ["nom", "prenom"]
    filter_horizontal = ["groups", "user_permissions"]
    fieldsets = (
        (None, {"fields": ("identifiant", "password")}),
        ("Identite", {"fields": ("nom", "prenom", "email", "telephone", "fonction")}),
        ("Droits", {"fields": ("est_actif", "is_staff", "is_superuser")}),
        ("Dates", {"fields": ("derniere_connexion", "cree_le", "modifie_le")}),
    )
    readonly_fields = ["derniere_connexion", "cree_le", "modifie_le"]
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("identifiant", "nom", "prenom", "password1", "password2"),
            },
        ),
    )


@admin.register(Application)
class AdminApplication(admin.ModelAdmin):
    list_display = ["code", "nom", "groupe", "chemin", "ordre", "active"]
    list_editable = ["ordre", "active"]
    list_filter = ["groupe", "active"]
    search_fields = ["code", "nom"]


@admin.register(Habilitation)
class AdminHabilitation(admin.ModelAdmin):
    list_display = ["utilisateur", "application", "roles", "active", "accordee_le"]
    list_filter = ["application", "active"]
    autocomplete_fields = ["utilisateur", "application"]


@admin.register(SessionJeton)
class AdminSession(admin.ModelAdmin):
    list_display = ["utilisateur", "cree_le", "expire_le", "revoque_le", "adresse_ip"]
    list_filter = ["revoque_le"]


@admin.register(JournalConnexion)
class AdminJournalConnexion(admin.ModelAdmin):
    list_display = ["date", "identifiant_saisi", "reussie", "motif", "adresse_ip"]
    list_filter = ["reussie", "motif"]
    search_fields = ["identifiant_saisi", "adresse_ip"]
