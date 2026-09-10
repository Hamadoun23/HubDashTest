import { Head, useForm } from '@inertiajs/react';
import { Mail } from 'lucide-react';
import AuthCard from '@/Layouts/AuthCard';
import { Input, Label, FieldError } from '@/Components/ui/Input';
import Button from '@/Components/ui/Button';

export default function ForgotPassword({ status }) {
    const { data, setData, post, processing, errors } = useForm({ email: '' });

    function submit(e) {
        e.preventDefault();
        post(route('password.email'));
    }

    return (
        <AuthCard title="Mot de passe oublié" subtitle="Indiquez votre e-mail pour recevoir un lien de réinitialisation.">
            <Head title="Mot de passe oublié" />

            {status && (
                <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3.5 py-2.5 text-sm text-green-800">
                    {status}
                </div>
            )}

            <form onSubmit={submit} className="space-y-4">
                <div>
                    <Label htmlFor="email">E-mail</Label>
                    <Input
                        id="email"
                        type="email"
                        autoFocus
                        autoComplete="username"
                        value={data.email}
                        onChange={(e) => setData('email', e.target.value)}
                        error={errors.email}
                    />
                    <FieldError>{errors.email}</FieldError>
                </div>

                <Button type="submit" disabled={processing} className="w-full" size="lg">
                    <Mail size={16} />
                    Envoyer le lien de réinitialisation
                </Button>
            </form>
        </AuthCard>
    );
}
