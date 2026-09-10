import { Link, router, usePage } from '@inertiajs/react';
import {
    LayoutDashboard, Building2, Users, Megaphone, CreditCard, FileBarChart,
    ClipboardList, Phone, FileText, TrendingUp, LogOut, X, Smartphone, Repeat,
} from 'lucide-react';
import { cn } from '@/lib/cn';

// `client` porte le partenaire courant : un client sans réseau d'agences (UBA)
// n'a pas d'écran « Agences » à proposer.
//
// Regroupee par role, sur le meme principe que les autres applications du
// hub (Jus d'orange, FinanceRH, Chantiers, Planning) : une puce de couleur,
// un intitule de section, puis ses liens.
function groupesFor(user, client) {
    const groupes = [
        {
            cle: 'accueil',
            label: 'Accueil',
            couleur: 'bg-ardoise-400',
            items: [{ href: route('dashboard'), label: 'Dashboard', icon: LayoutDashboard, match: 'dashboard' }],
        },
    ];

    if (user.is_direction) {
        groupes.push({
            cle: 'direction',
            label: 'Direction',
            couleur: 'bg-violet-500',
            items: [
                { href: route('direction.campagnes.index'), label: 'Campagnes', icon: Megaphone, match: 'direction.campagnes.*' },
                { href: route('rapports.index'), label: 'Rapports', icon: FileBarChart, match: 'rapports.*' },
                { href: route('performances.index'), label: 'Performances', icon: TrendingUp, match: 'performances.*' },
            ],
        });
    }

    if (user.is_admin) {
        groupes.push({
            cle: 'admin',
            label: 'Administration',
            couleur: 'bg-marque-500',
            items: [
                { href: route('admin.campagnes.index'), label: 'Campagnes', icon: Megaphone, match: 'admin.campagnes.*' },
                ...(client?.courant?.a_des_agences === false
                    ? []
                    : [{ href: route('admin.agences.index'), label: 'Agences', icon: Building2, match: 'admin.agences.*' }]),
                { href: route('admin.users.index'), label: 'Utilisateurs', icon: Users, match: 'admin.users.*' },
                { href: route('admin.types-cartes.index'), label: 'Types de cartes', icon: CreditCard, match: 'admin.types-cartes.*' },
                { href: route('rapports.index'), label: 'Rapports', icon: FileBarChart, match: 'rapports.*' },
                { href: route('clients.index'), label: 'Clients', icon: Users, match: 'clients.*' },
                { href: route('performances.index'), label: 'Performances', icon: TrendingUp, match: 'performances.*' },
                { href: route('admin.login-logs.index'), label: 'Journal des connexions', icon: ClipboardList, match: 'admin.login-logs.*' },
                { href: route('admin.telephonique-rapports.index'), label: 'Reporting téléphonique', icon: Phone, match: 'admin.telephonique-rapports.*' },
            ],
        });
    }

    if (user.is_commercial) {
        const items = [];
        if (user.peut_vendre) {
            items.push({ href: route('ventes.index'), label: 'Mes ventes', icon: CreditCard, match: 'ventes.*' });
        }
        if (user.peut_enroler) {
            items.push({ href: route('enrolements.index'), label: 'Enrôlement clients', icon: Smartphone, match: 'enrolements.*' });
        }
        items.push(
            { href: route('commercial.contrat'), label: 'Mon contrat', icon: FileText, match: 'commercial.contrat' },
            { href: route('performances.index'), label: 'Performances', icon: TrendingUp, match: 'performances.*' },
        );
        groupes.push({ cle: 'commercial', label: 'Commercial', couleur: 'bg-blue-500', items });
    }

    if (user.is_commercial_telephonique) {
        groupes.push({
            cle: 'telephonique',
            label: 'Commercial téléphonique',
            couleur: 'bg-emerald-500',
            items: [
                { href: route('commercial.telephonique.create'), label: 'Reporting téléphonique', icon: Phone, match: 'commercial.telephonique.*' },
                { href: route('commercial.contrat'), label: 'Mon contrat', icon: FileText, match: 'commercial.contrat' },
                { href: route('performances.index'), label: 'Performances', icon: TrendingUp, match: 'performances.*' },
            ],
        });
    }

    return groupes.filter((g) => g.items.length > 0);
}

function NavItem({ item, onClick }) {
    const active = route().current(item.match);
    const Icon = item.icon;

    return (
        <Link
            href={item.href}
            onClick={onClick}
            className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                active ? 'bg-marque-700 text-white shadow-sm' : 'text-ardoise-300 hover:bg-white/5 hover:text-white',
            )}
        >
            <Icon size={16} className="shrink-0" strokeWidth={2} />
            {item.label}
        </Link>
    );
}

function Brand() {
    return (
        <Link href={route('dashboard')} className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white p-1 shadow-sm">
                <img src="/img/logo-gda-carre.png" alt="" className="h-full w-full object-contain" />
            </span>
            <div className="leading-tight">
                <p className="font-brand text-sm font-semibold text-white">Campagnes GDA</p>
                <p className="text-xs text-ardoise-400">Ventes de cartes bancaires</p>
            </div>
        </Link>
    );
}

function ClientIndicateur({ client, onClick }) {
    if (!client?.courant) return null;

    return (
        <div className="mx-3 mt-3 rounded-2xl bg-marque-500/10 px-3 py-2.5 ring-1 ring-marque-500/25">
            <p className="text-[11px] font-medium uppercase tracking-wide text-marque-400/80">Client</p>
            <div className="mt-0.5 flex items-center justify-between gap-2">
                <p className="truncate text-sm font-semibold text-marque-300">{client.courant.nom}</p>
                {client.peut_changer && (
                    <Link
                        href={route('partenaires.choix')}
                        onClick={onClick}
                        className="flex shrink-0 items-center gap-1 rounded-lg px-1.5 py-1 text-xs font-medium text-marque-300 transition-colors hover:bg-marque-500/15"
                    >
                        <Repeat size={13} />
                        Changer
                    </Link>
                )}
            </div>
        </div>
    );
}

function UserAvatar({ user }) {
    if (user.photo) {
        return (
            <img
                src={user.photo}
                alt=""
                className="h-9 w-9 shrink-0 rounded-full object-cover ring-2 ring-white/10"
            />
        );
    }
    return (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-marque-700 text-xs font-semibold text-white ring-2 ring-white/10">
            {(user.prenom || user.name || '?').charAt(0).toUpperCase()}
        </span>
    );
}

function ContenuBarreLaterale({ groupes, client, user, onNavigate, onLogout, masquerEntete = false }) {
    return (
        <div className="flex h-full flex-col bg-ardoise-950">
            {!masquerEntete && (
                <div className="flex h-16 items-center px-5 border-b border-white/10">
                    <Brand />
                </div>
            )}

            <ClientIndicateur client={client} onClick={onNavigate} />

            <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4 scrollbar-thin">
                {groupes.map((groupe) => (
                    <div key={groupe.cle}>
                        <div className="mb-1 flex items-center gap-2 px-3">
                            <span className={cn('size-1.5 rounded-full', groupe.couleur)} />
                            <p className="text-xs font-semibold uppercase tracking-wider text-ardoise-500">{groupe.label}</p>
                        </div>
                        <div className="space-y-0.5">
                            {groupe.items.map((item) => (
                                <NavItem key={item.label + item.href} item={item} onClick={onNavigate} />
                            ))}
                        </div>
                    </div>
                ))}
            </nav>

            <div className="border-t border-white/10 p-3">
                <div className="flex items-center gap-3 rounded-2xl px-2 py-2">
                    {/* Photo, nom, coordonnées : geres par le hub, pas par
                        Campagnes — ce lien y mene directement plutot que de
                        les redire ici. Adresse absolue : « Mon compte » est
                        servi par une autre application, derriere la meme
                        passerelle. */}
                    <a href="/mon-compte" className="flex min-w-0 flex-1 items-center gap-3" title="Mon compte (GDA Hub)">
                        <UserAvatar user={user} />
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-white">{user.prenom || user.name}</p>
                            <p className="truncate text-xs capitalize text-ardoise-400">{user.role?.replace('_', ' ')}</p>
                        </div>
                    </a>
                    <button onClick={onLogout} title="Déconnexion" className="rounded-lg p-1.5 text-ardoise-400 transition-colors hover:bg-red-500/10 hover:text-red-400">
                        <LogOut size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function Sidebar({ open, onClose }) {
    const { auth, client } = usePage().props;
    const user = auth.user;
    const groupes = groupesFor(user, client);

    function logout(e) {
        e.preventDefault();
        router.post(route('logout'));
    }

    return (
        <>
            {/* Barre laterale — desktop. Toujours sombre, comme la sidebar du
                hub Next.js (GdaHub) : c'est la seule zone sombre de l'appli,
                le canevas de contenu reste clair partout ailleurs. */}
            <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-white/10 lg:flex">
                <ContenuBarreLaterale groupes={groupes} client={client} user={user} onLogout={logout} />
            </aside>

            {/* Tiroir — mobile */}
            {open && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={onClose} />}
            <aside
                className={cn(
                    'fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-white/10 bg-ardoise-950 transition-transform lg:hidden',
                    open ? 'translate-x-0' : '-translate-x-full',
                )}
                style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
            >
                <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 px-4">
                    <Brand />
                    <button onClick={onClose} className="rounded-lg p-1.5 text-ardoise-400 transition-colors hover:bg-white/10 hover:text-white">
                        <X size={18} />
                    </button>
                </div>
                <ContenuBarreLaterale groupes={groupes} client={client} user={user} onNavigate={onClose} onLogout={logout} masquerEntete />
            </aside>
        </>
    );
}
