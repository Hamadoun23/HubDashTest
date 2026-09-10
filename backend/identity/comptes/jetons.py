"""Signature et verification des jetons GDA Hub.

Identity signe avec une cle privee RSA qui ne sort jamais de ce service ; les
autres services verifient avec la cle publique publiee sur
/.well-known/jwks.json. C'est ce qui permet d'ajouter un service sans lui
confier le moindre secret, et de faire tourner la cle sans redeployer
personne.

Le jeton d'acces transporte les habilitations completes du compte. Un service
n'a donc aucun appel reseau a faire pour savoir si l'utilisateur a le droit
d'etre la. En contrepartie, un droit retire ne prend effet qu'a l'expiration
du jeton d'acces, quinze minutes au plus.
"""

from __future__ import annotations

import hashlib
import json
import uuid
from datetime import timedelta
from pathlib import Path

import jwt
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from django.conf import settings
from django.utils import timezone

from comptes.models import SessionJeton, Utilisateur

NOM_CLE_PRIVEE = "identity_prive.pem"
NOM_CLE_PUBLIQUE = "identity_public.pem"


def chemins_cles() -> tuple[Path, Path]:
    dossier = Path(settings.GDAHUB_DOSSIER_CLES)
    return dossier / NOM_CLE_PRIVEE, dossier / NOM_CLE_PUBLIQUE


def generer_cles(forcer: bool = False) -> tuple[Path, Path]:
    """Cree la paire RSA si elle n'existe pas encore.

    Appelee au demarrage du conteneur. Le dossier est un volume Docker : les
    cles survivent aux reconstructions d'image, sans quoi tous les jetons en
    circulation seraient invalides a chaque `docker compose up --build`.
    """
    prive, public = chemins_cles()
    if prive.exists() and public.exists() and not forcer:
        return prive, public

    prive.parent.mkdir(parents=True, exist_ok=True)
    cle = rsa.generate_private_key(public_exponent=65537, key_size=2048)

    prive.write_bytes(
        cle.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        )
    )
    prive.chmod(0o600)
    public.write_bytes(
        cle.public_key().public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        )
    )
    return prive, public


def _lire(chemin: Path) -> bytes:
    if not chemin.exists():
        raise RuntimeError(
            f"Cle absente : {chemin}. Lancez « python manage.py generer_cles »."
        )
    return chemin.read_bytes()


def cle_privee():
    prive, _ = chemins_cles()
    return serialization.load_pem_private_key(_lire(prive), password=None)


def cle_publique():
    _, public = chemins_cles()
    return serialization.load_pem_public_key(_lire(public))


def identifiant_cle() -> str:
    """Empreinte stable de la cle publique, utilisee comme « kid ».

    Elle change avec la cle : pendant une rotation, les deux peuvent etre
    publiees en meme temps et chaque jeton dit laquelle le verifie.
    """
    brut = cle_publique().public_bytes(
        encoding=serialization.Encoding.DER,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    return hashlib.sha256(brut).hexdigest()[:16]


def jeu_de_cles() -> dict:
    """Le document JWKS servi aux autres services."""
    jwk = json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(cle_publique()))
    jwk.update({"kid": identifiant_cle(), "use": "sig", "alg": "RS256"})
    return {"keys": [jwk]}


def _claims_communs(utilisateur: Utilisateur) -> dict:
    maintenant = timezone.now()
    return {
        "iss": settings.GDAHUB_JETON_EMETTEUR,
        "aud": settings.GDAHUB_JETON_AUDIENCE,
        "sub": str(utilisateur.pk),
        "iat": maintenant,
        "nbf": maintenant,
    }


def emettre_acces(utilisateur: Utilisateur) -> str:
    charge = _claims_communs(utilisateur)
    charge.update(
        {
            "exp": timezone.now() + timedelta(seconds=settings.GDAHUB_DUREE_ACCES),
            "jti": uuid.uuid4().hex,
            "token_type": "access",
            "identifiant": utilisateur.identifiant,
            "nom_complet": utilisateur.nom_complet,
            "email": utilisateur.email,
            # Le profil (nom, photo) est desormais gere une seule fois, par le
            # hub : porter la photo dans le jeton permet aux applications
            # rassemblees (Campagnes...) de l'afficher sans appel reseau
            # supplementaire — la meme logique que `nom_complet`/`email`
            # ci-dessus, deja transportes ainsi.
            "photo": utilisateur.photo.url if utilisateur.photo else None,
            "est_superadmin": utilisateur.is_superuser,
            "habilitations": utilisateur.habilitations_actives(),
            # Sous quel nom chaque application connait cette personne, quand
            # ce n'est pas son adresse. Voir Utilisateur.identifiants_locaux.
            "identifiants_locaux": utilisateur.identifiants_locaux(),
        }
    )
    return jwt.encode(
        charge, cle_privee(), algorithm="RS256", headers={"kid": identifiant_cle()}
    )


def emettre_rafraichissement(
    utilisateur: Utilisateur, adresse_ip=None, agent: str = ""
) -> str:
    """Emet un jeton de rafraichissement et ouvre la session correspondante."""
    jti = uuid.uuid4().hex
    expire_le = timezone.now() + timedelta(
        seconds=settings.GDAHUB_DUREE_RAFRAICHISSEMENT
    )
    SessionJeton.objects.create(
        identifiant_jeton=jti,
        utilisateur=utilisateur,
        expire_le=expire_le,
        adresse_ip=adresse_ip,
        agent=(agent or "")[:300],
    )
    charge = _claims_communs(utilisateur)
    charge.update({"exp": expire_le, "jti": jti, "token_type": "refresh"})
    return jwt.encode(
        charge, cle_privee(), algorithm="RS256", headers={"kid": identifiant_cle()}
    )


def emettre(utilisateur: Utilisateur, adresse_ip=None, agent: str = "") -> dict:
    """Le couple de jetons remis a la connexion."""
    return {
        "acces": emettre_acces(utilisateur),
        "rafraichissement": emettre_rafraichissement(utilisateur, adresse_ip, agent),
    }


def lire(jeton: str, type_attendu: str = "access") -> dict:
    """Verifie un jeton emis par ce service et renvoie sa charge utile."""
    charge = jwt.decode(
        jeton,
        cle_publique(),
        algorithms=["RS256"],
        audience=settings.GDAHUB_JETON_AUDIENCE,
        issuer=settings.GDAHUB_JETON_EMETTEUR,
    )
    if charge.get("token_type") != type_attendu:
        raise jwt.InvalidTokenError(
            f"Type de jeton inattendu : {charge.get('token_type')}"
        )
    return charge
