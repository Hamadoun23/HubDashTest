"""Tests du module Reporting (calcul des périodes d'analyse).

Les tests des pages d'accueil HTML ont été retirés avec ces pages : l'interface
est désormais servie par le frontend React, et les rapports sont couverts par
les endpoints /api/reporting/<module>/.
"""
from django.test import TestCase, RequestFactory
from datetime import date, timedelta
from reporting.services.base import (
    get_period_semaine,
    get_period_mois,
    get_period_trimestre,
    get_period_default,
    get_period_from_request,
)


class GetPeriodSemaineTest(TestCase):
    """Tests de get_period_semaine."""

    def test_duree_7_jours(self):
        """La période couvre 7 jours (debut à fin inclus)."""
        debut, fin = get_period_semaine()
        self.assertEqual((fin - debut).days, 6)

    def test_fin_est_aujourdhui(self):
        """La fin de période est aujourd'hui."""
        debut, fin = get_period_semaine()
        self.assertEqual(fin, date.today())


class GetPeriodMoisTest(TestCase):
    """Tests de get_period_mois."""

    def test_debut_est_premier_du_mois(self):
        """Le début est le 1er du mois en cours."""
        debut, fin = get_period_mois()
        self.assertEqual(debut.day, 1)

    def test_fin_est_aujourdhui(self):
        """La fin est aujourd'hui."""
        debut, fin = get_period_mois()
        self.assertEqual(fin, date.today())


class GetPeriodTrimestreTest(TestCase):
    """Tests de get_period_trimestre."""

    def test_debut_est_premier_du_mois(self):
        """Le début est un 1er du mois."""
        debut, fin = get_period_trimestre()
        self.assertEqual(debut.day, 1)

    def test_fin_est_aujourdhui(self):
        """La fin est aujourd'hui."""
        debut, fin = get_period_trimestre()
        self.assertEqual(fin, date.today())


class GetPeriodDefaultTest(TestCase):
    """Tests de get_period_default."""

    def test_debut_est_premier_du_mois(self):
        """Le début est le 1er du mois en cours."""
        debut, fin = get_period_default()
        self.assertEqual(debut.day, 1)

    def test_fin_est_aujourdhui(self):
        """La fin est aujourd'hui."""
        debut, fin = get_period_default()
        self.assertEqual(fin, date.today())


class GetPeriodFromRequestTest(TestCase):
    """Tests de get_period_from_request."""

    def setUp(self):
        self.factory = RequestFactory()

    def test_periode_semaine(self):
        """periode=semaine retourne la période semaine."""
        request = self.factory.get('/', {'periode': 'semaine'})
        debut, fin = get_period_from_request(request)
        self.assertEqual((fin - debut).days, 6)

    def test_periode_mois(self):
        """periode=mois retourne le mois en cours."""
        request = self.factory.get('/', {'periode': 'mois'})
        debut, fin = get_period_from_request(request)
        self.assertEqual(debut.day, 1)
        self.assertEqual(fin, date.today())

    def test_periode_trimestre(self):
        """periode=trimestre retourne le trimestre."""
        request = self.factory.get('/', {'periode': 'trimestre'})
        debut, fin = get_period_from_request(request)
        self.assertEqual(debut.day, 1)

    def test_date_debut_fin_custom(self):
        """date_debut et date_fin personnalisées."""
        request = self.factory.get('/', {
            'date_debut': '2026-01-15',
            'date_fin': '2026-01-20'
        })
        debut, fin = get_period_from_request(request)
        self.assertEqual(debut, date(2026, 1, 15))
        self.assertEqual(fin, date(2026, 1, 20))

    def test_dates_invalides_retourne_default(self):
        """Dates invalides → période par défaut."""
        request = self.factory.get('/', {
            'date_debut': 'invalid',
            'date_fin': '2026-01-20'
        })
        debut, fin = get_period_from_request(request)
        self.assertEqual(debut.day, 1)
        self.assertEqual(fin, date.today())

    def test_sans_param_retourne_default(self):
        """Sans paramètre GET → période par défaut."""
        request = self.factory.get('/')
        debut, fin = get_period_from_request(request)
        self.assertEqual(debut.day, 1)
        self.assertEqual(fin, date.today())
