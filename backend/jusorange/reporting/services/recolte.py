"""Statistiques du module Récolte (Producteur, Cueillette)."""
from django.db.models import Sum, Count
from recolte.models import Cueillette, Producteur

from . import analytique as an


def get_stats_recolte(date_debut, date_fin):
    """Retourne les statistiques de récolte pour la période donnée."""
    cueillettes = Cueillette.objects.filter(
        date_cueil__gte=date_debut,
        date_cueil__lte=date_fin
    )
    agg = cueillettes.aggregate(
        nb=Count('id'),
        qte_total=Sum('qte_total'),
        qte_bon=Sum('qte_bon'),
        qte_mauvais=Sum('qte_mauvais'),
    )
    return {
        'nb_cueillettes': agg['nb'] or 0,
        'qte_total_kg': agg['qte_total'] or 0,
        'qte_bon_kg': agg['qte_bon'] or 0,
        'qte_mauvais_kg': agg['qte_mauvais'] or 0,
        'producteurs_actifs': Producteur.objects.filter(actif=True).count(),
    }


def get_rapport_recolte(date_debut, date_fin):
    """Retourne les données détaillées pour le rapport récolte."""
    stats = get_stats_recolte(date_debut, date_fin)
    cueillettes = Cueillette.objects.filter(
        date_cueil__gte=date_debut,
        date_cueil__lte=date_fin
    ).select_related('producteur').order_by('-date_cueil')
    stats['cueillettes'] = cueillettes
    # Vue par producteur (agrégat)
    par_producteur = Cueillette.objects.filter(
        date_cueil__gte=date_debut,
        date_cueil__lte=date_fin,
        producteur__isnull=False
    ).values('producteur__nom_complet').annotate(
        nb=Count('id'),
        qte_total=Sum('qte_total'),
        qte_bon=Sum('qte_bon'),
    ).order_by('-qte_bon')
    stats['par_producteur'] = list(par_producteur)
    # Vue par zone (agrégat)
    par_zone = Cueillette.objects.filter(
        date_cueil__gte=date_debut,
        date_cueil__lte=date_fin,
        producteur__isnull=False
    ).values('producteur__zone').annotate(
        nb=Count('id'),
        qte_total=Sum('qte_total'),
        qte_bon=Sum('qte_bon'),
    ).order_by('-qte_bon')
    stats['par_zone'] = list(par_zone)
    stats['analyse'] = _analyse_recolte(stats, cueillettes, date_debut, date_fin)
    return stats


def _analyse_recolte(stats, cueillettes, date_debut, date_fin):
    """Comparaison, tendance et concentration de la récolte."""
    debut_p, fin_p = an.periode_precedente(date_debut, date_fin)
    prec = get_stats_recolte(debut_p, fin_p)
    comparaison = an.comparer(
        stats, prec,
        ['nb_cueillettes', 'qte_total_kg', 'qte_bon_kg', 'qte_mauvais_kg'])

    total = stats['qte_total_kg']
    taux_qualite = an.taux(stats['qte_bon_kg'], total)
    taux_perte = an.taux(stats['qte_mauvais_kg'], total)
    # Le taux de qualité de la période précédente, pour dire si la marchandise
    # s'améliore ou se dégrade — le tonnage seul ne le dit pas.
    taux_qualite_prec = an.taux(prec['qte_bon_kg'], prec['qte_total_kg'])

    faits = [
        f for f in [
            an.fait_variation('Tonnage récolté', comparaison['qte_total_kg'], ' kg'),
            an.fait_variation('Pertes', comparaison['qte_mauvais_kg'], ' kg',
                              sens_positif=False),
        ] if f
    ]
    if taux_qualite is not None and taux_qualite_prec is not None:
        ecart = round(taux_qualite - taux_qualite_prec, 1)
        if abs(ecart) >= 2:
            faits.append(an.fait(
                f"Qualité des oranges {'en progrès' if ecart > 0 else 'en recul'} : "
                f"{taux_qualite:.1f} % de bonnes contre {taux_qualite_prec:.1f} % avant "
                f"({ecart:+.1f} pt).",
                'positif' if ecart > 0 else 'alerte'))

    conc = an.concentration(stats['par_producteur'], 'producteur__nom_complet', 'qte_bon')
    if conc['nb_acteurs'] >= 3 and conc['part_top3'] is not None:
        faits.append(an.fait(
            f"{conc['acteurs_80pct']} producteur(s) sur {conc['nb_acteurs']} fournissent "
            f"80 % du tonnage — les 3 premiers en font {conc['part_top3']:.0f} %.",
            'attention' if conc['part_top3'] >= 70 else 'neutre'))

    return {
        'comparaison': comparaison,
        'periode_precedente': {'date_debut': debut_p, 'date_fin': fin_p},
        'serie': an.serie_temporelle(
            cueillettes, 'date_cueil',
            {'total': 'qte_total', 'bonnes': 'qte_bon'}, date_debut, date_fin),
        'serie_mesures': [
            {'cle': 'total', 'label': 'Récolté (kg)'},
            {'cle': 'bonnes', 'label': 'Dont bonnes (kg)'},
        ],
        'concentration': conc,
        'concentration_titre': 'Tonnage bon par producteur',
        'concentration_unite': ' kg',
        'indicateurs': [
            {'label': 'Taux de qualité', 'valeur': taux_qualite, 'unite': '%',
             'aide': 'Oranges bonnes sur le total récolté.'},
            {'label': 'Taux de perte', 'valeur': taux_perte, 'unite': '%',
             'aide': 'Oranges écartées à la cueillette.', 'sens_positif': False},
            {'label': 'Récolte moyenne', 'unite': ' kg',
             'valeur': round(total / stats['nb_cueillettes'], 1) if stats['nb_cueillettes'] else None,
             'aide': 'Par cueillette.'},
        ],
        'faits': faits,
    }
