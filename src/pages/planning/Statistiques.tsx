import { useState } from 'react';
import { BarChart3, CheckCircle2, ChevronDown, Lightbulb, Megaphone, User, Users, Video } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { EtatChargement, EtatErreur } from '../../components/ui/EtatRequete';
import { GraphiqueBarres } from '../../components/ui/GraphiqueBarres';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatTile } from '../../components/ui/StatTile';
import { useApi } from '../../lib/hooks/useApi';
import { LIBELLES_STATUT, listerClients, statistiques, type StatutEvenement } from '../../lib/api/planning';

const MOIS_COURT = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

// Couleurs validées CVD-safe (dataviz skill, palette de référence, slots 1 et 2).
const COULEUR_TOURNAGES = '#d95926';
const COULEUR_PUBLICATIONS = '#3987e5';
const COULEUR_NON_REALISE = '#52514e';

// Mêmes couleurs de statut que les calendriers (Tournages.tsx, Publications.tsx, etc.) —
// une teinte par statut déjà connue des utilisateurs, pas une nouvelle échelle.
const COULEUR_STATUT: Record<StatutEvenement, string> = {
  pending: '#facc15',
  completed: '#34d399',
  not_realized: '#f87171',
  cancelled: '#6b7280',
  rescheduled: '#60a5fa',
};
const ORDRE_STATUTS: StatutEvenement[] = ['completed', 'pending', 'not_realized', 'rescheduled', 'cancelled'];

type Periode = 'semaine' | 'mois' | 'annee';

export default function Statistiques() {
  const clients = useApi(listerClients, []);
  const [clientId, setClientId] = useState('all');
  const { donnees, chargement, erreur, recharger } = useApi(() => statistiques(clientId), [clientId]);
  const [periode, setPeriode] = useState<Periode>('mois');

  const clientNom = clientId === 'all' ? null : clients.donnees?.find((c) => String(c.id) === clientId)?.nom_entreprise ?? null;

  if (chargement) return <EtatChargement texte="Chargement des statistiques…" />;
  if (erreur || !donnees) return <EtatErreur message={erreur ?? 'Indisponible'} recharger={recharger} />;

  const totalTournages = donnees.statuts.tournages.completed;
  const totalPublications = donnees.statuts.publications.completed;
  const semaineCourante = donnees.par_semaine[donnees.par_semaine.length - 1];
  const moisCourant = donnees.par_mois[donnees.par_mois.length - 1];

  const etiquettes =
    periode === 'semaine'
      ? donnees.par_semaine.map((p) => new Date(p.debut + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }))
      : periode === 'mois'
        ? donnees.par_mois.map((p) => `${MOIS_COURT[p.mois - 1]} ${String(p.annee).slice(2)}`)
        : donnees.par_annee.map((p) => String(p.annee));

  const donneesPeriode = periode === 'semaine' ? donnees.par_semaine : periode === 'mois' ? donnees.par_mois : donnees.par_annee;

  const clientsTries = [...donnees.par_client].sort((a, b) => b.tournages + b.publications - (a.tournages + a.publications));
  const maxClient = Math.max(1, ...clientsTries.map((c) => c.tournages + c.publications));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={BarChart3}
        titre="Statistiques"
        sousTitre={clientNom ? `Contenu réalisé — ${clientNom}` : 'Contenu réalisé — tournages et publications complétés'}
      />

      <Card className="relative overflow-hidden !bg-gradient-to-br !from-surface !via-surface !to-accent/10 !p-5">
        <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">
          <User size={12} /> Filtrer par client
        </label>
        <div className="flex items-center gap-3">
          <div className="relative max-w-xs flex-1">
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full appearance-none rounded-xl border border-border bg-surface2 px-3.5 py-2.5 text-sm font-semibold text-white transition-colors hover:border-accent/50 focus:border-accent focus:outline-none"
            >
              <option value="all">Tous les clients</option>
              {(clients.donnees ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom_entreprise}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-muted" />
          </div>
          {clientNom && (
            <button onClick={() => setClientId('all')} className="text-xs font-bold text-accent2 hover:text-white">
              Réinitialiser
            </button>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile icon={CheckCircle2} valeur={totalTournages + totalPublications} libelle="Total réalisé" teinte="#4ade80" />
        <StatTile icon={Video} valeur={totalTournages} libelle="Tournages réalisés" teinte={COULEUR_TOURNAGES} />
        <StatTile icon={Megaphone} valeur={totalPublications} libelle="Publications réalisées" teinte={COULEUR_PUBLICATIONS} />
        <StatTile
          icon={CheckCircle2}
          valeur={semaineCourante.tournages + semaineCourante.publications}
          libelle="Réalisé cette semaine"
          teinte="#facc15"
        />
        {!clientNom && (
          <StatTile icon={Users} valeur={`${donnees.clients.actifs}/${donnees.clients.total}`} libelle="Clients actifs" teinte="#60a5fa" />
        )}
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-white">Contenu réalisé dans le temps</h2>
            <p className="text-xs text-muted">
              {periode === 'mois'
                ? `${moisCourant.tournages + moisCourant.publications} ce mois-ci`
                : periode === 'semaine'
                  ? `${semaineCourante.tournages + semaineCourante.publications} cette semaine`
                  : null}
            </p>
          </div>
          <div className="flex gap-1 rounded-xl border border-border bg-surface2 p-1">
            {(['semaine', 'mois', 'annee'] as Periode[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriode(p)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold capitalize transition-colors ${
                  periode === p ? 'bg-accent text-black' : 'text-muted hover:text-white'
                }`}
              >
                {p === 'annee' ? 'Année' : p}
              </button>
            ))}
          </div>
        </div>

        <GraphiqueBarres
          etiquettes={etiquettes}
          series={[
            { nom: 'Tournages', couleur: COULEUR_TOURNAGES, valeurs: donneesPeriode.map((p) => p.tournages) },
            { nom: 'Publications', couleur: COULEUR_PUBLICATIONS, valeurs: donneesPeriode.map((p) => p.publications) },
          ]}
        />
      </Card>

      {!clientNom && (
      <Card>
        <h2 className="mb-1 text-sm font-bold text-white">Par client</h2>
        <p className="mb-4 text-xs text-muted">Réalisé vs non réalisé, tous temps confondus</p>
        {clientsTries.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted">Aucun client pour le moment.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {clientsTries.map((c) => {
              const total = c.tournages + c.publications;
              const nonRealise = c.tournages_non_realises + c.publications_non_realisees;
              const maxLigne = Math.max(maxClient, total + nonRealise);
              return (
                <div key={c.client} className="flex items-center gap-3">
                  <span className="w-24 shrink-0 truncate text-xs font-semibold text-white">{c.client}</span>
                  <div className="flex h-5 flex-1 overflow-hidden rounded-md bg-surface2">
                    {c.tournages > 0 && (
                      <div
                        className="h-full"
                        style={{ width: `${(c.tournages / maxLigne) * 100}%`, background: COULEUR_TOURNAGES }}
                        title={`${c.tournages} tournages réalisés`}
                      />
                    )}
                    {c.publications > 0 && (
                      <div
                        className="h-full"
                        style={{ width: `${(c.publications / maxLigne) * 100}%`, background: COULEUR_PUBLICATIONS }}
                        title={`${c.publications} publications réalisées`}
                      />
                    )}
                    {nonRealise > 0 && (
                      <div
                        className="h-full opacity-50"
                        style={{ width: `${(nonRealise / maxLigne) * 100}%`, background: COULEUR_NON_REALISE }}
                        title={`${nonRealise} non réalisé (en attente, annulé, non réalisé…)`}
                      />
                    )}
                  </div>
                  <span className="w-10 shrink-0 text-right text-xs font-bold tabular-nums text-white">{total}</span>
                </div>
              );
            })}
          </div>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-border pt-3 text-[11px] text-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm" style={{ background: COULEUR_TOURNAGES }} /> Tournages réalisés
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm" style={{ background: COULEUR_PUBLICATIONS }} /> Publications réalisées
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm opacity-50" style={{ background: COULEUR_NON_REALISE }} /> Non réalisé
          </span>
        </div>
      </Card>
      )}

      <Card>
        <h2 className="mb-1 text-sm font-bold text-white">Statuts détaillés</h2>
        <p className="mb-4 text-xs text-muted">Tous les tournages et publications, quel que soit leur statut</p>
        <div className="flex flex-col gap-4">
          {(
            [
              { icone: Video, libelle: 'Tournages', compte: donnees.statuts.tournages },
              { icone: Megaphone, libelle: 'Publications', compte: donnees.statuts.publications },
            ] as const
          ).map(({ icone: Icone, libelle, compte }) => {
            const total = Object.values(compte).reduce((s, v) => s + v, 0);
            return (
              <div key={libelle}>
                <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-white">
                  <Icone size={13} className="text-accent2" /> {libelle} <span className="text-muted">({total})</span>
                </div>
                <div className="flex h-5 overflow-hidden rounded-md bg-surface2">
                  {ORDRE_STATUTS.map(
                    (s) =>
                      compte[s] > 0 && (
                        <div
                          key={s}
                          className="h-full"
                          style={{ width: `${(compte[s] / Math.max(total, 1)) * 100}%`, background: COULEUR_STATUT[s] }}
                          title={`${compte[s]} ${LIBELLES_STATUT[s].toLowerCase()}`}
                        />
                      ),
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-border pt-3 text-[11px] text-muted">
          {ORDRE_STATUTS.map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: COULEUR_STATUT[s] }} /> {LIBELLES_STATUT[s]}
            </span>
          ))}
        </div>
      </Card>

      <Card>
        <div className="mb-1 flex items-center gap-1.5">
          <Lightbulb size={14} className="text-accent2" />
          <h2 className="text-sm font-bold text-white">Idées de contenu réalisées</h2>
        </div>
        <p className="mb-4 text-xs text-muted">
          {donnees.idees.realisees} sur {donnees.idees.total} idées ont donné lieu à un tournage ou une publication complétés
        </p>
        <div className="flex flex-col gap-3">
          {donnees.idees.par_type.map((t) => (
            <div key={t.type} className="flex items-center gap-3">
              <span className="w-14 shrink-0 truncate text-xs font-semibold capitalize text-white">{t.type}</span>
              <div className="h-5 flex-1 overflow-hidden rounded-md bg-surface2">
                {t.total > 0 && (
                  <div
                    className="h-full rounded-md bg-accent"
                    style={{ width: `${(t.realisees / t.total) * 100}%` }}
                    title={`${t.realisees} réalisées sur ${t.total}`}
                  />
                )}
              </div>
              <span className="w-14 shrink-0 text-right text-xs font-bold tabular-nums text-white">
                {t.realisees}/{t.total}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
