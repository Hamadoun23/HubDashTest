"""Le moteur de validation.

Repris de FinanceRH/backend/core/workflow.py, ou il a fait ses preuves en
production. Deux differences, toutes deux dues au decoupage en services :

- le valideur est designe par son **identifiant de connexion**, seule cle
  commune a identity, organisation et aux services metier ;
- le responsable du demandeur n'est plus lu dans l'annuaire a chaque calcul :
  il a ete recopie sur le dossier a sa creation.

Une troisieme difference tient a la separation des roles par application. Dans
l'application d'origine, on savait quel role portait le responsable d'un agent,
et l'on pouvait donc supprimer d'avance l'etape « service financier » quand ce
responsable etait lui-meme le financier. Ce n'est plus possible : les
habilitations vivent chez identity. On procede donc a l'envers, et c'est plus
juste : **une seule decision regle toutes les etapes que son auteur pouvait
trancher**, chacune restant consignee separement. Le responsable qui porte
aussi le role financier n'est sollicite qu'une fois, et le journal montre a
quel titre il s'est prononce.
"""

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from gdahub_common.constantes import (
    STATUTS_TRANCHES,
    Decision,
    NatureEtape,
    StatutDocument,
    TypeDocument,
)
from gdahub_common.validation.models import EtapeValidation, RegleCircuit


def regles_applicables(type_document, montant):
    """Les regles a appliquer, triees par ordre."""
    regles = RegleCircuit.objects.filter(actif=True).filter(
        Q(type_document=type_document) | Q(type_document=TypeDocument.TOUS)
    )
    return sorted(
        (regle for regle in regles if regle.couvre(montant)),
        key=lambda regle: (regle.ordre, regle.montant_min),
    )


def _valideur_resolu(regle, document) -> tuple[str, str]:
    """La personne visee par la regle : (identifiant, nom).

    Ordre de priorite : la personne nommee l'emporte sur le responsable du
    demandeur, qui l'emporte sur le role. Sans personne resolue, l'etape
    revient a quiconque porte `role_valideur` — c'est aussi le repli d'une
    etape hierarchique dont le demandeur n'a pas de responsable.
    """
    if regle.valideur_identifiant:
        return regle.valideur_identifiant, regle.valideur_nom
    if regle.valideur_hierarchique:
        return document.responsable_identifiant, document.responsable_nom
    return "", ""


#: Du moins engageant au plus engageant. Sert a departager deux etapes qui
#: retombent sur la meme personne.
POIDS_NATURE = {
    NatureEtape.INFORMATION: 0,
    NatureEtape.AVIS: 1,
    NatureEtape.DECISION: 2,
}


def _regles_dedoublonnees(regles, document, roles_du_demandeur=()):
    """Ecarte les etapes qui retomberaient sur un intervenant deja sollicite.

    Le responsable d'un agent est souvent aussi le directeur cite plus loin
    dans le circuit : sans ce filtre, la meme personne devrait se prononcer
    deux fois sur le meme dossier.

    Entre deux etapes visant la meme personne, on retient **la plus
    engageante** ; a nature egale, **la plus precoce**. Un responsable direct
    se prononce donc des la premiere etape, avant les services transverses,
    tandis qu'un directeur qui tranche en dernier ressort garde sa place a la
    fin du circuit : sa decision ne remonte jamais au debut.

    `roles_du_demandeur` vient de son jeton : une etape qui viserait le role
    qu'il porte lui-meme est ecartee, personne ne se validant soi-meme.
    """
    demandeur = document.demandeur_identifiant
    roles_du_demandeur = set(roles_du_demandeur)

    candidats = []
    for regle in regles:
        identifiant, nom = _valideur_resolu(regle, document)
        if identifiant and identifiant == demandeur:
            continue
        if not identifiant and regle.role_valideur in roles_du_demandeur:
            continue
        candidats.append((regle, identifiant, nom))

    def meilleure(gauche, droite):
        """La plus engageante des deux ; a egalite, la plus precoce."""
        if POIDS_NATURE[droite[0].nature] > POIDS_NATURE[gauche[0].nature]:
            return droite
        return gauche

    par_personne: dict[str, tuple] = {}
    par_role: dict[str, tuple] = {}

    for candidat in candidats:
        regle, identifiant, _ = candidat
        if identifiant:
            precedent = par_personne.get(identifiant)
            par_personne[identifiant] = (
                candidat if precedent is None else meilleure(precedent, candidat)
            )
        else:
            precedent = par_role.get(regle.role_valideur)
            par_role[regle.role_valideur] = (
                candidat if precedent is None else meilleure(precedent, candidat)
            )

    retenues = [*par_personne.values(), *par_role.values()]
    retenues.sort(key=lambda candidat: (candidat[0].ordre, candidat[0].montant_min))
    return retenues


@transaction.atomic
def construire_circuit(document, roles_du_demandeur=()):
    """(Re)genere les etapes de validation d'un document."""
    document.etapes.all().delete()
    regles = regles_applicables(document.TYPE_DOCUMENT, document.montant_controle)

    etapes = []
    for position, (regle, identifiant, nom) in enumerate(
        _regles_dedoublonnees(regles, document, roles_du_demandeur), start=1
    ):
        information = regle.nature == NatureEtape.INFORMATION
        etapes.append(
            EtapeValidation(
                document=document,
                ordre=position,
                libelle=regle.libelle,
                role_valideur=regle.role_valideur,
                valideur_identifiant=identifiant,
                valideur_nom=nom,
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
def soumettre(document, utilisateur):
    """Soumet un document au circuit de validation."""
    if document.statut not in {StatutDocument.BROUILLON, StatutDocument.REJETE}:
        raise ValidationError(
            {"statut": "Seul un document en brouillon ou rejete peut etre soumis."}
        )
    if document.demandeur_identifiant != utilisateur.identifiant and not utilisateur.a_role(
        "direction"
    ):
        raise PermissionDenied("Vous n'etes pas le demandeur de ce document.")

    etapes = construire_circuit(document, utilisateur.roles)
    document.motif_rejet = ""
    document.date_soumission = timezone.now()
    document.statut = (
        StatutDocument.EN_VALIDATION if etapes else StatutDocument.APPROUVE
    )
    document.save(
        update_fields=["statut", "date_soumission", "motif_rejet", "modifie_le"]
    )
    if not etapes:
        # Aucune regle pour ce type et ce montant : approbation directe.
        _declencher(document)
    return document


def _declencher(document):
    """Execute l'effet metier d'une approbation, si le document en a un."""
    effet = getattr(document, "apres_approbation", None)
    if callable(effet):
        effet()


def raison_verrou(document):
    """Ce qui empeche le demandeur de corriger ou de retirer son dossier.

    Retourne le motif a afficher, ou `None` si la demande lui appartient
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
    quiconque agisse : elle ne porte pas de decideur et ne verrouille donc pas
    le dossier. C'est bien un geste humain que l'on guette.
    """
    if document.statut in STATUTS_TRANCHES:
        return (
            f"Ce dossier est {document.get_statut_display().lower()} : "
            "il n'est plus modifiable."
        )
    # `all()` plutot qu'un `filter().exists()` : les vues prechargent les
    # etapes, et un filtre sur le manager relance une requete par dossier —
    # soit une cinquantaine sur une simple liste.
    if any(etape.decide_par_identifiant for etape in document.etapes.all()):
        return (
            "Un responsable s'est deja prononce sur ce dossier : "
            "il n'est plus modifiable."
        )
    return None


@transaction.atomic
def rejouer_circuit(document, roles_du_demandeur=()):
    """Reconstruit le circuit d'un dossier corrige avant toute decision.

    Le montant commande le routage : une demande revue de 50 000 a 5 000 000
    doit passer devant les valideurs que son nouveau montant appelle. Comme
    personne ne s'est encore prononce, rien n'est perdu a repartir de zero.
    """
    if not construire_circuit(document, roles_du_demandeur):
        # Plus aucune regle ne couvre le nouveau montant : approbation
        # directe, exactement comme a la soumission.
        document.statut = StatutDocument.APPROUVE
        document.save(update_fields=["statut", "modifie_le"])
        _declencher(document)
    return document


def etape_decisive(document):
    """L'etape qui clot le dossier.

    C'est la derniere etape de nature `DECISION` du circuit — celle qui a le
    dernier mot. A defaut, la derniere etape tout court : un circuit qui ne
    comporte que des avis se conclut sur le dernier d'entre eux, sans quoi
    personne ne trancherait jamais.
    """
    etapes = list(document.etapes.all())
    if not etapes:
        return None
    decisions = [etape for etape in etapes if etape.nature == NatureEtape.DECISION]
    return max(decisions or etapes, key=lambda etape: etape.ordre)


def etapes_decidables_par(document, utilisateur):
    """Toutes les etapes en attente que `utilisateur` peut trancher.

    Il y en a plusieurs quand une meme personne cumule les titres — le
    responsable d'un agent qui est aussi le responsable financier. Elles se
    reglent alors d'un seul geste, et restent consignees separement.
    """
    return [
        etape
        for etape in document.etapes.filter(decision=Decision.EN_ATTENTE).order_by("ordre")
        if etape.peut_etre_decidee_par(utilisateur, document)
    ]


def etape_decidable_par(document, utilisateur):
    """La premiere etape en attente que `utilisateur` peut trancher."""
    etapes = etapes_decidables_par(document, utilisateur)
    return etapes[0] if etapes else None


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
        _declencher(document)
    return document


@transaction.atomic
def decider(document, utilisateur, approuve: bool, commentaire: str = ""):
    """Enregistre la decision de `utilisateur` sur les etapes qui lui reviennent.

    Tous les decideurs d'un circuit peuvent se prononcer en parallele, dans
    l'ordre qu'ils veulent. Le dossier se clot des que l'etape decisive tombe :
    si le Directeur General accorde en premier, la demande est approuvee et
    disparait des files de tous les autres, dont l'avis devient sans objet.
    """
    if document.statut != StatutDocument.EN_VALIDATION:
        raise ValidationError(
            {"statut": "Ce document n'est pas en cours de validation."}
        )

    etapes = etapes_decidables_par(document, utilisateur)
    if not etapes:
        raise PermissionDenied("Aucune etape de ce dossier ne vous revient.")

    maintenant = timezone.now()
    for etape in etapes:
        etape.decision = Decision.APPROUVE if approuve else Decision.REJETE
        etape.decide_par_identifiant = utilisateur.identifiant
        etape.decide_par_nom = utilisateur.nom_complet or utilisateur.identifiant
        etape.date_decision = maintenant
        etape.commentaire = commentaire
        etape.save(
            update_fields=[
                "decision",
                "decide_par_identifiant",
                "decide_par_nom",
                "date_decision",
                "commentaire",
                "modifie_le",
            ]
        )

    decisive = etape_decisive(document)
    tranche = decisive is not None and any(etape.pk == decisive.pk for etape in etapes)

    if not approuve:
        # Un refus n'arrete le dossier que s'il engage : une etape de decision,
        # ou l'etape decisive du circuit. Un avis defavorable est consigne et
        # le dossier poursuit sa route vers celui qui tranche.
        engage = tranche or any(
            etape.nature == NatureEtape.DECISION for etape in etapes
        )
        if engage:
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
    return _clore(
        document, approuve=not refuse, commentaire=commentaire if refuse else ""
    )


def documents_en_attente_de(modele, utilisateur):
    """Les documents d'un modele qui attendent une decision de `utilisateur`."""
    candidats = modele.objects.filter(
        statut=StatutDocument.EN_VALIDATION
    ).prefetch_related("etapes")
    identifiants = [
        document.pk
        for document in candidats
        if etapes_decidables_par(document, utilisateur)
    ]
    return modele.objects.filter(pk__in=identifiants)
