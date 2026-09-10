# Image du backend Django, en deux cibles.
#
#   --target developpement : rechargement automatique, code monte en volume
#   (defaut)               : gunicorn, code copie, statiques collectes
#
# Les dependances sont installees une fois dans un environnement virtuel, puis
# recopiees dans l'image finale : celle-ci ne contient ni gcc ni en-tetes de
# developpement.

FROM python:3.12-slim AS dependances

ENV PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential libpq-dev \
    && rm -rf /var/lib/apt/lists/*

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt .
RUN pip install -r requirements.txt gunicorn==23.0.0


# --- Socle commun aux deux cibles -----------------------------------------
FROM python:3.12-slim AS socle

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH"

# libpq pour psycopg, curl pour le test de sante.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq5 curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=dependances /opt/venv /opt/venv
WORKDIR /app
EXPOSE 8000


# --- Developpement ---------------------------------------------------------
FROM socle AS developpement

# Le code arrive par un volume : rien n'est copie, une modification est prise
# en compte sans reconstruire l'image.
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]


# --- Production ------------------------------------------------------------
FROM socle AS production

RUN useradd --create-home --shell /usr/sbin/nologin django     && chown django:django /app
COPY --chown=django:django . .

# Statiques collectes a la construction : le conteneur demarre sans avoir a
# ecrire ailleurs que dans ses volumes.
RUN mkdir -p /app/staticfiles /app/media \
    && chown -R django:django /app/staticfiles /app/media \
    && DJANGO_SECRET_KEY=construction DJANGO_DEBUG=False \
       python manage.py collectstatic --noinput --clear

USER django

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS http://127.0.0.1:8000/api/ -o /dev/null -w '%{http_code}' | grep -qE '200|401' || exit 1

# Trois workers suffisent pour cet usage ; le timeout court evite qu'une
# requete bloquee retienne un worker indefiniment.
CMD ["gunicorn", "config.wsgi:application", \
     "--bind", "0.0.0.0:8000", \
     "--workers", "3", \
     "--timeout", "60", \
     "--access-logfile", "-", \
     "--error-logfile", "-"]
