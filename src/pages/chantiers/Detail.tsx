import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { EtatChargement } from './EtatsGda';
import { useAction } from '../../lib/hooks/useApi';
import { exporterTableauDeBordExcel } from '../../lib/api/chantiers';
import type { ContexteChantier } from './ChantierLayout';
import { TOUTES, useGraphiques } from './graphiquesDashboard';

export default function Detail() {
  const { projet, tableau, estPartenaire } = useOutletContext<ContexteChantier>();
  const navigate = useNavigate();
  const export_ = useAction(exporterTableauDeBordExcel);
  const [filtrePhase, setFiltrePhase] = useState(TOUTES);

  useEffect(() => setFiltrePhase(TOUTES), [projet.id]);

  const refs = useGraphiques(tableau, filtrePhase);

  if (!tableau) return <EtatChargement texte="Chargement du tableau de bord…" />;

  const phases = tableau.progress_by_phase;
  const toutesActivites = tableau.charts.activities;
  const activitesFiltrees = filtrePhase === TOUTES ? toutesActivites : toutesActivites.filter((a) => a.phase === filtrePhase);

  return (
    <div className="page active gda-legacy" id="page-dashboard">
      <div className="page-header">
        <div>
          <div className="page-title">Tableau de bord</div>
          <div className="page-sub">Vue d'ensemble du projet</div>
        </div>
        {!estPartenaire && (
          <button type="button" className="btn btn-primary" onClick={() => navigate(`/chantiers/${projet.id}/saisie`)}>
            ✎ Saisie du jour
          </button>
        )}
      </div>

      <div className="stats-row">
        <div className="stat-card s-total">
          <div className="stat-val">{tableau.stats.total}</div>
          <div className="stat-lbl">Tâches totales</div>
        </div>
        <div className="stat-card s-done">
          <div className="stat-val">{tableau.stats.done}</div>
          <div className="stat-lbl">Terminées</div>
        </div>
        <div className="stat-card s-prog">
          <div className="stat-val">{tableau.stats.in_progress}</div>
          <div className="stat-lbl">En cours</div>
        </div>
        <div className="stat-card s-late">
          <div className="stat-val">{tableau.stats.cancelled}</div>
          <div className="stat-lbl">Annulées</div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">Avancement par phase</div>
        <div>
          {phases.map((p) => {
            const cls = p.progress === 100 ? 'fill-done' : p.progress > 0 ? 'fill-low' : 'fill-0';
            return (
              <div
                key={p.phase}
                className={`dash-phase-row${p.partner_hidden ? ' row-partner-hidden' : ''}`}
                style={{ display: 'grid', gridTemplateColumns: '180px 1fr 50px', alignItems: 'center', gap: 14, marginBottom: 10 }}
              >
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{p.phase}</div>
                <div className="pbar">
                  <div className={`pbar-fill ${cls}`} style={{ width: `${p.progress}%` }} />
                </div>
                <div
                  style={{
                    fontFamily: "Tahoma,Verdana,'Segoe UI',sans-serif",
                    fontSize: 16,
                    fontWeight: 700,
                    color: 'var(--blanc)',
                  }}
                >
                  {p.progress}%
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {!estPartenaire && (
        <div className="card">
          <div className="card-head">Activité récente</div>
          <div>
            {tableau.recent_activity.length === 0 ? (
              <div style={{ color: 'var(--muted)', fontSize: 13, padding: 20, textAlign: 'center' }}>
                Aucune activité enregistrée — commencez la saisie du jour.
              </div>
            ) : (
              tableau.recent_activity.map((a) => (
                <div
                  key={`${a.task_id}-${a.ts}`}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '10px 0', borderBottom: '1px solid var(--bg2)' }}
                >
                  <div
                    style={{
                      background: 'var(--bg2)',
                      borderRadius: 6,
                      padding: '6px 10px',
                      fontFamily: "Tahoma,Verdana,'Segoe UI',sans-serif",
                      fontSize: 12,
                      color: 'var(--muted)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {a.time}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{a.task_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                      {a.action} · <span style={{ color: 'var(--blanc)', fontWeight: 600 }}>{a.user}</span>
                    </div>
                  </div>
                  <div
                    style={{
                      marginLeft: 'auto',
                      fontFamily: "Tahoma,Verdana,'Segoe UI',sans-serif",
                      fontSize: 18,
                      fontWeight: 700,
                      color: 'var(--blanc)',
                    }}
                  >
                    {a.progress}%
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <div className="card" id="dashboard-stats-card">
        <div className="card-head dashboard-stats-card-head">
          <span className="dashboard-stats-card-head__title">Données & statistiques</span>
          <button
            type="button"
            className="btn btn-excel btn-sm dashboard-stats-export-btn"
            disabled={export_.enCours}
            onClick={() => export_.executer(projet.id, `dashboard-${projet.name}.xlsx`)}
          >
            {export_.enCours ? 'Export…' : 'Exporter Excel'}
          </button>
        </div>
        <p className="dashboard-charts-intro">
          Synthèse du projet : statuts, phases, sous-phases. Les activités sont affichées par phase (1re phase par défaut) ; vous pouvez tout
          afficher si besoin.
        </p>
        <div className="dashboard-charts-grid">
          <div className="dashboard-chart-wrap">
            <div className="dashboard-chart-title">Répartition par statut</div>
            <div className="dashboard-chart-canvas">
              <canvas ref={refs.pie} aria-label="Camembert des statuts" />
            </div>
          </div>
          <div className="dashboard-chart-wrap">
            <div className="dashboard-chart-title">Avancement par phase (%)</div>
            <div className="dashboard-chart-canvas">
              <canvas ref={refs.phase} aria-label="Histogramme par phase" />
            </div>
          </div>
          <div className="dashboard-chart-wrap dashboard-chart-wrap--wide">
            <div className="dashboard-chart-title">Sous-phases — progression moyenne</div>
            <div className="dashboard-chart-canvas dashboard-chart-canvas--tall">
              <canvas ref={refs.sub} aria-label="Barres des sous-phases" />
            </div>
          </div>
          <div className="dashboard-chart-wrap dashboard-chart-wrap--wide">
            <div className="dashboard-chart-head-row">
              <div className="dashboard-chart-title">Activités — progression</div>
              {toutesActivites.length > 0 && (
                <div className="dashboard-activity-toolbar">
                  <label htmlFor="dashboard-activity-phase-filter" className="dashboard-activity-filter-lbl">
                    Afficher
                  </label>
                  <select
                    id="dashboard-activity-phase-filter"
                    className="dashboard-activity-phase-select"
                    value={filtrePhase}
                    onChange={(e) => setFiltrePhase(e.target.value)}
                  >
                    {phases.map((p) => (
                      <option key={p.phase} value={p.phase}>
                        {p.phase}
                      </option>
                    ))}
                    <option value={TOUTES}>Tout afficher ({toutesActivites.length})</option>
                  </select>
                </div>
              )}
            </div>
            {toutesActivites.length === 0 ? (
              <div className="dashboard-activity-empty">Aucune activité pour ce projet.</div>
            ) : activitesFiltrees.length === 0 ? (
              <div className="dashboard-activity-empty">Aucune activité pour cette phase.</div>
            ) : null}
            <div
              ref={refs.actWrap}
              className="dashboard-chart-canvas dashboard-chart-canvas--activities"
              hidden={activitesFiltrees.length === 0}
            >
              <canvas ref={refs.act} aria-label="Barres par activité" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
