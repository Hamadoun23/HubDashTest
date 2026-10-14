import { useMemo, useState } from 'react';
import { MessageCircle, Phone, ReceiptText, Trash2 } from 'lucide-react';
import { EtatChargement, EtatErreur } from '../../../components/ui/EtatRequete';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Badge } from '../../../components/ui/Table';
import { useAction, useApi } from '../../../lib/hooks/useApi';
import { listerFactures, listerPaiements, modifierFacture, obtenirFacture, supprimerFacture, type Facture } from '../../../lib/api/jus';
import { CarteFacture } from './EspaceCommercial';
import {
  Barres,
  CHAMP,
  C_BLEU,
  C_NEUTRE,
  C_ORANGE,
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
  TEINTES_AGE,
  Tuile,
  type Colonne,
  type Periode,
} from './bi';

type Filtre = 'toutes' | 'a_encaisser' | 'echues' | 'soldees' | 'annulees';
const FILTRES: { cle: Filtre; libelle: string }[] = [
  { cle: 'toutes', libelle: 'Toutes' },
  { cle: 'a_encaisser', libelle: 'À encaisser' },
  { cle: 'echues', libelle: 'Échues' },
  { cle: 'soldees', libelle: 'Soldées' },
  { cle: 'annulees', libelle: 'Annulées' },
];
const annulee = (f: Facture) => f.statut === 'ANNULEE';
const ouverteDue = (f: Facture) => !annulee(f) && f.reste_a_payer > 0.5;
const retard = (f: Facture) => (ouverteDue(f) && f.jours_avant_echeance < 0 ? -f.jours_avant_echeance : 0);

function garde(f: Facture, filtre: Filtre) {
  switch (filtre) {
    case 'a_encaisser':
      return ouverteDue(f);
    case 'echues':
      return retard(f) > 0;
    case 'soldees':
      return !annulee(f) && f.reste_a_payer <= 0.5;
    case 'annulees':
      return annulee(f);
    default:
      return true;
  }
}

/** Tranches de la balance âgée (mêmes bornes que l'analyse des clients). */
const TRANCHES: { cle: string; libelle: string; dans: (j: number) => boolean }[] = [
  { cle: 'non_echu', libelle: 'Non échu', dans: (j) => j <= 0 },
  { cle: 'j0_30', libelle: '1 à 30 j de retard', dans: (j) => j > 0 && j <= 30 },
  { cle: 'j31_60', libelle: '31 à 60 j', dans: (j) => j > 30 && j <= 60 },
  { cle: 'j61_90', libelle: '61 à 90 j', dans: (j) => j > 60 && j <= 90 },
  { cle: 'j90_plus', libelle: 'Plus de 90 j', dans: (j) => j > 90 },
];

function Echeance({ f }: { f: Facture }) {
  if (annulee(f)) return <Badge>Annulée</Badge>;
  if (!ouverteDue(f)) return <Badge tone="success">Soldée</Badge>;
  const r = retard(f);
  if (r > 0) return <Badge tone="danger">Échue · {r} j</Badge>;
  return <Badge tone={f.jours_avant_echeance <= 7 ? 'warning' : 'neutral'}>Dans {f.jours_avant_echeance} j</Badge>;
}

function FicheFacture({ facture, onFermer, onChange }: { facture: Facture; onFermer: () => void; onChange: () => void }) {
  const detail = useApi(() => obtenirFacture(facture.id), [facture.id, facture.total_paye, facture.montant]);
  const modification = useAction(modifierFacture);
  const suppression = useAction(supprimerFacture);
  const [montant, setMontant] = useState(String(facture.montant));
  const [echeance, setEcheance] = useState(facture.date_echeance);
  const change = Number(montant) !== facture.montant || echeance !== facture.date_echeance;
  const tel = (detail.donnees?.client_tel ?? '').replace(/\D/g, '');
  const telValide = tel.length >= 8 && !/^0+$/.test(tel);
  const message = encodeURIComponent(`Bonjour, petit rappel : la facture ${facture.num_fact} présente un reste à payer de ${fcfa(facture.reste_a_payer)}. Merci.`);

  return (
    <Panneau titre={facture.num_fact} sousTitre={`${facture.client_nom} · émise le ${dateFr(facture.date_fact)}`} onFermer={onFermer}>
      <div className="flex flex-wrap items-center gap-2">
        <Echeance f={facture} />
        <span className="text-xs text-muted">Échéance {dateFr(facture.date_echeance)}</span>
        {facture.recouvrement?.action && ouverteDue(facture) && <span className="text-xs text-muted">· {facture.recouvrement.action}</span>}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Tuile valeur={fcfa(facture.montant)} libelle="Montant" />
        <Tuile valeur={fcfa(facture.total_paye)} libelle="Payé" ton="ok" />
        <Tuile valeur={fcfa(facture.reste_a_payer)} libelle="Reste" ton={retard(facture) > 0 ? 'danger' : undefined} />
      </div>

      {telValide && ouverteDue(facture) && (
        <div className="flex flex-wrap gap-2">
          <a href={`tel:${tel}`} className="flex items-center gap-1.5 rounded-xl bg-surface2 px-3 py-2 text-xs font-semibold text-white"><Phone size={14} /> Appeler le client</a>
          <a href={`https://wa.me/${tel.length === 8 ? `223${tel}` : tel}?text=${message}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-xl bg-surface2 px-3 py-2 text-xs font-semibold text-white">
            <MessageCircle size={14} /> Relancer sur WhatsApp
          </a>
        </div>
      )}

      {ouverteDue(facture) && <CarteFacture key={facture.reste_a_payer} f={facture} onChange={onChange} />}

      <div>
        <p className="mb-2 text-sm font-bold text-white">Paiements reçus</p>
        {detail.chargement && <p className="text-xs text-muted">Chargement…</p>}
        <ul className="space-y-2">
          {(detail.donnees?.paiements ?? []).map((p) => (
            <li key={p.id} className="flex items-center justify-between rounded-xl bg-surface2 px-3 py-2 text-sm">
              <span className="text-white">
                {dateFr(p.date_paie)} · {p.mode_display}
                {p.reference && <span className="text-muted"> · {p.reference}</span>}
              </span>
              <span className="font-semibold text-emerald-300">{fcfa(p.montant)}</span>
            </li>
          ))}
          {detail.donnees && detail.donnees.paiements.length === 0 && <li className="text-xs text-muted">Aucun paiement pour l'instant.</li>}
        </ul>
      </div>

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await modification.executer(facture.id, { montant: Number(montant), date_echeance: echeance });
            onChange();
          } catch {
            /* erreur affichée */
          }
        }}
        className="space-y-3 rounded-2xl border border-border p-4"
      >
        <p className="text-sm font-bold text-white">Corriger la facture</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted">Montant</span>
            <input type="number" min={0} inputMode="numeric" required value={montant} onChange={(e) => setMontant(e.target.value)} className={CHAMP} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted">Échéance</span>
            <input type="date" required value={echeance} onChange={(e) => setEcheance(e.target.value)} className={CHAMP} />
          </label>
        </div>
        {modification.erreur && <p className="text-xs font-semibold text-red-400">{modification.erreur}</p>}
        <button type="submit" disabled={!change || modification.enCours} className="rounded-xl bg-accent px-4 py-2 text-sm font-bold text-black disabled:opacity-40">
          {modification.enCours ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </form>

      <button
        type="button"
        disabled={suppression.enCours}
        onClick={async () => {
          if (!window.confirm(`Supprimer définitivement la facture ${facture.num_fact} et ses paiements ?`)) return;
          try {
            await suppression.executer(facture.id);
            onChange();
            onFermer();
          } catch {
            /* erreur affichée */
          }
        }}
        className="flex items-center justify-center gap-2 rounded-xl border border-red-400/40 px-3 py-2.5 text-sm font-semibold text-red-300 hover:bg-red-500/10"
      >
        <Trash2 size={15} /> Supprimer la facture
      </button>
      {suppression.erreur && <p className="text-xs font-semibold text-red-400">{suppression.erreur}</p>}
    </Panneau>
  );
}

/** Factures : facturé, encaissé, balance âgée, plus gros débiteurs, relances. */
export default function Factures() {
  const factures = useApi(() => listerFactures({ page_size: 5000 }), []);
  const paiements = useApi(() => listerPaiements({ page_size: 5000 }), []);
  const [periode, setPeriode] = useState<Periode>('tout');
  const [filtre, setFiltre] = useState<Filtre>('a_encaisser');
  const [recherche, setRecherche] = useState('');
  const [ouverte, setOuverte] = useState<Facture | null>(null);

  const toutes = factures.donnees ?? [];
  const fraiche = ouverte ? toutes.find((x) => x.id === ouverte.id) : undefined;
  const dePeriode = useMemo(() => toutes.filter((f) => dansPeriode(f.date_fact, periode)), [toutes, periode]);
  const q = recherche.trim().toLowerCase();
  const liste = useMemo(
    () => dePeriode.filter((f) => garde(f, filtre) && (!q || f.client_nom.toLowerCase().includes(q) || f.num_fact.toLowerCase().includes(q))),
    [dePeriode, filtre, q],
  );

  const valides = dePeriode.filter((f) => !annulee(f));
  const facture = valides.reduce((s, f) => s + f.montant, 0);
  const encaisse = valides.reduce((s, f) => s + f.total_paye, 0);
  const reste = valides.reduce((s, f) => s + f.reste_a_payer, 0);
  const dues = valides.filter(ouverteDue);
  const echues = dues.filter((f) => retard(f) > 0);
  const echu = echues.reduce((s, f) => s + f.reste_a_payer, 0);
  const mois = douzeMois();

  const colonnes: Colonne<Facture>[] = [
    { cle: 'num', libelle: 'Facture', rendu: (f) => <span className="font-semibold">{f.num_fact}</span>, tri: (f) => f.num_fact },
    { cle: 'client', libelle: 'Client', rendu: (f) => f.client_nom, tri: (f) => f.client_nom },
    { cle: 'date', libelle: 'Émise le', rendu: (f) => <span className="text-muted">{dateFr(f.date_fact)}</span>, tri: (f) => f.date_fact },
    { cle: 'montant', libelle: 'Montant', rendu: (f) => fcfa(f.montant), tri: (f) => f.montant, droite: true },
    { cle: 'reste', libelle: 'Reste', rendu: (f) => (ouverteDue(f) ? <span className="font-semibold">{fcfa(f.reste_a_payer)}</span> : <span className="text-muted">—</span>), tri: (f) => (annulee(f) ? 0 : f.reste_a_payer), droite: true },
    { cle: 'echeance', libelle: 'Échéance', rendu: (f) => <Echeance f={f} />, tri: (f) => (ouverteDue(f) ? f.jours_avant_echeance : 99999) },
  ];

  if (factures.chargement) return <EtatChargement texte="Chargement des factures…" />;
  if (factures.erreur) return <EtatErreur message={factures.erreur} recharger={factures.recharger} />;

  return (
    <div>
      <PageHeader icon={ReceiptText} titre="Factures" sousTitre="Facturation, recouvrement et relances" />

      <div className="mb-4"><Puces options={PERIODES} valeur={periode} onChange={setPeriode} /></div>

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tuile valeur={fcfa(facture)} libelle="Facturé" detail={`${valides.length} facture(s)`} />
        <Tuile valeur={fcfa(encaisse)} libelle="Encaissé" ton="ok" detail={facture ? `${Math.round((100 * encaisse) / facture)} % recouvré` : undefined} />
        <Tuile valeur={fcfa(reste)} libelle="Reste à encaisser" detail={`${dues.length} facture(s) ouverte(s)`} />
        <Tuile valeur={fcfa(echu)} libelle="Échu (en retard)" detail={`${echues.length} facture(s)`} ton={echu > 0 ? 'danger' : undefined} />
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-3">
        <GraphiqueMensuel
          className="lg:col-span-2"
          titre="Facturé et encaissé — 12 derniers mois"
          mois={mois}
          series={[
            { nom: 'Facturé', couleur: C_ORANGE, valeurs: parMois(toutes.filter((f) => !annulee(f)), (f) => f.date_fact, (f) => f.montant, mois) },
            { nom: 'Encaissé', couleur: C_BLEU, valeurs: parMois(paiements.donnees ?? [], (p) => p.date_paie, (p) => p.montant, mois) },
          ]}
        />
        <div className="space-y-4">
          <Barres
            titre="Balance âgée des impayés"
            lignes={TRANCHES.map((t) => ({ cle: t.cle, libelle: t.libelle, montant: dues.filter((f) => t.dans(retard(f))).reduce((s, f) => s + f.reste_a_payer, 0) }))}
            couleur={(cle) => TEINTES_AGE[cle ?? ''] ?? C_NEUTRE}
          />
          <Barres titre="Plus gros débiteurs" lignes={parCategorie(dues, (f) => f.client_nom, (f) => f.reste_a_payer, 5)} couleur={(_, l) => (l === 'Autres' ? C_NEUTRE : C_ORANGE)} />
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Recherche valeur={recherche} onChange={setRecherche} placeholder="Rechercher un client, un n° de facture…" />
        <Puces options={FILTRES} valeur={filtre} onChange={setFiltre} compte={(f) => dePeriode.filter((x) => garde(x, f)).length} />
      </div>

      <TableTriable
        lignes={liste}
        colonnes={colonnes}
        cle={(f) => f.id}
        triInitial={filtre === 'a_encaisser' ? { cle: 'echeance', sens: 1 } : { cle: 'date', sens: -1 }}
        onLigne={setOuverte}
        vide="Aucune facture ne correspond."
      />

      {fraiche && (
        <FicheFacture
          key={fraiche.id}
          facture={fraiche}
          onFermer={() => setOuverte(null)}
          onChange={() => {
            factures.recharger();
            paiements.recharger();
          }}
        />
      )}
    </div>
  );
}
