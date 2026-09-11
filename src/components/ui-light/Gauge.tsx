/** Jauge circulaire à une seule teinte, sans dégradé. Reprise à l'identique
 * de Bdm/frontend (Components/ui/Gauge.jsx), la source réelle de l'identité
 * visuelle de Campagnes. */
export function Gauge({
  value,
  size = 120,
  stroke = 12,
  color = '#FF6A3A',
  label,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  label?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;

  return (
    <div className="relative inline-flex items-center justify-center" role="img" aria-label={`${label ?? 'Valeur'} : ${pct}%`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F1F1F1" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-xl font-semibold text-gray-900">{pct}%</span>
        {label && <span className="text-[11px] text-gray-500">{label}</span>}
      </div>
    </div>
  );
}
