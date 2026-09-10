"""Alimente Chantiers avec des donnees fictives, pour tester l'interface.

Rejouable sans danger : les projets de demonstration (et tout ce qui leur est
rattache — phases, taches, mises a jour, photos, rapports) sont recrees a
chaque execution. Un projet cree ailleurs (par exemple manuellement depuis
l'interface) n'est jamais touche.

    docker compose exec chantiers python manage.py donnees_test
"""

from __future__ import annotations

import io
import random
from datetime import timedelta

from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand
from django.utils import timezone

from chantiers.models import MiseAJourJournaliere, Phase, Photo, Project, Rapport, SousPhase, Tache

NOMS_PROJETS_DEMO = [
    "Résidence Teranga",
    "Extension Entrepôt GDA",
    "Villa Fleuve Niger",
]

STRUCTURE = [
    ("Fondations", ["Terrassement", "Fouilles"], ["Implantation", "Excavation", "Coulage semelles"]),
    ("Gros œuvre", ["Élévation", "Dalles"], ["Maçonnerie murs", "Poteaux et poutres", "Coulage dalle"]),
    ("Second œuvre", ["Électricité", "Plomberie"], ["Câblage", "Tableaux électriques", "Réseau d'eau"]),
    ("Finitions", ["Peinture", "Menuiserie"], ["Enduits", "Peinture murs", "Pose portes et fenêtres"]),
]

METEOS = ["Ensoleillé", "Nuageux", "Pluie légère", "Chaleur sèche", "Vent modéré"]

COULEURS_PLACEHOLDER = [(200, 120, 60), (90, 130, 90), (120, 120, 160), (180, 90, 90)]


def _image_placeholder(couleur) -> ContentFile:
    from PIL import Image

    tampon = io.BytesIO()
    Image.new("RGB", (640, 480), couleur).save(tampon, format="JPEG")
    return ContentFile(tampon.getvalue(), name="photo.jpg")


class Command(BaseCommand):
    help = "Alimente Chantiers avec des projets, taches, mises a jour, photos et rapports fictifs."

    def handle(self, *args, **options):
        alea = random.Random(7)

        Project.objects.filter(name__in=NOMS_PROJETS_DEMO).delete()

        aujourd_hui = timezone.localdate()

        # Avancement cible par projet : combien de jours de mises a jour on
        # rejoue, et jusqu'a quel pourcentage moyen — pour varier l'etat des
        # trois projets (un bien avance, un en cours, un qui demarre).
        profils = [
            {"jours_historique": 45, "avancement_max": 92, "client": "Groupe Immobilier Sahel", "status": "en_cours"},
            {"jours_historique": 30, "avancement_max": 55, "client": "GDA Logistique", "status": "en_cours"},
            {"jours_historique": 8, "avancement_max": 15, "client": "Awa Diarra", "status": "planifie"},
        ]

        for index, (nom, profil) in enumerate(zip(NOMS_PROJETS_DEMO, profils)):
            projet = Project.objects.create(
                name=nom,
                description=f"Chantier de demonstration — {nom}.",
                client=profil["client"],
                start_date=aujourd_hui - timedelta(days=profil["jours_historique"] + 5),
                status=profil["status"],
                sort_order=index,
                user_ids=[1],
                user_names={"1": "Hamadoun Cisse"},
            )

            taches_du_projet = []
            for sort_phase, (nom_phase, noms_sous_phases, activites) in enumerate(STRUCTURE):
                phase = Phase.objects.create(projet=projet, name=nom_phase, sort_order=sort_phase)
                for sort_sous, nom_sous in enumerate(noms_sous_phases):
                    sous_phase = SousPhase.objects.create(phase=phase, name=nom_sous, sort_order=sort_sous)
                    for sort_tache, activite in enumerate(activites):
                        tache = Tache.objects.create(
                            sous_phase=sous_phase,
                            activity=f"{activite} — {nom_sous}",
                            start_day=sort_phase * 10 + 1,
                            duration_days=alea.randint(3, 12),
                            sort_order=sort_tache,
                        )
                        taches_du_projet.append((tache, sort_phase))

            # Rejoue un historique de mises a jour : plus une tache appartient
            # a une phase avancee dans le temps du chantier, plus elle demarre
            # tard — pour que la progression par phase ait une forme credible
            # (fondations terminees avant que les finitions ne commencent).
            nb_phases = len(STRUCTURE)
            for tache, indice_phase in taches_du_projet:
                depart_relatif = int((indice_phase / nb_phases) * profil["jours_historique"])
                jours_actifs = max(1, profil["jours_historique"] - depart_relatif)
                cible = max(0, profil["avancement_max"] - indice_phase * alea.randint(5, 20))
                cible = min(100, max(0, cible))
                # Une tache tres avancee d'une phase deja bien engagee finit
                # par etre vraiment terminee — sans ca, aucune tache
                # n'atteignait jamais 100%, meme sur le chantier le plus avance.
                if cible >= 80 and alea.random() < 0.5:
                    cible = 100
                # Un abandon occasionnel : annule directement, sans historique
                # de progression — le stagiaire de chantier a simplement
                # constate que la tache ne se ferait pas.
                annulee = indice_phase >= 2 and alea.random() < 0.08

                if annulee:
                    MiseAJourJournaliere.objects.create(
                        tache=tache,
                        user_id=1,
                        user_name="Hamadoun Cisse",
                        report_date=aujourd_hui - timedelta(days=alea.randint(1, jours_actifs)),
                        progress=0,
                        status="annule",
                        comment="Tache annulee : hors perimetre revu avec le client.",
                    )
                    continue

                progression = 0
                pas = max(1, jours_actifs // alea.randint(3, 6))
                jour_courant = -jours_actifs
                while jour_courant <= 0 and progression < cible:
                    progression = min(cible, progression + alea.randint(5, 25))
                    date_maj = aujourd_hui + timedelta(days=jour_courant)
                    MiseAJourJournaliere.objects.update_or_create(
                        tache=tache,
                        report_date=date_maj,
                        defaults=dict(
                            user_id=1,
                            user_name="Hamadoun Cisse",
                            progress=progression,
                            status=MiseAJourJournaliere.status_from_progress(progression),
                            comment=alea.choice(
                                [
                                    "Avancement conforme au planning.",
                                    "Leger retard rattrape le lendemain.",
                                    "Equipe complete sur site.",
                                    "",
                                ]
                            )
                            or None,
                        ),
                    )
                    jour_courant += pas

                # Force le dernier point de donnees a la cible exacte : les pas
                # aleatoires laissaient parfois la progression juste sous 100,
                # et aucune tache ne passait jamais vraiment a « terminee ».
                if cible == 100 and progression < 100:
                    MiseAJourJournaliere.objects.update_or_create(
                        tache=tache,
                        report_date=aujourd_hui,
                        defaults=dict(
                            user_id=1,
                            user_name="Hamadoun Cisse",
                            progress=100,
                            status="termine",
                            comment="Tache terminee.",
                        ),
                    )

            # Photos : quelques cliches par categorie, avec un vrai fichier
            # image (place-holder colore) pour que la galerie ait du contenu.
            for categorie, couleur in zip(["avant", "pendant", "apres"], COULEURS_PLACEHOLDER):
                photo = Photo(
                    projet=projet,
                    user_id=1,
                    user_name="Hamadoun Cisse",
                    category=categorie,
                    caption=f"{categorie.capitalize()} — {nom}",
                    taken_at=aujourd_hui - timedelta(days=alea.randint(1, profil["jours_historique"])),
                )
                fichier = _image_placeholder(couleur)
                photo.file.save(fichier.name, fichier, save=False)
                photo.file_size = fichier.size
                photo.save()

            # Rapports : un ou deux, avec un instantane de l'avancement global.
            for _ in range(alea.randint(1, 2)):
                Rapport.objects.create(
                    projet=projet,
                    user_id=1,
                    user_name="Hamadoun Cisse",
                    report_date=aujourd_hui - timedelta(days=alea.randint(0, min(5, profil["jours_historique"]))),
                    temperature=alea.uniform(24, 38),
                    weather=alea.choice(METEOS),
                    page_number=str(alea.randint(1, 3)),
                    overall_progress=projet.overall_progress(),
                    notes="Rapport genere automatiquement pour la demonstration.",
                )

        self.stdout.write(
            self.style.SUCCESS(f"{len(NOMS_PROJETS_DEMO)} projets de demonstration crees avec leur historique complet.")
        )
