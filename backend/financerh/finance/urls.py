from django.urls import include, path
from rest_framework.routers import DefaultRouter

from finance.views import (
    ApprovisionnementCaisseViewSet,
    BaremePerdiemViewSet,
    BonCommandeViewSet,
    CaisseViewSet,
    CategorieDepenseViewSet,
    ConsommationCommunicationViewSet,
    DemandePrixViewSet,
    DepenseViewSet,
    ForfaitCommunicationViewSet,
    FournisseurViewSet,
    IndicateursFinanceView,
    LigneFraisMissionViewSet,
    LigneRequisitionViewSet,
    MissionViewSet,
    OffreFournisseurViewSet,
    PrestationViewSet,
    RequisitionViewSet,
    SeuilValidationViewSet,
    SortieCaisseViewSet,
)

router = DefaultRouter()
router.register("seuils", SeuilValidationViewSet, basename="seuil")
router.register("fournisseurs", FournisseurViewSet, basename="fournisseur")
router.register("categories-depense", CategorieDepenseViewSet, basename="categorie-depense")
router.register("baremes-perdiem", BaremePerdiemViewSet, basename="bareme-perdiem")
router.register("requisitions", RequisitionViewSet, basename="requisition")
router.register("lignes-requisition", LigneRequisitionViewSet, basename="ligne-requisition")
router.register("demandes-prix", DemandePrixViewSet, basename="demande-prix")
router.register("offres", OffreFournisseurViewSet, basename="offre")
router.register("bons-commande", BonCommandeViewSet, basename="bon-commande")
router.register("caisses", CaisseViewSet, basename="caisse")
router.register(
    "approvisionnements", ApprovisionnementCaisseViewSet, basename="approvisionnement"
)
router.register("sorties-caisse", SortieCaisseViewSet, basename="sortie-caisse")
router.register("depenses", DepenseViewSet, basename="depense")
router.register("missions", MissionViewSet, basename="mission")
router.register("frais-mission", LigneFraisMissionViewSet, basename="frais-mission")
router.register("prestations", PrestationViewSet, basename="prestation")
router.register("forfaits", ForfaitCommunicationViewSet, basename="forfait")
router.register(
    "consommations", ConsommationCommunicationViewSet, basename="consommation"
)

urlpatterns = [
    path("indicateurs/", IndicateursFinanceView.as_view(), name="indicateurs-finance"),
    path("", include(router.urls)),
]
