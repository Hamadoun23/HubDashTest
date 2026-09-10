"""Importe les données d'un dump MySQL/MariaDB dans la base SQLite.

Le schéma SQLite est créé au préalable par les migrations Django (les noms de
tables/colonnes correspondent). On ne charge ici que les instructions INSERT,
en traduisant l'échappement MySQL vers des valeurs Python paramétrées.

Usage :
    python manage.py load_sql_dump [chemin/vers/dump.sql] [--flush]
"""
import re
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import connection

# Tables chargées, dans l'ordre des dépendances (FK désactivées de toute façon).
TABLES = [
    'auth_group',
    'auth_user',
    'auth_user_groups',
    'recolte_producteur',
    'recolte_cueillette',
    'appro_articlestock',
    'appro_reception',
    'appro_reception_articles',
    'fabrication_production',
    'emballage_conditionnement',
    'distribution_client',
    'distribution_vente',
    'distribution_commande',
    'distribution_facture',
    'distribution_paiement',
    'distribution_receptionpaiement',
    'emballage_bouteille',
    'entrepot_inventaire',
]

CREATE_RE = re.compile(r"CREATE TABLE `(\w+)` \((.*?)\n\) ENGINE", re.S)
INSERT_RE = re.compile(r"INSERT INTO `(\w+)` VALUES")

ESCAPES = {'n': '\n', 't': '\t', 'r': '\r', '0': '\0', 'b': '\b', 'Z': '\x1a'}


def parse_columns(content):
    """table -> liste ordonnée des colonnes, depuis les CREATE TABLE."""
    cols = {}
    for m in CREATE_RE.finditer(content):
        table, body = m.group(1), m.group(2)
        names = []
        for line in body.split('\n'):
            line = line.strip()
            if line.startswith('`'):
                names.append(line.split('`')[1])
        cols[table] = names
    return cols


def _parse_string(content, i):
    """Lit une chaîne quotée à partir de content[i] == \"'\". Retourne (valeur, index_apres)."""
    i += 1  # saute la quote ouvrante
    out = []
    n = len(content)
    while i < n:
        c = content[i]
        if c == '\\':
            nxt = content[i + 1]
            out.append(ESCAPES.get(nxt, nxt))
            i += 2
        elif c == "'":
            # '' = quote échappée à la MySQL
            if i + 1 < n and content[i + 1] == "'":
                out.append("'")
                i += 2
            else:
                return ''.join(out), i + 1
        else:
            out.append(c)
            i += 1
    return ''.join(out), i


def _to_scalar(token):
    token = token.strip()
    if token == 'NULL':
        return None
    try:
        return int(token)
    except ValueError:
        try:
            return float(token)
        except ValueError:
            return token


def parse_value_tuples(content, i):
    """Lit la liste de tuples après VALUES jusqu'au ';'. Retourne (rows, index)."""
    rows = []
    n = len(content)
    while i < n:
        while i < n and content[i] in ' \n\r\t':
            i += 1
        if i >= n or content[i] == ';':
            return rows, i + 1
        if content[i] == ',':
            i += 1
            continue
        assert content[i] == '(', f"attendu '(' à {i}: {content[i-5:i+5]!r}"
        i += 1
        row, field = [], []
        while i < n:
            c = content[i]
            if c == "'":
                val, i = _parse_string(content, i)
                row.append(val)
                field = None  # marque : valeur déjà ajoutée
            elif c == ',':
                if field is not None:
                    row.append(_to_scalar(''.join(field)))
                field = []
                i += 1
            elif c == ')':
                if field is not None:
                    row.append(_to_scalar(''.join(field)))
                i += 1
                break
            else:
                if field is None:
                    field = []  # ne devrait pas arriver après une chaîne
                field.append(c)
                i += 1
        rows.append(row)
    return rows, i


def parse_inserts(content):
    """table -> liste de rows (listes de valeurs)."""
    data = {}
    for m in INSERT_RE.finditer(content):
        table = m.group(1)
        rows, _ = parse_value_tuples(content, m.end())
        data.setdefault(table, []).extend(rows)
    return data


class Command(BaseCommand):
    help = "Charge les données d'un dump MySQL/MariaDB dans SQLite."

    def add_arguments(self, parser):
        parser.add_argument('dump', nargs='?', default=None)
        parser.add_argument('--flush', action='store_true',
                            help='Vide les tables avant import.')

    def handle(self, *args, **opts):
        dump_path = opts['dump']
        if not dump_path:
            # Par défaut : le backup à la racine du projet (deux niveaux au-dessus).
            base = Path(__file__).resolve().parents[4]
            matches = sorted(base.glob('jusorange_backup_*.sql'))
            if not matches:
                raise CommandError("Aucun fichier dump trouvé. Précisez le chemin.")
            dump_path = str(matches[-1])

        self.stdout.write(f"Lecture du dump : {dump_path}")
        content = Path(dump_path).read_text(encoding='utf-8', errors='replace')

        columns = parse_columns(content)
        inserts = parse_inserts(content)

        with connection.cursor() as cur:
            cur.execute('PRAGMA foreign_keys = OFF;')
            if opts['flush']:
                for table in reversed(TABLES):
                    cur.execute(f'DELETE FROM "{table}";')
                self.stdout.write(self.style.WARNING("Tables vidées."))

            total = 0
            for table in TABLES:
                cols = columns.get(table)
                rows = inserts.get(table)
                if not cols or not rows:
                    self.stdout.write(f"  - {table}: (aucune donnée)")
                    continue

                # Colonnes réellement présentes dans le schéma SQLite migré.
                cur.execute(f'PRAGMA table_info("{table}")')
                sqlite_cols = {r[1] for r in cur.fetchall()}
                keep = [(idx, c) for idx, c in enumerate(cols) if c in sqlite_cols]
                skipped = [c for c in cols if c not in sqlite_cols]
                kept_cols = [c for _, c in keep]
                kept_idx = [idx for idx, _ in keep]

                filtered = [[row[i] for i in kept_idx] for row in rows]
                col_list = ', '.join(f'"{c}"' for c in kept_cols)
                placeholders = ', '.join('?' for _ in kept_cols)
                sql = f'INSERT OR REPLACE INTO "{table}" ({col_list}) VALUES ({placeholders})'
                cur.executemany(sql, filtered)
                total += len(filtered)
                note = f" (colonnes ignorées : {', '.join(skipped)})" if skipped else ""
                self.stdout.write(self.style.SUCCESS(f"  - {table}: {len(filtered)} lignes{note}"))

            cur.execute('PRAGMA foreign_keys = ON;')

        self.stdout.write(self.style.SUCCESS(f"\nImport terminé : {total} lignes chargées."))
