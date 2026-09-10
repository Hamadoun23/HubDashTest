from django.contrib import admin

from finance.models import (
    ApprovisionnementCaisse,
    BaremePerdiem,
    BonCommande,
    Caisse,
    CategorieDepense,
    ConsommationCommunication,
    DemandePrix,
    Depense,
    ForfaitCommunication,
    Fournisseur,
    LigneFraisMission,
    LigneRequisition,
    Mission,
    OffreFournisseur,
    Prestation,
    Requisition,
    SortieCaisse,
)


@admin.register(Fournisseur)
class FournisseurAdmin(admin.ModelAdmin):
    list_display = ("code", "raison_sociale", "categorie", "telephone", "actif")
    list_filter = ("actif", "categorie")
    search_fields = ("code", "raison_sociale")


@admin.register(CategorieDepense)
class CategorieDepenseAdmin(admin.ModelAdmin):
    list_display = ("code", "libelle", "imputation", "actif")


class LigneRequisitionInline(admin.TabularInline):
    model = LigneRequisition
    extra = 1


@admin.register(Requisition)
class RequisitionAdmin(admin.ModelAdmin):
    list_display = ("numero", "objet", "demandeur", "montant", "priorite", "statut")
    list_filter = ("statut", "priorite", "departement")
    search_fields = ("numero", "objet")
    inlines = [LigneRequisitionInline]


class OffreInline(admin.TabularInline):
    model = OffreFournisseur
    extra = 1


@admin.register(DemandePrix)
class DemandePrixAdmin(admin.ModelAdmin):
    list_display = ("numero", "objet", "statut", "date_limite", "acheteur")
    list_filter = ("statut",)
    search_fields = ("numero", "objet")
    inlines = [OffreInline]


@admin.register(BonCommande)
class BonCommandeAdmin(admin.ModelAdmin):
    list_display = ("numero", "objet", "fournisseur", "montant", "statut")
    list_filter = ("statut", "fournisseur")


class ApprovisionnementInline(admin.TabularInline):
    model = ApprovisionnementCaisse
    extra = 0


@admin.register(Caisse)
class CaisseAdmin(admin.ModelAdmin):
    list_display = ("code", "libelle", "responsable", "solde_actuel", "sous_alerte", "actif")
    inlines = [ApprovisionnementInline]


@admin.register(SortieCaisse)
class SortieCaisseAdmin(admin.ModelAdmin):
    list_display = ("numero", "caisse", "beneficiaire", "montant", "date_sortie", "statut")
    list_filter = ("statut", "caisse", "categorie")
    search_fields = ("numero", "beneficiaire")
    date_hierarchy = "date_sortie"


@admin.register(Depense)
class DepenseAdmin(admin.ModelAdmin):
    list_display = ("numero", "libelle", "categorie", "montant", "date_depense", "statut")
    list_filter = ("statut", "categorie", "mode_paiement")
    search_fields = ("numero", "libelle")
    date_hierarchy = "date_depense"


@admin.register(BaremePerdiem)
class BaremePerdiemAdmin(admin.ModelAdmin):
    list_display = ("libelle", "zone", "role_agent", "montant_jour", "actif")
    list_filter = ("zone", "actif")


class FraisMissionInline(admin.TabularInline):
    model = LigneFraisMission
    extra = 0


@admin.register(Mission)
class MissionAdmin(admin.ModelAdmin):
    list_display = (
        "numero",
        "demandeur",
        "destination",
        "date_depart",
        "date_retour",
        "montant",
        "statut",
    )
    list_filter = ("statut", "zone")
    search_fields = ("numero", "objet", "destination")
    inlines = [FraisMissionInline]


@admin.register(Prestation)
class PrestationAdmin(admin.ModelAdmin):
    list_display = ("numero", "objet", "prestataire", "montant", "taux_execution", "statut")
    list_filter = ("statut",)


class ConsommationInline(admin.TabularInline):
    model = ConsommationCommunication
    extra = 0


@admin.register(ForfaitCommunication)
class ForfaitCommunicationAdmin(admin.ModelAdmin):
    list_display = ("agent", "operateur", "numero_ligne", "montant_mensuel", "actif")
    list_filter = ("operateur", "type_forfait", "actif")
    search_fields = ("agent__last_name", "numero_ligne")
    inlines = [ConsommationInline]
