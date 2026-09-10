from datetime import date, timedelta


def get_period_semaine():
    """Période : 7 derniers jours."""
    today = date.today()
    return today - timedelta(days=6), today


def get_period_mois():
    """Période : mois en cours (1er → aujourd'hui)."""
    today = date.today()
    return today.replace(day=1), today


def get_period_trimestre():
    """Période : 3 derniers mois complets + mois en cours."""
    today = date.today()
    debut = (today.replace(day=1) - timedelta(days=1)).replace(day=1)  # 1er du mois précédent
    debut = (debut - timedelta(days=1)).replace(day=1)  # 2 mois avant
    debut = (debut - timedelta(days=1)).replace(day=1)  # 3 mois avant
    return debut, today


def get_period_default():
    """
    Retourne la période par défaut : du 1er du mois en cours jusqu'à aujourd'hui.
    Exemple : si on est le 10 février 2026 → (1er fév 2026, 10 fév 2026)
    """
    today = date.today()
    debut = today.replace(day=1)  # 1er du mois
    fin = today
    return debut, fin


def get_period_from_request(request):
    """
    Extrait date_debut et date_fin depuis les paramètres GET.
    Supporte : periode=semaine|mois|trimestre ou date_debut/date_fin.
    """
    periode = request.GET.get('periode')
    if periode == 'semaine':
        return get_period_semaine()
    if periode == 'mois':
        return get_period_mois()
    if periode == 'trimestre':
        return get_period_trimestre()
    debut_str = request.GET.get('date_debut')
    fin_str = request.GET.get('date_fin')
    if debut_str and fin_str:
        try:
            debut = date.fromisoformat(debut_str)
            fin = date.fromisoformat(fin_str)
            return debut, fin
        except (ValueError, TypeError):
            pass
    return get_period_default()