import { useState } from 'react';
import { Lightbulb } from 'lucide-react';
import { EtatErreur } from '../../components/ui/EtatRequete';
import { FormulaireEtHistorique } from '../../components/ui/FormulaireEtHistorique';
import { useAction, useApi } from '../../lib/hooks/useApi';
import { creerIdee, listerIdees } from '../../lib/api/planning';

const TYPES = ['vidéo', 'image', 'texte'];

export default function IdeesContenu() {
  const idees = useApi(listerIdees, []);
  const creation = useAction(creerIdee);
  const [titre, setTitre] = useState('');
  const [type, setType] = useState(TYPES[0]);

  async function envoyer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await creation.executer(titre, type);
    setTitre('');
    idees.recharger();
  }

  return idees.erreur ? (
    <EtatErreur message={idees.erreur} recharger={idees.recharger} />
  ) : (
    <FormulaireEtHistorique
      icon={Lightbulb}
      titre="Idées de contenu"
      sousTitre="Ce qui se prépare pour vos clients"
      onSubmit={envoyer}
      envoiEnCours={creation.enCours}
      erreurEnvoi={creation.erreur}
      texteBouton="Ajouter l’idée"
      champs={[
        { label: 'Titre', placeholder: 'Série "Portrait d\'agriculteur"', valeur: titre, onChange: setTitre, requis: true },
        {
          label: `Type (${TYPES.join(' / ')})`,
          valeur: type,
          onChange: setType,
          requis: true,
        },
      ]}
      colonnesHistorique={['Idée', 'Type', 'Créée le']}
      lignesHistorique={(idees.donnees ?? []).map((i) => [i.titre, i.type, new Date(i.created_at).toLocaleDateString('fr-FR')])}
    />
  );
}
