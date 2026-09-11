import { ArrowLeft, Clapperboard, LogOut } from 'lucide-react';
import { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { NAVIGATION } from '../lib/navigation';
import { useAuth } from '../lib/auth/AuthContext';

/**
 * Identité visuelle propre de Campagnes — cette app n'existe pas dans le
 * dépôt GdaHub (elle n'a jamais fait partie de l'interface unique : elle
 * servait à l'origine ses propres pages Inertia, cf. gateway/nginx.conf).
 * Elle suit donc le même principe que les 4 autres apps métier plutôt que
 * de recopier une référence qui n'existe pas : fond clair, identité propre
 * (violet, cohérent avec sa couleur déjà utilisée dans le lanceur du hub),
 * jamais l'habillage sombre "Virtus" réservé à la coquille du hub. Voir
 * retrogradeAppmetier.md.
 */
function estActif(chemin: string, href: string) {
  return chemin === href || chemin.startsWith(`${href}/`);
}

const GROUPE = NAVIGATION.find((g) => g.app === 'campagnes')!;

function initiales(nom: string) {
  return nom
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((mot) => mot[0])
    .join('')
    .toUpperCase();
}

export default function CampagnesLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { utilisateur, deconnecter } = useAuth();
  const [menuOuvert, setMenuOuvert] = useState(false);

  const nomAffiche = utilisateur?.nom_complet || utilisateur?.username || '—';

  return (
    <div className="flex h-screen w-full bg-[#faf9fc] text-slate-900">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-campagnes-primary text-white">
            <Clapperboard size={18} />
          </div>
          <div className="leading-tight">
            <p className="font-semibold text-slate-900">Campagnes</p>
            <p className="text-xs text-slate-500">Ventes &amp; enrôlements</p>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
          {GROUPE.items.map((item) => {
            const Icon = item.icon;
            const actif = estActif(pathname, item.href);
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  actif ? 'bg-campagnes-primary/10 text-campagnes-primaryDark' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon size={15} className="shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur">
          <Link
            to="/"
            title="Revenir à GDA Hub"
            className="hidden shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-slate-500 transition hover:bg-slate-100 sm:inline-flex"
          >
            <ArrowLeft size={15} />
            GDA Hub
          </Link>

          <div className="relative ml-auto shrink-0">
            <button
              onClick={() => setMenuOuvert((v) => !v)}
              className="flex size-9 items-center justify-center rounded-full bg-campagnes-primary/15 text-sm font-semibold text-campagnes-primaryDark"
            >
              {initiales(nomAffiche)}
            </button>
            {menuOuvert && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOuvert(false)} />
                <div className="absolute right-0 z-20 mt-2 w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
                  <div className="px-2.5 py-2">
                    <p className="text-sm font-medium text-slate-800">{nomAffiche}</p>
                  </div>
                  <button
                    onClick={() => {
                      deconnecter();
                      navigate('/connexion');
                    }}
                    className="block w-full rounded-md px-2.5 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
                  >
                    <span className="flex items-center gap-2">
                      <LogOut size={14} /> Déconnexion
                    </span>
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
