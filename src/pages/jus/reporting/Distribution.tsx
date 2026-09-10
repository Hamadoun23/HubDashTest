import { FileText } from 'lucide-react';
import { EcranRapportModule } from './EcranRapportModule';

export default function Distribution() {
  return <EcranRapportModule module="distribution" icon={FileText} titre="Reporting — Distribution" sousTitre="Volumes livrés par destination" />;
}
