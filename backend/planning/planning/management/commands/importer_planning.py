"""Reprise des données de Planning (Laravel, export phpMyAdmin) dans le service Planning.

    python manage.py importer_planning /chemin/gdamali_planning_bd.sql [--oui]

**Destructif** : clients, idées de contenu, tournages, publications, règles et
rapports existants sont remplacés par ceux de l'export. Les identifiants
d'origine sont conservés : les comptes clients du hub, rattachés par
l'identifiant de leur client (`identifiant_local`), restent valables.

Les fichiers des rapports clients ne sont pas dans l'export : seul leur chemin
suit ; les fichiers déjà présents dans le volume média restent lisibles.
"""
from datetime import datetime, timezone as tz

from django.core.management.base import BaseCommand, CommandError
from django.core.management.color import no_style
from django.db import connection, transaction

from planning.dump_mysql import lire_tables
from planning.models import ClientPlanning, ClientReport, ContentIdea, Publication, PublicationRule, Shooting

MODELES = [ClientPlanning, ContentIdea, Shooting, Publication, PublicationRule, ClientReport]


def _date_heure(valeur):
    if not valeur:
        return None
    texte = str(valeur)
    if texte.startswith("0000"):
        return None
    return datetime.strptime(texte, "%Y-%m-%d %H:%M:%S").replace(tzinfo=tz.utc)


class Command(BaseCommand):
    help = "Remplace les données Planning par un export SQL de l'application Planning (Laravel)."

    def add_arguments(self, parser):
        parser.add_argument("fichier")
        parser.add_argument("--oui", action="store_true", help="Ne pas demander de confirmation.")

    def handle(self, fichier, oui, **options):
        tables = lire_tables(fichier)
        if "clients" not in tables or "publications" not in tables:
            raise CommandError("Ce fichier ne ressemble pas à un export de Planning.")
        existants = ClientPlanning.objects.count()
        if existants and not oui:
            reponse = input(f"{existants} client(s) existant(s) seront remplacés. Continuer ? [oui/non] ")
            if reponse.strip().lower() != "oui":
                raise CommandError("Import annulé.")

        # Les dates d'origine priment : les champs « auto_now » sont suspendus.
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
                compte = self._importer(tables)
                with connection.cursor() as curseur:
                    for requete in connection.ops.sequence_reset_sql(no_style(), MODELES):
                        curseur.execute(requete)
        finally:
            for champ, auto_now, auto_now_add in automatiques:
                champ.auto_now, champ.auto_now_add = auto_now, auto_now_add

        for nom, n in compte.items():
            self.stdout.write(f"  {nom} : {n}")
        self.stdout.write(self.style.SUCCESS("Import terminé."))

    def _importer(self, tables):
        ClientPlanning.objects.bulk_create(
            ClientPlanning(id=r["id"], nom_entreprise=r["nom_entreprise"], created_at=_date_heure(r.get("created_at")))
            for r in tables["clients"]
        )
        ContentIdea.objects.bulk_create(
            ContentIdea(id=r["id"], titre=r["titre"], type=r.get("type") or "post", created_at=_date_heure(r.get("created_at")))
            for r in tables.get("content_ideas", [])
        )
        Shooting.objects.bulk_create(
            Shooting(
                id=r["id"], client_id=r["client_id"], date=_date_heure(r["date"]), status=r.get("status") or "pending",
                status_reason=r.get("status_reason"), description=r.get("description"), created_at=_date_heure(r.get("created_at")),
            )
            for r in tables.get("shootings", [])
        )
        lien = Shooting.content_ideas.through
        lien.objects.bulk_create(
            lien(shooting_id=r["shooting_id"], contentidea_id=r["content_idea_id"])
            for r in tables.get("content_idea_shooting", [])
        )
        Publication.objects.bulk_create(
            Publication(
                id=r["id"], client_id=r["client_id"], date=_date_heure(r["date"]), content_idea_id=r.get("content_idea_id"),
                shooting_id=r.get("shooting_id"), status=r.get("status") or "pending", status_reason=r.get("status_reason"),
                description=r.get("description"), created_at=_date_heure(r.get("created_at")),
            )
            for r in tables["publications"]
        )
        PublicationRule.objects.bulk_create(
            PublicationRule(id=r["id"], client_id=r["client_id"], day_of_week=r["day_of_week"])
            for r in tables.get("publication_rules", [])
        )
        ClientReport.objects.bulk_create(
            ClientReport(
                id=r["id"], client_id=r["client_id"], report_type=r["report_type"], report_date=r["report_date"],
                file=r.get("file_path") or "", original_filename=r.get("original_filename") or "",
                file_size=r.get("file_size") or 0, uploaded_at=_date_heure(r.get("uploaded_at") or r.get("created_at")),
            )
            for r in tables.get("client_reports", [])
        )
        resultat = {m.__name__: m.objects.count() for m in MODELES}
        resultat["liens tournage-idée"] = lien.objects.count()
        return resultat
