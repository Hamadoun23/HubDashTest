import { Head } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import UserForm from './Form';

export default function UsersEdit({ user, agences, aDesAgences, clientNom }) {
    return (
        <AppLayout title={`Modifier ${user.name}`} subtitle="Utilisateur">
            <Head title="Modifier utilisateur" />
            <UserForm user={user} agences={agences} aDesAgences={aDesAgences} clientNom={clientNom} />
        </AppLayout>
    );
}
