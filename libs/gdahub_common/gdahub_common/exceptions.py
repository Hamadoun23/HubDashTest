"""Format d'erreur unique.

Toute erreur, quel que soit le service, sort sous la meme forme :

    {"erreur": {"code": "validation", "message": "...", "details": {...}}}

Le shell React affiche `message` et n'a besoin de connaitre `details` que
pour surligner les champs d'un formulaire.
"""

import logging

from django.core.exceptions import PermissionDenied
from django.http import Http404
from rest_framework import exceptions, status
from rest_framework.response import Response
from rest_framework.views import exception_handler as gestionnaire_drf

journal = logging.getLogger("gdahub")

CODES = {
    status.HTTP_400_BAD_REQUEST: "validation",
    status.HTTP_401_UNAUTHORIZED: "authentification",
    status.HTTP_403_FORBIDDEN: "interdit",
    status.HTTP_404_NOT_FOUND: "introuvable",
    status.HTTP_405_METHOD_NOT_ALLOWED: "methode_non_autorisee",
    status.HTTP_409_CONFLICT: "conflit",
    status.HTTP_429_TOO_MANY_REQUESTS: "trop_de_requetes",
}


def _message(detail) -> str:
    """Extrait une phrase lisible d'un detail DRF, qui peut etre imbrique."""
    if isinstance(detail, dict):
        for valeur in detail.values():
            return _message(valeur)
        return "Requete invalide."
    if isinstance(detail, list):
        return _message(detail[0]) if detail else "Requete invalide."
    return str(detail)


def gestionnaire(exc, context):
    """Gestionnaire d'exceptions DRF a declarer dans EXCEPTION_HANDLER."""
    if isinstance(exc, Http404):
        exc = exceptions.NotFound()
    elif isinstance(exc, PermissionDenied):
        exc = exceptions.PermissionDenied()

    reponse = gestionnaire_drf(exc, context)

    if reponse is None:
        # Exception non geree : on journalise la trace et on ne divulgue rien.
        journal.exception(
            "Erreur non geree dans %s", context.get("view").__class__.__name__
        )
        return Response(
            {
                "erreur": {
                    "code": "erreur_serveur",
                    "message": "Une erreur interne est survenue.",
                    "details": {},
                }
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    detail = reponse.data
    details = detail if isinstance(detail, dict) and "detail" not in detail else {}
    reponse.data = {
        "erreur": {
            "code": getattr(exc, "default_code", None)
            or CODES.get(reponse.status_code, "erreur"),
            "message": _message(detail.get("detail") if isinstance(detail, dict) and "detail" in detail else detail),
            "details": details,
        }
    }
    return reponse
