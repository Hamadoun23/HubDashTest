import { useState } from 'react';
import { Clapperboard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../../components/ui-light/Card';
import { EtatChargement, EtatErreur } from '../../../components/ui-light/EtatRequete';
import { PageHeader } from '../../../components/ui-light/PageHeader';
import { useAction, useApi } from '../../../lib/hooks/useApi';
import { creerCampagne, optionsCreationCampagne, type NouvelleCampagne } from '../../../lib/api/campagnes';

export default function Creer() {
  const navigate = useNavigate();
  const options = useApi(optionsCreationCampagne, []);
  const creation = useAction(creerCampagne);

  const [nom, setNom] = useState('');
  const [type, setType] = useState<NouvelleCampagne['type']>('vente_carte');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [primeVendeur, setPrimeVendeur] = useState('');

  async function envoyer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await creation.executer({
      nom,
      type,
      date_debut: dateDebut,
      date_fin: dateFin,
      toutes_agences: true,
      prime_meilleur_vendeur: primeVendeur || undefined,
    });
    navigate('/campagnes/admin/campagnes');
  }

  if (options.chargement) return <EtatChargement texte="Chargement…" />;
  if (options.erreur) return <EtatErreur message={options.erreur} recharger={options.recharger} />;

  return (
    <div>
      <PageHeader icon={Clapperboard} titre="Nouvelle campagne" sousTitre={options.donnees?.clientNom ?? ''} accent="#7c3aed" />
      <Card className="max-w-xl">
        <form onSubmit={envoyer} className="flex flex-col gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-500">Nom de la campagne</label>
            <input
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              required
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-500">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as NouvelleCampagne['type'])}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none"
            >
              <option value="vente_carte">Vente de cartes</option>
              <option value="enrolement_app">Enrôlement à l'application</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-500">Début</label>
              <input
                type="date"
                value={dateDebut}
                onChange={(e) => setDateDebut(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-500">Fin</label>
              <input
                type="date"
                value={dateFin}
                onChange={(e) => setDateFin(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-500">Prime meilleur vendeur (optionnel)</label>
            <input
              value={primeVendeur}
              onChange={(e) => setPrimeVendeur(e.target.value)}
              placeholder="25 000"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
            />
          </div>
          {creation.erreur ? <p className="text-xs font-semibold text-rose-600">{creation.erreur}</p> : null}
          <button
            type="submit"
            disabled={creation.enCours}
            className="mt-1 w-fit rounded-xl bg-campagnes-primary px-4 py-2.5 text-xs font-bold text-white disabled:opacity-60"
          >
            {creation.enCours ? 'Création...' : 'Créer la campagne'}
          </button>
        </form>
      </Card>
    </div>
  );
}
