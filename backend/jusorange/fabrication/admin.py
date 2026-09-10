from django.contrib import admin
from .models import Production


@admin.register(Production)
class ProductionAdmin(admin.ModelAdmin):
    list_display = ('numero_of', 'date_of', 'recette', 'statut_production', 'volume_final_l', 'test_qualite', 'user')
    search_fields = ('numero_of',)
    list_filter = ('statut_production', 'recette', 'date_of')
    list_editable = ('statut_production',)
    readonly_fields = ('numero_of',)
    
    fieldsets = (
        ('Identification', {'fields': ('numero_of', 'date_of', 'statut_production', 'user')}),
        ('Procédé', {'fields': ('lavage_effectue', 'filtration_effectuee', 'pasteurisation_80c', 'recette')}),
        ('Ingrédients', {'fields': ('eau_ajoutee_l', 'sucre_ajoute_kg', 'sorbate_ajoute_g')}),
        ('Contrôle qualité', {'fields': ('test_qualite', 'ph', 'refractometre')}),
        ('Résultat', {'fields': ('volume_final_l',)}),
    )