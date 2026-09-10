"""API du service identity.

Deux familles de routes :

- l'authentification, ouverte a tous (connexion, rafraichissement,
  deconnexion, « mon compte ») ;
- l'administration des comptes, des applications et des habilitations,
  reservee aux administrateurs du hub.
"""

from __future__ import annotations

import jwt
from django.conf import settings
from django.db.models import Prefetch
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from comptes import cookie, jetons
from comptes.models import (
    Application,
    Habilitation,
    JournalConnexion,
    SessionJeton,
    Utilisateur,
)
from comptes.permissions import EstAdminHub, EstConnecte
from comptes.serializers import (
    ApplicationSerializer,
    ChangementMotDePasseSerializer,
    ConnexionSerializer,
    HabilitationSerializer,
    JournalConnexionSerializer,
    RafraichissementSerializer,
    SessionSerializer,
    UtilisateurEcritureSerializer,
    UtilisateurSerializer,
)


def _adresse(requete):
    transmise = requete.META.get("HTTP_X_FORWARDED_FOR", "")
    if transmise:
        return transmise.split(",")[0].strip()
    return requete.META.get("REMOTE_ADDR")


def _agent(requete):
    return (requete.META.get("HTTP_USER_AGENT") or "")[:300]


def _profil(utilisateur: Utilisateur) -> dict:
    """Ce que le shell React affiche apres la connexion.

    Les applications sont renvoyees ici plutot que laissees au front : la
    liste depend des habilitations, et la calculer cote client reviendrait a
    lui faire confiance pour masquer ce qu'il ne doit pas voir.
    """
    habilitations = utilisateur.habilitations_actives()
    applications = Application.objects.filter(
        active=True, code__in=habilitations.keys()
    ).order_by("ordre")
    return {
        "utilisateur": {
            "id": utilisateur.pk,
            "identifiant": utilisateur.identifiant,
            "nom_complet": utilisateur.nom_complet,
            "email": utilisateur.email,
            "fonction": utilisateur.fonction,
            "est_superadmin": utilisateur.is_superuser,
            "photo": utilisateur.photo.url if utilisateur.photo else None,
        },
        "habilitations": habilitations,
        "applications": [
            {
                **ApplicationSerializer(application).data,
                "roles": habilitations.get(application.code, []),
            }
            for application in applications
        ],
    }


class Connexion(APIView):
    """Echange un identifiant et un mot de passe contre un couple de jetons."""

    authentication_classes: list = []
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "connexion"

    def post(self, requete):
        formulaire = ConnexionSerializer(data=requete.data)
        formulaire.is_valid(raise_exception=True)
        identifiant = formulaire.validated_data["identifiant"]
        mot_de_passe = formulaire.validated_data["mot_de_passe"]

        utilisateur = Utilisateur.objects.filter(identifiant=identifiant).first()

        # Le hachage est calcule meme quand le compte n'existe pas : sans cela,
        # le temps de reponse revele quels identifiants sont valides.
        if utilisateur is None:
            Utilisateur().set_password(mot_de_passe)
            return self._echec(requete, identifiant, None, "inconnu")

        if not utilisateur.check_password(mot_de_passe):
            return self._echec(requete, identifiant, utilisateur, "mot_de_passe")

        if not utilisateur.est_actif:
            return self._echec(requete, identifiant, utilisateur, "compte_inactif")

        utilisateur.derniere_connexion = timezone.now()
        utilisateur.save(update_fields=["derniere_connexion"])
        JournalConnexion.objects.create(
            identifiant_saisi=identifiant,
            utilisateur=utilisateur,
            reussie=True,
            adresse_ip=_adresse(requete),
            agent=_agent(requete),
        )

        couple = jetons.emettre(utilisateur, _adresse(requete), _agent(requete))
        # Le cookie porte le compte unique jusqu'aux applications rassemblees,
        # qui ne savent pas aller chercher un jeton chez le hub.
        return cookie.poser(
            Response({**couple, **_profil(utilisateur)}), couple["acces"]
        )

    def _echec(self, requete, identifiant, utilisateur, motif):
        JournalConnexion.objects.create(
            identifiant_saisi=identifiant,
            utilisateur=utilisateur,
            reussie=False,
            motif=motif,
            adresse_ip=_adresse(requete),
            agent=_agent(requete),
        )
        return Response(
            {
                "erreur": {
                    "code": "authentification",
                    "message": self._message(identifiant, motif),
                    "details": {},
                }
            },
            status=status.HTTP_401_UNAUTHORIZED,
        )

    @staticmethod
    def _message(identifiant: str, motif: str) -> str:
        """Ce que l'on dit a celui qui n'entre pas.

        En production, on ne distingue pas un identifiant inconnu d'un mot de
        passe faux : la difference apprendrait a un inconnu quels comptes
        existent, et c'est la premiere chose que cherche une attaque.

        En developpement, cette prudence se retourne contre celui qui installe
        l'ERP : il ne peut pas savoir s'il s'est trompe de compte ou de mot de
        passe, et il essaie les deux au hasard. On le lui dit donc, et
        seulement la.
        """
        if motif == "compte_inactif":
            return "Ce compte est desactive. Contactez un administrateur."
        if not settings.DEBUG:
            return "Identifiant ou mot de passe incorrect."
        if motif == "inconnu":
            connus = list(
                Utilisateur.objects.filter(est_actif=True)
                .order_by("identifiant")
                .values_list("identifiant", flat=True)[:3]
            )
            exemples = f" Comptes existants : {', '.join(connus)}..." if connus else ""
            return (
                f"Aucun compte ne porte l'identifiant « {identifiant} ».{exemples}"
            )
        return "Mot de passe incorrect pour ce compte."


class Rafraichir(APIView):
    """Rend un nouveau jeton d'acces a partir du jeton de rafraichissement."""

    authentication_classes: list = []
    permission_classes = [AllowAny]

    def post(self, requete):
        formulaire = RafraichissementSerializer(data=requete.data)
        formulaire.is_valid(raise_exception=True)
        try:
            charge = jetons.lire(
                formulaire.validated_data["rafraichissement"], "refresh"
            )
        except jwt.InvalidTokenError as erreur:
            return self._refus(f"Jeton de rafraichissement invalide : {erreur}")

        session = SessionJeton.objects.filter(
            identifiant_jeton=charge["jti"]
        ).select_related("utilisateur").first()
        if session is None or not session.valide:
            return self._refus("Session close. Reconnectez-vous.")
        if not session.utilisateur.est_actif:
            return self._refus("Ce compte est desactive.")

        # Les habilitations sont relues en base : c'est le moment ou un droit
        # accorde ou retire entre reellement en vigueur.
        acces = jetons.emettre_acces(session.utilisateur)
        # Le cookie est repose : sans cela, il expirerait avant la session et
        # les applications rassemblees se fermeraient au bout de quinze
        # minutes, alors que le shell, lui, continuerait de fonctionner.
        return cookie.poser(
            Response({"acces": acces, **_profil(session.utilisateur)}), acces
        )

    def _refus(self, message):
        return Response(
            {"erreur": {"code": "authentification", "message": message, "details": {}}},
            status=status.HTTP_401_UNAUTHORIZED,
        )


class Deconnexion(APIView):
    """Revoque le jeton de rafraichissement fourni."""

    authentication_classes: list = []
    permission_classes = [AllowAny]

    def post(self, requete):
        formulaire = RafraichissementSerializer(data=requete.data)
        formulaire.is_valid(raise_exception=True)
        try:
            charge = jetons.lire(
                formulaire.validated_data["rafraichissement"], "refresh"
            )
        except jwt.InvalidTokenError:
            # Un jeton illisible est deja sans effet : on repond comme si la
            # deconnexion avait eu lieu, pour ne rien apprendre a l'appelant.
            # Le cookie part quand meme : se deconnecter doit toujours fermer
            # l'acces aux applications, meme quand le jeton fourni ne vaut rien.
            return cookie.retirer(Response(status=status.HTTP_204_NO_CONTENT))

        session = SessionJeton.objects.filter(identifiant_jeton=charge["jti"]).first()
        if session:
            session.revoquer()
        return cookie.retirer(Response(status=status.HTTP_204_NO_CONTENT))


class MonCompte(APIView):
    """Profil et applications accessibles au porteur du jeton."""

    permission_classes = [EstConnecte]

    def get(self, requete):
        utilisateur = Utilisateur.objects.filter(pk=requete.user.id).first()
        if utilisateur is None:
            return Response(
                {
                    "erreur": {
                        "code": "introuvable",
                        "message": "Ce compte n'existe plus.",
                        "details": {},
                    }
                },
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(_profil(utilisateur))


class PhotoDeProfil(APIView):
    """Depot et retrait de la photo de profil.

    Vue separee de MonCompte plutot qu'un champ de plus sur
    UtilisateurEcritureSerializer : celle-ci est reservee aux administrateurs
    et n'accepte que du JSON, alors qu'une photo part en multipart. Melanger
    les deux aurait complique les deux cas sans en simplifier aucun.
    """

    permission_classes = [EstConnecte]

    TAILLE_MAXIMALE = 5 * 1024 * 1024

    def post(self, requete):
        fichier = requete.FILES.get("photo")
        if not fichier:
            return self._erreur("Aucun fichier recu.", "Obligatoire.")
        if not (fichier.content_type or "").startswith("image/"):
            return self._erreur("Le fichier doit etre une image.", "Format non reconnu.")
        if fichier.size > self.TAILLE_MAXIMALE:
            return self._erreur("L'image depasse 5 Mo.", "Trop volumineuse.")

        utilisateur = Utilisateur.objects.get(pk=requete.user.id)
        # L'ancien fichier ne se remplace pas tout seul sur le disque : sans
        # ce menage, chaque nouvelle photo laisserait la precedente derriere
        # elle, orpheline. Le nom est capture a part plutot que gardee comme
        # FieldFile : `FieldFile.delete()` reecrit aussi le champ sur
        # l'instance qui le porte (c'est fait pour, dans son usage normal) —
        # ici cette instance est la meme que celle qu'on vient de sauver avec
        # la nouvelle photo, et l'appeler aurait efface la reponse tout en
        # laissant la bonne valeur en base (constate : 200 avec `photo: null`
        # malgre un fichier bien enregistre).
        ancien_nom = utilisateur.photo.name if utilisateur.photo else None
        utilisateur.photo = fichier
        utilisateur.save(update_fields=["photo", "modifie_le"])
        if ancien_nom:
            utilisateur.photo.storage.delete(ancien_nom)
        return Response(_profil(utilisateur))

    def delete(self, requete):
        utilisateur = Utilisateur.objects.get(pk=requete.user.id)
        if utilisateur.photo:
            nom = utilisateur.photo.name
            stockage = utilisateur.photo.storage
            utilisateur.photo = None
            utilisateur.save(update_fields=["photo", "modifie_le"])
            stockage.delete(nom)
        return Response(_profil(utilisateur))

    @staticmethod
    def _erreur(message, detail):
        return Response(
            {
                "erreur": {
                    "code": "validation",
                    "message": message,
                    "details": {"photo": [detail]},
                }
            },
            status=status.HTTP_400_BAD_REQUEST,
        )


class ChangerMotDePasse(APIView):
    """Changement de mot de passe par l'utilisateur lui-meme."""

    permission_classes = [EstConnecte]

    def post(self, requete):
        formulaire = ChangementMotDePasseSerializer(data=requete.data)
        formulaire.is_valid(raise_exception=True)
        utilisateur = Utilisateur.objects.get(pk=requete.user.id)
        if not utilisateur.check_password(formulaire.validated_data["ancien"]):
            return Response(
                {
                    "erreur": {
                        "code": "validation",
                        "message": "Ancien mot de passe incorrect.",
                        "details": {"ancien": ["Incorrect."]},
                    }
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        utilisateur.set_password(formulaire.validated_data["nouveau"])
        utilisateur.save(update_fields=["password", "modifie_le"])
        utilisateur.sessions.filter(revoque_le__isnull=True).update(
            revoque_le=timezone.now()
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class UtilisateurViewSet(viewsets.ModelViewSet):
    """Annuaire des comptes du groupe."""

    permission_classes = [EstAdminHub]
    queryset = (
        Utilisateur.objects.all()
        .prefetch_related(
            Prefetch(
                "habilitations",
                queryset=Habilitation.objects.select_related("application"),
            )
        )
        .order_by("nom", "prenom")
    )
    filterset_fields = ["est_actif", "is_superuser"]
    search_fields = ["identifiant", "nom", "prenom", "email", "telephone"]
    ordering_fields = ["nom", "cree_le", "derniere_connexion"]

    def get_serializer_class(self):
        if self.action in {"create", "update", "partial_update"}:
            return UtilisateurEcritureSerializer
        return UtilisateurSerializer

    def perform_destroy(self, instance):
        """On desactive plutot que de supprimer.

        Les services metier stockent utilisateur_id sans cle etrangere ; une
        suppression laisserait des references orphelines dans quatre bases.
        """
        instance.est_actif = False
        instance.save(update_fields=["est_actif", "modifie_le"])
        instance.sessions.filter(revoque_le__isnull=True).update(
            revoque_le=timezone.now()
        )

    @action(detail=True, methods=["get"])
    def sessions(self, requete, pk=None):
        utilisateur = self.get_object()
        return Response(
            SessionSerializer(utilisateur.sessions.all()[:50], many=True).data
        )

    @action(detail=True, methods=["post"], url_path="revoquer-sessions")
    def revoquer_sessions(self, requete, pk=None):
        utilisateur = self.get_object()
        nombre = utilisateur.sessions.filter(revoque_le__isnull=True).update(
            revoque_le=timezone.now()
        )
        return Response({"sessions_revoquees": nombre})


class ApplicationViewSet(viewsets.ModelViewSet):
    """Catalogue des applications de GDA Hub."""

    permission_classes = [EstAdminHub]
    queryset = Application.objects.all()
    serializer_class = ApplicationSerializer
    filterset_fields = ["active"]
    search_fields = ["code", "nom"]


class HabilitationViewSet(viewsets.ModelViewSet):
    """Qui accede a quoi, avec quels roles."""

    permission_classes = [EstAdminHub]
    queryset = Habilitation.objects.select_related("application", "utilisateur")
    serializer_class = HabilitationSerializer
    filterset_fields = ["utilisateur", "application", "active"]

    def perform_create(self, serializer):
        serializer.save(accordee_par_id=self.request.user.id)


class JournalConnexionViewSet(viewsets.ReadOnlyModelViewSet):
    """Journal des connexions, en lecture seule."""

    permission_classes = [EstAdminHub]
    queryset = JournalConnexion.objects.select_related("utilisateur")
    serializer_class = JournalConnexionSerializer
    filterset_fields = ["reussie", "utilisateur"]
    search_fields = ["identifiant_saisi", "adresse_ip"]
