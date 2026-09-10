import { Head, router } from '@inertiajs/react';
import { Download, Plus, Pencil, Trash2 } from 'lucide-react';
import AppLayout from '@/Layouts/AppLayout';
import { Card } from '@/Components/ui/Card';
import Badge from '@/Components/ui/Badge';
import Button from '@/Components/ui/Button';
import Pagination from '@/Components/ui/Pagination';

export default function VentesIndex({ ventes, libelleStatsCampagne, canManage, canSeeCommercial, aDesAgences = true }) {
    function destroy(v) {
        if (confirm('Supprimer cette vente et la fiche client associée ?')) {
            router.delete(route('ventes.destroy', v.id));
        }
    }

    return (
        <AppLayout
            title="Historique des ventes"
            subtitle={libelleStatsCampagne ? `Périmètre : ${libelleStatsCampagne}` : 'Toutes les ventes enregistrées'}
            actions={
                <div className="flex items-center gap-2">
                    <Button href={route('ventes.export-excel')} variant="outline" size="sm" target="_blank">
                        <Download size={14} /> Exporter
                    </Button>
                    {canManage && (
                        <Button href={route('ventes.create')} size="sm">
                            <Plus size={14} /> Nouvelle vente
                        </Button>
                    )}
                </div>
            }
        >
            <Head title="Historique des ventes" />

            <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-ardoise-100 text-xs uppercase tracking-wide text-ardoise-500">
                                <th className="px-5 py-3 font-medium">Date</th>
                                <th className="px-5 py-3 font-medium">Client</th>
                                <th className="px-5 py-3 font-medium">Type carte</th>
                                {canSeeCommercial && (
                                    <>
                                        <th className="px-5 py-3 font-medium">Commercial</th>
                                        {aDesAgences && <th className="px-5 py-3 font-medium">Agence</th>}
                                    </>
                                )}
                                {canManage && <th className="px-5 py-3 text-right font-medium">Actions</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-ardoise-100">
                            {ventes.data.map((v) => (
                                <tr key={v.id} className="hover:bg-ardoise-50">
                                    <td className="px-5 py-3 text-ardoise-600">{v.date}</td>
                                    <td className="px-5 py-3 font-medium text-ardoise-900">{v.client_nom}</td>
                                    <td className="px-5 py-3"><Badge tone="blue">{v.type_carte}</Badge></td>
                                    {canSeeCommercial && (
                                        <>
                                            <td className="px-5 py-3 text-ardoise-600">{v.commercial}</td>
                                            {aDesAgences && <td className="px-5 py-3 text-ardoise-600">{v.agence}</td>}
                                        </>
                                    )}
                                    {canManage && (
                                        <td className="px-5 py-3">
                                            <div className="flex justify-end gap-1.5">
                                                {v.peut_modifier_client ? (
                                                    <Button href={route('commercial.clients.edit', v.client_id)} variant="ghost" size="sm" title="Modifier">
                                                        <Pencil size={15} />
                                                    </Button>
                                                ) : (
                                                    <span className="p-1.5 text-ardoise-300" title="Modification impossible après 48 h">
                                                        <Pencil size={15} />
                                                    </span>
                                                )}
                                                {v.peut_supprimer ? (
                                                    <button title="Supprimer" onClick={() => destroy(v)} className="rounded-md p-1.5 text-red-600 hover:bg-red-50">
                                                        <Trash2 size={15} />
                                                    </button>
                                                ) : (
                                                    <span className="p-1.5 text-ardoise-300" title="Suppression impossible après le délai">
                                                        <Trash2 size={15} />
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))}
                            {ventes.data.length === 0 && (
                                <tr>
                                    <td colSpan={canSeeCommercial ? 5 : canManage ? 4 : 3} className="px-5 py-8 text-center text-ardoise-500">
                                        Aucune vente.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <Pagination links={ventes.links} from={ventes.from} to={ventes.to} total={ventes.total} />
            </Card>
        </AppLayout>
    );
}
