/** Camembert (donut) en CSS pur — `conic-gradient`, aucune dépendance de
 * graphique. Pensé pour de petites répartitions (statuts, catégories),
 * jamais pour des séries temporelles. */
export function DonutChart({
  segments,
  taille = 120,
}: {
  segments: { valeur: number; couleur: string; label: string }[];
  taille?: number;
}) {
  const total = segments.reduce((s, x) => s + x.valeur, 0);
  let cumul = 0;
  const degrades = segments
    .filter((s) => s.valeur > 0)
    .map((s) => {
      const debut = (cumul / (total || 1)) * 100;
      cumul += s.valeur;
      const fin = (cumul / (total || 1)) * 100;
      return `${s.couleur} ${debut}% ${fin}%`;
    });

  return (
    <div className="flex items-center gap-4">
      <div
        className="relative shrink-0 rounded-full"
        style={{
          width: taille,
          height: taille,
          background: degrades.length > 0 ? `conic-gradient(${degrades.join(', ')})` : '#e2e8f0',
        }}
      >
        <div
          className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-inner"
          style={{ width: taille * 0.62, height: taille * 0.62 }}
        >
          <span className="font-display text-base font-bold text-chantiers-marron">{total}</span>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        {segments.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: s.couleur }} />
            {s.label} <span className="font-semibold text-chantiers-marron">{s.valeur}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
