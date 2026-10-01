import { Head, router } from '@inertiajs/react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import AppLayout from '@campagnes/Layouts/AppLayout';
import { Card } from '@campagnes/Components/ui/Card';
import Button from '@campagnes/Components/ui/Button';

export default function AgencesIndex({ agences }) {
    function destroy(a) {
        if (confirm(`Supprimer l'agence « ${a.nom} » ?`)) {
            router.delete(route('admin.agences.destroy', a.id));
        }
    }

    return (
        <AppLayout
            title="Agences"
            subtitle="Référentiel des sites de déploiement"
            actions={<Button href={route('admin.agences.create')} size="sm"><Plus size={15} /> Nouvelle agence</Button>}
        >
            <Head title="Agences" />

            <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-500">
                                <th className="px-5 py-3 font-medium">N°</th>
                                <th className="px-5 py-3 font-medium">Nom</th>
                                <th className="px-5 py-3 text-right font-medium">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {agences.map((a) => (
                                <tr key={a.id} className="hover:bg-gray-50">
                                    <td className="px-5 py-3 text-gray-500">{a.ordre}</td>
                                    <td className="px-5 py-3 font-medium text-gray-900">{a.nom}</td>
                                    <td className="px-5 py-3">
                                        <div className="flex justify-end gap-1.5">
                                            <Button href={route('admin.agences.edit', a.id)} variant="ghost" size="sm" title="Modifier">
                                                <Pencil size={15} />
                                            </Button>
                                            <button title="Supprimer" onClick={() => destroy(a)} className="rounded-md p-1.5 text-red-600 hover:bg-red-50">
                                                <Trash2 size={15} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {agences.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="px-5 py-8 text-center text-gray-500">Aucune agence.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </AppLayout>
    );
}
