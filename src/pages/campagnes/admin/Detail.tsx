import { useState } from 'react';
import { AlertTriangle, ArrowLeft, Ban, CalendarClock, Pencil } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { Card } from '../../../components/ui/Card';
import { EtatChargement, EtatErreur } from '../../../components/ui/EtatRequete';
import { Badge, TableVirtus } from '../../../components/ui/Table';
import { useAction, useApi } from '../../../lib/hooks/useApi';
import { annulerCampagne, arreterCampagne, modifierCampagne, obtenirCampagne, reprogrammerCampagne } from '../../../lib/api/campagnes';

const ONGLETS = [
  { cle: 'pilotage', libelle: 'Pilotage' },
  { cle: 'commerciaux', libelle: 'Commerciaux' },
  { cle: 'performances', libelle: 'Performances' },
  { cle: 'historique', libelle: 'Historique' },
];

export default function Detail() {
  const { id } = useParams();
  const campagneId = Number(id);
  const [onglet, setOnglet] = useState('pilotage');

  const detail = useApi(() => obtenirCampagne(campagneId, onglet), [campagneId, onglet]);
  const arret = useAction(arreterCampagne);
  const annulation = useAction(annulerCampagne);
  const reprogrammation = useAction(reprogrammerCampagne);
  const modification = useAction(modifierCampagne);

  const [reprogrammationOuverte, setReprogrammationOuverte] = useState(false);
  const [nouveauDebut, setNouveauDebut] = useState('');
  const [nouvelleFin, setNouvelleFin] = useState('');
  const [motifReprogrammation, setMotifReprogrammation] = useState('');

  const [editionOuverte, setEditionOuverte] = useState(false);
  const [primeVendeur, setPrimeVendeur] = useState('');
  const [aideMontant, setAideMontant] = useState('');

  // Le backend trace chaque arrêt/annulation/reprogrammation avec un motif
  // (10 caractères minimum) — demandé au clic plutôt que via un champ dédié,
  // pour rester au plus simple sur ces deux actions ponctuelles.
  function demanderMotif(): string | null {
    const motif = window.prompt('Motif (10 caractères minimum) :');
    if (motif === null) return null;
    if (motif.trim().length < 10) {
      window.alert('Le motif doit contenir au moins 10 caractères.');
      return null;
    }
    return motif.trim();
  }

  async function arreter() {
    const motif = demanderMotif();
    if (motif === null) return;
    await arret.executer(campagneId, motif);
    detail.recharger();
  }

  async function annuler() {
    const motif = demanderMotif();
    if (motif === null) return;
    await annulation.executer(campagneId, motif);
    detail.recharger();
  }

  async function reprogrammer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await reprogrammation.executer(campagneId, nouveauDebut, nouvelleFin, motifReprogrammation);
    setReprogrammationOuverte(false);
    setMotifReprogrammation('');
    detail.recharger();
  }

  async function enregistrerEdition(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await modification.executer(campagneId, { prime_meilleur_vendeur: primeVendeur, aide_hebdo_montant: aideMontant });
    setEditionOuverte(false);
    detail.recharger();
  }

  if (detail.chargement) return <EtatChargement texte="Chargement de la campagne…" />;
  if (detail.erreur || !detail.donnees) return <EtatErreur message={detail.erreur ?? 'Indisponible'} recharger={detail.recharger} />;

  const { campagne } = detail.donnees;

  return (
    <div>
      <Link to="/campagnes/admin/campagnes" className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-accent2">
        <ArrowLeft size={14} />
        Retour aux campagnes
      </Link>

      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">{campagne.nom}</h1>
          <p className="text-xs text-muted">
            {campagne.date_debut} → {campagne.date_fin} · {campagne.agences_libelle}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={campagne.statut === 'en_cours' ? 'success' : campagne.statut === 'programmee' ? 'warning' : 'neutral'}>
            {campagne.statut}
          </Badge>
          {campagne.peut_piloter && (
            <>
              <button
                onClick={arreter}
                disabled={arret.enCours}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-surface2 px-3 py-1.5 text-xs font-semibold text-white hover:border-accent"
              >
                <Ban size={13} /> Arrêter
              </button>
              <button
                onClick={annuler}
                disabled={annulation.enCours}
                className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400"
              >
                <AlertTriangle size={13} /> Annuler
              </button>
              <button
                onClick={() => {
                  setNouveauDebut(campagne.date_debut);
                  setNouvelleFin(campagne.date_fin);
                  setReprogrammationOuverte((v) => !v);
                }}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-surface2 px-3 py-1.5 text-xs font-semibold text-white hover:border-accent"
              >
                <CalendarClock size={13} /> Reprogrammer
              </button>
              <button
                onClick={() => {
                  setPrimeVendeur(campagne.prime_meilleur_vendeur ?? '');
                  setAideMontant(campagne.aide_hebdo_montant ?? '');
                  setEditionOuverte((v) => !v);
                }}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-surface2 px-3 py-1.5 text-xs font-semibold text-white hover:border-accent"
              >
                <Pencil size={13} /> Modifier
              </button>
            </>
          )}
        </div>
      </div>

      {reprogrammationOuverte && (
        <form onSubmit={reprogrammer} className="mb-5 flex items-end gap-3 rounded-2xl border border-border bg-surface p-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted">Nouveau début</label>
            <input
              type="date"
              value={nouveauDebut}
              onChange={(e) => setNouveauDebut(e.target.value)}
              required
              className="rounded-lg border border-border bg-surface2 px-2.5 py-1.5 text-sm text-white focus:border-accent focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted">Nouvelle fin</label>
            <input
              type="date"
              value={nouvelleFin}
              onChange={(e) => setNouvelleFin(e.target.value)}
              required
              className="rounded-lg border border-border bg-surface2 px-2.5 py-1.5 text-sm text-white focus:border-accent focus:outline-none"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs font-semibold text-muted">Motif (10 caractères min.)</label>
            <input
              value={motifReprogrammation}
              onChange={(e) => setMotifReprogrammation(e.target.value)}
              required
              minLength={10}
              className="w-full rounded-lg border border-border bg-surface2 px-2.5 py-1.5 text-sm text-white focus:border-accent focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={reprogrammation.enCours}
            className="rounded-xl bg-accent px-4 py-2 text-xs font-bold text-black disabled:opacity-60"
          >
            {reprogrammation.enCours ? 'Envoi...' : 'Confirmer'}
          </button>
          <button type="button" onClick={() => setReprogrammationOuverte(false)} className="text-xs font-semibold text-muted hover:text-white">
            Annuler
          </button>
          {reprogrammation.erreur ? <p className="text-xs font-semibold text-red-400">{reprogrammation.erreur}</p> : null}
        </form>
      )}

      {editionOuverte && (
        <form onSubmit={enregistrerEdition} className="mb-5 flex items-end gap-3 rounded-2xl border border-border bg-surface p-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted">Prime meilleur vendeur</label>
            <input
              value={primeVendeur}
              onChange={(e) => setPrimeVendeur(e.target.value)}
              className="w-40 rounded-lg border border-border bg-surface2 px-2.5 py-1.5 text-sm text-white focus:border-accent focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted">Aide hebdomadaire</label>
            <input
              value={aideMontant}
              onChange={(e) => setAideMontant(e.target.value)}
              className="w-40 rounded-lg border border-border bg-surface2 px-2.5 py-1.5 text-sm text-white focus:border-accent focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={modification.enCours}
            className="rounded-xl bg-accent px-4 py-2 text-xs font-bold text-black disabled:opacity-60"
          >
            {modification.enCours ? 'Envoi...' : 'Mettre à jour'}
          </button>
          <button type="button" onClick={() => setEditionOuverte(false)} className="text-xs font-semibold text-muted hover:text-white">
            Annuler
          </button>
          {modification.erreur ? <p className="text-xs font-semibold text-red-400">{modification.erreur}</p> : null}
        </form>
      )}

      <div className="mb-5 flex gap-2">
        {ONGLETS.map((o) => (
          <button
            key={o.cle}
            onClick={() => setOnglet(o.cle)}
            className={`rounded-full px-3.5 py-2 text-xs font-semibold transition-colors ${
              onglet === o.cle ? 'bg-accent text-black' : 'bg-surface2 text-muted hover:text-white'
            }`}
          >
            {o.libelle}
          </button>
        ))}
      </div>

      {onglet === 'pilotage' && (
        <div className="grid grid-cols-2 gap-4">
          <Card className="flex flex-col gap-2">
            <p className="text-xs text-muted">Prime meilleur vendeur</p>
            <p className="text-lg font-bold text-white">{campagne.prime_meilleur_vendeur ?? '—'}</p>
          </Card>
          <Card className="flex flex-col gap-2">
            <p className="text-xs text-muted">Remise</p>
            <p className="text-lg font-bold text-white">{campagne.remise_libelle ?? '—'}</p>
          </Card>
          <Card className="flex flex-col gap-2">
            <p className="text-xs text-muted">Aide hebdomadaire</p>
            <p className="text-lg font-bold text-white">{campagne.aide_hebdo_active ? campagne.aide_hebdo_montant : 'Désactivée'}</p>
          </Card>
          <Card className="flex flex-col gap-2">
            <p className="text-xs text-muted">Commerciaux actifs</p>
            <p className="text-lg font-bold text-white">
              {detail.donnees.nbCommerciauxActifs} <span className="text-xs font-normal text-muted">/ {detail.donnees.nbCommerciauxActifs + detail.donnees.nbCommerciauxInactifs}</span>
            </p>
          </Card>
        </div>
      )}

      {onglet === 'commerciaux' && (
        <TableVirtus
          colonnes={['Nom', 'Agence', 'Téléphone', 'Contrat', 'Statut']}
          lignes={detail.donnees.commerciauxPerimetre.map((c) => [
            c.nom,
            c.agence_nom,
            c.telephone,
            c.contrat_statut,
            <Badge tone={c.actif ? 'success' : 'neutral'}>{c.actif ? 'Actif' : 'Inactif'}</Badge>,
          ])}
        />
      )}

      {onglet === 'performances' && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-4">
            <Card className="flex flex-col gap-1">
              <p className="text-xs text-muted">Ventes totales</p>
              <p className="text-lg font-bold text-white">{detail.donnees.stats.total_ventes}</p>
            </Card>
          </div>
          <TableVirtus
            colonnes={['Rang', 'Commercial', 'Ventes']}
            lignes={detail.donnees.classement.map((c) => [c.rang, c.user_name, c.total_ventes])}
          />
        </div>
      )}

      {onglet === 'historique' && (
        <div className="flex flex-col gap-3 border-l border-border pl-4">
          {campagne.actions.length === 0 ? (
            <p className="text-xs text-muted">Aucune action enregistrée.</p>
          ) : (
            campagne.actions.map((a) => (
              <div key={a.id} className="relative">
                <span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-accent" />
                <p className="text-xs text-muted">
                  {a.created_at} · {a.user_name}
                </p>
                <p className="mt-0.5 text-sm text-white">{a.description}</p>
              </div>
            ))
          )}
        </div>
      )}

      {(arret.erreur || annulation.erreur) && <p className="mt-3 text-xs font-semibold text-red-400">{arret.erreur ?? annulation.erreur}</p>}
    </div>
  );
}
