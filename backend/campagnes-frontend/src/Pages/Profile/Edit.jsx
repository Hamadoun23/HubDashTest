import { useState } from 'react';
import { Head, useForm } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardHeader, CardTitle, CardBody } from '@/Components/ui/Card';
import { PasswordInput, Label, FieldError } from '@/Components/ui/Input';
import Button from '@/Components/ui/Button';
import Modal from '@/Components/ui/Modal';

/**
 * Profil : plus de nom, d'e-mail ni de mot de passe ici.
 *
 * Les trois se géraient localement (Laravel Breeze, à l'origine de cet
 * écran) avant le rattachement au hub. Ils se gèrent maintenant une seule
 * fois, au même endroit pour toutes les applications — « Mon compte », côté
 * hub — plutôt que redondants ici, susceptibles de diverger d'avec ce que
 * montre le hub. Ne reste que la suppression de compte : le hub n'a pas
 * d'équivalent, c'est une action propre à cette application.
 */
export default function ProfileEdit() {
    const deleteForm = useForm({ password: '' });
    const [confirmingDeletion, setConfirmingDeletion] = useState(false);

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
        <AppLayout title="Profil" subtitle="Votre identite est geree depuis le hub">
            <Head title="Profil" />

            <div className="max-w-xl space-y-4">
                <Card>
                    <CardBody>
                        <p className="text-sm text-ardoise-600">
                            Votre nom, votre e-mail et votre mot de passe se modifient
                            desormais depuis <strong>Mon compte</strong>, sur GDA Hub — un
                            seul endroit, pour toutes les applications auxquelles vous avez
                            acces.
                        </p>
                        <a
                            href="/mon-compte"
                            className="mt-3 inline-flex items-center text-sm font-medium text-marque-700 hover:text-marque-800"
                        >
                            Ouvrir Mon compte →
                        </a>
                    </CardBody>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Supprimer le compte</CardTitle>
                        <p className="mt-1 text-sm text-ardoise-500">
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
