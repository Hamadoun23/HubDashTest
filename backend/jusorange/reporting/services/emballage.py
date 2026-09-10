"""Statistiques du module Emballage (Conditionnement, Bouteille)."""
from django.db.models import Sum, Count
from emballage.models import Conditionnement, Bouteille

from . import analytique as an


def get_stats_emballage(date_debut, date_fin):
    """Retourne les statistiques de conditionnement pour la période donnée."""
    conditionnements = Conditionnement.objects.filter(
        date_cond__gte=date_debut,
        date_cond__lte=date_fin
    )
    agg = conditionnements.aggregate(
        nb=Count('id'),
        qte_33cl=Sum('qte_33cl'),
        qte_1l=Sum('qte_1l'),
        volume=Sum('volume_utilisee'),
    )
    # Bouteilles par statut (toutes périodes pour vue globale)
    nb_dispo = Bouteille.objects.filter(statut_stock='DISPO').count()
    nb_vendue = Bouteille.objects.filter(statut_stock='VENDUE').count()
    nb_perimee = Bouteille.objects.filter(statut_stock='PERIMEE').count()
    nb_rebut = Bouteille.objects.filter(statut_stock='REBUT').count()
    return {
        'nb_conditionnements': agg['nb'] or 0,
        'qte_33cl': agg['qte_33cl'] or 0,
        'qte_1l': agg['qte_1l'] or 0,
        'volume_l': agg['volume'] or 0,
        'bouteilles_dispo': nb_dispo,
        'bouteilles_vendue': nb_vendue,
        'bouteilles_perimee': nb_perimee,
        'bouteilles_rebut': nb_rebut,
    }


def get_rapport_emballage(date_debut, date_fin):
    """Retourne les données détaillées pour le rapport emballage."""
    stats = get_stats_emballage(date_debut, date_fin)
    conditionnements = Conditionnement.objects.filter(
        date_cond__gte=date_debut,
        date_cond__lte=date_fin
    ).select_related('production').order_by('-date_cond')
    stats['conditionnements'] = conditionnements
    # Bouteilles par statut (toutes)
    stats['bouteilles_par_statut'] = [
        {'statut': 'DISPO', 'label': 'Disponible', 'count': stats['bouteilles_dispo']},
        {'statut': 'VENDUE', 'label': 'Vendue', 'count': stats['bouteilles_vendue']},
        {'statut': 'PERIMEE', 'label': 'Périmée', 'count': stats['bouteilles_perimee']},
        {'statut': 'REBUT', 'label': 'Rebut', 'count': stats['bouteilles_rebut']},
    ]
    # Liste des bouteilles (conditionnements de la période, limité à 200)
    bouteilles = Bouteille.objects.filter(
        conditionnement__date_cond__gte=date_debut,
        conditionnement__date_cond__lte=date_fin
    ).select_related('conditionnement').order_by('-date_creation')[:200]
    stats['bouteilles'] = bouteilles
    stats['analyse'] = _analyse_emballage(stats, conditionnements, date_debut, date_fin)
    return stats


def _analyse_emballage(stats, conditionnements, date_debut, date_fin):
    """Comparaison, tendance, pertes du parc et rendement de remplissage."""
    debut_p, fin_p = an.periode_precedente(date_debut, date_fin)
    prec = get_stats_emballage(debut_p, fin_p)
    comparaison = an.comparer(
        stats, prec,
        ['nb_conditionnements', 'qte_33cl', 'qte_1l', 'volume_l'])

    nb_bouteilles = stats['qte_33cl'] + stats['qte_1l']
    # Volume théorique contenu dans les bouteilles produites, comparé au volume
    # de jus consommé : l'écart est la perte de remplissage.
    volume_embouteille = stats['qte_33cl'] * 0.33 + stats['qte_1l'] * 1.0
    rendement = an.taux(volume_embouteille, stats['volume_l'])

    parc = (stats['bouteilles_dispo'] + stats['bouteilles_vendue']
            + stats['bouteilles_perimee'] + stats['bouteilles_rebut'])
    taux_perte_parc = an.taux(
        stats['bouteilles_perimee'] + stats['bouteilles_rebut'], parc)

    faits = [
        f for f in [
            an.fait_variation('Volume conditionné', comparaison['volume_l'], ' L'),
        ] if f
    ]
    if stats['bouteilles_perimee']:
        faits.append(an.fait(
            f"{stats['bouteilles_perimee']} bouteille(s) périmée(s) dans le parc — "
            f"stock à écouler avant DLC.", 'alerte'))
    if rendement is not None and rendement < 90:
        faits.append(an.fait(
            f"Rendement de remplissage à {rendement:.1f} % : "
            f"{stats['volume_l'] - volume_embouteille:.0f} L de jus consommés "
            f"sans se retrouver en bouteille.", 'attention'))

    formats = [
        {'format': 'Bouteilles 33cl', 'nb': stats['qte_33cl']},
        {'format': 'Bouteilles 1L', 'nb': stats['qte_1l']},
    ]

    return {
        'comparaison': comparaison,
        'periode_precedente': {'date_debut': debut_p, 'date_fin': fin_p},
        'serie': an.serie_temporelle(
            conditionnements, 'date_cond',
            {'b33cl': 'qte_33cl', 'b1l': 'qte_1l'}, date_debut, date_fin),
        'serie_mesures': [
            {'cle': 'b33cl', 'label': 'Bouteilles 33cl'},
            {'cle': 'b1l', 'label': 'Bouteilles 1L'},
        ],
        'concentration': an.concentration(formats, 'format', 'nb'),
        'concentration_titre': 'Répartition par format',
        'concentration_unite': ' bouteilles',
        'indicateurs': [
            {'label': 'Rendement remplissage', 'valeur': rendement, 'unite': '%',
             'aide': 'Volume mis en bouteille sur volume de jus consommé.'},
            {'label': 'Perte du parc', 'valeur': taux_perte_parc, 'unite': '%',
             'aide': 'Bouteilles périmées ou au rebut.', 'sens_positif': False},
            {'label': 'Bouteilles par lot', 'unite': '',
             'valeur': round(nb_bouteilles / stats['nb_conditionnements'])
                       if stats['nb_conditionnements'] else None,
             'aide': 'Par conditionnement.'},
        ],
        'faits': faits,
    }
