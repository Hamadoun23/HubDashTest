from django.db import models
from recolte.models import Cueillette


# Table des articles en stock (paramétrage unique par type)
# Chaque type d'article n'existe qu'une seule fois (unique=True)
class ArticleStock(models.Model):
    TYPE_CHOICES = [
        ('bouteille_vide_33cl', 'Bouteille vide 33cl'),
        ('bouteille_vide_1l', 'Bouteille vide 1L'),
        ('preforme_33cl', 'Préforme 33cl'),
        ('preforme_1l', 'Préforme 1L'),
        ('orange_dispo', 'Orange disponible'),
        ('jus_33cl', 'Jus 33cl'),
        ('jus_1l', 'Jus 1L'),
    ]

    # unique=True : chaque type n'apparaît qu'une seule fois dans la liste
    type_art = models.CharField(max_length=50, choices=TYPE_CHOICES, unique=True)
    # Quantité actuelle en stock
    # Pour les oranges : mise à jour automatiquement via les réceptions
    # Pour les autres articles : mise à jour manuellement
    qte_art = models.FloatField(default=0)
    # Seuil minimum avant alerte
    seuil_alerte = models.FloatField()
    # Prix de vente (uniquement pour jus_33cl et jus_1l)
    prix_33cl = models.FloatField(null=True, blank=True, verbose_name='Prix 33cl (XOF)')
    prix_1l = models.FloatField(null=True, blank=True, verbose_name='Prix 1L (XOF)')
    # Se met à jour automatiquement à chaque modification
    date_maj = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.get_type_art_display()} - {self.qte_art}"

    class Meta:
        ordering = ['type_art']
        verbose_name = "Article Stock"
        verbose_name_plural = "Articles Stock"


# Table des réceptions (réception des oranges après cueillette)
# Si la cueillette est supprimée, on garde la réception avec cueillette_archive
class Reception(models.Model):
    # Lien vers la cueillette (plusieurs réceptions → 1 cueillette)
    # SET_NULL : la réception reste si la cueillette est supprimée
    cueillette = models.ForeignKey(
        Cueillette,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='receptions'
    )
    # Info de la cueillette archivée quand elle est supprimée (pour affichage)
    cueillette_archive = models.CharField(max_length=250, blank=True)
    # Producteur EXTERNE livrant directement : sa récolte ne nous concerne pas,
    # il n'y a donc pas de cueillette à rattacher. Une réception provient soit
    # d'une cueillette (producteur interne), soit d'un producteur externe.
    producteur_externe = models.ForeignKey(
        'recolte.Producteur',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='receptions_directes',
        verbose_name='Producteur externe',
    )
    # Lien vers les articles (plusieurs réceptions ↔ plusieurs articles)
    articles = models.ManyToManyField(
        ArticleStock,
        related_name='receptions',
        blank=True
    )
    # num_recp généré dans save() : N001JGDA12022026, N002... par date (reset à N001 quand date change)
    num_recp = models.CharField(max_length=30, editable=False, blank=True)
    date_recp = models.DateField()
    qte_recue = models.FloatField()
    qte_bon = models.FloatField()
    # qte_mauvais est calculé automatiquement dans save()
    qte_mauvais = models.FloatField(editable=False, default=0)
    lieu_depot = models.CharField(max_length=100)
    cause_perte = models.TextField(blank=True, null=True)

    # Calcul automatique : (qte_bon / qte_recue) * 100
    @property
    def taux_qualite(self):
        if self.qte_recue > 0:
            return round((self.qte_bon / self.qte_recue) * 100, 2)
        return 0

    # Calcul automatique de l'état qualité selon le taux
    @property
    def etat_qualite(self):
        taux = self.taux_qualite
        if taux >= 80:
            return 'EXCELLENT'
        elif taux >= 50:
            return 'BON'
        else:
            return 'MAUVAIS'

    def get_cueillette_display(self):
        """Décrit l'origine des oranges reçues.

        Trois cas : une cueillette (producteur interne), un producteur externe
        qui livre directement, ou une cueillette supprimée dont on a gardé la
        trace textuelle.
        """
        if self.cueillette:
            return str(self.cueillette)
        if self.producteur_externe:
            return f"{self.producteur_externe.nom_complet} (externe)"
        if self.cueillette_archive:
            return f"{self.cueillette_archive} (supprimée)"
        return "Origine non renseignée"

    # Avant chaque sauvegarde, calculer qte_mauvais et num_recp automatiquement
    def save(self, *args, **kwargs):
        self.qte_mauvais = self.qte_recue - self.qte_bon

        # Générer num_recp : N001JGDA12022026, N002... par date (reset à N001 quand date change)
        date_str = self.date_recp.strftime('%d%m%Y')
        if self.pk:
            try:
                old = Reception.objects.only('date_recp', 'num_recp').get(pk=self.pk)
                if old.date_recp == self.date_recp:
                    self.num_recp = old.num_recp
                else:
                    count = Reception.objects.filter(date_recp=self.date_recp).exclude(pk=self.pk).count()
                    self.num_recp = f"N{count + 1:03d}JGDA{date_str}"
            except Reception.DoesNotExist:
                count = Reception.objects.filter(date_recp=self.date_recp).count()
                self.num_recp = f"N{count + 1:03d}JGDA{date_str}"
        else:
            count = Reception.objects.filter(date_recp=self.date_recp).count()
            self.num_recp = f"N{count + 1:03d}JGDA{date_str}"

        super().save(*args, **kwargs)

        # Après la sauvegarde, mettre à jour le stock d'oranges disponibles
        article_orange, created = ArticleStock.objects.get_or_create(
            type_art='orange_dispo',
            defaults={'seuil_alerte': 100, 'qte_art': 0}
        )
        from django.db.models import Sum
        total_oranges = Reception.objects.aggregate(total=Sum('qte_bon'))['total'] or 0
        article_orange.qte_art = total_oranges
        article_orange.save()

        # Lier automatiquement cet article à la réception
        self.articles.add(article_orange)

    def __str__(self):
        return f"{self.num_recp} - {self.date_recp}"

    class Meta:
        ordering = ['-date_recp']
        verbose_name = "Réception"
        verbose_name_plural = "Réceptions"
