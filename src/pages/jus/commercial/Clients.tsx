import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, MessageCircle, Pencil, Phone, Plus, Search, Trash2, UserRound, X } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { EtatChargement, EtatErreur } from '../../../components/ui/EtatRequete';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Badge } from '../../../components/ui/Table';
import { useAction, useApi } from '../../../lib/hooks/useApi';
import {
  analyserClients,
  creerClient,
  ficheClient,
  modifierClient,
  supprimerClient,
  type AnalyseClients,
  type LigneAnalyseClient,
} from '../../../lib/api/jus';

/* Couleurs validées (dataviz/validate_palette.js, mode sombre, fond des cartes) :
   facturé #e8590c, encaissé #1c7ed6. Balance âgée : une seule teinte, du clair
   (peu de retard) au foncé (retard grave) ; « non échu » en neutre. */
const C_FACTURE = '#e8590c';
const C_ENCAISSE = '#1c7ed6';
const TEINTES_AGE: Record<string, string> = { non_echu: '#8a7f75', j0_30: '#fca5a5', j31_60: '#f87171', j61_90: '#dc2626', j90_plus: '#991b1b' };

const F = new Intl.NumberFormat('fr-FR');
const fcfa = (v: number) => `${F.format(Math.round(v))} F`;
const COURT = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 });
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const CHAMP = 'w-full rounded-xl border border-border bg-surface2 px-3 py-2.5 text-sm text-white placeholder:text-muted focus:border-accent focus:outline-none';

type Filtre = 'tous' | 'retard' | 'actifs' | 'inactifs' | 'sans_achat';
type Tri = 'nom' | 'facture' | 'paye' | 'reste' | 'echu' | 'retard_max' | 'taux_recouvrement' | 'dernier_achat';

function Tuile({ valeur, libelle, detail, ton }: { valeur: string; libelle: string; detail?: string; ton?: 'danger' | 'ok' }) {
  return (
    <Card className="flex flex-col gap-1">
      <p className={`truncate font-display text-xl font-bold ${ton === 'danger' ? 'text-red-300' : ton === 'ok' ? 'text-emerald-300' : 'text-white'}`}>{valeur}</p>
      <p className="text-xs text-muted">{libelle}</p>
      {detail && <p className="text-[11px] text-muted/80">{detail}</p>}
    </Card>
  );
}

/** Facturé et encaissé par mois : barres groupées, un seul axe (F CFA). */
function GraphiqueMensuel({ donnees }: { donnees: AnalyseClients['mensuel'] }) {
  const [survol, setSurvol] = useState<number | null>(null);
  const max = Math.max(1, ...donnees.flatMap((d) => [d.facture, d.encaisse]));
  return (
    <Card className="lg:col-span-2">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold text-white">Facturé et encaissé — 12 derniers mois</p>
        <div className="flex gap-4 text-xs text-muted">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: C_FACTURE }} /> Facturé</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: C_ENCAISSE }} /> Encaissé</span>
        </div>
      </div>
      <div className="relative">
        <div className="flex h-48 items-end gap-1.5 border-b border-white/10 sm:gap-2" role="img" aria-label="Facturé et encaissé par mois">
          {donnees.map((d, i) => (
            <div
              key={d.mois}
              className="relative flex h-full flex-1 items-end justify-center gap-[2px]"
              onMouseEnter={() => setSurvol(i)}
              onMouseLeave={() => setSurvol(null)}
            >
              {survol === i && <div className="absolute inset-0 rounded-md bg-white/5" />}
              <div className="w-1/2 max-w-[14px] rounded-t" style={{ height: `${(d.facture / max) * 100}%`, background: C_FACTURE, minHeight: d.facture ? 2 : 0 }} />
              <div className="w-1/2 max-w-[14px] rounded-t" style={{ height: `${(d.encaisse / max) * 100}%`, background: C_ENCAISSE, minHeight: d.encaisse ? 2 : 0 }} />
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex gap-1.5 sm:gap-2">
          {donnees.map((d) => (
            <span key={d.mois} className="flex-1 text-center text-[10px] text-muted">{MOIS[Number(d.mois.slice(5, 7)) - 1]}</span>
          ))}
        </div>
        {survol !== null && (
          <div
            className="pointer-events-none absolute top-0 z-10 rounded-xl border border-border bg-[#1f1712] px-3 py-2 text-xs shadow-xl"
            style={{ left: `min(calc(${((survol + 0.5) / donnees.length) * 100}% - 70px), calc(100% - 150px))` }}
          >
            <p className="mb-1 font-semibold text-white">{MOIS[Number(donnees[survol].mois.slice(5, 7)) - 1]} {donnees[survol].mois.slice(0, 4)}</p>
            <p className="text-white/85">Facturé : {fcfa(donnees[survol].facture)}</p>
            <p className="text-white/85">Encaissé : {fcfa(donnees[survol].encaisse)}</p>
          </div>
        )}
      </div>
    </Card>
  );
}

/** Barres horizontales simples (balance âgée, modes de paiement). */
function Barres({ titre, lignes, couleur }: { titre: string; lignes: { libelle: string; montant: number; cle?: string }[]; couleur: (cle?: string) => string }) {
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
            <li key={l.libelle} title={`${l.libelle} : ${fcfa(l.montant)}`}>
              <div className="mb-1 flex justify-between gap-2 text-xs">
                <span className="text-white/85">{l.libelle}</span>
                <span className="font-semibold text-white">{fcfa(l.montant)}</span>
              </div>
              <div className="h-2 rounded-full bg-white/10">
                <div className="h-2 rounded-full" style={{ width: `${(l.montant / max) * 100}%`, background: couleur(l.cle), minWidth: l.montant ? 4 : 0 }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** Fiche d'un client : chiffres, factures (reste, retard), paiements, commandes. */
function FicheClient({ ligne, onFermer, onModifier }: { ligne: LigneAnalyseClient; onFermer: () => void; onModifier: () => void }) {
  const fiche = useApi(() => ficheClient(ligne.id), [ligne.id]);
  const [onglet, setOnglet] = useState<'factures' | 'paiements' | 'commandes'>('factures');
  const tel = ligne.telephone.replace(/\D/g, '');
  const telValide = tel.length >= 8 && !/^0+$/.test(tel);
  const whatsapp = telValide ? `https://wa.me/${tel.length === 8 ? `223${tel}` : tel}` : null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={ligne.nom}>
      <button type="button" aria-label="Fermer" className="absolute inset-0 bg-black/60" onClick={onFermer} />
      <div className="relative flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-border bg-[#1f1712] p-5" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1.25rem)' }}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display text-xl font-bold text-white">{ligne.nom}</p>
            <p className="text-sm text-muted">{ligne.telephone || 'Sans téléphone'}{ligne.adresse ? ` · ${ligne.adresse}` : ''}</p>
          </div>
          <button type="button" onClick={onFermer} className="rounded-full p-2 text-muted hover:text-white" aria-label="Fermer">
            <X size={18} />
          </button>
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          {telValide && (
            <a href={`tel:${tel}`} className="flex items-center gap-1.5 rounded-xl bg-surface2 px-3 py-2 text-xs font-semibold text-white"><Phone size={14} /> Appeler</a>
          )}
          {whatsapp && (
            <a href={whatsapp} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-xl bg-surface2 px-3 py-2 text-xs font-semibold text-white"><MessageCircle size={14} /> WhatsApp</a>
          )}
          <button type="button" onClick={onModifier} className="flex items-center gap-1.5 rounded-xl bg-surface2 px-3 py-2 text-xs font-semibold text-white"><Pencil size={14} /> Modifier</button>
          {ligne.reste > 0 && (
            <Link to="/jus/commercial" className="flex items-center gap-1.5 rounded-xl bg-accent px-3 py-2 text-xs font-bold text-black">Encaisser</Link>
          )}
        </div>
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ['Facturé', fcfa(ligne.facture)],
            ['Payé', fcfa(ligne.paye)],
            ['Reste dû', fcfa(ligne.reste)],
            ['Dont échu', fcfa(ligne.echu)],
          ].map(([l, v]) => (
            <div key={l} className="rounded-2xl bg-surface2 px-3 py-2">
              <p className={`text-sm font-bold ${l === 'Dont échu' && ligne.echu > 0 ? 'text-red-300' : 'text-white'}`}>{v}</p>
              <p className="text-[11px] text-muted">{l}</p>
            </div>
          ))}
        </div>
        <p className="mb-4 text-xs text-muted">
          {ligne.bouteilles_33cl} × 33 cl et {ligne.bouteilles_1l} × 1 L achetées · recouvrement {ligne.taux_recouvrement ?? '—'} %
          {ligne.retard_max > 0 ? ` · plus ancien retard : ${ligne.retard_max} j` : ''}
        </p>

        <div className="mb-3 flex gap-1 rounded-xl bg-surface2 p-1">
          {(['factures', 'paiements', 'commandes'] as const).map((o) => (
            <button key={o} type="button" onClick={() => setOnglet(o)} className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold capitalize ${onglet === o ? 'bg-accent text-black' : 'text-muted hover:text-white'}`}>
              {o}
            </button>
          ))}
        </div>
        {fiche.chargement ? (
          <p className="py-6 text-center text-xs text-muted">Chargement…</p>
        ) : fiche.erreur ? (
          <p className="text-xs text-red-400">{fiche.erreur}</p>
        ) : (
          <ul className="space-y-2">
            {onglet === 'factures' &&
              (fiche.donnees?.factures.length ? fiche.donnees.factures : []).map((f) => (
                <li key={f.id} className="rounded-xl bg-surface2 px-3 py-2 text-xs">
                  <div className="flex justify-between gap-2">
                    <span className="font-semibold text-white">{f.numero}</span>
                    <span className="text-white">{fcfa(f.montant)}</span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap justify-between gap-2 text-muted">
                    <span>{new Date(f.date).toLocaleDateString('fr-FR')} · échéance {new Date(f.echeance).toLocaleDateString('fr-FR')}</span>
                    {f.reste > 0 ? (
                      <span className={f.retard > 0 ? 'font-semibold text-red-300' : 'text-amber-200'}>
                        reste {fcfa(f.reste)}{f.retard > 0 ? ` · ${f.retard} j de retard` : ''}
                      </span>
                    ) : (
                      <span className="text-emerald-300">soldée</span>
                    )}
                  </div>
                </li>
              ))}
            {onglet === 'paiements' &&
              (fiche.donnees?.paiements ?? []).map((p, i) => (
                <li key={i} className="flex justify-between gap-2 rounded-xl bg-surface2 px-3 py-2 text-xs">
                  <span className="text-muted">{new Date(p.date).toLocaleDateString('fr-FR')} · {p.mode} · {p.facture}</span>
                  <span className="font-semibold text-emerald-300">{fcfa(p.montant)}</span>
                </li>
              ))}
            {onglet === 'commandes' &&
              (fiche.donnees?.commandes ?? []).map((c, i) => (
                <li key={i} className="flex justify-between gap-2 rounded-xl bg-surface2 px-3 py-2 text-xs">
                  <span className="text-muted">
                    {new Date(c.date).toLocaleDateString('fr-FR')} · {c.qte_33cl} × 33 cl, {c.qte_1l} × 1 L
                  </span>
                  <span className="text-white">{fcfa(c.total)} {c.livree ? '' : '· à livrer'}</span>
                </li>
              ))}
            {fiche.donnees && fiche.donnees[onglet].length === 0 && <p className="py-6 text-center text-xs text-muted">Rien pour le moment.</p>}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Création ou modification d'un client (fenêtre). */
function FormulaireClient({ client, onFermer, onTermine }: { client: LigneAnalyseClient | null; onFermer: () => void; onTermine: () => void }) {
  const creation = useAction(creerClient);
  const modification = useAction(modifierClient);
  const [nom, setNom] = useState(client?.nom ?? '');
  const [tel, setTel] = useState(client?.telephone ?? '');
  const [adresse, setAdresse] = useState(client?.adresse ?? '');
  const enCours = creation.enCours || modification.enCours;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <button type="button" aria-label="Fermer" className="absolute inset-0 bg-black/60" onClick={onFermer} />
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const payload = { nom_complet: nom.trim(), tel_client: tel.trim(), adresse: adresse.trim() };
          try {
            if (client) await modification.executer(client.id, payload);
            else await creation.executer(payload);
            onTermine();
          } catch {
            /* erreur affichée */
          }
        }}
        className="relative w-full space-y-3 rounded-t-3xl border border-border bg-[#1f1712] p-5 sm:max-w-md sm:rounded-3xl"
      >
        <p className="font-display text-lg font-bold text-white">{client ? 'Modifier le client' : 'Nouveau client'}</p>
        <input autoFocus required value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom du client ou de la boutique" className={CHAMP} />
        <input value={tel} onChange={(e) => setTel(e.target.value)} placeholder="Téléphone" type="tel" inputMode="tel" className={CHAMP} />
        <input value={adresse} onChange={(e) => setAdresse(e.target.value)} placeholder="Adresse / quartier" className={CHAMP} />
        {(creation.erreur ?? modification.erreur) && <p className="text-xs font-semibold text-red-400">{creation.erreur ?? modification.erreur}</p>}
        <div className="flex gap-2">
          <button type="submit" disabled={enCours || !nom.trim()} className="rounded-xl bg-accent px-4 py-2 text-sm font-bold text-black disabled:opacity-50">Enregistrer</button>
          <button type="button" onClick={onFermer} className="rounded-xl px-3 py-2 text-sm text-muted hover:text-white">Annuler</button>
        </div>
      </form>
    </div>
  );
}

/**
 * Clients — analyse commerciale (BI) : ce que chaque client a acheté et payé,
 * ce qu'il doit, depuis quand, et la santé du recouvrement. Recherche,
 * filtres, tri par colonne, fiche détaillée de chaque client.
 */
export default function Clients() {
  const analyse = useApi(analyserClients, []);
  const suppression = useAction(supprimerClient);
  const [recherche, setRecherche] = useState('');
  const [filtre, setFiltre] = useState<Filtre>('tous');
  const [tri, setTri] = useState<{ cle: Tri; sens: 1 | -1 }>({ cle: 'facture', sens: -1 });
  const [ouvert, setOuvert] = useState<LigneAnalyseClient | null>(null);
  const [edition, setEdition] = useState<LigneAnalyseClient | null | 'nouveau'>(null);

  const clients = analyse.donnees?.clients ?? [];
  const compte = (f: Filtre) => clients.filter((c) => correspond(c, f)).length;
  const liste = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    const r = clients.filter((c) => correspond(c, filtre) && (!q || c.nom.toLowerCase().includes(q) || c.telephone.includes(q) || (c.adresse || '').toLowerCase().includes(q)));
    return [...r].sort((a, b) => {
      const va = a[tri.cle] ?? (tri.cle === 'dernier_achat' ? '' : -1);
      const vb = b[tri.cle] ?? (tri.cle === 'dernier_achat' ? '' : -1);
      if (typeof va === 'string' && typeof vb === 'string') return va.localeCompare(vb) * tri.sens;
      return ((va as number) - (vb as number)) * tri.sens;
    });
  }, [clients, filtre, recherche, tri]);

  if (analyse.chargement && !analyse.donnees) return <EtatChargement texte="Analyse des clients…" />;
  if (analyse.erreur || !analyse.donnees) return <EtatErreur message={analyse.erreur ?? 'Analyse indisponible'} recharger={analyse.recharger} />;
  const k = analyse.donnees.indicateurs;

  const entete = (cle: Tri, libelle: string, droite = true) => (
    <th className={`whitespace-nowrap px-3 py-3 text-xs font-semibold uppercase tracking-wide text-muted ${droite ? 'text-right' : 'text-left'}`} data-label={libelle}>
      <button type="button" onClick={() => setTri((t) => ({ cle, sens: t.cle === cle ? (t.sens === 1 ? -1 : 1) : -1 }))} className="inline-flex items-center gap-1 hover:text-white">
        {libelle}
        {tri.cle === cle && (tri.sens === 1 ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
      </button>
    </th>
  );

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader icon={UserRound} titre="Clients" sousTitre="Achats, paiements et recouvrement par client" />
        <button type="button" onClick={() => setEdition('nouveau')} className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-black">
          <Plus size={16} /> Nouveau client
        </button>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tuile valeur={fcfa(k.chiffre_affaires)} libelle="Chiffre d'affaires facturé" detail={`Panier moyen ${fcfa(k.panier_moyen)}`} />
        <Tuile valeur={fcfa(k.encaisse)} libelle="Encaissé" ton="ok" />
        <Tuile valeur={fcfa(k.reste)} libelle="Reste à encaisser" detail={`dont ${fcfa(k.echu)} échu`} ton={k.echu > 0 ? 'danger' : undefined} />
        <Tuile valeur={k.taux_recouvrement === null ? '—' : `${k.taux_recouvrement} %`} libelle="Taux de recouvrement" detail={`${k.clients_en_retard} client(s) en retard`} />
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-3">
        <GraphiqueMensuel donnees={analyse.donnees.mensuel} />
        <div className="space-y-4">
          <Barres titre="Balance âgée des impayés" lignes={analyse.donnees.balance_agee} couleur={(cle) => TEINTES_AGE[cle ?? ''] ?? '#8a7f75'} />
          <Barres
            titre="Encaissements par mode"
            lignes={analyse.donnees.modes_paiement.map((m) => ({ libelle: m.mode, montant: m.montant }))}
            couleur={() => C_ENCAISSE}
          />
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="relative w-full sm:max-w-sm">
          <Search size={15} className="pointer-events-none absolute left-3 top-3 text-muted" />
          <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher un client, un téléphone, un quartier…" className={`${CHAMP} pl-9`} />
        </label>
        {(
          [
            ['tous', 'Tous'],
            ['retard', 'En retard'],
            ['actifs', 'Actifs (90 j)'],
            ['inactifs', 'Inactifs'],
            ['sans_achat', 'Sans achat'],
          ] as [Filtre, string][]
        ).map(([cle, libelle]) => (
          <button
            key={cle}
            type="button"
            onClick={() => setFiltre(cle)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${filtre === cle ? 'bg-accent text-black' : 'bg-surface2 text-muted hover:text-white'}`}
          >
            {libelle} <span className="opacity-70">({compte(cle)})</span>
          </button>
        ))}
      </div>

      <Card className="overflow-hidden !p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {entete('nom', 'Client', false)}
                {entete('facture', 'Facturé')}
                {entete('paye', 'Payé')}
                {entete('reste', 'Reste dû')}
                {entete('echu', 'Échu')}
                {entete('taux_recouvrement', 'Recouvrement')}
                {entete('dernier_achat', 'Dernier achat')}
                <th className="px-3 py-3" data-label="" />
              </tr>
            </thead>
            <tbody>
              {liste.map((c) => (
                <tr key={c.id} onClick={() => setOuvert(c)} className="cursor-pointer border-b border-border/60 last:border-0 hover:bg-surface2/60">
                  <td className="px-3 py-3 text-left">
                    <p className="font-semibold text-white">{c.nom}</p>
                    <p className="text-xs text-muted">{c.telephone || '—'}</p>
                  </td>
                  <td className="px-3 py-3 text-right text-white">{fcfa(c.facture)}</td>
                  <td className="px-3 py-3 text-right text-emerald-300">{fcfa(c.paye)}</td>
                  <td className="px-3 py-3 text-right font-semibold text-white">{c.reste ? fcfa(c.reste) : '—'}</td>
                  <td className="px-3 py-3 text-right">
                    {c.echu ? <span className="font-semibold text-red-300">{fcfa(c.echu)}<span className="block text-[11px] font-normal">{c.retard_max} j</span></span> : <span className="text-muted">—</span>}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {c.taux_recouvrement === null ? (
                      <span className="text-muted">—</span>
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        <span className="hidden h-1.5 w-14 rounded-full bg-white/10 sm:block">
                          <span className="block h-1.5 rounded-full" style={{ width: `${c.taux_recouvrement}%`, background: C_ENCAISSE }} />
                        </span>
                        <span className="text-white">{c.taux_recouvrement} %</span>
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right text-muted">
                    {c.dernier_achat ? new Date(c.dernier_achat).toLocaleDateString('fr-FR') : <Badge>Jamais</Badge>}
                  </td>
                  <td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <span className="inline-flex gap-1">
                      <button type="button" title="Modifier" onClick={() => setEdition(c)} className="rounded-lg p-1.5 text-muted hover:bg-surface2 hover:text-white"><Pencil size={14} /></button>
                      <button
                        type="button"
                        title="Supprimer"
                        disabled={suppression.enCours}
                        onClick={async () => {
                          if (!window.confirm(`Supprimer ${c.nom} ? Ses ventes, commandes et factures seront aussi supprimées.`)) return;
                          try {
                            await suppression.executer(c.id);
                            analyse.recharger();
                          } catch {
                            /* erreur affichée */
                          }
                        }}
                        className="rounded-lg p-1.5 text-muted hover:bg-red-500/10 hover:text-red-300"
                      >
                        <Trash2 size={14} />
                      </button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {liste.length === 0 && <p className="p-6 text-center text-sm text-muted">Aucun client ne correspond.</p>}
      </Card>
      <p className="mt-2 text-xs text-muted">
        {liste.length} client(s) affiché(s) sur {k.clients} · {k.clients_actifs} actif(s) sur 90 jours · {COURT.format(k.chiffre_affaires)} F facturés au total
      </p>
      {suppression.erreur && <p className="mt-2 text-xs font-semibold text-red-400">{suppression.erreur}</p>}

      {ouvert && (
        <FicheClient
          ligne={ouvert}
          onFermer={() => setOuvert(null)}
          onModifier={() => {
            setEdition(ouvert);
            setOuvert(null);
          }}
        />
      )}
      {edition && (
        <FormulaireClient
          client={edition === 'nouveau' ? null : edition}
          onFermer={() => setEdition(null)}
          onTermine={() => {
            setEdition(null);
            analyse.recharger();
          }}
        />
      )}
    </div>
  );
}

function correspond(c: LigneAnalyseClient, f: Filtre) {
  if (f === 'retard') return c.echu > 0;
  if (f === 'actifs') return c.actif;
  if (f === 'inactifs') return c.nb_factures > 0 && !c.actif;
  if (f === 'sans_achat') return c.nb_factures === 0;
  return true;
}
