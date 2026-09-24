import unicodedata
from datetime import date, timedelta
from urllib.parse import quote

from django.db.models import Q
from django.http import Http404, HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from . import services
from .models import (
    STATUTS_NECESSITANT_RAISON,
    ClientPlanning,
    ClientReport,
    ContentIdea,
    Publication,
    PublicationRule,
    Shooting,
)
from .permissions import EcritureReserveeAAdmin, ReserveEquipe
from .serializers import (
    ClientPlanningSerializer,
    ClientReportSerializer,
    ContentIdeaSerializer,
    PublicationRuleSerializer,
    PublicationSerializer,
    ShootingSerializer,
)


def parse_datetime_aware(brute):
    """`parse_datetime` renvoie un datetime naïf si la chaîne n'a pas d'offset —
    on le rend conscient du fuseau pour éviter un TypeError au premier `is_overdue()`
    (`self.date < timezone.now()`) une fois la valeur relue depuis la base."""
    dt = parse_datetime(brute) if brute else None
    if dt is not None and timezone.is_naive(dt):
        dt = timezone.make_aware(dt)
    return dt


def parametres_mois(requete):
    aujourd_hui = timezone.localdate()
    mois = int(requete.query_params.get("month", aujourd_hui.month))
    annee = int(requete.query_params.get("year", aujourd_hui.year))
    return mois, annee


def bornes_mois(mois: int, annee: int):
    debut = date(annee, mois, 1)
    fin = date(annee + (1 if mois == 12 else 0), 1 if mois == 12 else mois + 1, 1) - timedelta(days=1)
    return debut, fin


def serialiser_grille(grille, contexte=None):
    return [
        [
            {
                "date": jour["date"].isoformat(),
                "est_mois_courant": jour["est_mois_courant"],
                "tournages": ShootingSerializer(jour["tournages"], many=True, context=contexte).data,
                "publications": PublicationSerializer(jour["publications"], many=True, context=contexte).data,
                "avertissement": jour["avertissement"],
            }
            for jour in semaine
        ]
        for semaine in grille
    ]


def entete_telechargement(nom_fichier: str) -> str:
    """`filename` ASCII (accents retires) + `filename*` UTF-8 (RFC 5987).

    Les noms de fichiers ici portent des mois en francais ("Août", "Décembre") :
    un en-tete HTTP n'accepte que du Latin-1, et l'ecrire tel quel corrompt le
    nom telecharge ("Ao?t"). Un client qui ignore `filename*` retombe sur
    la version sans accents plutot que sur du texte illisible.
    """
    ascii_repli = unicodedata.normalize("NFKD", nom_fichier).encode("ascii", "ignore").decode("ascii")
    return f"attachment; filename=\"{ascii_repli}\"; filename*=UTF-8''{quote(nom_fichier)}"


def reponse_pdf(pdf: bytes, nom_fichier: str) -> HttpResponse:
    reponse = HttpResponse(pdf, content_type="application/pdf")
    reponse["Content-Disposition"] = entete_telechargement(nom_fichier)
    return reponse


def reponse_csv(contenu: bytes, nom_fichier: str) -> HttpResponse:
    reponse = HttpResponse(contenu, content_type="text/csv; charset=UTF-8")
    reponse["Content-Disposition"] = entete_telechargement(nom_fichier)
    return reponse


class ClientPlanningViewSet(viewsets.ModelViewSet):
    """CRUD clients — plus tout ce qui, cote Laravel, vit sous `clients.*` et `client-space.*`."""

    serializer_class = ClientPlanningSerializer
    permission_classes = [EcritureReserveeAAdmin]
    filter_backends = [filters.SearchFilter]
    search_fields = ["nom_entreprise"]

    def get_queryset(self):
        queryset = ClientPlanning.objects.all()
        if self.request.user.est_client:
            queryset = queryset.filter(pk=self.request.user.client_id)
        return queryset

    def create(self, requete, *args, **kwargs):
        if requete.user.est_client:
            return Response(status=status.HTTP_403_FORBIDDEN)
        return super().create(requete, *args, **kwargs)

    @action(detail=True, methods=["get"], url_path="calendrier")
    def calendrier(self, requete, pk=None):
        """Fusion de `ClientController::show` et `::dashboard` : calendrier + stats + listes."""
        client = self.get_object()
        mois, annee = parametres_mois(requete)
        debut, fin = bornes_mois(mois, annee)

        tournages_mois = client.tournages.filter(date__date__gte=debut, date__date__lte=fin).prefetch_related(
            "content_ideas"
        )
        publications_mois = client.publications.filter(
            date__date__gte=debut, date__date__lte=fin
        ).select_related("content_idea", "shooting")

        grille = services.construire_grille_calendrier(annee, mois, tournages_mois, publications_mois)
        stats = client.get_period_stats(debut, fin)

        maintenant = timezone.now()
        horizon = maintenant + timedelta(days=30)
        recul = maintenant - timedelta(days=30)

        tournages_a_venir = client.tournages.filter(
            date__gte=maintenant, date__lte=horizon, status="pending"
        ).order_by("date")
        publications_a_venir = client.publications.filter(
            date__gte=maintenant, date__lte=horizon, status="pending"
        ).order_by("date")
        tournages_recents = client.tournages.filter(date__gte=recul, date__lt=maintenant).order_by("-date")
        publications_recentes = client.publications.filter(date__gte=recul, date__lt=maintenant).order_by("-date")

        rapports_mensuels = client.rapports.filter(report_type="monthly")
        rapports_annuels = client.rapports.filter(report_type="annual")

        return Response(
            {
                "client": ClientPlanningSerializer(client).data,
                "mois": mois,
                "annee": annee,
                "calendrier": serialiser_grille(grille),
                "stats": stats,
                "tournages_a_venir": ShootingSerializer(tournages_a_venir, many=True).data,
                "publications_a_venir": PublicationSerializer(publications_a_venir, many=True).data,
                "tournages_recents": ShootingSerializer(tournages_recents, many=True).data,
                "publications_recentes": PublicationSerializer(publications_recentes, many=True).data,
                "rapports_mensuels": ClientReportSerializer(rapports_mensuels, many=True).data,
                "rapports_annuels": ClientReportSerializer(rapports_annuels, many=True).data,
                "lecture_seule": not requete.user.peut_ecrire,
            }
        )

    @action(detail=True, methods=["get"], url_path="tournages/(?P<tournage_id>[0-9]+)")
    def tournage_detail(self, requete, pk=None, tournage_id=None):
        """`showShooting()` — lecture seule, verifie que le tournage appartient bien au client."""
        client = self.get_object()
        tournage = get_object_or_404(Shooting.objects.select_related("client"), pk=tournage_id)
        if tournage.client_id != client.id:
            return Response(status=status.HTTP_403_FORBIDDEN)
        return Response(ShootingSerializer(tournage).data)

    @action(detail=True, methods=["get"], url_path="publications/(?P<publication_id>[0-9]+)")
    def publication_detail(self, requete, pk=None, publication_id=None):
        """`showPublication()` — meme principe."""
        client = self.get_object()
        publication = get_object_or_404(Publication.objects.select_related("client"), pk=publication_id)
        if publication.client_id != client.id:
            return Response(status=status.HTTP_403_FORBIDDEN)
        return Response(PublicationSerializer(publication).data)

    @action(detail=True, methods=["get"], url_path="rapport-genere")
    def rapport_genere(self, requete, pk=None):
        """`ClientController::generateReport` — planning en PDF, mensuel ou annuel."""
        client = self.get_object()
        type_periode = requete.query_params.get("type", "monthly")
        mois, annee = parametres_mois(requete)
        pdf, nom_fichier = services.generer_rapport_client_pdf(client, type_periode, mois, annee)
        return reponse_pdf(pdf, nom_fichier)

    @action(detail=True, methods=["get", "post"], url_path="rapports")
    def rapports(self, requete, pk=None):
        client = self.get_object()
        if requete.method == "POST":
            if not requete.user.peut_ecrire:
                return Response(status=status.HTTP_403_FORBIDDEN)
            serializer = ClientReportSerializer(data=requete.data)
            serializer.is_valid(raise_exception=True)
            serializer.save(client=client)
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        return Response(
            {
                "mensuels": ClientReportSerializer(client.rapports.filter(report_type="monthly"), many=True).data,
                "annuels": ClientReportSerializer(client.rapports.filter(report_type="annual"), many=True).data,
            }
        )

    @action(detail=True, methods=["get", "delete"], url_path=r"rapports/(?P<rapport_id>[0-9]+)")
    def rapport_detail(self, requete, pk=None, rapport_id=None):
        client = self.get_object()
        rapport = get_object_or_404(ClientReport, pk=rapport_id, client=client)

        if requete.method == "DELETE":
            if not requete.user.peut_ecrire:
                return Response(status=status.HTTP_403_FORBIDDEN)
            rapport.file.delete(save=False)
            rapport.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)

        try:
            fichier = rapport.file.open("rb")
        except FileNotFoundError as erreur:
            raise Http404("Fichier non trouvé.") from erreur

        type_libelle = "Mensuel" if rapport.report_type == "monthly" else "Annuel"
        nom = f"{client.nom_entreprise}_Rapport_{type_libelle}_{rapport.report_date:%Y-%m}.pdf"
        reponse = HttpResponse(fichier.read(), content_type="application/pdf")
        reponse["Content-Disposition"] = entete_telechargement(nom)
        return reponse


class PublicationRuleViewSet(viewsets.ModelViewSet):
    """`PublicationRuleController` — regles nichees sous un client (`?client=<id>`)."""

    serializer_class = PublicationRuleSerializer
    permission_classes = [ReserveEquipe, EcritureReserveeAAdmin]

    def get_queryset(self):
        queryset = PublicationRule.objects.select_related("client")
        client_id = self.request.query_params.get("client")
        if client_id:
            queryset = queryset.filter(client_id=client_id)
        return queryset.order_by("day_of_week")

    def create(self, requete, *args, **kwargs):
        client_id = requete.data.get("client")
        client = get_object_or_404(ClientPlanning, pk=client_id)
        if PublicationRule.objects.filter(client=client, day_of_week=requete.data.get("day_of_week")).exists():
            return Response({"day_of_week": "Cette règle existe déjà pour ce client."}, status=400)
        serializer = self.get_serializer(data=requete.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(client=client)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ContentIdeaViewSet(viewsets.ModelViewSet):
    queryset = ContentIdea.objects.all()
    serializer_class = ContentIdeaSerializer
    permission_classes = [ReserveEquipe, EcritureReserveeAAdmin]
    filter_backends = [filters.SearchFilter]
    search_fields = ["titre"]

    def get_queryset(self):
        return ContentIdea.objects.all().order_by("-created_at")


class ShootingViewSet(viewsets.ModelViewSet):
    """`ShootingController` — calendrier global + CRUD + statut + reprogrammation + export."""

    serializer_class = ShootingSerializer
    permission_classes = [ReserveEquipe, EcritureReserveeAAdmin]
    filter_backends = [filters.SearchFilter]
    search_fields = ["description", "client__nom_entreprise"]

    def get_queryset(self):
        return Shooting.objects.select_related("client").prefetch_related("content_ideas").order_by("-date")

    @action(detail=False, methods=["get"], url_path="calendrier")
    def calendrier(self, requete):
        mois, annee = parametres_mois(requete)
        debut, fin = bornes_mois(mois, annee)
        tournages = self.get_queryset().filter(date__date__gte=debut, date__date__lte=fin)
        client_id = requete.query_params.get("client_id")
        if client_id and client_id != "all":
            tournages = tournages.filter(client_id=client_id)
        grille = services.construire_grille_calendrier(annee, mois, tournages=tournages)
        return Response({"mois": mois, "annee": annee, "calendrier": serialiser_grille(grille)})

    @action(detail=False, methods=["get"], url_path="export")
    def export(self, requete):
        mois, annee = parametres_mois(requete)
        debut, fin = bornes_mois(mois, annee)
        tournages = self.get_queryset().filter(date__date__gte=debut, date__date__lte=fin)
        grille = services.construire_grille_calendrier(annee, mois, tournages=tournages)
        contenu = services.generer_csv_calendrier(
            grille, services.MOIS_FR[mois], annee, "Calendrier Tournages",
            inclure_tournages=True, inclure_publications=False,
        )
        nom = f"calendrier_tournages_{services.MOIS_FR[mois]}_{annee}.csv"
        return reponse_csv(contenu, nom)

    @action(detail=True, methods=["post"], url_path="statut")
    def changer_statut(self, requete, pk=None):
        """`toggleStatus()` — statut direct, ou reprogrammation en place (`rescheduled`)."""
        tournage = self.get_object()
        nouveau_statut = requete.data.get("status", "completed")
        raison = requete.data.get("status_reason")
        statuts_valides = {"pending", "completed", "not_realized", "cancelled", "rescheduled"}

        if nouveau_statut not in statuts_valides:
            return Response({"status": "Le statut sélectionné est invalide."}, status=400)
        if nouveau_statut in STATUTS_NECESSITANT_RAISON and not raison:
            return Response({"status_reason": "Une description est obligatoire pour ce statut."}, status=400)

        if nouveau_statut == "rescheduled":
            nouvelle_date_brute = requete.data.get("reschedule_date")
            if not nouvelle_date_brute:
                return Response({"reschedule_date": "La nouvelle date est obligatoire pour reprogrammer un tournage."}, status=400)
            nouvelle_date = parse_datetime_aware(nouvelle_date_brute)
            if nouvelle_date is None or nouvelle_date.date() < timezone.localdate():
                return Response({"reschedule_date": "La nouvelle date doit être aujourd'hui ou dans le futur."}, status=400)
            ancienne_date = tournage.date.strftime("%d/%m/%Y %H:%M")
            tournage.date = nouvelle_date
            tournage.status = "pending"
            tournage.status_reason = f"{raison} - Ancienne date : {ancienne_date} - Nouvelle date : {nouvelle_date:%d/%m/%Y %H:%M}"
            tournage.save()
            return Response(ShootingSerializer(tournage).data)

        tournage.status = nouveau_statut
        tournage.status_reason = raison if nouveau_statut in {"not_realized", "cancelled", "rescheduled"} else None
        tournage.save()
        return Response(ShootingSerializer(tournage).data)

    @action(detail=True, methods=["post"], url_path="reprogrammer")
    def reprogrammer(self, requete, pk=None):
        """`reschedule()` — cree un NOUVEAU tournage, marque l'ancien `cancelled` (comportement d'origine)."""
        tournage = self.get_object()
        nouvelle_date_brute = requete.data.get("new_date")
        if not nouvelle_date_brute:
            return Response({"new_date": "La nouvelle date est obligatoire."}, status=400)
        nouvelle_date = parse_datetime_aware(nouvelle_date_brute)
        if nouvelle_date is None:
            return Response({"new_date": "La nouvelle date doit être une date valide."}, status=400)

        nouveau = Shooting.objects.create(client=tournage.client, date=nouvelle_date, status="pending")
        premiere_idee = tournage.content_ideas.first()
        if premiere_idee:
            nouveau.content_ideas.add(premiere_idee)

        tournage.status = "cancelled"
        tournage.save()

        return Response(ShootingSerializer(nouveau).data, status=status.HTTP_201_CREATED)


class PublicationViewSet(viewsets.ModelViewSet):
    """`PublicationController` — calendrier global + CRUD + statut + reprogrammation + export + verification de date."""

    serializer_class = PublicationSerializer
    permission_classes = [ReserveEquipe, EcritureReserveeAAdmin]
    filter_backends = [filters.SearchFilter]
    search_fields = ["description", "client__nom_entreprise"]

    def get_queryset(self):
        return Publication.objects.select_related("client", "content_idea", "shooting").order_by("-date")

    @action(detail=False, methods=["get"], url_path="calendrier")
    def calendrier(self, requete):
        mois, annee = parametres_mois(requete)
        debut, fin = bornes_mois(mois, annee)
        publications = self.get_queryset().filter(date__date__gte=debut, date__date__lte=fin)
        client_id = requete.query_params.get("client_id")
        if client_id and client_id != "all":
            publications = publications.filter(client_id=client_id)
        grille = services.construire_grille_calendrier(annee, mois, publications=publications)
        return Response({"mois": mois, "annee": annee, "calendrier": serialiser_grille(grille)})

    @action(detail=False, methods=["get"], url_path="export")
    def export(self, requete):
        mois, annee = parametres_mois(requete)
        debut, fin = bornes_mois(mois, annee)
        publications = self.get_queryset().filter(date__date__gte=debut, date__date__lte=fin)
        grille = services.construire_grille_calendrier(annee, mois, publications=publications)
        contenu = services.generer_csv_calendrier(
            grille, services.MOIS_FR[mois], annee, "Calendrier Publications",
            inclure_tournages=False, inclure_publications=True,
        )
        nom = f"calendrier_publications_{services.MOIS_FR[mois]}_{annee}.csv"
        return reponse_csv(contenu, nom)

    @action(detail=False, methods=["get"], url_path="verifier-date")
    def verifier_date(self, requete):
        """AJAX consommee par le formulaire de creation/edition — avertit, ne bloque jamais."""
        client_id = requete.query_params.get("client_id")
        date_brute = requete.query_params.get("date")
        exclure = requete.query_params.get("exclude")
        if not client_id or not date_brute:
            return Response({"avertissements": []})
        client = get_object_or_404(ClientPlanning, pk=client_id)
        quand = parse_datetime(date_brute)
        if quand is None:
            return Response({"avertissements": []})
        avertissements = services.verifier_date(client, quand, int(exclure) if exclure else None)
        return Response({"avertissements": avertissements})

    def create(self, requete, *args, **kwargs):
        serializer = self.get_serializer(data=requete.data)
        serializer.is_valid(raise_exception=True)
        client = serializer.validated_data["client"]
        quand = serializer.validated_data["date"]
        avertissements = services.verifier_date(client, quand)
        publication = serializer.save()
        return Response(
            {**self.get_serializer(publication).data, "avertissements": avertissements},
            status=status.HTTP_201_CREATED,
        )

    def update(self, requete, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=requete.data, partial=kwargs.get("partial", False))
        serializer.is_valid(raise_exception=True)
        client = serializer.validated_data.get("client", instance.client)
        quand = serializer.validated_data.get("date", instance.date)
        avertissements = services.verifier_date(client, quand, exclure_publication_id=instance.id)
        publication = serializer.save()
        return Response({**self.get_serializer(publication).data, "avertissements": avertissements})

    @action(detail=True, methods=["post"], url_path="statut")
    def changer_statut(self, requete, pk=None):
        publication = self.get_object()
        nouveau_statut = requete.data.get("status", "completed")
        raison = requete.data.get("status_reason")
        statuts_valides = {"pending", "completed", "not_realized", "cancelled", "rescheduled"}

        if nouveau_statut not in statuts_valides:
            return Response({"status": "Le statut sélectionné est invalide."}, status=400)
        if nouveau_statut in STATUTS_NECESSITANT_RAISON and not raison:
            return Response({"status_reason": "Une description est obligatoire pour ce statut."}, status=400)

        if nouveau_statut == "rescheduled":
            nouvelle_date_brute = requete.data.get("reschedule_date")
            if not nouvelle_date_brute:
                return Response({"reschedule_date": "La nouvelle date est obligatoire pour reprogrammer une publication."}, status=400)
            nouvelle_date = parse_datetime_aware(nouvelle_date_brute)
            if nouvelle_date is None:
                return Response({"reschedule_date": "La date doit être une date valide."}, status=400)
            ancienne_date = publication.date.strftime("%d/%m/%Y %H:%M")
            publication.date = nouvelle_date
            publication.status = "pending"
            publication.status_reason = f"{raison} - Ancienne date : {ancienne_date} - Nouvelle date : {nouvelle_date:%d/%m/%Y %H:%M}"
            publication.save()
            return Response(PublicationSerializer(publication).data)

        publication.status = nouveau_statut
        publication.status_reason = raison if nouveau_statut in {"not_realized", "cancelled", "rescheduled"} else None
        publication.save()
        return Response(PublicationSerializer(publication).data)

    @action(detail=True, methods=["post"], url_path="reprogrammer")
    def reprogrammer(self, requete, pk=None):
        """`reschedule()` — cree une NOUVELLE publication, marque l'ancienne `rescheduled` (asymetrie d'origine avec les tournages)."""
        publication = self.get_object()
        nouvelle_date_brute = requete.data.get("new_date")
        if not nouvelle_date_brute:
            return Response({"new_date": "La nouvelle date est obligatoire."}, status=400)
        nouvelle_date = parse_datetime_aware(nouvelle_date_brute)
        if nouvelle_date is None:
            return Response({"new_date": "La nouvelle date doit être une date valide."}, status=400)

        nouvelle = Publication.objects.create(
            client=publication.client, date=nouvelle_date, content_idea=publication.content_idea, status="pending"
        )
        publication.status = "rescheduled"
        publication.status_reason = f"Reprogrammée - Nouvelle date : {nouvelle_date_brute}"
        publication.save()

        return Response(PublicationSerializer(nouvelle).data, status=status.HTTP_201_CREATED)


class TableauDeBordVue(APIView):
    """`DashboardController::index/getCalendarData` — calendrier combine, alertes, stats globales."""

    permission_classes = [ReserveEquipe]

    def get(self, requete):
        mois, annee = parametres_mois(requete)
        debut, fin = bornes_mois(mois, annee)
        maintenant = timezone.now()
        client_id = requete.query_params.get("client_id")
        client_id = client_id if client_id and client_id != "all" else None

        tournages_mois = Shooting.objects.select_related("client").prefetch_related("content_ideas").filter(
            date__date__gte=debut, date__date__lte=fin
        )
        publications_mois = Publication.objects.select_related("client", "content_idea", "shooting").filter(
            date__date__gte=debut, date__date__lte=fin
        )
        tournages_retard = Shooting.objects.select_related("client").filter(status="pending", date__lt=maintenant)
        publications_retard = Publication.objects.select_related("client", "content_idea").filter(
            status="pending", date__lt=maintenant
        )
        horizon = maintenant + timedelta(days=3)
        tournages_a_venir = Shooting.objects.select_related("client").filter(
            status="pending", date__gte=maintenant, date__lte=horizon
        )
        publications_a_venir = Publication.objects.select_related("client", "content_idea").filter(
            status="pending", date__gte=maintenant, date__lte=horizon
        )
        shootings_this_month = Shooting.objects.filter(date__year=annee, date__month=mois)
        publications_this_month = Publication.objects.filter(date__year=annee, date__month=mois)
        # "Prochains tournages/publications" du tableau de bord : les 5 plus
        # proches en attente, sans se limiter aux 3 jours des alertes ci-dessus.
        tournages_prochains = Shooting.objects.select_related("client").filter(status="pending", date__gte=maintenant)
        publications_prochains = Publication.objects.select_related("client", "content_idea").filter(
            status="pending", date__gte=maintenant
        )

        if client_id:
            tournages_mois = tournages_mois.filter(client_id=client_id)
            publications_mois = publications_mois.filter(client_id=client_id)
            tournages_retard = tournages_retard.filter(client_id=client_id)
            publications_retard = publications_retard.filter(client_id=client_id)
            tournages_a_venir = tournages_a_venir.filter(client_id=client_id)
            publications_a_venir = publications_a_venir.filter(client_id=client_id)
            shootings_this_month = shootings_this_month.filter(client_id=client_id)
            publications_this_month = publications_this_month.filter(client_id=client_id)
            tournages_prochains = tournages_prochains.filter(client_id=client_id)
            publications_prochains = publications_prochains.filter(client_id=client_id)

        grille = services.construire_grille_calendrier(annee, mois, tournages_mois, publications_mois)
        tournages_retard = tournages_retard.order_by("date")
        publications_retard = publications_retard.order_by("date")
        tournages_a_venir = tournages_a_venir.order_by("date")
        publications_a_venir = publications_a_venir.order_by("date")
        tournages_prochains = tournages_prochains.order_by("date")[:5]
        publications_prochains = publications_prochains.order_by("date")[:5]

        stats = {
            "clients_count": ClientPlanning.objects.count(),
            "shootings_this_month": shootings_this_month.count(),
            "publications_this_month": publications_this_month.count(),
        }

        return Response(
            {
                "mois": mois,
                "annee": annee,
                "calendrier": serialiser_grille(grille),
                "stats": stats,
                "tournages_en_retard": ShootingSerializer(tournages_retard, many=True).data,
                "publications_en_retard": PublicationSerializer(publications_retard, many=True).data,
                "tournages_a_venir": ShootingSerializer(tournages_a_venir, many=True).data,
                "publications_a_venir": PublicationSerializer(publications_a_venir, many=True).data,
                "tournages_prochains": ShootingSerializer(tournages_prochains, many=True).data,
                "publications_prochains": PublicationSerializer(publications_prochains, many=True).data,
            }
        )


class RapportGlobalVue(APIView):
    """`DashboardController::generateReport` — rapport HTML-en-.doc, tous clients ou un seul."""

    permission_classes = [ReserveEquipe]

    def get(self, requete):
        periode = requete.query_params.get("period", "monthly")
        if periode not in {"weekly", "monthly", "annual"}:
            periode = "monthly"
        client_id = requete.query_params.get("client_id")

        if client_id and client_id != "all":
            client = get_object_or_404(ClientPlanning, pk=client_id)
            pdf, nom_fichier = services.generer_rapport_global_pdf([client], periode, client_unique=client)
        else:
            clients = ClientPlanning.objects.all().order_by("nom_entreprise")
            pdf, nom_fichier = services.generer_rapport_global_pdf(clients, periode)

        return reponse_pdf(pdf, nom_fichier)


class ExportGlobalVue(APIView):
    """`DashboardController::exportCalendar` — CSV combine tournages + publications."""

    permission_classes = [ReserveEquipe]

    def get(self, requete):
        mois, annee = parametres_mois(requete)
        debut, fin = bornes_mois(mois, annee)
        tournages = Shooting.objects.select_related("client").prefetch_related("content_ideas").filter(
            date__date__gte=debut, date__date__lte=fin
        )
        publications = Publication.objects.select_related("client", "content_idea", "shooting").filter(
            date__date__gte=debut, date__date__lte=fin
        )
        grille = services.construire_grille_calendrier(annee, mois, tournages, publications)
        contenu = services.generer_csv_calendrier(
            grille, services.MOIS_FR[mois], annee, "Planning Global",
            inclure_tournages=True, inclure_publications=True,
        )
        nom = f"calendrier_{services.MOIS_FR[mois]}_{annee}.csv"
        return reponse_csv(contenu, nom)


class StatistiquesVue(APIView):
    """Contenu "réalisé" (statut `completed`) — tournages + publications,
    regroupés par semaine, par mois, par année et par client. N'existait pas
    cote Laravel (seule une comparaison calendrier cote-a-cote existait) ;
    construit pour répondre au besoin d'un vrai tableau de bord analytique."""

    permission_classes = [ReserveEquipe]

    def get(self, requete):
        client_id = requete.query_params.get("client_id")
        client_id = client_id if client_id and client_id != "all" else None

        tournages_ok = Shooting.objects.filter(status="completed")
        publications_ok = Publication.objects.filter(status="completed")
        if client_id:
            tournages_ok = tournages_ok.filter(client_id=client_id)
            publications_ok = publications_ok.filter(client_id=client_id)
        maintenant = timezone.now()

        par_semaine = []
        lundi_courant = maintenant.date() - timedelta(days=maintenant.weekday())
        for i in range(11, -1, -1):
            debut = lundi_courant - timedelta(weeks=i)
            fin = debut + timedelta(days=6)
            par_semaine.append(
                {
                    "debut": debut.isoformat(),
                    "fin": fin.isoformat(),
                    "tournages": tournages_ok.filter(date__date__gte=debut, date__date__lte=fin).count(),
                    "publications": publications_ok.filter(date__date__gte=debut, date__date__lte=fin).count(),
                }
            )

        par_mois = []
        for i in range(11, -1, -1):
            total = maintenant.month - 1 - i
            annee = maintenant.year + (total // 12)
            mois = (total % 12) + 1
            par_mois.append(
                {
                    "mois": mois,
                    "annee": annee,
                    "tournages": tournages_ok.filter(date__year=annee, date__month=mois).count(),
                    "publications": publications_ok.filter(date__year=annee, date__month=mois).count(),
                }
            )

        annees_tournages = set(d.year for d in tournages_ok.dates("date", "year"))
        annees_publications = set(d.year for d in publications_ok.dates("date", "year"))
        par_annee = []
        for annee in sorted(annees_tournages | annees_publications):
            par_annee.append(
                {
                    "annee": annee,
                    "tournages": tournages_ok.filter(date__year=annee).count(),
                    "publications": publications_ok.filter(date__year=annee).count(),
                }
            )

        tournages_non_ok = Shooting.objects.exclude(status="completed")
        publications_non_ok = Publication.objects.exclude(status="completed")

        par_client = []
        for client in ClientPlanning.objects.all().order_by("nom_entreprise"):
            par_client.append(
                {
                    "client": client.nom_entreprise,
                    "tournages": tournages_ok.filter(client=client).count(),
                    "publications": publications_ok.filter(client=client).count(),
                    "tournages_non_realises": tournages_non_ok.filter(client=client).count(),
                    "publications_non_realisees": publications_non_ok.filter(client=client).count(),
                }
            )

        statuts_possibles = ["pending", "completed", "not_realized", "cancelled", "rescheduled"]
        tournages_tous = Shooting.objects.filter(client_id=client_id) if client_id else Shooting.objects.all()
        publications_toutes = Publication.objects.filter(client_id=client_id) if client_id else Publication.objects.all()
        statuts = {
            "tournages": {s: tournages_tous.filter(status=s).count() for s in statuts_possibles},
            "publications": {s: publications_toutes.filter(status=s).count() for s in statuts_possibles},
        }

        if client_id:
            idees_realisees_q = Q(tournages__status="completed", tournages__client_id=client_id) | Q(
                publications__status="completed", publications__client_id=client_id
            )
        else:
            idees_realisees_q = Q(tournages__status="completed") | Q(publications__status="completed")
        par_type_idees = []
        for valeur, _libelle in ContentIdea.TYPE_CHOICES:
            idees_du_type = ContentIdea.objects.filter(type=valeur)
            par_type_idees.append(
                {
                    "type": valeur,
                    "total": idees_du_type.count(),
                    "realisees": idees_du_type.filter(idees_realisees_q).distinct().count(),
                }
            )
        idees = {
            "total": ContentIdea.objects.count(),
            "realisees": ContentIdea.objects.filter(idees_realisees_q).distinct().count(),
            "par_type": par_type_idees,
        }

        clients_actifs_q = Q(tournages__isnull=False) | Q(publications__isnull=False)
        clients_stats = {
            "total": ClientPlanning.objects.count(),
            "actifs": ClientPlanning.objects.filter(clients_actifs_q).distinct().count(),
        }

        return Response(
            {
                "par_semaine": par_semaine,
                "par_mois": par_mois,
                "par_annee": par_annee,
                "par_client": par_client,
                "statuts": statuts,
                "idees": idees,
                "clients": clients_stats,
            }
        )
