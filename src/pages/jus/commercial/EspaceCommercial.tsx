import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Banknote, Check, ChevronRight, Minus, Plus, Search, ShoppingCart, Store, Truck, UserPlus, Wallet, X } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { EtatChargement, EtatErreur } from '../../../components/ui/EtatRequete';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Badge } from '../../../components/ui/Table';
import { useAction, useApi } from '../../../lib/hooks/useApi';
import {
  completerCommande,
  creerClient,
  creerCommande,
  listerArticles,
  listerClients,
  listerCommandes,
  listerFactures,
  listerVentes,
  payerFacture,
  supprimerCommande,
  type Client,
  type Commande,
  type Facture,
  type ModePaie,
  type StatutPaiement,
} from '../../../lib/api/jus';

const CHAMP = 'w-full rounded-xl border border-border bg-surface2 px-3 py-2.5 text-sm text-white placeholder:text-muted focus:border-accent focus:outline-none';
const F = new Intl.NumberFormat('fr-FR');
const fcfa = (v: number) => `${F.format(Math.round(v))} F`;
const aujourdhui = () => new Date().toISOString().slice(0, 10);

const PAIEMENTS: { cle: StatutPaiement; libelle: string; aide: string }[] = [
  { cle: 'ACHAT_VENTE', libelle: 'Payé comptant', aide: 'Le client paie tout maintenant' },
  { cle: 'PARTIELLE', libelle: 'Acompte', aide: 'Le client paie une partie' },
  { cle: 'DEPOT_VENTE', libelle: 'Dépôt-vente', aide: 'Le client paiera plus tard' },
];
const MODES: { cle: ModePaie; libelle: string }[] = [
  { cle: 'ESPECE', libelle: 'Espèces' },
  { cle: 'MOBILE', libelle: 'Mobile money' },
  { cle: 'VIREMENT', libelle: 'Virement' },
  { cle: 'CHEQUE', libelle: 'Chèque' },
];

function Puces<T extends string>({ options, valeur, onChange }: { options: { cle: T; libelle: string }[]; valeur: T; onChange: (v: T) => void }) {
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
        </button>
      ))}
    </div>
  );
}

function Quantite({ libelle, valeur, onChange, prix, stock }: { libelle: string; valeur: number; onChange: (v: number) => void; prix: number; stock: number | null }) {
  const trop = stock !== null && valeur > stock;
  return (
    <div className="rounded-2xl border border-border bg-surface2/60 p-3">
      <p className="text-xs font-semibold text-muted">{libelle}</p>
      <div className="mt-2 flex items-center gap-2">
        <button type="button" onClick={() => onChange(Math.max(0, valeur - 1))} className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface2 text-white" aria-label="Moins">
          <Minus size={16} />
        </button>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={valeur || ''}
          placeholder="0"
          onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
          className="w-full rounded-xl border border-border bg-surface px-2 py-2 text-center font-display text-lg font-bold text-white focus:border-accent focus:outline-none"
        />
        <button type="button" onClick={() => onChange(valeur + 1)} className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface2 text-white" aria-label="Plus">
          <Plus size={16} />
        </button>
      </div>
      <p className={`mt-1.5 text-[11px] ${trop ? 'font-semibold text-red-300' : 'text-muted'}`}>
        {prix ? `${fcfa(prix)} l'unité` : 'Prix non paramétré'} · {stock === null ? '—' : `${stock} en stock`}
      </p>
    </div>
  );
}

/** Choix du client : recherche instantanée, ou création sur place. */
function ChoixClient({ clients, valeur, onChange, onCree }: { clients: Client[]; valeur: Client | null; onChange: (c: Client | null) => void; onCree: () => void }) {
  const [recherche, setRecherche] = useState('');
  const [ouvert, setOuvert] = useState(false);
  const [nouveau, setNouveau] = useState(false);
  const [nom, setNom] = useState('');
  const [tel, setTel] = useState('');
  const creation = useAction(creerClient);

  const resultats = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return clients.filter((c) => !q || c.nom_complet.toLowerCase().includes(q) || c.tel_client.includes(q)).slice(0, 8);
  }, [clients, recherche]);

  if (valeur) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-xl border border-accent/50 bg-accent/10 px-3 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-white">{valeur.nom_complet}</p>
          <p className="text-xs text-muted">{valeur.tel_client || 'Sans téléphone'}</p>
        </div>
        <button type="button" onClick={() => onChange(null)} className="rounded-lg px-2 py-1 text-xs font-semibold text-accent2 hover:text-white">
          Changer
        </button>
      </div>
    );
  }

  if (nouveau) {
    return (
      <div className="space-y-2 rounded-2xl border border-border bg-surface2/60 p-3">
        <p className="text-xs font-semibold text-muted">Nouveau client</p>
        <input autoFocus value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom du client ou de la boutique" className={CHAMP} />
        <input value={tel} onChange={(e) => setTel(e.target.value)} placeholder="Téléphone" type="tel" inputMode="tel" className={CHAMP} />
        {creation.erreur && <p className="text-xs font-semibold text-red-400">{creation.erreur}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!nom.trim() || creation.enCours}
            onClick={async () => {
              try {
                const c = await creation.executer({ nom_complet: nom.trim(), tel_client: tel.trim() });
                onChange(c);
                onCree();
                setNouveau(false);
              } catch {
                /* erreur affichée */
              }
            }}
            className="rounded-xl bg-accent px-4 py-2 text-sm font-bold text-black disabled:opacity-50"
          >
            Créer le client
          </button>
          <button type="button" onClick={() => setNouveau(false)} className="rounded-xl px-3 py-2 text-sm text-muted hover:text-white">
            Annuler
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <Search size={15} className="pointer-events-none absolute left-3 top-3.5 text-muted" />
      <input
        value={recherche}
        onChange={(e) => {
          setRecherche(e.target.value);
          setOuvert(true);
        }}
        onFocus={() => setOuvert(true)}
        placeholder="Rechercher un client (nom ou téléphone)…"
        className={`${CHAMP} pl-9`}
      />
      {ouvert && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-2xl border border-border bg-[#1f1712] shadow-2xl">
          {resultats.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                onChange(c);
                setOuvert(false);
                setRecherche('');
              }}
              className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm hover:bg-surface2"
            >
              <span className="truncate text-white">{c.nom_complet}</span>
              <span className="shrink-0 text-xs text-muted">{c.tel_client}</span>
            </button>
          ))}
          {resultats.length === 0 && <p className="px-3 py-2.5 text-sm text-muted">Aucun client trouvé.</p>}
          <button
            type="button"
            onClick={() => {
              setNouveau(true);
              setNom(recherche);
              setOuvert(false);
            }}
            className="flex w-full items-center gap-2 border-t border-border px-3 py-2.5 text-left text-sm font-semibold text-accent2 hover:bg-surface2"
          >
            <UserPlus size={15} /> Nouveau client{recherche.trim() ? ` « ${recherche.trim()} »` : ''}
          </button>
        </div>
      )}
    </div>
  );
}

/** Mode de règlement au moment de livrer et facturer. */
export function Reglement({ montant, statut, setStatut, acompte, setAcompte }: { montant: number; statut: StatutPaiement; setStatut: (s: StatutPaiement) => void; acompte: string; setAcompte: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-3">
        {PAIEMENTS.map((p) => (
          <button
            key={p.cle}
            type="button"
            onClick={() => setStatut(p.cle)}
            className={`rounded-2xl border px-3 py-2.5 text-left ${statut === p.cle ? 'border-accent bg-accent/15' : 'border-border bg-surface2 hover:border-white/30'}`}
          >
            <p className="text-sm font-bold text-white">{p.libelle}</p>
            <p className="text-[11px] text-muted">{p.aide}</p>
          </button>
        ))}
      </div>
      {statut === 'PARTIELLE' && (
        <label className="block max-w-xs">
          <span className="mb-1 block text-xs font-semibold text-muted">Montant de l'acompte (sur {fcfa(montant)})</span>
          <input type="number" inputMode="numeric" min={1} max={montant} required value={acompte} onChange={(e) => setAcompte(e.target.value)} className={CHAMP} />
        </label>
      )}
    </div>
  );
}

export function CarteCommande({ c, onChange }: { c: Commande; onChange: () => void }) {
  const [ouverte, setOuverte] = useState(false);
  const [statut, setStatut] = useState<StatutPaiement>('ACHAT_VENTE');
  const [acompte, setAcompte] = useState('');
  const livraison = useAction(completerCommande);
  const suppression = useAction(supprimerCommande);
  const [message, setMessage] = useState('');

  return (
    <Card className={`flex flex-col gap-3 ${ouverte ? 'sm:col-span-2 xl:col-span-3' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-display text-base font-bold text-white">{c.client_nom}</p>
          <p className="text-xs text-muted">Commande du {new Date(c.date_cmd).toLocaleDateString('fr-FR')}</p>
        </div>
        <span className="shrink-0 font-display text-base font-bold text-accent2">{fcfa(c.total)}</span>
      </div>
      <div className="flex gap-2 text-xs">
        {c.quantite_33cl > 0 && <span className="rounded-full bg-surface2 px-2.5 py-1 font-semibold text-white">{c.quantite_33cl} × 33 cl</span>}
        {c.quantite_1l > 0 && <span className="rounded-full bg-surface2 px-2.5 py-1 font-semibold text-white">{c.quantite_1l} × 1 L</span>}
      </div>
      {!ouverte ? (
        <div className="mt-auto flex gap-2">
          <button type="button" onClick={() => setOuverte(true)} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-3 py-2.5 text-sm font-bold text-black">
            <Truck size={16} /> Livrer & facturer
          </button>
          <button
            type="button"
            title="Supprimer la commande"
            disabled={suppression.enCours}
            onClick={async () => {
              if (!window.confirm(`Supprimer la commande de ${c.client_nom} ?`)) return;
              try {
                await suppression.executer(c.id);
                onChange();
              } catch {
                /* erreur affichée */
              }
            }}
            className="rounded-xl border border-red-400/40 px-3 text-red-300 hover:bg-red-500/10"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              const r = await livraison.executer(c.id, { statut_paiement: statut, montant_paye: statut === 'PARTIELLE' ? Number(acompte) : undefined });
              setMessage(r.detail);
              setOuverte(false);
              onChange();
            } catch {
              /* erreur affichée */
            }
          }}
          className="space-y-3 rounded-2xl border border-border bg-surface2/60 p-4"
        >
          <p className="text-sm font-bold text-white">Comment le client règle-t-il ?</p>
          <Reglement montant={c.total} statut={statut} setStatut={setStatut} acompte={acompte} setAcompte={setAcompte} />
          <p className="text-xs text-muted">Les bouteilles sortent du stock (DLC la plus proche d'abord), la vente et la facture sont créées.</p>
          {livraison.erreur && <p className="text-xs font-semibold text-red-400">{livraison.erreur}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={livraison.enCours} className="rounded-xl bg-accent px-4 py-2 text-sm font-bold text-black disabled:opacity-60">
              {livraison.enCours ? 'Enregistrement…' : 'Valider la livraison'}
            </button>
            <button type="button" onClick={() => setOuverte(false)} className="rounded-xl px-3 py-2 text-sm text-muted hover:text-white">
              Fermer
            </button>
          </div>
        </form>
      )}
      {message && <p className="text-xs font-semibold text-emerald-300">{message}</p>}
      {suppression.erreur && <p className="text-xs font-semibold text-red-400">{suppression.erreur}</p>}
    </Card>
  );
}

export function CarteFacture({ f, onChange }: { f: Facture; onChange: () => void }) {
  const [ouverte, setOuverte] = useState(false);
  const [montant, setMontant] = useState(String(Math.round(f.reste_a_payer)));
  const [mode, setMode] = useState<ModePaie>('ESPECE');
  const [reference, setReference] = useState('');
  const paiement = useAction(payerFacture);
  const retard = f.jours_avant_echeance < 0;

  return (
    <Card className={`flex flex-col gap-3 ${ouverte ? 'sm:col-span-2 xl:col-span-3' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-display text-base font-bold text-white">{f.client_nom}</p>
          <p className="text-xs text-muted">{f.num_fact}</p>
        </div>
        <div className="text-right">
          <p className="font-display text-base font-bold text-accent2">{fcfa(f.reste_a_payer)}</p>
          <p className="text-[11px] text-muted">reste sur {fcfa(f.montant)}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={retard ? 'danger' : f.jours_avant_echeance <= 7 ? 'warning' : 'neutral'}>
          {retard ? `Échue depuis ${-f.jours_avant_echeance} j` : `Échéance dans ${f.jours_avant_echeance} j`}
        </Badge>
        {f.recouvrement?.action && <span className="text-[11px] text-muted">{f.recouvrement.action}</span>}
      </div>
      {!ouverte ? (
        <button type="button" onClick={() => setOuverte(true)} className="mt-auto flex items-center justify-center gap-2 rounded-xl bg-accent px-3 py-2.5 text-sm font-bold text-black">
          <Banknote size={16} /> Encaisser
        </button>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await paiement.executer(f.id, { date_paie: aujourdhui(), montant: Number(montant), mode_paie: mode, reference: reference.trim() || undefined });
              setOuverte(false);
              onChange();
            } catch {
              /* erreur affichée */
            }
          }}
          className="space-y-3 rounded-2xl border border-border bg-surface2/60 p-4"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-muted">Montant reçu</span>
              <input type="number" inputMode="numeric" min={1} max={Math.round(f.reste_a_payer)} required value={montant} onChange={(e) => setMontant(e.target.value)} className={CHAMP} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-muted">Référence (facultatif)</span>
              <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="N° de transaction, de chèque…" className={CHAMP} />
            </label>
          </div>
          <Puces options={MODES} valeur={mode} onChange={setMode} />
          {paiement.erreur && <p className="text-xs font-semibold text-red-400">{paiement.erreur}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={paiement.enCours} className="rounded-xl bg-accent px-4 py-2 text-sm font-bold text-black disabled:opacity-60">
              {paiement.enCours ? 'Enregistrement…' : 'Enregistrer le paiement'}
            </button>
            <button type="button" onClick={() => setOuverte(false)} className="rounded-xl px-3 py-2 text-sm text-muted hover:text-white">
              Fermer
            </button>
          </div>
        </form>
      )}
    </Card>
  );
}

/**
 * Espace commercial de Jus d'orange : tout le parcours au même endroit.
 * 1. Nouvelle commande (client trouvé ou créé sur place, quantités, prix et
 *    stock visibles), avec livraison et facturation immédiates si besoin ;
 * 2. Commandes à livrer → « Livrer & facturer » ;
 * 3. Factures à encaisser → « Encaisser ».
 */
export default function EspaceCommercial() {
  const clients = useApi(() => listerClients(), []);
  const commandes = useApi(() => listerCommandes(), []);
  const factures = useApi(() => listerFactures(), []);
  const ventes = useApi(() => listerVentes(), []);
  const articles = useApi(() => listerArticles(), []);
  const creation = useAction(creerCommande);
  const livraison = useAction(completerCommande);

  const [client, setClient] = useState<Client | null>(null);
  const [q33, setQ33] = useState(0);
  const [q1l, setQ1l] = useState(0);
  const [livrer, setLivrer] = useState(true);
  const [statut, setStatut] = useState<StatutPaiement>('ACHAT_VENTE');
  const [acompte, setAcompte] = useState('');
  const [message, setMessage] = useState('');

  const article = (type: string) => (articles.donnees ?? []).find((a) => a.type_art === type);
  const prix33 = article('jus_33cl')?.prix_33cl ?? 0;
  const prix1l = article('jus_1l')?.prix_1l ?? 0;
  const stock33 = article('jus_33cl')?.qte_art ?? null;
  const stock1l = article('jus_1l')?.qte_art ?? null;
  const total = q33 * prix33 + q1l * prix1l;

  const aLivrer = (commandes.donnees ?? []).filter((c) => !c.est_completee).sort((a, b) => (a.date_cmd < b.date_cmd ? 1 : -1));
  const aEncaisser = (factures.donnees ?? [])
    .filter((f) => f.reste_a_payer > 0.5 && f.statut !== 'ANNULEE')
    .sort((a, b) => a.jours_avant_echeance - b.jours_avant_echeance);
  const mois = aujourdhui().slice(0, 7);
  const ventesMois = (ventes.donnees ?? []).filter((v) => v.date_vente.startsWith(mois)).reduce((s, v) => s + v.montant_total, 0);
  const totalAEncaisser = aEncaisser.reduce((s, f) => s + f.reste_a_payer, 0);

  function recharger() {
    commandes.recharger();
    factures.recharger();
    ventes.recharger();
    articles.recharger();
  }

  if (clients.chargement && !clients.donnees) return <EtatChargement texte="Chargement de l'espace commercial…" />;
  if (commandes.erreur) return <EtatErreur message={commandes.erreur} recharger={commandes.recharger} />;

  async function enregistrer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!client || (q33 <= 0 && q1l <= 0)) return;
    setMessage('');
    try {
      const cmd = await creation.executer({ client: client.id, date_cmd: aujourdhui(), quantite_33cl: q33, quantite_1l: q1l });
      if (livrer) {
        const r = await livraison.executer(cmd.id, { statut_paiement: statut, montant_paye: statut === 'PARTIELLE' ? Number(acompte) : undefined });
        setMessage(r.detail);
      } else {
        setMessage(`Commande enregistrée pour ${client.nom_complet} : à livrer plus bas.`);
      }
      setClient(null);
      setQ33(0);
      setQ1l(0);
      setAcompte('');
      recharger();
    } catch {
      recharger();
    }
  }

  const tuile = (Icone: typeof Store, valeur: string, libelle: string, teinte: string) => (
    <Card className="flex items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl" style={{ background: `${teinte}26` }}>
        <Icone size={18} color={teinte} />
      </span>
      <div className="min-w-0">
        <p className="truncate font-display text-lg font-bold text-white">{valeur}</p>
        <p className="text-[11px] text-muted">{libelle}</p>
      </div>
    </Card>
  );

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader icon={Store} titre="Espace commercial" sousTitre="Commande, livraison, facture et encaissement au même endroit" />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tuile(Truck, String(aLivrer.length), 'Commandes à livrer', '#fb923c')}
        {tuile(Wallet, fcfa(totalAEncaisser), `À encaisser (${aEncaisser.length} factures)`, '#f87171')}
        {tuile(ShoppingCart, `${stock33 ?? '—'} / ${stock1l ?? '—'}`, 'Stock 33 cl / 1 L', '#38bdf8')}
        {tuile(Banknote, fcfa(ventesMois), 'Ventes du mois', '#34d399')}
      </div>

      {/* --- 1. Nouvelle commande ----------------------------------------- */}
      <Card className="mb-8">
        <form onSubmit={enregistrer} className="space-y-4">
          <p className="font-display text-lg font-bold text-white">Nouvelle commande</p>
          <div>
            <span className="mb-1.5 block text-xs font-semibold text-muted">Client</span>
            <ChoixClient clients={clients.donnees ?? []} valeur={client} onChange={setClient} onCree={clients.recharger} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Quantite libelle="Bouteilles 33 cl" valeur={q33} onChange={setQ33} prix={prix33} stock={stock33} />
            <Quantite libelle="Bouteilles 1 L" valeur={q1l} onChange={setQ1l} prix={prix1l} stock={stock1l} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface2/60 px-4 py-3">
            <span className="text-sm text-muted">Total</span>
            <span className="font-display text-2xl font-bold text-white">{fcfa(total)}</span>
          </div>
          <label className="flex items-center gap-2 text-sm text-white">
            <input type="checkbox" checked={livrer} onChange={(e) => setLivrer(e.target.checked)} className="h-4 w-4 accent-accent" />
            Livrer et facturer maintenant
          </label>
          {livrer && <Reglement montant={total} statut={statut} setStatut={setStatut} acompte={acompte} setAcompte={setAcompte} />}
          {(creation.erreur ?? livraison.erreur) && <p className="text-sm font-semibold text-red-400">{creation.erreur ?? livraison.erreur}</p>}
          {message && (
            <p className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-300">
              <Check size={15} /> {message}
            </p>
          )}
          <button
            type="submit"
            disabled={!client || (q33 <= 0 && q1l <= 0) || creation.enCours || livraison.enCours}
            className="w-full rounded-xl bg-accent px-4 py-3 text-sm font-bold text-black disabled:opacity-50 sm:w-auto"
          >
            {creation.enCours || livraison.enCours ? 'Enregistrement…' : livrer ? 'Enregistrer, livrer et facturer' : 'Enregistrer la commande'}
          </button>
        </form>
      </Card>

      {/* --- 2. Commandes à livrer ---------------------------------------- */}
      <div className="mb-3 flex items-center gap-2">
        <Truck size={16} className="text-accent2" />
        <h2 className="text-sm font-bold text-white">Commandes à livrer</h2>
        <span className="text-xs font-semibold text-muted">{aLivrer.length}</span>
      </div>
      {aLivrer.length === 0 ? (
        <Card className="mb-8 py-6 text-center text-sm text-muted">Aucune commande en attente de livraison.</Card>
      ) : (
        <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {aLivrer.map((c) => (
            <CarteCommande key={c.id} c={c} onChange={recharger} />
          ))}
        </div>
      )}

      {/* --- 3. Factures à encaisser -------------------------------------- */}
      <div className="mb-3 flex items-center gap-2">
        <Wallet size={16} className="text-accent2" />
        <h2 className="text-sm font-bold text-white">À encaisser</h2>
        <span className="text-xs font-semibold text-muted">{aEncaisser.length}</span>
      </div>
      {aEncaisser.length === 0 ? (
        <Card className="mb-8 py-6 text-center text-sm text-muted">Toutes les factures sont réglées.</Card>
      ) : (
        <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {aEncaisser.map((f) => (
            <CarteFacture key={f.id} f={f} onChange={recharger} />
          ))}
        </div>
      )}

      {/* --- Accès aux listes complètes ----------------------------------- */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Clients', '/jus/commercial/clients'],
          ['Ventes', '/jus/commercial/ventes'],
          ['Factures', '/jus/commercial/factures'],
          ['Paiements', '/jus/commercial/paiements'],
        ].map(([libelle, lien]) => (
          <Link key={lien} to={lien} className="flex items-center justify-between rounded-2xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-white hover:bg-surface2">
            {libelle} <ChevronRight size={15} className="text-muted" />
          </Link>
        ))}
      </div>
    </div>
  );
}
