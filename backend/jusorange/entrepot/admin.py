# entrepot/admin.py
from django.contrib import admin
from .models import Inventaire


@admin.register(Inventaire)
class InventaireAdmin(admin.ModelAdmin):
    list_display = ('id', 'date_inv', 'article', 'qte_systeme', 'qte_depot', 'ecart', 'statut', 'qualite', 'user')
    list_filter = ('statut', 'date_inv')
    search_fields = ('article__type_art', 'observation')