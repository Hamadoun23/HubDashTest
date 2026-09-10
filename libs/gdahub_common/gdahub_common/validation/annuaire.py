"""Le seul point ou un service metier interroge l'annuaire.

Un appel, au moment ou un document est cree, avec le jeton de l'utilisateur.
Ensuite plus rien : le nom du demandeur, son departement et son responsable
sont figes sur le dossier, et toutes les lectures qui suivent — listes, files
de validation, tableaux de bord — se font en local.

C'est un choix assume plutot qu'une optimisation. Un ERP qui rejoue l'annuaire
a chaque affichage devient inutilisable des que le reseau tousse ; et un
document doit de toute facon garder le nom et le rattachement qu'il portait le
jour de la decision, pas ceux d'aujourd'hui.

Le jeton propage est celui de l'utilisateur : ses droits voyagent avec lui, et
il n'y a aucune authentification de service a inventer.
"""

from __future__ import annotations

import logging

from django.core.cache import cache
from rest_framework.exceptions import ValidationError

from gdahub_common.client import ClientService, ErreurService

journal = logging.getLogger("gdahub")

#: Le contexte d'une personne ne change pas d'une minute a l'autre : le mettre
#: brievement en cache evite un appel par ligne lors d'une saisie en rafale.
DUREE_CACHE = 60


def contexte_du_demandeur(utilisateur, forcer=False) -> dict:
    """L'instantane de la personne connectee et de son responsable.

    Leve une erreur de validation explicite si l'annuaire est injoignable ou
    si la personne n'y a pas de fiche : mieux vaut refuser le depot que
    construire un circuit qui ne remonte a personne.
    """
    cle = f"gdahub:contexte:{utilisateur.identifiant}"
    if not forcer:
        connu = cache.get(cle)
        if connu is not None:
            return connu

    client = ClientService("organisation", jeton=utilisateur.jeton)
    try:
        contexte = client.get("/api/organisation/mon-contexte")
    except ErreurService as erreur:
        journal.warning("Annuaire injoignable pour %s : %s", utilisateur.identifiant, erreur)
        if erreur.statut == 404:
            raise ValidationError(
                {
                    "demandeur": "Aucune fiche d'agent n'est rattachee a votre "
                    "compte. Signalez-le aux Ressources Humaines avant de "
                    "deposer une demande."
                }
            ) from erreur
        raise ValidationError(
            {
                "demandeur": "L'annuaire est momentanement indisponible : "
                "votre demande ne peut pas etre enregistree. Reessayez dans "
                "quelques instants."
            }
        ) from erreur

    cache.set(cle, contexte, DUREE_CACHE)
    return contexte


def contexte_facultatif(utilisateur) -> dict | None:
    """Le meme contexte, mais sans faire echouer l'appelant.

    Un ecran de consultation — tableau de bord, compteur — doit s'afficher
    meme pour quelqu'un qui n'a pas de fiche d'agent : c'est le cas du
    responsable informatique, qui administre l'ERP sans y poser de conges.
    Refuser d'afficher la page lui apprendrait seulement que l'application est
    cassee.

    Le depot d'un document, lui, reste strict : sans demandeur identifie, un
    dossier ne remonte a personne.
    """
    try:
        return contexte_du_demandeur(utilisateur)
    except ValidationError:
        return None


def oublier(utilisateur) -> None:
    """A appeler quand un rattachement vient de changer."""
    cache.delete(f"gdahub:contexte:{utilisateur.identifiant}")
