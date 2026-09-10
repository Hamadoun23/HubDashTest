export function ProgressBar({ progress, height = 8 }: { progress: number; height?: number }) {
  const clamped = Math.max(0, Math.min(100, progress));
  return (
    <div style={{ height }} className="w-full overflow-hidden rounded-full bg-surface2">
      <div
        style={{ width: `${clamped}%`, height: '100%' }}
        className="rounded-full bg-gradient-to-r from-accent2 to-accentDeep"
      />
    </div>
  );
}
