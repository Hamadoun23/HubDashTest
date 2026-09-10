"""Couche analytique commune aux six rapports.

Les services de chaque module répondent « combien ». Ce module répond aux trois
questions qu'un lecteur se pose ensuite et auxquelles un total seul ne répond
jamais :

- **Est-ce beaucoup ?** → comparaison avec la période précédente de même durée.
- **Dans quel sens ça va ?** → série temporelle, à une granularité adaptée à
  l'étendue demandée.
- **D'où ça vient ?** → concentration (Pareto) : combien d'acteurs font
  l'essentiel du volume.

Tout est calculé ici, côté serveur, comme le reste du reporting : les rapports
HTML, l'API et l'export Excel continuent de lire les mêmes chiffres.
"""
from collections import OrderedDict
from datetime import date, timedelta

from django.db.models import Sum


# =========================================================
#  Comparaison avec la période précédente
# =========================================================
def periode_precedente(date_debut, date_fin):
    """Période de même durée, immédiatement antérieure.

    Comparer « ce mois-ci » à « le mois dernier » suppose des durées égales.
    On décale donc la fenêtre de sa propre longueur plutôt que de reculer d'un
    mois calendaire : sur une sélection libre de 12 jours, un mois de recul
    n'aurait aucun sens.
    """
    duree = (date_fin - date_debut).days + 1
    fin = date_debut - timedelta(days=1)
    return fin - timedelta(days=duree - 1), fin


def variation(actuel, precedent):
    """Écart relatif en pourcentage, ou None quand il n'est pas calculable.

    Partir de zéro n'est pas « +100 % » : c'est une apparition, qu'aucun
    pourcentage ne décrit honnêtement. On renvoie None et le front affiche
    « nouveau » plutôt qu'un chiffre trompeur.
    """
    actuel = actuel or 0
    precedent = precedent or 0
    if precedent == 0:
        return None
    return round((actuel - precedent) / abs(precedent) * 100, 1)


def comparer(stats_actuels, stats_precedents, cles):
    """Assemble valeur courante, valeur précédente et écart pour chaque clé."""
    resultat = {}
    for cle in cles:
        actuel = stats_actuels.get(cle) or 0
        precedent = stats_precedents.get(cle) or 0
        resultat[cle] = {
            'valeur': actuel,
            'precedent': precedent,
            'variation': variation(actuel, precedent),
        }
    return resultat


# =========================================================
#  Série temporelle
# =========================================================
def granularite(date_debut, date_fin):
    """Pas de temps lisible pour l'étendue demandée.

    Un trimestre découpé en jours donne 90 barres illisibles ; une semaine
    découpée en mois donne une seule barre. Le pas suit donc la durée.
    """
    jours = (date_fin - date_debut).days + 1
    if jours <= 31:
        return 'jour'
    if jours <= 120:
        return 'semaine'
    return 'mois'


def _debut_de_periode(jour, pas):
    if pas == 'jour':
        return jour
    if pas == 'semaine':
        return jour - timedelta(days=jour.weekday())  # lundi
    return jour.replace(day=1)


def _libelle(jour, pas):
    if pas == 'jour':
        return jour.strftime('%d/%m')
    if pas == 'semaine':
        return f"sem. {jour.strftime('%d/%m')}"
    return jour.strftime('%m/%Y')


def _pas_suivant(jour, pas):
    if pas == 'jour':
        return jour + timedelta(days=1)
    if pas == 'semaine':
        return jour + timedelta(days=7)
    if jour.month == 12:
        return date(jour.year + 1, 1, 1)
    return date(jour.year, jour.month + 1, 1)


def serie_temporelle(queryset, champ_date, mesures, date_debut, date_fin):
    """Agrège un queryset dans le temps.

    `mesures` associe un nom de sortie à un champ à sommer, ou à None pour
    compter les lignes : {'volume': 'volume_final_l', 'nb': None}.

    Les intervalles sans donnée sont émis à zéro : sans cela, une rupture
    d'activité se lirait comme une ligne continue, ce qui est exactement
    l'inverse de ce qui s'est passé.
    """
    pas = granularite(date_debut, date_fin)

    # Squelette complet de la période, à zéro.
    points = OrderedDict()
    curseur = _debut_de_periode(date_debut, pas)
    while curseur <= date_fin:
        points[curseur] = {nom: 0 for nom in mesures}
        curseur = _pas_suivant(curseur, pas)

    for ligne in queryset.values_list(champ_date, *[c for c in mesures.values() if c]):
        jour = ligne[0]
        if jour is None:
            continue
        # Un DateTimeField (les visites) doit être ramené à sa date.
        if hasattr(jour, 'date'):
            jour = jour.date()
        seau = _debut_de_periode(jour, pas)
        if seau not in points:
            continue
        index = 1
        for nom, champ in mesures.items():
            if champ is None:
                points[seau][nom] += 1
            else:
                points[seau][nom] += ligne[index] or 0
                index += 1

    return [
        {'periode': _libelle(jour, pas), 'date': jour.isoformat(), **valeurs}
        for jour, valeurs in points.items()
    ]


# =========================================================
#  Concentration (Pareto)
# =========================================================
def concentration(lignes, cle_libelle, cle_valeur, sommet=8):
    """Répartition du volume entre les acteurs, et poids des plus gros.

    « 3 producteurs assurent 80 % du tonnage » est une information de pilotage :
    elle dit où porte le risque. Un tableau trié ne la donne pas, il faut
    additionner mentalement les lignes.
    """
    valorisees = [
        {'libelle': str(l.get(cle_libelle) or '—'), 'valeur': float(l.get(cle_valeur) or 0)}
        for l in lignes
    ]
    valorisees = [l for l in valorisees if l['valeur'] > 0]
    valorisees.sort(key=lambda l: l['valeur'], reverse=True)

    total = sum(l['valeur'] for l in valorisees)
    if not total:
        return {'total': 0, 'lignes': [], 'nb_acteurs': 0,
                'acteurs_80pct': 0, 'part_top3': None}

    cumul = 0
    acteurs_80pct = 0
    for rang, ligne in enumerate(valorisees, start=1):
        cumul += ligne['valeur']
        ligne['part'] = round(ligne['valeur'] / total * 100, 1)
        ligne['cumul'] = round(cumul / total * 100, 1)
        if acteurs_80pct == 0 and ligne['cumul'] >= 80:
            acteurs_80pct = rang

    part_top3 = round(
        sum(l['valeur'] for l in valorisees[:3]) / total * 100, 1)

    return {
        'total': round(total, 2),
        # Au-delà de huit barres le graphique devient un mur : le reste est
        # regroupé, comme le veut la règle « jamais une 9e couleur ».
        'lignes': valorisees[:sommet],
        'reste': len(valorisees) - sommet if len(valorisees) > sommet else 0,
        'nb_acteurs': len(valorisees),
        'acteurs_80pct': acteurs_80pct or len(valorisees),
        'part_top3': part_top3,
    }


# =========================================================
#  Faits marquants
# =========================================================
def fait(texte, ton='neutre'):
    """Constat court affiché en tête de rapport.

    `ton` : positif, attention, alerte, neutre — il pilote la couleur de statut,
    toujours accompagnée d'un libellé, jamais seule.
    """
    return {'texte': texte, 'ton': ton}


def fait_variation(libelle, comp, unite='', sens_positif=True):
    """Formule l'évolution d'un indicateur en une phrase.

    `sens_positif` dit si une hausse est une bonne nouvelle : +40 % de ventes et
    +40 % de pertes ne se commentent pas de la même façon.
    """
    v = comp.get('variation')
    if v is None:
        return None
    if abs(v) < 5:
        return fait(f"{libelle} stable ({v:+.1f} %) par rapport à la période précédente.")
    hausse = v > 0
    bon = hausse == sens_positif
    valeur = f"{comp['valeur']:,.0f}".replace(',', ' ')
    return fait(
        f"{libelle} {'en hausse' if hausse else 'en baisse'} de {abs(v):.1f} % "
        f"({valeur}{unite} sur la période).",
        'positif' if bon else 'attention',
    )


def taux(numerateur, denominateur):
    """Pourcentage, ou None si le dénominateur est nul (pas de 0 % trompeur)."""
    if not denominateur:
        return None
    return round((numerateur or 0) / denominateur * 100, 1)


def somme(queryset, champ):
    return queryset.aggregate(s=Sum(champ))['s'] or 0
