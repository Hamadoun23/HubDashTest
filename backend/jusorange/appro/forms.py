from django import forms
from django.db.models import Sum
from .models import ArticleStock, Reception
from recolte.models import Cueillette


# Formulaire pour PARAMETRER un article (créer : définir type + seuil d'alerte)
# Les types jus_33cl et jus_1l sont exclus (créés par migration, gérés automatiquement)
class ArticleStockCreateForm(forms.ModelForm):
    class Meta:
        model = ArticleStock
        fields = ['type_art', 'seuil_alerte']
        widgets = {
            'type_art': forms.Select(attrs={'class': 'form-input'}),
            'seuil_alerte': forms.NumberInput(attrs={'class': 'form-input', 'placeholder': 'Ex: 50', 'min': '0', 'step': '0.1'}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # À la création, exclure uniquement les types créés/gérés automatiquement :
        # - orange_dispo : créé automatiquement par les réceptions
        # - jus_33cl, jus_1l : créés par migration (prix gérés à part)
        # Les bouteilles vides (bouteille_vide_33cl, bouteille_vide_1l) sont incluses
        # pour permettre leur création manuelle après vidage de la base
        if not self.instance or not self.instance.pk:
            exclude = ('orange_dispo', 'jus_33cl', 'jus_1l')
            choices = [(k, v) for k, v in ArticleStock.TYPE_CHOICES if k not in exclude]
            self.fields['type_art'].choices = choices


# Formulaire pour ACTUALISER le stock d'un article (ajouter une quantité au stock existant)
class ArticleStockUpdateForm(forms.Form):
    qte_ajout = forms.FloatField(
        label="Quantité à ajouter",
        min_value=0,
        widget=forms.NumberInput(attrs={'class': 'form-input', 'placeholder': 'Ex: 100', 'min': '0', 'step': '0.1'}),
    )


# Formulaire pour ajouter/modifier une réception
# qte_mauvais, taux_qualite, etat_qualite et num_recp sont calculés automatiquement
# Les oranges disponibles sont mises à jour automatiquement
# RÈGLE : on ne peut réceptionner que les qte_bon d'une cueillette
# Le total des réceptions pour une cueillette ne doit pas dépasser sa qte_bon
class ReceptionForm(forms.ModelForm):
    class Meta:
        model = Reception
        fields = ['cueillette', 'date_recp', 'qte_recue', 'qte_bon', 'lieu_depot', 'cause_perte']
        widgets = {
            'cueillette': forms.Select(attrs={'class': 'form-input', 'id': 'id_cueillette'}),
            'date_recp': forms.DateInput(attrs={'class': 'form-input', 'type': 'date'}),
            'qte_recue': forms.NumberInput(attrs={'class': 'form-input', 'placeholder': 'Ex: 200', 'min': '0', 'step': '0.1'}),
            'qte_bon': forms.NumberInput(attrs={'class': 'form-input', 'placeholder': 'Ex: 180', 'min': '0', 'step': '0.1'}),
            'lieu_depot': forms.TextInput(attrs={'class': 'form-input', 'placeholder': 'Ex: Entrepôt A'}),
            'cause_perte': forms.Textarea(attrs={'class': 'form-input', 'rows': 3, 'placeholder': 'Cause de perte (optionnel)'}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        # Si réception avec cueillette supprimée, le champ cueillette devient optionnel et masqué
        if self.instance and self.instance.pk and not self.instance.cueillette_id:
            self.fields['cueillette'].required = False
            self.fields['cueillette'].widget = forms.HiddenInput()

        # Filtrer : afficher uniquement les cueillettes qui ont encore des oranges à réceptionner
        cueillettes_disponibles = []
        for c in Cueillette.objects.all():
            # Calculer le total déjà réceptionné pour cette cueillette
            total_deja_recu = c.receptions.aggregate(total=Sum('qte_recue'))['total'] or 0
            # Si on modifie une réception existante, exclure sa propre qte de la somme
            if self.instance and self.instance.pk and self.instance.cueillette_id == c.pk:
                total_deja_recu -= (self.instance.qte_recue or 0)
            restant = c.qte_bon - total_deja_recu
            if restant > 0:
                cueillettes_disponibles.append(c.pk)

        self.fields['cueillette'].queryset = Cueillette.objects.filter(pk__in=cueillettes_disponibles)

        # Personnaliser l'affichage du dropdown pour montrer le restant
        self.fields['cueillette'].label_from_instance = self._label_cueillette

    def _label_cueillette(self, obj):
        """Afficher le producteur, la date et la quantité restante à réceptionner."""
        total_deja_recu = obj.receptions.aggregate(total=Sum('qte_recue'))['total'] or 0
        # Si on modifie une réception existante, exclure sa propre qte
        if self.instance and self.instance.pk and self.instance.cueillette_id == obj.pk:
            total_deja_recu -= (self.instance.qte_recue or 0)
        restant = obj.qte_bon - total_deja_recu
        nom_prod = obj.get_producteur_display()
        return f"{nom_prod} - {obj.date_cueil} | Qté bonne: {obj.qte_bon} kg | Restant: {restant} kg"

    # Validation
    def clean(self):
        cleaned_data = super().clean()
        cueillette = cleaned_data.get('cueillette')
        qte_recue = cleaned_data.get('qte_recue')
        qte_bon = cleaned_data.get('qte_bon')

        # Vérification qte_bon <= qte_recue
        if qte_recue is not None and qte_bon is not None:
            if qte_bon > qte_recue:
                raise forms.ValidationError("La quantité bonne ne peut pas dépasser la quantité reçue.")
            if qte_recue < 0 or qte_bon < 0:
                raise forms.ValidationError("Les quantités ne peuvent pas être négatives.")

        # Vérification : le total réceptionné ne doit pas dépasser la qte_bon de la cueillette
        # (sauf si réception avec cueillette supprimée : pas de validation cueillette)
        if cueillette and qte_recue is not None:
            total_deja_recu = cueillette.receptions.aggregate(total=Sum('qte_recue'))['total'] or 0
            # Si on modifie une réception existante, exclure sa propre qte
            if self.instance and self.instance.pk and self.instance.cueillette_id == cueillette.pk:
                total_deja_recu -= (self.instance.qte_recue or 0)
            restant = cueillette.qte_bon - total_deja_recu

            if qte_recue > restant:
                raise forms.ValidationError(
                    f"La quantité reçue ({qte_recue} kg) dépasse le restant à réceptionner "
                    f"pour cette cueillette. "
                    f"Qté bonne de la cueillette : {cueillette.qte_bon} kg, "
                    f"déjà réceptionné : {total_deja_recu} kg, "
                    f"restant disponible : {restant} kg."
                )

        return cleaned_data
