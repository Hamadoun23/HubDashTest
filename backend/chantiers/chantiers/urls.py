"""Routes internes du service Chantiers, montees sous /api/ par config/urls.py."""
from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    ActivityLogViewSet,
    DashboardViewSet,
    MiseAJourJournaliereViewSet,
    PhaseViewSet,
    PhotoViewSet,
    ProjectViewSet,
    RapportViewSet,
    SousPhaseViewSet,
    TacheViewSet,
    WeatherView,
)

router = DefaultRouter()
router.register("projets", ProjectViewSet, basename="projet")
router.register("phases", PhaseViewSet, basename="phase")
router.register("sous-phases", SousPhaseViewSet, basename="sous-phase")
router.register("taches", TacheViewSet, basename="tache")
router.register("mises-a-jour", MiseAJourJournaliereViewSet, basename="mise-a-jour")
router.register("photos", PhotoViewSet, basename="photo")
router.register("rapports", RapportViewSet, basename="rapport")
router.register("dashboard", DashboardViewSet, basename="dashboard")
router.register("activity-logs", ActivityLogViewSet, basename="activity-log")

urlpatterns = router.urls + [path("weather/", WeatherView.as_view(), name="chantier-weather")]
