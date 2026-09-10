"""Vues du service Chantiers — API REST fidele a l'original DailyGda."""
import json
from urllib.parse import urlencode
from urllib.request import urlopen

from django.db import transaction
from django.db.models import Q
from django.http import FileResponse
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from .exports import excel_response, pdf_response
from .models import (
    ActivityLog,
    MiseAJourJournaliere,
    Phase,
    Photo,
    Project,
    Rapport,
    SousPhase,
)
from .permissions import EstEquipeInterne, LectureSeulePourPartenaire
from .serializers import (
    MiseAJourJournaliereSerializer,
    PhaseSerializer,
    PhotoSerializer,
    ProjectSerializer,
    RapportSerializer,
    SousPhaseSerializer,
    TacheDetailSerializer,
    TacheSerializer,
)
from .services import (
    active_project,
    current_user_name,
    dashboard_data,
    generate_charts_data,
    log_activity,
    process_base64_photo,
    process_uploaded_photo,
    project_queryset_for,
    save_daily_update,
    visible_tasks,
)

#: Un partenaire lit ; l'equipe interne lit et ecrit. Aucun autre distinguo
#: de role n'existe encore dans la logique metier (cf. hub.UtilisateurHub).
PERMISSIONS_PAR_DEFAUT = [LectureSeulePourPartenaire]


def message_erreur(exc: Exception) -> str:
    """Un message lisible, pour une ligne en echec d'un lot.

    `str()` sur une `ValidationError` de DRF rend la representation Python de
    sa structure interne — `{'progress_note': ErrorDetail(string="...",
    code='invalid')}` — au lieu du message qu'elle porte. Sans cette
    extraction, c'est ce texte brut qui remontait jusqu'a l'ecran de saisie
    du jour a chaque avancee non justifiee.
    """
    detail = getattr(exc, "detail", None)
    if isinstance(detail, dict):
        def aplatir(messages):
            # DRF construit un `ErrorDetail` (une sous-classe de `str`) quand
            # le champ ne porte qu'un seul message, une liste quand il en
            # porte plusieurs. Iterer sur le premier cas parcourt ses
            # caracteres un par un — exactement le bug que ce garde-fou evite.
            if isinstance(messages, (list, tuple)):
                return " ".join(str(m) for m in messages)
            return str(messages)

        return " ".join(f"{champ} : {aplatir(messages)}" for champ, messages in detail.items())
    if detail is not None:
        return str(detail)
    return str(exc)


def apply_sort_order(queryset, order):
    """Applique un ordre complet et atomique, sans accepter d'objet hors perimetre."""
    requested = [int(item) for item in order]
    found = list(queryset.filter(id__in=requested).values_list("id", flat=True))
    if len(requested) != len(set(requested)) or len(found) != len(requested):
        raise ValidationError({"order": "Ordre invalide : elements du mauvais perimetre ou introuvables."})
    with transaction.atomic():
        for index, object_id in enumerate(requested):
            queryset.model.objects.filter(pk=object_id).update(sort_order=index)


class ProjectViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectSerializer
    permission_classes = PERMISSIONS_PAR_DEFAUT
    filterset_fields = ["status"]
    search_fields = ["name", "client"]

    def get_queryset(self):
        return project_queryset_for(self.request.user)

    def perform_create(self, serializer):
        user = self.request.user
        dernier = Project.objects.order_by("-sort_order").values_list("sort_order", flat=True).first()
        projet = serializer.save(
            sort_order=(dernier or -1) + 1,
            user_ids=[user.id],
            user_names={str(user.id): current_user_name(user)},
        )
        log_activity(self.request, "project.created", project=projet, subject=projet)

    @action(detail=False, methods=["post"], url_path="reorder", permission_classes=[EstEquipeInterne])
    def reorder(self, request):
        order = request.data.get("order", [])
        if not isinstance(order, list) or not order:
            return Response({"detail": "La liste order est obligatoire."}, status=status.HTTP_400_BAD_REQUEST)
        apply_sort_order(self.get_queryset(), order)
        return Response({"ok": True})

    @action(detail=True, methods=["get"])
    def structure(self, request, pk=None):
        """Structure complete d'un projet : phases -> sous-phases -> taches avec progression."""
        projet = self.get_object()
        data = []
        for phase in projet.phases.order_by("sort_order"):
            sp_data = []
            for sp in phase.sous_phases.order_by("sort_order"):
                sp_data.append(
                    {
                        "id": sp.id,
                        "name": sp.name,
                        "sort_order": sp.sort_order,
                        "hidden_from_partner": sp.hidden_from_partner,
                        "tasks": TacheSerializer(sp.taches.order_by("sort_order"), many=True, context={"request": request}).data,
                    }
                )
            data.append(
                {
                    "id": phase.id,
                    "name": phase.name,
                    "sort_order": phase.sort_order,
                    "hidden_from_partner": phase.hidden_from_partner,
                    "sub_phases": sp_data,
                }
            )
        return Response({"id": projet.id, "name": projet.name, "phases": data})


class PhaseViewSet(viewsets.ModelViewSet):
    serializer_class = PhaseSerializer
    permission_classes = PERMISSIONS_PAR_DEFAUT
    filterset_fields = ["projet"]

    def get_queryset(self):
        return Phase.objects.filter(projet__in=project_queryset_for(self.request.user))

    @action(detail=False, methods=["post"], url_path="reorder", permission_classes=[EstEquipeInterne])
    def reorder(self, request):
        project_id = request.data.get("project_id") or request.query_params.get("project_id")
        if not project_id or not isinstance(request.data.get("order"), list):
            return Response({"detail": "project_id et order sont obligatoires."}, status=status.HTTP_400_BAD_REQUEST)
        apply_sort_order(self.get_queryset().filter(projet_id=project_id), request.data["order"])
        return Response({"ok": True})


class SousPhaseViewSet(viewsets.ModelViewSet):
    serializer_class = SousPhaseSerializer
    permission_classes = PERMISSIONS_PAR_DEFAUT
    filterset_fields = ["phase"]

    def get_queryset(self):
        return SousPhase.objects.filter(phase__projet__in=project_queryset_for(self.request.user))

    @action(detail=False, methods=["post"], url_path="reorder", permission_classes=[EstEquipeInterne])
    def reorder(self, request):
        phase_id = request.data.get("phase_id")
        if not phase_id or not isinstance(request.data.get("order"), list):
            return Response({"detail": "phase_id et order sont obligatoires."}, status=status.HTTP_400_BAD_REQUEST)
        apply_sort_order(self.get_queryset().filter(phase_id=phase_id), request.data["order"])
        return Response({"ok": True})


class TacheViewSet(viewsets.ModelViewSet):
    serializer_class = TacheSerializer
    permission_classes = PERMISSIONS_PAR_DEFAUT
    filterset_fields = ["sous_phase"]

    def get_queryset(self):
        return visible_tasks(active_project(self.request), self.request.user)

    @action(detail=False, methods=["post"], url_path="reorder", permission_classes=[EstEquipeInterne])
    def reorder(self, request):
        sous_phase_id = request.data.get("sous_phase_id")
        if not sous_phase_id or not isinstance(request.data.get("order"), list):
            return Response({"detail": "sous_phase_id et order sont obligatoires."}, status=status.HTTP_400_BAD_REQUEST)
        apply_sort_order(self.get_queryset().filter(sous_phase_id=sous_phase_id), request.data["order"])
        return Response({"ok": True})

    @action(detail=True, methods=["get"], url_path="detail-complete")
    def detail_complete(self, request, pk=None):
        """Detail complet d'une tache : historique des mises a jour et notes de progression."""
        tache = self.get_object()
        return Response(TacheDetailSerializer(tache, context={"request": request}).data)


class MiseAJourJournaliereViewSet(viewsets.ModelViewSet):
    serializer_class = MiseAJourJournaliereSerializer
    permission_classes = PERMISSIONS_PAR_DEFAUT
    filterset_fields = ["tache", "report_date"]

    def get_queryset(self):
        project = active_project(self.request)
        return MiseAJourJournaliere.objects.filter(tache__in=visible_tasks(project, self.request.user))

    def create(self, request, *args, **kwargs):
        update = save_daily_update(request, request.data)
        return Response(MiseAJourJournaliereSerializer(update).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        data = dict(request.data)
        data["task_id"] = instance.tache_id
        data["date"] = str(instance.report_date)
        update = save_daily_update(request, data)
        return Response(MiseAJourJournaliereSerializer(update).data)

    @action(detail=False, methods=["post"])
    def batch(self, request):
        """Accepte le contrat Laravel `{date, updates}` et le contrat historique `{items}`."""
        raw_items = request.data.get("items")
        if raw_items is None:
            batch_date = request.data.get("date")
            raw_items = [{**row, "date": batch_date} for row in request.data.get("updates", [])]
        if not isinstance(raw_items, list) or not raw_items:
            return Response(
                {"detail": "updates (ou items) doit contenir au moins une ligne."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        created, errors = [], []
        with transaction.atomic():
            for item in raw_items:
                try:
                    created.append(MiseAJourJournaliereSerializer(save_daily_update(request, item)).data)
                except Exception as exc:
                    errors.append({"data": item, "detail": message_erreur(exc)})
            if errors:
                transaction.set_rollback(True)
                return Response({"created": [], "errors": errors}, status=400)
        return Response({"created": created, "errors": []})

    @action(detail=False, methods=["get"])
    def daily(self, request):
        project = active_project(request)
        report_date = request.query_params.get("date") or str(timezone.localdate())
        items = []
        for task in visible_tasks(project, request.user):
            today = task.mises_a_jour.filter(report_date=report_date).first()
            latest = task.latest_daily_update()
            items.append(
                {
                    "task": TacheSerializer(task, context={"request": request}).data,
                    "daily_update": MiseAJourJournaliereSerializer(today).data if today else None,
                    "effective_progress": today.progress if today else (latest.progress if latest else 0),
                    "effective_status": today.status if today else (latest.status if latest else "non_demarre"),
                }
            )
        return Response({"date": report_date, "items": items})


class PhotoViewSet(viewsets.ModelViewSet):
    serializer_class = PhotoSerializer
    permission_classes = PERMISSIONS_PAR_DEFAUT
    filterset_fields = ["projet", "category"]

    def get_queryset(self):
        # Comme TacheViewSet, MiseAJourJournaliereViewSet et DashboardViewSet :
        # scope sur le projet actif resolu via l'en-tete `X-Project-Id` (cf.
        # `services.active_project`), pas sur l'ensemble des projets
        # accessibles a l'utilisateur. Sans ce filtre, `listerPhotos()` cote
        # frontend (qui ne passe que cet en-tete, jamais `?projet=`) renvoyait
        # les photos de TOUS les projets visibles par la personne — melangees,
        # et `bulk-delete` pouvait supprimer une photo d'un autre chantier des
        # lors que son id etait connu.
        return Photo.objects.filter(projet=active_project(self.request))

    def perform_create(self, serializer):
        photo_base64 = self.request.data.get("photo_base64")
        if photo_base64:
            processed = process_base64_photo(photo_base64, self.request.data.get("photo_name", "webcam_capture.jpg"))
            photo = serializer.save(
                projet=active_project(self.request),
                user_id=self.request.user.id,
                user_name=current_user_name(self.request.user),
                original_name=self.request.data.get("photo_name", "webcam_capture.jpg"),
                file=processed["processed_file"],
                file_size=processed["file_size"],
                taken_at=(processed["taken_at"].date() if processed["taken_at"] else timezone.localdate()),
            )
            log_activity(self.request, "photo.created", project=photo.projet, subject=photo)
            return

        upload = self.request.FILES.get("file")
        if not upload:
            raise ValidationError({"file": "Aucun fichier fourni (file ou photo_base64 requis)."})

        processed = process_uploaded_photo(upload, upload.name)
        photo = serializer.save(
            projet=active_project(self.request),
            user_id=self.request.user.id,
            user_name=current_user_name(self.request.user),
            original_name=upload.name,
            file=processed["processed_file"],
            file_size=processed["file_size"],
            taken_at=(processed["taken_at"].date() if processed["taken_at"] else timezone.localdate()),
        )
        log_activity(self.request, "photo.created", project=photo.projet, subject=photo)

    @action(detail=True, methods=["get"])
    def file(self, request, pk=None):
        photo = self.get_object()
        if not photo.file:
            return Response({"detail": "Aucun fichier associe."}, status=404)
        return FileResponse(photo.file.open("rb"), as_attachment=False)

    @action(detail=False, methods=["post"], url_path="bulk-delete", permission_classes=[EstEquipeInterne])
    def bulk_delete(self, request):
        qs = self.get_queryset().filter(id__in=request.data.get("ids", []))
        count = qs.count()
        qs.delete()
        return Response({"deleted": count})


class RapportViewSet(viewsets.ModelViewSet):
    serializer_class = RapportSerializer
    permission_classes = PERMISSIONS_PAR_DEFAUT
    filterset_fields = ["projet", "report_date"]

    def get_queryset(self):
        return Rapport.objects.filter(projet__in=project_queryset_for(self.request.user))

    @action(detail=False, methods=["post"], permission_classes=[EstEquipeInterne])
    def generate(self, request):
        project = active_project(request)
        report_date = request.data.get("report_date") or timezone.localdate()

        tasks = visible_tasks(project, request.user)
        total_tasks = tasks.count()
        done_tasks = tasks.filter(mises_a_jour__status="termine").distinct().count()
        in_progress_tasks = tasks.filter(mises_a_jour__status="en_cours").distinct().count()
        page_count = max(1, (total_tasks + 19) // 20)

        report = Rapport.objects.create(
            projet=project,
            user_id=request.user.id,
            user_name=current_user_name(request.user),
            report_date=report_date,
            temperature=request.data.get("temperature") or None,
            weather=request.data.get("weather", ""),
            notes=request.data.get("notes", ""),
            overall_progress=project.overall_progress(),
            page_number=f"1/{page_count}",
        )
        log_activity(request, "report.generated", project=project, subject=report)

        data = dashboard_data(project, request.user)
        return Response(
            {
                "report": RapportSerializer(report).data,
                "statistics": {
                    "total_tasks": total_tasks,
                    "done_tasks": done_tasks,
                    "in_progress_tasks": in_progress_tasks,
                    "overall_progress": project.overall_progress(),
                    "page_count": page_count,
                },
                "tasks": data["activities"][:50],
            },
            status=201,
        )

    @action(detail=True, methods=["get"])
    def pdf(self, request, pk=None):
        report = self.get_object()
        data = dashboard_data(report.projet, request.user)
        rows = [[r["phase"], r["subphase"], r["activity"], f"{r['progress']}%", r["status"]] for r in data["activities"]]
        return pdf_response(
            f"Rapport chantier - {report.projet.name}",
            ["Phase", "Sous-phase", "Activite", "Progression", "Statut"],
            rows,
            f"rapport-{report.report_date}",
        )


class DashboardViewSet(viewsets.ViewSet):
    """Tableau de bord et export du projet actif."""

    permission_classes = PERMISSIONS_PAR_DEFAUT

    def list(self, request):
        data = dashboard_data(active_project(request), request.user)
        data["charts"] = generate_charts_data(active_project(request), request.user)
        return Response(data)

    @action(detail=False, methods=["get"])
    def export(self, request):
        data = dashboard_data(active_project(request), request.user)
        rows = [[r["phase"], r["subphase"], r["activity"], r["progress"], r["status"]] for r in data["activities"]]
        return excel_response(
            f"Tableau de bord - {data['project']['name']}",
            ["Phase", "Sous-phase", "Activite", "Progression", "Statut"],
            rows,
            "dashboard-chantier",
        )

    @action(detail=False, methods=["get"])
    def charts(self, request):
        return Response(generate_charts_data(active_project(request), request.user))


class ActivityLogViewSet(viewsets.ViewSet):
    """Journal d'activite — reserve a l'equipe interne."""

    permission_classes = [EstEquipeInterne]

    def list(self, request):
        qs = ActivityLog.objects.all().order_by("-created_at", "-id")
        params = request.query_params
        if params.get("project_id"):
            qs = qs.filter(project_id=params["project_id"])
        if params.get("action"):
            qs = qs.filter(action=params["action"])
        if params.get("q"):
            qs = qs.filter(Q(description__icontains=params["q"]) | Q(user_name__icontains=params["q"]))
        if params.get("from"):
            qs = qs.filter(created_at__date__gte=params["from"])
        if params.get("to"):
            qs = qs.filter(created_at__date__lte=params["to"])
        try:
            per_page = min(100, max(10, int(params.get("per_page", 50))))
            page = max(1, int(params.get("page", 1)))
        except ValueError:
            return Response({"detail": "Pagination invalide."}, status=status.HTTP_400_BAD_REQUEST)

        total = qs.count()
        rows = qs[(page - 1) * per_page : page * per_page]
        return Response(
            {
                "logs": [
                    {
                        "id": row.id,
                        "action": row.action,
                        "description": row.description,
                        "user_name": row.user_name,
                        "project_id": row.project_id,
                        "ip_address": row.ip_address,
                        "created_at": row.created_at,
                    }
                    for row in rows
                ],
                "meta": {
                    "current_page": page,
                    "last_page": max(1, (total + per_page - 1) // per_page),
                    "per_page": per_page,
                    "total": total,
                },
                "filters": {
                    "actions": list(ActivityLog.objects.order_by("action").values_list("action", flat=True).distinct())
                },
            }
        )


class WeatherView(APIView):
    """Previsions Open-Meteo (sans cle), utilisees par le tableau de bord terrain."""

    permission_classes = PERMISSIONS_PAR_DEFAUT

    def get(self, request):
        endpoint = request.query_params.get("endpoint", "forecast")

        if endpoint == "geocode":
            city = request.query_params.get("city", "")
            if not city:
                return Response({"detail": "Le parametre city est requis."}, status=400)
            try:
                with urlopen(
                    f"https://geocoding-api.open-meteo.com/v1/search?{urlencode({'name': city, 'count': 5})}",
                    timeout=8,
                ) as reponse:
                    return Response({"results": json.loads(reponse.read().decode("utf-8")).get("results", [])})
            except Exception:
                return Response({"detail": "Service de geocodage indisponible."}, status=503)

        try:
            lat, lon = float(request.query_params["lat"]), float(request.query_params["lon"])
        except (KeyError, TypeError, ValueError):
            return Response({"detail": "Les parametres lat et lon sont requis."}, status=400)

        if endpoint == "nav":
            query = urlencode({"latitude": lat, "longitude": lon, "current": "temperature_2m,weather_code", "timezone": "auto"})
        else:
            query = urlencode(
                {
                    "latitude": lat,
                    "longitude": lon,
                    "current": "temperature_2m,weather_code",
                    "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
                    "timezone": "auto",
                    "forecast_days": 7,
                }
            )

        try:
            with urlopen(f"https://api.open-meteo.com/v1/forecast?{query}", timeout=8) as reponse:  # nosec B310 - URL constante
                return Response(json.loads(reponse.read().decode("utf-8")))
        except Exception:
            return Response({"detail": "Le service meteo est temporairement indisponible."}, status=503)
