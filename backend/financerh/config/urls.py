from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path


def sante(_request):
    """Sonde de disponibilite pour le monitoring et le frontend."""
    return JsonResponse({"statut": "ok", "service": "GDA - RH & Finance"})


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/sante/", sante, name="sante"),
    path("api/", include("accounts.urls")),
    path("api/rh/", include("rh.urls")),
    path("api/finance/", include("finance.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

admin.site.site_header = "GDA - Administration"
admin.site.site_title = "GDA RH & Finance"
admin.site.index_title = "Modules RH et Finance"
