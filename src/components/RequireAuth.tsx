import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth/AuthContext';
import { useEspaceExterne } from '../lib/auth/commercialExterne';
import { NotificationsProvider } from '../lib/notifications/NotificationsContext';
import { BarreOngletsMobile } from './BarreOngletsMobile';
import ChangementObligatoire, { changementReporte } from '../pages/ChangementObligatoire';

export function RequireAuth() {
  const { identite, chargement } = useAuth();
  const espace = useEspaceExterne();
  const { pathname } = useLocation();

  if (chargement) {
    return <div className="flex h-screen w-full items-center justify-center bg-bg text-sm text-muted">Chargement…</div>;
  }

  // Une seule connexion pour tout le monde : celle du hub.
  if (!identite) return <Navigate to="/connexion" replace />;

  // Mot de passe provisoire (« 1234 » à la mise en service) : on propose d'en
  // choisir un personnel à la connexion. « Plus tard » laisse passer pour la
  // session ; le changement reste possible dans « Mon compte ».
  if (identite.doit_changer_mot_de_passe && !changementReporte()) return <ChangementObligatoire />;

  // Compte externe (commercial BDM/UBA, partenaire de chantier) : il ne voit
  // que son application. Toute autre adresse du hub — l'accueil juste après
  // la connexion compris — le ramène dans son espace.
  if (espace && !(pathname === espace || pathname.startsWith(`${espace}/`))) {
    return <Navigate to={espace} replace />;
  }

  return (
    <NotificationsProvider>
      <Outlet />
      {/* Barre d'onglets du bas (téléphone, tablette) : collaborateurs seulement. */}
      {!espace && <BarreOngletsMobile />}
    </NotificationsProvider>
  );
}
