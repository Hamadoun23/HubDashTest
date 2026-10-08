import { useMemo, useState } from 'react';
import { CalendarDays, Droplets, Package, PackageCheck, X } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { EtatChargement, EtatErreur } from '../../../components/ui/EtatRequete';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Badge, TableVirtus } from '../../../components/ui/Table';
import { useAction, useApi } from '../../../lib/hooks/useApi';
import {
  creerConditionnement,
  listerArticles,
  listerConditionnements,
  listerProductions,
  modifierConditionnement,
  supprimerConditionnement,
  type Conditionnement,
  type Production,
} from '../../../lib/api/jus';

const CHAMP = 'w-full rounded-xl border border-border bg-surface2 px-3 py-2 text-sm text-white focus:border-accent focus:outline-none';
const aujourdhui = () => new Date().toISOString().slice(0, 10);
const DATE = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
const DUREES = [30, 60, 90, 180];

type Cible = { production: Production; existant?: Conditionnement };

/**
 * Formulaire de mise en bouteille, prérempli : volume final de la production,
 * date du jour, durée de conservation du dernier conditionnement. Le total des
 * bouteilles est recalculé en direct pour le comparer au volume.
 */
function FormulaireConditionnement({
  cible,
  dureeParDefaut,
  stock33,
  stock1l,
  onFermer,
  onTermine,
}: {
  cible: Cible;
  dureeParDefaut: number;
  stock33: number | null;
  stock1l: number | null;
  onFermer: () => void;
  onTermine: () => void;
}) {
  const { production, existant } = cible;
  const creation = useAction(creerConditionnement);
  const modification = useAction(modifierConditionnement);
  const [date, setDate] = useState(existant?.date_cond ?? aujourdhui());
  const [volume, setVolume] = useState(String(existant?.volume_utilisee ?? production.volume_final_l ?? ''));
  const [qte33, setQte33] = useState(existant ? String(existant.qte_33cl) : '');
  const [qte1l, setQte1l] = useState(existant ? String(existant.qte_1l) : '');
  const [jours, setJours] = useState(String(existant?.nb_jours ?? dureeParDefaut));
  const [observation, setObservation] = useState(existant?.observation ?? `Mise en bouteille de ${production.numero_of}.`);

  const litres = (Number(qte33) || 0) * 0.33 + (Number(qte1l) || 0);
  const ecart = (Number(volume) || 0) - litres;
  const enCours = creation.enCours || modification.enCours;
  const erreur = creation.erreur ?? modification.erreur;

  async function envoyer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const payload = {
      production: production.id,
      date_cond: date,
      qte_33cl: Number(qte33) || 0,
      qte_1l: Number(qte1l) || 0,
      volume_utilisee: Number(volume),
      observation: observation.trim(),
      nb_jours: Number(jours),
    };
    try {
      if (existant) await modification.executer(existant.id, payload);
      else await creation.executer(payload);
      onTermine();
    } catch {
      /* erreur affichée */
    }
  }

  const stock = (n: number | null, demandes: number) =>
    n === null ? null : (
      <span className={`text-[11px] ${demandes > n ? 'font-semibold text-red-300' : 'text-muted'}`}>Stock bouteilles vides : {n}</span>
    );

  return (
    <form onSubmit={envoyer} className="space-y-3 rounded-2xl border border-border bg-surface2/60 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-white">{existant ? `Modifier ${existant.numero_cond}` : `Conditionner ${production.numero_of}`}</p>
          <p className="text-xs text-muted">
            {production.recette_display} · {production.volume_final_l ?? '—'} L produits
          </p>
        </div>
        <button type="button" onClick={onFermer} className="rounded-lg p-1 text-muted hover:text-white" aria-label="Fermer">
          <X size={16} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-muted">Date</span>
          <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={CHAMP} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-muted">Volume utilisé (L)</span>
          <input type="number" inputMode="decimal" step="any" min={0} required value={volume} onChange={(e) => setVolume(e.target.value)} className={CHAMP} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-muted">Bouteilles 33 cl</span>
          <input type="number" inputMode="numeric" min={0} value={qte33} onChange={(e) => setQte33(e.target.value)} placeholder="0" className={CHAMP} />
          {!existant && stock(stock33, Number(qte33) || 0)}
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-muted">Bouteilles 1 L</span>
          <input type="number" inputMode="numeric" min={0} value={qte1l} onChange={(e) => setQte1l(e.target.value)} placeholder="0" className={CHAMP} />
          {!existant && stock(stock1l, Number(qte1l) || 0)}
        </label>
      </div>
      <p className={`text-xs ${Math.abs(ecart) > 0.5 ? 'text-amber-300' : 'text-muted'}`}>
        Bouteilles : {litres.toFixed(2)} L — {Math.abs(ecart) <= 0.5 ? 'correspond au volume utilisé.' : ecart > 0 ? `il reste ${ecart.toFixed(2)} L non mis en bouteille.` : `${(-ecart).toFixed(2)} L de plus que le volume utilisé.`}
      </p>
      <div>
        <span className="mb-1 block text-xs font-semibold text-muted">Durée de conservation (DLC)</span>
        <div className="flex flex-wrap items-center gap-2">
          {DUREES.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setJours(String(d))}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${Number(jours) === d ? 'bg-accent text-black' : 'bg-surface2 text-muted hover:text-white'}`}
            >
              {d} jours
            </button>
          ))}
          <input type="number" min={1} required value={jours} onChange={(e) => setJours(e.target.value)} className="w-24 rounded-xl border border-border bg-surface2 px-3 py-1.5 text-sm text-white focus:border-accent focus:outline-none" aria-label="Nombre de jours" />
        </div>
      </div>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-muted">Observation</span>
        <textarea rows={2} required value={observation} onChange={(e) => setObservation(e.target.value)} className={`${CHAMP} resize-y`} />
      </label>
      {erreur && <p className="text-xs font-semibold text-red-400">{erreur}</p>}
      <button type="submit" disabled={enCours} className="rounded-xl bg-accent px-4 py-2 text-sm font-bold text-black disabled:opacity-60">
        {enCours ? 'Enregistrement…' : existant ? 'Enregistrer les modifications' : 'Valider le conditionnement'}
      </button>
    </form>
  );
}

/**
 * Conditionnements : les productions terminées et pas encore mises en
 * bouteille s'affichent en cartes, « Conditionner » ouvre le formulaire
 * prérempli. L'historique des conditionnements est en dessous.
 */
export default function Conditionnements() {
  const conditionnements = useApi(() => listerConditionnements(), []);
  const productions = useApi(() => listerProductions(), []);
  const articles = useApi(() => listerArticles(), []);
  const suppression = useAction(supprimerConditionnement);
  const [cible, setCible] = useState<Cible | null>(null);

  const aConditionner = useMemo(
    () => (productions.donnees ?? []).filter((p) => p.statut === 'TERMINEE' && !p.est_conditionnee).sort((a, b) => (a.date_of < b.date_of ? 1 : -1)),
    [productions.donnees],
  );
  const historique = conditionnements.donnees ?? [];
  const dureeParDefaut = historique.find((c) => c.nb_jours)?.nb_jours ?? 90;
  const stockDe = (type: string) => (articles.donnees ?? []).find((a) => a.type_art === type)?.qte_art ?? null;

  if ((conditionnements.chargement && !conditionnements.donnees) || (productions.chargement && !productions.donnees)) {
    return <EtatChargement texte="Chargement des conditionnements…" />;
  }
  if (conditionnements.erreur) return <EtatErreur message={conditionnements.erreur} recharger={conditionnements.recharger} />;

  function apresEnregistrement() {
    setCible(null);
    conditionnements.recharger();
    productions.recharger();
    articles.recharger();
  }

  async function supprimer(c: Conditionnement) {
    if (!window.confirm(`Supprimer définitivement ${c.numero_cond} ?`)) return;
    try {
      await suppression.executer(c.id);
      apresEnregistrement();
    } catch {
      /* erreur affichée */
    }
  }

  const formulaire = (c: Cible) => (
    <FormulaireConditionnement
      cible={c}
      dureeParDefaut={dureeParDefaut}
      stock33={stockDe('bouteille_vide_33cl')}
      stock1l={stockDe('bouteille_vide_1l')}
      onFermer={() => setCible(null)}
      onTermine={apresEnregistrement}
    />
  );

  return (
    <div>
      <PageHeader icon={Package} titre="Conditionnements" sousTitre="Mise en bouteille des productions terminées" />

      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-bold text-white">Prêtes à conditionner</h2>
        <span className="text-xs font-semibold text-muted">{aConditionner.length}</span>
      </div>
      {aConditionner.length === 0 ? (
        <Card className="mb-6 py-8 text-center text-sm text-muted">Aucune production terminée en attente de mise en bouteille.</Card>
      ) : (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {aConditionner.map((p) => {
            const ouverte = cible?.production.id === p.id && !cible.existant;
            return (
              <Card key={p.id} className={`flex flex-col gap-3 ${ouverte ? 'sm:col-span-2 xl:col-span-3' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-display text-base font-bold text-white">{p.numero_of}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                      <CalendarDays size={13} /> Produite le {DATE.format(new Date(p.date_of))}
                    </p>
                  </div>
                  <span className="rounded-full bg-accent/20 px-2.5 py-1 text-xs font-bold text-accent2">{p.recette_display}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="flex items-center gap-1 text-white">
                    <Droplets size={13} className="text-sky-300" /> {p.volume_final_l ?? '—'} L
                  </span>
                  {p.test_qualite_display && <Badge tone={p.test_qualite === 'CONFORME' ? 'success' : 'danger'}>{p.test_qualite_display}</Badge>}
                </div>
                {ouverte ? (
                  formulaire({ production: p })
                ) : (
                  <button
                    type="button"
                    onClick={() => setCible({ production: p })}
                    className="mt-auto flex items-center justify-center gap-2 rounded-xl bg-accent px-3 py-2.5 text-sm font-bold text-black"
                  >
                    <PackageCheck size={16} /> Conditionner
                  </button>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {cible?.existant && <div className="mb-4">{formulaire(cible)}</div>}

      <h2 className="mb-3 text-sm font-bold text-white">Historique des conditionnements</h2>
      <TableVirtus
        colonnes={['Référence', 'Production', 'Date', '33 cl', '1 L', 'DLC', '']}
        lignes={historique.map((c) => {
          const production = (productions.donnees ?? []).find((p) => p.id === c.production);
          return [
            c.numero_cond,
            c.production_numero,
            c.date_cond,
            c.qte_33cl,
            c.qte_1l,
            c.dlc,
            <div className="flex gap-3">
              {production && (
                <button type="button" onClick={() => setCible({ production, existant: c })} className="text-xs font-semibold text-accent2 hover:text-white">
                  Modifier
                </button>
              )}
              <button type="button" onClick={() => supprimer(c)} disabled={suppression.enCours} className="text-xs font-semibold text-red-400 hover:text-red-300 disabled:opacity-50">
                Supprimer
              </button>
            </div>,
          ];
        })}
      />
      {suppression.erreur && <p className="mt-3 text-xs font-semibold text-red-400">{suppression.erreur}</p>}
    </div>
  );
}
