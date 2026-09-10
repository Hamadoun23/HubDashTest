import { Sprout } from 'lucide-react';
import { EcranRapportModule } from './EcranRapportModule';

export default function Recolte() {
  return <EcranRapportModule module="recolte" icon={Sprout} titre="Reporting — Récolte" sousTitre="Volumes récoltés par période" />;
}
