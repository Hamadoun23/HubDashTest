"""Chargement de l'effectif depuis un fichier de donnees.

L'organigramme d'une entreprise — noms, adresses, rattachements — est une
donnee, pas du code : il n'a rien a faire dans un depot. Il vit donc dans
``backend/personnel.json``, ignore par git, et le depot ne publie que
``personnel.exemple.json``, un jeu anonyme de meme forme.

Sans fichier reel, l'application se charge avec l'exemple : elle demarre, se
parcourt et se teste, sans jamais exposer qui que ce soit.

Forme attendue du fichier :

    {
      "organisation": "…",
      "prefixe_matricule": "…",
      "postes_cles": {"directeur_general": "…", "directeur_operations": "…"},
      "departements": [{"code": "…", "nom": "…"}],
      "responsables": {"<code departement>": "<username>"},
      "agents": [{"username", "prenom", "nom", "email", "role",
                  "departement", "poste", "manager", "administrateur"}]
    }

L'ordre des agents compte : un responsable doit preceder ceux qui lui sont
rattaches.
"""

import json
from decimal import Decimal
from functools import lru_cache
from pathlib import Path

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from accounts.models import Departement, Utilisateur

#: Mot de passe attribue a la creation des comptes, a changer par l'agent.
MOT_DE_PASSE_DEFAUT = "12345"

RACINE = Path(settings.BASE_DIR)
FICHIER_REEL = RACINE / "personnel.json"
FICHIER_EXEMPLE = RACINE / "personnel.exemple.json"


@lru_cache(maxsize=1)
def effectif() -> dict:
    """Le fichier reel s'il existe, l'exemple anonyme sinon."""
    chemin = FICHIER_REEL if FICHIER_REEL.exists() else FICHIER_EXEMPLE
    with chemin.open(encoding="utf-8") as fichier:
        donnees = json.load(fichier)
    donnees["_fichier"] = chemin.name
    return donnees


def poste_cle(nom: str) -> str | None:
    """Identifiant de celui qui occupe un poste vise par les circuits."""
    return effectif().get("postes_cles", {}).get(nom)


def _departements(donnees):
    """Cree ou met a jour les departements decrits par le fichier.

    Rien n'est supprime : l'organigramme se modifie aussi depuis l'ecran
    Organisation, et un rechargement du fichier ne doit pas effacer un
    departement cree entre-temps par la Direction. Retirer un departement se
    fait depuis l'interface, ou il est visible qui s'y trouve encore.
    """
    departements = {}
    for fiche in donnees["departements"]:
        departement, _ = Departement.objects.update_or_create(
            code=fiche["code"], defaults={"nom": fiche["nom"]}
        )
        departements[fiche["code"]] = departement
    # Les departements hors fichier restent joignables pour les rattachements.
    for departement in Departement.objects.exclude(code__in=departements):
        departements[departement.code] = departement
    return departements


@transaction.atomic
def charger_personnel(purger=False):
    """Cree ou met a jour les comptes decrits par le fichier d'effectif.

    ``purger`` supprime au prealable tous les comptes existants, y compris les
    superutilisateurs. La suppression echoue si un agent porte deja un
    document en circulation (``demandeur`` est protege) — c'est voulu, on ne
    fait pas disparaitre une piste d'audit sans le decider explicitement.
    """
    donnees = effectif()
    if purger:
        Utilisateur.objects.all().delete()

    departements = _departements(donnees)
    prefixe = donnees.get("prefixe_matricule", "AG")
    agents = {}

    for index, fiche in enumerate(donnees["agents"], start=1):
        manager = agents.get(fiche.get("manager")) if fiche.get("manager") else None
        agent, cree = Utilisateur.objects.update_or_create(
            username=fiche["username"],
            defaults={
                "first_name": fiche["prenom"],
                "last_name": fiche["nom"],
                "email": fiche["email"],
                "role": fiche["role"],
                "departement": departements[fiche["departement"]],
                "poste": fiche["poste"],
                "manager": manager,
                "matricule": f"{prefixe}{index:04d}",
                "is_active": True,
                "is_staff": fiche.get("administrateur", False),
                "is_superuser": fiche.get("administrateur", False),
            },
        )
        if cree:
            agent.set_password(MOT_DE_PASSE_DEFAUT)
            agent.save(update_fields=["password"])
        agents[fiche["username"]] = agent

    for code, username in donnees.get("responsables", {}).items():
        if username in agents:
            Departement.objects.filter(code=code).update(responsable=agents[username])

    annee = timezone.localdate().year
    for agent in agents.values():
        agent.soldes_conges.get_or_create(
            annee=annee,
            defaults={"jours_acquis": Decimal("30.0"), "jours_reportes": Decimal("0.0")},
        )

    return agents
