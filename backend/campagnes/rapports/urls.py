"""Routes des rapports de campagne et de l'écran Performances."""

from django.urls import path

from . import exports, performances, views

urlpatterns = [
    # Les chemins littéraux passent avant ceux à paramètre, qui les capteraient.
    path("rapports/cumul/export", exports.export_cumul, name="rapports.cumul.export"),
    path("rapports/cumul", views.cumul, name="rapports.cumul"),
    path("rapports/export", exports.export_ventes_periode, name="rapports.export"),
    path("rapports", views.index, name="rapports.index"),
    path(
        "rapports/campagnes/<int:campagne>/export",
        exports.export_campagne,
        name="rapports.campagnes.export",
    ),
    path(
        "rapports/campagnes/<int:campagne>/synthese/export-graphiques-excel",
        exports.export_synthese_graphiques_excel,
        name="rapports.campagnes.synthese.export-graphiques-excel",
    ),
    path(
        "rapports/campagnes/<int:campagne>/synthese/export-graphiques-word",
        exports.export_synthese_graphiques_word,
        name="rapports.campagnes.synthese.export-graphiques-word",
    ),
    path(
        "rapports/campagnes/<int:campagne>/synthese",
        views.campagne_synthese,
        name="rapports.campagnes.synthese",
    ),
    path(
        "rapports/campagnes/<int:campagne>/ventes",
        views.campagne_ventes,
        name="rapports.campagnes.ventes",
    ),
    path(
        "rapports/campagnes/<int:campagne>/clients",
        views.campagne_clients,
        name="rapports.campagnes.clients",
    ),
    path(
        "rapports/campagnes/<int:campagne>/reporting-telephonique",
        views.campagne_reporting_telephonique,
        name="rapports.campagnes.reporting-telephonique",
    ),
    path(
        "rapports/campagnes/<int:campagne>/reporting-telephonique/<int:telephoniqueRapport>",
        views.campagne_reporting_telephonique_show,
        name="rapports.campagnes.reporting-telephonique.show",
    ),
    # Reporting téléphonique — vue admin transverse. L'export est déclaré avant
    # la route à paramètre, qui capterait sinon le segment « export ».
    path(
        "admin/reporting-telephonique/export",
        exports.telephonique_admin_export,
        name="admin.telephonique-rapports.export",
    ),
    path(
        "admin/reporting-telephonique",
        views.telephonique_admin_index,
        name="admin.telephonique-rapports.index",
    ),
    path(
        "admin/reporting-telephonique/<int:telephoniqueRapport>",
        views.telephonique_admin_show,
        name="admin.telephonique-rapports.show",
    ),
    # Référentiel direction
    path(
        "direction/types-de-cartes",
        views.direction_types_cartes,
        name="direction.types-cartes.index",
    ),
    # Performances — les chemins littéraux avant ceux à paramètre.
    path(
        "performances/export-excel",
        exports.performances_export_excel,
        name="performances.export-excel",
    ),
    path(
        "performances/export-graphiques-excel",
        exports.performances_export_graphiques_excel,
        name="performances.export-graphiques-excel",
    ),
    path(
        "performances/export-graphiques-word",
        exports.performances_export_graphiques_word,
        name="performances.export-graphiques-word",
    ),
    path(
        "performances/commercial/<int:user>/export-excel",
        exports.performances_commercial_export_excel,
        name="performances.commercial.export-excel",
    ),
    path("performances", performances.index, name="performances.index"),
    path(
        "performances/commercial/<int:user>",
        performances.show,
        name="performances.commercial.show",
    ),
]
