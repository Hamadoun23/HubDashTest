// Mini-graphique en barres, une seule teinte (pas de légende nécessaire :
// série unique). Voir skill dataviz — marks fins, coins arrondis ancrés à la
// base, pas de double axe.
export default function Sparkline({ values, color = '#FF6A3A', height = 32 }) {
    if (!values || values.length === 0) return null;
    const max = Math.max(...values, 1);
    const barWidth = 5;
    const gap = 3;
    const width = values.length * (barWidth + gap) - gap;

    return (
        <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label={`Tendance sur ${values.length} périodes, dernière valeur ${values[values.length - 1]}`}
        >
            <title>{values.join(', ')}</title>
            {values.map((v, i) => {
                const h = Math.max((v / max) * height, 2);
                const isLast = i === values.length - 1;
                return (
                    <rect
                        key={i}
                        x={i * (barWidth + gap)}
                        y={height - h}
                        width={barWidth}
                        height={h}
                        rx={2}
                        fill={color}
                        opacity={isLast ? 1 : 0.35}
                    />
                );
            })}
        </svg>
    );
}
