import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth/AuthContext';
import { useCommercialExterne } from '../lib/auth/commercialExterne';
import { NotificationsProvider } from '../lib/notifications/NotificationsContext';

export function RequireAuth() {
  const { identite, chargement } = useAuth();
  const externe = useCommercialExterne();
  const { pathname } = useLocation();

  if (chargement) {
    return <div className="flex h-screen w-full items-center justify-center bg-bg text-sm text-muted">Chargement…</div>;
  }

  // Une seule connexion pour tout le monde : celle du hub.
  if (!identite) return <Navigate to="/connexion" replace />;

  // Commercial externe (BDM, UBA…) : il ne voit que Campagnes. Toute autre
  // adresse du hub — l'accueil juste après la connexion compris — le ramène
  // sur son tableau de bord.
  if (externe && !(pathname === '/campagnes' || pathname.startsWith('/campagnes/'))) {
    return <Navigate to="/campagnes" replace />;
  }

  return (
    <NotificationsProvider>
      <Outlet />
    </NotificationsProvider>
  );
}
