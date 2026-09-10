"""Tests du module Appro."""
from django.test import TestCase
from datetime import date

from appro.models import ArticleStock, Reception
from appro.forms import ReceptionForm, ArticleStockCreateForm
from recolte.models import Producteur, Cueillette


class ArticleStockModelTest(TestCase):
    """Tests du modèle ArticleStock."""

    def test_str(self):
        """__str__ affiche type et quantité."""
        art, _ = ArticleStock.objects.get_or_create(
            type_art='orange_dispo',
            defaults={'qte_art': 500, 'seuil_alerte': 100}
        )
        art.qte_art = 500
        art.save()
        self.assertIn('Orange disponible', str(art))
        self.assertIn('500', str(art))


class ReceptionModelTest(TestCase):
    """Tests du modèle Reception."""

    def setUp(self):
        self.producteur = Producteur.objects.create(
            nom_complet="Test Producteur",
            zone="Dakar",
            contact="771234567"
        )
        self.cueillette = Cueillette.objects.create(
            producteur=self.producteur,
            date_cueil=date.today(),
            qte_total=200,
            qte_bon=180
        )

    def test_taux_qualite(self):
        """taux_qualite = (qte_bon / qte_recue) * 100."""
        rec = Reception.objects.create(
            cueillette=self.cueillette,
            date_recp=date.today(),
            qte_recue=100,
            qte_bon=85,
            lieu_depot="Entrepôt A"
        )
        self.assertEqual(rec.taux_qualite, 85.0)

    def test_etat_qualite_excellent(self):
        """taux >= 80 → EXCELLENT."""
        rec = Reception.objects.create(
            cueillette=self.cueillette,
            date_recp=date.today(),
            qte_recue=100,
            qte_bon=85,
            lieu_depot="Entrepôt A"
        )
        self.assertEqual(rec.etat_qualite, 'EXCELLENT')

    def test_etat_qualite_bon(self):
        """50 <= taux < 80 → BON."""
        rec = Reception.objects.create(
            cueillette=self.cueillette,
            date_recp=date.today(),
            qte_recue=100,
            qte_bon=60,
            lieu_depot="Entrepôt A"
        )
        self.assertEqual(rec.etat_qualite, 'BON')

    def test_etat_qualite_mauvais(self):
        """taux < 50 → MAUVAIS."""
        rec = Reception.objects.create(
            cueillette=self.cueillette,
            date_recp=date.today(),
            qte_recue=100,
            qte_bon=40,
            lieu_depot="Entrepôt A"
        )
        self.assertEqual(rec.etat_qualite, 'MAUVAIS')

    def test_qte_mauvais_calculee(self):
        """qte_mauvais = qte_recue - qte_bon."""
        rec = Reception.objects.create(
            cueillette=self.cueillette,
            date_recp=date.today(),
            qte_recue=100,
            qte_bon=90,
            lieu_depot="Entrepôt A"
        )
        rec.refresh_from_db()
        self.assertEqual(rec.qte_mauvais, 10)

    def test_num_recp_genere(self):
        """num_recp est généré automatiquement."""
        rec = Reception.objects.create(
            cueillette=self.cueillette,
            date_recp=date.today(),
            qte_recue=50,
            qte_bon=50,
            lieu_depot="Entrepôt A"
        )
        self.assertTrue(rec.num_recp.startswith('N'))
        self.assertIn(date.today().strftime('%d%m%Y'), rec.num_recp)


class ReceptionFormTest(TestCase):
    """Tests du formulaire ReceptionForm."""

    def setUp(self):
        self.producteur = Producteur.objects.create(
            nom_complet="Test Producteur",
            zone="Dakar",
            contact="771234567"
        )
        self.cueillette = Cueillette.objects.create(
            producteur=self.producteur,
            date_cueil=date.today(),
            qte_total=200,
            qte_bon=180
        )

    def test_qte_bon_superieure_qte_recue_invalide(self):
        """qte_bon > qte_recue → invalide."""
        form = ReceptionForm(data={
            'cueillette': self.cueillette.pk,
            'date_recp': date.today(),
            'qte_recue': 100,
            'qte_bon': 150,
            'lieu_depot': 'Entrepôt A',
            'cause_perte': ''
        })
        self.assertFalse(form.is_valid())
        self.assertIn('__all__', form.errors)

    def test_qte_recue_depasse_restant_invalide(self):
        """qte_recue > restant cueillette → invalide."""
        form = ReceptionForm(data={
            'cueillette': self.cueillette.pk,
            'date_recp': date.today(),
            'qte_recue': 250,
            'qte_bon': 180,
            'lieu_depot': 'Entrepôt A',
            'cause_perte': ''
        })
        self.assertFalse(form.is_valid())

    def test_valide(self):
        """Données valides → valide."""
        form = ReceptionForm(data={
            'cueillette': self.cueillette.pk,
            'date_recp': date.today(),
            'qte_recue': 100,
            'qte_bon': 95,
            'lieu_depot': 'Entrepôt A',
            'cause_perte': ''
        })
        self.assertTrue(form.is_valid())
