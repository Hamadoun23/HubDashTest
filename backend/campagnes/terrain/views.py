"""
Écrans terrain : ventes, enrôlements, clients, contrat de prestation et
reporting téléphonique.

Portage de app/Http/Controllers/{Commercial,Clients,Api}/*.php.
"""

from datetime import date, datetime, timedelta

from django.core.exceptions import PermissionDenied
from django.db import transaction
from django.http import Http404, JsonResponse
from django.shortcuts import get_object_or_404, redirect
from inertia import render

from campagnes.models import (
    Campagne,
    CampagneAideVersement,
    ContratPrestationReponse,
    StatutReponseContrat,
    TypeCampagne,
)
from campagnes.articles_defaut import remuneration_dans_articles
from campagnes.services import totaux_telephonique
from core.decorators import http_methods, role_required
from core.middleware import deposer_flash, retour_avec_erreurs
from core.models import Role, TypeCarte
from core.pagination import paginer
from core.partenaires import (
    filtrer_saisies,
    filtrer_types_cartes,
    partenaire_courant,
)
from core.php import nombre_format
from core.validation import ErreursValidation, Validateur

from . import services
from .models import (
    DELAI_MODIFICATION_COMMERCIAL_HEURES,
    Client,
    EnrolementClient,
    TelephoniqueRapport,
    TypePieceIdentite,
    Vente,
)


def _nom(user):
    if user is None:
        return None
    return f"{user.prenom} {user.name}".strip() if user.prenom else user.name


def _corps(request):
    """
    Corps de la requête, que la méthode soit POST ou PUT/PATCH.

    `request.POST` suffit dans tous les cas : `core.middleware.CorpsJsonMiddleware`
    le remplit déjà à partir du corps JSON ou form-urlencoded, quelle que soit
    la méthode — reconstruire le corps ici à la main (`QueryDict(request.body)`)
    traiterait un corps JSON comme une chaîne de requête et ne lirait plus
    aucun champ.
    """
    return request.POST


# ---------------------------------------------------------------------------
# Ventes
# ---------------------------------------------------------------------------


@role_required(Role.ADMIN, Role.DIRECTION, Role.COMMERCIAL)
@http_methods("GET", "HEAD")
def ventes_index(request):
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
    # Admin et direction voient toutes les ventes du client courant, bornées au
    # périmètre de campagne.

    ventes = services.restreindre_aux_campagnes_vente(
        ventes, agence_id, partenaire.id if partenaire else None
    ).order_by("-created_at", "-id")

    def formater(v):
        return {
            "id": v.id,
            "date": v.created_at.strftime("%d/%m/%Y %H:%M"),
            "client_nom": f"{v.client.prenom} {v.client.nom}".strip(),
            "type_carte": v.type_carte.code if v.type_carte_id else "?",
            "commercial": v.user.name if v.user_id else "-",
            "agence": v.agence.nom if v.agence_id else "-",
            "peut_modifier_client": v.client.peut_etre_modifie_ou_supprime_par_commercial()
            if v.client_id
            else False,
            "peut_supprimer": v.peut_etre_supprimee_par_commercial(),
            "client_id": v.client_id,
        }

    return render(
        request,
        "Ventes/Index",
        {
            "libelleStatsCampagne": services.libelle_stats(
                agence_id, TypeCampagne.VENTE_CARTE,
                partenaire.id if partenaire else None,
            ),
            "canManage": bool(user.is_commercial),
            "canSeeCommercial": bool(user.is_admin or user.is_direction),
            "aDesAgences": partenaire is None or partenaire.a_des_agences,
            "ventes": paginer(request, ventes, 15, formater),
        },
    )


@role_required(Role.COMMERCIAL)
@http_methods("GET", "HEAD")
def ventes_create(request):
    Campagne.sync_statuts()
    user = request.user
    ouvertes = services.campagnes_ouvertes_pour(user, TypeCampagne.VENTE_CARTE)

    # La demande d'adhésion s'affiche dès que le client de GDA l'exige.
    partenaire = partenaire_courant(request)
    return render(
        request,
        "Ventes/Create",
        {
            "typesCartes": [
                {"id": t.id, "code": t.code}
                for t in filtrer_types_cartes(
                    TypeCarte.objects.filter(actif=True), partenaire
                ).order_by("code")
            ],
            "campagnesOuvertes": [
                {"id": c.id, "nom": c.nom, "date_fin": c.date_fin.strftime("%d/%m/%Y")}
                for c in ouvertes
            ],
            "peutVendre": bool(ouvertes),
            "contratAccepte": any(
                c.commercial_a_accepte_contrat(user.id) for c in ouvertes
            ),
            "ficheAdhesion": bool(partenaire and partenaire.fiche_adhesion),
            "clientNom": partenaire.nom if partenaire else None,
            "typesPiece": [
                {"valeur": v, "libelle": l} for v, l in TypePieceIdentite.choices
            ],
        },
    )


@role_required(Role.COMMERCIAL)
@http_methods("POST", "DELETE")
def ventes_destroy(request, vente):
    vente = get_object_or_404(Vente, pk=vente)
    if int(vente.user_id) != int(request.user.id):
        raise PermissionDenied

    if not vente.peut_etre_supprimee_par_commercial():
        deposer_flash(
            request,
            error=f"Suppression impossible : plus de {DELAI_MODIFICATION_COMMERCIAL_HEURES} h "
            "se sont écoulées depuis l’enregistrement de cette vente.",
        )
        return redirect("/ventes")

    # La fiche client n'existe que pour porter la vente : les deux disparaissent ensemble.
    with transaction.atomic():
        client = Client.objects.filter(pk=vente.client_id).first()
        vente.delete()
        if client:
            _supprimer_piece_identite(client)
            client.delete()

    deposer_flash(request, success="Vente supprimée.")
    return redirect("/ventes")


def _supprimer_piece_identite(client):
    """Retire le justificatif d'identité du disque public, s'il existe."""
    if not client.carte_identite:
        return
    from django.conf import settings

    chemin = settings.MEDIA_ROOT / client.carte_identite
    if chemin.exists():
        chemin.unlink()


@role_required(Role.COMMERCIAL)
@http_methods("POST")
def api_vente_store(request):
    """Enregistrement d'une vente depuis le formulaire React (réponse JSON)."""
    user = request.user
    if not user.is_commercial or not (user.agence_id or user.partenaire_id):
        return JsonResponse(
            {
                "success": False,
                "message": "Accès non autorisé. Seuls les commerciaux peuvent enregistrer des ventes.",
            },
            status=403,
        )

    Campagne.sync_statuts()
    ids_ouvertes = [
        c.id for c in services.campagnes_ouvertes_pour(user, TypeCampagne.VENTE_CARTE)
    ]
    if not ids_ouvertes:
        return JsonResponse(
            {
                "success": False,
                "message": "Aucune campagne ouverte pour votre périmètre : "
                "enregistrement de vente impossible.",
            },
            status=400,
        )

    validateur = Validateur(request.POST)
    validateur.champ("prenom", "required|max:100")
    validateur.champ("nom", "required|max:100")
    validateur.champ("telephone", "nullable|max:20")
    validateur.champ("ville", "nullable|max:100")
    validateur.champ("quartier", "nullable|max:100")
    validateur.champ("type_carte_id", "required|integer")
    validateur.champ("campagne_id", "nullable|integer")
    validateur.existe(
        "type_carte_id",
        filtrer_types_cartes(
            TypeCarte.objects.filter(actif=True), partenaire_courant(request)
        ),
    )
    # La campagne n'est exigée que s'il y a une ambiguïté à lever.
    if len(ids_ouvertes) > 1 and not validateur.valeurs.get("campagne_id"):
        validateur.erreur("campagne_id", "Le champ campagne id est obligatoire.")
    if validateur.valeurs.get("campagne_id") and validateur.valeurs["campagne_id"] not in ids_ouvertes:
        validateur.erreur("campagne_id", "Le champ campagne id est invalide.")

    try:
        donnees = validateur.resultat()
    except ErreursValidation as erreur:
        return JsonResponse(
            {
                "success": False,
                "message": "Données invalides.",
                "errors": {champ: [message] for champ, message in erreur.erreurs.items()},
            },
            status=422,
        )

    if len(ids_ouvertes) == 1:
        donnees["campagne_id"] = ids_ouvertes[0]
    fichier = request.FILES.get("carte_identite")
    if fichier:
        donnees["carte_identite"] = _stocker_piece_identite(fichier)

    partenaire = partenaire_courant(request)
    adhesion = None
    if partenaire and partenaire.fiche_adhesion:
        try:
            adhesion = _valider_adhesion(request, donnees)
        except ErreursValidation as erreur:
            return JsonResponse(
                {
                    "success": False,
                    "message": "Données invalides.",
                    "errors": {
                        champ: [message]
                        for champ, message in erreur.erreurs.items()
                    },
                },
                status=422,
            )

    try:
        vente = services.enregistrer_vente(donnees, user, adhesion)
    except services.ErreurMetier as erreur:
        return JsonResponse({"success": False, "message": str(erreur)}, status=400)

    return JsonResponse(
        {
            "success": True,
            "message": "Vente enregistrée avec succès.",
            "vente": {"id": vente.id, "campagne_id": vente.campagne_id},
        },
        status=201,
    )


def _valider_adhesion(request, donnees):
    """
    Valide la demande d'adhésion carte prépayée et la ramène à un dictionnaire.

    Seuls le nom à imprimer sur la carte et la pièce d'identité sont exigés en
    plus de l'état civil : ce sont eux qui bloquent l'émission côté banque. Le
    reste est recopié tel quel de l'imprimé, et peut rester vide sur le terrain.
    """
    validateur = Validateur(request.POST)
    validateur.champ("date_naissance", "nullable|date")
    validateur.champ("lieu_naissance", "nullable|max:191")
    validateur.champ("nationalite", "nullable|max:100")
    validateur.champ("email", "nullable|email")
    validateur.champ("adresse", "nullable|max:255")
    validateur.champ("pays_residence", "nullable|max:100")
    validateur.champ("nom_sur_carte", "required|max:100")
    validateur.champ("piece_type", "required|in:cni,passeport,nina")
    validateur.champ("piece_numero", "required|max:100")
    validateur.champ("piece_delivree_le", "nullable|date")
    validateur.champ("piece_expire_le", "nullable|date")
    validateur.champ("piece_autorite", "nullable|max:191")
    validateur.champ("numero_compte_uba", "nullable|max:50")
    validateur.champ("profession", "nullable|max:191")
    validateur.champ("employeur", "nullable|max:191")

    valides = validateur.resultat()

    # L'état civil de la fiche est celui de la vente : une seule saisie, deux
    # enregistrements. Les divergences seraient impossibles à arbitrer ensuite.
    valides["nom"] = donnees["nom"]
    valides["prenoms"] = donnees["prenom"]
    valides["telephone"] = donnees.get("telephone")
    valides["ville"] = donnees.get("ville")
    valides["quartier"] = donnees.get("quartier")
    return valides


def _stocker_piece_identite(fichier):
    """Enregistre le justificatif et renvoie son chemin relatif au disque public."""
    from django.core.files.storage import FileSystemStorage
    from django.conf import settings

    stockage = FileSystemStorage(location=settings.MEDIA_ROOT / "cartes-identite")
    nom = stockage.save(fichier.name, fichier)
    return f"cartes-identite/{nom}"


# ---------------------------------------------------------------------------
# Enrôlements
# ---------------------------------------------------------------------------


@role_required(Role.ADMIN, Role.DIRECTION, Role.COMMERCIAL)
@http_methods("GET", "HEAD")
def enrolements_index(request):
    user = request.user
    partenaire = partenaire_courant(request)
    enrolements = filtrer_saisies(
        EnrolementClient.objects.select_related("user", "agence", "campagne"),
        partenaire,
    )
    if user.is_commercial:
        enrolements = enrolements.filter(user_id=user.id)
    enrolements = enrolements.order_by("-created_at", "-id")

    def formater(e):
        return {
            "id": e.id,
            "date": e.created_at.strftime("%d/%m/%Y %H:%M"),
            "client_nom": f"{e.prenom} {e.nom}".strip(),
            "numero_compte": e.numero_compte,
            "telephone": e.telephone,
            "adresse": e.adresse,
            "commercial": e.user.name if e.user_id else "-",
            "agence": e.agence.nom if e.agence_id else "-",
            "peut_supprimer": e.peut_etre_modifie_ou_supprime_par_commercial(),
        }

    return render(
        request,
        "Enrolements/Index",
        {
            "canManage": bool(user.is_commercial),
            "canSeeCommercial": bool(user.is_admin or user.is_direction),
            "aDesAgences": partenaire is None or partenaire.a_des_agences,
            "enrolements": paginer(request, enrolements, 15, formater),
        },
    )


@role_required(Role.COMMERCIAL)
@http_methods("GET", "HEAD")
def enrolements_create(request):
    Campagne.sync_statuts()
    user = request.user
    ouvertes = services.campagnes_ouvertes_pour(user, TypeCampagne.ENROLEMENT_APP)

    return render(
        request,
        "Enrolements/Create",
        {
            "campagnesOuvertes": [
                {"id": c.id, "nom": c.nom, "date_fin": c.date_fin.strftime("%d/%m/%Y")}
                for c in ouvertes
            ],
            "peutEnroler": bool(ouvertes),
            "contratAccepte": any(
                c.commercial_a_accepte_contrat(user.id) for c in ouvertes
            ),
        },
    )


@role_required(Role.COMMERCIAL)
@http_methods("POST", "DELETE")
def enrolements_destroy(request, enrolement):
    enrolement = get_object_or_404(EnrolementClient, pk=enrolement)
    if int(enrolement.user_id) != int(request.user.id):
        raise PermissionDenied

    if not enrolement.peut_etre_modifie_ou_supprime_par_commercial():
        deposer_flash(
            request,
            error=f"Suppression impossible : plus de {DELAI_MODIFICATION_COMMERCIAL_HEURES} h "
            "se sont écoulées depuis l’enregistrement.",
        )
        return redirect("/enrolements")

    enrolement.delete()
    deposer_flash(request, success="Enrôlement supprimé.")
    return redirect("/enrolements")


@role_required(Role.COMMERCIAL)
@http_methods("POST")
def api_enrolement_store(request):
    user = request.user
    if not user.is_commercial or not (user.agence_id or user.partenaire_id):
        return JsonResponse(
            {
                "success": False,
                "message": "Accès non autorisé. Seuls les commerciaux peuvent enregistrer des enrôlements.",
            },
            status=403,
        )

    Campagne.sync_statuts()
    ids_ouvertes = [
        c.id for c in services.campagnes_ouvertes_pour(user, TypeCampagne.ENROLEMENT_APP)
    ]
    if not ids_ouvertes:
        return JsonResponse(
            {
                "success": False,
                "message": "Aucune campagne d’enrôlement ouverte pour votre agence.",
            },
            status=400,
        )

    validateur = Validateur(request.POST)
    validateur.champ("nom", "required|max:255")
    validateur.champ("prenom", "required|max:255")
    validateur.champ("numero_compte", "required|max:50")
    validateur.champ("telephone", "nullable|max:20")
    validateur.champ("adresse", "nullable|max:255")
    validateur.champ("campagne_id", "nullable|integer")
    if len(ids_ouvertes) > 1 and not validateur.valeurs.get("campagne_id"):
        validateur.erreur("campagne_id", "Le champ campagne id est obligatoire.")

    try:
        donnees = validateur.resultat()
    except ErreursValidation as erreur:
        return JsonResponse(
            {
                "success": False,
                "message": "Données invalides.",
                "errors": {champ: [message] for champ, message in erreur.erreurs.items()},
            },
            status=422,
        )

    if len(ids_ouvertes) == 1:
        donnees["campagne_id"] = ids_ouvertes[0]

    try:
        enrolement = services.enregistrer_enrolement(donnees, user)
    except services.ErreurMetier as erreur:
        return JsonResponse({"success": False, "message": str(erreur)}, status=400)

    return JsonResponse(
        {
            "success": True,
            "message": "Enrôlement enregistré avec succès.",
            "enrolement": {"id": enrolement.id, "campagne_id": enrolement.campagne_id},
        },
        status=201,
    )


# ---------------------------------------------------------------------------
# Clients — consultation admin / direction
# ---------------------------------------------------------------------------


@role_required(Role.ADMIN, Role.DIRECTION)
@http_methods("GET", "HEAD")
def clients_index(request):
    clients = filtrer_saisies(
        Client.objects.select_related("user__agence", "type_carte").order_by(
            "-created_at", "-id"
        ),
        partenaire_courant(request),
    )

    def formater(c):
        return {
            "id": c.id,
            "nom_complet": f"{c.prenom} {c.nom}".strip(),
            "telephone": c.telephone,
            "ville": c.ville,
            "type_carte": c.type_carte.code if c.type_carte_id else "?",
            "commercial": c.user.name if c.user_id else "—",
            "statut_carte": c.statut_carte,
        }

    return render(
        request, "Clients/Index", {"clients": paginer(request, clients, 20, formater)}
    )


@role_required(Role.ADMIN, Role.DIRECTION)
@http_methods("GET", "HEAD")
def clients_show(request, client):
    client = get_object_or_404(
        filtrer_saisies(
            Client.objects.select_related("user__agence", "type_carte"),
            partenaire_courant(request),
        ),
        pk=client,
    )
    ventes = client.ventes.select_related("agence", "type_carte", "user").all()

    return render(
        request,
        "Clients/Show",
        {
            "client": {
                "id": client.id,
                "nom_complet": f"{client.prenom} {client.nom}".strip(),
                "telephone": client.telephone,
                "ville": client.ville,
                "quartier": client.quartier,
                "type_carte": client.type_carte.code if client.type_carte_id else "?",
                "statut_carte": client.statut_carte,
                "commercial": client.user.name if client.user_id else "—",
                "agence": client.user.agence.nom
                if client.user_id and client.user.agence_id
                else None,
                "created_at": client.created_at.strftime("%d/%m/%Y %H:%M"),
                "carte_identite_url": request.build_absolute_uri(
                    "/storage/" + client.carte_identite
                )
                if client.carte_identite
                else None,
                "ventes": [
                    {
                        "id": v.id,
                        "date": v.created_at.strftime("%d/%m/%Y %H:%M"),
                        "type_carte": v.type_carte.code if v.type_carte_id else "?",
                        "commercial": v.user.name if v.user_id else "—",
                        "agence": v.agence.nom if v.agence_id else "—",
                        "statut_activation": v.statut_activation,
                    }
                    for v in ventes
                ],
            }
        },
    )


# ---------------------------------------------------------------------------
# Fiche client côté commercial (correction dans le délai de 48 h)
# ---------------------------------------------------------------------------


def _client_du_commercial(request, client_id):
    client = get_object_or_404(Client.objects.select_related("type_carte"), pk=client_id)
    if not request.user.is_commercial or int(client.user_id) != int(request.user.id):
        raise PermissionDenied("Vous ne pouvez modifier que vos propres clients.")
    return client


@role_required(Role.COMMERCIAL)
@http_methods("GET", "HEAD")
def commercial_client_edit(request, client):
    client = _client_du_commercial(request, client)
    modifiable = client.peut_etre_modifie_ou_supprime_par_commercial()

    return render(
        request,
        "Commercial/Clients/Edit",
        {
            "client": {
                "id": client.id,
                "prenom": client.prenom,
                "nom": client.nom,
                "telephone": client.telephone,
                "ville": client.ville,
                "quartier": client.quartier,
                "carte_identite_url": request.build_absolute_uri(
                    "/storage/" + client.carte_identite
                )
                if client.carte_identite
                else None,
                "type_carte_code": client.type_carte.code if client.type_carte_id else None,
                "verrouille": not modifiable,
                "peut_supprimer": modifiable,
            },
            "delaiHeures": DELAI_MODIFICATION_COMMERCIAL_HEURES,
        },
    )


@role_required(Role.COMMERCIAL)
@http_methods("POST", "PUT", "PATCH")
def commercial_client_update(request, client):
    client = _client_du_commercial(request, client)

    if not client.peut_etre_modifie_ou_supprime_par_commercial():
        deposer_flash(
            request,
            error=f"La modification n’est plus possible : plus de "
            f"{DELAI_MODIFICATION_COMMERCIAL_HEURES} h se sont écoulées depuis "
            "l’enregistrement du client.",
        )
        return redirect(f"/mes-clients/{client.id}/modifier")

    source = _corps(request)
    validateur = Validateur(source)
    validateur.champ("prenom", "required|max:100")
    validateur.champ("nom", "required|max:100")
    validateur.champ("telephone", "nullable|max:20")
    validateur.champ("ville", "nullable|max:100")
    validateur.champ("quartier", "nullable|max:100")
    try:
        donnees = validateur.resultat()
    except ErreursValidation as erreur:
        return retour_avec_erreurs(request, erreur.erreurs)

    for champ in ("prenom", "nom", "telephone", "ville", "quartier"):
        setattr(client, champ, donnees[champ])

    fichier = request.FILES.get("carte_identite")
    if fichier:
        _supprimer_piece_identite(client)
        client.carte_identite = _stocker_piece_identite(fichier)

    client.save()
    deposer_flash(request, success="Informations client mises à jour.")
    return redirect("/ventes")


@role_required(Role.COMMERCIAL)
@http_methods("POST", "DELETE")
def commercial_client_destroy(request, client):
    client = _client_du_commercial(request, client)

    if not client.peut_etre_modifie_ou_supprime_par_commercial():
        deposer_flash(
            request,
            error=f"La suppression n’est plus possible : plus de "
            f"{DELAI_MODIFICATION_COMMERCIAL_HEURES} heures se sont écoulées depuis "
            "l’enregistrement du client.",
        )
        return redirect(f"/mes-clients/{client.id}/modifier")

    _supprimer_piece_identite(client)
    client.delete()
    deposer_flash(
        request,
        success="Fiche client supprimée (ventes associées supprimées également).",
    )
    return redirect("/ventes")


# ---------------------------------------------------------------------------
# Contrat de prestation
# ---------------------------------------------------------------------------


def _campagne_du_commercial(user):
    """Première campagne active du périmètre où le commercial est engagé."""
    Campagne.sync_statuts()
    for campagne in Campagne.actives_pour_commercial(user):
        if campagne.est_engage_commercial(user.id):
            return campagne
    return None


@role_required(Role.COMMERCIAL, Role.COMMERCIAL_TELEPHONIQUE)
@http_methods("GET", "HEAD")
def contrat_show(request):
    user = request.user
    campagne = _campagne_du_commercial(user)

    if not campagne or not campagne.user_est_signataire_contrat(user):
        return render(request, "Commercial/Contrat/NoCampagne", {})

    reponse, _ = ContratPrestationReponse.objects.get_or_create(
        campagne_id=campagne.id,
        user_id=user.id,
        defaults={"statut": StatutReponseContrat.EN_ATTENTE},
    )

    verrou = bool(campagne.contrat_publie_at) and campagne.contrat_delai_expire()
    peut_repondre = (
        bool(campagne.contrat_publie_at)
        and not verrou
        and reponse.statut == StatutReponseContrat.EN_ATTENTE
    )

    contexte = services.donnees_contrat(campagne)
    versements = campagne.aide_versements.filter(user_id=user.id).order_by("-semaine_debut")
    # Le commercial dispose de 5 jours après publication pour répondre.
    echeance = (
        campagne.contrat_publie_at + timedelta(days=5)
        if campagne.contrat_publie_at
        else None
    )

    return render(
        request,
        "Commercial/Contrat/Show",
        {
            "campagne": {
                "nom": campagne.nom,
                "date_debut": campagne.date_debut.strftime("%d/%m/%Y"),
                "date_fin": campagne.date_fin.strftime("%d/%m/%Y"),
                "contrat_publie_at": bool(campagne.contrat_publie_at),
                "aide_hebdo_active": campagne.aide_hebdo_active,
            },
            "user": {
                "adresse_contrat": user.adresse_contrat,
                "piece_identite_ref": user.piece_identite_ref,
            },
            "reponse": {
                "statut": reponse.statut,
                "repondu_at": reponse.repondu_at.strftime("%d/%m/%Y %H:%M")
                if reponse.repondu_at
                else None,
            },
            "verrou5j": bool(verrou),
            "peutRepondre": bool(peut_repondre),
            "echeance": echeance.strftime("%d/%m/%Y %H:%M") if echeance else None,
            "document": {
                # Le contrat UBA énonce la rémunération dans son article 4 ;
                # celui de la BDM la laisse au bloc calculé plus bas. Afficher
                # les deux la ferait dire deux fois, au risque de diverger.
                "remuneration_dans_articles": remuneration_dans_articles(
                    campagne.partenaire.contrat_modele
                    if campagne.partenaire_id
                    else None
                ),
                "client_nom": campagne.partenaire.nom if campagne.partenaire_id else None,
                "representant_nom": campagne.contrat_representant_nom,
                "nom_presta": _nom(user),
                "contact_presta": user.telephone or "—",
                "adresse": user.adresse_contrat or "………………………",
                "piece_id": user.piece_identite_ref or "………………………",
                "lundi_effectif": contexte["lundi_effectif"].strftime("%d/%m/%Y"),
                "date_fin": campagne.date_fin.strftime("%d/%m/%Y"),
                "nom_campagne": campagne.nom,
                "articles": [
                    {"titre": a.titre, "contenu": a.contenu}
                    for a in campagne.contrat_articles.order_by("sort_order")
                ],
                "emolument_forfait": nombre_format(campagne.contrat_emolument_forfait),
                "forfait_communication": nombre_format(
                    campagne.contrat_forfait_communication
                ),
                "forfait_deplacement": nombre_format(campagne.contrat_forfait_deplacement),
                "prime_meilleur_vendeur": nombre_format(campagne.prime_meilleur_vendeur),
                "aide_hebdo_active": campagne.aide_hebdo_active,
                "aide_hebdo_montant": nombre_format(campagne.aide_hebdo_montant),
                "aide_hebdo_carburant": nombre_format(campagne.aide_hebdo_carburant),
                "aide_hebdo_credit_tel": nombre_format(campagne.aide_hebdo_credit_tel),
                "clause_libre": campagne.contrat_clause_libre,
                "lieu_signature": campagne.contrat_lieu_signature,
                "date_signature_affichee": contexte["date_signature_affichee"],
            },
            "versements": [
                {
                    "id": v.id,
                    "semaine_debut": v.semaine_debut.strftime("%d/%m/%Y"),
                    "montant_carburant": nombre_format(v.montant_carburant),
                    "montant_credit_tel": nombre_format(v.montant_credit_tel),
                    "accuse_at": v.accuse_at.strftime("%d/%m/%Y %H:%M")
                    if v.accuse_at
                    else None,
                }
                for v in versements
            ],
        },
    )


def _repondre_contrat(request, statut):
    user = request.user
    campagne = _campagne_du_commercial(user)

    if not campagne or not campagne.user_est_signataire_contrat(user):
        deposer_flash(request, error="Campagne ou habilitation invalide.")
        return redirect("/mon-contrat")

    reponse = ContratPrestationReponse.objects.filter(
        campagne_id=campagne.id, user_id=user.id
    ).first()
    if reponse is None:
        raise Http404

    if campagne.contrat_delai_expire() or reponse.statut != StatutReponseContrat.EN_ATTENTE:
        deposer_flash(
            request,
            error="Vous ne pouvez plus modifier votre réponse "
            "(délai de 5 jours dépassé ou décision déjà enregistrée).",
        )
        return redirect("/mon-contrat")

    if not campagne.contrat_publie_at:
        deposer_flash(
            request, error="Le contrat n’a pas encore été publié par l’administrateur."
        )
        return redirect("/mon-contrat")

    reponse.statut = statut
    reponse.repondu_at = datetime.now().replace(microsecond=0)
    reponse.save(update_fields=["statut", "repondu_at"])

    deposer_flash(
        request,
        success="Contrat accepté. Merci."
        if statut == StatutReponseContrat.ACCEPTE
        else "Contrat refusé. La direction en sera informée.",
    )
    return redirect("/mon-contrat")


@role_required(Role.COMMERCIAL, Role.COMMERCIAL_TELEPHONIQUE)
@http_methods("POST")
def contrat_accepter(request):
    return _repondre_contrat(request, StatutReponseContrat.ACCEPTE)


@role_required(Role.COMMERCIAL, Role.COMMERCIAL_TELEPHONIQUE)
@http_methods("POST")
def contrat_rejeter(request):
    return _repondre_contrat(request, StatutReponseContrat.REJETE)


@role_required(Role.COMMERCIAL, Role.COMMERCIAL_TELEPHONIQUE)
@http_methods("POST")
def versement_accuser(request, versement):
    versement = get_object_or_404(CampagneAideVersement, pk=versement)
    if versement.user_id != request.user.id:
        raise PermissionDenied
    if versement.accuse_at:
        deposer_flash(request, error="Ce versement est déjà accusé réception.")
        return redirect(request.META.get("HTTP_REFERER") or "/mon-contrat")

    versement.accuse_at = datetime.now().replace(microsecond=0)
    versement.accuse_commentaire = request.POST.get("accuse_commentaire") or None
    versement.save(update_fields=["accuse_at", "accuse_commentaire"])

    deposer_flash(request, success="Réception des aides enregistrée.")
    return redirect(request.META.get("HTTP_REFERER") or "/mon-contrat")


# ---------------------------------------------------------------------------
# Reporting téléphonique
# ---------------------------------------------------------------------------


@role_required(Role.COMMERCIAL_TELEPHONIQUE)
@http_methods("GET", "HEAD")
def telephonique_index(request):
    user = request.user
    agence_id = int(user.agence_id) if user.agence_id else None
    base = services.restreindre_aux_campagnes_vente(
        TelephoniqueRapport.objects.filter(user_id=user.id),
        agence_id,
        user.partenaire_id,
    )

    def formater(r):
        return {
            "id": r.id,
            "date_iso": r.date_rapport.strftime("%Y-%m-%d"),
            "date": r.date_rapport.strftime("%d/%m/%Y"),
            "appels_emis": r.appels_emis,
            "appels_joignables": r.appels_joignables,
            "appels_non_joignables": r.appels_non_joignables,
            "taux_joignabilite": f"{nombre_format(r.taux_joignabilite, 2)} %"
            if r.taux_joignabilite is not None
            else None,
            "clients_interesses_nombre": r.clients_interesses_nombre,
            "peut_modifier": r.peut_etre_modifie_ou_supprime(),
        }

    return render(
        request,
        "Commercial/Telephonique/Index",
        {
            "libelleStatsCampagne": services.libelle_stats(
                agence_id, TypeCampagne.VENTE_CARTE, user.partenaire_id
            ),
            "totauxListe": totaux_telephonique(base),
            "rapports": paginer(
                request, base.order_by("-date_rapport", "-id"), 20, formater
            ),
        },
    )


def _types_cartes_campagne(user):
    """Types proposés au reporting, selon la campagne active du périmètre."""
    Campagne.sync_statuts()
    actives = list(Campagne.actives_pour_commercial(user)[:1])
    campagne = actives[0] if actives else None
    if campagne is None:
        return None, []
    return campagne, list(campagne.types_cartes_pour_reporting_telephonique())


@role_required(Role.COMMERCIAL_TELEPHONIQUE)
@http_methods("GET", "HEAD")
def telephonique_create(request):
    user = request.user
    jour = request.GET.get("date") or date.today().strftime("%Y-%m-%d")
    rapport = TelephoniqueRapport.objects.filter(
        user_id=user.id, date_rapport=jour
    ).first()

    campagne, types = _types_cartes_campagne(user)

    return render(
        request,
        "Commercial/Telephonique/Form",
        {
            "dateRapport": jour,
            "campagneActiveNom": campagne.nom if campagne else None,
            "rapportVerrouille": bool(rapport and not rapport.peut_etre_modifie_ou_supprime()),
            "typesCampagne": [{"id": t.id, "code": t.code} for t in types],
            "rapport": {
                "appels_emis": rapport.appels_emis,
                "appels_joignables": rapport.appels_joignables,
                "taux_joignabilite": rapport.taux_joignabilite,
                "clients_interesses_nombre": rapport.clients_interesses_nombre,
                "clients_deja_servis_nombre": rapport.clients_deja_servis_nombre,
                "nj_repondeur": rapport.nj_repondeur,
                "nj_numero_errone": rapport.nj_numero_errone,
                "nj_hors_reseau": rapport.nj_hors_reseau,
                "nj_autres_nombre": rapport.nj_autres_nombre,
                "nj_autres_precision": rapport.nj_autres_precision,
                "propose": {
                    str(t.id): rapport.nombre_propose_pour_type(t.id) for t in types
                },
            }
            if rapport
            else None,
        },
    )


@role_required(Role.COMMERCIAL_TELEPHONIQUE)
@http_methods("POST")
def telephonique_store(request):
    user = request.user
    _, types = _types_cartes_campagne(user)
    source = request.POST

    validateur = Validateur(source)
    validateur.champ("date_rapport", "required|date")
    for champ in (
        "appels_emis",
        "appels_joignables",
        "clients_interesses_nombre",
        "clients_deja_servis_nombre",
        "nj_repondeur",
        "nj_numero_errone",
        "nj_hors_reseau",
        "nj_autres_nombre",
    ):
        validateur.champ(champ, "required|integer|min:0")
    validateur.champ("nj_autres_precision", "nullable|max:500")
    for type_carte in types:
        validateur.champ(f"propose.{type_carte.id}", "required|integer|min:0")

    try:
        donnees = validateur.resultat()
    except ErreursValidation as erreur:
        return retour_avec_erreurs(request, erreur.erreurs)

    autres = donnees["nj_autres_nombre"]
    if autres > 0 and not (donnees.get("nj_autres_precision") or "").strip():
        return retour_avec_erreurs(
            request,
            {
                "nj_autres_precision": "Précisez le motif « autres » lorsque le nombre est supérieur à 0."
            },
        )

    emis, joignables = donnees["appels_emis"], donnees["appels_joignables"]
    if joignables > emis:
        return retour_avec_erreurs(
            request,
            {
                "appels_joignables": "Le nombre de joignables ne peut pas dépasser les appels émis."
            },
        )

    non_joignables = max(0, emis - joignables)
    somme_motifs = (
        donnees["nj_repondeur"]
        + donnees["nj_numero_errone"]
        + donnees["nj_hors_reseau"]
        + autres
    )
    if somme_motifs > non_joignables:
        return retour_avec_erreurs(
            request,
            {
                "nj_analyse": "La somme (répondeur + n° erroné + hors réseau + autres) ne peut "
                "pas dépasser le nombre de non joignables (appels émis − joignables), soit "
                f"{non_joignables} pour cette fiche."
            },
        )

    jour = donnees["date_rapport"]
    existante = TelephoniqueRapport.objects.filter(
        user_id=user.id, date_rapport=jour
    ).first()
    if existante and not existante.peut_etre_modifie_ou_supprime():
        return retour_avec_erreurs(
            request,
            {
                "date_rapport": "Cette fiche ne peut plus être modifiée : délai de 48 h "
                "dépassé depuis l’enregistrement."
            },
        )

    agence_id = int(user.agence_id) if user.agence_id else None
    campagne_fiche = Campagne.pour_fiche_telephonique(
        agence_id, date.fromisoformat(jour), user.partenaire_id
    )

    valeurs = {
        "campagne_id": campagne_fiche.id if campagne_fiche else None,
        "appels_emis": emis,
        "appels_joignables": joignables,
        "appels_non_joignables": non_joignables,
        "taux_joignabilite": round(joignables / emis * 100, 2) if emis > 0 else None,
        "clients_interesses_nombre": donnees["clients_interesses_nombre"],
        "clients_interesses_pct": None,
        "clients_deja_servis_nombre": donnees["clients_deja_servis_nombre"],
        "clients_deja_servis_pct": None,
        "cartes_proposees": {
            str(t.id): donnees[f"propose.{t.id}"] for t in types
        },
        # Colonnes de l'ancien format, conservées à zéro pour l'historique.
        "propose_visa": 0,
        "propose_gim": 0,
        "propose_cauris": 0,
        "propose_prepayee": 0,
        "nj_repondeur": donnees["nj_repondeur"],
        "nj_numero_errone": donnees["nj_numero_errone"],
        "nj_hors_reseau": donnees["nj_hors_reseau"],
        "nj_autres_nombre": autres,
        "nj_autres_precision": (donnees.get("nj_autres_precision") or "").strip()
        if autres > 0
        else None,
    }

    TelephoniqueRapport.objects.update_or_create(
        user_id=user.id, date_rapport=jour, defaults=valeurs
    )

    deposer_flash(request, success="Fiche enregistrée.")
    return redirect("/reporting-telephonique")


@role_required(Role.COMMERCIAL_TELEPHONIQUE)
@http_methods("POST", "DELETE")
def telephonique_destroy(request, telephoniqueRapport):
    rapport = get_object_or_404(TelephoniqueRapport, pk=telephoniqueRapport)
    if rapport.user_id != request.user.id:
        raise PermissionDenied

    if not rapport.peut_etre_modifie_ou_supprime():
        deposer_flash(
            request,
            error="Suppression impossible : délai de 48 h dépassé depuis l’enregistrement de cette fiche.",
        )
        return redirect("/reporting-telephonique")

    rapport.delete()
    deposer_flash(request, success="Fiche supprimée.")
    return redirect("/reporting-telephonique")
