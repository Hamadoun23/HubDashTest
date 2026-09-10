"""Le compte unique de GDA Hub, et ce a quoi il donne acces.

Un employe a un seul compte pour tout le groupe. Ce qui change d'une
application a l'autre, ce n'est pas le compte, c'est l'habilitation : le
directeur general porte une habilitation sur chacune des applications qu'il
suit, avec des roles qui peuvent differer de l'une a l'autre.

C'est la raison d'etre de la table Habilitation. Mettre les roles sur
l'utilisateur, comme le faisaient les applications d'origine, obligerait a
inventer des codes globaux du genre admin_bdm, admin_daily, et chaque
nouvelle application allongerait la liste.
"""

from django.contrib.auth.base_user import BaseUserManager
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models
from django.utils import timezone


class GestionnaireUtilisateur(BaseUserManager):
    """Creation de comptes par identifiant plutot que par nom d'utilisateur."""

    use_in_migrations = True

    def create_user(self, identifiant, mot_de_passe=None, **extra):
        if not identifiant:
            raise ValueError("Un compte doit avoir un identifiant.")
        identifiant = identifiant.strip().lower()
        if extra.get("email"):
            extra["email"] = self.normalize_email(extra["email"])
        utilisateur = self.model(identifiant=identifiant, **extra)
        utilisateur.set_password(mot_de_passe)
        utilisateur.save(using=self._db)
        return utilisateur

    def create_superuser(self, identifiant, mot_de_passe=None, **extra):
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        extra.setdefault("est_actif", True)
        if not extra["is_superuser"]:
            raise ValueError("Un superutilisateur doit avoir is_superuser=True.")
        return self.create_user(identifiant, mot_de_passe, **extra)


class Utilisateur(AbstractBaseUser, PermissionsMixin):
    """Une personne, un compte, quelles que soient les applications utilisees.

    identifiant accepte un e-mail, un numero de telephone ou un nom : les
    applications d'origine ne se connectaient pas toutes de la meme facon, et
    imposer l'e-mail exclurait les commerciaux de terrain qui n'en ont pas.
    """

    identifiant = models.CharField(
        "Identifiant de connexion", max_length=150, unique=True, db_index=True
    )
    nom = models.CharField("Nom", max_length=100)
    prenom = models.CharField("Prenom", max_length=100, blank=True)
    email = models.EmailField("Adresse e-mail", blank=True)
    telephone = models.CharField("Telephone", max_length=30, blank=True)
    fonction = models.CharField("Fonction", max_length=150, blank=True)
    photo = models.ImageField(
        "Photo de profil", upload_to="photos", null=True, blank=True
    )

    est_actif = models.BooleanField(
        "Compte actif",
        default=True,
        help_text="Un compte inactif ne peut plus se connecter nulle part.",
    )
    is_staff = models.BooleanField("Acces a l'administration Django", default=False)

    cree_le = models.DateTimeField("Cree le", auto_now_add=True)
    modifie_le = models.DateTimeField("Modifie le", auto_now=True)
    derniere_connexion = models.DateTimeField(
        "Derniere connexion", null=True, blank=True
    )

    objects = GestionnaireUtilisateur()

    USERNAME_FIELD = "identifiant"
    REQUIRED_FIELDS: list[str] = ["nom"]

    class Meta:
        db_table = "utilisateur"
        ordering = ["nom", "prenom"]
        verbose_name = "Utilisateur"
        verbose_name_plural = "Utilisateurs"

    def __str__(self):
        return self.nom_complet or self.identifiant

    @property
    def nom_complet(self) -> str:
        return f"{self.prenom} {self.nom}".strip()

    @property
    def is_active(self) -> bool:
        """Django lit is_active ; le modele expose est_actif."""
        return self.est_actif

    @is_active.setter
    def is_active(self, valeur):
        self.est_actif = valeur

    def habilitations_actives(self) -> dict[str, list[str]]:
        """Les roles portes par ce compte, application par application.

        C'est exactement ce qui part dans le jeton : le shell React s'en sert
        pour n'afficher que les applications autorisees, et chaque service
        pour n'y lire que sa propre entree.
        """
        return {
            habilitation.application.code: list(habilitation.roles)
            for habilitation in self.habilitations.select_related("application")
            .filter(active=True, application__active=True)
            .order_by("application__ordre")
        }

    def identifiants_locaux(self) -> dict[str, str]:
        """Sous quel nom ce compte est connu de chaque application.

        **Pourquoi cette table existe.** Le hub identifie une personne par son
        adresse professionnelle. Les applications rassemblees, elles, ont ete
        peuplees a des epoques et par des chemins differents : FinanceRH tient
        des adresses en @gdamali.net, Jus d'orange des comptes de role
        (« resprod@jusorange.local »), BDM des adresses fabriquees lors de la
        reprise depuis Laravel (« juin2026.74082712@import.gda »).

        Rien ne relie ces trois vues d'une meme personne. Sans cette
        correspondance, le compte unique ne fonctionnerait que pour FinanceRH,
        et le hub ne rassemblerait rien du tout.

        Seules les entrees renseignees figurent ici : quand l'adresse
        professionnelle suffit, il n'y a rien a dire.
        """
        return {
            habilitation.application.code: habilitation.identifiant_local
            for habilitation in self.habilitations.select_related("application")
            .filter(active=True, application__active=True)
            .exclude(identifiant_local="")
            .order_by("application__ordre")
        }


class Application(models.Model):
    """Une des applications de GDA Hub.

    Le catalogue vit ici, pas dans le front : ajouter une application au
    groupe ne doit pas demander de redeployer le shell.
    """

    code = models.SlugField(
        "Code", max_length=32, unique=True, help_text="rh, finance, bdm, daily..."
    )
    nom = models.CharField("Nom affiche", max_length=100)
    description = models.CharField("Description", max_length=255, blank=True)
    groupe = models.CharField(
        "Groupe",
        max_length=60,
        blank=True,
        help_text="Intitule de la section du menu : « Board », "
        "« Applications metier »... Le libelle sert directement d'en-tete, "
        "pour qu'ajouter une section ne demande pas de toucher au front.",
    )
    chemin = models.CharField(
        "Chemin dans le shell",
        max_length=100,
        blank=True,
        help_text="Par exemple /daily, la page ouverte depuis le tableau de bord.",
    )
    prefixe_api = models.CharField(
        "Prefixe d'API",
        max_length=100,
        blank=True,
        help_text="Par exemple /api/daily, route servie par la passerelle.",
    )
    roles_disponibles = models.JSONField(
        "Roles disponibles",
        default=list,
        blank=True,
        help_text="Liste d'objets code/libelle propres a cette application.",
    )
    couleur = models.CharField("Couleur", max_length=9, blank=True)
    ordre = models.PositiveSmallIntegerField("Ordre d'affichage", default=100)
    active = models.BooleanField("Application active", default=True)

    class Meta:
        db_table = "application"
        ordering = ["ordre", "nom"]
        verbose_name = "Application"
        verbose_name_plural = "Applications"

    def __str__(self):
        return self.nom

    def codes_de_roles(self) -> set[str]:
        return {role.get("code") for role in self.roles_disponibles if role.get("code")}


class Habilitation(models.Model):
    """Le droit d'un compte sur une application, avec ses roles.

    Une ligne par couple compte/application. La desactiver coupe l'acces sans
    perdre l'historique des roles accordes.
    """

    utilisateur = models.ForeignKey(
        Utilisateur,
        on_delete=models.CASCADE,
        related_name="habilitations",
        verbose_name="Utilisateur",
    )
    application = models.ForeignKey(
        Application,
        on_delete=models.CASCADE,
        related_name="habilitations",
        verbose_name="Application",
    )
    roles = models.JSONField(
        "Roles",
        default=list,
        blank=True,
        help_text="Codes de roles, pris dans roles_disponibles de l'application.",
    )
    identifiant_local = models.CharField(
        "Identifiant dans l'application",
        max_length=150,
        blank=True,
        help_text=(
            "Sous quel nom cette personne est connue de l'application, quand "
            "ce n'est pas son adresse professionnelle. Laisser vide si les "
            "deux coincident."
        ),
    )
    active = models.BooleanField("Habilitation active", default=True)
    accordee_le = models.DateTimeField("Accordee le", auto_now_add=True)
    accordee_par = models.ForeignKey(
        Utilisateur,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="habilitations_accordees",
        verbose_name="Accordee par",
    )

    class Meta:
        db_table = "habilitation"
        constraints = [
            models.UniqueConstraint(
                fields=["utilisateur", "application"],
                name="une_habilitation_par_application",
            )
        ]
        ordering = ["application__ordre"]
        verbose_name = "Habilitation"
        verbose_name_plural = "Habilitations"

    def __str__(self):
        return f"{self.utilisateur} sur {self.application} : {', '.join(self.roles)}"


class SessionJeton(models.Model):
    """Un jeton de rafraichissement en cours de validite.

    Les jetons d'acces sont volontairement sans etat, c'est ce qui evite un
    appel a identity a chaque requete. Les jetons de rafraichissement, eux,
    sont traces : sans cette table, se deconnecter ne couperait rien pendant
    sept jours.
    """

    identifiant_jeton = models.CharField(
        "Identifiant du jeton (jti)", max_length=64, unique=True, db_index=True
    )
    utilisateur = models.ForeignKey(
        Utilisateur, on_delete=models.CASCADE, related_name="sessions"
    )
    cree_le = models.DateTimeField("Cree le", auto_now_add=True)
    expire_le = models.DateTimeField("Expire le")
    revoque_le = models.DateTimeField("Revoque le", null=True, blank=True)
    adresse_ip = models.GenericIPAddressField("Adresse IP", null=True, blank=True)
    agent = models.CharField("Navigateur", max_length=300, blank=True)

    class Meta:
        db_table = "session_jeton"
        ordering = ["-cree_le"]
        verbose_name = "Session"
        verbose_name_plural = "Sessions"

    def __str__(self):
        return f"{self.utilisateur} - {self.cree_le:%d/%m/%Y %H:%M}"

    @property
    def valide(self) -> bool:
        return self.revoque_le is None and self.expire_le > timezone.now()

    def revoquer(self):
        if self.revoque_le is None:
            self.revoque_le = timezone.now()
            self.save(update_fields=["revoque_le"])


class JournalConnexion(models.Model):
    """Trace des tentatives de connexion, reussies ou non."""

    identifiant_saisi = models.CharField("Identifiant saisi", max_length=150)
    utilisateur = models.ForeignKey(
        Utilisateur,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="connexions",
    )
    reussie = models.BooleanField("Reussie", default=False)
    motif = models.CharField("Motif de l'echec", max_length=100, blank=True)
    adresse_ip = models.GenericIPAddressField("Adresse IP", null=True, blank=True)
    agent = models.CharField("Navigateur", max_length=300, blank=True)
    date = models.DateTimeField("Date", auto_now_add=True, db_index=True)

    class Meta:
        db_table = "journal_connexion"
        ordering = ["-date"]
        verbose_name = "Connexion"
        verbose_name_plural = "Journal des connexions"

    def __str__(self):
        etat = "reussie" if self.reussie else f"echouee ({self.motif})"
        return f"{self.identifiant_saisi} - {etat} - {self.date:%d/%m/%Y %H:%M}"
