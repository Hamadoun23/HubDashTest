import { Head } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import UserForm from './Form';

export default function UsersCreate({ agences, aDesAgences, clientNom }) {
    return (
        <AppLayout title="Nouvel utilisateur" subtitle="Créer un compte commercial, téléphonique ou direction">
            <Head title="Nouvel utilisateur" />
            <UserForm agences={agences} aDesAgences={aDesAgences} clientNom={clientNom} />
        </AppLayout>
    );
}
