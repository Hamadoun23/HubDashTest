import { Head, useForm } from '@inertiajs/react';
import { ShieldCheck } from 'lucide-react';
import AuthCard from '@/Layouts/AuthCard';
import { PasswordInput, Label, FieldError } from '@/Components/ui/Input';
import Button from '@/Components/ui/Button';

export default function ConfirmPassword() {
    const { data, setData, post, processing, errors } = useForm({ password: '' });

    function submit(e) {
        e.preventDefault();
        post(route('password.confirm'));
    }

    return (
        <AuthCard title="Confirmation du mot de passe" subtitle="Ceci est une zone sécurisée. Confirmez votre mot de passe pour continuer.">
            <Head title="Confirmation du mot de passe" />

            <form onSubmit={submit} className="space-y-4">
                <div>
                    <Label htmlFor="password">Mot de passe</Label>
                    <PasswordInput
                        id="password"
                        autoFocus
                        autoComplete="current-password"
                        value={data.password}
                        onChange={(e) => setData('password', e.target.value)}
                        error={errors.password}
                    />
                    <FieldError>{errors.password}</FieldError>
                </div>

                <Button type="submit" disabled={processing} className="w-full" size="lg">
                    <ShieldCheck size={16} />
                    Confirmer
                </Button>
            </form>
        </AuthCard>
    );
}
