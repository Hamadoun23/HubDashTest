import { Head } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import AppLayout from '@/Layouts/AppLayout';
import { Card } from '@/Components/ui/Card';
import Button from '@/Components/ui/Button';

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
                        <tr className="border-b border-ardoise-100 text-xs uppercase tracking-wide text-ardoise-500">
                            <th className="px-5 py-3 font-medium">Code</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-ardoise-100">
                        {typesCartes.length === 0 ? (
                            <tr><td className="px-5 py-8 text-center text-ardoise-500">Aucun type enregistré.</td></tr>
                        ) : (
                            typesCartes.map((code) => (
                                <tr key={code}>
                                    <td className="px-5 py-3 font-medium text-ardoise-900">{code}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </Card>
        </AppLayout>
    );
}
