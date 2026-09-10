import {
  BarChart3,
  Calendar,
  CheckCircle2,
  Crown,
  PenSquare,
  Settings,
  Target,
  Trophy,
  Undo2,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { assignments, goals } from '../data/dashboard';
import { AvatarStack } from './ui/Avatar';
import { Card } from './ui/Card';
import { CircularProgress } from './ui/CircularProgress';
import { ProgressBar } from './ui/ProgressBar';

const TABS = ['Mes tâches et objectifs', 'Points de contrôle', 'Historique de suivi'];
const ICON_ACTIONS = [Calendar, PenSquare, Users, Trophy, Settings];

const STATUS_STYLE: Record<string, string> = {
  'En cours': 'bg-emerald-500/20 text-emerald-400',
  'En attente': 'bg-accent/20 text-accent2',
};

export function AboutYouSection() {
  const [activeTab, setActiveTab] = useState(TABS[0]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Undo2 size={18} className="text-accent2" />
          <h2 className="text-base font-bold text-white">Tout sur vous</h2>
          <Crown size={15} className="text-accent2" />
        </div>
        <div className="flex gap-1.5">
          {ICON_ACTIONS.map((Icon, index) => (
            <button
              key={index}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-surface2 text-white hover:bg-surface"
            >
              <Icon size={14} />
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        {TABS.map((tab) => {
          const active = tab === activeTab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-full px-3.5 py-2 text-xs font-semibold transition-colors ${
                active ? 'bg-accent text-black' : 'bg-surface2 text-muted hover:text-white'
              }`}
            >
              {tab}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target size={16} className="text-accent2" />
              <h3 className="text-sm font-bold text-white">Objectif principal</h3>
            </div>
            <div className="flex gap-2">
              <span className="rounded-full bg-accent px-2.5 py-1 text-[10px] font-bold text-black">
                Maintenant
              </span>
              <span className="rounded-full bg-surface2 px-2.5 py-1 text-[10px] font-semibold text-muted">
                Progression
              </span>
            </div>
          </div>

          {goals.map((goal) => (
            <div key={goal.id} className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">{goal.title}</p>
                  <p className="text-xs text-muted">{goal.subtitle}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-display text-base font-bold tabular-nums text-white">{goal.progress}%</span>
                  <CheckCircle2 size={16} className="text-emerald-400" />
                </div>
              </div>
              <ProgressBar progress={goal.progress} />
            </div>
          ))}
        </Card>

        <Card className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-accent2" />
              <h3 className="text-sm font-bold text-white">Assignation équipe</h3>
            </div>
            <span className="text-xs text-muted">Tout l'équipe</span>
          </div>

          {assignments.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-2xl border border-border bg-surface2 p-3"
            >
              <AvatarStack labels={item.avatars} size={26} />
              <div className="flex-1">
                <p className="text-xs text-muted">
                  {item.code} · {item.duration}
                </p>
                <p className="text-sm font-semibold text-white">{item.title}</p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${STATUS_STYLE[item.status]}`}>
                {item.status}
              </span>
            </div>
          ))}

          <button className="rounded-2xl border border-dashed border-border py-3 text-xs font-semibold text-muted hover:text-white">
            + Nouvelle assignation
          </button>
        </Card>

        <Card className="flex flex-col items-center gap-3">
          <div className="flex w-full items-center gap-2">
            <BarChart3 size={16} className="text-accent2" />
            <h3 className="text-sm font-bold text-white">Progression globale</h3>
          </div>
          <CircularProgress progress={47} size={110} strokeWidth={11} gradientId="globalGradient" />
          <div className="flex flex-col items-center gap-1">
            <p className="text-xs text-muted">Délai</p>
            <p className="text-sm font-semibold text-white">56 min restantes</p>
          </div>
          <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-3 py-2.5 text-xs font-bold text-black">
            <CheckCircle2 size={14} />
            Marquer comme terminé
          </button>
        </Card>
      </div>
    </div>
  );
}
