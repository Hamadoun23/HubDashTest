"""Ce qu'un ViewSet de document validable partage avec tous les autres.

Deux briques, a poser dans cet ordre :

    class DemandeAbsenceViewSet(PerimetreMixin, CirculationMixin, ModelViewSet):
        roles_globaux = {"gestionnaire", "direction"}

`PerimetreMixin` decide **ce que l'on voit**, `CirculationMixin` **ce que l'on
peut faire**. Les deux se lisent ensemble : un valideur n'est ni le demandeur
ni forcement son responsable, et les actions de circulation echappent donc au
filtrage par perimetre — l'habilitation reelle y est verifiee etape par etape.
"""

from django.db.models import Q
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from gdahub_common.constantes import StatutDocument
from gdahub_common.validation import annuaire
from gdahub_common.validation.moteur import (
    decider,
    documents_en_attente_de,
    raison_verrou,
    rejouer_circuit,
    soumettre,
)
from gdahub_common.validation.serializers import DecisionSerializer


class PerimetreMixin:
    """Restreint les donnees a l'agent, a son equipe, ou a tout pour le back-office.

    C'est la brique qui materialise la contrainte de confidentialite : un agent
    ne voit que ses propres dossiers, un encadrant ceux de son equipe, et seuls
    les roles listes dans `roles_globaux` accedent a l'ensemble.

    L'appartenance a une equipe se lit sur le dossier lui-meme — le responsable
    du demandeur y a ete recopie a la creation. Aucun appel a l'annuaire n'est
    donc necessaire pour afficher une liste, et un changement de rattachement
    ne fait pas disparaitre l'historique d'un encadrant.
    """

    roles_globaux: frozenset = frozenset()
    #: Actions pour lesquelles le filtrage par perimetre ne s'applique pas.
    actions_sans_perimetre: tuple = ()

    def filtrer_perimetre(self, queryset):
        utilisateur = self.request.user
        if utilisateur.est_superadmin or utilisateur.a_role(*self.roles_globaux):
            return queryset
        portee = Q(demandeur_identifiant=utilisateur.identifiant)
        # Encadrant de fait : des dossiers le designent comme responsable.
        portee |= Q(responsable_identifiant=utilisateur.identifiant)
        return queryset.filter(portee)

    def get_queryset(self):
        queryset = super().get_queryset()
        exemptions = set(self.actions_sans_perimetre) | set(
            getattr(self, "ACTIONS_CIRCULATION", ())
        )
        if self.action in exemptions:
            return queryset
        return self.filtrer_perimetre(queryset)


class CirculationMixin:
    """Ajoute les actions de circulation a un ViewSet de document validable.

    Routes exposees :

        POST /<ressource>/<id>/soumettre
        POST /<ressource>/<id>/valider
        POST /<ressource>/<id>/rejeter
        POST /<ressource>/<id>/annuler
        GET  /<ressource>/a-valider
        GET  /<ressource>/mes-demandes
    """

    #: Actions ou le perimetre est remplace par le controle du circuit.
    ACTIONS_CIRCULATION = ("a_valider", "valider", "rejeter")

    def perform_create(self, serializer):
        """Recopie l'instantane du demandeur, puis enregistre.

        C'est le seul moment ou ce service interroge l'annuaire. Si celui-ci
        ne repond pas, la creation echoue avec un message clair plutot que de
        produire un dossier sans demandeur ni valideur.
        """
        contexte = annuaire.contexte_du_demandeur(self.request.user)
        document = serializer.save()
        document.appliquer_contexte(contexte)
        document.save()

    def _verifier_main_du_demandeur(self, document, verbe):
        """Le dossier est-il encore entre les mains de celui qui l'a depose ?

        Une demande appartient a son auteur, et a lui seul : ni son
        responsable ni le back-office ne corrigent ni ne retirent une demande
        a sa place — ils la valident ou la rejettent, ce qui laisse une trace.
        La direction fait exception, comme pour l'annulation.
        """
        utilisateur = self.request.user
        if document.demandeur_identifiant != utilisateur.identifiant and not (
            utilisateur.a_role("direction") or utilisateur.est_superadmin
        ):
            raise PermissionDenied(f"Seul le demandeur peut {verbe} sa demande.")
        raison = raison_verrou(document)
        if raison:
            raise ValidationError({"statut": raison})

    def perform_update(self, serializer):
        document = serializer.instance
        self._verifier_main_du_demandeur(document, "modifier")
        document = serializer.save()
        if document.statut == StatutDocument.EN_VALIDATION:
            rejouer_circuit(document, self.request.user.roles)

    def perform_destroy(self, instance):
        # Suppression reelle, et non passage en « annule » : un dossier sur
        # lequel personne ne s'est prononce n'a rien laisse a auditer. Des
        # qu'un responsable a tranche, le verrou ci-dessus interdit ce geste
        # et la piste d'audit reste intacte.
        self._verifier_main_du_demandeur(instance, "supprimer")
        instance.delete()

    @action(detail=True, methods=["post"])
    def soumettre(self, requete, pk=None):
        document = soumettre(self.get_object(), requete.user)
        return Response(self.get_serializer(document).data)

    @action(detail=True, methods=["post"])
    def valider(self, requete, pk=None):
        return self._decider(requete, approuve=True)

    @action(detail=True, methods=["post"])
    def rejeter(self, requete, pk=None):
        return self._decider(requete, approuve=False)

    def _decider(self, requete, approuve):
        formulaire = DecisionSerializer(data=requete.data)
        formulaire.is_valid(raise_exception=True)
        commentaire = formulaire.validated_data["commentaire"]
        if not approuve and not commentaire:
            raise ValidationError(
                {"commentaire": "Le motif de rejet est obligatoire."}
            )
        document = decider(self.get_object(), requete.user, approuve, commentaire)
        return Response(self.get_serializer(document).data)

    @action(detail=True, methods=["post"])
    def annuler(self, requete, pk=None):
        document = self.get_object()
        utilisateur = requete.user
        if document.demandeur_identifiant != utilisateur.identifiant and not (
            utilisateur.a_role("direction") or utilisateur.est_superadmin
        ):
            raise PermissionDenied("Seul le demandeur peut annuler sa demande.")
        if document.statut in {StatutDocument.APPROUVE, StatutDocument.CLOTURE}:
            raise ValidationError(
                {"statut": "Document deja approuve : annulation impossible."}
            )
        document.statut = StatutDocument.ANNULE
        document.save(update_fields=["statut", "modifie_le"])
        return Response(self.get_serializer(document).data)

    @action(detail=False, methods=["get"], url_path="a-valider")
    def a_valider(self, requete):
        queryset = documents_en_attente_de(self.queryset.model, requete.user)
        return self._page(queryset)

    @action(detail=False, methods=["get"], url_path="mes-demandes")
    def mes_demandes(self, requete):
        queryset = self.queryset.filter(
            demandeur_identifiant=requete.user.identifiant
        )
        return self._page(queryset)

    def _page(self, queryset):
        page = self.paginate_queryset(queryset)
        if page is not None:
            return self.get_paginated_response(self.get_serializer(page, many=True).data)
        return Response(self.get_serializer(queryset, many=True).data)
