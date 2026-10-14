import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, ShoppingCart } from 'lucide-react';
import { EtatChargement, EtatErreur } from '../../../components/ui/EtatRequete';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Badge } from '../../../components/ui/Table';
import { useAction, useApi } from '../../../lib/hooks/useApi';
import { listerCommandes, modifierCommande, type Commande } from '../../../lib/api/jus';
import { CarteCommande } from './EspaceCommercial';
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
  nombre,
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

type Filtre = 'toutes' | 'a_livrer' | 'livrees';
const FILTRES: { cle: Filtre; libelle: string }[] = [
  { cle: 'toutes', libelle: 'Toutes' },
  { cle: 'a_livrer', libelle: 'À livrer' },
  { cle: 'livrees', libelle: 'Livrées' },
];
const garde = (c: Commande, f: Filtre) => f === 'toutes' || (f === 'a_livrer' ? !c.est_completee : c.est_completee);
const age = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));

function FicheCommande({ commande, onFermer, onChange }: { commande: Commande; onFermer: () => void; onChange: () => void }) {
  const modification = useAction(modifierCommande);
  const [q33, setQ33] = useState(String(commande.quantite_33cl));
  const [q1l, setQ1l] = useState(String(commande.quantite_1l));
  const change = Number(q33) !== commande.quantite_33cl || Number(q1l) !== commande.quantite_1l;

  return (
    <Panneau titre={commande.client_nom} sousTitre={`Commande du ${dateFr(commande.date_cmd)}`} onFermer={onFermer}>
      <div className="flex items-center gap-2">
        {commande.est_completee ? <Badge tone="success">Livrée et facturée</Badge> : <Badge tone="warning">À livrer depuis {age(commande.date_cmd)} j</Badge>}
      </div>

      {commande.est_completee ? (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <Tuile valeur={nombre(commande.quantite_33cl)} libelle="Bouteilles 33 cl" />
            <Tuile valeur={nombre(commande.quantite_1l)} libelle="Bouteilles 1 L" />
            <Tuile valeur={fcfa(commande.total)} libelle="Total" />
          </div>
          <p className="text-sm text-muted">
            Cette commande est déjà livrée : le paiement se suit depuis la{' '}
            <Link to="/jus/commercial/factures" className="font-semibold text-accent2 hover:text-white">facture</Link> ou la{' '}
            <Link to="/jus/commercial/ventes" className="font-semibold text-accent2 hover:text-white">vente</Link>.
          </p>
        </div>
      ) : (
        <>
          <CarteCommande
            c={commande}
            onChange={() => {
              onChange();
            }}
          />
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await modification.executer(commande.id, { client: commande.client, quantite_33cl: Number(q33) || 0, quantite_1l: Number(q1l) || 0 });
                onChange();
              } catch {
                /* erreur affichée */
              }
            }}
            className="space-y-3 rounded-2xl border border-border p-4"
          >
            <p className="text-sm font-bold text-white">Corriger les quantités</p>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-muted">33 cl</span>
                <input type="number" min={0} inputMode="numeric" value={q33} onChange={(e) => setQ33(e.target.value)} className={CHAMP} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-muted">1 L</span>
                <input type="number" min={0} inputMode="numeric" value={q1l} onChange={(e) => setQ1l(e.target.value)} className={CHAMP} />
              </label>
            </div>
            {modification.erreur && <p className="text-xs font-semibold text-red-400">{modification.erreur}</p>}
            <button type="submit" disabled={!change || modification.enCours} className="rounded-xl bg-accent px-4 py-2 text-sm font-bold text-black disabled:opacity-40">
              {modification.enCours ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </form>
        </>
      )}
    </Panneau>
  );
}

/** Commandes : volumes commandés, carnet à livrer, clients qui commandent le plus. */
export default function Commandes() {
  const commandes = useApi(() => listerCommandes({ page_size: 5000 }), []);
  const [periode, setPeriode] = useState<Periode>('annee');
  const [filtre, setFiltre] = useState<Filtre>('toutes');
  const [recherche, setRecherche] = useState('');
  const [ouverte, setOuverte] = useState<Commande | null>(null);

  const toutes = commandes.donnees ?? [];
  const fraiche = ouverte ? toutes.find((x) => x.id === ouverte.id) : undefined;
  const dePeriode = useMemo(() => toutes.filter((c) => dansPeriode(c.date_cmd, periode)), [toutes, periode]);
  const q = recherche.trim().toLowerCase();
  const liste = useMemo(() => dePeriode.filter((c) => garde(c, filtre) && (!q || c.client_nom.toLowerCase().includes(q))), [dePeriode, filtre, q]);

  // Le carnet à livrer ne dépend pas de la période : une commande ancienne non livrée reste à traiter.
  const aLivrer = toutes.filter((c) => !c.est_completee);
  const valeurALivrer = aLivrer.reduce((s, c) => s + c.total, 0);
  const plusAncienne = aLivrer.reduce((m, c) => Math.max(m, age(c.date_cmd)), 0);
  const total = dePeriode.reduce((s, c) => s + c.total, 0);
  const b33 = dePeriode.reduce((s, c) => s + c.quantite_33cl, 0);
  const b1l = dePeriode.reduce((s, c) => s + c.quantite_1l, 0);
  const mois = douzeMois();

  const colonnes: Colonne<Commande>[] = [
    { cle: 'date', libelle: 'Date', rendu: (c) => <span className="text-muted">{dateFr(c.date_cmd)}</span>, tri: (c) => c.date_cmd },
    { cle: 'client', libelle: 'Client', rendu: (c) => <span className="font-semibold">{c.client_nom}</span>, tri: (c) => c.client_nom },
    { cle: 'q33', libelle: '33 cl', rendu: (c) => nombre(c.quantite_33cl), tri: (c) => c.quantite_33cl, droite: true },
    { cle: 'q1l', libelle: '1 L', rendu: (c) => nombre(c.quantite_1l), tri: (c) => c.quantite_1l, droite: true },
    { cle: 'total', libelle: 'Total', rendu: (c) => fcfa(c.total), tri: (c) => c.total, droite: true },
    {
      cle: 'statut',
      libelle: 'Statut',
      rendu: (c) => (c.est_completee ? <Badge tone="success">Livrée</Badge> : <Badge tone={age(c.date_cmd) > 7 ? 'danger' : 'warning'}>À livrer · {age(c.date_cmd)} j</Badge>),
      tri: (c) => (c.est_completee ? -1 : age(c.date_cmd)),
    },
  ];

  if (commandes.chargement) return <EtatChargement texte="Chargement des commandes…" />;
  if (commandes.erreur) return <EtatErreur message={commandes.erreur} recharger={commandes.recharger} />;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader icon={ShoppingCart} titre="Commandes" sousTitre="Volumes commandés et commandes à livrer" />
        <Link to="/jus/commercial" className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-black">
          <Plus size={16} /> Nouvelle commande
        </Link>
      </div>

      <div className="mb-4"><Puces options={PERIODES} valeur={periode} onChange={setPeriode} /></div>

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tuile valeur={String(aLivrer.length)} libelle="À livrer" detail={aLivrer.length ? `${fcfa(valeurALivrer)} · la plus ancienne : ${plusAncienne} j` : 'Rien en attente'} ton={plusAncienne > 7 ? 'danger' : undefined} />
        <Tuile valeur={fcfa(total)} libelle="Valeur commandée" detail={`${dePeriode.length} commande(s)`} />
        <Tuile valeur={nombre(b33)} libelle="Bouteilles 33 cl" />
        <Tuile valeur={nombre(b1l)} libelle="Bouteilles 1 L" />
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-3">
        <GraphiqueMensuel
          className="lg:col-span-2"
          titre="Bouteilles commandées — 12 derniers mois"
          mois={mois}
          format={(v) => `${nombre(v)} bouteilles`}
          series={[
            { nom: '33 cl', couleur: C_ORANGE, valeurs: parMois(toutes, (c) => c.date_cmd, (c) => c.quantite_33cl, mois) },
            { nom: '1 L', couleur: C_BLEU, valeurs: parMois(toutes, (c) => c.date_cmd, (c) => c.quantite_1l, mois) },
          ]}
        />
        <div className="space-y-4">
          <Barres titre="Clients qui commandent le plus" lignes={parCategorie(dePeriode, (c) => c.client_nom, (c) => c.total, 5)} couleur={(_, l) => (l === 'Autres' ? C_NEUTRE : C_ORANGE)} />
          <Barres titre="À livrer par client" lignes={parCategorie(aLivrer, (c) => c.client_nom, (c) => c.total, 5)} couleur={(_, l) => (l === 'Autres' ? C_NEUTRE : C_ORANGE)} />
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Recherche valeur={recherche} onChange={setRecherche} placeholder="Rechercher un client…" />
        <Puces options={FILTRES} valeur={filtre} onChange={setFiltre} compte={(f) => dePeriode.filter((c) => garde(c, f)).length} />
      </div>

      <TableTriable lignes={liste} colonnes={colonnes} cle={(c) => c.id} triInitial={{ cle: 'date', sens: -1 }} onLigne={setOuverte} vide="Aucune commande ne correspond." />

      {fraiche && (
        <FicheCommande
          key={fraiche.id}
          commande={fraiche}
          onFermer={() => setOuverte(null)}
          onChange={commandes.recharger}
        />
      )}
    </div>
  );
}
