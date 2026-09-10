from django.contrib import admin

from .models import PointVente, Visite


class VisiteInline(admin.TabularInline):
    model = Visite
    extra = 0
    fields = ('date_visite', 'commercial', 'statut_constate', 'compte_rendu', 'photo')


@admin.register(PointVente)
class PointVenteAdmin(admin.ModelAdmin):
    list_display = (
        'nom', 'type_point', 'statut', 'commercial',
        'date_prochaine_relance', 'potentiel_ca', 'client',
    )
    list_filter = ('statut', 'type_point', 'commercial')
    search_fields = ('nom', 'adresse', 'contact_nom', 'contact_tel')
    inlines = [VisiteInline]


@admin.register(Visite)
class VisiteAdmin(admin.ModelAdmin):
    list_display = ('point_vente', 'date_visite', 'commercial', 'statut_constate')
    list_filter = ('statut_constate', 'commercial')
    search_fields = ('point_vente__nom', 'compte_rendu')
    date_hierarchy = 'date_visite'
