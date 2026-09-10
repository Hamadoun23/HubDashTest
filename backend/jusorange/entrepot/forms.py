# entrepot/forms.py
from django import forms
from .models import Inventaire


class InventaireForm(forms.ModelForm):
    class Meta:
        model = Inventaire
        fields = ['date_inv', 'article', 'qte_depot', 'statut', 'observation', 'user']
        widgets = {
            'date_inv': forms.DateInput(attrs={'class': 'form-input', 'type': 'date'}),
            'article': forms.Select(attrs={'class': 'form-input'}),
            'qte_depot': forms.NumberInput(attrs={'class': 'form-input', 'min': '0', 'step': '0.1', 'placeholder': 'Résultat du comptage physique'}),
            'statut': forms.Select(attrs={'class': 'form-input'}),
            'observation': forms.Textarea(attrs={'class': 'form-input', 'rows': 3, 'placeholder': 'Remarques sur l\'inventaire'}),
            'user': forms.Select(attrs={'class': 'form-input'}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['qte_depot'].help_text = "Renseignez le résultat du comptage physique. La quantité système, l'écart et la qualité sont calculés automatiquement."
        self.fields['observation'].required = False
        self.fields['observation'].help_text = "À renseigner après l'inventaire, une fois le statut passé à « Terminé »."

    def clean(self):
        cleaned_data = super().clean()
        statut = cleaned_data.get('statut')
        observation = (cleaned_data.get('observation') or '').strip()
        if statut == 'TERMINE' and not observation:
            self.add_error('observation', "L'observation est obligatoire une fois l'inventaire terminé.")
        return cleaned_data


class InventaireObservationForm(forms.ModelForm):
    """Formulaire dédié pour saisir ou modifier l'observation d'un inventaire."""
    class Meta:
        model = Inventaire
        fields = ['observation']
        widgets = {
            'observation': forms.Textarea(attrs={'class': 'form-input', 'rows': 4, 'placeholder': 'Saisissez vos remarques après l\'inventaire...'}),
        }