import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { EtatChargement, EtatErreur } from '../../components/ui/EtatRequete';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { useAction, useApi } from '../../lib/hooks/useApi';
import { creerMiseAJour, modifierMiseAJour, vueDuJour, type ElementJour } from '../../lib/api/chantiers';
import type { ContexteChantier } from './ChantierLayout';

function LigneTache({ chantierId, item, recharger }: { chantierId: number; item: ElementJour; recharger: () => void }) {
  const [progress, setProgress] = useState(item.effective_progress);
  const [commentaire, setCommentaire] = useState(item.daily_update?.comment ?? '');
  const creation = useAction(creerMiseAJour);
  const modification = useAction(modifierMiseAJour);
  const saisie = item.daily_update ? modification : creation;

  const progressionEnHausse = progress > item.effective_progress;

  async function enregistrer() {
    // Le backend exige une justification (`progress_note`) dès que l'avancement
    // augmente — le champ « Commentaire » sert cette double fonction ici.
    const payload = { progress, comment: commentaire || undefined, progress_note: commentaire || undefined };
    if (item.daily_update) {
      await modification.executer(chantierId, item.daily_update.id, payload);
    } else {
      await creation.executer(chantierId, { task_id: item.task.id, ...payload });
    }
    recharger();
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-surface2 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-white">{item.task.activity}</p>
          <p className="text-xs text-muted">
            {item.task.phase} · {item.task.subphase}
          </p>
        </div>
        <span className="text-xs font-semibold text-muted">{item.effective_status}</span>
      </div>
      <ProgressBar progress={item.effective_progress} height={5} />
      <div className="mt-1 flex items-end gap-2">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-semibold text-muted">Avancement (%)</label>
          <input
            type="number"
            min={0}
            max={100}
            value={progress}
            onChange={(e) => setProgress(Number(e.target.value))}
            className="w-full rounded-lg border border-border bg-bg px-2.5 py-1.5 text-sm text-white focus:border-accent focus:outline-none"
          />
        </div>
        <div className="flex-[2]">
          <label className="mb-1 block text-xs font-semibold text-muted">
            Commentaire{progressionEnHausse ? ' (obligatoire pour justifier la hausse)' : ''}
          </label>
          <input
            value={commentaire}
            onChange={(e) => setCommentaire(e.target.value)}
            placeholder="Travaux réalisés, incidents..."
            className="w-full rounded-lg border border-border bg-bg px-2.5 py-1.5 text-sm text-white placeholder:text-muted focus:border-accent focus:outline-none"
          />
        </div>
        <button
          onClick={enregistrer}
          disabled={saisie.enCours || (progressionEnHausse && !commentaire.trim())}
          className="rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-black disabled:opacity-60"
        >
          {saisie.enCours ? 'Envoi...' : item.daily_update ? 'Mettre à jour' : 'Enregistrer'}
        </button>
      </div>
      {saisie.erreur ? <p className="text-xs font-semibold text-red-400">{saisie.erreur}</p> : null}
    </div>
  );
}

export default function SaisieDuJour() {
  const { projet } = useOutletContext<ContexteChantier>();
  const jour = useApi(() => vueDuJour(projet.id), [projet.id]);

  if (jour.chargement) return <EtatChargement texte="Chargement de la saisie du jour…" />;
  if (jour.erreur || !jour.donnees) return <EtatErreur message={jour.erreur ?? 'Indisponible'} recharger={jour.recharger} />;

  return (
    <div>
      <Card className="mb-4">
        <h2 className="text-sm font-bold text-white">Saisie du jour — {projet.name}</h2>
        <p className="mt-1 text-xs text-muted">{jour.donnees.date}</p>
      </Card>

      {jour.donnees.items.length === 0 ? (
        <p className="rounded-3xl border border-border bg-surface p-8 text-center text-sm text-muted backdrop-blur-xl">
          Aucune tâche à saisir aujourd'hui.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {jour.donnees.items.map((item) => (
            <LigneTache key={item.task.id} chantierId={projet.id} item={item} recharger={jour.recharger} />
          ))}
        </div>
      )}
    </div>
  );
}
