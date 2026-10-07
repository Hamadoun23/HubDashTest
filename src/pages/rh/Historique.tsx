import { useMemo, useState } from 'react';
import { ChevronRight, FileText, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { EtatChargement, EtatErreur } from '../../components/ui/EtatRequete';
import { PageHeader } from '../../components/ui/PageHeader';
import { Badge, TableVirtus } from '../../components/ui/Table';
import { useApi } from '../../lib/hooks/useApi';
import { chargerHistorique, type CategorieHistorique, type LigneHistorique } from '../../lib/api/dossiers';

type FiltreStatut = 'TOUS' | 'EN_COURS' | 'APPROUVE' | 'REJETE' | 'ANNULE';

const TYPES: { cle: CategorieHistorique | 'TOUS'; libelle: string }[] = [
  { cle: 'TOUS', libelle: 'Tout' },
  { cle: 'CONGE', libelle: 'Congés' },
  { cle: 'PERMISSION', libelle: 'Permissions' },
  { cle: 'RETARD', libelle: 'Retards' },
  { cle: 'FINANCE', libelle: 'Demandes financières' },
];

const STATUTS: { cle: FiltreStatut; libelle: string }[] = [
  { cle: 'TOUS', libelle: 'Tous les statuts' },
  { cle: 'EN_COURS', libelle: 'En cours' },
  { cle: 'APPROUVE', libelle: 'Approuvées' },
  { cle: 'REJETE', libelle: 'Refusées' },
  { cle: 'ANNULE', libelle: 'Annulées' },
];

function famille(statut: string): FiltreStatut {
  if (statut === 'APPROUVE' || statut === 'CLOTURE') return 'APPROUVE';
  if (statut === 'REJETE') return 'REJETE';
  if (statut === 'ANNULE') return 'ANNULE';
  return 'EN_COURS';
}

const TONE: Record<FiltreStatut, 'success' | 'danger' | 'warning' | 'neutral'> = {
  TOUS: 'neutral',
  EN_COURS: 'warning',
  APPROUVE: 'success',
  REJETE: 'danger',
  ANNULE: 'neutral',
};

const DATE = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });

/**
 * Toutes les demandes — congés, permissions, retards et demandes financières —
 * quel que soit leur sort : en cours, approuvées, refusées, annulées. Chacun
 * voit les siennes, un responsable celles de son équipe, le back-office tout.
 * Un clic ouvre le dossier (circuit, échanges, versions).
 */
export default function Historique() {
  const navigate = useNavigate();
  const { donnees, chargement, erreur, recharger } = useApi(chargerHistorique, []);
  const [type, setType] = useState<CategorieHistorique | 'TOUS'>('TOUS');
  const [statut, setStatut] = useState<FiltreStatut>('TOUS');
  const [recherche, setRecherche] = useState('');

  const toutes = donnees ?? [];
  const filtrees = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return toutes.filter(
      (l) =>
        (type === 'TOUS' || l.categorie === type) &&
        (statut === 'TOUS' || famille(l.statut) === statut) &&
        (!q || `${l.numero} ${l.demandeur_nom} ${l.type}`.toLowerCase().includes(q)),
    );
  }, [toutes, type, statut, recherche]);

  const compte = (s: FiltreStatut) =>
    toutes.filter((l) => (type === 'TOUS' || l.categorie === type) && (s === 'TOUS' || famille(l.statut) === s)).length;

  if (chargement) return <EtatChargement texte="Chargement de l'historique…" />;
  if (erreur) return <EtatErreur message={erreur} recharger={recharger} />;

  const ouvrir = (l: LigneHistorique) => navigate(`/rh/dossiers/${l.source}/${l.id}`);

  return (
    <div>
      <PageHeader icon={FileText} titre="Historique" sousTitre="Toutes les demandes : congés, permissions, retards et demandes financières" />

      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {TYPES.map((t) => (
            <button
              key={t.cle}
              type="button"
              onClick={() => setType(t.cle)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                type === t.cle ? 'bg-accent text-black' : 'bg-surface2 text-muted hover:text-white'
              }`}
            >
              {t.libelle}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {STATUTS.map((s) => (
            <button
              key={s.cle}
              type="button"
              onClick={() => setStatut(s.cle)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                statut === s.cle ? 'border-accent bg-accent/15 text-accent2' : 'border-border text-muted hover:text-white'
              }`}
            >
              {s.libelle} <span className="opacity-70">({compte(s.cle)})</span>
            </button>
          ))}
          <label className="relative ml-auto w-full sm:max-w-xs">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Référence, collaborateur, objet…"
              className="w-full rounded-xl border border-border bg-surface2 py-2 pl-9 pr-3 text-sm text-white placeholder:text-muted focus:border-accent focus:outline-none"
            />
          </label>
        </div>
      </div>

      {filtrees.length === 0 ? (
        <p className="rounded-3xl border border-border bg-surface p-8 text-center text-sm text-muted">
          Aucune demande ne correspond à ces filtres.
        </p>
      ) : (
        <TableVirtus
          colonnes={['Référence', 'Collaborateur', 'Type', 'Période / montant', 'Demandée le', 'Statut']}
          onRowClick={(i) => ouvrir(filtrees[i])}
          lignes={filtrees.map((l) => [
            <span className="font-semibold text-white">
              {l.numero}
              <ChevronRight size={13} className="ml-0.5 inline text-accent2" aria-hidden />
            </span>,
            l.demandeur_nom,
            <span className="block max-w-[22rem] truncate" title={l.type}>
              {l.type}
            </span>,
            l.detail || '—',
            l.cree_le ? DATE.format(new Date(l.cree_le)) : '—',
            <Badge tone={TONE[famille(l.statut)]}>{l.statut_libelle}</Badge>,
          ])}
        />
      )}
    </div>
  );
}
