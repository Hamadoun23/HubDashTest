from django.contrib import admin
from .models import Producteur, Cueillette


@admin.register(Producteur)
class ProducteurAdmin(admin.ModelAdmin):
    list_display = ('nom_complet', 'zone', 'contact', 'actif', 'date_creation')
    search_fields = ('nom_complet', 'zone', 'contact')
    list_filter = ('zone', 'actif')
    list_editable = ('actif',)


@admin.register(Cueillette)
class CueilletteAdmin(admin.ModelAdmin):
    list_display = ('get_producteur_display', 'date_cueil', 'qte_total', 'qte_bon', 'qte_mauvais', 'get_taux_qualite')
    search_fields = ('producteur__nom_complet', 'producteur_nom_archive')
    list_filter = ('date_cueil',)

    @admin.display(description='Producteur')
    def get_producteur_display(self, obj):
        return obj.get_producteur_display()

    @admin.display(description='Taux qualité (%)')
    def get_taux_qualite(self, obj):
        return f"{obj.taux_qualite} %"