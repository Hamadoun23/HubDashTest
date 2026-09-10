"""Routing de l'API REST."""
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
# Production (ResProd)
router.register('producteurs', views.ProducteurViewSet)
router.register('cueillettes', views.CueilletteViewSet)
router.register('articles', views.ArticleStockViewSet)
router.register('receptions', views.ReceptionViewSet)
router.register('productions', views.ProductionViewSet)
router.register('conditionnements', views.ConditionnementViewSet)
router.register('bouteilles', views.BouteilleViewSet)
router.register('inventaires', views.InventaireViewSet)
# Commercial
router.register('clients', views.ClientViewSet)
router.register('ventes', views.VenteViewSet)
router.register('commandes', views.CommandeViewSet)
router.register('factures', views.FactureViewSet)
router.register('paiements', views.PaiementViewSet)
# Prospection (cartographie commerciale)
router.register('points-vente', views.PointVenteViewSet)
router.register('visites', views.VisiteViewSet)
# Finance
router.register('tresorerie', views.ReceptionPaiementViewSet)
# Direction
router.register('utilisateurs', views.UserViewSet)

urlpatterns = [
    path('auth/login/', views.LoginView.as_view(), name='api_login'),
    path('auth/me/', views.MeView.as_view(), name='api_me'),
    path('options/', views.form_options, name='api_form_options'),
    path('reporting/summary/', views.reporting_summary, name='api_reporting_summary'),
    # Rapports détaillés par module + export Excel (mêmes services que les
    # vues templates). L'export doit être déclaré avant, sinon <module> capture
    # le segment « export ».
    path('reporting/<str:module>/export/', views.rapport_export, name='api_rapport_export'),
    path('reporting/<str:module>/', views.rapport, name='api_rapport'),
    path('', include(router.urls)),
]
