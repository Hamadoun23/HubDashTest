"""Contrôle d'accès aux fichiers déposés, pour la passerelle (nginx `auth_request`).

Les fichiers des applications (justificatifs RH et Finance, photos de
chantier, pièces d'identité des clients de Campagnes, rapports de Planning…)
sont servis par la passerelle directement depuis les volumes, sans passer par
Django. Sans contrôle, quiconque connaît ou devine une adresse les lit.

Avant chaque fichier, la passerelle interroge donc cette vue avec la requête
du navigateur : le jeton du hub (cookie HttpOnly `gdahub_acces`, ou en-tête
`Authorization`) et, dans l'en-tête `X-Applications`, les codes
d'habilitation qui ouvrent ce dossier. Réponse 204 : le fichier est servi ;
401/403 : il ne l'est pas.

La vue ne touche pas la base : la signature et l'expiration du jeton, puis
les habilitations qu'il porte, suffisent — c'est aussi ce qui la rend assez
rapide pour être appelée à chaque image.
"""
import jwt
from django.http import HttpResponse
from django.views.decorators.http import require_GET

from comptes import cookie, jetons


def _jeton(requete):
    entete = requete.META.get("HTTP_AUTHORIZATION", "")
    if entete.lower().startswith("bearer "):
        return entete.split(None, 1)[1].strip()
    return requete.COOKIES.get(cookie.NOM, "")


@require_GET
def verifier_fichier(requete):
    brut = _jeton(requete)
    if not brut:
        return HttpResponse(status=401)
    try:
        charge = jetons.lire(brut, "access")
    except jwt.InvalidTokenError:
        return HttpResponse(status=401)

    if charge.get("est_superadmin"):
        return HttpResponse(status=204)

    attendues = [c.strip() for c in requete.META.get("HTTP_X_APPLICATIONS", "").split(",") if c.strip()]
    if not attendues:
        # Dossier commun (photos de profil du hub) : tout compte connecté.
        return HttpResponse(status=204)
    habilitations = charge.get("habilitations") or {}
    if any(habilitations.get(code) is not None for code in attendues):
        return HttpResponse(status=204)
    return HttpResponse(status=403)
