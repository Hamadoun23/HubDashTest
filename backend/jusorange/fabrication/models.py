from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.contrib.auth.models import User


class Production(models.Model):
    RECETTE_CHOICES = [
        ('R80_20', '80/20'),
        ('R75_25', '75/25'),
    ]
    TEST_QUALITE_CHOICES = [
        ('CONFORME', 'Conforme'),
        ('NON_CONFORME', 'Non conforme'),
    ]
    STATUT_CHOICES = [
        ('EN_COURS', 'En cours'),
        ('TERMINEE', 'Terminée'),
        ('ANNULLEE', 'Annulée'),
    ]

    date_of = models.DateField()
    numero_of = models.CharField(max_length=30, editable=False, blank=True)
    lavage_effectue = models.BooleanField(default=False)
    filtration_effectuee = models.BooleanField(default=False)
    recette = models.CharField(max_length=20, choices=RECETTE_CHOICES)
    eau_ajoutee_l = models.FloatField(default=0)
    sucre_ajoute_kg = models.FloatField(default=0)
    sorbate_ajoute_g = models.FloatField(default=0)
    pasteurisation_80c = models.BooleanField(default=False)
    test_qualite = models.CharField(max_length=20, choices=TEST_QUALITE_CHOICES, blank=True, null=True)
    ph = models.IntegerField(blank=True, null=True, validators=[MinValueValidator(0), MaxValueValidator(10)])
    refractometre = models.IntegerField(blank=True, null=True, validators=[MinValueValidator(0), MaxValueValidator(20)])
    volume_final_l = models.FloatField(default=0)
    statut_production = models.CharField(max_length=20, choices=STATUT_CHOICES, default='EN_COURS')
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='productions')

    def save(self, *args, **kwargs):
        # Générer numero_of : OF00112022026, OF002... par date (reset à OF001 quand date change)
        date_str = self.date_of.strftime('%d%m%Y')
        if self.pk:
            try:
                old = Production.objects.only('date_of', 'numero_of').get(pk=self.pk)
                if old.date_of == self.date_of:
                    self.numero_of = old.numero_of
                else:
                    count = Production.objects.filter(date_of=self.date_of).exclude(pk=self.pk).count()
                    self.numero_of = f"OF{count + 1:03d}{date_str}"
            except Production.DoesNotExist:
                count = Production.objects.filter(date_of=self.date_of).count()
                self.numero_of = f"OF{count + 1:03d}{date_str}"
        else:
            count = Production.objects.filter(date_of=self.date_of).count()
            self.numero_of = f"OF{count + 1:03d}{date_str}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.numero_of} - {self.date_of}"

    class Meta:
        ordering = ['-date_of']
        verbose_name = "Production"
        verbose_name_plural = "Productions"