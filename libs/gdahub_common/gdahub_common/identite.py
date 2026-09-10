"""Qui fait la requete, tel que les services le voient.

Ce module ne connait ni JWT ni reseau : il ne decrit qu'une identite. C'est
volontaire — le domaine metier raisonne sur « qui est la et ce qu'il a le
droit de faire », pas sur la facon dont on l'a appris. Les tests peuvent donc
fabriquer un porteur sans signer quoi que ce soit, et une autre methode
d'authentification se brancherait sans toucher au metier.
"""

from dataclasses import dataclass, field


@dataclass
class UtilisateurJeton:
    """L'utilisateur tel que le jeton le decrit. Il n'est jamais en base.

    `roles` ne contient que les roles de l'application courante : un directeur
    general habilite sur trois applications recoit trois listes distinctes, et
    chaque service ne voit que la sienne.

    L'`identifiant` est la cle qui traverse tout l'ERP. Les numeros — de
    compte, d'agent — vivent dans des bases differentes ; celui-ci est le meme
    partout, et c'est donc lui qui designe une personne dans un circuit de
    validation.
    """

    id: int
    identifiant: str
    nom_complet: str = ""
    email: str = ""
    est_superadmin: bool = False
    roles: list[str] = field(default_factory=list)
    habilitations: dict[str, list[str]] = field(default_factory=dict)
    jeton: str = ""

    @property
    def is_authenticated(self) -> bool:
        return True

    @property
    def is_anonymous(self) -> bool:
        return False

    @property
    def pk(self) -> int:
        return self.id

    def a_role(self, *roles: str) -> bool:
        """Vrai si l'utilisateur porte l'un des roles sur cette application."""
        if self.est_superadmin:
            return True
        return any(role in self.roles for role in roles)

    def a_acces(self, application: str) -> bool:
        if self.est_superadmin:
            return True
        return bool(self.habilitations.get(application))

    def __str__(self) -> str:
        return self.identifiant
