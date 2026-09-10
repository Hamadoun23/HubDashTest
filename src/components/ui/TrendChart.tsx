import { useId, useState } from 'react';

/** Courbe de tendance à une série — aire + ligne, avec repère au survol.
 * Pas de légende : une série seule s'identifie par le titre de la carte qui
 * l'entoure (voir la règle du skill dataviz). */
export function TrendChart({
  donnees,
  hauteur = 160,
  formatValeur = (v: number) => String(v),
}: {
  donnees: { label: string; valeur: number }[];
  hauteur?: number;
  formatValeur?: (v: number) => string;
}) {
  const gradientId = useId();
  const [survol, setSurvol] = useState<number | null>(null);

  if (donnees.length === 0) {
    return <p className="text-xs text-muted">Pas encore de données.</p>;
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
            <stop offset="0%" stopColor="#ff6a2b" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#ff6a2b" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grille horizontale, discrète */}
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={marge.gauche}
            x2={largeur - marge.droite}
            y1={marge.haut + zoneH * f}
            y2={marge.haut + zoneH * f}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={1}
          />
        ))}

        <path d={aire} fill={`url(#${gradientId})`} />
        <path d={ligne} fill="none" stroke="#ff6a2b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

        {points.map((p, i) => (
          <g key={i}>
            {/* Cible de survol, plus large que le point visible */}
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
              <line x1={p.x} x2={p.x} y1={marge.haut} y2={marge.haut + zoneH} stroke="rgba(255,255,255,0.25)" strokeWidth={1} />
            )}
            <circle cx={p.x} cy={p.y} r={survol === i ? 4 : 3} fill="#ff6a2b" stroke="#1a130e" strokeWidth={1.5} />
            <text x={p.x} y={hauteur - 6} textAnchor="middle" className="fill-muted text-[9px]">
              {p.label}
            </text>
          </g>
        ))}
      </svg>

      {survol !== null && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-lg border border-border bg-surface2 px-2.5 py-1.5 text-xs shadow-lg"
          style={{ left: `${(points[survol].x / largeur) * 100}%`, top: `${(points[survol].y / hauteur) * 100 - 4}%` }}
        >
          <p className="font-semibold text-white">{formatValeur(points[survol].valeur)}</p>
          <p className="text-[10px] text-muted">{points[survol].label}</p>
        </div>
      )}
    </div>
  );
}
