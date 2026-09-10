"""
Référentiels d'administration : agences, types de cartes, utilisateurs
(dont transfert d'agence) et journal des connexions.

Portage de app/Http/Controllers/Admin/{Agence,TypeCarte,User,UserLoginLog}Controller.php.
"""

import re

from django.db import transaction
from django.db.models import Q
from django.http import Http404
from django.shortcuts import get_object_or_404, redirect
from inertia import render

from campagnes.models import Campagne, CommercialAgenceTransfert, ContratPrestationReponse
from terrain.models import Vente

from .auth_backend import hacher_mot_de_passe
from .decorators import http_methods, role_required
from .middleware import deposer_flash, retour_avec_erreurs
from .models import ROLES_COMMERCIAUX, Agence, Role, TypeCarte, User, UserLoginLog
from .pagination import paginer
from .partenaires import (
    filtrer_agences,
    filtrer_types_cartes,
    filtrer_saisies,
    filtrer_users,
    partenaire_courant,
)
from .php import tableau
from .validation import ErreursValidation, Validateur, booleen, valider

#: Rôles administrables depuis l'écran utilisateurs (l'admin ne s'y gère pas lui-même).
ROLES_ADMINISTRABLES = [Role.COMMERCIAL, Role.COMMERCIAL_TELEPHONIQUE, Role.DIRECTION]


def _nom_complet(user):
    if user is None:
        return None
    return f"{user.prenom} {user.name}".strip() if user.prenom else user.name


# ---------------------------------------------------------------------------
# Agences
# ---------------------------------------------------------------------------


def _agence_du_perimetre(request, agence_id):
    """Une agence du client courant, 404 sinon — l'URL ne doit pas franchir la cloison."""
    return get_object_or_404(
        filtrer_agences(Agence.objects.all(), partenaire_courant(request)),
        pk=agence_id,
    )


def _user_du_perimetre(request, user_id):
    return get_object_or_404(
        filtrer_users(User.objects.all(), partenaire_courant(request)), pk=user_id
    )


@role_required(Role.ADMIN)
@http_methods("GET", "HEAD")
def agences_index(request):
    agences = filtrer_agences(
        Agence.objects.order_by("ordre", "nom"), partenaire_courant(request)
    )
    return render(
        request,
        "Admin/Agences/Index",
        {
            "agences": [
                {"id": a.id, "ordre": a.ordre, "nom": a.nom} for a in agences
            ]
        },
    )


@role_required(Role.ADMIN)
@http_methods("GET", "HEAD")
def agences_create(request):
    maximum = (
        filtrer_agences(Agence.objects.all(), partenaire_courant(request))
        .order_by("-ordre")
        .values_list("ordre", flat=True)
        .first()
    )
    return render(
        request, "Admin/Agences/Create", {"ordreSuggest": int(maximum or 0) + 1}
    )


@role_required(Role.ADMIN)
@http_methods("POST")
def agences_store(request):
    try:
        donnees = valider(
            request.POST, {"ordre": "required|integer|min:0", "nom": "required|max:255"}
        )
    except ErreursValidation as erreur:
        return retour_avec_erreurs(request, erreur.erreurs)

    partenaire = partenaire_courant(request)
    Agence.objects.create(
        ordre=donnees["ordre"],
        nom=donnees["nom"],
        adresse=None,
        chef=None,
        partenaire_id=partenaire.id if partenaire else None,
    )
    deposer_flash(request, success="Agence créée.")
    return redirect("/admin/agences")


@role_required(Role.ADMIN)
@http_methods("GET", "HEAD")
def agences_edit(request, agence):
    agence = _agence_du_perimetre(request, agence)
    return render(
        request,
        "Admin/Agences/Edit",
        {"agence": {"id": agence.id, "ordre": agence.ordre, "nom": agence.nom}},
    )


@role_required(Role.ADMIN)
@http_methods("POST", "PUT", "PATCH")
def agences_update(request, agence):
    agence = _agence_du_perimetre(request, agence)
    try:
        donnees = valider(
            _corps(request), {"ordre": "required|integer|min:0", "nom": "required|max:255"}
        )
    except ErreursValidation as erreur:
        return retour_avec_erreurs(request, erreur.erreurs)

    agence.ordre = donnees["ordre"]
    agence.nom = donnees["nom"]
    agence.adresse = None
    agence.save()
    deposer_flash(request, success="Agence mise à jour.")
    return redirect("/admin/agences")


@role_required(Role.ADMIN)
@http_methods("POST", "DELETE")
def agences_destroy(request, agence):
    agence = _agence_du_perimetre(request, agence)
    with transaction.atomic():
        if agence.chef_id:
            agence.chef = None
            agence.save(update_fields=["chef"])
        # Les utilisateurs rattachés sont détachés, pas supprimés.
        User.objects.filter(agence_id=agence.id).update(agence_id=None)
        agence.delete()
    deposer_flash(request, success="Agence supprimée.")
    return redirect("/admin/agences")


# ---------------------------------------------------------------------------
# Types de cartes
# ---------------------------------------------------------------------------


def _slug_code(valeur):
    """Reproduit `Str::upper(Str::slug($code, '_'))`."""
    import unicodedata

    sans_accent = (
        unicodedata.normalize("NFKD", str(valeur)).encode("ascii", "ignore").decode()
    )
    slug = re.sub(r"[^a-zA-Z0-9]+", "_", sans_accent).strip("_")
    return slug.upper()


def _type_carte_du_perimetre(request, type_carte_id):
    """Un type de carte du catalogue du client courant, 404 sinon."""
    return get_object_or_404(
        filtrer_types_cartes(TypeCarte.objects.all(), partenaire_courant(request)),
        pk=type_carte_id,
    )


@role_required(Role.ADMIN)
@http_methods("GET", "HEAD")
def types_cartes_index(request):
    types = filtrer_types_cartes(
        TypeCarte.objects.order_by("code"), partenaire_courant(request)
    )
    return render(
        request,
        "Admin/TypesCartes/Index",
        {
            "types": [
                {"id": t.id, "code": t.code, "actif": bool(t.actif)} for t in types
            ]
        },
    )


@role_required(Role.ADMIN)
@http_methods("GET", "HEAD")
def types_cartes_create(request):
    return render(request, "Admin/TypesCartes/Create", {})


@role_required(Role.ADMIN)
@http_methods("POST")
def types_cartes_store(request):
    try:
        donnees = valider(request.POST, {"code": "required|max:50", "actif": "boolean"})
    except ErreursValidation as erreur:
        return retour_avec_erreurs(request, erreur.erreurs)

    code = _slug_code(donnees["code"])
    if code == "":
        return retour_avec_erreurs(request, {"code": "Code invalide."})
    if TypeCarte.objects.filter(code=code).exists():
        return retour_avec_erreurs(request, {"code": "Ce code existe déjà."})

    # La carte est créée au catalogue du client que l'administrateur consulte.
    partenaire = partenaire_courant(request)
    TypeCarte.objects.create(
        code=code,
        actif=booleen(request.POST, "actif"),
        partenaire_id=partenaire.id if partenaire else None,
    )
    deposer_flash(request, success="Type de carte créé.")
    return redirect("/admin/types-cartes")


@role_required(Role.ADMIN)
@http_methods("GET", "HEAD")
def types_cartes_edit(request, types_carte):
    type_carte = _type_carte_du_perimetre(request, types_carte)
    return render(
        request,
        "Admin/TypesCartes/Edit",
        {
            "typeCarte": {
                "id": type_carte.id,
                "code": type_carte.code,
                "actif": bool(type_carte.actif),
            }
        },
    )


@role_required(Role.ADMIN)
@http_methods("POST", "PUT", "PATCH")
def types_cartes_update(request, types_carte):
    type_carte = _type_carte_du_perimetre(request, types_carte)
    # Le code n'est pas modifiable : il est référencé par les ventes et les clients.
    type_carte.actif = booleen(_corps(request), "actif", defaut=True)
    type_carte.save()
    deposer_flash(request, success="Type de carte mis à jour.")
    return redirect("/admin/types-cartes")


@role_required(Role.ADMIN)
@http_methods("POST", "DELETE")
def types_cartes_destroy(request, types_carte):
    type_carte = _type_carte_du_perimetre(request, types_carte)
    if type_carte.ventes.exists() or type_carte.clients.exists():
        deposer_flash(
            request,
            error="Impossible de supprimer : des ventes ou clients utilisent encore ce type.",
        )
        return redirect("/admin/types-cartes")

    type_carte.delete()
    deposer_flash(request, success="Type de carte supprimé.")
    return redirect("/admin/types-cartes")


# ---------------------------------------------------------------------------
# Utilisateurs
# ---------------------------------------------------------------------------


def _statut_contrat_campagne_active(user):
    """
    Statut du contrat de prestation pour la campagne active du commercial.

    Le périmètre est celui de son rattachement : son agence chez un partenaire
    qui en a, son partenaire sinon.
    """
    if not user.is_commercial_ou_telephonique:
        return None

    Campagne.sync_statuts()
    campagnes = list(Campagne.actives_pour_commercial(user)[:1])
    campagne = campagnes[0] if campagnes else None

    if not campagne or not campagne.user_est_signataire_contrat(user):
        return "non_signataire"

    reponse = ContratPrestationReponse.objects.filter(
        campagne_id=campagne.id, user_id=user.id
    ).first()
    return reponse.statut if reponse else "en_attente"


def _filtre_recherche(terme):
    """`LIKE %terme%` sur le nom, le prénom ou le téléphone."""
    terme = (terme or "").strip()
    if not terme:
        return Q()
    return (
        Q(name__icontains=terme)
        | Q(prenom__icontains=terme)
        | Q(telephone__icontains=terme)
    )


@role_required(Role.ADMIN)
@http_methods("GET", "HEAD")
def users_index(request):
    partenaire = partenaire_courant(request)
    qs = filtrer_users(
        User.objects.select_related("agence").filter(role__in=ROLES_ADMINISTRABLES),
        partenaire,
    )

    role = request.GET.get("role")
    if role:
        qs = qs.filter(role=role)

    recherche = request.GET.get("q")
    if recherche:
        qs = qs.filter(_filtre_recherche(recherche))

    filtre_contrat = request.GET.get("contrat")
    if filtre_contrat in ("accepte", "rejete", "en_attente", "non_signataire"):
        # Le statut se calcule utilisateur par utilisateur : on résout d'abord
        # les identifiants correspondants, puis on restreint la requête.
        candidats = filtrer_users(
            User.objects.filter(role__in=ROLES_COMMERCIAUX), partenaire
        )
        if partenaire is None or partenaire.a_des_agences:
            candidats = candidats.filter(agence_id__isnull=False)
        if role in ROLES_COMMERCIAUX:
            candidats = candidats.filter(role=role)
        if recherche:
            candidats = candidats.filter(_filtre_recherche(recherche))
        ids = [
            u.id
            for u in candidats
            if _statut_contrat_campagne_active(u) == filtre_contrat
        ]
        qs = qs.filter(pk__in=ids or [0])

    qs = qs.order_by("role", "name")
    utilisateur_courant = request.user.id

    def formater(u):
        return {
            "id": u.id,
            "nom_complet": _nom_complet(u),
            "telephone": u.telephone,
            "email": u.email,
            "role": u.role,
            "contrat_statut": _statut_contrat_campagne_active(u),
            "actif": bool(u.actif),
            "agence_nom": u.agence.nom if u.agence_id else None,
            "is_self": u.id == utilisateur_courant,
        }

    return render(
        request,
        "Admin/Users/Index",
        {
            "filters": tableau(
                {
                    cle: request.GET.get(cle)
                    for cle in ("q", "role", "contrat")
                    if request.GET.get(cle)
                }
            ),
            "users": paginer(request, qs, 15, formater),
            # Le client courant n'a peut-être pas d'agences : la colonne
            # correspondante disparaît alors de la liste.
            "aDesAgences": partenaire is None or partenaire.a_des_agences,
        },
    )


def _liste_agences(request):
    return [
        {"id": a.id, "nom": a.nom}
        for a in filtrer_agences(
            Agence.objects.order_by("nom"), partenaire_courant(request)
        )
    ]


def _props_referentiel(request):
    partenaire = partenaire_courant(request)
    return {
        "agences": _liste_agences(request),
        "aDesAgences": partenaire is None or partenaire.a_des_agences,
        "clientNom": partenaire.nom if partenaire else None,
    }


@role_required(Role.ADMIN)
@http_methods("GET", "HEAD")
def users_create(request):
    return render(request, "Admin/Users/Create", _props_referentiel(request))


def _corps(request):
    """
    Corps de la requête, que la méthode soit POST ou PUT/PATCH.

    Le frontend Inertia envoie les mises à jour en PUT. `request.POST` suffit
    dans tous les cas : `core.middleware.CorpsJsonMiddleware` le remplit déjà
    à partir du corps JSON ou form-urlencoded, quelle que soit la méthode —
    reconstruire le corps ici à la main (`QueryDict(request.body)`) traiterait
    un corps JSON comme une chaîne de requête et ne lirait plus aucun champ.
    """
    return request.POST


def _valider_user(request, user=None):
    """Règles communes à la création et à la mise à jour d'un utilisateur."""
    source = _corps(request)
    validateur = Validateur(source)
    validateur.champ("name", "required|max:255")
    validateur.champ("prenom", "nullable|max:100")
    validateur.champ("email", "nullable|email")
    validateur.champ("telephone", "required|max:20")
    validateur.champ(
        "role", "required|in:commercial,commercial_telephonique,direction"
    )
    validateur.champ("agence_id", "nullable|integer")
    validateur.champ("adresse_contrat", "nullable|max:5000")
    validateur.champ("piece_identite_ref", "nullable|max:191")

    validateur.unique("email", User.objects.all(), user.pk if user else None)
    validateur.unique("telephone", User.objects.all(), user.pk if user else None)
    if validateur.valeurs.get("agence_id"):
        validateur.existe("agence_id", Agence.objects.all())

    # L'agence n'est exigée que chez un partenaire qui en a un réseau : chez
    # UBA, un commercial dépend directement du client.
    partenaire = partenaire_courant(request)
    exige_agence = partenaire is None or partenaire.a_des_agences

    role = validateur.valeurs.get("role")
    if (
        exige_agence
        and role in ROLES_COMMERCIAUX
        and not validateur.valeurs.get("agence_id")
    ):
        validateur.erreur(
            "agence_id", "L’agence est obligatoire pour ce type de profil."
        )

    return validateur.resultat(), source


def _appliquer_user(user, donnees, source, partenaire=None):
    """Champs communs création / mise à jour, avec les remises à null de Laravel."""
    role = donnees["role"]
    terrain_ou_tel = role in ROLES_COMMERCIAUX

    user.name = donnees["name"]
    user.prenom = donnees["prenom"]
    # Les commerciaux n'ont pas d'e-mail : ils se connectent par téléphone.
    user.email = None if terrain_ou_tel else (donnees["email"] or None)
    user.telephone = donnees["telephone"] or None
    user.role = role
    user.agence_id = None if role == Role.DIRECTION else donnees["agence_id"]
    # Le compte est créé chez le client que l'administrateur consulte.
    if partenaire is not None:
        user.partenaire_id = partenaire.id
    user.actif = booleen(source, "actif")
    user.adresse_contrat = donnees["adresse_contrat"] or None if terrain_ou_tel else None
    user.piece_identite_ref = (
        donnees["piece_identite_ref"] or None if terrain_ou_tel else None
    )
    return user


@role_required(Role.ADMIN)
@http_methods("POST")
def users_store(request):
    try:
        donnees, source = _valider_user(request)
    except ErreursValidation as erreur:
        return retour_avec_erreurs(request, erreur.erreurs)

    mot_de_passe = source.get("password") or ""
    if not mot_de_passe:
        return retour_avec_erreurs(
            request, {"password": "Le champ password est obligatoire."}
        )
    if mot_de_passe != source.get("password_confirmation"):
        return retour_avec_erreurs(
            request, {"password": "Le champ de confirmation password ne correspond pas."}
        )
    if len(mot_de_passe) < 8:
        return retour_avec_erreurs(
            request,
            {"password": "Le texte de password doit contenir au moins 8 caractères."},
        )

    user = _appliquer_user(User(), donnees, source, partenaire_courant(request))
    user.password = hacher_mot_de_passe(mot_de_passe)
    user.save()

    deposer_flash(request, success="Utilisateur créé.")
    return redirect("/admin/users")


@role_required(Role.ADMIN)
@http_methods("GET", "HEAD")
def users_edit(request, user):
    user = _user_du_perimetre(request, user)
    return render(
        request,
        "Admin/Users/Edit",
        {
            "user": {
                "id": user.id,
                "name": user.name,
                "prenom": user.prenom,
                "telephone": user.telephone,
                "email": user.email,
                "role": user.role,
                "agence_id": user.agence_id,
                "actif": bool(user.actif),
                "adresse_contrat": user.adresse_contrat,
                "piece_identite_ref": user.piece_identite_ref,
                "is_commercial_ou_telephonique": user.is_commercial_ou_telephonique,
            },
            **_props_referentiel(request),
        },
    )


@role_required(Role.ADMIN)
@http_methods("POST", "PUT", "PATCH")
def users_update(request, user):
    user = _user_du_perimetre(request, user)
    try:
        donnees, source = _valider_user(request, user)
    except ErreursValidation as erreur:
        return retour_avec_erreurs(request, erreur.erreurs)

    _appliquer_user(user, donnees, source, partenaire_courant(request))

    mot_de_passe = source.get("password") or ""
    if mot_de_passe:
        if mot_de_passe != source.get("password_confirmation"):
            return retour_avec_erreurs(
                request,
                {"password": "Le champ de confirmation password ne correspond pas."},
            )
        if len(mot_de_passe) < 8:
            return retour_avec_erreurs(
                request,
                {"password": "Le texte de password doit contenir au moins 8 caractères."},
            )
        user.password = hacher_mot_de_passe(mot_de_passe)

    user.save()
    deposer_flash(request, success="Utilisateur mis à jour.")
    return redirect("/admin/users")


@role_required(Role.ADMIN)
@http_methods("POST", "DELETE")
def users_destroy(request, user):
    user = _user_du_perimetre(request, user)
    user.agence_id = None
    user.save(update_fields=["agence_id"])
    user.delete()
    deposer_flash(request, success="Utilisateur supprimé.")
    return redirect("/admin/users")


# ---------------------------------------------------------------------------
# Transfert d'agence
# ---------------------------------------------------------------------------


@role_required(Role.ADMIN)
@http_methods("GET", "HEAD")
def users_transfert_form(request, user):
    user = get_object_or_404(
        filtrer_users(
            User.objects.select_related("agence"), partenaire_courant(request)
        ),
        pk=user,
    )
    if not user.is_commercial_ou_telephonique:
        raise Http404

    ventes = Vente.objects.filter(user_id=user.id).select_related(
        "campagne", "agence", "type_carte", "client"
    )

    du = request.GET.get("du")
    au = request.GET.get("au")
    if du:
        ventes = ventes.filter(created_at__date__gte=du)
    if au:
        ventes = ventes.filter(created_at__date__lte=au)
    if request.GET.get("campagne_id"):
        ventes = ventes.filter(campagne_id=int(request.GET["campagne_id"]))
    if request.GET.get("agence_id"):
        ventes = ventes.filter(agence_id=int(request.GET["agence_id"]))

    ventes = ventes.order_by("-created_at")

    retour_campagne = None
    if request.GET.get("return_campagne"):
        retour_campagne = Campagne.objects.filter(
            pk=int(request.GET["return_campagne"])
        ).first()

    filtres_url = {
        cle: request.GET.get(cle)
        for cle in ("du", "au", "campagne_id", "agence_id", "return_campagne", "mode")
        if request.GET.get(cle)
    }

    return render(
        request,
        "Admin/Users/TransfertAgence",
        {
            "user": {
                "id": user.id,
                "nom_complet": _nom_complet(user),
                "agence_nom": user.agence.nom if user.agence_id else None,
            },
            "ventes": paginer(
                request,
                ventes,
                25,
                lambda v: {
                    "id": v.id,
                    "date": v.created_at.strftime("%d/%m/%Y %H:%M"),
                    "campagne_nom": v.campagne.nom if v.campagne_id else None,
                    "type_carte_code": v.type_carte.code if v.type_carte_id else None,
                    "agence_nom": v.agence.nom if v.agence_id else None,
                },
            ),
            "campagnes": [
                {"id": c.id, "nom": c.nom}
                for c in Campagne.objects.order_by("-date_debut", "-id")
            ],
            "agences": [
                {"id": a.id, "nom": a.nom}
                for a in Agence.objects.order_by("ordre", "nom")
            ],
            "returnCampagne": {"id": retour_campagne.id, "nom": retour_campagne.nom}
            if retour_campagne
            else None,
            "modeProfil": request.GET.get("mode") == "profil",
            "filters": {
                "du": request.GET.get("du", ""),
                "au": request.GET.get("au", ""),
                "campagne_id": request.GET.get("campagne_id", ""),
                "agence_id": request.GET.get("agence_id", ""),
            },
            "qFilters": tableau(filtres_url),
        },
    )


def _reattribuer_ventes(commercial, vente_ids, nouvelle_agence_id):
    """
    Portage de TransfertVentesAgenceService : ne touche que `ventes.agence_id`.

    Renvoie le nombre de ventes réellement déplacées et les instantanés
    avant/après, tracés dans `commercial_agence_transferts`.
    """
    vente_ids = sorted({int(i) for i in vente_ids})
    if not vente_ids:
        raise ValueError("Sélectionnez au moins une vente.")
    if not Agence.objects.filter(pk=nouvelle_agence_id).exists():
        raise ValueError("Agence cible invalide.")

    with transaction.atomic():
        ventes = list(
            Vente.objects.select_for_update()
            .filter(id__in=vente_ids, user_id=commercial.id)
            .order_by("id")
        )
        if len(ventes) != len(vente_ids):
            raise ValueError(
                "Certaines ventes sont introuvables ou n’appartiennent pas à ce commercial."
            )

        instantanes = []
        for vente in ventes:
            ancienne = int(vente.agence_id)
            if ancienne == nouvelle_agence_id:
                continue
            vente.agence_id = nouvelle_agence_id
            vente.save(update_fields=["agence_id"])
            instantanes.append(
                {
                    "vente_id": int(vente.id),
                    "agence_avant": ancienne,
                    "agence_apres": nouvelle_agence_id,
                }
            )

    return {"count": len(instantanes), "snapshots": instantanes}


def _sync_agences_campagnes_signataire(user):
    """
    Ajoute la nouvelle agence du profil aux campagnes où le commercial est
    signataire, sans retirer les anciennes : les ventes déjà enregistrées
    doivent rester rattachables à leur agence d'origine.
    """
    if not user.agence_id:
        return

    for campagne in Campagne.objects.filter(signataires_contrat__id=user.id).distinct():
        ids = set(campagne.agences.values_list("id", flat=True))
        ids.update(
            Vente.objects.filter(user_id=user.id, campagne_id=campagne.id)
            .values_list("agence_id", flat=True)
            .distinct()
        )
        ids.add(int(user.agence_id))

        from campagnes.models import CampagneAgence

        CampagneAgence.objects.filter(campagne_id=campagne.id).exclude(
            agence_id__in=ids
        ).delete()
        existants = set(
            CampagneAgence.objects.filter(campagne_id=campagne.id).values_list(
                "agence_id", flat=True
            )
        )
        CampagneAgence.objects.bulk_create(
            [
                CampagneAgence(campagne_id=campagne.id, agence_id=agence_id)
                for agence_id in ids - existants
            ]
        )


@role_required(Role.ADMIN)
@http_methods("POST")
def users_transfert_apply(request, user):
    user = get_object_or_404(User, pk=user)
    if not user.is_commercial_ou_telephonique:
        raise Http404

    agence_cible = request.POST.get("agence_cible_id")
    if not agence_cible or not Agence.objects.filter(pk=agence_cible).exists():
        return retour_avec_erreurs(
            request, {"agence_cible_id": "Le champ agence cible est obligatoire."}
        )
    agence_cible = int(agence_cible)

    vente_ids = [int(i) for i in request.POST.getlist("vente_ids[]") or request.POST.getlist("vente_ids") if str(i).strip()]
    maj_profil = booleen(request.POST, "maj_profil")

    if not vente_ids and not maj_profil:
        return retour_avec_erreurs(
            request,
            {
                "vente_ids": "Cochez au moins une vente et/ou activez « Mettre à jour l’agence du profil »."
            },
        )

    profil_avant = int(user.agence_id) if user.agence_id else None
    resultat = {"count": 0, "snapshots": []}

    try:
        if vente_ids:
            resultat = _reattribuer_ventes(user, vente_ids, agence_cible)
            if resultat["count"] == 0 and not maj_profil:
                return retour_avec_erreurs(
                    request,
                    {
                        "transfert": "Aucune vente n’a été modifiée (déjà rattachées à l’agence cible). "
                        "Cochez « Mettre à jour l’agence du profil » si vous souhaitez seulement changer le profil."
                    },
                )

        if maj_profil:
            user.agence_id = agence_cible
            user.save(update_fields=["agence_id"])
            _sync_agences_campagnes_signataire(user)

        if resultat["count"] > 0 or maj_profil:
            CommercialAgenceTransfert.objects.create(
                commercial_user_id=user.id,
                admin_user_id=request.user.id,
                nouvelle_agence_id=agence_cible,
                snapshots=resultat["snapshots"],
                profil_agence_avant=profil_avant if maj_profil else None,
                profil_agence_apres=agence_cible if maj_profil else None,
                note=request.POST.get("note") or None,
            )
    except ValueError as erreur:
        return retour_avec_erreurs(request, {"transfert": str(erreur)})

    messages = []
    if resultat["count"] > 0:
        messages.append(f"{resultat['count']} vente(s) réattribuée(s).")
    if maj_profil:
        messages.append(
            "Agence du profil mise à jour — les ventes déjà enregistrées conservent leur agence d’origine."
        )
    deposer_flash(request, success=" ".join(messages))

    if request.POST.get("return_campagne"):
        return redirect(
            f"/admin/campagnes/{int(request.POST['return_campagne'])}?tab=commerciaux"
        )

    from urllib.parse import urlencode

    filtres = {
        cle: request.POST.get(cle)
        for cle in ("du", "au", "campagne_id", "agence_id", "return_campagne", "mode")
        if request.POST.get(cle)
    }
    suffixe = f"?{urlencode(filtres)}" if filtres else ""
    return redirect(f"/admin/users/{user.id}/transfert-agence{suffixe}")


# ---------------------------------------------------------------------------
# Journal des connexions
# ---------------------------------------------------------------------------


@role_required(Role.ADMIN)
@http_methods("GET", "HEAD")
def login_logs_index(request):
    partenaire = partenaire_courant(request)
    logs = filtrer_saisies(
        UserLoginLog.objects.select_related("user").order_by("-logged_in_at", "-id"),
        partenaire,
    )

    if request.GET.get("user_id"):
        logs = logs.filter(user_id=int(request.GET["user_id"]))
    if request.GET.get("date_debut"):
        logs = logs.filter(logged_in_at__date__gte=request.GET["date_debut"])
    if request.GET.get("date_fin"):
        logs = logs.filter(logged_in_at__date__lte=request.GET["date_fin"])

    def etiquette(u):
        base = _nom_complet(u)
        return f"{base} — {u.role}" + (f" ({u.telephone})" if u.telephone else "")

    def formater(log):
        return {
            "id": log.id,
            "date": log.logged_in_at.strftime("%d/%m/%Y %H:%M:%S"),
            "user_nom": _nom_complet(log.user),
            "role": log.user.role if log.user_id else None,
            "ip": log.ip_address,
            "user_agent": _tronquer(log.user_agent, 80),
            "user_agent_full": log.user_agent,
        }

    return render(
        request,
        "Admin/LoginLogs/Index",
        {
            "filters": tableau(
                {
                    cle: request.GET.get(cle)
                    for cle in ("user_id", "date_debut", "date_fin")
                    if request.GET.get(cle)
                }
            ),
            "utilisateurs": [
                {"id": u.id, "label": etiquette(u)}
                for u in filtrer_users(User.objects.all(), partenaire).order_by(
                    "name", "prenom"
                )
            ],
            "logs": paginer(request, logs, 40, formater),
        },
    )


def _tronquer(texte, limite):
    """Équivalent de `Str::limit()` : ajoute « ... » au-delà de la limite."""
    if texte is None:
        return None
    return texte if len(texte) <= limite else texte[:limite] + "..."


# ---------------------------------------------------------------------------
# Mot de passe
# ---------------------------------------------------------------------------
#
# Note : App\Http\Controllers\ProfileController existe côté Laravel mais n'est
# routé nulle part, et aucune page ne pointe vers lui — c'est du code mort hérité
# de Breeze, l'écran Profile/Edit.jsx est inatteignable en production. On ne le
# route donc pas ici : l'exposer changerait le comportement de l'application.
# Seule `password.update`, déclarée dans routes/auth.php, est portée.


@http_methods("POST", "PUT")
def mot_de_passe_update(request):
    """Portage de Auth\\PasswordController::update()."""
    from core.auth_backend import verifier_mot_de_passe

    source = _corps(request)
    user = request.user
    actuel = source.get("current_password") or ""
    nouveau = source.get("password") or ""

    if not verifier_mot_de_passe(actuel, user.password):
        return retour_avec_erreurs(
            request, {"current_password": "Le mot de passe fourni est incorrect."}
        )
    if len(nouveau) < 8:
        return retour_avec_erreurs(
            request,
            {"password": "Le texte de password doit contenir au moins 8 caractères."},
        )
    if nouveau != source.get("password_confirmation"):
        return retour_avec_erreurs(
            request, {"password": "Le champ de confirmation password ne correspond pas."}
        )

    user.password = hacher_mot_de_passe(nouveau)
    user.save(update_fields=["password"])
    deposer_flash(request, status="password-updated")
    return redirect(request.META.get("HTTP_REFERER") or "/dashboard")
