import { Head, router } from '@inertiajs/react';
import { Plus, Trash2 } from 'lucide-react';
import AppLayout from '@/Layouts/AppLayout';
import { Card } from '@/Components/ui/Card';
import Button from '@/Components/ui/Button';
import Pagination from '@/Components/ui/Pagination';

export default function EnrolementsIndex({ enrolements, canManage, canSeeCommercial, aDesAgences = true }) {
    function destroy(e) {
        if (confirm('Supprimer cet enrôlement ?')) {
            router.delete(route('enrolements.destroy', e.id));
        }
    }

    return (
        <AppLayout
            title="Enrôlement clients"
            subtitle="Clients BDM enrôlés sur l'application mobile"
            actions={
                canManage && (
                    <Button href={route('enrolements.create')} size="sm">
                        <Plus size={14} /> Nouvel enrôlement
                    </Button>
                )
            }
        >
            <Head title="Enrôlement clients" />

            <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-ardoise-100 text-xs uppercase tracking-wide text-ardoise-500">
                                <th className="px-5 py-3 font-medium">Date</th>
                                <th className="px-5 py-3 font-medium">Client</th>
                                <th className="px-5 py-3 font-medium">N° de compte</th>
                                <th className="px-5 py-3 font-medium">Téléphone</th>
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
                            {enrolements.data.map((e) => (
                                <tr key={e.id} className="hover:bg-ardoise-50">
                                    <td className="px-5 py-3 text-ardoise-600">{e.date}</td>
                                    <td className="px-5 py-3 font-medium text-ardoise-900">{e.client_nom}</td>
                                    <td className="px-5 py-3 font-mono text-ardoise-600">{e.numero_compte ?? '—'}</td>
                                    <td className="px-5 py-3 text-ardoise-600">{e.telephone ?? '—'}</td>
                                    {canSeeCommercial && (
                                        <>
                                            <td className="px-5 py-3 text-ardoise-600">{e.commercial}</td>
                                            {aDesAgences && <td className="px-5 py-3 text-ardoise-600">{e.agence}</td>}
                                        </>
                                    )}
                                    {canManage && (
                                        <td className="px-5 py-3">
                                            <div className="flex justify-end gap-1.5">
                                                {e.peut_supprimer ? (
                                                    <button title="Supprimer" onClick={() => destroy(e)} className="rounded-md p-1.5 text-red-600 hover:bg-red-50">
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
                            {enrolements.data.length === 0 && (
                                <tr>
                                    <td colSpan={canSeeCommercial ? 6 : canManage ? 5 : 4} className="px-5 py-8 text-center text-ardoise-500">
                                        Aucun enrôlement.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <Pagination links={enrolements.links} from={enrolements.from} to={enrolements.to} total={enrolements.total} />
            </Card>
        </AppLayout>
    );
}
