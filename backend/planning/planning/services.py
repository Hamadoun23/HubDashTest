"""Regles metier — port fidele des controleurs Laravel de Planning-main.

Regroupe ici ce qui, cote Laravel, vivait disperse dans
`DashboardController`, `ShootingController`, `PublicationController` et
`ClientController` : construction du calendrier, verification de date,
export CSV et generation des rapports (PDF, mise en page dans le theme
sombre "Virtus" du hub, motif GDA en fond de page).
"""

from __future__ import annotations

import base64
import csv
import io
from datetime import date, datetime, timedelta
from pathlib import Path

from django.utils import timezone
from weasyprint import HTML

from .models import JOURS_FR, Publication, Shooting, jour_semaine_fr

_ASSETS_DIR = Path(__file__).resolve().parent / "assets"


def _image_base64(nom_fichier: str, mime: str) -> str:
    """Encode une image de `planning/assets/` en data URI — evite toute
    dependance a un chemin de fichier resolu par WeasyPrint au rendu."""
    donnees = (_ASSETS_DIR / nom_fichier).read_bytes()
    return f"data:{mime};base64,{base64.b64encode(donnees).decode('ascii')}"


def _pdf_depuis_html(html: str) -> bytes:
    return HTML(string=html).write_pdf()

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


def _style_rapport(motif_data_uri: str) -> str:
    """Theme sombre "Virtus" du hub, decline en CSS imprimable : motif GDA en
    fond de chaque page (`@page background-image`, seul endroit ou WeasyPrint
    applique un fond repete sur tout le document), cartes translucides,
    accent orange — la meme identite visuelle que le reste de l'app plutot
    qu'un document Word par defaut."""
    return f"""
        @page {{
            size: A4;
            margin: 0;
            background-image:
                linear-gradient(160deg, rgba(20, 13, 8, 0.55), rgba(38, 22, 10, 0.5)),
                url('{motif_data_uri}');
            background-size: cover;
            background-repeat: no-repeat;
            background-position: center;
        }}
        * {{ box-sizing: border-box; }}
        body {{
            font-family: 'Liberation Sans', Arial, sans-serif;
            color: #f3ede6;
            margin: 0;
            padding: 28px 34px 40px;
            line-height: 1.55;
            font-size: 12.5px;
        }}
        .en-tete {{
            display: flex;
            align-items: center;
            gap: 16px;
            padding-bottom: 16px;
            margin-bottom: 22px;
            border-bottom: 2px solid rgba(255, 138, 76, 0.4);
        }}
        .en-tete .logo {{
            display: flex;
            align-items: center;
            justify-content: center;
            width: 52px;
            height: 52px;
            background: #ffffff;
            border-radius: 12px;
            padding: 6px;
            flex-shrink: 0;
        }}
        .en-tete .logo img {{ width: 100%; height: 100%; object-fit: contain; }}
        .en-tete .kicker {{
            display: inline-block;
            font-size: 9.5px;
            font-weight: 700;
            letter-spacing: 1.2px;
            text-transform: uppercase;
            color: #ff8a4c;
            background: rgba(255, 138, 76, 0.15);
            padding: 3px 10px;
            border-radius: 999px;
            margin-bottom: 6px;
        }}
        h1 {{ color: #ffffff; margin: 0; font-size: 22px; font-weight: 800; }}
        .meta {{
            display: flex;
            gap: 22px;
            flex-wrap: wrap;
            margin-bottom: 22px;
            font-size: 11.5px;
            color: #cbbfb2;
        }}
        .meta strong {{ color: #f3ede6; }}
        h2 {{
            color: #ffffff;
            font-size: 16px;
            margin: 0 0 14px;
            padding: 10px 14px;
            background: linear-gradient(90deg, rgba(255, 106, 58, 0.35), rgba(255, 106, 58, 0.05));
            border-left: 4px solid #ff6a3a;
            border-radius: 6px;
        }}
        h3 {{ color: #ff8a4c; font-size: 13px; margin: 18px 0 8px; text-transform: uppercase; letter-spacing: 0.4px; }}
        table {{ width: 100%; border-collapse: collapse; margin: 6px 0 16px; font-size: 11px; }}
        th {{
            background: rgba(255, 138, 76, 0.18);
            color: #ffcdae;
            padding: 8px 10px;
            text-align: left;
            font-weight: 700;
            border-bottom: 1px solid rgba(255, 138, 76, 0.35);
        }}
        td {{ padding: 7px 10px; border-bottom: 1px solid rgba(255, 255, 255, 0.08); }}
        tr:nth-child(even) td {{ background: rgba(255, 255, 255, 0.03); }}
        .status-completed {{ color: #4ade80; font-weight: 700; }}
        .status-pending {{ color: #facc15; font-weight: 700; }}
        .status-cancelled {{ color: #9ca3af; font-weight: 700; }}
        .stat-box {{ background: rgba(255, 255, 255, 0.04); padding: 14px; margin: 14px 0; border-left: 4px solid #ff6a3a; border-radius: 6px; }}
        .client-section {{
            page-break-after: always;
            margin-bottom: 24px;
            background: rgba(20, 14, 9, 0.78);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 14px;
            padding: 18px 20px;
        }}
        .client-section:last-child {{ page-break-after: avoid; }}
        /* Flexbox plutot que CSS Grid : le support de `grid-column: span` par
        WeasyPrint est trop partiel pour garder le <h3> sur sa propre ligne. */
        .summary {{
            display: flex;
            flex-wrap: wrap;
            gap: 10px 24px;
            background: rgba(255, 138, 76, 0.1);
            padding: 16px;
            margin: 14px 0 18px;
            border: 1px solid rgba(255, 138, 76, 0.25);
            border-radius: 10px;
        }}
        .summary h3 {{ flex: 1 1 100%; margin: 0 0 4px; }}
        .summary p {{ flex: 1 1 42%; margin: 0; font-size: 11.5px; }}
        .summary strong {{ color: #ffcdae; }}
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


def _en_tete_html(kicker: str, titre: str, lignes_meta: list[str]) -> str:
    logo = _image_base64("logo-gda.png", "image/png")
    meta = "".join(f"<span>{ligne}</span>" for ligne in lignes_meta)
    return (
        f'<div class="en-tete"><div class="logo"><img src="{logo}" alt="GDA" /></div>'
        f'<div><span class="kicker">{_echapper(kicker)}</span><h1>{_echapper(titre)}</h1></div></div>'
        f'<div class="meta">{meta}</div>'
    )


def generer_rapport_client_pdf(client, type_periode: str, mois: int, annee: int) -> tuple[bytes, str]:
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

    titre = client.nom_entreprise
    entete = _en_tete_html(
        "Planning",
        titre,
        [f"<strong>Période :</strong> {libelle_periode}", f"<strong>Généré le</strong> {maintenant:%d/%m/%Y à %H:%M}"],
    )
    corps = _section_client_html(client, tournages, publications, regles, avec_description=True)
    motif = _image_base64("motif-orange.jpg", "image/jpeg")

    html = (
        f"<!DOCTYPE html><html><head><meta charset='UTF-8'><title>{_echapper(titre)}</title>"
        f"<style>{_style_rapport(motif)}</style></head><body>{entete}{corps}</body></html>"
    )

    slug = client.nom_entreprise.replace(" ", "_")
    if type_periode == "annual":
        nom_fichier = f"planning_{slug}_{annee}.pdf"
    else:
        nom_fichier = f"planning_{slug}_{MOIS_FR[mois]}_{annee}.pdf"

    return _pdf_depuis_html(html), nom_fichier


def generer_rapport_global_pdf(clients, periode: str, client_unique=None) -> tuple[bytes, str]:
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

    titre = client_unique.nom_entreprise if client_unique is not None else "Tous les clients"
    entete = _en_tete_html(
        f"Rapport {libelle.lower()}",
        titre,
        [
            f"<strong>Période :</strong> du {debut:%d/%m/%Y} au {fin:%d/%m/%Y}",
            f"<strong>Généré le</strong> {maintenant:%d/%m/%Y à %H:%M}",
        ],
    )

    corps = ""
    for client in clients:
        tournages = list(client.tournages.filter(date__date__gte=debut, date__date__lte=fin).order_by("date"))
        publications = list(client.publications.filter(date__date__gte=debut, date__date__lte=fin).order_by("date"))
        regles = list(client.regles.all())
        corps += _section_client_html(client, tournages, publications, regles, avec_description=False)

    motif = _image_base64("motif-orange.jpg", "image/jpeg")
    html = (
        f"<!DOCTYPE html><html><head><meta charset='UTF-8'><title>{_echapper(titre)}</title>"
        f"<style>{_style_rapport(motif)}</style></head><body>{entete}{corps}</body></html>"
    )

    if client_unique is not None:
        nom_fichier = f"rapport_{slug_periode}_{client_unique.nom_entreprise.replace(' ', '_')}_{aujourd_hui:%Y-%m-%d}.pdf"
    else:
        nom_fichier = f"rapport_{slug_periode}_tous_clients_{aujourd_hui:%Y-%m-%d}.pdf"

    return _pdf_depuis_html(html), nom_fichier
