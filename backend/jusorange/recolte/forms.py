# Formulaires pour les modèles Producteur et Cueillette
from django import forms
from .models import Producteur, Cueillette


# Formulaire pour ajouter/modifier un producteur
class ProducteurForm(forms.ModelForm):
    class Meta:
        model = Producteur
        fields = ['nom_complet', 'zone', 'contact', 'adresse', 'actif']
        widgets = {
            'nom_complet': forms.TextInput(attrs={'class': 'form-input', 'placeholder': 'Ex: Moussa Diallo'}),
            'zone': forms.TextInput(attrs={'class': 'form-input', 'placeholder': 'Ex: Nord'}),
            'contact': forms.TextInput(attrs={'class': 'form-input', 'placeholder': 'Ex: 77 123 45 67'}),
            'adresse': forms.Textarea(attrs={'class': 'form-input', 'rows': 3, 'placeholder': 'Adresse complète (optionnel)'}),
            'actif': forms.CheckboxInput(attrs={'class': 'form-checkbox'}),
        }


# Formulaire pour ajouter/modifier une cueillette
# qte_mauvais n'apparait pas car il est calculé automatiquement (qte_total - qte_bon)
# taux_qualite n'apparait pas car il est calculé automatiquement (qte_bon / qte_total * 100)
class CueilletteForm(forms.ModelForm):
    class Meta:
        model = Cueillette
        fields = ['producteur', 'date_cueil', 'qte_total', 'qte_bon', 'observation']
        widgets = {
            'producteur': forms.Select(attrs={'class': 'form-input'}),
            'date_cueil': forms.DateInput(attrs={'class': 'form-input', 'type': 'date'}),
            'qte_total': forms.NumberInput(attrs={'class': 'form-input', 'placeholder': 'Ex: 200', 'min': '0', 'step': '0.1'}),
            'qte_bon': forms.NumberInput(attrs={'class': 'form-input', 'placeholder': 'Ex: 180', 'min': '0', 'step': '0.1'}),
            'observation': forms.Textarea(attrs={'class': 'form-input', 'rows': 3, 'placeholder': 'Remarque (optionnel)'}),
        }

    # Validation : qte_bon ne peut pas dépasser qte_total
    def clean(self):
        cleaned_data = super().clean()
        qte_total = cleaned_data.get('qte_total')
        qte_bon = cleaned_data.get('qte_bon')

        if qte_total is not None and qte_bon is not None:
            if qte_bon > qte_total:
                raise forms.ValidationError("La quantité bonne ne peut pas dépasser la quantité totale.")
            if qte_total < 0 or qte_bon < 0:
                raise forms.ValidationError("Les quantités ne peuvent pas être négatives.")

        return cleaned_data
