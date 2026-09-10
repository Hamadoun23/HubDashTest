"""Regles metier — port fidele des controleurs Laravel de Planning-main.

Regroupe ici ce qui, cote Laravel, vivait disperse dans
`DashboardController`, `ShootingController`, `PublicationController` et
`ClientController` : construction du calendrier, verification de date,
export CSV et generation des rapports HTML-en-.doc.
"""

from __future__ import annotations

import csv
import io
from datetime import date, datetime, timedelta

from django.utils import timezone

from .models import JOURS_FR, Publication, Shooting, jour_semaine_fr

MOIS_FR = [
    "", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
]

JOURS_ENTETE = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"]


def debut_semaine_lundi(d: date) -> date:
    return d - timedelta(days=d.weekday())


def construire_grille_calendrier(annee: int, mois: int, tournages=None, publications=None):
    """Meme algorithme que `buildCombinedCalendar()` / `buildCalendar()` cote Laravel.

    `tournages` et `publications` sont des querysets deja filtres sur le mois ;
    on les regroupe ici par jour ISO (`Y-m-d`).
    """
    premier_jour = date(annee, mois, 1)
    dernier_jour = date(
        annee + (1 if mois == 12 else 0), 1 if mois == 12 else mois + 1, 1
    ) - timedelta(days=1)

    tournages_par_jour: dict[str, list] = {}
    for t in tournages or []:
        tournages_par_jour.setdefault(t.date.date().isoformat(), []).append(t)

    publications_par_jour: dict[str, list] = {}
    for p in publications or []:
        publications_par_jour.setdefault(p.date.date().isoformat(), []).append(p)

    jour_courant = debut_semaine_lundi(premier_jour)
    fin_grille = debut_semaine_lundi(dernier_jour) + timedelta(days=6)

    semaines = []
    while jour_courant <= fin_grille:
        semaine = []
        for _ in range(7):
            cle = jour_courant.isoformat()
            jour_tournages = tournages_par_jour.get(cle, [])
            jour_publications = publications_par_jour.get(cle, [])

            avertissement = False
            jour_fr = jour_semaine_fr(jour_courant)
            for pub in jour_publications:
                if pub.client.is_day_not_recommended(jour_fr):
                    avertissement = True
                    break

            semaine.append(
                {
                    "date": jour_courant,
                    "est_mois_courant": jour_courant.month == mois,
                    "tournages": jour_tournages,
                    "publications": jour_publications,
                    "avertissement": avertissement,
                }
            )
            jour_courant += timedelta(days=1)
        semaines.append(semaine)

    return semaines


def verifier_date(client, quand: datetime, exclure_publication_id: int | None = None) -> list[str]:
    """Meme verification que `PublicationController::create/store/update` (avertit, ne bloque jamais)."""
    avertissements = []

    existante = Publication.objects.filter(client=client, date__date=quand.date())
    if exclure_publication_id:
        existante = existante.exclude(pk=exclure_publication_id)
    if existante.exists():
        avertissements.append(
            f"Une publication existe déjà pour ce client le {quand:%d/%m/%Y}."
        )

    jour_fr = jour_semaine_fr(quand)
    if client.is_day_not_recommended(jour_fr):
        avertissements.append(
            f"Ce jour ({jour_fr.capitalize()}) est non recommandé pour la publication pour ce client."
        )

    return avertissements


def _icone_et_texte_statut(objet, libelles_completee: str, libelle_annulee: str) -> tuple[str, str]:
    if objet.status == "cancelled":
        return "❌", libelle_annulee
    if objet.is_completed():
        return "✅", libelles_completee
    if objet.is_overdue():
        return "🚨", "En retard"
    if objet.is_upcoming():
        return "⏰", "À venir"
    return "", "En attente"


def generer_csv_calendrier(semaines, nom_mois: str, annee: int, titre: str, inclure_tournages: bool, inclure_publications: bool) -> bytes:
    """Reproduit `generateCalendarCSV()` : BOM UTF-8, separateur `;`, une cellule par jour."""
    tampon = io.StringIO()
    tampon.write("﻿")
    ecrivain = csv.writer(tampon, delimiter=";")

    ecrivain.writerow([f"{titre} - {nom_mois} {annee}"])
    ecrivain.writerow([])
    ecrivain.writerow(JOURS_ENTETE)

    for semaine in semaines:
        ligne = []
        for jour in semaine:
            contenu = []
            if jour["est_mois_courant"]:
                contenu.append(jour["date"].strftime("%d/%m"))

                if inclure_tournages:
                    for tournage in jour["tournages"]:
                        icone, texte = _icone_et_texte_statut(tournage, "Complété", "Annulé")
                        prefixe = "TOURNAGE - " if inclure_publications else ""
                        contenu.append(f"{icone} {prefixe}{tournage.client.nom_entreprise}")
                        contenu.append(f"   Statut: {texte}")
                        idees = list(tournage.content_ideas.all())
                        if idees:
                            contenu.append(f"   Idées de contenu ({len(idees)}):")
                            for idee in idees:
                                contenu.append(f"     • {idee.titre}")

                if inclure_publications:
                    for publication in jour["publications"]:
                        icone, texte = _icone_et_texte_statut(publication, "Complétée", "Annulée")
                        prefixe = "PUBLICATION - " if inclure_tournages else ""
                        contenu.append(f"{icone} {prefixe}{publication.client.nom_entreprise}")
                        contenu.append(f"   Statut: {texte}")
                        if publication.content_idea:
                            contenu.append(f"   Idée: {publication.content_idea.titre}")
                        if publication.shooting:
                            contenu.append(f"   Tournage lié: {publication.shooting.date:%d/%m/%Y}")
                        if publication.is_day_not_recommended():
                            contenu.append("   ⚠️ Jour non recommandé pour ce client")
            else:
                contenu.append(jour["date"].strftime("%d/%m"))
            ligne.append("\n".join(contenu))
        ecrivain.writerow(ligne)

    return tampon.getvalue().encode("utf-8")


_STYLE_RAPPORT = """
        body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
        h1 { color: #FF6A3A; border-bottom: 3px solid #FF6A3A; padding-bottom: 10px; }
        h2 { color: #303030; margin-top: 30px; border-bottom: 2px solid #303030; padding-bottom: 5px; }
        h3 { color: #FF6A3A; margin-top: 20px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th { background-color: #FF6A3A; color: white; padding: 12px; text-align: left; }
        td { border: 1px solid #ddd; padding: 10px; }
        tr:nth-child(even) { background-color: #f9f9f9; }
        .status-completed { color: #28a745; font-weight: bold; }
        .status-pending { color: #ffc107; font-weight: bold; }
        .status-cancelled { color: #6c757d; font-weight: bold; }
        .stat-box { background: #f8f9fa; padding: 15px; margin: 15px 0; border-left: 4px solid #FF6A3A; }
        .client-section { page-break-after: always; margin-bottom: 40px; }
        .summary { background: #fffbf0; padding: 20px; margin: 20px 0; border: 1px solid #ffc107; }
"""


def _echapper(texte: str) -> str:
    import html

    return html.escape(texte or "")


def _texte_statut(statut: str, completee: str, annulee: str) -> str:
    return {"completed": completee, "cancelled": annulee}.get(statut, "En attente")


def _section_client_html(client, tournages, publications, regles, avec_description: bool) -> str:
    html_parts = [
        f'<div class="client-section"><h2>{_echapper(client.nom_entreprise)}</h2>',
        '<div class="summary"><h3>Résumé</h3>',
        f"<p><strong>Total Tournages :</strong> {len(tournages)}</p>",
        f"<p><strong>Total Publications :</strong> {len(publications)}</p>",
        f"<p><strong>Tournages complétés :</strong> {sum(1 for t in tournages if t.status == 'completed')}</p>",
        f"<p><strong>Publications complétées :</strong> {sum(1 for p in publications if p.status == 'completed')}</p>",
        f"<p><strong>Tournages en attente :</strong> {sum(1 for t in tournages if t.status == 'pending')}</p>",
        f"<p><strong>Publications en attente :</strong> {sum(1 for p in publications if p.status == 'pending')}</p>",
    ]
    if avec_description:
        html_parts.append(
            f"<p><strong>Tournages annulés :</strong> {sum(1 for t in tournages if t.status == 'cancelled')}</p>"
        )
        html_parts.append(
            f"<p><strong>Publications annulées :</strong> {sum(1 for p in publications if p.status == 'cancelled')}</p>"
        )
    html_parts.append("</div>")

    if regles:
        html_parts.append("<h3>Règles de Publication</h3><table><tr><th>Jour non recommandé</th></tr>")
        for regle in regles:
            html_parts.append(f"<tr><td>{regle.get_day_of_week_display()}</td></tr>")
        html_parts.append("</table>")

    if tournages:
        colonnes = "<th>Date</th><th>Statut</th><th>Idées de contenu</th>" + (
            "<th>Description</th>" if avec_description else ""
        )
        html_parts.append(f"<h3>Tournages</h3><table><tr>{colonnes}</tr>")
        for t in tournages:
            classe = f"status-{t.status}"
            texte = _texte_statut(t.status, "Complété", "Annulé")
            idees = ", ".join(i.titre for i in t.content_ideas.all()) or "Aucune"
            fmt = "%d/%m/%Y %H:%M" if avec_description else "%d/%m/%Y"
            ligne = f"<tr><td>{t.date:{fmt}}</td><td class='{classe}'>{texte}</td><td>{_echapper(idees)}</td>"
            if avec_description:
                ligne += f"<td>{_echapper(t.description) if t.description else 'Aucune'}</td>"
            ligne += "</tr>"
            html_parts.append(ligne)
        html_parts.append("</table>")

    if publications:
        colonnes = "<th>Date</th><th>Idée de contenu</th><th>Tournage lié</th><th>Statut</th>" + (
            "<th>Description</th>" if avec_description else ""
        )
        html_parts.append(f"<h3>Publications</h3><table><tr>{colonnes}</tr>")
        for p in publications:
            classe = f"status-{p.status}"
            texte = _texte_statut(p.status, "Complétée", "Annulée")
            lien = f"Tournage du {p.shooting.date:%d/%m/%Y}" if p.shooting else "Aucun"
            titre = p.content_idea.titre if p.content_idea else "—"
            fmt = "%d/%m/%Y" if not avec_description else "%d/%m/%Y"
            ligne = f"<tr><td>{p.date:{fmt}}</td><td>{_echapper(titre)}</td><td>{lien}</td><td class='{classe}'>{texte}</td>"
            if avec_description:
                ligne += f"<td>{_echapper(p.description) if p.description else 'Aucune'}</td>"
            ligne += "</tr>"
            html_parts.append(ligne)
        html_parts.append("</table>")

    html_parts.append("</div>")
    return "".join(html_parts)


def generer_rapport_client_html(client, type_periode: str, mois: int, annee: int) -> tuple[str, str]:
    """`ClientController::generateReport` — un client, mois ou annee complete."""
    maintenant = timezone.now()

    if type_periode == "annual":
        debut, fin = date(annee, 1, 1), date(annee, 12, 31)
        libelle_periode = f"Année {annee}"
    else:
        debut = date(annee, mois, 1)
        fin = date(annee + (1 if mois == 12 else 0), 1 if mois == 12 else mois + 1, 1) - timedelta(days=1)
        libelle_periode = f"{MOIS_FR[mois]} {annee}"

    tournages = list(client.tournages.filter(date__date__gte=debut, date__date__lte=fin).order_by("date"))
    publications = list(client.publications.filter(date__date__gte=debut, date__date__lte=fin).order_by("date"))
    regles = list(client.regles.all())

    titre = f"Planning - {client.nom_entreprise} - {libelle_periode}"
    corps = _section_client_html(client, tournages, publications, regles, avec_description=True)

    html = (
        f"<!DOCTYPE html><html><head><meta charset='UTF-8'><title>{_echapper(titre)}</title>"
        f"<style>{_STYLE_RAPPORT}</style></head><body>"
        f"<h1>{_echapper(titre)}</h1>"
        f"<p><strong>Date de génération :</strong> {maintenant:%d/%m/%Y à %H:%M}</p>{corps}</body></html>"
    )

    slug = client.nom_entreprise.replace(" ", "_")
    if type_periode == "annual":
        nom_fichier = f"planning_{slug}_{annee}.doc"
    else:
        nom_fichier = f"planning_{slug}_{MOIS_FR[mois]}_{annee}.doc"

    return html, nom_fichier


def generer_rapport_global_html(clients, periode: str, client_unique=None) -> tuple[str, str]:
    """`DashboardController::generateReport` — tous les clients ou un seul, periode libre."""
    maintenant = timezone.now()
    aujourd_hui = timezone.localdate()

    if periode == "weekly":
        debut = debut_semaine_lundi(aujourd_hui)
        fin = debut + timedelta(days=6)
        libelle, slug_periode = "Hebdomadaire", "hebdomadaire"
    elif periode == "annual":
        debut, fin = date(aujourd_hui.year, 1, 1), date(aujourd_hui.year, 12, 31)
        libelle, slug_periode = "Annuel", "annuel"
    else:
        debut = aujourd_hui.replace(day=1)
        fin = date(
            aujourd_hui.year + (1 if aujourd_hui.month == 12 else 0),
            1 if aujourd_hui.month == 12 else aujourd_hui.month + 1,
            1,
        ) - timedelta(days=1)
        libelle, slug_periode = "Mensuel", "mensuel"

    if client_unique is not None:
        titre = f"Rapport {libelle} - {client_unique.nom_entreprise}"
    else:
        titre = f"Rapport {libelle} - Tous les Clients"

    corps = ""
    for client in clients:
        tournages = list(client.tournages.filter(date__date__gte=debut, date__date__lte=fin).order_by("date"))
        publications = list(client.publications.filter(date__date__gte=debut, date__date__lte=fin).order_by("date"))
        regles = list(client.regles.all())
        corps += _section_client_html(client, tournages, publications, regles, avec_description=False)

    html = (
        f"<!DOCTYPE html><html><head><meta charset='UTF-8'><title>{_echapper(titre)}</title>"
        f"<style>{_STYLE_RAPPORT}</style></head><body>"
        f"<h1>{_echapper(titre)}</h1>"
        f"<p><strong>Date de génération :</strong> {maintenant:%d/%m/%Y à %H:%M}</p>"
        f"<p><strong>Période :</strong> {libelle} (du {debut:%d/%m/%Y} au {fin:%d/%m/%Y})</p>"
        f"{corps}</body></html>"
    )

    if client_unique is not None:
        nom_fichier = f"rapport_{slug_periode}_{client_unique.nom_entreprise.replace(' ', '_')}_{aujourd_hui:%Y-%m-%d}.doc"
    else:
        nom_fichier = f"rapport_{slug_periode}_tous_clients_{aujourd_hui:%Y-%m-%d}.doc"

    return html, nom_fichier
