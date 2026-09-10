"""Tests du module Emballage."""
from django.test import TestCase
from datetime import date
from django.contrib.auth.models import User

from emballage.forms import add_months
from emballage.models import Conditionnement, Bouteille
from appro.models import ArticleStock
from fabrication.models import Production


class AddMonthsTest(TestCase):
    """Tests de la fonction add_months."""

    def test_add_1_mois(self):
        """Ajouter 1 mois à une date."""
        d = date(2026, 1, 15)
        result = add_months(d, 1)
        self.assertEqual(result, date(2026, 2, 15))

    def test_add_12_mois(self):
        """Ajouter 12 mois = année suivante."""
        d = date(2026, 2, 10)
        result = add_months(d, 12)
        self.assertEqual(result, date(2027, 2, 10))

    def test_add_3_mois_changement_annee(self):
        """Ajouter des mois avec changement d'année."""
        d = date(2026, 11, 20)
        result = add_months(d, 3)
        self.assertEqual(result, date(2027, 2, 20))


class ConditionnementModelTest(TestCase):
    """Tests du modèle Conditionnement."""

    def setUp(self):
        self.user = User.objects.create_user('testuser', 'test@test.com', 'pass')
        self.production = Production.objects.create(
            date_of=date.today(),
            recette='R80_20',
            statut_production='TERMINEE'
        )

    def test_numero_cond_genere(self):
        """numero_cond est généré à la création."""
        cond = Conditionnement.objects.create(
            date_cond=date.today(),
            production=self.production,
            qte_33cl=100,
            qte_1l=0,
            volume_utilisee=500,
            dlc=date.today()
        )
        self.assertTrue(cond.numero_cond.startswith('COND'))
        self.assertIn(date.today().strftime('%d%m%Y'), cond.numero_cond)

    def test_str(self):
        """__str__ affiche numero_cond et date."""
        cond = Conditionnement.objects.create(
            date_cond=date.today(),
            production=self.production,
            qte_33cl=50,
            qte_1l=20,
            volume_utilisee=300,
            dlc=date.today()
        )
        self.assertIn('COND', str(cond))


class BouteilleModelTest(TestCase):
    """Tests du modèle Bouteille."""

    def setUp(self):
        self.article, _ = ArticleStock.objects.get_or_create(
            type_art='jus_33cl',
            defaults={'qte_art': 0, 'seuil_alerte': 10}
        )
        self.production = Production.objects.create(
            date_of=date.today(),
            recette='R80_20',
            statut_production='TERMINEE'
        )
        self.conditionnement = Conditionnement.objects.create(
            date_cond=date.today(),
            production=self.production,
            qte_33cl=10,
            qte_1l=0,
            volume_utilisee=100,
            dlc=date.today()
        )

    def test_get_format_display_33cl(self):
        """format_33cl=1 → '33 cl'."""
        b = Bouteille.objects.create(
            format_33cl=1,
            format_1l=0,
            dlc=date.today(),
            conditionnement=self.conditionnement,
            article_stock=self.article
        )
        self.assertEqual(b.get_format_display(), '33 cl')

    def test_get_format_display_1l(self):
        """format_1l=1 → '1 L'."""
        b = Bouteille.objects.create(
            format_33cl=0,
            format_1l=1,
            dlc=date.today(),
            conditionnement=self.conditionnement,
            article_stock=self.article
        )
        self.assertEqual(b.get_format_display(), '1 L')

    def test_statut_par_defaut(self):
        """Statut par défaut = DISPO."""
        b = Bouteille.objects.create(
            format_33cl=1,
            format_1l=0,
            dlc=date.today(),
            conditionnement=self.conditionnement,
            article_stock=self.article
        )
        self.assertEqual(b.statut_stock, 'DISPO')


class ConditionnementFormTest(TestCase):
    """Tests du formulaire ConditionnementForm."""

    def setUp(self):
        self.user = User.objects.create_user('testuser', 'test@test.com', 'pass')
        self.production = Production.objects.create(
            date_of=date.today(),
            recette='R80_20',
            statut_production='TERMINEE'
        )

    def test_quantites_zero_invalide(self):
        """qte_33cl et qte_1l à 0 → invalide."""
        from emballage.forms import ConditionnementForm
        form = ConditionnementForm(data={
            'date_cond': date.today(),
            'production': self.production.pk,
            'qte_33cl': 0,
            'qte_1l': 0,
            'volume_utilisee': 100,
            'observation': 'Test',
            'nb_jours': '',
            'nb_mois': ''
        })
        self.assertFalse(form.is_valid())
        self.assertIn('qte_33cl', form.errors)
