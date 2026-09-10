import { Calendar, ChevronRight, ExternalLink, Flame, RotateCw, Zap } from 'lucide-react';
import { AvatarStack } from './ui/Avatar';
import { Card } from './ui/Card';
import { CircularProgress } from './ui/CircularProgress';
import { ProgressBar } from './ui/ProgressBar';

export function TaskTrackingSection() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RotateCw size={18} className="text-accent2" />
          <h2 className="text-base font-bold text-white">Suivi des tâches</h2>
          <span className="rounded-full bg-surface2 px-2 py-0.5 text-xs font-semibold text-muted">4/12</span>
        </div>
        <ChevronRight size={18} className="text-muted" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted">Projet en cours</span>
            <ExternalLink size={15} className="text-muted" />
          </div>
          <div className="flex items-center gap-4">
            <CircularProgress progress={67} size={72} strokeWidth={7} gradientId="projectGradient" />
            <div>
              <p className="font-display text-2xl font-bold tabular-nums text-white">67%</p>
              <p className="text-xs text-muted">Avancement global</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <Calendar size={13} />
            21 sept. 2024
          </div>
          <button className="mt-1 flex items-center justify-center gap-1.5 rounded-xl bg-accent px-3 py-2.5 text-xs font-bold text-black">
            Démarrer maintenant
            <ExternalLink size={12} />
          </button>
        </Card>

        <Card className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted">Tâche du jour</span>
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-accent">
              <Zap size={13} className="text-black" />
            </div>
          </div>
          <div className="flex w-fit items-center gap-1 rounded-full bg-accent/20 px-2 py-1">
            <Flame size={12} className="text-accent2" />
            <span className="text-[11px] font-semibold text-accent2">Priorité haute</span>
          </div>
          <div>
            <p className="text-sm font-bold text-white">Refonte du réseau</p>
            <p className="text-xs text-muted">Design • Productivité</p>
          </div>
          <p className="font-display text-xl font-bold tabular-nums text-white">2/3</p>
          <ProgressBar progress={66} />
          <button className="mt-1 flex items-center justify-center gap-1.5 rounded-xl border border-border bg-surface2 px-3 py-2.5 text-xs font-bold text-white">
            Voir les détails
            <ExternalLink size={12} />
          </button>
        </Card>
      </div>

      <div className="flex items-center justify-between rounded-2xl bg-gradient-to-br from-accent2 to-accentDeep p-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/30 text-[10px] font-bold text-white">
              LJ
            </div>
            <span className="text-xs font-semibold text-white">lisan jone</span>
          </div>
          <p className="mt-1 text-sm font-bold text-white">Rejoins l'équipe pour les tâches de design !</p>
          <div className="mt-2 flex items-center gap-3">
            <AvatarStack labels={['A', 'B']} size={20} />
            <div className="flex items-center gap-1 text-[11px] text-white/90">
              <Calendar size={12} />
              23 sept. 2024
            </div>
          </div>
        </div>
        <ChevronRight size={20} className="text-white" />
      </div>
    </div>
  );
}
