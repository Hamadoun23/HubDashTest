"""Connexion avec l'adresse GDA complète ou le seul nom qui la précède."""
from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from comptes.models import Utilisateur

URL = "/api/identity/auth/connexion"


@override_settings(GDAHUB_DOMAINE_MAIL="gdamali.net")
class ConnexionNomCourtTest(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        Utilisateur.objects.create_user(identifiant="hcisse@gdamali.net", mot_de_passe="secret-1", nom="CISSE")
        # Identifiant historique (téléphone), adresse GDA en e-mail.
        Utilisateur.objects.create_user(
            identifiant="70000000", mot_de_passe="secret-2", nom="KONE", email="Modi.Kone@gdamali.net"
        )
        # Un compte dont l'identifiant est déjà un nom court : il reste prioritaire.
        Utilisateur.objects.create_user(identifiant="cisse", mot_de_passe="secret-3", nom="AUTRE")

    def connexion(self, identifiant, mot_de_passe):
        return self.client.post(URL, {"identifiant": identifiant, "mot_de_passe": mot_de_passe}, format="json")

    def test_adresse_complete(self):
        r = self.connexion("hcisse@gdamali.net", "secret-1")
        self.assertEqual(r.status_code, 200, r.content)

    def test_nom_court_identifiant(self):
        r = self.connexion("HCisse ", "secret-1")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["utilisateur"]["identifiant"], "hcisse@gdamali.net")

    def test_nom_court_email(self):
        r = self.connexion("modi.kone", "secret-2")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["utilisateur"]["identifiant"], "70000000")

    def test_identifiant_exact_prioritaire(self):
        self.assertEqual(self.connexion("cisse", "secret-3").status_code, 200)
        self.assertNotEqual(self.connexion("cisse", "secret-1").status_code, 200)

    def test_mauvais_mot_de_passe(self):
        self.assertNotEqual(self.connexion("hcisse", "faux").status_code, 200)

    def test_autre_domaine_non_complete(self):
        Utilisateur.objects.create_user(identifiant="x@autre.com", mot_de_passe="secret-4", nom="X")
        self.assertNotEqual(self.connexion("x", "secret-4").status_code, 200)

    def test_email_partage_ambigu_refuse(self):
        Utilisateur.objects.create_user(identifiant="1", mot_de_passe="p", nom="A", email="double@gdamali.net")
        Utilisateur.objects.create_user(identifiant="2", mot_de_passe="p", nom="B", email="double@gdamali.net")
        self.assertNotEqual(self.connexion("double", "p").status_code, 200)
