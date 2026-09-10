from django.db.models import Q
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from core.constants import Role, StatutDocument
from core.serializers import DecisionSerializer
from core.workflow import (
    decider,
    documents_en_attente_de,
    raison_verrou,
    rejouer_circuit,
    soumettre,
)


class PerimetreMixin:
    """Restreint les donnees a l'agent, a son equipe, ou a tout pour le back-office.

    C'est la brique qui materialise la contrainte de confidentialite : un agent
    ne voit que ses propres dossiers, un manager ceux de son equipe, et seuls
    les roles listes dans ``roles_globaux`` accedent a l'ensemble du perimetre.
    """

    champ_agent = "demandeur"
    roles_globaux = frozenset()
    #: Actions pour lesquelles le filtrage par perimetre ne s'applique pas.
    actions_sans_perimetre = ()

    def filtrer_perimetre(self, queryset):
        user = self.request.user
        if user.role in self.roles_globaux:
            return queryset
        portee = Q(**{self.champ_agent: user})
        # Encadrant de fait : des agents lui sont rattaches hierarchiquement.
        if user.equipe.exists():
            portee |= Q(**{f"{self.champ_agent}__manager": user})
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
      * ``POST   /<ressource>/<id>/soumettre/``
      * ``POST   /<ressource>/<id>/valider/``
      * ``POST   /<ressource>/<id>/rejeter/``
      * ``POST   /<ressource>/<id>/annuler/``
      * ``GET    /<ressource>/a-valider/``

    Ces actions doivent echapper au filtrage par perimetre : un valideur n'est
    ni le demandeur ni forcement son manager. L'habilitation reelle est
    verifiee etape par etape par ``EtapeValidation.peut_etre_decidee_par``.
    """

    #: Actions ou le perimetre est remplace par le controle du circuit.
    ACTIONS_CIRCULATION = ("a_valider", "valider", "rejeter")

    def perform_create(self, serializer):
        serializer.save(demandeur=self.request.user)

    def _verifier_main_du_demandeur(self, document, verbe):
        """Le dossier est-il encore entre les mains de celui qui l'a depose ?

        Une demande appartient a son auteur, et a lui seul : ni son
        responsable ni le back-office ne corrigent ni ne retirent une demande
        a sa place — ils la valident ou la rejettent, ce qui laisse une trace.
        La Direction fait exception, comme pour l'annulation.
        """
        user = self.request.user
        if document.demandeur_id != user.id and user.role != Role.DIRECTION:
            raise PermissionDenied(f"Seul le demandeur peut {verbe} sa demande.")
        raison = raison_verrou(document)
        if raison:
            raise ValidationError({"statut": raison})

    def perform_update(self, serializer):
        document = serializer.instance
        self._verifier_main_du_demandeur(document, "modifier")
        document = serializer.save()
        if document.statut == StatutDocument.EN_VALIDATION:
            rejouer_circuit(document)

    def perform_destroy(self, instance):
        # Suppression reelle, et non passage en « annule » : un dossier sur
        # lequel personne ne s'est prononce n'a rien laisse a auditer. Des
        # qu'un responsable a tranche, le verrou ci-dessus interdit ce geste
        # et la piste d'audit reste intacte.
        self._verifier_main_du_demandeur(instance, "supprimer")
        instance.delete()

    @action(detail=True, methods=["post"])
    def soumettre(self, request, pk=None):
        document = soumettre(self.get_object(), request.user)
        return Response(self.get_serializer(document).data)

    @action(detail=True, methods=["post"])
    def valider(self, request, pk=None):
        return self._decider(request, approuve=True)

    @action(detail=True, methods=["post"])
    def rejeter(self, request, pk=None):
        return self._decider(request, approuve=False)

    def _decider(self, request, approuve):
        payload = DecisionSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        commentaire = payload.validated_data["commentaire"]
        if not approuve and not commentaire:
            raise ValidationError({"commentaire": "Le motif de rejet est obligatoire."})
        document = decider(self.get_object(), request.user, approuve, commentaire)
        return Response(self.get_serializer(document).data)

    @action(detail=True, methods=["post"])
    def annuler(self, request, pk=None):
        document = self.get_object()
        if document.demandeur_id != request.user.id and request.user.role != Role.DIRECTION:
            raise PermissionDenied("Seul le demandeur peut annuler sa demande.")
        if document.statut in {StatutDocument.APPROUVE, StatutDocument.CLOTURE}:
            raise ValidationError({"statut": "Document deja approuve : annulation impossible."})
        document.statut = StatutDocument.ANNULE
        document.save(update_fields=["statut", "modifie_le"])
        return Response(self.get_serializer(document).data)

    @action(detail=False, methods=["get"], url_path="a-valider")
    def a_valider(self, request):
        queryset = documents_en_attente_de(self.queryset.model, request.user)
        page = self.paginate_queryset(queryset)
        serializer = self.get_serializer(page if page is not None else queryset, many=True)
        if page is not None:
            return self.get_paginated_response(serializer.data)
        return Response(serializer.data)
