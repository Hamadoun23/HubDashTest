"""Detail d'un dossier, echanges, mise en attente et versions."""

from datetime import timedelta

from django.utils import timezone

from core.constants import Role, StatutDocument, TypeDocument
from core.models import EvenementDossier, SeuilValidation
from core.tests import BaseAPITestCase
from rh.models import CategorieAbsence, TypeAbsence

T = EvenementDossier.Type


class DossierEchangesTest(BaseAPITestCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.conge = TypeAbsence.objects.create(
            code="CA", libelle="Conge annuel", categorie=CategorieAbsence.CONGE,
            decompte_solde=False, duree_max_jours=30,
        )
        SeuilValidation.objects.create(
            libelle="Avis du responsable", type_document=TypeDocument.ABSENCE,
            role_valideur=Role.DIRECTION, ordre=1, valideur_hierarchique=True,
        )
        SeuilValidation.objects.create(
            libelle="Controle RH", type_document=TypeDocument.ABSENCE, role_valideur=Role.RH, ordre=2,
        )

    def setUp(self):
        debut = timezone.localdate() + timedelta(days=10)
        reponse = self.client_de(self.salarie).post(
            "/api/rh/demandes-absence/",
            {
                "type_absence": self.conge.libelle,
                "date_debut": debut.isoformat(),
                "date_fin": (debut + timedelta(days=2)).isoformat(),
                "motif": "Repos",
            },
            format="json",
        )
        self.assertEqual(reponse.status_code, 201, reponse.data)
        self.id = reponse.data["id"]
        self.url = f"/api/rh/demandes-absence/{self.id}"
        self.client_de(self.salarie).post(f"{self.url}/soumettre/")

    def _dossier(self, agent):
        return self.client_de(agent).get(f"{self.url}/dossier/")

    def test_detail_ouvert_au_demandeur_et_aux_valideurs(self):
        for agent in (self.salarie, self.chef, self.rh, self.direction):
            self.assertEqual(self._dossier(agent).status_code, 200, agent.username)
        # Un collegue sans role dans le circuit ne voit rien.
        self.assertEqual(self._dossier(self.autre).status_code, 404)

    def test_soumission_cree_la_version_1(self):
        donnees = self._dossier(self.chef).data
        self.assertEqual([v["numero"] for v in donnees["versions"]], [1])
        self.assertTrue(donnees["peut_decider"])
        self.assertTrue(donnees["peut_mettre_en_attente"])
        self.assertFalse(self._dossier(self.salarie).data["peut_decider"])

    def test_mise_en_attente_puis_reponse_du_demandeur(self):
        r = self.client_de(self.chef).post(f"{self.url}/mettre-en-attente/", {"motif": "Qui vous remplace ?"}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertTrue(r.data["en_attente"])
        self.assertFalse(r.data["peut_mettre_en_attente"])
        # Le dossier reste en validation : rien n'est tranche.
        self.assertEqual(self._dossier(self.salarie).data["document"]["statut"], StatutDocument.EN_VALIDATION)
        self.assertTrue(self._dossier(self.salarie).data["document"]["en_attente"])

        r = self.client_de(self.salarie).post(f"{self.url}/echanger/", {"texte": "Aminata me remplace."}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertFalse(r.data["en_attente"])
        types = [e["type"] for e in r.data["evenements"]]
        self.assertEqual(types, [T.SOUMISSION, T.MISE_EN_ATTENTE, T.MESSAGE, T.REPRISE])

    def test_motif_obligatoire_et_reserve_aux_valideurs(self):
        self.assertEqual(self.client_de(self.chef).post(f"{self.url}/mettre-en-attente/", {"motif": " "}, format="json").status_code, 400)
        self.assertEqual(self.client_de(self.salarie).post(f"{self.url}/mettre-en-attente/", {"motif": "x"}, format="json").status_code, 403)
        self.assertEqual(self.client_de(self.autre).post(f"{self.url}/echanger/", {"texte": "x"}, format="json").status_code, 404)

    def test_modification_cree_une_version_avec_les_changements(self):
        self.client_de(self.chef).post(f"{self.url}/mettre-en-attente/", {"motif": "Precisez le motif"}, format="json")
        r = self.client_de(self.salarie).patch(f"{self.url}/", {"motif": "Mariage de ma soeur"}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        donnees = self._dossier(self.chef).data
        self.assertEqual([v["numero"] for v in donnees["versions"]], [1, 2])
        changements = donnees["versions"][1]["changements"]
        self.assertIn({"libelle": "Motif", "avant": "Repos", "apres": "Mariage de ma soeur"}, changements)
        self.assertFalse(donnees["en_attente"])

    def test_decision_consignee_dans_le_fil(self):
        self.client_de(self.chef).post(f"{self.url}/valider/", {"commentaire": "OK pour moi"}, format="json")
        evenements = self._dossier(self.salarie).data["evenements"]
        self.assertEqual(evenements[-1]["type"], T.APPROBATION)
        self.assertEqual(evenements[-1]["texte"], "OK pour moi")
        self.assertEqual(evenements[-1]["contexte"], "Avis du responsable")


class RelanceTest(DossierEchangesTest):
    """Le demandeur relance les valideurs en attente, une fois par 24 h."""

    def test_detail_indique_qui_est_attendu(self):
        donnees = self._dossier(self.salarie).data
        self.assertTrue(donnees["peut_relancer"])
        self.assertEqual([a["etape"] for a in donnees["attendus"]], ["Avis du responsable", "Controle RH"])

    def test_relance_consignee_puis_bloquee_24h(self):
        r = self.client_de(self.salarie).post(f"{self.url}/relancer/", {"texte": "Mon congé approche."}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data["evenements"][-1]["type"], T.RELANCE)
        self.assertFalse(r.data["peut_relancer"])
        self.assertIsNotNone(r.data["prochaine_relance"])
        self.assertEqual(self.client_de(self.salarie).post(f"{self.url}/relancer/").status_code, 400)

    def test_reservee_au_demandeur(self):
        self.assertEqual(self.client_de(self.chef).post(f"{self.url}/relancer/").status_code, 403)

    def test_impossible_pendant_une_mise_en_attente(self):
        self.client_de(self.chef).post(f"{self.url}/mettre-en-attente/", {"motif": "Pièce manquante"}, format="json")
        self.assertFalse(self._dossier(self.salarie).data["peut_relancer"])
        self.assertEqual(self.client_de(self.salarie).post(f"{self.url}/relancer/").status_code, 400)
