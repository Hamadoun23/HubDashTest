"""Statistiques du module Distribution (Client, Vente, Commande, Facture, Paiement)."""
from datetime import date

from django.db.models import Sum, Count
from distribution.models import Vente, Commande, Facture, Paiement, ReceptionPaiement

from . import analytique as an


def get_stats_distribution(date_debut, date_fin):
    """Retourne les statistiques commerciales pour la période donnée."""
    ventes = Vente.objects.filter(
        date_vente__gte=date_debut,
        date_vente__lte=date_fin
    )
    agg_ventes = ventes.aggregate(
        nb=Count('id'),
        ca_total=Sum('montant_total'),
    )
    commandes_en_attente = Commande.objects.filter(vente__isnull=True).count()
    commandes = Commande.objects.filter(
        date_cmd__gte=date_debut,
        date_cmd__lte=date_fin
    )
    nb_commandes = commandes.count()
    # Trésorerie : écarts non traités
    paiements = Paiement.objects.select_related('reception_tresorerie').all()
    nb_ecarts = 0
    for p in paiements:
        try:
            rec = p.reception_tresorerie
            if not rec.ecart_traite and rec.statut_reception in ('ECART_POSITIF', 'ECART_NEGATIF'):
                nb_ecarts += 1
        except ReceptionPaiement.DoesNotExist:
            pass
    return {
        'nb_ventes': agg_ventes['nb'] or 0,
        'ca_total': agg_ventes['ca_total'] or 0,
        'nb_commandes': nb_commandes,
        'commandes_en_attente': commandes_en_attente,
        'nb_ecarts_tresorerie': nb_ecarts,
    }


def get_rapport_distribution(date_debut, date_fin):
    """Retourne les données détaillées pour le rapport distribution."""
    stats = get_stats_distribution(date_debut, date_fin)
    ventes = Vente.objects.filter(
        date_vente__gte=date_debut,
        date_vente__lte=date_fin
    ).select_related('client').order_by('-date_vente')
    commandes = Commande.objects.filter(
        date_cmd__gte=date_debut,
        date_cmd__lte=date_fin
    ).select_related('client', 'vente').order_by('-date_cmd')
    factures = Facture.objects.filter(
        date_fact__gte=date_debut,
        date_fact__lte=date_fin
    ).select_related('vente', 'vente__client').order_by('-date_fact')
    paiements = Paiement.objects.filter(
        date_paie__gte=date_debut,
        date_paie__lte=date_fin
    ).select_related('facture', 'facture__vente', 'facture__vente__client').order_by('-date_paie')
    receptions_tresorerie = ReceptionPaiement.objects.filter(
        date_reception__gte=date_debut,
        date_reception__lte=date_fin
    ).select_related('paiement', 'paiement__facture', 'paiement__facture__vente', 'paiement__facture__vente__client').order_by('-date_reception')
    stats['ventes'] = ventes
    stats['commandes'] = commandes
    stats['factures'] = factures
    stats['paiements'] = paiements
    stats['receptions_tresorerie'] = receptions_tresorerie
    stats['analyse'] = _analyse_distribution(
        stats, ventes, factures, paiements, date_debut, date_fin)
    return stats


def _analyse_distribution(stats, ventes, factures, paiements, date_debut, date_fin):
    """Panier moyen, recouvrement, retards et concentration du chiffre d'affaires."""
    debut_p, fin_p = an.periode_precedente(date_debut, date_fin)
    prec = get_stats_distribution(debut_p, fin_p)
    comparaison = an.comparer(
        stats, prec, ['nb_ventes', 'ca_total', 'nb_commandes'])

    ca = stats['ca_total']
    panier = round(ca / stats['nb_ventes']) if stats['nb_ventes'] else None
    encaisse = an.somme(paiements, 'montant')
    taux_recouvrement = an.taux(encaisse, an.somme(factures, 'montant'))

    # Créances en retard : factures échues qu'il reste à encaisser. C'est
    # l'information que le tableau des factures oblige à reconstituer à la main.
    aujourdhui = date.today()
    en_retard, montant_retard = 0, 0.0
    for f in factures:
        paye = sum(p.montant for p in f.paiements.all())
        reste = f.montant - paye
        if reste > 0.01 and f.date_echeance and f.date_echeance < aujourdhui:
            en_retard += 1
            montant_retard += reste

    faits = [
        f for f in [
            an.fait_variation("Chiffre d'affaires", comparaison['ca_total'], ' XOF'),
            an.fait_variation('Nombre de ventes', comparaison['nb_ventes']),
        ] if f
    ]
    if taux_recouvrement is not None and taux_recouvrement < 80:
        faits.append(an.fait(
            f"Recouvrement à {taux_recouvrement:.1f} % seulement : "
            f"une partie du facturé n'est pas rentrée en caisse.", 'attention'))
    if en_retard:
        # L'espace fine des milliers s'applique au seul nombre : formater la
        # phrase entière effaçait aussi sa ponctuation.
        montant_lisible = f"{montant_retard:,.0f}".replace(',', ' ')
        faits.append(an.fait(
            f"{en_retard} facture(s) échue(s) non soldée(s), soit "
            f"{montant_lisible} XOF à relancer.", 'alerte'))
    if stats['nb_ecarts_tresorerie']:
        faits.append(an.fait(
            f"{stats['nb_ecarts_tresorerie']} écart(s) de trésorerie non traité(s) "
            f"entre le déclaré et l'encaissé.", 'alerte'))
    if stats['commandes_en_attente']:
        faits.append(an.fait(
            f"{stats['commandes_en_attente']} commande(s) en attente de "
            f"complétion en vente.", 'attention'))

    par_client = list(ventes.values('client__nom_complet').annotate(
        ca=Sum('montant_total')).order_by('-ca'))
    conc = an.concentration(par_client, 'client__nom_complet', 'ca')
    if conc['nb_acteurs'] >= 3 and conc['part_top3'] is not None:
        faits.append(an.fait(
            f"Les 3 premiers clients pèsent {conc['part_top3']:.0f} % du chiffre "
            f"d'affaires ({conc['acteurs_80pct']} clients sur {conc['nb_acteurs']} "
            f"en font 80 %).",
            'attention' if conc['part_top3'] >= 60 else 'neutre'))

    return {
        'comparaison': comparaison,
        'periode_precedente': {'date_debut': debut_p, 'date_fin': fin_p},
        'serie': an.serie_temporelle(
            ventes, 'date_vente',
            {'ca': 'montant_total', 'ventes': None}, date_debut, date_fin),
        'serie_mesures': [
            {'cle': 'ca', 'label': "Chiffre d'affaires (XOF)"},
        ],
        'concentration': conc,
        'concentration_titre': "Chiffre d'affaires par client",
        'concentration_unite': ' XOF',
        'indicateurs': [
            {'label': 'Panier moyen', 'valeur': panier, 'unite': ' XOF',
             'aide': 'Chiffre d\'affaires par vente.'},
            {'label': 'Taux de recouvrement', 'valeur': taux_recouvrement, 'unite': '%',
             'aide': 'Encaissé sur facturé, sur la période.'},
            {'label': 'Créances en retard', 'valeur': round(montant_retard),
             'unite': ' XOF', 'aide': f'{en_retard} facture(s) échue(s).',
             'sens_positif': False},
        ],
        'faits': faits,
    }
