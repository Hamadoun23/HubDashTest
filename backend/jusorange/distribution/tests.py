"""Tests du module Distribution."""
from django.test import TestCase
from datetime import date

from distribution.models import Client, Vente, Facture, Paiement, ReceptionPaiement
from distribution.forms import ClientForm, CommandeForm, CompleterCommandeForm, PaiementFactureForm


class ClientModelTest(TestCase):
    """Tests du modèle Client."""

    def test_str(self):
        """__str__ retourne le nom complet."""
        c = Client.objects.create(nom_complet="Boutique Chez Fatou", tel_client="771234567")
        self.assertEqual(str(c), "Boutique Chez Fatou")


class ClientFormTest(TestCase):
    """Tests du formulaire ClientForm."""

    def test_valide_avec_tel(self):
        """Formulaire valide avec téléphone uniquement."""
        form = ClientForm(data={
            'nom_complet': 'Boutique Test',
            'tel_client': '771234567',
            'email': '',
            'adresse': ''
        })
        self.assertTrue(form.is_valid())

    def test_valide_avec_email(self):
        """Formulaire valide avec email uniquement."""
        form = ClientForm(data={
            'nom_complet': 'Boutique Test',
            'tel_client': '',
            'email': 'test@example.com',
            'adresse': ''
        })
        self.assertTrue(form.is_valid())

    def test_invalide_sans_tel_ni_email(self):
        """Formulaire invalide sans téléphone ni email."""
        form = ClientForm(data={
            'nom_complet': 'Boutique Test',
            'tel_client': '',
            'email': '',
            'adresse': ''
        })
        self.assertFalse(form.is_valid())
        self.assertIn('__all__', form.errors)


class CommandeFormTest(TestCase):
    """Tests du formulaire CommandeForm."""

    def setUp(self):
        self.client_obj = Client.objects.create(
            nom_complet="Super Marché Dia",
            tel_client="761234567"
        )

    def test_invalide_quantites_zero(self):
        """Formulaire invalide si les deux quantités sont à 0."""
        form = CommandeForm(data={
            'client': self.client_obj.pk,
            'date_cmd': date.today(),
            'quantite_33cl': 0,
            'quantite_1l': 0
        })
        self.assertFalse(form.is_valid())
        self.assertIn('__all__', form.errors)

    def test_valide_avec_33cl(self):
        """Formulaire valide avec quantité 33cl > 0."""
        form = CommandeForm(data={
            'client': self.client_obj.pk,
            'date_cmd': date.today(),
            'quantite_33cl': 10,
            'quantite_1l': 0
        })
        self.assertTrue(form.is_valid())

    def test_valide_avec_1l(self):
        """Formulaire valide avec quantité 1L > 0."""
        form = CommandeForm(data={
            'client': self.client_obj.pk,
            'date_cmd': date.today(),
            'quantite_33cl': 0,
            'quantite_1l': 5
        })
        self.assertTrue(form.is_valid())


class CompleterCommandeFormTest(TestCase):
    """Tests du formulaire CompleterCommandeForm."""

    def test_partielle_sans_montant_invalide(self):
        """Statut Partielle sans montant payé → invalide."""
        form = CompleterCommandeForm(
            data={'statut_paiement': 'PARTIELLE', 'montant_paye': ''},
            montant_total=10000
        )
        self.assertFalse(form.is_valid())

    def test_partielle_montant_egal_total_invalide(self):
        """Statut Partielle avec montant >= total → invalide."""
        form = CompleterCommandeForm(
            data={'statut_paiement': 'PARTIELLE', 'montant_paye': 10000},
            montant_total=10000
        )
        self.assertFalse(form.is_valid())

    def test_partielle_montant_ok_valide(self):
        """Statut Partielle avec montant < total → valide."""
        form = CompleterCommandeForm(
            data={'statut_paiement': 'PARTIELLE', 'montant_paye': 5000},
            montant_total=10000
        )
        self.assertTrue(form.is_valid())

    def test_achat_vente_sans_montant_valide(self):
        """Statut Achat-vente sans montant → valide."""
        form = CompleterCommandeForm(
            data={'statut_paiement': 'ACHAT_VENTE', 'montant_paye': ''},
            montant_total=10000
        )
        self.assertTrue(form.is_valid())


class PaiementFactureFormTest(TestCase):
    """Tests du formulaire PaiementFactureForm."""

    def test_montant_zero_invalide(self):
        """Montant 0 ou négatif → invalide."""
        form = PaiementFactureForm(
            data={'date_paie': date.today(), 'montant': 0, 'mode_paie': 'ESPECE'},
            facture=None,
            reste_a_payer=5000
        )
        self.assertFalse(form.is_valid())

    def test_montant_depasse_reste_invalide(self):
        """Montant > reste à payer → invalide."""
        form = PaiementFactureForm(
            data={'date_paie': date.today(), 'montant': 6000, 'mode_paie': 'ESPECE'},
            facture=None,
            reste_a_payer=5000
        )
        self.assertFalse(form.is_valid())

    def test_montant_egal_reste_valide(self):
        """Montant = reste à payer → valide."""
        form = PaiementFactureForm(
            data={'date_paie': date.today(), 'montant': 5000, 'mode_paie': 'ESPECE'},
            facture=None,
            reste_a_payer=5000
        )
        self.assertTrue(form.is_valid())


class ReceptionPaiementModelTest(TestCase):
    """Tests du modèle ReceptionPaiement."""

    def setUp(self):
        self.client_obj = Client.objects.create(
            nom_complet="Test Client",
            tel_client="771234567"
        )
        self.vente = Vente.objects.create(
            client=self.client_obj,
            date_vente=date.today(),
            montant_total=62500,
            statut_paiement='ACHAT_VENTE'
        )
        self.facture = Facture.objects.create(
            vente=self.vente,
            date_fact=date.today(),
            montant=62500,
            statut='ACHAT_VENTE',
            date_echeance=date.today()
        )
        self.paiement = Paiement.objects.create(
            facture=self.facture,
            date_paie=date.today(),
            montant=62500,
            mode_paie='ESPECE'
        )

    def test_ecart_conforme(self):
        """Écart = 0 → statut CONFORME."""
        rec = ReceptionPaiement.objects.create(
            paiement=self.paiement,
            montant_recu=62500,
            date_reception=date.today()
        )
        self.assertEqual(rec.ecart, 0)
        self.assertEqual(rec.statut_reception, 'CONFORME')

    def test_ecart_positif(self):
        """Montant reçu > déclaré → ECART_POSITIF."""
        rec = ReceptionPaiement.objects.create(
            paiement=self.paiement,
            montant_recu=63000,
            date_reception=date.today()
        )
        self.assertEqual(rec.ecart, 500)
        self.assertEqual(rec.statut_reception, 'ECART_POSITIF')

    def test_ecart_negatif(self):
        """Montant reçu < déclaré → ECART_NEGATIF."""
        rec = ReceptionPaiement.objects.create(
            paiement=self.paiement,
            montant_recu=60000,
            date_reception=date.today()
        )
        self.assertEqual(rec.ecart, -2500)
        self.assertEqual(rec.statut_reception, 'ECART_NEGATIF')
