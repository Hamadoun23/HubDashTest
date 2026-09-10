"""Installe les circuits de validation de l'application courante.

    python manage.py amorcer_circuits

Sans regle applicable, un document soumis est approuve d'office, sans etape ni
trace : cette commande fait partie de l'amorcage, pas des donnees de
demonstration. Elle est rejouable — elle remplace les regles des types
qu'elle installe, et laisse les autres intactes.
"""

from django.conf import settings
from django.core.management.base import BaseCommand

from gdahub_common.validation import circuits


class Command(BaseCommand):
    help = "Cree les regles de circuit de validation de ce service."

    def add_arguments(self, parseur):
        parseur.add_argument(
            "--type",
            action="append",
            dest="types",
            help="Limiter le chargement a ce type de document (repetable).",
        )

    def handle(self, *args, **options):
        application = settings.GDAHUB_APPLICATION
        regles = circuits.charger(application, options["types"])

        if not regles:
            self.stdout.write(
                self.style.WARNING(
                    f"Aucun circuit defini pour « {application} ». Les documents "
                    "de ce service seront approuves sans etape."
                )
            )
            return

        titulaires = circuits.titulaires_des_postes()
        if not titulaires:
            self.stdout.write(
                self.style.WARNING(
                    "Aucun poste cle trouve dans le fichier d'effectif : les "
                    "etapes nominatives retombent sur le role."
                )
            )

        type_courant = None
        for regle in sorted(regles, key=lambda r: (r.type_document, r.ordre)):
            if regle.type_document != type_courant:
                type_courant = regle.type_document
                self.stdout.write(f"\n{regle.get_type_document_display()}")
            if regle.valideur_identifiant:
                valideur = regle.valideur_nom or regle.valideur_identifiant
            elif regle.valideur_hierarchique:
                valideur = f"responsable direct (sinon {regle.role_valideur})"
            else:
                valideur = regle.role_valideur or "—"
            self.stdout.write(
                f"  [{regle.ordre}] {regle.get_nature_display():18} "
                f"{regle.libelle:36} -> {valideur}"
            )

        self.stdout.write(self.style.SUCCESS(f"\n{len(regles)} regles installees."))
