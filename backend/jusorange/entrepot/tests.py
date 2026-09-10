"""Tests du module Entrepôt."""
from django.test import TestCase
from datetime import date
from django.contrib.auth.models import User

from entrepot.models import Inventaire
from entrepot.forms import InventaireForm, InventaireObservationForm
from appro.models import ArticleStock


class InventaireModelTest(TestCase):
    """Tests du modèle Inventaire."""

    def setUp(self):
        self.article, _ = ArticleStock.objects.get_or_create(
            type_art='orange_dispo',
            defaults={'qte_art': 500, 'seuil_alerte': 100}
        )
        self.article.qte_art = 500
        self.article.save()

    def test_ecart_calcule(self):
        """ecart = qte_depot - qte_systeme."""
        inv = Inventaire.objects.create(
            date_inv=date.today(),
            article=self.article,
            qte_systeme=500,
            qte_depot=480,
            statut='EN_COURS'
        )
        inv.refresh_from_db()
        self.assertEqual(inv.ecart, -20)

    def test_qualite_bon_ecart_faible(self):
        """Écart <= 5% → qualite BON."""
        inv = Inventaire.objects.create(
            date_inv=date.today(),
            article=self.article,
            qte_systeme=100,
            qte_depot=97,
            statut='EN_COURS'
        )
        inv.refresh_from_db()
        self.assertEqual(inv.qualite, 'BON')

    def test_qualite_moyen_ecart_modere(self):
        """5% < écart <= 15% → qualite MOYEN."""
        inv = Inventaire.objects.create(
            date_inv=date.today(),
            article=self.article,
            qte_systeme=100,
            qte_depot=88,
            statut='EN_COURS'
        )
        inv.refresh_from_db()
        self.assertEqual(inv.qualite, 'MOYEN')

    def test_qualite_mauvais_ecart_eleve(self):
        """Écart > 15% → qualite MAUVAIS."""
        inv = Inventaire.objects.create(
            date_inv=date.today(),
            article=self.article,
            qte_systeme=100,
            qte_depot=80,
            statut='EN_COURS'
        )
        inv.refresh_from_db()
        self.assertEqual(inv.qualite, 'MAUVAIS')

    def test_str(self):
        """__str__ affiche article et date."""
        inv = Inventaire.objects.create(
            date_inv=date.today(),
            article=self.article,
            qte_systeme=500,
            qte_depot=500,
            statut='TERMINE'
        )
        self.assertIn('Orange disponible', str(inv))
        self.assertIn(str(date.today().year), str(inv))


class InventaireFormTest(TestCase):
    """Tests du formulaire InventaireForm."""

    def setUp(self):
        self.article, _ = ArticleStock.objects.get_or_create(
            type_art='orange_dispo',
            defaults={'qte_art': 500, 'seuil_alerte': 100}
        )

    def test_termine_sans_observation_invalide(self):
        """Statut TERMINE sans observation → invalide."""
        form = InventaireForm(data={
            'date_inv': date.today(),
            'article': self.article.pk,
            'qte_depot': 500,
            'statut': 'TERMINE',
            'observation': ''
        })
        self.assertFalse(form.is_valid())
        self.assertIn('observation', form.errors)

    def test_termine_avec_observation_valide(self):
        """Statut TERMINE avec observation → valide."""
        form = InventaireForm(data={
            'date_inv': date.today(),
            'article': self.article.pk,
            'qte_depot': 500,
            'statut': 'TERMINE',
            'observation': 'Inventaire conforme'
        })
        self.assertTrue(form.is_valid())

    def test_en_cours_sans_observation_valide(self):
        """Statut EN_COURS sans observation → valide."""
        form = InventaireForm(data={
            'date_inv': date.today(),
            'article': self.article.pk,
            'qte_depot': 500,
            'statut': 'EN_COURS',
            'observation': ''
        })
        self.assertTrue(form.is_valid())


class InventaireObservationFormTest(TestCase):
    """Tests du formulaire InventaireObservationForm."""

    def setUp(self):
        self.article, _ = ArticleStock.objects.get_or_create(
            type_art='orange_dispo',
            defaults={'qte_art': 500, 'seuil_alerte': 100}
        )
        self.inventaire = Inventaire.objects.create(
            date_inv=date.today(),
            article=self.article,
            qte_systeme=500,
            qte_depot=500,
            statut='TERMINE'
        )

    def test_valide(self):
        """Formulaire observation valide."""
        form = InventaireObservationForm(
            data={'observation': 'Tout est conforme'},
            instance=self.inventaire
        )
        self.assertTrue(form.is_valid())
