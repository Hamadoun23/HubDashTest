"""Statistiques du module Appro (Reception, ArticleStock)."""
from datetime import date, timedelta
from django.db.models import Sum, Count, F
from appro.models import Reception, ArticleStock

from . import analytique as an


def get_stats_appro(date_debut, date_fin):
    """Retourne les statistiques d'approvisionnement pour la période donnée."""
    receptions = Reception.objects.filter(
        date_recp__gte=date_debut,
        date_recp__lte=date_fin
    )
    agg = receptions.aggregate(
        nb=Count('id'),
        qte_recue=Sum('qte_recue'),
        qte_bon=Sum('qte_bon'),
        qte_mauvais=Sum('qte_mauvais'),
    )
    # Articles sous seuil d'alerte
    articles_alerte = ArticleStock.objects.filter(qte_art__lt=F('seuil_alerte'))
    return {
        'nb_receptions': agg['nb'] or 0,
        'qte_recue_kg': agg['qte_recue'] or 0,
        'qte_bon_kg': agg['qte_bon'] or 0,
        'qte_mauvais_kg': agg['qte_mauvais'] or 0,
        'nb_articles_alerte': articles_alerte.count(),
    }


def get_rapport_appro(date_debut, date_fin):
    """Retourne les données détaillées pour le rapport appro."""
    stats = get_stats_appro(date_debut, date_fin)
    receptions = Reception.objects.filter(
        date_recp__gte=date_debut,
        date_recp__lte=date_fin
    ).select_related('cueillette').order_by('-date_recp')
    stats['receptions'] = receptions
    stats['articles_alerte'] = ArticleStock.objects.filter(qte_art__lt=F('seuil_alerte'))
    # Évolution du stock (oranges) : réceptions qte_bon par mois
    evolution_mois = []
    current = date(date_debut.year, date_debut.month, 1)
    end_month = date(date_fin.year, date_fin.month, 1)
    while current <= end_month:
        if current.month == 12:
            month_end = date(current.year, 12, 31)
        else:
            month_end = date(current.year, current.month + 1, 1) - timedelta(days=1)
        month_end = min(month_end, date_fin)
        month_start = max(current, date_debut)
        qte = Reception.objects.filter(
            date_recp__gte=month_start,
            date_recp__lte=month_end
        ).aggregate(s=Sum('qte_bon'))['s'] or 0
        evolution_mois.append({
            'mois': current.strftime('%m/%Y'),
            'qte_bon': qte,
        })
        if current.month == 12:
            current = date(current.year + 1, 1, 1)
        else:
            current = date(current.year, current.month + 1, 1)
    stats['evolution_stock'] = evolution_mois
    # Stock actuel par article
    stats['stock_actuel'] = ArticleStock.objects.all().order_by('type_art')
    stats['analyse'] = _analyse_appro(stats, receptions, date_debut, date_fin)
    return stats


def _analyse_appro(stats, receptions, date_debut, date_fin):
    """Comparaison, tendance et rebut à la réception."""
    debut_p, fin_p = an.periode_precedente(date_debut, date_fin)
    prec = get_stats_appro(debut_p, fin_p)
    comparaison = an.comparer(
        stats, prec,
        ['nb_receptions', 'qte_recue_kg', 'qte_bon_kg', 'qte_mauvais_kg'])

    recue = stats['qte_recue_kg']
    taux_rebut = an.taux(stats['qte_mauvais_kg'], recue)
    taux_rebut_prec = an.taux(prec['qte_mauvais_kg'], prec['qte_recue_kg'])

    faits = [
        f for f in [
            an.fait_variation('Quantité réceptionnée', comparaison['qte_recue_kg'], ' kg'),
        ] if f
    ]
    if taux_rebut is not None and taux_rebut_prec is not None:
        ecart = round(taux_rebut - taux_rebut_prec, 1)
        if abs(ecart) >= 2:
            faits.append(an.fait(
                f"Rebut à la réception {'en hausse' if ecart > 0 else 'en baisse'} : "
                f"{taux_rebut:.1f} % contre {taux_rebut_prec:.1f} % avant ({ecart:+.1f} pt).",
                'alerte' if ecart > 0 else 'positif'))
    if stats['nb_articles_alerte']:
        faits.append(an.fait(
            f"{stats['nb_articles_alerte']} article(s) sous leur seuil d'alerte : "
            f"la production peut s'arrêter faute de consommables.",
            'alerte'))

    # Le dépôt est une dimension de pilotage : un site qui concentre tout est
    # un point de rupture unique.
    par_depot = list(receptions.values('lieu_depot').annotate(
        qte=Sum('qte_bon')).order_by('-qte'))

    return {
        'comparaison': comparaison,
        'periode_precedente': {'date_debut': debut_p, 'date_fin': fin_p},
        'serie': an.serie_temporelle(
            receptions, 'date_recp',
            {'recue': 'qte_recue', 'bonnes': 'qte_bon'}, date_debut, date_fin),
        'serie_mesures': [
            {'cle': 'recue', 'label': 'Reçu (kg)'},
            {'cle': 'bonnes', 'label': 'Dont bonnes (kg)'},
        ],
        'concentration': an.concentration(par_depot, 'lieu_depot', 'qte'),
        'concentration_titre': 'Réceptions par dépôt',
        'concentration_unite': ' kg',
        'indicateurs': [
            {'label': 'Taux de rebut', 'valeur': taux_rebut, 'unite': '%',
             'aide': 'Oranges écartées à la réception.', 'sens_positif': False},
            {'label': 'Réception moyenne', 'unite': ' kg',
             'valeur': round(recue / stats['nb_receptions'], 1) if stats['nb_receptions'] else None,
             'aide': 'Par réception.'},
            {'label': 'Articles sous seuil', 'valeur': stats['nb_articles_alerte'],
             'unite': '', 'aide': 'À réapprovisionner.', 'sens_positif': False},
        ],
        'faits': faits,
    }
