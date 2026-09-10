# Image de l'API de Jus d'orange.
#
# En production, l'application tourne sous systemd avec gunicorn : ce fichier
# ne remplace rien: il sert a la faire tourner dans GDA Hub, ou toutes les
# applications sont conteneurisees pour demarrer d'une seule commande.
#
#   docker build -t jusorange-api back/

FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1     PYTHONUNBUFFERED=1     PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# libpq5 pour psycopg, curl pour les sondes de vie, gcc pour les rares roues
# qui ne sont pas precompilees.
RUN apt-get update     && apt-get install -y --no-install-recommends curl libpq5     && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./requirements.txt
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
CMD ["gunicorn", "JusOrange.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3"]
