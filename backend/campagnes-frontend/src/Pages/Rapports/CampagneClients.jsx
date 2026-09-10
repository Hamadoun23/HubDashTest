import { useState } from 'react';
import { Head } from '@inertiajs/react';
import { BarChart3, List, Phone, ArrowLeft, Download, FileText } from 'lucide-react';
import AppLayout from '@/Layouts/AppLayout';
import { Card } from '@/Components/ui/Card';
import Badge from '@/Components/ui/Badge';
import Button from '@/Components/ui/Button';
import Modal from '@/Components/ui/Modal';

export default function CampagneClients({ campagne, clients, estEnrolement }) {
    const [exportClient, setExportClient] = useState(null);

    return (
        <AppLayout
            title={`Clients — ${campagne.nom}`}
            subtitle={estEnrolement ? 'Clients enrôlés sur cette campagne' : 'Clients ayant au moins une vente sur cette campagne'}
            actions={
                <div className="flex flex-wrap items-center gap-2">
                    <Button href={route('rapports.campagnes.synthese', campagne.id)} size="sm"><BarChart3 size={14} /> Synthèse</Button>
                    <Button href={route('rapports.campagnes.ventes', campagne.id)} variant="outline" size="sm"><List size={14} /> {estEnrolement ? 'Enrôlements' : 'Ventes'}</Button>
                    {!estEnrolement && (
                        <Button href={route('rapports.campagnes.reporting-telephonique', campagne.id)} variant="outline" size="sm"><Phone size={14} /> Tél.</Button>
                    )}
                    <Button href={route('rapports.index')} variant="outline" size="sm"><ArrowLeft size={14} /> Rapports</Button>
                </div>
            }
        >
            <Head title={`Clients — ${campagne.nom}`} />

            <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-ardoise-100 text-xs uppercase tracking-wide text-ardoise-500">
                                <th className="px-4 py-3 font-medium">Nom</th>
                                {estEnrolement && <th className="px-4 py-3 font-medium">N° de compte</th>}
                                <th className="px-4 py-3 font-medium">Téléphone</th>
                                <th className="px-4 py-3 font-medium">{estEnrolement ? 'Adresse' : 'Ville'}</th>
                                {!estEnrolement && <th className="px-4 py-3 font-medium">Type carte</th>}
                                <th className="px-4 py-3 font-medium">Commercial</th>
                                {!estEnrolement && <th className="px-4 py-3 text-right font-medium">Actions</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-ardoise-100">
                            {clients.length === 0 ? (
                                <tr><td colSpan={estEnrolement ? 5 : 6} className="px-4 py-8 text-center text-ardoise-500">Aucun client.</td></tr>
                            ) : (
                                clients.map((c) => (
                                    <tr key={c.id} className="hover:bg-ardoise-50">
                                        <td className="px-4 py-3 font-medium text-ardoise-900">{c.nom_complet}</td>
                                        {estEnrolement && <td className="px-4 py-3 font-mono text-ardoise-600">{c.numero_compte ?? '—'}</td>}
                                        <td className="px-4 py-3 text-ardoise-600">{c.telephone ?? '—'}</td>
                                        <td className="px-4 py-3 text-ardoise-600">{c.ville ?? '—'}</td>
                                        {!estEnrolement && <td className="px-4 py-3"><Badge tone="blue">{c.type_carte}</Badge></td>}
                                        <td className="px-4 py-3 text-ardoise-600">{c.commercial}</td>
                                        {!estEnrolement && (
                                            <td className="px-4 py-3">
                                                <div className="flex justify-end gap-1.5">
                                                    <Button href={route('clients.show', c.id)} variant="outline" size="sm">Fiche</Button>
                                                    <Button onClick={() => setExportClient(c)} size="sm"><Download size={13} /> Exporter</Button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            <Modal open={!!exportClient} onClose={() => setExportClient(null)} title={exportClient ? `Exporter — ${exportClient.nom_complet}` : ''}>
                {exportClient && (
                    <div className="flex flex-col gap-2">
                        <Button href={route('clients.export', { client: exportClient.id, format: 'pdf' })} target="_blank" variant="outline">
                            <FileText size={14} /> PDF
                        </Button>
                        <Button href={route('clients.export', { client: exportClient.id, format: 'excel' })} target="_blank" variant="outline">
                            <FileText size={14} /> Excel (.xlsx)
                        </Button>
                        <Button href={route('clients.export', { client: exportClient.id, format: 'word' })} target="_blank" variant="outline">
                            <FileText size={14} /> Word (.doc)
                        </Button>
                    </div>
                )}
            </Modal>
        </AppLayout>
    );
}
