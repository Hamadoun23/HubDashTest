"""Reprise des données de daily.gdamali.net (Laravel) dans Chantiers.

    python manage.py importer_daily /chemin/gdamali_daily.sql [--oui]

**Destructif** : toutes les données Chantiers existantes sont remplacées par
celles de l'export (projets, phases, tâches, saisies, photos, rapports,
journal). Les identifiants d'origine sont conservés.

Ce qui ne peut pas suivre :
- les comptes : Chantiers identifie ses utilisateurs par leur compte du hub.
  Le nom de l'auteur Laravel est gardé (`user_name`), l'identifiant non ; un
  administrateur rattache ensuite les comptes du hub aux projets ;
- les fichiers photos : l'export ne contient que leurs chemins. Les copier
  dans le volume média (`photos/…`) pour qu'elles s'affichent.
"""
from datetime import datetime, timezone as tz

from django.core.management.base import BaseCommand, CommandError
from django.core.management.color import no_style
from django.db import connection, transaction

from chantiers.dump_mysql import lire_tables
from chantiers.models import (
    ActivityLog,
    MiseAJourJournaliere,
    Phase,
    Photo,
    Project,
    Rapport,
    SousPhase,
    Tache,
    TaskProgressNote,
)

MODELES = [Project, Phase, SousPhase, Tache, MiseAJourJournaliere, TaskProgressNote, Photo, Rapport, ActivityLog]


def _date_heure(valeur):
    if not valeur:
        return None
    return datetime.strptime(str(valeur), "%Y-%m-%d %H:%M:%S").replace(tzinfo=tz.utc)


def _texte(valeur):
    return "" if valeur is None else str(valeur)


class Command(BaseCommand):
    help = "Remplace les données Chantiers par un export SQL de daily.gdamali.net."

    def add_arguments(self, parser):
        parser.add_argument("fichier")
        parser.add_argument("--oui", action="store_true", help="Ne pas demander de confirmation.")

    def handle(self, fichier, oui, **options):
        tables = lire_tables(fichier)
        if "projects" not in tables:
            raise CommandError("Ce fichier ne ressemble pas à un export de daily.gdamali.net.")
        existants = Project.objects.count()
        if existants and not oui:
            reponse = input(f"{existants} projet(s) existant(s) seront remplacés. Continuer ? [oui/non] ")
            if reponse.strip().lower() != "oui":
                raise CommandError("Import annulé.")

        noms = {u["id"]: (u.get("name") or u.get("username") or "")[:200] for u in tables.get("users", [])}
        membres = {}
        for pu in tables.get("project_user", []):
            membres.setdefault(pu["project_id"], []).append(pu["user_id"])

        # Les dates d'origine priment : les champs « auto_now » sont
        # suspendus le temps de l'import.
        automatiques = []
        for modele in MODELES:
            for champ in modele._meta.fields:
                if getattr(champ, "auto_now", False) or getattr(champ, "auto_now_add", False):
                    automatiques.append((champ, champ.auto_now, champ.auto_now_add))
                    champ.auto_now = champ.auto_now_add = False
        try:
            with transaction.atomic():
                for modele in reversed(MODELES):
                    modele.objects.all().delete()
                compte = self._importer(tables, noms, membres)
                with connection.cursor() as curseur:
                    for requete in connection.ops.sequence_reset_sql(no_style(), MODELES):
                        curseur.execute(requete)
        finally:
            for champ, auto_now, auto_now_add in automatiques:
                champ.auto_now, champ.auto_now_add = auto_now, auto_now_add

        for nom, n in compte.items():
            self.stdout.write(f"  {nom} : {n}")
        self.stdout.write(self.style.SUCCESS("Import terminé."))

    def _importer(self, tables, noms, membres):
        Project.objects.bulk_create(
            Project(
                id=p["id"], name=p["name"], name_fr=p["name"], description=_texte(p.get("description")),
                description_fr=_texte(p.get("description")), client=_texte(p.get("client")), client_fr=_texte(p.get("client")),
                start_date=p.get("start_date"), end_date=p.get("end_date"), status=p.get("status") or "planifie",
                sort_order=p.get("sort_order") or 0,
                user_ids=[],
                user_names={str(uid): noms.get(uid, "") for uid in membres.get(p["id"], [])},
                created_at=_date_heure(p.get("created_at")), updated_at=_date_heure(p.get("updated_at")),
            )
            for p in tables["projects"]
        )
        Phase.objects.bulk_create(
            Phase(id=r["id"], projet_id=r["project_id"], name=r["name"], name_fr=r["name"],
                  sort_order=r.get("sort_order") or 0, hidden_from_partner=bool(r.get("hidden_from_partner")))
            for r in tables.get("phases", [])
        )
        SousPhase.objects.bulk_create(
            SousPhase(id=r["id"], phase_id=r["phase_id"], name=r["name"], name_fr=r["name"],
                      sort_order=r.get("sort_order") or 0, hidden_from_partner=bool(r.get("hidden_from_partner")))
            for r in tables.get("sub_phases", [])
        )
        Tache.objects.bulk_create(
            Tache(id=r["id"], sous_phase_id=r["sub_phase_id"], activity=r["activity"], activity_fr=r["activity"],
                  start_day=r.get("start_day") or 1, duration_days=r.get("duration_days") or 1,
                  sort_order=r.get("sort_order") or 0, hidden_from_partner=bool(r.get("hidden_from_partner")))
            for r in tables.get("tasks", [])
        )
        MiseAJourJournaliere.objects.bulk_create(
            MiseAJourJournaliere(
                id=r["id"], tache_id=r["task_id"], user_id=None, user_name=noms.get(r.get("user_id"), ""),
                report_date=r["report_date"], progress=r.get("progress") or 0, status=r.get("status") or "non_demarre",
                comment=_texte(r.get("comment")), comment_fr=_texte(r.get("comment")),
                created_at=_date_heure(r.get("created_at")), updated_at=_date_heure(r.get("updated_at")),
            )
            for r in tables.get("daily_updates", [])
        )
        TaskProgressNote.objects.bulk_create(
            TaskProgressNote(
                id=r["id"], tache_id=r["task_id"], user_id=None, user_name=noms.get(r.get("user_id"), ""),
                daily_update_id=r.get("daily_update_id"), progress=r.get("progress") or 0,
                previous_progress=r.get("previous_progress") or 0, body=_texte(r.get("body")), body_fr=_texte(r.get("body")),
                created_at=_date_heure(r.get("created_at")),
            )
            for r in tables.get("task_progress_notes", [])
        )
        Photo.objects.bulk_create(
            Photo(
                id=r["id"], projet_id=r["project_id"], user_id=None, user_name=noms.get(r.get("user_id"), ""),
                category=r.get("category") or "pendant", file=r.get("path") or "", original_name=_texte(r.get("original_name")),
                caption=_texte(r.get("caption")), caption_fr=_texte(r.get("caption")), taken_at=r.get("taken_at"),
                file_size=r.get("file_size") or 0, created_at=_date_heure(r.get("created_at")),
            )
            for r in tables.get("photos", [])
        )
        Rapport.objects.bulk_create(
            Rapport(
                id=r["id"], projet_id=r["project_id"], user_id=None, user_name=noms.get(r.get("user_id"), ""),
                report_date=r["report_date"], temperature=(str(r["temperature"]) if r.get("temperature") is not None else None),
                weather=_texte(r.get("weather")), weather_fr=_texte(r.get("weather")), page_number=_texte(r.get("page_number")),
                overall_progress=r.get("overall_progress") or 0, notes=_texte(r.get("notes")), notes_fr=_texte(r.get("notes")),
                generated_at=_date_heure(r.get("generated_at") or r.get("created_at")),
            )
            for r in tables.get("reports", [])
        )
        ActivityLog.objects.bulk_create(
            ActivityLog(
                id=r["id"], user_id=None, user_name=noms.get(r.get("user_id"), ""), action=_texte(r.get("action")),
                action_fr=_texte(r.get("action")), subject_type=_texte(r.get("subject_type")), subject_id=r.get("subject_id"),
                project_id=r.get("project_id"), description=_texte(r.get("description")), description_fr=_texte(r.get("description")),
                properties=_properties(r.get("properties")), ip_address=r.get("ip_address"), user_agent=_texte(r.get("user_agent")),
                created_at=_date_heure(r.get("created_at")),
            )
            for r in tables.get("activity_logs", [])
        )
        return {m._meta.verbose_name_plural or m.__name__: m.objects.count() for m in MODELES}


def _properties(brut):
    import json

    if not brut:
        return {}
    try:
        return json.loads(brut)
    except (TypeError, ValueError):
        return {"brut": str(brut)[:1000]}
