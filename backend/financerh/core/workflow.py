"""Moteur de validation par seuils.

Un document (requisition, sortie de caisse, mission, demande d'absence...) est
soumis a un circuit compose d'etapes ordonnees. Les etapes sont derivees des
regles ``SeuilValidation`` correspondant au type de document et a son montant.
"""

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from core.constants import (
    STATUTS_TRANCHES,
    Decision,
    NatureEtape,
    Role,
    StatutDocument,
    TypeDocument,
)
from core.models import EtapeValidation, SeuilValidation


def seuils_applicables(type_document, montant):
    """Retourne les regles de validation a appliquer, triees par ordre."""
    regles = SeuilValidation.objects.filter(actif=True).filter(
        Q(type_document=type_document) | Q(type_document=TypeDocument.TOUS)
    )
    return sorted(
        (regle for regle in regles if regle.couvre(montant)),
        key=lambda regle: (regle.ordre, regle.montant_min),
    )


def responsable_de(agent):
    """Qui repond du demandeur.

    Le responsable de son departement d'abord : c'est lui qui connait la
    charge de l'equipe et arbitre les absences. A defaut — departement sans
    responsable, ou demandeur qui dirige lui-meme son departement — on
    retombe sur son rattachement hierarchique direct.
    """
    departement = getattr(agent, "departement", None)
    responsable = getattr(departement, "responsable", None) if departement else None
    if responsable is not None and responsable.id != agent.id:
        return responsable
    return getattr(agent, "manager", None)


def _valideur_resolu(regle, document):
    """Personne visee par la regle, ou ``None`` si l'etape vise un role.

    Ordre de priorite : la personne nommee l'emporte sur le responsable du
    demandeur, qui l'emporte sur le role. Sans personne resolue, l'etape
    revient a quiconque porte ``role_valideur`` — c'est aussi le repli d'une
    etape hierarchique dont le demandeur n'a ni departement ni responsable.
    """
    if regle.valideur_designe_id:
        return regle.valideur_designe
    if regle.valideur_hierarchique:
        return responsable_de(document.demandeur)
    return None


#: Du moins engageant au plus engageant. Sert a departager deux etapes qui
#: retombent sur la meme personne.
POIDS_NATURE = {
    NatureEtape.INFORMATION: 0,
    NatureEtape.AVIS: 1,
    NatureEtape.DECISION: 2,
}


def _regles_dedoublonnees(regles, document):
    """Ecarte les etapes qui retomberaient sur un intervenant deja sollicite.

    Le responsable d'un agent est souvent aussi le directeur cite plus loin
    dans le circuit : sans ce filtre, la meme personne devrait se prononcer
    deux fois sur le meme dossier.

    Entre deux etapes visant la meme personne, on retient **la plus
    engageante** ; a nature egale, **la plus precoce**. Un responsable direct
    se prononce donc des la premiere etape, avant les services transverses,
    tandis qu'un directeur qui tranche en dernier ressort garde sa place a la
    fin du circuit : sa decision ne remonte jamais au debut.

    Une personne couvre aussi le role qu'elle porte : le service financier
    n'est pas sollicite deux fois parce que le responsable du demandeur est
    lui-meme le responsable financier.
    """
    demandeur = document.demandeur

    candidats = []
    for regle in regles:
        valideur = _valideur_resolu(regle, document)
        # Personne ne se prononce sur son propre dossier, que l'etape le vise
        # nommement ou par le role qu'il porte : elle saute, le niveau
        # superieur l'absorbe.
        if valideur is not None and valideur.id == demandeur.id:
            continue
        if valideur is None and regle.role_valideur == demandeur.role:
            continue
        candidats.append((regle, valideur))

    def meilleure(gauche, droite):
        """La plus engageante des deux ; a egalite, la plus precoce."""
        if POIDS_NATURE[droite[0].nature] > POIDS_NATURE[gauche[0].nature]:
            return droite
        return gauche

    # Les etapes nominatives d'abord : elles determinent les roles deja couverts.
    par_personne = {}
    for candidat in candidats:
        valideur = candidat[1]
        if valideur is None:
            continue
        precedent = par_personne.get(valideur.id)
        par_personne[valideur.id] = (
            candidat if precedent is None else meilleure(precedent, candidat)
        )

    roles_couverts = {
        candidat[1].role for candidat in par_personne.values()
    }

    par_role = {}
    for regle, valideur in candidats:
        if valideur is not None or regle.role_valideur in roles_couverts:
            continue
        precedent = par_role.get(regle.role_valideur)
        par_role[regle.role_valideur] = (
            (regle, None) if precedent is None else meilleure(precedent, (regle, None))
        )

    retenues = [*par_personne.values(), *par_role.values()]
    retenues.sort(key=lambda candidat: (candidat[0].ordre, candidat[0].montant_min))
    return retenues


@transaction.atomic
def construire_circuit(document):
    """(Re)genere les etapes de validation d'un document."""
    document.etapes.all().delete()
    montant = document.montant_controle
    regles = seuils_applicables(document.TYPE_DOCUMENT, montant)

    etapes = []
    for position, (regle, valideur) in enumerate(
        _regles_dedoublonnees(regles, document), start=1
    ):
        information = regle.nature == NatureEtape.INFORMATION
        etapes.append(
            EtapeValidation(
                document=document,
                ordre=position,
                libelle=regle.libelle,
                role_valideur=regle.role_valideur,
                valideur_attendu=valideur,
                nature=regle.nature,
                # Une etape d'information n'attend aucun geste : elle est
                # franchie des la soumission, sinon le dossier resterait
                # bloque chez quelqu'un a qui l'on ne demande rien.
                decision=Decision.APPROUVE if information else Decision.EN_ATTENTE,
                date_decision=timezone.now() if information else None,
            )
        )
    EtapeValidation.objects.bulk_create(etapes)
    return etapes


@transaction.atomic
def soumettre(document, user):
    """Soumet un document au circuit de validation."""
    if document.statut not in {StatutDocument.BROUILLON, StatutDocument.REJETE}:
        raise ValidationError(
            {"statut": "Seul un document en brouillon ou rejete peut etre soumis."}
        )
    if document.demandeur_id != user.id and user.role != Role.DIRECTION:
        raise PermissionDenied("Vous n'etes pas le demandeur de ce document.")

    etapes = construire_circuit(document)
    document.motif_rejet = ""
    document.date_soumission = timezone.now()
    document.statut = (
        StatutDocument.EN_VALIDATION if etapes else StatutDocument.APPROUVE
    )
    document.save(update_fields=["statut", "date_soumission", "motif_rejet", "modifie_le"])
    if not etapes:
        # Aucun seuil configure pour ce type/montant : approbation directe.
        hook = getattr(document, "apres_approbation", None)
        if callable(hook):
            hook()
    return document


def raison_verrou(document):
    """Ce qui empeche le demandeur de corriger ou de retirer son dossier.

    Retourne le motif a afficher, ou ``None`` si la demande lui appartient
    encore. Deux verrous, dans cet ordre :

    1. **Le dossier est tranche** — approuve, rejete, annule ou cloture. Il
       appartient alors a la piste d'audit, plus a son auteur.
    2. **Un responsable s'est prononce** — meme si le dossier circule encore.
       Laisser corriger une demande apres un premier avis reviendrait a faire
       signer un texte, puis a en changer les termes.

    La soumission, elle, ne verrouille rien : l'interface envoie la demande
    dans la foulee de sa creation, et un chiffre mal saisi doit pouvoir se
    corriger tant que personne n'a rien signe.

    Une etape *pour information* est franchie a la soumission sans que
    quiconque agisse : elle ne porte pas de ``decide_par`` et ne verrouille
    donc pas le dossier. C'est bien un geste humain que l'on guette.
    """
    if document.statut in STATUTS_TRANCHES:
        return (
            f"Ce dossier est {document.get_statut_display().lower()} : "
            "il n'est plus modifiable."
        )
    # `all()` plutot qu'un `filter().exists()` : les vues prechargent les
    # etapes, et un filtre sur le manager relance une requete par dossier —
    # soit une cinquantaine sur une simple liste.
    if any(etape.decide_par_id for etape in document.etapes.all()):
        return (
            "Un responsable s'est deja prononce sur ce dossier : "
            "il n'est plus modifiable."
        )
    return None


@transaction.atomic
def rejouer_circuit(document):
    """Reconstruit le circuit d'un dossier corrige avant toute decision.

    Le montant commande le routage : une demande revue de 50 000 a 5 000 000
    doit passer devant les valideurs que son nouveau montant appelle. Comme
    personne ne s'est encore prononce, rien n'est perdu a repartir de zero.
    """
    if not construire_circuit(document):
        # Plus aucun seuil ne couvre le nouveau montant : approbation
        # directe, exactement comme a la soumission.
        document.statut = StatutDocument.APPROUVE
        document.save(update_fields=["statut", "modifie_le"])
        hook = getattr(document, "apres_approbation", None)
        if callable(hook):
            hook()
    return document


def etape_decisive(document):
    """L'etape qui clot le dossier.

    C'est la derniere etape de nature ``DECISION`` du circuit — celle qui a le
    dernier mot. A defaut, la derniere etape tout court : un circuit qui ne
    comporte que des avis se conclut sur le dernier d'entre eux, sans quoi
    personne ne trancherait jamais.
    """
    etapes = list(document.etapes.all())
    if not etapes:
        return None
    decisions = [etape for etape in etapes if etape.nature == NatureEtape.DECISION]
    return max(decisions or etapes, key=lambda etape: etape.ordre)


def etape_decidable_par(document, user):
    """L'etape en attente que ``user`` peut trancher, s'il y en a une.

    Les etapes ne s'enchainent pas : chacune est ouverte des la soumission, et
    ses valideurs se prononcent quand ils veulent. Attendre son tour n'aurait
    fait que ralentir un dossier sans rien ajouter a la piste d'audit.
    """
    for etape in document.etapes.filter(decision=Decision.EN_ATTENTE).order_by("ordre"):
        if etape.peut_etre_decidee_par(user):
            return etape
    return None


def _clore(document, approuve, commentaire=""):
    """Arrete le circuit : les etapes encore ouvertes deviennent sans objet."""
    document.etapes.filter(decision=Decision.EN_ATTENTE).update(decision=Decision.IGNORE)
    document.statut = StatutDocument.APPROUVE if approuve else StatutDocument.REJETE
    champs = ["statut", "modifie_le"]
    if not approuve:
        document.motif_rejet = commentaire
        champs.append("motif_rejet")
    document.save(update_fields=champs)
    if approuve:
        hook = getattr(document, "apres_approbation", None)
        if callable(hook):
            hook()
    return document


@transaction.atomic
def decider(document, user, approuve: bool, commentaire: str = ""):
    """Enregistre la decision de ``user`` sur l'etape qui lui revient.

    Tous les decideurs d'un circuit peuvent se prononcer en parallele, dans
    l'ordre qu'ils veulent. Le dossier se clot des que l'etape decisive tombe :
    si le Directeur General accorde en premier, la demande est approuvee et
    disparait des files de tous les autres, dont l'avis devient sans objet.
    """
    if document.statut != StatutDocument.EN_VALIDATION:
        raise ValidationError({"statut": "Ce document n'est pas en cours de validation."})

    etape = etape_decidable_par(document, user)
    if etape is None:
        raise PermissionDenied("Aucune etape de ce dossier ne vous revient.")

    etape.decision = Decision.APPROUVE if approuve else Decision.REJETE
    etape.decide_par = user
    etape.date_decision = timezone.now()
    etape.commentaire = commentaire
    etape.save(
        update_fields=["decision", "decide_par", "date_decision", "commentaire", "modifie_le"]
    )

    decisive = etape_decisive(document)
    tranche = decisive is not None and decisive.pk == etape.pk

    if not approuve:
        # Un refus n'arrete le dossier que s'il engage : une etape de decision,
        # ou l'etape decisive du circuit. Un avis defavorable est consigne et
        # le dossier poursuit sa route vers celui qui tranche.
        if etape.nature == NatureEtape.DECISION or tranche:
            return _clore(document, approuve=False, commentaire=commentaire)
        if document.etapes.filter(decision=Decision.EN_ATTENTE).exists():
            return document
        return _clore(document, approuve=False, commentaire=commentaire)

    if tranche:
        return _clore(document, approuve=True)

    if document.etapes.filter(decision=Decision.EN_ATTENTE).exists():
        return document

    # Plus personne n'est attendu : le circuit se conclut sur les avis rendus.
    refuse = document.etapes.filter(decision=Decision.REJETE).exists()
    return _clore(document, approuve=not refuse, commentaire=commentaire if refuse else "")


def documents_en_attente_de(model, user):
    """Filtre un queryset de documents sur ceux attendant une decision de ``user``."""
    queryset = model.objects.filter(statut=StatutDocument.EN_VALIDATION)
    ids = [
        document.pk
        for document in queryset.prefetch_related("etapes")
        if etape_decidable_par(document, user) is not None
    ]
    return model.objects.filter(pk__in=ids)
