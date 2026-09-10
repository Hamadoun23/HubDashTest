"""
Exports du terrain : historique des ventes, fiches téléphoniques, fiche client
(PDF, Excel, Word).

Portage des méthodes `export*` de Commercial/VenteController,
Commercial/TelephoniqueRapportController et de ClientExportService.
"""

import base64
import mimetypes
from datetime import datetime

from django.conf import settings
from django.http import Http404, HttpResponse
from django.shortcuts import get_object_or_404
from django.template.loader import render_to_string

from campagnes.models import TypeCampagne
from core.decorators import http_methods, role_required
from core.exports.tableur import (
    classeur_multi_feuilles,
    classeur_simple,
    horodatage,
    reponse_xlsx,
)
from core.models import Role
from core.php import nombre_format
from core.partenaires import filtrer_saisies, partenaire_courant

from . import services
from .models import Client, TelephoniqueRapport, Vente

MOIS_FR = [
    "janvier", "février", "mars", "avril", "mai", "juin",
    "juillet", "août", "septembre", "octobre", "novembre", "décembre",
]


def _nom(user):
    if user is None:
        return ""
    return f"{user.prenom} {user.name}".strip() if user.prenom else user.name


def _date_longue():
    """Ex. « 13 août 2026 » — équivalent de translatedFormat('d F Y')."""
    maintenant = datetime.now()
    return f"{maintenant.day} {MOIS_FR[maintenant.month - 1]} {maintenant.year}"


# ---------------------------------------------------------------------------
# Historique des ventes
# ---------------------------------------------------------------------------


@role_required(Role.ADMIN, Role.DIRECTION, Role.COMMERCIAL)
@http_methods("GET", "HEAD")
def ventes_export_excel(request):
    user = request.user
    partenaire = partenaire_courant(request)
    ventes = filtrer_saisies(
        Vente.objects.select_related(
            "client", "agence", "user", "type_carte", "campagne"
        ),
        partenaire,
    )

    agence_id = None
    if user.is_commercial:
        ventes = ventes.filter(user_id=user.id)
        agence_id = int(user.agence_id) if user.agence_id else None

    ventes = services.restreindre_aux_campagnes_vente(
        ventes, agence_id, partenaire.id if partenaire else None
    ).order_by("-created_at", "-id")

    # Le commercial ne voit pas les colonnes qui désignent d'autres vendeurs.
    avec_commercial = user.is_admin or user.is_direction
    entetes = ["Date", "Campagne", "Client", "Téléphone", "Type carte"]
    if avec_commercial:
        entetes += ["Commercial", "Agence"]
    entetes.append("Statut activation")

    lignes = []
    for v in ventes:
        ligne = [
            v.created_at.strftime("%d/%m/%Y %H:%M"),
            v.campagne.nom if v.campagne_id else "—",
            f"{v.client.prenom} {v.client.nom}".strip() if v.client_id else "—",
            v.client.telephone or "" if v.client_id else "",
            v.type_carte.code if v.type_carte_id else "—",
        ]
        if avec_commercial:
            ligne += [_nom(v.user), v.agence.nom if v.agence_id else ""]
        ligne.append(v.statut_activation or "")
        lignes.append(ligne)

    return reponse_xlsx(
        classeur_simple("Historique ventes", entetes, lignes),
        f"historique_ventes_{horodatage()}.xlsx",
    )


# ---------------------------------------------------------------------------
# Fiches téléphoniques
# ---------------------------------------------------------------------------

ENTETES_FICHES_TEL = [
    "Date", "Campagne", "Collaborateur", "Agence", "Appels émis", "Joignables",
    "Non joignables", "Taux joign. %", "Intéressés (nb)", "Intéressés %",
    "Déjà servis (nb)", "Déjà servis %", "NJ répondeur", "NJ n° erroné",
    "NJ hors réseau", "NJ autres nb", "NJ autres précision",
    "Cartes proposées (résumé)", "Cohérence NJ",
]


def lignes_fiches_telephoniques(rapports):
    """Lignes détaillées d'un lot de fiches, format commun à tous les exports."""
    lignes = []
    for r in rapports:
        lignes.append(
            [
                r.date_rapport.strftime("%d/%m/%Y"),
                r.campagne.nom if r.campagne_id else "—",
                _nom(r.user),
                r.user.agence.nom if r.user_id and r.user.agence_id else "",
                r.appels_emis,
                r.appels_joignables,
                r.appels_non_joignables,
                round(float(r.taux_joignabilite), 2)
                if r.taux_joignabilite is not None
                else "",
                r.clients_interesses_nombre,
                round(float(r.clients_interesses_pct), 2)
                if r.clients_interesses_pct is not None
                else (r.pct_interesses_calcule() or ""),
                r.clients_deja_servis_nombre,
                round(float(r.clients_deja_servis_pct), 2)
                if r.clients_deja_servis_pct is not None
                else (r.pct_deja_servis_calcule() or ""),
                r.nj_repondeur,
                r.nj_numero_errone,
                r.nj_hors_reseau,
                r.nj_autres_nombre,
                r.nj_autres_precision or "",
                r.resume_cartes_proposees(),
                "OK" if r.nj_analyse_coherente() else "Écart",
            ]
        )
    return lignes


def totaux_fiches_telephoniques(rapports):
    """Ligne « TOTAUX » du tableau des fiches."""
    def somme(champ):
        return sum(getattr(r, champ) for r in rapports)

    return [
        "TOTAUX", f"{len(rapports)} fiche(s)", "", "",
        somme("appels_emis"),
        somme("appels_joignables"),
        somme("appels_non_joignables"),
        "", somme("clients_interesses_nombre"), "",
        somme("clients_deja_servis_nombre"), "",
        somme("nj_repondeur"),
        somme("nj_numero_errone"),
        somme("nj_hors_reseau"),
        somme("nj_autres_nombre"),
        "", "", "",
    ]


@role_required(Role.COMMERCIAL_TELEPHONIQUE)
@http_methods("GET", "HEAD")
def telephonique_export_excel(request):
    user = request.user
    agence_id = int(user.agence_id) if user.agence_id else None
    rapports = list(
        services.restreindre_aux_campagnes_vente(
            TelephoniqueRapport.objects.select_related("user__agence", "campagne").filter(
                user_id=user.id
            ),
            agence_id,
            user.partenaire_id,
        ).order_by("-date_rapport", "-id")
    )

    meta = [
        f"Généré le {_date_longue()} à {datetime.now().strftime('%H:%M')}",
        f"Collaborateur : {_nom(user)}"
        + (f" — {user.agence.nom}" if user.agence_id else ""),
    ]

    classeur = classeur_multi_feuilles(
        [
            {
                "titre": "Mes fiches",
                "titre_document": "Mes fiches — reporting téléphonique",
                "lignes_meta": meta,
                "entetes": ENTETES_FICHES_TEL,
                "lignes": lignes_fiches_telephoniques(rapports),
                "ligne_totaux": totaux_fiches_telephoniques(rapports),
            }
        ]
    )
    return reponse_xlsx(classeur, f"mes_fiches_telephonique_{horodatage()}.xlsx")


# ---------------------------------------------------------------------------
# Fiche client — PDF, Excel, Word
# ---------------------------------------------------------------------------


def _identite_pour_export(request, client):
    """
    Décrit la pièce d'identité rattachée au client.

    L'image est intégrée en base64 pour que le document reste autonome ; un PDF
    ne peut pas être fusionné et n'est donc proposé qu'en lien.
    """
    base = {
        "has_file": False,
        "stored": False,
        "image_src": None,
        "is_pdf": False,
        "download_url": None,
        "label": None,
    }
    if not client.carte_identite:
        return base

    base["has_file"] = True
    base["label"] = client.carte_identite.rsplit("/", 1)[-1]
    base["download_url"] = request.build_absolute_uri("/storage/" + client.carte_identite)

    chemin = settings.MEDIA_ROOT / client.carte_identite
    if not chemin.exists():
        return base

    base["stored"] = True
    type_mime = mimetypes.guess_type(str(chemin))[0] or ""

    if type_mime.startswith("image/"):
        contenu = base64.b64encode(chemin.read_bytes()).decode("ascii")
        base["image_src"] = f"data:{type_mime};base64,{contenu}"
    elif type_mime == "application/pdf" or client.carte_identite.lower().endswith(".pdf"):
        base["is_pdf"] = True

    return base


def _contexte_client(request, client):
    ventes = client.ventes.select_related("agence", "type_carte", "user").all()
    return {
        "client": client,
        "type_carte": client.type_carte.code if client.type_carte_id else None,
        "commercial": client.user.name if client.user_id else None,
        "agence": client.user.agence.nom
        if client.user_id and client.user.agence_id
        else None,
        "cree_le": client.created_at.strftime("%d/%m/%Y %H:%M"),
        "genere_le": datetime.now().strftime("%d/%m/%Y %H:%M"),
        "identite": _identite_pour_export(request, client),
        "ventes": [
            {
                "date": v.created_at.strftime("%d/%m/%Y %H:%M"),
                "type_carte": v.type_carte.code if v.type_carte_id else "?",
                "commercial": v.user.name if v.user_id else "—",
                "agence": v.agence.nom if v.agence_id else "—",
                "statut": v.statut_activation,
            }
            for v in ventes
        ],
    }


@role_required(Role.ADMIN, Role.DIRECTION)
@http_methods("GET", "HEAD")
def client_export(request, client):
    client = get_object_or_404(
        Client.objects.select_related("user__agence", "type_carte"), pk=client
    )
    format_demande = request.GET.get("format", "pdf")
    if format_demande not in ("pdf", "excel", "word"):
        return HttpResponse("Format d’export invalide.", status=422)

    nom_base = f"client_{client.id}_{datetime.now().strftime('%Y-%m-%d')}"

    if format_demande == "excel":
        return _client_excel(client, nom_base)

    contexte = _contexte_client(request, client)

    if format_demande == "word":
        # Comme Laravel : du HTML servi en `application/msword`, ouvert par Word.
        html = render_to_string("documents/client_word.html", contexte, request)
        reponse = HttpResponse(html, content_type="application/msword; charset=UTF-8")
        reponse["Content-Disposition"] = f'attachment; filename="{nom_base}.doc"'
        return reponse

    return _client_pdf(contexte, nom_base)


def _client_pdf(contexte, nom_base):
    from xhtml2pdf import pisa
    import io

    html = render_to_string("documents/client_pdf.html", contexte)
    tampon = io.BytesIO()
    resultat = pisa.CreatePDF(io.StringIO(html), dest=tampon, encoding="utf-8")
    if resultat.err:
        return HttpResponse("Génération du PDF impossible.", status=500)

    reponse = HttpResponse(tampon.getvalue(), content_type="application/pdf")
    reponse["Content-Disposition"] = f'attachment; filename="{nom_base}.pdf"'
    return reponse


def _client_excel(client, nom_base):
    lignes = [
        ["Identifiant", str(client.id)],
        ["Prénom", client.prenom],
        ["Nom", client.nom],
        ["Téléphone", client.telephone or "—"],
        ["Ville", client.ville or "—"],
        ["Quartier", client.quartier or "—"],
        ["Type de carte", client.type_carte.code if client.type_carte_id else "—"],
        ["Statut carte", client.statut_carte],
        ["Commercial", client.user.name if client.user_id else "—"],
        [
            "Agence (commercial)",
            client.user.agence.nom if client.user_id and client.user.agence_id else "—",
        ],
        ["Créé le", client.created_at.strftime("%d/%m/%Y %H:%M")],
    ]
    if client.carte_identite:
        lignes.append(["Pièce d’identité (fichier)", client.carte_identite])

    definitions = [
        {"titre": "Fiche client", "entetes": ["Champ", "Valeur"], "lignes": lignes}
    ]

    ventes = list(client.ventes.select_related("agence", "type_carte", "campagne").all())
    if ventes:
        definitions.append(
            {
                "titre": "Ventes liées",
                "entetes": ["Date", "Campagne", "Type carte", "Agence", "Statut"],
                "lignes": [
                    [
                        v.created_at.strftime("%d/%m/%Y %H:%M"),
                        v.campagne.nom if v.campagne_id else "—",
                        v.type_carte.code if v.type_carte_id else "—",
                        v.agence.nom if v.agence_id else "—",
                        v.statut_activation or "",
                    ]
                    for v in ventes
                ],
            }
        )

    return reponse_xlsx(classeur_multi_feuilles(definitions), f"{nom_base}.xlsx")
