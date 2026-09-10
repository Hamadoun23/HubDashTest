"""Cree la paire de cles RSA du service identity si elle manque.

Lancee au demarrage du conteneur. Sans elle, aucune connexion n'est possible :
identity ne peut pas signer, et les autres services n'ont rien a verifier.
"""

from django.core.management.base import BaseCommand

from comptes import jetons


class Command(BaseCommand):
    help = "Genere la paire de cles de signature des jetons."

    def add_arguments(self, parseur):
        parseur.add_argument(
            "--forcer",
            action="store_true",
            help="Remplace la paire existante. Tous les jetons en circulation "
            "deviennent invalides et chacun doit se reconnecter.",
        )

    def handle(self, *args, **options):
        prive, public = jetons.chemins_cles()
        existait = prive.exists() and public.exists()

        jetons.generer_cles(forcer=options["forcer"])

        if existait and not options["forcer"]:
            self.stdout.write(f"Cles deja presentes ({prive.parent}).")
        else:
            self.stdout.write(self.style.SUCCESS(f"Cles ecrites dans {prive.parent}."))
        self.stdout.write(f"Identifiant de cle (kid) : {jetons.identifiant_cle()}")
