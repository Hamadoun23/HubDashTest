"""Alimente Planning avec des donnees fictives, pour tester l'interface.

Rejouable sans danger : les clients de demonstration (et tout ce qui leur est
rattache) sont recrees a chaque execution, plutot que dupliques. Les clients
crees ailleurs (par exemple lors d'une verification manuelle) ne sont pas
touches.

    docker compose exec planning python manage.py donnees_test
"""

from __future__ import annotations

import random
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from planning.models import ClientPlanning, ContentIdea, Publication, PublicationRule, Shooting

NOMS_CLIENTS_DEMO = [
    "Café Sahel",
    "Mali Fashion",
    "AutoPlus Bamako",
    "Teranga Beauté",
    "Ecole Numérique ISTA",
]

IDEES = [
    ("Recette du mois", "vidéo"),
    ("Promo weekend", "image"),
    ("Portrait client", "vidéo"),
    ("Astuce du jour", "texte"),
    ("Nouveauté produit", "image"),
    ("Interview fondateur", "vidéo"),
    ("Citation inspirante", "texte"),
    ("Coulisses de l'atelier", "vidéo"),
]

STATUTS_PASSES = ["completed", "completed", "completed", "cancelled", "not_realized"]


class Command(BaseCommand):
    help = "Alimente Planning avec des clients, idees, tournages et publications fictifs."

    def handle(self, *args, **options):
        alea = random.Random(42)

        # --- Reinitialisation des clients de demonstration -----------------
        ClientPlanning.objects.filter(nom_entreprise__in=NOMS_CLIENTS_DEMO).delete()
        clients = [ClientPlanning.objects.create(nom_entreprise=nom) for nom in NOMS_CLIENTS_DEMO]

        # --- Idees de contenu : partagees, creees si absentes ---------------
        idees = []
        for titre, type_ in IDEES:
            idee, _ = ContentIdea.objects.get_or_create(titre=titre, defaults={"type": type_})
            idees.append(idee)

        # --- Regles de publication : quelques jours non recommandes ---------
        PublicationRule.objects.get_or_create(client=clients[0], day_of_week="lundi")
        PublicationRule.objects.get_or_create(client=clients[1], day_of_week="dimanche")
        PublicationRule.objects.get_or_create(client=clients[2], day_of_week="samedi")

        aujourd_hui = timezone.localdate()
        debut_fenetre = aujourd_hui - timedelta(days=25)
        fin_fenetre = aujourd_hui + timedelta(days=25)

        total_tournages = 0
        total_publications = 0

        for client in clients:
            nb_tournages = alea.randint(4, 7)
            tournages_client = []

            for _ in range(nb_tournages):
                jours_ecart = alea.randint(0, (fin_fenetre - debut_fenetre).days)
                jour = debut_fenetre + timedelta(days=jours_ecart)
                heure = alea.choice([9, 10, 11, 14, 15, 16])
                quand = timezone.make_aware(
                    timezone.datetime(jour.year, jour.month, jour.day, heure, 0)
                )

                if quand < timezone.now():
                    statut = alea.choice(STATUTS_PASSES)
                else:
                    statut = "pending"

                raison = None
                if statut in {"cancelled", "not_realized"}:
                    raison = alea.choice(
                        [
                            "Client indisponible ce jour-là.",
                            "Matériel de tournage indisponible.",
                            "Conditions météo défavorables.",
                        ]
                    )

                tournage = Shooting.objects.create(
                    client=client,
                    date=quand,
                    status=statut,
                    status_reason=raison,
                    description=alea.choice(
                        [
                            "Tournage en boutique, lumière naturelle.",
                            "Séance photo produit sur fond neutre.",
                            "Interview courte avec le gérant.",
                            "Captation des coulisses de préparation.",
                        ]
                    ),
                )
                tournage.content_ideas.add(alea.choice(idees))
                if alea.random() < 0.3:
                    tournage.content_ideas.add(alea.choice(idees))
                tournages_client.append(tournage)
                total_tournages += 1

            nb_publications = alea.randint(4, 7)
            for _ in range(nb_publications):
                jours_ecart = alea.randint(0, (fin_fenetre - debut_fenetre).days)
                jour = debut_fenetre + timedelta(days=jours_ecart)
                heure = alea.choice([8, 9, 12, 17, 18])
                quand = timezone.make_aware(
                    timezone.datetime(jour.year, jour.month, jour.day, heure, 0)
                )

                if quand < timezone.now():
                    statut = alea.choice(STATUTS_PASSES + ["rescheduled"])
                else:
                    statut = "pending"

                raison = None
                if statut in {"cancelled", "not_realized", "rescheduled"}:
                    raison = alea.choice(
                        [
                            "Report a la demande du client.",
                            "Contenu a retravailler avant publication.",
                            "Conflit avec une autre campagne.",
                        ]
                    )

                tournage_lie = alea.choice(tournages_client) if tournages_client and alea.random() < 0.4 else None

                Publication.objects.create(
                    client=client,
                    date=quand,
                    content_idea=alea.choice(idees),
                    shooting=tournage_lie,
                    status=statut,
                    status_reason=raison,
                    description=alea.choice(
                        [
                            "Publication Instagram + Facebook.",
                            "Story + post carrousel.",
                            "Publication accompagnée d'un jeu concours.",
                            "",
                        ]
                    )
                    or None,
                )
                total_publications += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"{len(clients)} clients, {len(idees)} idees de contenu, "
                f"{total_tournages} tournages, {total_publications} publications."
            )
        )
