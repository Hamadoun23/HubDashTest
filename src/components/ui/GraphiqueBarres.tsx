import { useState } from 'react';

type Serie = { nom: string; couleur: string; valeurs: number[] };

/** Graphique à barres groupées — jamais plus de deux séries à la fois pour
 * rester lisible (une par catégorie sinon). Traits fins, coins arrondis
 * uniquement en haut, jauge d'axe en pointillé fin, légende toujours visible
 * dès deux séries, infobulle au survol (valeur + catégorie + série). */
export function GraphiqueBarres({
  etiquettes,
  series,
  hauteur = 200,
}: {
  etiquettes: string[];
  series: Serie[];
  hauteur?: number;
}) {
  const [survol, setSurvol] = useState<{ cat: number; serie: number } | null>(null);
  const max = Math.max(1, ...series.flatMap((s) => s.valeurs));
  const paliers = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div>
      {series.length > 1 && (
        <div className="mb-3 flex flex-wrap items-center gap-4 text-[11px] text-muted">
          {series.map((s) => (
            <span key={s.nom} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm" style={{ background: s.couleur }} /> {s.nom}
            </span>
          ))}
        </div>
      )}

      <div className="relative" style={{ height: hauteur }}>
        {paliers.map((p) => (
          <div
            key={p}
            className="absolute left-0 right-0 border-t border-border/60"
            style={{ bottom: `${p * 100}%` }}
          />
        ))}

        <div className="relative flex h-full items-stretch gap-1.5">
          {etiquettes.map((etq, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="flex w-full flex-1 items-end justify-center gap-[3px]">
                {series.map((s, si) => {
                  const valeur = s.valeurs[i] ?? 0;
                  const pourcentage = (valeur / max) * 100;
                  const survole = survol?.cat === i && survol.serie === si;
                  return (
                    <div key={s.nom} className="relative flex h-full max-w-[18px] flex-1 items-end">
                      <div
                        onMouseEnter={() => setSurvol({ cat: i, serie: si })}
                        onMouseLeave={() => setSurvol(null)}
                        className={`w-full rounded-t-[4px] transition-opacity ${survole ? 'opacity-80' : ''}`}
                        style={{ height: `${Math.max(pourcentage, valeur > 0 ? 3 : 0)}%`, background: s.couleur, minHeight: valeur > 0 ? 2 : 0 }}
                      />
                      {survole && (
                        <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-lg border border-border bg-surface px-2 py-1 text-[11px] shadow-lg">
                          <span className="font-bold text-white">{valeur}</span> <span className="text-muted">{s.nom}</span>
                          <div className="text-[10px] text-muted">{etq}</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <span className="whitespace-nowrap text-[10px] text-muted">{etq}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
