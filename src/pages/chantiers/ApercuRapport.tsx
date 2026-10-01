import { Fragment } from 'react';
import { useApi } from '../../lib/hooks/useApi';
import { listerPhotos, vueDuJour, type CategoriePhoto, type Dashboard, type Projet } from '../../lib/api/chantiers';
import { TOUTES, useGraphiques } from './graphiquesDashboard';
import { BADGE_STATUT, classeBarre, dateDebutTache } from './toast';

const TEXTES = {
  fr: {
    surtitre: 'Rapport journalier de chantier',
    date: 'Date',
    temperature: 'Température',
    meteo: 'Météo',
    global: 'Avancement global',
    total: 'Tâches totales',
    terminees: 'Terminées',
    enCours: 'En cours',
    annulees: 'Annulées',
    phases: 'Avancement par phase',
    stats: 'Données & statistiques',
    statut: 'Répartition par statut',
    parPhase: 'Avancement par phase (%)',
    sousPhases: 'Sous-phases — progression moyenne',
    activites: 'Activités — progression',
    detail: 'Détail des activités',
    colSous: 'Sous-phase',
    colAct: 'Activité',
    colDebut: 'Début',
    colAvancement: 'Avancement',
    colStatut: 'Statut',
    photos: 'Photos',
    aucune: 'Aucune activité pour ce chantier.',
    statuts: { non_demarre: 'Non démarré', en_cours: 'En cours', termine: 'Terminé', annule: 'Annulé' } as Record<string, string>,
    categories: { avant: 'Avant travaux', pendant: 'Pendant travaux', apres: 'Après travaux', securite: 'Sécurité', qualite: 'Contrôle qualité' },
  },
  en: {
    surtitre: 'Daily site progress report',
    date: 'Date',
    temperature: 'Temperature',
    meteo: 'Weather',
    global: 'Overall progress',
    total: 'Total tasks',
    terminees: 'Completed',
    enCours: 'In progress',
    annulees: 'Cancelled',
    phases: 'Progress by phase',
    stats: 'Data & statistics',
    statut: 'Breakdown by status',
    parPhase: 'Progress by phase (%)',
    sousPhases: 'Sub-phases — average progress',
    activites: 'Activities — progress',
    detail: 'Activity details',
    colSous: 'Sub-phase',
    colAct: 'Activity',
    colDebut: 'Start',
    colAvancement: 'Progress',
    colStatut: 'Status',
    photos: 'Photos',
    aucune: 'No activity for this site.',
    statuts: { non_demarre: 'Not started', en_cours: 'In progress', termine: 'Completed', annule: 'Cancelled' } as Record<string, string>,
    categories: { avant: 'Before works', pendant: 'During works', apres: 'After works', securite: 'Safety', qualite: 'Quality control' },
  },
};

const CATEGORIES: CategoriePhoto[] = ['avant', 'pendant', 'apres', 'securite', 'qualite'];

/**
 * Aperçu du rapport journalier, construit avec les composants du tableau de
 * bord (cartes, graphiques, badges, grille photos). Mêmes données et mêmes
 * sections que le PDF, dans le thème de l'application.
 */
export default function ApercuRapport({
  projet,
  tableau,
  date,
  temperature,
  meteo,
  titre,
  langue,
}: {
  projet: Projet;
  tableau: Dashboard | null;
  date: string;
  temperature: string;
  meteo: string;
  titre: string;
  langue: 'fr' | 'en';
}) {
  const T = TEXTES[langue];
  const jour = useApi(() => vueDuJour(projet.id), [projet.id]);
  const photos = useApi(() => listerPhotos(projet.id), [projet.id]);
  const graphiques = useGraphiques(tableau, TOUTES);

  const taches = (jour.donnees?.items ?? []).map((i) => i.task);
  const phases = [...new Set(taches.map((t) => t.phase))];
  const global = Math.round(tableau?.overall_progress ?? projet.overall_progress ?? 0);
  const dateAffichee = date ? new Date(`${date}T12:00:00`).toLocaleDateString(langue === 'en' ? 'en-GB' : 'fr-FR') : '—';
  const sectionsPhotos = CATEGORIES.map((c) => ({ cle: c, liste: (photos.donnees ?? []).filter((p) => p.category === c) })).filter((s) => s.liste.length);

  return (
    <div className="rapport">
      <header className="rapport-entete">
        <div className="rapport-entete__texte">
          <div className="rapport-surtitre">{T.surtitre}</div>
          <h2 className="rapport-titre">{titre || projet.name}</h2>
          <div className="rapport-meta">
            <span>
              <b>{T.date}</b> {dateAffichee}
            </span>
            <span>
              <b>{T.temperature}</b> {temperature ? `${temperature} °C` : '—'}
            </span>
            <span>
              <b>{T.meteo}</b> {meteo || '—'}
            </span>
          </div>
        </div>
        <div className="rapport-global">
          <div className="rapport-global__pct">{global}%</div>
          <div className="rapport-global__lbl">{T.global}</div>
          <div className="pbar">
            <div className={`pbar-fill ${classeBarre(global)}`} style={{ width: `${global}%` }} />
          </div>
        </div>
      </header>

      {tableau && (
        <div className="stats-row">
          <div className="stat-card s-total">
            <div className="stat-val">{tableau.stats.total}</div>
            <div className="stat-lbl">{T.total}</div>
          </div>
          <div className="stat-card s-done">
            <div className="stat-val">{tableau.stats.done}</div>
            <div className="stat-lbl">{T.terminees}</div>
          </div>
          <div className="stat-card s-prog">
            <div className="stat-val">{tableau.stats.in_progress}</div>
            <div className="stat-lbl">{T.enCours}</div>
          </div>
          <div className="stat-card s-late">
            <div className="stat-val">{tableau.stats.cancelled}</div>
            <div className="stat-lbl">{T.annulees}</div>
          </div>
        </div>
      )}

      {tableau && tableau.progress_by_phase.length > 0 && (
        <section className="card">
          <div className="card-head">{T.phases}</div>
          {tableau.progress_by_phase.map((p) => (
            <div key={p.phase} className="rapport-phase">
              <span className="rapport-phase__nom">{p.phase}</span>
              <div className="pbar">
                <div className={`pbar-fill ${classeBarre(p.progress)}`} style={{ width: `${p.progress}%` }} />
              </div>
              <span className="rapport-phase__pct">{p.progress}%</span>
            </div>
          ))}
        </section>
      )}

      {tableau && (
        <section className="card">
          <div className="card-head">{T.stats}</div>
          <div className="dashboard-charts-grid">
            <div className="dashboard-chart-wrap">
              <div className="dashboard-chart-title">{T.statut}</div>
              <div className="dashboard-chart-canvas">
                <canvas ref={graphiques.pie} />
              </div>
            </div>
            <div className="dashboard-chart-wrap">
              <div className="dashboard-chart-title">{T.parPhase}</div>
              <div className="dashboard-chart-canvas">
                <canvas ref={graphiques.phase} />
              </div>
            </div>
            <div className="dashboard-chart-wrap dashboard-chart-wrap--wide">
              <div className="dashboard-chart-title">{T.sousPhases}</div>
              <div className="dashboard-chart-canvas dashboard-chart-canvas--tall">
                <canvas ref={graphiques.sub} />
              </div>
            </div>
            <div className="dashboard-chart-wrap dashboard-chart-wrap--wide">
              <div className="dashboard-chart-title">{T.activites}</div>
              <div ref={graphiques.actWrap} className="dashboard-chart-canvas dashboard-chart-canvas--activities">
                <canvas ref={graphiques.act} />
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="card-head rapport-card-head">{T.detail}</div>
        {taches.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--blanc-discret)' }}>{T.aucune}</div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>{T.colSous}</th>
                <th>{T.colAct}</th>
                <th>{T.colDebut}</th>
                <th style={{ minWidth: 160 }}>{T.colAvancement}</th>
                <th>{T.colStatut}</th>
              </tr>
            </thead>
            <tbody>
              {phases.map((ph) => (
                <Fragment key={ph}>
                  <tr className="phase-row">
                    <td colSpan={5}>{ph}</td>
                  </tr>
                  {taches
                    .filter((t) => t.phase === ph)
                    .map((t) => (
                      <tr key={t.id}>
                        <td style={{ fontWeight: 600 }}>{t.subphase}</td>
                        <td>{t.activity}</td>
                        <td style={{ color: 'var(--blanc-discret)' }}>{dateDebutTache(projet.start_date, t.start_day)}</td>
                        <td>
                          <div className="pbar-wrap">
                            <div className="pbar">
                              <div className={`pbar-fill ${classeBarre(t.progress)}`} style={{ width: `${t.progress}%` }} />
                            </div>
                            <div className="pct-num">{t.progress}%</div>
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${BADGE_STATUT[t.status] ?? 'badge-nd'}`}>{T.statuts[t.status] ?? t.status}</span>
                          {t.status === 'annule' && t.status_comment ? <div className="rapport-note">{t.status_comment}</div> : null}
                        </td>
                      </tr>
                    ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {sectionsPhotos.map((s) => (
        <section key={s.cle} className="card">
          <div className="card-head">
            {T.photos} — {T.categories[s.cle]}
            <span className="rapport-compte">{s.liste.length}</span>
          </div>
          <div className="rapport-photos">
            {s.liste.map((p) => (
              <figure key={p.id} className="rapport-photo">
                <img src={p.url} alt={p.caption || ''} loading="lazy" />
                {p.caption ? <figcaption>{p.caption}</figcaption> : null}
              </figure>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
