"""Variables disponibles dans le gabarit racine (templates/app.html)."""

import json

from django.conf import settings
from django.utils.safestring import mark_safe

from .routes import objet_ziggy


def app_context(request):
    return {
        "app_name": settings.APP_NAME,
        # Équivalent de la directive Blade @routes de Ziggy : le helper route()
        # du frontend consomme cet objet tel quel.
        "ziggy_json": mark_safe(json.dumps(objet_ziggy(request))),
        # Le nom du cookie CSRF, que le frontend ne peut pas deviner.
        #
        # Derriere la passerelle du hub, toutes les applications partagent une
        # seule origine — et donc un seul espace de cookies. Deux Django qui
        # posent tous les deux « csrftoken » s'ecraseraient mutuellement, d'ou
        # « bdm_csrftoken » ici. Mais axios cherchait le nom par defaut, ne
        # trouvait rien, n'envoyait aucun en-tete, et Django rejetait chaque
        # POST en 403 : connexion, choix du client, saisie d'une vente — toute
        # ecriture etait morte, sans message a l'ecran.
        "csrf_cookie_name": settings.CSRF_COOKIE_NAME,
    }
