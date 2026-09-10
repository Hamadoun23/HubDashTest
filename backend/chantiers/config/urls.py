"""Table des URLs du service Chantiers.

La passerelle du hub retire son propre prefixe avant de transmettre :
`/api/chantiers/projets/` devient `/api/projets/` ici. Les chemins internes
ne repetent donc jamais « chantiers » ou « daily » — le repeter creerait un
prefixe double des que le gateway le retire deja une fois.
"""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.db import connection
from django.http import JsonResponse
from django.urls import include, path


def sante(_request):
    """Sonde de vie, lue par la passerelle sous /sante/chantiers.

    Meme forme que les autres services du hub : on interroge la base plutot
    que de repondre 200 sur un processus vivant mais coupe d'elle.
    """
    try:
        with connection.cursor() as curseur:
            curseur.execute("SELECT 1")
        base, code = "ok", 200
    except Exception as erreur:  # noqa: BLE001 - le motif doit apparaitre dans la reponse
        base, code = f"indisponible : {erreur}", 503
    return JsonResponse({"service": "chantiers", "base": base}, status=code)


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/sante/", sante, name="sante"),
    path("api/", include("chantiers.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

admin.site.site_header = "GDA - Chantiers"
admin.site.site_title = "Chantiers"
admin.site.index_title = "Suivi de chantiers"
