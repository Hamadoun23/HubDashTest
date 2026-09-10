"""
Petites conversions imposées par la sérialisation JSON de PHP.

Le frontend a été écrit face à des props produites par Laravel : reproduire ces
quelques particularités évite des écarts sans intérêt dans le banc de
comparaison, et garantit que les composants React reçoivent exactement ce
qu'ils recevaient avant.
"""


from decimal import ROUND_HALF_UP, Decimal


def tableau(dictionnaire):
    """
    Un tableau PHP associatif vide se sérialise en `[]`, pas en `{}`.

    C'est le cas des filtres construits par `$request->only([...])` : sans
    aucun filtre actif, Laravel envoie `[]`.
    """
    return dictionnaire if dictionnaire else []


def nombre_format(valeur, decimales=0, separateur_decimal=",", separateur_milliers=" "):
    """
    Équivalent de `number_format($v, 0, ',', ' ')`, omniprésent dans les vues.

    Les montants sont convertis en `Decimal` et arrondis au demi-supérieur,
    comme PHP : passer par des flottants ferait dériver les totaux d'un franc
    sur certaines valeurs.
    """
    if valeur is None:
        valeur = 0
    montant = Decimal(str(valeur)).quantize(
        Decimal(1).scaleb(-decimales), rounding=ROUND_HALF_UP
    )

    negatif = montant < 0
    montant = abs(montant)
    entier, _, fraction = f"{montant:f}".partition(".")

    groupes = []
    while len(entier) > 3:
        groupes.insert(0, entier[-3:])
        entier = entier[:-3]
    groupes.insert(0, entier)
    texte = separateur_milliers.join(groupes)

    if decimales > 0:
        texte += separateur_decimal + fraction.ljust(decimales, "0")[:decimales]

    return ("-" if negatif else "") + texte
