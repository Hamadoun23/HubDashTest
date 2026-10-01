# Image du service Chantiers.
#
# Aucune connexion locale a preserver (jamais deploye avant ce hub) : voir
# config/settings.py et chantiers/hub.py pour ce que ca change.

FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# libpq5 pour psycopg, curl pour les sondes de vie, le reste pour WeasyPrint
# (rapport PDF : Pango/Cairo font le texte et les degrades, fonts-liberation
# une police lisible sans dependre de fonts systeme absentes).
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        curl libpq5 \
        libpango-1.0-0 libpangocairo-1.0-0 libgdk-pixbuf-2.0-0 libcairo2 \
        libffi8 shared-mime-info fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./requirements.txt
# pip à jour : les versions anciennes ont des failles connues (pip-audit).
RUN pip install --no-cache-dir --upgrade "pip>=26.2"
RUN pip install --no-cache-dir -r requirements.txt

COPY . /app/

EXPOSE 8000

FROM base AS developpement
ENV DJANGO_DEBUG=True
# Les migrations sont appliquees au demarrage : la base du hub part vide, et
# une sauvegarde restauree par-dessus ne les rejoue pas.
CMD ["sh", "-c", "python manage.py migrate --noinput && python manage.py runserver 0.0.0.0:8000"]

FROM base AS production
ENV DJANGO_DEBUG=False
RUN python manage.py collectstatic --noinput
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3"]
