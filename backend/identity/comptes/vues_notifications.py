"""Routes des notifications.

Pour la personne connectée (jeton du hub) :
  GET  notifications                        dernières notifications + nombre de non lues
  POST notifications/<id>/lue               en marquer une comme lue
  POST notifications/tout-lire              tout marquer comme lu
  GET  notifications/push/cle               clé publique VAPID (abonnement push)
  POST notifications/push/abonnement        abonner cet appareil
  POST notifications/push/desabonnement     le désabonner

Pour les applications du hub (réseau interne uniquement, clé partagée) :
  POST interne/notifications                notifier des personnes

La route interne n'est jamais servie par la passerelle (fermée dans
gateway/nginx.conf) : les services l'appellent directement sur
http://identity:8000, avec l'en-tête X-Cle-Interne.
"""
import hmac

from django.conf import settings
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from comptes import notifications
from comptes.models import AbonnementPush, Notification

LIMITE = 30


def _en_json(n: Notification) -> dict:
    return {
        "id": n.id,
        "application": n.application,
        "titre": n.titre,
        "message": n.message,
        "lien": n.lien,
        "cree_le": n.cree_le.isoformat(),
        "lue": n.lue_le is not None,
    }


class MesNotifications(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, requete):
        qs = Notification.objects.filter(utilisateur_id=requete.user.id)
        return Response(
            {
                "non_lues": qs.filter(lue_le__isnull=True).count(),
                "resultats": [_en_json(n) for n in qs[:LIMITE]],
            }
        )


class MarquerLue(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, requete, pk):
        n = Notification.objects.filter(pk=pk, utilisateur_id=requete.user.id).update(lue_le=timezone.now())
        return Response(status=status.HTTP_204_NO_CONTENT if n else status.HTTP_404_NOT_FOUND)


class ToutLire(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, requete):
        Notification.objects.filter(utilisateur_id=requete.user.id, lue_le__isnull=True).update(lue_le=timezone.now())
        return Response(status=status.HTTP_204_NO_CONTENT)


class ClePush(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, requete):
        return Response({"cle": notifications.cle_publique_vapid()})


class AbonnementPushVue(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, requete):
        endpoint = (requete.data.get("endpoint") or "").strip()
        cles = requete.data.get("keys") or {}
        if not endpoint.startswith("https://") or not cles.get("p256dh") or not cles.get("auth"):
            return Response({"detail": "Abonnement push incomplet."}, status=status.HTTP_400_BAD_REQUEST)
        AbonnementPush.objects.update_or_create(
            endpoint=endpoint[:1000],
            defaults={
                "utilisateur_id": requete.user.id,
                "p256dh": str(cles["p256dh"])[:200],
                "auth": str(cles["auth"])[:100],
                "agent": requete.META.get("HTTP_USER_AGENT", "")[:300],
            },
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class DesabonnementPush(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, requete):
        endpoint = (requete.data.get("endpoint") or "").strip()
        AbonnementPush.objects.filter(endpoint=endpoint, utilisateur_id=requete.user.id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class NotifierInterne(APIView):
    """Une application du hub demande de notifier des personnes.

    Corps : {"application": "campagnes", "destinataires": ["70000002", …],
             "titre": "…", "message": "…", "lien": "/campagnes/mon-contrat"}
    Les destinataires sont des identifiants du hub, des adresses, ou les
    identifiants locaux de l'application (cf. `resoudre_destinataires`).
    """

    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, requete):
        attendue = getattr(settings, "GDAHUB_CLE_INTERNE", "")
        fournie = requete.META.get("HTTP_X_CLE_INTERNE", "")
        if not attendue or not hmac.compare_digest(attendue, fournie):
            return Response(status=status.HTTP_403_FORBIDDEN)
        titre = (requete.data.get("titre") or "").strip()
        if not titre:
            return Response({"detail": "Titre requis."}, status=status.HTTP_400_BAD_REQUEST)
        application = (requete.data.get("application") or "hub").strip()
        destinataires = notifications.resoudre_destinataires(requete.data.get("destinataires") or [], application)
        creees = notifications.notifier(
            destinataires,
            titre=titre,
            message=requete.data.get("message") or "",
            lien=requete.data.get("lien") or "",
            application=application,
        )
        return Response({"notifiees": len(creees)}, status=status.HTTP_201_CREATED)
