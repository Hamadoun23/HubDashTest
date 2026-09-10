from datetime import date
from decimal import Decimal

from django.db.models import Avg, Count, Q, Sum
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Utilisateur
from core.constants import ROLES_RH, Role, StatutDocument
from core.mixins import CirculationMixin, PerimetreMixin
from core.permissions import EstRH, LectureSeulePourEmploye
from rh.models import (
    CampagneEvaluation,
    CritereEvaluation,
    DemandeAbsence,
    Evaluation,
    Formation,
    InscriptionFormation,
    NoteCritere,
    Presence,
    SoldeConge,
    StatutCampagne,
    StatutEvaluation,
    StatutFormation,
    StatutInscription,
    StatutPresence,
    TypeAbsence,
)
from rh.serializers import (
    CampagneEvaluationSerializer,
    CritereEvaluationSerializer,
    DemandeAbsenceSerializer,
    EvaluationSerializer,
    FormationSerializer,
    InscriptionFormationSerializer,
    PointageSerializer,
    PresenceSerializer,
    SaisieNotesSerializer,
    SoldeCongeSerializer,
    TypeAbsenceSerializer,
)


class PerimetreAgentMixin(PerimetreMixin):
    """Perimetre RH : l'agent, son equipe si manager, tout pour le back-office RH."""

    champ_agent = "agent"
    roles_globaux = ROLES_RH


class TypeAbsenceViewSet(viewsets.ModelViewSet):
    queryset = TypeAbsence.objects.all()
    serializer_class = TypeAbsenceSerializer
    permission_classes = [LectureSeulePourEmploye]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["categorie", "actif"]


class SoldeCongeViewSet(PerimetreAgentMixin, viewsets.ModelViewSet):
    queryset = SoldeConge.objects.select_related("agent").all()
    serializer_class = SoldeCongeSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["agent", "annee"]

    def get_permissions(self):
        if self.action in {"create", "update", "partial_update", "destroy"}:
            return [EstRH()]
        return super().get_permissions()

    @action(detail=False, methods=["get"], url_path="mon-solde")
    def mon_solde(self, request):
        annee = int(request.query_params.get("annee", timezone.localdate().year))
        solde, _ = SoldeConge.objects.get_or_create(agent=request.user, annee=annee)
        return Response(self.get_serializer(solde).data)


class DemandeAbsenceViewSet(CirculationMixin, PerimetreAgentMixin, viewsets.ModelViewSet):
    queryset = DemandeAbsence.objects.select_related(
        "demandeur", "type_absence", "remplacant"
    ).prefetch_related("etapes")
    serializer_class = DemandeAbsenceSerializer
    permission_classes = [IsAuthenticated]
    champ_agent = "demandeur"
    # Le service financier figure dans le circuit des absences au titre de
    # l'information : il doit pouvoir consulter les conges et les retards sans
    # avoir a se prononcer. C'est la seule breche voulue dans le cloisonnement
    # RH / Finance, et elle ne porte que sur la lecture des demandes — ni les
    # soldes, ni les indicateurs, ni le scoring ne lui sont ouverts.
    roles_globaux = ROLES_RH | {Role.FINANCE}
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["statut", "type_absence", "demandeur"]
    search_fields = ["numero", "motif", "demandeur__last_name"]
    ordering_fields = ["date_debut", "cree_le"]

    @action(detail=False, methods=["get"], url_path="mes-demandes")
    def mes_demandes(self, request):
        demandes = self.queryset.filter(demandeur=request.user)
        page = self.paginate_queryset(demandes)
        serializer = self.get_serializer(page if page is not None else demandes, many=True)
        if page is not None:
            return self.get_paginated_response(serializer.data)
        return Response(serializer.data)


class PresenceViewSet(PerimetreAgentMixin, viewsets.ModelViewSet):
    queryset = Presence.objects.select_related("agent").all()
    serializer_class = PresenceSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["agent", "date", "statut", "agent__departement"]
    ordering_fields = ["date", "heure_arrivee"]

    def perform_create(self, serializer):
        agent = serializer.validated_data.get("agent")
        if agent and agent != self.request.user and self.request.user.role not in ROLES_RH:
            raise PermissionDenied("Seuls les RH peuvent pointer pour un autre agent.")
        serializer.save()

    @action(detail=False, methods=["post"], url_path="pointer-arrivee")
    def pointer_arrivee(self, request):
        return self._pointer(request, champ="heure_arrivee")

    @action(detail=False, methods=["post"], url_path="pointer-depart")
    def pointer_depart(self, request):
        return self._pointer(request, champ="heure_depart")

    def _pointer(self, request, champ):
        payload = PointageSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        heure = payload.validated_data.get("heure") or timezone.localtime().time()
        aujourdhui = timezone.localdate()

        presence, _ = Presence.objects.get_or_create(
            agent=request.user,
            date=aujourdhui,
            defaults={"statut": StatutPresence.PRESENT, "saisi_par": request.user},
        )
        if getattr(presence, champ) is not None:
            raise ValidationError({champ: "Pointage deja enregistre pour aujourd'hui."})

        donnees = {champ: heure, "commentaire": payload.validated_data["commentaire"]}
        serializer = self.get_serializer(presence, data=donnees, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="aujourd-hui")
    def aujourd_hui(self, request):
        presences = self.get_queryset().filter(date=timezone.localdate())
        return Response(self.get_serializer(presences, many=True).data)


class CampagneEvaluationViewSet(viewsets.ModelViewSet):
    queryset = CampagneEvaluation.objects.prefetch_related("criteres").annotate(
        nb_evaluations=Count("evaluations")
    )
    serializer_class = CampagneEvaluationSerializer
    permission_classes = [LectureSeulePourEmploye]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["statut"]

    @action(detail=True, methods=["post"], permission_classes=[EstRH])
    def lancer(self, request, pk=None):
        """Genere une evaluation par agent actif et ouvre la campagne."""
        campagne = self.get_object()
        if not campagne.criteres.exists():
            raise ValidationError({"criteres": "Definissez au moins un critere."})

        crees = 0
        for agent in Utilisateur.objects.filter(is_active=True):
            _, cree = Evaluation.objects.get_or_create(
                campagne=campagne, agent=agent, defaults={"evaluateur": agent.manager}
            )
            crees += int(cree)
        campagne.statut = StatutCampagne.OUVERTE
        campagne.save(update_fields=["statut", "modifie_le"])
        return Response({"evaluations_creees": crees, "statut": campagne.statut})


class CritereEvaluationViewSet(viewsets.ModelViewSet):
    queryset = CritereEvaluation.objects.select_related("campagne").all()
    serializer_class = CritereEvaluationSerializer
    permission_classes = [LectureSeulePourEmploye]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["campagne"]


class EvaluationViewSet(viewsets.ModelViewSet):
    queryset = Evaluation.objects.select_related(
        "agent", "evaluateur", "campagne"
    ).prefetch_related("notes__critere")
    serializer_class = EvaluationSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["campagne", "agent", "statut"]

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if user.role in ROLES_RH:
            return queryset
        return queryset.filter(Q(agent=user) | Q(evaluateur=user))

    def _verifier_evaluateur(self, evaluation):
        user = self.request.user
        if user.role in ROLES_RH or evaluation.evaluateur_id == user.id:
            return
        raise PermissionDenied("Vous n'etes pas l'evaluateur de cet agent.")

    @action(detail=True, methods=["post"], url_path="saisir-notes")
    def saisir_notes(self, request, pk=None):
        evaluation = self.get_object()
        self._verifier_evaluateur(evaluation)
        payload = SaisieNotesSerializer(data=request.data)
        payload.is_valid(raise_exception=True)

        criteres = {c.id: c for c in evaluation.campagne.criteres.all()}
        for ligne in payload.validated_data["notes"]:
            critere = criteres.get(int(ligne["critere"]))
            if critere is None:
                raise ValidationError(
                    {"notes": f"Critere {ligne['critere']} absent de la campagne."}
                )
            note = Decimal(str(ligne["note"]))
            if not Decimal("0") <= note <= Decimal("5"):
                raise ValidationError({"notes": "Les notes vont de 0 a 5."})
            NoteCritere.objects.update_or_create(
                evaluation=evaluation,
                critere=critere,
                defaults={"note": note, "commentaire": ligne.get("commentaire", "")},
            )
        evaluation.statut = StatutEvaluation.EVALUEE
        evaluation.save(update_fields=["statut", "modifie_le"])
        evaluation.recalculer_note()
        return Response(self.get_serializer(evaluation).data)

    @action(detail=True, methods=["post"], permission_classes=[EstRH])
    def valider(self, request, pk=None):
        evaluation = self.get_object()
        if evaluation.note_globale is None:
            raise ValidationError({"statut": "Saisissez les notes avant de valider."})
        evaluation.statut = StatutEvaluation.VALIDEE
        evaluation.save(update_fields=["statut", "modifie_le"])
        return Response(self.get_serializer(evaluation).data)

    @action(detail=False, methods=["get"], url_path="mes-evaluations")
    def mes_evaluations(self, request):
        evaluations = self.get_queryset().filter(agent=request.user)
        return Response(self.get_serializer(evaluations, many=True).data)


class FormationViewSet(viewsets.ModelViewSet):
    queryset = Formation.objects.prefetch_related("inscriptions", "departements_cibles")
    serializer_class = FormationSerializer
    permission_classes = [LectureSeulePourEmploye]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["statut", "categorie", "obligatoire"]
    search_fields = ["titre", "formateur", "organisme", "lieu"]
    ordering_fields = ["date_debut", "titre"]

    @action(detail=True, methods=["post"])
    def inscrire(self, request, pk=None):
        formation = self.get_object()
        if formation.places_restantes <= 0:
            raise ValidationError({"places": "Plus de place disponible sur cette session."})
        inscription, cree = InscriptionFormation.objects.get_or_create(
            formation=formation, agent=request.user
        )
        if not cree:
            raise ValidationError({"agent": "Vous etes deja inscrit a cette formation."})
        return Response(InscriptionFormationSerializer(inscription).data)

    @action(detail=False, methods=["get"])
    def planning(self, request):
        """Planning des formations a venir, filtre sur le departement de l'agent."""
        aujourdhui = timezone.localdate()
        formations = self.get_queryset().filter(date_fin__gte=aujourdhui).exclude(
            statut=StatutFormation.ANNULEE
        )
        departement = request.user.departement
        if departement:
            formations = formations.filter(
                Q(departements_cibles__isnull=True) | Q(departements_cibles=departement)
            ).distinct()
        return Response(self.get_serializer(formations, many=True).data)


class InscriptionFormationViewSet(PerimetreAgentMixin, viewsets.ModelViewSet):
    queryset = InscriptionFormation.objects.select_related("formation", "agent")
    serializer_class = InscriptionFormationSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["formation", "agent", "statut"]

    def perform_create(self, serializer):
        serializer.save(agent=self.request.user)

    def perform_update(self, serializer):
        if self.request.user.role not in ROLES_RH:
            raise PermissionDenied("Seuls les RH modifient le statut d'une inscription.")
        serializer.save()


class IndicateursRHView(APIView):
    """Tableau de bord RH : effectifs, turnover, absenteisme, ponctualite.

    Reserve au back-office RH : ces agregats portent sur l'ensemble du
    personnel et n'ont pas a circuler hors du perimetre RH.
    """

    permission_classes = [EstRH]

    def get(self, request):
        aujourdhui = timezone.localdate()
        annee = int(request.query_params.get("annee", aujourdhui.year))
        debut = date(annee, 1, 1)
        fin = min(date(annee, 12, 31), aujourdhui)

        agents = Utilisateur.objects.all()
        effectif_actuel = agents.filter(is_active=True).count()
        entrees = agents.filter(date_embauche__range=(debut, fin)).count()
        sorties = agents.filter(date_sortie__range=(debut, fin)).count()
        effectif_debut = agents.filter(
            Q(date_embauche__lt=debut) | Q(date_embauche__isnull=True)
        ).filter(Q(date_sortie__isnull=True) | Q(date_sortie__gte=debut)).count()
        effectif_moyen = (effectif_debut + effectif_actuel) / 2 or 1
        turnover = round(sorties / effectif_moyen * 100, 2)

        presences = Presence.objects.filter(date__range=(debut, fin))
        total_pointages = presences.count() or 1
        jours_absence = presences.filter(statut=StatutPresence.ABSENT).count()
        jours_retard = presences.filter(retard_minutes__gt=0).count()
        minutes_retard = presences.aggregate(total=Sum("retard_minutes"))["total"] or 0

        demandes = DemandeAbsence.objects.filter(date_debut__range=(debut, fin))
        note_moyenne = Evaluation.objects.filter(
            campagne__periode_debut__year=annee, note_globale__isnull=False
        ).aggregate(moyenne=Avg("note_globale"))["moyenne"]

        return Response(
            {
                "annee": annee,
                "effectif": {
                    "actuel": effectif_actuel,
                    "entrees": entrees,
                    "sorties": sorties,
                    "par_departement": list(
                        agents.filter(is_active=True)
                        .values("departement__nom")
                        .annotate(total=Count("id"))
                        .order_by("-total")
                    ),
                    "par_contrat": list(
                        agents.filter(is_active=True)
                        .values("type_contrat")
                        .annotate(total=Count("id"))
                        .order_by("-total")
                    ),
                },
                "turnover": {
                    "taux_pourcent": turnover,
                    "effectif_moyen": round(effectif_moyen, 1),
                    "motifs": list(
                        agents.filter(date_sortie__range=(debut, fin))
                        .values("motif_sortie")
                        .annotate(total=Count("id"))
                        .order_by("-total")
                    ),
                },
                "absenteisme": {
                    "taux_pourcent": round(jours_absence / total_pointages * 100, 2),
                    "jours_absence": jours_absence,
                    "jours_retard": jours_retard,
                    "minutes_retard_cumulees": minutes_retard,
                },
                "demandes": {
                    "total": demandes.count(),
                    "en_validation": demandes.filter(
                        statut=StatutDocument.EN_VALIDATION
                    ).count(),
                    "approuvees": demandes.filter(statut=StatutDocument.APPROUVE).count(),
                    "rejetees": demandes.filter(statut=StatutDocument.REJETE).count(),
                    "par_categorie": list(
                        demandes.values("type_absence__categorie")
                        .annotate(total=Count("id"), jours=Sum("nb_jours"))
                        .order_by("-total")
                    ),
                },
                "performance": {
                    "note_moyenne": round(float(note_moyenne), 2) if note_moyenne else None,
                    "evaluations_validees": Evaluation.objects.filter(
                        campagne__periode_debut__year=annee,
                        statut=StatutEvaluation.VALIDEE,
                    ).count(),
                },
                "formations": {
                    "planifiees": Formation.objects.filter(
                        date_debut__year=annee
                    ).count(),
                    "inscrits": InscriptionFormation.objects.filter(
                        formation__date_debut__year=annee,
                        statut__in=[StatutInscription.CONFIRME, StatutInscription.PRESENT],
                    ).count(),
                },
            }
        )


class ScoringRHView(APIView):
    """Score de suivi par agent : assiduite, ponctualite et performance.

    Score sur 100 = 40 % assiduite + 20 % ponctualite + 40 % performance.
    Aucun element confidentiel (remuneration, dossier disciplinaire) n'entre
    dans le calcul.
    """

    permission_classes = [EstRH]

    def get(self, request):
        annee = int(request.query_params.get("annee", timezone.localdate().year))
        resultats = []

        agents = Utilisateur.objects.filter(is_active=True)
        for agent in agents.select_related("departement"):
            presences = Presence.objects.filter(agent=agent, date__year=annee)
            total = presences.count()
            presents = presences.filter(
                statut__in=[
                    StatutPresence.PRESENT,
                    StatutPresence.RETARD,
                    StatutPresence.MISSION,
                    StatutPresence.TELETRAVAIL,
                ]
            ).count()
            retards = presences.filter(retard_minutes__gt=0).count()

            assiduite = (presents / total * 100) if total else 100.0
            ponctualite = ((total - retards) / total * 100) if total else 100.0
            note = Evaluation.objects.filter(
                agent=agent, campagne__periode_debut__year=annee, note_globale__isnull=False
            ).aggregate(moyenne=Avg("note_globale"))["moyenne"]
            performance = float(note) / 5 * 100 if note else 0.0

            score = 0.4 * assiduite + 0.2 * ponctualite + 0.4 * performance
            resultats.append(
                {
                    "agent_id": agent.id,
                    "matricule": agent.matricule,
                    "nom": agent.get_full_name(),
                    "departement": agent.departement.nom if agent.departement else "",
                    "assiduite": round(assiduite, 1),
                    "ponctualite": round(ponctualite, 1),
                    "performance": round(performance, 1),
                    "jours_absence": presences.filter(
                        statut=StatutPresence.ABSENT
                    ).count(),
                    "retards": retards,
                    "note_evaluation": round(float(note), 2) if note else None,
                    "score": round(score, 1),
                }
            )

        resultats.sort(key=lambda ligne: ligne["score"], reverse=True)
        return Response({"annee": annee, "resultats": resultats})
