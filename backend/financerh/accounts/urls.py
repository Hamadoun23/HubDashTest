from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView, TokenVerifyView

from accounts.views import (
    ChangementMotDePasseView,
    ConnexionView,
    DepartementViewSet,
    ProfilView,
    UtilisateurViewSet,
)

router = DefaultRouter()
router.register("utilisateurs", UtilisateurViewSet, basename="utilisateur")
router.register("departements", DepartementViewSet, basename="departement")

urlpatterns = [
    path("auth/connexion/", ConnexionView.as_view(), name="connexion"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="refresh"),
    path("auth/verifier/", TokenVerifyView.as_view(), name="verifier"),
    path("auth/profil/", ProfilView.as_view(), name="profil"),
    path("auth/mot-de-passe/", ChangementMotDePasseView.as_view(), name="mot-de-passe"),
    path("", include(router.urls)),
]
