from django import forms
from .models import Production

# Choix Oui/Non pour les champs booléens obligatoires
OUI_NON_CHOICES = [('True', 'Oui'), ('False', 'Non')]


# Étape 1 : Programmer une production (date + recette uniquement)
class ProductionCreateForm(forms.ModelForm):
    class Meta:
        model = Production
        fields = ['date_of', 'recette']
        widgets = {
            'date_of': forms.DateInput(attrs={'class': 'form-input', 'type': 'date'}),
            'recette': forms.Select(attrs={'class': 'form-input'}),
        }


# Étape 2 : Compléter la production (tous les autres champs)
# date_of, recette, numero_of, statut_production sont exclus (statut forcé à TERMINEE dans la vue)
class ProductionCompleteForm(forms.ModelForm):
    lavage_effectue = forms.TypedChoiceField(
        choices=OUI_NON_CHOICES,
        widget=forms.RadioSelect(attrs={'class': 'form-check-input'}),
        coerce=lambda x: x == 'True',
        required=True,
        label='Lavage effectué',
    )
    filtration_effectuee = forms.TypedChoiceField(
        choices=OUI_NON_CHOICES,
        widget=forms.RadioSelect(attrs={'class': 'form-check-input'}),
        coerce=lambda x: x == 'True',
        required=True,
        label='Filtration effectuée',
    )
    pasteurisation_80c = forms.TypedChoiceField(
        choices=OUI_NON_CHOICES,
        widget=forms.RadioSelect(attrs={'class': 'form-check-input'}),
        coerce=lambda x: x == 'True',
        required=True,
        label='Pasteurisation 80°C',
    )

    class Meta:
        model = Production
        exclude = ['date_of', 'recette', 'numero_of', 'statut_production', 'user']
        widgets = {
            'test_qualite': forms.Select(attrs={'class': 'form-select'}),
            'eau_ajoutee_l': forms.NumberInput(attrs={'class': 'form-control', 'min': '0', 'step': '0.1', 'placeholder': 'ex: 500 litres'}),
            'sucre_ajoute_kg': forms.NumberInput(attrs={'class': 'form-control', 'min': '0', 'step': '0.1', 'placeholder': 'ex: 50 kg'}),
            'sorbate_ajoute_g': forms.NumberInput(attrs={'class': 'form-control', 'min': '0', 'step': '0.1', 'placeholder': 'ex: 100 g'}),
            'ph': forms.NumberInput(attrs={'class': 'form-control', 'min': '0', 'max': '10', 'step': '1', 'placeholder': '0 à 10'}),
            'refractometre': forms.NumberInput(attrs={'class': 'form-control', 'min': '0', 'max': '20', 'step': '1', 'placeholder': '0 à 20'}),
            'volume_final_l': forms.NumberInput(attrs={'class': 'form-control', 'min': '0', 'step': '0.1', 'placeholder': '1000 litres'}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Initialiser les champs Oui/Non avec la valeur du modèle si existant
        if self.instance and self.instance.pk:
            self.fields['lavage_effectue'].initial = str(self.instance.lavage_effectue)
            self.fields['filtration_effectuee'].initial = str(self.instance.filtration_effectuee)
            self.fields['pasteurisation_80c'].initial = str(self.instance.pasteurisation_80c)
        # Champs numériques vides par défaut (placeholder uniquement)
        for f in ['eau_ajoutee_l', 'sucre_ajoute_kg', 'sorbate_ajoute_g', 'volume_final_l']:
            if self.instance and getattr(self.instance, f, 0) == 0:
                self.fields[f].initial = None

    def clean_ph(self):
        ph = self.cleaned_data.get('ph')
        if ph is not None and (ph < 0 or ph > 10):
            raise forms.ValidationError('Le pH doit être un entier entre 0 et 10.')
        return ph

    def clean_refractometre(self):
        refract = self.cleaned_data.get('refractometre')
        if refract is not None and (refract < 0 or refract > 20):
            raise forms.ValidationError('Le réfractomètre doit être un entier entre 0 et 20.')
        return refract


# Formulaire pour modifier une production (terminée, bloquée, annulée)
class ProductionModifierForm(forms.ModelForm):
    lavage_effectue = forms.TypedChoiceField(
        choices=OUI_NON_CHOICES,
        widget=forms.RadioSelect(attrs={'class': 'form-check-input'}),
        coerce=lambda x: x == 'True',
        required=True,
        label='Lavage effectué',
    )
    filtration_effectuee = forms.TypedChoiceField(
        choices=OUI_NON_CHOICES,
        widget=forms.RadioSelect(attrs={'class': 'form-check-input'}),
        coerce=lambda x: x == 'True',
        required=True,
        label='Filtration effectuée',
    )
    pasteurisation_80c = forms.TypedChoiceField(
        choices=OUI_NON_CHOICES,
        widget=forms.RadioSelect(attrs={'class': 'form-check-input'}),
        coerce=lambda x: x == 'True',
        required=True,
        label='Pasteurisation 80°C',
    )

    class Meta:
        model = Production
        exclude = ['numero_of', 'user']
        widgets = {
            'date_of': forms.DateInput(attrs={'class': 'form-control', 'type': 'date'}),
            'recette': forms.Select(attrs={'class': 'form-select'}),
            'statut_production': forms.Select(attrs={'class': 'form-select'}),
            'test_qualite': forms.Select(attrs={'class': 'form-select'}),
            'eau_ajoutee_l': forms.NumberInput(attrs={'class': 'form-control', 'min': '0', 'step': '0.1', 'placeholder': 'ex: 500 litres'}),
            'sucre_ajoute_kg': forms.NumberInput(attrs={'class': 'form-control', 'min': '0', 'step': '0.1', 'placeholder': 'ex: 50 kg'}),
            'sorbate_ajoute_g': forms.NumberInput(attrs={'class': 'form-control', 'min': '0', 'step': '0.1', 'placeholder': 'ex: 100 g'}),
            'ph': forms.NumberInput(attrs={'class': 'form-control', 'min': '0', 'max': '10', 'step': '1', 'placeholder': '0 à 10'}),
            'refractometre': forms.NumberInput(attrs={'class': 'form-control', 'min': '0', 'max': '20', 'step': '1', 'placeholder': '0 à 20'}),
            'volume_final_l': forms.NumberInput(attrs={'class': 'form-control', 'min': '0', 'step': '0.1', 'placeholder': '1000 litres'}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance and self.instance.pk:
            self.fields['lavage_effectue'].initial = str(self.instance.lavage_effectue)
            self.fields['filtration_effectuee'].initial = str(self.instance.filtration_effectuee)
            self.fields['pasteurisation_80c'].initial = str(self.instance.pasteurisation_80c)
        # Champs numériques vides par défaut (placeholder uniquement)
        for f in ['eau_ajoutee_l', 'sucre_ajoute_kg', 'sorbate_ajoute_g', 'volume_final_l']:
            if self.instance and getattr(self.instance, f, 0) == 0:
                self.fields[f].initial = None

    def clean_ph(self):
        ph = self.cleaned_data.get('ph')
        if ph is not None and (ph < 0 or ph > 10):
            raise forms.ValidationError('Le pH doit être un entier entre 0 et 10.')
        return ph

    def clean_refractometre(self):
        refract = self.cleaned_data.get('refractometre')
        if refract is not None and (refract < 0 or refract > 20):
            raise forms.ValidationError('Le réfractomètre doit être un entier entre 0 et 20.')
        return refract
