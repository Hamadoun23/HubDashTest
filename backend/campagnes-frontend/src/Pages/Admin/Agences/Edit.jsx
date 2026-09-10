import { Head } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import AgenceForm from './Form';

export default function AgencesEdit({ agence }) {
    return (
        <AppLayout title="Modifier l'agence" subtitle={agence.nom}>
            <Head title="Modifier l'agence" />
            <AgenceForm agence={agence} />
        </AppLayout>
    );
}
