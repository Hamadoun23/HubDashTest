import { EtatChargement, EtatErreur } from '../../components/ui/EtatRequete';
import { useApi } from '../../lib/hooks/useApi';
import { monProfilJus } from '../../lib/api/jus';
import Direction from './Direction';
import Production from './Production';
import Commercial from './Commercial';
import Finance from './Finance';

/** Un seul tableau de bord, pas un par domaine : avant, la sidebar montrait
 * "Tableau de bord" sous Direction, Production, Commercial ET Finance —
 * quatre écrans redondants dès qu'on avait accès à plus d'un domaine (le cas
 * de Finance, qui lit tout). On choisit maintenant celui qui concerne le
 * rôle de la personne connectée, jamais un mélange des quatre. Direction
 * prime (elle supervise tout) ; à égalité de rôle réel, on ne devrait
 * jamais avoir à trancher entre plusieurs — un compte a un seul groupe. */
export default function TableauDeBord() {
  const profil = useApi(monProfilJus, []);

  if (profil.chargement) return <EtatChargement texte="Chargement…" />;
  if (profil.erreur) return <EtatErreur message={profil.erreur} recharger={profil.recharger} />;

  const roles = profil.donnees?.roles ?? [];

  if (roles.includes('Direction')) return <Direction />;
  if (roles.includes('Finance')) return <Finance />;
  if (roles.includes('ResProd')) return <Production />;
  if (roles.includes('Commercial')) return <Commercial />;

  return <EtatErreur message="Aucun tableau de bord n'est configuré pour votre compte JusOrange." />;
}
