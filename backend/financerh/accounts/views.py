from django.db.models import Q
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from accounts.models import Departement, Utilisateur
from accounts.serializers import (
    ChangementMotDePasseSerializer,
    ConnexionSerializer,
    DepartementSerializer,
    ProfilSerializer,
    UtilisateurSerializer,
)
from core.constants import Role
from core.permissions import EstRH, LectureSeulePourEmploye


class ConnexionView(TokenObtainPairView):
    serializer_class = ConnexionSerializer


class ProfilView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(ProfilSerializer(request.user).data)

    def patch(self, request):
        serializer = ProfilSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class ChangementMotDePasseView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangementMotDePasseSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"detail": "Mot de passe mis a jour."}, status=status.HTTP_200_OK)


class DepartementViewSet(viewsets.ModelViewSet):
    queryset = Departement.objects.select_related("responsable").all()
    serializer_class = DepartementSerializer
    permission_classes = [LectureSeulePourEmploye]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["code", "nom"]


class UtilisateurViewSet(viewsets.ModelViewSet):
    """Annuaire des agents.

    Lecture ouverte a tous les agents connectes (annuaire interne),
    ecriture reservee aux RH et aux administrateurs.
    """

    queryset = Utilisateur.objects.select_related("departement", "manager").all()
    serializer_class = UtilisateurSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["departement", "role", "type_contrat", "is_active"]
    search_fields = ["first_name", "last_name", "matricule", "poste", "email"]
    ordering_fields = ["last_name", "date_embauche", "matricule"]

    def get_permissions(self):
        if self.action in {"create", "update", "partial_update", "destroy"}:
            return [EstRH()]
        return super().get_permissions()

    @action(detail=False, methods=["get"], url_path="mon-equipe")
    def mon_equipe(self, request):
        equipe = self.get_queryset().filter(manager=request.user, is_active=True)
        return Response(self.get_serializer(equipe, many=True).data)

    @action(detail=False, methods=["get"])
    def valideurs(self, request):
        """Agents pouvant intervenir dans un circuit : back-office ou encadrants."""
        agents = self.get_queryset().filter(is_active=True).filter(
            Q(role__in=[Role.RH, Role.FINANCE, Role.DIRECTION]) | Q(equipe__isnull=False)
        ).distinct()
        return Response(self.get_serializer(agents, many=True).data)
