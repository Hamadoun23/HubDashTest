import { useId } from 'react';

// Jauge circulaire — valeur unique sur fond neutre, une seule teinte par
// defaut (skill dataviz : sequentiel = une teinte, jamais un degrade
// arc-en-ciel). `gradient` est une variante optionnelle (deux arrets dans la
// meme famille de teinte, pas arc-en-ciel) pour les jauges de mise en avant —
// desactivee par defaut pour ne rien changer aux appels existants.
export default function Gauge({ value, size = 120, stroke = 12, color = '#d03e0d', gradient = false, label }) {
    const gradientId = useId();
    const pct = Math.max(0, Math.min(100, value));
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const offset = c - (pct / 100) * c;

    return (
        <div className="relative inline-flex items-center justify-center" role="img" aria-label={`${label ?? 'Valeur'} : ${pct}%`}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
                {gradient && (
                    <defs>
                        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#ff8a62" />
                            <stop offset="100%" stopColor="#a63209" />
                        </linearGradient>
                    </defs>
                )}
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#efeff0" strokeWidth={stroke} />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    fill="none"
                    stroke={gradient ? `url(#${gradientId})` : color}
                    strokeWidth={stroke}
                    strokeDasharray={c}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                />
            </svg>
            <div className="absolute flex flex-col items-center">
                <span className="text-xl font-semibold text-ardoise-900">{pct}%</span>
                {label && <span className="text-[11px] text-ardoise-500">{label}</span>}
            </div>
        </div>
    );
}
