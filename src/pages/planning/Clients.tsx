import { useState } from 'react';
import { Users } from 'lucide-react';
import { EtatErreur } from '../../components/ui/EtatRequete';
import { FormulaireEtHistorique } from '../../components/ui/FormulaireEtHistorique';
import { useAction, useApi } from '../../lib/hooks/useApi';
import { creerClient, listerClients } from '../../lib/api/planning';

export default function Clients() {
  const clients = useApi(listerClients, []);
  const creation = useAction(creerClient);
  const [nom, setNom] = useState('');

  async function envoyer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await creation.executer(nom);
    setNom('');
    clients.recharger();
  }

  return clients.erreur ? (
    <EtatErreur message={clients.erreur} recharger={clients.recharger} />
  ) : (
    <FormulaireEtHistorique
      icon={Users}
      titre="Clients"
      sousTitre="Comptes suivis par Planning"
      onSubmit={envoyer}
      envoiEnCours={creation.enCours}
      erreurEnvoi={creation.erreur}
      texteBouton="Ajouter le client"
      champs={[{ label: 'Nom de l’entreprise', placeholder: 'Supermarché Azar', valeur: nom, onChange: setNom, requis: true }]}
      colonnesHistorique={['Nom', 'Tournages', 'Publications']}
      lignesHistorique={(clients.donnees ?? []).map((c) => [c.nom_entreprise, c.tournages_count, c.publications_count])}
    />
  );
}
