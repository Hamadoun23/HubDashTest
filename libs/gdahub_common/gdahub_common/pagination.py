"""Pagination unique pour tout GDA Hub.

Le shell React n'a qu'une seule forme de reponse paginee a comprendre, quel
que soit le service interroge.
"""

from collections import OrderedDict

from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response


class PaginationGdaHub(PageNumberPagination):
    page_size = 25
    page_size_query_param = "taille"
    page_query_param = "page"
    max_page_size = 200

    def get_paginated_response(self, data):
        return Response(
            OrderedDict(
                [
                    ("total", self.page.paginator.count),
                    ("page", self.page.number),
                    ("pages", self.page.paginator.num_pages),
                    ("taille", self.get_page_size(self.request)),
                    ("suivant", self.get_next_link()),
                    ("precedent", self.get_previous_link()),
                    ("resultats", data),
                ]
            )
        )
