"""Notifications du hub : enregistrement et envoi push (Web Push, VAPID).

Une notification est toujours rangée en base (la cloche de l'interface la
lit), puis poussée sur chaque appareil abonné de la personne — téléphone
avec l'application installée, navigateur de bureau — même application
fermée. L'envoi push se fait dans un fil à part : un service push lent ou
injoignable ne doit jamais retarder la requête qui a déclenché la
notification.

Clés VAPID : une paire EC P-256, créée au premier besoin dans le dossier des
clés de signature (volume Docker `cles`), comme la paire RSA des jetons.
"""
from __future__ import annotations

import base64
import json
import logging
import threading
from pathlib import Path

from django.conf import settings
from django.db.models import Q

from comptes.models import AbonnementPush, Habilitation, Notification, Utilisateur

journal = logging.getLogger("identity.notifications")

NOM_CLE_VAPID = "vapid_prive.pem"


# --- Clés VAPID ----------------------------------------------------------------

def _chemin_cle_vapid() -> Path:
    return Path(settings.GDAHUB_DOSSIER_CLES) / NOM_CLE_VAPID


def _cle_privee_vapid():
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import ec

    chemin = _chemin_cle_vapid()
    if not chemin.exists():
        chemin.parent.mkdir(parents=True, exist_ok=True)
        cle = ec.generate_private_key(ec.SECP256R1())
        chemin.write_bytes(
            cle.private_bytes(
                serialization.Encoding.PEM,
                serialization.PrivateFormat.PKCS8,
                serialization.NoEncryption(),
            )
        )
        chemin.chmod(0o600)
    return serialization.load_pem_private_key(chemin.read_bytes(), password=None)


def cle_publique_vapid() -> str:
    """Clé publique au format attendu par `pushManager.subscribe` (base64 url)."""
    from cryptography.hazmat.primitives import serialization

    brute = _cle_privee_vapid().public_key().public_bytes(
        serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint
    )
    return base64.urlsafe_b64encode(brute).decode().rstrip("=")


# --- Destinataires -------------------------------------------------------------

def resoudre_destinataires(identifiants, application: str | None = None):
    """Comptes du hub désignés par leur identifiant, leur adresse, ou — pour
    une application donnée — l'identifiant sous lequel ils y sont connus
    (`Habilitation.identifiant_local` : un téléphone pour Campagnes…)."""
    valeurs = [str(v).strip() for v in identifiants if str(v).strip()]
    if not valeurs:
        return Utilisateur.objects.none()
    filtre = Q()
    for v in valeurs:
        filtre |= Q(identifiant__iexact=v) | Q(email__iexact=v)
    if application:
        locaux = Habilitation.objects.filter(
            application__code=application, identifiant_local__in=valeurs, active=True
        ).values_list("utilisateur_id", flat=True)
        filtre |= Q(id__in=list(locaux))
    return Utilisateur.objects.filter(filtre, est_actif=True).distinct()


# --- Envoi ---------------------------------------------------------------------

def notifier(utilisateurs, titre: str, message: str = "", lien: str = "", application: str = "hub"):
    """Crée la notification pour chaque personne et la pousse sur ses appareils."""
    creees = [
        Notification.objects.create(
            utilisateur=u,
            application=application[:32],
            titre=titre[:150],
            message=message[:500],
            lien=lien[:300],
        )
        for u in utilisateurs
    ]
    if creees:
        fil = threading.Thread(target=_pousser, args=([n.id for n in creees],), daemon=True)
        fil.start()
    return creees


def _pousser(ids):
    try:
        from pywebpush import WebPushException, webpush
    except ImportError:  # dépendance absente : les notifications restent dans la cloche
        return

    from django.db import close_old_connections

    close_old_connections()
    try:
        cle_pem = _chemin_cle_vapid()
        _cle_privee_vapid()
        for n in Notification.objects.filter(id__in=ids).select_related("utilisateur"):
            charge = json.dumps(
                {
                    "id": n.id,
                    "titre": n.titre,
                    "message": n.message,
                    "lien": n.lien or "/",
                    "application": n.application,
                }
            )
            for abonnement in AbonnementPush.objects.filter(utilisateur_id=n.utilisateur_id):
                try:
                    webpush(
                        subscription_info={
                            "endpoint": abonnement.endpoint,
                            "keys": {"p256dh": abonnement.p256dh, "auth": abonnement.auth},
                        },
                        data=charge,
                        vapid_private_key=str(cle_pem),
                        vapid_claims={"sub": settings.GDAHUB_VAPID_CONTACT},
                        ttl=24 * 3600,
                        timeout=10,
                    )
                except WebPushException as erreur:
                    statut = getattr(erreur.response, "status_code", None)
                    if statut in (404, 410):
                        # Abonnement expiré ou révoqué par l'appareil : on l'oublie.
                        abonnement.delete()
                    else:
                        journal.warning("Push refusé (%s) pour %s", statut, abonnement.id)
                except Exception:  # noqa: BLE001 - un appareil en échec ne bloque pas les autres
                    journal.exception("Push impossible vers l'abonnement %s", abonnement.id)
    finally:
        close_old_connections()
