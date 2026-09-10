import { Head } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import CampagneForm from './Form';

export default function CampagnesCreate({ agences, commerciaux, aDesAgences, clientNom }) {
    return (
        <AppLayout title="Nouvelle campagne" subtitle="Créer une période commerciale">
            <Head title="Nouvelle campagne" />
            <div className="mx-auto max-w-3xl">
                <CampagneForm agences={agences} commerciaux={commerciaux} aDesAgences={aDesAgences} clientNom={clientNom} />
            </div>
        </AppLayout>
    );
}
