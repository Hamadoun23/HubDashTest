"""Données pour les graphiques du dashboard."""
from datetime import date, timedelta
from django.db.models import Sum
from recolte.models import Cueillette
from appro.models import Reception
from fabrication.models import Production
from distribution.models import Vente


def get_chart_data(date_debut, date_fin):
    """Retourne les données pour les graphiques (CA, récolte, production par mois)."""
    # Générer les mois dans la période
    labels = []
    ca_data = []
    recolte_data = []
    production_data = []
    current = date(date_debut.year, date_debut.month, 1)
    end_month = date(date_fin.year, date_fin.month, 1)
    while current <= end_month:
        month_start = current
        if current.month == 12:
            month_end = date(current.year, 12, 31)
        else:
            month_end = date(current.year, current.month + 1, 1) - timedelta(days=1)
        month_end = min(month_end, date_fin)
        month_start = max(month_start, date_debut)
        labels.append(month_start.strftime('%b %Y'))
        # CA
        ca = Vente.objects.filter(
            date_vente__gte=month_start,
            date_vente__lte=month_end
        ).aggregate(s=Sum('montant_total'))['s'] or 0
        ca_data.append(float(ca))
        # Récolte (qte_bon)
        rec = Cueillette.objects.filter(
            date_cueil__gte=month_start,
            date_cueil__lte=month_end
        ).aggregate(s=Sum('qte_bon'))['s'] or 0
        recolte_data.append(float(rec))
        # Production (volume)
        prod = Production.objects.filter(
            date_of__gte=month_start,
            date_of__lte=month_end,
            statut_production='TERMINEE'
        ).aggregate(s=Sum('volume_final_l'))['s'] or 0
        production_data.append(float(prod))
        if current.month == 12:
            current = date(current.year + 1, 1, 1)
        else:
            current = date(current.year, current.month + 1, 1)
    return {
        'labels': labels,
        'ca': ca_data,
        'recolte': recolte_data,
        'production': production_data,
    }
