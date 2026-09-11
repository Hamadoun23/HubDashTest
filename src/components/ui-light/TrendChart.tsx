import { useId, useState } from 'react';

/** Variante claire de ../ui/TrendChart.tsx pour les apps métier — même
 * logique de tracé, couleur paramétrable (accent de marque de l'app), texte
 * et grille en tons clairs plutôt que sur fond sombre "Virtus". */
export function TrendChart({
  donnees,
  hauteur = 160,
  formatValeur = (v: number) => String(v),
  accent = '#334155',
}: {
  donnees: { label: string; valeur: number }[];
  hauteur?: number;
  formatValeur?: (v: number) => string;
  accent?: string;
}) {
  const gradientId = useId();
  const [survol, setSurvol] = useState<number | null>(null);

  if (donnees.length === 0) {
    return <p className="text-xs text-slate-500">Pas encore de données.</p>;
  }

  const largeur = 560;
  const marge = { haut: 12, bas: 24, gauche: 8, droite: 8 };
  const zoneL = largeur - marge.gauche - marge.droite;
  const zoneH = hauteur - marge.haut - marge.bas;

  const max = Math.max(...donnees.map((d) => d.valeur), 1);
  const min = Math.min(...donnees.map((d) => d.valeur), 0);
  const echelle = max - min || 1;

  const points = donnees.map((d, i) => {
    const x = marge.gauche + (donnees.length === 1 ? zoneL / 2 : (i / (donnees.length - 1)) * zoneL);
    const y = marge.haut + zoneH - ((d.valeur - min) / echelle) * zoneH;
    return { x, y, ...d };
  });

  const ligne = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const aire = `${ligne} L ${points[points.length - 1].x} ${marge.haut + zoneH} L ${points[0].x} ${marge.haut + zoneH} Z`;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${largeur} ${hauteur}`} className="w-full overflow-visible" preserveAspectRatio="none">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity="0.22" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={marge.gauche}
            x2={largeur - marge.droite}
            y1={marge.haut + zoneH * f}
            y2={marge.haut + zoneH * f}
            stroke="rgba(15,23,42,0.06)"
            strokeWidth={1}
          />
        ))}

        <path d={aire} fill={`url(#${gradientId})`} />
        <path d={ligne} fill="none" stroke={accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

        {points.map((p, i) => (
          <g key={i}>
            <rect
              x={p.x - zoneL / donnees.length / 2}
              y={0}
              width={zoneL / donnees.length}
              height={hauteur}
              fill="transparent"
              onMouseEnter={() => setSurvol(i)}
              onMouseLeave={() => setSurvol((s) => (s === i ? null : s))}
            />
            {survol === i && (
              <line x1={p.x} x2={p.x} y1={marge.haut} y2={marge.haut + zoneH} stroke="rgba(15,23,42,0.15)" strokeWidth={1} />
            )}
            <circle cx={p.x} cy={p.y} r={survol === i ? 4 : 3} fill={accent} stroke="#ffffff" strokeWidth={1.5} />
            <text x={p.x} y={hauteur - 6} textAnchor="middle" className="fill-slate-400 text-[9px]">
              {p.label}
            </text>
          </g>
        ))}
      </svg>

      {survol !== null && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs shadow-lg"
          style={{ left: `${(points[survol].x / largeur) * 100}%`, top: `${(points[survol].y / hauteur) * 100 - 4}%` }}
        >
          <p className="font-semibold text-slate-900">{formatValeur(points[survol].valeur)}</p>
          <p className="text-[10px] text-slate-500">{points[survol].label}</p>
        </div>
      )}
    </div>
  );
}
