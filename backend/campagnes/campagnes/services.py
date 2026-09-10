"""
Services campagne : construction de l'écran de détail, agrégats du reporting
téléphonique, et import en masse de commerciaux.

Portage de app/Services/{CampagneDetailService,CampagneCommerciauxImportService}.php
et des méthodes téléphoniques de CampagneRapportService.
"""

import re
from datetime import date, datetime, timedelta

from django.db import transaction
from django.db.models import Count, Q, Sum
from django.db.models.functions import Lower, Trim

from core.auth_backend import hacher_mot_de_passe
from core.models import ROLES_COMMERCIAUX, Agence, Role, TypeCarte, User
from core.php import nombre_format
from terrain.models import EnrolementClient, Prime, TelephoniqueRapport, Vente

from .articles_defaut import MARQUEURS, articles_par_defaut
from .models import (
    Campagne,
    CampagneContratArticle,
    ContratPrestationReponse,
    StatutCampagne,
    TypeCampagne,
)

ONGLETS = ["pilotage", "commerciaux", "contrat", "aide", "performances", "historique"]


def _debut_jour(jour):
    return datetime(jour.year, jour.month, jour.day)


def _fin_jour(jour):
    return datetime(jour.year, jour.month, jour.day, 23, 59, 59, 999999)


def _nom(user):
    if user is None:
        return None
    return f"{user.prenom} {user.name}".strip() if user.prenom else user.name


# ---------------------------------------------------------------------------
# Articles de contrat
# ---------------------------------------------------------------------------


def _remplir_marqueurs(texte, campagne):
    """
    Remplace `{date_debut}`, `{emolument_forfait}`… par les valeurs de la campagne.

    Les articles sont recopiés une fois pour toutes dans la campagne : ce qui
    est signé doit dire les vraies dates et les vrais montants, pas un gabarit.
    """
    from core.php import nombre_format

    for marqueur, (champ, genre) in MARQUEURS.items():
        if marqueur not in texte:
            continue
        valeur = getattr(campagne, champ, None)
        if valeur is None:
            continue
        rendu = (
            valeur.strftime("%d/%m/%Y") if genre == "date" else nombre_format(valeur)
        )
        texte = texte.replace(marqueur, rendu)
    return texte


def creer_articles_par_defaut_si_absents(
    campagne_id, type_campagne=TypeCampagne.VENTE_CARTE, modele=None
):
    """
    Portage de CampagneContratArticle::seedDefaultsIfEmpty(), étendu au modèle
    de contrat du client.

    `modele` est celui du partenaire de la campagne ; il est lu ici quand
    l'appelant ne le fournit pas, pour qu'aucun chemin ne puisse poser par
    inadvertance le contrat d'un autre client.
    """
    if CampagneContratArticle.objects.filter(campagne_id=campagne_id).exists():
        return

    campagne = Campagne.objects.filter(pk=campagne_id).first()
    if campagne is None:
        return
    if modele is None and campagne.partenaire_id:
        modele = campagne.partenaire.contrat_modele

    CampagneContratArticle.objects.bulk_create(
        [
            CampagneContratArticle(
                campagne_id=campagne_id,
                sort_order=index,
                titre=article["titre"],
                contenu=_remplir_marqueurs(article["contenu"], campagne),
            )
            for index, article in enumerate(
                articles_par_defaut(type_campagne, modele)
            )
        ]
    )


# ---------------------------------------------------------------------------
# Reporting téléphonique rattaché à une campagne
# ---------------------------------------------------------------------------


def rapports_telephoniques_campagne(campagne, debut, fin, agence_id=None, user_id=None):
    """
    Fiches téléphoniques d'une campagne sur une période.

    Deux branches, comme dans Laravel : les fiches explicitement rattachées à la
    campagne, et les fiches orphelines (`campagne_id` nul) d'une téléopératrice
    du périmètre — ces dernières datent d'avant l'ajout de la colonne.
    """
    liees = Q(campagne_id=campagne.id)
    if user_id is not None:
        liees &= Q(user_id=user_id)
    if agence_id is not None:
        liees &= Q(user__agence_id=agence_id)

    orphelines = Q(campagne_id__isnull=True) & Q(
        user__role=Role.COMMERCIAL_TELEPHONIQUE
    )
    if not campagne.toutes_agences:
        ids_agences = list(campagne.agences.values_list("id", flat=True))
        if not ids_agences:
            orphelines &= Q(pk__in=[])
        else:
            orphelines &= Q(user__agence_id__in=ids_agences)
    if agence_id is not None:
        orphelines &= Q(user__agence_id=agence_id)
    if user_id is not None:
        orphelines &= Q(user_id=user_id)

    return TelephoniqueRapport.objects.filter(
        Q(date_rapport__gte=debut.date() if hasattr(debut, "date") else debut)
        & Q(date_rapport__lte=fin.date() if hasattr(fin, "date") else fin)
        & (liees | orphelines)
    )


def totaux_telephonique(queryset):
    """Totaux cumulés d'une liste de fiches, hors pagination."""
    agregats = queryset.aggregate(
        nb_fiches=Count("id"),
        appels_emis=Sum("appels_emis"),
        appels_joignables=Sum("appels_joignables"),
        appels_non_joignables=Sum("appels_non_joignables"),
        clients_interesses=Sum("clients_interesses_nombre"),
        clients_deja_servis=Sum("clients_deja_servis_nombre"),
    )
    return {cle: int(valeur or 0) for cle, valeur in agregats.items()}


def agregats_telephonique(campagne, debut, fin, agence_id=None, user_id=None):
    return totaux_telephonique(
        rapports_telephoniques_campagne(campagne, debut, fin, agence_id, user_id)
    )


# ---------------------------------------------------------------------------
# Écran de détail d'une campagne
# ---------------------------------------------------------------------------


def resoudre_periode(request, campagne):
    """
    Période affichée : préréglage « campagne », « semaine », « mois » ou « perso ».
    Portage de CampagneDetailService::resolvePeriodeFromRequest().
    """
    debut_campagne = _debut_jour(campagne.date_debut)
    fin_campagne = _fin_jour(campagne.date_fin)

    if request is None:
        return "campagne", debut_campagne, fin_campagne

    preset = request.GET.get("periode", "campagne")
    maintenant = datetime.now()

    if preset == "semaine":
        lundi = maintenant.date() - timedelta(days=maintenant.weekday())
        return "semaine", _debut_jour(lundi), _fin_jour(lundi + timedelta(days=6))

    if preset == "mois":
        premier = maintenant.date().replace(day=1)
        suivant = (premier + timedelta(days=32)).replace(day=1)
        return "mois", _debut_jour(premier), _fin_jour(suivant - timedelta(days=1))

    if preset == "perso":
        depuis = request.GET.get("date_debut")
        jusqua = request.GET.get("date_fin")
        return (
            "perso",
            _debut_jour(date.fromisoformat(depuis)) if depuis else debut_campagne,
            _fin_jour(date.fromisoformat(jusqua)) if jusqua else fin_campagne,
        )

    return "campagne", debut_campagne, fin_campagne


def construire_detail(campagne, request=None):
    """Portage de CampagneDetailService::buildShowData()."""
    Campagne.sync_statuts()
    campagne.refresh_from_db()

    preset, debut, fin = resoudre_periode(request, campagne)

    commerciaux_perimetre = list(
        campagne.query_commerciaux_perimetre().select_related("agence").order_by("name")
    )

    candidats = User.objects.select_related("agence").filter(
        role__in=ROLES_COMMERCIAUX, agence_id__isnull=False
    )
    if not campagne.toutes_agences:
        candidats = candidats.filter(agence_id__in=campagne.ids_agences_perimetre())
    candidats = list(candidats.order_by("name"))

    reponses_par_user = {
        reponse.user_id: reponse
        for reponse in campagne.contrat_reponses.select_related("user")
    }

    onglet = request.GET.get("tab") if request else None
    onglet = onglet if onglet in ONGLETS else "pilotage"

    # La période affichée est toujours bornée à celle de la campagne ; si
    # l'intersection est vide, on retombe sur la période complète.
    debut_campagne, fin_campagne = _debut_jour(campagne.date_debut), _fin_jour(campagne.date_fin)
    debut, fin = max(debut, debut_campagne), min(fin, fin_campagne)
    if debut > fin:
        debut, fin = debut_campagne, fin_campagne

    est_enrolement = campagne.type == TypeCampagne.ENROLEMENT_APP

    if est_enrolement:
        # Ni type de carte ni ventes hors campagne pour ce type : périmètre simple.
        base = EnrolementClient.objects.filter(
            campagne_id=campagne.id, created_at__range=(debut, fin)
        )
        par_type = {}
    else:
        ids_agences = (
            None if campagne.toutes_agences else list(campagne.agences.values_list("id", flat=True))
        )
        # Les ventes sans campagne réalisées dans la fenêtre par une agence du
        # périmètre sont rattachées à la campagne pour l'affichage.
        hors_campagne = Q(campagne_id__isnull=True) & Q(created_at__range=(debut, fin))
        if ids_agences:
            hors_campagne &= Q(agence_id__in=ids_agences)

        base = Vente.objects.filter(
            (Q(campagne_id=campagne.id) & Q(created_at__range=(debut, fin)))
            | hors_campagne
        )
        par_type = {
            ligne["type_carte_id"]: ligne["nb"]
            for ligne in base.values("type_carte_id").annotate(nb=Count("id"))
        }

    total = base.count()

    par_agence_brut = list(
        base.values("agence_id").annotate(nb=Count("id")).order_by()
    )
    noms_agences = dict(
        Agence.objects.filter(
            id__in=[l["agence_id"] for l in par_agence_brut if l["agence_id"]]
        ).values_list("id", "nom")
    )
    par_agence = [
        {"agence_nom": noms_agences.get(l["agence_id"], "N/A"), "nb": int(l["nb"])}
        for l in par_agence_brut
    ]

    classement_brut = list(
        base.values("user_id").annotate(total_ventes=Count("id")).order_by("-total_ventes")
    )
    utilisateurs = {
        u.id: u
        for u in User.objects.filter(
            id__in=[l["user_id"] for l in classement_brut if l["user_id"]]
        )
    }
    classement = [
        {
            "rang": index + 1,
            "user_name": _nom(utilisateurs.get(ligne["user_id"])) or "-",
            "total_ventes": ligne["total_ventes"],
        }
        for index, ligne in enumerate(classement_brut)
    ]

    # Les primes sont indexées par mois, pas par campagne : sans ce garde-fou,
    # celles d'une campagne de vente simultanée s'afficheraient ici.
    if est_enrolement:
        primes = []
        types_cartes = []
    else:
        periodes = set()
        courant = debut.date().replace(day=1)
        dernier = fin.date().replace(day=1)
        while courant <= dernier:
            periodes.add(courant.strftime("%Y-%m"))
            courant = (courant + timedelta(days=32)).replace(day=1)

        primes = list(
            Prime.objects.select_related("user")
            .filter(user_id__in=list(utilisateurs), periode__in=periodes)
            .order_by("periode")
        )
        types_cartes = list(TypeCarte.objects.order_by("code"))

    telephonique = (
        {
            "nb_fiches": 0,
            "appels_emis": 0,
            "appels_joignables": 0,
            "appels_non_joignables": 0,
            "clients_interesses": 0,
            "clients_deja_servis": 0,
        }
        if est_enrolement
        else agregats_telephonique(campagne, debut, fin)
    )

    return {
        "campagne": campagne,
        "preset": preset,
        "periode_debut": debut,
        "periode_fin": fin,
        "activeTab": onglet,
        "stats": {"total_ventes": total, "par_type": par_type, "par_agence": par_agence},
        "classement": classement,
        "primes": primes,
        "typesCartes": types_cartes,
        "telephoniqueCampagne": telephonique,
        "commerciauxPerimetre": commerciaux_perimetre,
        "commerciauxCandidats": candidats,
        "reponsesParUser": reponses_par_user,
        "nbCommerciauxActifs": sum(1 for u in commerciaux_perimetre if u.actif),
        "nbCommerciauxInactifs": sum(1 for u in commerciaux_perimetre if not u.actif),
    }


def _date_fr(valeur):
    """Formate une date/datetime éventuellement stockée en texte dans un JSON."""
    if valeur is None:
        return None
    if isinstance(valeur, str):
        valeur = datetime.fromisoformat(valeur.replace("Z", "+00:00"))
    return valeur.strftime("%d/%m/%Y")


def vers_props_inertia(request, detail, est_detail_direction):
    """Portage de CampagneDetailService::toInertiaProps()."""
    campagne = detail["campagne"]
    statut = campagne.statut_effectif
    debut, fin = detail["periode_debut"], detail["periode_fin"]

    articles = list(campagne.contrat_articles.order_by("sort_order"))
    reponses = list(campagne.contrat_reponses.select_related("user"))
    versements = list(
        campagne.aide_versements.select_related("user").order_by("-semaine_debut")
    )
    signataires = list(campagne.signataires_contrat.all())
    delai_expire = campagne.contrat_delai_expire()

    if campagne.toutes_agences:
        libelle_agences = "Toutes les agences"
    else:
        libelle_agences = ", ".join(
            campagne.agences.values_list("nom", flat=True)
        )

    if campagne.remise_pourcentage:
        if campagne.remise_tous_types_cartes:
            suffixe = " — tous types"
        else:
            codes = ", ".join(campagne.types_cartes_remise.values_list("code", flat=True))
            suffixe = " — " + (codes or "types non définis")
        libelle_remise = f"{campagne.remise_pourcentage} %{suffixe}"
    else:
        libelle_remise = None

    par_type = detail["stats"]["par_type"]

    return {
        "isDirectionDetail": est_detail_direction,
        "activeTab": detail["activeTab"],
        "preset": detail["preset"],
        "periode": {
            "debut": debut.strftime("%Y-%m-%d"),
            "fin": fin.strftime("%Y-%m-%d"),
            "debut_affiche": debut.strftime("%d/%m/%Y"),
            "fin_affiche": fin.strftime("%d/%m/%Y"),
        },
        "campagne": {
            "id": campagne.id,
            "nom": campagne.nom,
            "type": campagne.type,
            "statut": statut,
            "peut_piloter": statut
            in (StatutCampagne.PROGRAMMEE, StatutCampagne.EN_COURS),
            "date_debut": campagne.date_debut.strftime("%d/%m/%Y"),
            "date_fin": campagne.date_fin.strftime("%d/%m/%Y"),
            "date_debut_iso": campagne.date_debut.strftime("%Y-%m-%d"),
            "date_fin_iso": campagne.date_fin.strftime("%Y-%m-%d"),
            "agences_libelle": libelle_agences,
            "prime_meilleur_vendeur": nombre_format(campagne.prime_meilleur_vendeur),
            "aide_hebdo_active": campagne.aide_hebdo_active,
            "aide_hebdo_montant": nombre_format(campagne.aide_hebdo_montant),
            "aide_hebdo_carburant": nombre_format(campagne.aide_hebdo_carburant),
            "aide_hebdo_credit_tel": nombre_format(campagne.aide_hebdo_credit_tel),
            "remise_libelle": libelle_remise,
            "created_at": campagne.created_at.strftime("%d/%m/%Y %H:%M"),
            "contrat_tous_commerciaux": campagne.contrat_tous_commerciaux,
            "contrat_emolument_forfait": nombre_format(campagne.contrat_emolument_forfait),
            "contrat_forfait_communication": nombre_format(
                campagne.contrat_forfait_communication
            ),
            "contrat_forfait_deplacement": nombre_format(
                campagne.contrat_forfait_deplacement
            ),
            "contrat_representant_nom": campagne.contrat_representant_nom,
            "contrat_lieu_signature": campagne.contrat_lieu_signature,
            "contrat_clause_libre": campagne.contrat_clause_libre,
            "contrat_publie_at": campagne.contrat_publie_at.strftime("%d/%m/%Y %H:%M")
            if campagne.contrat_publie_at
            else None,
            "contrat_articles": [
                {"id": a.id, "titre": a.titre, "contenu": a.contenu} for a in articles
            ],
            "contrat_reponses": [
                {
                    "id": r.id,
                    "user_name": _nom(r.user),
                    "statut": r.statut,
                    "verrou": delai_expire and r.statut == "en_attente",
                    "repondu_at": r.repondu_at.strftime("%d/%m/%Y %H:%M")
                    if r.repondu_at
                    else None,
                }
                for r in reponses
            ],
            "aide_versements": [
                {
                    "id": v.id,
                    "semaine_debut": v.semaine_debut.strftime("%d/%m/%Y"),
                    "user_name": _nom(v.user),
                    "montant_carburant": nombre_format(v.montant_carburant),
                    "montant_credit_tel": nombre_format(v.montant_credit_tel),
                    "accuse_at": v.accuse_at.strftime("%d/%m/%Y %H:%M")
                    if v.accuse_at
                    else None,
                }
                for v in versements
            ],
            "signataires_pour_versement": [
                {"id": u.id, "nom": _nom(u)} for u in signataires
            ],
            "actions": [
                {
                    "id": a.id,
                    "action": a.action,
                    "description": a.description,
                    "created_at": a.created_at.strftime("%d/%m/%Y %H:%M"),
                    "user_name": a.user.name if a.user_id else None,
                    "avant": {
                        "date_debut": _date_fr((a.donnees_avant or {}).get("date_debut")),
                        "date_fin": _date_fr((a.donnees_avant or {}).get("date_fin")),
                    }
                    if a.donnees_avant
                    else None,
                    "apres": {
                        "date_debut": _date_fr((a.donnees_apres or {}).get("date_debut")),
                        "date_fin": _date_fr((a.donnees_apres or {}).get("date_fin")),
                    }
                    if a.donnees_apres
                    else None,
                }
                for a in campagne.actions.select_related("user").order_by("-created_at")
            ],
        },
        "nbCommerciauxActifs": detail["nbCommerciauxActifs"],
        "nbCommerciauxInactifs": detail["nbCommerciauxInactifs"],
        "commerciauxPerimetre": [
            {
                "id": u.id,
                "nom": _nom(u),
                "agence_nom": u.agence.nom if u.agence_id else "—",
                "telephone": u.telephone,
                "actif": bool(u.actif),
                "contrat_statut": reponse.statut
                if (reponse := detail["reponsesParUser"].get(u.id))
                else None,
            }
            for u in detail["commerciauxPerimetre"]
        ],
        "commerciauxCandidats": [
            {
                "id": c.id,
                "nom": _nom(c),
                "agence_nom": c.agence.nom if c.agence_id else "?",
            }
            for c in detail["commerciauxCandidats"]
        ],
        "benefIds": [u.id for u in signataires],
        "stats": {
            "total_ventes": detail["stats"]["total_ventes"],
            "par_type": [
                {"code": tc.code, "nb": int(par_type.get(tc.id, 0))}
                for tc in detail["typesCartes"]
            ],
            "par_agence": detail["stats"]["par_agence"],
        },
        "classement": detail["classement"],
        "primes": [
            {
                "periode": p.periode,
                "user_name": _nom(p.user),
                "rang": p.rang,
                "montant": nombre_format(p.montant),
            }
            for p in detail["primes"]
        ],
        "telephoniqueCampagne": detail["telephoniqueCampagne"],
        # `route()` de Laravel produit une URL absolue.
        "telephoniqueListUrl": request.build_absolute_uri(
            f"/rapports/campagnes/{campagne.id}/reporting-telephonique"
            f"?date_debut={debut.strftime('%Y-%m-%d')}&date_fin={fin.strftime('%Y-%m-%d')}"
        ),
    }


# ---------------------------------------------------------------------------
# Import en masse de commerciaux
# ---------------------------------------------------------------------------


def _normaliser_nom(valeur):
    return re.sub(r"\s+", " ", (valeur or "").strip()).lower()


def _est_ligne_entete(nom, prenom):
    return nom.strip().lower() in ("nom", "n°", "no") or prenom.strip().lower() in (
        "prénom",
        "prenom",
    )


def _mapper_colonnes(colonnes):
    """[nom, prénom, agence, téléphone] selon le nombre de colonnes collées."""
    nombre = len(colonnes)
    if nombre == 6:  # N°, Nom, Prénom, Quartier, Agence, Téléphone
        return colonnes[1], colonnes[2], colonnes[4], colonnes[5]
    if nombre == 5:  # Nom, Prénom, Quartier, Agence, Téléphone
        return colonnes[0], colonnes[1], colonnes[3], colonnes[4]
    if nombre == 4:  # Nom, Prénom, Agence, Téléphone
        return colonnes[0], colonnes[1], colonnes[2], colonnes[3]
    return None


def analyser_texte_colle(texte):
    """
    Découpe un collage Excel en lignes exploitables.

    Le séparateur est la tabulation ; à défaut, deux espaces ou plus. La ligne
    n'est pas nettoyée avant découpage, sous peine de perdre les cellules vides
    en fin de ligne et donc de fausser le nombre de colonnes détecté.
    """
    resultat = []
    telephones_vus = {}

    for index, ligne_brute in enumerate(re.split(r"\r\n|\r|\n", texte or "")):
        ligne_no = index + 1
        if ligne_brute.strip() == "":
            continue

        ligne = ligne_brute.rstrip("\r\n")
        colonnes = ligne.split("\t")
        if len(colonnes) == 1:
            colonnes = re.split(r"\s{2,}", ligne.strip()) or [ligne.strip()]
        colonnes = [c.strip() for c in colonnes]

        mappe = _mapper_colonnes(colonnes)
        if mappe is None:
            resultat.append(
                {
                    "ligne_no": ligne_no,
                    "nom": "",
                    "prenom": "",
                    "agence_nom": "",
                    "telephone": "",
                    "erreurs": [
                        f"Format non reconnu ({len(colonnes)} colonne(s)) — "
                        "attendu : Nom, Prénom, [Quartier], Agence, Téléphone."
                    ],
                }
            )
            continue

        nom, prenom, agence_nom, telephone_brut = mappe
        if _est_ligne_entete(nom, prenom):
            continue

        erreurs = []
        if nom == "":
            erreurs.append("Nom manquant.")
        if prenom == "":
            erreurs.append("Prénom manquant.")
        if agence_nom == "":
            erreurs.append("Agence manquante.")

        telephone = re.sub(r"\D", "", telephone_brut or "")
        if len(telephone) < 2:
            erreurs.append("Numéro de téléphone invalide.")
        elif telephone in telephones_vus:
            erreurs.append(
                f"Doublon dans la liste collée (même téléphone que la ligne {telephones_vus[telephone]})."
            )
        else:
            telephones_vus[telephone] = ligne_no

        resultat.append(
            {
                "ligne_no": ligne_no,
                "nom": nom,
                "prenom": prenom,
                "agence_nom": agence_nom,
                "telephone": telephone,
                "erreurs": erreurs,
            }
        )

    return resultat


def generer_mot_de_passe_initial(prenom, nom, telephone):
    """Ex. « A75B@bdm » — initiale du prénom, 2 derniers chiffres, initiale du nom."""
    initiale_prenom = (prenom or "").strip()[:1].upper()
    initiale_nom = (nom or "").strip()[:1].upper()
    return f"{initiale_prenom}{telephone[-2:]}{initiale_nom}@bdm"


def _resoudre_agence(nom_brut, persister):
    normalise = _normaliser_nom(nom_brut)
    agence = (
        Agence.objects.annotate(nom_normalise=Lower(Trim("nom")))
        .filter(nom_normalise=normalise)
        .first()
    )
    if agence:
        return agence, False
    if not persister:
        return None, True

    maximum = Agence.objects.order_by("-ordre").values_list("ordre", flat=True).first()
    return Agence.objects.create(nom=nom_brut.strip(), ordre=int(maximum or 0) + 1), True


def _resoudre_commercial(nom, prenom, telephone, agence_id, persister):
    user = User.objects.filter(telephone=telephone).first()
    if user:
        conflit = (
            user.agence_id is not None
            and agence_id is not None
            and int(user.agence_id) != agence_id
        )
        return user, False, conflit
    if not persister:
        return None, True, False

    user = User.objects.create(
        name=nom,
        prenom=prenom,
        email=None,
        telephone=telephone,
        password=hacher_mot_de_passe(
            generer_mot_de_passe_initial(prenom, nom, telephone)
        ),
        role=Role.COMMERCIAL,
        agence_id=agence_id,
        actif=True,
    )
    return user, True, False


def previsualiser_import(texte):
    """Analyse sans rien écrire en base."""
    lignes_analysees = analyser_texte_colle(texte)
    agences_en_creation = set()

    lignes = []
    valides = agences_a_creer = commerciaux_a_creer = commerciaux_existants = erreurs = 0

    for ligne in lignes_analysees:
        if ligne["erreurs"]:
            erreurs += 1
            lignes.append(
                {
                    **ligne,
                    "agence_statut": None,
                    "commercial_statut": None,
                    "conflit_agence": False,
                    "mot_de_passe_apercu": None,
                }
            )
            continue

        valides += 1
        agence, agence_a_creer = _resoudre_agence(ligne["agence_nom"], False)
        if agence_a_creer:
            # Une même agence citée sur plusieurs lignes ne compte qu'une fois.
            normalise = _normaliser_nom(ligne["agence_nom"])
            if normalise not in agences_en_creation:
                agences_en_creation.add(normalise)
                agences_a_creer += 1

        _, commercial_a_creer, conflit = _resoudre_commercial(
            ligne["nom"], ligne["prenom"], ligne["telephone"],
            agence.id if agence else None, False,
        )
        if commercial_a_creer:
            commerciaux_a_creer += 1
        else:
            commerciaux_existants += 1

        lignes.append(
            {
                **ligne,
                "agence_statut": "a_creer" if agence_a_creer else "existe",
                "commercial_statut": "a_creer" if commercial_a_creer else "existe",
                "conflit_agence": conflit,
                "mot_de_passe_apercu": generer_mot_de_passe_initial(
                    ligne["prenom"], ligne["nom"], ligne["telephone"]
                )
                if commercial_a_creer
                else None,
            }
        )

    return {
        "lignes": lignes,
        "resume": {
            "lignes_valides": valides,
            "agences_a_creer": agences_a_creer,
            "commerciaux_a_creer": commerciaux_a_creer,
            "commerciaux_existants": commerciaux_existants,
            "erreurs": erreurs,
        },
    }


def importer_commerciaux(texte):
    """Import réel : crée les agences et les comptes manquants, en transaction."""
    lignes_analysees = analyser_texte_colle(texte)
    valides = [l for l in lignes_analysees if not l["erreurs"]]

    with transaction.atomic():
        user_ids = []
        agences_creees = commerciaux_crees = commerciaux_reutilises = 0

        for ligne in valides:
            agence, agence_creee = _resoudre_agence(ligne["agence_nom"], True)
            if agence_creee:
                agences_creees += 1

            user, cree, _ = _resoudre_commercial(
                ligne["nom"], ligne["prenom"], ligne["telephone"], agence.id, True
            )
            if cree:
                commerciaux_crees += 1
            else:
                commerciaux_reutilises += 1
            user_ids.append(user.id)

    return {
        "user_ids": list(dict.fromkeys(user_ids)),
        "agences_creees": agences_creees,
        "commerciaux_crees": commerciaux_crees,
        "commerciaux_reutilises": commerciaux_reutilises,
        "lignes_en_erreur": len(lignes_analysees) - len(valides),
    }
