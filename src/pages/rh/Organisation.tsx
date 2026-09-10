import { Building2 } from 'lucide-react';
import { EtatChargement, EtatErreur } from '../../components/ui/EtatRequete';
import { PageHeader } from '../../components/ui/PageHeader';
import { TableVirtus } from '../../components/ui/Table';
import { useApi } from '../../lib/hooks/useApi';
import { listerDepartements, type Departement } from '../../lib/api/rh';

function versListe(donnees: { results: Departement[] } | Departement[]): Departement[] {
  return Array.isArray(donnees) ? donnees : donnees.results;
}

export default function Organisation() {
  const { donnees, chargement, erreur, recharger } = useApi(listerDepartements, []);

  if (chargement) return <EtatChargement texte="Chargement de l'organisation…" />;
  if (erreur) return <EtatErreur message={erreur} recharger={recharger} />;

  const departements = donnees ? versListe(donnees) : [];

  return (
    <div>
      <PageHeader icon={Building2} titre="Organisation" sousTitre="Répartition des agents par département" />
      <TableVirtus
        colonnes={['Département', 'Effectif', 'Responsable']}
        lignes={departements.map((d) => [d.nom, `${d.effectif} agents`, d.responsable_nom || '—'])}
      />
    </div>
  );
}
