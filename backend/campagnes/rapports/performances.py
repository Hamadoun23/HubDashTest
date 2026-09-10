"""
Écran Performances : classement des commerciaux, des agences et des types de
cartes sur une période, avec comparaison à la période précédente.

Portage de app/Http/Controllers/PerformanceController.php (méthodes Inertia).
"""

from datetime import date, datetime, timedelta
from urllib.parse import urlencode

from django.core.exceptions import PermissionDenied
from django.db.models import Count
from django.http import Http404
from django.shortcuts import get_object_or_404
from inertia import render

from campagnes.models import Campagne, StatutCampagne, TypeCampagne
from core.decorators import http_methods
from core.partenaires import filtrer_campagnes, filtrer_users, partenaire_courant
from core.models import ROLES_COMMERCIAUX, Agence, TypeCarte, User
from core.php import nombre_format, tableau
from terrain.models import EnrolementClient, Vente

from .services import (
    MOIS_FR,
    classement_enrolements_pour_campagnes,
    classement_ventes_pour_campagnes,
)


def _nom(user):
    if user is None:
        return "—"
    return f"{user.prenom} {user.name}".strip() if user.prenom else user.name


def _debut_jour(jour):
    return datetime(jour.year, jour.month, jour.day)


def _fin_jour(jour):
    return datetime(jour.year, jour.month, jour.day, 23, 59, 59, 999999)


def _libelle_campagnes(campagnes):
    if not campagnes:
        return "Aucune campagne"
    noms = [f"« {c.nom} »" for c in campagnes]
    return noms[0] if len(noms) == 1 else ", ".join(noms[:-1]) + " et " + noms[-1]


def _agences_perimetre(campagne_ids):
    """Union des agences couvertes par les campagnes, triée par nom."""
    if not campagne_ids:
        return []
    agences = {}
    for campagne in Campagne.objects.filter(id__in=campagne_ids):
        for agence in campagne.agences_perimetre():
            agences[agence.id] = agence
    return sorted(agences.values(), key=lambda a: a.nom)


# ---------------------------------------------------------------------------
# Contexte : période, agence, campagnes de référence
# ---------------------------------------------------------------------------


def _partenaire_id(request):
    """
    Le client de GDA du contexte.

    Pour un administrateur, c'est celui qu'il consulte ; pour un commercial,
    celui de son compte. Dans les deux cas, aucune performance d'un autre
    client ne doit apparaître.
    """
    partenaire = partenaire_courant(request)
    if partenaire is not None:
        return partenaire.id
    return getattr(request.user, "partenaire_id", None)


def _resoudre_campagne_filtre(request, user):
    """Campagne explicitement choisie, si l'utilisateur y a accès."""
    valeur = request.GET.get("campagne_id")
    if not valeur:
        return None
    campagne = filtrer_campagnes(
        Campagne.objects.filter(pk=valeur), partenaire_courant(request)
    ).first()
    if campagne is None:
        return None
    if user.is_admin or user.is_direction:
        return campagne
    if user.is_commercial_ou_telephonique and campagne.concerne_agence(
        int(user.agence_id) if user.agence_id else None
    ):
        return campagne
    return None


def _contexte_performance(request):
    """Portage de PerformanceController::performanceContext()."""
    user = request.user
    partenaire_id = _partenaire_id(request)

    if user.is_admin or user.is_direction:
        agence_id = int(request.GET["agence"]) if request.GET.get("agence") else None
    elif user.is_commercial_ou_telephonique:
        agence_id = int(user.agence_id) if user.agence_id else None
    else:
        agence_id = None

    du, au = request.GET.get("du"), request.GET.get("au")
    filtre_intervalle = bool(du and au)

    campagne_filtre = _resoudre_campagne_filtre(request, user)

    # Une campagne explicitement choisie impose son type. Sinon on privilégie la
    # vente (activité historique principale), et on ne bascule sur l'enrôlement
    # que s'il n'y a rien d'autre : mélanger les deux ferait interroger `ventes`
    # pour des campagnes d'enrôlement et remonterait des zéros silencieux.
    if campagne_filtre:
        type_campagne = campagne_filtre.type
        campagnes_du_type = [campagne_filtre]
    else:
        stats = Campagne.campagnes_pour_stats(agence_id, partenaire_id)
        vente = [c for c in stats if c.type == TypeCampagne.VENTE_CARTE]
        enrolement = [c for c in stats if c.type == TypeCampagne.ENROLEMENT_APP]
        if vente:
            type_campagne, campagnes_du_type = TypeCampagne.VENTE_CARTE, vente
        elif enrolement:
            type_campagne, campagnes_du_type = TypeCampagne.ENROLEMENT_APP, enrolement
        else:
            type_campagne, campagnes_du_type = TypeCampagne.VENTE_CARTE, []

    campagne_performances = campagnes_du_type[0] if campagnes_du_type else None
    campagne_ids = (
        [int(campagne_filtre.id)]
        if campagne_filtre is not None
        else [int(c.id) for c in campagnes_du_type]
    )
    campagne_ref = campagne_filtre or campagne_performances

    fenetre = None
    if campagnes_du_type:
        fenetre = (
            _debut_jour(min(c.date_debut for c in campagnes_du_type)),
            _fin_jour(max(c.date_fin for c in campagnes_du_type)),
        )

    if filtre_intervalle:
        debut, fin = _debut_jour(date.fromisoformat(du)), _fin_jour(date.fromisoformat(au))
        if debut > fin:
            debut, fin = _debut_jour(fin.date()), _fin_jour(debut.date())
        libelle = f"Du {debut.strftime('%d/%m/%Y')} au {fin.strftime('%d/%m/%Y')}"
        if campagne_filtre:
            libelle += f" — campagne « {campagne_filtre.nom} »"
        elif campagne_ids:
            libelle += " — " + _libelle_campagnes(campagnes_du_type)
    elif request.GET.get("periode"):
        premier = date.fromisoformat(request.GET["periode"] + "-01")
        suivant = (premier + timedelta(days=32)).replace(day=1)
        debut, fin = _debut_jour(premier), _fin_jour(suivant - timedelta(days=1))
        libelle = f"{MOIS_FR[premier.month - 1]} {premier.year}"
        if campagne_ids:
            libelle += " — " + _libelle_campagnes(campagnes_du_type)
    elif campagne_filtre:
        debut = _debut_jour(campagne_filtre.date_debut)
        fin = _fin_jour(campagne_filtre.date_fin)
        libelle = (
            f"Campagne « {campagne_filtre.nom} » "
            f"({debut.strftime('%d/%m/%Y')} – {fin.strftime('%d/%m/%Y')})"
        )
    elif fenetre and campagne_ids:
        debut, fin = fenetre
        libelle = (
            f"Campagne(s) {_libelle_campagnes(campagnes_du_type)} "
            f"({debut.strftime('%d/%m/%Y')} – {fin.strftime('%d/%m/%Y')})"
        )
    else:
        aujourdhui = date.today()
        debut, fin = _debut_jour(aujourdhui), _fin_jour(aujourdhui)
        libelle = "Aucune campagne trouvée"

    return {
        "dateDebut": debut,
        "dateFin": fin,
        "libellePeriode": libelle,
        "agenceId": agence_id,
        "partenaireId": partenaire_id,
        "filtreIntervalle": filtre_intervalle,
        "du": du if filtre_intervalle else None,
        "au": au if filtre_intervalle else None,
        "campagneRef": campagne_ref,
        "campagneIdsFilter": campagne_ids,
        "campagneIdSelected": campagne_filtre.id if campagne_filtre else None,
        "compareEnabled": str(request.GET.get("compare", "")).lower()
        in ("1", "true", "on", "yes"),
        "type": type_campagne,
        "campagnesDuType": campagnes_du_type,
    }


# ---------------------------------------------------------------------------
# Requêtes et agrégats
# ---------------------------------------------------------------------------


def _base_periode(modele, debut, fin, agence_id, campagne_ids):
    if not campagne_ids:
        return modele.objects.none()
    qs = modele.objects.filter(
        created_at__range=(debut, fin), campagne_id__in=campagne_ids
    )
    return qs.filter(agence_id=agence_id) if agence_id is not None else qs


def _fenetre_precedente(debut, fin):
    """Fenêtre de même durée en jours calendaires, terminant la veille de `debut`."""
    jours = (fin.date() - debut.date()).days + 1
    precedent_fin = _fin_jour(debut.date() - timedelta(days=1))
    precedent_debut = _debut_jour(debut.date() - timedelta(days=jours))
    return precedent_debut, precedent_fin, jours


def _pct_variation(courant, precedent):
    if precedent == 0:
        # Une progression depuis zéro n'a pas de pourcentage exploitable.
        return None if courant > 0 else 0.0
    return round((courant - precedent) / precedent * 100, 1)


def _ranger(lignes):
    """Rang de compétition sur des lignes déjà triées par total décroissant."""
    resultat = []
    rang = 1
    for index, ligne in enumerate(lignes):
        if index > 0 and ligne["total_ventes"] < lignes[index - 1]["total_ventes"]:
            rang = index + 1
        resultat.append({"rang": rang, **ligne})
    return resultat


def _classement_agences(base, ids_perimetre):
    """Classement des agences ; celles du périmètre sans vente apparaissent à 0."""
    par_agence = {
        l["agence_id"]: int(l["total"])
        for l in base.values("agence_id").annotate(total=Count("id"))
    }

    if ids_perimetre:
        lignes = [
            {"agence_nom": a.nom, "total_ventes": par_agence.get(a.id, 0)}
            for a in Agence.objects.filter(id__in=ids_perimetre).order_by("nom")
        ]
    else:
        if not par_agence:
            return []
        noms = dict(
            Agence.objects.filter(
                id__in=[i for i in par_agence if i]
            ).values_list("id", "nom")
        )
        lignes = [
            {
                "agence_nom": noms.get(agence_id, f"Agence #{agence_id}")
                if agence_id
                else "Sans agence",
                "total_ventes": total,
            }
            for agence_id, total in par_agence.items()
        ]

    lignes.sort(key=lambda l: l["total_ventes"], reverse=True)
    total_general = sum(l["total_ventes"] for l in lignes)

    return [
        {
            **ligne,
            "pct_volume": round(ligne["total_ventes"] / total_general * 100, 1)
            if total_general > 0
            else 0.0,
        }
        for ligne in _ranger(lignes)
    ]


def _classement_types_cartes(base):
    lignes_brutes = list(
        base.values("type_carte_id")
        .annotate(total_ventes=Count("id"))
        .order_by("-total_ventes", "type_carte_id")
    )
    if not lignes_brutes:
        return []

    total_general = sum(int(l["total_ventes"]) for l in lignes_brutes)
    codes = dict(
        TypeCarte.objects.filter(
            id__in=[l["type_carte_id"] for l in lignes_brutes if l["type_carte_id"]]
        ).values_list("id", "code")
    )

    lignes = [
        {
            "code": codes.get(l["type_carte_id"], f"#{l['type_carte_id']}")
            if l["type_carte_id"]
            else "—",
            "total_ventes": int(l["total_ventes"]),
            "pct_volume": round(int(l["total_ventes"]) / total_general * 100, 1)
            if total_general > 0
            else 0.0,
        }
        for l in lignes_brutes
    ]
    return _ranger(lignes)


def _ventes_par_agence_graphique(base):
    lignes = list(
        base.values("agence_id").annotate(total=Count("id")).order_by("-total")
    )
    if not lignes:
        return []
    noms = dict(
        Agence.objects.filter(
            id__in=[l["agence_id"] for l in lignes if l["agence_id"]]
        ).values_list("id", "nom")
    )
    return [
        {
            "label": noms.get(l["agence_id"], f"Agence #{l['agence_id']}")
            if l["agence_id"]
            else "Sans agence",
            "ventes": int(l["total"]),
        }
        for l in lignes
    ]


def _leader_et_ma_ligne(classement, user, mes_ventes_reelles):
    """
    Première place et position du commercial connecté.

    Son total est forcé sur le décompte réel de la période : le classement
    agrégé peut en diverger quand un filtre d'agence s'applique à la jointure.
    """
    par_user = {
        int(c["user_id"]): {
            "user_id": int(c["user_id"]),
            "user_name": c["user_name"],
            "total_ventes": int(c["total_ventes"]),
        }
        for c in classement
    }
    par_user[int(user.id)] = {
        "user_id": int(user.id),
        "user_name": _nom(user),
        "total_ventes": mes_ventes_reelles,
    }

    lignes = sorted(
        par_user.values(), key=lambda l: (-l["total_ventes"], l["user_id"])
    )
    avec_rang = _ranger(lignes)

    return (
        avec_rang[0] if avec_rang else None,
        next((l for l in avec_rang if l["user_id"] == int(user.id)), None),
    )


# ---------------------------------------------------------------------------
# Vues
# ---------------------------------------------------------------------------


@http_methods("GET", "HEAD")
def index(request):
    if not request.user.is_authenticated:
        from django.contrib.auth.views import redirect_to_login

        return redirect_to_login(request.get_full_path())

    Campagne.sync_statuts()
    contexte = _contexte_performance(request)
    user = request.user
    est_enrolement = contexte["type"] == TypeCampagne.ENROLEMENT_APP
    vue_commerciale = user.is_commercial_ou_telephonique

    # Le filtre d'agence ne s'applique au classement que pour admin/direction :
    # côté commercial, il mettrait les autres agences de la campagne à zéro et
    # fausserait les rangs.
    agence_classement = contexte["agenceId"] if (user.is_admin or user.is_direction) else None

    ids = contexte["campagneIdsFilter"]
    calcul_classement = (
        classement_enrolements_pour_campagnes
        if est_enrolement
        else classement_ventes_pour_campagnes
    )
    classement = (
        calcul_classement(
            ids, contexte["dateDebut"], contexte["dateFin"], False, agence_classement
        )
        if ids
        else []
    )

    modele = EnrolementClient if est_enrolement else Vente
    base = _base_periode(
        modele, contexte["dateDebut"], contexte["dateFin"], contexte["agenceId"], ids
    )

    par_type = (
        {}
        if est_enrolement
        else {
            str(l["type_carte_id"]): int(l["total"])
            for l in base.values("type_carte_id").annotate(total=Count("id"))
        }
    )
    stats = {"total_ventes": base.count(), "par_type": tableau(par_type)}

    stats_precedentes = None
    delta = None
    if contexte["compareEnabled"]:
        precedent_debut, precedent_fin, jours = _fenetre_precedente(
            contexte["dateDebut"], contexte["dateFin"]
        )
        base_precedente = _base_periode(
            modele, precedent_debut, precedent_fin, contexte["agenceId"], ids
        )
        stats_precedentes = {
            "total_ventes": base_precedente.count(),
            # Laravel n'agrège pas les types sur la période de comparaison.
            "par_type": tableau({}),
        }
        delta = {
            "ventes_pct": _pct_variation(
                stats["total_ventes"], stats_precedentes["total_ventes"]
            ),
            "libelle": (
                f"Période de comparaison : {precedent_debut.strftime('%d/%m/%Y')} → "
                f"{precedent_fin.strftime('%d/%m/%Y')} ({jours} j. inclus)"
            ),
        }

    ids_agences_perimetre = [a.id for a in _agences_perimetre(ids)]

    ligne_top1 = None
    ma_ligne = None
    if vue_commerciale:
        # Même périmètre que le classement : toutes les lignes du commercial sur
        # la campagne, sans filtre d'agence.
        mes_ventes = (
            modele.objects.filter(
                user_id=user.id,
                created_at__range=(contexte["dateDebut"], contexte["dateFin"]),
                campagne_id__in=ids,
            ).count()
            if ids
            else 0
        )
        ligne_top1, ma_ligne = _leader_et_ma_ligne(classement, user, mes_ventes)
        stats["mes_ventes"] = mes_ventes
        stats["mon_rang"] = ma_ligne["rang"] if ma_ligne else None

    # La prime « meilleur vendeur » n'existe que pour les campagnes de vente.
    campagne_prime = (
        None
        if est_enrolement
        else (
            contexte["campagneRef"]
            or Campagne.campagne_pour_performances(
                contexte["agenceId"], contexte.get("partenaireId")
            )
        )
    )

    total_pour_part = 0 if vue_commerciale else int(stats["total_ventes"])

    filtres_detail = {
        cle: valeur
        for cle, valeur in {
            "du": contexte["du"],
            "au": contexte["au"],
            "agence": contexte["agenceId"],
            "campagne_id": contexte["campagneIdSelected"],
            "compare": "1" if contexte["compareEnabled"] else None,
        }.items()
        if valeur not in (None, "")
    }

    def url_detail(user_id):
        suffixe = f"?{urlencode(filtres_detail)}" if filtres_detail else ""
        return request.build_absolute_uri(f"/performances/commercial/{user_id}{suffixe}")

    return render(
        request,
        "Performances/Index",
        {
            "filters": {
                "du": contexte["du"] or "",
                "au": contexte["au"] or "",
                "agence": contexte["agenceId"],
                "campagne_id": contexte["campagneIdSelected"],
                "compare": contexte["compareEnabled"],
            },
            # Filtrer par agence n'a de sens que chez un client qui en a un
            # réseau : `_agences_perimetre` renvoie une liste vide sinon.
            "canFilterAgence": bool(
                (user.is_admin or user.is_direction) and ids_agences_perimetre
            ),
            "aDesAgences": bool(ids_agences_perimetre),
            "agencesSelect": [
                {"id": a.id, "nom": a.nom} for a in _agences_perimetre(ids)
            ],
            "campagnesSelect": _campagnes_select(
                contexte["agenceId"], user, partenaire_courant(request)
            ),
            "libellePeriode": contexte["libellePeriode"],
            "estEnrolement": est_enrolement,
            "vueCommerciale": vue_commerciale,
            "vueChef": False,
            "canExport": not vue_commerciale,
            "exportQuery": tableau(
                {
                    cle: request.GET.get(cle)
                    for cle in ("du", "au", "agence", "campagne_id", "compare")
                    if request.GET.get(cle)
                }
            ),
            "stats": stats,
            "statsPrev": stats_precedentes,
            "compareDelta": delta,
            "compareEnabled": contexte["compareEnabled"],
            "typesCartes": []
            if est_enrolement
            else [
                {"id": t.id, "code": t.code} for t in TypeCarte.objects.order_by("code")
            ],
            "topCommerciauxChart": [
                {"label": c["user_name"], "ventes": int(c["total_ventes"])}
                for c in classement
                if c["total_ventes"] > 0
            ][:5],
            "ventesParAgenceChart": _ventes_par_agence_graphique(base),
            "campagneRefNom": contexte["campagneRef"].nom
            if (vue_commerciale and contexte["campagneRef"])
            else None,
            "primeMeilleurVendeur": nombre_format(campagne_prime.prime_meilleur_vendeur)
            if campagne_prime
            else None,
            "classement": []
            if vue_commerciale
            else [
                {
                    "user_id": c["user_id"],
                    "rang": c["rang"],
                    "user_name": c["user_name"],
                    "total_ventes": c["total_ventes"],
                    "pct_volume": round(c["total_ventes"] / total_pour_part * 100, 1)
                    if total_pour_part > 0
                    else None,
                    "detail_url": url_detail(c["user_id"]),
                }
                for c in classement
            ],
            "classementLigneTop1": ligne_top1,
            "ligneCommercialConnecte": ma_ligne,
            "userEstPremier": bool(
                vue_commerciale
                and ligne_top1
                and int(user.id) == int(ligne_top1["user_id"])
            ),
            "monDetailUrl": url_detail(user.id) if vue_commerciale else None,
            "classementAgences": _classement_agences(base, ids_agences_perimetre),
            "classementTypesCartes": []
            if est_enrolement
            else _classement_types_cartes(base),
        },
    )


def _campagnes_select(agence_id, user, partenaire=None):
    """
    Campagnes proposées au filtre.

    Note : Laravel ne sélectionne ici que id/nom/date_debut/date_fin. Le suffixe
    « — Enrôlement » de son libellé teste `$c->type`, absent de la sélection,
    donc toujours nul : il ne s'affiche jamais. Comportement reproduit tel quel.
    """
    qs = filtrer_campagnes(
        Campagne.objects.exclude(statut=StatutCampagne.ANNULEE).order_by("-date_debut"),
        partenaire,
    )

    if user.is_admin or user.is_direction:
        campagnes = qs
    elif agence_id:
        from django.db.models import Q

        campagnes = qs.filter(
            Q(toutes_agences=True) | Q(agences__id=agence_id)
        ).distinct()
    else:
        return []

    return [
        {
            "id": c.id,
            "label": f"{c.nom} ({c.date_debut.strftime('%d/%m/%y')}–{c.date_fin.strftime('%d/%m/%y')})",
        }
        for c in campagnes
    ]


@http_methods("GET", "HEAD")
def show(request, user):
    if not request.user.is_authenticated:
        from django.contrib.auth.views import redirect_to_login

        return redirect_to_login(request.get_full_path())

    Campagne.sync_statuts()
    viewer = request.user
    commercial = get_object_or_404(
        filtrer_users(
            User.objects.select_related("agence"), partenaire_courant(request)
        ),
        pk=user,
    )
    contexte = _contexte_performance(request)

    if not _peut_voir_detail(viewer, commercial, contexte["agenceId"]):
        raise PermissionDenied("Vous ne pouvez pas consulter le détail de ce commercial.")
    if commercial.role not in ROLES_COMMERCIAUX:
        raise Http404("Utilisateur non trouvé.")

    est_enrolement = contexte["type"] == TypeCampagne.ENROLEMENT_APP
    ids = contexte["campagneIdsFilter"]

    parametres = {
        cle: valeur
        for cle, valeur in {
            "du": contexte["du"],
            "au": contexte["au"],
            "agence": contexte["agenceId"],
            "campagne_id": contexte["campagneIdSelected"],
            "compare": "1" if contexte["compareEnabled"] else None,
        }.items()
        if valeur not in (None, "")
    }
    suffixe = f"?{urlencode(parametres)}" if parametres else ""

    commun = {
        "displayName": _nom(commercial),
        "agenceNom": commercial.agence.nom if commercial.agence_id else None,
        "libellePeriode": contexte["libellePeriode"],
        "estEnrolement": est_enrolement,
        "backUrl": request.build_absolute_uri(f"/performances{suffixe}"),
        "exportUrl": request.build_absolute_uri(
            f"/performances/commercial/{commercial.id}/export-excel{suffixe}"
        ),
    }

    if est_enrolement:
        enrolements = list(
            _base_periode(
                EnrolementClient, contexte["dateDebut"], contexte["dateFin"], None, ids
            )
            .filter(user_id=commercial.id)
            .select_related("agence")
            .order_by("-created_at", "-id")
        )
        return render(
            request,
            "Performances/Show",
            {
                **commun,
                "ventesCount": len(enrolements),
                "clientsCount": len(enrolements),
                "cartesVendues": [],
                "clients": [
                    {
                        "nom_complet": f"{e.prenom} {e.nom}".strip(),
                        "numero_compte": e.numero_compte,
                        "telephone": e.telephone,
                        "ville": e.adresse,
                        "type_carte": None,
                    }
                    for e in enrolements
                ],
                "ventes": [
                    {
                        "date": e.created_at.strftime("%d/%m/%Y %H:%M")
                        if e.created_at
                        else None,
                        "client_nom": f"{e.prenom} {e.nom}".strip(),
                        "numero_compte": e.numero_compte,
                        "type_carte": None,
                        "agence_nom": e.agence.nom if e.agence_id else None,
                    }
                    for e in enrolements
                ],
            },
        )

    base = _base_periode(
        Vente, contexte["dateDebut"], contexte["dateFin"], None, ids
    ).filter(user_id=commercial.id)

    ventes = list(
        base.select_related("client", "type_carte", "agence").order_by(
            "-created_at", "-id"
        )
    )
    par_type = {
        l["type_carte_id"]: int(l["total"])
        for l in base.values("type_carte_id").annotate(total=Count("id"))
    }

    from terrain.models import Client

    clients = list(
        Client.objects.select_related("type_carte")
        .filter(id__in={v.client_id for v in ventes if v.client_id})
        .order_by("nom", "prenom", "id")
    )

    return render(
        request,
        "Performances/Show",
        {
            **commun,
            "ventesCount": len(ventes),
            "clientsCount": len(clients),
            "cartesVendues": [
                {"code": t.code, "total": par_type.get(t.id, 0)}
                for t in TypeCarte.objects.order_by("code")
                if par_type.get(t.id, 0) > 0
            ],
            "clients": [
                {
                    "nom_complet": f"{c.prenom} {c.nom}".strip(),
                    "telephone": c.telephone,
                    "ville": c.ville,
                    "type_carte": c.type_carte.code if c.type_carte_id else None,
                }
                for c in clients
            ],
            "ventes": [
                {
                    "date": v.created_at.strftime("%d/%m/%Y %H:%M")
                    if v.created_at
                    else None,
                    "client_nom": f"{v.client.prenom} {v.client.nom}".strip()
                    if v.client_id
                    else "—",
                    "type_carte": v.type_carte.code if v.type_carte_id else None,
                    "agence_nom": v.agence.nom if v.agence_id else None,
                }
                for v in ventes
            ],
        },
    )


def _peut_voir_detail(viewer, commercial, agence_contexte):
    if viewer.is_admin or viewer.is_direction:
        # Un filtre d'agence actif restreint aussi l'accès au détail.
        if agence_contexte is not None and commercial.agence_id != agence_contexte:
            return False
        return True
    if viewer.is_commercial_ou_telephonique:
        return viewer.id == commercial.id
    return False
