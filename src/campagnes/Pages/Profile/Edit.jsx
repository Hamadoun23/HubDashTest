import { useState } from 'react';
import { Head, useForm, router } from '@inertiajs/react';
import AppLayout from '@campagnes/Layouts/AppLayout';
import { Card, CardHeader, CardTitle, CardBody } from '@campagnes/Components/ui/Card';
import { Input, PasswordInput, Label, FieldError } from '@campagnes/Components/ui/Input';
import Button from '@campagnes/Components/ui/Button';
import Modal from '@campagnes/Components/ui/Modal';

export default function ProfileEdit({ user, status }) {
    const profileForm = useForm({ name: user.name, email: user.email ?? '' });
    const passwordForm = useForm({ current_password: '', password: '', password_confirmation: '' });
    const deleteForm = useForm({ password: '' });
    const [confirmingDeletion, setConfirmingDeletion] = useState(false);

    function submitProfile(e) {
        e.preventDefault();
        profileForm.patch(route('profile.update'));
    }

    function submitPassword(e) {
        e.preventDefault();
        passwordForm.put(route('password.update'), {
            errorBag: 'updatePassword',
            preserveScroll: true,
            onSuccess: () => passwordForm.reset(),
        });
    }

    function resendVerification(e) {
        e.preventDefault();
        router.post(route('verification.send'));
    }

    function submitDelete(e) {
        e.preventDefault();
        deleteForm.delete(route('profile.destroy'), {
            errorBag: 'userDeletion',
            preserveScroll: true,
            onSuccess: () => setConfirmingDeletion(false),
            onError: () => setConfirmingDeletion(true),
        });
    }

    return (
        <AppLayout title="Profil" subtitle="Vos informations de connexion">
            <Head title="Profil" />

            <div className="max-w-xl space-y-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Informations du profil</CardTitle>
                        <p className="mt-1 text-sm text-gray-500">
                            {user.is_commercial ? 'Mise à jour du profil (connexion au téléphone).' : "Mettez à jour votre nom et votre adresse e-mail."}
                        </p>
                    </CardHeader>
                    <CardBody>
                        <form onSubmit={submitProfile} className="space-y-4">
                            <div>
                                <Label htmlFor="name">Nom</Label>
                                <Input
                                    id="name"
                                    autoFocus
                                    autoComplete="name"
                                    value={profileForm.data.name}
                                    onChange={(e) => profileForm.setData('name', e.target.value)}
                                    error={profileForm.errors.name}
                                />
                                <FieldError>{profileForm.errors.name}</FieldError>
                            </div>

                            {!user.is_commercial && (
                                <div>
                                    <Label htmlFor="email">E-mail</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        autoComplete="username"
                                        value={profileForm.data.email}
                                        onChange={(e) => profileForm.setData('email', e.target.value)}
                                        error={profileForm.errors.email}
                                    />
                                    <FieldError>{profileForm.errors.email}</FieldError>

                                    {!user.email_verified && user.email && (
                                        <p className="mt-2 text-sm text-gray-600">
                                            Votre adresse e-mail n'est pas vérifiée.{' '}
                                            <button type="button" onClick={resendVerification} className="text-gda-orange underline hover:text-orange-700">
                                                Cliquez ici pour renvoyer l'e-mail de vérification.
                                            </button>
                                        </p>
                                    )}
                                    {status === 'verification-link-sent' && (
                                        <p className="mt-2 text-sm font-medium text-green-600">
                                            Un nouveau lien de vérification a été envoyé à votre adresse e-mail.
                                        </p>
                                    )}
                                </div>
                            )}

                            <div className="flex items-center gap-4">
                                <Button type="submit" disabled={profileForm.processing}>Enregistrer</Button>
                                {status === 'profile-updated' && <p className="text-sm text-gray-600">Enregistré.</p>}
                            </div>
                        </form>
                    </CardBody>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Mot de passe</CardTitle>
                        <p className="mt-1 text-sm text-gray-500">Assurez-vous d'utiliser un mot de passe long et aléatoire pour rester en sécurité.</p>
                    </CardHeader>
                    <CardBody>
                        <form onSubmit={submitPassword} className="space-y-4">
                            <div>
                                <Label htmlFor="current_password">Mot de passe actuel</Label>
                                <PasswordInput
                                    id="current_password"
                                    autoComplete="current-password"
                                    value={passwordForm.data.current_password}
                                    onChange={(e) => passwordForm.setData('current_password', e.target.value)}
                                    error={passwordForm.errors.current_password}
                                />
                                <FieldError>{passwordForm.errors.current_password}</FieldError>
                            </div>
                            <div>
                                <Label htmlFor="password">Nouveau mot de passe</Label>
                                <PasswordInput
                                    id="password"
                                    autoComplete="new-password"
                                    value={passwordForm.data.password}
                                    onChange={(e) => passwordForm.setData('password', e.target.value)}
                                    error={passwordForm.errors.password}
                                />
                                <FieldError>{passwordForm.errors.password}</FieldError>
                            </div>
                            <div>
                                <Label htmlFor="password_confirmation">Confirmer le mot de passe</Label>
                                <PasswordInput
                                    id="password_confirmation"
                                    autoComplete="new-password"
                                    value={passwordForm.data.password_confirmation}
                                    onChange={(e) => passwordForm.setData('password_confirmation', e.target.value)}
                                    error={passwordForm.errors.password_confirmation}
                                />
                                <FieldError>{passwordForm.errors.password_confirmation}</FieldError>
                            </div>
                            <Button type="submit" disabled={passwordForm.processing}>Enregistrer</Button>
                        </form>
                    </CardBody>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Supprimer le compte</CardTitle>
                        <p className="mt-1 text-sm text-gray-500">
                            Une fois votre compte supprimé, toutes ses ressources et données seront définitivement effacées.
                        </p>
                    </CardHeader>
                    <CardBody>
                        <Button variant="destructive" onClick={() => setConfirmingDeletion(true)}>Supprimer le compte</Button>
                    </CardBody>
                </Card>
            </div>

            <Modal
                open={confirmingDeletion}
                onClose={() => setConfirmingDeletion(false)}
                title="Êtes-vous sûr de vouloir supprimer votre compte ?"
                description="Cette action est irréversible. Saisissez votre mot de passe pour confirmer."
            >
                <form onSubmit={submitDelete} className="space-y-4">
                    <div>
                        <Label htmlFor="delete_password">Mot de passe</Label>
                        <PasswordInput
                            id="delete_password"
                            autoFocus
                            value={deleteForm.data.password}
                            onChange={(e) => deleteForm.setData('password', e.target.value)}
                            error={deleteForm.errors.password}
                        />
                        <FieldError>{deleteForm.errors.password}</FieldError>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setConfirmingDeletion(false)}>Annuler</Button>
                        <Button type="submit" variant="destructive" disabled={deleteForm.processing}>Supprimer le compte</Button>
                    </div>
                </form>
            </Modal>
        </AppLayout>
    );
}
