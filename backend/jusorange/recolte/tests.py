"""Tests du module Récolte."""
from django.test import TestCase
from datetime import date

from recolte.models import Producteur, Cueillette


class ProducteurModelTest(TestCase):
    """Tests du modèle Producteur."""

    def test_str(self):
        """__str__ retourne le nom complet."""
        p = Producteur.objects.create(
            nom_complet="Moussa Diallo",
            zone="Dakar",
            contact="771234567"
        )
        self.assertEqual(str(p), "Moussa Diallo")

    def test_actif_par_defaut(self):
        """Un nouveau producteur est actif par défaut."""
        p = Producteur.objects.create(
            nom_complet="Test",
            zone="Zone",
            contact="123"
        )
        self.assertTrue(p.actif)

    def test_ordering(self):
        """Les producteurs sont triés par nom_complet."""
        Producteur.objects.create(nom_complet="Zebra", zone="Z", contact="1")
        Producteur.objects.create(nom_complet="Alpha", zone="A", contact="2")
        noms = [p.nom_complet for p in Producteur.objects.all()]
        self.assertEqual(noms, ["Alpha", "Zebra"])


class CueilletteModelTest(TestCase):
    """Tests du modèle Cueillette."""

    def setUp(self):
        self.producteur = Producteur.objects.create(
            nom_complet="Fatou Fall",
            zone="Thiès",
            contact="761234567"
        )

    def test_taux_qualite(self):
        """taux_qualite = (qte_bon / qte_total) * 100."""
        c = Cueillette.objects.create(
            producteur=self.producteur,
            date_cueil=date.today(),
            qte_total=100,
            qte_bon=85
        )
        self.assertEqual(c.taux_qualite, 85.0)

    def test_taux_qualite_zero_total(self):
        """taux_qualite retourne 0 si qte_total = 0."""
        c = Cueillette(qte_total=0, qte_bon=0)
        self.assertEqual(c.taux_qualite, 0)

    def test_qte_mauvais_calculee(self):
        """qte_mauvais est calculé automatiquement à la sauvegarde."""
        c = Cueillette.objects.create(
            producteur=self.producteur,
            date_cueil=date.today(),
            qte_total=100,
            qte_bon=90
        )
        c.refresh_from_db()
        self.assertEqual(c.qte_mauvais, 10)

    def test_get_producteur_display_avec_producteur(self):
        """get_producteur_display retourne le nom du producteur."""
        c = Cueillette.objects.create(
            producteur=self.producteur,
            date_cueil=date.today(),
            qte_total=50,
            qte_bon=50
        )
        self.assertEqual(c.get_producteur_display(), "Fatou Fall")

    def test_get_producteur_display_supprime(self):
        """get_producteur_display affiche (supprimé) si producteur supprimé."""
        c = Cueillette.objects.create(
            producteur=self.producteur,
            producteur_nom_archive="Fatou Fall",
            date_cueil=date.today(),
            qte_total=50,
            qte_bon=50
        )
        self.producteur.delete()
        c.refresh_from_db()
        self.assertIn("(supprimé)", c.get_producteur_display())

    def test_str(self):
        """__str__ affiche producteur, date et quantité."""
        c = Cueillette.objects.create(
            producteur=self.producteur,
            date_cueil=date(2026, 2, 10),
            qte_total=100,
            qte_bon=95
        )
        self.assertIn("Fatou Fall", str(c))
        self.assertIn("100", str(c))
