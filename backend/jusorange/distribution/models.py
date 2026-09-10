from datetime import date
from django.db import models


class Client(models.Model):
    """Client : acheteur de jus."""

    nom_complet = models.CharField(max_length=200, verbose_name='Nom complet')
    tel_client = models.CharField(max_length=30, blank=True, verbose_name='Téléphone')
    email = models.EmailField(blank=True, verbose_name='Email')
    adresse = models.TextField(blank=True, verbose_name='Adresse')

    def __str__(self):
        return self.nom_complet

    class Meta:
        ordering = ['nom_complet']
        verbose_name = "Client"
        verbose_name_plural = "Clients"


class Vente(models.Model):
    """Vente : transaction commerciale avec un client."""

    STATUT_PAIEMENT_CHOICES = [
        ('ACHAT_VENTE', 'Achat-vente'),
        ('PARTIELLE', 'Partielle'),
        ('DEPOT_VENTE', 'Dépôt-vente'),
    ]

    client = models.ForeignKey(
        Client,
        on_delete=models.CASCADE,
        related_name='ventes',
        verbose_name='Client'
    )
    date_vente = models.DateField(verbose_name='Date de vente')
    montant_total = models.FloatField(default=0, verbose_name='Montant total')
    statut_paiement = models.CharField(
        max_length=20,
        choices=STATUT_PAIEMENT_CHOICES,
        default='DEPOT_VENTE',
        verbose_name='Statut paiement'
    )

    def __str__(self):
        return f"Vente #{self.pk} - {self.client} - {self.date_vente}"

    class Meta:
        ordering = ['-date_vente']
        verbose_name = "Vente"
        verbose_name_plural = "Ventes"


class Commande(models.Model):
    """Commande : demande client (quantités 33cl/1L). La vente est créée via « Compléter commande »."""

    client = models.ForeignKey(
        'Client',
        on_delete=models.CASCADE,
        related_name='commandes',
        verbose_name='Client'
    )
    vente = models.ForeignKey(
        Vente,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='commandes',
        verbose_name='Vente'
    )
    date_cmd = models.DateField(verbose_name='Date commande', default=date.today)
    quantite_33cl = models.IntegerField(default=0, verbose_name='Quantité 33cl')
    quantite_1l = models.IntegerField(default=0, verbose_name='Quantité 1L')

    def get_total_ligne(self):
        """Calcule le total à partir des prix dans ArticleStock (jus_33cl, jus_1l)."""
        from appro.models import ArticleStock
        art_33 = ArticleStock.objects.filter(type_art='jus_33cl').first()
        art_1l = ArticleStock.objects.filter(type_art='jus_1l').first()
        prix_33 = (art_33.prix_33cl or 0) if art_33 else 0
        prix_1 = (art_1l.prix_1l or 0) if art_1l else 0
        return self.quantite_33cl * prix_33 + self.quantite_1l * prix_1

    def __str__(self):
        return f"Cmd #{self.pk} - {self.client} - {self.quantite_33cl}x33cl + {self.quantite_1l}x1L"

    class Meta:
        ordering = ['-date_cmd', '-pk']
        verbose_name = "Commande"
        verbose_name_plural = "Commandes"


class Facture(models.Model):
    """Facture : document de facturation lié à une vente."""

    STATUT_CHOICES = [
        ('EMIS', 'Émise'),
        ('ACHAT_VENTE', 'Achat-vente'),
        ('PARTIELLE', 'Partielle'),
        ('ANNULEE', 'Annulée'),
    ]

    vente = models.ForeignKey(
        Vente,
        on_delete=models.CASCADE,
        related_name='factures',
        verbose_name='Vente'
    )
    num_fact = models.CharField(max_length=50, editable=False, blank=True, verbose_name='N° facture')
    date_fact = models.DateField(verbose_name='Date facture')
    montant = models.FloatField(verbose_name='Montant')
    statut = models.CharField(
        max_length=20,
        choices=STATUT_CHOICES,
        default='EMIS',
        verbose_name='Statut'
    )
    date_echeance = models.DateField(verbose_name='Date échéance')

    def save(self, *args, **kwargs):
        if not self.num_fact:
            date_str = self.date_fact.strftime('%d%m%Y')
            count = Facture.objects.filter(date_fact=self.date_fact).count()
            self.num_fact = f"FACT{count + 1:03d}{date_str}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.num_fact} - {self.montant}"

    class Meta:
        ordering = ['-date_fact']
        verbose_name = "Facture"
        verbose_name_plural = "Factures"


class Paiement(models.Model):
    """Paiement : paiement partiel ou total d'une facture."""

    MODE_PAIE_CHOICES = [
        ('ESPECE', 'Espèce'),
        ('CHEQUE', 'Chèque'),
        ('VIREMENT', 'Virement'),
        ('MOBILE', 'Mobile'),
    ]

    facture = models.ForeignKey(
        Facture,
        on_delete=models.CASCADE,
        related_name='paiements',
        verbose_name='Facture'
    )
    date_paie = models.DateField(verbose_name='Date paiement')
    montant = models.FloatField(verbose_name='Montant')
    mode_paie = models.CharField(
        max_length=20,
        choices=MODE_PAIE_CHOICES,
        verbose_name='Mode paiement'
    )
    reference = models.CharField(max_length=100, blank=True, verbose_name='Référence')

    def __str__(self):
        return f"{self.montant} - {self.get_mode_paie_display()} - {self.date_paie}"

    class Meta:
        ordering = ['-date_paie']
        verbose_name = "Paiement"
        verbose_name_plural = "Paiements"


class ReceptionPaiement(models.Model):
    """Réception paiement côté trésorerie : enregistre le montant effectivement reçu par le trésorier."""

    STATUT_RECEPTION_CHOICES = [
        ('CONFORME', 'Conforme'),
        ('ECART_POSITIF', 'Écart positif (reçu > déclaré)'),
        ('ECART_NEGATIF', 'Écart négatif (reçu < déclaré)'),
    ]

    paiement = models.OneToOneField(
        Paiement,
        on_delete=models.CASCADE,
        related_name='reception_tresorerie',
        verbose_name='Paiement (commercial)'
    )
    montant_recu = models.FloatField(verbose_name='Montant reçu (trésorerie)')
    date_reception = models.DateField(verbose_name='Date réception')
    observation = models.TextField(blank=True, verbose_name='Observation (gestion des écarts)')
    ecart_traite = models.BooleanField(default=False, verbose_name='Écart traité')

    @property
    def ecart(self):
        """Écart = montant_recu - montant déclaré par le commercial."""
        return self.montant_recu - self.paiement.montant

    @property
    def statut_reception(self):
        """Statut automatique selon l'écart."""
        e = self.ecart
        if abs(e) < 0.01:
            return 'CONFORME'
        return 'ECART_POSITIF' if e > 0 else 'ECART_NEGATIF'

    def __str__(self):
        return f"Réception #{self.pk} - {self.paiement} - Reçu: {self.montant_recu:.0f} XOF"

    class Meta:
        ordering = ['-date_reception']
        verbose_name = "Réception paiement (trésorerie)"
        verbose_name_plural = "Réceptions paiements (trésorerie)"
