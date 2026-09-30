"""Lecture d'un export SQL phpMyAdmin/mysqldump, sans serveur MySQL.

Les anciennes applications (Laravel, MariaDB) exportent leurs données sous
forme d'instructions `INSERT INTO `table` (`col`, …) VALUES (…), (…);`. Ce
module les relit en Python pur : chaînes entre apostrophes avec échappements
MySQL, NULL, nombres. Il ne fait rien d'autre — le schéma d'arrivée n'est pas
le même, la correspondance se fait dans la commande d'import.
"""
import re

# La liste des colonnes est facultative : mysqldump l'omet, phpMyAdmin l'écrit.
_ENTETE = re.compile(r"INSERT INTO `(\w+)`\s*(?:\(([^)]*)\))?\s*VALUES\s*", re.S)
_CREATE = re.compile(r"CREATE TABLE `(\w+)` \((.*?)\n\)", re.S)
_ECHAPPEMENTS = {"0": "\0", "b": "\b", "n": "\n", "r": "\r", "t": "\t", "Z": "\x1a", "\\": "\\", "'": "'", '"': '"'}


def _valeurs(texte, i):
    """Lit les tuples à partir de `i` jusqu'au « ; » final. Renvoie (lignes, fin)."""
    lignes, n = [], len(texte)
    while i < n:
        while texte[i] in " \n\r\t,":
            i += 1
        if texte[i] == ";":
            return lignes, i + 1
        assert texte[i] == "(", f"tuple attendu à la position {i}"
        i += 1
        ligne = []
        while True:
            while texte[i] in " \n\r\t":
                i += 1
            c = texte[i]
            if c == "'":
                i += 1
                morceaux = []
                while True:
                    c = texte[i]
                    if c == "\\":
                        morceaux.append(_ECHAPPEMENTS.get(texte[i + 1], texte[i + 1]))
                        i += 2
                    elif c == "'":
                        if texte[i + 1] == "'":  # '' = apostrophe
                            morceaux.append("'")
                            i += 2
                        else:
                            i += 1
                            break
                    else:
                        morceaux.append(c)
                        i += 1
                ligne.append("".join(morceaux))
            else:
                debut = i
                while texte[i] not in ",)":
                    i += 1
                brut = texte[debut:i].strip()
                if brut.upper() == "NULL":
                    ligne.append(None)
                else:
                    try:
                        ligne.append(int(brut))
                    except ValueError:
                        ligne.append(float(brut))
            while texte[i] in " \n\r\t":
                i += 1
            if texte[i] == ",":
                i += 1
                continue
            assert texte[i] == ")", f"« ) » attendue à la position {i}"
            i += 1
            lignes.append(ligne)
            break
    return lignes, i


def lire_tables(chemin):
    """{table: [ {colonne: valeur}, … ]} pour toutes les tables de l'export."""
    texte = open(chemin, encoding="utf-8").read()
    # Ordre des colonnes de chaque table, pour les INSERT qui ne le répètent pas.
    declarees = {
        m.group(1): [l.strip().split()[0].strip("`") for l in m.group(2).split("\n") if l.strip().startswith("`")]
        for m in _CREATE.finditer(texte)
    }
    tables = {}
    position = 0
    while True:
        m = _ENTETE.search(texte, position)
        if not m:
            return tables
        colonnes = (
            [c.strip().strip("`") for c in m.group(2).split(",")] if m.group(2) else declarees.get(m.group(1), [])
        )
        lignes, position = _valeurs(texte, m.end())
        tables.setdefault(m.group(1), []).extend(dict(zip(colonnes, l)) for l in lignes)
