"""Table des URLs du service Planning.

La passerelle du hub retire son propre prefixe avant de transmettre :
`/api/planning/clients/` devient `/api/clients/` ici.
"""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.db import connection
from django.http import JsonResponse
from django.urls import include, path


def sante(_request):
    try:
        with connection.cursor() as curseur:
            curseur.execute("SELECT 1")
        base, code = "ok", 200
    except Exception as erreur:  # noqa: BLE001
        base, code = f"indisponible : {erreur}", 503
    return JsonResponse({"service": "planning", "base": base}, status=code)


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/sante/", sante, name="sante"),
    path("api/", include("planning.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

admin.site.site_header = "GDA - Planning"
admin.site.site_title = "Planning"
admin.site.index_title = "Planification de contenu"
