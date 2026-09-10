import { AlertTriangle, Loader2 } from 'lucide-react';
import { Card } from './Card';

export function EtatChargement({ texte = 'Chargement…' }: { texte?: string }) {
  return (
    <Card className="flex items-center justify-center gap-2 py-10 text-sm text-muted">
      <Loader2 size={16} className="animate-spin" />
      {texte}
    </Card>
  );
}

export function EtatErreur({ message, recharger }: { message: string; recharger?: () => void }) {
  return (
    <Card className="flex flex-col items-center gap-2 border-red-500/30 bg-red-500/5 py-10 text-center">
      <AlertTriangle size={20} className="text-red-400" />
      <p className="text-sm font-semibold text-white">Impossible de charger ces données</p>
      <p className="max-w-sm text-xs text-muted">{message}</p>
      {recharger ? (
        <button onClick={recharger} className="mt-2 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-white">
          Réessayer
        </button>
      ) : null}
    </Card>
  );
}
