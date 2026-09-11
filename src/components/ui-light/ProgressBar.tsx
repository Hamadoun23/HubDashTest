/** Variante claire de ../ui/ProgressBar.tsx pour les apps métier — piste
 * claire, remplissage à la couleur de marque de l'app (accent). */
export function ProgressBar({
  progress,
  height = 8,
  accent = '#334155',
}: {
  progress: number;
  height?: number;
  accent?: string;
}) {
  const clamped = Math.max(0, Math.min(100, progress));
  return (
    <div style={{ height }} className="w-full overflow-hidden rounded-full bg-slate-200">
      <div style={{ width: `${clamped}%`, height: '100%', background: accent }} className="rounded-full" />
    </div>
  );
}
