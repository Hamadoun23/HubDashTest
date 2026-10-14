import { useMemo, useState } from 'react';
import { Trash2, Wallet } from 'lucide-react';
import { EtatChargement, EtatErreur } from '../../../components/ui/EtatRequete';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Badge } from '../../../components/ui/Table';
import { useAction, useApi } from '../../../lib/hooks/useApi';
import { listerPaiements, modifierPaiement, supprimerPaiement, type ModePaie, type Paiement } from '../../../lib/api/jus';
import {
  Barres,
  CHAMP,
  C_BLEU,
  C_NEUTRE,
  dansPeriode,
  dateFr,
  douzeMois,
  fcfa,
  GraphiqueMensuel,
  Panneau,
  parCategorie,
  parMois,
  PERIODES,
  Puces,
  Recherche,
  TableTriable,
  Tuile,
  type Colonne,
  type Periode,
} from './bi';

const MODES: { cle: ModePaie; libelle: string }[] = [
  { cle: 'ESPECE', libelle: 'Espèces' },
  { cle: 'MOBILE', libelle: 'Mobile money' },
  { cle: 'VIREMENT', libelle: 'Virement' },
  { cle: 'CHEQUE', libelle: 'Chèque' },
];
type Filtre = 'tous' | ModePaie;
const FILTRES: { cle: Filtre; libelle: string }[] = [{ cle: 'tous', libelle: 'Tous' }, ...MODES];

function FichePaiement({ paiement, onFermer, onChange }: { paiement: Paiement; onFermer: () => void; onChange: () => void }) {
  const modification = useAction(modifierPaiement);
  const suppression = useAction(supprimerPaiement);
  const [montant, setMontant] = useState(String(paiement.montant));
  const [mode, setMode] = useState<ModePaie>(paiement.mode_paie);
  const [reference, setReference] = useState(paiement.reference);
  const [date, setDate] = useState(paiement.date_paie);

  return (
    <Panneau titre={fcfa(paiement.montant)} sousTitre={`${paiement.client_nom} · facture ${paiement.num_fact}`} onFermer={onFermer}>
      <div className="flex flex-wrap gap-2">
        <Badge tone="success">{paiement.mode_display}</Badge>
        <span className="text-xs text-muted">Reçu le {dateFr(paiement.date_paie)}{paiement.reference ? ` · réf. ${paiement.reference}` : ''}</span>
      </div>

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await modification.executer(paiement.id, { montant: Number(montant), mode_paie: mode, reference: reference.trim(), date_paie: date });
            onChange();
          } catch {
            /* erreur affichée */
          }
        }}
        className="space-y-3 rounded-2xl border border-border p-4"
      >
        <p className="text-sm font-bold text-white">Corriger le paiement</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted">Montant</span>
            <input type="number" min={1} inputMode="numeric" required value={montant} onChange={(e) => setMontant(e.target.value)} className={CHAMP} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted">Date</span>
            <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={CHAMP} />
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-muted">Référence</span>
          <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="N° de transaction, de chèque…" className={CHAMP} />
        </label>
        <Puces options={MODES} valeur={mode} onChange={setMode} />
        {modification.erreur && <p className="text-xs font-semibold text-red-400">{modification.erreur}</p>}
        <button type="submit" disabled={modification.enCours} className="rounded-xl bg-accent px-4 py-2 text-sm font-bold text-black disabled:opacity-60">
          {modification.enCours ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </form>

      <button
        type="button"
        disabled={suppression.enCours}
        onClick={async () => {
          if (!window.confirm(`Supprimer ce paiement de ${fcfa(paiement.montant)} ? Le reste à payer de la facture ${paiement.num_fact} augmentera d'autant.`)) return;
          try {
            await suppression.executer(paiement.id);
            onChange();
            onFermer();
          } catch {
            /* erreur affichée */
          }
        }}
        className="flex items-center justify-center gap-2 rounded-xl border border-red-400/40 px-3 py-2.5 text-sm font-semibold text-red-300 hover:bg-red-500/10"
      >
        <Trash2 size={15} /> Supprimer le paiement
      </button>
      {suppression.erreur && <p className="text-xs font-semibold text-red-400">{suppression.erreur}</p>}
    </Panneau>
  );
}

/** Paiements : encaissements par mois, par mode et par client. */
export default function Paiements() {
  const paiements = useApi(() => listerPaiements({ page_size: 5000 }), []);
  const [periode, setPeriode] = useState<Periode>('annee');
  const [filtre, setFiltre] = useState<Filtre>('tous');
  const [recherche, setRecherche] = useState('');
  const [ouvert, setOuvert] = useState<Paiement | null>(null);

  const tous = paiements.donnees ?? [];
  const frais = ouvert ? tous.find((x) => x.id === ouvert.id) : undefined;
  const dePeriode = useMemo(() => tous.filter((p) => dansPeriode(p.date_paie, periode)), [tous, periode]);
  const q = recherche.trim().toLowerCase();
  const liste = useMemo(
    () =>
      dePeriode.filter(
        (p) =>
          (filtre === 'tous' || p.mode_paie === filtre) &&
          (!q || (p.client_nom ?? '').toLowerCase().includes(q) || p.num_fact.toLowerCase().includes(q) || (p.reference ?? '').toLowerCase().includes(q)),
      ),
    [dePeriode, filtre, q],
  );

  const total = dePeriode.reduce((s, p) => s + p.montant, 0);
  const ceMois = tous.filter((p) => dansPeriode(p.date_paie, 'mois')).reduce((s, p) => s + p.montant, 0);
  const payeurs = new Set(dePeriode.map((p) => p.client_nom)).size;
  const mois = douzeMois();

  const colonnes: Colonne<Paiement>[] = [
    { cle: 'date', libelle: 'Date', rendu: (p) => <span className="text-muted">{dateFr(p.date_paie)}</span>, tri: (p) => p.date_paie },
    { cle: 'client', libelle: 'Client', rendu: (p) => <span className="font-semibold">{p.client_nom}</span>, tri: (p) => p.client_nom ?? '' },
    { cle: 'facture', libelle: 'Facture', rendu: (p) => p.num_fact, tri: (p) => p.num_fact },
    { cle: 'mode', libelle: 'Mode', rendu: (p) => p.mode_display, tri: (p) => p.mode_display },
    { cle: 'reference', libelle: 'Référence', rendu: (p) => <span className="text-muted">{p.reference || '—'}</span> },
    { cle: 'montant', libelle: 'Montant', rendu: (p) => <span className="font-semibold text-emerald-300">{fcfa(p.montant)}</span>, tri: (p) => p.montant, droite: true },
  ];

  if (paiements.chargement) return <EtatChargement texte="Chargement des paiements…" />;
  if (paiements.erreur) return <EtatErreur message={paiements.erreur} recharger={paiements.recharger} />;

  return (
    <div>
      <PageHeader icon={Wallet} titre="Paiements" sousTitre="Encaissements reçus — un paiement s'enregistre depuis sa facture" />

      <div className="mb-4"><Puces options={PERIODES} valeur={periode} onChange={setPeriode} /></div>

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tuile valeur={fcfa(total)} libelle="Encaissé sur la période" ton="ok" detail={`${dePeriode.length} paiement(s)`} />
        <Tuile valeur={fcfa(ceMois)} libelle="Encaissé ce mois-ci" />
        <Tuile valeur={fcfa(dePeriode.length ? total / dePeriode.length : 0)} libelle="Paiement moyen" />
        <Tuile valeur={String(payeurs)} libelle="Clients payeurs" />
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-3">
        <GraphiqueMensuel
          className="lg:col-span-2"
          titre="Encaissements — 12 derniers mois"
          mois={mois}
          series={[{ nom: 'Encaissé', couleur: C_BLEU, valeurs: parMois(tous, (p) => p.date_paie, (p) => p.montant, mois) }]}
        />
        <div className="space-y-4">
          <Barres titre="Par mode de paiement" lignes={parCategorie(dePeriode, (p) => p.mode_display, (p) => p.montant)} couleur={() => C_BLEU} />
          <Barres titre="Clients qui paient le plus" lignes={parCategorie(dePeriode, (p) => p.client_nom, (p) => p.montant, 5)} couleur={(_, l) => (l === 'Autres' ? C_NEUTRE : C_BLEU)} />
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Recherche valeur={recherche} onChange={setRecherche} placeholder="Rechercher un client, une facture, une référence…" />
        <Puces options={FILTRES} valeur={filtre} onChange={setFiltre} compte={(f) => dePeriode.filter((p) => f === 'tous' || p.mode_paie === f).length} />
      </div>

      <TableTriable lignes={liste} colonnes={colonnes} cle={(p) => p.id} triInitial={{ cle: 'date', sens: -1 }} onLigne={setOuvert} vide="Aucun paiement ne correspond." />

      {frais && <FichePaiement key={frais.id} paiement={frais} onFermer={() => setOuvert(null)} onChange={paiements.recharger} />}
    </div>
  );
}
