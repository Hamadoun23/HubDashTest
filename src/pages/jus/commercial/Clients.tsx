import { useState } from 'react';
import { UserRound } from 'lucide-react';
import { EtatErreur } from '../../../components/ui/EtatRequete';
import { FormulaireEtHistorique } from '../../../components/ui/FormulaireEtHistorique';
import { useAction, useApi } from '../../../lib/hooks/useApi';
import { creerClient, listerClients, modifierClient, supprimerClient } from '../../../lib/api/jus';

export default function ClientsCommercial() {
  const clients = useApi(() => listerClients(), []);
  const creation = useAction(creerClient);
  const modification = useAction(modifierClient);
  const suppression = useAction(supprimerClient);

  const [idEnEdition, setIdEnEdition] = useState<number | null>(null);
  const [nom, setNom] = useState('');
  const [tel, setTel] = useState('');
  const [email, setEmail] = useState('');
  const [adresse, setAdresse] = useState('');

  function reinitialiser() {
    setIdEnEdition(null);
    setNom('');
    setTel('');
    setEmail('');
    setAdresse('');
  }

  async function envoyer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const payload = { nom_complet: nom, tel_client: tel || undefined, email: email || undefined, adresse };
    if (idEnEdition !== null) {
      await modification.executer(idEnEdition, payload);
    } else {
      await creation.executer(payload);
    }
    reinitialiser();
    clients.recharger();
  }

  async function supprimer(id: number) {
    if (!window.confirm('Supprimer définitivement ce client ?')) return;
    await suppression.executer(id);
    if (idEnEdition === id) reinitialiser();
    clients.recharger();
  }

  return clients.erreur ? (
    <EtatErreur message={clients.erreur} recharger={clients.recharger} />
  ) : (
    <div>
      {idEnEdition !== null && (
        <div className="mb-3 flex items-center justify-between rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-accent2">
          <span>Modification du client en cours</span>
          <button type="button" onClick={reinitialiser} className="font-semibold text-white hover:text-accent">
            Annuler la modification
          </button>
        </div>
      )}
      <FormulaireEtHistorique
        icon={UserRound}
        titre="Clients"
        sousTitre="Comptes commerciaux actifs"
        onSubmit={envoyer}
        envoiEnCours={creation.enCours || modification.enCours}
        erreurEnvoi={creation.erreur ?? modification.erreur}
        texteBouton={idEnEdition !== null ? 'Mettre à jour' : 'Ajouter le client'}
        champs={[
          { label: 'Nom', placeholder: 'Épicerie Diallo', valeur: nom, onChange: setNom, requis: true },
          { label: 'Téléphone', placeholder: '+223 ...', valeur: tel, onChange: setTel },
          { label: 'Email', placeholder: 'contact@...', valeur: email, onChange: setEmail },
          { label: 'Adresse', valeur: adresse, onChange: setAdresse },
        ]}
        colonnesHistorique={['Client', 'Téléphone', 'Email', 'Adresse', '']}
        lignesHistorique={(clients.donnees ?? []).map((c) => [
          c.nom_complet,
          c.tel_client || '—',
          c.email || '—',
          c.adresse || '—',
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setIdEnEdition(c.id);
                setNom(c.nom_complet);
                setTel(c.tel_client);
                setEmail(c.email);
                setAdresse(c.adresse);
              }}
              className="text-xs font-semibold text-accent2 hover:text-accent"
            >
              Modifier
            </button>
            <button
              type="button"
              onClick={() => supprimer(c.id)}
              disabled={suppression.enCours}
              className="text-xs font-semibold text-red-400 hover:text-red-300 disabled:opacity-50"
            >
              Supprimer
            </button>
          </div>,
        ])}
      />
      {suppression.erreur ? <p className="mt-3 text-xs font-semibold text-red-400">{suppression.erreur}</p> : null}
    </div>
  );
}
