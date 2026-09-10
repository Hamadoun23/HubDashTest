from django.urls import include, path
from rest_framework.routers import DefaultRouter

from rh.views import (
    CampagneEvaluationViewSet,
    CritereEvaluationViewSet,
    DemandeAbsenceViewSet,
    EvaluationViewSet,
    FormationViewSet,
    IndicateursRHView,
    InscriptionFormationViewSet,
    PresenceViewSet,
    ScoringRHView,
    SoldeCongeViewSet,
    TypeAbsenceViewSet,
)

router = DefaultRouter()
router.register("types-absence", TypeAbsenceViewSet, basename="type-absence")
router.register("soldes-conges", SoldeCongeViewSet, basename="solde-conge")
router.register("demandes-absence", DemandeAbsenceViewSet, basename="demande-absence")
router.register("presences", PresenceViewSet, basename="presence")
router.register("campagnes", CampagneEvaluationViewSet, basename="campagne")
router.register("criteres", CritereEvaluationViewSet, basename="critere")
router.register("evaluations", EvaluationViewSet, basename="evaluation")
router.register("formations", FormationViewSet, basename="formation")
router.register("inscriptions", InscriptionFormationViewSet, basename="inscription")

urlpatterns = [
    path("indicateurs/", IndicateursRHView.as_view(), name="indicateurs-rh"),
    path("scoring/", ScoringRHView.as_view(), name="scoring-rh"),
    path("", include(router.urls)),
]
