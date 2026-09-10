"""Tests du moteur de validation par seuils et du cloisonnement des perimetres."""

from datetime import date, timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import Departement, Utilisateur
from core.constants import Decision, NatureEtape, Role, StatutDocument, TypeDocument
from core.models import SeuilValidation
from finance.models import Caisse, CategorieDepense, Depense, Requisition
from rh.models import CategorieAbsence, DemandeAbsence, SoldeConge, TypeAbsence

MDP = "MotDePasseTest2026!"


def creer_agent(username, role, manager=None, departement=None):
    agent = Utilisateur.objects.create(
        username=username,
        first_name=username.capitalize(),
        last_name="Test",
        matricule=f"M{username[:6].upper()}",
        role=role,
        manager=manager,
        departement=departement,
        date_embauche=date(2022, 1, 3),
    )
    agent.set_password(MDP)
    agent.save()
    return agent


class BaseAPITestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.departement = Departement.objects.create(code="TECH", nom="Technique")
        cls.direction = creer_agent("direction", Role.DIRECTION)
        cls.rh = creer_agent("rh", Role.RH, manager=cls.direction)
        cls.finance = creer_agent("finance", Role.FINANCE, manager=cls.direction)
        # Encadrant de fait : simple salarie, mais des agents lui sont rattaches.
        cls.chef = creer_agent(
            "chef", Role.SALARIE, manager=cls.direction, departement=cls.departement
        )
        cls.salarie = creer_agent(
            "salarie", Role.SALARIE, manager=cls.chef, departement=cls.departement
        )
        cls.autre = creer_agent("autre", Role.SALARIE, manager=cls.direction)

    def client_de(self, agent):
        client = APIClient()
        client.force_authenticate(user=agent)
        return client


class CircuitParSeuilsTest(BaseAPITestCase):
    """Le circuit doit dependre du type de document ET du montant."""

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        SeuilValidation.objects.create(
            libelle="Validation hierarchique",
            type_document=TypeDocument.REQUISITION,
            role_valideur=Role.DIRECTION,
            ordre=1,
            valideur_hierarchique=True,
        )
        SeuilValidation.objects.create(
            libelle="Controle Finance",
            type_document=TypeDocument.REQUISITION,
            role_valideur=Role.FINANCE,
            ordre=2,
        )
        SeuilValidation.objects.create(
            libelle="Accord Direction",
            type_document=TypeDocument.REQUISITION,
            role_valideur=Role.DIRECTION,
            ordre=3,
            montant_min=Decimal("500000"),
        )

    def _creer_requisition(self, montant):
        reponse = self.client_de(self.salarie).post(
            "/api/finance/requisitions/",
            {
                "objet": "Achat materiel",
                "lignes": [
                    {"designation": "Materiel", "quantite": "1", "prix_unitaire": str(montant)}
                ],
            },
            format="json",
        )
        self.assertEqual(reponse.status_code, 201, reponse.data)
        return reponse.data["id"]

    def test_montant_calcule_depuis_les_lignes(self):
        requisition_id = self._creer_requisition(120000)
        self.assertEqual(Requisition.objects.get(pk=requisition_id).montant, Decimal("120000"))

    def test_petit_montant_saute_l_etape_direction(self):
        requisition_id = self._creer_requisition(100000)
        self.client_de(self.salarie).post(f"/api/finance/requisitions/{requisition_id}/soumettre/")
        requisition = Requisition.objects.get(pk=requisition_id)
        self.assertEqual(
            [etape.libelle for etape in requisition.etapes.all()],
            ["Validation hierarchique", "Controle Finance"],
        )

    def test_gros_montant_ajoute_l_etape_direction(self):
        requisition_id = self._creer_requisition(900000)
        self.client_de(self.salarie).post(f"/api/finance/requisitions/{requisition_id}/soumettre/")
        requisition = Requisition.objects.get(pk=requisition_id)
        self.assertEqual(
            [etape.libelle for etape in requisition.etapes.all()],
            ["Validation hierarchique", "Controle Finance", "Accord Direction"],
        )

    def test_etape_hierarchique_visee_le_responsable_du_demandeur(self):
        requisition_id = self._creer_requisition(100000)
        self.client_de(self.salarie).post(f"/api/finance/requisitions/{requisition_id}/soumettre/")
        premiere = Requisition.objects.get(pk=requisition_id).etapes.first()
        self.assertEqual(premiere.valideur_attendu, self.chef)

    def test_chacun_se_prononce_dans_l_ordre_qu_il_veut(self):
        """Les etapes sont ouvertes en parallele, pas en file d'attente."""
        requisition_id = self._creer_requisition(900000)
        self.client_de(self.salarie).post(f"/api/finance/requisitions/{requisition_id}/soumettre/")

        # La Finance se prononce avant le responsable du demandeur.
        for agent in (self.finance, self.chef, self.direction):
            reponse = self.client_de(agent).post(
                f"/api/finance/requisitions/{requisition_id}/valider/", {"commentaire": "OK"}
            )
            self.assertEqual(reponse.status_code, 200, reponse.data)

        requisition = Requisition.objects.get(pk=requisition_id)
        self.assertEqual(requisition.statut, StatutDocument.APPROUVE)

    def test_l_etape_decisive_clot_le_dossier_sans_attendre_les_autres(self):
        """Le dernier mot tombe : les avis restants deviennent sans objet."""
        requisition_id = self._creer_requisition(900000)
        self.client_de(self.salarie).post(f"/api/finance/requisitions/{requisition_id}/soumettre/")

        reponse = self.client_de(self.direction).post(
            f"/api/finance/requisitions/{requisition_id}/valider/", {"commentaire": "Accord"}
        )
        self.assertEqual(reponse.status_code, 200, reponse.data)

        requisition = Requisition.objects.get(pk=requisition_id)
        self.assertEqual(requisition.statut, StatutDocument.APPROUVE)
        self.assertEqual(
            requisition.etapes.filter(decision=Decision.IGNORE).count(),
            2,
            "Les deux etapes non tranchees doivent etre marquees sans objet.",
        )

        # Le dossier ne figure plus dans la file de personne.
        for agent in (self.chef, self.finance):
            file_ = self.client_de(agent).get("/api/finance/requisitions/a-valider/")
            self.assertEqual(file_.data["count"], 0)

    def test_un_valideur_hors_circuit_est_refuse(self):
        requisition_id = self._creer_requisition(100000)
        self.client_de(self.salarie).post(f"/api/finance/requisitions/{requisition_id}/soumettre/")
        reponse = self.client_de(self.autre).post(
            f"/api/finance/requisitions/{requisition_id}/valider/"
        )
        self.assertEqual(reponse.status_code, 403)

    def test_rejet_interrompt_le_circuit(self):
        requisition_id = self._creer_requisition(900000)
        self.client_de(self.salarie).post(f"/api/finance/requisitions/{requisition_id}/soumettre/")
        self.client_de(self.chef).post(f"/api/finance/requisitions/{requisition_id}/valider/")

        reponse = self.client_de(self.finance).post(
            f"/api/finance/requisitions/{requisition_id}/rejeter/",
            {"commentaire": "Budget indisponible"},
        )
        self.assertEqual(reponse.status_code, 200)

        requisition = Requisition.objects.get(pk=requisition_id)
        self.assertEqual(requisition.statut, StatutDocument.REJETE)
        self.assertEqual(requisition.motif_rejet, "Budget indisponible")
        self.assertEqual(
            requisition.etapes.filter(decision=Decision.IGNORE).count(),
            1,
            "L'etape Direction restante doit etre ignoree.",
        )

    def test_rejet_sans_motif_refuse(self):
        requisition_id = self._creer_requisition(100000)
        self.client_de(self.salarie).post(f"/api/finance/requisitions/{requisition_id}/soumettre/")
        reponse = self.client_de(self.chef).post(
            f"/api/finance/requisitions/{requisition_id}/rejeter/"
        )
        self.assertEqual(reponse.status_code, 400)



class MaitriseDuDemandeurTest(BaseAPITestCase):
    """Un dossier appartient a son auteur jusqu'a la premiere decision.

    L'interface soumet la demande dans la foulee de sa creation : si la
    soumission verrouillait, une virgule mal placee condamnerait le demandeur
    a laisser circuler un chiffre faux. Le verrou tombe donc au premier geste
    d'un responsable, pas avant — et il ne se releve jamais.
    """

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        SeuilValidation.objects.create(
            libelle="Validation hierarchique",
            type_document=TypeDocument.REQUISITION,
            role_valideur=Role.DIRECTION,
            ordre=1,
            valideur_hierarchique=True,
        )
        SeuilValidation.objects.create(
            libelle="Accord Direction",
            type_document=TypeDocument.REQUISITION,
            role_valideur=Role.DIRECTION,
            ordre=2,
            montant_min=Decimal("500000"),
        )

    def _requisition_en_circulation(self, montant=100000):
        client = self.client_de(self.salarie)
        reponse = client.post(
            "/api/finance/requisitions/",
            {
                "objet": "Achat materiel",
                "lignes": [
                    {"designation": "Materiel", "quantite": "1", "prix_unitaire": str(montant)}
                ],
            },
            format="json",
        )
        self.assertEqual(reponse.status_code, 201, reponse.data)
        identifiant = reponse.data["id"]
        client.post(f"/api/finance/requisitions/{identifiant}/soumettre/")
        return identifiant

    # --- Avant toute decision ---------------------------------------------

    def test_dossier_en_circulation_reste_modifiable_par_son_auteur(self):
        identifiant = self._requisition_en_circulation()
        reponse = self.client_de(self.salarie).patch(
            f"/api/finance/requisitions/{identifiant}/",
            {"objet": "Achat de cartouches"},
            format="json",
        )
        self.assertEqual(reponse.status_code, 200, reponse.data)
        self.assertEqual(
            Requisition.objects.get(pk=identifiant).objet, "Achat de cartouches"
        )

    def test_dossier_en_circulation_se_supprime(self):
        identifiant = self._requisition_en_circulation()
        reponse = self.client_de(self.salarie).delete(
            f"/api/finance/requisitions/{identifiant}/"
        )
        self.assertEqual(reponse.status_code, 204)
        self.assertFalse(Requisition.objects.filter(pk=identifiant).exists())

    def test_api_annonce_le_dossier_modifiable(self):
        identifiant = self._requisition_en_circulation()
        reponse = self.client_de(self.salarie).get(
            f"/api/finance/requisitions/{identifiant}/"
        )
        self.assertTrue(reponse.data["modifiable"])
        self.assertEqual(reponse.data["verrou_motif"], "")

    def test_montant_revu_reconstruit_le_circuit(self):
        """Une demande revue a la hausse passe devant les valideurs qu'elle appelle."""
        identifiant = self._requisition_en_circulation(100000)
        requisition = Requisition.objects.get(pk=identifiant)
        self.assertEqual(requisition.etapes.count(), 1)

        reponse = self.client_de(self.salarie).patch(
            f"/api/finance/requisitions/{identifiant}/",
            {
                "lignes": [
                    {"designation": "Materiel", "quantite": "1", "prix_unitaire": "900000"}
                ]
            },
            format="json",
        )
        self.assertEqual(reponse.status_code, 200, reponse.data)

        requisition.refresh_from_db()
        self.assertEqual(requisition.montant, Decimal("900000"))
        self.assertEqual(
            [etape.libelle for etape in requisition.etapes.all()],
            ["Validation hierarchique", "Accord Direction"],
        )

    # --- Le verrou ---------------------------------------------------------

    def test_premiere_decision_verrouille_le_dossier(self):
        identifiant = self._requisition_en_circulation(900000)
        # Le responsable approuve son etape ; le dossier circule encore vers
        # la Direction, mais il n'appartient deja plus a son auteur.
        self.client_de(self.chef).post(f"/api/finance/requisitions/{identifiant}/valider/")
        self.assertEqual(
            Requisition.objects.get(pk=identifiant).statut, StatutDocument.EN_VALIDATION
        )

        client = self.client_de(self.salarie)
        modification = client.patch(
            f"/api/finance/requisitions/{identifiant}/", {"objet": "Autre"}, format="json"
        )
        self.assertEqual(modification.status_code, 400)
        self.assertEqual(
            client.delete(f"/api/finance/requisitions/{identifiant}/").status_code, 400
        )

    def test_dossier_rejete_ne_se_modifie_plus(self):
        identifiant = self._requisition_en_circulation()
        self.client_de(self.chef).post(
            f"/api/finance/requisitions/{identifiant}/rejeter/",
            {"commentaire": "Budget indisponible"},
        )
        reponse = self.client_de(self.salarie).patch(
            f"/api/finance/requisitions/{identifiant}/", {"objet": "Autre"}, format="json"
        )
        self.assertEqual(reponse.status_code, 400)

    def test_dossier_approuve_ne_se_supprime_pas(self):
        identifiant = self._requisition_en_circulation()
        self.client_de(self.chef).post(f"/api/finance/requisitions/{identifiant}/valider/")
        self.assertEqual(
            Requisition.objects.get(pk=identifiant).statut, StatutDocument.APPROUVE
        )
        reponse = self.client_de(self.salarie).delete(
            f"/api/finance/requisitions/{identifiant}/"
        )
        self.assertEqual(reponse.status_code, 400)
        self.assertTrue(Requisition.objects.filter(pk=identifiant).exists())

    def test_etape_pour_information_ne_verrouille_pas(self):
        """Personne n'a agi : le dossier reste entre les mains du demandeur."""
        SeuilValidation.objects.create(
            libelle="Information Finance",
            type_document=TypeDocument.REQUISITION,
            role_valideur=Role.FINANCE,
            ordre=3,
            nature=NatureEtape.INFORMATION,
        )
        identifiant = self._requisition_en_circulation()
        requisition = Requisition.objects.get(pk=identifiant)
        self.assertTrue(
            requisition.etapes.filter(decision=Decision.APPROUVE).exists(),
            "L'etape d'information doit etre franchie des la soumission.",
        )
        reponse = self.client_de(self.salarie).patch(
            f"/api/finance/requisitions/{identifiant}/", {"objet": "Autre"}, format="json"
        )
        self.assertEqual(reponse.status_code, 200, reponse.data)

    # --- Les deux guichets du quotidien -----------------------------------

    def test_demande_absence_corrigee_puis_retiree(self):
        """Le parcours reel d'un conge : deposer, corriger, se raviser.

        L'interface soumet la demande des sa creation ; c'est donc bien un
        dossier en circulation que le demandeur retouche.
        """
        SeuilValidation.objects.create(
            libelle="Accord du responsable",
            type_document=TypeDocument.ABSENCE,
            role_valideur=Role.DIRECTION,
            ordre=1,
            valideur_hierarchique=True,
        )
        client = self.client_de(self.salarie)
        creation = client.post(
            "/api/rh/demandes-absence/",
            {
                "type_absence": "Conge annuel",
                "date_debut": "2026-09-01",
                "date_fin": "2026-09-05",
                "motif": "Vacances",
            },
            format="json",
        )
        self.assertEqual(creation.status_code, 201, creation.data)
        identifiant = creation.data["id"]
        client.post(f"/api/rh/demandes-absence/{identifiant}/soumettre/")

        correction = client.patch(
            f"/api/rh/demandes-absence/{identifiant}/",
            {"date_fin": "2026-09-03", "motif": "Vacances, retour avance"},
            format="json",
        )
        self.assertEqual(correction.status_code, 200, correction.data)
        demande = DemandeAbsence.objects.get(pk=identifiant)
        self.assertEqual(demande.date_fin, date(2026, 9, 3))
        # La duree est recalculee a l'enregistrement, pas saisie.
        self.assertEqual(demande.nb_jours, Decimal("3.0"))

        self.assertEqual(
            client.delete(f"/api/rh/demandes-absence/{identifiant}/").status_code, 204
        )
        self.assertFalse(DemandeAbsence.objects.filter(pk=identifiant).exists())

    def test_demande_finance_verrouillee_par_la_decision(self):
        SeuilValidation.objects.create(
            libelle="Accord du responsable",
            type_document=TypeDocument.DEPENSE,
            role_valideur=Role.DIRECTION,
            ordre=1,
            valideur_hierarchique=True,
        )
        categorie = CategorieDepense.objects.create(code="DIV", libelle="Divers")
        client = self.client_de(self.salarie)
        creation = client.post(
            "/api/finance/depenses/",
            {
                "libelle": "Cartouches d'encre",
                "montant": "45000",
                "date_depense": "2026-09-01",
                "categorie": categorie.id,
                "description": "Stock epuise",
            },
            format="json",
        )
        self.assertEqual(creation.status_code, 201, creation.data)
        identifiant = creation.data["id"]
        client.post(f"/api/finance/depenses/{identifiant}/soumettre/")

        self.assertEqual(
            client.patch(
                f"/api/finance/depenses/{identifiant}/",
                {"montant": "52000"},
                format="json",
            ).status_code,
            200,
        )

        self.client_de(self.chef).post(f"/api/finance/depenses/{identifiant}/valider/")
        refus = client.patch(
            f"/api/finance/depenses/{identifiant}/", {"montant": "60000"}, format="json"
        )
        self.assertEqual(refus.status_code, 400)
        self.assertIn("modifiable", str(refus.data))

    # --- A qui le dossier appartient --------------------------------------

    def test_un_encadrant_ne_retire_pas_la_demande_de_son_agent(self):
        identifiant = self._requisition_en_circulation()
        reponse = self.client_de(self.chef).delete(
            f"/api/finance/requisitions/{identifiant}/"
        )
        self.assertEqual(reponse.status_code, 403)
        self.assertTrue(Requisition.objects.filter(pk=identifiant).exists())

    def test_le_back_office_ne_corrige_pas_a_la_place_du_demandeur(self):
        identifiant = self._requisition_en_circulation()
        reponse = self.client_de(self.finance).patch(
            f"/api/finance/requisitions/{identifiant}/", {"objet": "Autre"}, format="json"
        )
        self.assertEqual(reponse.status_code, 403)


class CloisonnementTest(BaseAPITestCase):
    """Chaque agent ne voit que son perimetre : contrainte de confidentialite."""

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        for demandeur in (cls.salarie, cls.autre):
            Requisition.objects.create(demandeur=demandeur, objet="Besoin", montant=Decimal("1000"))

    def _nombre_visible(self, agent):
        reponse = self.client_de(agent).get("/api/finance/requisitions/")
        self.assertEqual(reponse.status_code, 200)
        return reponse.data["count"]

    def test_salarie_ne_voit_que_ses_documents(self):
        self.assertEqual(self._nombre_visible(self.salarie), 1)

    def test_encadrant_voit_son_equipe(self):
        self.assertEqual(self._nombre_visible(self.chef), 1)

    def test_finance_voit_tout(self):
        self.assertEqual(self._nombre_visible(self.finance), 2)

    def test_rh_ne_voit_pas_les_documents_finance_des_autres(self):
        # Le back-office RH n'a aucun privilege sur le perimetre Finance.
        self.assertEqual(self._nombre_visible(self.rh), 0)

    def test_scoring_rh_ferme_aux_salaries_et_a_la_finance(self):
        self.assertEqual(self.client_de(self.salarie).get("/api/rh/scoring/").status_code, 403)
        self.assertEqual(self.client_de(self.finance).get("/api/rh/scoring/").status_code, 403)
        self.assertEqual(self.client_de(self.rh).get("/api/rh/scoring/").status_code, 200)

    def test_indicateurs_rh_fermes_hors_back_office_rh(self):
        # Effectifs et turnover portent sur tout le personnel : perimetre RH.
        self.assertEqual(
            self.client_de(self.salarie).get("/api/rh/indicateurs/").status_code, 403
        )
        self.assertEqual(
            self.client_de(self.finance).get("/api/rh/indicateurs/").status_code, 403
        )
        self.assertEqual(
            self.client_de(self.rh).get("/api/rh/indicateurs/").status_code, 200
        )
        self.assertEqual(
            self.client_de(self.direction).get("/api/rh/indicateurs/").status_code, 200
        )

    def test_soldes_de_caisse_masques_hors_finance(self):
        Caisse.objects.create(
            code="C1", libelle="Caisse siege", solde_initial=Decimal("500000")
        )
        # La liste reste lisible : un demandeur doit pouvoir choisir sa caisse.
        vue_salarie = self.client_de(self.salarie).get("/api/finance/caisses/")
        self.assertEqual(vue_salarie.status_code, 200)
        self.assertEqual(vue_salarie.data["count"], 1)
        self.assertNotIn("solde_actuel", vue_salarie.data["results"][0])
        self.assertIn("libelle", vue_salarie.data["results"][0])

        vue_finance = self.client_de(self.finance).get("/api/finance/caisses/")
        self.assertIn("solde_actuel", vue_finance.data["results"][0])

    def test_indicateurs_finance_masquent_les_caisses_hors_finance(self):
        reponse = self.client_de(self.salarie).get("/api/finance/indicateurs/")
        self.assertEqual(reponse.data["perimetre"], "PERSONNEL")
        self.assertNotIn("caisses", reponse.data)

        reponse_direction = self.client_de(self.direction).get("/api/finance/indicateurs/")
        self.assertEqual(reponse_direction.data["perimetre"], "GLOBAL")
        self.assertIn("caisses", reponse_direction.data)

    def test_salarie_ne_cree_pas_d_agent(self):
        reponse = self.client_de(self.salarie).post(
            "/api/utilisateurs/", {"username": "pirate", "first_name": "P", "last_name": "Q"},
            format="json",
        )
        self.assertEqual(reponse.status_code, 403)


class DemandeAbsenceTest(BaseAPITestCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.conge = TypeAbsence.objects.create(
            code="CA", libelle="Conge annuel", categorie=CategorieAbsence.CONGE,
            decompte_solde=True, duree_max_jours=30,
        )
        cls.maladie = TypeAbsence.objects.create(
            code="CM", libelle="Conge maladie", categorie=CategorieAbsence.CONGE,
            decompte_solde=False, duree_max_jours=15, justificatif_requis=True,
        )
        SeuilValidation.objects.create(
            libelle="Validation hierarchique",
            type_document=TypeDocument.ABSENCE,
            role_valideur=Role.DIRECTION,
            ordre=1,
            valideur_hierarchique=True,
        )
        SeuilValidation.objects.create(
            libelle="Controle RH", type_document=TypeDocument.ABSENCE,
            role_valideur=Role.RH, ordre=2,
        )

    def _demander(self, type_absence=None, jours=4, libelle=None, **extra):
        """``libelle`` permet de saisir un type en clair, connu ou non."""
        debut = timezone.localdate() + timedelta(days=10)
        return self.client_de(self.salarie).post(
            "/api/rh/demandes-absence/",
            {
                "type_absence": libelle if libelle is not None else type_absence.libelle,
                "date_debut": debut.isoformat(),
                "date_fin": (debut + timedelta(days=jours - 1)).isoformat(),
                "motif": "Repos",
                **extra,
            },
            format="json",
        )

    def test_nb_jours_calcule(self):
        reponse = self._demander(self.conge, jours=4)
        self.assertEqual(reponse.status_code, 201, reponse.data)
        self.assertEqual(Decimal(reponse.data["nb_jours"]), Decimal("4.0"))

    def test_date_fin_anterieure_refusee(self):
        debut = timezone.localdate() + timedelta(days=10)
        reponse = self.client_de(self.salarie).post(
            "/api/rh/demandes-absence/",
            {
                "type_absence": self.conge.libelle,
                "date_debut": debut.isoformat(),
                "date_fin": (debut - timedelta(days=2)).isoformat(),
                "motif": "Erreur",
            },
            format="json",
        )
        self.assertEqual(reponse.status_code, 400)

    def test_duree_maximale_du_type_respectee(self):
        reponse = self._demander(self.maladie, jours=40)
        self.assertEqual(reponse.status_code, 400)
        self.assertIn("date_fin", reponse.data)

    def test_justificatif_obligatoire(self):
        reponse = self._demander(self.maladie, jours=3)
        self.assertEqual(reponse.status_code, 400)
        self.assertIn("justificatif", reponse.data)

    def test_approbation_decremente_le_solde_et_alimente_les_presences(self):
        SoldeConge.objects.create(
            agent=self.salarie, annee=(timezone.localdate() + timedelta(days=10)).year,
            jours_acquis=Decimal("30.0"),
        )
        demande_id = self._demander(self.conge, jours=4).data["id"]
        self.client_de(self.salarie).post(f"/api/rh/demandes-absence/{demande_id}/soumettre/")
        self.client_de(self.chef).post(f"/api/rh/demandes-absence/{demande_id}/valider/")
        self.client_de(self.rh).post(f"/api/rh/demandes-absence/{demande_id}/valider/")

        demande = DemandeAbsence.objects.get(pk=demande_id)
        self.assertEqual(demande.statut, StatutDocument.APPROUVE)

        solde = SoldeConge.objects.get(agent=self.salarie, annee=demande.date_debut.year)
        self.assertEqual(solde.jours_pris, Decimal("4.0"))
        self.assertEqual(solde.jours_restants, Decimal("26.0"))
        self.assertEqual(self.salarie.presences.filter(statut="CONGE").count(), 4)

    def test_conge_maladie_ne_decompte_pas_le_solde(self):
        annee = (timezone.localdate() + timedelta(days=10)).year
        SoldeConge.objects.create(agent=self.salarie, annee=annee, jours_acquis=Decimal("30.0"))
        with open(__file__, "rb") as justificatif:
            reponse = self.client_de(self.salarie).post(
                "/api/rh/demandes-absence/",
                {
                    "type_absence": self.maladie.libelle,
                    "date_debut": (timezone.localdate() + timedelta(days=10)).isoformat(),
                    "date_fin": (timezone.localdate() + timedelta(days=12)).isoformat(),
                    "motif": "Arret maladie",
                    "justificatif": justificatif,
                },
            )
        self.assertEqual(reponse.status_code, 201, reponse.data)
        demande_id = reponse.data["id"]
        self.client_de(self.salarie).post(f"/api/rh/demandes-absence/{demande_id}/soumettre/")
        self.client_de(self.chef).post(f"/api/rh/demandes-absence/{demande_id}/valider/")
        self.client_de(self.rh).post(f"/api/rh/demandes-absence/{demande_id}/valider/")

        solde = SoldeConge.objects.get(agent=self.salarie, annee=annee)
        self.assertEqual(solde.jours_pris, Decimal("0.0"))

    def test_type_saisi_librement_est_cree_sans_entamer_le_solde(self):
        """Le demandeur saisit son type en clair ; le referentiel suit."""
        annee = (timezone.localdate() + timedelta(days=10)).year
        SoldeConge.objects.create(agent=self.salarie, annee=annee, jours_acquis=Decimal("30.0"))

        reponse = self._demander(type_absence=None, jours=2, libelle="Conge sans solde")
        self.assertEqual(reponse.status_code, 201, reponse.data)

        cree = TypeAbsence.objects.get(libelle="Conge sans solde")
        self.assertFalse(
            cree.decompte_solde,
            "Un type non arbitre par les RH ne doit pas retirer de jours.",
        )

        demande_id = reponse.data["id"]
        self.client_de(self.salarie).post(f"/api/rh/demandes-absence/{demande_id}/soumettre/")
        self.client_de(self.chef).post(f"/api/rh/demandes-absence/{demande_id}/valider/")
        self.client_de(self.rh).post(f"/api/rh/demandes-absence/{demande_id}/valider/")

        solde = SoldeConge.objects.get(agent=self.salarie, annee=annee)
        self.assertEqual(solde.jours_pris, Decimal("0.0"))

    def test_type_saisi_reutilise_le_type_existant(self):
        """Une casse differente ne doit pas dupliquer le referentiel."""
        reponse = self._demander(type_absence=None, jours=2, libelle="  conge   ANNUEL ")
        self.assertEqual(reponse.status_code, 201, reponse.data)

        demande = DemandeAbsence.objects.get(pk=reponse.data["id"])
        self.assertEqual(demande.type_absence, self.conge)
        self.assertEqual(TypeAbsence.objects.filter(libelle__iexact="conge annuel").count(), 1)

    def test_type_saisi_vide_refuse(self):
        reponse = self._demander(type_absence=None, jours=2, libelle="   ")
        self.assertEqual(reponse.status_code, 400)
        self.assertIn("type_absence", reponse.data)

    def test_avis_defavorable_ne_bloque_pas_et_remonte_au_dernier_valideur(self):
        """Un avis negatif accompagne le dossier au lieu de l'arreter."""
        SeuilValidation.objects.filter(type_document=TypeDocument.ABSENCE).update(
            nature=NatureEtape.AVIS
        )
        SeuilValidation.objects.create(
            libelle="Decision du Directeur General",
            type_document=TypeDocument.ABSENCE,
            role_valideur=Role.DIRECTION,
            ordre=3,
            valideur_designe=self.direction,
        )

        demande_id = self._demander(self.conge, jours=2).data["id"]
        self.client_de(self.salarie).post(f"/api/rh/demandes-absence/{demande_id}/soumettre/")

        refus_chef = self.client_de(self.chef).post(
            f"/api/rh/demandes-absence/{demande_id}/rejeter/",
            {"commentaire": "Periode chargee"},
            format="json",
        )
        self.assertEqual(refus_chef.status_code, 200, refus_chef.data)

        demande = DemandeAbsence.objects.get(pk=demande_id)
        self.assertEqual(
            demande.statut,
            StatutDocument.EN_VALIDATION,
            "Un avis defavorable ne doit pas rejeter le dossier.",
        )
        self.assertEqual(demande.etape_courante.ordre, 2)

        self.client_de(self.rh).post(
            f"/api/rh/demandes-absence/{demande_id}/rejeter/",
            {"commentaire": "Solde insuffisant"},
            format="json",
        )
        demande.refresh_from_db()
        self.assertEqual(demande.statut, StatutDocument.EN_VALIDATION)
        self.assertEqual(demande.etape_courante.ordre, 3)

        # Les deux avis restent lisibles par celui qui tranche.
        commentaires = list(
            demande.etapes.order_by("ordre").values_list("commentaire", flat=True)
        )
        self.assertEqual(commentaires[:2], ["Periode chargee", "Solde insuffisant"])

        # Le Directeur General tranche : malgre deux avis negatifs, il accorde.
        accord = self.client_de(self.direction).post(
            f"/api/rh/demandes-absence/{demande_id}/valider/"
        )
        self.assertEqual(accord.status_code, 200, accord.data)
        demande.refresh_from_db()
        self.assertEqual(demande.statut, StatutDocument.APPROUVE)

    def test_refus_du_dernier_valideur_rejette_le_dossier(self):
        """L'etape qui tranche garde un refus bloquant."""
        SeuilValidation.objects.filter(type_document=TypeDocument.ABSENCE).update(
            nature=NatureEtape.AVIS
        )
        SeuilValidation.objects.create(
            libelle="Decision du Directeur General",
            type_document=TypeDocument.ABSENCE,
            role_valideur=Role.DIRECTION,
            ordre=3,
            valideur_designe=self.direction,
        )

        demande_id = self._demander(self.conge, jours=2).data["id"]
        self.client_de(self.salarie).post(f"/api/rh/demandes-absence/{demande_id}/soumettre/")
        self.client_de(self.chef).post(f"/api/rh/demandes-absence/{demande_id}/valider/")
        self.client_de(self.rh).post(f"/api/rh/demandes-absence/{demande_id}/valider/")
        self.client_de(self.direction).post(
            f"/api/rh/demandes-absence/{demande_id}/rejeter/",
            {"commentaire": "Refus definitif"},
            format="json",
        )

        demande = DemandeAbsence.objects.get(pk=demande_id)
        self.assertEqual(demande.statut, StatutDocument.REJETE)
        self.assertEqual(demande.motif_rejet, "Refus definitif")

    def test_avis_defavorable_sur_la_derniere_etape_bloque(self):
        """Sans etape suivante, personne ne peut trancher : le refus s'impose."""
        SeuilValidation.objects.filter(type_document=TypeDocument.ABSENCE).update(
            nature=NatureEtape.AVIS
        )

        demande_id = self._demander(self.conge, jours=2).data["id"]
        self.client_de(self.salarie).post(f"/api/rh/demandes-absence/{demande_id}/soumettre/")
        self.client_de(self.chef).post(f"/api/rh/demandes-absence/{demande_id}/valider/")
        self.client_de(self.rh).post(
            f"/api/rh/demandes-absence/{demande_id}/rejeter/",
            {"commentaire": "Derniere etape, refus"},
            format="json",
        )

        self.assertEqual(
            DemandeAbsence.objects.get(pk=demande_id).statut, StatutDocument.REJETE
        )

    def test_valideur_designe_a_seul_le_dernier_mot(self):
        """Un porteur du meme role ne peut pas trancher a la place du designe."""
        autre_directeur = creer_agent("adjoint", Role.DIRECTION)
        SeuilValidation.objects.create(
            libelle="Decision du Directeur General",
            type_document=TypeDocument.ABSENCE,
            role_valideur=Role.DIRECTION,
            ordre=3,
            valideur_designe=self.direction,
        )

        demande_id = self._demander(self.conge, jours=2).data["id"]
        self.client_de(self.salarie).post(f"/api/rh/demandes-absence/{demande_id}/soumettre/")
        self.client_de(self.chef).post(f"/api/rh/demandes-absence/{demande_id}/valider/")
        self.client_de(self.rh).post(f"/api/rh/demandes-absence/{demande_id}/valider/")

        refus = self.client_de(autre_directeur).post(
            f"/api/rh/demandes-absence/{demande_id}/valider/"
        )
        self.assertEqual(refus.status_code, 403)
        self.assertEqual(
            DemandeAbsence.objects.get(pk=demande_id).statut,
            StatutDocument.EN_VALIDATION,
        )

        accord = self.client_de(self.direction).post(
            f"/api/rh/demandes-absence/{demande_id}/valider/"
        )
        self.assertEqual(accord.status_code, 200)
        self.assertEqual(
            DemandeAbsence.objects.get(pk=demande_id).statut, StatutDocument.APPROUVE
        )


class ConstructionDuCircuitTest(BaseAPITestCase):
    """Nature des etapes, doublons d'intervenants et auto-validation."""

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.conge = TypeAbsence.objects.create(
            code="CA", libelle="Conge annuel", categorie=CategorieAbsence.CONGE
        )

    def _regle(self, libelle, ordre, role, nature, hierarchique=False, designe=None):
        return SeuilValidation.objects.create(
            libelle=libelle,
            type_document=TypeDocument.ABSENCE,
            role_valideur=role,
            ordre=ordre,
            valideur_hierarchique=hierarchique,
            valideur_designe=designe,
            nature=nature,
        )

    def _soumettre(self, agent):
        creation = self.client_de(agent).post(
            "/api/rh/demandes-absence/",
            {
                "type_absence": self.conge.libelle,
                "date_debut": (timezone.localdate() + timedelta(days=5)).isoformat(),
                "date_fin": (timezone.localdate() + timedelta(days=6)).isoformat(),
                "motif": "Repos",
            },
            format="json",
        )
        self.assertEqual(creation.status_code, 201, creation.data)
        demande_id = creation.data["id"]
        self.client_de(agent).post(f"/api/rh/demandes-absence/{demande_id}/soumettre/")
        return DemandeAbsence.objects.get(pk=demande_id)

    def test_etape_information_est_franchie_sans_intervention(self):
        self._regle("Avis du responsable", 1, Role.DIRECTION, NatureEtape.AVIS, hierarchique=True)
        self._regle("Service financier", 2, Role.FINANCE, NatureEtape.INFORMATION)
        self._regle("Decision", 3, Role.DIRECTION, NatureEtape.DECISION, designe=self.direction)

        demande = self._soumettre(self.salarie)
        information = demande.etapes.get(libelle="Service financier")
        self.assertEqual(information.decision, Decision.APPROUVE)
        self.assertIsNone(information.decide_par)

        # Le dossier n'attend pas le financier : apres le responsable, il file
        # directement au valideur qui decide.
        self.client_de(self.chef).post(f"/api/rh/demandes-absence/{demande.pk}/valider/")
        demande.refresh_from_db()
        self.assertEqual(demande.etape_courante.libelle, "Decision")

    def test_un_intervenant_present_a_deux_niveaux_se_prononce_au_plus_tot(self):
        """Le responsable direct passe avant les services transverses."""
        # Le responsable du demandeur est aussi le directeur cite plus loin.
        self._regle("Avis du responsable", 1, Role.DIRECTION, NatureEtape.AVIS, hierarchique=True)
        self._regle("Avis RH", 2, Role.RH, NatureEtape.AVIS)
        self._regle("Avis du directeur", 3, Role.DIRECTION, NatureEtape.AVIS, designe=self.chef)
        self._regle("Decision", 4, Role.DIRECTION, NatureEtape.DECISION, designe=self.direction)

        demande = self._soumettre(self.salarie)
        self.assertEqual(
            [etape.libelle for etape in demande.etapes.all()],
            ["Avis du responsable", "Avis RH", "Decision"],
            "A nature egale, l'intervention la plus precoce est conservee.",
        )
        self.assertEqual(demande.etape_courante.valideur_attendu, self.chef)

    def test_une_decision_ne_remonte_jamais_au_debut_du_circuit(self):
        """Meme responsable du demandeur, celui qui tranche tranche en dernier."""
        # Le demandeur est rattache a la Direction, qui decide en fin de circuit.
        self._regle("Avis du responsable", 1, Role.DIRECTION, NatureEtape.AVIS, hierarchique=True)
        self._regle("Avis RH", 2, Role.RH, NatureEtape.AVIS)
        self._regle("Decision", 3, Role.DIRECTION, NatureEtape.DECISION, designe=self.direction)

        demande = self._soumettre(self.autre)
        self.assertEqual(
            [etape.libelle for etape in demande.etapes.all()],
            ["Avis RH", "Decision"],
            "La decision l'emporte sur l'avis rendu plus tot, et reste a la fin.",
        )

    def test_le_demandeur_ne_figure_jamais_dans_son_propre_circuit(self):
        self._regle("Avis du responsable", 1, Role.DIRECTION, NatureEtape.AVIS, hierarchique=True)
        self._regle("Avis RH", 2, Role.RH, NatureEtape.AVIS)
        self._regle("Decision", 3, Role.DIRECTION, NatureEtape.DECISION, designe=self.direction)

        # Le RH demande un conge : l'etape RH le viserait lui-meme.
        demande = self._soumettre(self.rh)
        self.assertNotIn("Avis RH", [etape.libelle for etape in demande.etapes.all()])
        self.assertFalse(
            demande.etapes.filter(valideur_attendu=self.rh).exists(),
            "Le demandeur ne doit etre attendu sur aucune etape.",
        )

    def test_le_demandeur_ne_peut_pas_decider_meme_vise_par_le_role(self):
        self._regle("Avis RH", 1, Role.RH, NatureEtape.AVIS)
        self._regle("Decision", 2, Role.DIRECTION, NatureEtape.DECISION, designe=self.direction)

        demande = self._soumettre(self.salarie)
        self.assertEqual(demande.etape_courante.libelle, "Avis RH")

        # On force l'etape sur le demandeur pour couvrir un circuit construit
        # avant un changement de role.
        DemandeAbsence.objects.filter(pk=demande.pk).update(demandeur=self.rh)
        demande.refresh_from_db()
        refus = self.client_de(self.rh).post(f"/api/rh/demandes-absence/{demande.pk}/valider/")
        self.assertEqual(refus.status_code, 403)


class VisibiliteFinanceSurLesAbsencesTest(BaseAPITestCase):
    """Le service financier est informe des absences, sans y decider."""

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.conge = TypeAbsence.objects.create(
            code="CA", libelle="Conge annuel", categorie=CategorieAbsence.CONGE
        )
        SeuilValidation.objects.create(
            libelle="Service financier",
            type_document=TypeDocument.ABSENCE,
            role_valideur=Role.FINANCE,
            ordre=1,
            nature=NatureEtape.INFORMATION,
        )
        SeuilValidation.objects.create(
            libelle="Decision",
            type_document=TypeDocument.ABSENCE,
            role_valideur=Role.DIRECTION,
            ordre=2,
            valideur_designe=cls.direction,
        )

    def _soumettre(self):
        creation = self.client_de(self.salarie).post(
            "/api/rh/demandes-absence/",
            {
                "type_absence": self.conge.libelle,
                "date_debut": (timezone.localdate() + timedelta(days=5)).isoformat(),
                "date_fin": (timezone.localdate() + timedelta(days=6)).isoformat(),
                "motif": "Repos",
            },
            format="json",
        )
        demande_id = creation.data["id"]
        self.client_de(self.salarie).post(f"/api/rh/demandes-absence/{demande_id}/soumettre/")
        return demande_id

    def test_le_financier_lit_les_absences_de_tout_le_monde(self):
        self._soumettre()
        reponse = self.client_de(self.finance).get("/api/rh/demandes-absence/")
        self.assertEqual(reponse.status_code, 200)
        self.assertEqual(reponse.data["count"], 1)

    def test_le_financier_n_a_aucune_absence_a_valider(self):
        self._soumettre()
        reponse = self.client_de(self.finance).get("/api/rh/demandes-absence/a-valider/")
        self.assertEqual(reponse.status_code, 200)
        self.assertEqual(
            reponse.data["count"],
            0,
            "Une etape d'information ne doit jamais peupler une file de validation.",
        )

    def test_les_indicateurs_rh_restent_fermes_au_financier(self):
        for route in ("/api/rh/indicateurs/", "/api/rh/scoring/"):
            with self.subTest(route=route):
                self.assertEqual(self.client_de(self.finance).get(route).status_code, 403)


class VisibiliteRhSurLesDemandesTest(BaseAPITestCase):
    """Les RH figurent dans le circuit des demandes : elles doivent les lire."""

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.categorie = CategorieDepense.objects.create(code="GEN", libelle="General")
        SeuilValidation.objects.create(
            libelle="Avis des Ressources Humaines",
            type_document=TypeDocument.DEPENSE,
            role_valideur=Role.RH,
            ordre=1,
            nature=NatureEtape.AVIS,
        )
        SeuilValidation.objects.create(
            libelle="Decision du Directeur General",
            type_document=TypeDocument.DEPENSE,
            role_valideur=Role.DIRECTION,
            ordre=2,
            valideur_designe=cls.direction,
        )

    def _soumettre(self):
        creation = self.client_de(self.salarie).post(
            "/api/finance/depenses/",
            {
                "libelle": "Fournitures",
                "montant": "50000",
                "date_depense": timezone.localdate().isoformat(),
                "description": "Papeterie du service",
            },
            format="json",
        )
        self.assertEqual(creation.status_code, 201, creation.data)
        depense_id = creation.data["id"]
        self.client_de(self.salarie).post(f"/api/finance/depenses/{depense_id}/soumettre/")
        return depense_id

    def test_les_rh_lisent_les_demandes_sur_lesquelles_elles_se_prononcent(self):
        self._soumettre()
        file_ = self.client_de(self.rh).get("/api/finance/depenses/a-valider/")
        registre = self.client_de(self.rh).get("/api/finance/depenses/")
        self.assertEqual(file_.data["count"], 1)
        self.assertEqual(
            registre.data["count"],
            1,
            "Se prononcer sur un dossier qu'on ne peut pas consulter n'a pas de sens.",
        )

    def test_un_salarie_ne_voit_pas_les_demandes_des_autres(self):
        self._soumettre()
        registre = self.client_de(self.autre).get("/api/finance/depenses/")
        self.assertEqual(registre.data["count"], 0)

    def test_la_categorie_comptable_n_est_pas_demandee_au_formulaire(self):
        """Le salarie n'a pas a connaitre le plan comptable."""
        depense_id = self._soumettre()
        depense = Depense.objects.get(pk=depense_id)
        self.assertIsNotNone(depense.categorie)

    def test_le_directeur_general_clot_la_demande_sans_attendre_les_avis(self):
        depense_id = self._soumettre()
        reponse = self.client_de(self.direction).post(
            f"/api/finance/depenses/{depense_id}/valider/", {"commentaire": "Accord"}
        )
        self.assertEqual(reponse.status_code, 200, reponse.data)

        depense = Depense.objects.get(pk=depense_id)
        self.assertEqual(depense.statut, StatutDocument.APPROUVE)
        self.assertEqual(depense.etapes.filter(decision=Decision.IGNORE).count(), 1)
        self.assertEqual(
            self.client_de(self.rh).get("/api/finance/depenses/a-valider/").data["count"],
            0,
        )


class ConnexionTest(BaseAPITestCase):
    """Un agent se connecte par son identifiant ou son adresse."""

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.salarie.email = "s.alarie@exemple.net"
        cls.salarie.set_password(MDP)
        cls.salarie.save(update_fields=["email", "password"])

    def _connexion(self, identifiant, mot_de_passe=MDP):
        return APIClient().post(
            "/api/auth/connexion/",
            {"username": identifiant, "password": mot_de_passe},
            format="json",
        )

    def test_connexion_par_identifiant(self):
        self.assertEqual(self._connexion("salarie").status_code, 200)

    def test_connexion_par_email(self):
        reponse = self._connexion("s.alarie@exemple.net")
        self.assertEqual(reponse.status_code, 200)
        self.assertEqual(reponse.data["utilisateur"]["username"], "salarie")

    def test_email_insensible_a_la_casse(self):
        self.assertEqual(self._connexion("S.Alarie@Exemple.NET").status_code, 200)

    def test_mauvais_mot_de_passe_refuse(self):
        self.assertEqual(self._connexion("salarie", "au-hasard").status_code, 401)

    def test_identifiant_inconnu_refuse(self):
        self.assertEqual(self._connexion("personne@exemple.net").status_code, 401)

    def test_compte_desactive_refuse(self):
        self.salarie.is_active = False
        self.salarie.save(update_fields=["is_active"])
        self.assertEqual(self._connexion("s.alarie@exemple.net").status_code, 401)


class ResponsableDeDepartementTest(BaseAPITestCase):
    """L'etape hierarchique vise le responsable du departement du demandeur."""

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.conge = TypeAbsence.objects.create(
            code="CA", libelle="Conge annuel", categorie=CategorieAbsence.CONGE
        )
        SeuilValidation.objects.create(
            libelle="Avis du responsable",
            type_document=TypeDocument.ABSENCE,
            role_valideur=Role.DIRECTION,
            ordre=1,
            valideur_hierarchique=True,
            nature=NatureEtape.AVIS,
        )
        SeuilValidation.objects.create(
            libelle="Decision",
            type_document=TypeDocument.ABSENCE,
            role_valideur=Role.DIRECTION,
            ordre=2,
            valideur_designe=cls.direction,
        )

    def _soumettre(self, agent):
        creation = self.client_de(agent).post(
            "/api/rh/demandes-absence/",
            {
                "type_absence": self.conge.libelle,
                "date_debut": (timezone.localdate() + timedelta(days=5)).isoformat(),
                "date_fin": (timezone.localdate() + timedelta(days=6)).isoformat(),
                "motif": "Repos",
            },
            format="json",
        )
        self.assertEqual(creation.status_code, 201, creation.data)
        demande_id = creation.data["id"]
        self.client_de(agent).post(f"/api/rh/demandes-absence/{demande_id}/soumettre/")
        return DemandeAbsence.objects.get(pk=demande_id)

    def test_le_responsable_du_departement_passe_avant_le_manager(self):
        # Le salarie est rattache au chef, mais son departement est dirige par
        # un autre agent : c'est ce dernier qui doit se prononcer.
        self.departement.responsable = self.autre
        self.departement.save(update_fields=["responsable"])

        demande = self._soumettre(self.salarie)
        premiere = demande.etapes.order_by("ordre").first()
        self.assertEqual(premiere.valideur_attendu, self.autre)

    def test_repli_sur_le_manager_sans_responsable_de_departement(self):
        self.departement.responsable = None
        self.departement.save(update_fields=["responsable"])

        demande = self._soumettre(self.salarie)
        self.assertEqual(demande.etapes.order_by("ordre").first().valideur_attendu, self.chef)

    def test_le_responsable_du_departement_ne_se_valide_pas_lui_meme(self):
        # Le chef dirige son propre departement : sa demande remonte a son
        # manager, pas a lui-meme.
        self.departement.responsable = self.chef
        self.departement.save(update_fields=["responsable"])

        demande = self._soumettre(self.chef)
        valideurs = [etape.valideur_attendu for etape in demande.etapes.all()]
        self.assertNotIn(self.chef, valideurs)
        self.assertIn(self.direction, valideurs)

    def test_le_departement_du_demandeur_accompagne_le_dossier(self):
        self.departement.responsable = self.autre
        self.departement.save(update_fields=["responsable"])
        demande = self._soumettre(self.salarie)

        reponse = self.client_de(self.rh).get(f"/api/rh/demandes-absence/{demande.pk}/")
        self.assertEqual(reponse.status_code, 200)
        self.assertEqual(reponse.data["demandeur_departement_nom"], self.departement.nom)
