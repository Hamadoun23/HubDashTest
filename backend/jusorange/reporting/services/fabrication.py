"""Statistiques du module Fabrication (Production)."""
from django.db.models import Sum, Count
from fabrication.models import Production

from . import analytique as an


def get_stats_fabrication(date_debut, date_fin):
    """Retourne les statistiques de production pour la période donnée."""
    productions = Production.objects.filter(
        date_of__gte=date_debut,
        date_of__lte=date_fin
    )
    agg = productions.aggregate(
        nb=Count('id'),
        volume_total=Sum('volume_final_l'),
    )
    terminees = productions.filter(statut_production='TERMINEE').count()
    return {
        'nb_productions': agg['nb'] or 0,
        'volume_total_l': agg['volume_total'] or 0,
        'nb_terminees': terminees,
    }


def get_rapport_fabrication(date_debut, date_fin):
    """Retourne les données détaillées pour le rapport fabrication."""
    stats = get_stats_fabrication(date_debut, date_fin)
    productions = Production.objects.filter(
        date_of__gte=date_debut,
        date_of__lte=date_fin
    ).order_by('-date_of')
    stats['productions'] = productions
    stats['analyse'] = _analyse_fabrication(stats, productions, date_debut, date_fin)
    return stats


def _analyse_fabrication(stats, productions, date_debut, date_fin):
    """Comparaison, tendance, rendement matière et recettes dominantes."""
    from appro.models import Reception

    debut_p, fin_p = an.periode_precedente(date_debut, date_fin)
    prec = get_stats_fabrication(debut_p, fin_p)
    comparaison = an.comparer(
        stats, prec, ['nb_productions', 'volume_total_l', 'nb_terminees'])

    # Rendement matière : litres de jus obtenus par kilo d'oranges bonnes
    # réceptionnées sur la même période. C'est l'indicateur industriel central —
    # deux ateliers produisant le même volume ne se valent pas s'ils n'ont pas
    # consommé la même matière première.
    oranges = an.somme(Reception.objects.filter(
        date_recp__gte=date_debut, date_recp__lte=date_fin), 'qte_bon')
    rendement = round(stats['volume_total_l'] / oranges, 3) if oranges else None

    oranges_p = an.somme(Reception.objects.filter(
        date_recp__gte=debut_p, date_recp__lte=fin_p), 'qte_bon')
    rendement_p = round(prec['volume_total_l'] / oranges_p, 3) if oranges_p else None

    taux_achevement = an.taux(stats['nb_terminees'], stats['nb_productions'])

    faits = [
        f for f in [
            an.fait_variation('Volume produit', comparaison['volume_total_l'], ' L'),
        ] if f
    ]
    if rendement is not None and rendement_p:
        ecart = round((rendement - rendement_p) / rendement_p * 100, 1)
        if abs(ecart) >= 5:
            faits.append(an.fait(
                f"Rendement matière {'en hausse' if ecart > 0 else 'en baisse'} de "
                f"{abs(ecart):.1f} % : {rendement:.3f} L de jus par kg d'oranges "
                f"contre {rendement_p:.3f} avant.",
                'positif' if ecart > 0 else 'alerte'))
    en_cours = stats['nb_productions'] - stats['nb_terminees']
    if en_cours > 0:
        faits.append(an.fait(
            f"{en_cours} ordre(s) de fabrication encore ouvert(s) sur la période.",
            'attention'))

    # Le libellé lisible, pas le code stocké : « Pur jus » plutôt que « PUR ».
    libelles = dict(Production.RECETTE_CHOICES)
    par_recette = [
        {'recette': libelles.get(r['recette'], r['recette'] or '—'), 'volume': r['volume']}
        for r in productions.values('recette').annotate(
            volume=Sum('volume_final_l')).order_by('-volume')
    ]

    return {
        'comparaison': comparaison,
        'periode_precedente': {'date_debut': debut_p, 'date_fin': fin_p},
        'serie': an.serie_temporelle(
            productions, 'date_of',
            {'volume': 'volume_final_l', 'ordres': None}, date_debut, date_fin),
        'serie_mesures': [
            {'cle': 'volume', 'label': 'Volume produit (L)'},
        ],
        'concentration': an.concentration(par_recette, 'recette', 'volume'),
        'concentration_titre': 'Volume par recette',
        'concentration_unite': ' L',
        'indicateurs': [
            {'label': 'Rendement matière', 'valeur': rendement, 'unite': ' L/kg',
             'aide': "Litres de jus par kilo d'oranges bonnes réceptionnées."},
            {'label': 'Taux d\'achèvement', 'valeur': taux_achevement, 'unite': '%',
             'aide': 'Ordres terminés sur ordres lancés.'},
            {'label': 'Volume moyen', 'unite': ' L',
             'valeur': round(stats['volume_total_l'] / stats['nb_productions'], 1)
                       if stats['nb_productions'] else None,
             'aide': 'Par ordre de fabrication.'},
        ],
        'faits': faits,
    }
