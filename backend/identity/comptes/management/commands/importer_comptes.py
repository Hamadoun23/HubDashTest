"""Cree les comptes GDA Hub depuis le fichier d'effectif.

Le pendant de `importer_effectif` cote organisation : les deux services lisent
le meme fichier, l'un y prend les comptes, l'autre les fiches d'agent. Ils ne
se parlent pas — ils derivent le meme identifiant via
`gdahub_common.effectif`, et fiche et compte se rejoignent a la premiere
connexion de l'interesse.

**La traduction des roles est le vrai travail de cette commande.** Dans
l'application d'origine, une personne portait un role unique — SALARIE, RH,
FINANCE, DIRECTION — qui valait pour tout le logiciel. Dans l'ERP, un role
n'existe que rattache a une application : le responsable financier est
« gestionnaire » sur la finance et simple « agent » sur les conges, ce qu'un
champ unique ne savait pas dire. La table ci-dessous est cette traduction, et
c'est le seul endroit ou elle est ecrite.

Elle ne couvre que le bloc Board. Les habilitations sur les quatre
applications metier ne se deduisent d'aucun role RH : elles s'accordent une
par une, depuis l'administration du hub.
"""

from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from gdahub_common import effectif

from comptes.models import Application, Habilitation, Utilisateur

#: Role d'origine -> habilitations dans l'ERP, application par application.
TRADUCTION = {
    "SALARIE": {
        "organisation": ["lecture"],
        "rh": ["agent"],
        "finance": ["agent"],
    },
    "RH": {
        # Les RH tiennent l'organigramme : c'est leur metier de savoir qui est
        # rattache a qui, et ce rattachement designe les valideurs.
        "organisation": ["gestionnaire"],
        "rh": ["gestionnaire"],
        "finance": ["agent"],
    },
    "FINANCE": {
        "organisation": ["lecture"],
        "rh": ["agent"],
        "finance": ["gestionnaire"],
    },
    "DIRECTION": {
        "organisation": ["gestionnaire"],
        "rh": ["direction"],
        "finance": ["direction"],
        "direction": ["membre"],
    },
}

#: Accorde en plus aux fiches marquees « administrateur » dans le fichier.
ADMINISTRATEUR = {"hub": ["admin"], "direction": ["admin"]}


class Command(BaseCommand):
    help = "Cree les comptes et leurs habilitations depuis le fichier d'effectif."

    def add_arguments(self, parseur):
        parseur.add_argument(
            "--dossier", help="Dossier contenant personnel.json (defaut : /effectif)."
        )
        parseur.add_argument(
            "--mot-de-passe",
            default="12345",
            help="Mot de passe attribue aux comptes crees. Chacun le change "
            "a sa premiere connexion.",
        )
        parseur.add_argument(
            "--simuler",
            action="store_true",
            help="Affiche ce qui serait fait, sans rien ecrire.",
        )

    def handle(self, *args, **options):
        try:
            donnees = effectif.charger(
                Path(options["dossier"]) if options["dossier"] else None
            )
        except (effectif.EffectifIntrouvable, ValueError) as erreur:
            raise CommandError(str(erreur)) from erreur

        if not donnees["_reel"]:
            self.stdout.write(
                self.style.WARNING(
                    f"Effectif anonyme ({donnees['_fichier']}) : comptes de "
                    "demonstration uniquement."
                )
            )

        applications = {
            application.code: application for application in Application.objects.all()
        }
        if not applications:
            raise CommandError(
                "Le catalogue des applications est vide. Lancez « manage.py "
                "amorcer » avant d'importer les comptes."
            )

        crees = repris = 0
        with transaction.atomic():
            for fiche in donnees.get("agents", []):
                compte, nouveau = self._compte(fiche, options["mot_de_passe"])
                crees += nouveau
                repris += not nouveau
                self._habiliter(compte, fiche, applications)

            if options["simuler"]:
                transaction.set_rollback(True)
                self.stdout.write(self.style.WARNING("Simulation : rien n'a ete ecrit."))

        self.stdout.write(
            self.style.SUCCESS(f"{crees} comptes crees, {repris} mis a jour.")
        )
        if crees and not options["simuler"]:
            self.stdout.write(
                self.style.WARNING(
                    f"Mot de passe attribue : « {options['mot_de_passe']} ». "
                    "A distribuer, puis a faire changer."
                )
            )

    def _compte(self, fiche, mot_de_passe) -> tuple[Utilisateur, bool]:
        identifiant = effectif.identifiant_de(fiche)
        administrateur = bool(fiche.get("administrateur"))

        compte = Utilisateur.objects.filter(identifiant=identifiant).first()
        if compte is None:
            compte = Utilisateur.objects.create_user(
                identifiant=identifiant,
                mot_de_passe=mot_de_passe,
                nom=fiche.get("nom", ""),
                prenom=fiche.get("prenom", ""),
                email=fiche.get("email", ""),
                telephone=fiche.get("telephone", ""),
                fonction=fiche.get("poste", ""),
                is_staff=administrateur,
                is_superuser=administrateur,
            )
            self.stdout.write(f"  compte cree     {identifiant}")
            return compte, True

        # Un compte existant garde son mot de passe : le reimport d'un fichier
        # ne doit pas deconnecter tout le monde ni reveler un mot de passe
        # commun a des comptes deja personnalises.
        compte.nom = fiche.get("nom", compte.nom)
        compte.prenom = fiche.get("prenom", compte.prenom)
        compte.email = fiche.get("email", compte.email)
        compte.fonction = fiche.get("poste", compte.fonction)
        if administrateur:
            compte.is_staff = True
            compte.is_superuser = True
        compte.save()
        self.stdout.write(f"  compte a jour   {identifiant}")
        return compte, False

    def _habiliter(self, compte, fiche, applications):
        role = (fiche.get("role") or "SALARIE").upper()
        accordees = dict(TRADUCTION.get(role, TRADUCTION["SALARIE"]))
        if fiche.get("administrateur"):
            accordees.update(ADMINISTRATEUR)

        if role not in TRADUCTION:
            self.stdout.write(
                self.style.WARNING(
                    f"    role « {role} » inconnu, traite comme SALARIE."
                )
            )

        for code, roles in accordees.items():
            application = applications.get(code)
            if application is None:
                self.stdout.write(
                    self.style.WARNING(f"    application « {code} » absente du catalogue.")
                )
                continue
            Habilitation.objects.update_or_create(
                utilisateur=compte,
                application=application,
                defaults={"roles": roles, "active": True},
            )
