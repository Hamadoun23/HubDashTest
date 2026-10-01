"""Rattachement au compte unique de GDA Hub.

BDM tourne sur `bdm.gdamali.net` avec sa propre connexion, et cela ne change
pas. Servie par la passerelle de GDA Hub, elle reconnait **en plus** le compte
unique : un agent deja connecte au hub entre dans BDM sans ressaisir son mot
de passe.

**Pourquoi un middleware et non une classe d'authentification.** BDM n'est pas
une API : Django sert lui-meme les pages React, par Inertia, et la session
tient l'identite. Il n'y a donc pas de requete portant un en-tete a inspecter
au niveau de DRF - il y a une navigation, avec des cookies. Le rattachement se
fait donc au moment ou la requete entre.

C'est la passerelle qui transforme le cookie du hub en en-tete `Authorization`
avant de transmettre la requete : le cookie reste inaccessible au JavaScript,
et BDM n'a qu'un en-tete a lire.

Les trois memes regles qu'ailleurs :

**Le hub s'ajoute, il ne remplace pas.** Une session BDM deja ouverte est
respectee telle quelle. Si le hub tombe, la connexion maison fonctionne
toujours.

**Sans configuration, ce module est inerte.**

**Le hub donne une identite, pas une autorisation.** Un jeton valide sans
compte BDM correspondant laisse la requete anonyme, et l'utilisateur arrive
sur l'ecran de connexion habituel. Creer le compte a la volee lui donnerait un
role vide - et dans BDM, le role decide de tout.
"""

import hashlib
import logging

from django.conf import settings
from django.contrib.auth import get_user_model, login, logout

#: Le code de cette application dans GDA Hub. C'est la cle sous
#: laquelle le jeton porte l'identifiant local de la personne.
#: BDM la banque n'est qu'un des clients servis par Campagnes — le code de
#: l'application ne doit donc pas porter son nom.
APPLICATION = "campagnes"

journal = logging.getLogger("campagnes.hub")

_CLIENT_JWKS = None


def _client_jwks():
    """Le client JWKS, construit une seule fois."""
    global _CLIENT_JWKS
    if _CLIENT_JWKS is None:
        from jwt import PyJWKClient

        _CLIENT_JWKS = PyJWKClient(settings.GDAHUB_JWKS_URL, cache_keys=True)
    return _CLIENT_JWKS


def _identifiant_du_jeton(jeton):
    """Sous quel nom le hub designe cette personne dans BDM.

    Renvoie `(identifiant, explicite, charge)`, ou `(None, False, None)` si
    le jeton ne vaut rien. `explicite` dit d'ou vient l'identifiant, et cela
    change ce qu'on s'autorise a en faire :

    - `True`  : c'est `identifiant_local`, saisi par un administrateur du hub
                pour declarer « cette personne est ce compte BDM ». Une
                affirmation, donc on la suit jusqu'au bout.
    - `False` : c'est l'identifiant de connexion au hub, une adresse
                professionnelle. Personne n'a dit qu'elle designait un compte
                BDM ; on ne l'accepte que sur une egalite d'adresse.
    """
    import jwt

    try:
        if jwt.get_unverified_header(jeton).get("alg") != "RS256":
            return None, False, None
        cle = _client_jwks().get_signing_key_from_jwt(jeton)
        charge = jwt.decode(
            jeton,
            cle.key,
            algorithms=["RS256"],
            issuer=settings.GDAHUB_JETON_EMETTEUR,
            audience=settings.GDAHUB_JETON_AUDIENCE,
        )
    except Exception:
        # Un jeton illisible n'est pas une erreur a remonter : la requete
        # poursuit son chemin en anonyme et tombera sur l'ecran de connexion.
        return None, False, None

    # Le hub identifie par l'adresse professionnelle ; BDM connait ses
    # utilisateurs sous des adresses fabriquees lors de la reprise depuis
    # Laravel — quand elles existent. La correspondance, quand elle est
    # renseignee, prime sur l'adresse.
    locaux = charge.get("identifiants_locaux") or {}
    local = (locaux.get(APPLICATION) or "").strip()
    if local:
        return local, True, charge

    identifiant = (charge.get("identifiant") or "").strip()
    return (identifiant or None), False, charge


#: Cle de session : empreinte du dernier jeton du hub verifie pour cette session.
CLE_EMPREINTE = "hub_jeton_empreinte"


def _empreinte(jeton):
    return hashlib.sha256(jeton.encode("utf-8")).hexdigest()[:32]


class AuthentificationHub:
    """Ouvre la session BDM d'un agent deja connecte a GDA Hub.

    **La session suit le compte du hub.** Quand la requete porte un jeton du
    hub, c'est lui qui fait foi : une session BDM ouverte pour quelqu'un
    d'autre (un admin qui s'est deconnecte du hub, puis un commercial qui se
    connecte sur le meme navigateur) est fermee, et celle du titulaire du
    jeton est ouverte a la place. Sans cette regle, le commercial heritait de
    la session de l'admin — ses ecrans, son choix de client, ses droits.

    Pour ne pas reverifier la signature a chaque requete, la session retient
    l'empreinte du dernier jeton verifie : tant que le meme jeton revient,
    rien n'est refait. Une requete sans jeton (connexion directe a BDM) garde
    sa session telle quelle.
    """

    def __init__(self, suivant):
        self.suivant = suivant

    def __call__(self, requete):
        if getattr(settings, "GDAHUB_JWKS_URL", ""):
            self._rattacher(requete)
        return self.suivant(requete)

    def _rattacher(self, requete):
        entete = requete.META.get("HTTP_AUTHORIZATION", "")
        if not entete.lower().startswith("bearer "):
            return
        jeton = entete.split(None, 1)[1].strip()
        empreinte = _empreinte(jeton)
        if requete.user.is_authenticated and requete.session.get(CLE_EMPREINTE) == empreinte:
            return

        identifiant, explicite, charge = _identifiant_du_jeton(jeton)
        if identifiant is None:
            return

        # Le jeton prouve l'identite ; l'habilitation « campagnes » donne le
        # droit d'entrer. Sans elle, un compte BDM qui porte la meme adresse
        # qu'un compte du hub s'ouvrirait meme si le hub ne donne (ou plus)
        # acces a Campagnes a cette personne.
        habilitations = (charge or {}).get("habilitations") or {}
        if not (charge or {}).get("est_superadmin") and habilitations.get(APPLICATION) is None:
            if requete.user.is_authenticated:
                logout(requete)
            return

        compte = self._compte(identifiant, explicite)
        if requete.user.is_authenticated:
            if compte is not None and requete.user.pk == compte.pk:
                # Meme personne, jeton renouvele : on retient simplement ce jeton.
                requete.session[CLE_EMPREINTE] = empreinte
                return
            # Session ouverte pour quelqu'un d'autre que le titulaire du jeton.
            logout(requete)
        if compte is None:
            journal.warning(
                "Jeton du hub valide pour « %s », mais aucun compte BDM ne "
                "correspond%s.",
                identifiant,
                "" if explicite else " (aucun identifiant_local n'est renseigne)",
            )
            return
        if not compte.is_active:
            return

        # `backend` doit etre nomme : BDM n'a qu'un backend maison, et
        # `login()` refuse de choisir a notre place quand l'utilisateur ne
        # vient pas de `authenticate()`.
        login(requete, compte, backend=settings.AUTHENTICATION_BACKENDS[0])
        # La photo de profil est geree par le hub, pas par BDM (voir
        # Pages/Profile/Edit.jsx) : on la garde en session a l'ouverture de
        # cette session SSO, pour que le middleware Inertia puisse la
        # partager sans redecoder le jeton a chaque requete — lui ne
        # s'execute plus une fois `requete.user` authentifie.
        requete.session["hub_photo"] = (charge or {}).get("photo")
        requete.session[CLE_EMPREINTE] = empreinte

    @staticmethod
    def _compte(identifiant, explicite):
        """Le compte BDM designe par cet identifiant, ou None.

        **L'adresse ne suffit pas, et c'est tout le probleme.** Trente des
        soixante-quatre comptes de BDM n'ont aucune adresse — tous les comptes
        d'administration en font partie. Chercher par `email` seul revenait a
        dire que le compte unique ne marcherait jamais pour eux : le jeton
        etait valide, la signature verifiee, et la personne atterrissait
        malgre tout sur l'ecran de connexion de BDM.

        BDM sait pourtant reconnaitre ces gens : son propre ecran de connexion
        accepte l'adresse, le numero de telephone, ou le nom pour les comptes
        d'administration et de direction. C'est cette meme resolution qui est
        reutilisee ici — une seule regle, au lieu de deux qui divergeraient.

        **Mais seulement pour un identifiant declare.** Le nom et le telephone
        ne sont pris en compte que si un administrateur du hub a explicitement
        renseigne `identifiant_local`. L'identifiant de connexion au hub, lui,
        n'a jamais ete presente comme designant un compte BDM : l'accepter par
        egalite de nom ouvrirait la session d'un administrateur a quiconque se
        verrait attribuer le bon identifiant dans le hub — et ici, contrairement
        a l'ecran de connexion, aucun mot de passe n'est demande.
        """
        Utilisateur = get_user_model()

        if explicite:
            from .auth_backend import trouver_par_identifiant

            compte = trouver_par_identifiant(identifiant)
            if compte is not None:
                return compte

        # Repli sur l'adresse, insensible a la casse : la resolution ci-dessus
        # compare les adresses exactement, comme l'ecran de connexion.
        return Utilisateur.objects.filter(email__iexact=identifiant).first()
