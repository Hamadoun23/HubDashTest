import { Head } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import CampagneForm from './Form';
import ContratArticles from './ContratArticles';

export default function CampagnesEdit({ campagne, agences, commerciaux, aDesAgences, clientNom }) {
    return (
        <AppLayout title={`Modifier ${campagne.nom}`} subtitle="Campagne">
            <Head title="Modifier campagne" />
            <div className="mx-auto max-w-3xl space-y-4">
                <CampagneForm campagne={campagne} agences={agences} commerciaux={commerciaux} aDesAgences={aDesAgences} clientNom={clientNom} />
                <ContratArticles campagneId={campagne.id} articles={campagne.contrat_articles} />
            </div>
        </AppLayout>
    );
}
