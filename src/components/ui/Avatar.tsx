import { useState } from 'react';
import { useAuth } from '../../lib/auth/AuthContext';
import { usePhoto } from '../../lib/photos';

const PALETTE = ['#ff8a4c', '#8b5cf6', '#34d399', '#60a5fa'];

function hashToIndex(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash + value.charCodeAt(i)) % PALETTE.length;
  return hash;
}

/**
 * Photo de profil si la personne en a une (passée en `photo`, ou retrouvée
 * par `email` / nom dans l'annuaire des photos du hub), sinon ses initiales.
 * `moi` : l'avatar de la personne connectée.
 */
export function Avatar({ label, size = 28, photo, email, moi }: { label: string; size?: number; photo?: string | null; email?: string | null; moi?: boolean }) {
  const { identite } = useAuth();
  const [enErreur, setEnErreur] = useState(false);
  const trouvee = usePhoto(moi ? identite?.email || identite?.identifiant : email, moi ? identite?.nom_complet : label);
  const source = (moi ? identite?.photo : photo) || trouvee;
  const color = PALETTE[hashToIndex(label)];
  if (source && !enErreur) {
    return (
      <img
        src={source}
        alt={label}
        onError={() => setEnErreur(true)}
        style={{ width: size, height: size }}
        className="shrink-0 rounded-full border-2 border-surface object-cover"
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.36 }}
      className="flex shrink-0 items-center justify-center rounded-full border-2 border-surface font-bold text-white"
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
