"""Analyse commerciale de Jus d'orange : clients, facturation, recouvrement.

Tout est calculé à partir des factures (ce qui est dû), des paiements (ce qui
est encaissé) et des commandes livrées (ce qui est parti). Les factures
annulées ne comptent pas. Le « reste » d'une facture est son montant moins ses
paiements ; il est « échu » quand l'échéance est passée.
"""
from collections import defaultdict
from datetime import date, timedelta

from distribution.models import Client, Commande, Facture, Paiement

TRANCHES = [
    ('non_echu', 'Non échu'),
    ('j0_30', '1 à 30 j de retard'),
    ('j31_60', '31 à 60 j'),
    ('j61_90', '61 à 90 j'),
    ('j90_plus', 'Plus de 90 j'),
]


def _tranche(retard):
    if retard <= 0:
        return 'non_echu'
    if retard <= 30:
        return 'j0_30'
    if retard <= 60:
        return 'j31_60'
    if retard <= 90:
        return 'j61_90'
    return 'j90_plus'


def _factures(client_id=None):
    qs = Facture.objects.exclude(statut='ANNULEE').select_related('vente__client').prefetch_related('paiements')
    if client_id is not None:
        qs = qs.filter(vente__client_id=client_id)
    return qs


def _ligne_facture(f, aujourdhui):
    paye = sum(p.montant for p in f.paiements.all())
    reste = max(f.montant - paye, 0)
    retard = (aujourdhui - f.date_echeance).days if reste > 0.5 else 0
    return paye, reste, retard


def synthese_clients():
    """Indicateurs globaux, séries mensuelles, balance âgée, classement des clients."""
    aujourdhui = date.today()
    par_client = defaultdict(lambda: {
        'facture': 0.0, 'paye': 0.0, 'reste': 0.0, 'echu': 0.0, 'retard_max': 0,
        'nb_factures': 0, 'nb_impayees': 0, 'dernier_achat': None,
    })
    tranches = {cle: 0.0 for cle, _ in TRANCHES}
    facture_mois = defaultdict(float)

    for f in _factures():
        paye, reste, retard = _ligne_facture(f, aujourdhui)
        c = par_client[f.vente.client_id]
        c['facture'] += f.montant
        c['paye'] += paye
        c['reste'] += reste
        c['nb_factures'] += 1
        if reste > 0.5:
            c['nb_impayees'] += 1
            tranches[_tranche(retard)] += reste
            if retard > 0:
                c['echu'] += reste
                c['retard_max'] = max(c['retard_max'], retard)
        if c['dernier_achat'] is None or f.date_fact > c['dernier_achat']:
            c['dernier_achat'] = f.date_fact
        facture_mois[f.date_fact.strftime('%Y-%m')] += f.montant

    encaisse_mois = defaultdict(float)
    modes = defaultdict(float)
    for p in Paiement.objects.exclude(facture__statut='ANNULEE'):
        encaisse_mois[p.date_paie.strftime('%Y-%m')] += p.montant
        modes[p.get_mode_paie_display()] += p.montant

    bouteilles = defaultdict(lambda: [0, 0])
    commandes_attente = defaultdict(int)
    for cmd in Commande.objects.all():
        if cmd.vente_id:
            bouteilles[cmd.client_id][0] += cmd.quantite_33cl
            bouteilles[cmd.client_id][1] += cmd.quantite_1l
        else:
            commandes_attente[cmd.client_id] += 1

    # 12 derniers mois, mois en cours compris.
    mois = []
    curseur = aujourdhui.replace(day=1)
    for _ in range(12):
        mois.append(curseur.strftime('%Y-%m'))
        curseur = (curseur - timedelta(days=1)).replace(day=1)
    mois.reverse()

    clients = []
    for client in Client.objects.all():
        c = par_client.get(client.id)
        b = bouteilles.get(client.id, [0, 0])
        actif = bool(c and c['dernier_achat'] and (aujourdhui - c['dernier_achat']).days <= 90)
        clients.append({
            'id': client.id,
            'nom': client.nom_complet,
            'telephone': client.tel_client,
            'adresse': client.adresse,
            'facture': round(c['facture']) if c else 0,
            'paye': round(c['paye']) if c else 0,
            'reste': round(c['reste']) if c else 0,
            'echu': round(c['echu']) if c else 0,
            'retard_max': c['retard_max'] if c else 0,
            'nb_factures': c['nb_factures'] if c else 0,
            'nb_impayees': c['nb_impayees'] if c else 0,
            'taux_recouvrement': round(100 * c['paye'] / c['facture']) if c and c['facture'] else None,
            'dernier_achat': c['dernier_achat'] if c else None,
            'bouteilles_33cl': b[0],
            'bouteilles_1l': b[1],
            'commandes_en_attente': commandes_attente.get(client.id, 0),
            'actif': actif,
        })

    facture = sum(c['facture'] for c in clients)
    paye = sum(c['paye'] for c in clients)
    reste = sum(c['reste'] for c in clients)
    echu = sum(c['echu'] for c in clients)
    acheteurs = [c for c in clients if c['nb_factures']]
    return {
        'indicateurs': {
            'chiffre_affaires': round(facture),
            'encaisse': round(paye),
            'reste': round(reste),
            'echu': round(echu),
            'taux_recouvrement': round(100 * paye / facture) if facture else None,
            'clients': len(clients),
            'clients_acheteurs': len(acheteurs),
            'clients_actifs': sum(1 for c in clients if c['actif']),
            'clients_en_retard': sum(1 for c in clients if c['echu'] > 0),
            'panier_moyen': round(facture / sum(c['nb_factures'] for c in acheteurs)) if acheteurs else 0,
        },
        'mensuel': [
            {'mois': m, 'facture': round(facture_mois.get(m, 0)), 'encaisse': round(encaisse_mois.get(m, 0))}
            for m in mois
        ],
        'balance_agee': [{'cle': cle, 'libelle': lib, 'montant': round(tranches[cle])} for cle, lib in TRANCHES],
        'modes_paiement': sorted(
            ({'mode': m, 'montant': round(v)} for m, v in modes.items()), key=lambda x: -x['montant']
        ),
        'clients': sorted(clients, key=lambda c: -c['facture']),
    }


def fiche_client(client):
    """Historique d'un client : factures (avec reste et retard), paiements, commandes."""
    aujourdhui = date.today()
    factures = []
    for f in _factures(client.id).order_by('-date_fact'):
        paye, reste, retard = _ligne_facture(f, aujourdhui)
        factures.append({
            'id': f.id, 'numero': f.num_fact, 'date': f.date_fact, 'echeance': f.date_echeance,
            'montant': round(f.montant), 'paye': round(paye), 'reste': round(reste),
            'retard': retard if reste > 0.5 else 0, 'statut': f.get_statut_display(),
        })
    paiements = [
        {'date': p.date_paie, 'montant': round(p.montant), 'mode': p.get_mode_paie_display(),
         'reference': p.reference, 'facture': p.facture.num_fact}
        for p in Paiement.objects.filter(facture__vente__client=client).exclude(facture__statut='ANNULEE')
        .select_related('facture').order_by('-date_paie')
    ]
    commandes = [
        {'date': c.date_cmd, 'qte_33cl': c.quantite_33cl, 'qte_1l': c.quantite_1l,
         'total': round(c.get_total_ligne()), 'livree': bool(c.vente_id)}
        for c in Commande.objects.filter(client=client).order_by('-date_cmd', '-pk')
    ]
    return {
        'client': {'id': client.id, 'nom': client.nom_complet, 'telephone': client.tel_client,
                   'email': client.email, 'adresse': client.adresse},
        'factures': factures,
        'paiements': paiements,
        'commandes': commandes,
    }
