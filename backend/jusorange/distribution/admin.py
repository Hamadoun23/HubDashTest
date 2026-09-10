from django.contrib import admin
from .models import Client, Vente, Commande, Facture, Paiement, ReceptionPaiement


@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ('nom_complet', 'tel_client', 'email', 'adresse')
    search_fields = ('nom_complet', 'tel_client', 'email')


class CommandeInline(admin.TabularInline):
    model = Commande
    extra = 0
    fields = ('client', 'date_cmd', 'quantite_33cl', 'quantite_1l')
    readonly_fields = ()


class FactureInline(admin.TabularInline):
    model = Facture
    extra = 0


@admin.register(Vente)
class VenteAdmin(admin.ModelAdmin):
    list_display = ('id', 'client', 'date_vente', 'montant_total', 'statut_paiement')
    list_filter = ('statut_paiement', 'date_vente')
    search_fields = ('client__nom_complet',)
    inlines = [CommandeInline, FactureInline]
    date_hierarchy = 'date_vente'


@admin.register(Commande)
class CommandeAdmin(admin.ModelAdmin):
    list_display = ('id', 'date_cmd', 'client', 'quantite_33cl', 'quantite_1l', 'vente', 'get_total')
    list_filter = ('date_cmd', 'vente__date_vente',)

    def get_total(self, obj):
        return f"{obj.get_total_ligne():.0f} XOF"
    get_total.short_description = 'Total'


class PaiementInline(admin.TabularInline):
    model = Paiement
    extra = 0


@admin.register(Facture)
class FactureAdmin(admin.ModelAdmin):
    list_display = ('num_fact', 'vente', 'date_fact', 'montant', 'statut', 'date_echeance')
    list_filter = ('statut', 'date_fact')
    search_fields = ('num_fact',)
    readonly_fields = ('num_fact',)
    inlines = [PaiementInline]


@admin.register(Paiement)
class PaiementAdmin(admin.ModelAdmin):
    list_display = ('id', 'facture', 'date_paie', 'montant', 'mode_paie', 'reference')
    list_filter = ('mode_paie', 'date_paie')


@admin.register(ReceptionPaiement)
class ReceptionPaiementAdmin(admin.ModelAdmin):
    list_display = ('id', 'paiement', 'montant_recu', 'date_reception', 'get_ecart', 'ecart_traite')
    list_filter = ('ecart_traite', 'date_reception')
    search_fields = ('paiement__facture__num_fact', 'observation')

    def get_ecart(self, obj):
        return f"{obj.ecart:+.0f} XOF"
    get_ecart.short_description = 'Écart'
