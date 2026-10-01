import { Fragment, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { EtatChargement, EtatErreur } from './EtatsGda';
import { useApi } from '../../lib/hooks/useApi';
import { vueDuJour } from '../../lib/api/chantiers';
import type { ContexteChantier } from './ChantierLayout';
import ModaleTache from './ModaleTache';
import { BADGE_STATUT, LIBELLE_STATUT, classeBarre, dateDebutTache, useToast } from './toast';

/** Port de la page `#page-tasks` (renderAllTasks). */
export default function Taches() {
  const { projet, rechargerTableau, estPartenaire } = useOutletContext<ContexteChantier>();
  const jour = useApi(() => vueDuJour(projet.id), [projet.id]);
  const [phase, setPhase] = useState('');
  const [statut, setStatut] = useState('');
  const [ouverte, setOuverte] = useState<number | null>(null);
  const { toast, element: toastEl } = useToast();

  const items = jour.donnees?.items ?? [];
  const phases = useMemo(() => [...new Set(items.map((i) => i.task.phase))], [items]);

  if (jour.chargement && !jour.donnees) return <EtatChargement texte="Chargement des tâches…" />;
  if (jour.erreur) return <EtatErreur message={jour.erreur} recharger={jour.recharger} />;

  let filtres = items;
  if (phase) filtres = filtres.filter((i) => i.task.phase === phase);
  if (statut) filtres = filtres.filter((i) => i.task.status === statut);
  const phasesAffichees = [...new Set(filtres.map((i) => i.task.phase))];

  const avancementPhase = (ph: string) => {
    const lot = items.filter((i) => i.task.phase === ph);
    return lot.length ? Math.round(lot.reduce((s, i) => s + i.task.progress, 0) / lot.length) : 0;
  };
  const itemOuvert = ouverte !== null ? items.find((i) => i.task.id === ouverte) : undefined;

  return (
    <div className="page active gda-legacy" id="page-tasks">
      <div className="page-header">
        <div>
          <div className="page-title">Toutes les tâches</div>
          <div className="page-sub">{items.length} activités · Groupées par phase</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={phase} style={{ padding: '8px 12px', fontSize: 12 }} onChange={(e) => setPhase(e.target.value)}>
            <option value="">Toutes les phases</option>
            {phases.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <select value={statut} style={{ padding: '8px 12px', fontSize: 12 }} onChange={(e) => setStatut(e.target.value)}>
            <option value="">Tous statuts</option>
            <option value="non_demarre">Non démarré</option>
            <option value="en_cours">En cours</option>
            <option value="termine">Terminé</option>
            <option value="annule">Annulée</option>
          </select>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Phase / Sous-phase</th>
              <th>Activité</th>
              <th>Début</th>
              <th style={{ minWidth: 160 }}>Avancement</th>
              <th>Statut</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {phasesAffichees.map((ph) => (
              <Fragment key={ph}>
                <tr className="phase-row">
                  <td colSpan={6}>
                    {ph}
                    <span style={{ marginLeft: 12, fontWeight: 400, color: 'var(--muted)' }}>{avancementPhase(ph)}% complété</span>
                  </td>
                </tr>
                {filtres
                  .filter((i) => i.task.phase === ph)
                  .map((i) => {
                    const t = i.task;
                    return (
                      <tr key={t.id}>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: 12 }}>{t.subphase}</div>
                        </td>
                        <td style={{ fontSize: 12 }}>{t.activity}</td>
                        <td style={{ fontSize: 12, color: 'var(--muted)' }}>{dateDebutTache(projet.start_date, t.start_day)}</td>
                        <td>
                          <div className="pbar-wrap">
                            <div className="pbar">
                              <div className={`pbar-fill ${classeBarre(t.progress, true)}`} style={{ width: `${t.progress}%` }} />
                            </div>
                            <div className="pct-num" style={{ color: 'var(--blanc)' }}>
                              {t.progress}%
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${BADGE_STATUT[t.status] ?? 'badge-nd'}`}>{LIBELLE_STATUT[t.status] ?? t.status}</span>
                          {t.status === 'annule' && t.status_comment ? (
                            <div className="status-note" style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, maxWidth: 220 }}>
                              {t.status_comment}
                            </div>
                          ) : null}
                        </td>
                        <td>
                          <button
                            className={`btn btn-secondary btn-sm${estPartenaire ? '' : ' btn-icon'}`}
                            title={estPartenaire ? 'Détails' : 'Modifier'}
                            onClick={() => setOuverte(t.id)}
                          >
                            {estPartenaire ? 'Détails' : '✎'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {itemOuvert && (
        <ModaleTache
          chantierId={projet.id}
          item={itemOuvert}
          date={jour.donnees?.date ?? ''}
          progressionAffichee={itemOuvert.effective_progress}
          statutAffiche={itemOuvert.effective_status}
          lectureSeule={estPartenaire}
          toast={toast}
          onFermer={() => setOuverte(null)}
          onEnregistre={() => {
            setOuverte(null);
            jour.recharger();
            rechargerTableau();
          }}
        />
      )}
      {toastEl}
    </div>
  );
}
