import { useState } from 'react';
import { Download, FileText } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { EtatErreur } from '../../components/ui/EtatRequete';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { TableVirtus } from '../../components/ui/Table';
import { useAction, useApi } from '../../lib/hooks/useApi';
import { genererRapport, listerRapports, telechargerRapportPdf } from '../../lib/api/chantiers';
import type { ContexteChantier } from './ChantierLayout';

export default function Rapport() {
  const { projet } = useOutletContext<ContexteChantier>();
  const rapports = useApi(() => listerRapports(projet.id), [projet.id]);
  const generation = useAction(genererRapport);
  const telechargement = useAction(telechargerRapportPdf);
  const [dernier, setDernier] = useState<{ statistics: { total_tasks: number; done_tasks: number; in_progress_tasks: number; overall_progress: number } } | null>(null);
  const [temperature, setTemperature] = useState('');
  const [meteo, setMeteo] = useState('');
  const [notes, setNotes] = useState('');

  async function generer() {
    const resultat = await generation.executer(projet.id, {
      temperature: temperature || undefined,
      weather: meteo || undefined,
      notes: notes || undefined,
    });
    setDernier(resultat);
    rapports.recharger();
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/20">
            <FileText size={18} className="text-accent2" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Rapport de chantier</h2>
            <p className="text-xs text-muted">
              {projet.name} — au {new Date().toLocaleDateString('fr-FR')}
            </p>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between text-xs text-muted">
            <span>Avancement global</span>
            <span className="font-semibold text-white">{Math.round(dernier?.statistics.overall_progress ?? projet.overall_progress)}%</span>
          </div>
          <div className="mt-2">
            <ProgressBar progress={dernier?.statistics.overall_progress ?? projet.overall_progress} />
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted">Température</label>
            <input
              value={temperature}
              onChange={(e) => setTemperature(e.target.value)}
              placeholder="28°C"
              className="w-28 rounded-lg border border-border bg-surface2 px-2.5 py-1.5 text-sm text-white placeholder:text-muted focus:border-accent focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted">Météo</label>
            <input
              value={meteo}
              onChange={(e) => setMeteo(e.target.value)}
              placeholder="Ensoleillé"
              className="w-36 rounded-lg border border-border bg-surface2 px-2.5 py-1.5 text-sm text-white placeholder:text-muted focus:border-accent focus:outline-none"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs font-semibold text-muted">Notes</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observations du jour..."
              className="w-full rounded-lg border border-border bg-surface2 px-2.5 py-1.5 text-sm text-white placeholder:text-muted focus:border-accent focus:outline-none"
            />
          </div>
        </div>

        {generation.erreur ? <p className="text-xs font-semibold text-red-400">{generation.erreur}</p> : null}

        <button
          onClick={generer}
          disabled={generation.enCours}
          className="flex w-fit items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-xs font-bold text-black disabled:opacity-60"
        >
          <Download size={14} />
          {generation.enCours ? 'Génération...' : 'Générer le rapport PDF'}
        </button>
      </Card>

      {rapports.erreur ? (
        <EtatErreur message={rapports.erreur} recharger={rapports.recharger} />
      ) : (
        <div>
          <h2 className="mb-3 text-sm font-bold text-white">Rapports générés</h2>
          <TableVirtus
            colonnes={['Date', 'Avancement', 'Météo', '']}
            lignes={(rapports.donnees ?? []).map((r) => [
              r.report_date,
              r.overall_progress !== null ? `${Math.round(r.overall_progress)}%` : '—',
              r.weather || '—',
              <button
                onClick={() => telechargement.executer(r.id, `rapport-${projet.name}-${r.report_date}.pdf`)}
                disabled={telechargement.enCours}
                className="text-xs font-semibold text-accent2 hover:text-accent"
              >
                Télécharger le PDF →
              </button>,
            ])}
          />
        </div>
      )}
    </div>
  );
}
