import { Head, useForm, router } from '@inertiajs/react';
import { Mail, LogOut } from 'lucide-react';
import AuthCard from '@/Layouts/AuthCard';
import Button from '@/Components/ui/Button';

export default function VerifyEmail({ status }) {
    const { post, processing } = useForm();

    function resend(e) {
        e.preventDefault();
        post(route('verification.send'));
    }

    function logout(e) {
        e.preventDefault();
        router.post(route('logout'));
    }

    return (
        <AuthCard title="Vérification e-mail">
            <Head title="Vérification e-mail" />

            <p className="mb-4 text-sm text-ardoise-600">
                Merci de votre inscription ! Avant de commencer, pourriez-vous vérifier votre adresse e-mail en cliquant
                sur le lien que nous venons de vous envoyer ? Si vous n'avez pas reçu l'e-mail, nous pouvons vous en renvoyer un.
            </p>

            {status === 'verification-link-sent' && (
                <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3.5 py-2.5 text-sm text-green-800">
                    Un nouveau lien de vérification a été envoyé à l'adresse e-mail que vous avez fournie.
                </div>
            )}

            <div className="flex items-center justify-between">
                <Button onClick={resend} disabled={processing} size="sm">
                    <Mail size={14} />
                    Renvoyer l'e-mail de vérification
                </Button>

                <button onClick={logout} className="flex items-center gap-1.5 text-sm text-ardoise-500 underline hover:text-ardoise-800">
                    <LogOut size={14} />
                    Déconnexion
                </button>
            </div>
        </AuthCard>
    );
}
