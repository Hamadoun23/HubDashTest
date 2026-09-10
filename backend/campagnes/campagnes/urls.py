"""Routes campagnes — administration et espace direction."""

from django.urls import path

from core.decorators import par_methode
from core.routing import ressource

from . import views

urlpatterns = [
    # Déclaré avant la ressource : `campagnes/<int:campagne>` capterait sinon
    # le segment littéral « import-commerciaux ».
    path(
        "admin/campagnes/import-commerciaux/preview",
        views.previsualiser_import,
        name="admin.campagnes.import-commerciaux.preview",
    ),
    path(
        "admin/campagnes/<int:campagne>/arreter",
        views.arreter,
        name="admin.campagnes.arreter",
    ),
    path(
        "admin/campagnes/<int:campagne>/annuler",
        views.annuler,
        name="admin.campagnes.annuler",
    ),
    path(
        "admin/campagnes/<int:campagne>/reprogrammer",
        views.reprogrammer,
        name="admin.campagnes.reprogrammer",
    ),
    path(
        "admin/campagnes/<int:campagne>/dates",
        views.update_dates,
        name="admin.campagnes.dates.update",
    ),
    path(
        "admin/campagnes/<int:campagne>/sync-commerciaux",
        views.sync_commerciaux,
        name="admin.campagnes.sync-commerciaux",
    ),
    path(
        "admin/campagnes/<int:campagne>/signataires",
        views.update_signataires,
        name="admin.campagnes.signataires.update",
    ),
    path(
        "admin/campagnes/<int:campagne>/import-commerciaux",
        views.importer_commerciaux,
        name="admin.campagnes.import-commerciaux",
    ),
    path(
        "admin/campagnes/<int:campagne>/republier-contrat",
        views.republier_contrat,
        name="admin.campagnes.republier-contrat",
    ),
    path(
        "admin/campagnes/<int:campagne>/contrat-reponses/<int:reponse>/reset",
        views.reset_contrat_reponse,
        name="admin.campagnes.contrat-reponses.reset",
    ),
    path(
        "admin/campagnes/<int:campagne>/versements",
        views.versement_store,
        name="admin.campagnes.versements.store",
    ),
    path(
        "admin/campagnes/<int:campagne>/versements/<int:versement>",
        views.versement_destroy,
        name="admin.campagnes.versements.destroy",
    ),
    path(
        "admin/campagnes/<int:campagne>/contrat-articles",
        views.article_store,
        name="admin.campagnes.contrat-articles.store",
    ),
    path(
        "admin/campagnes/<int:campagne>/contrat-articles/<int:article>",
        par_methode(
            PUT=views.article_update,
            PATCH=views.article_update,
            DELETE=views.article_destroy,
            POST=views.article_update,
        ),
        name="admin.campagnes.contrat-articles.update",
    ),
    path(
        "admin/campagnes/<int:campagne>/contrat-articles/<int:article>",
        par_methode(
            PUT=views.article_update,
            PATCH=views.article_update,
            DELETE=views.article_destroy,
            POST=views.article_update,
        ),
        name="admin.campagnes.contrat-articles.destroy",
    ),
    # Espace direction — consultation seule.
    path("direction/campagnes", views.direction_index, name="direction.campagnes.index"),
    path(
        "direction/campagnes/<int:campagne>",
        views.direction_show,
        name="direction.campagnes.show",
    ),
]

urlpatterns += ressource(
    "admin/campagnes",
    "campagne",
    prefixe_nom="admin.campagnes.",
    index=views.index,
    create=views.create,
    store=views.store,
    show=views.show,
    edit=views.edit,
    update=views.update,
    destroy=views.destroy,
)
