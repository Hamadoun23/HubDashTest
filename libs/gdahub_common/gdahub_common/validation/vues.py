"""L'administration des circuits, identique dans chaque service.

Chaque service expose ses propres regles ici ; le service `direction` s'en
sert comme console, en appelant ces routes avec le jeton du directeur. Les
droits voyagent donc avec la personne, et il n'y a aucune authentification de
service a inventer.
"""

from rest_framework import viewsets

from gdahub_common.permissions import EstHabilite
from gdahub_common.validation.models import RegleCircuit
from gdahub_common.validation.serializers import RegleCircuitSerializer
from rest_framework import permissions


class EcritureReserveeALaDirection(permissions.BasePermission):
    """Lire un circuit rassure ; le modifier engage.

    Un agent gagne a savoir qui doit se prononcer sur sa demande — c'est ce
    qui evite les relances a l'aveugle. Changer l'ordre des valideurs, en
    revanche, revient a redistribuer l'autorite dans l'entreprise.
    """

    message = "Seule la direction peut modifier les circuits de validation."

    def has_permission(self, requete, vue):
        if requete.method in permissions.SAFE_METHODS:
            return True
        utilisateur = getattr(requete, "user", None)
        if utilisateur is None or not utilisateur.is_authenticated:
            return False
        return utilisateur.a_role("direction", "admin")


class RegleCircuitViewSet(viewsets.ModelViewSet):
    """Qui valide quoi, a partir de quel montant, dans quel ordre."""

    permission_classes = [EstHabilite, EcritureReserveeALaDirection]
    queryset = RegleCircuit.objects.all()
    serializer_class = RegleCircuitSerializer
    filterset_fields = ["type_document", "actif", "nature"]
    search_fields = ["libelle", "role_valideur", "valideur_nom"]
    ordering_fields = ["type_document", "ordre", "montant_min"]
