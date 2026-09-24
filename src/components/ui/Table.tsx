import { Card } from './Card';

export function TableVirtus({
  colonnes,
  lignes,
  onRowClick,
}: {
  colonnes: string[];
  lignes: React.ReactNode[][];
  /** Rend toute la ligne cliquable (pas seulement une cellule) — utile quand chaque
   * ligne ouvre une fiche de détail. Sans cette prop, comportement inchangé. */
  onRowClick?: (index: number) => void;
}) {
  return (
    <Card className="overflow-hidden !p-0">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border">
              {colonnes.map((colonne, index) => (
                <th key={index} className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted">
                  {colonne}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lignes.map((ligne, index) => (
              <tr
                key={index}
                onClick={onRowClick ? () => onRowClick(index) : undefined}
                className={`border-b border-border/60 last:border-0 hover:bg-surface2/60 ${onRowClick ? 'cursor-pointer' : ''}`}
              >
                {ligne.map((cellule, cellIndex) => (
                  <td key={cellIndex} className="whitespace-nowrap px-4 py-3 text-white">
                    {cellule}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function Badge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'success' | 'warning' | 'danger' }) {
  const classes: Record<string, string> = {
    neutral: 'bg-surface2 text-muted',
    success: 'bg-emerald-500/15 text-emerald-400',
    warning: 'bg-accent/20 text-accent2',
    danger: 'bg-red-500/15 text-red-400',
  };
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${classes[tone]}`}>{children}</span>;
}
