"""
Le partenaire courant — le client de GDA dont on regarde les données.

Un administrateur pilote les campagnes de plusieurs banques. Il en choisit une
à la connexion ; ce choix vit en session et borne tout ce qu'il voit ensuite.
Un commercial, lui, n'a pas de choix à faire : son partenaire est celui de son
compte, et il ne peut pas en sortir.

Les trois fonctions `filtrer_*` sont le point de passage obligé des vues : une
requête qui ne passe pas par elles mélangerait les données des deux clients.
"""

from .models import Partenaire
from django.urls import reverse_lazy

#: Clé de session portant le choix de l'administrateur.
CLE_SESSION = "partenaire_courant_id"

#: Où l'on renvoie un compte multi-clients qui n'a pas encore choisi.
#:
#: Resolue et non ecrite en dur : servie sous un chemin — /bdm/ derriere la
#: passerelle de GDA Hub — une adresse absolue sortirait du perimetre de
#: l'application et tomberait sur la coquille du hub. `reverse` y ajoute le
#: prefixe que porte FORCE_SCRIPT_NAME, et ne fait rien a la racine.
URL_CHOIX = reverse_lazy("partenaires.choix")


def partenaires_accessibles(user):
    """Partenaires que ce compte a le droit de consulter, dans l'ordre d'affichage."""
    if user is None or not user.is_authenticated:
        return []
    if user.choisit_son_partenaire:
        return list(Partenaire.objects.filter(actif=True))
    if user.partenaire_id:
        return list(Partenaire.objects.filter(pk=user.partenaire_id))
    return []


def partenaire_courant(request):
    """
    Partenaire sous lequel la requête est servie, ou `None`.

    Pour un commercial, c'est celui de son compte — la session n'entre pas en
    jeu. Pour un administrateur, c'est son choix, revalidé à chaque requête :
    un partenaire désactivé entre-temps ne doit pas rester sélectionné.
    """
    user = getattr(request, "user", None)
    if user is None or not user.is_authenticated:
        return None

    if not user.choisit_son_partenaire:
        return user.partenaire if user.partenaire_id else None

    identifiant = request.session.get(CLE_SESSION)
    if not identifiant:
        return None

    partenaire = Partenaire.objects.filter(pk=identifiant, actif=True).first()
    if partenaire is None:
        request.session.pop(CLE_SESSION, None)
    return partenaire


def definir_partenaire(request, partenaire):
    request.session[CLE_SESSION] = int(partenaire.id)


# ---------------------------------------------------------------------------
# Restriction des requêtes
# ---------------------------------------------------------------------------


def filtrer_campagnes(queryset, partenaire):
    if partenaire is None:
        return queryset
    return queryset.filter(partenaire_id=partenaire.id)


def filtrer_agences(queryset, partenaire):
    if partenaire is None:
        return queryset
    if not partenaire.a_des_agences:
        return queryset.none()
    return queryset.filter(partenaire_id=partenaire.id)


def filtrer_users(queryset, partenaire):
    """
    Restreint aux comptes du partenaire.

    Les administrateurs n'ont pas de partenaire : ils n'apparaissent dans
    aucune des deux listes, ce qui est le comportement attendu — l'écran
    « Utilisateurs » ne gère de toute façon que commerciaux et direction.
    """
    if partenaire is None:
        return queryset
    return queryset.filter(partenaire_id=partenaire.id)


def filtrer_types_cartes(queryset, partenaire):
    """
    Restreint le catalogue de cartes au partenaire, en gardant les cartes
    communes (celles qui n'en désignent aucun).
    """
    if partenaire is None:
        return queryset
    from django.db.models import Q

    return queryset.filter(
        Q(partenaire_id=partenaire.id) | Q(partenaire_id__isnull=True)
    )


def filtrer_saisies(queryset, partenaire):
    """
    Restreint une requête sur des données terrain — ventes, enrôlements,
    clients, fiches téléphoniques — au partenaire courant.

    Le rattachement passe par le commercial qui a saisi, et non par la
    campagne : une vente peut avoir perdu sa campagne (`ON DELETE SET NULL`),
    jamais son auteur. Toutes ces tables portent `user_id`.
    """
    if partenaire is None:
        return queryset
    return queryset.filter(user__partenaire_id=partenaire.id)
