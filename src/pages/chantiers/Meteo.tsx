import { useEffect, useRef, useState } from 'react';
import Chart from 'chart.js/auto';
import { useApi } from '../../lib/hooks/useApi';
import { geocoderVille, obtenirPrevisionsDecision, type CreneauMeteo, type LieuGeocode, type PrevisionsDecision } from '../../lib/api/chantiers';
import { useToast } from './toast';

// Bamako par défaut (config gda.php : weather_default_lat / weather_default_lon).
const LIEU_DEFAUT = { lat: 12.6392, lon: -8.0029, label: 'Bamako, Mali' };
const CLE_LIEU = 'gda_weather_location';
const JOURS_24H = '__24h__';

type Lieu = { lat: number; lon: number; label: string };
type Niveau = 'good' | 'caution' | 'bad';
type Seuils = PrevisionsDecision['thresholds'];

const EMOJI: Record<string, string> = {
  '01d': '☀️',
  '02d': '🌤️',
  '03d': '☁️',
  '04d': '☁️',
  '09d': '🌧️',
  '10d': '🌦️',
  '11d': '⛈️',
  '13d': '❄️',
  '50d': '🌫️',
};

const VERDICT: Record<Niveau, { icone: string; court: string; titre: string; conseil: string; classe: string }> = {
  good: {
    icone: '✅',
    court: 'Favorable',
    titre: 'Bonnes conditions pour le chantier',
    conseil: 'Vous pouvez planifier les travaux en extérieur normalement.',
    classe: 'forecast-verdict--good',
  },
  caution: {
    icone: '⚠️',
    court: 'Attention',
    titre: 'Soyez prudents',
    conseil: 'Surveillez le ciel et prévoyez un plan B (report ou tâches intérieures).',
    classe: 'forecast-verdict--caution',
  },
  bad: {
    icone: '🛑',
    court: 'Difficile',
    titre: 'Conditions difficiles',
    conseil: 'Privilégiez le report ou l’annulation des tâches sensibles (pluie, vent, orage).',
    classe: 'forecast-verdict--bad',
  },
};

function lireLieu(): Lieu {
  try {
    const o = JSON.parse(localStorage.getItem(CLE_LIEU) ?? 'null');
    if (o && typeof o.lat === 'number' && typeof o.lon === 'number') return { lat: o.lat, lon: o.lon, label: o.label || '' };
  } catch {
    /* lieu illisible : on retombe sur Bamako */
  }
  return LIEU_DEFAUT;
}

function aujourdhui() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function libelleJour(date: string) {
  const demain = new Date();
  demain.setDate(demain.getDate() + 1);
  if (date === aujourdhui()) return 'Aujourd’hui';
  if (date === demain.toISOString().slice(0, 10)) return 'Demain';
  return new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

/** Port de `forecastAssessSlots` (gda-app.js). */
function evaluer(creneaux: CreneauMeteo[], s: Seuils): Niveau {
  let score = 0;
  for (const c of creneaux) {
    const main = c.weather_main.toLowerCase();
    if (main === 'thunderstorm') score += 3;
    else if (c.pop_percent >= s.rain_pop_percent || c.rain_mm >= s.rain_mm) score += 2;
    else if (c.wind_kmh >= s.wind_kmh) score += 1;
  }
  if (score >= 3) return 'bad';
  if (score >= 1) return 'caution';
  return 'good';
}

function niveauCreneau(c: CreneauMeteo, s: Seuils): 'ok' | 'warn' | 'bad' {
  const main = c.weather_main.toLowerCase();
  if (main === 'thunderstorm') return 'bad';
  if (c.pop_percent >= s.rain_pop_percent || c.rain_mm >= s.rain_mm) return 'warn';
  if (c.wind_kmh >= s.wind_kmh) return 'warn';
  return 'ok';
}

function conseilCreneau(c: CreneauMeteo, s: Seuils) {
  const niveau = niveauCreneau(c, s);
  if (niveau === 'bad') return 'Orage — évitez l’extérieur';
  if (niveau === 'warn') {
    const main = c.weather_main.toLowerCase();
    if (main === 'rain' || main === 'drizzle' || c.pop_percent >= s.rain_pop_percent) return 'Risque de pluie — pensez à reporter';
    return 'Vent notable — prudence en hauteur';
  }
  return 'OK pour travailler dehors';
}

const pluieSimple = (pop: number) => (pop >= 60 ? 'Pluie probable' : pop >= 30 ? 'Pluie possible' : 'Peu de pluie');
const ventSimple = (kmh: number) => (kmh >= 40 ? 'Vent fort' : kmh >= 20 ? 'Vent modéré' : 'Vent léger');

function messageAlerte(types: string[], message: string) {
  if (types.includes('storm')) return 'Orage — évitez l’extérieur';
  if (types.includes('rain')) return 'Risque de pluie — pensez à reporter';
  if (types.includes('wind')) return 'Vent notable — prudence en hauteur';
  return message || 'Conditions à surveiller';
}

/** Port de la page `#page-forecast` (loadForecastPage / renderForecastPage). */
export default function Meteo() {
  const [lieu, setLieu] = useState<Lieu>(lireLieu);
  const previsions = useApi(() => obtenirPrevisionsDecision(lieu.lat, lieu.lon), [lieu.lat, lieu.lon]);
  const [jour, setJour] = useState<string | null>(null);
  const [recherche, setRecherche] = useState('');
  const [resultats, setResultats] = useState<LieuGeocode[] | null>(null);
  const graphique = useRef<HTMLCanvasElement>(null);
  const { toast, element: toastEl } = useToast();

  const donnees = previsions.donnees;
  const seuils = donnees?.thresholds ?? { wind_ms: 10, wind_kmh: 36, rain_pop_percent: 55, rain_mm: 1 };
  const jourCle = jour ?? (donnees?.days.some((d) => d.date === aujourdhui()) ? aujourdhui() : donnees?.days[0]?.date ?? JOURS_24H);
  const tousCreneaux = (donnees?.days ?? []).flatMap((d) => d.slots);
  const creneaux = jourCle === JOURS_24H ? tousCreneaux.slice(0, 8) : donnees?.days.find((d) => d.date === jourCle)?.slots ?? [];
  const verdict = VERDICT[evaluer(creneaux, seuils)];
  const libellePeriode = jourCle === JOURS_24H ? 'Prochaines 24 h' : libelleJour(jourCle);
  const alertes = (donnees?.alerts ?? []).filter((a) => jourCle === JOURS_24H || !a.date || a.date === jourCle);

  // Recherche de localité, temporisée comme dans Laravel (350 ms).
  useEffect(() => {
    const q = recherche.trim();
    if (q.length < 2) {
      setResultats(null);
      return;
    }
    const minuteur = setTimeout(() => {
      geocoderVille(q)
        .then((r) => setResultats(r.results ?? []))
        .catch(() => setResultats(null));
    }, 350);
    return () => clearTimeout(minuteur);
  }, [recherche]);

  useEffect(() => {
    if (!graphique.current || !creneaux.length) return;
    const instance = new Chart(graphique.current, {
      type: 'line',
      data: {
        labels: creneaux.map((c) => c.time),
        datasets: [
          {
            label: 'Évolution de la température',
            data: creneaux.map((c) => c.temp),
            borderColor: '#c8521a',
            backgroundColor: 'rgba(200, 82, 26, 0.18)',
            fill: true,
            tension: 0.35,
            pointRadius: 5,
            pointBackgroundColor: '#c8521a',
            pointBorderColor: '#1a0f08',
            pointBorderWidth: 2,
            pointHoverRadius: 7,
            borderWidth: 3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `${c.parsed.y}°C` } } },
        scales: {
          x: { grid: { color: 'rgba(251,241,228,0.10)' }, ticks: { maxRotation: 0, font: { size: 12 }, color: 'rgba(251,241,228,0.8)' } },
          y: { grid: { color: 'rgba(251,241,228,0.10)' }, ticks: { callback: (v) => `${v}°`, color: 'rgba(251,241,228,0.8)' } },
        },
      },
    });
    return () => instance.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `creneaux` dérive de ces deux valeurs
  }, [jourCle, donnees]);

  function choisirLieu(l: Lieu) {
    localStorage.setItem(CLE_LIEU, JSON.stringify(l));
    setLieu(l);
    setJour(JOURS_24H);
    setRecherche('');
    setResultats(null);
  }

  function maPosition() {
    if (!navigator.geolocation) {
      toast('Géolocalisation non disponible', 'err');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => choisirLieu({ lat: pos.coords.latitude, lon: pos.coords.longitude, label: 'Ma position' }),
      () => toast('Autorisez la position ou choisissez une ville', 'err'),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }

  const misAJour = donnees?.fetched_at
    ? new Date(donnees.fetched_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';

  return (
    <div className="page active gda-legacy" id="page-forecast">
      <div className="page-header">
        <div>
          <div className="page-title">Prévisions météo</div>
          <div className="page-sub">Aide simple pour décider si le chantier peut avancer</div>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={previsions.recharger}>
          Actualiser
        </button>
      </div>

      {previsions.chargement && !donnees ? (
        <div className="forecast-loading card">
          <p>Chargement des prévisions…</p>
        </div>
      ) : previsions.erreur || !donnees ? (
        <div className="card forecast-error">
          <p>{previsions.erreur ?? 'Impossible de charger les prévisions.'}</p>
        </div>
      ) : (
        <>
          <div className="card forecast-loc-card">
            <div className="forecast-loc-search">
              <label className="forecast-loc-label" htmlFor="forecast-loc-input">
                Localité
              </label>
              <div className="forecast-loc-row">
                <input
                  type="search"
                  id="forecast-loc-input"
                  className="forecast-loc-input"
                  placeholder="Rechercher une ville…"
                  autoComplete="off"
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value)}
                />
                <button type="button" className="btn btn-secondary btn-sm" title="Ma position" onClick={maPosition}>
                  📍
                </button>
              </div>
              {resultats && (
                <div className="forecast-loc-results">
                  {resultats.length === 0 ? (
                    <div className="forecast-loc-item forecast-loc-item--empty">Aucun résultat</div>
                  ) : (
                    resultats.map((r) => {
                      const label = [r.name, r.admin1, r.country].filter(Boolean).join(', ');
                      return (
                        <button
                          key={`${r.latitude}-${r.longitude}`}
                          type="button"
                          className="forecast-loc-item"
                          onClick={() => choisirLieu({ lat: r.latitude, lon: r.longitude, label })}
                        >
                          {label}
                        </button>
                      );
                    })
                  )}
                </div>
              )}
              <p className="forecast-loc-active">
                <strong>Lieu :</strong> {lieu.label || '—'} · Mise à jour {misAJour}
              </p>
            </div>
          </div>

          <div className={`forecast-verdict ${verdict.classe}`}>
            <div className="forecast-verdict__icon">{verdict.icone}</div>
            <div>
              <div className="forecast-verdict__title">{verdict.titre}</div>
              <div className="forecast-verdict__sub">{verdict.conseil}</div>
              <div className="forecast-verdict__period">{libellePeriode}</div>
            </div>
          </div>

          <div className="stats-row forecast-stats-row forecast-stats-row--simple">
            <div className="stat-card s-prog">
              <div className="stat-val">{donnees.current?.temp != null ? `${donnees.current.temp}°C` : '—'}</div>
              <div className="stat-lbl">Actuellement</div>
              <div className="forecast-stat-sub">{donnees.current?.description ?? ''}</div>
            </div>
            <div className="stat-card s-total">
              <div className="stat-val">
                {donnees.stats.temp_min}–{donnees.stats.temp_max}°
              </div>
              <div className="stat-lbl">Chaleur sur 5 jours</div>
            </div>
            <div className="stat-card s-done">
              <div className="stat-val forecast-stat-val--text">{pluieSimple(donnees.stats.pop_max)}</div>
              <div className="stat-lbl">Pluie prévue</div>
            </div>
            <div className="stat-card s-late">
              <div className="stat-val forecast-stat-val--text">{ventSimple(donnees.stats.wind_max_kmh)}</div>
              <div className="stat-lbl">Vent prévu</div>
            </div>
          </div>

          <div className="forecast-day-pills-wrap">
            <p className="forecast-pills-hint">Choisissez un jour pour voir le détail :</p>
            <div className="forecast-day-pills">
              <button type="button" className={`forecast-day-pill${jourCle === JOURS_24H ? ' active' : ''}`} onClick={() => setJour(JOURS_24H)}>
                <span className="forecast-day-pill__name">Prochaines 24 h</span>
              </button>
              {donnees.days.map((d) => {
                const v = VERDICT[evaluer(d.slots, seuils)];
                return (
                  <button
                    key={d.date}
                    type="button"
                    className={`forecast-day-pill${jourCle === d.date ? ' active' : ''}`}
                    onClick={() => setJour(d.date)}
                  >
                    <span className="forecast-day-pill__name">{libelleJour(d.date)}</span>
                    <span className="forecast-day-pill__meta">
                      {v.icone} {v.court}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="card forecast-chart-card forecast-chart-card--simple">
            <div className="card-head">Évolution de la température</div>
            <p className="forecast-chart-hint">Plus la courbe monte, plus il fait chaud.</p>
            <div className="forecast-chart-canvas forecast-chart-canvas--simple">
              <canvas ref={graphique} />
            </div>
          </div>

          <div className="card forecast-alerts-card">
            <div className="card-head">Moments à surveiller</div>
            <div className="forecast-alerts">
              {alertes.length === 0 ? (
                <p className="forecast-alerts-empty">Aucune alerte pluie, vent ou orage sur la période affichée.</p>
              ) : (
                alertes.slice(0, 6).map((a, i) => (
                  <div key={i} className={`forecast-alert forecast-alert--${a.severity}`}>
                    <span className="forecast-alert__time">
                      {a.date ? `${libelleJour(a.date)} ` : ''}
                      {a.time}
                    </span>
                    <span className="forecast-alert__msg">{messageAlerte(a.types, a.message)}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card forecast-day-card">
            <div className="card-head">Heure par heure — {libellePeriode}</div>
            <div className="forecast-timeline">
              {creneaux.length === 0 ? (
                <p className="forecast-alerts-empty">Aucun créneau</p>
              ) : (
                creneaux.map((c) => {
                  const niveau = niveauCreneau(c, seuils);
                  const classe =
                    niveau === 'ok' ? 'forecast-timeline__advice--ok' : niveau === 'bad' ? 'forecast-timeline__advice--bad' : 'forecast-timeline__advice--warn';
                  return (
                    <div key={c.dt_txt} className="forecast-timeline__item">
                      <div className="forecast-timeline__time">{c.time}</div>
                      <div className="forecast-timeline__body">
                        <span className="forecast-timeline__emoji">{EMOJI[c.icon] ?? '🌡️'}</span>
                        <div>
                          <div className="forecast-timeline__main">
                            {c.temp}°C · {c.description}
                          </div>
                          <div className="forecast-timeline__sub">
                            {pluieSimple(c.pop_percent)} · {ventSimple(c.wind_kmh)}
                          </div>
                          <div className={`forecast-timeline__advice ${classe}`}>{conseilCreneau(c, seuils)}</div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="card forecast-trust">
            <div className="card-head">Fiabilité des données</div>
            <p className="forecast-guide-text">
              Source : Open-Meteo (prévisions numériques, pas une mesure sur place). Fiable pour tendances (pluie, chaleur, vent), mais pas au
              quart d’heure près. En cas de doute, regardez le ciel sur le chantier et validez avec le chef de chantier avant d’annuler une tâche.
            </p>
          </div>
        </>
      )}
      {toastEl}
    </div>
  );
}
