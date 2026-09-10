# entrepot/models.py
from django.db import models
from django.contrib.auth.models import User
from appro.models import ArticleStock


class Inventaire(models.Model):
    """Inventaire : comptage physique d'un article en stock."""

    STATUT_CHOICES = [
        ('EN_COURS', 'En cours'),
        ('TERMINE', 'Terminé'),
        ('BLOQUE', 'Bloqué'),
    ]

    QUALITE_CHOICES = [
        ('BON', 'Bon'),
        ('MOYEN', 'Moyen'),
        ('MAUVAIS', 'Mauvais'),
    ]

    date_inv = models.DateField(verbose_name='Date inventaire')
    qte_systeme = models.FloatField(
        verbose_name='Quantité système',
        default=0,
        help_text='Stock actuel de l\'article dans l\'app (ArticleStock.qte_art) au moment de l\'inventaire'
    )
    qte_depot = models.FloatField(
        verbose_name='Quantité au dépôt',
        default=0,
        help_text='Résultat du comptage physique renseigné par l\'utilisateur'
    )
    ecart = models.FloatField(
        verbose_name='Écart',
        default=0,
        help_text='Calculé automatiquement : qte_depot - qte_systeme'
    )
    statut = models.CharField(
        max_length=20,
        choices=STATUT_CHOICES,
        default='EN_COURS',
        verbose_name='Statut'
    )
    qualite = models.CharField(
        max_length=20,
        choices=QUALITE_CHOICES,
        default='BON',
        blank=True,
        verbose_name='Qualité de l\'inventaire'
    )
    observation = models.TextField(blank=True, null=True, verbose_name='Observation')
    article = models.ForeignKey(
        ArticleStock,
        on_delete=models.CASCADE,
        related_name='inventaires',
        verbose_name='Article'
    )
    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='inventaires',
        verbose_name='Responsable'
    )

    def save(self, *args, **kwargs):
        # Calcul automatique de l'écart
        self.ecart = self.qte_depot - self.qte_systeme
        # Qualité calculée automatiquement selon l'écart (pas de saisie utilisateur)
        if self.qte_systeme and self.qte_systeme > 0:
            ecart_pct = abs(self.ecart) / self.qte_systeme * 100
            if ecart_pct <= 5:
                self.qualite = 'BON'
            elif ecart_pct <= 15:
                self.qualite = 'MOYEN'
            else:
                self.qualite = 'MAUVAIS'
        else:
            if abs(self.ecart) <= 5:
                self.qualite = 'BON'
            elif abs(self.ecart) <= 20:
                self.qualite = 'MOYEN'
            else:
                self.qualite = 'MAUVAIS'
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Inventaire {self.article.get_type_art_display()} - {self.date_inv}"

    class Meta:
        ordering = ['-date_inv']
        verbose_name = "Inventaire"
        verbose_name_plural = "Inventaires"