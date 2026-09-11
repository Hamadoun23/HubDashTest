import type { LucideIcon } from 'lucide-react';
import { Card } from './Card';

export function StatTile({
  icon: Icon,
  valeur,
  libelle,
  teinte = '#334155',
}: {
  icon: LucideIcon;
  valeur: string | number;
  libelle: string;
  teinte?: string;
}) {
  return (
    <Card className="flex flex-col gap-2">
      <span
        className="flex h-8 w-8 items-center justify-center rounded-full"
        style={{ background: `${teinte}1f` }}
      >
        <Icon size={15} color={teinte} />
      </span>
      <p className="font-display text-xl font-bold tabular-nums text-slate-900">{valeur}</p>
      <p className="text-xs text-slate-500">{libelle}</p>
    </Card>
  );
}
