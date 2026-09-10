"""Viewsets et endpoints de l'API REST JusOrange."""
from datetime import timedelta

from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import Sum, Count
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.authtoken.models import Token
from rest_framework.decorators import (
    action, api_view, permission_classes as perm_decorator,
)
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from recolte.models import Producteur, Cueillette
from appro.models import ArticleStock, Reception
from fabrication.models import Production
from emballage.models import Conditionnement, Bouteille
from emballage.views import maj_stock_jus, creer_bouteilles_et_maj_stock
from entrepot.models import Inventaire
from distribution.models import (
    Client, Vente, Commande, Facture, Paiement, ReceptionPaiement,
)
from prospection.models import PointVente, Visite, STATUT_CHOICES

# Les rapports réutilisent les services et exports déjà écrits pour les vues
# templates : une seule implémentation, donc des chiffres cohérents partout.
from reporting.services.base import get_period_from_request
from reporting.services.recolte import get_rapport_recolte
from reporting.services.appro import get_rapport_appro
from reporting.services.fabrication import get_rapport_fabrication
from reporting.services.emballage import get_rapport_emballage
from reporting.services.entrepot import get_rapport_entrepot
from reporting.services.distribution import get_rapport_distribution
from reporting.exports import (
    export_recolte_excel,
    export_appro_excel,
    export_fabrication_excel,
    export_emballage_excel,
    export_entrepot_excel,
    export_distribution_excel,
)

from . import serializers as s
from .permissions import (
    CanProduction, CanCommercial, CanFinance, IsDirection, IsReportingViewer,
)


# =========================================================
#  Authentification
# =========================================================
class LoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        user = authenticate(username=username, password=password)
        if user is None:
            return Response({'detail': 'Identifiants invalides.'}, status=400)
        if not user.is_active:
            return Response({'detail': 'Compte désactivé.'}, status=403)
        token, _ = Token.objects.get_or_create(user=user)
        return Response({'token': token.key, 'user': _user_payload(user)})


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(_user_payload(request.user))


def _user_payload(user):
    if user.is_superuser or user.is_staff:
        roles = ['Direction', 'ResProd', 'Commercial', 'Finance']
    else:
        roles = list(user.groups.values_list('name', flat=True))
    return {
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'is_staff': user.is_staff,
        'is_superuser': user.is_superuser,
        'roles': roles,
    }


# =========================================================
#  Production (ResProd)
# =========================================================
class ProducteurViewSet(viewsets.ModelViewSet):
    queryset = Producteur.objects.all()
    serializer_class = s.ProducteurSerializer
    permission_classes = [CanProduction]


class CueilletteViewSet(viewsets.ModelViewSet):
    queryset = Cueillette.objects.select_related('producteur').all()
    serializer_class = s.CueilletteSerializer
    permission_classes = [CanProduction]


class ArticleStockViewSet(viewsets.ModelViewSet):
    """Articles de stock.

    Deux process distincts, comme dans l'interface Django :
    - « paramétrer » = créer/modifier le type, le seuil et les prix (CRUD standard) ;
    - « actualiser » = AJOUTER une quantité au stock (action dédiée ci-dessous).
    On ne remplace jamais une quantité de stock par saisie directe.
    """
    queryset = ArticleStock.objects.all()
    serializer_class = s.ArticleStockSerializer
    permission_classes = [CanProduction]

    def list(self, request, *args, **kwargs):
        # Les quantités de jus dérivent des bouteilles : on les resynchronise
        # avant d'afficher la liste, comme le fait liste_articles().
        maj_stock_jus()
        return super().list(request, *args, **kwargs)

    @action(detail=True, methods=['post'])
    def actualiser(self, request, pk=None):
        """Ajoute une quantité au stock existant (actualiser_article)."""
        article = self.get_object()
        if article.type_art in s.TYPES_AUTOGERES:
            return Response(
                {'detail': "Cet article est géré automatiquement : son stock ne "
                           "peut pas être actualisé manuellement."},
                status=400,
            )
        payload = s.ArticleActualiserSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        article.qte_art += payload.validated_data['qte_ajout']
        article.save()
        return Response(s.ArticleStockSerializer(article).data)


class ReceptionViewSet(viewsets.ModelViewSet):
    queryset = Reception.objects.select_related('cueillette').all()
    serializer_class = s.ReceptionSerializer
    permission_classes = [CanProduction]


class ProductionViewSet(viewsets.ModelViewSet):
    """Ordres de fabrication, en deux étapes comme en Django.

    Création = programmer (date + recette) → EN_COURS.
    Action « completer » = saisie des mesures → TERMINEE.
    """
    queryset = Production.objects.all()
    serializer_class = s.ProductionSerializer
    permission_classes = [CanProduction]

    def get_serializer_class(self):
        if self.action == 'create':
            return s.ProductionCreateSerializer
        return s.ProductionSerializer

    @action(detail=True, methods=['post', 'patch'])
    def completer(self, request, pk=None):
        """Complète une production programmée (completer_production)."""
        production = self.get_object()
        payload = s.ProductionCompleteSerializer(
            production, data=request.data, partial=True)
        payload.is_valid(raise_exception=True)
        payload.save()
        return Response(s.ProductionSerializer(production).data)


class ConditionnementViewSet(viewsets.ModelViewSet):
    queryset = Conditionnement.objects.select_related('production').all()
    serializer_class = s.ConditionnementSerializer
    permission_classes = [CanProduction]

    def perform_create(self, serializer):
        """Créer un conditionnement fabrique les bouteilles correspondantes.

        C'est le cœur du process : sans cela le conditionnement resterait une
        simple ligne, sans impact sur le stock (ajouter_conditionnement).
        """
        conditionnement = serializer.save()
        creer_bouteilles_et_maj_stock(conditionnement)

    def perform_destroy(self, instance):
        instance.delete()
        maj_stock_jus()


class BouteilleViewSet(viewsets.ModelViewSet):
    """Bouteilles physiques.

    Pas de création directe : une bouteille naît toujours d'un conditionnement.
    Toute modification ou suppression resynchronise le stock de jus.
    """
    queryset = Bouteille.objects.select_related('conditionnement').all()
    serializer_class = s.BouteilleSerializer
    permission_classes = [CanProduction]
    http_method_names = ['get', 'patch', 'put', 'delete', 'head', 'options']

    def perform_update(self, serializer):
        serializer.save()
        maj_stock_jus()

    def perform_destroy(self, instance):
        instance.delete()
        maj_stock_jus()


class InventaireViewSet(viewsets.ModelViewSet):
    queryset = Inventaire.objects.select_related('article', 'user').all()
    serializer_class = s.InventaireSerializer
    permission_classes = [CanProduction]

    def get_queryset(self):
        """Filtre par article pour reproduire liste_inventaires_article."""
        qs = super().get_queryset()
        article = self.request.query_params.get('article')
        if article:
            qs = qs.filter(article_id=article)
        return qs

    @action(detail=True, methods=['post', 'patch'])
    def observation(self, request, pk=None):
        """Saisie de l'observation après inventaire (modifier_observation_inventaire)."""
        inventaire = self.get_object()
        payload = s.InventaireObservationSerializer(
            inventaire, data=request.data, partial=True)
        payload.is_valid(raise_exception=True)
        payload.save()
        return Response(s.InventaireSerializer(inventaire).data)


# =========================================================
#  Commercial
# =========================================================
class ClientViewSet(viewsets.ModelViewSet):
    queryset = Client.objects.all()
    serializer_class = s.ClientSerializer
    permission_classes = [CanCommercial]


class VenteViewSet(viewsets.ModelViewSet):
    queryset = Vente.objects.select_related('client').prefetch_related(
        'commandes', 'factures', 'factures__paiements').all()
    serializer_class = s.VenteSerializer
    permission_classes = [CanCommercial]

    @action(detail=True, methods=['get'])
    def detail(self, request, pk=None):
        """Vue détaillée d'une vente : ses factures avec le reste à payer.

        Reproduit detail_vente() : c'est depuis cet écran que le commercial
        enregistre les paiements facture par facture.
        """
        vente = self.get_object()
        return Response({
            'vente': s.VenteSerializer(vente).data,
            'commandes': s.CommandeSerializer(vente.commandes.all(), many=True).data,
            'factures': s.FactureSerializer(vente.factures.all(), many=True).data,
        })


class CommandeViewSet(viewsets.ModelViewSet):
    queryset = Commande.objects.select_related('client', 'vente').all()
    serializer_class = s.CommandeSerializer
    permission_classes = [CanCommercial]

    @action(detail=True, methods=['post'])
    def completer(self, request, pk=None):
        """Transforme une commande en vente facturée (completer_commande).

        Enchaînement identique à la vue Django : contrôle des prix, contrôle du
        stock, puis création Vente + Facture + Paiement et sortie des bouteilles
        en FIFO sur la DLC. L'ensemble est atomique : un échec en cours de route
        ne doit pas laisser une vente sans bouteilles décrémentées.
        """
        cmd = self.get_object()
        if cmd.vente_id:
            return Response(
                {'detail': 'Cette commande a déjà été complétée.'}, status=400)

        # Les prix doivent être paramétrés, sinon le montant serait faux.
        art_33 = ArticleStock.objects.filter(type_art='jus_33cl').first()
        art_1l = ArticleStock.objects.filter(type_art='jus_1l').first()
        if not art_33 or not art_33.prix_33cl:
            return Response({'detail': "Le prix du Jus 33cl n'est pas paramétré. "
                                       "Allez dans Articles > Paramétrer Jus 33cl."}, status=400)
        if not art_1l or not art_1l.prix_1l:
            return Response({'detail': "Le prix du Jus 1L n'est pas paramétré. "
                                       "Allez dans Articles > Paramétrer Jus 1L."}, status=400)

        # On ne vend que ce qui est physiquement disponible.
        dispo_33 = Bouteille.objects.filter(statut_stock='DISPO', format_33cl=1).count()
        dispo_1l = Bouteille.objects.filter(statut_stock='DISPO', format_1l=1).count()
        if cmd.quantite_33cl > dispo_33:
            return Response({'detail': f'Stock insuffisant : {dispo_33} bouteilles 33cl '
                                       f'disponibles, {cmd.quantite_33cl} demandées.'}, status=400)
        if cmd.quantite_1l > dispo_1l:
            return Response({'detail': f'Stock insuffisant : {dispo_1l} bouteilles 1L '
                                       f'disponibles, {cmd.quantite_1l} demandées.'}, status=400)

        montant = cmd.get_total_ligne()
        payload = s.CompleterCommandeSerializer(data=request.data, montant_total=montant)
        payload.is_valid(raise_exception=True)
        statut = payload.validated_data['statut_paiement']
        montant_paye = payload.validated_data.get('montant_paye') or 0

        today = timezone.now().date()
        with transaction.atomic():
            vente = Vente.objects.create(
                client=cmd.client, date_vente=today,
                montant_total=montant, statut_paiement=statut,
            )
            cmd.vente = vente
            cmd.save()

            statut_fact = statut if statut in ('ACHAT_VENTE', 'PARTIELLE') else 'EMIS'
            facture = Facture.objects.create(
                vente=vente, date_fact=today, montant=montant,
                statut=statut_fact, date_echeance=today + timedelta(days=30),
            )

            if statut == 'ACHAT_VENTE':
                Paiement.objects.create(
                    facture=facture, date_paie=today, montant=montant,
                    mode_paie='ESPECE', reference='Paiement complet à la commande',
                )
            elif statut == 'PARTIELLE' and montant_paye > 0:
                Paiement.objects.create(
                    facture=facture, date_paie=today, montant=montant_paye,
                    mode_paie='ESPECE', reference='Acompte à la commande',
                )

            # Sortie FIFO : les bouteilles dont la DLC est la plus proche partent
            # en premier, pour limiter les pertes.
            bouteilles = list(
                Bouteille.objects.filter(statut_stock='DISPO', format_33cl=1)
                .order_by('dlc')[:cmd.quantite_33cl]
            ) + list(
                Bouteille.objects.filter(statut_stock='DISPO', format_1l=1)
                .order_by('dlc')[:cmd.quantite_1l]
            )
            for b in bouteilles:
                b.statut_stock = 'VENDUE'
                b.commande = cmd
                b.save()

            maj_stock_jus()

        message = f'Vente #{vente.pk} et facture créées pour {montant:.0f} XOF.'
        if statut == 'ACHAT_VENTE':
            message += ' Paiement complet enregistré.'
        elif statut == 'PARTIELLE':
            message += f' Acompte de {montant_paye:.0f} XOF enregistré.'

        return Response({
            'detail': message,
            'vente': s.VenteSerializer(vente).data,
            'facture': s.FactureSerializer(facture).data,
        })


class FactureViewSet(viewsets.ModelViewSet):
    queryset = Facture.objects.select_related(
        'vente', 'vente__client').prefetch_related('paiements').all()
    serializer_class = s.FactureSerializer
    permission_classes = [CanCommercial]

    def get_serializer_class(self):
        # La consultation d'une facture renvoie aussi l'historique de ses
        # paiements : c'est la page de détail du recouvrement.
        if self.action == 'retrieve':
            return s.FactureDetailSerializer
        return s.FactureSerializer

    @action(detail=True, methods=['post'])
    def paiement(self, request, pk=None):
        """Enregistre un paiement sur la facture (ajouter_paiement_facture).

        Met à jour le statut de la facture ET de la vente : soldée si le total
        atteint le montant dû, partielle sinon.
        """
        facture = self.get_object()
        total_paye = sum(p.montant for p in facture.paiements.all())
        reste_a_payer = facture.montant - total_paye

        if reste_a_payer <= 0:
            return Response(
                {'detail': 'Cette facture est déjà entièrement payée.'}, status=400)

        payload = s.PaiementFactureSerializer(
            data=request.data, reste_a_payer=reste_a_payer)
        payload.is_valid(raise_exception=True)

        with transaction.atomic():
            paiement = payload.save(facture=facture)
            nouveau_total = total_paye + paiement.montant
            solde = nouveau_total >= facture.montant
            nouveau_statut = 'ACHAT_VENTE' if solde else 'PARTIELLE'
            facture.statut = nouveau_statut
            facture.save()
            facture.vente.statut_paiement = nouveau_statut
            facture.vente.save()

        if solde:
            message = (f'Paiement de {paiement.montant:.0f} XOF enregistré. '
                       f'Facture soldée.')
        else:
            message = (f'Paiement de {paiement.montant:.0f} XOF enregistré. '
                       f'Reste à payer: {facture.montant - nouveau_total:.0f} XOF.')

        return Response({
            'detail': message,
            'facture': s.FactureSerializer(facture).data,
        })


class PaiementViewSet(viewsets.ModelViewSet):
    queryset = Paiement.objects.select_related('facture').all()
    serializer_class = s.PaiementSerializer
    permission_classes = [CanCommercial]


# =========================================================
#  Prospection (cartographie commerciale)
# =========================================================
class PointVenteViewSet(viewsets.ModelViewSet):
    queryset = PointVente.objects.select_related(
        'commercial', 'client').prefetch_related('visites').all()
    serializer_class = s.PointVenteSerializer
    permission_classes = [CanCommercial]

    def get_serializer_class(self):
        # Ouvrir un point sur la carte doit livrer sa fiche complète : contact,
        # photos et historique des visites, en une seule requête.
        if self.action == 'retrieve':
            return s.PointVenteDetailSerializer
        return s.PointVenteSerializer

    def get_queryset(self):
        """Filtres de la carte : statut, commercial, relances échues."""
        qs = super().get_queryset()
        params = self.request.query_params

        statut = params.get('statut')
        if statut:
            qs = qs.filter(statut__in=statut.split(','))

        commercial = params.get('commercial')
        if commercial:
            qs = qs.filter(commercial_id=commercial)

        if params.get('relances') in ('1', 'true'):
            qs = qs.filter(date_prochaine_relance__lte=timezone.localdate())

        return qs

    @action(detail=True, methods=['post'])
    def convertir_client(self, request, pk=None):
        """Transforme le point de vente en client du fichier commercial.

        Le point passe au statut « Client » et pointe vers la fiche créée : les
        ventes et factures se rattachent ensuite au client comme d'habitude.
        """
        point = self.get_object()
        payload = s.ConvertirEnClientSerializer(data=request.data, point=point)
        payload.is_valid(raise_exception=True)

        with transaction.atomic():
            client = payload.creer()
            point.client = client
            point.statut = 'CLIENT'
            point.save(update_fields=['client', 'statut'])

        return Response({
            'detail': f'« {point.nom} » est désormais rattaché au client '
                      f'{client.nom_complet}.',
            'point_vente': s.PointVenteSerializer(
                point, context={'request': request}).data,
        })


class VisiteViewSet(viewsets.ModelViewSet):
    queryset = Visite.objects.select_related(
        'point_vente', 'commercial').all()
    serializer_class = s.VisiteSerializer
    permission_classes = [CanCommercial]

    def get_queryset(self):
        qs = super().get_queryset()
        point = self.request.query_params.get('point_vente')
        if point:
            qs = qs.filter(point_vente_id=point)
        return qs


# =========================================================
#  Finance
# =========================================================
class ReceptionPaiementViewSet(viewsets.ModelViewSet):
    queryset = ReceptionPaiement.objects.select_related(
        'paiement', 'paiement__facture', 'paiement__facture__vente',
        'paiement__facture__vente__client').all()
    serializer_class = s.ReceptionPaiementSerializer
    permission_classes = [CanFinance]

    @action(detail=False, methods=['get'])
    def rapprochement(self, request):
        """Paiements déclarés par le commercial face aux encaisses du trésorier.

        Reproduit liste_tresorerie() : la liste contient AUSSI les paiements
        sans réception (statut EN_ATTENTE), qui sont précisément ceux que le
        trésorier doit traiter. Un simple listing des réceptions les masquerait.
        """
        paiements = Paiement.objects.select_related(
            'facture', 'facture__vente', 'facture__vente__client'
        ).prefetch_related('reception_tresorerie').order_by('-date_paie')

        lignes = []
        for p in paiements:
            rec = getattr(p, 'reception_tresorerie', None)
            lignes.append({
                'paiement_id': p.pk,
                'date_paie': p.date_paie,
                'num_fact': p.facture.num_fact if p.facture else None,
                'client_nom': (p.facture.vente.client.nom_complet
                               if p.facture and p.facture.vente and p.facture.vente.client
                               else None),
                'mode_paie': p.mode_paie,
                'mode_display': p.get_mode_paie_display(),
                'montant_commercial': p.montant,
                'reception_id': rec.pk if rec else None,
                'montant_recu': rec.montant_recu if rec else None,
                'date_reception': rec.date_reception if rec else None,
                'ecart': rec.ecart if rec else None,
                'statut_reception': rec.statut_reception if rec else 'EN_ATTENTE',
                'ecart_traite': rec.ecart_traite if rec else False,
                'observation': rec.observation if rec else '',
            })

        total_commercial = sum(l['montant_commercial'] for l in lignes)
        total_recu = sum(l['montant_recu'] or 0 for l in lignes)
        return Response({
            'lignes': lignes,
            'totaux': {
                'total_commercial': total_commercial,
                'total_recu': total_recu,
                'ecart_global': total_recu - total_commercial,
                'nb_en_attente': sum(1 for l in lignes if l['reception_id'] is None),
                'nb_ecarts_non_traites': sum(
                    1 for l in lignes
                    if l['reception_id'] and not l['ecart_traite']
                    and l['statut_reception'] in ('ECART_POSITIF', 'ECART_NEGATIF')
                ),
            },
        })

    @action(detail=True, methods=['post', 'patch'], url_path='gerer-ecart')
    def gerer_ecart(self, request, pk=None):
        """Justifie un écart et le marque comme traité (gerer_ecart)."""
        reception = self.get_object()
        if abs(reception.ecart) < 0.01:
            return Response(
                {'detail': 'Ce paiement est conforme, aucun écart à gérer.'},
                status=400,
            )
        payload = s.GererEcartSerializer(reception, data=request.data, partial=True)
        payload.is_valid(raise_exception=True)
        payload.save()
        return Response(s.ReceptionPaiementSerializer(reception).data)


# =========================================================
#  Utilisateurs (Direction)
# =========================================================
class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.prefetch_related('groups').all().order_by('-date_joined')
    serializer_class = s.UserSerializer
    permission_classes = [IsDirection]


# =========================================================
#  Options des listes déroulantes
# =========================================================
@api_view(['GET'])
@perm_decorator([IsAuthenticated])
def form_options(request):
    """Valeurs proposées dans les listes déroulantes des formulaires.

    Les formulaires Django ne montrent pas bêtement toutes les lignes : ils
    filtrent selon des règles métier (une cueillette déjà entièrement
    réceptionnée disparaît, une production déjà conditionnée aussi) et
    affichent un libellé enrichi. Sans cet endpoint, le frontend demanderait
    des identifiants numériques à l'utilisateur.
    """
    # Cueillettes : uniquement celles où il reste des oranges à réceptionner.
    # `reception` permet, en modification, de ne pas s'exclure soi-même.
    reception_id = request.query_params.get('reception')
    reception = Reception.objects.filter(pk=reception_id).first() if reception_id else None
    cueillettes = []
    for c in Cueillette.objects.select_related('producteur').all():
        restant = s.restant_a_receptionner(c, reception)
        if restant > 0:
            cueillettes.append({
                'value': c.pk,
                'label': (f'{c.get_producteur_display()} - {c.date_cueil} | '
                          f'Qté bonne: {c.qte_bon} kg | Restant: {restant} kg'),
                'restant': restant,
            })

    # Productions : terminées et pas encore conditionnées.
    conditionnement_id = request.query_params.get('conditionnement')
    productions_qs = Production.objects.filter(
        statut_production='TERMINEE', conditionnement__isnull=True)
    if conditionnement_id:
        deja = Conditionnement.objects.filter(pk=conditionnement_id).first()
        if deja and deja.production_id:
            productions_qs = productions_qs | Production.objects.filter(pk=deja.production_id)

    return Response({
        'producteurs': [
            {'value': p.pk, 'label': p.nom_complet, 'type_prod': p.type_prod}
            for p in Producteur.objects.order_by('nom_complet')
        ],
        # Seuls les producteurs internes ont des cueillettes à enregistrer.
        'producteurs_internes': [
            {'value': p.pk, 'label': p.nom_complet}
            for p in Producteur.objects.filter(
                type_prod='INTERNE').order_by('nom_complet')
        ],
        # Les externes livrent directement : on les réceptionne sans cueillette.
        'producteurs_externes': [
            {'value': p.pk, 'label': p.nom_complet}
            for p in Producteur.objects.filter(
                type_prod='EXTERNE').order_by('nom_complet')
        ],
        'cueillettes_disponibles': cueillettes,
        'productions_disponibles': [
            {'value': p.pk, 'label': f'{p.numero_of} — {p.date_of}'}
            for p in productions_qs.distinct().order_by('-date_of')
        ],
        'articles': [
            {'value': a.pk, 'label': a.get_type_art_display(),
             'type_art': a.type_art, 'qte_art': a.qte_art}
            for a in ArticleStock.objects.order_by('type_art')
        ],
        'articles_actualisables': [
            {'value': a.pk, 'label': a.get_type_art_display(), 'qte_art': a.qte_art}
            for a in ArticleStock.objects.exclude(
                type_art__in=s.TYPES_AUTOGERES).order_by('type_art')
        ],
        'types_article_creables': [
            {'value': k, 'label': v}
            for k, v in ArticleStock.TYPE_CHOICES
            if k not in s.TYPES_AUTOGERES
        ],
        'clients': [
            {'value': c.pk, 'label': c.nom_complet}
            for c in Client.objects.order_by('nom_complet')
        ],
        # Ventes et factures, pour rattacher une facture ou un paiement.
        'ventes': [
            {'value': v.pk,
             'label': f'#{v.pk} — {v.client.nom_complet if v.client else "client supprimé"} '
                      f'— {v.montant_total:.0f} XOF'}
            for v in Vente.objects.select_related('client').order_by('-date_vente')
        ],
        'factures': [
            {'value': f.pk, 'label': f'{f.num_fact} — {f.montant:.0f} XOF'}
            for f in Facture.objects.order_by('-date_fact')
        ],
        # Trésorerie : uniquement les paiements pas encore réceptionnés.
        'paiements_sans_reception': [
            {'value': p.pk,
             'label': (f'{p.facture.vente.client.nom_complet} — {p.montant:.0f} XOF — '
                       f'{p.get_mode_paie_display()} — {p.date_paie.strftime("%d/%m/%Y")}')
                      if p.facture and p.facture.vente and p.facture.vente.client
                      else f'Paiement #{p.pk} — {p.montant:.0f} XOF',
             'montant': p.montant}
            for p in Paiement.objects.select_related(
                'facture', 'facture__vente', 'facture__vente__client'
            ).exclude(
                pk__in=ReceptionPaiement.objects.values_list('paiement_id', flat=True)
            ).order_by('-date_paie')
        ],
        'utilisateurs': [
            {'value': u.pk, 'label': u.get_full_name() or u.username}
            for u in User.objects.order_by('username')
        ],
        # --- Prospection ---
        'points_vente': [
            {'value': p.pk, 'label': f'{p.nom} — {p.get_statut_display()}'}
            for p in PointVente.objects.order_by('nom')
        ],
        'statuts_prospection': [
            {'value': k, 'label': v} for k, v in STATUT_CHOICES
        ],
        'types_point_vente': [
            {'value': k, 'label': v} for k, v in PointVente.TYPE_CHOICES
        ],
        # Commerciaux : pour attribuer un point ou filtrer la carte. La
        # Direction supervise sans prospecter, elle n'apparaît donc pas ici.
        'commerciaux': [
            {'value': u.pk, 'label': u.get_full_name() or u.username}
            for u in User.objects.filter(
                groups__name='Commercial', is_active=True
            ).distinct().order_by('username')
        ],
    })


# =========================================================
#  Rapports détaillés (réutilisent les services Django)
# =========================================================
# On appelle exactement les mêmes fonctions que les vues templates : les
# chiffres affichés dans React sont donc identiques à ceux du rapport HTML,
# sans logique dupliquée qui pourrait dériver.
RAPPORTS = {
    'recolte': get_rapport_recolte,
    'appro': get_rapport_appro,
    'fabrication': get_rapport_fabrication,
    'emballage': get_rapport_emballage,
    'entrepot': get_rapport_entrepot,
    'distribution': get_rapport_distribution,
}

EXPORTS = {
    'recolte': (export_recolte_excel, ['cueillettes', 'par_producteur', 'par_zone']),
    'appro': (export_appro_excel, ['receptions', 'evolution_stock', 'stock_actuel']),
    'fabrication': (export_fabrication_excel, ['productions']),
    'emballage': (export_emballage_excel, ['conditionnements', 'bouteilles_par_statut', 'bouteilles']),
    'entrepot': (export_entrepot_excel, ['inventaires']),
    'distribution': (export_distribution_excel, ['ventes', 'commandes', 'factures',
                                                 'paiements', 'receptions_tresorerie']),
}

# Rôles autorisés par rapport, reproduits du LoginRequiredMiddleware : le
# rapport distribution reste fermé à la production, et inversement.
ROLES_RAPPORT = {
    'distribution': ('Direction', 'Finance', 'Commercial'),
    'recolte': ('Direction', 'Finance', 'ResProd'),
    'appro': ('Direction', 'Finance', 'ResProd'),
    'fabrication': ('Direction', 'Finance', 'ResProd'),
    'emballage': ('Direction', 'Finance', 'ResProd'),
    'entrepot': ('Direction', 'Finance', 'ResProd'),
}

# Les listes d'objets sont converties par les serializers du module ; les
# autres valeurs (compteurs, agrégats déjà en dict) passent telles quelles.
SERIALIZERS_RAPPORT = {
    'cueillettes': s.CueilletteSerializer,
    'receptions': s.ReceptionSerializer,
    'articles_alerte': s.ArticleStockSerializer,
    'stock_actuel': s.ArticleStockSerializer,
    'productions': s.ProductionSerializer,
    'conditionnements': s.ConditionnementSerializer,
    'bouteilles': s.BouteilleSerializer,
    'inventaires': s.InventaireSerializer,
    'ventes': s.VenteSerializer,
    'commandes': s.CommandeSerializer,
    'factures': s.FactureSerializer,
    'paiements': s.PaiementSerializer,
    'receptions_tresorerie': s.ReceptionPaiementSerializer,
}


def _peut_voir_rapport(user, module):
    if user.is_superuser or user.is_staff:
        return True
    roles = set(user.groups.values_list('name', flat=True))
    return bool(roles & set(ROLES_RAPPORT.get(module, ())))


@api_view(['GET'])
@perm_decorator([IsAuthenticated])
def rapport(request, module):
    """Rapport détaillé d'un module, filtré par période.

    Paramètres : ?periode=semaine|mois|trimestre, ou ?date_debut=&date_fin=.
    Par défaut : du 1er du mois en cours à aujourd'hui.
    """
    if module not in RAPPORTS:
        return Response({'detail': f'Rapport inconnu : {module}.'}, status=404)
    if not _peut_voir_rapport(request.user, module):
        return Response(
            {'detail': "Vous n'avez pas accès à ce rapport."}, status=403)

    date_debut, date_fin = get_period_from_request(request)
    donnees = RAPPORTS[module](date_debut, date_fin)

    payload = {'periode': {'date_debut': date_debut, 'date_fin': date_fin}}
    for cle, valeur in donnees.items():
        serializer = SERIALIZERS_RAPPORT.get(cle)
        payload[cle] = serializer(valeur, many=True).data if serializer else valeur
    return Response(payload)


@api_view(['GET'])
@perm_decorator([IsAuthenticated])
def rapport_export(request, module):
    """Export Excel du rapport, identique au bouton de l'interface Django."""
    if module not in EXPORTS:
        return Response({'detail': f'Rapport inconnu : {module}.'}, status=404)
    if not _peut_voir_rapport(request.user, module):
        return Response(
            {'detail': "Vous n'avez pas accès à ce rapport."}, status=403)

    date_debut, date_fin = get_period_from_request(request)
    donnees = RAPPORTS[module](date_debut, date_fin)
    fonction, arguments = EXPORTS[module]
    # Le bloc analytique alimente la feuille « Synthèse » du classeur : le
    # fichier téléchargé porte la même lecture que l'écran, pas seulement les
    # lignes brutes.
    return fonction(
        date_debut, date_fin,
        *[donnees.get(a) for a in arguments],
        analyse=donnees.get('analyse'),
    )


# =========================================================
#  Reporting (statistiques agrégées)
# =========================================================
@api_view(['GET'])
@perm_decorator([IsReportingViewer])
def reporting_summary(request):
    """KPI consolidés pour les tableaux de bord."""
    recolte_total = Cueillette.objects.aggregate(t=Sum('qte_total'))['t'] or 0
    jus_stock = ArticleStock.objects.filter(
        type_art__in=['jus_33cl', 'jus_1l']).aggregate(t=Sum('qte_art'))['t'] or 0
    ca_total = Vente.objects.aggregate(t=Sum('montant_total'))['t'] or 0
    bouteilles = Bouteille.objects.count()
    articles_sous_seuil = sum(
        1 for a in ArticleStock.objects.all() if a.qte_art < a.seuil_alerte)

    # Récolte par zone
    recolte_zone = list(
        Producteur.objects.values('zone').annotate(
            tonnage=Sum('cueillettes__qte_total')).order_by('-tonnage')
    )
    # Stock par article
    stock_articles = [
        {
            'article': a.get_type_art_display(),
            'stock': a.qte_art,
            'seuil': a.seuil_alerte,
        }
        for a in ArticleStock.objects.all()
    ]
    # Paiements par mode
    paiements_mode = list(
        Paiement.objects.values('mode_paie').annotate(total=Count('id'))
    )
    return Response({
        'kpi': {
            'recolte_total': recolte_total,
            'jus_stock': jus_stock,
            'ca_total': ca_total,
            'bouteilles': bouteilles,
            'articles_sous_seuil': articles_sous_seuil,
            'clients': Client.objects.count(),
            'ventes': Vente.objects.count(),
            'productions': Production.objects.count(),
        },
        'recolte_zone': recolte_zone,
        'stock_articles': stock_articles,
        'paiements_mode': paiements_mode,
    })
