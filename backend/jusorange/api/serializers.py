"""Serializers DRF pour tous les modèles métier + utilisateurs.

Les règles de validation reproduisent celles des formulaires Django
(`*/forms.py`) : l'API et les vues templates doivent se comporter à
l'identique, sinon le frontend React et l'interface HTML divergeraient.
"""
from datetime import date, timedelta

from django.contrib.auth.models import User, Group
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Sum
from rest_framework import serializers

from recolte.models import Producteur, Cueillette
from appro.models import ArticleStock, Reception
from fabrication.models import Production
from emballage.models import Conditionnement, Bouteille
from emballage.forms import add_months
from entrepot.models import Inventaire
from distribution.models import (
    Client, Vente, Commande, Facture, Paiement, ReceptionPaiement,
)
from prospection.models import PointVente, Visite


def restant_a_receptionner(cueillette, reception_exclue=None):
    """Quantité encore réceptionnable sur une cueillette.

    Reproduit le calcul de `ReceptionForm` : on somme les réceptions déjà
    saisies et, en modification, on retire celle qu'on est en train d'éditer
    pour ne pas la compter deux fois.
    """
    total_deja_recu = cueillette.receptions.aggregate(
        total=Sum('qte_recue'))['total'] or 0
    if reception_exclue is not None and reception_exclue.pk \
            and reception_exclue.cueillette_id == cueillette.pk:
        total_deja_recu -= (reception_exclue.qte_recue or 0)
    return cueillette.qte_bon - total_deja_recu


# ---------- Récolte ----------
class ProducteurSerializer(serializers.ModelSerializer):
    type_prod_display = serializers.CharField(source='get_type_prod_display', read_only=True)

    class Meta:
        model = Producteur
        fields = '__all__'


class CueilletteSerializer(serializers.ModelSerializer):
    producteur_display = serializers.CharField(source='get_producteur_display', read_only=True)
    taux_qualite = serializers.FloatField(read_only=True)
    qte_mauvais = serializers.FloatField(read_only=True)

    class Meta:
        model = Cueillette
        fields = '__all__'

    def validate(self, attrs):
        """Mêmes contrôles que CueilletteForm.clean(), plus le type de producteur."""
        # Un producteur externe livre directement : on ne suit pas sa récolte,
        # donc aucune cueillette ne doit lui être rattachée.
        producteur = attrs.get('producteur', getattr(self.instance, 'producteur', None))
        if producteur is not None and producteur.type_prod == 'EXTERNE':
            raise serializers.ValidationError({
                'producteur': "Ce producteur est externe : sa récolte n'est pas suivie. "
                              "Enregistrez directement une réception."
            })

        qte_total = attrs.get('qte_total', getattr(self.instance, 'qte_total', None))
        qte_bon = attrs.get('qte_bon', getattr(self.instance, 'qte_bon', None))
        if qte_total is not None and qte_bon is not None:
            if qte_bon > qte_total:
                raise serializers.ValidationError(
                    "La quantité bonne ne peut pas dépasser la quantité totale.")
            if qte_total < 0 or qte_bon < 0:
                raise serializers.ValidationError(
                    "Les quantités ne peuvent pas être négatives.")
        return attrs


# ---------- Approvisionnement ----------
# Types d'articles gérés automatiquement par l'application :
# - orange_dispo : alimenté par les réceptions
# - jus_33cl / jus_1l : recalculés depuis les bouteilles disponibles
# On ne peut donc ni les créer ni saisir leur quantité à la main.
TYPES_AUTOGERES = ('orange_dispo', 'jus_33cl', 'jus_1l')
TYPES_JUS = ('jus_33cl', 'jus_1l')


class ArticleStockSerializer(serializers.ModelSerializer):
    type_art_display = serializers.CharField(source='get_type_art_display', read_only=True)
    sous_seuil = serializers.SerializerMethodField()
    # La quantité ne se modifie que via « actualiser » (ajout) ou automatiquement.
    qte_art = serializers.FloatField(read_only=True)
    actualisable = serializers.SerializerMethodField()

    class Meta:
        model = ArticleStock
        fields = '__all__'

    def get_sous_seuil(self, obj):
        return obj.qte_art <= obj.seuil_alerte

    def get_actualisable(self, obj):
        return obj.type_art not in TYPES_AUTOGERES

    def validate_type_art(self, value):
        """À la création, interdire les types gérés automatiquement."""
        if self.instance is None and value in TYPES_AUTOGERES:
            raise serializers.ValidationError(
                "Ce type d'article est géré automatiquement par l'application "
                "et ne peut pas être créé manuellement."
            )
        return value

    def validate(self, attrs):
        """Les prix ne concernent que les articles jus."""
        type_art = attrs.get('type_art', getattr(self.instance, 'type_art', None))
        if type_art not in TYPES_JUS:
            if attrs.get('prix_33cl') or attrs.get('prix_1l'):
                raise serializers.ValidationError(
                    "Un prix ne peut être défini que sur les articles Jus 33cl et Jus 1L."
                )
        return attrs


class ArticleActualiserSerializer(serializers.Serializer):
    """Ajout d'une quantité au stock existant (ArticleStockUpdateForm)."""
    qte_ajout = serializers.FloatField(min_value=0)


class ReceptionSerializer(serializers.ModelSerializer):
    cueillette_display = serializers.CharField(source='get_cueillette_display', read_only=True)
    taux_qualite = serializers.FloatField(read_only=True)
    etat_qualite = serializers.CharField(read_only=True)
    qte_mauvais = serializers.FloatField(read_only=True)
    num_recp = serializers.CharField(read_only=True)

    class Meta:
        model = Reception
        fields = '__all__'

    def validate(self, attrs):
        """Mêmes contrôles que ReceptionForm.clean(), plus l'origine des oranges."""
        cueillette = attrs.get('cueillette', getattr(self.instance, 'cueillette', None))
        externe = attrs.get('producteur_externe',
                            getattr(self.instance, 'producteur_externe', None))
        qte_recue = attrs.get('qte_recue', getattr(self.instance, 'qte_recue', None))
        qte_bon = attrs.get('qte_bon', getattr(self.instance, 'qte_bon', None))

        # Une réception vient soit d'une cueillette (producteur interne, avec
        # son quota), soit d'un producteur externe qui livre directement.
        if cueillette is None and externe is None:
            raise serializers.ValidationError(
                "Indiquez l'origine des oranges : une cueillette (producteur "
                "interne) ou un producteur externe.")
        if cueillette is not None and externe is not None:
            raise serializers.ValidationError(
                "Choisissez soit une cueillette, soit un producteur externe, "
                "pas les deux.")
        if externe is not None and externe.type_prod != 'EXTERNE':
            raise serializers.ValidationError({
                'producteur_externe': "Ce producteur est interne : passez par "
                                      "une de ses cueillettes."
            })

        if qte_recue is not None and qte_bon is not None:
            if qte_bon > qte_recue:
                raise serializers.ValidationError(
                    "La quantité bonne ne peut pas dépasser la quantité reçue.")
            if qte_recue < 0 or qte_bon < 0:
                raise serializers.ValidationError(
                    "Les quantités ne peuvent pas être négatives.")

        # On ne peut réceptionner que les oranges bonnes d'une cueillette, et
        # jamais plus que ce qui reste à réceptionner dessus.
        if cueillette is not None and qte_recue is not None:
            restant = restant_a_receptionner(cueillette, self.instance)
            if qte_recue > restant:
                total_deja_recu = cueillette.qte_bon - restant
                raise serializers.ValidationError(
                    f"La quantité reçue ({qte_recue} kg) dépasse le restant à "
                    f"réceptionner pour cette cueillette. "
                    f"Qté bonne de la cueillette : {cueillette.qte_bon} kg, "
                    f"déjà réceptionné : {total_deja_recu} kg, "
                    f"restant disponible : {restant} kg."
                )
        return attrs


# ---------- Fabrication ----------
def _valider_mesures_production(attrs):
    """pH entre 0 et 10, réfractomètre entre 0 et 20 (ProductionCompleteForm)."""
    ph = attrs.get('ph')
    if ph is not None and (ph < 0 or ph > 10):
        raise serializers.ValidationError(
            {'ph': 'Le pH doit être un entier entre 0 et 10.'})
    refract = attrs.get('refractometre')
    if refract is not None and (refract < 0 or refract > 20):
        raise serializers.ValidationError(
            {'refractometre': 'Le réfractomètre doit être un entier entre 0 et 20.'})
    return attrs


# Champs redéclarés sans les validateurs du modèle : ceux-ci produiraient un
# message en anglais avant que _valider_mesures_production() ne s'exécute, alors
# que l'interface Django affiche un message en français.
def _champ_mesure():
    return serializers.IntegerField(required=False, allow_null=True)


class ProductionSerializer(serializers.ModelSerializer):
    numero_of = serializers.CharField(read_only=True)
    recette_display = serializers.CharField(source='get_recette_display', read_only=True)
    statut_display = serializers.CharField(source='get_statut_production_display', read_only=True)
    est_conditionnee = serializers.SerializerMethodField()
    ph = _champ_mesure()
    refractometre = _champ_mesure()

    class Meta:
        model = Production
        fields = '__all__'

    def get_est_conditionnee(self, obj):
        return hasattr(obj, 'conditionnement') and obj.conditionnement is not None

    def validate(self, attrs):
        return _valider_mesures_production(attrs)


class ProductionCreateSerializer(serializers.ModelSerializer):
    """Étape 1 — programmer : date + recette, statut forcé à EN_COURS.

    Reproduit ProductionCreateForm : les paramètres de fabrication ne sont pas
    encore connus au moment où l'on programme l'ordre de fabrication.
    """
    class Meta:
        model = Production
        fields = ['id', 'date_of', 'recette']

    def create(self, validated_data):
        validated_data['statut_production'] = 'EN_COURS'
        return super().create(validated_data)


class ProductionCompleteSerializer(serializers.ModelSerializer):
    """Étape 2 — compléter : mesures de fabrication, statut forcé à TERMINEE."""
    ph = _champ_mesure()
    refractometre = _champ_mesure()

    class Meta:
        model = Production
        exclude = ['date_of', 'recette', 'numero_of', 'statut_production', 'user']

    def validate(self, attrs):
        return _valider_mesures_production(attrs)

    def update(self, instance, validated_data):
        validated_data['statut_production'] = 'TERMINEE'
        return super().update(instance, validated_data)


# ---------- Emballage ----------
class ConditionnementSerializer(serializers.ModelSerializer):
    """Reproduit ConditionnementForm : DLC calculée, contrôles de stock.

    La DLC n'est jamais saisie directement : on renseigne un délai en jours
    OU en mois à partir de la date de conditionnement, comme dans le formulaire
    Django. `dlc` est donc en lecture seule côté API.
    """
    numero_cond = serializers.CharField(read_only=True)
    dlc = serializers.DateField(read_only=True)
    production_numero = serializers.CharField(source='production.numero_of', read_only=True)
    nb_jours = serializers.IntegerField(write_only=True, required=False, allow_null=True, min_value=1)
    nb_mois = serializers.IntegerField(write_only=True, required=False, allow_null=True, min_value=1)

    class Meta:
        model = Conditionnement
        fields = '__all__'

    def _stock_bouteilles_vides(self, type_art, qte, champ, libelle, erreurs):
        """Vérifie qu'il reste assez de bouteilles vides pour ce format."""
        if qte <= 0:
            return
        article = ArticleStock.objects.filter(type_art=type_art).first()
        if article is None:
            erreurs[champ] = (
                f"L'article '{libelle}' n'existe pas. "
                "Paramétrez-le d'abord dans Articles."
            )
        elif article.qte_art < qte:
            erreurs[champ] = (
                f'Stock insuffisant {libelle.split()[-1]} : {article.qte_art:.0f} '
                f'bouteilles vides disponibles, {qte} demandées.'
            )

    def validate(self, attrs):
        erreurs = {}
        volume = attrs.get('volume_utilisee', getattr(self.instance, 'volume_utilisee', None))
        observation = attrs.get('observation', getattr(self.instance, 'observation', None))
        qte_33cl = attrs.get('qte_33cl', getattr(self.instance, 'qte_33cl', 0)) or 0
        qte_1l = attrs.get('qte_1l', getattr(self.instance, 'qte_1l', 0)) or 0
        nb_jours = attrs.get('nb_jours')
        nb_mois = attrs.get('nb_mois')

        if volume is None or volume <= 0:
            erreurs['volume_utilisee'] = 'Le volume utilisée (L) est obligatoire et doit être supérieur à 0.'

        if not (observation and str(observation).strip()):
            erreurs['observation'] = "L'observation est obligatoire."

        if qte_33cl <= 0 and qte_1l <= 0:
            msg = 'Renseignez au moins la quantité 33cl ou la quantité 1L.'
            erreurs['qte_33cl'] = msg
            erreurs['qte_1l'] = msg
        else:
            # En modification, les bouteilles ont déjà été créées : re-vérifier le
            # stock ferait échouer toute édition. Django ne le fait qu'à la création.
            if self.instance is None:
                self._stock_bouteilles_vides(
                    'bouteille_vide_33cl', qte_33cl, 'qte_33cl', 'Bouteille vide 33cl', erreurs)
                self._stock_bouteilles_vides(
                    'bouteille_vide_1l', qte_1l, 'qte_1l', 'Bouteille vide 1L', erreurs)

        if nb_jours and nb_mois:
            msg = 'Renseignez soit les jours, soit les mois, pas les deux.'
            erreurs['nb_jours'] = msg
            erreurs['nb_mois'] = msg
        elif not nb_jours and not nb_mois and self.instance is None:
            msg = 'Renseignez le nombre de jours ou le nombre de mois pour la DLC.'
            erreurs['nb_jours'] = msg
            erreurs['nb_mois'] = msg

        # Une production ne peut être conditionnée qu'une seule fois.
        production = attrs.get('production')
        if production is not None:
            deja_pris = hasattr(production, 'conditionnement') and production.conditionnement
            en_modification_sur_la_meme = (
                self.instance is not None
                and self.instance.production_id == production.pk
            )
            if deja_pris and not en_modification_sur_la_meme:
                erreurs['production'] = 'Cette production a déjà été conditionnée.'

        if erreurs:
            raise serializers.ValidationError(erreurs)
        return attrs

    def _appliquer_dlc(self, instance, nb_jours, nb_mois):
        if nb_jours:
            instance.dlc = instance.date_cond + timedelta(days=nb_jours)
        elif nb_mois:
            instance.dlc = add_months(instance.date_cond, nb_mois)

    def create(self, validated_data):
        nb_jours = validated_data.pop('nb_jours', None)
        nb_mois = validated_data.pop('nb_mois', None)
        instance = Conditionnement(**validated_data)
        self._appliquer_dlc(instance, nb_jours, nb_mois)
        instance.save()
        return instance

    def update(self, instance, validated_data):
        nb_jours = validated_data.pop('nb_jours', None)
        nb_mois = validated_data.pop('nb_mois', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if nb_jours or nb_mois:
            self._appliquer_dlc(instance, nb_jours, nb_mois)
        instance.save()
        return instance


class BouteilleSerializer(serializers.ModelSerializer):
    format_display = serializers.CharField(source='get_format_display', read_only=True)
    statut_display = serializers.CharField(source='get_statut_stock_display', read_only=True)

    class Meta:
        model = Bouteille
        fields = '__all__'


# ---------- Entrepôt ----------
class InventaireSerializer(serializers.ModelSerializer):
    """Reproduit InventaireForm.

    `qte_systeme` n'est pas saisie : elle est relevée sur l'article au moment
    de la création, sinon l'écart mesuré n'aurait aucune valeur de contrôle.
    L'écart et la qualité sont calculés par Inventaire.save().
    """
    article_display = serializers.CharField(source='article.get_type_art_display', read_only=True)
    statut_display = serializers.CharField(source='get_statut_display', read_only=True)
    ecart = serializers.FloatField(read_only=True)
    qte_systeme = serializers.FloatField(read_only=True)
    qualite = serializers.CharField(read_only=True)

    class Meta:
        model = Inventaire
        fields = '__all__'

    def validate(self, attrs):
        statut = attrs.get('statut', getattr(self.instance, 'statut', None))
        observation = attrs.get('observation', getattr(self.instance, 'observation', None))
        if statut == 'TERMINE' and not (observation and str(observation).strip()):
            raise serializers.ValidationError({
                'observation': "L'observation est obligatoire une fois l'inventaire terminé."
            })
        return attrs

    def create(self, validated_data):
        instance = Inventaire(**validated_data)
        instance.qte_systeme = instance.article.qte_art
        instance.save()
        return instance


class InventaireObservationSerializer(serializers.ModelSerializer):
    """Saisie ou correction de la seule observation (InventaireObservationForm)."""
    class Meta:
        model = Inventaire
        fields = ['id', 'observation']


# ---------- Distribution ----------
class ClientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Client
        fields = '__all__'

    def validate(self, attrs):
        """Un client injoignable ne sert à rien (ClientForm.clean)."""
        tel = (attrs.get('tel_client', getattr(self.instance, 'tel_client', '')) or '').strip()
        email = (attrs.get('email', getattr(self.instance, 'email', '')) or '').strip()
        if not tel and not email:
            raise serializers.ValidationError(
                "Indiquez au moins le numéro de téléphone ou l'email.")
        return attrs


class VenteSerializer(serializers.ModelSerializer):
    client_nom = serializers.CharField(source='client.nom_complet', read_only=True)
    statut_display = serializers.CharField(source='get_statut_paiement_display', read_only=True)
    total_paye = serializers.SerializerMethodField()
    reste_a_payer = serializers.SerializerMethodField()

    class Meta:
        model = Vente
        fields = '__all__'

    def _paiements(self, obj):
        return [p for f in obj.factures.all() for p in f.paiements.all()]

    def get_total_paye(self, obj):
        return sum(p.montant for p in self._paiements(obj))

    def get_reste_a_payer(self, obj):
        return obj.montant_total - self.get_total_paye(obj)


class CommandeSerializer(serializers.ModelSerializer):
    client_nom = serializers.CharField(source='client.nom_complet', read_only=True)
    total = serializers.SerializerMethodField()
    # Une commande liée à une vente est déjà complétée : le frontend s'en sert
    # pour masquer l'action « Compléter ».
    est_completee = serializers.SerializerMethodField()
    vente = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Commande
        fields = '__all__'

    def get_total(self, obj):
        return obj.get_total_ligne()

    def get_est_completee(self, obj):
        return obj.vente_id is not None

    def validate(self, attrs):
        """Au moins une quantité (CommandeForm.clean)."""
        qte_33 = attrs.get('quantite_33cl', getattr(self.instance, 'quantite_33cl', 0)) or 0
        qte_1l = attrs.get('quantite_1l', getattr(self.instance, 'quantite_1l', 0)) or 0
        if qte_33 <= 0 and qte_1l <= 0:
            raise serializers.ValidationError(
                'Indiquez au moins une quantité (33cl ou 1L, ou les deux).')
        return attrs


class CompleterCommandeSerializer(serializers.Serializer):
    """Choix du statut de paiement à la validation d'une commande.

    Reproduit CompleterCommandeForm : un paiement partiel exige un acompte
    strictement compris entre 0 et le montant total.
    """
    STATUT_CHOICES = [
        ('DEPOT_VENTE', 'Dépôt-vente'),
        ('PARTIELLE', 'Partielle'),
        ('ACHAT_VENTE', 'Achat-vente'),
    ]
    statut_paiement = serializers.ChoiceField(choices=STATUT_CHOICES, default='DEPOT_VENTE')
    montant_paye = serializers.FloatField(required=False, allow_null=True, min_value=0)

    def __init__(self, *args, montant_total=None, **kwargs):
        super().__init__(*args, **kwargs)
        self.montant_total = montant_total

    def validate(self, attrs):
        if attrs.get('statut_paiement') == 'PARTIELLE':
            montant = attrs.get('montant_paye')
            if montant is None or montant <= 0:
                raise serializers.ValidationError({
                    'montant_paye': 'Indiquez le montant déjà payé pour un paiement partiel.'
                })
            if self.montant_total and montant >= self.montant_total:
                raise serializers.ValidationError({
                    'montant_paye': 'Pour un paiement partiel, le montant payé doit '
                                    'être inférieur au montant total.'
                })
        return attrs


# Seuil de relance préventive : en deçà, l'échéance est jugée imminente.
JOURS_RELANCE = 7


def montant_lisible(valeur):
    """Formate un montant avec une espace comme séparateur de milliers."""
    return f'{valeur:,.0f}'.replace(',', ' ')


class FactureSerializer(serializers.ModelSerializer):
    num_fact = serializers.CharField(read_only=True)
    client_nom = serializers.CharField(source='vente.client.nom_complet', read_only=True)
    statut_display = serializers.CharField(source='get_statut_display', read_only=True)
    total_paye = serializers.SerializerMethodField()
    reste_a_payer = serializers.SerializerMethodField()
    # Suivi du recouvrement, calculé à partir de l'échéance et du reste dû.
    jours_avant_echeance = serializers.SerializerMethodField()
    recouvrement = serializers.SerializerMethodField()

    class Meta:
        model = Facture
        fields = '__all__'

    def get_total_paye(self, obj):
        return sum(p.montant for p in obj.paiements.all())

    def get_reste_a_payer(self, obj):
        return obj.montant - self.get_total_paye(obj)

    def get_jours_avant_echeance(self, obj):
        """Négatif si l'échéance est dépassée."""
        if not obj.date_echeance:
            return None
        return (obj.date_echeance - date.today()).days

    def get_recouvrement(self, obj):
        """Ce que le commercial doit faire, et quand.

        Il n'existe pas d'échéancier dans le modèle : le seul engagement de
        paiement est la date d'échéance de la facture. Le montant restant est
        donc attendu pour cette date, et l'urgence en découle.
        """
        reste = self.get_reste_a_payer(obj)
        if reste <= 0:
            return {
                'statut': 'SOLDEE',
                'libelle': 'Soldée',
                'action': "Aucune action : la facture est intégralement réglée.",
                'jours': None,
                'montant_attendu': 0,
            }

        jours = self.get_jours_avant_echeance(obj)
        if jours is None:
            return {
                'statut': 'SANS_ECHEANCE',
                'libelle': 'Sans échéance',
                'action': "Aucune échéance n'est définie sur cette facture.",
                'jours': None,
                'montant_attendu': reste,
            }

        if jours < 0:
            return {
                'statut': 'RECOUVREMENT',
                'libelle': f'En retard de {abs(jours)} jour(s)',
                'action': (f"Recouvrement à engager : {montant_lisible(reste)} XOF dus depuis "
                           f"{abs(jours)} jour(s). Contacter le client."),
                'jours': jours,
                'montant_attendu': reste,
            }

        if jours <= JOURS_RELANCE:
            return {
                'statut': 'RELANCE',
                'libelle': f'Échéance dans {jours} jour(s)',
                'action': (f"Relance préventive : {montant_lisible(reste)} XOF à encaisser "
                           f"avant le {obj.date_echeance:%d/%m/%Y}."),
                'jours': jours,
                'montant_attendu': reste,
            }

        return {
            'statut': 'A_ECHOIR',
            'libelle': f'À échoir dans {jours} jour(s)',
            'action': (f"Rien à faire pour l'instant : {montant_lisible(reste)} XOF attendus "
                       f"le {obj.date_echeance:%d/%m/%Y}."),
            'jours': jours,
            'montant_attendu': reste,
        }


class FactureDetailSerializer(FactureSerializer):
    """Facture avec l'historique de ses paiements, pour la page de détail."""
    paiements = serializers.SerializerMethodField()
    vente_id = serializers.IntegerField(source='vente.pk', read_only=True)
    client_tel = serializers.CharField(source='vente.client.tel_client', read_only=True)
    client_email = serializers.CharField(source='vente.client.email', read_only=True)

    class Meta(FactureSerializer.Meta):
        pass

    def get_paiements(self, obj):
        return PaiementSerializer(
            obj.paiements.all().order_by('date_paie', 'pk'), many=True).data


class PaiementFactureSerializer(serializers.ModelSerializer):
    """Paiement enregistré depuis une facture (PaiementFactureForm).

    Le montant est borné par le reste à payer : sans cela on encaisserait plus
    que le dû et le suivi de trésorerie deviendrait faux.
    """
    class Meta:
        model = Paiement
        fields = ['id', 'date_paie', 'montant', 'mode_paie', 'reference']

    def __init__(self, *args, reste_a_payer=None, **kwargs):
        super().__init__(*args, **kwargs)
        self.reste_a_payer = reste_a_payer or 0

    def validate_montant(self, value):
        if value is None or value <= 0:
            raise serializers.ValidationError('Le montant doit être supérieur à 0.')
        if self.reste_a_payer and value > self.reste_a_payer:
            raise serializers.ValidationError(
                f'Le montant ne peut pas dépasser le reste à payer '
                f'({montant_lisible(self.reste_a_payer)} XOF).')
        return value


class PaiementSerializer(serializers.ModelSerializer):
    num_fact = serializers.CharField(source='facture.num_fact', read_only=True)
    mode_display = serializers.CharField(source='get_mode_paie_display', read_only=True)

    class Meta:
        model = Paiement
        fields = '__all__'


class ReceptionPaiementSerializer(serializers.ModelSerializer):
    num_fact = serializers.CharField(source='paiement.facture.num_fact', read_only=True)
    montant_declare = serializers.FloatField(source='paiement.montant', read_only=True)
    client_nom = serializers.CharField(
        source='paiement.facture.vente.client.nom_complet', read_only=True)
    ecart = serializers.FloatField(read_only=True)
    statut_reception = serializers.CharField(read_only=True)
    # validators=[] désactive le contrôle d'unicité automatique de DRF, dont le
    # message est technique ; validate_paiement() ci-dessous le remplace par un
    # message compréhensible par le trésorier.
    paiement = serializers.PrimaryKeyRelatedField(
        queryset=Paiement.objects.all(), validators=[])

    class Meta:
        model = ReceptionPaiement
        fields = '__all__'

    def validate_montant_recu(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError(
                'Le montant reçu ne peut pas être négatif.')
        return value

    def validate_paiement(self, value):
        """Un paiement ne peut être réceptionné qu'une fois (OneToOne).

        Message explicite plutôt que l'erreur d'unicité brute : le trésorier
        doit comprendre qu'il a déjà saisi cette encaisse.
        """
        deja = ReceptionPaiement.objects.filter(paiement=value)
        if self.instance is not None:
            deja = deja.exclude(pk=self.instance.pk)
        if deja.exists():
            raise serializers.ValidationError(
                'Ce paiement a déjà fait l\'objet d\'une réception de trésorerie.')
        return value


class GererEcartSerializer(serializers.ModelSerializer):
    """Justification d'un écart (GererEcartForm). L'écart passe alors en traité."""
    observation = serializers.CharField(allow_blank=False)

    class Meta:
        model = ReceptionPaiement
        fields = ['id', 'observation']

    def update(self, instance, validated_data):
        validated_data['ecart_traite'] = True
        return super().update(instance, validated_data)


# ---------- Utilisateurs ----------
ROLES_AUTORISES = ('ResProd', 'Commercial', 'Finance', 'Direction')


class UserSerializer(serializers.ModelSerializer):
    roles = serializers.SerializerMethodField()
    role = serializers.ChoiceField(
        choices=ROLES_AUTORISES, write_only=True, required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, required=False, style={'input_type': 'password'})

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'is_active', 'is_staff',
                  'is_superuser', 'date_joined', 'roles', 'role', 'password']

    def get_roles(self, obj):
        return list(obj.groups.values_list('name', flat=True))

    def validate_password(self, value):
        """Applique les validateurs de mot de passe du projet.

        Django passe par UserCreationForm, qui refuse les mots de passe trop
        courts, trop courants ou uniquement numériques. Sans ce contrôle, l'API
        laisserait créer des comptes que l'interface Django rejetterait.
        """
        if not value:
            return value
        try:
            validate_password(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages))
        return value

    def validate(self, attrs):
        """Un compte créé sans mot de passe serait inutilisable."""
        if self.instance is None and not attrs.get('password'):
            raise serializers.ValidationError(
                {'password': 'Un mot de passe est obligatoire à la création.'})
        return attrs

    def create(self, validated_data):
        role = validated_data.pop('role', None)
        password = validated_data.pop('password', None)
        user = User(**validated_data)
        if password:
            user.set_password(password)
        # Commodité reprise de la vue Django : si l'identifiant est une adresse
        # e-mail, elle sert d'e-mail. On ne l'applique que si aucun e-mail n'a
        # été saisi, pour ne pas écraser une valeur voulue.
        if not user.email and '@' in user.username:
            user.email = user.username
        user.save()
        if role:
            group, _ = Group.objects.get_or_create(name=role)
            user.groups.add(group)
        return user

    def update(self, instance, validated_data):
        role = validated_data.pop('role', None)
        password = validated_data.pop('password', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        if role:
            instance.groups.clear()
            group, _ = Group.objects.get_or_create(name=role)
            instance.groups.add(group)
        return instance


# ---------- Prospection (cartographie commerciale) ----------
def _url_photo(instance, request):
    """URL absolue de la photo, ou None. Le front est sur un autre domaine que
    l'API : une URL relative ne serait pas résolvable côté navigateur."""
    if not instance.photo:
        return None
    url = instance.photo.url
    return request.build_absolute_uri(url) if request else url


def _nom_utilisateur(user):
    """Nom lisible d'un commercial : « Prénom Nom » si renseigné, sinon le login."""
    if user is None:
        return ''
    complet = user.get_full_name().strip()
    return complet or user.username


class VisiteSerializer(serializers.ModelSerializer):
    point_vente_nom = serializers.CharField(source='point_vente.nom', read_only=True)
    commercial_nom = serializers.SerializerMethodField()
    statut_display = serializers.CharField(
        source='get_statut_constate_display', read_only=True)
    photo_url = serializers.SerializerMethodField()

    # Poser la relance depuis le compte rendu évite au commercial de rouvrir la
    # fiche du point juste après avoir saisi sa visite.
    date_prochaine_relance = serializers.DateField(
        write_only=True, required=False, allow_null=True)

    class Meta:
        model = Visite
        fields = [
            'id', 'point_vente', 'point_vente_nom', 'commercial', 'commercial_nom',
            'date_visite', 'statut_constate', 'statut_display', 'compte_rendu',
            'photo', 'photo_url', 'latitude', 'longitude',
            'date_prochaine_relance',
        ]
        extra_kwargs = {
            'photo': {'write_only': True, 'required': False},
            # Le commercial est déduit de l'utilisateur connecté (voir create).
            'commercial': {'required': False},
        }

    def get_commercial_nom(self, obj):
        return _nom_utilisateur(obj.commercial)

    def get_photo_url(self, obj):
        return _url_photo(obj, self.context.get('request'))

    def validate(self, attrs):
        """Une visite sans trace exploitable n'a pas d'intérêt."""
        instance = self.instance
        compte_rendu = (attrs.get(
            'compte_rendu', getattr(instance, 'compte_rendu', '')) or '').strip()
        photo = attrs.get('photo', getattr(instance, 'photo', None))
        statut = attrs.get(
            'statut_constate', getattr(instance, 'statut_constate', ''))
        if not compte_rendu and not photo and not statut:
            raise serializers.ValidationError(
                'Renseignez au moins un compte rendu, une photo ou un statut.')
        return attrs

    def create(self, validated_data):
        relance = validated_data.pop('date_prochaine_relance', None)
        request = self.context.get('request')
        # Le commercial est celui qui saisit : le laisser choisir permettrait
        # d'attribuer une visite à un collègue, ce que le terrain ne justifie pas.
        if not validated_data.get('commercial') and request and request.user.is_authenticated:
            validated_data['commercial'] = request.user

        visite = super().create(validated_data)
        self._reporter_sur_le_point(visite, relance)
        return visite

    def update(self, instance, validated_data):
        relance = validated_data.pop('date_prochaine_relance', None)
        visite = super().update(instance, validated_data)
        self._reporter_sur_le_point(visite, relance)
        return visite

    @staticmethod
    def _reporter_sur_le_point(visite, relance):
        """Le point de vente affiche l'état issu de la dernière visite.

        Sans cette remontée, la carte continuerait d'afficher « Prospecté » en
        bleu alors que le commercial vient de noter un refus.
        """
        point = visite.point_vente
        champs = []
        if visite.statut_constate and point.statut != visite.statut_constate:
            point.statut = visite.statut_constate
            champs.append('statut')
        if relance is not None:
            point.date_prochaine_relance = relance
            champs.append('date_prochaine_relance')
        # Un point sans commercial attitré revient à celui qui l'a visité.
        if point.commercial_id is None and visite.commercial_id:
            point.commercial_id = visite.commercial_id
            champs.append('commercial')
        if champs:
            point.save(update_fields=champs)


class PointVenteSerializer(serializers.ModelSerializer):
    type_display = serializers.CharField(source='get_type_point_display', read_only=True)
    statut_display = serializers.CharField(source='get_statut_display', read_only=True)
    couleur = serializers.CharField(read_only=True)
    relance_en_retard = serializers.BooleanField(read_only=True)
    commercial_nom = serializers.SerializerMethodField()
    client_nom = serializers.CharField(source='client.nom_complet', read_only=True)
    nb_visites = serializers.SerializerMethodField()
    derniere_visite = serializers.SerializerMethodField()
    photo_url = serializers.SerializerMethodField()

    class Meta:
        model = PointVente
        fields = [
            'id', 'nom', 'type_point', 'type_display',
            'latitude', 'longitude', 'adresse',
            'contact_nom', 'contact_tel', 'contact_email',
            'statut', 'statut_display', 'couleur',
            'potentiel_ca', 'date_prochaine_relance', 'relance_en_retard',
            'commercial', 'commercial_nom', 'client', 'client_nom',
            'nb_visites', 'derniere_visite', 'photo_url', 'cree_le',
        ]

    def get_commercial_nom(self, obj):
        return _nom_utilisateur(obj.commercial)

    def get_nb_visites(self, obj):
        return obj.visites.count()

    def get_derniere_visite(self, obj):
        visite = obj.derniere_visite
        return visite.date_visite if visite else None

    def get_photo_url(self, obj):
        """Dernière photo prise : sert de vignette dans la liste et l'infobulle."""
        visite = obj.visites.exclude(photo='').exclude(photo=None).first()
        return _url_photo(visite, self.context.get('request')) if visite else None

    def validate_latitude(self, value):
        if value is None or not -90 <= value <= 90:
            raise serializers.ValidationError(
                'La latitude doit être comprise entre -90 et 90.')
        return value

    def validate_longitude(self, value):
        if value is None or not -180 <= value <= 180:
            raise serializers.ValidationError(
                'La longitude doit être comprise entre -180 et 180.')
        return value

    def validate_potentiel_ca(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError(
                'Le potentiel commercial ne peut pas être négatif.')
        return value

    def validate(self, attrs):
        """Un point à relancer sans date de relance ne remonterait nulle part."""
        statut = attrs.get('statut', getattr(self.instance, 'statut', 'PROSPECTE'))
        relance = attrs.get(
            'date_prochaine_relance',
            getattr(self.instance, 'date_prochaine_relance', None))
        if statut == 'A_RELANCER' and not relance:
            raise serializers.ValidationError({
                'date_prochaine_relance':
                    'Indiquez la date de relance pour un point « À relancer ».'
            })
        return attrs

    def create(self, validated_data):
        request = self.context.get('request')
        if not validated_data.get('commercial') and request and request.user.is_authenticated:
            validated_data['commercial'] = request.user
        return super().create(validated_data)


class PointVenteDetailSerializer(PointVenteSerializer):
    """Fiche complète : toutes les visites, de la plus récente à la plus ancienne."""
    visites = serializers.SerializerMethodField()

    class Meta(PointVenteSerializer.Meta):
        fields = PointVenteSerializer.Meta.fields + ['visites']

    def get_visites(self, obj):
        return VisiteSerializer(
            obj.visites.select_related('commercial').all(),
            many=True, context=self.context).data


class ConvertirEnClientSerializer(serializers.Serializer):
    """Crée la fiche client d'un point de vente devenu acheteur.

    Le point porte déjà le nom, le téléphone et l'adresse : les ressaisir dans
    « Clients » serait une double saisie, source d'écarts entre les deux fichiers.
    """
    nom_complet = serializers.CharField(max_length=200, required=False, allow_blank=True)
    tel_client = serializers.CharField(max_length=30, required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    adresse = serializers.CharField(required=False, allow_blank=True)

    def __init__(self, *args, point=None, **kwargs):
        super().__init__(*args, **kwargs)
        self.point = point

    def validate(self, attrs):
        if self.point is not None and self.point.client_id:
            raise serializers.ValidationError(
                f'Ce point est déjà rattaché au client « {self.point.client.nom_complet} ».')
        tel = (attrs.get('tel_client') or getattr(self.point, 'contact_tel', '')).strip()
        email = (attrs.get('email') or getattr(self.point, 'contact_email', '')).strip()
        if not tel and not email:
            raise serializers.ValidationError({
                'tel_client': "Indiquez au moins le numéro de téléphone ou l'email : "
                              'un client injoignable ne sert à rien.'
            })
        return attrs

    def creer(self):
        """Crée le client à partir des valeurs saisies, complétées par le point."""
        d = self.validated_data
        point = self.point
        return Client.objects.create(
            nom_complet=(d.get('nom_complet') or point.nom).strip(),
            tel_client=(d.get('tel_client') or point.contact_tel).strip(),
            email=(d.get('email') or point.contact_email).strip(),
            adresse=(d.get('adresse') or point.adresse).strip(),
        )

