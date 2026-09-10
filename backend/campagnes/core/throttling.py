"""
Limitation des tentatives de connexion — équivalent du RateLimiter de Laravel
utilisé par LoginRequest (5 essais par couple identifiant + IP).
"""

import time
import unicodedata

from django.core.cache import cache

MAX_TENTATIVES = 5
FENETRE_SECONDES = 60


def _cle(identifiant: str, ip: str) -> str:
    """Reproduit `Str::transliterate($login.'|'.$this->ip())`."""
    brut = f"{(identifiant or '').strip().lower()}|{ip or ''}"
    translitere = (
        unicodedata.normalize("NFKD", brut).encode("ascii", "ignore").decode("ascii")
    )
    return f"login-throttle:{translitere}"


def trop_de_tentatives(identifiant: str, ip: str) -> int:
    """Renvoie le nombre de secondes à patienter, ou 0 si la voie est libre."""
    entree = cache.get(_cle(identifiant, ip))
    if not entree:
        return 0
    tentatives, expire_a = entree
    if tentatives < MAX_TENTATIVES:
        return 0
    restant = int(expire_a - time.time())
    return max(restant, 1) if restant > 0 else 0


def enregistrer_echec(identifiant: str, ip: str) -> None:
    cle = _cle(identifiant, ip)
    entree = cache.get(cle)
    maintenant = time.time()

    if entree and entree[1] > maintenant:
        tentatives, expire_a = entree[0] + 1, entree[1]
    else:
        tentatives, expire_a = 1, maintenant + FENETRE_SECONDES

    cache.set(cle, (tentatives, expire_a), timeout=int(expire_a - maintenant))


def reinitialiser(identifiant: str, ip: str) -> None:
    cache.delete(_cle(identifiant, ip))
