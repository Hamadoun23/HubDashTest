"""Routes terrain : ventes, enrôlements, clients, contrat, reporting téléphonique."""

from django.urls import path

from core.decorators import par_methode

from . import exports, views

urlpatterns = [
    # Ventes
    path("ventes/export-excel", exports.ventes_export_excel, name="ventes.export-excel"),
    path("ventes", views.ventes_index, name="ventes.index"),
    path("ventes/create", views.ventes_create, name="ventes.create"),
    path("ventes/<int:vente>", views.ventes_destroy, name="ventes.destroy"),
    path("api/ventes", views.api_vente_store, name="api.ventes.store"),
    # Enrôlements
    path("enrolements", views.enrolements_index, name="enrolements.index"),
    path("enrolements/create", views.enrolements_create, name="enrolements.create"),
    path(
        "enrolements/<int:enrolement>",
        views.enrolements_destroy,
        name="enrolements.destroy",
    ),
    path("api/enrolements", views.api_enrolement_store, name="api.enrolements.store"),
    # Fiche client côté commercial
    path(
        "mes-clients/<int:client>/modifier",
        views.commercial_client_edit,
        name="commercial.clients.edit",
    ),
    path(
        "mes-clients/<int:client>",
        par_methode(
            PUT=views.commercial_client_update,
            PATCH=views.commercial_client_update,
            POST=views.commercial_client_update,
            DELETE=views.commercial_client_destroy,
        ),
        name="commercial.clients.update",
    ),
    path(
        "mes-clients/<int:client>",
        par_methode(
            PUT=views.commercial_client_update,
            PATCH=views.commercial_client_update,
            POST=views.commercial_client_update,
            DELETE=views.commercial_client_destroy,
        ),
        name="commercial.clients.destroy",
    ),
    # Clients — consultation admin / direction
    path("clients", views.clients_index, name="clients.index"),
    path("clients/<int:client>/export", exports.client_export, name="clients.export"),
    path("clients/<int:client>", views.clients_show, name="clients.show"),
    # Contrat de prestation
    path("mon-contrat", views.contrat_show, name="commercial.contrat"),
    path("mon-contrat/accepter", views.contrat_accepter, name="commercial.contrat.accepter"),
    path("mon-contrat/rejeter", views.contrat_rejeter, name="commercial.contrat.rejeter"),
    path(
        "mes-aides/<int:versement>/accuser",
        views.versement_accuser,
        name="commercial.aides.accuser",
    ),
    # Reporting téléphonique — la route de saisie est déclarée avant
    # `reporting-telephonique/<int:...>` qui capterait sinon « saisie ».
    path(
        "reporting-telephonique/export-excel",
        exports.telephonique_export_excel,
        name="commercial.telephonique.export-excel",
    ),
    path(
        "reporting-telephonique/saisie",
        views.telephonique_create,
        name="commercial.telephonique.create",
    ),
    path(
        "reporting-telephonique",
        par_methode(GET=views.telephonique_index, POST=views.telephonique_store),
        name="commercial.telephonique.index",
    ),
    path(
        "reporting-telephonique",
        par_methode(GET=views.telephonique_index, POST=views.telephonique_store),
        name="commercial.telephonique.store",
    ),
    path(
        "reporting-telephonique/<int:telephoniqueRapport>",
        views.telephonique_destroy,
        name="commercial.telephonique.destroy",
    ),
]
