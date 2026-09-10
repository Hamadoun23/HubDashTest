"""Jeu de donnees de demonstration (Ressources Humaines et Finance).

Les agents ne sont pas inventes : ils viennent du referentiel du personnel
reel (``accounts.personnel``). Seuls les referentiels et les mouvements de
recette (pointages, formations, fournisseurs, caisses) sont fabriques ici.

Usage : ``python manage.py seed_demo`` (ajouter ``--reset`` pour repartir a zero).
"""

import random
from datetime import date, time, timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from accounts.models import Departement, Utilisateur
from accounts.personnel import MOT_DE_PASSE_DEFAUT, charger_personnel
from core.circuits import charger_circuits
from core.constants import Role
from core.models import SeuilValidation
from finance.models import (
    ApprovisionnementCaisse,
    BaremePerdiem,
    Caisse,
    CategorieDepense,
    ConsommationCommunication,
    DemandePrix,
    ForfaitCommunication,
    Fournisseur,
    OffreFournisseur,
    ZoneMission,
)
from rh.models import (
    CampagneEvaluation,
    CategorieAbsence,
    CritereEvaluation,
    Formation,
    Presence,
    StatutCampagne,
    StatutFormation,
    StatutPresence,
    TypeAbsence,
)


class Command(BaseCommand):
    help = "Charge un jeu de donnees de demonstration RH et Finance."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Supprime les donnees existantes avant le chargement.",
        )
        parser.add_argument(
            "--mouvements",
            action="store_true",
            help=(
                "Ajoute des mouvements fictifs (pointages, retards, "
                "consommations telephoniques). Hors demonstration, s'en passer : "
                "ces lignes portent le nom d'agents reels."
            ),
        )

    @transaction.atomic
    def handle(self, *args, **options):
        random.seed(20260810)
        if options["reset"]:
            self.stdout.write("Suppression des donnees existantes...")
            Utilisateur.objects.all().delete()
            Departement.objects.all().delete()
            SeuilValidation.objects.all().delete()

        agents_par_username = charger_personnel()
        agents = list(agents_par_username.values())
        departements = {
            departement.code: departement for departement in Departement.objects.all()
        }
        self.stdout.write(f"{len(departements)} departements, {len(agents)} agents")
        self._seuils()
        self._referentiels_rh()
        if options["mouvements"]:
            self._presences(agents)
        self._campagne_evaluation()
        self._formations(departements)
        self._referentiels_finance(agents, options["mouvements"])

        self.stdout.write(self.style.SUCCESS("\nJeu de demonstration charge."))
        self.stdout.write(
            f"Mot de passe attribue a la creation des comptes : {MOT_DE_PASSE_DEFAUT}"
        )

    # ------------------------------------------------------------------
    # Circuit de validation par seuils
    # ------------------------------------------------------------------

    def _seuils(self):
        """Les circuits vivent dans ``core.circuits`` : une seule definition."""
        regles = charger_circuits()
        self.stdout.write(f"{len(regles)} regles de validation")

    # ------------------------------------------------------------------
    # Referentiels RH
    # ------------------------------------------------------------------

    def _referentiels_rh(self):
        types = [
            ("CA", "Conge annuel", CategorieAbsence.CONGE, True, 30, False),
            ("CM", "Conge maladie", CategorieAbsence.CONGE, False, 15, True),
            ("CMAT", "Conge maternite", CategorieAbsence.CONGE, False, 98, True),
            ("CEXC", "Conge exceptionnel (evenement familial)", CategorieAbsence.CONGE, False, 5, True),
            ("ABS", "Absence non planifiee", CategorieAbsence.ABSENCE, False, 5, True),
            ("RET", "Retard", CategorieAbsence.RETARD, False, 1, False),
            ("PERM", "Permission d'absence", CategorieAbsence.PERMISSION, False, 2, False),
        ]
        for code, libelle, categorie, decompte, duree, justificatif in types:
            TypeAbsence.objects.get_or_create(
                code=code,
                defaults={
                    "libelle": libelle,
                    "categorie": categorie,
                    "decompte_solde": decompte,
                    "duree_max_jours": duree,
                    "justificatif_requis": justificatif,
                },
            )
        self.stdout.write(f"{TypeAbsence.objects.count()} types d'absence")

    def _presences(self, agents):
        if Presence.objects.exists():
            return
        aujourdhui = timezone.localdate()
        actifs = [agent for agent in agents if agent.is_active]
        lignes = []
        for decalage in range(30):
            jour = aujourdhui - timedelta(days=decalage)
            if jour.weekday() >= 5:
                continue
            for agent in actifs:
                tirage = random.random()
                if tirage < 0.04:
                    lignes.append(
                        Presence(agent=agent, date=jour, statut=StatutPresence.ABSENT)
                    )
                    continue
                if tirage < 0.16:
                    arrivee = time(8, random.randint(6, 55))
                    statut = StatutPresence.RETARD
                    retard = (arrivee.hour - 8) * 60 + arrivee.minute
                else:
                    arrivee = time(7, random.randint(30, 59))
                    statut = StatutPresence.PRESENT
                    retard = 0
                lignes.append(
                    Presence(
                        agent=agent,
                        date=jour,
                        heure_arrivee=arrivee,
                        heure_depart=time(17, random.randint(0, 45)),
                        statut=statut,
                        retard_minutes=retard,
                    )
                )
        Presence.objects.bulk_create(lignes, ignore_conflicts=True)
        self.stdout.write(f"{len(lignes)} pointages")

    def _campagne_evaluation(self):
        annee = timezone.localdate().year
        campagne, cree = CampagneEvaluation.objects.get_or_create(
            libelle=f"Evaluation annuelle {annee}",
            defaults={
                "periode_debut": date(annee, 1, 1),
                "periode_fin": date(annee, 12, 31),
                "date_limite": date(annee, 12, 15),
                "statut": StatutCampagne.OUVERTE,
                "consignes": "Entretien individuel puis restitution au collaborateur.",
            },
        )
        if cree:
            criteres = [
                ("Qualite du travail", 3),
                ("Respect des delais", 3),
                ("Esprit d'equipe", 2),
                ("Autonomie et initiative", 2),
                ("Respect des procedures", 2),
            ]
            for libelle, poids in criteres:
                CritereEvaluation.objects.create(
                    campagne=campagne, libelle=libelle, poids=poids
                )
        self.stdout.write("1 campagne d'evaluation")

    def _formations(self, departements):
        aujourdhui = timezone.localdate()
        sessions = [
            ("Securite au travail et gestes de premiers secours", "HSE", 15, True, "PROD"),
            ("Excel avance pour le reporting", "Bureautique", 45, False, "FIN"),
            ("Creation graphique et identite de marque", "Creation", 30, False, "COM"),
            ("Cybersecurite et sauvegarde des donnees", "Informatique", 60, False, "IT"),
            ("Prise en main de l'application", "Digitalisation", 7, True, None),
        ]
        for titre, categorie, dans_jours, obligatoire, cible in sessions:
            formation, cree = Formation.objects.get_or_create(
                titre=titre,
                defaults={
                    "categorie": categorie,
                    "formateur": random.choice(["Cabinet Sahel", "IFCA", "Formateur interne"]),
                    "organisme": "Direction des Ressources Humaines",
                    "lieu": random.choice(["Salle de conference", "Centre IFCA", "En ligne"]),
                    "date_debut": aujourdhui + timedelta(days=dans_jours),
                    "date_fin": aujourdhui + timedelta(days=dans_jours + 2),
                    "places": random.choice([12, 15, 20, 25]),
                    "obligatoire": obligatoire,
                    "statut": StatutFormation.PLANIFIEE,
                },
            )
            if cree and cible:
                formation.departements_cibles.add(departements[cible])
        self.stdout.write(f"{Formation.objects.count()} formations planifiees")

    # ------------------------------------------------------------------
    # Referentiels Finance
    # ------------------------------------------------------------------

    def _referentiels_finance(self, agents, mouvements):
        categories = [
            ("FOURN", "Fournitures de bureau", "606100"),
            ("CARB", "Carburant et lubrifiants", "606200"),
            ("ENTR", "Entretien et reparations", "615000"),
            ("MISS", "Frais de mission et deplacements", "625100"),
            ("TELE", "Telephone et internet", "626100"),
            ("PREST", "Prestations de services externes", "611000"),
            ("REPR", "Frais de representation", "623000"),
        ]
        for code, libelle, imputation in categories:
            CategorieDepense.objects.get_or_create(
                code=code, defaults={"libelle": libelle, "imputation": imputation}
            )

        fournisseurs = [
            ("F001", "Sahel Bureautique SARL", "Fournitures"),
            ("F002", "TechnoServ CI", "Informatique"),
            ("F003", "Garage Central Auto", "Entretien vehicules"),
            ("F004", "Hotel Le Baobab", "Hebergement"),
            ("F005", "Cabinet Conseil Nyeleni", "Conseil et audit"),
        ]
        for code, raison, categorie in fournisseurs:
            Fournisseur.objects.get_or_create(
                code=code,
                defaults={
                    "raison_sociale": raison,
                    "categorie": categorie,
                    "contact": "Service commercial",
                    "telephone": f"+223 20 {random.randint(10, 99)} {random.randint(100000, 999999)}",
                    "email": f"contact@{code.lower()}.example",
                },
            )

        direction = Utilisateur.objects.filter(role=Role.DIRECTION).first()
        # Referentiels de demonstration : on vise un role, jamais une personne.
        caissier = Utilisateur.objects.filter(role=Role.FINANCE).first()
        caisse_principale, cree = Caisse.objects.get_or_create(
            code="CAI-PRIN",
            defaults={
                "libelle": "Caisse principale siege",
                "responsable": caissier,
                "solde_initial": Decimal("1500000"),
                "plafond_alerte": Decimal("300000"),
            },
        )
        Caisse.objects.get_or_create(
            code="CAI-PROD",
            defaults={
                "libelle": "Caisse menue depense Production",
                "responsable": Utilisateur.objects.filter(role=Role.SALARIE).first(),
                "solde_initial": Decimal("400000"),
                "plafond_alerte": Decimal("100000"),
            },
        )
        # Une caisse dont le responsable a quitte l'effectif se retrouve sans
        # titulaire (``SET_NULL``) : on la reconfie sans toucher a son solde.
        Caisse.objects.filter(code="CAI-PRIN", responsable__isnull=True).update(
            responsable=caissier
        )
        Caisse.objects.filter(code="CAI-PROD", responsable__isnull=True).update(
            responsable=Utilisateur.objects.filter(role=Role.SALARIE).first()
        )
        if cree:
            ApprovisionnementCaisse.objects.create(
                caisse=caisse_principale,
                montant=Decimal("2000000"),
                date_operation=timezone.localdate() - timedelta(days=20),
                reference="VIR-BANQUE-0142",
                commentaire="Approvisionnement mensuel",
                enregistre_par=direction,
            )

        baremes = [
            ("Perdiem local", ZoneMission.LOCALE, "10000"),
            ("Perdiem national", ZoneMission.NATIONALE, "25000"),
            ("Perdiem sous-region", ZoneMission.SOUS_REGION, "50000"),
            ("Perdiem international", ZoneMission.INTERNATIONALE, "90000"),
            ("Perdiem national - encadrement", ZoneMission.NATIONALE, "40000"),
        ]
        for libelle, zone, montant in baremes:
            BaremePerdiem.objects.get_or_create(
                libelle=libelle,
                defaults={"zone": zone, "montant_jour": Decimal(montant)},
            )

        demande, cree = DemandePrix.objects.get_or_create(
            objet="Fourniture de 15 ordinateurs portables",
            defaults={
                "description": "Consultation restreinte aupres de trois fournisseurs agrees.",
                "date_lancement": timezone.localdate() - timedelta(days=10),
                "date_limite": timezone.localdate() + timedelta(days=4),
                "acheteur": Utilisateur.objects.filter(role=Role.FINANCE).first(),
            },
        )
        DemandePrix.objects.filter(pk=demande.pk, acheteur__isnull=True).update(
            acheteur=Utilisateur.objects.filter(role=Role.FINANCE).first()
        )
        if cree:
            offres = [("F002", "8250000", 21, 16), ("F001", "8900000", 14, 14), ("F005", "7990000", 45, 11)]
            for code, montant, delai, note in offres:
                OffreFournisseur.objects.create(
                    demande_prix=demande,
                    fournisseur=Fournisseur.objects.get(code=code),
                    montant=Decimal(montant),
                    delai_livraison_jours=delai,
                    note_technique=note,
                    conditions_paiement="30 % a la commande, solde a la livraison",
                )

        # Numeros de ligne et consommations sont inventes : ils n'ont leur
        # place que dans une base de demonstration, jamais accroches d'office
        # au nom d'un agent reel.
        if mouvements:
            mois_courant = timezone.localdate().replace(day=1)
            # Forfaits reserves au back-office et aux encadrants.
            for agent in agents:
                if agent.role == Role.SALARIE and not agent.equipe.exists():
                    continue
                if ForfaitCommunication.objects.filter(agent=agent).exists():
                    continue
                forfait = ForfaitCommunication.objects.create(
                    agent=agent,
                    numero_ligne=f"+223 7{random.randint(0, 9)} {random.randint(10, 99)} "
                    f"{random.randint(1000, 9999)}",
                    operateur=random.choice(["Orange Mali", "Malitel", "Telecel"]),
                    montant_mensuel=Decimal(random.choice(["15000", "25000", "40000"])),
                    date_debut=date(timezone.localdate().year, 1, 1),
                )
                for recul in range(3):
                    mois = (mois_courant - timedelta(days=31 * recul)).replace(day=1)
                    ConsommationCommunication.objects.get_or_create(
                        forfait=forfait,
                        mois=mois,
                        defaults={
                            "montant_consomme": forfait.montant_mensuel
                            * Decimal(random.choice(["0.7", "0.9", "1.0", "1.2"]))
                        },
                    )

        self.stdout.write(
            f"{Fournisseur.objects.count()} fournisseurs, "
            f"{Caisse.objects.count()} caisses, "
            f"{ForfaitCommunication.objects.count()} forfaits communication"
        )
