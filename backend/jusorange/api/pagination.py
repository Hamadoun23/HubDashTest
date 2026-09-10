"""Pagination de l'API."""
from rest_framework.pagination import PageNumberPagination


class PaginationConfigurable(PageNumberPagination):
    """Permet au client de choisir la taille de page via ?page_size=.

    Sans `page_size_query_param`, DRF ignore silencieusement le paramètre et
    renvoie toujours PAGE_SIZE éléments : le frontend, qui demandait 1000
    lignes, n'en recevait que 50 et affichait 50 bouteilles sur 3144 sans
    aucun message d'erreur.

    La borne max évite qu'une requête ne tente de charger toute la base.
    """
    page_size_query_param = 'page_size'
    max_page_size = 5000
