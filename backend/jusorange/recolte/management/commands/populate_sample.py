"""
Commande pour vider la base et la remplir avec des données fictives.
Usage : python manage.py populate_sample
"""
import random
from datetime import date, timedelta
from django.core.management.base import BaseCommand

from recolte.models import Producteur, Cueillette
from appro.models import ArticleStock, Reception
from fabrication.models import Production
from emballage.models import Conditionnement, Bouteille
from emballage.views import creer_bouteilles_et_maj_stock, maj_stock_jus
from distribution.models import Client, Vente, Commande, Facture, Paiement, ReceptionPaiement
from entrepot.models import Inventaire


class Command(BaseCommand):
    help = 'Vide la base et la remplit avec des données fictives'

    def handle(self, *args, **options):
        self.stdout.write('Vidage de la base...')

        # Nettoyer les données existantes (ordre inverse des dépendances)
        Inventaire.objects.all().delete()
        ReceptionPaiement.objects.all().delete()
        Paiement.objects.all().delete()
        Facture.objects.all().delete()
        Commande.objects.all().delete()
        Vente.objects.all().delete()
        Client.objects.all().delete()
        Bouteille.objects.all().delete()
        Conditionnement.objects.all().delete()
        Production.objects.all().delete()
        Reception.objects.all().delete()
        ArticleStock.objects.all().delete()
        Cueillette.objects.all().delete()
        Producteur.objects.all().delete()

        self.stdout.write('Création des nouvelles données...')

        # --- Producteurs (actif + inactif) ---
        p1 = Producteur.objects.create(
            nom_complet='Mamadou Ba',
            zone='Dakar',
            contact='70 111 22 33',
            adresse='Parcelles Assainies, Dakar',
            actif=True
        )
        p2 = Producteur.objects.create(
            nom_complet='Aminata Fall',
            zone='Thiès',
            contact='76 444 55 66',
            adresse='Thiès, quartier Keur Mame',
            actif=True
        )
        p3 = Producteur.objects.create(
            nom_complet='Ousmane Gueye',
            zone='Saint-Louis',
            contact='77 777 88 99',
            adresse='Saint-Louis, Gandiol',
            actif=True
        )
        Producteur.objects.create(
            nom_complet='Ibrahima Diop',
            zone='Ziguinchor',
            contact='70 999 00 11',
            adresse='Ziguinchor centre',
            actif=False
        )
        self.stdout.write(f'  - {Producteur.objects.count()} producteurs créés (actifs + inactif)')

        # --- Cueillettes ---
        today = date.today()
        c1 = Cueillette.objects.create(
            producteur=p1,
            date_cueil=today - timedelta(days=6),
            qte_total=600,
            qte_bon=550,
            observation='Récolte excellente'
        )
        c2 = Cueillette.objects.create(
            producteur=p1,
            date_cueil=today - timedelta(days=3),
            qte_total=350,
            qte_bon=320,
            observation='Quelques oranges abîmées'
        )
        c3 = Cueillette.objects.create(
            producteur=p2,
            date_cueil=today - timedelta(days=4),
            qte_total=450,
            qte_bon=410,
            observation='Bonne qualité'
        )
        c4 = Cueillette.objects.create(
            producteur=p3,
            date_cueil=today - timedelta(days=2),
            qte_total=280,
            qte_bon=250,
            observation=''
        )
        self.stdout.write(f'  - {Cueillette.objects.count()} cueillettes créées')

        # --- Articles en stock ---
        ArticleStock.objects.create(
            type_art='orange_dispo',
            qte_art=0,
            seuil_alerte=50
        )
        ArticleStock.objects.create(
            type_art='bouteille_vide_33cl',
            qte_art=350,
            seuil_alerte=25
        )
        ArticleStock.objects.create(
            type_art='bouteille_vide_1l',
            qte_art=200,
            seuil_alerte=15
        )
        ArticleStock.objects.create(
            type_art='preforme_33cl',
            qte_art=200,
            seuil_alerte=50
        )
        ArticleStock.objects.create(
            type_art='preforme_1l',
            qte_art=100,
            seuil_alerte=30
        )
        ArticleStock.objects.create(
            type_art='jus_33cl',
            qte_art=0,
            seuil_alerte=10,
            prix_33cl=750
        )
        ArticleStock.objects.create(
            type_art='jus_1l',
            qte_art=0,
            seuil_alerte=5,
            prix_1l=2500
        )
        self.stdout.write(f'  - {ArticleStock.objects.count()} articles créés')

        # --- Réceptions ---
        Reception.objects.create(
            cueillette=c1,
            date_recp=today - timedelta(days=5),
            qte_recue=400,
            qte_bon=380,
            lieu_depot='Entrepôt principal',
            cause_perte='Chute'
        )
        Reception.objects.create(
            cueillette=c1,
            date_recp=today - timedelta(days=5),
            qte_recue=150,
            qte_bon=145,
            lieu_depot='Entrepôt principal',
            cause_perte=''
        )
        Reception.objects.create(
            cueillette=c2,
            date_recp=today - timedelta(days=2),
            qte_recue=200,
            qte_bon=195,
            lieu_depot='Entrepôt secondaire',
            cause_perte='Tri'
        )
        Reception.objects.create(
            cueillette=c3,
            date_recp=today - timedelta(days=3),
            qte_recue=300,
            qte_bon=285,
            lieu_depot='Entrepôt principal',
            cause_perte='Transport'
        )
        self.stdout.write(f'  - {Reception.objects.count()} réceptions créées')

        # --- Productions ---
        prod1 = Production.objects.create(
            date_of=today - timedelta(days=4),
            recette='R80_20',
            lavage_effectue=True,
            filtration_effectuee=True,
            pasteurisation_80c=True,
            eau_ajoutee_l=500,
            sucre_ajoute_kg=50,
            sorbate_ajoute_g=100,
            test_qualite='CONFORME',
            ph=4,
            refractometre=12,
            volume_final_l=1000,
            statut_production='TERMINEE'
        )
        prod2 = Production.objects.create(
            date_of=today - timedelta(days=2),
            recette='R75_25',
            lavage_effectue=True,
            filtration_effectuee=True,
            pasteurisation_80c=True,
            eau_ajoutee_l=400,
            sucre_ajoute_kg=45,
            sorbate_ajoute_g=80,
            test_qualite='CONFORME',
            ph=4,
            refractometre=14,
            volume_final_l=800,
            statut_production='TERMINEE'
        )
        prod4 = Production.objects.create(
            date_of=today - timedelta(days=1),
            recette='R80_20',
            lavage_effectue=True,
            filtration_effectuee=True,
            pasteurisation_80c=True,
            eau_ajoutee_l=600,
            sucre_ajoute_kg=60,
            sorbate_ajoute_g=120,
            test_qualite='CONFORME',
            ph=4,
            refractometre=13,
            volume_final_l=1200,
            statut_production='TERMINEE'
        )
        prod3 = Production.objects.create(
            date_of=today,
            recette='R80_20',
            lavage_effectue=False,
            filtration_effectuee=False,
            pasteurisation_80c=False,
            eau_ajoutee_l=0,
            sucre_ajoute_kg=0,
            sorbate_ajoute_g=0,
            volume_final_l=0,
            statut_production='EN_COURS'
        )
        Production.objects.create(
            date_of=today - timedelta(days=7),
            recette='R80_20',
            lavage_effectue=True,
            filtration_effectuee=True,
            pasteurisation_80c=True,
            eau_ajoutee_l=500,
            sucre_ajoute_kg=48,
            sorbate_ajoute_g=95,
            test_qualite='NON_CONFORME',
            ph=3,
            refractometre=10,
            volume_final_l=950,
            statut_production='ANNULLEE'
        )
        self.stdout.write(f'  - {Production.objects.count()} productions créées')

        # --- Conditionnements ---
        cond1 = Conditionnement.objects.create(
            date_cond=today - timedelta(days=3),
            production=prod1,
            qte_33cl=120,
            qte_1l=30,
            volume_utilisee=900,
            dlc=today + timedelta(days=87),
            observation='Conditionnement lot 1'
        )
        creer_bouteilles_et_maj_stock(cond1)

        cond2 = Conditionnement.objects.create(
            date_cond=today - timedelta(days=1),
            production=prod2,
            qte_33cl=80,
            qte_1l=20,
            volume_utilisee=600,
            dlc=today + timedelta(days=89),
            observation='Conditionnement lot 2'
        )
        creer_bouteilles_et_maj_stock(cond2)

        cond3 = Conditionnement.objects.create(
            date_cond=today,
            production=prod4,
            qte_33cl=100,
            qte_1l=100,
            volume_utilisee=1100,
            dlc=today + timedelta(days=90),
            observation='Conditionnement lot 3 - 100x33cl + 100x1L'
        )
        creer_bouteilles_et_maj_stock(cond3)

        # Répartir les bouteilles sur les 4 statuts (DISPO, VENDUE, PERIMEE, REBUT)
        bouteilles = list(Bouteille.objects.all())
        n = len(bouteilles)
        statuts = (
            ['DISPO'] * (n // 4 + n % 4) +
            ['VENDUE'] * (n // 4) +
            ['PERIMEE'] * (n // 4) +
            ['REBUT'] * (n // 4)
        )
        random.shuffle(statuts)
        for b, statut in zip(bouteilles, statuts):
            b.statut_stock = statut
        Bouteille.objects.bulk_update(bouteilles, ['statut_stock'])
        maj_stock_jus()

        self.stdout.write(f'  - {Conditionnement.objects.count()} conditionnements créés')
        self.stdout.write(f'  - {Bouteille.objects.count()} bouteilles créées (DISPO, VENDUE, PERIMEE, REBUT)')

        # --- Clients (tel+email, tel seul, email seul) ---
        cli1 = Client.objects.create(
            nom_complet='Boutique Chez Fatou',
            tel_client='77 123 45 67',
            email='fatou@boutique.sn',
            adresse='Marché Kermel, Dakar'
        )
        cli2 = Client.objects.create(
            nom_complet='Super Marché Dia',
            tel_client='33 987 65 43',
            email='contact@dia.sn',
            adresse='Plateau, Dakar'
        )
        cli3 = Client.objects.create(
            nom_complet='Epicerie Mame Diarra',
            tel_client='76 555 12 34',
            email='',
            adresse='Thiès, centre-ville'
        )
        cli4 = Client.objects.create(
            nom_complet='Dépôt Sébikotane',
            tel_client='77 888 11 22',
            email='',
            adresse='Sébikotane'
        )
        cli5 = Client.objects.create(
            nom_complet='Restaurant Le Calao',
            tel_client='',
            email='contact@lecalao.sn',
            adresse='Plateau, Dakar'
        )
        self.stdout.write(f'  - {Client.objects.count()} clients créés')

        # --- Commandes (en attente + complétées) ---
        cmd_v1 = Commande.objects.create(client=cli1, date_cmd=today - timedelta(days=2), quantite_33cl=50, quantite_1l=10)
        Commande.objects.create(client=cli1, date_cmd=today, quantite_33cl=50, quantite_1l=10)
        Commande.objects.create(client=cli1, date_cmd=today - timedelta(days=1), quantite_33cl=30, quantite_1l=0)
        cmd_v2 = Commande.objects.create(client=cli2, date_cmd=today - timedelta(days=1), quantite_33cl=100, quantite_1l=25)
        cmd_v3 = Commande.objects.create(client=cli3, date_cmd=today, quantite_33cl=25, quantite_1l=5)
        cmd_v4 = Commande.objects.create(client=cli4, date_cmd=today - timedelta(days=1), quantite_33cl=0, quantite_1l=3)
        Commande.objects.create(client=cli5, date_cmd=today - timedelta(days=2), quantite_33cl=10, quantite_1l=0)
        self.stdout.write(f'  - {Commande.objects.count()} commandes créées (en attente + complétées)')

        # --- Ventes (ACHAT_VENTE, PARTIELLE, DEPOT_VENTE) ---
        # 50*750 + 10*2500 = 62500
        v1 = Vente.objects.create(
            client=cli1,
            date_vente=today - timedelta(days=2),
            montant_total=62500,
            statut_paiement='ACHAT_VENTE'
        )
        # 100*750 + 25*2500 = 137500
        v2 = Vente.objects.create(
            client=cli2,
            date_vente=today - timedelta(days=1),
            montant_total=137500,
            statut_paiement='PARTIELLE'
        )
        # 25*750 + 5*2500 = 31250
        v3 = Vente.objects.create(
            client=cli3,
            date_vente=today,
            montant_total=31250,
            statut_paiement='DEPOT_VENTE'
        )
        # 3*2500 = 7500
        v4 = Vente.objects.create(
            client=cli4,
            date_vente=today - timedelta(days=1),
            montant_total=7500,
            statut_paiement='ACHAT_VENTE'
        )
        # Lier les commandes aux ventes
        cmd_v1.vente = v1
        cmd_v1.save()
        cmd_v2.vente = v2
        cmd_v2.save()
        cmd_v3.vente = v3
        cmd_v3.save()
        cmd_v4.vente = v4
        cmd_v4.save()
        self.stdout.write(f'  - {Vente.objects.count()} ventes créées (ACHAT_VENTE, PARTIELLE, DEPOT_VENTE)')

        # --- Factures (ACHAT_VENTE, PARTIELLE, EMIS, ANNULEE) ---
        f1 = Facture.objects.create(
            vente=v1,
            date_fact=today - timedelta(days=2),
            montant=62500,
            statut='ACHAT_VENTE',
            date_echeance=today + timedelta(days=28)
        )
        f2 = Facture.objects.create(
            vente=v2,
            date_fact=today - timedelta(days=1),
            montant=137500,
            statut='PARTIELLE',
            date_echeance=today + timedelta(days=30)
        )
        f3 = Facture.objects.create(
            vente=v3,
            date_fact=today,
            montant=31250,
            statut='EMIS',
            date_echeance=today + timedelta(days=15)
        )
        f4 = Facture.objects.create(
            vente=v4,
            date_fact=today - timedelta(days=1),
            montant=7500,
            statut='ACHAT_VENTE',
            date_echeance=today + timedelta(days=30)
        )
        # Facture annulée (liée à aucune vente réelle - on crée une vente DEPOT_VENTE puis facture annulée)
        v_annulee = Vente.objects.create(client=cli5, date_vente=today - timedelta(days=5), montant_total=5000, statut_paiement='DEPOT_VENTE')
        Facture.objects.create(
            vente=v_annulee,
            date_fact=today - timedelta(days=5),
            montant=5000,
            statut='ANNULEE',
            date_echeance=today + timedelta(days=25)
        )
        self.stdout.write(f'  - {Facture.objects.count()} factures créées (ACHAT_VENTE, PARTIELLE, EMIS, ANNULEE)')

        # --- Paiements (ESPECE, CHEQUE, VIREMENT, MOBILE) ---
        paie1 = Paiement.objects.create(facture=f1, date_paie=today - timedelta(days=2), montant=62500, mode_paie='VIREMENT', reference='VIR-2026-001')
        paie2 = Paiement.objects.create(facture=f2, date_paie=today - timedelta(days=1), montant=60000, mode_paie='CHEQUE', reference='CHQ-456')
        paie3 = Paiement.objects.create(facture=f2, date_paie=today, montant=20000, mode_paie='ESPECE', reference='')
        paie4 = Paiement.objects.create(facture=f4, date_paie=today - timedelta(days=1), montant=7500, mode_paie='MOBILE', reference='OM-123456')
        self.stdout.write(f'  - {Paiement.objects.count()} paiements créés (ESPECE, CHEQUE, VIREMENT, MOBILE)')

        # --- Réceptions trésorerie (conforme, écart +, écart -, en attente) ---
        ReceptionPaiement.objects.create(paiement=paie1, montant_recu=62500, date_reception=today - timedelta(days=2), observation='', ecart_traite=True)  # Conforme
        ReceptionPaiement.objects.create(paiement=paie2, montant_recu=58500, date_reception=today - timedelta(days=1), observation='Commission retenue', ecart_traite=False)  # Écart négatif
        ReceptionPaiement.objects.create(paiement=paie3, montant_recu=20500, date_reception=today, observation='Arrondi client', ecart_traite=True)  # Écart positif
        # paie4 : pas de réception (en attente)
        self.stdout.write(f'  - {ReceptionPaiement.objects.count()} réceptions trésorerie créées (conforme, écart -, écart +, en attente)')

        # --- Inventaires (TERMINE, EN_COURS, BLOQUE + qualité calculée auto) ---
        art_preforme_33 = ArticleStock.objects.get(type_art='preforme_33cl')
        art_preforme_1l = ArticleStock.objects.get(type_art='preforme_1l')
        art_bout_1l = ArticleStock.objects.get(type_art='bouteille_vide_1l')
        art_jus_33cl = ArticleStock.objects.get(type_art='jus_33cl')
        art_bout_33 = ArticleStock.objects.get(type_art='bouteille_vide_33cl')

        Inventaire.objects.create(
            date_inv=today - timedelta(days=2),
            article=art_preforme_33,
            qte_systeme=art_preforme_33.qte_art,
            qte_depot=195,
            statut='TERMINE',
            observation='Inventaire mensuel préformes 33cl'
        )
        Inventaire.objects.create(
            date_inv=today - timedelta(days=2),
            article=art_preforme_1l,
            qte_systeme=art_preforme_1l.qte_art,
            qte_depot=98,
            statut='TERMINE',
            observation='Inventaire mensuel préformes 1L'
        )
        Inventaire.objects.create(
            date_inv=today - timedelta(days=1),
            article=art_bout_1l,
            qte_systeme=art_bout_1l.qte_art,
            qte_depot=art_bout_1l.qte_art + 2,
            statut='TERMINE',
            observation='Comptage bouteilles 1L'
        )
        Inventaire.objects.create(
            date_inv=today,
            article=art_jus_33cl,
            qte_systeme=art_jus_33cl.qte_art,
            qte_depot=art_jus_33cl.qte_art,
            statut='EN_COURS',
            observation='Inventaire en cours'
        )
        Inventaire.objects.create(
            date_inv=today - timedelta(days=3),
            article=art_bout_33,
            qte_systeme=art_bout_33.qte_art,
            qte_depot=art_bout_33.qte_art - 5,
            statut='BLOQUE',
            observation='Écart constaté - enquête en cours'
        )

        self.stdout.write(f'  - {Inventaire.objects.count()} inventaires créés (TERMINE, EN_COURS, BLOQUE / BON, MOYEN, MAUVAIS)')

        self.stdout.write(self.style.SUCCESS('\nBase vidée et remplie avec succès !'))
        self.stdout.write('Lance le serveur : python manage.py runserver')
        self.stdout.write('Puis visite : http://127.0.0.1:8000/')
