"""Lecture du fichier d'effectif, partagee par identity et organisation.

L'organigramme d'une entreprise — noms, adresses, rattachements — est une
donnee, pas du code : il n'a rien a faire dans un depot. Il vit donc dans
`infra/effectif/personnel.json`, ignore par git, et le depot ne publie que
`personnel.exemple.json`, un jeu anonyme de meme forme. Sans fichier reel,
l'ERP s'amorce sur l'exemple : il demarre, se parcourt et se teste, sans
jamais exposer qui que ce soit.

**Pourquoi ce module est dans le socle et pas dans un service.** Deux services
lisent le meme fichier : identity y cree les comptes, organisation les fiches
d'agent. Les deux doivent en tirer *exactement le meme identifiant de
connexion*, sans quoi le rapprochement d'une fiche et de son compte ne se fera
jamais et chaque agent verra « aucune fiche rattachee a votre compte ». La
regle vit donc ici, ecrite une fois.

Forme attendue du fichier :

    {
      "organisation": "…",
      "prefixe_matricule": "GDA",
      "postes_cles": {"directeur_general": "…", "directeur_operations": "…"},
      "departements": [{"code": "…", "nom": "…"}],
      "responsables": {"<code departement>": "<username>"},
      "agents": [{"username", "prenom", "nom", "email", "role",
                  "departement", "poste", "manager", "administrateur"}]
    }

L'ordre des agents compte : un responsable doit preceder ceux qui lui sont
rattaches.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

#: Emplacement du fichier dans les conteneurs, monte en lecture seule.
DOSSIER = Path(os.environ.get("GDAHUB_DOSSIER_EFFECTIF", "/effectif"))
NOM_REEL = "personnel.json"
NOM_EXEMPLE = "personnel.exemple.json"


class EffectifIntrouvable(FileNotFoundError):
    """Ni le fichier reel ni l'exemple n'ont ete trouves."""


def chemin(dossier: Path | None = None) -> Path:
    """Le fichier reel s'il existe, l'exemple anonyme sinon."""
    base = Path(dossier) if dossier else DOSSIER
    reel = base / NOM_REEL
    if reel.exists():
        return reel
    exemple = base / NOM_EXEMPLE
    if exemple.exists():
        return exemple
    raise EffectifIntrouvable(
        f"Aucun fichier d'effectif dans {base}. Deposez-y « {NOM_REEL} » "
        f"(ou « {NOM_EXEMPLE} » pour un jeu anonyme)."
    )


def charger(dossier: Path | None = None) -> dict:
    fichier = chemin(dossier)
    with fichier.open(encoding="utf-8") as flux:
        donnees = json.load(flux)
    donnees["_fichier"] = fichier.name
    donnees["_reel"] = fichier.name == NOM_REEL
    return donnees


def identifiant_de(fiche: dict) -> str:
    """L'identifiant de connexion d'un agent — la regle, en un seul endroit.

    L'adresse professionnelle prime sur le nom d'utilisateur : c'est elle qui
    survit a un changement de convention de nommage, et c'est celle que les
    agents connaissent par coeur. Le nom d'utilisateur ne sert que pour les
    fiches sans adresse — un chauffeur, un agent de terrain.

    Toujours en minuscules : identity normalise de la meme facon a la
    connexion, et « H.Cisse@gdamali.net » ne doit pas creer un second compte.
    """
    valeur = fiche.get("identifiant") or fiche.get("email") or fiche.get("username")
    if not valeur:
        raise ValueError(
            f"Fiche sans identifiant exploitable : {fiche.get('nom', '?')}. "
            "Renseignez « email » ou « username »."
        )
    return str(valeur).strip().lower()


def matricule_de(donnees: dict, rang: int) -> str:
    """Matricule attribue a l'import : prefixe du fichier plus le rang.

    Le rang suit l'ordre du fichier. Reimporter le meme fichier redonne donc
    les memes matricules — c'est ce qui rend l'operation rejouable sans
    renumeroter tout le monde.
    """
    return f"{donnees.get('prefixe_matricule', 'AG')}{rang:04d}"


def index_par_username(donnees: dict) -> dict[str, dict]:
    """Les fiches indexees par nom d'utilisateur, pour resoudre les renvois.

    Le fichier designe les responsables par leur nom d'utilisateur, pas par
    leur adresse : c'est ce que fait le fichier d'origine, on ne le reecrit
    pas.
    """
    return {
        fiche["username"]: fiche for fiche in donnees.get("agents", []) if fiche.get("username")
    }
