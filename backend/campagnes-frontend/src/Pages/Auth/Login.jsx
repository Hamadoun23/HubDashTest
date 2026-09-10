import { Head, useForm } from '@inertiajs/react';
import AuthCard from '@/Layouts/AuthCard';
import { FieldBox, CheckLine } from '@/Components/ui/FieldBox';

export default function Login({ status }) {
    const { data, setData, post, processing, errors } = useForm({
        email: '',
        password: '',
        remember: false,
    });

    function submit(e) {
        e.preventDefault();
        post(route('login'));
    }

    return (
        <AuthCard title="Content de vous revoir" subtitle="Connectez-vous pour accéder à votre espace.">
            <Head title="Connexion" />

            {status && (
                <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                    {status}
                </div>
            )}

            <form onSubmit={submit} className="space-y-3">
                <FieldBox
                    label="Identifiant"
                    type="text"
                    autoFocus
                    autoComplete="username"
                    value={data.email}
                    onChange={(e) => setData('email', e.target.value)}
                    error={errors.email}
                />

                <FieldBox
                    label="Mot de passe"
                    type="password"
                    autoComplete="current-password"
                    value={data.password}
                    onChange={(e) => setData('password', e.target.value)}
                    error={errors.password}
                />

                <div className="pt-1">
                    <CheckLine
                        checked={data.remember}
                        onChange={(e) => setData('remember', e.target.checked)}
                    >
                        Rester connecté
                    </CheckLine>
                </div>

                <button
                    type="submit"
                    disabled={processing}
                    className="mt-2 flex h-12 w-full items-center justify-center rounded-xl bg-marque-700 text-[15px] font-medium text-white transition-colors hover:bg-marque-800 disabled:opacity-50"
                >
                    {processing ? 'Connexion…' : 'Se connecter'}
                </button>
            </form>

            <p className="mt-5 text-sm text-ardoise-500">
                Un problème pour vous connecter ? Contactez votre administrateur.
            </p>
        </AuthCard>
    );
}
