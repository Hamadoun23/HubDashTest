"""Prévisions « aide à la décision » — port de `WeatherService::forecastForDecisions`
(Laravel DailyGda) sur Open-Meteo (sans clé) au lieu d'OpenWeather.

Même forme de réponse que Laravel (days -> slots de 3 h, stats, thresholds,
alerts, current), pour que la page Prévisions reprenne la même logique de
verdict côté client. Open-Meteo donne des séries horaires : on garde un point
toutes les 3 h (00 h, 03 h, ... 21 h) et on cumule la pluie sur la fenêtre,
l'équivalent de `rain.3h` chez OpenWeather.
"""
from __future__ import annotations

import json
from datetime import datetime
from urllib.parse import urlencode
from urllib.request import urlopen

from django.utils import timezone

# Seuils identiques à config/gda.php (vent 10 m/s, pluie 55 %, 1 mm / 3 h).
SEUIL_VENT_MS = 10.0
SEUIL_PLUIE_POP = 0.55
SEUIL_PLUIE_MM = 1.0


def _libelle_wmo(code: int) -> tuple[str, str, str]:
    """(weather_main façon OpenWeather, description FR, icône OpenWeather)."""
    if code == 0:
        return "Clear", "Ciel dégagé", "01d"
    if code in (1, 2):
        return "Clouds", "Peu nuageux", "02d"
    if code == 3:
        return "Clouds", "Couvert", "04d"
    if code in (45, 48):
        return "Mist", "Brouillard", "50d"
    if 51 <= code <= 57:
        return "Drizzle", "Bruine", "09d"
    if 61 <= code <= 67:
        return "Rain", "Pluie", "10d"
    if 71 <= code <= 77:
        return "Snow", "Neige", "13d"
    if 80 <= code <= 82:
        return "Rain", "Averses", "09d"
    if code >= 95:
        return "Thunderstorm", "Orage", "11d"
    return "Clouds", "Nuageux", "03d"


def _alerte(slot: dict) -> dict | None:
    """Port de `WeatherService::buildForecastAlert`."""
    types, severite = [], "info"
    main = slot["weather_main"].lower()
    pop = slot["pop_percent"] / 100
    pluie = slot["rain_mm"]
    vent_ms = slot["wind_ms"]

    if main == "thunderstorm":
        types.append("storm")
        severite = "high"
    elif pop >= SEUIL_PLUIE_POP or pluie >= SEUIL_PLUIE_MM or main in ("rain", "drizzle"):
        types.append("rain")
        severite = "high" if pluie >= 3 or pop >= 0.75 else "medium"

    if vent_ms >= SEUIL_VENT_MS:
        types.append("wind")
        severite = "high" if vent_ms >= SEUIL_VENT_MS * 1.35 else ("high" if severite == "high" else "medium")

    if not types:
        return None

    parties = []
    if "storm" in types:
        parties.append("Risque d’orage")
    if "rain" in types:
        parties.append(f"Pluie ({slot['pop_percent']} % prob., {pluie:.1f} mm/3h)")
    if "wind" in types:
        parties.append(f"Vent fort ({slot['wind_kmh']} km/h)")

    return {
        "types": types,
        "severity": severite,
        "dt_txt": slot["dt_txt"],
        "time": slot["time"],
        "date": slot["dt_txt"][:10],
        "message": " — ".join(parties) + " — " + slot["description"],
    }


def previsions_decision(lat: float, lon: float) -> dict:
    requete = urlencode(
        {
            "latitude": lat,
            "longitude": lon,
            "current": "temperature_2m,weather_code",
            "hourly": "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_gusts_10m",
            "timezone": "auto",
            "forecast_days": 5,
        }
    )
    with urlopen(f"https://api.open-meteo.com/v1/forecast?{requete}", timeout=8) as reponse:  # nosec B310 - URL constante
        brut = json.loads(reponse.read().decode("utf-8"))

    h = brut.get("hourly") or {}
    heures = h.get("time") or []
    jours: dict[str, dict] = {}
    alertes = []

    for i, horodatage in enumerate(heures):
        instant = datetime.fromisoformat(horodatage)
        if instant.hour % 3:
            continue
        code = int((h.get("weather_code") or [0])[i] or 0)
        main, description, icone = _libelle_wmo(code)
        vent_kmh = float((h.get("wind_speed_10m") or [0])[i] or 0)
        rafale = (h.get("wind_gusts_10m") or [None])[i]
        pluie = sum(float(v or 0) for v in (h.get("precipitation") or [])[i : i + 3])
        temp = float((h.get("temperature_2m") or [0])[i] or 0)
        date = horodatage[:10]
        slot = {
            "dt_txt": instant.strftime("%Y-%m-%d %H:%M:%S"),
            "time": instant.strftime("%H:%M"),
            "temp": round(temp),
            "feels_like": round(float((h.get("apparent_temperature") or [temp])[i] or temp)),
            "humidity": int((h.get("relative_humidity_2m") or [0])[i] or 0),
            "description": description,
            "weather_main": main,
            "icon": icone,
            "wind_ms": round(vent_kmh / 3.6, 1),
            "wind_kmh": round(vent_kmh),
            "wind_gust_kmh": round(float(rafale)) if rafale else None,
            "pop_percent": int((h.get("precipitation_probability") or [0])[i] or 0),
            "rain_mm": round(pluie, 1),
        }
        jour = jours.setdefault(date, {"date": date, "slots": []})
        jour["slots"].append(slot)
        alerte = _alerte(slot)
        if alerte:
            alertes.append(alerte)

    tous = [s for j in jours.values() for s in j["slots"]]
    stats = {
        "temp_min": min((s["temp"] for s in tous), default=0),
        "temp_max": max((s["temp"] for s in tous), default=0),
        "wind_max_kmh": max((s["wind_kmh"] for s in tous), default=0),
        "pop_max": max((s["pop_percent"] for s in tous), default=0),
        "alert_count": len(alertes),
        "slots_count": len(tous),
    }

    courant = brut.get("current") or {}
    courant_code = int(courant.get("weather_code") or 0)
    return {
        "ok": True,
        "lat": lat,
        "lon": lon,
        "fetched_at": timezone.now().isoformat(),
        "current": {
            "temp": round(float(courant["temperature_2m"])) if courant.get("temperature_2m") is not None else None,
            "description": _libelle_wmo(courant_code)[1],
            "icon": _libelle_wmo(courant_code)[2],
        },
        "stats": stats,
        "thresholds": {
            "wind_ms": SEUIL_VENT_MS,
            "wind_kmh": round(SEUIL_VENT_MS * 3.6),
            "rain_pop_percent": round(SEUIL_PLUIE_POP * 100),
            "rain_mm": SEUIL_PLUIE_MM,
        },
        "alerts": alertes[:24],
        "days": sorted(jours.values(), key=lambda j: j["date"]),
    }
