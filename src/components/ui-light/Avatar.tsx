const PALETTE = ['#f59e0b', '#8b5cf6', '#10b981', '#3b82f6'];

function hashToIndex(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash + value.charCodeAt(i)) % PALETTE.length;
  return hash;
}

export function Avatar({ label, size = 28 }: { label: string; size?: number }) {
  const color = PALETTE[hashToIndex(label)];
  return (
    <div
      style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.36 }}
      className="flex items-center justify-center rounded-full border-2 border-white font-bold text-white"
    >
      {label.slice(0, 2).toUpperCase()}
    </div>
  );
}

export function AvatarStack({ labels, size = 24 }: { labels: string[]; size?: number }) {
  return (
    <div className="flex">
      {labels.map((label, index) => (
        <div key={label + index} style={{ marginLeft: index === 0 ? 0 : -size * 0.35 }}>
          <Avatar label={label} size={size} />
        </div>
      ))}
    </div>
  );
}
