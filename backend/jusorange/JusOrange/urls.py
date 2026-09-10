"""Routage du projet JusOrange.

L'interface utilisateur est le frontend Next.js : Django n'expose plus que
l'API REST, l'administration et le parcours d'authentification (connexion et
réinitialisation de mot de passe, qui envoient des e-mails et n'ont pas
d'équivalent côté React).
"""
import os

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.shortcuts import redirect
from django.urls import path, include

from .sante import sante


def racine(request):
    """Renvoie vers le frontend.

    En production nginx sert déjà le frontend sur « / » et cette vue n'est
    jamais atteinte. En local, ouvrir http://127.0.0.1:8000/ affichait un 404
    listant les routes Django, ce qui laissait croire à une panne : on redirige
    donc vers l'application.
    """
    return redirect(os.environ.get('FRONTEND_URL', 'http://localhost:3000'))


urlpatterns = [
    path('admin/', admin.site.urls),
    # Sonde de vie, lue par la passerelle de GDA Hub sous « /sante/jus ».
    path('sante', sante, name='sante'),
    path('api/', include('api.urls')),
    # login / logout / password-reset (templates dans templates/auth/)
    path('', include('accounts.urls')),
    path('', racine, name='racine'),
]

# Photos de prospection. En développement Django les sert lui-même ; en
# production c'est nginx qui expose /media/ depuis le disque.
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
