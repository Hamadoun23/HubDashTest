"""
Routes du socle et des référentiels d'administration.

Les noms doivent reproduire exactement ceux de routes/web.php et routes/auth.php :
c'est ce qui permet aux 199 appels `route(...)` du frontend de fonctionner sans
modification (cf. core.routes).
"""

from django.urls import path

from . import admin_views as adm
from . import dashboard, password_views as mdp, views
from .decorators import par_methode
from .routing import ressource

urlpatterns = [
    path("", views.racine, name="racine"),
    path("site.webmanifest", views.manifeste_pwa, name="pwa.manifest"),
    # A la racine de l'application, et non sous /static/ : un service
    # worker ne pilote que ce qui vit sous son propre dossier.
    path("sw.js", views.service_worker, name="pwa.sw"),
    path("sante", views.sante, name="sante"),
    path("login", views.login, name="login"),
    path("logout", views.logout_store, name="logout"),
    path("password", adm.mot_de_passe_update, name="password.update"),
    path("dashboard", dashboard.dashboard, name="dashboard"),
    # Choix du client de GDA (BDM, UBA…). Une seule URI pour l'affichage et la
    # sélection, comme le reste des écrans repris de Laravel.
    path("choix-client", views.choix_client, name="partenaires.choix"),
    path("choix-client", views.choix_client, name="partenaires.choix.store"),
    # Réinitialisation de mot de passe et vérification d'e-mail (routes/auth.php).
    path("forgot-password", mdp.mot_de_passe_oublie, name="password.request"),
    path("forgot-password", mdp.mot_de_passe_oublie, name="password.email"),
    path("reset-password/<str:token>", mdp.reinitialiser_formulaire, name="password.reset"),
    path("reset-password", mdp.reinitialiser_appliquer, name="password.store"),
    path("confirm-password", mdp.confirmer_mot_de_passe, name="password.confirm"),
    path("verify-email", mdp.verification_notice, name="verification.notice"),
    path("verify-email/<int:id>/<str:hash>", mdp.verification_verify, name="verification.verify"),
    path("email/verification-notification", mdp.verification_send, name="verification.send"),
    # Le transfert d'agence est déclaré avant la ressource `users` : sans cela,
    # `users/<int:user>/edit` capterait aussi `users/12/transfert-agence`.
    path(
        "admin/users/<int:user>/transfert-agence",
        par_methode(GET=adm.users_transfert_form, POST=adm.users_transfert_apply),
        name="admin.users.transfert-agence",
    ),
    path(
        "admin/users/<int:user>/transfert-agence",
        par_methode(GET=adm.users_transfert_form, POST=adm.users_transfert_apply),
        name="admin.users.transfert-agence.apply",
    ),
    path("admin/journal-connexions", adm.login_logs_index, name="admin.login-logs.index"),
]

urlpatterns += ressource(
    "admin/agences",
    "agence",
    prefixe_nom="admin.agences.",
    index=adm.agences_index,
    create=adm.agences_create,
    store=adm.agences_store,
    edit=adm.agences_edit,
    update=adm.agences_update,
    destroy=adm.agences_destroy,
)

urlpatterns += ressource(
    "admin/users",
    "user",
    prefixe_nom="admin.users.",
    index=adm.users_index,
    create=adm.users_create,
    store=adm.users_store,
    edit=adm.users_edit,
    update=adm.users_update,
    destroy=adm.users_destroy,
)

urlpatterns += ressource(
    "admin/types-cartes",
    "types_carte",
    prefixe_nom="admin.types-cartes.",
    index=adm.types_cartes_index,
    create=adm.types_cartes_create,
    store=adm.types_cartes_store,
    edit=adm.types_cartes_edit,
    update=adm.types_cartes_update,
    destroy=adm.types_cartes_destroy,
)
