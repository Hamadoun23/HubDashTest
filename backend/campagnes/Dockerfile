# Image de Campagnes (ex-BDM — BDM la banque n'est qu'un des clients servis).
#
# L'application sert encore ses propres pages : Django rend du React par
# Inertia, et non une API consommee par l'interface unique. Son front est donc
# construit ici, dans une premiere etape, et Django n'a pas besoin de Node a
# l'execution.
#
# Le contexte de construction est la RACINE du depot : l'image a besoin du
# backend (backend/campagnes) et du front (backend/campagnes-frontend).
#
#   docker build -f backend/campagnes/Dockerfile --target developpement .

FROM node:24-alpine AS interface
WORKDIR /build
# Sous quel chemin les fichiers compiles seront servis. Vite le grave dans le
# bundle : c'est de la que partent les imports dynamiques des pages.
ARG VITE_BASE=/campagnes/static/
ENV VITE_BASE=${VITE_BASE}
COPY backend/campagnes-frontend/package*.json ./
RUN npm ci
COPY backend/campagnes-frontend/ ./
RUN npm run build


FROM python:3.13-slim AS base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    DJANGO_SETTINGS_MODULE=config.settings

WORKDIR /app

# `default-libmysqlclient-dev` n'est pas necessaire : PyMySQL est en Python pur.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY backend/campagnes/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn

COPY backend/campagnes/ .
# Django lit le manifeste de Vite un cran au-dessus de son propre dossier
# (cf. STATICFILES_DIRS dans config/settings.py).
COPY --from=interface /build/dist /frontend/dist

RUN chmod +x /app/entrypoint.sh

EXPOSE 8000

FROM base AS developpement
ENV DJANGO_DEBUG=True
# `collectstatic` au demarrage, pas au build : c'est un volume partage avec
# nginx qui porte les fichiers, et il survit aux reconstructions. Sans cette
# etape le volume reste vide, et le JavaScript compile de l'interface repond
# 404 — la page s'affiche sans rien dedans.
#
# Les migrations suivent : la base du hub part vide, et une sauvegarde
# restauree par-dessus ne les rejoue pas.
CMD ["sh", "-c", "python manage.py collectstatic --noinput --clear >/dev/null && python manage.py migrate --noinput && python manage.py runserver 0.0.0.0:8000"]

FROM base AS production
ENV DJANGO_DEBUG=False
# `collectstatic` est execute au demarrage, pas au build : le volume partage
# avec nginx survit aux reconstructions et doit etre resynchronise a chaque
# lancement (cf. entrypoint.sh).
ENTRYPOINT ["/app/entrypoint.sh"]
# 3 workers : suffisant pour la charge actuelle (une soixantaine de comptes).
CMD ["gunicorn", "config.wsgi:application", \
     "--bind", "0.0.0.0:8000", \
     "--workers", "3", \
     "--timeout", "120", \
     "--access-logfile", "-", \
     "--error-logfile", "-"]
