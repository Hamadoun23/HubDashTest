import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth/AuthContext';

export function RequireAuth() {
  const { identite, chargement } = useAuth();

  if (chargement) {
    return <div className="flex h-screen w-full items-center justify-center bg-bg text-sm text-muted">Chargement…</div>;
  }

  if (!identite) return <Navigate to="/connexion" replace />;

  return <Outlet />;
}
