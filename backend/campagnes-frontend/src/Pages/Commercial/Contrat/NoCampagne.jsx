import { Head } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardBody } from '@/Components/ui/Card';

export default function ContratNoCampagne() {
    return (
        <AppLayout title="Mon contrat de prestation">
            <Head title="Mon contrat" />
            <Card className="mx-auto max-w-xl">
                <CardBody>
                    <p className="text-ardoise-600">
                        Il n'y a pas de campagne active pour votre agence, ou vous n'êtes pas enregistré(e) comme
                        commercial engagé sur la campagne en cours.
                    </p>
                    <p className="mt-2 text-sm text-ardoise-500">
                        Si vous pensez qu'il s'agit d'une erreur, contactez l'administration.
                    </p>
                </CardBody>
            </Card>
        </AppLayout>
    );
}
