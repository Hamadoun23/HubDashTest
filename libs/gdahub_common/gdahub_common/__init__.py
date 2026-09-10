"""Socle partage des services GDA Hub.

Tout service metier importe d'ici l'authentification, les permissions, la
pagination et le format d'erreur. Ces quatre briques doivent etre identiques
partout : c'est ce qui permet au shell React de parler a n'importe quel
service sans cas particulier.
"""

__all__ = ["auth", "permissions", "pagination", "exceptions", "reglages"]
