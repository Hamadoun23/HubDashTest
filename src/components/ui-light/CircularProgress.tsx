export function CircularProgress({
  progress,
  size = 84,
  strokeWidth = 9,
  label,
  gradientId,
  accent = '#334155',
  accentClair = '#94a3b8',
}: {
  progress: number;
  size?: number;
  strokeWidth?: number;
  label?: React.ReactNode;
  gradientId: string;
  accent?: string;
  accentClair?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, progress));
  const offset = circumference * (1 - clamped / 100);
  const center = size / 2;

  return (
    <div style={{ width: size, height: size }} className="relative flex items-center justify-center">
      <svg width={size} height={size}>
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={accentClair} />
            <stop offset="100%" stopColor={accent} />
          </linearGradient>
        </defs>
        <circle cx={center} cy={center} r={radius} stroke="#e2e8f0" strokeWidth={strokeWidth} fill="none" />
        <circle
          cx={center}
          cy={center}
          r={radius}
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          fill="none"
          transform={`rotate(-90 ${center} ${center})`}
        />
      </svg>
      <div className="absolute flex items-center justify-center">
        <span className="font-display text-lg font-bold tabular-nums text-slate-900">
          {label ?? `${Math.round(clamped)}%`}
        </span>
      </div>
    </div>
  );
}
