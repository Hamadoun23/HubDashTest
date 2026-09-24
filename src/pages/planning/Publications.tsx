import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, ChevronDown, ChevronLeft, ChevronRight, Megaphone, Plus, User, X } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { EtatErreur } from '../../components/ui/EtatRequete';
import { PageHeader } from '../../components/ui/PageHeader';
import { useAction, useApi } from '../../lib/hooks/useApi';
import {
  LIBELLES_STATUT,
  calendrierPublications,
  creerPublication,
  listerClients,
  listerIdees,
  listerPublications,
  listerTournages,
  modifierPublication,
  obtenirPublication,
  verifierDatePublication,
  type StatutEvenement,
} from '../../lib/api/planning';
import { ModaleJour } from './ModaleJour';

const CHAMP = 'w-full rounded-xl border border-border bg-surface2 px-3 py-2 text-sm text-white placeholder:text-muted focus:border-accent focus:outline-none';
const LABEL = 'mb-1.5 block text-xs font-semibold text-muted';

const MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

const COULEUR_STATUT: Record<StatutEvenement, string> = {
  pending: '#facc15',
  completed: '#34d399',
  not_realized: '#f87171',
  cancelled: '#6b7280',
  rescheduled: '#60a5fa',
};

export default function Publications() {
  const clients = useApi(listerClients, []);
  const idees = useApi(listerIdees, []);
  const tournages = useApi(listerTournages, []);
  const publications = useApi(listerPublications, []);
  const creation = useAction(creerPublication);
  const modification = useAction(modifierPublication);

  const [ouvert, setOuvert] = useState(false);
  const [clientId, setClientId] = useState('');
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');
  const [contentIdeaId, setContentIdeaId] = useState('');
  const [shootingId, setShootingId] = useState('');
  const [idEnEdition, setIdEnEdition] = useState<number | null>(null);
  const [avertissements, setAvertissements] = useState<string[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();

  const maintenant = new Date();
  const [periode, setPeriode] = useState({ mois: maintenant.getMonth() + 1, annee: maintenant.getFullYear() });
  const [filtreClient, setFiltreClient] = useState('all');
  const [jourOuvert, setJourOuvert] = useState<string | null>(null);
  const calendrier = useApi(
    () => calendrierPublications(periode.mois, periode.annee, filtreClient),
    [periode.mois, periode.annee, filtreClient],
  );

  function rechargerTout() {
    publications.recharger();
    calendrier.recharger();
  }

  // Vérifie le jour non recommandé dès que client + date sont connus — même
  // logique que `getDayNotRecommendedWarning()` côté Laravel, appelée ici
  // avant l'envoi plutôt que découverte après coup.
  useEffect(() => {
    if (!clientId || !date) {
      setAvertissements([]);
      return;
    }
    let annule = false;
    verifierDatePublication(Number(clientId), date, idEnEdition ?? undefined)
      .then((r) => {
        if (!annule) setAvertissements(r.avertissements);
      })
      .catch(() => {
        if (!annule) setAvertissements([]);
      });
    return () => {
      annule = true;
    };
  }, [clientId, date, idEnEdition]);

  function reinitialiser() {
    setIdEnEdition(null);
    setClientId('');
    setDate('');
    setDescription('');
    setContentIdeaId('');
    setShootingId('');
    setAvertissements([]);
  }

  function ouvrirCreation() {
    reinitialiser();
    setOuvert(true);
  }

  function ouvrirCreationPourJour(iso: string) {
    reinitialiser();
    setDate(`${iso}T09:00`);
    setOuvert(true);
  }

  function ouvrirEdition(p: NonNullable<typeof publications.donnees>[number]) {
    setIdEnEdition(p.id);
    setClientId(String(p.client));
    setDate(p.date.slice(0, 16));
    setDescription(p.description);
    setContentIdeaId(p.content_idea ? String(p.content_idea) : '');
    setShootingId(p.shooting ? String(p.shooting) : '');
    setOuvert(true);
  }

  function changerMois(delta: number) {
    setPeriode((p) => {
      const total = p.mois - 1 + delta;
      const annee = p.annee + Math.floor(total / 12);
      const mois = ((total % 12) + 12) % 12;
      return { mois: mois + 1, annee };
    });
  }

  // Ouvre directement l'édition d'une publication quand on arrive via `?edit=<id>`
  // (lien "Modifier" depuis la modale de jour du calendrier) — va chercher
  // l'événement par son id plutôt que dans la liste affichée, qui ne contient
  // que la première page (50 résultats côté backend).
  useEffect(() => {
    const editId = searchParams.get('edit');
    if (!editId) return;
    setSearchParams({}, { replace: true });
    obtenirPublication(Number(editId)).then(ouvrirEdition).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function envoyer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!clientId) return;
    const payload = {
      client: Number(clientId),
      date,
      description,
      content_idea: contentIdeaId ? Number(contentIdeaId) : null,
      shooting: shootingId ? Number(shootingId) : null,
    };
    const reponse = idEnEdition !== null ? await modification.executer(idEnEdition, payload) : await creation.executer(payload);
    setAvertissements(reponse.avertissements ?? []);
    setOuvert(false);
    rechargerTout();
  }

  if (publications.erreur) return <EtatErreur message={publications.erreur} recharger={publications.recharger} />;

  const erreurForm = creation.erreur ?? modification.erreur;
  const enCoursForm = creation.enCours || modification.enCours;
  const tournagesDuClient = (tournages.donnees ?? []).filter((t) => String(t.client) === clientId);
  const grille = calendrier.donnees?.calendrier ?? [];
  const jourSelectionne = jourOuvert ? grille.flat().find((j) => j.date === jourOuvert) ?? null : null;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={Megaphone}
        titre="Publications"
        sousTitre="Ce qui est publié ou programmé"
        action={
          <button onClick={ouvrirCreation} className="flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2 text-xs font-bold text-black">
            <Plus size={14} /> Nouvelle publication
          </button>
        }
      />

      {avertissements.length > 0 && !ouvert && (
        <div className="flex items-start gap-2 rounded-xl border border-accent/30 bg-accent/10 p-3 text-xs text-accent2">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <div>
            {avertissements.map((a, i) => (
              <p key={i}>{a}</p>
            ))}
          </div>
        </div>
      )}

      <Card className="!p-0 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-0">
          <h2 className="text-base font-bold text-white">
            Planning de publication — {MOIS[periode.mois - 1]} {periode.annee}
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

        <div className="flex items-end gap-3 p-5">
          <div className="flex-1">
            <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">
              <User size={12} /> Client
            </label>
            <div className="relative">
              <select
                value={filtreClient}
                onChange={(e) => setFiltreClient(e.target.value)}
                className="w-full appearance-none rounded-xl border border-border bg-surface2 px-3.5 py-2.5 text-sm font-semibold text-white focus:border-accent focus:outline-none"
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
          </div>
        </div>

        <div className="overflow-x-auto px-5">
          <table className="w-full min-w-[720px] border-separate border-spacing-1">
            <thead>
              <tr>
                {JOURS.map((j) => (
                  <th key={j} className="pb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                    {j}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grille.map((semaine, si) => (
                <tr key={si}>
                  {semaine.map((jour, ci) => (
                    <td
                      key={ci}
                      onClick={() => setJourOuvert(jour.date)}
                      className={`group h-24 w-[14.2%] cursor-pointer rounded-xl border border-border p-1.5 align-top hover:border-accent/40 ${
                        jour.est_mois_courant ? 'bg-surface2' : 'bg-transparent opacity-40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-muted">{Number(jour.date.split('-')[2])}</span>
                        {jour.est_mois_courant && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              ouvrirCreationPourJour(jour.date);
                            }}
                            title="Ajouter une publication"
                            className="flex h-4 w-4 items-center justify-center rounded-full bg-accent/70 text-black opacity-0 transition-opacity group-hover:opacity-100"
                          >
                            <Plus size={10} />
                          </button>
                        )}
                      </div>
                      <div className="mt-1 space-y-1">
                        {jour.publications.map((p) => (
                          <div
                            key={p.id}
                            title={`${p.client_nom} — ${LIBELLES_STATUT[p.status]}`}
                            className="truncate rounded px-1.5 py-0.5 text-[10px] font-semibold text-white"
                            style={{ backgroundColor: `${COULEUR_STATUT[p.status]}cc` }}
                          >
                            📢 {p.client_nom}
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


      {ouvert ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <Card className="w-full max-w-lg !bg-surface">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">{idEnEdition !== null ? 'Modifier la publication' : 'Nouvelle publication'}</h2>
              <button
                onClick={() => {
                  setOuvert(false);
                  setAvertissements([]);
                }}
                className="rounded-lg p-1 text-muted hover:bg-surface2 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={envoyer} className="flex flex-col gap-3">
              <div>
                <label className={LABEL}>
                  Client <span className="text-accent2">*</span>
                </label>
                <select
                  value={clientId}
                  onChange={(e) => {
                    setClientId(e.target.value);
                    setShootingId('');
                  }}
                  required
                  className={CHAMP}
                >
                  <option value="">Sélectionner...</option>
                  {(clients.donnees ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nom_entreprise}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={LABEL}>
                  Date et heure <span className="text-accent2">*</span>
                </label>
                <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} required className={CHAMP} />
                {avertissements.length > 0 && (
                  <p className="mt-1.5 flex items-start gap-1.5 text-xs text-accent2">
                    <AlertTriangle size={13} className="mt-0.5 shrink-0" /> {avertissements[0]}
                  </p>
                )}
              </div>
              <div>
                <label className={LABEL}>Idée de contenu</label>
                <select value={contentIdeaId} onChange={(e) => setContentIdeaId(e.target.value)} className={CHAMP}>
                  <option value="">Aucune</option>
                  {(idees.donnees ?? []).map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.titre}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={LABEL}>Tournage lié</label>
                <select value={shootingId} onChange={(e) => setShootingId(e.target.value)} disabled={!clientId} className={CHAMP}>
                  <option value="">Aucun</option>
                  {tournagesDuClient.map((t) => (
                    <option key={t.id} value={t.id}>
                      {new Date(t.date).toLocaleDateString('fr-FR')} — {t.description || 'Tournage'}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={LABEL}>Description</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={CHAMP} />
              </div>
              {erreurForm && <p className="text-xs font-semibold text-red-400">{erreurForm}</p>}
              <button type="submit" disabled={enCoursForm} className="mt-1 rounded-xl bg-accent px-3 py-2.5 text-xs font-bold text-black disabled:opacity-60">
                {enCoursForm ? 'Envoi...' : idEnEdition !== null ? 'Mettre à jour' : 'Planifier'}
              </button>
            </form>
          </Card>
        </div>
      ) : null}

      {jourSelectionne && (
        <ModaleJour jour={jourSelectionne} onFermer={() => setJourOuvert(null)} onChange={rechargerTout} afficherClient />
      )}
    </div>
  );
}
