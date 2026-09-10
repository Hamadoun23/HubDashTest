"""
Tableau de bord — portage de app/Http/Controllers/DashboardController.php.

Quatre variantes selon le rôle : admin, direction (admin en lecture seule),
commercial téléphonique et commercial terrain.
"""

from datetime import datetime

from inertia import render

from campagnes.models import Campagne, StatutCampagne, TypeCampagne
from rapports.services import (
    agreger_par_periode,
    classement_enrolements_pour_campagnes,
    classement_ventes_pour_campagnes,
)
from terrain.models import EnrolementClient, Vente

from .decorators import http_methods
from .models import Agence, Role, User
from .partenaires import (
    filtrer_agences,
    filtrer_campagnes,
    filtrer_saisies,
    filtrer_users,
    partenaire_courant,
)


def _fenetre(campagnes):
    """Plage couvrant les campagnes, du premier jour 00:00 au dernier jour 23:59:59."""
    if not campagnes:
        return None
    debut = min(c.date_debut for c in campagnes)
    fin = max(c.date_fin for c in campagnes)
    return (
        datetime(debut.year, debut.month, debut.day),
        datetime(fin.year, fin.month, fin.day, 23, 59, 59, 999999),
    )


def _jj_mm_aaaa(jour):
    return jour.strftime("%d/%m/%Y")


def _contexte_user(user):
    nom = f"{user.prenom or ''} {user.name or ''}".strip() or (user.name or "—")
    return {
        "display_name": nom,
        "is_admin": user.is_admin,
        "agence_nom": user.agence.nom if user.agence_id else None,
    }


def _libelle(campagnes):
    if not campagnes:
        return "Aucune campagne"
    noms = [f"« {c.nom} »" for c in campagnes]
    return noms[0] if len(noms) == 1 else ", ".join(noms[:-1]) + " et " + noms[-1]


@http_methods("GET", "HEAD")
def dashboard(request):
    user = request.user
    if not user.is_authenticated:
        return render(request, "Dashboard", {"variant": "guest"})
    if user.is_admin:
        return _dashboard_admin(request, user, lecture_seule=False)
    if user.is_direction:
        return _dashboard_admin(request, user, lecture_seule=True)
    if user.is_commercial_telephonique:
        return _dashboard_telephonique(request, user)
    return _dashboard_commercial(request, user)


def _dashboard_admin(request, user, lecture_seule):
    Campagne.sync_statuts()
    # Tout le tableau de bord est celui d'un seul client de GDA.
    partenaire = partenaire_courant(request)
    partenaire_id = partenaire.id if partenaire else None

    # Si le périmètre de référence ne contient que des campagnes d'enrôlement,
    # tout le tableau de bord doit parler d'enrôlements : les compteurs de
    # ventes resteraient sinon à zéro.
    campagnes_stats = Campagne.campagnes_pour_stats(None, partenaire_id)
    campagnes_vente = [c for c in campagnes_stats if c.type == TypeCampagne.VENTE_CARTE]
    campagnes_enrolement = [
        c for c in campagnes_stats if c.type == TypeCampagne.ENROLEMENT_APP
    ]
    est_enrolement = not campagnes_vente and bool(campagnes_enrolement)
    campagnes_du_type = campagnes_enrolement if est_enrolement else campagnes_vente

    ids_stats = [c.id for c in campagnes_du_type]
    fenetre = _fenetre(campagnes_du_type)

    modele = EnrolementClient if est_enrolement else Vente
    base = (
        filtrer_saisies(modele.objects.filter(campagne_id__in=ids_stats), partenaire)
        if ids_stats
        else modele.objects.none()
    )

    ventes_total = base.count()
    ventes_mois = base.filter(created_at__range=fenetre).count() if fenetre else 0

    if fenetre:
        calcul = (
            classement_enrolements_pour_campagnes
            if est_enrolement
            else classement_ventes_pour_campagnes
        )
        classement = calcul(ids_stats, fenetre[0], fenetre[1])
    else:
        classement = []

    tendance = [
        ligne["total_ventes"] for ligne in agreger_par_periode(base, "semaine")
    ][-6:]

    pct_actifs = (
        round(len([c for c in classement if c["total_ventes"] > 0]) / len(classement) * 100)
        if classement
        else 0
    )

    campagnes_actives = list(
        filtrer_campagnes(
            Campagne.objects.filter(actif=True).order_by("-date_debut"), partenaire
        )
    )
    campagne_active = campagnes_actives[0] if campagnes_actives else None

    return render(
        request,
        "Dashboard",
        {
            "variant": "admin",
            "user": _contexte_user(user),
            "readOnly": lecture_seule,
            "estEnrolement": est_enrolement,
            "ventesTotal": ventes_total,
            "ventesMois": ventes_mois,
            "venteTrend": tendance,
            "pctCommerciauxActifs": pct_actifs,
            "classement": classement[:5],
            "campagnesTotal": filtrer_campagnes(
                Campagne.objects.all(), partenaire
            ).count(),
            "campagneActive": {
                "nom": campagne_active.nom,
                "date_debut": _jj_mm_aaaa(campagne_active.date_debut),
                "date_fin": _jj_mm_aaaa(campagne_active.date_fin),
            }
            if campagne_active
            else None,
            "campagnesActivesListe": [
                {
                    "nom": c.nom,
                    "date_debut": _jj_mm_aaaa(c.date_debut),
                    "date_fin": _jj_mm_aaaa(c.date_fin),
                }
                for c in campagnes_actives
            ],
            "campagnesEnCours": filtrer_campagnes(
                Campagne.objects.filter(statut=StatutCampagne.EN_COURS), partenaire
            ).count(),
            "campagnesProgrammees": filtrer_campagnes(
                Campagne.objects.filter(statut=StatutCampagne.PROGRAMMEE), partenaire
            ).count(),
            "libelleStatsCampagne": _libelle(campagnes_du_type),
            "agencesCount": filtrer_agences(Agence.objects.all(), partenaire).count(),
            "commerciauxCount": filtrer_users(
                User.objects.filter(role=Role.COMMERCIAL), partenaire
            ).count(),
            # Pas de prop « client » ici : elle est déjà partagée par
            # `InertiaSharedDataMiddleware`, et une prop de page du même nom
            # l'écraserait — la barre latérale perdrait son sélecteur.
            "aDesAgences": partenaire is None or partenaire.a_des_agences,
        },
    )


def _dashboard_telephonique(request, user):
    Campagne.sync_statuts()
    actives = list(Campagne.actives_pour_commercial(user))
    campagne = actives[0] if actives else None

    return render(
        request,
        "Dashboard",
        {
            "variant": "telephonique",
            "user": _contexte_user(user),
            "campagneActive": {
                "nom": campagne.nom,
                "date_debut": _jj_mm_aaaa(campagne.date_debut),
                "date_fin": _jj_mm_aaaa(campagne.date_fin),
            }
            if campagne
            else None,
            "signataire": bool(campagne and campagne.user_est_signataire_contrat(user)),
        },
    )


def _dashboard_commercial(request, user):
    Campagne.sync_statuts()
    agence_id = int(user.agence_id) if user.agence_id else None
    partenaire_id = user.partenaire_id

    # Campagnes réellement ouvertes ET où ce commercial est engagé — « agence
    # couverte » ne suffit pas. Les deux univers vente et enrôlement restent
    # strictement séparés, y compris dans les statistiques affichées.
    engagees = [
        c
        for c in Campagne.actives_pour_commercial(user)
        if c.est_engage_commercial(user.id)
    ]
    vente_ouvertes = [c for c in engagees if c.type == TypeCampagne.VENTE_CARTE]
    enrolement_ouvertes = [c for c in engagees if c.type == TypeCampagne.ENROLEMENT_APP]

    stats = Campagne.campagnes_pour_stats(agence_id, partenaire_id)

    campagnes_vente = [c for c in stats if c.type == TypeCampagne.VENTE_CARTE]
    ids_vente = [c.id for c in campagnes_vente]
    if ids_vente:
        fenetre = _fenetre(campagnes_vente)
        mes_ventes = Vente.objects.filter(
            user_id=user.id, campagne_id__in=ids_vente
        ).count()
        classement = classement_ventes_pour_campagnes(
            ids_vente, fenetre[0], fenetre[1], False, agence_id
        )
    else:
        mes_ventes = 0
        classement = []

    mon_rang = next(
        (c["rang"] for c in classement if int(c["user_id"]) == int(user.id)), None
    )

    campagnes_enrolement = [c for c in stats if c.type == TypeCampagne.ENROLEMENT_APP]
    ids_enrolement = [c.id for c in campagnes_enrolement]
    mes_enrolements = (
        EnrolementClient.objects.filter(
            user_id=user.id, campagne_id__in=ids_enrolement
        ).count()
        if ids_enrolement
        else 0
    )

    def _resume(campagnes):
        return [
            {"nom": c.nom, "date_fin": _jj_mm_aaaa(c.date_fin)} for c in campagnes
        ]

    return render(
        request,
        "Dashboard",
        {
            "variant": "commercial",
            "user": _contexte_user(user),
            "peutVendre": bool(vente_ouvertes),
            "peutEnroler": bool(enrolement_ouvertes),
            "vente": {
                "mesVentes": mes_ventes,
                "monRang": mon_rang,
                "libelleStatsCampagne": ", ".join(c.nom for c in campagnes_vente) or None,
                "campagneActive": _resume(vente_ouvertes[:1])[0] if vente_ouvertes else None,
                "campagnesOuvertes": _resume(vente_ouvertes),
            },
            "enrolement": {
                "mesEnrolements": mes_enrolements,
                "campagneActive": _resume(enrolement_ouvertes[:1])[0]
                if enrolement_ouvertes
                else None,
                "campagnesOuvertes": _resume(enrolement_ouvertes),
            },
        },
    )
