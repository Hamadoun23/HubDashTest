import type { LucideIcon } from 'lucide-react';

export function PageHeader({
  icon: Icon,
  titre,
  sousTitre,
  action,
}: {
  icon: LucideIcon;
  titre: string;
  sousTitre?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/20">
          <Icon size={18} className="text-accent2" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">{titre}</h1>
          {sousTitre ? <p className="text-xs text-muted">{sousTitre}</p> : null}
        </div>
      </div>
      {action}
    </div>
  );
}
