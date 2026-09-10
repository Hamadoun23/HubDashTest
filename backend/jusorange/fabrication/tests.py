"""Tests du module Fabrication."""
from django.test import TestCase
from datetime import date

from fabrication.models import Production
from fabrication.forms import ProductionCreateForm, ProductionCompleteForm


class ProductionModelTest(TestCase):
    """Tests du modèle Production."""

    def test_str(self):
        """__str__ affiche numero_of et date."""
        prod = Production.objects.create(
            date_of=date(2026, 2, 10),
            recette='R80_20',
            statut_production='EN_COURS'
        )
        self.assertIn('OF', str(prod))
        self.assertIn('2026', str(prod))

    def test_numero_of_genere(self):
        """numero_of est généré automatiquement."""
        prod = Production.objects.create(
            date_of=date(2026, 2, 10),
            recette='R80_20',
            statut_production='EN_COURS'
        )
        self.assertTrue(prod.numero_of.startswith('OF'))
        self.assertIn('10022026', prod.numero_of)

    def test_statut_par_defaut(self):
        """Statut par défaut = EN_COURS."""
        prod = Production.objects.create(
            date_of=date.today(),
            recette='R80_20'
        )
        self.assertEqual(prod.statut_production, 'EN_COURS')


class ProductionCreateFormTest(TestCase):
    """Tests du formulaire ProductionCreateForm."""

    def test_valide(self):
        """Formulaire valide avec date et recette."""
        form = ProductionCreateForm(data={
            'date_of': date.today(),
            'recette': 'R80_20'
        })
        self.assertTrue(form.is_valid())

    def test_invalide_sans_recette(self):
        """Sans recette → invalide."""
        form = ProductionCreateForm(data={
            'date_of': date.today(),
            'recette': ''
        })
        self.assertFalse(form.is_valid())


class ProductionCompleteFormTest(TestCase):
    """Tests du formulaire ProductionCompleteForm."""

    def setUp(self):
        self.production = Production.objects.create(
            date_of=date.today(),
            recette='R80_20',
            statut_production='EN_COURS'
        )

    def test_ph_hors_limites_invalide(self):
        """pH < 0 ou > 10 → invalide."""
        form = ProductionCompleteForm(
            data={
                'lavage_effectue': 'True',
                'filtration_effectuee': 'True',
                'pasteurisation_80c': 'True',
                'eau_ajoutee_l': 500,
                'sucre_ajoute_kg': 50,
                'sorbate_ajoute_g': 100,
                'ph': 15,
                'refractometre': 10,
                'volume_final_l': 1000,
            },
            instance=self.production
        )
        self.assertFalse(form.is_valid())
        self.assertIn('ph', form.errors)

    def test_refractometre_hors_limites_invalide(self):
        """Réfractomètre < 0 ou > 20 → invalide."""
        form = ProductionCompleteForm(
            data={
                'lavage_effectue': 'True',
                'filtration_effectuee': 'True',
                'pasteurisation_80c': 'True',
                'eau_ajoutee_l': 500,
                'sucre_ajoute_kg': 50,
                'sorbate_ajoute_g': 100,
                'ph': 5,
                'refractometre': 25,
                'volume_final_l': 1000,
            },
            instance=self.production
        )
        self.assertFalse(form.is_valid())
        self.assertIn('refractometre', form.errors)
