"""Regles metier du service Chantiers, partagees par les vues.

Toute decision d'acces repose sur `request.user`, une instance de
`hub.UtilisateurHub` construite a partir du jeton du hub — jamais sur une
table de comptes locale, qui n'existe pas ici (cf. hub.py).
"""
import base64
import io
import uuid
from collections import Counter
from datetime import datetime
from io import BytesIO

from django.core.files.base import ContentFile
from django.db import transaction
from django.db.models import QuerySet
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from .models import ActivityLog, MiseAJourJournaliere, Project, Tache, TaskProgressNote


def process_uploaded_photo(uploaded_file, original_filename: str = ""):
    """Redimensionne (max 1920px), extrait la date EXIF, compresse en JPEG 85%."""
    try:
        from PIL import ExifTags, Image
    except ImportError as erreur:
        raise ValidationError({"file": "Pillow n'est pas installe."}) from erreur

    try:
        image = Image.open(uploaded_file)

        taken_at = None
        try:
            exif_data = image.getexif()
            if exif_data:
                for tag_id, value in exif_data.items():
                    if ExifTags.TAGS.get(tag_id, tag_id) == "DateTimeOriginal":
                        try:
                            taken_at = timezone.make_aware(
                                datetime.strptime(value, "%Y:%m:%d %H:%M:%S")
                            )
                        except ValueError:
                            pass
                        break
        except Exception:
            pass

        if image.width > 1920 or image.height > 1920:
            if image.width > image.height:
                new_width, new_height = 1920, int(image.height * (1920 / image.width))
            else:
                new_height, new_width = 1920, int(image.width * (1920 / image.height))
            image = image.resize((new_width, new_height), Image.Resampling.LANCZOS)

        if image.mode not in ("RGB", "L"):
            image = image.convert("RGB")

        output = io.BytesIO()
        image.save(output, format="JPEG", quality=85, optimize=True)
        file_size = len(output.getvalue())
        output.seek(0)
        filename = f"{uuid.uuid4()}.jpg"
        processed_file = ContentFile(output.read(), name=filename)

        return {"processed_file": processed_file, "taken_at": taken_at, "file_size": file_size}
    except ValidationError:
        raise
    except Exception as erreur:
        raise ValidationError({"file": f"Erreur lors du traitement de l'image : {erreur}"}) from erreur


def process_base64_photo(photo_base64: str, photo_name: str = ""):
    """Decode une photo base64 (capture webcam) puis la traite normalement."""
    try:
        format_part, imgstr = photo_base64.split(";base64,")
        ext = format_part.split("/")[-1]
        data = base64.b64decode(imgstr)
        temp_file = BytesIO(data)
        temp_file.name = photo_name or f"webcam_capture.{ext}"
        return process_uploaded_photo(temp_file, temp_file.name)
    except ValidationError:
        raise
    except Exception as erreur:
        raise ValidationError({"photo_base64": f"Format base64 invalide : {erreur}"}) from erreur


def project_queryset_for(user) -> "QuerySet[Project]":
    """Les projets qu'une personne peut voir.

    L'equipe interne voit tout. Un partenaire ne voit que les projets dont
    son identifiant figure dans `Project.user_ids` — une liste d'entiers,
    puisque ce service n'a pas de relation Django vers un modele utilisateur
    (cf. models.py).
    """
    if user.est_interne:
        return Project.objects.all()
    return Project.objects.filter(user_ids__contains=[user.id])


def active_project(request) -> Project:
    raw = request.headers.get("X-Project-Id") or request.query_params.get("project_id")
    qs = project_queryset_for(request.user).order_by("sort_order", "id")
    project = qs.filter(pk=raw).first() if raw else qs.first()
    if not project:
        raise PermissionDenied("Aucun projet accessible pour cet utilisateur.")
    return project


def assert_project_access(user, project: Project) -> None:
    if user.est_interne:
        return
    if user.id not in (project.user_ids or []):
        raise PermissionDenied("Acces non autorise a ce projet.")


def visible_tasks(project: Project, user) -> "QuerySet[Tache]":
    qs = Tache.objects.filter(sous_phase__phase__projet=project).select_related("sous_phase__phase")
    if user.est_partenaire:
        qs = qs.filter(
            hidden_from_partner=False,
            sous_phase__hidden_from_partner=False,
            sous_phase__phase__hidden_from_partner=False,
        )
    return qs


def current_user_name(user) -> str:
    return (user.nom_complet or user.identifiant or "")[:200]


def log_activity(request, action: str, *, project=None, subject=None, description="", properties=None) -> None:
    user = getattr(request, "user", None)
    ActivityLog.objects.create(
        user_id=getattr(user, "id", None),
        user_name=current_user_name(user) if user else "",
        action=action,
        project_id=getattr(project, "id", None),
        subject_type=subject.__class__.__name__ if subject else "",
        subject_id=getattr(subject, "id", None),
        description=description,
        properties=properties or {},
        ip_address=request.META.get("REMOTE_ADDR"),
        user_agent=(request.META.get("HTTP_USER_AGENT") or "")[:500],
    )


def save_daily_update(request, data: dict) -> MiseAJourJournaliere:
    """Enregistre une mise a jour journaliere.

    Port fidele de `App\\Support\\TaskProgressRecorder` (Laravel) :

    - un commentaire est obligatoire pour un statut « annule » ;
    - **seule l'equipe interne** doit justifier une avancee de progression
      (une note obligatoire), et seulement quand le statut n'est pas
      « annule ». Un partenaire ne peut de toute facon jamais ecrire ici
      (cf. `permissions.LectureSeulePourPartenaire`), donc ce garde-fou vise
      en pratique le personnel qui saisit une correction plutot qu'un
      releve du jour.
    - **seule l'equipe interne** peut purger l'historique de justification
      en remettant la progression a zero. Le code repris du stagiaire
      faisait cette purge sans aucun controle de role — n'importe quel
      compte authentifie pouvait donc effacer l'historique d'une tache.
    """
    project = active_project(request)
    user = request.user
    task_id = data.get("task_id") or data.get("tache")
    report_date = data.get("date") or data.get("report_date") or timezone.localdate()

    task = visible_tasks(project, user).filter(pk=task_id).first()
    if not task:
        raise ValidationError({"task_id": "Tache introuvable dans le projet actif."})

    progress = int(data["progress"])
    if not 0 <= progress <= 100:
        raise ValidationError({"progress": "La progression doit etre comprise entre 0 et 100."})

    status = data.get("status") or MiseAJourJournaliere.status_from_progress(progress)
    comment = (data.get("comment") or "").strip()
    if status == "annule" and not comment:
        raise ValidationError({"comment": "Un commentaire est obligatoire pour une tache annulee."})

    # La progression de reference AVANT cet appel : celle du jour si une
    # entree existe deja pour cette date, sinon la derniere connue.
    #
    # Calculee avant toute ecriture, et non a partir de la ligne qu'on vient
    # de creer ou modifier : une premiere tentative refusee pour justification
    # manquante ecrivait quand meme la nouvelle progression en base (le
    # `get_or_create` s'execute avant que l'erreur ne soit levee). La
    # tentative suivante, pourtant munie de sa justification, ne voyait alors
    # plus aucune avancee a justifier — puisque la valeur « avant » qu'elle
    # lisait etait deja celle, non validee, laissee par l'echec precedent.
    existant = task.mises_a_jour.filter(report_date=report_date).first()
    if existant:
        previous_progress = existant.progress
    else:
        dernier = task.mises_a_jour.order_by("-report_date", "-id").first()
        previous_progress = dernier.progress if dernier else 0

    note = (data.get("progress_note") or "").strip()
    avancee_a_justifier = user.est_interne and status != "annule" and progress > previous_progress
    if avancee_a_justifier and not note:
        raise ValidationError(
            {"progress_note": "Une description est obligatoire pour justifier l'avancement."}
        )

    # Rien n'est ecrit avant ce point : une erreur de validation ci-dessus ne
    # laisse donc aucune trace partielle en base.
    with transaction.atomic():
        update, created = MiseAJourJournaliere.objects.update_or_create(
            tache=task,
            report_date=report_date,
            defaults={
                "user_id": user.id,
                "user_name": current_user_name(user),
                "progress": progress,
                "status": status,
                "comment": comment,
            },
        )

        if avancee_a_justifier:
            TaskProgressNote.objects.create(
                tache=task,
                user_id=user.id,
                user_name=current_user_name(user),
                daily_update_id=update.id,
                progress=progress,
                previous_progress=previous_progress,
                body=note,
            )

        if user.est_interne and progress == 0:
            task.progress_notes.all().delete()

    log_activity(
        request,
        "daily_update.created" if created else "daily_update.updated",
        project=project,
        subject=update,
    )
    return update


def dashboard_data(project: Project, user) -> dict:
    tasks = list(visible_tasks(project, user).prefetch_related("mises_a_jour"))
    rows, statuses = [], Counter()
    phase_rows = {}
    recent = []
    for task in tasks:
        latest = task.latest_daily_update()
        progress = latest.progress if latest else 0
        status = latest.status if latest else "non_demarre"
        statuses[status] += 1
        key = task.sous_phase.phase.name
        phase_rows.setdefault(key, []).append(progress)
        rows.append(
            {
                "id": task.id,
                "phase": key,
                "subphase": task.sous_phase.name,
                "activity": task.activity,
                "progress": progress,
                "status": status,
            }
        )
        if latest:
            recent.append(
                {
                    "task_id": task.id,
                    "task_name": task.activity,
                    "progress": progress,
                    "status": status,
                    "comment": latest.comment,
                    "date": latest.report_date,
                    "user": latest.user_name,
                }
            )
    overall = round(sum(r["progress"] for r in rows) / len(rows)) if rows else 0
    phases = [
        {"phase": name, "progress": round(sum(values) / len(values)), "task_count": len(values)}
        for name, values in phase_rows.items()
    ]
    return {
        "project": {"id": project.id, "name": project.name, "client": project.client},
        "overall_progress": overall,
        "stats": {
            "total": len(tasks),
            "done": statuses["termine"],
            "in_progress": statuses["en_cours"],
            "not_started": statuses["non_demarre"],
            "cancelled": statuses["annule"],
        },
        "status_counts": dict(statuses),
        "progress_by_phase": phases,
        "activities": rows,
        "recent_activity": sorted(recent, key=lambda x: str(x["date"]), reverse=True)[:20],
    }


def generate_charts_data(project: Project, user) -> dict:
    """Donnees pour les graphiques du tableau de bord."""
    tasks = list(visible_tasks(project, user).prefetch_related("mises_a_jour", "sous_phase__phase"))

    status_counts = Counter()
    phase_progress = {}
    subphase_progress = {}
    activities_data = []

    for task in tasks:
        latest = task.latest_daily_update()
        progress = latest.progress if latest else 0
        status = latest.status if latest else "non_demarre"
        status_counts[status] += 1

        phase_name = task.sous_phase.phase.name
        phase_progress.setdefault(phase_name, []).append(progress)

        subphase_name = f"{phase_name} - {task.sous_phase.name}"
        subphase_progress.setdefault(subphase_name, []).append(progress)

        activities_data.append(
            {
                "activity": task.activity,
                "phase": phase_name,
                "subphase": task.sous_phase.name,
                "progress": progress,
                "status": status,
                "start_day": task.start_day,
                "duration_days": task.duration_days,
            }
        )

    progress_by_phase = [
        {"phase": phase, "progress": round(sum(values) / len(values)), "task_count": len(values)}
        for phase, values in phase_progress.items()
    ]
    progress_by_subphase = [
        {"subphase": subphase, "progress": round(sum(values) / len(values)), "task_count": len(values)}
        for subphase, values in subphase_progress.items()
    ]
    activities_chart = sorted(activities_data, key=lambda x: x["progress"], reverse=True)[:20]

    return {
        "status_counts": dict(status_counts),
        "progress_by_phase": progress_by_phase,
        "progress_by_subphase": progress_by_subphase,
        "activities_chart": activities_chart,
    }
