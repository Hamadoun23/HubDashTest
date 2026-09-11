import { Calendar, CheckCircle2, Circle, ListChecks, User, Users } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import { Card } from '../../components/ui-light/Card';
import { EtatChargement, EtatErreur } from '../../components/ui-light/EtatRequete';
import { ProgressBar } from '../../components/ui-light/ProgressBar';
import { StatTile } from '../../components/ui-light/StatTile';
import { useApi } from '../../lib/hooks/useApi';
import { obtenirTableauDeBord } from '../../lib/api/chantiers';
import type { ContexteChantier } from './ChantierLayout';

export default function Detail() {
  const { projet } = useOutletContext<ContexteChantier>();
  const dashboard = useApi(() => obtenirTableauDeBord(projet.id), [projet.id]);

  return (
    <div>
      <div className="grid grid-cols-[1fr_1.4fr] gap-6">
        <Card className="flex flex-col gap-4">
          <div className="flex items-center gap-3 text-sm">
            <User size={15} className="text-slate-400" />
            <span className="text-slate-700">{projet.client || 'Client non renseigné'}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Calendar size={15} className="text-slate-400" />
            <span className="text-slate-700">
              {projet.start_date ?? '—'} → {projet.end_date ?? '—'}
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Users size={15} className="text-slate-400" />
            <span className="text-slate-700">
              {projet.user_names.length > 0 ? projet.user_names.join(', ') : 'Aucune équipe assignée'}
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <ListChecks size={15} className="text-slate-400" />
            <span className="text-slate-700">{projet.tasks_count} tâches au total</span>
          </div>
          {projet.description ? <p className="mt-1 text-xs text-slate-500">{projet.description}</p> : null}
        </Card>

        <Card className="flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-chantiers-marron">Avancement global</h2>
            <span className="font-display text-base font-bold tabular-nums text-chantiers-marron">
              {Math.round(projet.overall_progress)}%
            </span>
          </div>
          <ProgressBar progress={projet.overall_progress} accent="#c8521a" />

          <div className="mt-2 flex flex-col gap-4">
            {Object.entries(projet.progress_by_phase).length === 0 ? (
              <p className="text-xs text-slate-500">Aucune phase définie pour ce chantier.</p>
            ) : (
              Object.entries(projet.progress_by_phase).map(([phase, avancement]) => (
                <div key={phase} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500">{phase}</span>
                    <span className="text-xs font-semibold text-chantiers-marron">{Math.round(avancement)}%</span>
                  </div>
                  <ProgressBar progress={avancement} height={6} accent="#c8521a" />
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <div className="mt-6">
        {dashboard.chargement ? (
          <EtatChargement texte="Chargement du tableau de bord…" />
        ) : dashboard.erreur || !dashboard.donnees ? (
          <EtatErreur message={dashboard.erreur ?? 'Tableau de bord indisponible'} recharger={dashboard.recharger} />
        ) : (
          <div className="grid grid-cols-5 gap-4">
            <StatTile icon={ListChecks} valeur={dashboard.donnees.stats.total} libelle="Tâches au total" teinte="#c8521a" />
            <StatTile icon={CheckCircle2} valeur={dashboard.donnees.stats.done} libelle="Terminées" teinte="#1a7a42" />
            <StatTile icon={Circle} valeur={dashboard.donnees.stats.in_progress} libelle="En cours" teinte="#1a5c8a" />
            <StatTile icon={Circle} valeur={dashboard.donnees.stats.not_started} libelle="Non démarrées" teinte="#8a8a8a" />
            <StatTile icon={Circle} valeur={dashboard.donnees.stats.cancelled} libelle="Annulées" teinte="#c01a1a" />
          </div>
        )}
      </div>
    </div>
  );
}
