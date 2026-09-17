import { EtatChargement } from '../components/ui/EtatRequete';
import { useAuth } from '../lib/auth/AuthContext';
import MesAcces from './administration/MesAcces';
import VueGlobale from './administration/VueGlobale';

export default function Administration() {
  const { identite, habilitations, chargement } = useAuth();

  if (chargement) return <EtatChargement texte="Chargement…" />;

  const estAdmin = Boolean(identite?.est_superadmin) || (habilitations['hub'] ?? []).includes('admin');

  return estAdmin ? <VueGlobale /> : <MesAcces />;
}
