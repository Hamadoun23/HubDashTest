"""Cartographie commerciale : points de vente prospectés et visites terrain.

Un « point de vente » est un lieu physique démarché par les commerciaux
(boutique, supermarché, restaurant, entreprise…). Les clients particuliers
n'en sont pas : ils vivent uniquement dans `distribution.Client` et
n'apparaissent donc pas sur la carte.

Le point porte l'état courant (statut, prochaine relance, potentiel) ; la
`Visite` en garde l'historique daté, avec photo et compte rendu.
"""
from django.conf import settings
from django.db import models
from django.utils import timezone


# Statuts du parcours de prospection, dans l'ordre de progression.
# La couleur sert de source unique pour les marqueurs de la carte : le front
# la lit dans le serializer au lieu de dupliquer la correspondance.
STATUT_CHOICES = [
    ('PROSPECTE', 'Prospecté'),
    ('INTERESSE', 'Intéressé'),
    ('CLIENT', 'Client'),
    ('PARTENAIRE', 'Point de vente partenaire'),
    ('A_RELANCER', 'À relancer'),
    ('REFUS', 'Non intéressé'),
]

STATUT_COULEURS = {
    'PROSPECTE': 'blue',
    'INTERESSE': 'cyan',
    'CLIENT': 'green',
    'PARTENAIRE': 'violet',
    'A_RELANCER': 'orange',
    'REFUS': 'red',
}


class PointVente(models.Model):
    """Point de vente ou prospect géolocalisé."""

    TYPE_CHOICES = [
        ('BOUTIQUE', 'Boutique'),
        ('SUPERMARCHE', 'Supermarché'),
        ('EPICERIE', 'Épicerie / alimentation'),
        ('RESTAURANT', 'Restaurant / maquis'),
        ('HOTEL', 'Hôtel'),
        ('KIOSQUE', 'Kiosque'),
        ('STATION', 'Station-service'),
        ('GROSSISTE', 'Grossiste / demi-gros'),
        ('ENTREPRISE', 'Entreprise / administration'),
        ('AUTRE', 'Autre'),
    ]

    nom = models.CharField(max_length=200, verbose_name='Nom du point de vente')
    type_point = models.CharField(
        max_length=20, choices=TYPE_CHOICES, default='BOUTIQUE',
        verbose_name='Type de point de vente')

    # Géolocalisation. Relevée par le navigateur du commercial sur le terrain,
    # ou saisie à la main en cliquant sur la carte.
    latitude = models.FloatField(verbose_name='Latitude')
    longitude = models.FloatField(verbose_name='Longitude')
    adresse = models.CharField(
        max_length=255, blank=True,
        verbose_name='Adresse / repère', help_text='Quartier, rue, point de repère.')

    # Contact sur place.
    contact_nom = models.CharField(
        max_length=150, blank=True, verbose_name='Contact / responsable')
    contact_tel = models.CharField(
        max_length=30, blank=True, verbose_name='Téléphone du contact')
    contact_email = models.EmailField(blank=True, verbose_name='Email du contact')

    statut = models.CharField(
        max_length=20, choices=STATUT_CHOICES, default='PROSPECTE',
        verbose_name='Statut')
    potentiel_ca = models.FloatField(
        default=0, verbose_name='Potentiel commercial (XOF / mois)',
        help_text="Chiffre d'affaires mensuel estimé.")
    date_prochaine_relance = models.DateField(
        null=True, blank=True, verbose_name='Prochaine relance')

    commercial = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL, null=True, blank=True,
        related_name='points_prospectes',
        verbose_name='Commercial en charge')

    # Rattachement au fichier clients : un point devenu client y est relié pour
    # éviter la double saisie. Reste vide tant qu'il n'a rien acheté, et les
    # clients particuliers n'ont jamais de point de vente.
    client = models.ForeignKey(
        'distribution.Client',
        on_delete=models.SET_NULL, null=True, blank=True,
        related_name='points_vente',
        verbose_name='Client rattaché')

    cree_le = models.DateTimeField(auto_now_add=True, verbose_name='Créé le')

    @property
    def couleur(self):
        """Couleur du marqueur sur la carte."""
        return STATUT_COULEURS.get(self.statut, 'gray')

    @property
    def derniere_visite(self):
        # Les visites sont triées de la plus récente à la plus ancienne.
        return self.visites.first()

    @property
    def relance_en_retard(self):
        """Vrai quand la date de relance est passée sans nouvelle visite."""
        if not self.date_prochaine_relance:
            return False
        return self.date_prochaine_relance < timezone.localdate()

    def __str__(self):
        return f"{self.nom} ({self.get_statut_display()})"

    class Meta:
        ordering = ['nom']
        verbose_name = 'Point de vente'
        verbose_name_plural = 'Points de vente'
        indexes = [models.Index(fields=['statut'])]


def photo_visite_path(instance, filename):
    """Range les photos par année/mois : un dossier ne devient jamais illisible."""
    jour = (instance.date_visite or timezone.now())
    return f"prospection/{jour:%Y/%m}/{filename}"


class Visite(models.Model):
    """Passage d'un commercial sur un point de vente."""

    point_vente = models.ForeignKey(
        PointVente, on_delete=models.CASCADE, related_name='visites',
        verbose_name='Point de vente')
    commercial = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL, null=True, blank=True,
        related_name='visites_prospection',
        verbose_name='Commercial')
    date_visite = models.DateTimeField(
        default=timezone.now, verbose_name='Date et heure de la visite')

    statut_constate = models.CharField(
        max_length=20, choices=STATUT_CHOICES, blank=True,
        verbose_name='Statut constaté',
        help_text='Reporté sur le point de vente à l\'enregistrement.')
    compte_rendu = models.TextField(blank=True, verbose_name='Compte rendu')
    photo = models.ImageField(
        upload_to=photo_visite_path, blank=True, null=True,
        verbose_name='Photo du point prospecté')

    # Position relevée au moment du passage : elle peut différer de celle du
    # point (GPS imprécis, point créé depuis le bureau). La garder permet de
    # vérifier que le commercial était bien sur place.
    latitude = models.FloatField(null=True, blank=True, verbose_name='Latitude relevée')
    longitude = models.FloatField(null=True, blank=True, verbose_name='Longitude relevée')

    # Les photos viennent des téléphones des commerciaux : 4 à 8 Mo pièce, pour
    # une vignette et un aperçu. Sans réduction, quelques centaines de visites
    # suffiraient à saturer le disque du VPS et à rendre la fiche illisible en
    # 3G. On plafonne donc le côté le plus long.
    LARGEUR_MAX = 1280

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if self.photo:
            self._reduire_photo()

    def _reduire_photo(self):
        from PIL import Image, ImageOps

        try:
            with Image.open(self.photo.path) as image:
                # Les photos de téléphone portent leur orientation dans l'EXIF :
                # sans cette correction, les clichés en mode portrait
                # s'afficheraient couchés.
                image = ImageOps.exif_transpose(image)
                if max(image.size) <= self.LARGEUR_MAX:
                    return
                image.thumbnail((self.LARGEUR_MAX, self.LARGEUR_MAX))
                if image.mode in ('RGBA', 'P'):
                    image = image.convert('RGB')
                image.save(self.photo.path, quality=85, optimize=True)
        except (FileNotFoundError, OSError):
            # Une photo illisible ne doit pas faire échouer l'enregistrement de
            # la visite : le compte rendu compte davantage que l'image.
            pass

    def __str__(self):
        return f"{self.point_vente.nom} — {self.date_visite:%d/%m/%Y %H:%M}"

    class Meta:
        ordering = ['-date_visite', '-pk']
        verbose_name = 'Visite de prospection'
        verbose_name_plural = 'Visites de prospection'
