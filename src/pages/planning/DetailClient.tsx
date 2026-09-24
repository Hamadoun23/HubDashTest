import { useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Download,
  FileText,
  Megaphone,
  Trash2,
  Upload,
  Video,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { EtatChargement, EtatErreur } from '../../components/ui/EtatRequete';
import { PageHeader } from '../../components/ui/PageHeader';
import { Badge } from '../../components/ui/Table';
import { useAction, useApi } from '../../lib/hooks/useApi';
import {
  LIBELLES_STATUT,
  calendrierClient,
  genererRapportPlanning,
  reglesClient,
  supprimerRapportClient,
  telechargerRapportClient,
  uploaderRapportClient,
  type RapportClient,
  type StatutEvenement,
} from '../../lib/api/planning';
import { nomEvenement, type EvenementAffiche } from './evenementUtils';
import { ModaleJour } from './ModaleJour';

const maintenant = new Date();

const MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

const COULEUR_STATUT: Record<StatutEvenement, string> = {
  pending: '#facc15',
  completed: '#34d399',
  not_realized: '#f87171',
  cancelled: '#6b7280',
  rescheduled: '#60a5fa',
};

const TONE: Record<StatutEvenement, 'success' | 'warning' | 'danger' | 'neutral'> = {
  completed: 'success',
  pending: 'warning',
  not_realized: 'danger',
  cancelled: 'neutral',
  rescheduled: 'warning',
};

function ListeEvenements({ titre, items }: { titre: string; items: EvenementAffiche[] }) {
  const [voirTout, setVoirTout] = useState(false);
  const affiches = voirTout ? items : items.slice(0, 5);
  return (
    <Card>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-white">{titre}</h2>
        {items.length > 5 && (
          <button onClick={() => setVoirTout((v) => !v)} className="flex items-center gap-1 text-xs font-semibold text-accent2 hover:text-white">
            {voirTout ? (
              <>
                Voir moins <ChevronUp size={13} />
              </>
            ) : (
              <>
                Voir plus ({items.length - 5}) <ChevronDown size={13} />
              </>
            )}
          </button>
        )}
      </div>
      <div className="mt-3 flex flex-col gap-2">
        {items.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted">Rien ici.</p>
        ) : (
          affiches.map((item) => {
            const Icon = item.type === 'tournage' ? Video : Megaphone;
            return (
              <div key={`${item.type}-${item.evenement.id}`} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface2 p-3">
                <div className="flex items-center gap-3 overflow-hidden">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/15">
                    <Icon size={14} className="text-accent2" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{nomEvenement(item)}</p>
                    <p className="text-xs text-muted">
                      {new Date(item.evenement.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                </div>
                <Badge tone={TONE[item.evenement.status]}>{LIBELLES_STATUT[item.evenement.status]}</Badge>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}

function FormulaireUploadRapport({
  type,
  clientId,
  onTelecharge,
}: {
  type: 'monthly' | 'annual';
  clientId: number;
  onTelecharge: () => void;
}) {
  const upload = useAction(uploaderRapportClient);
  const inputFichier = useRef<HTMLInputElement>(null);
  const [dateRapport, setDateRapport] = useState('');
  const [fichier, setFichier] = useState<File | null>(null);

  async function envoyer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!fichier || !dateRapport) return;
    // report_date backend est un DateField complet (YYYY-MM-DD) : on dérive le
    // premier jour du mois/de l'année choisie à partir des inputs simplifiés.
    const reportDate = type === 'monthly' ? `${dateRapport}-01` : `${dateRapport}-01-01`;
    await upload.executer(clientId, { report_type: type, report_date: reportDate, file: fichier });
    setDateRapport('');
    setFichier(null);
    if (inputFichier.current) inputFichier.current.value = '';
    onTelecharge();
  }

  return (
    <form onSubmit={envoyer} className="mb-2 flex flex-wrap items-center gap-1.5 rounded-xl border border-dashed border-border bg-surface2/60 p-2.5">
      <input
        type={type === 'monthly' ? 'month' : 'number'}
        value={dateRapport}
        onChange={(e) => setDateRapport(e.target.value)}
        placeholder={type === 'annual' ? 'Année' : undefined}
        required
        className="w-28 rounded-lg border border-border bg-surface2 px-2 py-1.5 text-xs text-white focus:border-accent focus:outline-none"
      />
      <input
        ref={inputFichier}
        type="file"
        accept="application/pdf"
        onChange={(e) => setFichier(e.target.files?.[0] ?? null)}
        required
        className="flex-1 text-xs text-muted file:mr-2 file:rounded-lg file:border-0 file:bg-accent/15 file:px-2 file:py-1 file:text-xs file:font-semibold file:text-accent2"
      />
      <button
        type="submit"
        disabled={upload.enCours || !fichier || !dateRapport}
        className="flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1.5 text-[11px] font-bold text-black disabled:opacity-50"
      >
        <Upload size={12} /> {upload.enCours ? 'Envoi...' : 'Ajouter'}
      </button>
      {upload.erreur && <p className="w-full text-[11px] font-semibold text-red-400">{upload.erreur}</p>}
    </form>
  );
}

function ListeRapports({
  titre,
  type,
  rapports,
  clientId,
  onChange,
}: {
  titre: string;
  type: 'monthly' | 'annual';
  rapports: RapportClient[];
  clientId: number;
  onChange: () => void;
}) {
  const suppression = useAction(supprimerRapportClient);

  async function supprimer(rapportId: number) {
    if (!confirm('Supprimer ce rapport ?')) return;
    await suppression.executer(clientId, rapportId);
    onChange();
  }

  return (
    <div>
      <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted">
        {titre} <span className="rounded-full bg-surface2 px-2 py-0.5 text-[10px] text-white">{rapports.length}</span>
      </h3>
      <FormulaireUploadRapport type={type} clientId={clientId} onTelecharge={onChange} />
      {rapports.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface2 p-4 text-center text-xs text-muted">Aucun rapport téléversé.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {rapports.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface2 p-3">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <FileText size={16} className="shrink-0 text-accent2" />
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-white">{r.original_filename}</p>
                  <p className="text-[11px] text-muted">
                    {r.report_date ? `${r.report_date} · ` : ''}
                    {(r.file_size / 1024).toFixed(0)} Ko
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  onClick={() => telechargerRapportClient(clientId, r)}
                  title="Télécharger"
                  className="rounded-lg border border-border p-1.5 text-muted hover:text-white"
                >
                  <Download size={14} />
                </button>
                <button
                  onClick={() => supprimer(r.id)}
                  disabled={suppression.enCours}
                  title="Supprimer"
                  className="rounded-lg border border-border p-1.5 text-muted hover:text-red-400 disabled:opacity-50"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DetailClient() {
  const { id } = useParams();
  const clientId = Number(id);
  const [periode, setPeriode] = useState({ mois: maintenant.getMonth() + 1, annee: maintenant.getFullYear() });
  const [genereEnCours, setGenereEnCours] = useState<'monthly' | 'annual' | null>(null);
  const [jourOuvert, setJourOuvert] = useState<string | null>(null);

  const donnees = useApi(() => calendrierClient(clientId, periode.mois, periode.annee), [clientId, periode.mois, periode.annee]);
  const regles = useApi(() => reglesClient(clientId), [clientId]);

  function changerMois(delta: number) {
    setPeriode((p) => {
      const total = p.mois - 1 + delta;
      const annee = p.annee + Math.floor(total / 12);
      const mois = ((total % 12) + 12) % 12;
      return { mois: mois + 1, annee };
    });
  }

  async function generer(type: 'monthly' | 'annual') {
    setGenereEnCours(type);
    try {
      await genererRapportPlanning(clientId, type, periode.mois, periode.annee);
    } finally {
      setGenereEnCours(null);
    }
  }

  if (donnees.chargement) return <EtatChargement texte="Chargement du client…" />;
  if (donnees.erreur || !donnees.donnees) return <EtatErreur message={donnees.erreur ?? 'Indisponible'} recharger={donnees.recharger} />;

  const { client, calendrier, stats, tournages_a_venir, publications_a_venir, tournages_recents, publications_recentes, rapports_mensuels, rapports_annuels } =
    donnees.donnees;

  const aVenir: EvenementAffiche[] = [
    ...tournages_a_venir.map((t) => ({ type: 'tournage' as const, evenement: t })),
    ...publications_a_venir.map((p) => ({ type: 'publication' as const, evenement: p })),
  ].sort((a, b) => new Date(a.evenement.date).getTime() - new Date(b.evenement.date).getTime());
  const recents: EvenementAffiche[] = [
    ...tournages_recents.map((t) => ({ type: 'tournage' as const, evenement: t })),
    ...publications_recentes.map((p) => ({ type: 'publication' as const, evenement: p })),
  ].sort((a, b) => new Date(b.evenement.date).getTime() - new Date(a.evenement.date).getTime());

  const jourSelectionne = jourOuvert ? calendrier.flat().find((j) => j.date === jourOuvert) ?? null : null;

  return (
    <div className="flex flex-col gap-4">
      <Link to="/planning/clients" className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-white">
        <ArrowLeft size={14} /> Retour à la liste
      </Link>

      <PageHeader
        icon={Building2}
        titre={client.nom_entreprise}
        sousTitre="Détails du client — Tableau de bord"
        action={
          <div className="flex gap-2">
            <button
              onClick={() => generer('monthly')}
              disabled={genereEnCours !== null}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-surface2 px-3.5 py-2 text-xs font-bold text-white disabled:opacity-50"
            >
              <FileText size={14} /> {genereEnCours === 'monthly' ? 'Génération...' : `Planning ${MOIS[periode.mois - 1]}`}
            </button>
            <button
              onClick={() => generer('annual')}
              disabled={genereEnCours !== null}
              className="flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2 text-xs font-bold text-black disabled:opacity-50"
            >
              <FileText size={14} /> {genereEnCours === 'annual' ? 'Génération...' : `Planning ${periode.annee}`}
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="flex flex-col gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/15">
            <Video size={15} className="text-accent2" />
          </span>
          <p className="font-display text-2xl font-bold tabular-nums text-white">{stats.total_shootings}</p>
          <p className="text-xs font-semibold text-white">Tournages</p>
          <div className="flex flex-wrap gap-1.5">
            <Badge tone="warning">{stats.pending_shootings} en attente</Badge>
            <Badge tone="success">{stats.completed_shootings} complétés</Badge>
            <Badge tone="danger">{stats.non_realises_shootings} non réalisés</Badge>
          </div>
        </Card>
        <Card className="flex flex-col gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/15">
            <Megaphone size={15} className="text-accent2" />
          </span>
          <p className="font-display text-2xl font-bold tabular-nums text-white">{stats.total_publications}</p>
          <p className="text-xs font-semibold text-white">Publications</p>
          <div className="flex flex-wrap gap-1.5">
            <Badge tone="warning">{stats.pending_publications} en attente</Badge>
            <Badge tone="success">{stats.completed_publications} complétées</Badge>
            <Badge tone="danger">{stats.non_realises_publications} non réalisées</Badge>
          </div>
        </Card>
        <Card className="flex flex-col gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/15">
            <AlertTriangle size={15} className="text-accent2" />
          </span>
          <p className="font-display text-2xl font-bold tabular-nums text-white">{stats.publication_rules}</p>
          <p className="text-xs font-semibold text-white">Règles de publication</p>
          {regles.donnees && regles.donnees.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {regles.donnees.map((r) => (
                <span key={r.id} className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-semibold text-accent2">
                  {r.day_of_week.charAt(0).toUpperCase() + r.day_of_week.slice(1)}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted">Aucune règle — aucun jour non recommandé.</p>
          )}
        </Card>
      </div>

      <Card className="!p-0 overflow-hidden">
        <div className="flex items-center justify-between p-5 pb-0">
          <h2 className="text-base font-bold text-white">
            Planning — {MOIS[periode.mois - 1]} {periode.annee}
          </h2>
          <div className="flex items-center gap-1.5">
            <button onClick={() => changerMois(-1)} className="flex h-7 w-7 items-center justify-center rounded-full bg-surface2">
              <ChevronLeft size={14} className="text-white" />
            </button>
            <button onClick={() => changerMois(1)} className="flex h-7 w-7 items-center justify-center rounded-full bg-surface2">
              <ChevronRight size={14} className="text-white" />
            </button>
          </div>
        </div>
        <div className="overflow-x-auto p-5">
          <table className="w-full min-w-[720px] border-separate border-spacing-1">
            <thead>
              <tr>
                {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((j) => (
                  <th key={j} className="pb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                    {j}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {calendrier.map((semaine, si) => (
                <tr key={si}>
                  {semaine.map((jour, ci) => (
                    <td
                      key={ci}
                      onClick={() => setJourOuvert(jour.date)}
                      className={`h-24 w-[14.2%] cursor-pointer rounded-xl border border-border p-1.5 align-top hover:border-accent/40 ${
                        jour.est_mois_courant ? 'bg-surface2' : 'bg-transparent opacity-40'
                      }`}
                    >
                      <span className="text-[11px] font-semibold text-muted">{Number(jour.date.split('-')[2])}</span>
                      <div className="mt-1 space-y-1">
                        {jour.tournages.map((t) => (
                          <div
                            key={`t-${t.id}`}
                            title={`Tournage — ${LIBELLES_STATUT[t.status]}`}
                            className="truncate rounded px-1.5 py-0.5 text-[10px] font-semibold text-white"
                            style={{ backgroundColor: `${COULEUR_STATUT[t.status]}cc` }}
                          >
                            🎥 {nomEvenement({ type: 'tournage', evenement: t })}
                          </div>
                        ))}
                        {jour.publications.map((p) => (
                          <div
                            key={`p-${p.id}`}
                            title={`Publication — ${LIBELLES_STATUT[p.status]}`}
                            className="truncate rounded px-1.5 py-0.5 text-[10px] font-semibold text-white"
                            style={{ backgroundColor: `${COULEUR_STATUT[p.status]}cc` }}
                          >
                            📢 {nomEvenement({ type: 'publication', evenement: p })}
                          </div>
                        ))}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center gap-4 border-t border-border p-5 text-[11px] text-muted">
          <span className="flex items-center gap-1.5">
            <Video size={12} className="text-accent2" /> Tournage
          </span>
          <span className="flex items-center gap-1.5">
            <Megaphone size={12} className="text-accent2" /> Publication
          </span>
          <span className="h-4 w-px bg-border" />
          {(Object.entries(LIBELLES_STATUT) as [StatutEvenement, string][]).map(([statut, libelle]) => (
            <span key={statut} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: COULEUR_STATUT[statut] }} /> {libelle}
            </span>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ListeEvenements titre="Tournages et publications à venir (30 prochains jours)" items={aVenir} />
        <ListeEvenements titre="Activité récente (30 derniers jours)" items={recents} />
      </div>

      <Card>
        <h2 className="mb-3 text-sm font-bold text-white">Rapports de reporting</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ListeRapports titre="Mensuels" type="monthly" rapports={rapports_mensuels} clientId={clientId} onChange={donnees.recharger} />
          <ListeRapports titre="Annuels" type="annual" rapports={rapports_annuels} clientId={clientId} onChange={donnees.recharger} />
        </div>
      </Card>

      {jourSelectionne && (
        <ModaleJour jour={jourSelectionne} onFermer={() => setJourOuvert(null)} onChange={donnees.recharger} afficherClient={false} />
      )}
    </div>
  );
}
