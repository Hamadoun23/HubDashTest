import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Citrus, Store, Trash2 } from 'lucide-react';
import { EtatChargement, EtatErreur } from '../../../components/ui/EtatRequete';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Badge } from '../../../components/ui/Table';
import { useAction, useApi } from '../../../lib/hooks/useApi';
import {
  listerPaiements,
  listerVentes,
  modifierVente,
  obtenirDetailVente,
  supprimerVente,
  type StatutPaiement,
  type Vente,
} from '../../../lib/api/jus';
import { CarteFacture } from './EspaceCommercial';
import {
  Barres,
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
  Tuile,
  type Colonne,
  type Periode,
} from './bi';

const TON = { ACHAT_VENTE: 'success', PARTIELLE: 'warning', DEPOT_VENTE: 'neutral' } as const;
const STATUTS: { cle: StatutPaiement; libelle: string }[] = [
  { cle: 'ACHAT_VENTE', libelle: 'Achat/vente (payé)' },
  { cle: 'PARTIELLE', libelle: 'Paiement partiel' },
  { cle: 'DEPOT_VENTE', libelle: 'Dépôt-vente' },
];
type Filtre = 'tous' | 'a_encaisser' | 'soldees' | StatutPaiement;
const FILTRES: { cle: Filtre; libelle: string }[] = [
  { cle: 'tous', libelle: 'Toutes' },
  { cle: 'a_encaisser', libelle: 'Reste à encaisser' },
  { cle: 'soldees', libelle: 'Soldées' },
  { cle: 'PARTIELLE', libelle: 'Partielles' },
  { cle: 'DEPOT_VENTE', libelle: 'Dépôt-vente' },
];

function garde(v: Vente, f: Filtre) {
  if (f === 'tous') return true;
  if (f === 'a_encaisser') return v.reste_a_payer > 0.5;
  if (f === 'soldees') return v.reste_a_payer <= 0.5;
  return v.statut_paiement === f;
}

function FicheVente({ vente, onFermer, onChange }: { vente: Vente; onFermer: () => void; onChange: () => void }) {
  const detail = useApi(() => obtenirDetailVente(vente.id), [vente.id]);
  const modification = useAction(modifierVente);
  const suppression = useAction(supprimerVente);
  const [statut, setStatut] = useState<StatutPaiement>(vente.statut_paiement);
  const recharger = () => {
    detail.recharger();
    onChange();
  };

  return (
    <Panneau titre={vente.client_nom} sousTitre={`Vente du ${dateFr(vente.date_vente)}`} onFermer={onFermer}>
      <div className="grid grid-cols-3 gap-2">
        <Tuile valeur={fcfa(vente.montant_total)} libelle="Montant" />
        <Tuile valeur={fcfa(vente.total_paye)} libelle="Payé" ton="ok" />
        <Tuile valeur={fcfa(vente.reste_a_payer)} libelle="Reste" ton={vente.reste_a_payer > 0.5 ? 'danger' : undefined} />
      </div>

      <div className="rounded-2xl border border-border p-4">
        <p className="mb-2 text-sm font-bold text-white">Mode de vente</p>
        <Puces options={STATUTS} valeur={statut} onChange={setStatut} />
        {statut !== vente.statut_paiement && (
          <button
            type="button"
            disabled={modification.enCours}
            onClick={async () => {
              try {
                await modification.executer(vente.id, { statut_paiement: statut });
                onChange();
              } catch {
                /* erreur affichée */
              }
            }}
            className="mt-3 rounded-xl bg-accent px-4 py-2 text-sm font-bold text-black disabled:opacity-60"
          >
            {modification.enCours ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        )}
        {modification.erreur && <p className="mt-2 text-xs font-semibold text-red-400">{modification.erreur}</p>}
      </div>

      {detail.chargement && <p className="text-sm text-muted">Chargement du détail…</p>}
      {detail.erreur && <p className="text-sm text-red-400">{detail.erreur}</p>}
      {detail.donnees && (
        <>
          <div>
            <p className="mb-2 text-sm font-bold text-white">Commandes livrées</p>
            <ul className="space-y-2">
              {detail.donnees.commandes.map((c) => (
                <li key={c.id} className="flex items-center justify-between rounded-xl bg-surface2 px-3 py-2 text-sm">
                  <span className="text-white">
                    {c.quantite_33cl > 0 && `${c.quantite_33cl} × 33 cl`}
                    {c.quantite_33cl > 0 && c.quantite_1l > 0 && ' · '}
                    {c.quantite_1l > 0 && `${c.quantite_1l} × 1 L`}
                  </span>
                  <span className="font-semibold text-white">{fcfa(c.total)}</span>
                </li>
              ))}
              {detail.donnees.commandes.length === 0 && <li className="text-xs text-muted">Aucune commande liée.</li>}
            </ul>
          </div>
          <div className="space-y-3">
            <p className="text-sm font-bold text-white">Factures</p>
            {detail.donnees.factures.map((f) =>
              f.reste_a_payer > 0.5 && f.statut !== 'ANNULEE' ? (
                <CarteFacture key={`${f.id}-${f.reste_a_payer}`} f={f} onChange={recharger} />
              ) : (
                <div key={f.id} className="flex items-center justify-between rounded-xl bg-surface2 px-3 py-2 text-sm">
                  <span className="text-white">{f.num_fact}</span>
                  <Badge tone={f.statut === 'ANNULEE' ? 'neutral' : 'success'}>{f.statut === 'ANNULEE' ? 'Annulée' : 'Soldée'}</Badge>
                </div>
              ),
            )}
          </div>
        </>
      )}

      <button
        type="button"
        disabled={suppression.enCours}
        onClick={async () => {
          if (!window.confirm(`Supprimer définitivement la vente de ${vente.client_nom} ? Ses factures et paiements seront aussi supprimés.`)) return;
          try {
            await suppression.executer(vente.id);
            onChange();
            onFermer();
          } catch {
            /* erreur affichée */
          }
        }}
        className="mt-auto flex items-center justify-center gap-2 rounded-xl border border-red-400/40 px-3 py-2.5 text-sm font-semibold text-red-300 hover:bg-red-500/10"
      >
        <Trash2 size={15} /> Supprimer la vente
      </button>
      {suppression.erreur && <p className="text-xs font-semibold text-red-400">{suppression.erreur}</p>}
    </Panneau>
  );
}

/** Ventes : chiffre d'affaires, encaissements, mode de vente, meilleurs clients. */
export default function Ventes() {
  const ventes = useApi(() => listerVentes({ page_size: 5000 }), []);
  const paiements = useApi(() => listerPaiements({ page_size: 5000 }), []);
  const [periode, setPeriode] = useState<Periode>('annee');
  const [filtre, setFiltre] = useState<Filtre>('tous');
  const [recherche, setRecherche] = useState('');
  const [ouverte, setOuverte] = useState<Vente | null>(null);

  const toutes = ventes.donnees ?? [];
  const fraiche = ouverte ? toutes.find((x) => x.id === ouverte.id) : undefined;
  const dePeriode = useMemo(() => toutes.filter((v) => dansPeriode(v.date_vente, periode)), [toutes, periode]);
  const q = recherche.trim().toLowerCase();
  const liste = useMemo(
    () => dePeriode.filter((v) => garde(v, filtre) && (!q || v.client_nom.toLowerCase().includes(q) || String(v.montant_total).includes(q))),
    [dePeriode, filtre, q],
  );

  const mois = douzeMois();
  const ca = dePeriode.reduce((s, v) => s + v.montant_total, 0);
  const paye = dePeriode.reduce((s, v) => s + v.total_paye, 0);
  const reste = dePeriode.reduce((s, v) => s + v.reste_a_payer, 0);
  const clients = new Set(dePeriode.map((v) => v.client)).size;

  const colonnes: Colonne<Vente>[] = [
    { cle: 'date', libelle: 'Date', rendu: (v) => <span className="text-muted">{dateFr(v.date_vente)}</span>, tri: (v) => v.date_vente },
    { cle: 'client', libelle: 'Client', rendu: (v) => <span className="font-semibold">{v.client_nom}</span>, tri: (v) => v.client_nom },
    { cle: 'montant', libelle: 'Montant', rendu: (v) => fcfa(v.montant_total), tri: (v) => v.montant_total, droite: true },
    { cle: 'paye', libelle: 'Payé', rendu: (v) => <span className="text-emerald-300">{fcfa(v.total_paye)}</span>, tri: (v) => v.total_paye, droite: true },
    { cle: 'reste', libelle: 'Reste', rendu: (v) => (v.reste_a_payer > 0.5 ? <span className="font-semibold">{fcfa(v.reste_a_payer)}</span> : <span className="text-muted">—</span>), tri: (v) => v.reste_a_payer, droite: true },
    { cle: 'statut', libelle: 'Mode', rendu: (v) => <Badge tone={TON[v.statut_paiement]}>{v.statut_display}</Badge>, tri: (v) => v.statut_display },
  ];

  if (ventes.chargement) return <EtatChargement texte="Chargement des ventes…" />;
  if (ventes.erreur) return <EtatErreur message={ventes.erreur} recharger={ventes.recharger} />;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader icon={Citrus} titre="Ventes" sousTitre="Chiffre d'affaires, encaissements et meilleurs clients" />
        <Link to="/jus/commercial" className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-black">
          <Store size={16} /> Nouvelle vente
        </Link>
      </div>

      <div className="mb-4"><Puces options={PERIODES} valeur={periode} onChange={setPeriode} /></div>

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tuile valeur={fcfa(ca)} libelle="Chiffre d'affaires" detail={`${dePeriode.length} vente(s) · ${clients} client(s)`} />
        <Tuile valeur={fcfa(paye)} libelle="Déjà payé" ton="ok" />
        <Tuile valeur={fcfa(reste)} libelle="Reste à encaisser" ton={reste > 0.5 ? 'danger' : undefined} />
        <Tuile valeur={fcfa(dePeriode.length ? ca / dePeriode.length : 0)} libelle="Vente moyenne" detail={ca ? `${Math.round((100 * paye) / ca)} % recouvré` : undefined} />
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-3">
        <GraphiqueMensuel
          className="lg:col-span-2"
          titre="Ventes et encaissements — 12 derniers mois"
          mois={mois}
          series={[
            { nom: 'Ventes', couleur: C_ORANGE, valeurs: parMois(toutes, (v) => v.date_vente, (v) => v.montant_total, mois) },
            { nom: 'Encaissé', couleur: C_BLEU, valeurs: parMois(paiements.donnees ?? [], (p) => p.date_paie, (p) => p.montant, mois) },
          ]}
        />
        <div className="space-y-4">
          <Barres titre="Meilleurs clients" lignes={parCategorie(dePeriode, (v) => v.client_nom, (v) => v.montant_total, 5)} couleur={(_, l) => (l === 'Autres' ? C_NEUTRE : C_ORANGE)} />
          <Barres titre="Par mode de vente" lignes={parCategorie(dePeriode, (v) => v.statut_display, (v) => v.montant_total)} couleur={() => C_ORANGE} />
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Recherche valeur={recherche} onChange={setRecherche} placeholder="Rechercher un client, un montant…" />
        <Puces options={FILTRES} valeur={filtre} onChange={setFiltre} compte={(f) => dePeriode.filter((v) => garde(v, f)).length} />
      </div>

      <TableTriable lignes={liste} colonnes={colonnes} cle={(v) => v.id} triInitial={{ cle: 'date', sens: -1 }} onLigne={setOuverte} vide="Aucune vente ne correspond." />

      {fraiche && (
        <FicheVente
          key={fraiche.id}
          vente={fraiche}
          onFermer={() => setOuverte(null)}
          onChange={() => {
            ventes.recharger();
            paiements.recharger();
          }}
        />
      )}
    </div>
  );
}
