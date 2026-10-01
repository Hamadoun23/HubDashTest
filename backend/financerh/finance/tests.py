"""Lignes de requisition et frais de mission : qui les voit, qui les corrige."""
from datetime import date
from decimal import Decimal

from core.tests import BaseAPITestCase
from finance.models import LigneFraisMission, LigneRequisition, Mission, Requisition


class LignesRequisitionTest(BaseAPITestCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        for demandeur in (cls.salarie, cls.autre):
            requisition = Requisition.objects.create(demandeur=demandeur, objet="Besoin", montant=Decimal("1000"))
            LigneRequisition.objects.create(requisition=requisition, designation="Papier", quantite=1, prix_unitaire=1000)

    def _visibles(self, agent):
        reponse = self.client_de(agent).get("/api/finance/lignes-requisition/")
        self.assertEqual(reponse.status_code, 200)
        return reponse.data["count"] if isinstance(reponse.data, dict) else len(reponse.data)

    def test_salarie_ne_voit_que_ses_lignes(self):
        self.assertEqual(self._visibles(self.salarie), 1)
        self.assertEqual(self._visibles(self.autre), 1)

    def test_encadrant_voit_son_equipe(self):
        self.assertEqual(self._visibles(self.chef), 1)

    def test_finance_voit_tout(self):
        self.assertEqual(self._visibles(self.finance), 2)

    def test_ligne_d_un_autre_introuvable(self):
        ligne = LigneRequisition.objects.get(requisition__demandeur=self.autre)
        self.assertEqual(self.client_de(self.salarie).get(f"/api/finance/lignes-requisition/{ligne.pk}/").status_code, 404)


class FraisMissionTest(BaseAPITestCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.mission = Mission.objects.create(
            demandeur=cls.salarie, objet="Visite", destination="Kayes", zone="NATIONALE",
            date_depart=date(2026, 9, 1), date_retour=date(2026, 9, 3), montant=Decimal("0"),
        )

    def setUp(self):
        self.ligne = LigneFraisMission.objects.create(
            mission=self.mission, libelle="Taxi", montant=Decimal("5000"), date_depense=date(2026, 9, 1)
        )

    def _url(self):
        return f"/api/finance/frais-mission/{self.ligne.pk}/"

    def test_l_agent_corrige_ses_frais(self):
        r = self.client_de(self.salarie).patch(self._url(), {"montant": "6000"}, format="json")
        self.assertEqual(r.status_code, 200, r.data)

    def test_le_manager_voit_mais_ne_corrige_pas(self):
        client = self.client_de(self.chef)
        self.assertEqual(client.get(self._url()).status_code, 200)
        self.assertEqual(client.patch(self._url(), {"montant": "1"}, format="json").status_code, 403)
        self.assertEqual(client.delete(self._url()).status_code, 403)
        self.assertTrue(LigneFraisMission.objects.filter(pk=self.ligne.pk, montant=Decimal("5000")).exists())

    def test_ligne_validee_figee(self):
        self.ligne.valide = True
        self.ligne.save()
        client = self.client_de(self.salarie)
        self.assertEqual(client.patch(self._url(), {"montant": "1"}, format="json").status_code, 400)
        self.assertEqual(client.delete(self._url()).status_code, 400)

    def test_un_autre_agent_ne_voit_rien(self):
        self.assertEqual(self.client_de(self.autre).get(self._url()).status_code, 404)
