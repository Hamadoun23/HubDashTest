import { Head, router, usePage } from '@inertiajs/react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import AppLayout from '@/Layouts/AppLayout';
import { Card } from '@/Components/ui/Card';
import Badge from '@/Components/ui/Badge';
import Button from '@/Components/ui/Button';

export default function TypesCartesIndex({ types }) {
    function destroy(t) {
        if (confirm(`Supprimer le type « ${t.code} » ?`)) {
            router.delete(route('admin.types-cartes.destroy', t.id));
        }
    }

    return (
        <AppLayout
            title="Types de cartes"
            subtitle="Référentiel des produits vendus"
            actions={<Button href={route('admin.types-cartes.create')} size="sm"><Plus size={15} /> Nouveau type</Button>}
        >
            <Head title="Types de cartes" />

            <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-ardoise-100 text-xs uppercase tracking-wide text-ardoise-500">
                                <th className="px-5 py-3 font-medium">Code</th>
                                <th className="px-5 py-3 font-medium">Actif</th>
                                <th className="px-5 py-3 text-right font-medium">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-ardoise-100">
                            {types.map((t) => (
                                <tr key={t.id} className="hover:bg-ardoise-50">
                                    <td className="px-5 py-3"><code className="rounded bg-ardoise-100 px-1.5 py-0.5 text-xs font-medium text-ardoise-700">{t.code}</code></td>
                                    <td className="px-5 py-3">
                                        <Badge tone={t.actif ? 'green' : 'neutral'}>{t.actif ? 'Oui' : 'Non'}</Badge>
                                    </td>
                                    <td className="px-5 py-3">
                                        <div className="flex justify-end gap-1.5">
                                            <Button href={route('admin.types-cartes.edit', t.id)} variant="ghost" size="sm" title="Modifier">
                                                <Pencil size={15} />
                                            </Button>
                                            <button title="Supprimer" onClick={() => destroy(t)} className="rounded-md p-1.5 text-red-600 hover:bg-red-50">
                                                <Trash2 size={15} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {types.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="px-5 py-8 text-center text-ardoise-500">Aucun type de carte.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </AppLayout>
    );
}
