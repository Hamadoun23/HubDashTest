"""Rapport PDF de chantier — version légère.

Même contenu que le rapport de daily.gdamali.net (en-tête, synthèse,
avancement par phase, détail des tâches, photos par catégorie, FR/EN), mais
mis en page pour rester sobre et léger : A4 portrait, motif orange GDA en fond,
cartes sombres comme dans l'application,
barres dessinées en CSS (aucun graphique en image) et photos réduites en
vignettes compressées. Le fichier pèse quelques dizaines de Ko hors photos et
se génère vite. Rendu par WeasyPrint, comme les rapports de Planning.
"""
from __future__ import annotations

import base64
import io
from collections import Counter
from datetime import date, timedelta
from functools import lru_cache
from html import escape
from pathlib import Path

from PIL import Image, ImageOps
from weasyprint import HTML

from .models import Photo, Project
from .services import visible_tasks

PHOTO_CATEGORIES = ["avant", "pendant", "apres", "securite", "qualite"]
STATUTS_ORDRE = ["non_demarre", "en_cours", "termine", "annule"]

# Palette de daily.gdamali.net.
COULEUR_STATUT = {
    "non_demarre": "#6b6259",
    "en_cours": "#c8521a",
    "termine": "#1a7a42",
    "annule": "#c01a1a",
}

# Vignettes photo : recadrées en 4:3, assez nettes pour être lues, assez petites pour un PDF léger.
TAILLE_VIGNETTE = (420, 315)
QUALITE_VIGNETTE = 62

LABELS = {
    "fr": {
        "report_title": "Rapport journalier de chantier",
        "overall": "Avancement global",
        "date": "Date",
        "temperature": "Température",
        "weather": "Météo",
        "kpi_total": "Tâches",
        "kpi_done": "Terminées",
        "kpi_in_progress": "En cours",
        "kpi_cancelled": "Annulées",
        "phases": "Avancement par phase",
        "details": "Détail des activités",
        "col_subphase": "Sous-phase",
        "col_activity": "Activité",
        "col_start": "Début",
        "col_progress": "Avancement",
        "col_status": "Statut",
        "photos": "Photos",
        "no_data": "Aucune tâche visible pour ce projet.",
        "page": "Page",
        "status": {"non_demarre": "Non démarré", "en_cours": "En cours", "termine": "Terminé", "annule": "Annulé"},
        "photo_categories": {
            "avant": "Avant travaux",
            "pendant": "Pendant travaux",
            "apres": "Après travaux",
            "securite": "Sécurité",
            "qualite": "Contrôle qualité",
        },
    },
    "en": {
        "report_title": "Daily site progress report",
        "overall": "Overall progress",
        "date": "Date",
        "temperature": "Temperature",
        "weather": "Weather",
        "kpi_total": "Tasks",
        "kpi_done": "Completed",
        "kpi_in_progress": "In progress",
        "kpi_cancelled": "Cancelled",
        "phases": "Progress by phase",
        "details": "Activity details",
        "col_subphase": "Sub-phase",
        "col_activity": "Activity",
        "col_start": "Start",
        "col_progress": "Progress",
        "col_status": "Status",
        "photos": "Photos",
        "no_data": "No visible task for this project.",
        "page": "Page",
        "status": {"non_demarre": "Not started", "en_cours": "In progress", "termine": "Completed", "annule": "Cancelled"},
        "photo_categories": {
            "avant": "Before works",
            "pendant": "During works",
            "apres": "After works",
            "securite": "Safety",
            "qualite": "Quality control",
        },
    },
}

_STYLE = """
@page {
    size: A4 portrait;
    margin: 14mm 13mm 16mm;
    background: #c8521a;
    @bottom-left { content: string(projet); font-family: "Liberation Sans", "DejaVu Sans", Arial, sans-serif; font-size: 7.5pt; color: #fbe6cf; }
    @bottom-right { content: "__PAGE__ " counter(page) " / " counter(pages); font-family: "Liberation Sans", "DejaVu Sans", Arial, sans-serif; font-size: 7.5pt; color: #fbe6cf; }
}
* { box-sizing: border-box; }
body { margin: 0; font-family: "Liberation Sans", "DejaVu Sans", Arial, sans-serif; font-size: 9pt; color: #fbf1e4; line-height: 1.4; }

/* Motif plein page : élément fixe, répété par WeasyPrint sur chaque page, décalé des marges. */
.fond { position: fixed; top: -14mm; left: -13mm; width: 210mm; height: 297mm; z-index: -1; }

/* Cartes sombres sur le motif, comme dans l'application. */
.carte { background: rgba(20, 12, 7, 0.80); border-radius: 6px; }

.entete { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; padding: 2px 2px 12px; margin-bottom: 12px; }
.surtitre { font-size: 7.5pt; letter-spacing: 0.14em; text-transform: uppercase; color: #fff3e3; }
.surtitre b { letter-spacing: 0.2em; color: #fff; }
.projet { string-set: projet content(); margin: 3px 0 5px; font-size: 18pt; font-weight: bold; color: #fff; }
.meta { font-size: 8.5pt; color: #fff3e3; }
.meta b { color: #fff; }
.meta span + span::before { content: "·"; margin: 0 6px; color: #ffd9b0; }
.global { text-align: right; }
.global__pct { font-size: 26pt; font-weight: bold; color: #fff; line-height: 1; }
.global__lbl { font-size: 7.5pt; letter-spacing: 0.12em; text-transform: uppercase; color: #fff3e3; }

.synthese { display: flex; gap: 8px; margin-bottom: 12px; }
.synthese div { flex: 1; padding: 8px 12px; border-top: 3px solid; }
.synthese b { display: block; font-size: 15pt; line-height: 1.1; color: #fbf1e4; }
.synthese span { font-size: 7.5pt; letter-spacing: 0.1em; text-transform: uppercase; color: #cdbfae; }

section { margin-bottom: 12px; padding: 10px 12px; }
section.tableau { padding: 10px 0 2px; }
section.tableau h2 { padding: 0 12px; }
h2 { page-break-after: avoid; margin: 0 0 8px; font-size: 8pt; letter-spacing: 0.14em; text-transform: uppercase; color: #f0cfa0; font-weight: bold; }

.phase { display: flex; align-items: center; gap: 10px; padding: 3px 0; }
.phase__nom { width: 34%; font-weight: bold; }
.phase__pct { width: 38px; text-align: right; font-weight: bold; }
.barre { flex: 1; height: 5px; background: rgba(251, 241, 228, 0.16); border-radius: 3px; overflow: hidden; }
.barre i { display: block; height: 100%; background: #c8521a; }
.barre i.fait { background: #1a7a42; }

table { width: 100%; border-collapse: collapse; }
thead { display: table-header-group; }
th { padding: 6px 8px; text-align: left; font-size: 7pt; letter-spacing: 0.08em; text-transform: uppercase;
     color: #f0cfa0; border-bottom: 1px solid rgba(251, 241, 228, 0.22); }
td { padding: 5px 8px; border-bottom: 1px solid rgba(251, 241, 228, 0.08); vertical-align: middle; }
tr { page-break-inside: avoid; }
tr.groupe { page-break-after: avoid; }
tr.groupe td { padding-top: 9px; font-weight: bold; color: #f0cfa0; border-bottom: 1px solid rgba(251, 241, 228, 0.18); }
td.sous { font-weight: bold; color: #e8dccb; }
td.debut { color: #b8aa98; white-space: nowrap; }
td.avancement { width: 110px; white-space: nowrap; }
td.avancement .barre { display: inline-block; width: 60px; vertical-align: middle; margin-right: 5px; }
td.statut { white-space: nowrap; }
.pastille { display: inline-block; padding: 1px 7px; border-radius: 8px; font-size: 7.5pt; font-weight: bold; color: #fbf1e4; }
.note { display: block; font-size: 7.5pt; color: #b8aa98; white-space: normal; }

.photos { display: flex; flex-wrap: wrap; gap: 8px; }
.photo { width: 23.8%; page-break-inside: avoid; }
.photo img { width: 100%; height: auto; display: block; border-radius: 3px; }
.photo span { display: block; margin-top: 2px; font-size: 7.5pt; color: #cdbfae; }
"""


# Fond de page : motif orange GDA, pré-recadré en A4 et compressé (~6 Ko, embarqué une fois).
_MOTIF_PAGE = Path(__file__).resolve().parent / "assets" / "motif-orange-page.jpg"


@lru_cache(maxsize=1)
def _motif() -> str:
    try:
        return "data:image/jpeg;base64," + base64.b64encode(_MOTIF_PAGE.read_bytes()).decode("ascii")
    except OSError:
        return ""


def _libelles(lang: str) -> dict:
    return LABELS["en"] if lang == "en" else LABELS["fr"]


def _format_debut(date_debut_projet, start_day: int) -> str:
    base = date_debut_projet or date.today()
    return (base + timedelta(days=max(0, int(start_day) - 1))).strftime("%d/%m/%Y")


def build_task_rows(project: Project, user, lang: str) -> list[dict]:
    """Une ligne par tâche visible, triée phase -> sous-phase -> tâche."""
    L = _libelles(lang)
    taches = (
        visible_tasks(project, user)
        .select_related("sous_phase__phase")
        .order_by("sous_phase__phase__sort_order", "sous_phase__sort_order", "sort_order")
    )
    lignes = []
    for tache in taches:
        latest = tache.latest_daily_update()
        statut = latest.status if latest else "non_demarre"
        lignes.append(
            {
                "phase": tache.sous_phase.phase.name,
                "subphase": tache.sous_phase.name,
                "activity": tache.activity,
                "start_label": _format_debut(project.start_date, tache.start_day),
                "progress": int(latest.progress if latest else 0),
                "status": statut,
                "status_label": L["status"][statut],
                "status_comment": latest.comment if (latest and statut == "annule") else None,
            }
        )
    return lignes


def build_stats(lignes: list[dict]) -> dict:
    total = len(lignes)
    par_statut = Counter(l["status"] for l in lignes)
    return {
        "overall": round(sum(l["progress"] for l in lignes) / total) if total else 0,
        "total": total,
        "done": par_statut.get("termine", 0),
        "in_progress": par_statut.get("en_cours", 0),
        "cancelled": par_statut.get("annule", 0),
    }


def _vignette(photo: Photo) -> str | None:
    if not photo.file:
        return None
    try:
        with photo.file.open("rb") as source:
            image = Image.open(source)
            image.load()
    except Exception:
        return None
    image = ImageOps.fit(ImageOps.exif_transpose(image).convert("RGB"), TAILLE_VIGNETTE)
    tampon = io.BytesIO()
    image.save(tampon, format="JPEG", quality=QUALITE_VIGNETTE, optimize=True, progressive=True)
    return "data:image/jpeg;base64," + base64.b64encode(tampon.getvalue()).decode("ascii")


def count_non_empty_photo_categories(project: Project) -> int:
    return len(set(Photo.objects.filter(projet=project, category__in=PHOTO_CATEGORIES).values_list("category", flat=True)))


def estimer_pages(total_taches: int, sections_photos_count: int) -> str:
    """Estimation affichée « 1/N » : ~32 tâches par page, deux catégories de photos par page."""
    pages = max(1, (total_taches + 31) // 32) + (sections_photos_count + 1) // 2
    return f"1/{pages}"


def _barre(progress: int) -> str:
    classe = ' class="fait"' if progress >= 100 else ""
    return f'<span class="barre"><i{classe} style="width:{min(100, progress)}%"></i></span>'


def _html_phases(lignes: list[dict]) -> str:
    par_phase: dict[str, list[int]] = {}
    for l in lignes:
        par_phase.setdefault(l["phase"], []).append(l["progress"])
    return "".join(
        f'<div class="phase"><span class="phase__nom">{escape(nom)}</span>{_barre(round(sum(v) / len(v)))}'
        f'<span class="phase__pct">{round(sum(v) / len(v))}%</span></div>'
        for nom, v in par_phase.items()
    )


def _html_taches(lignes: list[dict], L: dict) -> str:
    if not lignes:
        return f'<tr><td colspan="5" style="text-align:center;color:#8a8070;padding:14px">{escape(L["no_data"])}</td></tr>'
    morceaux, phase_courante = [], None
    for t in lignes:
        if t["phase"] != phase_courante:
            phase_courante = t["phase"]
            morceaux.append(f'<tr class="groupe"><td colspan="5">{escape(phase_courante)}</td></tr>')
        note = f'<span class="note">{escape(t["status_comment"])}</span>' if t["status_comment"] else ""
        morceaux.append(
            "<tr>"
            f'<td class="sous">{escape(t["subphase"])}</td>'
            f'<td>{escape(t["activity"])}</td>'
            f'<td class="debut">{t["start_label"]}</td>'
            f'<td class="avancement">{_barre(t["progress"])}<b>{t["progress"]}%</b></td>'
            f'<td class="statut"><span class="pastille" style="background:{COULEUR_STATUT[t["status"]]}">{escape(t["status_label"])}</span>{note}</td>'
            "</tr>"
        )
    return "".join(morceaux)


def _html_photos(project: Project, L: dict) -> str:
    sections = []
    for categorie in PHOTO_CATEGORIES:
        vignettes = []
        for photo in Photo.objects.filter(projet=project, category=categorie).order_by("created_at"):
            src = _vignette(photo)
            if src:
                legende = f"<span>{escape(photo.caption)}</span>" if photo.caption else ""
                vignettes.append(f'<div class="photo"><img src="{src}" alt="">{legende}</div>')
        if vignettes:
            titre = f'{L["photos"]} — {L["photo_categories"][categorie]} ({len(vignettes)})'
            sections.append(f'<section class="carte"><h2>{escape(titre)}</h2><div class="photos">{"".join(vignettes)}</div></section>')
    return "".join(sections)


def build_report_html(project: Project, rapport, user, lang: str = "fr", titre: str | None = None) -> str:
    lang = "en" if lang == "en" else "fr"
    L = _libelles(lang)
    lignes = build_task_rows(project, user, lang)
    stats = build_stats(lignes)

    date_rapport = rapport.report_date.strftime("%d/%m/%Y") if rapport.report_date else "—"
    temperature = f"{rapport.temperature} °C" if rapport.temperature else "—"
    meteo = rapport.weather or "—"
    style = _STYLE.replace("__PAGE__", L["page"])

    return f"""<!DOCTYPE html>
<html lang="{lang}">
<head><meta charset="UTF-8"><title>{escape(L["report_title"])}</title><style>{style}</style></head>
<body>
  <img class="fond" src="{_motif()}" alt="">
  <div class="entete">
    <div>
      <div class="surtitre"><b>GDA</b> · {escape(L["report_title"])}</div>
      <div class="projet">{escape(titre or project.name)}</div>
      <div class="meta">
        <span><b>{escape(L["date"])}</b> {date_rapport}</span>
        <span><b>{escape(L["temperature"])}</b> {escape(temperature)}</span>
        <span><b>{escape(L["weather"])}</b> {escape(meteo)}</span>
      </div>
    </div>
    <div class="global">
      <div class="global__pct">{stats["overall"]}%</div>
      <div class="global__lbl">{escape(L["overall"])}</div>
    </div>
  </div>

  <div class="synthese">
    <div class="carte" style="border-color:#1a5c8a"><b>{stats["total"]}</b><span>{escape(L["kpi_total"])}</span></div>
    <div class="carte" style="border-color:{COULEUR_STATUT["termine"]}"><b>{stats["done"]}</b><span>{escape(L["kpi_done"])}</span></div>
    <div class="carte" style="border-color:{COULEUR_STATUT["en_cours"]}"><b>{stats["in_progress"]}</b><span>{escape(L["kpi_in_progress"])}</span></div>
    <div class="carte" style="border-color:{COULEUR_STATUT["annule"]}"><b>{stats["cancelled"]}</b><span>{escape(L["kpi_cancelled"])}</span></div>
  </div>

  <section class="carte">
    <h2>{escape(L["phases"])}</h2>
    {_html_phases(lignes)}
  </section>

  <section class="carte tableau">
    <h2>{escape(L["details"])}</h2>
    <table>
      <thead><tr>
        <th>{escape(L["col_subphase"])}</th><th>{escape(L["col_activity"])}</th><th>{escape(L["col_start"])}</th>
        <th>{escape(L["col_progress"])}</th><th>{escape(L["col_status"])}</th>
      </tr></thead>
      <tbody>{_html_taches(lignes, L)}</tbody>
    </table>
  </section>

  {_html_photos(project, L)}
</body>
</html>"""


def generate_report_pdf(project: Project, rapport, user, lang: str = "fr", titre: str | None = None) -> bytes:
    return HTML(string=build_report_html(project, rapport, user, lang, titre)).write_pdf()
