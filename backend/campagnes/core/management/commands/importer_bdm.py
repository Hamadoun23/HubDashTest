"""Reprise d'un export MySQL de BDM (bdm.gdamali.net) dans Campagnes (Postgres).

    python manage.py importer_bdm /chemin/bdm_prod_AAAA-MM-JJ.sql [--oui]

**Destructif** : les tables métier de Campagnes sont vidées puis remplies
avec l'export. Le schéma est le même des deux côtés (hérité de Laravel,
mêmes tables, mêmes colonnes) : seules les colonnes communes sont reprises,
et les types propres à MySQL sont convertis (booléens 0/1, dates « zéro »).
Les tables techniques (sessions, cache, migrations, django_*, auth_*) ne sont
pas touchées. Les mots de passe bcrypt restent valides.
"""
from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction

from core.dump_mysql import lire_tables

IGNOREES = {"cache", "cache_locks", "failed_jobs", "job_batches", "jobs", "migrations", "password_reset_tokens", "sessions"}
LOT = 500


def _convertir(valeur, type_pg):
    if valeur is None:
        return None
    if type_pg == "bool":
        return valeur if isinstance(valeur, bool) else bool(int(valeur))
    if type_pg in ("timestamp", "timestamptz", "date") and str(valeur).startswith("0000-00-00"):
        return None
    return valeur


class Command(BaseCommand):
    help = "Remplace les données de Campagnes par un export MySQL de BDM."

    def add_arguments(self, parser):
        parser.add_argument("fichier")
        parser.add_argument("--oui", action="store_true", help="Ne pas demander de confirmation.")

    def handle(self, fichier, oui, **options):
        tables = lire_tables(fichier)
        if "users" not in tables or "campagnes" not in tables:
            raise CommandError("Ce fichier ne ressemble pas à un export de BDM.")
        with connection.cursor() as c:
            c.execute(
                "select table_name, column_name, udt_name from information_schema.columns where table_schema='public'"
            )
            schema = {}
            for table, colonne, udt in c.fetchall():
                schema.setdefault(table, {})[colonne] = udt
        metier = [t for t in schema if not t.startswith(("django_", "auth_"))]
        cibles = [t for t in tables if t in metier and t not in IGNOREES]
        if not oui:
            reponse = input(f"{len(metier)} tables de Campagnes seront remplacées. Continuer ? [oui/non] ")
            if reponse.strip().lower() != "oui":
                raise CommandError("Import annulé.")

        compte = {}
        with transaction.atomic(), connection.cursor() as c:
            # Les clés étrangères Django sont différables : l'ordre des tables
            # importe peu tant que tout est dans la même transaction.
            c.execute("SET CONSTRAINTS ALL DEFERRED")
            c.execute("TRUNCATE " + ", ".join(f'"{t}"' for t in metier) + " RESTART IDENTITY CASCADE")
            for table in cibles:
                lignes = tables[table]
                if not lignes:
                    continue
                colonnes = [col for col in lignes[0] if col in schema[table]]
                types = [schema[table][col] for col in colonnes]
                sql = 'INSERT INTO "{}" ({}) VALUES ({})'.format(
                    table,
                    ", ".join(f'"{col}"' for col in colonnes),
                    ", ".join(f"%s::{t}" for t in types),
                )
                valeurs = [[_convertir(l.get(col), t) for col, t in zip(colonnes, types)] for l in lignes]
                for i in range(0, len(valeurs), LOT):
                    c.executemany(sql, valeurs[i : i + LOT])
                compte[table] = len(valeurs)
                if "id" in schema[table]:
                    c.execute(
                        f"SELECT setval(pg_get_serial_sequence('\"{table}\"', 'id'), "
                        f"COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM \"{table}\""
                    )
        for table, n in sorted(compte.items()):
            self.stdout.write(f"  {table} : {n}")
        self.stdout.write(self.style.SUCCESS("Import terminé."))
