"""Exports Excel et PDF, sous une forme volontairement simple.

Le module monolithique du stagiaire s'appuyait sur `apps.core.exports`,
partage entre neuf applications metier — une dependance qui n'existe plus
des que Chantiers devient un service a part entiere. Ces deux fonctions n'en
sont pas la reprise a l'identique : c'est la version minimale qui couvre ce
que Chantiers exporte reellement (un tableau, des colonnes, des lignes),
sans reintroduire une bibliotheque partagee qu'aucun autre service du hub
n'utilise encore.
"""

from io import BytesIO

from django.http import HttpResponse


def excel_response(titre: str, entetes: list[str], lignes: list[list], nom_fichier: str) -> HttpResponse:
    from openpyxl import Workbook
    from openpyxl.styles import Font

    classeur = Workbook()
    feuille = classeur.active
    feuille.title = titre[:31] or "Export"

    feuille.append(entetes)
    for cellule in feuille[1]:
        cellule.font = Font(bold=True)

    for ligne in lignes:
        feuille.append(ligne)

    for colonne in feuille.columns:
        largeur = max((len(str(c.value)) for c in colonne if c.value is not None), default=10)
        feuille.column_dimensions[colonne[0].column_letter].width = min(largeur + 2, 60)

    tampon = BytesIO()
    classeur.save(tampon)
    reponse = HttpResponse(
        tampon.getvalue(),
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
    reponse["Content-Disposition"] = f'attachment; filename="{nom_fichier}.xlsx"'
    return reponse


def pdf_response(titre: str, entetes: list[str], lignes: list[list], nom_fichier: str) -> HttpResponse:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    tampon = BytesIO()
    document = SimpleDocTemplate(tampon, pagesize=landscape(A4))
    styles = getSampleStyleSheet()

    tableau = Table([entetes] + [[str(v) for v in ligne] for ligne in lignes], repeatRows=1)
    tableau.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#334155")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]
        )
    )
    document.build([Paragraph(titre, styles["Title"]), Spacer(1, 12), tableau])

    reponse = HttpResponse(tampon.getvalue(), content_type="application/pdf")
    reponse["Content-Disposition"] = f'attachment; filename="{nom_fichier}.pdf"'
    return reponse
