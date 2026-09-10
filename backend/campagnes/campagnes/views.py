"""
Campagnes — administration et consultation direction.

Portage de app/Http/Controllers/Admin/CampagneController.php,
Admin/CampagneAideVersementController.php, Admin/CampagneContratArticleController.php
et Direction/CampagneController.php.
"""

from datetime import date, datetime

from django.db.models import Max
from django.http import Http404, JsonResponse
from django.shortcuts import get_object_or_404, redirect
from inertia import render

from core.db import synchroniser_pivot
from core.decorators import http_methods, role_required
from core.middleware import deposer_flash, retour_avec_erreurs
from core.models import ROLES_COMMERCIAUX, Agence, Role, TypeCarte, User
from core.pagination import paginer
from core.partenaires import (
    filtrer_agences,
    filtrer_campagnes,
    filtrer_users,
    partenaire_courant,
)
from core.php import nombre_format
from core.validation import ErreursValidation, Validateur, booleen

from . import services
from .models import (
    STATUTS_MANUELS,
    Campagne,
    CampagneAction,
    CampagneAgence,
    CampagneAideBeneficiaire,
    CampagneAideVersement,
    CampagneCommercialContrat,
    CampagneContratArticle,
    CampagneRemiseTypeCarte,
    ContratPrestationReponse,
    StatutCampagne,
    StatutReponseContrat,
    TypeCampagne,
)

#: Statuts depuis lesquels une campagne reste pilotable (arrêt, annulation, reprogrammation).
STATUTS_PILOTABLES = [StatutCampagne.PROGRAMMEE, StatutCampagne.EN_COURS]


def _corps(request):
    """
    Corps de la requête, que la méthode soit POST ou PUT/PATCH.

    `request.POST` suffit dans tous les cas : `core.middleware.CorpsJsonMiddleware`
    le remplit déjà à partir du corps JSON ou form-urlencoded, quelle que soit
    la méthode — reconstruire le corps ici à la main (`QueryDict(request.body)`)
    traiterait un corps JSON comme une chaîne de requête et ne lirait plus
    aucun champ (c'était le cas du PUT `/admin/campagnes/<id>`).
    """
    return request.POST


def _liste(source, cle):
    """Récupère un champ tableau envoyé par Inertia (`agences[]` ou `agences`)."""
    return source.getlist(f"{cle}[]") or source.getlist(cle)


def _nom(user):
    if user is None:
        return None
    return f"{user.prenom} {user.name}".strip() if user.prenom else user.name


def _campagne_du_perimetre(request, campagne_id):
    """
    Charge une campagne en refusant celles d'un autre client de GDA.

    Un identifiant tapé dans la barre d'adresse ne doit pas suffire à sortir du
    périmètre choisi : on renvoie un 404, comme si la campagne n'existait pas.
    """
    return get_object_or_404(
        filtrer_campagnes(Campagne.objects.all(), partenaire_courant(request)),
        pk=campagne_id,
    )


def _url_show(campagne_id, onglet):
    return f"/admin/campagnes/{campagne_id}?tab={onglet}"


# ---------------------------------------------------------------------------
# Liste, création, édition
# ---------------------------------------------------------------------------


@role_required(Role.ADMIN)
@http_methods("GET", "HEAD")
def index(request):
    Campagne.sync_statuts()
    campagnes = filtrer_campagnes(
        Campagne.objects.order_by("-date_debut"), partenaire_courant(request)
    )

    def formater(c):
        statut = c.statut_effectif
        return {
            "id": c.id,
            "nom": c.nom,
            "date_debut": c.date_debut.strftime("%d/%m/%Y"),
            "date_debut_iso": c.date_debut.strftime("%Y-%m-%d"),
            "date_fin": c.date_fin.strftime("%d/%m/%Y"),
            "date_fin_iso": c.date_fin.strftime("%Y-%m-%d"),
            "prime_meilleur_vendeur": nombre_format(c.prime_meilleur_vendeur),
            "estEnrolement": c.type == TypeCampagne.ENROLEMENT_APP,
            "statut": statut,
            "peut_piloter": statut in STATUTS_PILOTABLES,
        }

    return render(
        request,
        "Admin/Campagnes/Index",
        {"campagnes": paginer(request, campagnes, 10, formater)},
    )


def _agences_et_commerciaux(request):
    """
    Le référentiel proposé aux formulaires de campagne, borné au client courant.

    Chez un partenaire sans réseau d'agences, la liste d'agences est vide et
    les commerciaux sont retenus sur leur seul rattachement au partenaire —
    exiger une agence les écarterait tous.
    """
    partenaire = partenaire_courant(request)
    a_des_agences = partenaire is None or partenaire.a_des_agences

    commerciaux = filtrer_users(
        User.objects.select_related("agence").filter(role__in=ROLES_COMMERCIAUX),
        partenaire,
    )
    if a_des_agences:
        commerciaux = commerciaux.filter(agence_id__isnull=False)

    return (
        [
            {"id": a.id, "nom": a.nom}
            for a in filtrer_agences(
                Agence.objects.order_by("ordre", "nom"), partenaire
            )
        ],
        [
            {
                "id": c.id,
                "nom": _nom(c),
                "agence_nom": c.agence.nom if c.agence_id else "—",
            }
            for c in commerciaux.order_by("name")
        ],
    )


def _props_client(request):
    """Ce que le formulaire doit savoir du client courant pour s'adapter."""
    partenaire = partenaire_courant(request)
    return {
        "aDesAgences": partenaire is None or partenaire.a_des_agences,
        "clientNom": partenaire.nom if partenaire else None,
    }


@role_required(Role.ADMIN)
@http_methods("GET", "HEAD")
def create(request):
    agences, commerciaux = _agences_et_commerciaux(request)
    return render(
        request,
        "Admin/Campagnes/Create",
        {"agences": agences, "commerciaux": commerciaux, **_props_client(request)},
    )


@role_required(Role.ADMIN)
@http_methods("GET", "HEAD")
def edit(request, campagne):
    campagne = _campagne_du_perimetre(request, campagne)
    agences, commerciaux = _agences_et_commerciaux(request)

    return render(
        request,
        "Admin/Campagnes/Edit",
        {
            "campagne": {
                "id": campagne.id,
                "nom": campagne.nom,
                "type": campagne.type,
                "date_debut": campagne.date_debut.strftime("%Y-%m-%d"),
                "date_fin": campagne.date_fin.strftime("%Y-%m-%d"),
                "prime_meilleur_vendeur": campagne.prime_meilleur_vendeur,
                "toutes_agences": campagne.toutes_agences,
                "agence_ids": list(campagne.agences.values_list("id", flat=True)),
                "aide_hebdo_active": campagne.aide_hebdo_active,
                "aide_hebdo_montant": campagne.aide_hebdo_montant,
                "aide_hebdo_carburant": campagne.aide_hebdo_carburant,
                "aide_hebdo_credit_tel": campagne.aide_hebdo_credit_tel,
                "aide_hebdo_tous_commerciaux": campagne.aide_hebdo_tous_commerciaux,
                # Les bénéficiaires affichés sont les signataires du contrat :
                # c'est ce pivot qui fait foi pour l'engagement.
                "aide_beneficiaire_ids": list(
                    campagne.signataires_contrat.values_list("id", flat=True)
                ),
                "contrat_emolument_forfait": campagne.contrat_emolument_forfait,
                "contrat_forfait_communication": campagne.contrat_forfait_communication,
                "contrat_forfait_deplacement": campagne.contrat_forfait_deplacement,
                "contrat_representant_nom": campagne.contrat_representant_nom,
                "contrat_lieu_signature": campagne.contrat_lieu_signature,
                "contrat_clause_libre": campagne.contrat_clause_libre,
                "contrat_publie_at": campagne.contrat_publie_at.strftime("%d/%m/%Y %H:%M")
                if campagne.contrat_publie_at
                else None,
                "contrat_articles": [
                    {"id": a.id, "titre": a.titre, "contenu": a.contenu}
                    for a in campagne.contrat_articles.order_by("sort_order")
                ],
            },
            "agences": agences,
            "commerciaux": commerciaux,
            **_props_client(request),
        },
    )


@role_required(Role.ADMIN)
@http_methods("GET", "HEAD")
def show(request, campagne):
    campagne = _campagne_du_perimetre(request, campagne)
    detail = services.construire_detail(campagne, request)
    return render(
        request, "Admin/Campagnes/Show", services.vers_props_inertia(request, detail, False)
    )


# ---------------------------------------------------------------------------
# Validation partagée création / mise à jour
# ---------------------------------------------------------------------------


def _valider_base(source, avec_type):
    validateur = Validateur(source)
    validateur.champ("nom", "required|max:255")
    if avec_type:
        validateur.champ("type", "required|in:vente_carte,enrolement_app")
    validateur.champ("date_debut", "required|date")
    validateur.champ("date_fin", "required|date")
    validateur.champ("prime_meilleur_vendeur", "required|integer|min:0")

    debut, fin = validateur.valeurs.get("date_debut"), validateur.valeurs.get("date_fin")
    if debut and fin and str(fin) < str(debut):
        validateur.erreur(
            "date_fin",
            "Le champ date fin doit être une date postérieure ou égale à date debut.",
        )
    return validateur


def _valider_remise_aide(validateur, source):
    validateur.champ("remise_pourcentage", "nullable|integer|min:0|max:100")
    for champ in (
        "aide_hebdo_montant",
        "aide_hebdo_carburant",
        "aide_hebdo_credit_tel",
        "contrat_emolument_forfait",
        "contrat_forfait_communication",
        "contrat_forfait_deplacement",
    ):
        validateur.champ(champ, "nullable|integer|min:0")
    validateur.champ("contrat_representant_nom", "nullable|max:191")
    validateur.champ("contrat_lieu_signature", "nullable|max:191")
    validateur.champ("contrat_clause_libre", "nullable|max:20000")

    # Engagement : « tous les commerciaux » ou une sélection explicite.
    if not booleen(source, "aide_hebdo_tous_commerciaux") and not _liste(
        source, "aide_beneficiaires"
    ):
        validateur.erreur(
            "aide_beneficiaires",
            "Sélectionnez au moins un commercial engagé sur le contrat ou cochez "
            "« Tous les commerciaux des agences concernées ».",
        )

    # L'aide hebdomadaire doit être exactement répartie entre ses deux postes.
    if booleen(source, "aide_hebdo_active"):
        total = int(source.get("aide_hebdo_montant") or 0)
        carburant = int(source.get("aide_hebdo_carburant") or 0)
        credit = int(source.get("aide_hebdo_credit_tel") or 0)
        if carburant + credit != total:
            validateur.erreur(
                "aide_hebdo_montant",
                "Carburant + crédit téléphonique doit égaler le montant total hebdomadaire.",
            )

    if _remise_active(source) and not booleen(source, "remise_tous_types_cartes"):
        if not _liste(source, "remise_types_cartes"):
            validateur.erreur(
                "remise_types_cartes",
                "Sélectionnez au moins un type de carte ou cochez « Tous les types de cartes ».",
            )
    return validateur


def _remise_active(source):
    valeur = source.get("remise_pourcentage")
    try:
        return valeur not in (None, "") and float(valeur) > 0
    except ValueError:
        return False


def _valider_chevauchement(
    campagne, debut, fin, toutes_agences, agence_ids, type_campagne, partenaire=None
):
    """
    Interdit qu'une même agence soit couverte par deux campagnes actives dont
    les périodes se chevauchent. Deux campagnes de types différents (vente /
    enrôlement) sont des activités indépendantes et peuvent coexister.

    Le contrôle ne vaut qu'à l'intérieur d'un client de GDA : une campagne UBA
    et une campagne BDM se chevauchent sans conflit, leurs réseaux étant
    disjoints. Chez un partenaire sans agences, il n'y a rien à croiser.
    """
    Campagne.sync_statuts()

    if partenaire is not None and not partenaire.a_des_agences:
        return None

    agences_perimetre = filtrer_agences(Agence.objects.all(), partenaire)
    ids = (
        set(agences_perimetre.values_list("id", flat=True))
        if toutes_agences
        else {int(i) for i in agence_ids}
    )

    autres = filtrer_campagnes(
        Campagne.objects.filter(
            type=type_campagne, actif=True, date_debut__lte=fin, date_fin__gte=debut
        ),
        partenaire,
    ).exclude(statut__in=[*STATUTS_MANUELS, StatutCampagne.TERMINEE])
    if campagne is not None:
        autres = autres.exclude(pk=campagne.pk)

    for autre in autres:
        autres_ids = (
            set(agences_perimetre.values_list("id", flat=True))
            if autre.toutes_agences
            else set(autre.agences.values_list("id", flat=True))
        )
        conflits = ids & autres_ids
        if not conflits:
            continue

        noms = list(
            Agence.objects.filter(id__in=conflits).order_by("nom").values_list("nom", flat=True)
        )
        liste = ", ".join(noms[:8]) + ("…" if len(noms) > 8 else "")
        return {
            "agences": f"Cette campagne chevauche la période de « {autre.nom} » "
            f"(également active) : les agences {liste} ne peuvent pas être sur les deux "
            "campagnes à la fois. Retirez « Toutes les agences » ou excluez ces agences "
            "d’une des campagnes."
        }
    return None


# ---------------------------------------------------------------------------
# Synchronisation des pivots
# ---------------------------------------------------------------------------


def _sync_beneficiaires_aide(campagne, source):
    if not booleen(source, "aide_hebdo_active") or booleen(
        source, "aide_hebdo_tous_commerciaux"
    ):
        CampagneAideBeneficiaire.objects.filter(campagne_id=campagne.id).delete()
        return
    ids = User.objects.filter(
        id__in=_liste(source, "aide_beneficiaires"), role__in=ROLES_COMMERCIAUX
    ).values_list("id", flat=True)
    synchroniser_pivot(CampagneAideBeneficiaire, "campagne_id", campagne.id, "user_id", ids)


def _sync_signataires(campagne, source):
    if booleen(source, "aide_hebdo_tous_commerciaux"):
        qs = User.objects.filter(role__in=ROLES_COMMERCIAUX)
        if campagne.partenaire_id:
            qs = qs.filter(partenaire_id=campagne.partenaire_id)
        # « Tous les commerciaux » se lit sur l'agence chez un partenaire qui en
        # a un réseau ; ailleurs, le rattachement au client suffit et exiger une
        # agence écarterait tout le monde.
        if not campagne.sans_agences:
            qs = qs.filter(agence_id__isnull=False)
            if not campagne.toutes_agences:
                qs = qs.filter(
                    agence_id__in=campagne.agences.values_list("id", flat=True)
                )
        ids = qs.values_list("id", flat=True)
    else:
        ids = User.objects.filter(
            id__in=_liste(source, "aide_beneficiaires"), role__in=ROLES_COMMERCIAUX
        ).values_list("id", flat=True)
    synchroniser_pivot(CampagneCommercialContrat, "campagne_id", campagne.id, "user_id", ids)


def _sync_types_cartes_remise(campagne, source):
    if not _remise_active(source) or booleen(source, "remise_tous_types_cartes"):
        CampagneRemiseTypeCarte.objects.filter(campagne_id=campagne.id).delete()
        return
    ids = TypeCarte.objects.filter(
        id__in=_liste(source, "remise_types_cartes")
    ).values_list("id", flat=True)
    synchroniser_pivot(
        CampagneRemiseTypeCarte, "campagne_id", campagne.id, "type_carte_id", ids
    )


def _sync_reponses_contrat(campagne, source, creation):
    """
    Aligne les réponses au contrat sur la liste des signataires.

    À la création, le contrat est publié immédiatement ; ensuite seule une
    demande explicite de republication remet les réponses à zéro.
    """
    if creation or booleen(source, "contrat_republier"):
        campagne.contrat_publie_at = datetime.now().replace(microsecond=0)
        campagne.save(update_fields=["contrat_publie_at"])
        if not creation:
            ContratPrestationReponse.objects.filter(campagne_id=campagne.id).update(
                statut=StatutReponseContrat.EN_ATTENTE, repondu_at=None
            )

    ids = set(campagne.signataires_contrat.values_list("id", flat=True))
    existants = set(
        ContratPrestationReponse.objects.filter(campagne_id=campagne.id).values_list(
            "user_id", flat=True
        )
    )
    for user_id in ids - existants:
        ContratPrestationReponse.objects.create(
            campagne_id=campagne.id,
            user_id=user_id,
            statut=StatutReponseContrat.EN_ATTENTE,
        )
    ContratPrestationReponse.objects.filter(campagne_id=campagne.id).exclude(
        user_id__in=ids
    ).delete()

    if not campagne.contrat_publie_at and ids:
        campagne.contrat_publie_at = datetime.now().replace(microsecond=0)
        campagne.save(update_fields=["contrat_publie_at"])


# ---------------------------------------------------------------------------
# Création / mise à jour
# ---------------------------------------------------------------------------


def _champs_vente(source):
    return {
        "remise_pourcentage": source.get("remise_pourcentage") or None,
        "aide_hebdo_active": booleen(source, "aide_hebdo_active"),
        "aide_hebdo_montant": int(source.get("aide_hebdo_montant") or 5000),
        "aide_hebdo_carburant": int(source.get("aide_hebdo_carburant") or 3000),
        "aide_hebdo_credit_tel": int(source.get("aide_hebdo_credit_tel") or 2000),
        "aide_hebdo_tous_commerciaux": booleen(source, "aide_hebdo_tous_commerciaux"),
        "remise_tous_types_cartes": booleen(source, "remise_tous_types_cartes"),
        # Le contrat suit le même périmètre que l'aide hebdomadaire.
        "contrat_tous_commerciaux": booleen(source, "aide_hebdo_tous_commerciaux"),
        "contrat_emolument_forfait": int(source.get("contrat_emolument_forfait") or 50000),
        "contrat_forfait_communication": int(
            source.get("contrat_forfait_communication") or 2000
        ),
        "contrat_forfait_deplacement": int(
            source.get("contrat_forfait_deplacement") or 3000
        ),
        "contrat_representant_nom": source.get("contrat_representant_nom") or "Yaya H DIALLO",
        "contrat_lieu_signature": source.get("contrat_lieu_signature") or "Bamako",
        "contrat_clause_libre": source.get("contrat_clause_libre") or None,
    }


@role_required(Role.ADMIN)
@http_methods("POST")
def store(request):
    source = request.POST
    partenaire = partenaire_courant(request)
    type_campagne = source.get("type") or TypeCampagne.VENTE_CARTE
    est_vente = type_campagne == TypeCampagne.VENTE_CARTE

    validateur = _valider_base(source, avec_type=True)
    if est_vente:
        _valider_remise_aide(validateur, source)
    try:
        donnees = validateur.resultat()
    except ErreursValidation as erreur:
        return retour_avec_erreurs(request, erreur.erreurs)

    toutes_agences, agence_ids, erreur = _perimetre_agences(source, partenaire)
    if erreur:
        return retour_avec_erreurs(request, erreur)

    erreur = _valider_chevauchement(
        None,
        date.fromisoformat(donnees["date_debut"]),
        date.fromisoformat(donnees["date_fin"]),
        toutes_agences,
        agence_ids,
        type_campagne,
        partenaire,
    )
    if erreur:
        return retour_avec_erreurs(request, erreur)

    attributs = {
        "nom": donnees["nom"],
        "partenaire_id": partenaire.id if partenaire else None,
        "type": type_campagne,
        "date_debut": donnees["date_debut"],
        "date_fin": donnees["date_fin"],
        "prime_meilleur_vendeur": donnees["prime_meilleur_vendeur"],
        "actif": False,
        "statut": StatutCampagne.PROGRAMMEE,
        "toutes_agences": toutes_agences,
    }
    if est_vente:
        attributs.update(_champs_vente(source))
    else:
        # Ni remise ni aide hebdomadaire sur ce type : les commerciaux engagés
        # sont désignés explicitement depuis l'onglet Commerciaux, jamais « tous ».
        attributs["contrat_tous_commerciaux"] = False
        attributs["contrat_representant_nom"] = (
            source.get("contrat_representant_nom") or "Yaya H DIALLO"
        )
        attributs["contrat_lieu_signature"] = (
            source.get("contrat_lieu_signature") or "Bamako"
        )

    campagne = Campagne.objects.create(**attributs)

    if not toutes_agences:
        synchroniser_pivot(CampagneAgence, "campagne_id", campagne.id, "agence_id", agence_ids)

    if est_vente:
        _sync_beneficiaires_aide(campagne, source)
        _sync_signataires(campagne, source)
        _sync_types_cartes_remise(campagne, source)

    # Le contrat de prestation est requis pour les deux types.
    _sync_reponses_contrat(campagne, source, creation=True)
    services.creer_articles_par_defaut_si_absents(campagne.id, type_campagne)
    Campagne.sync_statuts()

    deposer_flash(request, success="Campagne créée.")
    return redirect("/admin/campagnes")


def _perimetre_agences(source, partenaire):
    """
    Lit le périmètre d'agences du formulaire, ou le neutralise.

    Chez un partenaire sans réseau d'agences, la question ne se pose pas : la
    campagne vaut pour tous ses commerciaux, et exiger une sélection d'agences
    rendrait le formulaire impossible à valider.

    Renvoie `(toutes_agences, agence_ids, erreur)`.
    """
    if partenaire is not None and not partenaire.a_des_agences:
        return True, [], None

    toutes_agences = booleen(source, "toutes_agences")
    # Le frontend envoie `agence_ids` (cf. `NouvelleCampagne` côté virtus-dashboard,
    # et la prop `agence_ids` déjà renvoyée par `edit()` ci-dessus) — pas `agences`.
    agence_ids = [] if toutes_agences else _liste(source, "agence_ids")
    if not toutes_agences and not agence_ids:
        return (
            toutes_agences,
            agence_ids,
            {
                "agences": "Sélectionnez au moins une agence ou cochez "
                '"Toutes les agences".'
            },
        )
    return toutes_agences, agence_ids, None


def _perimetre_ou_dates_modifies(campagne, donnees, toutes_agences, agence_ids):
    if toutes_agences != campagne.toutes_agences:
        return True
    if donnees["date_debut"] != campagne.date_debut.strftime("%Y-%m-%d"):
        return True
    if donnees["date_fin"] != campagne.date_fin.strftime("%Y-%m-%d"):
        return True
    if not toutes_agences:
        return sorted({int(i) for i in agence_ids}) != sorted(
            campagne.agences.values_list("id", flat=True)
        )
    return False


def _defauts_edition(campagne):
    """
    Valeurs courantes de `campagne`, au format attendu par les validateurs.

    Le formulaire Laravel d'origine réémettait tous les champs à chaque
    modification ; l'écran d'édition de virtus-dashboard, lui, n'en propose
    que deux (`prime_meilleur_vendeur`, `aide_hebdo_montant` — voir
    `Detail.tsx`/`modifierCampagne`). Sans ces valeurs de repli, un champ non
    envoyé serait lu comme vide par `_valider_base`/`_valider_remise_aide` et
    bloquerait la mise à jour (nom/dates requis) ou, pire, écraserait
    silencieusement les autres réglages de la campagne avec les valeurs par
    défaut de *création* de `_champs_vente` (ex. « aide hebdomadaire »
    désactivée alors qu'elle était active).
    """
    defauts = {
        "nom": campagne.nom,
        "date_debut": campagne.date_debut.isoformat(),
        "date_fin": campagne.date_fin.isoformat(),
        "prime_meilleur_vendeur": campagne.prime_meilleur_vendeur,
        "toutes_agences": "1" if campagne.toutes_agences else "",
    }
    if campagne.type == TypeCampagne.VENTE_CARTE:
        defauts.update(
            {
                "remise_pourcentage": campagne.remise_pourcentage,
                "aide_hebdo_active": "1" if campagne.aide_hebdo_active else "",
                "aide_hebdo_montant": campagne.aide_hebdo_montant,
                "aide_hebdo_carburant": campagne.aide_hebdo_carburant,
                "aide_hebdo_credit_tel": campagne.aide_hebdo_credit_tel,
                "aide_hebdo_tous_commerciaux": "1"
                if campagne.aide_hebdo_tous_commerciaux
                else "",
                "remise_tous_types_cartes": "1"
                if campagne.remise_tous_types_cartes
                else "",
                "contrat_emolument_forfait": campagne.contrat_emolument_forfait,
                "contrat_forfait_communication": campagne.contrat_forfait_communication,
                "contrat_forfait_deplacement": campagne.contrat_forfait_deplacement,
                "contrat_representant_nom": campagne.contrat_representant_nom,
                "contrat_lieu_signature": campagne.contrat_lieu_signature,
                "contrat_clause_libre": campagne.contrat_clause_libre,
            }
        )
    return defauts


def _defauts_edition_listes(campagne):
    """Listes (agences, bénéficiaires, types de cartes) au même repli."""
    listes = {}
    if not campagne.toutes_agences:
        listes["agence_ids"] = [
            str(i) for i in campagne.agences.values_list("id", flat=True)
        ]
    if campagne.type == TypeCampagne.VENTE_CARTE:
        listes["aide_beneficiaires"] = [
            str(i) for i in campagne.signataires_contrat.values_list("id", flat=True)
        ]
        listes["remise_types_cartes"] = [
            str(i) for i in campagne.types_cartes_remise.values_list("id", flat=True)
        ]
    return listes


def _completer_avec_defauts(source, campagne):
    """
    Copie mutable de `source` complétée par les valeurs courantes de
    `campagne` pour tout champ absent — transforme une mise à jour partielle
    (seuls certains champs envoyés) en un jeu de données complet, sans quoi
    les champs tus seraient traités comme vides plutôt que « inchangés ».

    Seule l'*absence* du champ déclenche le repli : un champ explicitement
    envoyé (y compris vide, pour lever une case à cocher) prime toujours.
    """
    complet = source.copy()

    for champ, valeur in _defauts_edition(campagne).items():
        if champ not in complet:
            complet[champ] = "" if valeur is None else str(valeur)

    for champ, valeurs in _defauts_edition_listes(campagne).items():
        if not complet.getlist(f"{champ}[]") and not complet.getlist(champ):
            complet.setlist(champ, valeurs)

    return complet


@role_required(Role.ADMIN)
@http_methods("POST", "PUT", "PATCH")
def update(request, campagne):
    campagne = _campagne_du_perimetre(request, campagne)
    partenaire = partenaire_courant(request)
    source = _completer_avec_defauts(_corps(request), campagne)

    # Le type est figé à la création : le changer laisserait des données
    # orphelines (contrat, enrôlements) derrière lui.
    type_campagne = campagne.type
    est_vente = type_campagne == TypeCampagne.VENTE_CARTE

    validateur = _valider_base(source, avec_type=False)
    if est_vente:
        _valider_remise_aide(validateur, source)
    try:
        donnees = validateur.resultat()
    except ErreursValidation as erreur:
        return retour_avec_erreurs(request, erreur.erreurs)

    toutes_agences, agence_ids, erreur = _perimetre_agences(source, partenaire)
    if erreur:
        return retour_avec_erreurs(request, erreur)

    if _perimetre_ou_dates_modifies(campagne, donnees, toutes_agences, agence_ids):
        erreur = _valider_chevauchement(
            campagne,
            date.fromisoformat(donnees["date_debut"]),
            date.fromisoformat(donnees["date_fin"]),
            toutes_agences,
            agence_ids,
            type_campagne,
            partenaire,
        )
        if erreur:
            return retour_avec_erreurs(request, erreur)

    campagne.nom = donnees["nom"]
    campagne.date_debut = donnees["date_debut"]
    campagne.date_fin = donnees["date_fin"]
    campagne.prime_meilleur_vendeur = donnees["prime_meilleur_vendeur"]
    campagne.toutes_agences = toutes_agences
    if est_vente:
        for champ, valeur in _champs_vente(source).items():
            setattr(campagne, champ, valeur)
    campagne.save()

    synchroniser_pivot(
        CampagneAgence, "campagne_id", campagne.id, "agence_id",
        [] if toutes_agences else agence_ids,
    )

    if est_vente:
        _sync_beneficiaires_aide(campagne, source)
        _sync_signataires(campagne, source)
        _sync_types_cartes_remise(campagne, source)

    # Filet de sécurité : garantit que le contrat reste publié et ses articles
    # présents, y compris pour les campagnes créées avant cette règle.
    _sync_reponses_contrat(campagne, source, creation=False)
    services.creer_articles_par_defaut_si_absents(campagne.id, type_campagne)
    Campagne.sync_statuts()

    deposer_flash(request, success="Campagne mise à jour.")
    return redirect(_url_show(campagne.id, "pilotage"))


@role_required(Role.ADMIN)
@http_methods("POST", "DELETE")
def destroy(request, campagne):
    _campagne_du_perimetre(request, campagne).delete()
    deposer_flash(request, success="Campagne supprimée.")
    return redirect("/admin/campagnes")


# ---------------------------------------------------------------------------
# Pilotage
# ---------------------------------------------------------------------------


def _tracer_action(campagne, action, description, user, avant=None, apres=None):
    CampagneAction.objects.create(
        campagne_id=campagne.id,
        action=action,
        description=description,
        donnees_avant=avant,
        donnees_apres=apres,
        user_id=user.id if user and user.is_authenticated else None,
    )


def _changer_statut(request, campagne_id, action, nouveau_statut, message, refus):
    campagne = get_object_or_404(Campagne, pk=campagne_id)
    description = (request.POST.get("description") or "").strip()

    if len(description) < 10:
        return retour_avec_erreurs(
            request,
            {"description": "Le texte de description doit contenir au moins 10 caractères."},
        )
    if campagne.statut_effectif not in STATUTS_PILOTABLES:
        return retour_avec_erreurs(request, {"description": refus})

    _tracer_action(
        campagne, action, description, request.user,
        avant={"statut": campagne.statut, "actif": campagne.actif},
    )
    campagne.statut = nouveau_statut
    campagne.actif = False
    campagne.save(update_fields=["statut", "actif"])
    Campagne.resynchroniser_actifs_commerciaux()

    deposer_flash(request, success=message)
    return redirect(_url_show(campagne.id, "pilotage"))


@role_required(Role.ADMIN)
@http_methods("POST")
def arreter(request, campagne):
    return _changer_statut(
        request, campagne, "arreter", StatutCampagne.ARRETEE,
        "Campagne arrêtée.", "Cette campagne ne peut pas être arrêtée.",
    )


@role_required(Role.ADMIN)
@http_methods("POST")
def annuler(request, campagne):
    return _changer_statut(
        request, campagne, "annuler", StatutCampagne.ANNULEE,
        "Campagne annulée.", "Cette campagne ne peut pas être annulée.",
    )


@role_required(Role.ADMIN)
@http_methods("POST")
def reprogrammer(request, campagne):
    campagne = get_object_or_404(Campagne, pk=campagne)
    source = request.POST

    validateur = Validateur(source)
    validateur.champ("date_debut", "required|date")
    validateur.champ("date_fin", "required|date")
    validateur.champ("description", "required|min:10")
    debut, fin = validateur.valeurs.get("date_debut"), validateur.valeurs.get("date_fin")
    if debut and fin and str(fin) < str(debut):
        validateur.erreur(
            "date_fin",
            "Le champ date fin doit être une date postérieure ou égale à date debut.",
        )
    try:
        donnees = validateur.resultat()
    except ErreursValidation as erreur:
        return retour_avec_erreurs(request, erreur.erreurs)

    if campagne.statut_effectif not in STATUTS_PILOTABLES:
        return retour_avec_erreurs(
            request,
            {
                "description": "Seules les campagnes programmées ou en cours peuvent être reprogrammées."
            },
        )

    _tracer_action(
        campagne, "reprogrammer", donnees["description"], request.user,
        avant={
            "date_debut": campagne.date_debut.isoformat(),
            "date_fin": campagne.date_fin.isoformat(),
        },
        apres={"date_debut": donnees["date_debut"], "date_fin": donnees["date_fin"]},
    )

    campagne.date_debut = donnees["date_debut"]
    campagne.date_fin = donnees["date_fin"]
    campagne.save(update_fields=["date_debut", "date_fin"])
    Campagne.sync_statuts()

    deposer_flash(request, success="Campagne reprogrammée.")
    return redirect(_url_show(campagne.id, "pilotage"))


@role_required(Role.ADMIN)
@http_methods("POST")
def update_dates(request, campagne):
    campagne = get_object_or_404(Campagne, pk=campagne)
    validateur = Validateur(request.POST)
    validateur.champ("date_debut", "required|date")
    validateur.champ("date_fin", "required|date")
    debut, fin = validateur.valeurs.get("date_debut"), validateur.valeurs.get("date_fin")
    if debut and fin and str(fin) < str(debut):
        validateur.erreur(
            "date_fin",
            "Le champ date fin doit être une date postérieure ou égale à date debut.",
        )
    try:
        donnees = validateur.resultat()
    except ErreursValidation as erreur:
        return retour_avec_erreurs(request, erreur.erreurs)

    erreur = _valider_chevauchement(
        campagne,
        date.fromisoformat(donnees["date_debut"]),
        date.fromisoformat(donnees["date_fin"]),
        campagne.toutes_agences,
        list(campagne.agences.values_list("id", flat=True)),
        campagne.type,
    )
    if erreur:
        return retour_avec_erreurs(request, erreur)

    campagne.date_debut = donnees["date_debut"]
    campagne.date_fin = donnees["date_fin"]
    campagne.save(update_fields=["date_debut", "date_fin"])
    Campagne.sync_statuts()

    deposer_flash(
        request,
        success="Dates mises à jour — statuts et comptes commerciaux resynchronisés.",
    )
    return redirect(_url_show(campagne.id, "pilotage"))


@role_required(Role.ADMIN)
@http_methods("POST")
def sync_commerciaux(request, campagne):
    campagne = get_object_or_404(Campagne, pk=campagne)
    Campagne.sync_statuts()
    deposer_flash(
        request,
        success="Comptes commerciaux resynchronisés selon les campagnes en cours.",
    )
    return redirect(_url_show(campagne.id, "commerciaux"))


@role_required(Role.ADMIN)
@http_methods("POST")
def update_signataires(request, campagne):
    campagne = get_object_or_404(Campagne, pk=campagne)
    source = request.POST

    tous = booleen(source, "aide_hebdo_tous_commerciaux")
    if not tous and not _liste(source, "aide_beneficiaires"):
        return retour_avec_erreurs(
            request,
            {
                "aide_beneficiaires": "Sélectionnez au moins un commercial engagé sur le contrat "
                "ou cochez « Tous les commerciaux des agences concernées »."
            },
        )

    campagne.aide_hebdo_tous_commerciaux = tous
    campagne.contrat_tous_commerciaux = tous
    campagne.save(update_fields=["aide_hebdo_tous_commerciaux", "contrat_tous_commerciaux"])

    _sync_signataires(campagne, source)
    _sync_reponses_contrat(campagne, source, creation=False)
    Campagne.sync_statuts()

    deposer_flash(request, success="Commerciaux engagés mis à jour.")
    return redirect(_url_show(campagne.id, "commerciaux"))


# ---------------------------------------------------------------------------
# Import de commerciaux
# ---------------------------------------------------------------------------


@role_required(Role.ADMIN)
@http_methods("POST")
def previsualiser_import(request):
    texte = request.POST.get("texte")
    if not texte:
        return JsonResponse({"message": "Le champ texte est obligatoire."}, status=422)
    return JsonResponse(services.previsualiser_import(texte))


@role_required(Role.ADMIN)
@http_methods("POST")
def importer_commerciaux(request, campagne):
    campagne = get_object_or_404(Campagne, pk=campagne)
    texte = request.POST.get("texte")
    if not texte:
        return retour_avec_erreurs(request, {"texte": "Le champ texte est obligatoire."})

    resultat = services.importer_commerciaux(texte)
    if not resultat["user_ids"]:
        return retour_avec_erreurs(
            request,
            {
                "texte": "Aucune ligne valide n’a pu être importée. "
                "Vérifiez le format (Nom, Prénom, Agence, Téléphone)."
            },
        )

    # Les commerciaux importés s'ajoutent aux signataires existants.
    existants = set(campagne.signataires_contrat.values_list("id", flat=True))
    synchroniser_pivot(
        CampagneCommercialContrat, "campagne_id", campagne.id, "user_id",
        existants | set(resultat["user_ids"]),
    )
    Campagne.sync_statuts()

    message = (
        f"{resultat['commerciaux_reutilises']} commercial(aux) réutilisé(s), "
        f"{resultat['commerciaux_crees']} compte(s) créé(s), "
        f"{resultat['agences_creees']} nouvelle(s) agence(s)."
    )
    if resultat["lignes_en_erreur"] > 0:
        message += f" {resultat['lignes_en_erreur']} ligne(s) ignorée(s) (format invalide)."
    deposer_flash(request, success=message)

    return redirect(_url_show(campagne.id, "commerciaux"))


# ---------------------------------------------------------------------------
# Contrat
# ---------------------------------------------------------------------------


@role_required(Role.ADMIN)
@http_methods("POST")
def republier_contrat(request, campagne):
    campagne = get_object_or_404(Campagne, pk=campagne)
    campagne.contrat_publie_at = datetime.now().replace(microsecond=0)
    campagne.save(update_fields=["contrat_publie_at"])
    ContratPrestationReponse.objects.filter(campagne_id=campagne.id).update(
        statut=StatutReponseContrat.EN_ATTENTE, repondu_at=None
    )
    deposer_flash(
        request,
        success="Contrat republié — nouveau délai de 5 jours pour accepter ou refuser.",
    )
    return redirect(_url_show(campagne.id, "contrat"))


@role_required(Role.ADMIN)
@http_methods("POST")
def reset_contrat_reponse(request, campagne, reponse):
    campagne = get_object_or_404(Campagne, pk=campagne)
    reponse = get_object_or_404(ContratPrestationReponse, pk=reponse)
    if reponse.campagne_id != campagne.id:
        raise Http404

    reponse.statut = StatutReponseContrat.EN_ATTENTE
    reponse.repondu_at = None
    reponse.save(update_fields=["statut", "repondu_at"])

    deposer_flash(request, success="Réponse du commercial réinitialisée.")
    return redirect(_url_show(campagne.id, "contrat"))


# ---------------------------------------------------------------------------
# Articles de contrat
# ---------------------------------------------------------------------------


@role_required(Role.ADMIN)
@http_methods("POST")
def article_store(request, campagne):
    campagne = get_object_or_404(Campagne, pk=campagne)
    try:
        donnees = Validateur(request.POST)
        donnees.champ("titre", "required|max:255")
        donnees.champ("contenu", "required")
        donnees = donnees.resultat()
    except ErreursValidation as erreur:
        return retour_avec_erreurs(request, erreur.erreurs)

    ordre = CampagneContratArticle.objects.filter(campagne_id=campagne.id).aggregate(
        maximum=Max("sort_order")
    )["maximum"]
    CampagneContratArticle.objects.create(
        campagne_id=campagne.id,
        sort_order=(ordre or 0) + 1,
        titre=donnees["titre"],
        contenu=donnees["contenu"],
    )
    deposer_flash(request, success_article="Article ajouté.")
    return redirect(_url_show(campagne.id, "contrat"))


@role_required(Role.ADMIN)
@http_methods("POST", "PUT", "PATCH")
def article_update(request, campagne, article):
    campagne = get_object_or_404(Campagne, pk=campagne)
    article = get_object_or_404(CampagneContratArticle, pk=article)
    if article.campagne_id != campagne.id:
        raise Http404

    source = _corps(request)
    try:
        validateur = Validateur(source)
        validateur.champ("titre", "required|max:255")
        validateur.champ("contenu", "required")
        donnees = validateur.resultat()
    except ErreursValidation as erreur:
        return retour_avec_erreurs(request, erreur.erreurs)

    article.titre = donnees["titre"]
    article.contenu = donnees["contenu"]
    article.save(update_fields=["titre", "contenu"])

    deposer_flash(request, success_article="Article enregistré.")
    return redirect(_url_show(campagne.id, "contrat"))


@role_required(Role.ADMIN)
@http_methods("POST", "DELETE")
def article_destroy(request, campagne, article):
    campagne = get_object_or_404(Campagne, pk=campagne)
    article = get_object_or_404(CampagneContratArticle, pk=article)
    if article.campagne_id != campagne.id:
        raise Http404
    article.delete()

    deposer_flash(request, success_article="Article supprimé.")
    return redirect(_url_show(campagne.id, "contrat"))


# ---------------------------------------------------------------------------
# Versements d'aide hebdomadaire
# ---------------------------------------------------------------------------


@role_required(Role.ADMIN)
@http_methods("POST")
def versement_store(request, campagne):
    campagne = get_object_or_404(Campagne, pk=campagne)
    source = request.POST

    validateur = Validateur(source)
    validateur.champ("user_id", "required|integer")
    validateur.champ("semaine_debut", "required|date")
    validateur.champ("montant_carburant", "required|integer|min:0")
    validateur.champ("montant_credit_tel", "required|integer|min:0")
    validateur.existe("user_id", User.objects.all())
    try:
        donnees = validateur.resultat()
    except ErreursValidation as erreur:
        return retour_avec_erreurs(request, erreur.erreurs)

    user = get_object_or_404(User, pk=donnees["user_id"])
    if not user.is_commercial_ou_telephonique or not campagne.user_est_signataire_contrat(user):
        return retour_avec_erreurs(
            request,
            {"user_id": "Ce commercial ne fait pas partie des signataires de cette campagne."},
        )

    CampagneAideVersement.objects.create(
        campagne_id=campagne.id,
        user_id=user.id,
        semaine_debut=donnees["semaine_debut"],
        montant_carburant=donnees["montant_carburant"],
        montant_credit_tel=donnees["montant_credit_tel"],
        enregistre_par_id=request.user.id,
    )
    deposer_flash(
        request, success="Versement enregistré. Le commercial doit confirmer la réception."
    )
    return redirect(_url_show(campagne.id, "aide"))


@role_required(Role.ADMIN)
@http_methods("POST", "DELETE")
def versement_destroy(request, campagne, versement):
    campagne = get_object_or_404(Campagne, pk=campagne)
    versement = get_object_or_404(CampagneAideVersement, pk=versement)
    if versement.campagne_id != campagne.id:
        raise Http404
    # Un versement dont le commercial a accusé réception fait foi : il ne peut
    # plus être retiré de l'historique.
    if versement.accuse_at:
        return retour_avec_erreurs(
            request,
            {"versement": "Impossible de supprimer un versement déjà accusé réception."},
        )
    versement.delete()

    deposer_flash(request, success="Versement supprimé.")
    return redirect(_url_show(campagne.id, "aide"))


# ---------------------------------------------------------------------------
# Espace direction (lecture seule)
# ---------------------------------------------------------------------------


@role_required(Role.DIRECTION)
@http_methods("GET", "HEAD")
def direction_index(request):
    Campagne.sync_statuts()
    campagnes = filtrer_campagnes(
        Campagne.objects.order_by("-date_debut"), partenaire_courant(request)
    )

    def formater(c):
        if c.toutes_agences:
            agences = "Toutes"
        else:
            agences = ", ".join(c.agences.values_list("nom", flat=True)) or "—"
        return {
            "id": c.id,
            "nom": c.nom,
            "date_debut": c.date_debut.strftime("%d/%m/%Y"),
            "date_fin": c.date_fin.strftime("%d/%m/%Y"),
            "agences": agences,
            "prime_meilleur_vendeur": nombre_format(c.prime_meilleur_vendeur),
            "statut": c.statut_effectif,
        }

    return render(
        request,
        "Direction/Campagnes/Index",
        {"campagnes": paginer(request, campagnes, 15, formater)},
    )


@role_required(Role.DIRECTION)
@http_methods("GET", "HEAD")
def direction_show(request, campagne):
    campagne = _campagne_du_perimetre(request, campagne)
    detail = services.construire_detail(campagne, request)
    return render(
        request, "Admin/Campagnes/Show", services.vers_props_inertia(request, detail, True)
    )
