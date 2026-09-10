"""Attribue un mot de passe distinct a chaque agent.

Usage :

    python manage.py generer_mots_de_passe            # comptes sans mot de passe personnel
    python manage.py generer_mots_de_passe --tous     # tous les comptes, y compris deja changes
    python manage.py generer_mots_de_passe --agent m.dupont --agent a.diallo

La liste est ecrite dans ``backend/mots-de-passe.txt``, ignore par git. C'est
un document a distribuer puis a detruire : chaque agent est invite a changer
son mot de passe des sa premiere connexion, depuis « Mon profil ».
"""

import re
import secrets
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone

from accounts.models import Utilisateur

#: Alphabet sans caracteres ambigus : ni O/0, ni I/l/1. Un mot de passe se
#: transmet parfois a l'oral ou sur papier.
ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"

#: Trois groupes de quatre, separes par des tirets : 12 caracteres tires au
#: sort, mais lisibles et recopiables sans erreur.
GROUPES = 3
TAILLE_GROUPE = 4

FICHIER = Path(settings.BASE_DIR) / "mots-de-passe.txt"


def mot_de_passe() -> str:
    return "-".join(
        "".join(secrets.choice(ALPHABET) for _ in range(TAILLE_GROUPE))
        for _ in range(GROUPES)
    )


class Command(BaseCommand):
    help = "Attribue un mot de passe distinct a chaque agent."

    def add_arguments(self, parser):
        parser.add_argument(
            "--tous",
            action="store_true",
            help="Reinitialise aussi les comptes dont le mot de passe a deja ete change.",
        )
        parser.add_argument(
            "--agent",
            action="append",
            dest="agents",
            help="Limiter a cet identifiant (repetable).",
        )
        parser.add_argument(
            "--sortie",
            help="Chemin du fichier a ecrire (defaut : backend/mots-de-passe.txt).",
        )

    @staticmethod
    def _lire_existant():
        """Relit le fichier pour conserver les agents hors du perimetre traite."""
        connus = {}
        if not FICHIER.exists():
            return connus
        for ligne in FICHIER.read_text(encoding="utf-8").splitlines():
            colonnes = re.split(r"\s{2,}", ligne.strip())
            if len(colonnes) == 4 and "@" in colonnes[2]:
                identifiant, nom, email, secret = colonnes
                connus[identifiant] = (nom, email, secret)
        return connus

    def handle(self, *args, **options):
        global FICHIER
        if options.get("sortie"):
            FICHIER = Path(options["sortie"])
        agents = Utilisateur.objects.filter(is_active=True).order_by("matricule")
        if options["agents"]:
            agents = agents.filter(username__in=options["agents"])

        # Sans --tous, on epargne les agents ayant deja choisi leur mot de
        # passe : le regenerer les mettrait dehors sans prevenir.
        commun = "12345"
        lignes = []
        for agent in agents:
            if not options["tous"] and not agent.check_password(commun):
                self.stdout.write(f"  = {agent.username} : deja personnalise, ignore")
                continue
            secret = mot_de_passe()
            agent.set_password(secret)
            agent.save(update_fields=["password"])
            lignes.append((agent, secret))
            self.stdout.write(f"  + {agent.username}")

        if not lignes:
            self.stdout.write(self.style.WARNING("Aucun compte a traiter."))
            return

        # Le fichier est fusionne, jamais ecrase : un mot de passe en clair ne
        # se retrouve nulle part ailleurs — pas meme en base, ou il est hache.
        # Une execution ciblee par ``--agent`` ne doit donc pas emporter les
        # lignes des agents qu'elle ne traite pas.
        connus = self._lire_existant()
        for agent, secret in lignes:
            connus[agent.username] = (agent.get_full_name(), agent.email, secret)

        largeur_id = max(len(cle) for cle in connus)
        largeur_nom = max(len(valeur[0]) for valeur in connus.values())
        largeur_mail = max(len(valeur[1]) for valeur in connus.values())
        with FICHIER.open("w", encoding="utf-8") as sortie:
            sortie.write("Mots de passe individuels\n")
            sortie.write(f"Mis a jour le {timezone.localtime():%d/%m/%Y a %H:%M}\n\n")
            sortie.write(
                "Chaque agent se connecte avec son identifiant OU son adresse\n"
                "professionnelle, puis change son mot de passe depuis Mon profil.\n"
                "Detruire ce document une fois les mots de passe distribues.\n\n"
            )
            for identifiant in sorted(connus):
                nom, email, secret = connus[identifiant]
                sortie.write(
                    f"{identifiant:<{largeur_id}}  {nom:<{largeur_nom}}  "
                    f"{email:<{largeur_mail}}  {secret}\n"
                )

        self.stdout.write(
            self.style.SUCCESS(f"\n{len(lignes)} mot(s) de passe ecrit(s) dans {FICHIER}")
        )
        self.stdout.write("Ce fichier est ignore par git. A distribuer puis detruire.")
