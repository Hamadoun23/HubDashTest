"""Demander a GDA Hub de notifier des personnes (cloche + push sur leurs appareils).

Les comptes et les appareils vivent dans identity : l'application lui
transmet la demande sur le reseau interne (route jamais exposee par la
passerelle), avec la cle partagee GDAHUB_CLE_INTERNE. L'envoi part dans un
fil a part et ses echecs sont seulement journalises : une notification
manquee ne doit jamais faire echouer l'action qui l'a declenchee.
"""
import json
import logging
import os
import threading
import urllib.request

journal = logging.getLogger(__name__)


def notifier(destinataires, titre, message="", lien="", application="hub"):
    """`destinataires` : identifiants du hub, adresses, ou identifiants locaux
    de `application` (un telephone pour Campagnes)."""
    cle = os.environ.get("GDAHUB_CLE_INTERNE", "")
    base = os.environ.get("GDAHUB_URL_IDENTITY", "")
    destinataires = [d for d in destinataires if d]
    if not cle or not base or not destinataires:
        return
    corps = json.dumps(
        {
            "application": application,
            "destinataires": destinataires,
            "titre": titre,
            "message": message,
            "lien": lien,
        }
    ).encode("utf-8")

    def envoyer():
        requete = urllib.request.Request(
            f"{base.rstrip('/')}/api/identity/interne/notifications",
            data=corps,
            headers={"Content-Type": "application/json", "X-Cle-Interne": cle},
            method="POST",
        )
        try:
            urllib.request.urlopen(requete, timeout=10).read()
        except Exception:  # noqa: BLE001 - voir l'en-tete du module
            journal.warning("Notification GDA Hub non transmise : %s", titre, exc_info=True)

    threading.Thread(target=envoyer, daemon=True).start()
