import { BadgeCheck, Download, TrendingUp, Users } from 'lucide-react';
import { useState } from 'react';
import { statTiles } from '../data/dashboard';
import { PerformanceChart } from './PerformanceChart';
import { Card } from './ui/Card';

const TABS = ['Tout', 'Hebdo', 'Mensuel'];

const TILE_ICONS = {
  done: BadgeCheck,
  productivity: TrendingUp,
  realtime: Users,
} as const;

export function PerformanceSection() {
  const [activeTab, setActiveTab] = useState('Hebdo');

  return (
    <Card className="flex h-full flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white">Performance exceptionnelle</h2>
          <p className="mt-1 text-xs text-muted">
            ↗ Ton équipe est plus productive que la semaine dernière
          </p>
        </div>
        <div className="flex shrink-0 gap-1 rounded-full bg-surface2 p-1">
          {TABS.map((tab) => {
            const active = tab === activeTab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  active ? 'bg-accent text-black' : 'text-muted hover:text-white'
                }`}
              >
                {tab}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {statTiles.map((tile) => {
          const Icon = TILE_ICONS[tile.id];
          return (
            <div key={tile.id} className="flex flex-col gap-2 rounded-2xl border border-border bg-surface2 p-3">
              <div
                style={{ backgroundColor: `${tile.tint}26` }}
                className="flex h-8 w-8 items-center justify-center rounded-full"
              >
                <Icon size={15} color={tile.tint} />
              </div>
              <p className="font-display text-lg font-bold tabular-nums text-white">{tile.value}%</p>
              <p className="text-[11px] leading-tight text-muted">{tile.label}</p>
            </div>
          );
        })}
      </div>

      <PerformanceChart />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-accent" />
            <span className="text-[11px] text-muted">Performance élevée</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-muted" />
            <span className="text-[11px] text-muted">Bonne performance</span>
          </div>
        </div>
        <button className="flex h-8 w-8 items-center justify-center rounded-full bg-accent">
          <Download size={15} className="text-black" />
        </button>
      </div>
    </Card>
  );
}
