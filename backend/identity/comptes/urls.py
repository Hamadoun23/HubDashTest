"""Routes de l'API identity, montees sous /api/identity/."""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from comptes import views, vues_fichiers, vues_notifications

# Pas de barre oblique finale : les routes ecrites a la main n'en ont pas
# (« /auth/connexion », « /tableau-de-bord »), et melanger les deux
# conventions ferait echouer un POST sur redirection.
routeur = DefaultRouter(trailing_slash=False)
routeur.register("utilisateurs", views.UtilisateurViewSet, basename="utilisateur")
routeur.register("applications", views.ApplicationViewSet, basename="application")
routeur.register("departements", views.DepartementViewSet, basename="departement")
routeur.register("habilitations", views.HabilitationViewSet, basename="habilitation")
routeur.register("connexions", views.JournalConnexionViewSet, basename="connexion")

urlpatterns = [
    path("auth/connexion", views.Connexion.as_view(), name="connexion"),
    # Appelee par la passerelle avant de servir un fichier depose (auth_request).
    path("auth/verifier-fichier", vues_fichiers.verifier_fichier, name="verifier-fichier"),
    path("notifications", vues_notifications.MesNotifications.as_view(), name="notifications"),
    path("notifications/tout-lire", vues_notifications.ToutLire.as_view(), name="notifications-tout-lire"),
    path("notifications/<int:pk>/lue", vues_notifications.MarquerLue.as_view(), name="notification-lue"),
    path("notifications/push/cle", vues_notifications.ClePush.as_view(), name="push-cle"),
    path("notifications/push/abonnement", vues_notifications.AbonnementPushVue.as_view(), name="push-abonnement"),
    path("notifications/push/desabonnement", vues_notifications.DesabonnementPush.as_view(), name="push-desabonnement"),
    # Reseau interne seulement (fermee par la passerelle).
    path("interne/notifications", vues_notifications.NotifierInterne.as_view(), name="interne-notifications"),
    path("auth/rafraichir", views.Rafraichir.as_view(), name="rafraichir"),
    path("auth/deconnexion", views.Deconnexion.as_view(), name="deconnexion"),
    path("auth/moi", views.MonCompte.as_view(), name="moi"),
    path("auth/moi/photo", views.PhotoDeProfil.as_view(), name="moi-photo"),
    path(
        "auth/mot-de-passe",
        views.ChangerMotDePasse.as_view(),
        name="changer-mot-de-passe",
    ),
    path("", include(routeur.urls)),
]
