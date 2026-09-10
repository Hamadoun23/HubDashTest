"""Charge les comptes du personnel reel de GDA.

Usage : ``python manage.py seed_personnel`` (ajouter ``--purger`` pour
supprimer d'abord tous les comptes existants, comptes fictifs compris).
"""

from django.core.management.base import BaseCommand

from accounts.personnel import MOT_DE_PASSE_DEFAUT, charger_personnel


class Command(BaseCommand):
    help = "Cree ou met a jour les comptes du personnel de GDA."

    def add_arguments(self, parser):
        parser.add_argument(
            "--purger",
            action="store_true",
            help="Supprime tous les comptes existants avant le chargement.",
        )

    def handle(self, *args, **options):
        agents = charger_personnel(purger=options["purger"])

        for agent in agents.values():
            self.stdout.write(
                f"{agent.matricule}  {agent.username:<15} {agent.get_role_display():<20} "
                f"{agent.poste}"
            )
        self.stdout.write(self.style.SUCCESS(f"\n{len(agents)} comptes charges."))
        self.stdout.write(
            f"Mot de passe attribue a la creation : {MOT_DE_PASSE_DEFAUT}"
        )
