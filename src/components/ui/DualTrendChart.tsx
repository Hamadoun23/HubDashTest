import { useId, useState } from 'react';

export type SerieChart = { nom: string; couleur: string; points: number[] };

/** Courbe à deux séries (comme TrendChart, mais sans aire, avec légende) —
 * pour comparer deux mesures sur le même axe des ordonnées (0-100%). */
export function DualTrendChart({
  labels,
  series,
  hauteur = 220,
}: {
  labels: string[];
  series: [SerieChart, SerieChart];
  hauteur?: number;
}) {
  const clipId = useId();
  const [survol, setSurvol] = useState<number | null>(null);

  if (labels.length === 0) {
    return <p className="text-xs text-muted">Pas encore de données.</p>;
  }

  const largeur = 700;
  const marge = { haut: 12, bas: 24, gauche: 32, droite: 8 };
  const zoneL = largeur - marge.gauche - marge.droite;
  const zoneH = hauteur - marge.haut - marge.bas;
  const max = 100;

  const xDe = (i: number) => marge.gauche + (labels.length === 1 ? zoneL / 2 : (i / (labels.length - 1)) * zoneL);
  const yDe = (v: number) => marge.haut + zoneH - (Math.max(0, Math.min(max, v)) / max) * zoneH;

  const chemin = (points: number[]) => points.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xDe(i)} ${yDe(v)}`).join(' ');

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${largeur} ${hauteur}`} className="w-full overflow-visible" preserveAspectRatio="none">
        <defs>
          <clipPath id={clipId}>
            <rect x={marge.gauche} y={0} width={zoneL} height={hauteur} />
          </clipPath>
        </defs>

        {[0, 25, 50, 75, 100].map((f) => (
          <g key={f}>
            <line x1={marge.gauche} x2={largeur - marge.droite} y1={yDe(f)} y2={yDe(f)} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
            <text x={0} y={yDe(f) + 3} className="fill-muted text-[9px]">
              {f}%
            </text>
          </g>
        ))}

        {series.map((s) => (
          <path key={s.nom} d={chemin(s.points)} fill="none" stroke={s.couleur} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        ))}

        {labels.map((label, i) => (
          <g key={label}>
            <rect
              x={xDe(i) - zoneL / labels.length / 2}
              y={0}
              width={zoneL / labels.length}
              height={hauteur}
              fill="transparent"
              onMouseEnter={() => setSurvol(i)}
              onMouseLeave={() => setSurvol((s) => (s === i ? null : s))}
            />
            {survol === i && <line x1={xDe(i)} x2={xDe(i)} y1={marge.haut} y2={marge.haut + zoneH} stroke="rgba(255,255,255,0.25)" strokeWidth={1} />}
            {series.map((s) => (
              <circle key={s.nom} cx={xDe(i)} cy={yDe(s.points[i])} r={survol === i ? 4 : 3} fill={s.couleur} stroke="#1a130e" strokeWidth={1.5} />
            ))}
            <text x={xDe(i)} y={hauteur - 4} textAnchor="middle" className="fill-muted text-[9px]">
              {label}
            </text>
          </g>
        ))}
      </svg>

      {survol !== null && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-lg border border-border bg-surface2 px-2.5 py-1.5 text-xs shadow-lg"
          style={{ left: `${(xDe(survol) / largeur) * 100}%`, top: `${(yDe(Math.max(...series.map((s) => s.points[survol]))) / hauteur) * 100 - 4}%` }}
        >
          {series.map((s) => (
            <p key={s.nom} className="font-semibold" style={{ color: s.couleur }}>
              {Math.round(s.points[survol])}%
            </p>
          ))}
        </div>
      )}

      <div className="mt-2 flex items-center gap-4">
        {series.map((s) => (
          <span key={s.nom} className="flex items-center gap-1.5 text-xs text-muted">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.couleur }} />
            {s.nom}
          </span>
        ))}
      </div>
    </div>
  );
}
