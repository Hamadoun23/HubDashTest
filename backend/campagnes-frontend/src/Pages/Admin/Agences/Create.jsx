import { Head } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import AgenceForm from './Form';

export default function AgencesCreate({ ordreSuggest }) {
    return (
        <AppLayout title="Nouvelle agence" subtitle="Ajouter un site au référentiel">
            <Head title="Nouvelle agence" />
            <AgenceForm ordreSuggest={ordreSuggest} />
        </AppLayout>
    );
}
