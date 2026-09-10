import { useEffect, useRef, useState } from 'react';
import { chartDays, goodPerformance, highPerformance } from '../data/dashboard';

const HEIGHT = 180;
const PADDING = 8;

function toPoints(values: number[], width: number) {
  const stepX = (width - PADDING * 2) / (values.length - 1);
  return values.map((value, index) => ({
    x: PADDING + index * stepX,
    y: PADDING + (HEIGHT - PADDING * 2) * (1 - value / 100),
  }));
}

function smoothPath(points: { x: number; y: number }[]) {
  if (points.length < 2) return '';
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const current = points[i];
    const next = points[i + 1];
    const midX = (current.x + next.x) / 2;
    path += ` C ${midX} ${current.y}, ${midX} ${next.y}, ${next.x} ${next.y}`;
  }
  return path;
}

export function PerformanceChart() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(560);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const highPoints = toPoints(highPerformance, width);
  const goodPoints = toPoints(goodPerformance, width);
  const peakIndex = highPerformance.indexOf(Math.max(...highPerformance));
  const peak = highPoints[peakIndex];

  return (
    <div ref={containerRef} className="relative w-full">
      <svg width={width} height={HEIGHT + 24}>
        <defs>
          <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ffb673" />
            <stop offset="100%" stopColor="#ff5a1f" />
          </linearGradient>
        </defs>

        {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
          const y = PADDING + (HEIGHT - PADDING * 2) * fraction;
          return (
            <line
              key={fraction}
              x1={PADDING}
              y1={y}
              x2={width - PADDING}
              y2={y}
              stroke="#2f2118"
              strokeWidth={1}
              strokeDasharray="4 6"
            />
          );
        })}

        <path d={smoothPath(goodPoints)} stroke="#5c5148" strokeWidth={2.5} fill="none" />
        <path d={smoothPath(highPoints)} stroke="url(#lineGradient)" strokeWidth={3} fill="none" />

        {highPoints.length > 0 && (
          <circle cx={peak.x} cy={peak.y} r={5} fill="#ff5a1f" stroke="#1a130e" strokeWidth={2} />
        )}

        {chartDays.map((day, index) => (
          <text
            key={day}
            x={PADDING + index * ((width - PADDING * 2) / (chartDays.length - 1))}
            y={HEIGHT + 16}
            fontSize={11}
            fill="#9a8b80"
            textAnchor="middle"
          >
            {day}
          </text>
        ))}
      </svg>

      {highPoints.length > 0 && (
        <div
          className="absolute rounded-lg bg-accentDeep px-2 py-1 font-display text-xs font-bold tabular-nums text-white shadow-lg"
          style={{ left: Math.min(Math.max(peak.x - 18, 0), width - 44), top: peak.y - 34 }}
        >
          85%
        </div>
      )}
    </div>
  );
}
