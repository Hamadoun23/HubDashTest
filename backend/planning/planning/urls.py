from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

routeur = DefaultRouter()
routeur.register("clients", views.ClientPlanningViewSet, basename="client-planning")
routeur.register("regles-publication", views.PublicationRuleViewSet, basename="regle-publication")
routeur.register("idees-contenu", views.ContentIdeaViewSet, basename="idee-contenu")
routeur.register("tournages", views.ShootingViewSet, basename="tournage")
routeur.register("publications", views.PublicationViewSet, basename="publication")

urlpatterns = [
    path("tableau-de-bord/", views.TableauDeBordVue.as_view(), name="tableau-de-bord"),
    path("tableau-de-bord/rapport/", views.RapportGlobalVue.as_view(), name="rapport-global"),
    path("tableau-de-bord/export/", views.ExportGlobalVue.as_view(), name="export-global"),
    path("", include(routeur.urls)),
]
