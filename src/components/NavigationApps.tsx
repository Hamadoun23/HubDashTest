import { useEffect, useState } from 'react';
import { ArrowLeft, BarChart3, Building2, Camera, ChevronRight, ClipboardList, CloudSun, FileText, HardHat, Home, LayoutDashboard, List, Megaphone, Users } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth/AuthContext';
import { APPLICATIONS_HUB, NAVIGATION, type AppKey, type NavItem } from '../lib/navigation';
import { itemJusVisible, rolesJusDepuisHub } from '../lib/rolesJus';

type SousGroupe = { label?: string; items: NavItem[] };

/** Chemin hub d'une page : la racine d'une appli n'est active que pour elle-même. */
function estActif(chemin: string, href: string, racines: string[]) {
  if (racines.includes(href)) return chemin === href;
  return chemin === href || chemin.startsWith(`${href}/`);
}

/** Chantier ouvert : celui de l'adresse, sinon le dernier consulté. */
function chantierActif(): string | null {
  const m = /^#\/chantiers\/(\d+)/.exec(window.location.hash);
  if (m) return m[1];
  try {
    return localStorage.getItem('chantiers_dernier_actif');
  } catch {
    return null;
  }
}

/** Appli dont relève l'adresse courante (`null` sur les écrans du hub). */
export function appDuChemin(chemin: string): AppKey | null {
  const segment = chemin.split('/')[1];
  if (segment === 'rh') return 'rh';
  if (segment === 'jus') return 'jus';
  if (segment === 'chantiers') return 'chantiers';
  if (segment === 'planning') return 'planning';
  if (segment === 'campagnes') return 'campagnes';
  return null;
}

/**
 * Sous-menus d'une appli pour la personne connectée. Mêmes règles que les
 * applis elles-mêmes (le serveur refuse de toute façon le reste) : on ne
 * propose pas un écran qui répondrait « accès refusé ».
 */
function sousMenus(app: AppKey, habilitations: Record<string, string[]>, estSuperadmin: boolean, valideur: boolean): SousGroupe[] {
  const groupes = NAVIGATION.filter((g) => g.app === app);
  if (app === 'rh') {
    return [{ items: groupes[0].items.filter((i) => i.href !== '/rh/validations' || valideur) }];
  }
  if (app === 'jus') {
    const roles = rolesJusDepuisHub(habilitations.orange ?? [], estSuperadmin);
    return groupes
      .map((g) => ({
        label: g.label.replace("Jus d'orange — ", ''),
        items: g.items.filter((i) => itemJusVisible(g.key, i.href, roles)),
      }))
      .filter((g) => g.items.length > 0);
  }
  if (app === 'planning') {
    const roles = habilitations.planning ?? [];
    const client = !estSuperadmin && roles.includes('client') && !roles.some((r) => r === 'admin' || r === 'team');
    return [{ items: client ? [{ label: 'Mon espace', href: '/planning', icon: Home }] : groupes[0].items }];
  }
  if (app === 'chantiers') {
    const roles = habilitations.daily ?? [];
    const internes = ['admin', 'chef_chantier', 'ingenieur', 'controle_qualite'];
    const partenaire = !estSuperadmin && roles.length > 0 && roles.every((r) => r === 'partenaire');
    // Partenaire et direction consultent : pas de saisie ni de dépôt de photos.
    const lectureSeule = !estSuperadmin && !roles.some((r) => internes.includes(r));
    const projet = chantierActif();
    const items: NavItem[] = [];
    if (projet) {
      const base = `/chantiers/${projet}`;
      items.push({ label: 'Tableau de bord', href: base, icon: LayoutDashboard });
      if (!lectureSeule) items.push({ label: 'Saisie du jour', href: `${base}/saisie`, icon: ClipboardList });
      items.push({ label: 'Toutes les tâches', href: `${base}/taches`, icon: List });
      if (!lectureSeule) items.push({ label: 'Galerie photos', href: `${base}/photos`, icon: Camera });
      items.push({ label: 'Rapport PDF', href: `${base}/rapport`, icon: FileText }, { label: 'Prévisions météo', href: `${base}/meteo`, icon: CloudSun });
    } else {
      items.push({ label: 'Suivi de chantier', href: '/chantiers', icon: HardHat });
    }
    if (!partenaire) items.push({ label: 'Tous les chantiers', href: '/chantiers/projets', icon: Building2 });
    return [{ items }];
  }
  // Campagnes : écrans BDM selon le rôle (cf. backend campagnes, role_required).
  const roles = habilitations.campagnes ?? [];
  const admin = estSuperadmin || roles.includes('admin');
  const direction = roles.includes('direction');
  const items: NavItem[] = [{ label: 'Tableau de bord', href: '/campagnes/dashboard', icon: LayoutDashboard }];
  if (admin) {
    items.push(
      { label: 'Campagnes', href: '/campagnes/admin/campagnes', icon: Megaphone },
      { label: 'Utilisateurs', href: '/campagnes/admin/users', icon: Users },
    );
  } else if (direction) {
    items.push({ label: 'Campagnes', href: '/campagnes/direction/campagnes', icon: Megaphone });
  }
  if (admin || direction) {
    items.push(
      { label: 'Rapports', href: '/campagnes/rapports', icon: ClipboardList },
      { label: 'Performances', href: '/campagnes/performances', icon: BarChart3 },
    );
  }
  return [{ items }];
}

/** Bouton principal de retour au hub, bien visible en tête de barre latérale. */
export function BoutonRetourHub({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      to="/"
      title="Revenir à l'accueil de GDA Hub"
      className={`flex items-center justify-center gap-2 rounded-xl bg-accent font-semibold text-black shadow-lg shadow-accent/20 transition hover:bg-accent2 focus:outline-none focus:ring-2 focus:ring-white/60 ${
        compact ? 'px-4 py-2 text-sm' : 'w-full px-4 py-3 text-sm'
      }`}
    >
      <ArrowLeft size={18} strokeWidth={2.5} />
      Retour au hub
    </Link>
  );
}

/**
 * Navigation entre applications, à la manière de la documentation Angular :
 * chaque appli est une section dépliable avec ses sous-menus, celle où l'on
 * se trouve est ouverte, l'élément actif est marqué d'un trait à gauche.
 * On passe d'une appli à l'autre sans repasser par l'accueil.
 */
export function NavigationApps({ onNaviguer, exclure, titre = 'Applications' }: { onNaviguer?: () => void; exclure?: AppKey; titre?: string }) {
  const { pathname } = useLocation();
  const { identite, utilisateur, applications, habilitations } = useAuth();
  const estSuperadmin = Boolean(identite?.est_superadmin);
  const valideur = Boolean(utilisateur && (utilisateur.est_encadrant || utilisateur.role !== 'SALARIE'));
  const courante = appDuChemin(pathname);

  const accessibles = APPLICATIONS_HUB.filter(
    (app) => app.key !== exclure && applications.some((a) => a.active && a.chemin.split('/')[1] === app.chemin.split('/')[1]),
  );

  const [ouvertes, setOuvertes] = useState<Set<AppKey>>(() => new Set(courante ? [courante] : []));
  // En changeant d'appli, sa section s'ouvre d'elle-même.
  useEffect(() => {
    if (courante) setOuvertes((s) => (s.has(courante) ? s : new Set(s).add(courante)));
  }, [courante]);

  const basculer = (cle: AppKey) =>
    setOuvertes((s) => {
      const suivant = new Set(s);
      if (suivant.has(cle)) suivant.delete(cle);
      else suivant.add(cle);
      return suivant;
    });

  return (
    <div className="space-y-1">
      {accessibles.length > 0 && <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted">{titre}</p>}
      {accessibles.map((app) => {
        const Icone = app.icon;
        const ouverte = ouvertes.has(app.key);
        const active = courante === app.key;
        const groupes = sousMenus(app.key, habilitations, estSuperadmin, valideur);
        const racines = groupes.flatMap((g) => g.items.map((i) => i.href)).filter((h) => h.split('/').length <= 2 || h === '/campagnes/dashboard' || /^\/chantiers\/\d+$/.test(h));
        return (
          <div key={app.key}>
            <div
              className={`flex items-center rounded-xl transition-colors ${active ? 'bg-surface2 text-white' : 'text-muted hover:bg-surface2 hover:text-white'}`}
            >
              <Link
                to={app.key === 'campagnes' ? '/campagnes/dashboard' : app.chemin}
                onClick={() => {
                  setOuvertes((s) => new Set(s).add(app.key));
                  onNaviguer?.();
                }}
                className="flex flex-1 items-center gap-3 overflow-hidden px-3 py-2 text-sm font-semibold"
              >
                <span className={`h-2 w-2 shrink-0 rounded-full ${app.couleur}`} />
                <Icone size={16} className="shrink-0" />
                <span className="truncate">{app.nom}</span>
              </Link>
              <button
                type="button"
                onClick={() => basculer(app.key)}
                aria-expanded={ouverte}
                aria-label={ouverte ? `Replier ${app.nom}` : `Déplier ${app.nom}`}
                className="mr-1 rounded-lg p-1.5 hover:bg-surface"
              >
                <ChevronRight size={15} className={`transition-transform ${ouverte ? 'rotate-90' : ''}`} />
              </button>
            </div>

            {ouverte && (
              <div className="mb-2 ml-5 mt-1 border-l border-border pl-1">
                {groupes.map((groupe, i) => (
                  <div key={groupe.label ?? i} className={i > 0 ? 'mt-2' : ''}>
                    {groupe.label && groupes.length > 1 && (
                      <p className="px-3 pb-0.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted/80">{groupe.label}</p>
                    )}
                    {groupe.items.map((item) => {
                      const actif = estActif(pathname, item.href, racines);
                      return (
                        <Link
                          key={item.href}
                          to={item.href}
                          onClick={onNaviguer}
                          className={`-ml-[5px] flex items-center gap-2.5 border-l-2 py-1.5 pl-3 pr-2 text-[13px] transition-colors ${
                            actif ? 'border-accent font-semibold text-accent2' : 'border-transparent text-muted hover:border-white/30 hover:text-white'
                          }`}
                        >
                          <span className="truncate">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
