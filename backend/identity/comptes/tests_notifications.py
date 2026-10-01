"""Contrôle d'accès aux fichiers et notifications du hub."""
from unittest import mock

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from comptes import jetons
from comptes.models import AbonnementPush, Application, Habilitation, Notification, Utilisateur


class _Base(TestCase):
    def setUp(self):
        self.agent = Utilisateur.objects.create_user(identifiant="agent@test.local", password="x", nom="AGENT")
        self.autre = Utilisateur.objects.create_user(identifiant="autre@test.local", password="x", nom="AUTRE")
        self.daily = Application.objects.create(code="daily", nom="Chantiers", chemin="/chantiers")
        Habilitation.objects.create(utilisateur=self.agent, application=self.daily, roles=["admin"])
        self.client = APIClient()

    def jeton(self, utilisateur):
        return jetons.emettre_acces(utilisateur)


class VerifierFichierTest(_Base):
    URL = "/api/identity/auth/verifier-fichier"

    def test_sans_jeton_refuse(self):
        self.assertEqual(self.client.get(self.URL).status_code, 401)

    def test_jeton_bidon_refuse(self):
        r = self.client.get(self.URL, HTTP_AUTHORIZATION="Bearer faux.jeton.x")
        self.assertEqual(r.status_code, 401)

    def test_habilite_au_dossier(self):
        r = self.client.get(self.URL, HTTP_AUTHORIZATION=f"Bearer {self.jeton(self.agent)}", HTTP_X_APPLICATIONS="daily")
        self.assertEqual(r.status_code, 204)

    def test_non_habilite_au_dossier(self):
        r = self.client.get(self.URL, HTTP_AUTHORIZATION=f"Bearer {self.jeton(self.autre)}", HTTP_X_APPLICATIONS="daily")
        self.assertEqual(r.status_code, 403)

    def test_cookie_du_hub_accepte(self):
        self.client.cookies["gdahub_acces"] = self.jeton(self.agent)
        self.assertEqual(self.client.get(self.URL, HTTP_X_APPLICATIONS="daily").status_code, 204)

    def test_dossier_commun_ouvert_a_tout_compte(self):
        r = self.client.get(self.URL, HTTP_AUTHORIZATION=f"Bearer {self.jeton(self.autre)}")
        self.assertEqual(r.status_code, 204)


@mock.patch("comptes.notifications._pousser")
class NotificationsTest(_Base):
    def test_liste_et_lecture(self, _pousser):
        n = Notification.objects.create(utilisateur=self.agent, titre="Bonjour")
        Notification.objects.create(utilisateur=self.autre, titre="Pas pour vous")
        self.client.force_authenticate(user=None)
        entete = {"HTTP_AUTHORIZATION": f"Bearer {self.jeton(self.agent)}"}
        d = self.client.get("/api/identity/notifications", **entete).json()
        self.assertEqual(d["non_lues"], 1)
        self.assertEqual([x["titre"] for x in d["resultats"]], ["Bonjour"])
        self.assertEqual(self.client.post(f"/api/identity/notifications/{n.id}/lue", **entete).status_code, 204)
        self.assertEqual(self.client.get("/api/identity/notifications", **entete).json()["non_lues"], 0)

    def test_on_ne_lit_pas_celles_des_autres(self, _pousser):
        n = Notification.objects.create(utilisateur=self.autre, titre="Privé")
        r = self.client.post(f"/api/identity/notifications/{n.id}/lue", HTTP_AUTHORIZATION=f"Bearer {self.jeton(self.agent)}")
        self.assertEqual(r.status_code, 404)
        self.assertIsNone(Notification.objects.get(pk=n.pk).lue_le)

    def test_abonnement_push(self, _pousser):
        entete = {"HTTP_AUTHORIZATION": f"Bearer {self.jeton(self.agent)}"}
        corps = {"endpoint": "https://fcm.googleapis.com/fcm/send/abc", "keys": {"p256dh": "cle", "auth": "secret"}}
        self.assertEqual(self.client.post("/api/identity/notifications/push/abonnement", corps, format="json", **entete).status_code, 204)
        self.assertEqual(AbonnementPush.objects.get().utilisateur, self.agent)
        for adresse in ["http://fcm.googleapis.com/x", "https://identity:8000/api/x", "https://169.254.169.254/latest", "https://fcm.googleapis.com.evil.com/x", "https://fcm.googleapis.com:8443/x"]:
            mauvais = {"endpoint": adresse, "keys": {"p256dh": "c", "auth": "s"}}
            r = self.client.post("/api/identity/notifications/push/abonnement", mauvais, format="json", **entete)
            self.assertEqual(r.status_code, 400, adresse)

    @override_settings(GDAHUB_CLE_INTERNE="cle-de-test")
    def test_route_interne(self, _pousser):
        corps = {"application": "daily", "destinataires": ["agent@test.local"], "titre": "Rapport prêt", "lien": "/chantiers"}
        self.assertEqual(self.client.post("/api/identity/interne/notifications", corps, format="json").status_code, 403)
        r = self.client.post("/api/identity/interne/notifications", corps, format="json", HTTP_X_CLE_INTERNE="mauvaise")
        self.assertEqual(r.status_code, 403)
        r = self.client.post("/api/identity/interne/notifications", corps, format="json", HTTP_X_CLE_INTERNE="cle-de-test")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.json()["notifiees"], 1)
        self.assertEqual(Notification.objects.get().utilisateur, self.agent)

    @override_settings(GDAHUB_CLE_INTERNE="")
    def test_route_interne_fermee_sans_cle_configuree(self, _pousser):
        r = self.client.post("/api/identity/interne/notifications", {"titre": "x"}, format="json", HTTP_X_CLE_INTERNE="")
        self.assertEqual(r.status_code, 403)

    @override_settings(GDAHUB_CLE_INTERNE="cle-de-test")
    def test_destinataire_par_identifiant_local(self, _pousser):
        campagnes = Application.objects.create(code="campagnes", nom="Campagnes", chemin="/campagnes/")
        Habilitation.objects.create(utilisateur=self.autre, application=campagnes, roles=["commercial"], identifiant_local="70000002")
        corps = {"application": "campagnes", "destinataires": ["70000002"], "titre": "Contrat à signer"}
        r = self.client.post("/api/identity/interne/notifications", corps, format="json", HTTP_X_CLE_INTERNE="cle-de-test")
        self.assertEqual(r.json()["notifiees"], 1)
        self.assertEqual(Notification.objects.get().utilisateur, self.autre)
