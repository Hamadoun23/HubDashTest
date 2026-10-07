from django.db.models import Q
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.response import Response

from core.constants import Role, StatutDocument
from django.utils import timezone

from core.echanges import (
    Type,
    attendus,
    etapes_en_attente,
    prochaine_relance,
    valideurs_en_attente,
    comparer,
    consigner,
    est_en_attente,
    evenements,
    instantane,
    peut_consulter,
    prevenir,
    valideurs_concernes,
)
from core.serializers import DecisionSerializer
from core.workflow import (
    decider,
    documents_en_attente_de,
    etape_decidable_par,
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
        exemptions = (
            set(self.actions_sans_perimetre)
            | set(getattr(self, "ACTIONS_CIRCULATION", ()))
            | set(getattr(self, "ACTIONS_DOSSIER", ()))
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
    #: Detail et echanges : ouverts au demandeur et aux valideurs du circuit,
    #: controles par `_dossier_accessible` plutot que par le perimetre (un
    #: valideur n'est ni le demandeur ni forcement son manager).
    ACTIONS_DOSSIER = ("dossier", "echanger", "mettre_en_attente", "reprendre", "relancer")

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
        attendait = est_en_attente(document)
        document = serializer.save()
        if document.statut == StatutDocument.EN_VALIDATION:
            rejouer_circuit(document)
            # Correction en cours de validation : nouvelle version, et le
            # dossier mis en attente repart vers ses valideurs.
            consigner(document, Type.MODIFICATION, auteur=self.request.user, versionner=True)
            if attendait:
                consigner(document, Type.REPRISE, auteur=self.request.user, texte="Dossier complete par le demandeur.")
            prevenir(
                document,
                self.request.user,
                "Dossier modifie",
                "Le demandeur a mis a jour son dossier.",
                list(valideurs_concernes(document)),
            )

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

    # --- Detail du dossier, echanges, mise en attente --------------------

    def _dossier_accessible(self):
        document = self.get_object()
        user = self.request.user
        dans_perimetre = (
            hasattr(self, "filtrer_perimetre")
            and self.filtrer_perimetre(type(document).objects.filter(pk=document.pk)).exists()
        )
        if not (dans_perimetre or peut_consulter(document, user)):
            raise NotFound()
        return document

    @action(detail=True, methods=["get"])
    def dossier(self, request, pk=None):
        """Tout ce que montre la page de detail : dossier, circuit, fil, versions."""
        document = self._dossier_accessible()
        return Response(self._etat_dossier(document))

    def _etat_dossier(self, document):
        user = self.request.user
        journal = list(evenements(document))
        versions, precedente = [], None
        for evt in journal:
            if evt.version:
                versions.append(
                    {
                        "numero": evt.version,
                        "date": evt.cree_le,
                        "auteur": evt.auteur.get_full_name() if evt.auteur else "",
                        "type": evt.type,
                        "champs": evt.instantane or {},
                        "changements": comparer(precedente, evt.instantane) if precedente is not None else [],
                    }
                )
                precedente = evt.instantane
        mon_etape = etape_decidable_par(document, user) if document.statut == StatutDocument.EN_VALIDATION else None
        decidable = mon_etape is not None
        en_attente = est_en_attente(document)
        est_demandeur = document.demandeur_id == user.id
        suivante = prochaine_relance(document)
        relancable = (
            est_demandeur
            and document.statut == StatutDocument.EN_VALIDATION
            and not en_attente
            and bool(etapes_en_attente(document))
        )
        return {
            "type_libelle": str(type(document)._meta.verbose_name).capitalize(),
            "document": self.get_serializer(document).data,
            "resume": [v for v in instantane(document).values() if v["valeur"] not in ("", None)],
            "evenements": [
                {
                    "id": evt.id,
                    "type": evt.type,
                    "type_libelle": evt.get_type_display(),
                    "auteur": evt.auteur.get_full_name() if evt.auteur else "",
                    "auteur_id": evt.auteur_id,
                    "texte": evt.texte,
                    "contexte": evt.contexte,
                    "version": evt.version,
                    "date": evt.cree_le,
                }
                for evt in journal
            ],
            "versions": versions,
            "en_attente": en_attente,
            "est_demandeur": document.demandeur_id == user.id,
            "peut_decider": decidable,
            # Avis (n'engage pas) ou décision (clôt le dossier) : l'écran adapte ses boutons.
            "mon_etape": {"libelle": mon_etape.libelle, "nature": mon_etape.nature} if mon_etape else None,
            "peut_mettre_en_attente": decidable and not en_attente,
            "peut_reprendre": en_attente and (decidable or document.demandeur_id == user.id),
            "peut_ecrire": document.statut != StatutDocument.ANNULE,
            # Qui doit encore se prononcer, et la relance par le demandeur.
            "attendus": attendus(document) if document.statut == StatutDocument.EN_VALIDATION else [],
            "peut_relancer": relancable and suivante is None,
            "prochaine_relance": suivante if relancable else None,
        }

    def _texte(self, request, champ="texte", obligatoire=True, message="Ecrivez un message."):
        texte = str(request.data.get(champ, "") or "").strip()
        if obligatoire and not texte:
            raise ValidationError({champ: message})
        if len(texte) > 4000:
            raise ValidationError({champ: "4000 caracteres au plus."})
        return texte

    @action(detail=True, methods=["post"])
    def echanger(self, request, pk=None):
        """Message dans le fil du dossier (demandeur ou valideur)."""
        document = self._dossier_accessible()
        if document.statut == StatutDocument.ANNULE:
            raise ValidationError({"statut": "Ce dossier est annule."})
        texte = self._texte(request)
        user = request.user
        attendait = est_en_attente(document)
        consigner(document, Type.MESSAGE, auteur=user, texte=texte)
        if document.demandeur_id == user.id:
            # La reponse du demandeur remet le dossier entre les mains des valideurs.
            if attendait:
                consigner(document, Type.REPRISE, auteur=user, texte="Reponse du demandeur.")
            cibles = list(valideurs_concernes(document))
        else:
            cibles = [document.demandeur] + [
                evt.auteur for evt in evenements(document).filter(type=Type.MESSAGE) if evt.auteur
            ]
        prevenir(document, user, f"Message de {user.get_full_name()}", texte, cibles)
        return Response(self._etat_dossier(document))

    @action(detail=True, methods=["post"], url_path="mettre-en-attente")
    def mettre_en_attente(self, request, pk=None):
        """« Pas encore » : observation ou complement demande au demandeur."""
        document = self._dossier_accessible()
        if document.statut != StatutDocument.EN_VALIDATION or etape_decidable_par(document, request.user) is None:
            raise PermissionDenied("Aucune etape de ce dossier ne vous revient.")
        if est_en_attente(document):
            raise ValidationError({"statut": "Ce dossier est deja en attente."})
        motif = self._texte(request, "motif", message="Precisez ce que vous attendez du demandeur.")
        consigner(document, Type.MISE_EN_ATTENTE, auteur=request.user, texte=motif)
        prevenir(document, request.user, "Dossier mis en attente", motif, [document.demandeur])
        return Response(self._etat_dossier(document))

    @action(detail=True, methods=["post"])
    def reprendre(self, request, pk=None):
        """Leve la mise en attente (valideur, ou demandeur qui a complete)."""
        document = self._dossier_accessible()
        user = request.user
        if not est_en_attente(document):
            raise ValidationError({"statut": "Ce dossier n'est pas en attente."})
        if document.demandeur_id != user.id and etape_decidable_par(document, user) is None:
            raise PermissionDenied("Vous ne pouvez pas reprendre ce dossier.")
        texte = self._texte(request, obligatoire=False)
        consigner(document, Type.REPRISE, auteur=user, texte=texte)
        cibles = list(valideurs_concernes(document)) if document.demandeur_id == user.id else [document.demandeur]
        prevenir(document, user, "Dossier repris", texte or "Le dossier reprend son circuit de validation.", cibles)
        return Response(self._etat_dossier(document))

    @action(detail=True, methods=["post"])
    def relancer(self, request, pk=None):
        """Le demandeur relance les valideurs qui ne se sont pas encore prononces."""
        document = self._dossier_accessible()
        user = request.user
        if document.demandeur_id != user.id:
            raise PermissionDenied("Seul le demandeur peut relancer son dossier.")
        if document.statut != StatutDocument.EN_VALIDATION:
            raise ValidationError({"statut": "Ce dossier n'est plus en cours de validation."})
        if est_en_attente(document):
            raise ValidationError({"statut": "Un valideur attend votre complement : repondez dans le fil."})
        suivante = prochaine_relance(document)
        if suivante is not None:
            raise ValidationError(
                {"statut": f"Relance deja envoyee : nouvelle relance possible apres le {timezone.localtime(suivante):%d/%m a %H:%M}."}
            )
        cibles = list(valideurs_en_attente(document))
        if not cibles:
            raise ValidationError({"statut": "Personne n'est attendu sur ce dossier."})
        texte = self._texte(request, obligatoire=False)
        consigner(document, Type.RELANCE, auteur=user, texte=texte)
        prevenir(
            document,
            user,
            f"Relance de {user.get_full_name()}",
            texte or "Ce dossier attend toujours votre decision.",
            cibles,
        )
        return Response(self._etat_dossier(document))

    @action(detail=False, methods=["get"], url_path="a-valider")
    def a_valider(self, request):
        queryset = documents_en_attente_de(self.queryset.model, request.user)
        page = self.paginate_queryset(queryset)
        serializer = self.get_serializer(page if page is not None else queryset, many=True)
        if page is not None:
            return self.get_paginated_response(serializer.data)
        return Response(serializer.data)
