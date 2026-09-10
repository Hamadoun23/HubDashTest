import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { EtatErreur } from '../../components/ui/EtatRequete';
import { FormulaireEtHistorique } from '../../components/ui/FormulaireEtHistorique';
import { useAction, useApi } from '../../lib/hooks/useApi';
import { creerEnrolement, listerEnrolements, obtenirTableauDeBord } from '../../lib/api/campagnes';

export default function Enrolements() {
  const enrolements = useApi(() => listerEnrolements(), []);
  const tableau = useApi(obtenirTableauDeBord, []);
  const creation = useAction(creerEnrolement);

  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [numeroCompte, setNumeroCompte] = useState('');
  const [telephone, setTelephone] = useState('');
  const [campagneId, setCampagneId] = useState('');

  const campagnesOuvertes = tableau.donnees && tableau.donnees.variant === 'commercial' ? tableau.donnees.enrolement.campagnesOuvertes : [];

  async function envoyer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await creation.executer({ nom, prenom, numero_compte: numeroCompte, telephone: telephone || undefined, campagne_id: campagneId ? Number(campagneId) : undefined });
    setNom('');
    setPrenom('');
    setNumeroCompte('');
    setTelephone('');
    enrolements.recharger();
  }

  return enrolements.erreur ? (
    <EtatErreur message={enrolements.erreur} recharger={enrolements.recharger} />
  ) : (
    <FormulaireEtHistorique
      icon={UserPlus}
      titre="Mes enrôlements"
      sousTitre={enrolements.donnees?.libelleStatsCampagne ?? "Enrôler un client sur l'application"}
      onSubmit={envoyer}
      envoiEnCours={creation.enCours}
      erreurEnvoi={creation.erreur}
      texteBouton="Enregistrer l'enrôlement"
      champs={[
        { label: 'Prénom', valeur: prenom, onChange: setPrenom, requis: true },
        { label: 'Nom', valeur: nom, onChange: setNom, requis: true },
        { label: 'Numéro de compte', valeur: numeroCompte, onChange: setNumeroCompte, requis: true },
        { label: 'Téléphone', valeur: telephone, onChange: setTelephone },
        ...(campagnesOuvertes.length > 1
          ? [
              {
                label: 'Campagne',
                valeur: campagneId,
                onChange: setCampagneId,
                requis: true,
                options: campagnesOuvertes.map((c) => ({ valeur: String(c.id), libelle: c.nom })),
              },
            ]
          : []),
      ]}
      colonnesHistorique={['Nom', 'Numéro de compte', 'Date']}
      lignesHistorique={(enrolements.donnees?.enrolements.data ?? []).map((e) => [e.nom, e.numero_compte, e.date])}
    />
  );
}
