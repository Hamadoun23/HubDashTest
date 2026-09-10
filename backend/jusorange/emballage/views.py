"""
Fonctions utilitaires pour la gestion du stock de jus.

Appelées par l'API (api.views) lors des conditionnements et des mouvements de
bouteilles. Ce module ne contient plus de vue : l'interface est servie par le
frontend React.
"""
from appro.models import ArticleStock
from .models import Bouteille


def maj_stock_jus():
    """Met à jour les articles Jus 33cl et Jus 1L à partir des bouteilles DISPO."""
    for type_art, format_filter in [('jus_33cl', {'format_33cl': 1}), ('jus_1l', {'format_1l': 1})]:
        art = ArticleStock.objects.filter(type_art=type_art).first()
        if art:
            qte = Bouteille.objects.filter(statut_stock='DISPO', **format_filter).count()
            art.qte_art = qte
            art.save()


def creer_bouteilles_et_maj_stock(conditionnement):
    """Crée les bouteilles à partir des quantités du conditionnement et met à jour le stock."""
    qte_33cl = conditionnement.qte_33cl or 0
    qte_1l = conditionnement.qte_1l or 0
    if qte_33cl <= 0 and qte_1l <= 0:
        return

    article_bout_33cl = ArticleStock.objects.filter(type_art='bouteille_vide_33cl').first()
    article_bout_1l = ArticleStock.objects.filter(type_art='bouteille_vide_1l').first()
    bouteilles = []

    for _ in range(qte_33cl):
        bouteilles.append(Bouteille(
            conditionnement=conditionnement,
            format_33cl=1,
            format_1l=0,
            dlc=conditionnement.dlc,
            statut_stock='DISPO',
            article_stock=article_bout_33cl,
        ))
    for _ in range(qte_1l):
        bouteilles.append(Bouteille(
            conditionnement=conditionnement,
            format_33cl=0,
            format_1l=1,
            dlc=conditionnement.dlc,
            statut_stock='DISPO',
            article_stock=article_bout_1l,
        ))

    Bouteille.objects.bulk_create(bouteilles)

    if article_bout_33cl and qte_33cl > 0:
        article_bout_33cl.qte_art = max(0, article_bout_33cl.qte_art - qte_33cl)
        article_bout_33cl.save()
    if article_bout_1l and qte_1l > 0:
        article_bout_1l.qte_art = max(0, article_bout_1l.qte_art - qte_1l)
        article_bout_1l.save()

    maj_stock_jus()