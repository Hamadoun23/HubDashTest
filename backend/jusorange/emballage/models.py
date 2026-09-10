from django.db import models
from django.contrib.auth.models import User
from appro.models import ArticleStock
from fabrication.models import Production


class Conditionnement(models.Model):
    """Conditionnement : mise en bouteille d'une production."""

    date_cond = models.DateField(verbose_name='Date de conditionnement')
    numero_cond = models.CharField(max_length=30, editable=False, blank=True, verbose_name='N° conditionnement')
    qte_33cl = models.IntegerField(default=0, verbose_name='Quantité 33cl')
    qte_1l = models.IntegerField(default=0, verbose_name='Quantité 1L')
    volume_utilisee = models.FloatField(default=0, verbose_name='Volume utilisée (L)')
    dlc = models.DateField(verbose_name='Date limite de consommation')
    observation = models.TextField(blank=True, null=True)
    production = models.OneToOneField(
        Production,
        on_delete=models.CASCADE,
        related_name='conditionnement',
        verbose_name='Production'
    )
    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='conditionnements',
        verbose_name='Responsable'
    )

    def save(self, *args, **kwargs):
        if not self.numero_cond:
            date_str = self.date_cond.strftime('%d%m%Y')
            count = Conditionnement.objects.filter(date_cond=self.date_cond).count()
            self.numero_cond = f"COND{count + 1:03d}{date_str}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.numero_cond} - {self.date_cond}"

    class Meta:
        ordering = ['-date_cond']
        verbose_name = "Conditionnement"
        verbose_name_plural = "Conditionnements"


class Bouteille(models.Model):
    """Bouteille : unité physique issue d'un conditionnement."""

    STATUT_STOCK_CHOICES = [
        ('DISPO', 'Disponible'),
        ('VENDUE', 'Vendue'),
        ('PERIMEE', 'Périmée'),
        ('REBUT', 'Rebut'),
    ]

    format_33cl = models.IntegerField(default=0, verbose_name='Format 33cl (1=33cl, 0=non)')
    format_1l = models.IntegerField(default=0, verbose_name='Format 1L (1=1L, 0=non)')
    codebar = models.CharField(max_length=100, blank=True, verbose_name='Code-barres')
    dlc = models.DateField(verbose_name='Date limite de consommation')
    statut_stock = models.CharField(
        max_length=20,
        choices=STATUT_STOCK_CHOICES,
        default='DISPO',
        verbose_name='Statut stock'
    )
    date_creation = models.DateField(auto_now_add=True, verbose_name='Date création')
    article_stock = models.ForeignKey(
        ArticleStock,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='bouteilles',
        verbose_name='Article stock'
    )
    conditionnement = models.ForeignKey(
        Conditionnement,
        on_delete=models.CASCADE,
        related_name='bouteilles',
        verbose_name='Conditionnement'
    )
    commande = models.ForeignKey(
        'distribution.Commande',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='bouteilles',
        verbose_name='Commande'
    )

    def get_format_display(self):
        if self.format_1l:
            return '1 L'
        return '33 cl'

    def __str__(self):
        return f"{self.codebar or self.pk} - {self.get_format_display()} - {self.statut_stock}"

    class Meta:
        ordering = ['-date_creation']
        verbose_name = "Bouteille"
        verbose_name_plural = "Bouteilles"