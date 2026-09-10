import { Card } from './Card';

export function TableVirtus({
  colonnes,
  lignes,
}: {
  colonnes: string[];
  lignes: React.ReactNode[][];
}) {
  return (
    <Card className="overflow-hidden !p-0">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border">
              {colonnes.map((colonne) => (
                <th key={colonne} className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted">
                  {colonne}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lignes.map((ligne, index) => (
              <tr key={index} className="border-b border-border/60 last:border-0 hover:bg-surface2/60">
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
