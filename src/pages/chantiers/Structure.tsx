import { useState } from 'react';
import { HardHat, Plus } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import { Card } from '../../components/ui-light/Card';
import { EtatChargement, EtatErreur } from '../../components/ui-light/EtatRequete';
import { ProgressBar } from '../../components/ui-light/ProgressBar';
import { useAction, useApi } from '../../lib/hooks/useApi';
import { creerPhase, creerSousPhase, creerTache, obtenirStructure } from '../../lib/api/chantiers';
import type { ContexteChantier } from './ChantierLayout';

export default function Structure() {
  const { projet } = useOutletContext<ContexteChantier>();
  const structure = useApi(() => obtenirStructure(projet.id), [projet.id]);
  const creationPhase = useAction(creerPhase);
  const creationSousPhase = useAction(creerSousPhase);
  const creationTache = useAction(creerTache);

  const [nomPhase, setNomPhase] = useState('');
  const [sousPhaseOuverte, setSousPhaseOuverte] = useState<number | null>(null);
  const [nomSousPhase, setNomSousPhase] = useState('');
  const [tacheOuverte, setTacheOuverte] = useState<number | null>(null);
  const [nomTache, setNomTache] = useState('');

  async function ajouterPhase(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await creationPhase.executer({ projet: projet.id, name: nomPhase });
    setNomPhase('');
    structure.recharger();
  }

  async function ajouterSousPhase(phaseId: number) {
    if (!nomSousPhase.trim()) return;
    await creationSousPhase.executer({ phase: phaseId, name: nomSousPhase });
    setNomSousPhase('');
    setSousPhaseOuverte(null);
    structure.recharger();
  }

  async function ajouterTache(sousPhaseId: number) {
    if (!nomTache.trim()) return;
    await creationTache.executer(projet.id, { sous_phase: sousPhaseId, activity: nomTache });
    setNomTache('');
    setTacheOuverte(null);
    structure.recharger();
  }

  if (structure.chargement) return <EtatChargement texte="Chargement de la structure…" />;
  if (structure.erreur || !structure.donnees) {
    return <EtatErreur message={structure.erreur ?? 'Structure indisponible'} recharger={structure.recharger} />;
  }

  const { phases } = structure.donnees;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <form onSubmit={ajouterPhase} className="flex items-end gap-3">
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-semibold text-slate-500">Nouvelle phase</label>
            <input
              value={nomPhase}
              onChange={(e) => setNomPhase(e.target.value)}
              placeholder="Gros œuvre"
              required
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-chantiers-terracotta focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={creationPhase.enCours}
            className="flex items-center gap-1.5 rounded-xl bg-chantiers-terracotta px-4 py-2.5 text-xs font-bold text-white disabled:opacity-60"
          >
            <Plus size={14} />
            {creationPhase.enCours ? 'Ajout...' : 'Ajouter la phase'}
          </button>
        </form>
        {creationPhase.erreur ? <p className="mt-2 text-xs font-semibold text-chantiers-rouge">{creationPhase.erreur}</p> : null}
      </Card>

      {phases.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 py-10 text-center">
          <HardHat size={20} className="text-slate-400" />
          <p className="text-sm text-slate-500">Aucune phase n'a encore été définie pour ce chantier.</p>
        </Card>
      ) : (
        phases.map((phase) => (
          <Card key={phase.id} className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-chantiers-marron">{phase.name}</h2>
              <button
                onClick={() => {
                  setSousPhaseOuverte(sousPhaseOuverte === phase.id ? null : phase.id);
                  setNomSousPhase('');
                }}
                className="text-xs font-semibold text-chantiers-terracotta hover:opacity-80"
              >
                {sousPhaseOuverte === phase.id ? 'Annuler' : '+ Sous-phase'}
              </button>
            </div>

            {sousPhaseOuverte === phase.id && (
              <div className="flex items-end gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <input
                  value={nomSousPhase}
                  onChange={(e) => setNomSousPhase(e.target.value)}
                  placeholder="Fondations"
                  autoFocus
                  className="flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-chantiers-terracotta focus:outline-none"
                />
                <button
                  onClick={() => ajouterSousPhase(phase.id)}
                  disabled={creationSousPhase.enCours}
                  className="rounded-lg bg-chantiers-terracotta px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
                >
                  Ajouter
                </button>
              </div>
            )}
            {creationSousPhase.erreur ? <p className="text-xs font-semibold text-chantiers-rouge">{creationSousPhase.erreur}</p> : null}

            {phase.sub_phases.length === 0 ? (
              <p className="text-xs text-slate-500">Aucune sous-phase.</p>
            ) : (
              <div className="flex flex-col gap-4">
                {phase.sub_phases.map((sousPhase) => (
                  <div key={sousPhase.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wide text-chantiers-terracotta">{sousPhase.name}</h3>
                      <button
                        onClick={() => {
                          setTacheOuverte(tacheOuverte === sousPhase.id ? null : sousPhase.id);
                          setNomTache('');
                        }}
                        className="text-xs font-semibold text-chantiers-terracotta hover:opacity-80"
                      >
                        {tacheOuverte === sousPhase.id ? 'Annuler' : '+ Tâche'}
                      </button>
                    </div>

                    {tacheOuverte === sousPhase.id && (
                      <div className="mb-3 flex items-end gap-2 rounded-xl border border-slate-200 bg-white p-3">
                        <input
                          value={nomTache}
                          onChange={(e) => setNomTache(e.target.value)}
                          placeholder="Coulage des fondations"
                          autoFocus
                          className="flex-1 rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-chantiers-terracotta focus:outline-none"
                        />
                        <button
                          onClick={() => ajouterTache(sousPhase.id)}
                          disabled={creationTache.enCours}
                          className="rounded-lg bg-chantiers-terracotta px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
                        >
                          Ajouter
                        </button>
                      </div>
                    )}
                    {creationTache.erreur ? <p className="mb-3 text-xs font-semibold text-chantiers-rouge">{creationTache.erreur}</p> : null}

                    {sousPhase.tasks.length === 0 ? (
                      <p className="text-xs text-slate-500">Aucune tâche.</p>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {sousPhase.tasks.map((tache) => (
                          <div key={tache.id} className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-700">{tache.activity}</span>
                              <span className="font-semibold text-slate-500">{tache.status_label}</span>
                            </div>
                            <ProgressBar progress={tache.progress} height={5} accent="#c8521a" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))
      )}
    </div>
  );
}
