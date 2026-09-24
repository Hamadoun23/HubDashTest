import { useState } from 'react';
import {
  AlertTriangle,
  CalendarRange,
  ChevronDown,
  ChevronUp,
  Clapperboard,
  FileDown,
  Lightbulb,
  Megaphone,
  User,
  Users,
  Video,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatTile } from '../../components/ui/StatTile';
import { Badge } from '../../components/ui/Table';
import { useAction, useApi } from '../../lib/hooks/useApi';
import { DetailEvenementModale } from './ModaleJour';
import {
  LIBELLES_STATUT,
  genererRapportGlobal,
  listerClients,
  listerIdees,
  tableauDeBord,
  type PeriodeRapport,
  type Publication,
  type StatutEvenement,
  type Tournage,
} from '../../lib/api/planning';
import { CalendrierPlanning } from './CalendrierPlanning';

const PERIODES: { valeur: PeriodeRapport; libelle: string }[] = [
  { valeur: 'weekly', libelle: 'Hebdo' },
  { valeur: 'monthly', libelle: 'Mensuel' },
  { valeur: 'annual', libelle: 'Annuel' },
];

const maintenant = new Date();

const TONE: Record<StatutEvenement, 'success' | 'warning' | 'danger' | 'neutral'> = {
  completed: 'success',
  pending: 'warning',
  not_realized: 'danger',
  cancelled: 'neutral',
  rescheduled: 'warning',
};

type EvenementAffiche =
  | { type: 'tournage'; evenement: Tournage }
  | { type: 'publication'; evenement: Publication };

function trierParDate(evenements: EvenementAffiche[]) {
  return [...evenements].sort(
    (a, b) => new Date(a.evenement.date).getTime() - new Date(b.evenement.date).getTime(),
  );
}

/** Le nom affiché : la description saisie si elle existe (la plus parlante,
 * ex. "Fête de l'armée"), sinon le titre de l'idée de contenu associée
 * (ex. "Vlog") — aucun des deux modèles n'a de champ "titre" dédié. */
function nomEvenement(item: EvenementAffiche): string {
  const { evenement } = item;
  if (evenement.description?.trim()) return evenement.description.trim();
  if (item.type === 'publication') return item.evenement.content_idea_detail?.titre || 'Sans titre';
  const idees = item.evenement.content_ideas_detail;
  return idees && idees.length > 0 ? idees.map((i) => i.titre).join(', ') : 'Sans titre';
}

function CarteProchainEvenement({ item, onVoir }: { item: EvenementAffiche; onVoir: () => void }) {
  const { evenement } = item;
  const Icon = item.type === 'tournage' ? Video : Megaphone;
  const idee =
    item.type === 'publication'
      ? item.evenement.content_idea_detail?.titre
      : item.evenement.content_ideas_detail.map((i) => i.titre).join(', ') || undefined;
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface2 p-3">
      <div className="flex items-center gap-3 overflow-hidden">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15">
          <Icon size={15} className="text-accent2" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">
            {evenement.client_nom}
            {idee && <span className="font-normal text-muted"> — {idee}</span>}
          </p>
          <p className="text-xs text-muted">
            {new Date(evenement.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
          </p>
        </div>
      </div>
      <button onClick={onVoir} className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-black">
        Voir
      </button>
    </div>
  );
}

function LigneEvenement({ item, enRetard }: { item: EvenementAffiche; enRetard?: boolean }) {
  const { evenement } = item;
  const Icon = item.type === 'tournage' ? Video : Megaphone;
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-2xl border p-3 ${
        enRetard ? 'border-red-500/30 bg-red-500/10' : 'border-border bg-surface2'
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
          style={{ background: enRetard ? '#f8717126' : '#ff8a4c26' }}
        >
          <Icon size={14} color={enRetard ? '#f87171' : '#ff8a4c'} />
        </span>
        <div>
          <p className="text-sm font-semibold text-white">
            {evenement.client_nom} <span className="font-normal text-muted">— {nomEvenement(item)}</span>
          </p>
          <p className="text-xs text-muted">
            {item.type === 'tournage' ? 'Tournage' : 'Publication'} ·{' '}
            {new Date(evenement.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
          </p>
        </div>
      </div>
      <Badge tone={enRetard ? 'danger' : TONE[evenement.status]}>{LIBELLES_STATUT[evenement.status]}</Badge>
    </div>
  );
}

function FiltreRapport({
  clients,
  clientId,
  onClientChange,
}: {
  clients: { id: number; nom_entreprise: string }[];
  clientId: string;
  onClientChange: (v: string) => void;
}) {
  const [periode, setPeriode] = useState<PeriodeRapport>('monthly');
  const generation = useAction(genererRapportGlobal);

  return (
    <Card className="relative overflow-hidden !bg-gradient-to-br !from-surface !via-surface !to-accent/10 !p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:gap-3">
        <div className="min-w-0 flex-1">
          <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">
            <User size={12} /> Client affiché
          </label>
          <div className="relative">
            <select
              value={clientId}
              onChange={(e) => onClientChange(e.target.value)}
              className="w-full appearance-none rounded-xl border border-border bg-surface2 px-3.5 py-2.5 text-sm font-semibold text-white transition-colors hover:border-accent/50 focus:border-accent focus:outline-none"
            >
              <option value="all">Tous les clients</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom_entreprise}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-muted" />
          </div>
        </div>

        <div className="hidden h-10 w-px shrink-0 bg-border md:block" />

        <div className="min-w-0 flex-1">
          <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">
            <CalendarRange size={12} /> Période du rapport
          </label>
          <div className="flex gap-1 rounded-xl border border-border bg-surface2 p-1">
            {PERIODES.map((p) => (
              <button
                key={p.valeur}
                type="button"
                onClick={() => setPeriode(p.valeur)}
                className={`flex-1 rounded-lg px-2 py-2 text-xs font-bold transition-all ${
                  periode === p.valeur ? 'bg-accent text-black shadow-sm shadow-accent/30' : 'text-muted hover:bg-surface hover:text-white'
                }`}
              >
                {p.libelle}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => generation.executer(periode, clientId)}
          disabled={generation.enCours}
          className="flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-accent px-5 py-2.5 text-xs font-bold text-black shadow-lg shadow-accent/20 transition-transform hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100 md:w-auto"
        >
          <FileDown size={14} /> {generation.enCours ? 'Génération...' : 'Générer le rapport'}
        </button>
      </div>
    </Card>
  );
}

export default function TableauDeBordPlanning() {
  const clients = useApi(listerClients, []);
  const idees = useApi(listerIdees, []);
  const [clientId, setClientId] = useState('all');
  const bord = useApi(
    () => tableauDeBord(maintenant.getMonth() + 1, maintenant.getFullYear(), clientId),
    [clientId],
  );
  const [voirTout, setVoirTout] = useState(false);
  const [voirDetail, setVoirDetail] = useState<EvenementAffiche | null>(null);
  const clientNom = clientId === 'all' ? null : clients.donnees?.find((c) => String(c.id) === clientId)?.nom_entreprise ?? null;

  const donnees = bord.donnees;
  const enRetard: EvenementAffiche[] = trierParDate([
    ...(donnees?.tournages_en_retard.map((t) => ({ type: 'tournage' as const, evenement: t })) ?? []),
    ...(donnees?.publications_en_retard.map((p) => ({ type: 'publication' as const, evenement: p })) ?? []),
  ]);
  const aVenir: EvenementAffiche[] = trierParDate([
    ...(donnees?.tournages_a_venir.map((t) => ({ type: 'tournage' as const, evenement: t })) ?? []),
    ...(donnees?.publications_a_venir.map((p) => ({ type: 'publication' as const, evenement: p })) ?? []),
  ]);
  const totalRetard = enRetard.length;

  // En retard d'abord (le plus urgent), puis à venir : un seul élément par
  // client par défaut — le reste (souvent plusieurs dizaines de lignes,
  // toutes "en attente") n'apparaît qu'au clic sur "Voir plus".
  const activite = [
    ...enRetard.map((item) => ({ item, enRetard: true })),
    ...aVenir.map((item) => ({ item, enRetard: false })),
  ];
  const dejaVus = new Set<string>();
  const unParClient = activite.filter(({ item }) => {
    const client = item.evenement.client_nom;
    if (dejaVus.has(client)) return false;
    dejaVus.add(client);
    return true;
  });
  const activiteAffichee = voirTout ? activite : unParClient;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={Clapperboard}
        titre="Planning"
        sousTitre="Gérez vos plannings et générez des rapports en un clic"
      />

      <FiltreRapport clients={clients.donnees ?? []} clientId={clientId} onClientChange={setClientId} />

      {clientNom && (
        <div className="flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-4 py-2.5 text-xs font-semibold text-accent2">
          <User size={13} /> Vue filtrée sur <span className="text-white">{clientNom}</span>
          <button onClick={() => setClientId('all')} className="ml-auto font-bold text-muted hover:text-white">
            Réinitialiser
          </button>
        </div>
      )}

      <div className={`grid gap-4 ${totalRetard > 0 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
        {clientNom ? (
          <StatTile
            icon={Megaphone}
            valeur={bord.donnees?.stats.publications_this_month ?? '—'}
            libelle="Publications ce mois"
            teinte="#60a5fa"
          />
        ) : (
          <StatTile icon={Users} valeur={clients.donnees?.length ?? '—'} libelle="Clients suivis" teinte="#60a5fa" />
        )}
        <StatTile
          icon={Video}
          valeur={bord.donnees?.stats.shootings_this_month ?? '—'}
          libelle="Tournages ce mois"
          teinte="#ff8a4c"
        />
        <StatTile icon={Lightbulb} valeur={idees.donnees?.length ?? '—'} libelle="Idées en cours" teinte="#facc15" />
        {totalRetard > 0 && (
          <StatTile icon={AlertTriangle} valeur={totalRetard} libelle="En retard" teinte="#f87171" />
        )}
      </div>

      {donnees && (
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">Activité récente{clientNom ? ` — ${clientNom}` : ''}</h2>
            {activite.length > unParClient.length && (
              <button
                onClick={() => setVoirTout((v) => !v)}
                className="flex items-center gap-1 text-xs font-semibold text-accent2 hover:text-white"
              >
                {voirTout ? (
                  <>
                    Voir moins <ChevronUp size={13} />
                  </>
                ) : (
                  <>
                    Voir plus ({activite.length - unParClient.length}) <ChevronDown size={13} />
                  </>
                )}
              </button>
            )}
          </div>
          <div className="mt-4 flex flex-col gap-2">
            {activite.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted">Aucun tournage ni publication en retard ou à venir.</p>
            ) : (
              activiteAffichee.map(({ item, enRetard }) => (
                <LigneEvenement key={`${enRetard ? 'retard' : 'avenir'}-${item.type}-${item.evenement.id}`} item={item} enRetard={enRetard} />
              ))
            )}
          </div>
        </Card>
      )}

      <CalendrierPlanning clientId={clientId} clientNom={clientNom} />

      {donnees && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <h2 className="mb-3 text-sm font-bold text-white">Prochains tournages</h2>
            {donnees.tournages_prochains.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted">Aucun tournage à venir.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {donnees.tournages_prochains.map((t) => (
                  <CarteProchainEvenement
                    key={t.id}
                    item={{ type: 'tournage', evenement: t }}
                    onVoir={() => setVoirDetail({ type: 'tournage', evenement: t })}
                  />
                ))}
              </div>
            )}
          </Card>

          <Card>
            <h2 className="mb-3 text-sm font-bold text-white">Prochaines publications</h2>
            {donnees.publications_prochains.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted">Aucune publication à venir.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {donnees.publications_prochains.map((p) => (
                  <CarteProchainEvenement
                    key={p.id}
                    item={{ type: 'publication', evenement: p }}
                    onVoir={() => setVoirDetail({ type: 'publication', evenement: p })}
                  />
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {voirDetail && (
        <DetailEvenementModale item={voirDetail} onFermer={() => setVoirDetail(null)} onChange={bord.recharger} />
      )}
    </div>
  );
}
