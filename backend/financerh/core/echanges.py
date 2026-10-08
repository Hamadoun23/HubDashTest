"""Journal d'un dossier : echanges, mise en attente, reprise et versions.

Le circuit de validation ne connaissait que oui ou non. Un valideur doit
aussi pouvoir dire « pas encore » : il met le dossier en attente avec une
observation (complement, piece manquante, question). Le demandeur repond dans
le fil ou corrige sa demande ; le dossier reprend alors sa route. Chaque
correction cree une nouvelle version, comparable a la precedente.

Tout tient dans `EvenementDossier`, attache a n'importe quel document
validable (absences, requisitions, depenses, missions...).
"""

from decimal import Decimal

from django.contrib.contenttypes.models import ContentType
from django.db.models import Max

from core.constants import Role, StatutDocument
from core.models import EvenementDossier

Type = EvenementDossier.Type

#: Champs techniques ou deja montres ailleurs : absents des versions.
CHAMPS_IGNORES = {
    "id", "numero", "demandeur", "statut", "date_soumission", "motif_rejet",
    "cree_le", "modifie_le", "montant_lettres",
}


def _valeur_affichable(document, champ):
    """Valeur lisible d'un champ : libelle d'un choix, nom d'un lien, nombre."""
    if champ.choices:
        return getattr(document, f"get_{champ.name}_display")() or ""
    valeur = getattr(document, champ.name, None)
    if valeur is None or valeur == "":
        return ""
    if champ.is_relation:
        return str(valeur)
    if hasattr(valeur, "isoformat") and not hasattr(valeur, "year"):  # heure seule
        return valeur.strftime("%H:%M")
    if hasattr(valeur, "isoformat"):
        return valeur.strftime("%d/%m/%Y %H:%M") if hasattr(valeur, "hour") else valeur.strftime("%d/%m/%Y")
    if isinstance(valeur, bool):
        return "Oui" if valeur else "Non"
    if isinstance(valeur, Decimal):
        return f"{valeur:,.0f}".replace(",", " ") if valeur == valeur.to_integral() else str(valeur)
    if hasattr(valeur, "name"):  # fichier
        return valeur.name.rsplit("/", 1)[-1] if valeur else ""
    return str(valeur)


#: Libelles lisibles des champs courants (les noms de modele n'ont pas d'accents).
LIBELLES = {
    "type_absence": "Type d'absence",
    "date_debut": "Date de début",
    "date_fin": "Date de fin",
    "demi_journee": "Demi-journée",
    "heure_debut": "Heure de début",
    "heure_fin": "Heure de fin",
    "nb_jours": "Nombre de jours",
    "remplacant": "Remplaçant",
    "date_depense": "Date de la dépense",
    "date_depart": "Date de départ",
    "date_retour": "Date de retour",
    "categorie": "Catégorie",
    "priorite": "Priorité",
    "beneficiaire": "Bénéficiaire",
}


def instantane(document):
    """Etat lisible du dossier : {champ: {libelle, valeur}}, dans l'ordre du modele."""
    etat = {}
    for champ in document._meta.concrete_fields:
        if champ.name in CHAMPS_IGNORES or champ.name.endswith("_ptr"):
            continue
        etat[champ.name] = {
            "libelle": LIBELLES.get(champ.name, str(champ.verbose_name).capitalize()),
            "valeur": _valeur_affichable(document, champ),
        }
    ajuster = getattr(document, "ajuster_resume", None)
    if callable(ajuster):
        etat = ajuster(etat)
    return etat


def _filtre(document):
    return {
        "content_type": ContentType.objects.get_for_model(document),
        "object_id": document.pk,
    }


def consigner(document, type_evenement, auteur=None, texte="", contexte="", versionner=False):
    """Ajoute un fait au journal ; `versionner` y joint un instantane numerote."""
    champs = {"type": type_evenement, "auteur": auteur, "texte": texte, "contexte": contexte}
    if versionner:
        dernier = EvenementDossier.objects.filter(**_filtre(document)).aggregate(m=Max("version"))["m"]
        champs["version"] = (dernier or 0) + 1
        champs["instantane"] = instantane(document)
    return EvenementDossier.objects.create(**_filtre(document), **champs)


def evenements(document):
    return EvenementDossier.objects.filter(**_filtre(document)).select_related("auteur")


def est_en_attente(document):
    """En attente tant que la derniere mise en attente n'a pas ete suivie d'une reprise."""
    if document.statut != StatutDocument.EN_VALIDATION:
        return False
    dernier = (
        evenements(document)
        .filter(type__in=[Type.MISE_EN_ATTENTE, Type.REPRISE, Type.APPROBATION, Type.REJET])
        .order_by("-cree_le", "-id")
        .first()
    )
    return dernier is not None and dernier.type == Type.MISE_EN_ATTENTE


def valideurs_concernes(document):
    """Utilisateurs pouvant intervenir sur une etape du circuit (attendus ou par role)."""
    from accounts.models import Utilisateur

    ids, roles = set(), set()
    for etape in document.etapes.all():
        if etape.decide_par_id:
            ids.add(etape.decide_par_id)
        if etape.valideur_attendu_id:
            ids.add(etape.valideur_attendu_id)
        elif etape.role_valideur:
            roles.add(etape.role_valideur)
    personnes = Utilisateur.objects.filter(is_active=True)
    return personnes.filter(pk__in=ids) | personnes.filter(role__in=roles)


#: Delai minimal entre deux relances d'un meme dossier par son demandeur.
DELAI_RELANCE_HEURES = 24


def etapes_en_attente(document):
    """Etapes qui attendent encore quelqu'un (les etapes « pour information » n'attendent personne)."""
    from core.constants import Decision, NatureEtape

    return [
        e
        for e in document.etapes.all()
        if e.decision == Decision.EN_ATTENTE and e.nature != NatureEtape.INFORMATION
    ]


def attendus(document):
    """Qui doit encore se prononcer, pour l'affichage : [{etape, qui}]."""
    lignes = []
    for e in etapes_en_attente(document):
        if e.valideur_attendu_id:
            qui = e.valideur_attendu.get_full_name()
        else:
            qui = e.get_role_valideur_display()
        lignes.append({"etape": e.libelle, "qui": qui})
    return lignes


def valideurs_en_attente(document):
    """Personnes a prevenir lors d'une relance : celles des etapes encore ouvertes."""
    from accounts.models import Utilisateur

    ids, roles = set(), set()
    for e in etapes_en_attente(document):
        if e.valideur_attendu_id:
            ids.add(e.valideur_attendu_id)
        elif e.role_valideur:
            roles.add(e.role_valideur)
    personnes = Utilisateur.objects.filter(is_active=True).exclude(pk=document.demandeur_id)
    return personnes.filter(pk__in=ids) | personnes.filter(role__in=roles)


def prochaine_relance(document):
    """Date a partir de laquelle une nouvelle relance est possible (None : tout de suite)."""
    from datetime import timedelta

    from django.utils import timezone

    derniere = evenements(document).filter(type=Type.RELANCE).order_by("-cree_le").first()
    if derniere is None:
        return None
    suivante = derniere.cree_le + timedelta(hours=DELAI_RELANCE_HEURES)
    return suivante if suivante > timezone.now() else None


def peut_consulter(document, user):
    """Demandeur, valideurs du circuit, Direction : ceux qui suivent ce dossier."""
    if document.demandeur_id == user.id or user.role == Role.DIRECTION:
        return True
    for etape in document.etapes.all():
        if user.id in (etape.decide_par_id, etape.valideur_attendu_id):
            return True
        if not etape.valideur_attendu_id and etape.role_valideur == user.role:
            return True
    return False


def _identifiants(personne):
    return [personne.email, personne.username]


def prevenir(document, auteur, titre, message, destinataires):
    """Notification GDA Hub a chacun, sauf a l'auteur lui-meme."""
    from accounts.notifications_hub import notifier

    reference = getattr(document, "numero", "") or ""
    cibles = []
    for personne in destinataires:
        if personne is None or (auteur is not None and personne.pk == auteur.pk):
            continue
        cibles.extend(_identifiants(personne))
    if cibles:
        notifier(
            cibles,
            titre=f"{titre} — {reference}".strip(" —"),
            message=message[:300],
            lien=lien_dossier(document),
            application="rh",
        )


def lien_dossier(document):
    return f"/rh/dossiers/{SOURCES_INVERSES.get(type(document).__name__, '')}/{document.pk}"


#: Nom du modele -> segment d'URL de la page de detail (cf. frontend).
SOURCES_INVERSES = {
    "DemandeAbsence": "absence",
    "Requisition": "requisition",
    "Depense": "depense",
    "Mission": "mission",
    "SortieCaisse": "sortie-caisse",
    "BonCommande": "bon-commande",
    "Prestation": "prestation",
}


def comparer(avant, apres):
    """Champs qui different entre deux instantanes."""
    changements = []
    for cle, champ in (apres or {}).items():
        ancienne = ((avant or {}).get(cle) or {}).get("valeur", "")
        if ancienne != champ.get("valeur", ""):
            changements.append({"libelle": champ.get("libelle", cle), "avant": ancienne, "apres": champ.get("valeur", "")})
    return changements
