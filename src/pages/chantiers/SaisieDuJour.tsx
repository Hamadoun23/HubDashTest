import { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { EtatChargement, EtatErreur } from './EtatsGda';
import { ApiError } from '../../lib/api/client';
import { useApi } from '../../lib/hooks/useApi';
import { saisirEnLot, vueDuJour, type ElementJour } from '../../lib/api/chantiers';
import type { ContexteChantier } from './ChantierLayout';
import ModaleTache from './ModaleTache';
import { BADGE_STATUT, LIBELLE_STATUT, classeBarre, statutDepuisProgression, useToast } from './toast';

function aujourdhui() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type Modification = { progress: number; status: string; base: number };

/** Port de la page `#page-daily` (renderDaily / quickUpdate / saveDailyAll). */
export default function SaisieDuJour() {
  const { projet, rechargerTableau, estPartenaire } = useOutletContext<ContexteChantier>();
  const [date, setDate] = useState(aujourdhui());
  const jour = useApi(() => vueDuJour(projet.id, date), [projet.id, date]);
  const [filtre, setFiltre] = useState<'all' | 'ip' | 'nd'>('all');
  const [phase, setPhase] = useState('');
  const [modifs, setModifs] = useState<Record<number, Modification>>({});
  const [ouverte, setOuverte] = useState<number | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const { toast, element: toastEl } = useToast();

  const items = jour.donnees?.items ?? [];
  const phases = useMemo(() => [...new Set(items.map((i) => i.task.phase))], [items]);

  const progressionDe = (i: ElementJour) => modifs[i.task.id]?.progress ?? i.effective_progress;
  const statutDe = (i: ElementJour) => modifs[i.task.id]?.status ?? i.effective_status;

  let filtres = phase ? items.filter((i) => i.task.phase === phase) : items;
  if (filtre === 'ip') filtres = filtres.filter((i) => statutDe(i) !== 'annule' && (statutDe(i) === 'en_cours' || progressionDe(i) > 0));
  if (filtre === 'nd') filtres = filtres.filter((i) => statutDe(i) === 'non_demarre');

  function changerDate(valeur: string) {
    if (!valeur) return;
    setDate(valeur);
    setModifs({});
  }

  function miseAJourRapide(i: ElementJour, valeur: number) {
    if (estPartenaire) return;
    setModifs((m) => ({
      ...m,
      [i.task.id]: {
        progress: valeur,
        status: statutDepuisProgression(valeur),
        base: m[i.task.id]?.base ?? (i.daily_update ? i.daily_update.progress : i.task.progress),
      },
    }));
  }

  async function toutEnregistrer() {
    const cles = Object.keys(modifs);
    if (!cles.length) {
      toast('Aucune modification à enregistrer');
      return;
    }
    setEnvoi(true);
    try {
      await saisirEnLot(
        projet.id,
        date,
        cles.map((id) => ({ task_id: Number(id), progress: modifs[Number(id)].progress, status: modifs[Number(id)].status })),
      );
      setModifs({});
      jour.recharger();
      rechargerTableau();
      toast('Toutes les modifications enregistrées ✓', 'ok');
    } catch (e) {
      const erreurs = e instanceof ApiError ? (e.details as { errors?: { detail?: string }[] } | null)?.errors : undefined;
      toast(erreurs?.[0]?.detail || (e instanceof Error ? e.message : 'Erreur'), 'err');
    } finally {
      setEnvoi(false);
    }
  }

  const libelleDate = `Date sélectionnée · ${new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })}`;
  const itemOuvert = ouverte !== null ? items.find((i) => i.task.id === ouverte) : undefined;

  return (
    <div className="page active gda-legacy" id="page-daily">
      <div className="page-header">
        <div>
          <div className="page-title">Saisie du jour</div>
          <div className="page-sub">{libelleDate}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ marginBottom: 0, minWidth: 170 }}>
            <label className="form-label">Date de saisie</label>
            <input type="date" value={date} onChange={(e) => changerDate(e.target.value)} />
          </div>
          <button type="button" className="btn btn-secondary" onClick={() => setFiltre('all')}>
            Toutes
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setFiltre('ip')}>
            En cours
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setFiltre('nd')}>
            Non démarrées
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>
            Mettez à jour l'avancement de vos tâches. Cliquez sur une ligne pour voir les détails.
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Filtre phase :</div>
            <select value={phase} style={{ padding: '5px 10px', fontSize: 12 }} onChange={(e) => setPhase(e.target.value)}>
              <option value="">— Toutes les phases —</option>
              {phases.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {jour.chargement && !jour.donnees ? (
        <EtatChargement texte="Chargement de la saisie du jour…" />
      ) : jour.erreur ? (
        <EtatErreur message={jour.erreur} recharger={jour.recharger} />
      ) : filtres.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Aucune tâche dans ce filtre.</div>
      ) : (
        <div>
          {filtres.map((i) => {
            const prog = progressionDe(i);
            const st = statutDe(i);
            const commentaire = st === 'annule' ? i.daily_update?.comment || i.task.status_comment : '';
            return (
              <div key={i.task.id} className="daily-task-row" onClick={() => setOuverte(i.task.id)}>
                <div>
                  <div className="task-name">
                    {i.task.subphase} — {i.task.activity}
                  </div>
                  <div className="task-phase">{i.task.phase}</div>
                </div>
                <div>
                  <span className={`badge ${BADGE_STATUT[st] ?? 'badge-nd'}`}>{LIBELLE_STATUT[st] ?? st}</span>
                  {commentaire ? (
                    <div className="status-note" style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, maxWidth: 220 }}>
                      {commentaire}
                    </div>
                  ) : null}
                </div>
                <div className="range-wrap" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={prog}
                    style={{ width: '100%' }}
                    disabled={estPartenaire}
                    onChange={(e) => miseAJourRapide(i, Number(e.target.value))}
                  />
                  <div className="range-val">{prog}%</div>
                </div>
                <div>
                  <div className="pbar">
                    <div className={`pbar-fill ${classeBarre(prog)}`} style={{ width: `${prog}%` }} />
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOuverte(i.task.id);
                    }}
                  >
                    {estPartenaire ? 'Détails' : 'Détail'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!estPartenaire && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
          <button type="button" className="btn btn-ok btn-sm" disabled={envoi} onClick={toutEnregistrer}>
            {envoi ? 'Envoi…' : '✓ Enregistrer toutes les modifications'}
          </button>
        </div>
      )}

      {itemOuvert && (
        <ModaleTache
          chantierId={projet.id}
          item={itemOuvert}
          date={date}
          progressionAffichee={progressionDe(itemOuvert)}
          statutAffiche={statutDe(itemOuvert)}
          lectureSeule={estPartenaire}
          toast={toast}
          onFermer={() => setOuverte(null)}
          onEnregistre={() => {
            setModifs((m) => {
              const reste = { ...m };
              delete reste[itemOuvert.task.id];
              return reste;
            });
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
