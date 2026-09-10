from datetime import date
from decimal import Decimal

from django.db.models import Count, Q, Sum
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.constants import ROLES_FINANCE, Role, StatutDocument
from core.mixins import CirculationMixin, PerimetreMixin
from core.models import SeuilValidation
from core.permissions import EstDirection, EstFinance, LectureSeulePourEmploye
from core.serializers import SeuilValidationSerializer
from core.workflow import raison_verrou, rejouer_circuit
from finance.models import (
    ApprovisionnementCaisse,
    BaremePerdiem,
    BonCommande,
    Caisse,
    CategorieDepense,
    ConsommationCommunication,
    DemandePrix,
    Depense,
    ForfaitCommunication,
    Fournisseur,
    LigneFraisMission,
    LigneRequisition,
    Mission,
    OffreFournisseur,
    Prestation,
    Requisition,
    SortieCaisse,
    StatutDemandePrix,
)
from finance.serializers import (
    ApprovisionnementCaisseSerializer,
    BaremePerdiemSerializer,
    BonCommandeSerializer,
    CaisseSerializer,
    CategorieDepenseSerializer,
    ConsommationCommunicationSerializer,
    DemandePrixSerializer,
    DepenseSerializer,
    ForfaitCommunicationSerializer,
    FournisseurSerializer,
    LigneFraisMissionSerializer,
    LigneRequisitionSerializer,
    MissionSerializer,
    OffreFournisseurSerializer,
    PrestationSerializer,
    RequisitionAvecLignesSerializer,
    SortieCaisseSerializer,
)


class PerimetreFinanceMixin(PerimetreMixin):
    """Perimetre Finance : le demandeur, son equipe si manager, tout pour la Finance."""

    champ_agent = "demandeur"
    roles_globaux = ROLES_FINANCE


class DocumentFinancierViewSet(
    CirculationMixin, PerimetreFinanceMixin, viewsets.ModelViewSet
):
    """Socle commun aux documents finance circulant dans le workflow."""

    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    ordering_fields = ["cree_le", "montant"]

    @action(detail=False, methods=["get"], url_path="mes-demandes")
    def mes_demandes(self, request):
        documents = self.queryset.filter(demandeur=request.user)
        page = self.paginate_queryset(documents)
        serializer = self.get_serializer(page if page is not None else documents, many=True)
        if page is not None:
            return self.get_paginated_response(serializer.data)
        return Response(serializer.data)


# ---------------------------------------------------------------------------
# Referentiels et parametrage
# ---------------------------------------------------------------------------


class SeuilValidationViewSet(viewsets.ModelViewSet):
    """Parametrage du systeme de validation par seuils."""

    queryset = SeuilValidation.objects.all()
    serializer_class = SeuilValidationSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["type_document", "actif", "role_valideur"]

    def get_permissions(self):
        if self.action in {"create", "update", "partial_update", "destroy"}:
            return [EstDirection()]
        return super().get_permissions()

    @action(detail=False, methods=["get"])
    def simulation(self, request):
        """Previsualise le circuit applique pour un type de document et un montant."""
        from core.workflow import seuils_applicables

        type_document = request.query_params.get("type_document", "TOUS")
        try:
            montant = Decimal(request.query_params.get("montant", "0"))
        except (TypeError, ValueError):
            raise ValidationError({"montant": "Montant invalide."})
        circuit = seuils_applicables(type_document, montant)
        return Response(
            {
                "type_document": type_document,
                "montant": montant,
                "circuit": SeuilValidationSerializer(circuit, many=True).data,
            }
        )


class FournisseurViewSet(viewsets.ModelViewSet):
    queryset = Fournisseur.objects.all()
    serializer_class = FournisseurSerializer
    permission_classes = [LectureSeulePourEmploye]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ["actif", "categorie"]
    search_fields = ["code", "raison_sociale", "contact", "email"]


class CategorieDepenseViewSet(viewsets.ModelViewSet):
    queryset = CategorieDepense.objects.all()
    serializer_class = CategorieDepenseSerializer
    permission_classes = [LectureSeulePourEmploye]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["actif"]


class BaremePerdiemViewSet(viewsets.ModelViewSet):
    queryset = BaremePerdiem.objects.all()
    serializer_class = BaremePerdiemSerializer
    permission_classes = [LectureSeulePourEmploye]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["zone", "actif"]


# ---------------------------------------------------------------------------
# Requisitions
# ---------------------------------------------------------------------------


class RequisitionViewSet(DocumentFinancierViewSet):
    queryset = Requisition.objects.select_related(
        "demandeur", "departement"
    ).prefetch_related("lignes", "etapes")
    serializer_class = RequisitionAvecLignesSerializer
    filterset_fields = ["statut", "priorite", "departement", "demandeur"]
    search_fields = ["numero", "objet", "justification"]


class LigneRequisitionViewSet(viewsets.ModelViewSet):
    queryset = LigneRequisition.objects.select_related("requisition")
    serializer_class = LigneRequisitionSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["requisition"]

    def _verifier_modifiable(self, requisition):
        """Les lignes suivent le sort de la requisition qui les porte.

        Meme regle que le document lui-meme : tant qu'aucun responsable ne
        s'est prononce, l'auteur corrige ce qu'il a demande.
        """
        user = self.request.user
        if requisition.demandeur_id != user.id and user.role not in ROLES_FINANCE:
            raise PermissionDenied("Requisition d'un autre agent.")
        raison = raison_verrou(requisition)
        if raison:
            raise ValidationError({"requisition": raison})

    def _repercuter(self, requisition):
        """Un total revu change le circuit : il faut le rejouer."""
        requisition.recalculer_montant()
        if requisition.statut == StatutDocument.EN_VALIDATION:
            rejouer_circuit(requisition)

    def perform_create(self, serializer):
        self._verifier_modifiable(serializer.validated_data["requisition"])
        serializer.save()
        self._repercuter(serializer.instance.requisition)

    def perform_update(self, serializer):
        self._verifier_modifiable(serializer.instance.requisition)
        serializer.save()
        self._repercuter(serializer.instance.requisition)

    def perform_destroy(self, instance):
        self._verifier_modifiable(instance.requisition)
        requisition = instance.requisition
        instance.delete()
        self._repercuter(requisition)


# ---------------------------------------------------------------------------
# Demandes de prix, offres et bons de commande
# ---------------------------------------------------------------------------


class DemandePrixViewSet(viewsets.ModelViewSet):
    queryset = DemandePrix.objects.select_related("requisition", "acheteur").prefetch_related(
        "offres__fournisseur"
    )
    serializer_class = DemandePrixSerializer
    permission_classes = [LectureSeulePourEmploye]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ["statut", "requisition"]
    search_fields = ["numero", "objet"]

    def perform_create(self, serializer):
        serializer.save(acheteur=self.request.user)

    @action(detail=True, methods=["post"], permission_classes=[EstFinance])
    def attribuer(self, request, pk=None):
        """Retient une offre et cloture la consultation."""
        demande = self.get_object()
        offre_id = request.data.get("offre")
        offre = demande.offres.filter(pk=offre_id).first()
        if offre is None:
            raise ValidationError({"offre": "Offre introuvable pour cette demande de prix."})
        demande.offres.update(retenue=False)
        offre.retenue = True
        offre.save(update_fields=["retenue", "modifie_le"])
        demande.statut = StatutDemandePrix.ATTRIBUEE
        demande.save(update_fields=["statut", "modifie_le"])
        return Response(self.get_serializer(demande).data)

    @action(detail=True, methods=["post"], url_path="generer-bon-commande",
            permission_classes=[EstFinance])
    def generer_bon_commande(self, request, pk=None):
        """Cree le bon de commande a partir de l'offre retenue."""
        demande = self.get_object()
        offre = demande.offre_retenue
        if offre is None:
            raise ValidationError({"offre": "Attribuez d'abord la demande de prix."})
        bon = BonCommande.objects.create(
            demandeur=request.user,
            requisition=demande.requisition,
            demande_prix=demande,
            fournisseur=offre.fournisseur,
            objet=demande.objet,
            montant=offre.montant,
            devise=offre.devise,
            conditions=offre.conditions_paiement,
        )
        return Response(BonCommandeSerializer(bon).data)


class OffreFournisseurViewSet(viewsets.ModelViewSet):
    queryset = OffreFournisseur.objects.select_related("fournisseur", "demande_prix")
    serializer_class = OffreFournisseurSerializer
    permission_classes = [LectureSeulePourEmploye]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["demande_prix", "fournisseur", "retenue"]


class BonCommandeViewSet(DocumentFinancierViewSet):
    queryset = BonCommande.objects.select_related(
        "demandeur", "fournisseur", "requisition"
    ).prefetch_related("etapes")
    serializer_class = BonCommandeSerializer
    filterset_fields = ["statut", "fournisseur", "requisition"]
    search_fields = ["numero", "objet"]

    @action(detail=True, methods=["post"], permission_classes=[EstFinance])
    def receptionner(self, request, pk=None):
        bon = self.get_object()
        if bon.statut != StatutDocument.APPROUVE:
            raise ValidationError({"statut": "Le bon doit etre approuve avant reception."})
        bon.date_livraison_reelle = request.data.get("date") or timezone.localdate()
        bon.statut = StatutDocument.CLOTURE
        bon.save(update_fields=["date_livraison_reelle", "statut", "modifie_le"])
        return Response(self.get_serializer(bon).data)


# ---------------------------------------------------------------------------
# Caisse et depenses
# ---------------------------------------------------------------------------


class CaisseViewSet(viewsets.ModelViewSet):
    queryset = Caisse.objects.select_related("responsable")
    serializer_class = CaisseSerializer
    permission_classes = [LectureSeulePourEmploye]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["actif"]

    @action(detail=True, methods=["get"])
    def journal(self, request, pk=None):
        """Journal chronologique des mouvements d'une caisse."""
        caisse = self.get_object()
        mouvements = [
            {
                "date": appro.date_operation,
                "type": "APPROVISIONNEMENT",
                "libelle": appro.commentaire or appro.reference or "Approvisionnement",
                "montant": appro.montant,
            }
            for appro in caisse.approvisionnements.all()
        ] + [
            {
                "date": sortie.date_sortie,
                "type": "SORTIE",
                "libelle": f"{sortie.numero} - {sortie.beneficiaire}",
                "montant": -sortie.montant,
            }
            for sortie in caisse.sorties.filter(statut=StatutDocument.CLOTURE)
        ]
        mouvements.sort(key=lambda ligne: ligne["date"])
        return Response(
            {
                "caisse": CaisseSerializer(caisse).data,
                "mouvements": mouvements,
            }
        )


class ApprovisionnementCaisseViewSet(viewsets.ModelViewSet):
    queryset = ApprovisionnementCaisse.objects.select_related("caisse")
    serializer_class = ApprovisionnementCaisseSerializer
    permission_classes = [EstFinance]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["caisse"]

    def perform_create(self, serializer):
        serializer.save(enregistre_par=self.request.user)


class SortieCaisseViewSet(DocumentFinancierViewSet):
    queryset = SortieCaisse.objects.select_related(
        "demandeur", "caisse", "categorie"
    ).prefetch_related("etapes")
    serializer_class = SortieCaisseSerializer
    filterset_fields = ["statut", "caisse", "categorie", "demandeur"]
    search_fields = ["numero", "beneficiaire", "motif"]

    @action(detail=True, methods=["post"], permission_classes=[EstFinance])
    def decaisser(self, request, pk=None):
        """Acte le decaissement effectif apres approbation du circuit."""
        sortie = self.get_object()
        if sortie.statut != StatutDocument.APPROUVE:
            raise ValidationError(
                {"statut": "Le decaissement exige une approbation complete du circuit."}
            )
        if sortie.montant > sortie.caisse.solde_actuel:
            raise ValidationError({"montant": "Solde de caisse insuffisant."})
        sortie.date_decaissement = timezone.now()
        sortie.decaisse_par = request.user
        sortie.statut = StatutDocument.CLOTURE
        sortie.save(
            update_fields=["date_decaissement", "decaisse_par", "statut", "modifie_le"]
        )
        return Response(self.get_serializer(sortie).data)


class DepenseViewSet(DocumentFinancierViewSet):
    """Les demandes d'engagement du personnel, guichet unique de la Finance."""

    queryset = Depense.objects.select_related(
        "demandeur", "categorie", "fournisseur", "departement"
    ).prefetch_related("etapes")
    serializer_class = DepenseSerializer
    # Les Ressources Humaines figurent dans le circuit des demandes : elles
    # doivent pouvoir consulter les dossiers sur lesquels elles se prononcent,
    # et suivre ce qui circule. Symetrique de l'ouverture des absences au
    # service financier ; les soldes de caisse et les indicateurs Finance
    # restent fermes.
    roles_globaux = ROLES_FINANCE | {Role.RH}
    filterset_fields = ["statut", "categorie", "departement", "mode_paiement", "demandeur"]
    search_fields = ["numero", "libelle", "reference_paiement"]


# ---------------------------------------------------------------------------
# Missions, perdiems et prestations
# ---------------------------------------------------------------------------


class MissionViewSet(DocumentFinancierViewSet):
    queryset = Mission.objects.select_related("demandeur", "bareme").prefetch_related(
        "etapes", "frais", "participants"
    )
    serializer_class = MissionSerializer
    filterset_fields = ["statut", "zone", "demandeur"]
    search_fields = ["numero", "objet", "destination"]

    @action(detail=True, methods=["post"])
    def rapport(self, request, pk=None):
        """Depot du rapport de mission au retour."""
        mission = self.get_object()
        if mission.demandeur_id != request.user.id and request.user.role not in ROLES_FINANCE:
            raise PermissionDenied("Seul le missionnaire depose son rapport.")
        texte = (request.data.get("rapport") or "").strip()
        if not texte:
            raise ValidationError({"rapport": "Le contenu du rapport est obligatoire."})
        mission.rapport = texte
        mission.date_rapport = timezone.localdate()
        mission.save(update_fields=["rapport", "date_rapport", "modifie_le"])
        return Response(self.get_serializer(mission).data)


class LigneFraisMissionViewSet(viewsets.ModelViewSet):
    queryset = LigneFraisMission.objects.select_related("mission", "categorie")
    serializer_class = LigneFraisMissionSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["mission", "valide"]

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if user.role in ROLES_FINANCE:
            return queryset
        return queryset.filter(
            Q(mission__demandeur=user) | Q(mission__demandeur__manager=user)
        )

    def perform_create(self, serializer):
        mission = serializer.validated_data["mission"]
        if mission.demandeur_id != self.request.user.id:
            raise PermissionDenied("Frais rattaches a la mission d'un autre agent.")
        serializer.save()

    @action(detail=True, methods=["post"], permission_classes=[EstFinance])
    def valider(self, request, pk=None):
        ligne = self.get_object()
        ligne.valide = True
        ligne.save(update_fields=["valide", "modifie_le"])
        return Response(self.get_serializer(ligne).data)


class PrestationViewSet(DocumentFinancierViewSet):
    queryset = Prestation.objects.select_related("demandeur", "prestataire").prefetch_related(
        "etapes"
    )
    serializer_class = PrestationSerializer
    filterset_fields = ["statut", "prestataire"]
    search_fields = ["numero", "objet"]


# ---------------------------------------------------------------------------
# Forfaits de communication
# ---------------------------------------------------------------------------


class ForfaitCommunicationViewSet(PerimetreMixin, viewsets.ModelViewSet):
    queryset = ForfaitCommunication.objects.select_related(
        "agent", "agent__departement"
    ).prefetch_related("consommations")
    serializer_class = ForfaitCommunicationSerializer
    permission_classes = [IsAuthenticated]
    champ_agent = "agent"
    roles_globaux = ROLES_FINANCE
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["agent", "actif", "operateur", "type_forfait"]

    def get_permissions(self):
        if self.action in {"create", "update", "partial_update", "destroy"}:
            return [EstFinance()]
        return super().get_permissions()

    @action(detail=False, methods=["get"], url_path="mon-forfait")
    def mon_forfait(self, request):
        forfaits = self.queryset.filter(agent=request.user, actif=True)
        return Response(self.get_serializer(forfaits, many=True).data)


class ConsommationCommunicationViewSet(viewsets.ModelViewSet):
    queryset = ConsommationCommunication.objects.select_related("forfait__agent")
    serializer_class = ConsommationCommunicationSerializer
    permission_classes = [EstFinance]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["forfait", "mois"]


# ---------------------------------------------------------------------------
# Tableau de bord
# ---------------------------------------------------------------------------


class IndicateursFinanceView(APIView):
    """Indicateurs de pilotage des flux finance non confidentiels."""

    permission_classes = [IsAuthenticated]

    MODELES = {
        "requisitions": Requisition,
        "sorties_caisse": SortieCaisse,
        "depenses": Depense,
        "missions": Mission,
        "prestations": Prestation,
        "bons_commande": BonCommande,
    }

    def get(self, request):
        annee = int(request.query_params.get("annee", timezone.localdate().year))
        debut, fin = date(annee, 1, 1), date(annee, 12, 31)
        global_ = request.user.role in ROLES_FINANCE

        flux = {}
        total_engage = Decimal("0")
        total_en_attente = Decimal("0")
        for cle, modele in self.MODELES.items():
            queryset = modele.objects.filter(cree_le__date__range=(debut, fin))
            if not global_:
                queryset = queryset.filter(demandeur=request.user)
            approuve = queryset.filter(
                statut__in=[StatutDocument.APPROUVE, StatutDocument.CLOTURE]
            ).aggregate(total=Sum("montant"))["total"] or Decimal("0")
            attente = queryset.filter(
                statut=StatutDocument.EN_VALIDATION
            ).aggregate(total=Sum("montant"))["total"] or Decimal("0")
            flux[cle] = {
                "total": queryset.count(),
                "en_validation": queryset.filter(
                    statut=StatutDocument.EN_VALIDATION
                ).count(),
                "approuves": queryset.filter(statut=StatutDocument.APPROUVE).count(),
                "rejetes": queryset.filter(statut=StatutDocument.REJETE).count(),
                "montant_approuve": approuve,
                "montant_en_attente": attente,
            }
            total_engage += approuve
            total_en_attente += attente

        depenses = Depense.objects.filter(
            date_depense__range=(debut, fin),
            statut__in=[StatutDocument.APPROUVE, StatutDocument.CLOTURE],
        )
        if not global_:
            depenses = depenses.filter(demandeur=request.user)

        reponse = {
            "annee": annee,
            "perimetre": "GLOBAL" if global_ else "PERSONNEL",
            "total_engage": total_engage,
            "total_en_attente": total_en_attente,
            "flux": flux,
            "depenses_par_categorie": list(
                depenses.values("categorie__libelle")
                .annotate(total=Sum("montant"), nombre=Count("id"))
                .order_by("-total")
            ),
        }

        if global_:
            reponse["caisses"] = [
                {
                    "id": caisse.id,
                    "libelle": caisse.libelle,
                    "solde_actuel": caisse.solde_actuel,
                    "sous_alerte": caisse.sous_alerte,
                }
                for caisse in Caisse.objects.filter(actif=True)
            ]
            reponse["communication"] = {
                "forfaits_actifs": ForfaitCommunication.objects.filter(actif=True).count(),
                "budget_mensuel": ForfaitCommunication.objects.filter(actif=True).aggregate(
                    total=Sum("montant_mensuel")
                )["total"] or Decimal("0"),
                "consomme_annee": ConsommationCommunication.objects.filter(
                    mois__range=(debut, fin)
                ).aggregate(total=Sum("montant_consomme"))["total"] or Decimal("0"),
            }
            reponse["achats"] = {
                "demandes_prix_ouvertes": DemandePrix.objects.filter(
                    statut=StatutDemandePrix.OUVERTE
                ).count(),
                "fournisseurs_actifs": Fournisseur.objects.filter(actif=True).count(),
            }
        return Response(reponse)
