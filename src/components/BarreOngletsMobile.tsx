import { Bell, Building2, CalendarDays, ClipboardCheck, Home, LayoutGrid, UserRound, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth/AuthContext';
import { useNotificationsOptionnelles } from '../lib/notifications/NotificationsContext';
import { BoutonRetourHub, NavigationApps, appDuChemin } from './NavigationApps';

type Onglet = { libelle: string; href: string; icone: typeof Home; badge?: number };

function actif(chemin: string, href: string) {
  if (href === '/') return chemin === '/';
  return chemin === href || chemin.startsWith(`${href}/`);
}

/**
 * Barre d'onglets du bas, sur téléphone et tablette (cachée sur ordinateur,
 * où la barre latérale est toujours visible). Les écrans les plus utilisés
 * selon le rôle, plus « Plus » qui ouvre toute la navigation entre applis.
 * Réservée aux collaborateurs : un compte externe a sa propre navigation.
 */
export function BarreOngletsMobile() {
  const { pathname } = useLocation();
  const { applications, habilitations, identite, utilisateur } = useAuth();
  const nonLues = useNotificationsOptionnelles()?.nonLues ?? 0;
  const [plus, setPlus] = useState(false);

  useEffect(() => {
    document.body.classList.add('avec-onglets');
    return () => document.body.classList.remove('avec-onglets');
  }, []);
  // Toute navigation referme le menu « Plus ».
  useEffect(() => setPlus(false), [pathname]);

  const accesRh = applications.some((a) => a.chemin.startsWith('/rh'));
  const valideur = Boolean(utilisateur && (utilisateur.est_encadrant || utilisateur.role !== 'SALARIE'));
  const onglets: Onglet[] = [
    { libelle: 'Accueil', href: '/', icone: Home },
    ...(accesRh
      ? [valideur ? { libelle: 'À valider', href: '/rh/validations', icone: ClipboardCheck } : { libelle: 'Congés', href: '/rh/absences', icone: CalendarDays }]
      : []),
    { libelle: 'Alertes', href: '/notifications', icone: Bell, badge: nonLues },
    { libelle: 'Compte', href: '/mon-compte', icone: UserRound },
  ];
  const estAdminHub = Boolean(identite?.est_superadmin || habilitations.hub);

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur-xl lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Navigation principale"
      >
        <div className="mx-auto flex max-w-xl items-stretch justify-around">
          {onglets.map((o) => {
            const Icone = o.icone;
            const estActif = actif(pathname, o.href);
            return (
              <Link
                key={o.href}
                to={o.href}
                className={`relative flex min-h-[3.5rem] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${
                  estActif ? 'text-accent2' : 'text-muted'
                }`}
              >
                <Icone size={21} strokeWidth={estActif ? 2.4 : 2} />
                {o.libelle}
                {!!o.badge && (
                  <span className="absolute right-[calc(50%-1.1rem)] top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-black">
                    {o.badge > 99 ? '99+' : o.badge}
                  </span>
                )}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setPlus(true)}
            className={`flex min-h-[3.5rem] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${plus ? 'text-accent2' : 'text-muted'}`}
          >
            <LayoutGrid size={21} />
            Plus
          </button>
        </div>
      </nav>

      {plus && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Toutes les applications">
          <button type="button" aria-label="Fermer" className="absolute inset-0 bg-black/60" onClick={() => setPlus(false)} />
          <div
            className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl border-t border-border bg-surface px-4 pt-3 backdrop-blur-xl"
            style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}
          >
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-white/20" />
            <div className="mb-3 flex items-center justify-between">
              <p className="font-display text-lg font-bold text-white">Navigation</p>
              <button type="button" onClick={() => setPlus(false)} className="rounded-full p-2 text-muted hover:text-white" aria-label="Fermer">
                <X size={18} />
              </button>
            </div>
            {appDuChemin(pathname) && (
              <div className="mb-4">
                <BoutonRetourHub />
              </div>
            )}
            {estAdminHub && (
              <Link to="/administration" className="mb-3 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted hover:bg-surface2 hover:text-white">
                <Building2 size={16} />
                Administration
              </Link>
            )}
            <NavigationApps onNaviguer={() => setPlus(false)} />
          </div>
        </div>
      )}
    </>
  );
}
