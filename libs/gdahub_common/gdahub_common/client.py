"""Appels d'un service a un autre.

Regle d'architecture : un service n'importe jamais le modele d'un autre. Quand
il a besoin d'une donnee qui ne lui appartient pas, il passe par ici, en
propageant le jeton de l'utilisateur — les droits sont donc revalides a
l'arrivee, jamais court-circuites.

En pratique, chaque service expose un module `api.py` par domaine consomme :
tant que le domaine voisin vit dans le meme conteneur, ce module lit la base ;
le jour de l'extraction, il devient un appel a `ClientService`, et rien
d'autre ne bouge.
"""

from __future__ import annotations

import logging

import requests
from django.conf import settings

journal = logging.getLogger("gdahub")


class ErreurService(Exception):
    """Le service appele a repondu autre chose qu'un succes."""

    def __init__(self, service: str, statut: int, corps: str):
        self.service = service
        self.statut = statut
        self.corps = corps
        super().__init__(f"{service} a repondu {statut} : {corps[:200]}")


class ClientService:
    """Client HTTP minimal vers un autre service de GDA Hub.

    L'URL de base se lit dans `GDAHUB_SERVICES` :

        GDAHUB_SERVICES = {"referentiel": "http://referentiel:8000"}
    """

    def __init__(self, service: str, jeton: str = "", delai: float = 5.0):
        self.service = service
        self.jeton = jeton
        self.delai = delai
        try:
            self.base = settings.GDAHUB_SERVICES[service].rstrip("/")
        except (AttributeError, KeyError) as erreur:
            raise ErreurService(
                service, 0, "service inconnu dans GDAHUB_SERVICES"
            ) from erreur

    def _entetes(self) -> dict[str, str]:
        entetes = {"Accept": "application/json"}
        if self.jeton:
            entetes["Authorization"] = f"Bearer {self.jeton}"
        return entetes

    def _appeler(self, methode: str, chemin: str, **kwargs):
        url = f"{self.base}/{chemin.lstrip('/')}"
        reponse = requests.request(
            methode, url, headers=self._entetes(), timeout=self.delai, **kwargs
        )
        if reponse.status_code >= 400:
            journal.warning("%s %s -> %s", methode, url, reponse.status_code)
            raise ErreurService(self.service, reponse.status_code, reponse.text)
        if not reponse.content:
            return None
        return reponse.json()

    def get(self, chemin: str, params: dict | None = None):
        return self._appeler("GET", chemin, params=params)

    def post(self, chemin: str, donnees: dict | None = None):
        return self._appeler("POST", chemin, json=donnees)

    def patch(self, chemin: str, donnees: dict | None = None):
        return self._appeler("PATCH", chemin, json=donnees)
