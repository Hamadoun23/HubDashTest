"""
Services de statistiques partagés par le tableau de bord et les rapports.

Portage de app/Services/PrimeService.php (classements) et de l'agrégation
temporelle de app/Services/CampagneRapportService.php.

Les noms de mois sont codés en dur : `locale` de Python n'est pas fiable sous
Windows et les libellés doivent être identiques à ceux produits par Carbon.
"""

from datetime import date

from django.db.models import Count, Q

from campagnes.models import Campagne
from core.models import ROLES_COMMERCIAUX, User

MOIS_FR = [
    "janvier", "février", "mars", "avril", "mai", "juin",
    "juillet", "août", "septembre", "octobre", "novembre", "décembre",
]


# ---------------------------------------------------------------------------
# Classements
# ---------------------------------------------------------------------------


def _ranger(lignes):
    """
    Applique un rang de compétition (1, 1, 3…) sur des lignes déjà triées par
    total décroissant. Reproduit la boucle de PrimeService.
    """
    resultat = []
    rang = 1
    for index, (user, total) in enumerate(lignes):
        if index > 0 and total < lignes[index - 1][1]:
            rang = index + 1
        resultat.append(
            {
                "rang": rang,
                "user_id": int(user.id),
                "user_name": user.nom_complet,
                "total_ventes": int(total),
            }
        )
    return resultat


def _classement(queryset, relation, filtre):
    """
    Compte les lignes de `relation` satisfaisant `filtre` pour chaque
    utilisateur, en conservant ceux qui n'en ont aucune (jointure externe).
    """
    lignes = (
        queryset.annotate(total=Count(relation, filter=filtre))
        .order_by("-total", "id")
        .values_list("id", "name", "prenom", "total")
    )
    # `values_list` évite de matérialiser des instances complètes ; on
    # reconstitue le minimum nécessaire au rendu.
    utilisateurs = [
        (User(id=i, name=n, prenom=p), total) for i, n, p, total in lignes
    ]
    return _ranger(utilisateurs)


def ids_commerciaux_perimetre(campagne_ids: list[int]) -> list[int]:
    """Union des commerciaux engagés sur les campagnes indiquées."""
    if not campagne_ids:
        return []
    ids = set()
    for campagne in Campagne.objects.filter(id__in=campagne_ids):
        ids.update(campagne.query_commerciaux_perimetre().values_list("id", flat=True))
    return sorted(ids)


def classement_ventes_pour_campagnes(
    campagne_ids, debut, fin, seulement_actifs=False, ventes_agence_id=None
):
    """Classement des commerciaux par nombre de ventes sur les campagnes données."""
    user_ids = ids_commerciaux_perimetre(list(campagne_ids))
    if not user_ids:
        return []

    qs = User.objects.filter(id__in=user_ids)
    if seulement_actifs:
        qs = qs.filter(actif=True)

    filtre = Q(ventes__campagne_id__in=campagne_ids, ventes__created_at__range=(debut, fin))
    if ventes_agence_id is not None:
        filtre &= Q(ventes__agence_id=ventes_agence_id)

    return _classement(qs, "ventes", filtre)


def classement_enrolements_pour_campagnes(
    campagne_ids, debut, fin, seulement_actifs=False, agence_id=None
):
    """Même classement, compté sur les enrôlements au lieu des ventes."""
    user_ids = ids_commerciaux_perimetre(list(campagne_ids))
    if not user_ids:
        return []

    qs = User.objects.filter(id__in=user_ids)
    if seulement_actifs:
        qs = qs.filter(actif=True)

    filtre = Q(
        enrolements__campagne_id__in=campagne_ids,
        enrolements__created_at__range=(debut, fin),
    )
    if agence_id is not None:
        filtre &= Q(enrolements__agence_id=agence_id)

    return _classement(qs, "enrolements", filtre)


def classement_entre_dates(
    debut, fin, agence_id=None, seulement_actifs=False, ventes_agence_id=None
):
    """Classement sur une plage de dates, sans restriction de campagne."""
    qs = User.objects.filter(role__in=ROLES_COMMERCIAUX)
    if seulement_actifs:
        qs = qs.filter(actif=True)
    if agence_id:
        qs = qs.filter(agence_id=agence_id)

    filtre = Q(ventes__created_at__range=(debut, fin))
    if ventes_agence_id is not None:
        filtre &= Q(ventes__agence_id=ventes_agence_id)

    return _classement(qs, "ventes", filtre)


# ---------------------------------------------------------------------------
# Agrégation temporelle
# ---------------------------------------------------------------------------


def _libelle_plage_semaine(lundi: date, dimanche: date) -> str:
    """Ex. « 30 mars – 5 Avril 2026 » (mois de fin capitalisé, comme Carbon)."""
    debut = f"{lundi.day} {MOIS_FR[lundi.month - 1]}"
    if lundi.year != dimanche.year:
        debut += f" {lundi.year}"
    mois_fin = MOIS_FR[dimanche.month - 1]
    mois_fin = mois_fin[0].upper() + mois_fin[1:]
    return f"{debut} – {dimanche.day} {mois_fin} {dimanche.year}"


def _libelle_semaine(cle: str) -> str:
    """`cle` est le résultat de YEARWEEK(date, 3) : AAAASS en ISO."""
    cle = str(cle).strip()
    if len(cle) == 6 and cle.isdigit():
        annee, semaine = int(cle[:4]), int(cle[4:])
        if 1 <= semaine <= 53:
            try:
                lundi = date.fromisocalendar(annee, semaine, 1)
                dimanche = date.fromisocalendar(annee, semaine, 7)
                return _libelle_plage_semaine(lundi, dimanche)
            except ValueError:
                return cle
    return cle


def _synthese(campagne, debut, fin, modele, agence_id=None, user_id=None, avec_types=True):
    """
    Synthèse d'une campagne : résumé, classement des commerciaux, répartition
    par agence et par type de carte, courbes hebdomadaire et mensuelle.

    Portage de CampagneRapportService::synthese() et syntheseEnrolement(). Les
    deux variantes partagent la même forme de retour — les pages React
    consomment les mêmes clés (« total_ventes » même pour des enrôlements).
    """
    from core.models import Agence

    base = modele.objects.filter(campagne_id=campagne.id, created_at__range=(debut, fin))
    if agence_id is not None:
        base = base.filter(agence_id=agence_id)
    if user_id is not None:
        base = base.filter(user_id=user_id)

    total = base.count()

    perimetre = campagne.query_commerciaux_perimetre()
    if agence_id is not None:
        perimetre = perimetre.filter(agence_id=agence_id)
    if user_id is not None:
        perimetre = perimetre.filter(id=user_id)

    nb_perimetre = perimetre.count()

    # Chaque commercial du périmètre apparaît, même sans aucune ligne.
    relation = "ventes" if modele.__name__ == "Vente" else "enrolements"
    filtre = Q(
        **{
            f"{relation}__campagne_id": campagne.id,
            f"{relation}__created_at__range": (debut, fin),
        }
    )
    if agence_id is not None:
        filtre &= Q(**{f"{relation}__agence_id": agence_id})
    if user_id is not None:
        filtre &= Q(**{f"{relation}__user_id": user_id})

    lignes = list(
        perimetre.annotate(total_ventes=Count(relation, filter=filtre))
        .order_by("-total_ventes", "id")
        .values("id", "name", "prenom", "agence_id", "total_ventes")
    )

    noms_agences = dict(
        Agence.objects.filter(
            id__in={l["agence_id"] for l in lignes if l["agence_id"]}
        ).values_list("id", "nom")
    )

    commerciaux = []
    rang = 1
    for index, ligne in enumerate(lignes):
        if index > 0 and ligne["total_ventes"] < lignes[index - 1]["total_ventes"]:
            rang = index + 1
        commerciaux.append(
            {
                "user_id": int(ligne["id"]),
                "user_name": f"{ligne['prenom']} {ligne['name']}".strip()
                if ligne["prenom"]
                else ligne["name"],
                "agence_id": int(ligne["agence_id"]) if ligne["agence_id"] else None,
                "agence_nom": noms_agences.get(ligne["agence_id"]),
                "total_ventes": int(ligne["total_ventes"]),
                "rang": rang,
            }
        )

    par_agence_compte = {
        l["agence_id"]: l["cnt"]
        for l in base.values("agence_id").annotate(cnt=Count("id"))
    }
    commerciaux_par_agence = {
        l["agence_id"]: l["cnt"]
        for l in perimetre.values("agence_id").annotate(cnt=Count("id"))
    }

    agences_perimetre = campagne.agences_perimetre()
    if agence_id is not None:
        agences_perimetre = [a for a in agences_perimetre if a.id == agence_id]

    agences = [
        {
            "agence_id": int(a.id),
            "agence_nom": a.nom,
            "total_ventes": int(par_agence_compte.get(a.id, 0)),
            "pct_volume": round(par_agence_compte.get(a.id, 0) / total * 100, 2)
            if total > 0
            else 0.0,
            "nb_commerciaux": int(commerciaux_par_agence.get(a.id, 0)),
        }
        for a in agences_perimetre
    ]
    agences.sort(key=lambda a: a["total_ventes"], reverse=True)

    par_type = []
    if avec_types:
        from core.models import TypeCarte

        lignes_types = list(base.values("type_carte_id").annotate(cnt=Count("id")))
        codes = dict(
            TypeCarte.objects.filter(
                id__in={l["type_carte_id"] for l in lignes_types if l["type_carte_id"]}
            ).values_list("id", "code")
        )
        par_type = [
            {
                "type_carte_id": int(l["type_carte_id"]) if l["type_carte_id"] else None,
                "code": codes.get(l["type_carte_id"], "?"),
                "total_ventes": int(l["cnt"]),
                "pct_volume": round(l["cnt"] / total * 100, 2) if total > 0 else 0.0,
            }
            for l in lignes_types
        ]
        par_type.sort(key=lambda t: t["total_ventes"], reverse=True)

    return {
        "date_debut": debut,
        "date_fin": fin,
        "resume": {
            "total_ventes": total,
            "nb_commerciaux_perimetre": nb_perimetre,
            "nb_avec_ventes": sum(1 for c in commerciaux if c["total_ventes"] > 0),
            "nb_zero_vente": sum(1 for c in commerciaux if c["total_ventes"] == 0),
            "nb_agences_avec_ventes": sum(
                1 for a in agences_perimetre if par_agence_compte.get(a.id, 0) > 0
            ),
        },
        "commerciaux": commerciaux,
        "agences": agences,
        "par_type_carte": par_type,
        "par_semaine": agreger_par_periode(base, "semaine"),
        "par_mois": agreger_par_periode(base, "mois"),
    }


def synthese_campagne(campagne, debut, fin, agence_id=None, user_id=None):
    """Synthèse d'une campagne, quel que soit son type."""
    from campagnes.models import TypeCampagne
    from terrain.models import EnrolementClient, Vente

    if campagne.type == TypeCampagne.ENROLEMENT_APP:
        return _synthese(
            campagne, debut, fin, EnrolementClient, agence_id, user_id, avec_types=False
        )
    return _synthese(campagne, debut, fin, Vente, agence_id, user_id, avec_types=True)


def agreger_par_periode(queryset, mode: str, colonne_date: str = "created_at"):
    """
    Regroupe un queryset par semaine ISO ou par mois.

    On passe par `YEARWEEK(date, 3)` et `DATE_FORMAT(date, '%Y-%m')`, exactement
    comme Laravel sur MySQL : la numérotation des semaines ISO diffère selon les
    fonctions employées, un écart ici décalerait tous les graphiques.
    """
    from django.db.models.functions import Cast
    from django.db.models import CharField, Func

    if mode == "semaine":
        expression = Func(
            colonne_date, template="YEARWEEK(%(expressions)s, 3)", output_field=CharField()
        )
    else:
        expression = Func(
            colonne_date,
            template="DATE_FORMAT(%(expressions)s, '%%%%Y-%%%%m')",
            output_field=CharField(),
        )

    lignes = (
        queryset.annotate(periode_cle=Cast(expression, CharField(max_length=16)))
        .values("periode_cle")
        .annotate(cnt=Count("id"))
        .order_by("periode_cle")
    )

    resultat = []
    for ligne in lignes:
        cle = str(ligne["periode_cle"])
        if mode == "semaine":
            libelle = _libelle_semaine(cle)
        elif len(cle) == 7:
            annee, mois = cle.split("-")
            libelle = f"{MOIS_FR[int(mois) - 1]} {annee}"
        else:
            libelle = cle
        resultat.append({"cle": cle, "libelle": libelle, "total_ventes": int(ligne["cnt"])})
    return resultat
