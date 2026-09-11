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
            <tr className="border-b border-slate-200 bg-slate-50">
              {colonnes.map((colonne) => (
                <th key={colonne} className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {colonne}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lignes.map((ligne, index) => (
              <tr key={index} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                {ligne.map((cellule, cellIndex) => (
                  <td key={cellIndex} className="whitespace-nowrap px-4 py-3 text-slate-800">
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
    neutral: 'bg-slate-100 text-slate-600',
    success: 'bg-emerald-50 text-emerald-700',
    warning: 'bg-amber-50 text-amber-700',
    danger: 'bg-rose-50 text-rose-700',
  };
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${classes[tone]}`}>{children}</span>;
}
