"""
Socle commun aux modèles repris de Laravel.

Toutes les tables métier sont en `managed = False` : Django ne crée, ne modifie
et ne supprime jamais leur structure. Le schéma reste celui produit par les
migrations Laravel, ce qui rend la bascule et le retour arrière triviaux.
"""

from datetime import datetime

from django.db import models


class LaravelModel(models.Model):
    """Modèle mappé sur une table Laravel : timestamps `created_at` / `updated_at`
    gérés à la main, comme le fait Eloquent."""

    created_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        now = datetime.now().replace(microsecond=0)
        update_fields = kwargs.get("update_fields")

        if self._state.adding and self.created_at is None:
            self.created_at = now
        self.updated_at = now

        # Si l'appelant a restreint les colonnes écrites, les timestamps doivent
        # y être ajoutés explicitement sous peine d'être ignorés.
        if update_fields is not None:
            fields = set(update_fields) | {"updated_at"}
            if self._state.adding:
                fields.add("created_at")
            kwargs["update_fields"] = tuple(fields)

        return super().save(*args, **kwargs)


class LaravelModelSansTimestamps(models.Model):
    """Pour les tables pivot Laravel créées sans colonnes de timestamps."""

    class Meta:
        abstract = True
