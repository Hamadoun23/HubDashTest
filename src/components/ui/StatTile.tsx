import type { LucideIcon } from 'lucide-react';
import { Card } from './Card';

export function StatTile({
  icon: Icon,
  valeur,
  libelle,
  teinte = '#ff8a4c',
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
        style={{ background: `${teinte}26` }}
      >
        <Icon size={15} color={teinte} />
      </span>
      <p className="font-display text-xl font-bold tabular-nums text-white">{valeur}</p>
      <p className="text-xs text-muted">{libelle}</p>
    </Card>
  );
}
