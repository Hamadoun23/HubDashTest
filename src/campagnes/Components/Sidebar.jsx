import { Link, usePage } from '@inertiajs/react';
import {
    LayoutDashboard, Building2, Users, Megaphone, CreditCard, FileBarChart,
    ClipboardList, Phone, FileText, TrendingUp, LogOut, X, Smartphone, Repeat,
} from 'lucide-react';
import { cn } from '@campagnes/lib/cn';
import { Link as LienHub, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth/AuthContext';
import { Avatar } from '../../components/ui/Avatar';
import { useCommercialExterne } from '../../lib/auth/commercialExterne';
import { BoutonRetourHub, NavigationApps } from '../../components/NavigationApps';

/**
 * Barre latérale de Campagnes dans GDA Hub.
 *
 * Même habillage que les autres applications du hub (RhLayout, JusLayout) :
 * 288 px, translucide sur le motif orange, entrée active en orange plein. Le
 * contenu, lui, reste celui de BDM (Components/Sidebar.jsx d'origine) :
 * entrées selon le rôle, client courant et bascule de client.
 */

// `client` porte le partenaire courant : un client sans réseau d'agences (UBA)
// n'a pas d'écran « Agences » à proposer.
function itemsFor(user, client) {
    const items = [{ href: route('dashboard'), label: 'Tableau de bord', icon: LayoutDashboard, match: 'dashboard' }];

    if (user.is_direction) {
        items.push(
            { href: route('direction.campagnes.index'), label: 'Campagnes', icon: Megaphone, match: 'direction.campagnes.*' },
            { href: route('rapports.index'), label: 'Rapports', icon: FileBarChart, match: 'rapports.*' },
            { href: route('performances.index'), label: 'Performances', icon: TrendingUp, match: 'performances.*' },
        );
    }

    if (user.is_admin) {
        items.push(
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
        );
    }

    if (user.is_commercial) {
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
    }

    if (user.is_commercial_telephonique) {
        items.push(
            { href: route('commercial.telephonique.create'), label: 'Reporting téléphonique', icon: Phone, match: 'commercial.telephonique.*' },
            { href: route('commercial.contrat'), label: 'Mon contrat', icon: FileText, match: 'commercial.contrat' },
            { href: route('performances.index'), label: 'Performances', icon: TrendingUp, match: 'performances.*' },
        );
    }

    return items;
}

function Entree({ item, onClick }) {
    const actif = route().current(item.match);
    const Icon = item.icon;

    return (
        <Link
            href={item.href}
            onClick={onClick}
            className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                actif ? 'bg-accent text-black' : 'text-muted hover:bg-surface2 hover:text-white',
            )}
        >
            <Icon size={16} className="shrink-0" />
            <span className="truncate">{item.label}</span>
        </Link>
    );
}

function Marque({ client }) {
    // Le nom du client remplace « BDM » : l'application sert plusieurs banques,
    // et l'en-tête doit dire laquelle on regarde.
    const nom = client?.courant?.nom;
    // Un commercial externe ne connaît que Campagnes : ni « GDA Hub » ni hub.
    const externe = useCommercialExterne();

    return (
        <Link href={route('dashboard')} className="flex items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl p-1.5 shadow" style={{ backgroundColor: "#fff" }}>
                <img src="/logo-gda.png" alt="GDA" className="h-full w-full object-contain" />
            </div>
            <div className="min-w-0 leading-tight">
                <p className="truncate font-display text-lg font-bold tracking-tight text-white">
                    {externe ? 'Campagnes GDA' : 'GDA Hub'}
                </p>
                <p className="truncate text-xs text-muted">
                    {externe ? (nom ? `Campagne ${nom}` : 'Espace commercial') : nom ? `Campagnes · ${nom}` : 'Campagnes'}
                </p>
            </div>
        </Link>
    );
}

function Client({ client, onClick }) {
    if (!client?.courant) return null;

    return (
        <div className="mx-3 mb-3 rounded-2xl border border-border bg-surface2 px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Client</p>
            <div className="mt-0.5 flex items-center justify-between gap-2">
                <p className="truncate text-sm font-semibold text-accent">{client.courant.nom}</p>
                {client.peut_changer && (
                    <Link
                        href={route('partenaires.choix')}
                        onClick={onClick}
                        className="flex shrink-0 items-center gap-1 rounded-lg px-1.5 py-1 text-xs font-medium text-muted transition-colors hover:bg-surface hover:text-white"
                    >
                        <Repeat size={13} />
                        Changer
                    </Link>
                )}
            </div>
        </div>
    );
}

/** Déconnexion : ferme la session Campagnes, puis le compte unique du hub. */
export function useDeconnexion() {
    const { deconnecter } = useAuth();
    const navigate = useNavigate();
    return async (e) => {
        e?.preventDefault();
        await window.axios.post(route('logout')).catch(() => undefined);
        deconnecter();
        navigate('/connexion');
    };
}

function Contenu({ onNaviguer }) {
    const { auth, client } = usePage().props;
    const user = auth.user;
    const items = itemsFor(user, client);
    const deconnexion = useDeconnexion();
    const nom = [user.prenom, user.name].filter(Boolean).join(' ') || '—';
    const externe = useCommercialExterne();
    const identite = (
        <>
            <Avatar label={nom} size={36} />
            <div className="flex-1 overflow-hidden text-left">
                <p className="truncate text-sm font-semibold text-white">{nom}</p>
                <p className="truncate text-xs capitalize text-muted">{user.role?.replace('_', ' ')}</p>
            </div>
        </>
    );

    return (
        <>
            {!externe && (
                <div className="px-3 pb-2">
                    <BoutonRetourHub />
                </div>
            )}
            <nav className="mt-2 flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
                {items.map((item) => (
                    <Entree key={item.label + item.href} item={item} onClick={onNaviguer} />
                ))}
                {/* Passer directement à une autre appli du hub, sans repasser par l'accueil. */}
                {!externe && (
                    <div className="mt-5 border-t border-border pt-4">
                        <NavigationApps onNaviguer={onNaviguer} exclure="campagnes" titre="Autres applications" />
                    </div>
                )}
            </nav>

            <div className="border-t border-border p-3" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
                <div className="flex items-center gap-2 rounded-2xl border border-border bg-surface2 px-3 py-2.5">
                    {/* « Mon compte » est une page du hub : pas pour un commercial externe. */}
                    {externe ? (
                        <div className="flex flex-1 items-center gap-3 overflow-hidden">{identite}</div>
                    ) : (
                        <LienHub to="/mon-compte" className="flex flex-1 items-center gap-3 overflow-hidden">
                            {identite}
                        </LienHub>
                    )}
                    <button
                        onClick={deconnexion}
                        title="Se déconnecter"
                        className="shrink-0 rounded-lg p-1.5 text-muted hover:bg-surface hover:text-white"
                    >
                        <LogOut size={15} />
                    </button>
                </div>
            </div>
        </>
    );
}

export default function Sidebar({ open, onClose }) {
    const { client } = usePage().props;

    return (
        <>
            {/* Barre latérale — écran large */}
            <aside className="hidden h-screen w-72 shrink-0 flex-col overflow-hidden border-r border-border bg-surface backdrop-blur-xl lg:flex">
                <div className="px-5 py-5">
                    <Marque client={client} />
                </div>
                <Client client={client} />
                <Contenu />
            </aside>

            {/* Tiroir — mobile (commerciaux sur le terrain) */}
            {open && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={onClose} />}
            <aside
                className={cn(
                    'fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-border bg-[#1a130e]/95 backdrop-blur-xl transition-transform lg:hidden',
                    open ? 'translate-x-0' : '-translate-x-full',
                )}
            >
                <div
                    className="flex items-center justify-between px-5 py-4"
                    style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1rem)' }}
                >
                    <Marque client={client} />
                    <button onClick={onClose} className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface2 hover:text-white">
                        <X size={18} />
                    </button>
                </div>
                <Client client={client} onClick={onClose} />
                <Contenu onNaviguer={onClose} />
            </aside>
        </>
    );
}
