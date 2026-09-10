from django.contrib import admin
from .models import Conditionnement, Bouteille


@admin.register(Conditionnement)
class ConditionnementAdmin(admin.ModelAdmin):
    list_display = ('numero_cond', 'date_cond', 'production', 'qte_33cl', 'qte_1l', 'volume_utilisee', 'dlc', 'user')
    search_fields = ('numero_cond',)
    list_filter = ('date_cond',)
    readonly_fields = ('numero_cond',)
    fieldsets = (
        ('Identification', {'fields': ('numero_cond', 'date_cond', 'production', 'user')}),
        ('Quantités', {'fields': ('qte_33cl', 'qte_1l', 'volume_utilisee')}),
        ('Autres', {'fields': ('dlc', 'observation')}),
    )


@admin.register(Bouteille)
class BouteilleAdmin(admin.ModelAdmin):
    list_display = ('id', 'conditionnement', 'get_format_display', 'codebar', 'statut_stock', 'dlc', 'date_creation')
    search_fields = ('codebar',)
    list_filter = ('statut_stock', 'conditionnement')
    list_editable = ('statut_stock',)