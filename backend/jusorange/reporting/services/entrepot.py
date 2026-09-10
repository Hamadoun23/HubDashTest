"""Statistiques du module Entrepot (Inventaire)."""
from django.db.models import Sum
from entrepot.models import Inventaire

from . import analytique as an


def get_stats_entrepot(date_debut, date_fin):
    """Retourne les statistiques d'inventaire pour la période donnée."""
    inventaires = Inventaire.objects.filter(
        date_inv__gte=date_debut,
        date_inv__lte=date_fin
    )
    nb = inventaires.count()
    nb_bloque = inventaires.filter(statut='BLOQUE').count()
    nb_mauvais = inventaires.filter(qualite='MAUVAIS').count()
    return {
        'nb_inventaires': nb,
        'nb_bloque': nb_bloque,
        'nb_qualite_mauvais': nb_mauvais,
    }


def get_rapport_entrepot(date_debut, date_fin):
    """Retourne les données détaillées pour le rapport entrepot."""
    stats = get_stats_entrepot(date_debut, date_fin)
    inventaires = Inventaire.objects.filter(
        date_inv__gte=date_debut,
        date_inv__lte=date_fin
    ).select_related('article').order_by('-date_inv')
    stats['inventaires'] = inventaires
    stats['analyse'] = _analyse_entrepot(stats, inventaires, date_debut, date_fin)
    return stats


def _analyse_entrepot(stats, inventaires, date_debut, date_fin):
    """Comparaison, tendance et fiabilité du stock théorique.

    L'enjeu d'un inventaire n'est pas de compter : c'est de mesurer à quel point
    le stock affiché par le système ment. D'où le taux de fiabilité et le
    cumul des écarts, absents du rapport d'origine.
    """
    debut_p, fin_p = an.periode_precedente(date_debut, date_fin)
    prec = get_stats_entrepot(debut_p, fin_p)
    comparaison = an.comparer(
        stats, prec, ['nb_inventaires', 'nb_bloque', 'nb_qualite_mauvais'])

    nb = stats['nb_inventaires']
    nb_justes = inventaires.filter(ecart=0).count()
    fiabilite = an.taux(nb_justes, nb)

    ecart_negatif = abs(inventaires.filter(ecart__lt=0).aggregate(
        s=Sum('ecart'))['s'] or 0)
    ecart_positif = inventaires.filter(ecart__gt=0).aggregate(
        s=Sum('ecart'))['s'] or 0

    faits = []
    if fiabilite is not None:
        faits.append(an.fait(
            f"Stock théorique fiable à {fiabilite:.1f} % : {nb_justes} inventaire(s) "
            f"sans écart sur {nb}.",
            'positif' if fiabilite >= 90 else 'alerte' if fiabilite < 70 else 'attention'))
    if ecart_negatif:
        faits.append(an.fait(
            f"{ecart_negatif:.0f} unité(s) manquantes au total : le système "
            f"surestime le stock disponible.", 'alerte'))
    if stats['nb_bloque']:
        faits.append(an.fait(
            f"{stats['nb_bloque']} lot(s) bloqué(s) — stock immobilisé.", 'attention'))

    # Les articles qui décrochent le plus : c'est là qu'il faut aller voir.
    par_article = list(inventaires.exclude(ecart=0).values(
        'article__type_art').annotate(nb=Sum('ecart')).order_by('nb'))
    for ligne in par_article:
        ligne['nb'] = abs(ligne['nb'] or 0)

    return {
        'comparaison': comparaison,
        'periode_precedente': {'date_debut': debut_p, 'date_fin': fin_p},
        'serie': an.serie_temporelle(
            inventaires, 'date_inv',
            {'controles': None}, date_debut, date_fin),
        'serie_mesures': [
            {'cle': 'controles', 'label': 'Inventaires réalisés'},
        ],
        'concentration': an.concentration(par_article, 'article__type_art', 'nb'),
        'concentration_titre': "Écarts cumulés par article (valeur absolue)",
        'concentration_unite': ' unités',
        'indicateurs': [
            {'label': 'Fiabilité du stock', 'valeur': fiabilite, 'unite': '%',
             'aide': 'Inventaires sans écart entre système et dépôt.'},
            {'label': 'Manquants cumulés', 'valeur': round(ecart_negatif, 1),
             'unite': '', 'aide': 'Dépôt inférieur au système.', 'sens_positif': False},
            {'label': 'Excédents cumulés', 'valeur': round(ecart_positif, 1),
             'unite': '', 'aide': 'Dépôt supérieur au système.', 'sens_positif': False},
        ],
        'faits': faits,
    }
