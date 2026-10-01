import { Head } from '@inertiajs/react';
import { Eye } from 'lucide-react';
import AppLayout from '@campagnes/Layouts/AppLayout';
import { Card } from '@campagnes/Components/ui/Card';
import Badge from '@campagnes/Components/ui/Badge';
import Button from '@campagnes/Components/ui/Button';
import Pagination from '@campagnes/Components/ui/Pagination';

const statutTones = {
    en_cours: 'green',
    programmee: 'blue',
    arretee: 'amber',
    annulee: 'red',
    terminee: 'neutral',
};

const statutLabels = {
    en_cours: 'En cours',
    programmee: 'Programmée',
    arretee: 'Arrêtée',
    annulee: 'Annulée',
    terminee: 'Terminée',
};

export default function DirectionCampagnesIndex({ campagnes }) {
    return (
        <AppLayout title="Suivi des campagnes" subtitle="Lecture seule">
            <Head title="Campagnes" />

            <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-500">
                                <th className="px-5 py-3 font-medium">Nom</th>
                                <th className="px-5 py-3 font-medium">Période</th>
                                <th className="px-5 py-3 font-medium">Agences</th>
                                <th className="px-5 py-3 font-medium">Prime 1<sup>er</sup></th>
                                <th className="px-5 py-3 font-medium">Statut</th>
                                <th className="px-5 py-3"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {campagnes.data.map((c) => (
                                <tr key={c.id} className="hover:bg-gray-50">
                                    <td className="px-5 py-3 font-medium text-gray-900">{c.nom}</td>
                                    <td className="px-5 py-3 text-gray-600">{c.date_debut} – {c.date_fin}</td>
                                    <td className="px-5 py-3 text-gray-600">{c.agences}</td>
                                    <td className="px-5 py-3 text-gray-600">{c.prime_meilleur_vendeur} F</td>
                                    <td className="px-5 py-3"><Badge tone={statutTones[c.statut]}>{statutLabels[c.statut]}</Badge></td>
                                    <td className="px-5 py-3 text-right">
                                        <Button href={route('direction.campagnes.show', c.id)} variant="outline" size="sm">
                                            <Eye size={14} /> Détail complet
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                            {campagnes.data.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-5 py-8 text-center text-gray-500">Aucune campagne.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <Pagination links={campagnes.links} from={campagnes.from} to={campagnes.to} total={campagnes.total} />
            </Card>
        </AppLayout>
    );
}
