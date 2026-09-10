from django.contrib import admin
from .models import ArticleStock, Reception


@admin.register(ArticleStock)
class ArticleStockAdmin(admin.ModelAdmin):
    list_display = ('type_art', 'qte_art', 'seuil_alerte', 'date_maj')
    search_fields = ('type_art',)
    list_filter = ('type_art',)


@admin.register(Reception)
class ReceptionAdmin(admin.ModelAdmin):
    list_display = ('num_recp', 'get_cueillette_display', 'date_recp', 'qte_recue', 'qte_bon', 'qte_mauvais', 'get_taux_qualite', 'get_etat_qualite')
    search_fields = ('num_recp', 'cueillette_archive')
    list_filter = ('date_recp',)

    @admin.display(description='Cueillette')
    def get_cueillette_display(self, obj):
        return obj.get_cueillette_display()

    @admin.display(description='Taux qualité (%)')
    def get_taux_qualite(self, obj):
        return f"{obj.taux_qualite} %"

    @admin.display(description='État qualité')
    def get_etat_qualite(self, obj):
        return obj.etat_qualite
