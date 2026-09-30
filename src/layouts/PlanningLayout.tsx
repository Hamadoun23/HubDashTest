import { Building2, Calendar, Clapperboard, FileText, ListChecks, LogOut } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { NAVIGATION } from '../lib/navigation';
import { BoutonMenu, TiroirMobile } from '../components/TiroirMobile';
import { ClocheNotifications } from '../components/notifications/ClocheNotifications';
import { useAuth } from '../lib/auth/AuthContext';
import { Avatar } from '../components/ui/Avatar';
import { useApi } from '../lib/hooks/useApi';
import { listerClients } from '../lib/api/planning';
import { usePermissionsPlanning } from '../pages/planning/permissions';

/**
 * Planning reprend l'habillage sombre "Virtus" du hub, au même titre que
 * RH & Finance et Jus d'orange (voir RhLayout.tsx) — demande explicite :
 * même motif, mêmes surfaces translucides plutôt que le bandeau dégradé
 * clair propre restauré précédemment. Chantiers garde pour l'instant le
 * sien.
 */
function estActif(chemin: string, href: string) {
  return chemin === href || chemin.startsWith(`${href}/`);
}

const ONGLETS = NAVIGATION.find((g) => g.app === 'planning')!.items;

export default function PlanningLayout() {
  const [menuMobile, setMenuMobile] = useState(false);
  const fermerMenu = useCallback(() => setMenuMobile(false), []);
  const { pathname, hash } = useLocation();
  const navigate = useNavigate();
  const { utilisateur, deconnecter } = useAuth();
  const [menuOuvert, setMenuOuvert] = useState(false);
  const { estClient } = usePermissionsPlanning();
  // Un compte client ne voit que son propre ClientPlanning — le backend filtre
  // déjà `listerClients()` à cette seule ligne pour ce rôle (voir
  // `ClientPlanningViewSet.get_queryset`), donc pas besoin d'un endpoint dédié.
  const monClient = useApi(listerClients, []);
  const monClientId = estClient ? monClient.donnees?.[0]?.id : undefined;
  const monClientNom = estClient ? monClient.donnees?.[0]?.nom_entreprise : undefined;

  useEffect(() => {
    if (!estClient || !monClientId) return;
    const monEspace = `/planning/clients/${monClientId}`;
    // Un compte client n'a qu'un seul espace : toute autre route de Planning
    // (accueil, liste des clients, calendriers d'équipe...) le renvoie dessus.
    if (pathname !== monEspace) {
      navigate(monEspace, { replace: true });
    }
  }, [estClient, monClientId, pathname, navigate]);

  // Un compte client ne peut charger qu'une seule page (`/planning/clients/{id}`,
  // voir la redirection ci-dessus) — ces entrées pointent donc vers des ancres
  // de cette même page plutôt que vers des routes distinctes (qui lui seraient
  // de toute façon fermées par `ReserveEquipe` côté backend).
  const sectionsClient = monClientId
    ? [
        { hash: '', label: monClientNom ?? 'Vue d’ensemble', icon: Building2 },
        { hash: '#calendrier', label: 'Calendrier', icon: Calendar },
        { hash: '#evenements', label: 'Tournages & publications', icon: ListChecks },
        { hash: '#rapports', label: 'Rapports', icon: FileText },
      ]
    : [];

  const nomAffiche = utilisateur?.nom_complet || utilisateur?.username || '—';

  // Même barre latérale sur grand écran et dans le tiroir mobile.
  const barreLaterale = (
      <aside className="hidden h-screen w-64 shrink-0 flex-col overflow-hidden border-r border-border bg-surface backdrop-blur-xl md:flex">
        <div className="flex h-16 items-center gap-2 border-b border-border px-5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-black">
            <Clapperboard size={18} />
          </div>
          <div className="min-w-0 leading-tight">
            <p className="truncate font-semibold text-white">GDA Media Planning</p>
            <p className="truncate text-xs text-muted">Gestion des plannings</p>
          </div>
        </div>
  
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
          {estClient
            ? sectionsClient.map((section) => {
                const Icon = section.icon;
                const actif = pathname === `/planning/clients/${monClientId}` && hash === section.hash;
                return (
                  <Link
                    key={section.hash || 'accueil'}
                    to={`/planning/clients/${monClientId}${section.hash}`}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      actif ? 'bg-accent text-black' : 'text-muted hover:bg-surface2 hover:text-white'
                    }`}
                  >
                    <Icon size={15} className="shrink-0" />
                    {section.label}
                  </Link>
                );
              })
            : ONGLETS.map((onglet) => {
                const Icon = onglet.icon;
                const actif = estActif(pathname, onglet.href);
                return (
                  <Link
                    key={onglet.href}
                    to={onglet.href}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      actif ? 'bg-accent text-black' : 'text-muted hover:bg-surface2 hover:text-white'
                    }`}
                  >
                    <Icon size={15} className="shrink-0" />
                    {onglet.label}
                  </Link>
                );
              })}
        </nav>
  
        <div className="border-t border-border p-4">
          <div className="flex items-center gap-2 rounded-2xl border border-border bg-surface2 px-3 py-2.5">
            <Avatar label={nomAffiche} size={36} />
            <div className="flex-1 overflow-hidden text-left">
              <p className="truncate text-sm font-semibold text-white">{nomAffiche}</p>
              {estClient && monClientNom && <p className="truncate text-xs text-muted">{monClientNom}</p>}
            </div>
            <button
              onClick={() => {
                deconnecter();
                navigate('/connexion');
              }}
              title="Se déconnecter"
              className="shrink-0 rounded-lg p-1.5 text-muted hover:bg-surface hover:text-white"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>
  );

  return (
    <div
      className="flex h-screen w-full bg-cover bg-center bg-fixed text-white"
      style={{ backgroundImage: "url('/motif-orange.jpg')" }}
    >
      {barreLaterale}
      <TiroirMobile ouvert={menuMobile} onFermer={fermerMenu}>
        {barreLaterale}
      </TiroirMobile>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-surface/40 px-4 backdrop-blur-md sm:justify-end sm:px-8">
          <BoutonMenu onClick={() => setMenuMobile(true)} className="md:hidden" />
          <Link to="/planning" className="shrink-0 font-display text-base font-bold text-white md:hidden">
            GDA Media Planning
          </Link>

          <Link
            to="/"
            title="Revenir à GDA Hub"
            className="hidden items-center gap-1.5 rounded-full border border-border bg-surface2 px-3 py-1.5 text-xs font-semibold text-muted backdrop-blur-sm transition hover:text-white sm:inline-flex"
          >
            <span aria-hidden>&larr;</span>
            GDA Hub
          </Link>

          <ClocheNotifications />

          <div className="relative shrink-0">
            <button
              onClick={() => setMenuOuvert((v) => !v)}
              className="flex items-center gap-2.5 rounded-full border border-border bg-surface2 py-1.5 pl-1.5 pr-3 backdrop-blur-sm transition hover:bg-surface"
            >
              <Avatar label={nomAffiche} size={28} />
              <span className="hidden text-sm font-medium text-white sm:block">{nomAffiche}</span>
            </button>

            {menuOuvert && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOuvert(false)} />
                <div className="absolute right-0 z-20 mt-1 w-52 rounded-xl border border-border bg-surface p-1.5 shadow-lg backdrop-blur-xl">
                  <button
                    onClick={() => {
                      deconnecter();
                      navigate('/connexion');
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-red-400 hover:bg-red-500/10"
                  >
                    <LogOut size={14} />
                    Déconnexion
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 py-5 lg:px-8 lg:py-6">
          <div className="mx-auto max-w-[1400px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
