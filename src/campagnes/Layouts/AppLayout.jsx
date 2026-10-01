import { useState } from 'react';
import { usePage } from '@inertiajs/react';
import { ArrowLeft, Menu, MapPin, CheckCircle2, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { Link as LienHub } from 'react-router-dom';
import Sidebar from '@campagnes/Components/Sidebar';
import { InstallAppButton, InstallAppToast } from '@campagnes/Components/InstallApp';
import { cn } from '@campagnes/lib/cn';
import { useCommercialExterne } from '../../lib/auth/commercialExterne';
import { ClocheNotifications } from '../../components/notifications/ClocheNotifications';

/**
 * Mise en page des écrans de Campagnes dans GDA Hub : motif orange en fond,
 * barre latérale et en-tête du hub (cf. RhLayout), zone de contenu qui défile
 * seule. Titre, sous-titre, actions et messages de confirmation restent ceux
 * de BDM (Layouts/AppLayout.jsx d'origine).
 */

const alertConfig = {
    success: { icon: CheckCircle2, cls: 'border-emerald-400/30 bg-emerald-500/15 text-emerald-200' },
    error: { icon: AlertCircle, cls: 'border-rose-400/30 bg-rose-500/15 text-rose-200' },
    warning: { icon: AlertTriangle, cls: 'border-amber-400/30 bg-amber-500/15 text-amber-200' },
    status: { icon: Info, cls: 'border-sky-400/30 bg-sky-500/15 text-sky-200' },
};

function Alert({ tone, children }) {
    const { icon: Icon, cls } = alertConfig[tone];
    return (
        <div className={cn('mb-4 flex items-start gap-2 rounded-2xl border px-3.5 py-2.5 text-sm backdrop-blur-xl', cls)}>
            <Icon className="mt-0.5 h-4 w-4 shrink-0" size={16} />
            <span>{children}</span>
        </div>
    );
}

export default function AppLayout({ title, subtitle, actions, children }) {
    const { flash, auth } = usePage().props;
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const firstName = auth.user?.prenom || auth.user?.name;
    const isDashboard = typeof route === 'function' && route().current('dashboard');
    // Commercial externe : aucune porte vers le hub (cf. commercialExterne.ts).
    const externe = useCommercialExterne();

    return (
        <div
            className="flex h-screen w-full bg-cover bg-center bg-fixed text-white"
            style={{ backgroundImage: "url('/motif-orange.jpg')" }}
        >
            <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <div className="flex flex-1 flex-col overflow-hidden">
                <header
                    className="flex items-center gap-3 border-b border-border bg-surface/40 px-4 py-4 backdrop-blur-md sm:px-8"
                    style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1rem)' }}
                >
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="shrink-0 text-muted hover:text-white lg:hidden"
                    >
                        <Menu size={22} />
                    </button>

                    {!isDashboard && (
                        <button
                            onClick={() => window.history.back()}
                            title="Retour"
                            className="shrink-0 rounded-full p-1 text-muted hover:bg-surface2 hover:text-white"
                        >
                            <ArrowLeft size={18} />
                        </button>
                    )}

                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <h1 className="truncate font-display text-lg font-bold tracking-tight text-white">
                                {title || `Bonjour, ${firstName} !`}
                            </h1>
                            {/* Rappel constant de l'agence du commercial connecté : les
                                admins/direction n'ont pas d'agence propre, le badge ne
                                s'affiche donc que pour les comptes qui en ont une. */}
                            {auth.user?.agence_nom && (
                                <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-accent/40 bg-accent/15 px-2.5 py-0.5 text-xs font-medium text-accent2">
                                    <MapPin size={11} /> {auth.user.agence_nom}
                                </span>
                            )}
                        </div>
                        <p className="truncate text-sm text-muted">
                            {subtitle || 'Voici le suivi de votre activité.'}
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        {actions}
                        {/* Visible sur mobile aussi : c'est là que l'installation compte le plus. */}
                        <InstallAppButton />
                        <ClocheNotifications />
                        {!externe && (
                            <LienHub
                                to="/"
                                title="Revenir à GDA Hub"
                                className="hidden shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface2 px-3 py-1.5 text-xs font-semibold text-muted backdrop-blur-sm transition hover:text-white sm:inline-flex"
                            >
                                <span aria-hidden>&larr;</span>
                                GDA Hub
                            </LienHub>
                        )}
                    </div>
                </header>

                <main data-defilement className="flex-1 overflow-y-auto px-4 py-5 lg:px-8 lg:py-6">
                    <div className="mx-auto max-w-[1400px] pb-10">
                        {flash?.success && <Alert tone="success">{flash.success}</Alert>}
                        {flash?.error && <Alert tone="error">{flash.error}</Alert>}
                        {flash?.warning && <Alert tone="warning">{flash.warning}</Alert>}
                        {flash?.status && <Alert tone="status">{flash.status}</Alert>}
                        {children}
                    </div>
                </main>
            </div>

            <InstallAppToast />
        </div>
    );
}
