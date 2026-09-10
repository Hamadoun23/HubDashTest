import { Head, useForm } from '@inertiajs/react';
import { KeyRound } from 'lucide-react';
import AuthCard from '@/Layouts/AuthCard';
import { Input, PasswordInput, Label, FieldError } from '@/Components/ui/Input';
import Button from '@/Components/ui/Button';

export default function ResetPassword({ token, email }) {
    const { data, setData, post, processing, errors } = useForm({
        token,
        email: email ?? '',
        password: '',
        password_confirmation: '',
    });

    function submit(e) {
        e.preventDefault();
        post(route('password.store'));
    }

    return (
        <AuthCard title="Nouveau mot de passe" subtitle="Choisissez un nouveau mot de passe pour votre compte.">
            <Head title="Nouveau mot de passe" />

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

                <div>
                    <Label htmlFor="password">Nouveau mot de passe</Label>
                    <PasswordInput
                        id="password"
                        autoComplete="new-password"
                        value={data.password}
                        onChange={(e) => setData('password', e.target.value)}
                        error={errors.password}
                    />
                    <FieldError>{errors.password}</FieldError>
                </div>

                <div>
                    <Label htmlFor="password_confirmation">Confirmer le mot de passe</Label>
                    <PasswordInput
                        id="password_confirmation"
                        autoComplete="new-password"
                        value={data.password_confirmation}
                        onChange={(e) => setData('password_confirmation', e.target.value)}
                        error={errors.password_confirmation}
                    />
                    <FieldError>{errors.password_confirmation}</FieldError>
                </div>

                <Button type="submit" disabled={processing} className="w-full" size="lg">
                    <KeyRound size={16} />
                    Réinitialiser le mot de passe
                </Button>
            </form>
        </AuthCard>
    );
}
