import { Head } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Card } from '@/Components/ui/Card';
import Badge from '@/Components/ui/Badge';
import Button from '@/Components/ui/Button';
import Pagination from '@/Components/ui/Pagination';

export default function ClientsIndex({ clients }) {
    return (
        <AppLayout title="Clients" subtitle="Liste de tous les clients enregistrés">
            <Head title="Clients" />

            <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-ardoise-100 text-xs uppercase tracking-wide text-ardoise-500">
                                <th className="px-5 py-3 font-medium">Nom</th>
                                <th className="px-5 py-3 font-medium">Téléphone</th>
                                <th className="px-5 py-3 font-medium">Ville</th>
                                <th className="px-5 py-3 font-medium">Type carte</th>
                                <th className="px-5 py-3 font-medium">Commercial</th>
                                <th className="px-5 py-3 font-medium">Statut</th>
                                <th className="px-5 py-3"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-ardoise-100">
                            {clients.data.map((c) => (
                                <tr key={c.id} className="hover:bg-ardoise-50">
                                    <td className="px-5 py-3 font-medium text-ardoise-900">{c.nom_complet}</td>
                                    <td className="px-5 py-3 text-ardoise-600">{c.telephone ?? '—'}</td>
                                    <td className="px-5 py-3 text-ardoise-600">{c.ville ?? '—'}</td>
                                    <td className="px-5 py-3"><Badge tone="blue">{c.type_carte}</Badge></td>
                                    <td className="px-5 py-3 text-ardoise-600">{c.commercial}</td>
                                    <td className="px-5 py-3"><Badge>{c.statut_carte}</Badge></td>
                                    <td className="px-5 py-3 text-right">
                                        <Button href={route('clients.show', c.id)} size="sm">Détail</Button>
                                    </td>
                                </tr>
                            ))}
                            {clients.data.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-5 py-8 text-center text-ardoise-500">Aucun client.</td>
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
