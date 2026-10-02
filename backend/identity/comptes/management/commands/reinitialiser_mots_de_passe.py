"""Remet un mot de passe provisoire commun, a changer a la prochaine connexion.

    python manage.py reinitialiser_mots_de_passe --mot-de-passe 1234 [--tous]

Par defaut, seuls les comptes actifs sont touches. Chaque compte est marque
« doit changer son mot de passe » : l'interface du hub n'ouvre rien d'autre
tant qu'un nouveau mot de passe n'a pas ete choisi, et toutes les sessions
ouvertes sont fermees.
"""
from django.core.management.base import BaseCommand
from django.utils import timezone

from comptes.models import SessionJeton, Utilisateur


class Command(BaseCommand):
    help = "Mot de passe provisoire commun, change obligatoirement a la connexion."

    def add_arguments(self, parser):
        parser.add_argument("--mot-de-passe", required=True)
        parser.add_argument("--tous", action="store_true", help="Inclure les comptes inactifs.")

    def handle(self, *args, **options):
        comptes = Utilisateur.objects.all() if options["tous"] else Utilisateur.objects.filter(est_actif=True)
        total = 0
        for utilisateur in comptes:
            utilisateur.set_password(options["mot_de_passe"])
            utilisateur.doit_changer_mot_de_passe = True
            utilisateur.save(update_fields=["password", "doit_changer_mot_de_passe"])
            total += 1
        SessionJeton.objects.filter(utilisateur__in=comptes, revoque_le__isnull=True).update(revoque_le=timezone.now())
        self.stdout.write(self.style.SUCCESS(f"{total} comptes reinitialises (changement exige a la connexion)."))
