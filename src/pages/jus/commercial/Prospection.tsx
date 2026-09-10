import { useState } from 'react';
import { History, Map, UserCheck } from 'lucide-react';
import { EtatChargement, EtatErreur } from '../../../components/ui/EtatRequete';
import { FormulaireEtHistorique } from '../../../components/ui/FormulaireEtHistorique';
import { Badge } from '../../../components/ui/Table';
import { useAction, useApi } from '../../../lib/hooks/useApi';
import {
  convertirClient,
  creerPointVente,
  creerVisite,
  listerPointsVente,
  listerVisites,
  modifierPointVente,
  supprimerPointVente,
  type PointVente,
  type StatutProspection,
  type TypePointVente,
} from '../../../lib/api/jus';

function PanneauVisites({ point, fermer, surConversion }: { point: PointVente; fermer: () => void; surConversion: () => void }) {
  const visites = useApi(() => listerVisites({ point_vente: point.id }), [point.id]);
  const creation = useAction(creerVisite);
  const conversion = useAction(convertirClient);

  const [statutConstate, setStatutConstate] = useState('');
  const [compteRendu, setCompteRendu] = useState('');
  const [dateRelance, setDateRelance] = useState('');

  async function envoyer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await creation.executer({
      point_vente: point.id,
      statut_constate: statutConstate || undefined,
      compte_rendu: compteRendu || undefined,
      date_prochaine_relance: dateRelance || undefined,
    });
    setStatutConstate('');
    setCompteRendu('');
    setDateRelance('');
    visites.recharger();
  }

  async function convertir() {
    if (!window.confirm(`Convertir « ${point.nom} » en client ?`)) return;
    await conversion.executer(point.id, {});
    surConversion();
  }

  return (
    <div className="mt-4 rounded-2xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-white">Visites — {point.nom}</p>
          <p className="text-xs text-muted">{point.nb_visites} visite(s) · dernière le {point.derniere_visite ?? '—'}</p>
        </div>
        <div className="flex items-center gap-2">
          {point.statut !== 'CLIENT' && point.statut !== 'PARTENAIRE' && (
            <button
              type="button"
              onClick={convertir}
              disabled={conversion.enCours}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-surface2 px-2.5 py-1.5 text-xs font-semibold text-white hover:border-accent disabled:opacity-50"
            >
              <UserCheck size={13} /> Convertir en client
            </button>
          )}
          <button type="button" onClick={fermer} className="text-xs font-semibold text-muted hover:text-white">
            Fermer
          </button>
        </div>
      </div>
      {conversion.erreur ? <p className="mb-2 text-xs font-semibold text-red-400">{conversion.erreur}</p> : null}

      <form onSubmit={envoyer} className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface2/40 p-3">
        <div>
          <label className="mb-1 block text-xs font-semibold text-muted">Constat</label>
          <input
            value={statutConstate}
            onChange={(e) => setStatutConstate(e.target.value)}
            placeholder="Intéressé, absent..."
            className="w-40 rounded-lg border border-border bg-surface2 px-2.5 py-1.5 text-sm text-white focus:border-accent focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-muted">Compte-rendu</label>
          <input
            value={compteRendu}
            onChange={(e) => setCompteRendu(e.target.value)}
            className="w-56 rounded-lg border border-border bg-surface2 px-2.5 py-1.5 text-sm text-white focus:border-accent focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-muted">Prochaine relance</label>
          <input
            type="date"
            value={dateRelance}
            onChange={(e) => setDateRelance(e.target.value)}
            className="rounded-lg border border-border bg-surface2 px-2.5 py-1.5 text-sm text-white focus:border-accent focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={creation.enCours}
          className="rounded-xl bg-accent px-4 py-2 text-xs font-bold text-black disabled:opacity-60"
        >
          {creation.enCours ? 'Envoi...' : 'Enregistrer la visite'}
        </button>
        {creation.erreur ? <p className="text-xs font-semibold text-red-400">{creation.erreur}</p> : null}
      </form>

      {visites.chargement ? (
        <EtatChargement texte="Chargement des visites…" />
      ) : visites.erreur ? (
        <EtatErreur message={visites.erreur} recharger={visites.recharger} />
      ) : (visites.donnees ?? []).length === 0 ? (
        <p className="text-xs text-muted">Aucune visite enregistrée pour ce point de vente.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {(visites.donnees ?? []).map((v) => (
            <li key={v.id} className="rounded-lg border border-border bg-surface2/40 px-3 py-2 text-xs">
              <p className="font-semibold text-white">
                {v.date_visite} {v.statut_constate ? `· ${v.statut_constate}` : ''}
              </p>
              {v.compte_rendu ? <p className="mt-0.5 text-muted">{v.compte_rendu}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const TONE: Record<StatutProspection, 'success' | 'warning' | 'danger' | 'neutral'> = {
  PROSPECTE: 'neutral',
  INTERESSE: 'warning',
  CLIENT: 'success',
  PARTENAIRE: 'success',
  A_RELANCER: 'warning',
  REFUS: 'danger',
};

const TYPES: { valeur: TypePointVente; libelle: string }[] = [
  { valeur: 'BOUTIQUE', libelle: 'Boutique' },
  { valeur: 'SUPERMARCHE', libelle: 'Supermarché' },
  { valeur: 'EPICERIE', libelle: 'Épicerie' },
  { valeur: 'RESTAURANT', libelle: 'Restaurant' },
  { valeur: 'HOTEL', libelle: 'Hôtel' },
  { valeur: 'KIOSQUE', libelle: 'Kiosque' },
  { valeur: 'STATION', libelle: 'Station' },
  { valeur: 'GROSSISTE', libelle: 'Grossiste' },
  { valeur: 'ENTREPRISE', libelle: 'Entreprise' },
  { valeur: 'AUTRE', libelle: 'Autre' },
];

export default function Prospection() {
  const points = useApi(() => listerPointsVente(), []);
  const creation = useAction(creerPointVente);
  const modification = useAction(modifierPointVente);
  const suppression = useAction(supprimerPointVente);

  const [idEnEdition, setIdEnEdition] = useState<number | null>(null);
  const [pointVisites, setPointVisites] = useState<PointVente | null>(null);
  const [nom, setNom] = useState('');
  const [type, setType] = useState<TypePointVente>('BOUTIQUE');
  const [adresse, setAdresse] = useState('');
  const [contactTel, setContactTel] = useState('');
  // Bamako par défaut — la latitude/longitude précise se règle normalement par géolocalisation
  // sur le terrain ; ce champ texte permet une saisie manuelle en attendant.
  const [latitude, setLatitude] = useState('12.6392');
  const [longitude, setLongitude] = useState('-8.0029');

  function reinitialiser() {
    setIdEnEdition(null);
    setNom('');
    setType('BOUTIQUE');
    setAdresse('');
    setContactTel('');
    setLatitude('12.6392');
    setLongitude('-8.0029');
  }

  async function envoyer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const payload = {
      nom,
      type_point: type,
      latitude: Number(latitude),
      longitude: Number(longitude),
      adresse,
      contact_tel: contactTel,
    };
    if (idEnEdition !== null) {
      await modification.executer(idEnEdition, payload);
    } else {
      await creation.executer(payload);
    }
    reinitialiser();
    points.recharger();
  }

  async function supprimer(id: number) {
    if (!window.confirm('Supprimer définitivement ce point de vente ?')) return;
    await suppression.executer(id);
    if (idEnEdition === id) reinitialiser();
    points.recharger();
  }

  return points.erreur ? (
    <EtatErreur message={points.erreur} recharger={points.recharger} />
  ) : (
    <div>
      {idEnEdition !== null && (
        <div className="mb-3 flex items-center justify-between rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-accent2">
          <span>Modification du point de vente en cours</span>
          <button type="button" onClick={reinitialiser} className="font-semibold text-white hover:text-accent">
            Annuler la modification
          </button>
        </div>
      )}
      <FormulaireEtHistorique
        icon={Map}
        titre="Prospection"
        sousTitre="Nouveaux points de vente à prospecter"
        onSubmit={envoyer}
        envoiEnCours={creation.enCours || modification.enCours}
        erreurEnvoi={creation.erreur ?? modification.erreur}
        texteBouton={idEnEdition !== null ? 'Mettre à jour' : 'Ajouter le point de vente'}
        champs={[
          { label: 'Nom', placeholder: 'Épicerie Diallo', valeur: nom, onChange: setNom, requis: true },
          { label: 'Type', valeur: type, onChange: (v) => setType(v as TypePointVente), requis: true, options: TYPES.map((t) => ({ valeur: t.valeur, libelle: t.libelle })) },
          { label: 'Adresse / Zone', placeholder: 'Bamako, Badalabougou', valeur: adresse, onChange: setAdresse },
          { label: 'Téléphone', valeur: contactTel, onChange: setContactTel },
          { label: 'Latitude', valeur: latitude, onChange: setLatitude, requis: true },
          { label: 'Longitude', valeur: longitude, onChange: setLongitude, requis: true },
        ]}
        colonnesHistorique={['Nom', 'Type', 'Zone', 'Statut', '']}
        lignesHistorique={(points.donnees ?? []).map((p) => [
          p.nom,
          p.type_display,
          p.adresse || '—',
          <Badge tone={TONE[p.statut]}>{p.statut_display}</Badge>,
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setIdEnEdition(p.id);
                setNom(p.nom);
                setType(p.type_point);
                setAdresse(p.adresse);
                setContactTel(p.contact_tel);
                setLatitude(String(p.latitude));
                setLongitude(String(p.longitude));
              }}
              className="text-xs font-semibold text-accent2 hover:text-accent"
            >
              Modifier
            </button>
            <button
              type="button"
              onClick={() => setPointVisites(pointVisites?.id === p.id ? null : p)}
              className="flex items-center gap-1 text-xs font-semibold text-accent2 hover:text-accent"
            >
              <History size={12} /> Visites
            </button>
            <button
              type="button"
              onClick={() => supprimer(p.id)}
              disabled={suppression.enCours}
              className="text-xs font-semibold text-red-400 hover:text-red-300 disabled:opacity-50"
            >
              Supprimer
            </button>
          </div>,
        ])}
      />
      {suppression.erreur ? <p className="mt-3 text-xs font-semibold text-red-400">{suppression.erreur}</p> : null}

      {pointVisites && (
        <PanneauVisites
          point={pointVisites}
          fermer={() => setPointVisites(null)}
          surConversion={() => {
            setPointVisites(null);
            points.recharger();
          }}
        />
      )}
    </div>
  );
}
