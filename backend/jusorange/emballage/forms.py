from datetime import timedelta
from django import forms
from appro.models import ArticleStock
from .models import Conditionnement, Bouteille


def add_months(date, months):
    """Ajoute un nombre de mois à une date."""
    months = int(months)
    new_month = date.month + months
    year = date.year + (new_month - 1) // 12
    new_month = (new_month - 1) % 12 + 1
    return date.replace(year=year, month=new_month)


class ConditionnementForm(forms.ModelForm):
    nb_jours = forms.IntegerField(
        required=False,
        min_value=1,
        label='DLC : nombre de jours après la date de conditionnement',
        widget=forms.NumberInput(attrs={'class': 'form-input', 'placeholder': 'ex: 90'}),
        help_text='Renseignez soit les jours, soit les mois (pas les deux)'
    )
    nb_mois = forms.IntegerField(
        required=False,
        min_value=1,
        label='DLC : nombre de mois après la date de conditionnement',
        widget=forms.NumberInput(attrs={'class': 'form-input', 'placeholder': 'ex: 6'}),
        help_text='Renseignez soit les jours, soit les mois (pas les deux)'
    )

    class Meta:
        model = Conditionnement
        fields = ['date_cond', 'production', 'qte_33cl', 'qte_1l', 'volume_utilisee', 'observation', 'user']
        widgets = {
            'date_cond': forms.DateInput(attrs={'class': 'form-input', 'type': 'date'}),
            'production': forms.Select(attrs={'class': 'form-input'}),
            'user': forms.Select(attrs={'class': 'form-input'}),
            'observation': forms.Textarea(attrs={'class': 'form-input', 'rows': 3, 'placeholder': 'Obligatoire'}),
            'volume_utilisee': forms.NumberInput(attrs={'class': 'form-input', 'min': '0', 'step': '0.1', 'placeholder': 'Obligatoire'}),
            'qte_33cl': forms.NumberInput(attrs={'class': 'form-input', 'min': '0', 'placeholder': 'Au moins 33cl ou 1L'}),
            'qte_1l': forms.NumberInput(attrs={'class': 'form-input', 'min': '0', 'placeholder': 'Au moins 33cl ou 1L'}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance and self.instance.pk and self.instance.dlc and self.instance.date_cond:
            diff = (self.instance.dlc - self.instance.date_cond).days
            if diff > 0:
                self.fields['nb_jours'].initial = diff

        # Filtrer les productions : terminées et non encore conditionnées
        from fabrication.models import Production
        productions_disponibles = Production.objects.filter(
            statut_production='TERMINEE',
            conditionnement__isnull=True
        )
        if self.instance and self.instance.pk and self.instance.production_id:
            productions_disponibles = productions_disponibles | Production.objects.filter(pk=self.instance.production_id)
        self.fields['production'].queryset = productions_disponibles.distinct()
        self.fields['production'].help_text = 'Seules les productions terminées et non encore conditionnées sont proposées.'

    def clean(self):
        cleaned = super().clean()
        volume = cleaned.get('volume_utilisee')
        observation = cleaned.get('observation')
        qte_33cl = cleaned.get('qte_33cl') or 0
        qte_1l = cleaned.get('qte_1l') or 0
        nb_jours = cleaned.get('nb_jours')
        nb_mois = cleaned.get('nb_mois')

        if volume is None or volume <= 0:
            self.add_error('volume_utilisee', 'Le volume utilisée (L) est obligatoire et doit être supérieur à 0.')

        if not (observation and str(observation).strip()):
            self.add_error('observation', "L'observation est obligatoire.")

        if qte_33cl <= 0 and qte_1l <= 0:
            self.add_error('qte_33cl', 'Renseignez au moins la quantité 33cl ou la quantité 1L.')
            self.add_error('qte_1l', 'Renseignez au moins la quantité 33cl ou la quantité 1L.')
        else:
            try:
                art_33cl = ArticleStock.objects.get(type_art='bouteille_vide_33cl')
                if qte_33cl > 0 and art_33cl.qte_art < qte_33cl:
                    self.add_error('qte_33cl', f'Stock insuffisant 33cl : {art_33cl.qte_art:.0f} bouteilles vides disponibles, {qte_33cl} demandées.')
            except ArticleStock.DoesNotExist:
                if qte_33cl > 0:
                    self.add_error('qte_33cl', "L'article 'Bouteille vide 33cl' n'existe pas. Paramétrez-le d'abord dans Articles.")
            try:
                art_1l = ArticleStock.objects.get(type_art='bouteille_vide_1l')
                if qte_1l > 0 and art_1l.qte_art < qte_1l:
                    self.add_error('qte_1l', f'Stock insuffisant 1L : {art_1l.qte_art:.0f} bouteilles vides disponibles, {qte_1l} demandées.')
            except ArticleStock.DoesNotExist:
                if qte_1l > 0:
                    self.add_error('qte_1l', "L'article 'Bouteille vide 1L' n'existe pas. Paramétrez-le d'abord dans Articles.")

        if nb_jours and nb_mois:
            self.add_error('nb_jours', 'Renseignez soit les jours, soit les mois, pas les deux.')
            self.add_error('nb_mois', 'Renseignez soit les jours, soit les mois, pas les deux.')
        elif not nb_jours and not nb_mois:
            self.add_error('nb_jours', 'Renseignez le nombre de jours ou le nombre de mois pour la DLC.')
            self.add_error('nb_mois', 'Renseignez le nombre de jours ou le nombre de mois pour la DLC.')

        # Vérifier que la production n'est pas déjà utilisée (sauf en modification)
        production = cleaned.get('production')
        if production and not (self.instance and self.instance.pk and self.instance.production_id == production.pk):
            if hasattr(production, 'conditionnement') and production.conditionnement:
                self.add_error('production', 'Cette production a déjà été conditionnée.')

        return cleaned

    def save(self, commit=True):
        instance = super().save(commit=False)
        date_cond = instance.date_cond
        nb_jours = self.cleaned_data.get('nb_jours')
        nb_mois = self.cleaned_data.get('nb_mois')

        if nb_jours:
            instance.dlc = date_cond + timedelta(days=nb_jours)
        elif nb_mois:
            instance.dlc = add_months(date_cond, nb_mois)

        if commit:
            instance.save()
        return instance


class BouteilleForm(forms.ModelForm):
    class Meta:
        model = Bouteille
        fields = '__all__'
        widgets = {
            'dlc': forms.DateInput(attrs={'class': 'form-input', 'type': 'date'}),
            'conditionnement': forms.Select(attrs={'class': 'form-input'}),
            'article_stock': forms.Select(attrs={'class': 'form-input'}),
        }