import { Head, router, usePage } from '@inertiajs/react';
import { Building2, Check, LogOut, Users } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Choix du client de GDA.
 *
 * GDA mène les campagnes de plusieurs banques. Tout ce qu'un administrateur voit
 * ensuite — campagnes, commerciaux, ventes, rapports — dépend de ce choix.
 * L'écran s'affiche à la connexion et reste accessible depuis la barre latérale.
 */
function CarteClient({ partenaire, courant, onChoisir }) {
    const parAgences = partenaire.organisation === 'agences';

    return (
        <button
            type="button"
            onClick={() => onChoisir(partenaire.id)}
            className={cn(
                'group relative flex w-full flex-col items-start gap-4 rounded-2xl border bg-white p-6 text-left transition-all',
                'hover:-translate-y-0.5 hover:shadow-lg',
                courant
                    ? 'border-marque-500 ring-2 ring-marque-500/20'
                    : 'border-ardoise-200 hover:border-ardoise-300',
            )}
        >
            {courant && (
                <span className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full bg-marque-700 text-white">
                    <Check size={14} strokeWidth={3} />
                </span>
            )}

            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-marque-50 text-lg font-bold uppercase text-marque-700">
                {partenaire.code}
            </span>

            <div className="min-w-0">
                <p className="text-lg font-semibold text-ardoise-900">{partenaire.nom}</p>
                {partenaire.nom_complet && (
                    <p className="mt-0.5 text-sm text-ardoise-500">{partenaire.nom_complet}</p>
                )}
            </div>

            <dl className="flex w-full flex-wrap gap-x-6 gap-y-2 border-t border-ardoise-100 pt-4 text-sm">
                <div className="flex items-center gap-1.5 text-ardoise-600">
                    {parAgences ? <Building2 size={15} /> : <Users size={15} />}
                    <span className="font-medium text-ardoise-900">
                        {parAgences ? partenaire.agences : partenaire.commerciaux}
                    </span>
                    <span>{parAgences ? 'agences' : 'commerciaux'}</span>
                </div>
                <div className="flex items-center gap-1.5 text-ardoise-600">
                    <span className="font-medium text-ardoise-900">{partenaire.campagnes_actives}</span>
                    <span>
                        {partenaire.campagnes_actives > 1 ? 'campagnes actives' : 'campagne active'}
                    </span>
                </div>
            </dl>
        </button>
    );
}

export default function PartenairesChoix({ partenaires, courantId }) {
    const { auth } = usePage().props;

    function choisir(id) {
        router.post(route('partenaires.choix.store'), { partenaire_id: id });
    }

    function logout(e) {
        e.preventDefault();
        router.post(route('logout'));
    }

    return (
        <div className="flex min-h-screen flex-col bg-[#f7f7f8]">
            <Head title="Choisir un client" />

            <header className="flex items-center justify-between px-6 py-6 lg:px-10">
                <img src="/img/logo-gda-carre.png" alt="GDA" className="h-10 w-auto object-contain" />
                <button
                    onClick={logout}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-ardoise-500 transition-colors hover:bg-red-50 hover:text-red-600"
                >
                    <LogOut size={16} />
                    Déconnexion
                </button>
            </header>

            <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center px-6 pb-16">
                <p className="text-sm font-medium text-marque-700">
                    Bonjour, {auth.user?.prenom || auth.user?.name}
                </p>
                <h1 className="mt-1 text-2xl font-semibold text-ardoise-900">
                    Pour quel client travaillez-vous ?
                </h1>
                <p className="mt-2 max-w-xl text-sm text-ardoise-500">
                    GDA pilote les campagnes de vente de cartes pour plusieurs banques. Le client
                    sélectionné détermine les campagnes, les commerciaux et les rapports que vous
                    consultez. Vous pourrez en changer à tout moment.
                </p>

                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                    {partenaires.map((p) => (
                        <CarteClient
                            key={p.id}
                            partenaire={p}
                            courant={p.id === courantId}
                            onChoisir={choisir}
                        />
                    ))}
                </div>

                {partenaires.length === 0 && (
                    <p className="mt-8 rounded-xl border border-dashed border-ardoise-300 p-8 text-center text-sm text-ardoise-500">
                        Aucun client actif n'est configuré.
                    </p>
                )}
            </main>
        </div>
    );
}
