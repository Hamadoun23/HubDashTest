"""Le rattachement au compte unique de GDA Hub.

Ce module decide qui entre dans FinanceRH : il merite ses propres epreuves.
Chacune correspond a une regle ecrite dans accounts/hub.py.
"""

from datetime import datetime, timedelta, timezone

import jwt
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.test import APIRequestFactory

from accounts import hub

EMETTEUR = "gdahub-identity"
AUDIENCE = "gdahub"


def _paire_de_cles():
    privee = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    return privee, privee.public_key()


def _jeton(privee, identifiant, **surcharges):
    maintenant = datetime.now(tz=timezone.utc)
    charge = {
        "identifiant": identifiant,
        "iss": EMETTEUR,
        "aud": AUDIENCE,
        "iat": maintenant,
        "exp": maintenant + timedelta(minutes=15),
    }
    charge.update(surcharges)
    pem = privee.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    return jwt.encode(charge, pem, algorithm="RS256")


class _CleFactice:
    """Tient lieu de client JWKS : renvoie la cle publique sans reseau."""

    def __init__(self, publique):
        self.key = publique

    def get_signing_key_from_jwt(self, _jeton):
        return self


class AuthentificationHubTest(TestCase):
    def setUp(self):
        self.privee, self.publique = _paire_de_cles()
        self.fabrique = APIRequestFactory()
        self.agent = get_user_model().objects.create_user(
            username="hcisse",
            email="hcisse@gdamali.net",
            password="peu-importe",
            matricule="AG001",
        )
        # Le client JWKS est remplace : les epreuves ne joignent aucun reseau.
        hub._CLIENT_JWKS = _CleFactice(self.publique)
        self.addCleanup(setattr, hub, "_CLIENT_JWKS", None)

    def _requete(self, jeton):
        return self.fabrique.get("/api/", HTTP_AUTHORIZATION=f"Bearer {jeton}")

    def test_sans_configuration_le_module_est_inerte(self):
        """En production, le hub n'existe pas : la classe rend la main aussitot."""
        with override_settings(GDAHUB_JWKS_URL=""):
            requete = self._requete(_jeton(self.privee, "hcisse@gdamali.net"))
            self.assertIsNone(hub.AuthentificationHub().authenticate(requete))

    @override_settings(
        GDAHUB_JWKS_URL="http://identity/jwks.json",
        GDAHUB_JETON_EMETTEUR=EMETTEUR,
        GDAHUB_JETON_AUDIENCE=AUDIENCE,
    )
    def test_un_jeton_du_hub_ouvre_la_session_de_l_agent(self):
        requete = self._requete(_jeton(self.privee, "hcisse@gdamali.net"))
        agent, _ = hub.AuthentificationHub().authenticate(requete)
        self.assertEqual(agent.pk, self.agent.pk)

    @override_settings(
        GDAHUB_JWKS_URL="http://identity/jwks.json",
        GDAHUB_JETON_EMETTEUR=EMETTEUR,
        GDAHUB_JETON_AUDIENCE=AUDIENCE,
    )
    def test_l_adresse_se_reconnait_quelle_que_soit_la_casse(self):
        requete = self._requete(_jeton(self.privee, "HCisse@GdaMali.net"))
        agent, _ = hub.AuthentificationHub().authenticate(requete)
        self.assertEqual(agent.pk, self.agent.pk)

    @override_settings(
        GDAHUB_JWKS_URL="http://identity/jwks.json",
        GDAHUB_JETON_EMETTEUR=EMETTEUR,
        GDAHUB_JETON_AUDIENCE=AUDIENCE,
    )
    def test_un_jeton_hs256_est_laisse_a_simplejwt(self):
        """Le jeton maison ne doit pas etre intercepte : il a son propre gardien."""
        maison = jwt.encode({"user_id": self.agent.pk}, "secret", algorithm="HS256")
        self.assertIsNone(hub.AuthentificationHub().authenticate(self._requete(maison)))

    @override_settings(
        GDAHUB_JWKS_URL="http://identity/jwks.json",
        GDAHUB_JETON_EMETTEUR=EMETTEUR,
        GDAHUB_JETON_AUDIENCE=AUDIENCE,
    )
    def test_un_compte_sans_agent_est_refuse_et_non_cree(self):
        """Un agent cree a la volee n'aurait ni matricule ni responsable."""
        avant = get_user_model().objects.count()
        requete = self._requete(_jeton(self.privee, "inconnu@gdamali.net"))
        with self.assertRaises(AuthenticationFailed):
            hub.AuthentificationHub().authenticate(requete)
        self.assertEqual(get_user_model().objects.count(), avant)

    @override_settings(
        GDAHUB_JWKS_URL="http://identity/jwks.json",
        GDAHUB_JETON_EMETTEUR=EMETTEUR,
        GDAHUB_JETON_AUDIENCE=AUDIENCE,
    )
    def test_un_compte_desactive_reste_ferme(self):
        self.agent.is_active = False
        self.agent.save(update_fields=["is_active"])
        requete = self._requete(_jeton(self.privee, "hcisse@gdamali.net"))
        with self.assertRaises(AuthenticationFailed):
            hub.AuthentificationHub().authenticate(requete)

    @override_settings(
        GDAHUB_JWKS_URL="http://identity/jwks.json",
        GDAHUB_JETON_EMETTEUR=EMETTEUR,
        GDAHUB_JETON_AUDIENCE=AUDIENCE,
    )
    def test_un_jeton_perime_est_refuse(self):
        expire = datetime.now(tz=timezone.utc) - timedelta(minutes=1)
        requete = self._requete(
            _jeton(self.privee, "hcisse@gdamali.net", exp=expire)
        )
        with self.assertRaises(AuthenticationFailed):
            hub.AuthentificationHub().authenticate(requete)

    @override_settings(
        GDAHUB_JWKS_URL="http://identity/jwks.json",
        GDAHUB_JETON_EMETTEUR=EMETTEUR,
        GDAHUB_JETON_AUDIENCE=AUDIENCE,
    )
    def test_un_jeton_signe_par_un_autre_est_refuse(self):
        """La cle publique du hub est la seule qui vaille."""
        autre, _ = _paire_de_cles()
        requete = self._requete(_jeton(autre, "hcisse@gdamali.net"))
        with self.assertRaises(AuthenticationFailed):
            hub.AuthentificationHub().authenticate(requete)

    @override_settings(
        GDAHUB_JWKS_URL="http://identity/jwks.json",
        GDAHUB_JETON_EMETTEUR=EMETTEUR,
        GDAHUB_JETON_AUDIENCE=AUDIENCE,
    )
    def test_un_jeton_destine_a_une_autre_audience_est_refuse(self):
        requete = self._requete(
            _jeton(self.privee, "hcisse@gdamali.net", aud="autre-chose")
        )
        with self.assertRaises(AuthenticationFailed):
            hub.AuthentificationHub().authenticate(requete)

    @override_settings(
        GDAHUB_JWKS_URL="http://identity/jwks.json",
        GDAHUB_JETON_EMETTEUR=EMETTEUR,
        GDAHUB_JETON_AUDIENCE=AUDIENCE,
    )
    def test_sans_en_tete_la_classe_rend_la_main(self):
        requete = self.fabrique.get("/api/")
        self.assertIsNone(hub.AuthentificationHub().authenticate(requete))

    @override_settings(
        GDAHUB_JWKS_URL="http://identity/jwks.json",
        GDAHUB_JETON_EMETTEUR=EMETTEUR,
        GDAHUB_JETON_AUDIENCE=AUDIENCE,
    )
    def test_l_identifiant_local_prime_sur_l_adresse(self):
        """Une application peut connaitre la personne sous un autre nom.

        C'est le cas de Jus d'orange et de BDM, dont les comptes ne portent
        aucune adresse @gdamali.net. Sans cette correspondance, le compte
        unique ne servirait que pour FinanceRH.
        """
        autre = get_user_model().objects.create_user(
            username="import.4207",
            email="import.4207@ancien-systeme.local",
            password="peu-importe",
            matricule="AG002",
        )
        requete = self._requete(
            _jeton(
                self.privee,
                "hcisse@gdamali.net",
                identifiants_locaux={"rh": "import.4207@ancien-systeme.local"},
            )
        )
        agent, _ = hub.AuthentificationHub().authenticate(requete)
        self.assertEqual(agent.pk, autre.pk)

    @override_settings(
        GDAHUB_JWKS_URL="http://identity/jwks.json",
        GDAHUB_JETON_EMETTEUR=EMETTEUR,
        GDAHUB_JETON_AUDIENCE=AUDIENCE,
    )
    def test_la_correspondance_d_une_autre_application_est_ignoree(self):
        """Chaque application ne lit que sa propre entree.

        Prendre celle du voisin ouvrirait la session de quelqu'un d'autre.
        """
        requete = self._requete(
            _jeton(
                self.privee,
                "hcisse@gdamali.net",
                identifiants_locaux={"bdm": "quelqu-un-d-autre@import.gda"},
            )
        )
        agent, _ = hub.AuthentificationHub().authenticate(requete)
        self.assertEqual(agent.pk, self.agent.pk)
