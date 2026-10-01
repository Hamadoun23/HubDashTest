import { useEffect, useState } from 'react';
import { creerMiseAJour, modifierMiseAJour, obtenirTacheDetailComplete, type ElementJour, type NoteProgression } from '../../lib/api/chantiers';

/**
 * Modale « Modifier la tâche » — port d'`openModal()` / `saveTask()` /
 * `syncTaskStatusCommentField()` (gda-app.js) et du balisage d'overlays.blade.php.
 */
export default function ModaleTache({
  chantierId,
  item,
  date,
  progressionAffichee,
  statutAffiche,
  lectureSeule,
  onFermer,
  onEnregistre,
  toast,
}: {
  chantierId: number;
  item: ElementJour;
  date: string;
  progressionAffichee: number;
  statutAffiche: string;
  lectureSeule: boolean;
  onFermer: () => void;
  onEnregistre: () => void;
  toast: (message: string, type?: '' | 'ok' | 'err') => void;
}) {
  const t = item.task;
  // Avancement de référence pour la date de saisie (même règle que l'API).
  const reference = item.daily_update ? item.daily_update.progress : t.progress;
  const [statut, setStatut] = useState(statutAffiche);
  const [progression, setProgression] = useState(progressionAffichee);
  const [texte, setTexte] = useState(lectureSeule ? '' : statutAffiche === 'annule' ? item.daily_update?.comment ?? '' : '');
  const [notes, setNotes] = useState<NoteProgression[]>(t.progress_notes ?? []);
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    let actif = true;
    obtenirTacheDetailComplete(t.id)
      .then((d) => actif && setNotes(d.progress_notes ?? []))
      .catch(() => {});
    return () => {
      actif = false;
    };
  }, [t.id]);

  const enHausse = progression > reference;
  const libelleCommentaire = lectureSeule
    ? 'Commentaire (optionnel)'
    : statut === 'annule'
      ? "Motif d'annulation (obligatoire)"
      : enHausse
        ? 'Justification de l’avancement (obligatoire)'
        : 'Justification (si avancement augmente)';
  const placeholder = statut === 'annule' ? 'Décrivez la raison de l’annulation...' : 'Décrivez les travaux réalisés pour justifier l’avancement…';

  async function enregistrer() {
    if (lectureSeule) return;
    const note = texte.trim();
    if (statut === 'annule' && !note) {
      toast('Une description est obligatoire pour le statut Annulée.', 'err');
      return;
    }
    if (enHausse && !note) {
      toast('Une description est obligatoire lorsque l’avancement augmente.', 'err');
      return;
    }
    const payload = {
      progress: progression,
      status: statut,
      comment: statut === 'annule' ? note : undefined,
      progress_note: enHausse ? note : undefined,
    };
    setEnvoi(true);
    try {
      if (item.daily_update) {
        await modifierMiseAJour(chantierId, item.daily_update.id, payload);
      } else {
        await creerMiseAJour(chantierId, { task_id: t.id, date, ...payload });
      }
      toast(`✓ "${t.subphase}" mis à jour — ${progression}%`, 'ok');
      onEnregistre();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erreur', 'err');
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="modal-backdrop open gda-legacy" onClick={onFermer}>
      <div className={`modal${lectureSeule ? ' modal-readonly' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">{lectureSeule ? 'Détails de l’activité' : 'Modifier la tâche'}</div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Phase</label>
            <input type="text" value={t.phase} readOnly style={{ opacity: 0.6 }} />
          </div>
          <div className="form-group">
            <label className="form-label">Sous-phase</label>
            <input type="text" value={t.subphase} readOnly style={{ opacity: 0.6 }} />
          </div>
        </div>
        <div className="form-group" style={{ marginBottom: 14 }}>
          <label className="form-label">Activité</label>
          <input type="text" value={t.activity} readOnly style={{ opacity: 0.6 }} />
        </div>
        <div className="form-group modal-field-editable" style={{ marginBottom: 14 }}>
          <label className="form-label">Statut</label>
          <select value={statut} disabled={lectureSeule} onChange={(e) => setStatut(e.target.value)}>
            <option value="non_demarre">Non démarré</option>
            <option value="en_cours">En cours</option>
            <option value="termine">Terminé</option>
            <option value="annule">Annulée</option>
          </select>
        </div>
        <div className="form-group modal-field-editable" style={{ marginBottom: 8 }}>
          <label className="form-label">
            <span>Avancement</span> — <span>{progression}</span>%
          </label>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={progression}
            disabled={lectureSeule}
            onChange={(e) => setProgression(Number(e.target.value))}
          />
        </div>
        <div className="form-group" style={{ marginBottom: 14 }}>
          <label className="form-label">Historique des justifications</label>
          <div className="progress-notes-list">
            {notes.length === 0 ? (
              <div className="progress-notes-empty">Aucune justification enregistrée.</div>
            ) : (
              notes.map((n) => (
                <div key={n.id} className="progress-note-item">
                  {n.created_at !== undefined && (
                    <div className="progress-note-meta">
                      <span className="progress-note-pct">
                        {n.previous_progress}% → {n.progress}%
                      </span>
                      <span className="progress-note-date">{n.created_at ? new Date(n.created_at).toLocaleString('fr-FR') : ''}</span>
                      {n.user_name ? <span className="progress-note-user">{n.user_name}</span> : null}
                    </div>
                  )}
                  <div className="progress-note-body">{n.body}</div>
                </div>
              ))
            )}
          </div>
        </div>
        {!lectureSeule && (
          <div className="form-group modal-field-editable" style={{ marginBottom: 14 }}>
            <label className="form-label">{libelleCommentaire}</label>
            <textarea rows={3} value={texte} placeholder={placeholder} onChange={(e) => setTexte(e.target.value)} />
          </div>
        )}
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onFermer}>
            {lectureSeule ? 'Retour' : 'Annuler'}
          </button>
          {!lectureSeule && (
            <button type="button" className="btn btn-ok" disabled={envoi} onClick={enregistrer}>
              {envoi ? 'Envoi…' : '✓ Enregistrer'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
