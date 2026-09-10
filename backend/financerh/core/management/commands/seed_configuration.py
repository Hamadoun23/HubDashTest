"""Installe la configuration de l'application : circuits et referentiels.

Usage : ``python manage.py seed_configuration`` (ajouter ``--type ABSENCE``
pour ne recharger que le circuit d'un type de document, option repetable).

Sans cette configuration, un document soumis est approuve d'office, sans
etape ni trace : la commande est donc a lancer apres chaque ``migrate`` sur
une base neuve.
"""

from django.core.management.base import BaseCommand

from core.circuits import charger_circuits
from core.constants import TypeDocument
from core.referentiels import charger_referentiels


class Command(BaseCommand):
    help = "Cree les circuits de validation et les referentiels minimaux."

    def add_arguments(self, parser):
        parser.add_argument(
            "--type",
            action="append",
            dest="types",
            choices=[valeur for valeur, _ in TypeDocument.choices],
            help="Limiter le chargement du circuit a ce type (repetable).",
        )

    def handle(self, *args, **options):
        retard, permission, categorie = charger_referentiels()
        self.stdout.write("Referentiels")
        self.stdout.write(f"  type d'absence   {retard.code} - {retard.libelle}")
        self.stdout.write(f"  type d'absence   {permission.code} - {permission.libelle}")
        self.stdout.write(f"  categorie        {categorie.code} - {categorie.libelle}")

        regles = charger_circuits(options["types"])
        type_courant = None
        for regle in sorted(regles, key=lambda r: (r.type_document, r.ordre)):
            if regle.type_document != type_courant:
                type_courant = regle.type_document
                self.stdout.write(f"\n{regle.get_type_document_display()}")
            if regle.valideur_designe:
                valideur = regle.valideur_designe.get_full_name()
            elif regle.valideur_hierarchique:
                valideur = f"responsable direct (sinon {regle.get_role_valideur_display()})"
            else:
                valideur = regle.get_role_valideur_display()
            self.stdout.write(
                f"  [{regle.ordre}] {regle.get_nature_display():18} "
                f"{regle.libelle:34} -> {valideur}"
            )

        self.stdout.write(self.style.SUCCESS(f"\n{len(regles)} regles installees."))
