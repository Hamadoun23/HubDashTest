# On importe le module 'models' de Django
from django.db import models


# Table des producteurs d'oranges
class Producteur(models.Model):

    # Interne : nos propres vergers — on y suit les cueillettes.
    # Externe : fournisseur tiers — la récolte ne nous concerne pas, on ne fait
    # que réceptionner les oranges qu'il livre.
    TYPE_CHOICES = [
        ('INTERNE', 'Interne'),
        ('EXTERNE', 'Externe'),
    ]

    nom_complet = models.CharField(max_length=100)
    type_prod = models.CharField(
        max_length=10,
        choices=TYPE_CHOICES,
        default='INTERNE',
        verbose_name='Type de producteur',
    )
    zone = models.CharField(max_length=100)
    contact = models.CharField(max_length=20)
    adresse = models.TextField(blank=True, null=True) 
    # default=True : par défaut, un nouveau producteur est actif, Est-ce que le producteur est actif ? 
    actif = models.BooleanField(default=True) 

    # Date et heure de création du producteur
    # auto_now_add=True : la date se remplit toute seule à la création
    date_creation = models.DateTimeField(auto_now_add=True)  

    # Cette méthode définit comment afficher un producteur sous forme de texte
    # Par exemple dans l'admin Django, au lieu de "Producteur object (1)"
    # on verra directement le nom du producteur (ex: "Moussa Diallo")
    def __str__(self):
        return self.nom_complet

    # Options de configuration de la table
    class Meta:
        # Les producteurs seront triés par ordre alphabétique du nom
        ordering = ['nom_complet']
        # Nom affiché dans l'admin au singulier
        verbose_name = "Producteur"
        # Nom affiché dans l'admin au pluriel
        verbose_name_plural = "Producteurs"



# Table des cueillettes (récoltes d'oranges)
# Si le producteur est supprimé, on garde la cueillette avec producteur_nom_archive
class Cueillette(models.Model):
    # Lien vers le producteur (1 producteur → plusieurs cueillettes)
    # SET_NULL : la cueillette reste si le producteur est supprimé
    producteur = models.ForeignKey(
        Producteur,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='cueillettes'
    )
    # Nom du producteur archivé quand il est supprimé (pour affichage)
    producteur_nom_archive = models.CharField(max_length=100, blank=True)
    date_cueil = models.DateField()
    qte_total = models.FloatField()
    qte_bon = models.FloatField()
    # qte_mauvais est calculé automatiquement dans save()
    qte_mauvais = models.FloatField(editable=False, default=0)
    observation = models.TextField(blank=True, null=True)

    # Calcul automatique : (qte_bon / qte_total) * 100
    @property
    def taux_qualite(self):
        if self.qte_total > 0:
            return round((self.qte_bon / self.qte_total) * 100, 2)
        return 0

    def get_producteur_display(self):
        """Affiche le nom du producteur ou l'archive + (supprimé)."""
        if self.producteur:
            return self.producteur.nom_complet
        return f"{self.producteur_nom_archive} (supprimé)"

    # Avant chaque sauvegarde, calculer qte_mauvais automatiquement
    def save(self, *args, **kwargs):
        self.qte_mauvais = self.qte_total - self.qte_bon
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.get_producteur_display()} - {self.date_cueil} - {self.qte_total} kg"

    class Meta:
        ordering = ['-date_cueil']
        verbose_name = "Cueillette"
        verbose_name_plural = "Cueillettes" 