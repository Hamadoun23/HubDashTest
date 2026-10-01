import { Head, router } from '@inertiajs/react';
import { Download, Plus, Pencil, Trash2 } from 'lucide-react';
import AppLayout from '@campagnes/Layouts/AppLayout';
import { Card } from '@campagnes/Components/ui/Card';
import Badge from '@campagnes/Components/ui/Badge';
import Button from '@campagnes/Components/ui/Button';
import Pagination from '@campagnes/Components/ui/Pagination';

export default function VentesIndex({ ventes, libelleStatsCampagne, canManage, canSeeCommercial, aDesAgences = true }) {
    function destroy(v) {
        if (confirm('Supprimer cette vente et la fiche client associée ?')) {
            router.delete(route('ventes.destroy', v.id));
        }
    }

    const nbColonnes = 3 + (canSeeCommercial ? 1 : 0) + (aDesAgences ? 1 : 0) + (canManage ? 1 : 0);

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
                            <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-500">
                                <th className="px-5 py-3 font-medium">Date</th>
                                <th className="px-5 py-3 font-medium">Client</th>
                                <th className="px-5 py-3 font-medium">Type carte</th>
                                {canSeeCommercial && <th className="px-5 py-3 font-medium">Commercial</th>}
                                {aDesAgences && <th className="px-5 py-3 font-medium">Agence</th>}
                                {canManage && <th className="px-5 py-3 text-right font-medium">Actions</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {ventes.data.map((v) => (
                                <tr key={v.id} className="hover:bg-gray-50">
                                    <td className="px-5 py-3 text-gray-600">{v.date}</td>
                                    <td className="px-5 py-3 font-medium text-gray-900">{v.client_nom}</td>
                                    <td className="px-5 py-3"><Badge tone="blue">{v.type_carte}</Badge></td>
                                    {canSeeCommercial && <td className="px-5 py-3 text-gray-600">{v.commercial}</td>}
                                    {aDesAgences && <td className="px-5 py-3 text-gray-600">{v.agence}</td>}
                                    {canManage && (
                                        <td className="px-5 py-3">
                                            <div className="flex justify-end gap-1.5">
                                                {v.peut_modifier_client ? (
                                                    <Button href={route('commercial.clients.edit', v.client_id)} variant="ghost" size="sm" title="Modifier">
                                                        <Pencil size={15} />
                                                    </Button>
                                                ) : (
                                                    <span className="p-1.5 text-gray-300" title="Modification impossible après 48 h">
                                                        <Pencil size={15} />
                                                    </span>
                                                )}
                                                {v.peut_supprimer ? (
                                                    <button title="Supprimer" onClick={() => destroy(v)} className="rounded-md p-1.5 text-red-600 hover:bg-red-50">
                                                        <Trash2 size={15} />
                                                    </button>
                                                ) : (
                                                    <span className="p-1.5 text-gray-300" title="Suppression impossible après le délai">
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
                                    <td colSpan={nbColonnes} className="px-5 py-8 text-center text-gray-500">
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
