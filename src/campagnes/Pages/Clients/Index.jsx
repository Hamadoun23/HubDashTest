import { Head } from '@inertiajs/react';
import AppLayout from '@campagnes/Layouts/AppLayout';
import { Card } from '@campagnes/Components/ui/Card';
import Badge from '@campagnes/Components/ui/Badge';
import Button from '@campagnes/Components/ui/Button';
import Pagination from '@campagnes/Components/ui/Pagination';

export default function ClientsIndex({ clients }) {
    return (
        <AppLayout title="Clients" subtitle="Liste de tous les clients enregistrés">
            <Head title="Clients" />

            <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-500">
                                <th className="px-5 py-3 font-medium">Nom</th>
                                <th className="px-5 py-3 font-medium">Téléphone</th>
                                <th className="px-5 py-3 font-medium">Ville</th>
                                <th className="px-5 py-3 font-medium">Type carte</th>
                                <th className="px-5 py-3 font-medium">Commercial</th>
                                <th className="px-5 py-3 font-medium">Statut</th>
                                <th className="px-5 py-3"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {clients.data.map((c) => (
                                <tr key={c.id} className="hover:bg-gray-50">
                                    <td className="px-5 py-3 font-medium text-gray-900">{c.nom_complet}</td>
                                    <td className="px-5 py-3 text-gray-600">{c.telephone ?? '—'}</td>
                                    <td className="px-5 py-3 text-gray-600">{c.ville ?? '—'}</td>
                                    <td className="px-5 py-3"><Badge tone="blue">{c.type_carte}</Badge></td>
                                    <td className="px-5 py-3 text-gray-600">{c.commercial}</td>
                                    <td className="px-5 py-3"><Badge>{c.statut_carte}</Badge></td>
                                    <td className="px-5 py-3 text-right">
                                        <Button href={route('clients.show', c.id)} size="sm">Détail</Button>
                                    </td>
                                </tr>
                            ))}
                            {clients.data.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-5 py-8 text-center text-gray-500">Aucun client.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <Pagination links={clients.links} from={clients.from} to={clients.to} total={clients.total} />
            </Card>
        </AppLayout>
    );
}
