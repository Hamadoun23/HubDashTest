"""URL du service identity."""

from django.contrib import admin
from django.urls import include, path

from comptes.vues_jwks import jwks, sante

urlpatterns = [
    path("api/identity/", include("comptes.urls")),
    # Chemin standard : c'est la que chaque service va chercher la cle
    # publique pour verifier les jetons.
    path(".well-known/jwks.json", jwks, name="jwks"),
    path("sante", sante, name="sante"),
    path("admin/", admin.site.urls),
]
