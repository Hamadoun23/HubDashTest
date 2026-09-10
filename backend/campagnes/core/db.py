"""
Utilitaires de base de données.

Les relations many-to-many passent toutes par un modèle `through` explicite
(les tables pivot viennent de Laravel et sont en `managed = False`). Django
interdit alors `.set()` sur la relation : on gère la synchronisation à la main.
"""


def synchroniser_pivot(modele_pivot, champ_gauche, valeur_gauche, champ_droit, ids):
    """
    Équivalent de `$relation->sync($ids)` d'Eloquent.

    Supprime les liens absents de `ids`, crée ceux qui manquent, et laisse
    intacts les liens déjà corrects — ce dernier point compte : les tables
    pivot portent des timestamps que `sync()` ne remet pas à jour non plus.
    """
    ids = {int(identifiant) for identifiant in ids or []}
    filtre = {champ_gauche: valeur_gauche}

    existants = set(
        modele_pivot.objects.filter(**filtre).values_list(champ_droit, flat=True)
    )

    a_supprimer = existants - ids
    if a_supprimer:
        modele_pivot.objects.filter(
            **filtre, **{f"{champ_droit}__in": a_supprimer}
        ).delete()

    a_creer = ids - existants
    if not a_creer:
        return

    # `bulk_create` court-circuite `save()` : les timestamps que Laravel
    # renseigne via `withTimestamps()` doivent être posés explicitement.
    champs = {champ.name for champ in modele_pivot._meta.get_fields()}
    horodatage = {}
    if "created_at" in champs:
        from datetime import datetime

        maintenant = datetime.now().replace(microsecond=0)
        horodatage = {"created_at": maintenant, "updated_at": maintenant}

    modele_pivot.objects.bulk_create(
        [
            modele_pivot(**filtre, **horodatage, **{champ_droit: identifiant})
            for identifiant in sorted(a_creer)
        ]
    )
