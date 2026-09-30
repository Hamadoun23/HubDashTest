"""Notification GDA Hub au demandeur quand sa demande est tranchee."""
from types import SimpleNamespace
from unittest import mock

from django.test import SimpleTestCase

from core import workflow


class _Meta:
    verbose_name = "demande d'absence"


def _document():
    return SimpleNamespace(
        _meta=_Meta(), reference="ABS-0042",
        demandeur=SimpleNamespace(email="agent@gdamali.net", username="agent"),
    )


class PrevenirDemandeurTest(SimpleTestCase):
    @mock.patch("accounts.notifications_hub.notifier")
    def test_approbation(self, notifier):
        workflow._prevenir_demandeur(_document(), approuve=True)
        args, kwargs = notifier.call_args
        self.assertIn("agent@gdamali.net", args[0])
        self.assertEqual(kwargs["titre"], "Demande d'absence ABS-0042 approuvee")
        self.assertEqual(kwargs["application"], "rh")

    @mock.patch("accounts.notifications_hub.notifier")
    def test_rejet_avec_motif(self, notifier):
        workflow._prevenir_demandeur(_document(), approuve=False, commentaire="Période chargée")
        kwargs = notifier.call_args.kwargs
        self.assertTrue(kwargs["titre"].endswith("rejetee"))
        self.assertIn("Période chargée", kwargs["message"])

    @mock.patch("accounts.notifications_hub.notifier")
    def test_sans_demandeur_rien(self, notifier):
        workflow._prevenir_demandeur(SimpleNamespace(_meta=_Meta(), demandeur=None), approuve=True)
        notifier.assert_not_called()
