import { Users } from 'lucide-react';
import { EtatChargement, EtatErreur } from '../../components/ui-light/EtatRequete';
import { PageHeader } from '../../components/ui-light/PageHeader';
import { TableVirtus } from '../../components/ui-light/Table';
import { useApi } from '../../lib/hooks/useApi';
import { listerUtilisateurs, type Utilisateur } from '../../lib/api/rh';

function versListe(donnees: { results: Utilisateur[] } | Utilisateur[]): Utilisateur[] {
  return Array.isArray(donnees) ? donnees : donnees.results;
}

export default function Annuaire() {
  const { donnees, chargement, erreur, recharger } = useApi(() => listerUtilisateurs(), []);

  if (chargement) return <EtatChargement texte="Chargement de l'annuaire…" />;
  if (erreur) return <EtatErreur message={erreur} recharger={recharger} />;

  const agents = donnees ? versListe(donnees) : [];

  return (
    <div>
      <PageHeader icon={Users} titre="Annuaire" sousTitre={`${agents.length} collaborateurs`} accent="#d03e0d" />
      <TableVirtus
        colonnes={['Nom', 'Poste', 'Département', 'Email']}
        lignes={agents.map((a) => [a.nom_complet, a.poste || '—', a.departement_nom || '—', a.email])}
      />
    </div>
  );
}
