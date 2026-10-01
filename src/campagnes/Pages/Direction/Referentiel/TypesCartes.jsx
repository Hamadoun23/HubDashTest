import { Head } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import AppLayout from '@campagnes/Layouts/AppLayout';
import { Card } from '@campagnes/Components/ui/Card';
import Button from '@campagnes/Components/ui/Button';

export default function DirectionTypesCartes({ typesCartes }) {
    return (
        <AppLayout
            title="Types de cartes"
            subtitle="Référentiel — lecture seule"
            actions={<Button href={route('direction.campagnes.index')} variant="outline" size="sm"><ArrowLeft size={14} /> Campagnes</Button>}
        >
            <Head title="Types de cartes" />

            <Card className="overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead>
                        <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-500">
                            <th className="px-5 py-3 font-medium">Code</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {typesCartes.length === 0 ? (
                            <tr><td className="px-5 py-8 text-center text-gray-500">Aucun type enregistré.</td></tr>
                        ) : (
                            typesCartes.map((code) => (
                                <tr key={code}>
                                    <td className="px-5 py-3 font-medium text-gray-900">{code}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </Card>
        </AppLayout>
    );
}
