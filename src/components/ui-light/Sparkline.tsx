/** Mini-graphique en barres, une seule teinte (série unique, pas de légende
 * nécessaire). Repris à l'identique de Bdm/frontend (Components/ui/Sparkline.jsx),
 * la source réelle de l'identité visuelle de Campagnes. */
export function Sparkline({ values, color = '#FF6A3A', height = 32 }: { values: number[]; color?: string; height?: number }) {
  if (!values || values.length === 0) return null;
  const max = Math.max(...values, 1);
  const barWidth = 5;
  const gap = 3;
  const width = values.length * (barWidth + gap) - gap;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Tendance sur ${values.length} périodes`}>
      <title>{values.join(', ')}</title>
      {values.map((v, i) => {
        const h = Math.max((v / max) * height, 2);
        const isLast = i === values.length - 1;
        return (
          <rect key={i} x={i * (barWidth + gap)} y={height - h} width={barWidth} height={h} rx={2} fill={color} opacity={isLast ? 1 : 0.35} />
        );
      })}
    </svg>
  );
}
