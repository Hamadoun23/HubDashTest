"""
Rapports de campagne : index, cumul multi-campagnes, listes de ventes et de
clients, synthèse et reporting téléphonique.

Portage des méthodes Inertia de app/Http/Controllers/Admin/RapportController.php.
"""

from datetime import date, datetime

from django.core.exceptions import PermissionDenied
from django.db.models import Count
from django.http import Http404
from django.shortcuts import get_object_or_404, redirect
from inertia import render

from campagnes.models import Campagne, TypeCampagne
from campagnes.services import (
    agregats_telephonique,
    rapports_telephoniques_campagne,
)
from core.decorators import http_methods, role_required
from core.middleware import deposer_flash
from core.models import Agence, Role, TypeCarte, User
from core.pagination import paginer
from core.php import nombre_format, tableau
from terrain.models import Client, EnrolementClient, TelephoniqueRapport, Vente
from core.partenaires import filtrer_campagnes, filtrer_saisies, partenaire_courant
from terrain.services import libelle_stats

from . import services


def _nom(user):
    if user is None:
        return "—"
    return f"{user.prenom} {user.name}".strip() if user.prenom else user.name


def _debut_jour(jour):
    return datetime(jour.year, jour.month, jour.day)


def _fin_jour(jour):
    return datetime(jour.year, jour.month, jour.day, 23, 59, 59, 999999)


def _entier(valeur):
    return int(valeur) if valeur not in (None, "") else None


def _campagne_du_perimetre(request, campagne_id):
    """Une campagne du client courant, 404 sinon."""
    from django.shortcuts import get_object_or_404

    return get_object_or_404(
        filtrer_campagnes(Campagne.objects.all(), partenaire_courant(request)),
        pk=campagne_id,
    )


def _filtres_synthese(request, campagne):
    """
    Période et filtres de l'écran de synthèse.

    La plage saisie est toujours ramenée dans les bornes de la campagne, et
    inversée si l'utilisateur a saisi les dates à l'envers.
    """
    debut_campagne = _debut_jour(campagne.date_debut)
    fin_campagne = _fin_jour(campagne.date_fin)

    du, au = request.GET.get("du"), request.GET.get("au")
    if du and au:
        debut = max(_debut_jour(date.fromisoformat(du)), debut_campagne)
        fin = min(_fin_jour(date.fromisoformat(au)), fin_campagne)
        if debut > fin:
            debut, fin = _debut_jour(fin.date()), _fin_jour(debut.date())
    else:
        debut, fin = debut_campagne, fin_campagne

    return (
        debut,
        fin,
        _entier(request.GET.get("agence_id")),
        _entier(request.GET.get("user_id")),
    )


# ---------------------------------------------------------------------------
# Index
# ---------------------------------------------------------------------------


@role_required(Role.ADMIN, Role.DIRECTION)
@http_methods("GET", "HEAD")
def index(request):
    Campagne.sync_statuts()
    partenaire = partenaire_courant(request)
    campagnes = filtrer_campagnes(
        Campagne.objects.order_by("-date_debut", "-id"), partenaire
    )

    def nb_lignes(campagne):
        modele = (
            EnrolementClient if campagne.type == TypeCampagne.ENROLEMENT_APP else Vente
        )
        return modele.objects.filter(campagne_id=campagne.id).count()

    return render(
        request,
        "Rapports/Index",
        {
            "libelleStatsCampagne": libelle_stats(
                None, None, partenaire.id if partenaire else None
            ),
            "isAdmin": request.user.is_admin,
            "campagnes": [
                {
                    "id": c.id,
                    "nom": c.nom,
                    "type": c.type,
                    "estEnrolement": c.type == TypeCampagne.ENROLEMENT_APP,
                    "date_debut": c.date_debut.strftime("%d/%m/%Y"),
                    "date_fin": c.date_fin.strftime("%d/%m/%Y"),
                    "statut": c.statut_effectif,
                    "nb_ventes": nb_lignes(c),
                }
                for c in campagnes
            ],
        },
    )


# ---------------------------------------------------------------------------
# Cumul multi-campagnes
# ---------------------------------------------------------------------------


def _repartir_en_graphique(lignes, limite, libelle_reste, avec_part=False, total=0):
    """
    Prépare une série pour graphique : les `limite` premières valeurs, puis une
    ligne « Autres » agrégeant la queue de distribution.
    """
    avec_valeurs = sorted(
        [l for l in lignes if l["total"] > 0], key=lambda l: l["total"], reverse=True
    )
    denominateur = total if total > 0 else 1

    serie = []
    for ligne in avec_valeurs[:limite]:
        entree = {"label": ligne["label"], "total_ventes": ligne["total"]}
        if avec_part:
            entree["pct_part"] = round(100 * ligne["total"] / denominateur, 2)
        serie.append(entree)

    reste = avec_valeurs[limite:]
    if reste:
        somme = sum(l["total"] for l in reste)
        entree = {
            "label": f"{libelle_reste} ({len(reste)})",
            "total_ventes": somme,
        }
        if avec_part:
            entree["pct_part"] = round(100 * somme / denominateur, 2)
        serie.append(entree)

    return serie


@role_required(Role.ADMIN, Role.DIRECTION)
@http_methods("GET", "HEAD")
def cumul(request):
    ids = sorted(
        {
            int(i)
            for i in (request.GET.getlist("campagne_ids[]") or request.GET.getlist("campagne_ids"))
            if str(i).strip().isdigit() and int(i) > 0
        }
    )
    if not ids:
        deposer_flash(
            request,
            warning="Cochez au moins une campagne, puis cliquez sur « Voir le cumul ».",
        )
        return redirect("/rapports")

    Campagne.sync_statuts()
    # Le filtre par partenaire fait aussi office de contrôle d'accès : une
    # campagne d'un autre client tombe hors du compte et la sélection est
    # rejetée, plutôt que d'être cumulée en silence.
    campagnes = list(
        filtrer_campagnes(
            Campagne.objects.filter(id__in=ids), partenaire_courant(request)
        ).order_by("-date_debut", "-id")
    )
    if len(campagnes) != len(ids):
        deposer_flash(request, warning="Sélection de campagnes invalide.")
        return redirect("/rapports")

    # Le cumul est bâti sur `ventes` : mélanger les types, ou ne sélectionner
    # que de l'enrôlement, produirait un cumul silencieusement vide.
    types = {c.type for c in campagnes}
    if len(types) > 1:
        deposer_flash(
            request,
            warning="Impossible de cumuler des campagnes de types différents (vente et enrôlement).",
        )
        return redirect("/rapports")
    if types == {TypeCampagne.ENROLEMENT_APP}:
        deposer_flash(
            request,
            warning="Le cumul multi-campagnes n’est pas encore disponible pour les campagnes d’enrôlement.",
        )
        return redirect("/rapports")

    campagne_ids = [c.id for c in campagnes]
    base = Vente.objects.filter(campagne_id__in=campagne_ids)
    total_ventes = base.count()

    par_commercial = list(
        base.values("user_id").annotate(total=Count("id")).order_by("-total")
    )
    utilisateurs = {
        u.id: u for u in User.objects.filter(id__in=[l["user_id"] for l in par_commercial])
    }

    par_agence = list(
        base.values("agence_id").annotate(total=Count("id")).order_by("-total")
    )
    ids_agences = {l["agence_id"] for l in par_agence if l["agence_id"]} | {
        u.agence_id for u in utilisateurs.values() if u.agence_id
    }
    noms_agences = dict(
        Agence.objects.filter(id__in=ids_agences).values_list("id", "nom")
    )

    par_type = list(
        base.values("type_carte_id").annotate(total=Count("id")).order_by("-total")
    )
    codes_types = dict(
        TypeCarte.objects.filter(
            id__in={l["type_carte_id"] for l in par_type if l["type_carte_id"]}
        ).values_list("id", "code")
    )

    ventes_par_client = {
        l["client_id"]: l["cnt"]
        for l in base.values("client_id").annotate(cnt=Count("id"))
    }
    clients = list(
        Client.objects.select_related("user__agence", "type_carte")
        .filter(id__in=[i for i in ventes_par_client if i])
        .order_by("nom", "prenom", "id")
    )

    types_kpi = [
        {
            "code": codes_types.get(l["type_carte_id"], "?") if l["type_carte_id"] else "—",
            "total": int(l["total"]),
            "pct": round(100 * l["total"] / total_ventes, 1) if total_ventes > 0 else 0.0,
        }
        for l in par_type
    ]

    debut = _debut_jour(min(c.date_debut for c in campagnes))
    fin = _fin_jour(max(c.date_fin for c in campagnes))

    ventes = base.select_related(
        "client", "user", "agence", "type_carte", "campagne"
    ).order_by("-created_at", "-id")

    return render(
        request,
        "Rapports/Cumul",
        {
            "campagnes": [
                {
                    "nom": c.nom,
                    "date_debut": c.date_debut.strftime("%d/%m/%Y"),
                    "date_fin": c.date_fin.strftime("%d/%m/%Y"),
                    "statut": c.statut_effectif,
                }
                for c in campagnes
            ],
            "periode": {
                "debut": debut.strftime("%d/%m/%Y"),
                "fin": fin.strftime("%d/%m/%Y"),
            },
            "totalVentes": total_ventes,
            "nbClientsDistincts": len(clients),
            "nbCommerciauxAvecVentes": len(par_commercial),
            "nbAgencesAvecVentes": sum(1 for l in par_agence if l["agence_id"] is not None),
            # Vrai dès qu'une des campagnes cumulées porte un réseau d'agences.
            "aDesAgences": any(c.agences_perimetre() for c in campagnes),
            "typesCarteKpi": types_kpi,
            "chartTypes": [
                {"code": t["code"], "total_ventes": t["total"]} for t in types_kpi
            ],
            "chartCommerciaux": _repartir_en_graphique(
                [
                    {"label": _nom(utilisateurs.get(l["user_id"])), "total": int(l["total"])}
                    for l in par_commercial
                ],
                5,
                "Autres commerciaux",
                avec_part=True,
                total=total_ventes,
            ),
            "chartAgences": _repartir_en_graphique(
                [
                    {
                        "label": noms_agences.get(l["agence_id"], "?")
                        if l["agence_id"]
                        else "— Sans agence",
                        "total": int(l["total"]),
                    }
                    for l in par_agence
                ],
                10,
                "Autres agences",
            ),
            "parCommercial": [
                {
                    "nom": _nom(utilisateurs.get(l["user_id"])),
                    "agence_nom": noms_agences.get(
                        getattr(utilisateurs.get(l["user_id"]), "agence_id", None), "—"
                    )
                    if getattr(utilisateurs.get(l["user_id"]), "agence_id", None)
                    else "—",
                    "total": int(l["total"]),
                }
                for l in par_commercial
            ],
            "parAgence": [
                {
                    "nom": noms_agences.get(l["agence_id"], "?")
                    if l["agence_id"]
                    else "— Sans agence",
                    "total": int(l["total"]),
                }
                for l in par_agence
            ],
            "clients": [
                {
                    "id": c.id,
                    "nom_complet": f"{c.prenom} {c.nom}".strip(),
                    "telephone": c.telephone,
                    "ville": c.ville,
                    "type_carte": c.type_carte.code if c.type_carte_id else "?",
                    "commercial": _nom(c.user) if c.user_id else "—",
                    "nb_ventes": int(ventes_par_client.get(c.id, 0)),
                }
                for c in clients
            ],
            "ventes": paginer(
                request,
                ventes,
                30,
                lambda v: {
                    "date": v.created_at.strftime("%d/%m/%Y %H:%M"),
                    "campagne_nom": v.campagne.nom if v.campagne_id else None,
                    "client_nom": f"{v.client.prenom} {v.client.nom}".strip(),
                    "type_carte": v.type_carte.code if v.type_carte_id else "?",
                    "commercial": _nom(v.user),
                    "agence_nom": v.agence.nom if v.agence_id else "—",
                    "statut_activation": v.statut_activation,
                },
            ),
            "exportQuery": {"campagne_ids": campagne_ids},
        },
    )


# ---------------------------------------------------------------------------
# Liste des ventes d'une campagne
# ---------------------------------------------------------------------------


@role_required(Role.ADMIN, Role.DIRECTION)
@http_methods("GET", "HEAD")
def campagne_ventes(request, campagne):
    campagne = _campagne_du_perimetre(request, campagne)
    est_enrolement = campagne.type == TypeCampagne.ENROLEMENT_APP
    debut, fin, agence_id, user_id = _filtres_synthese(request, campagne)
    type_carte_id = None if est_enrolement else _entier(request.GET.get("type_carte_id"))

    modele = EnrolementClient if est_enrolement else Vente
    base = modele.objects.filter(campagne_id=campagne.id, created_at__range=(debut, fin))
    if agence_id is not None:
        base = base.filter(agence_id=agence_id)
    if user_id is not None:
        base = base.filter(user_id=user_id)
    if type_carte_id is not None:
        base = base.filter(type_carte_id=type_carte_id)

    if est_enrolement:
        lignes = base.select_related("user", "agence")

        def formater(e):
            return {
                "id": e.id,
                "client_id": None,
                "date": e.created_at.strftime("%d/%m/%Y %H:%M"),
                "client_nom": f"{e.prenom} {e.nom}".strip(),
                "numero_compte": e.numero_compte,
                "telephone": e.telephone,
                "adresse": e.adresse,
                "type_carte": None,
                "commercial": _nom(e.user),
                "agence_nom": e.agence.nom if e.agence_id else "—",
                "statut_activation": None,
            }
    else:
        lignes = base.select_related("client", "user", "agence", "type_carte", "campagne")

        def formater(v):
            return {
                "id": v.id,
                "client_id": v.client_id,
                "date": v.created_at.strftime("%d/%m/%Y %H:%M"),
                "client_nom": f"{v.client.prenom} {v.client.nom}".strip(),
                "numero_compte": None,
                "telephone": v.client.telephone,
                "adresse": v.client.ville,
                "type_carte": v.type_carte.code if v.type_carte_id else "?",
                "commercial": _nom(v.user),
                "agence_nom": v.agence.nom if v.agence_id else "—",
                "statut_activation": v.statut_activation,
            }

    return render(
        request,
        "Rapports/CampagneVentes",
        {
            "campagne": {
                "id": campagne.id,
                "nom": campagne.nom,
                "date_debut": campagne.date_debut.strftime("%d/%m/%Y"),
                "date_fin": campagne.date_fin.strftime("%d/%m/%Y"),
                "date_debut_iso": campagne.date_debut.strftime("%Y-%m-%d"),
                "date_fin_iso": campagne.date_fin.strftime("%Y-%m-%d"),
            },
            "estEnrolement": est_enrolement,
            "periode": {
                "debut": debut.strftime("%d/%m/%Y"),
                "fin": fin.strftime("%d/%m/%Y"),
            },
            "filtres": {
                "du": request.GET.get("du", debut.strftime("%Y-%m-%d")),
                "au": request.GET.get("au", fin.strftime("%Y-%m-%d")),
                "agence_id": agence_id,
                "user_id": user_id,
                "type_carte_id": type_carte_id,
            },
            "agencesChoix": [
                {"id": a.id, "nom": a.nom} for a in campagne.agences_perimetre()
            ],
            "commerciauxChoix": [
                {"id": u.id, "nom": _nom(u)}
                for u in campagne.query_commerciaux_perimetre().order_by("name")
            ],
            "typesChoix": []
            if est_enrolement
            else [
                {"id": t.id, "code": t.code} for t in TypeCarte.objects.order_by("code")
            ],
            "resumeListe": {"count": base.count()},
            "qListe": tableau(
                {
                    cle: request.GET.get(cle)
                    for cle in ("du", "au", "agence_id", "user_id", "type_carte_id")
                    if request.GET.get(cle)
                }
            ),
            "ventes": paginer(
                request, lignes.order_by("-created_at", "-id"), 25, formater
            ),
        },
    )


# ---------------------------------------------------------------------------
# Clients d'une campagne
# ---------------------------------------------------------------------------


@role_required(Role.ADMIN, Role.DIRECTION)
@http_methods("GET", "HEAD")
def campagne_clients(request, campagne):
    campagne = _campagne_du_perimetre(request, campagne)

    if campagne.type == TypeCampagne.ENROLEMENT_APP:
        enrolements = (
            EnrolementClient.objects.select_related("user")
            .filter(campagne_id=campagne.id)
            .order_by("nom", "prenom", "id")
        )
        clients = [
            {
                "id": e.id,
                "nom_complet": f"{e.prenom} {e.nom}".strip(),
                "numero_compte": e.numero_compte,
                "telephone": e.telephone,
                "ville": e.adresse,
                "type_carte": None,
                "commercial": e.user.name if e.user_id else "—",
            }
            for e in enrolements
        ]
    else:
        ids = (
            Vente.objects.filter(campagne_id=campagne.id)
            .exclude(client_id__isnull=True)
            .values_list("client_id", flat=True)
            .distinct()
        )
        clients = [
            {
                "id": c.id,
                "nom_complet": f"{c.prenom} {c.nom}".strip(),
                "telephone": c.telephone,
                "ville": c.ville,
                "type_carte": c.type_carte.code if c.type_carte_id else "?",
                "commercial": c.user.name if c.user_id else "—",
            }
            for c in Client.objects.select_related("user__agence", "type_carte")
            .filter(id__in=list(ids))
            .order_by("nom", "prenom", "id")
        ]

    return render(
        request,
        "Rapports/CampagneClients",
        {
            "campagne": {"id": campagne.id, "nom": campagne.nom},
            "estEnrolement": campagne.type == TypeCampagne.ENROLEMENT_APP,
            "clients": clients,
        },
    )


# ---------------------------------------------------------------------------
# Synthèse d'une campagne
# ---------------------------------------------------------------------------


@role_required(Role.ADMIN, Role.DIRECTION)
@http_methods("GET", "HEAD")
def campagne_synthese(request, campagne):
    campagne = _campagne_du_perimetre(request, campagne)
    Campagne.sync_statuts()

    debut, fin, agence_id, user_id = _filtres_synthese(request, campagne)
    est_enrolement = campagne.type == TypeCampagne.ENROLEMENT_APP

    synthese = services.synthese_campagne(campagne, debut, fin, agence_id, user_id)

    # Le reporting téléphonique n'a pas d'équivalent pour l'enrôlement.
    telephonique = (
        None
        if est_enrolement
        else agregats_telephonique(campagne, debut, fin, agence_id, user_id)
    )

    total = int(synthese["resume"]["total_ventes"])

    return render(
        request,
        "Rapports/CampagneSynthese",
        {
            "campagne": {
                "id": campagne.id,
                "nom": campagne.nom,
                "date_debut_iso": campagne.date_debut.strftime("%Y-%m-%d"),
                "date_fin_iso": campagne.date_fin.strftime("%Y-%m-%d"),
            },
            "estEnrolement": est_enrolement,
            "periode": {
                "debut": debut.strftime("%d/%m/%Y"),
                "fin": fin.strftime("%d/%m/%Y"),
            },
            "filtres": {
                "du": request.GET.get("du", debut.strftime("%Y-%m-%d")),
                "au": request.GET.get("au", fin.strftime("%Y-%m-%d")),
                "agence_id": agence_id,
                "user_id": user_id,
            },
            "agencesChoix": [
                {"id": a.id, "nom": a.nom} for a in campagne.agences_perimetre()
            ],
            "commerciauxChoix": [
                {"id": u.id, "nom": _nom(u)}
                for u in campagne.query_commerciaux_perimetre().order_by("name")
            ],
            "resume": synthese["resume"],
            "commerciaux": synthese["commerciaux"],
            "agences": synthese["agences"],
            "parTypeCarte": synthese["par_type_carte"],
            "parSemaine": synthese["par_semaine"],
            "parMois": synthese["par_mois"],
            "telephonique": telephonique,
            "chartCommerciaux": _repartir_en_graphique(
                [
                    {"label": c["user_name"], "total": c["total_ventes"]}
                    for c in synthese["commerciaux"]
                ],
                5,
                "Autres commerciaux",
                avec_part=True,
                total=total,
            ),
            "chartAgences": _repartir_en_graphique(
                [
                    {"label": a["agence_nom"], "total": a["total_ventes"]}
                    for a in synthese["agences"]
                ],
                10,
                "Autres agences",
            ),
            "qExp": tableau(
                {
                    cle: request.GET.get(cle)
                    for cle in ("du", "au", "agence_id", "user_id")
                    if request.GET.get(cle)
                }
            ),
        },
    )


# ---------------------------------------------------------------------------
# Reporting téléphonique d'une campagne
# ---------------------------------------------------------------------------


def _dates_reporting(request, campagne):
    debut_campagne = _debut_jour(campagne.date_debut)
    fin_campagne = _fin_jour(campagne.date_fin)

    du, au = request.GET.get("date_debut"), request.GET.get("date_fin")
    debut = _debut_jour(date.fromisoformat(du)) if du else debut_campagne
    fin = _fin_jour(date.fromisoformat(au)) if au else fin_campagne

    debut, fin = max(debut, debut_campagne), min(fin, fin_campagne)
    if debut > fin:
        debut, fin = debut_campagne, fin_campagne
    return debut, fin


@role_required(Role.ADMIN, Role.DIRECTION)
@http_methods("GET", "HEAD")
def campagne_reporting_telephonique(request, campagne):
    campagne = _campagne_du_perimetre(request, campagne)
    Campagne.sync_statuts()

    debut, fin = _dates_reporting(request, campagne)
    agence_id = _entier(request.GET.get("agence_id"))
    user_id = _entier(request.GET.get("user_id"))

    base = rapports_telephoniques_campagne(campagne, debut, fin, agence_id, user_id)

    telephoniques = User.objects.select_related("agence").filter(
        role=Role.COMMERCIAL_TELEPHONIQUE
    )
    ids_agences = list(campagne.agences.values_list("id", flat=True))
    if not campagne.toutes_agences and ids_agences:
        telephoniques = telephoniques.filter(agence_id__in=ids_agences)

    return render(
        request,
        "Rapports/CampagneReportingTelephonique",
        {
            "campagne": {
                "id": campagne.id,
                "nom": campagne.nom,
                "date_debut_iso": campagne.date_debut.strftime("%Y-%m-%d"),
                "date_fin_iso": campagne.date_fin.strftime("%Y-%m-%d"),
            },
            "periode": {
                "debut": debut.strftime("%d/%m/%Y"),
                "fin": fin.strftime("%d/%m/%Y"),
            },
            "filtres": {
                "date_debut": request.GET.get("date_debut", debut.strftime("%Y-%m-%d")),
                "date_fin": request.GET.get("date_fin", fin.strftime("%Y-%m-%d")),
                "user_id": user_id,
                "agence_id": agence_id,
            },
            "telephoniques": [
                {
                    "id": t.id,
                    "label": f"{_nom(t)} — {t.agence.nom if t.agence_id else ''}",
                }
                for t in telephoniques.order_by("name")
            ],
            "agencesChoix": [
                {"id": a.id, "nom": a.nom} for a in campagne.agences_perimetre()
            ],
            "agregats": agregats_telephonique(campagne, debut, fin, agence_id, user_id),
            "isAdmin": bool(request.user.is_admin),
            "exportQuery": tableau(
                {
                    cle: valeur
                    for cle, valeur in {
                        "campagne_id": campagne.id,
                        "user_id": request.GET.get("user_id"),
                        "date_debut": request.GET.get(
                            "date_debut", debut.strftime("%Y-%m-%d")
                        ),
                        "date_fin": request.GET.get("date_fin", fin.strftime("%Y-%m-%d")),
                    }.items()
                    if valeur not in (None, "")
                }
            ),
            "rapports": paginer(
                request,
                base.select_related("user__agence", "campagne").order_by(
                    "-date_rapport", "-id"
                ),
                30,
                lambda r: {
                    "id": r.id,
                    "date": r.date_rapport.strftime("%d/%m/%Y"),
                    "campagne_nom": r.campagne.nom if r.campagne_id else None,
                    "user_nom": _nom(r.user) if r.user_id else None,
                    "agence_nom": r.user.agence.nom
                    if r.user_id and r.user.agence_id
                    else None,
                    "appels_emis": r.appels_emis,
                    "appels_joignables": r.appels_joignables,
                    "appels_non_joignables": r.appels_non_joignables,
                    "clients_interesses_nombre": r.clients_interesses_nombre,
                    "clients_deja_servis_nombre": r.clients_deja_servis_nombre,
                    "cartes_resume": r.resume_cartes_proposees(),
                },
            ),
        },
    )


def _pourcentage_affiche(valeur_base, valeur_calculee):
    """« 12,34 % (base) » si la colonne est renseignée, sinon la valeur recalculée."""
    if valeur_base is not None:
        return f"{nombre_format(valeur_base, 2)} % (base)"
    if valeur_calculee is not None:
        return f"{nombre_format(valeur_calculee, 2)} % (sur appels émis)"
    return None


@role_required(Role.ADMIN, Role.DIRECTION)
@http_methods("GET", "HEAD")
def campagne_reporting_telephonique_show(request, campagne, telephoniqueRapport):
    campagne = _campagne_du_perimetre(request, campagne)
    rapport = get_object_or_404(
        TelephoniqueRapport.objects.select_related("user__agence", "campagne"),
        pk=telephoniqueRapport,
    )

    # La fiche doit appartenir au périmètre de la campagne, pas seulement exister.
    dans_perimetre = rapports_telephoniques_campagne(
        campagne, _debut_jour(campagne.date_debut), _fin_jour(campagne.date_fin)
    ).filter(pk=rapport.pk).exists()
    if not dans_perimetre:
        raise Http404

    codes = dict(TypeCarte.objects.order_by("code").values_list("id", "code"))
    cartes = [
        {"code": codes.get(int(id_type), f"#{id_type}"), "quantite": int(nombre)}
        for id_type, nombre in (rapport.cartes_proposees or {}).items()
        if int(nombre or 0) > 0
    ]

    from urllib.parse import urlencode

    filtres_retour = {
        cle: request.GET.get(cle)
        for cle in ("date_debut", "date_fin", "user_id", "agence_id")
        if request.GET.get(cle)
    }
    url_retour = request.build_absolute_uri(
        f"/rapports/campagnes/{campagne.id}/reporting-telephonique"
        + (f"?{urlencode(filtres_retour)}" if filtres_retour else "")
    )

    taux = (
        f"{nombre_format(rapport.taux_joignabilite, 2)} %"
        if rapport.taux_joignabilite is not None
        else (
            f"{nombre_format(rapport.appels_joignables / rapport.appels_emis * 100, 2)} % (recalculé)"
            if rapport.appels_emis > 0
            else None
        )
    )

    return render(
        request,
        "Admin/TelephoniqueRapports/Show",
        {
            "backUrl": url_retour,
            "rapport": {
                "user_nom": _nom(rapport.user) if rapport.user_id else None,
                "date_rapport": rapport.date_rapport.strftime("%d/%m/%Y"),
                "campagne_nom": rapport.campagne.nom if rapport.campagne_id else None,
                "agence_nom": rapport.user.agence.nom
                if rapport.user_id and rapport.user.agence_id
                else None,
                "created_at": rapport.created_at.strftime("%d/%m/%Y %H:%M")
                if rapport.created_at
                else None,
                "coherent": rapport.nj_analyse_coherente(),
                "somme_nj_motifs": rapport.somme_nj_motifs(),
                "appels_emis": rapport.appels_emis,
                "appels_joignables": rapport.appels_joignables,
                "appels_non_joignables": rapport.appels_non_joignables,
                "appels_non_joignables_calcule": max(
                    0, rapport.appels_emis - rapport.appels_joignables
                ),
                "taux_joignabilite": taux,
                "clients_interesses_nombre": rapport.clients_interesses_nombre,
                "clients_interesses_pct": _pourcentage_affiche(
                    rapport.clients_interesses_pct, rapport.pct_interesses_calcule()
                ),
                "clients_deja_servis_nombre": rapport.clients_deja_servis_nombre,
                "clients_deja_servis_pct": _pourcentage_affiche(
                    rapport.clients_deja_servis_pct, rapport.pct_deja_servis_calcule()
                ),
                "cartes": cartes,
                "cartes_resume": rapport.resume_cartes_proposees(),
                "nj_repondeur": rapport.nj_repondeur,
                "nj_numero_errone": rapport.nj_numero_errone,
                "nj_hors_reseau": rapport.nj_hors_reseau,
                "nj_autres_nombre": rapport.nj_autres_nombre,
                "nj_autres_precision": rapport.nj_autres_precision,
            },
        },
    )


# ---------------------------------------------------------------------------
# Reporting téléphonique — vue admin transverse (toutes campagnes)
# ---------------------------------------------------------------------------


def _rapports_telephoniques_filtres(request):
    """
    Fiches filtrées de l'écran admin.

    Avec une campagne choisie, on réutilise le périmètre de cette campagne
    (fiches rattachées + orphelines) ; sinon on filtre à plat et on borne aux
    campagnes de vente de référence.
    """
    partenaire = partenaire_courant(request)
    campagne_id = request.GET.get("campagne_id")
    if campagne_id:
        campagne = filtrer_campagnes(
            Campagne.objects.filter(pk=campagne_id), partenaire
        ).first()
        if campagne is None:
            return TelephoniqueRapport.objects.none()
        du = request.GET.get("date_debut")
        au = request.GET.get("date_fin")
        debut = _debut_jour(date.fromisoformat(du)) if du else _debut_jour(campagne.date_debut)
        fin = _fin_jour(date.fromisoformat(au)) if au else _fin_jour(campagne.date_fin)
        return rapports_telephoniques_campagne(
            campagne, debut, fin, None, _entier(request.GET.get("user_id"))
        )

    qs = filtrer_saisies(TelephoniqueRapport.objects.all(), partenaire)
    if request.GET.get("user_id"):
        qs = qs.filter(user_id=int(request.GET["user_id"]))
    if request.GET.get("date_debut"):
        qs = qs.filter(date_rapport__gte=request.GET["date_debut"])
    if request.GET.get("date_fin"):
        qs = qs.filter(date_rapport__lte=request.GET["date_fin"])

    from terrain.services import restreindre_aux_campagnes_vente

    return restreindre_aux_campagnes_vente(
        qs, None, partenaire.id if partenaire else None
    )


@role_required(Role.ADMIN)
@http_methods("GET", "HEAD")
def telephonique_admin_index(request):
    from campagnes.services import totaux_telephonique

    base = _rapports_telephoniques_filtres(request)

    return render(
        request,
        "Admin/TelephoniqueRapports/Index",
        {
            "filters": tableau(
                {
                    cle: request.GET.get(cle)
                    for cle in ("user_id", "campagne_id", "date_debut", "date_fin")
                    if request.GET.get(cle)
                }
            ),
            # Le libellé de périmètre n'a de sens que sans campagne explicite.
            "libelleStatsCampagne": None
            if request.GET.get("campagne_id")
            else libelle_stats(
                None,
                TypeCampagne.VENTE_CARTE,
                (partenaire_courant(request).id if partenaire_courant(request) else None),
            ),
            "telephoniques": [
                {
                    "id": t.id,
                    "label": f"{_nom(t)} — {t.agence.nom if t.agence_id else ''}",
                }
                for t in User.objects.select_related("agence")
                .filter(role=Role.COMMERCIAL_TELEPHONIQUE)
                .order_by("name")
            ],
            "campagnes": [
                {
                    "id": c.id,
                    "label": f"{c.nom} ({c.date_debut.strftime('%d/%m/%y')}–{c.date_fin.strftime('%d/%m/%y')})",
                }
                for c in Campagne.objects.order_by("-date_debut")
            ],
            "totauxListe": totaux_telephonique(base),
            "rapports": paginer(
                request,
                base.select_related("user__agence", "campagne").order_by(
                    "-date_rapport", "-id"
                ),
                30,
                lambda r: {
                    "id": r.id,
                    "date": r.date_rapport.strftime("%d/%m/%Y"),
                    "campagne_nom": r.campagne.nom if r.campagne_id else None,
                    "user_nom": _nom(r.user) if r.user_id else None,
                    "agence_nom": r.user.agence.nom
                    if r.user_id and r.user.agence_id
                    else None,
                    "appels_emis": r.appels_emis,
                    "appels_joignables": r.appels_joignables,
                    "appels_non_joignables": r.appels_non_joignables,
                    "clients_interesses_nombre": r.clients_interesses_nombre,
                    "clients_deja_servis_nombre": r.clients_deja_servis_nombre,
                    "cartes_resume": r.resume_cartes_proposees(),
                },
            ),
        },
    )


@role_required(Role.ADMIN)
@http_methods("GET", "HEAD")
def telephonique_admin_show(request, telephoniqueRapport):
    rapport = get_object_or_404(
        TelephoniqueRapport.objects.select_related("user__agence", "campagne"),
        pk=telephoniqueRapport,
    )
    codes = dict(TypeCarte.objects.order_by("code").values_list("id", "code"))
    cartes = [
        {"code": codes.get(int(id_type), f"#{id_type}"), "quantite": int(nombre)}
        for id_type, nombre in (rapport.cartes_proposees or {}).items()
        if int(nombre or 0) > 0
    ]

    taux = (
        f"{nombre_format(rapport.taux_joignabilite, 2)} %"
        if rapport.taux_joignabilite is not None
        else (
            f"{nombre_format(rapport.appels_joignables / rapport.appels_emis * 100, 2)} % (recalculé)"
            if rapport.appels_emis > 0
            else None
        )
    )

    return render(
        request,
        "Admin/TelephoniqueRapports/Show",
        {
            "rapport": {
                "user_nom": _nom(rapport.user) if rapport.user_id else None,
                "date_rapport": rapport.date_rapport.strftime("%d/%m/%Y"),
                "campagne_nom": rapport.campagne.nom if rapport.campagne_id else None,
                "agence_nom": rapport.user.agence.nom
                if rapport.user_id and rapport.user.agence_id
                else None,
                "created_at": rapport.created_at.strftime("%d/%m/%Y %H:%M")
                if rapport.created_at
                else None,
                "coherent": rapport.nj_analyse_coherente(),
                "somme_nj_motifs": rapport.somme_nj_motifs(),
                "appels_emis": rapport.appels_emis,
                "appels_joignables": rapport.appels_joignables,
                "appels_non_joignables": rapport.appels_non_joignables,
                "appels_non_joignables_calcule": max(
                    0, rapport.appels_emis - rapport.appels_joignables
                ),
                "taux_joignabilite": taux,
                "clients_interesses_nombre": rapport.clients_interesses_nombre,
                "clients_interesses_pct": _pourcentage_affiche(
                    rapport.clients_interesses_pct, rapport.pct_interesses_calcule()
                ),
                "clients_deja_servis_nombre": rapport.clients_deja_servis_nombre,
                "clients_deja_servis_pct": _pourcentage_affiche(
                    rapport.clients_deja_servis_pct, rapport.pct_deja_servis_calcule()
                ),
                "cartes": cartes,
                "cartes_resume": rapport.resume_cartes_proposees(),
                "nj_repondeur": rapport.nj_repondeur,
                "nj_numero_errone": rapport.nj_numero_errone,
                "nj_hors_reseau": rapport.nj_hors_reseau,
                "nj_autres_nombre": rapport.nj_autres_nombre,
                "nj_autres_precision": rapport.nj_autres_precision,
            }
        },
    )


# ---------------------------------------------------------------------------
# Référentiel direction
# ---------------------------------------------------------------------------


@role_required(Role.DIRECTION)
@http_methods("GET", "HEAD")
def direction_types_cartes(request):
    return render(
        request,
        "Direction/Referentiel/TypesCartes",
        {
            "typesCartes": list(
                TypeCarte.objects.order_by("code").values_list("code", flat=True)
            )
        },
    )
