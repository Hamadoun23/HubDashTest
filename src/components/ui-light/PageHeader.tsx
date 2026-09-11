import type { LucideIcon } from 'lucide-react';

export function PageHeader({
  icon: Icon,
  titre,
  sousTitre,
  action,
  accent = '#334155',
}: {
  icon: LucideIcon;
  titre: string;
  sousTitre?: string;
  action?: React.ReactNode;
  /** Couleur de marque de l'app courante (Jus, RH, Chantiers, Planning). */
  accent?: string;
}) {
  return (
    <div className="mb-6 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-2xl"
          style={{ background: `${accent}1f` }}
        >
          <Icon size={18} style={{ color: accent }} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">{titre}</h1>
          {sousTitre ? <p className="text-xs text-slate-500">{sousTitre}</p> : null}
        </div>
      </div>
      {action}
    </div>
  );
}
