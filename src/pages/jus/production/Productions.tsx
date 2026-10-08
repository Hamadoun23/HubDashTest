import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Ban, CalendarDays, CheckCircle2, ChevronDown, ChevronUp, FlaskConical, Pencil, Plus, X } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { EtatChargement, EtatErreur } from '../../../components/ui/EtatRequete';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Badge, TableVirtus } from '../../../components/ui/Table';
import { useAction, useApi } from '../../../lib/hooks/useApi';
import {
  annulerProduction,
  completerProduction,
  creerProduction,
  formuleProduction,
  listerProductions,
  modifierProduction,
  type Production,
  type Recette,
} from '../../../lib/api/jus';

const RECETTES: { cle: Recette; libelle: string }[] = [
  { cle: 'R80_20', libelle: '80/20' },
  { cle: 'R75_25', libelle: '75/25' },
];
const VISIBLES = 5;
const CHAMP = 'w-full rounded-xl border border-border bg-surface2 px-3 py-2 text-sm text-white focus:border-accent focus:outline-none';
const aujourdhui = () => new Date().toISOString().slice(0, 10);
const DATE = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });

function echeance(dateIso: string) {
  const jours = Math.round((new Date(dateIso).getTime() - new Date(aujourdhui()).getTime()) / 86_400_000);
  if (jours === 0) return { texte: "Aujourd'hui", tone: 'warning' as const };
  if (jours > 0) return { texte: `Dans ${jours} j`, tone: 'neutral' as const };
  return { texte: `En attente depuis ${-jours} j`, tone: 'danger' as const };
}

/** Saisie des mesures, préremplie avec la formule de base de la recette (dernière production terminée). */
function FormulaireCompletion({ production, onTermine, onFermer }: { production: Production; onTermine: () => void; onFermer: () => void }) {
  const completion = useAction(completerProduction);
  const formule = useApi(() => formuleProduction(production.recette), [production.recette]);
  const [champs, setChamps] = useState({
    eau_ajoutee_l: '',
    sucre_ajoute_kg: '',
    sorbate_ajoute_g: '',
    ph: '',
    refractometre: '',
    volume_final_l: '',
    lavage_effectue: false,
    filtration_effectuee: false,
    pasteurisation_80c: false,
    test_qualite: 'CONFORME' as 'CONFORME' | 'NON_CONFORME',
  });

  useEffect(() => {
    const f = formule.donnees;
    if (!f?.reference) return;
    const v = (x: number | null | undefined) => (x === null || x === undefined ? '' : String(x));
    setChamps({
      eau_ajoutee_l: v(f.eau_ajoutee_l),
      sucre_ajoute_kg: v(f.sucre_ajoute_kg),
      sorbate_ajoute_g: v(f.sorbate_ajoute_g),
      ph: v(f.ph),
      refractometre: v(f.refractometre),
      volume_final_l: '',
      lavage_effectue: Boolean(f.lavage_effectue),
      filtration_effectuee: Boolean(f.filtration_effectuee),
      pasteurisation_80c: Boolean(f.pasteurisation_80c),
      test_qualite: 'CONFORME',
    });
  }, [formule.donnees]);

  async function envoyer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      await completion.executer(production.id, {
        ...champs,
        eau_ajoutee_l: Number(champs.eau_ajoutee_l),
        sucre_ajoute_kg: Number(champs.sucre_ajoute_kg),
        sorbate_ajoute_g: Number(champs.sorbate_ajoute_g),
        ph: Number(champs.ph),
        refractometre: Number(champs.refractometre),
        volume_final_l: Number(champs.volume_final_l),
      });
      onTermine();
    } catch {
      /* erreur affichée sous le formulaire */
    }
  }

  const nombre = (cle: 'eau_ajoutee_l' | 'sucre_ajoute_kg' | 'sorbate_ajoute_g' | 'ph' | 'refractometre' | 'volume_final_l', label: string, pas = 'any') => (
    <label key={cle} className="block">
      <span className="mb-1 block text-xs font-semibold text-muted">{label}</span>
      <input type="number" inputMode="decimal" step={pas} min={0} required value={champs[cle]} onChange={(e) => setChamps((c) => ({ ...c, [cle]: e.target.value }))} className={CHAMP} />
    </label>
  );
  const caseACocher = (cle: 'lavage_effectue' | 'filtration_effectuee' | 'pasteurisation_80c', label: string) => (
    <label key={cle} className="flex items-center gap-2 text-sm text-white">
      <input type="checkbox" checked={champs[cle]} onChange={(e) => setChamps((c) => ({ ...c, [cle]: e.target.checked }))} className="h-4 w-4 accent-accent" />
      {label}
    </label>
  );

  return (
    <form onSubmit={envoyer} className="space-y-3 rounded-2xl border border-border bg-surface2/60 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-white">Compléter {production.numero_of}</p>
          <p className="text-xs text-muted">
            {formule.donnees?.reference
              ? `Prérempli avec la formule de base ${production.recette_display} (dernière production : ${formule.donnees.reference}) — ajustez si besoin.`
              : 'Saisissez les mesures de la fabrication.'}
          </p>
        </div>
        <button type="button" onClick={onFermer} className="rounded-lg p-1 text-muted hover:text-white" aria-label="Fermer">
          <X size={16} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {nombre('eau_ajoutee_l', 'Eau ajoutée (L)')}
        {nombre('sucre_ajoute_kg', 'Sucre ajouté (kg)')}
        {nombre('sorbate_ajoute_g', 'Sorbate ajouté (g)')}
        {nombre('ph', 'pH (0 à 10)', '1')}
        {nombre('refractometre', 'Réfractomètre (0 à 20)', '1')}
        {nombre('volume_final_l', 'Volume final (L)')}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {caseACocher('lavage_effectue', 'Lavage effectué')}
        {caseACocher('filtration_effectuee', 'Filtration effectuée')}
        {caseACocher('pasteurisation_80c', 'Pasteurisation 80 °C')}
      </div>
      <label className="block max-w-xs">
        <span className="mb-1 block text-xs font-semibold text-muted">Test qualité</span>
        <select value={champs.test_qualite} onChange={(e) => setChamps((c) => ({ ...c, test_qualite: e.target.value as 'CONFORME' | 'NON_CONFORME' }))} className={CHAMP}>
          <option value="CONFORME" className="bg-[#1a130e]">Conforme</option>
          <option value="NON_CONFORME" className="bg-[#1a130e]">Non conforme</option>
        </select>
      </label>
      {completion.erreur && <p className="text-xs font-semibold text-red-400">{completion.erreur}</p>}
      <button type="submit" disabled={completion.enCours} className="rounded-xl bg-accent px-4 py-2 text-sm font-bold text-black disabled:opacity-60">
        {completion.enCours ? 'Enregistrement…' : 'Marquer comme terminée'}
      </button>
    </form>
  );
}

type Mode = { type: 'completer' | 'modifier' | 'annuler'; id: number } | null;

/** Carte d'une production à compléter : date, recette, échéance, actions. */
function CarteProduction({ p, mode, setMode, onChange }: { p: Production; mode: Mode; setMode: (m: Mode) => void; onChange: () => void }) {
  const modification = useAction(modifierProduction);
  const annulation = useAction(annulerProduction);
  const [date, setDate] = useState(p.date_of);
  const [recette, setRecette] = useState<Recette>(p.recette);
  const [motif, setMotif] = useState('');
  const actif = mode?.id === p.id ? mode.type : null;
  const e = echeance(p.date_of);

  return (
    <Card className={`flex flex-col gap-3 ${actif ? 'sm:col-span-2 xl:col-span-3' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-display text-base font-bold text-white">{p.numero_of}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
            <CalendarDays size={13} /> {DATE.format(new Date(p.date_of))}
          </p>
        </div>
        <span className="rounded-full bg-accent/20 px-2.5 py-1 text-xs font-bold text-accent2">{p.recette_display}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={e.tone}>{e.texte}</Badge>
        {p.cree_par_nom && <span className="text-xs text-muted">Lancée par {p.cree_par_nom}</span>}
      </div>

      {!actif && (
        <div className="mt-auto grid grid-cols-3 gap-2">
          <button type="button" onClick={() => setMode({ type: 'completer', id: p.id })} className="flex items-center justify-center gap-1.5 rounded-xl bg-accent px-2 py-2 text-xs font-bold text-black">
            <CheckCircle2 size={14} /> Compléter
          </button>
          <button type="button" onClick={() => setMode({ type: 'modifier', id: p.id })} className="flex items-center justify-center gap-1.5 rounded-xl border border-border px-2 py-2 text-xs font-semibold text-white hover:bg-surface2">
            <Pencil size={13} /> Modifier
          </button>
          <button type="button" onClick={() => setMode({ type: 'annuler', id: p.id })} className="flex items-center justify-center gap-1.5 rounded-xl border border-red-400/40 px-2 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/10">
            <Ban size={13} /> Annuler
          </button>
        </div>
      )}

      {actif === 'completer' && (
        <FormulaireCompletion
          production={p}
          onFermer={() => setMode(null)}
          onTermine={() => {
            setMode(null);
            onChange();
          }}
        />
      )}

      {actif === 'modifier' && (
        <form
          onSubmit={async (ev) => {
            ev.preventDefault();
            try {
              await modification.executer(p.id, { date_of: date, recette });
              setMode(null);
              onChange();
            } catch {
              /* erreur affichée */
            }
          }}
          className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-surface2/60 p-4"
        >
          <label>
            <span className="mb-1 block text-xs font-semibold text-muted">Date de production</span>
            <input type="date" required value={date} onChange={(ev) => setDate(ev.target.value)} className={CHAMP} />
          </label>
          <label>
            <span className="mb-1 block text-xs font-semibold text-muted">Recette</span>
            <select value={recette} onChange={(ev) => setRecette(ev.target.value as Recette)} className={CHAMP}>
              {RECETTES.map((r) => (
                <option key={r.cle} value={r.cle} className="bg-[#1a130e]">{r.libelle}</option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={modification.enCours} className="rounded-xl bg-accent px-4 py-2 text-sm font-bold text-black disabled:opacity-60">Enregistrer</button>
          <button type="button" onClick={() => setMode(null)} className="rounded-xl px-3 py-2 text-sm text-muted hover:text-white">Fermer</button>
          {modification.erreur && <p className="w-full text-xs font-semibold text-red-400">{modification.erreur}</p>}
        </form>
      )}

      {actif === 'annuler' && (
        <form
          onSubmit={async (ev) => {
            ev.preventDefault();
            try {
              await annulation.executer(p.id, motif.trim());
              setMode(null);
              onChange();
            } catch {
              /* erreur affichée */
            }
          }}
          className="space-y-2 rounded-2xl border border-red-400/30 bg-red-500/5 p-4"
        >
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted">Justification de l'annulation (obligatoire) — la Direction sera prévenue</span>
            <textarea required rows={3} value={motif} onChange={(ev) => setMotif(ev.target.value)} placeholder="Ex. : panne de la pasteurisatrice, oranges non conformes…" className={`${CHAMP} resize-y`} />
          </label>
          {annulation.erreur && <p className="text-xs font-semibold text-red-400">{annulation.erreur}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={annulation.enCours || !motif.trim()} className="rounded-xl bg-red-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Confirmer l'annulation</button>
            <button type="button" onClick={() => setMode(null)} className="rounded-xl px-3 py-2 text-sm text-muted hover:text-white">Fermer</button>
          </div>
        </form>
      )}
    </Card>
  );
}

/**
 * Productions : on programme une production à une date (recette de base), puis
 * on vient la compléter avec les mesures. Les productions à compléter sont en
 * cartes (les 5 plus récentes, « Voir plus » pour les autres) ; l'historique
 * (terminées, annulées avec leur motif) est en dessous. La Direction est
 * prévenue de chaque production programmée, terminée ou annulée.
 */
export default function Productions() {
  const productions = useApi(() => listerProductions(), []);
  const creation = useAction(creerProduction);
  const [nouvelle, setNouvelle] = useState(false);
  const [date, setDate] = useState(aujourdhui());
  const [recette, setRecette] = useState<Recette>('R80_20');
  const [mode, setMode] = useState<Mode>(null);
  const [tout, setTout] = useState(false);

  const liste = productions.donnees ?? [];
  const aCompleter = useMemo(
    () => liste.filter((p) => p.statut === 'EN_COURS').sort((a, b) => (a.date_of < b.date_of ? 1 : -1)),
    [liste],
  );
  const historique = useMemo(() => liste.filter((p) => p.statut !== 'EN_COURS').sort((a, b) => (a.date_of < b.date_of ? 1 : -1)), [liste]);

  if (productions.chargement && !productions.donnees) return <EtatChargement texte="Chargement des productions…" />;
  if (productions.erreur) return <EtatErreur message={productions.erreur} recharger={productions.recharger} />;

  async function programmer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      await creation.executer({ date_of: date, recette });
      setNouvelle(false);
      setDate(aujourdhui());
      productions.recharger();
    } catch {
      /* erreur affichée */
    }
  }

  const visibles = tout ? aCompleter : aCompleter.slice(0, VISIBLES);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader icon={FlaskConical} titre="Productions" sousTitre="Programmer une production, puis la compléter" />
        <button type="button" onClick={() => setNouvelle((v) => !v)} className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-black">
          <Plus size={16} /> Nouvelle production
        </button>
      </div>

      {nouvelle && (
        <Card className="mb-5">
          <form onSubmit={programmer} className="space-y-4">
            <p className="text-sm font-bold text-white">Programmer une production</p>
            <div>
              <span className="mb-2 block text-xs font-semibold text-muted">Formule de base</span>
              <div className="grid grid-cols-2 gap-2 sm:max-w-md">
                {RECETTES.map((r) => (
                  <button
                    key={r.cle}
                    type="button"
                    onClick={() => setRecette(r.cle)}
                    className={`rounded-2xl border px-4 py-3 text-left ${recette === r.cle ? 'border-accent bg-accent/15' : 'border-border bg-surface2 hover:border-white/30'}`}
                  >
                    <p className="font-display text-lg font-bold text-white">{r.libelle}</p>
                    <p className="text-xs text-muted">Recette {r.libelle}</p>
                  </button>
                ))}
              </div>
            </div>
            <label className="block max-w-xs">
              <span className="mb-1 block text-xs font-semibold text-muted">Date de production</span>
              <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={CHAMP} />
            </label>
            <p className="text-xs text-muted">Les mesures (eau, sucre, sorbate, pH…) se saisissent en complétant la production ; elles seront préremplies avec la dernière production de la même recette.</p>
            {creation.erreur && <p className="text-xs font-semibold text-red-400">{creation.erreur}</p>}
            <div className="flex gap-2">
              <button type="submit" disabled={creation.enCours} className="rounded-xl bg-accent px-4 py-2 text-sm font-bold text-black disabled:opacity-60">
                {creation.enCours ? 'Programmation…' : 'Programmer'}
              </button>
              <button type="button" onClick={() => setNouvelle(false)} className="rounded-xl px-3 py-2 text-sm text-muted hover:text-white">Fermer</button>
            </div>
          </form>
        </Card>
      )}

      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-bold text-white">À compléter</h2>
        <span className="text-xs font-semibold text-muted">{aCompleter.length}</span>
      </div>
      {aCompleter.length === 0 ? (
        <Card className="mb-6 py-8 text-center text-sm text-muted">Aucune production à compléter.</Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visibles.map((p) => (
              <CarteProduction key={p.id} p={p} mode={mode} setMode={setMode} onChange={productions.recharger} />
            ))}
          </div>
          {aCompleter.length > VISIBLES && (
            <button type="button" onClick={() => setTout((v) => !v)} className="mx-auto mt-4 flex items-center gap-1.5 rounded-xl border border-border bg-surface2 px-4 py-2 text-sm font-semibold text-white hover:bg-surface">
              {tout ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              {tout ? 'Voir moins' : `Voir plus (${aCompleter.length - VISIBLES} autres à compléter)`}
            </button>
          )}
        </>
      )}

      <h2 className="mb-3 mt-8 text-sm font-bold text-white">Historique</h2>
      <TableVirtus
        colonnes={['Référence', 'Recette', 'Date', 'Volume', 'Qualité', 'Statut', 'Détail']}
        lignes={historique.map((p) => [
          p.numero_of,
          p.recette_display,
          p.date_of,
          p.volume_final_l ? `${p.volume_final_l} L` : '—',
          p.test_qualite_display || '—',
          <Badge tone={p.statut === 'TERMINEE' ? 'success' : 'danger'}>{p.statut_display}</Badge>,
          p.statut === 'ANNULLEE' ? (
            <span className="block max-w-[18rem] whitespace-normal text-xs text-muted">
              {p.motif_annulation || 'Sans motif'}
              {p.annulee_par_nom ? ` — ${p.annulee_par_nom}` : ''}
            </span>
          ) : p.est_conditionnee ? (
            'Conditionnée'
          ) : p.statut === 'TERMINEE' ? (
            <Link to="/jus/production/conditionnements" className="text-xs font-semibold text-accent2 hover:text-white">
              À conditionner →
            </Link>
          ) : (
            '—'
          ),
        ])}
      />
    </div>
  );
}
