"""Jeu de donnees minimal : le catalogue des applications et le super admin.

La commande est idempotente : elle se relance a chaque demarrage sans ecraser
ce qui a ete modifie depuis. Les roles disponibles, eux, sont realignes sur ce
fichier — c'est ici que le catalogue fait autorite.

L'ERP se lit en trois blocs, dans cet ordre :

1. **Board** — le siege. L'organigramme, puis les ressources humaines, la
   finance et la direction. Il vient en premier parce qu'il detient ce dont
   toutes les autres applications ont besoin : qui travaille ici, dans quel
   departement, sous quelle autorite.
2. **Applications metier** — les quatre activites du groupe.
3. **Administration** — le hub lui-meme : comptes, habilitations, journal.

Les listes de roles reprennent celles des applications d'origine chaque fois
qu'elles existaient, pour que la reprise des comptes soit une correspondance
ligne a ligne et non une reinterpretation.
"""

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction

from comptes.models import Application, Habilitation, Utilisateur

BOARD = "Board"
METIER = "Applications metier"
ADMINISTRATION = "Administration"

#: Le catalogue des applications, tel que le menu du hub l'affiche.
#:
#: **Chaque chemin mene a l'application reelle**, servie par la passerelle, et
#: jamais a un ecran de la coquille. Le hub est une porte d'entree : il
#: rassemble et il ouvre, il ne refait pas ce qui existe.
#:
#:   /rh/...    FinanceRH    (rh.gdamali.net en production)
#:   /jus/      Jus d'orange (jus.gdamali.net)
#:   /bdm/      BDM          (bdm.gdamali.net)
#:
#: FinanceRH porte a elle seule quatre entrees du menu : ce sont ses propres
#: sections. Les separer ici donne au hub un menu par metier plutot que par
#: application, sans rien dupliquer.
APPLICATIONS = [
    # --- Board : le siege ------------------------------------------------
    #
    # « organisation » (organigramme/annuaire, /rh/annuaire) existait comme
    # entree separee du catalogue, avec ses propres roles. Retiree a la
    # demande explicite de l'utilisateur : quiconque a acces a « rh »
    # atteint deja l'annuaire depuis le menu de FinanceRH lui-meme — un
    # deuxieme bouton du hub vers le meme endroit n'ajoutait rien, seulement
    # de la confusion pour qui, comme un super-admin, voit les deux a la
    # fois. L'entree existante en base est desactivee, pas supprimee : les
    # habilitations deja accordees restent tracees.
    {
        "code": "rh",
        "role_admin": "gestionnaire",
        "nom": "Ressources humaines",
        "groupe": BOARD,
        "description": "Conges, permissions, retards, presences, formations.",
        "chemin": "/rh/absences",
        "prefixe_api": "/api/rh",
        "couleur": "#0369a1",
        "ordre": 11,
        "roles_disponibles": [
            {"code": "agent", "libelle": "Agent (ses propres demandes)"},
            {"code": "gestionnaire", "libelle": "Ressources humaines"},
            {"code": "direction", "libelle": "Direction"},
        ],
    },
    {
        "code": "finance",
        "role_admin": "gestionnaire",
        "nom": "Finance",
        "groupe": BOARD,
        "description": "Demandes d'engagement, depenses, caisse, budgets.",
        "chemin": "/rh/mes-demandes",
        "prefixe_api": "/api/finance",
        "couleur": "#047857",
        "ordre": 12,
        "roles_disponibles": [
            {"code": "agent", "libelle": "Agent (ses propres demandes)"},
            {"code": "gestionnaire", "libelle": "Service financier"},
            {"code": "direction", "libelle": "Direction"},
        ],
    },
    {
        "code": "direction",
        "role_admin": "admin",
        "nom": "Direction",
        "groupe": BOARD,
        "description": "Regles de validation, decisions, tableau de bord consolide.",
        "chemin": "/rh/validations",
        "prefixe_api": "/api/direction",
        "couleur": "#4338ca",
        "ordre": 13,
        "roles_disponibles": [
            {"code": "admin", "libelle": "Parametre les circuits"},
            {"code": "membre", "libelle": "Comite de direction"},
        ],
    },
    # --- Les quatre applications metier ----------------------------------
    {
        # BDM (la banque) n'est qu'un des clients de cette application de
        # gestion de campagnes — le code ne doit pas porter son nom.
        "code": "campagnes",
        "role_admin": "admin",
        "nom": "Campagnes",
        "groupe": METIER,
        "description": "Campagnes de cartes bancaires : ventes, enrolements, primes.",
        "chemin": "/campagnes/",
        "prefixe_api": "/api/campagnes",
        "couleur": "#1d4ed8",
        "ordre": 20,
        "roles_disponibles": [
            {"code": "admin", "libelle": "Administrateur"},
            {"code": "direction", "libelle": "Direction"},
            {"code": "commercial", "libelle": "Commercial terrain"},
            {"code": "commercial_telephonique", "libelle": "Commercial telephonique"},
        ],
    },
    {
        "code": "orange",
        "role_admin": "admin",
        "nom": "Jus d'Orange",
        "groupe": METIER,
        "description": "Recolte, fabrication, entrepot et distribution.",
        "chemin": "/jus/production",
        "prefixe_api": "/api/orange",
        "couleur": "#ea580c",
        "ordre": 21,
        "roles_disponibles": [
            {"code": "admin", "libelle": "Administrateur"},
            {"code": "direction", "libelle": "Direction"},
            {"code": "responsable_production", "libelle": "Responsable production"},
            {"code": "commercial", "libelle": "Commercial"},
            {"code": "finance", "libelle": "Finance"},
        ],
    },
    {
        "code": "daily",
        "role_admin": "admin",
        "nom": "Chantiers",
        "groupe": METIER,
        "description": "Suivi de chantier : avancement, photos, rapport journalier.",
        "chemin": "/chantiers",
        # Le service existe desormais (backend/chantiers), repris et corrige
        # du travail du stagiaire : cf. PLAN.md, etape 5.
        "active": True,
        "prefixe_api": "/api/daily",
        "couleur": "#b45309",
        "ordre": 22,
        "roles_disponibles": [
            {"code": "admin", "libelle": "Administrateur"},
            {"code": "chef_chantier", "libelle": "Chef de chantier"},
            {"code": "ingenieur", "libelle": "Ingenieur"},
            {"code": "controle_qualite", "libelle": "Controle qualite"},
            {"code": "partenaire", "libelle": "Partenaire (lecture seule)"},
        ],
    },
    {
        "code": "planning",
        "role_admin": "admin",
        "nom": "Planning",
        "groupe": METIER,
        "description": "Publications, tournages et rapports clients.",
        "chemin": "/planning",
        "active": True,
        "prefixe_api": "/api/planning",
        "couleur": "#7c3aed",
        "ordre": 23,
        "roles_disponibles": [
            {"code": "admin", "libelle": "Administrateur"},
            {"code": "team", "libelle": "Equipe"},
            {"code": "client", "libelle": "Client (ses donnees seulement)"},
        ],
    },
    # --- Le hub lui-meme --------------------------------------------------
    {
        "code": "hub",
        "role_admin": "admin",
        "nom": "Administration du hub",
        "groupe": ADMINISTRATION,
        "description": "Comptes, habilitations et journal des connexions.",
        "chemin": "/administration",
        "prefixe_api": "/api/identity",
        "couleur": "#334155",
        "ordre": 90,
        "roles_disponibles": [
            {"code": "admin", "libelle": "Administrateur du hub"},
            {"code": "lecture", "libelle": "Consultation de l'annuaire"},
        ],
    },
]


class Command(BaseCommand):
    help = "Cree le catalogue des applications et le compte super administrateur."

    @transaction.atomic
    def handle(self, *args, **options):
        for donnees in APPLICATIONS:
            application, cree = Application.objects.update_or_create(
                code=donnees["code"],
                defaults={
                    champ: valeur
                    for champ, valeur in donnees.items()
                    if champ not in {"code", "role_admin"}
                },
            )
            etat = "creee" if cree else "mise a jour"
            self.stdout.write(f"  {application.groupe:20} {application.code:14} {etat}")

        self.stdout.write("")
        self._super_admin()

    def _super_admin(self):
        """Cree le compte du responsable IT, habilite sur tout.

        Ce n'est pas un compte de service anonyme : c'est une personne
        identifiee, qui administre l'ERP, les serveurs et les domaines. Le
        creer nommement plutot que sous un « admin » generique rend le journal
        des connexions lisible des le premier jour.
        """
        identifiant = settings.GDAHUB_ADMIN_IDENTIFIANT.strip().lower()
        administrateur = Utilisateur.objects.filter(identifiant=identifiant).first()

        if administrateur is None:
            administrateur = Utilisateur.objects.create_superuser(
                identifiant=identifiant,
                mot_de_passe=settings.GDAHUB_ADMIN_MOT_DE_PASSE,
                nom=settings.GDAHUB_ADMIN_NOM,
                prenom=settings.GDAHUB_ADMIN_PRENOM,
                email=identifiant if "@" in identifiant else "",
                fonction=settings.GDAHUB_ADMIN_FONCTION,
            )
            self.stdout.write(
                self.style.SUCCESS(
                    f"Super administrateur cree : {administrateur.nom_complet} "
                    f"({identifiant})"
                )
            )
            self.stdout.write(
                self.style.WARNING(
                    "Mot de passe issu de la configuration : changez-le a la "
                    "premiere connexion."
                )
            )
        else:
            self.stdout.write(
                f"Super administrateur deja present : {administrateur.nom_complet} "
                f"({identifiant})"
            )
            # Le drapeau peut avoir ete perdu lors d'une reprise de donnees.
            if not administrateur.is_superuser:
                administrateur.is_superuser = True
                administrateur.is_staff = True
                administrateur.save(update_fields=["is_superuser", "is_staff"])
                self.stdout.write(self.style.WARNING("  drapeau superadmin retabli"))

        # Habilite sur toutes les applications. Le drapeau superadmin suffirait
        # a lui ouvrir les portes, mais le tableau de bord ne liste que les
        # applications habilitees : sans ces lignes, il se connecterait sur un
        # ecran vide.
        #
        # Le role accorde est declare par application dans le catalogue :
        # le premier de la liste n'est pas partout le plus etendu, « rh » et
        # « finance » commencant par « agent ».
        roles_admin = {
            donnees["code"]: donnees["role_admin"] for donnees in APPLICATIONS
        }
        for application in Application.objects.all():
            Habilitation.objects.update_or_create(
                utilisateur=administrateur,
                application=application,
                defaults={
                    "roles": [roles_admin.get(application.code, "admin")],
                    "active": True,
                },
            )
        self.stdout.write("Habilitations du super administrateur alignees.")
