import { useState } from 'react';
import { usePage } from '@inertiajs/react';
import { ArrowLeft, Menu, Search, Bell, CheckCircle2, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import Sidebar from '@/Components/Sidebar';
import { cn } from '@/lib/cn';

const alertConfig = {
    success: { icon: CheckCircle2, cls: 'bg-green-50 text-green-800 border-green-200' },
    error: { icon: AlertCircle, cls: 'bg-red-50 text-red-800 border-red-200' },
    warning: { icon: AlertTriangle, cls: 'bg-amber-50 text-amber-800 border-amber-200' },
    status: { icon: Info, cls: 'bg-blue-50 text-blue-800 border-blue-200' },
};

function Alert({ tone, children }) {
    const { icon: Icon, cls } = alertConfig[tone];
    return (
        <div className={cn('mb-4 flex items-start gap-2 rounded-lg border px-3.5 py-2.5 text-sm', cls)}>
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

    return (
        <div className="min-h-screen bg-ardoise-50">
            <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <div className="lg:pl-64">
                <header
                    className="flex items-center gap-3 px-4 py-5 lg:px-8"
                    style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1.25rem)' }}
                >
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="shrink-0 text-ardoise-500 hover:text-ardoise-700 lg:hidden"
                    >
                        <Menu size={22} />
                    </button>

                    {!isDashboard && (
                        <button
                            onClick={() => window.history.back()}
                            title="Retour"
                            className="shrink-0 text-ardoise-500 hover:text-ardoise-700"
                        >
                            <ArrowLeft size={20} />
                        </button>
                    )}

                    <div className="min-w-0 flex-1">
                        <h1 className="truncate text-lg font-semibold text-ardoise-900">
                            {title || `Bonjour, ${firstName} !`}
                        </h1>
                        <p className="truncate text-sm text-ardoise-500">
                            {subtitle || 'Voici le suivi de votre activité.'}
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        {actions}
                        {/* Le retour au hub. Une adresse absolue et non un lien
                            Inertia : l'accueil du hub est servi par une autre
                            application, derriere la meme passerelle. */}
                        <a
                            href="/"
                            title="Revenir a GDA Hub"
                            className="hidden shrink-0 items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-sm font-medium text-ardoise-500 shadow-sm ring-1 ring-ardoise-200 transition hover:text-ardoise-900 sm:inline-flex"
                        >
                            <ArrowLeft size={15} />
                            GDA Hub
                        </a>
                        <div className="hidden items-center gap-2 sm:flex">
                            <div className="flex items-center gap-2 rounded-full bg-white px-3.5 py-2 text-sm text-ardoise-400 shadow-sm ring-1 ring-ardoise-200">
                                <Search size={15} />
                                <span className="hidden lg:inline">Rechercher…</span>
                            </div>
                            <button className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-ardoise-400 shadow-sm ring-1 ring-ardoise-200 hover:text-ardoise-600">
                                <Bell size={16} />
                            </button>
                        </div>
                    </div>
                </header>

                <main className="mx-auto w-full max-w-6xl px-4 pb-10 lg:px-8">
                    {flash?.success && <Alert tone="success">{flash.success}</Alert>}
                    {flash?.error && <Alert tone="error">{flash.error}</Alert>}
                    {flash?.warning && <Alert tone="warning">{flash.warning}</Alert>}
                    {flash?.status && <Alert tone="status">{flash.status}</Alert>}
                    {children}
                </main>
            </div>
        </div>
    );
}
