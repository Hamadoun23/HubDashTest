import { PackageOpen } from 'lucide-react';
import { EcranRapportModule } from './EcranRapportModule';

export default function Appro() {
  return <EcranRapportModule module="appro" icon={PackageOpen} titre="Reporting — Approvisionnement" sousTitre="Fournisseurs et délais" />;
}
