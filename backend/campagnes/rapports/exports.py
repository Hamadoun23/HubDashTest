"""
Exports des rapports et de l'écran Performances : CSV, Excel et Word.

Portage des méthodes `export*` de Admin/RapportController,
Admin/TelephoniqueRapportController et PerformanceController.
"""

import csv
import io
from datetime import date, datetime, timedelta

from django.db.models import Count
from django.http import Http404, HttpResponse
from django.shortcuts import get_object_or_404, redirect

from campagnes.models import Campagne, TypeCampagne
from campagnes.services import agregats_telephonique, rapports_telephoniques_campagne
from core.decorators import http_methods, role_required
from core.exports import graphiques as gr
from core.exports.tableur import (
    classeur_multi_feuilles,
    classeur_simple,
    horodatage,
    reponse_xlsx,
)
from core.middleware import deposer_flash
from core.models import Agence, Role, TypeCarte, User
from core.partenaires import filtrer_campagnes, filtrer_saisies, partenaire_courant
from terrain.exports import (
    ENTETES_FICHES_TEL,
    lignes_fiches_telephoniques,
    totaux_fiches_telephoniques,
    _date_longue,
    _nom,
)
from terrain.models import Client, EnrolementClient, TelephoniqueRapport, Vente
from terrain.services import ids_pour_stats

from . import performances, services, views


def reponse_csv(nom_fichier, entetes, lignes, avec_bom=True):
    """
    Réponse CSV au format attendu par Excel francophone : séparateur `;` et
    BOM UTF-8, sans quoi les accents s'affichent mal à l'ouverture.
    """
    tampon = io.StringIO()
    if avec_bom:
        tampon.write("﻿")
    redacteur = csv.writer(tampon, delimiter=";", lineterminator="\r\n")
    redacteur.writerow(entetes)
    redacteur.writerows(lignes)

    reponse = HttpResponse(tampon.getvalue(), content_type="text/csv; charset=UTF-8")
    reponse["Content-Disposition"] = f'attachment; filename="{nom_fichier}"'
    return reponse


# ---------------------------------------------------------------------------
# Rapport de ventes périodique
# ---------------------------------------------------------------------------

ENTETES_VENTES = [
    "Date", "Campagne", "Client", "Téléphone", "Type carte", "Commercial", "Agence", "Statut",
]


def _ligne_vente(v):
    return [
        v.created_at.strftime("%d/%m/%Y %H:%M"),
        v.campagne.nom if v.campagne_id else "-",
        f"{v.client.prenom} {v.client.nom}".strip() if v.client_id else "-",
        v.client.telephone or "" if v.client_id else "",
        v.type_carte.code if v.type_carte_id else "-",
        _nom(v.user),
        v.agence.nom if v.agence_id else "",
        v.statut_activation or "",
    ]


@role_required(Role.ADMIN, Role.DIRECTION)
@http_methods("GET", "HEAD")
def export_ventes_periode(request):
    """Portage de RapportController::export() — CSV ou XLSX, hebdo ou mensuel."""
    type_rapport = request.GET.get("type", "mensuel")
    agence_id = request.GET.get("agence") or None
    reference = request.GET.get("date") or datetime.now().strftime("%Y-%m")

    premier = date.fromisoformat(reference + "-01")
    if type_rapport == "hebdomadaire":
        debut = premier - timedelta(days=premier.weekday())
        fin = debut + timedelta(days=6)
    else:
        debut = premier
        suivant = (premier + timedelta(days=32)).replace(day=1)
        fin = suivant - timedelta(days=1)

    from terrain.services import restreindre_aux_campagnes_vente

    partenaire = partenaire_courant(request)
    ventes = filtrer_saisies(
        Vente.objects.select_related(
            "client", "user", "agence", "type_carte", "campagne"
        ),
        partenaire,
    ).filter(created_at__range=(views._debut_jour(debut), views._fin_jour(fin)))
    ventes = restreindre_aux_campagnes_vente(
        ventes,
        int(agence_id) if agence_id else None,
        partenaire.id if partenaire else None,
    )
    if agence_id:
        ventes = ventes.filter(agence_id=agence_id)
    ventes = ventes.order_by("created_at", "id")

    lignes = [_ligne_vente(v) for v in ventes]
    nom_base = f"rapport_ventes_{type_rapport}_{debut.strftime('%Y-%m-%d')}"

    if request.GET.get("format", "csv").lower() == "xlsx":
        return reponse_xlsx(
            classeur_simple(f"Ventes {type_rapport}", ENTETES_VENTES, lignes),
            f"{nom_base}.xlsx",
        )

    # Laravel n'ajoute pas de BOM sur cet export précis.
    return reponse_csv(f"{nom_base}.csv", ENTETES_VENTES, lignes, avec_bom=False)


# ---------------------------------------------------------------------------
# Export d'une campagne
# ---------------------------------------------------------------------------


def _lignes_detail_campagne(campagne, debut, fin, agence_id, user_id, type_carte_id):
    """En-têtes et lignes du détail — ventes ou enrôlements selon le type."""
    if campagne.type == TypeCampagne.ENROLEMENT_APP:
        lignes = EnrolementClient.objects.select_related(
            "user", "agence", "campagne"
        ).filter(campagne_id=campagne.id, created_at__range=(debut, fin))
        if agence_id is not None:
            lignes = lignes.filter(agence_id=agence_id)
        if user_id is not None:
            lignes = lignes.filter(user_id=user_id)

        return (
            [
                "Date",
                "Campagne",
                "Client",
                "N° de compte",
                "Téléphone",
                "Adresse",
                "Commercial",
                "Agence",
            ],
            [
                [
                    e.created_at.strftime("%d/%m/%Y %H:%M"),
                    e.campagne.nom if e.campagne_id else "-",
                    f"{e.prenom} {e.nom}".strip(),
                    e.numero_compte or "",
                    e.telephone or "",
                    e.adresse or "",
                    _nom(e.user),
                    e.agence.nom if e.agence_id else "",
                ]
                for e in lignes.order_by("created_at", "id")
            ],
        )

    ventes = Vente.objects.select_related(
        "client", "user", "agence", "type_carte", "campagne"
    ).filter(campagne_id=campagne.id, created_at__range=(debut, fin))
    if agence_id is not None:
        ventes = ventes.filter(agence_id=agence_id)
    if user_id is not None:
        ventes = ventes.filter(user_id=user_id)
    if type_carte_id is not None:
        ventes = ventes.filter(type_carte_id=type_carte_id)

    return ENTETES_VENTES, [_ligne_vente(v) for v in ventes.order_by("created_at", "id")]


#: Sections exportables, par type de campagne.
SECTIONS_CSV_VENTE = ["ventes", "commerciaux", "agences", "types", "semaines", "mois"]
SECTIONS_CSV_ENROLEMENT = ["ventes", "commerciaux", "agences", "semaines", "mois"]


@role_required(Role.ADMIN, Role.DIRECTION)
@http_methods("GET", "HEAD")
def export_campagne(request, campagne):
    campagne = get_object_or_404(Campagne, pk=campagne)
    est_enrolement = campagne.type == TypeCampagne.ENROLEMENT_APP

    format_demande = request.GET.get("format", "csv").lower()
    section = request.GET.get("section", "ventes")

    autorisees = SECTIONS_CSV_ENROLEMENT if est_enrolement else SECTIONS_CSV_VENTE
    if format_demande == "xlsx":
        autorisees = [*autorisees, "all"]
    if section not in autorisees:
        raise Http404

    debut, fin, agence_id, user_id = views._filtres_synthese(request, campagne)
    type_carte_id = (
        None if est_enrolement else views._entier(request.GET.get("type_carte_id"))
    )

    if format_demande == "xlsx" and section == "all":
        return _classeur_campagne_complet(
            campagne, debut, fin, agence_id, user_id, type_carte_id
        )

    libelle = gr.libelle_volume(est_enrolement)
    nom_base = f"rapport_campagne_{campagne.id}_{section}_{debut.strftime('%Y-%m-%d')}"

    if section == "ventes":
        entetes, lignes = _lignes_detail_campagne(
            campagne, debut, fin, agence_id, user_id, type_carte_id
        )
        titre = "Enrôlements détaillés" if est_enrolement else "Ventes détaillées"
    else:
        synthese = services.synthese_campagne(campagne, debut, fin, agence_id, user_id)
        entetes, lignes, titre = _section_synthese(section, synthese, libelle)

    if format_demande == "xlsx":
        return reponse_xlsx(classeur_simple(titre, entetes, lignes), f"{nom_base}.xlsx")
    return reponse_csv(f"{nom_base}.csv", entetes, lignes)


def _section_synthese(section, synthese, libelle):
    """En-têtes, lignes et titre d'onglet d'une section de synthèse."""
    if section == "commerciaux":
        return (
            ["Rang", "Commercial", "Agence", libelle],
            [
                [l["rang"], l["user_name"], l["agence_nom"] or "", l["total_ventes"]]
                for l in synthese["commerciaux"]
            ],
            "Commerciaux",
        )
    if section == "agences":
        return (
            ["Agence", libelle, "Part % volume", "Nb commerciaux rattachés"],
            [
                [l["agence_nom"], l["total_ventes"], l["pct_volume"], l["nb_commerciaux"]]
                for l in synthese["agences"]
            ],
            "Agences",
        )
    if section == "types":
        return (
            ["Type carte", "Ventes", "Part % volume"],
            [
                [l["code"], l["total_ventes"], l["pct_volume"]]
                for l in synthese["par_type_carte"]
            ],
            "Types de carte",
        )
    if section == "semaines":
        return (
            ["Période", libelle],
            [[l["libelle"], l["total_ventes"]] for l in synthese["par_semaine"]],
            "Par semaine",
        )
    return (
        ["Mois", libelle],
        [[l["libelle"], l["total_ventes"]] for l in synthese["par_mois"]],
        "Par mois",
    )


def _classeur_campagne_complet(campagne, debut, fin, agence_id, user_id, type_carte_id):
    """Classeur multi-onglets reprenant l'ensemble du rapport de campagne."""
    est_enrolement = campagne.type == TypeCampagne.ENROLEMENT_APP
    libelle = gr.libelle_volume(est_enrolement)
    # Le client de cette campagne a-t-il un réseau d'agences ?
    avec_agences = bool(campagne.agences_perimetre())

    synthese = services.synthese_campagne(campagne, debut, fin, agence_id, user_id)
    entetes_detail, lignes_detail = _lignes_detail_campagne(
        campagne, debut, fin, agence_id, user_id, type_carte_id
    )

    meta = [
        f"Campagne : {campagne.nom}",
        f"Période : {debut.strftime('%d/%m/%Y')} → {fin.strftime('%d/%m/%Y')}",
        f"Généré le {_date_longue()} à {datetime.now().strftime('%H:%M')}",
    ]

    entetes_clients, lignes_clients, titre_clients = _clients_campagne(
        campagne, debut, fin, agence_id, user_id, type_carte_id
    )

    definitions = [
        {
            "titre": "Enrôlements détaillés" if est_enrolement else "Ventes détaillées",
            "titre_document": "Rapport campagne — "
            + ("Enrôlements détaillés" if est_enrolement else "Ventes détaillées"),
            "lignes_meta": meta,
            "entetes": entetes_detail,
            "lignes": lignes_detail,
            "ligne_totaux": [f"TOTAUX ({len(lignes_detail)} ligne(s))"]
            + [""] * max(0, len(entetes_detail) - 1),
        },
        {
            "titre": "Clients",
            "titre_document": titre_clients,
            "lignes_meta": meta,
            "entetes": entetes_clients,
            "lignes": lignes_clients,
            "ligne_totaux": [f"TOTAUX ({len(lignes_clients)} client(s))"]
            + [""] * max(0, len(entetes_clients) - 2)
            + [len(lignes_detail)],
        },
        {
            "titre": "Commerciaux",
            "titre_document": "Rapport campagne — Synthèse commerciaux",
            "lignes_meta": meta,
            "entetes": ["Rang", "Commercial"]
            + (["Agence"] if avec_agences else [])
            + [libelle],
            "lignes": [
                [l["rang"], l["user_name"]]
                + ([l["agence_nom"] or ""] if avec_agences else [])
                + [l["total_ventes"]]
                for l in synthese["commerciaux"]
            ],
            "ligne_totaux": ["", ""]
            + ([""] if avec_agences else [])
            + [sum(l["total_ventes"] for l in synthese["commerciaux"])],
        },
    ]

    # Pas de réseau d'agences, pas d'onglet « Agences » : il serait vide.
    if avec_agences:
        definitions.append(
            {
                "titre": "Agences",
                "titre_document": "Rapport campagne — Synthèse agences",
                "lignes_meta": meta,
                "entetes": ["Agence", libelle, "Part % volume", "Nb commerciaux"],
                "lignes": [
                    [
                        l["agence_nom"], l["total_ventes"],
                        l["pct_volume"], l["nb_commerciaux"],
                    ]
                    for l in synthese["agences"]
                ],
                "ligne_totaux": [
                    "TOTAUX",
                    sum(l["total_ventes"] for l in synthese["agences"]),
                    "", "",
                ],
            }
        )

    if not est_enrolement:
        definitions.append(
            {
                "titre": "Types de carte",
                "titre_document": "Rapport campagne — Types de carte",
                "lignes_meta": meta,
                "entetes": ["Type carte", "Ventes", "Part % volume"],
                "lignes": [
                    [l["code"], l["total_ventes"], l["pct_volume"]]
                    for l in synthese["par_type_carte"]
                ],
                "ligne_totaux": [
                    "TOTAUX",
                    sum(l["total_ventes"] for l in synthese["par_type_carte"]),
                    "",
                ],
            }
        )

    for cle, titre_onglet, titre_document, entete_periode in (
        ("par_semaine", "Par semaine", "Volume par semaine", "Période"),
        ("par_mois", "Par mois", "Volume par mois", "Mois"),
    ):
        definitions.append(
            {
                "titre": titre_onglet,
                "titre_document": f"Rapport campagne — {titre_document}",
                "lignes_meta": meta,
                "entetes": [entete_periode, libelle],
                "lignes": [[l["libelle"], l["total_ventes"]] for l in synthese[cle]],
                "ligne_totaux": [
                    "TOTAUX",
                    sum(l["total_ventes"] for l in synthese[cle]),
                ],
            }
        )

    # Le reporting téléphonique n'existe que pour les campagnes de vente.
    if not est_enrolement:
        agregats = agregats_telephonique(campagne, debut, fin, agence_id, user_id)
        fiches = list(
            rapports_telephoniques_campagne(campagne, debut, fin, agence_id, user_id)
            .select_related("user__agence", "campagne")
            .order_by("-date_rapport", "-id")
        )
        definitions += [
            {
                "titre": "Synthèse téléphonique",
                "titre_document": "Rapport campagne — Synthèse téléphonique (indicateurs agrégés)",
                "lignes_meta": meta,
                "entetes": ["Indicateur", "Valeur"],
                "lignes": [
                    ["Nombre de fiches", agregats["nb_fiches"]],
                    ["Appels émis (cumul)", agregats["appels_emis"]],
                    ["Joignables (cumul)", agregats["appels_joignables"]],
                    ["Non joignables (cumul)", agregats["appels_non_joignables"]],
                    ["Clients intéressés (cumul)", agregats["clients_interesses"]],
                    ["Clients déjà servis (cumul)", agregats["clients_deja_servis"]],
                ],
            },
            {
                "titre": "Fiches téléphonique",
                "titre_document": "Rapport campagne — Fiches reporting téléphonique (détail)",
                "lignes_meta": meta,
                "entetes": ENTETES_FICHES_TEL,
                "lignes": lignes_fiches_telephoniques(fiches),
                "ligne_totaux": totaux_fiches_telephoniques(fiches),
            },
        ]

    return reponse_xlsx(
        classeur_multi_feuilles(definitions),
        f"rapport_campagne_{campagne.id}_complet_{debut.strftime('%Y-%m-%d')}.xlsx",
    )


def _clients_campagne(campagne, debut, fin, agence_id, user_id, type_carte_id):
    """Onglet « Clients » : une ligne par personne, avec son nombre de lignes."""
    if campagne.type == TypeCampagne.ENROLEMENT_APP:
        enrolements = EnrolementClient.objects.filter(
            campagne_id=campagne.id, created_at__range=(debut, fin)
        )
        if agence_id is not None:
            enrolements = enrolements.filter(agence_id=agence_id)
        if user_id is not None:
            enrolements = enrolements.filter(user_id=user_id)

        groupes = {}
        for e in enrolements.order_by("nom", "prenom", "id"):
            cle = f"{e.nom} {e.prenom} {e.telephone or ''}".strip().lower()
            groupes.setdefault(cle, []).append(e)

        return (
            ["Client", "N° de compte", "Téléphone", "Adresse", "Nb enrôlements"],
            [
                [
                    f"{groupe[0].prenom} {groupe[0].nom}".strip(),
                    groupe[0].numero_compte or "",
                    groupe[0].telephone or "",
                    groupe[0].adresse or "",
                    len(groupe),
                ]
                for groupe in groupes.values()
            ],
            "Rapport campagne — Clients enrôlés",
        )

    ventes = Vente.objects.select_related("client").filter(
        campagne_id=campagne.id, created_at__range=(debut, fin)
    )
    if agence_id is not None:
        ventes = ventes.filter(agence_id=agence_id)
    if user_id is not None:
        ventes = ventes.filter(user_id=user_id)
    if type_carte_id is not None:
        ventes = ventes.filter(type_carte_id=type_carte_id)

    par_client = {}
    for v in ventes.order_by("created_at", "id"):
        if v.client_id:
            par_client.setdefault(v.client_id, {"client": v.client, "nb": 0})["nb"] += 1

    ordonnes = sorted(
        par_client.values(),
        key=lambda x: f"{x['client'].nom} {x['client'].prenom}".lower(),
    )

    return (
        ["Client", "Téléphone", "Ville", "Quartier", "Nb ventes"],
        [
            [
                f"{x['client'].prenom} {x['client'].nom}".strip(),
                x["client"].telephone or "",
                x["client"].ville or "",
                x["client"].quartier or "",
                x["nb"],
            ]
            for x in ordonnes
        ],
        "Rapport campagne — Clients (au moins une vente dans le périmètre)",
    )


# ---------------------------------------------------------------------------
# Graphiques de synthèse d'une campagne
# ---------------------------------------------------------------------------


def _synthese_pour_graphiques(request, campagne):
    debut, fin, agence_id, user_id = views._filtres_synthese(request, campagne)
    return (
        services.synthese_campagne(campagne, debut, fin, agence_id, user_id),
        debut,
        fin,
    )


@role_required(Role.ADMIN, Role.DIRECTION)
@http_methods("GET", "HEAD")
def export_synthese_graphiques_excel(request, campagne):
    campagne = get_object_or_404(Campagne, pk=campagne)
    synthese, debut, fin = _synthese_pour_graphiques(request, campagne)
    est_enrolement = campagne.type == TypeCampagne.ENROLEMENT_APP

    classeur = gr.classeur_synthese_campagne(
        campagne.nom, debut, fin, synthese, est_enrolement
    )
    return reponse_xlsx(
        classeur,
        f"synthese_campagne_{campagne.id}_{debut.strftime('%Y-%m-%d')}_graphiques.xlsx",
    )


@role_required(Role.ADMIN, Role.DIRECTION)
@http_methods("GET", "HEAD")
def export_synthese_graphiques_word(request, campagne):
    campagne = get_object_or_404(Campagne, pk=campagne)
    synthese, debut, fin = _synthese_pour_graphiques(request, campagne)
    est_enrolement = campagne.type == TypeCampagne.ENROLEMENT_APP
    libelle = gr.libelle_volume(est_enrolement)

    par_type, commerciaux, agences = gr.donnees_graphiques_synthese(synthese)

    blocs = []
    if not est_enrolement:
        blocs.append(
            ("Mix des ventes par type de carte", "doughnut", par_type["labels"], par_type["valeurs"])
        )
    blocs += [
        ("Top commerciaux — part du total (%)", "bar", commerciaux["labels"], commerciaux["valeurs"]),
        (f"Part des agences ({libelle.lower()})", "pie", agences["labels"], agences["valeurs"]),
    ]

    document = gr.document_graphiques(
        f"Synthèse — {campagne.nom} "
        f"({debut.strftime('%d/%m/%Y')} – {fin.strftime('%d/%m/%Y')})",
        [],
        blocs,
    )
    return gr.reponse_docx(
        document,
        f"synthese_campagne_{campagne.id}_{debut.strftime('%Y-%m-%d')}_graphiques.docx",
    )


# ---------------------------------------------------------------------------
# Cumul multi-campagnes
# ---------------------------------------------------------------------------


def _cumul_contexte(request):
    """Campagnes sélectionnées et agrégats communs aux exports du cumul."""
    ids = sorted(
        {
            int(i)
            for i in (
                request.GET.getlist("campagne_ids[]") or request.GET.getlist("campagne_ids")
            )
            if str(i).strip().isdigit() and int(i) > 0
        }
    )
    if not ids:
        return None, "Sélectionnez au moins une campagne pour l’export cumul."

    Campagne.sync_statuts()
    campagnes = list(
        filtrer_campagnes(
            Campagne.objects.filter(id__in=ids), partenaire_courant(request)
        ).order_by("-date_debut", "-id")
    )
    if len(campagnes) != len(ids):
        return None, "Sélection de campagnes invalide pour l’export."

    types = {c.type for c in campagnes}
    if len(types) > 1:
        return None, "Impossible de cumuler des campagnes de types différents (vente et enrôlement)."
    if types == {TypeCampagne.ENROLEMENT_APP}:
        return None, "Le cumul multi-campagnes n’est pas encore disponible pour les campagnes d’enrôlement."

    return campagnes, None


@role_required(Role.ADMIN, Role.DIRECTION)
@http_methods("GET", "HEAD")
def export_cumul(request):
    campagnes, erreur = _cumul_contexte(request)
    if erreur:
        deposer_flash(request, warning=erreur)
        return redirect("/rapports")

    campagne_ids = [c.id for c in campagnes]
    base = Vente.objects.filter(campagne_id__in=campagne_ids)
    total = base.count()

    par_commercial = list(
        base.values("user_id").annotate(total=Count("id")).order_by("-total")
    )
    utilisateurs = {
        u.id: u for u in User.objects.filter(id__in=[l["user_id"] for l in par_commercial])
    }
    par_agence = list(
        base.values("agence_id").annotate(total=Count("id")).order_by("-total")
    )
    par_type = list(
        base.values("type_carte_id").annotate(total=Count("id")).order_by("-total")
    )

    noms_agences = dict(
        Agence.objects.filter(
            id__in={l["agence_id"] for l in par_agence if l["agence_id"]}
            | {u.agence_id for u in utilisateurs.values() if u.agence_id}
        ).values_list("id", "nom")
    )
    codes_types = dict(
        TypeCarte.objects.filter(
            id__in={l["type_carte_id"] for l in par_type if l["type_carte_id"]}
        ).values_list("id", "code")
    )

    debut = views._debut_jour(min(c.date_debut for c in campagnes))
    fin = views._fin_jour(max(c.date_fin for c in campagnes))
    titre = "Cumul : " + " + ".join(c.nom for c in campagnes)
    nom_base = f"cumul_campagnes_{'-'.join(str(i) for i in campagne_ids)}_{horodatage()}"

    synthese = _synthese_cumul(
        total, par_commercial, par_agence, par_type, utilisateurs, noms_agences, codes_types
    )
    section = request.GET.get("section", "ventes").lower()

    if section == "graphiques-excel":
        return reponse_xlsx(
            gr.classeur_synthese_campagne(titre, debut, fin, synthese),
            f"{nom_base}_graphiques.xlsx",
        )

    if section == "graphiques-word":
        par_type_g, commerciaux_g, agences_g = gr.donnees_graphiques_synthese(synthese)
        document = gr.document_graphiques(
            f"Synthèse — {titre} ({debut.strftime('%d/%m/%Y')} – {fin.strftime('%d/%m/%Y')})",
            [],
            [
                ("Mix des ventes par type de carte", "doughnut", par_type_g["labels"], par_type_g["valeurs"]),
                ("Top commerciaux — part du total (%)", "bar", commerciaux_g["labels"], commerciaux_g["valeurs"]),
                ("Part des agences (ventes)", "pie", agences_g["labels"], agences_g["valeurs"]),
            ],
        )
        return gr.reponse_docx(document, f"{nom_base}_graphiques.docx")

    par_semaine = services.agreger_par_periode(base, "semaine")
    par_mois = services.agreger_par_periode(base, "mois")

    if section == "all":
        return _classeur_cumul_complet(
            titre, debut, fin, base, synthese, par_semaine, par_mois, nom_base
        )

    return _section_cumul(
        request, section, base, synthese, par_semaine, par_mois, nom_base, total
    )


def _synthese_cumul(
    total, par_commercial, par_agence, par_type, utilisateurs, noms_agences, codes_types
):
    """Met le cumul à la forme d'une synthèse de campagne, pour les graphiques."""
    commerciaux = []
    for index, ligne in enumerate(par_commercial):
        utilisateur = utilisateurs.get(ligne["user_id"])
        commerciaux.append(
            {
                "user_id": int(ligne["user_id"]) if ligne["user_id"] else 0,
                "user_name": _nom(utilisateur) or "—",
                "agence_nom": noms_agences.get(utilisateur.agence_id)
                if utilisateur and utilisateur.agence_id
                else None,
                "total_ventes": int(ligne["total"]),
                "rang": index + 1,
            }
        )

    agences = [
        {
            "agence_id": ligne["agence_id"],
            "agence_nom": noms_agences.get(ligne["agence_id"], "?")
            if ligne["agence_id"]
            else "— Sans agence",
            "total_ventes": int(ligne["total"]),
            "pct_volume": round(100 * ligne["total"] / total, 2) if total > 0 else 0,
            "nb_commerciaux": 0,
        }
        for ligne in par_agence
    ]

    types = [
        {
            "code": codes_types.get(ligne["type_carte_id"], "?")
            if ligne["type_carte_id"]
            else "—",
            "type_carte_id": ligne["type_carte_id"],
            "total_ventes": int(ligne["total"]),
            "pct_volume": round(100 * ligne["total"] / total, 2) if total > 0 else 0,
        }
        for ligne in par_type
    ]

    return {
        "resume": {
            "total_ventes": total,
            "nb_commerciaux_perimetre": len(commerciaux),
            "nb_avec_ventes": sum(1 for c in commerciaux if c["total_ventes"] > 0),
            "nb_zero_vente": 0,
            "nb_agences_avec_ventes": sum(1 for a in agences if a["total_ventes"] > 0),
        },
        "commerciaux": commerciaux,
        "agences": agences,
        "par_type_carte": types,
        "par_semaine": [],
        "par_mois": [],
    }


def _lignes_clients_cumul(base):
    """Clients distincts du cumul, avec leur nombre de ventes."""
    comptes = {
        l["client_id"]: l["cnt"]
        for l in base.values("client_id").annotate(cnt=Count("id"))
        if l["client_id"]
    }
    clients = Client.objects.select_related("user__agence", "type_carte").filter(
        id__in=list(comptes)
    ).order_by("nom", "prenom", "id")

    return [
        [
            f"{c.prenom} {c.nom}".strip(),
            c.telephone or "",
            c.ville or "",
            int(comptes.get(c.id, 0)),
            c.type_carte.code if c.type_carte_id else "",
        ]
        for c in clients
    ]


def _section_cumul(request, section, base, synthese, par_semaine, par_mois, nom_base, total):
    """Un onglet unique du cumul, au format XLSX."""
    if request.GET.get("format", "xlsx").lower() != "xlsx":
        raise Http404

    if section == "ventes":
        lignes = [
            _ligne_vente(v)
            for v in base.select_related(
                "client", "user", "agence", "type_carte", "campagne"
            ).order_by("created_at", "id")
        ]
        return reponse_xlsx(
            classeur_simple("Ventes cumul", ENTETES_VENTES, lignes),
            f"{nom_base}_ventes.xlsx",
        )

    if section == "commerciaux":
        lignes = [
            [l["rang"], l["user_name"], l["agence_nom"] or "", l["total_ventes"]]
            for l in synthese["commerciaux"]
        ]
        return reponse_xlsx(
            classeur_simple("Commerciaux cumul", ["Rang", "Commercial", "Agence", "Ventes"], lignes),
            f"{nom_base}_commerciaux.xlsx",
        )

    if section == "agences":
        lignes = [
            [l["agence_nom"], l["total_ventes"], l["pct_volume"]]
            for l in synthese["agences"]
        ]
        return reponse_xlsx(
            classeur_simple("Agences cumul", ["Agence", "Ventes", "Part % volume"], lignes),
            f"{nom_base}_agences.xlsx",
        )

    if section == "types":
        lignes = [
            [l["code"], l["total_ventes"], l["pct_volume"]]
            for l in synthese["par_type_carte"]
        ]
        return reponse_xlsx(
            classeur_simple("Types cumul", ["Type carte", "Ventes", "Part % volume"], lignes),
            f"{nom_base}_types.xlsx",
        )

    if section == "clients":
        return reponse_xlsx(
            classeur_simple(
                "Clients cumul",
                ["Client", "Téléphone", "Ville", "Nb ventes (cumul)", "Type carte"],
                _lignes_clients_cumul(base),
            ),
            f"{nom_base}_clients.xlsx",
        )

    if section == "semaines":
        return reponse_xlsx(
            classeur_simple(
                "Par semaine cumul",
                ["Période", "Ventes"],
                [[l["libelle"], l["total_ventes"]] for l in par_semaine],
            ),
            f"{nom_base}_semaines.xlsx",
        )

    if section == "mois":
        return reponse_xlsx(
            classeur_simple(
                "Par mois cumul",
                ["Mois", "Ventes"],
                [[l["libelle"], l["total_ventes"]] for l in par_mois],
            ),
            f"{nom_base}_mois.xlsx",
        )

    raise Http404


def _classeur_cumul_complet(titre, debut, fin, base, synthese, par_semaine, par_mois, nom_base):
    meta = [
        titre,
        f"Période : {debut.strftime('%d/%m/%Y')} → {fin.strftime('%d/%m/%Y')}",
        f"Généré le {_date_longue()} à {datetime.now().strftime('%H:%M')}",
    ]
    lignes_ventes = [
        _ligne_vente(v)
        for v in base.select_related(
            "client", "user", "agence", "type_carte", "campagne"
        ).order_by("created_at", "id")
    ]

    definitions = [
        {
            "titre": "Ventes",
            "titre_document": "Cumul — Ventes détaillées",
            "lignes_meta": meta,
            "entetes": ENTETES_VENTES,
            "lignes": lignes_ventes,
            "ligne_totaux": [f"TOTAUX ({len(lignes_ventes)} ligne(s))"]
            + [""] * (len(ENTETES_VENTES) - 1),
        },
        {
            "titre": "Clients",
            "titre_document": "Cumul — Clients",
            "lignes_meta": meta,
            "entetes": ["Client", "Téléphone", "Ville", "Nb ventes (cumul)", "Type carte"],
            "lignes": _lignes_clients_cumul(base),
        },
        {
            "titre": "Commerciaux",
            "titre_document": "Cumul — Commerciaux",
            "lignes_meta": meta,
            "entetes": ["Rang", "Commercial", "Agence", "Ventes"],
            "lignes": [
                [l["rang"], l["user_name"], l["agence_nom"] or "", l["total_ventes"]]
                for l in synthese["commerciaux"]
            ],
        },
        {
            "titre": "Agences",
            "titre_document": "Cumul — Agences",
            "lignes_meta": meta,
            "entetes": ["Agence", "Ventes", "Part % volume"],
            "lignes": [
                [l["agence_nom"], l["total_ventes"], l["pct_volume"]]
                for l in synthese["agences"]
            ],
        },
        {
            "titre": "Types de carte",
            "titre_document": "Cumul — Types de carte",
            "lignes_meta": meta,
            "entetes": ["Type carte", "Ventes", "Part % volume"],
            "lignes": [
                [l["code"], l["total_ventes"], l["pct_volume"]]
                for l in synthese["par_type_carte"]
            ],
        },
        {
            "titre": "Par semaine",
            "titre_document": "Cumul — Volume par semaine",
            "lignes_meta": meta,
            "entetes": ["Période", "Ventes"],
            "lignes": [[l["libelle"], l["total_ventes"]] for l in par_semaine],
        },
        {
            "titre": "Par mois",
            "titre_document": "Cumul — Volume par mois",
            "lignes_meta": meta,
            "entetes": ["Mois", "Ventes"],
            "lignes": [[l["libelle"], l["total_ventes"]] for l in par_mois],
        },
    ]

    return reponse_xlsx(classeur_multi_feuilles(definitions), f"{nom_base}_complet.xlsx")


# ---------------------------------------------------------------------------
# Reporting téléphonique — export admin
# ---------------------------------------------------------------------------


@role_required(Role.ADMIN)
@http_methods("GET", "HEAD")
def telephonique_admin_export(request):
    rapports = list(
        views._rapports_telephoniques_filtres(request)
        .select_related("user__agence", "campagne")
        .order_by("-date_rapport", "-id")
    )

    meta = [f"Généré le {_date_longue()} à {datetime.now().strftime('%H:%M')}"]
    classeur = classeur_multi_feuilles(
        [
            {
                "titre": "Fiches",
                "titre_document": "Reporting téléphonique — fiches",
                "lignes_meta": meta,
                "entetes": ENTETES_FICHES_TEL,
                "lignes": lignes_fiches_telephoniques(rapports),
                "ligne_totaux": totaux_fiches_telephoniques(rapports),
            }
        ]
    )
    return reponse_xlsx(classeur, f"reporting_telephonique_{horodatage()}.xlsx")


# ---------------------------------------------------------------------------
# Performances
# ---------------------------------------------------------------------------


def _contexte_performances_export(request):
    """Recalcule le contexte de l'écran Performances pour les exports."""
    Campagne.sync_statuts()
    contexte = performances._contexte_performance(request)
    est_enrolement = contexte["type"] == TypeCampagne.ENROLEMENT_APP
    ids = contexte["campagneIdsFilter"]

    modele = EnrolementClient if est_enrolement else Vente
    base = performances._base_periode(
        modele, contexte["dateDebut"], contexte["dateFin"], contexte["agenceId"], ids
    )

    stats = {"total_ventes": base.count(), "par_type": {}}
    if not est_enrolement:
        stats["par_type"] = {
            str(l["type_carte_id"]): int(l["total"])
            for l in base.values("type_carte_id").annotate(total=Count("id"))
        }

    calcul = (
        services.classement_enrolements_pour_campagnes
        if est_enrolement
        else services.classement_ventes_pour_campagnes
    )
    agence_classement = (
        contexte["agenceId"]
        if (request.user.is_admin or request.user.is_direction)
        else None
    )
    classement = (
        calcul(ids, contexte["dateDebut"], contexte["dateFin"], False, agence_classement)
        if ids
        else []
    )

    return contexte, est_enrolement, base, stats, classement


@role_required(Role.ADMIN, Role.DIRECTION)
@http_methods("GET", "HEAD")
def performances_export_excel(request):
    contexte, est_enrolement, base, stats, classement = _contexte_performances_export(request)
    libelle = gr.libelle_volume(est_enrolement)

    entetes = ["Rang", "Commercial", libelle, "Part % volume"]
    total = int(stats["total_ventes"])
    lignes = [
        [
            l["rang"],
            l["user_name"],
            l["total_ventes"],
            round(l["total_ventes"] / total * 100, 1) if total > 0 else 0,
        ]
        for l in classement
    ]

    meta = [
        f"Période : {contexte['libellePeriode']}",
        f"Généré le {_date_longue()} à {datetime.now().strftime('%H:%M')}",
    ]
    definitions = [
        {
            "titre": "Classement",
            "titre_document": f"Performances — classement des commerciaux ({libelle.lower()})",
            "lignes_meta": meta,
            "entetes": entetes,
            "lignes": lignes,
            "ligne_totaux": ["", "TOTAUX", total, ""],
        },
        {
            "titre": "Agences",
            "titre_document": "Performances — classement des agences",
            "lignes_meta": meta,
            "entetes": ["Rang", "Agence", libelle, "Part % volume"],
            "lignes": [
                [l["rang"], l["agence_nom"], l["total_ventes"], l["pct_volume"]]
                for l in performances._classement_agences(
                    base, [a.id for a in performances._agences_perimetre(contexte["campagneIdsFilter"])]
                )
            ],
        },
    ]
    if not est_enrolement:
        definitions.append(
            {
                "titre": "Types de carte",
                "titre_document": "Performances — types de carte",
                "lignes_meta": meta,
                "entetes": ["Rang", "Type carte", "Ventes", "Part % volume"],
                "lignes": [
                    [l["rang"], l["code"], l["total_ventes"], l["pct_volume"]]
                    for l in performances._classement_types_cartes(base)
                ],
            }
        )

    return reponse_xlsx(
        classeur_multi_feuilles(definitions), f"performances_{horodatage()}.xlsx"
    )


def _series_performances(base, classement):
    top = [
        {"label": l["user_name"], "ventes": int(l["total_ventes"])}
        for l in classement
        if l["total_ventes"] > 0
    ][:5]
    return top, performances._ventes_par_agence_graphique(base)


@role_required(Role.ADMIN, Role.DIRECTION)
@http_methods("GET", "HEAD")
def performances_export_graphiques_excel(request):
    contexte, est_enrolement, base, stats, classement = _contexte_performances_export(request)
    top, par_agence = _series_performances(base, classement)
    types = [] if est_enrolement else list(TypeCarte.objects.order_by("code"))

    classeur = gr.classeur_performances(
        contexte["libellePeriode"], stats, top, par_agence, types, est_enrolement
    )
    return reponse_xlsx(classeur, f"performances_{horodatage()}_graphiques.xlsx")


@role_required(Role.ADMIN, Role.DIRECTION)
@http_methods("GET", "HEAD")
def performances_export_graphiques_word(request):
    contexte, est_enrolement, base, stats, classement = _contexte_performances_export(request)
    top, par_agence = _series_performances(base, classement)
    libelle = gr.libelle_volume(est_enrolement)

    blocs = [
        ("Top commerciaux", "bar", [l["label"] for l in top], [l["ventes"] for l in top]),
        (
            "Répartition agences",
            "doughnut",
            [l["label"] for l in par_agence],
            [l["ventes"] for l in par_agence],
        ),
    ]
    if not est_enrolement:
        par_type = stats.get("par_type") or {}
        types = list(TypeCarte.objects.order_by("code"))
        blocs.append(
            (
                "Ventes par type de carte",
                "column",
                [t.code for t in types],
                [int(par_type.get(str(t.id), 0) or 0) for t in types],
            )
        )

    document = gr.document_graphiques(
        f"Performances — {contexte['libellePeriode']}",
        [f"Total {libelle.lower()} : {int(stats['total_ventes'])}"],
        blocs,
    )
    return gr.reponse_docx(document, f"performances_{horodatage()}_graphiques.docx")


@http_methods("GET", "HEAD")
def performances_commercial_export_excel(request, user):
    """Détail d'un commercial : ventes et clients de la période."""
    if not request.user.is_authenticated:
        from django.contrib.auth.views import redirect_to_login

        return redirect_to_login(request.get_full_path())

    commercial = get_object_or_404(User.objects.select_related("agence"), pk=user)
    Campagne.sync_statuts()
    contexte = performances._contexte_performance(request)

    if not performances._peut_voir_detail(request.user, commercial, contexte["agenceId"]):
        from django.core.exceptions import PermissionDenied

        raise PermissionDenied

    est_enrolement = contexte["type"] == TypeCampagne.ENROLEMENT_APP
    ids = contexte["campagneIdsFilter"]
    libelle = gr.libelle_volume(est_enrolement)

    meta = [
        f"Commercial : {_nom(commercial)}"
        + (f" — {commercial.agence.nom}" if commercial.agence_id else ""),
        f"Période : {contexte['libellePeriode']}",
        f"Généré le {_date_longue()} à {datetime.now().strftime('%H:%M')}",
    ]

    if est_enrolement:
        lignes_source = performances._base_periode(
            EnrolementClient, contexte["dateDebut"], contexte["dateFin"], None, ids
        ).filter(user_id=commercial.id).select_related("agence").order_by("-created_at", "-id")
        entetes = ["Date", "Client", "N° de compte", "Téléphone", "Adresse", "Agence"]
        lignes = [
            [
                e.created_at.strftime("%d/%m/%Y %H:%M"),
                f"{e.prenom} {e.nom}".strip(),
                e.numero_compte or "",
                e.telephone or "",
                e.adresse or "",
                e.agence.nom if e.agence_id else "",
            ]
            for e in lignes_source
        ]
    else:
        lignes_source = performances._base_periode(
            Vente, contexte["dateDebut"], contexte["dateFin"], None, ids
        ).filter(user_id=commercial.id).select_related(
            "client", "type_carte", "agence"
        ).order_by("-created_at", "-id")
        entetes = ["Date", "Client", "Téléphone", "Type carte", "Agence", "Statut"]
        lignes = [
            [
                v.created_at.strftime("%d/%m/%Y %H:%M"),
                f"{v.client.prenom} {v.client.nom}".strip() if v.client_id else "—",
                v.client.telephone or "" if v.client_id else "",
                v.type_carte.code if v.type_carte_id else "",
                v.agence.nom if v.agence_id else "",
                v.statut_activation or "",
            ]
            for v in lignes_source
        ]

    classeur = classeur_multi_feuilles(
        [
            {
                "titre": libelle,
                "titre_document": f"Détail {libelle.lower()} — {_nom(commercial)}",
                "lignes_meta": meta,
                "entetes": entetes,
                "lignes": lignes,
                "ligne_totaux": [f"TOTAUX ({len(lignes)} ligne(s))"]
                + [""] * (len(entetes) - 1),
            }
        ]
    )
    return reponse_xlsx(
        classeur, f"performances_{commercial.id}_{horodatage()}.xlsx"
    )
