import { useMemo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Search, X } from 'lucide-react';
import { Card } from '../../../components/ui/Card';

/* Briques communes des pages d'analyse commerciale de Jus (clients, ventes,
   commandes, factures, paiements).
   Couleurs validées (dataviz/validate_palette.js, mode sombre, fond des
   cartes) : orange #e8590c et bleu #1c7ed6 ; balance âgée en une seule
   teinte, du clair au foncé, « non échu » en neutre. */
export const C_ORANGE = '#e8590c';
export const C_BLEU = '#1c7ed6';
export const C_NEUTRE = '#8a7f75';
export const TEINTES_AGE: Record<string, string> = { non_echu: C_NEUTRE, j0_30: '#fca5a5', j31_60: '#f87171', j61_90: '#dc2626', j90_plus: '#991b1b' };

const F = new Intl.NumberFormat('fr-FR');
export const fcfa = (v: number) => `${F.format(Math.round(v || 0))} F`;
export const nombre = (v: number) => F.format(Math.round(v || 0));
export const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
export const CHAMP = 'w-full rounded-xl border border-border bg-surface2 px-3 py-2.5 text-sm text-white placeholder:text-muted focus:border-accent focus:outline-none';
export const dateFr = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('fr-FR') : '—');

/** Les 12 derniers mois (AAAA-MM), du plus ancien au mois en cours. */
export function douzeMois(): string[] {
  const mois: string[] = [];
  const d = new Date();
  d.setDate(1);
  for (let i = 0; i < 12; i++) {
    mois.unshift(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    d.setMonth(d.getMonth() - 1);
  }
  return mois;
}

/** Somme par mois (AAAA-MM) d'une liste datée. */
export function parMois<T>(liste: T[], date: (x: T) => string | null | undefined, valeur: (x: T) => number, mois = douzeMois()): number[] {
  const tot = new Map<string, number>();
  for (const x of liste) {
    const d = date(x);
    if (!d) continue;
    const cle = d.slice(0, 7);
    tot.set(cle, (tot.get(cle) ?? 0) + valeur(x));
  }
  return mois.map((m) => tot.get(m) ?? 0);
}

/** Total par catégorie, trié décroissant, en gardant les `n` premières et « Autres ». */
export function parCategorie<T>(liste: T[], cle: (x: T) => string, valeur: (x: T) => number, n = 6) {
  const tot = new Map<string, number>();
  for (const x of liste) tot.set(cle(x) || '—', (tot.get(cle(x) || '—') ?? 0) + valeur(x));
  const tries = [...tot.entries()].sort((a, b) => b[1] - a[1]).map(([libelle, montant]) => ({ libelle, montant }));
  if (tries.length <= n) return tries;
  const autres = tries.slice(n - 1).reduce((s, l) => s + l.montant, 0);
  return [...tries.slice(0, n - 1), { libelle: 'Autres', montant: autres }];
}

/** Période d'analyse appliquée aux listes datées. */
export type Periode = 'mois' | 'trimestre' | 'annee' | 'tout';
export const PERIODES: { cle: Periode; libelle: string }[] = [
  { cle: 'mois', libelle: 'Ce mois' },
  { cle: 'trimestre', libelle: '3 mois' },
  { cle: 'annee', libelle: '12 mois' },
  { cle: 'tout', libelle: 'Tout' },
];
export function dansPeriode(iso: string | null | undefined, p: Periode) {
  if (p === 'tout' || !iso) return p === 'tout';
  const d = new Date(iso);
  const maintenant = new Date();
  if (p === 'mois') return d.getFullYear() === maintenant.getFullYear() && d.getMonth() === maintenant.getMonth();
  const jours = p === 'trimestre' ? 92 : 366;
  return maintenant.getTime() - d.getTime() <= jours * 86_400_000;
}

export function Tuile({ valeur, libelle, detail, ton }: { valeur: string; libelle: string; detail?: string; ton?: 'danger' | 'ok' }) {
  return (
    <Card className="flex flex-col gap-1">
      <p className={`truncate font-display text-xl font-bold ${ton === 'danger' ? 'text-red-300' : ton === 'ok' ? 'text-emerald-300' : 'text-white'}`}>{valeur}</p>
      <p className="text-xs text-muted">{libelle}</p>
      {detail && <p className="text-[11px] text-muted/80">{detail}</p>}
    </Card>
  );
}

export type Serie = { nom: string; couleur: string; valeurs: number[] };

/** Barres groupées par mois, un seul axe ; infobulle au survol ; légende dès 2 séries. */
export function GraphiqueMensuel({ titre, mois, series, format = fcfa, className = '' }: { titre: string; mois: string[]; series: Serie[]; format?: (v: number) => string; className?: string }) {
  const [survol, setSurvol] = useState<number | null>(null);
  const max = Math.max(1, ...series.flatMap((s) => s.valeurs));
  return (
    <Card className={className}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold text-white">{titre}</p>
        {series.length > 1 && (
          <div className="flex gap-4 text-xs text-muted">
            {series.map((s) => (
              <span key={s.nom} className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.couleur }} /> {s.nom}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="relative">
        <div className="flex h-44 items-end gap-1.5 border-b border-white/10 sm:gap-2" role="img" aria-label={titre}>
          {mois.map((m, i) => (
            <div key={m} className="relative flex h-full flex-1 items-end justify-center gap-[2px]" onMouseEnter={() => setSurvol(i)} onMouseLeave={() => setSurvol(null)}>
              {survol === i && <div className="absolute inset-0 rounded-md bg-white/5" />}
              {series.map((s) => (
                <div
                  key={s.nom}
                  className="rounded-t"
                  style={{ width: `${Math.min(14, 100 / series.length)}px`, height: `${(s.valeurs[i] / max) * 100}%`, background: s.couleur, minHeight: s.valeurs[i] ? 2 : 0 }}
                />
              ))}
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex gap-1.5 sm:gap-2">
          {mois.map((m) => (
            <span key={m} className="flex-1 text-center text-[10px] text-muted">{MOIS_COURTS[Number(m.slice(5, 7)) - 1]}</span>
          ))}
        </div>
        {survol !== null && (
          <div
            className="pointer-events-none absolute top-0 z-10 rounded-xl border border-border bg-[#1f1712] px-3 py-2 text-xs shadow-xl"
            style={{ left: `min(calc(${((survol + 0.5) / mois.length) * 100}% - 70px), calc(100% - 160px))` }}
          >
            <p className="mb-1 font-semibold text-white">{MOIS_COURTS[Number(mois[survol].slice(5, 7)) - 1]} {mois[survol].slice(0, 4)}</p>
            {series.map((s) => (
              <p key={s.nom} className="text-white/85">{s.nom} : {format(s.valeurs[survol])}</p>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

/** Barres horizontales (répartitions, classements). */
export function Barres({ titre, lignes, couleur, format = fcfa }: { titre: string; lignes: { libelle: string; montant: number; cle?: string }[]; couleur: (cle?: string, libelle?: string) => string; format?: (v: number) => string }) {
  const max = Math.max(1, ...lignes.map((l) => l.montant));
  const total = lignes.reduce((s, l) => s + l.montant, 0);
  return (
    <Card>
      <p className="mb-3 text-sm font-bold text-white">{titre}</p>
      {total === 0 ? (
        <p className="py-6 text-center text-xs text-muted">Rien à afficher.</p>
      ) : (
        <ul className="space-y-2.5">
          {lignes.map((l) => (
            <li key={l.cle ?? l.libelle} title={`${l.libelle} : ${format(l.montant)}`}>
              <div className="mb-1 flex justify-between gap-2 text-xs">
                <span className="truncate text-white/85">{l.libelle}</span>
                <span className="shrink-0 font-semibold text-white">{format(l.montant)}</span>
              </div>
              <div className="h-2 rounded-full bg-white/10">
                <div className="h-2 rounded-full" style={{ width: `${(l.montant / max) * 100}%`, background: couleur(l.cle, l.libelle), minWidth: l.montant ? 4 : 0 }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** Puces de choix (filtres, périodes). */
export function Puces<T extends string>({ options, valeur, onChange, compte }: { options: { cle: T; libelle: string }[]; valeur: T; onChange: (v: T) => void; compte?: (v: T) => number }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.cle}
          type="button"
          onClick={() => onChange(o.cle)}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${valeur === o.cle ? 'bg-accent text-black' : 'bg-surface2 text-muted hover:text-white'}`}
        >
          {o.libelle}
          {compte && <span className="opacity-70"> ({compte(o.cle)})</span>}
        </button>
      ))}
    </div>
  );
}

export function Recherche({ valeur, onChange, placeholder }: { valeur: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="relative w-full sm:max-w-sm">
      <Search size={15} className="pointer-events-none absolute left-3 top-3 text-muted" />
      <input value={valeur} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`${CHAMP} pl-9`} />
    </label>
  );
}

export type Colonne<T> = {
  cle: string;
  libelle: string;
  rendu: (x: T) => ReactNode;
  tri?: (x: T) => number | string;
  droite?: boolean;
};

/** Tableau triable par colonne ; ligne cliquable ; cartes sur téléphone (cf. index.css). */
export function TableTriable<T>({ lignes, colonnes, cle, triInitial, onLigne, vide = 'Aucun élément ne correspond.' }: { lignes: T[]; colonnes: Colonne<T>[]; cle: (x: T) => string | number; triInitial?: { cle: string; sens: 1 | -1 }; onLigne?: (x: T) => void; vide?: string }) {
  const [tri, setTri] = useState(triInitial ?? { cle: colonnes[0].cle, sens: 1 as 1 | -1 });
  const triees = useMemo(() => {
    const col = colonnes.find((c) => c.cle === tri.cle);
    if (!col?.tri) return lignes;
    const f = col.tri;
    return [...lignes].sort((a, b) => {
      const va = f(a);
      const vb = f(b);
      return (typeof va === 'string' && typeof vb === 'string' ? va.localeCompare(vb) : (va as number) - (vb as number)) * tri.sens;
    });
  }, [lignes, colonnes, tri]);
  return (
    <Card className="overflow-hidden !p-0">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {colonnes.map((c) => (
                <th key={c.cle} data-label={c.libelle} className={`whitespace-nowrap px-3 py-3 text-xs font-semibold uppercase tracking-wide text-muted ${c.droite ? 'text-right' : 'text-left'}`}>
                  {c.tri ? (
                    <button type="button" onClick={() => setTri((t) => ({ cle: c.cle, sens: t.cle === c.cle ? (t.sens === 1 ? -1 : 1) : -1 }))} className="inline-flex items-center gap-1 hover:text-white">
                      {c.libelle}
                      {tri.cle === c.cle && (tri.sens === 1 ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                    </button>
                  ) : (
                    c.libelle
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {triees.map((x) => (
              <tr key={cle(x)} onClick={onLigne ? () => onLigne(x) : undefined} className={`border-b border-border/60 last:border-0 hover:bg-surface2/60 ${onLigne ? 'cursor-pointer' : ''}`}>
                {colonnes.map((c) => (
                  <td key={c.cle} className={`px-3 py-3 ${c.droite ? 'text-right' : 'text-left'} text-white`}>
                    {c.rendu(x)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {triees.length === 0 && <p className="p-6 text-center text-sm text-muted">{vide}</p>}
    </Card>
  );
}

/** Panneau latéral de détail (droite sur ordinateur, plein écran sur téléphone). */
export function Panneau({ titre, sousTitre, onFermer, children }: { titre: string; sousTitre?: string; onFermer: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={titre}>
      <button type="button" aria-label="Fermer" className="absolute inset-0 bg-black/60" onClick={onFermer} />
      <div className="relative flex h-full w-full max-w-xl flex-col gap-4 overflow-y-auto border-l border-border bg-[#1f1712] p-5" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1.25rem)' }}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display text-xl font-bold text-white">{titre}</p>
            {sousTitre && <p className="text-sm text-muted">{sousTitre}</p>}
          </div>
          <button type="button" onClick={onFermer} className="rounded-full p-2 text-muted hover:text-white" aria-label="Fermer">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
