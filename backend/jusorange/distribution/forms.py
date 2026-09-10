from django import forms
from .models import Client, Vente, Commande, Facture, Paiement, ReceptionPaiement


class CompleterCommandeForm(forms.Form):
    """Formulaire pour compléter une commande avec choix du statut de paiement."""
    STATUT_CHOICES = [
        ('DEPOT_VENTE', 'Dépôt-vente'),
        ('PARTIELLE', 'Partielle'),
        ('ACHAT_VENTE', 'Achat-vente'),
    ]
    statut_paiement = forms.ChoiceField(
        choices=STATUT_CHOICES,
        widget=forms.RadioSelect(attrs={'class': 'form-radio'}),
        label='Statut du paiement',
        initial='DEPOT_VENTE'
    )
    montant_paye = forms.FloatField(
        required=False,
        min_value=0,
        label='Montant déjà payé (si partielle)',
        widget=forms.NumberInput(attrs={
            'class': 'form-input',
            'min': '0',
            'step': '0.01',
            'placeholder': 'Ex: 2500',
            'id': 'id_montant_paye'
        }),
        help_text='Uniquement si "Partielle" est sélectionné'
    )

    def __init__(self, *args, montant_total=None, **kwargs):
        super().__init__(*args, **kwargs)
        self.montant_total = montant_total

    def clean(self):
        cleaned = super().clean()
        statut = cleaned.get('statut_paiement')
        montant = cleaned.get('montant_paye')
        if statut == 'PARTIELLE':
            if montant is None or montant <= 0:
                raise forms.ValidationError(
                    'Indiquez le montant déjà payé pour un paiement partiel.'
                )
            if self.montant_total and montant >= self.montant_total:
                raise forms.ValidationError(
                    'Pour un paiement partiel, le montant payé doit être inférieur au montant total.'
                )
        return cleaned


class ClientForm(forms.ModelForm):
    class Meta:
        model = Client
        fields = ['nom_complet', 'tel_client', 'email', 'adresse']
        widgets = {
            'nom_complet': forms.TextInput(attrs={'class': 'form-input', 'placeholder': 'Nom complet'}),
            'tel_client': forms.TextInput(attrs={'class': 'form-input', 'placeholder': 'ex: 70 111 22 33'}),
            'email': forms.EmailInput(attrs={'class': 'form-input', 'placeholder': 'email@exemple.com'}),
            'adresse': forms.Textarea(attrs={'class': 'form-input', 'rows': 3, 'placeholder': 'Adresse'}),
        }

    def clean(self):
        cleaned = super().clean()
        tel = (cleaned.get('tel_client') or '').strip()
        email = (cleaned.get('email') or '').strip()
        if not tel and not email:
            raise forms.ValidationError(
                'Indiquez au moins le numéro de téléphone ou l\'email.'
            )
        return cleaned


class VenteForm(forms.ModelForm):
    class Meta:
        model = Vente
        fields = ['client', 'date_vente', 'montant_total', 'statut_paiement']
        widgets = {
            'client': forms.Select(attrs={'class': 'form-input'}),
            'date_vente': forms.DateInput(attrs={'class': 'form-input', 'type': 'date'}),
            'montant_total': forms.NumberInput(attrs={'class': 'form-input', 'min': '0', 'step': '0.01'}),
            'statut_paiement': forms.Select(attrs={'class': 'form-input'}),
        }


class CommandeForm(forms.ModelForm):
    class Meta:
        model = Commande
        fields = ['client', 'date_cmd', 'quantite_33cl', 'quantite_1l']
        widgets = {
            'client': forms.Select(attrs={'class': 'form-input'}),
            'date_cmd': forms.DateInput(attrs={'class': 'form-input', 'type': 'date'}),
            'quantite_33cl': forms.NumberInput(attrs={'class': 'form-input', 'min': '0'}),
            'quantite_1l': forms.NumberInput(attrs={'class': 'form-input', 'min': '0'}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if not self.instance.pk:
            from django.utils import timezone
            self.fields['date_cmd'].initial = timezone.now().date()

    def clean(self):
        cleaned = super().clean()
        qte_33 = cleaned.get('quantite_33cl') or 0
        qte_1l = cleaned.get('quantite_1l') or 0
        if qte_33 <= 0 and qte_1l <= 0:
            raise forms.ValidationError(
                'Indiquez au moins une quantité (33cl ou 1L, ou les deux).'
            )
        return cleaned


class FactureForm(forms.ModelForm):
    class Meta:
        model = Facture
        fields = ['vente', 'date_fact', 'montant', 'statut', 'date_echeance']
        widgets = {
            'vente': forms.Select(attrs={'class': 'form-input'}),
            'date_fact': forms.DateInput(attrs={'class': 'form-input', 'type': 'date'}),
            'montant': forms.NumberInput(attrs={'class': 'form-input', 'min': '0', 'step': '0.01'}),
            'statut': forms.Select(attrs={'class': 'form-input'}),
            'date_echeance': forms.DateInput(attrs={'class': 'form-input', 'type': 'date'}),
        }


class PaiementForm(forms.ModelForm):
    class Meta:
        model = Paiement
        fields = ['facture', 'date_paie', 'montant', 'mode_paie', 'reference']
        widgets = {
            'facture': forms.Select(attrs={'class': 'form-input'}),
            'date_paie': forms.DateInput(attrs={'class': 'form-input', 'type': 'date'}),
            'montant': forms.NumberInput(attrs={'class': 'form-input', 'min': '0', 'step': '0.01'}),
            'mode_paie': forms.Select(attrs={'class': 'form-input'}),
            'reference': forms.TextInput(attrs={'class': 'form-input', 'placeholder': 'Référence chèque, virement...'}),
        }


class PaiementFactureForm(forms.ModelForm):
    """Formulaire pour enregistrer un paiement sur une facture (depuis détail vente)."""
    class Meta:
        model = Paiement
        fields = ['date_paie', 'montant', 'mode_paie', 'reference']
        widgets = {
            'date_paie': forms.DateInput(attrs={'class': 'form-input', 'type': 'date'}),
            'montant': forms.NumberInput(attrs={'class': 'form-input', 'min': '0', 'step': '0.01', 'placeholder': 'Montant'}),
            'mode_paie': forms.Select(attrs={'class': 'form-input'}),
            'reference': forms.TextInput(attrs={'class': 'form-input', 'placeholder': 'Référence (optionnel)'}),
        }

    def __init__(self, *args, facture=None, reste_a_payer=None, **kwargs):
        super().__init__(*args, **kwargs)
        self.facture = facture
        self.reste_a_payer = reste_a_payer or 0
        if not self.instance.pk:
            from django.utils import timezone
            self.fields['date_paie'].initial = timezone.now().date()
            self.fields['montant'].widget.attrs['placeholder'] = f'Reste: {self.reste_a_payer:.0f} XOF'

    def clean_montant(self):
        montant = self.cleaned_data.get('montant') or 0
        if montant <= 0:
            raise forms.ValidationError('Le montant doit être supérieur à 0.')
        if self.reste_a_payer and montant > self.reste_a_payer:
            raise forms.ValidationError(
                f'Le montant ne peut pas dépasser le reste à payer ({self.reste_a_payer:.0f} XOF).'
            )
        return montant


class ReceptionPaiementForm(forms.ModelForm):
    """Formulaire pour enregistrer une réception paiement côté trésorerie."""
    class Meta:
        model = ReceptionPaiement
        fields = ['paiement', 'montant_recu', 'date_reception']
        widgets = {
            'paiement': forms.Select(attrs={'class': 'form-input'}),
            'montant_recu': forms.NumberInput(attrs={'class': 'form-input', 'min': '0', 'step': '0.01', 'placeholder': 'Montant effectivement reçu'}),
            'date_reception': forms.DateInput(attrs={'class': 'form-input', 'type': 'date'}),
        }

    def __init__(self, *args, paiement_fixe=None, **kwargs):
        super().__init__(*args, **kwargs)
        # Paiements sans réception trésorerie (pour nouvelle réception uniquement)
        if not self.instance.pk:
            deja_recus = ReceptionPaiement.objects.values_list('paiement_id', flat=True)
            qs = Paiement.objects.select_related(
                'facture', 'facture__vente', 'facture__vente__client'
            ).exclude(pk__in=deja_recus).order_by('-date_paie')
            if paiement_fixe:
                # Venant de la page Trésorerie : paiement pré-sélectionné, pas de liste déroulante
                self.fields['paiement'].widget = forms.HiddenInput()
                self.fields['paiement'].label = ''
                self.fields['paiement'].queryset = Paiement.objects.filter(pk=paiement_fixe.pk)
                self.initial['paiement'] = paiement_fixe.pk
                self.fields['montant_recu'].widget.attrs['placeholder'] = f'Montant déclaré : {paiement_fixe.montant:.0f} XOF'
            else:
                self.fields['paiement'].queryset = qs
                self.fields['paiement'].label_from_instance = lambda obj: (
                    f"{obj.facture.vente.client.nom_complet} — {obj.montant:.0f} XOF — {obj.get_mode_paie_display()} — {obj.date_paie.strftime('%d/%m/%Y')}"
                )
        if not self.instance.pk:
            from django.utils import timezone
            self.fields['date_reception'].initial = timezone.now().date()

    def clean_montant_recu(self):
        montant = self.cleaned_data.get('montant_recu') or 0
        if montant < 0:
            raise forms.ValidationError('Le montant reçu ne peut pas être négatif.')
        return montant


class GererEcartForm(forms.ModelForm):
    """Formulaire pour gérer un écart : justification uniquement."""
    class Meta:
        model = ReceptionPaiement
        fields = ['observation']
        widgets = {
            'observation': forms.Textarea(attrs={'class': 'form-input', 'rows': 4, 'placeholder': 'Justification de l\'écart...'}),
        }


class ReceptionPaiementModifierForm(forms.ModelForm):
    """Formulaire pour modifier une réception (correction d'erreur du trésorier)."""
    class Meta:
        model = ReceptionPaiement
        fields = ['montant_recu', 'date_reception']
        widgets = {
            'montant_recu': forms.NumberInput(attrs={'class': 'form-input', 'min': '0', 'step': '0.01'}),
            'date_reception': forms.DateInput(attrs={'class': 'form-input', 'type': 'date'}),
        }
