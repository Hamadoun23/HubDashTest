"""Connexion avec l'adresse GDA complète ou le seul nom qui la précède."""
from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from comptes.models import Utilisateur

URL = "/api/identity/auth/connexion"


@override_settings(GDAHUB_DOMAINES_MAIL=["gdamali.net", "decheznousmali.com"])
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

    def test_nom_court_second_domaine(self):
        Utilisateur.objects.create_user(identifiant="sira.diallo@decheznousmali.com", mot_de_passe="secret-5", nom="DIALLO")
        r = self.connexion("sira.diallo", "secret-5")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["utilisateur"]["identifiant"], "sira.diallo@decheznousmali.com")

    def test_meme_nom_sur_deux_domaines_refuse(self):
        Utilisateur.objects.create_user(identifiant="awa@gdamali.net", mot_de_passe="p", nom="A")
        Utilisateur.objects.create_user(identifiant="awa@decheznousmali.com", mot_de_passe="p", nom="B")
        self.assertNotEqual(self.connexion("awa", "p").status_code, 200)

    def test_email_partage_ambigu_refuse(self):
        Utilisateur.objects.create_user(identifiant="1", mot_de_passe="p", nom="A", email="double@gdamali.net")
        Utilisateur.objects.create_user(identifiant="2", mot_de_passe="p", nom="B", email="double@gdamali.net")
        self.assertNotEqual(self.connexion("double", "p").status_code, 200)


class MotDePasseProvisoireTest(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.u = Utilisateur.objects.create_user(identifiant="agent@gdamali.net", mot_de_passe="1234", nom="AGENT")
        self.u.doit_changer_mot_de_passe = True
        self.u.save()

    def test_flag_dans_le_profil_et_leve_au_changement(self):
        r = self.client.post(URL, {"identifiant": "agent", "mot_de_passe": "1234"}, format="json")
        self.assertTrue(r.data["utilisateur"]["doit_changer_mot_de_passe"])
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {r.data['acces']}")
        r = self.client.post("/api/identity/auth/mot-de-passe", {"ancien": "1234", "nouveau": "Kayes-Bamako-2026"}, format="json")
        self.assertEqual(r.status_code, 204, getattr(r, "data", None))
        self.u.refresh_from_db()
        self.assertFalse(self.u.doit_changer_mot_de_passe)

    def test_nouveau_trop_faible_refuse(self):
        r = self.client.post(URL, {"identifiant": "agent", "mot_de_passe": "1234"}, format="json")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {r.data['acces']}")
        for faible in ("1234", "12345678"):
            r = self.client.post("/api/identity/auth/mot-de-passe", {"ancien": "1234", "nouveau": faible}, format="json")
            self.assertEqual(r.status_code, 400)
        self.u.refresh_from_db()
        self.assertTrue(self.u.doit_changer_mot_de_passe)

    def test_commande_de_reinitialisation(self):
        from django.core.management import call_command
        self.u.doit_changer_mot_de_passe = False
        self.u.save()
        call_command("reinitialiser_mots_de_passe", "--mot-de-passe", "1234", stdout=open(__import__("os").devnull, "w"))
        self.u.refresh_from_db()
        self.assertTrue(self.u.doit_changer_mot_de_passe)
        self.assertTrue(self.u.check_password("1234"))


class PhotosDesColleguesTest(TestCase):
    def test_reserve_aux_comptes_connectes(self):
        self.assertEqual(APIClient().get("/api/identity/auth/photos").status_code, 401)

    def test_liste_les_photos(self):
        from django.core.files.base import ContentFile

        from comptes import jetons

        u = Utilisateur.objects.create_user(identifiant="a@gdamali.net", mot_de_passe="x", nom="A", email="a@gdamali.net")
        Utilisateur.objects.create_user(identifiant="b@gdamali.net", mot_de_passe="x", nom="B")
        u.photo.save("a.jpg", ContentFile(b"x"), save=True)
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {jetons.emettre_acces(u)}")
        r = client.get("/api/identity/auth/photos")
        self.assertEqual(r.status_code, 200)
        self.assertEqual([p["email"] for p in r.data], ["a@gdamali.net"])
        u.photo.delete(save=False)
