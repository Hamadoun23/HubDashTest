import type { HTMLAttributes } from 'react';

/**
 * Carte claire, utilisée par les 4 apps métier (Jus, RH, Chantiers,
 * Planning) — contrairement à ../ui/Card.tsx qui porte l'habillage sombre
 * "Virtus" réservé à la coquille du hub. Voir retrogradeAppmetier.md.
 */
export function Card({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}
      {...props}
    />
  );
}
