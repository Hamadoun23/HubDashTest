import { Head, router } from '@inertiajs/react';
import { Download, Plus, Pencil, Trash2 } from 'lucide-react';
import AppLayout from '@/Layouts/AppLayout';
import { Card } from '@/Components/ui/Card';
import Button from '@/Components/ui/Button';
import Pagination from '@/Components/ui/Pagination';

export default function TelephoniqueIndex({ rapports, totauxListe, libelleStatsCampagne }) {
    function destroy(r) {
        if (confirm('Supprimer définitivement cette fiche ?')) {
            router.delete(route('commercial.telephonique.destroy', r.id));
        }
    }

    return (
        <AppLayout
            title="Mes fiches de reporting"
            subtitle={libelleStatsCampagne ? `Périmètre : ${libelleStatsCampagne}` : undefined}
            actions={
                <div className="flex items-center gap-2">
                    <Button href={route('commercial.telephonique.export-excel')} target="_blank" variant="outline" size="sm">
                        <Download size={14} /> Exporter
                    </Button>
                    <Button href={route('commercial.telephonique.create')} size="sm">
                        <Plus size={14} /> Nouvelle saisie
                    </Button>
                </div>
            }
        >
            <Head title="Reporting téléphonique" />

            <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-ardoise-100 text-xs uppercase tracking-wide text-ardoise-500">
                                <th className="px-4 py-3 font-medium">Date</th>
                                <th className="px-4 py-3 text-right font-medium">Appels émis</th>
                                <th className="px-4 py-3 text-right font-medium">Joignables</th>
                                <th className="px-4 py-3 text-right font-medium">Non joignables</th>
                                <th className="px-4 py-3 text-right font-medium">Taux joign.</th>
                                <th className="px-4 py-3 text-right font-medium">Intéressés</th>
                                <th className="px-4 py-3 text-right font-medium">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-ardoise-100">
                            {rapports.data.map((r) => (
                                <tr key={r.id} className="hover:bg-ardoise-50">
                                    <td className="px-4 py-3">
                                        <Button href={route('commercial.telephonique.create', { date: r.date_iso })} variant="ghost" size="sm" className="px-0">
                                            {r.date}
                                        </Button>
                                    </td>
                                    <td className="px-4 py-3 text-right text-ardoise-600">{r.appels_emis}</td>
                                    <td className="px-4 py-3 text-right text-ardoise-600">{r.appels_joignables}</td>
                                    <td className="px-4 py-3 text-right text-ardoise-600">{r.appels_non_joignables}</td>
                                    <td className="px-4 py-3 text-right text-ardoise-600">{r.taux_joignabilite ?? '—'}</td>
                                    <td className="px-4 py-3 text-right text-ardoise-600">{r.clients_interesses_nombre}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex justify-end gap-1.5">
                                            {r.peut_modifier ? (
                                                <>
                                                    <Button href={route('commercial.telephonique.create', { date: r.date_iso })} variant="ghost" size="sm" title="Modifier">
                                                        <Pencil size={15} />
                                                    </Button>
                                                    <button title="Supprimer" onClick={() => destroy(r)} className="rounded-md p-1.5 text-red-600 hover:bg-red-50">
                                                        <Trash2 size={15} />
                                                    </button>
                                                </>
                                            ) : (
                                                <span className="p-1.5 text-ardoise-300" title="Modification impossible après 48 h">
                                                    <Pencil size={15} />
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {rapports.data.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center text-ardoise-500">Aucune fiche enregistrée.</td>
                                </tr>
                            )}
                        </tbody>
                        {totauxListe?.nb_fiches > 0 && (
                            <tfoot className="border-t border-ardoise-200 bg-ardoise-50 text-sm font-semibold text-ardoise-700">
                                <tr>
                                    <td className="px-4 py-2.5 text-right">Total ({totauxListe.nb_fiches})</td>
                                    <td className="px-4 py-2.5 text-right">{totauxListe.appels_emis}</td>
                                    <td className="px-4 py-2.5 text-right">{totauxListe.appels_joignables}</td>
                                    <td className="px-4 py-2.5 text-right">{totauxListe.appels_non_joignables}</td>
                                    <td></td>
                                    <td className="px-4 py-2.5 text-right">{totauxListe.clients_interesses}</td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
                <Pagination links={rapports.links} from={rapports.from} to={rapports.to} total={rapports.total} />
            </Card>
        </AppLayout>
    );
}
