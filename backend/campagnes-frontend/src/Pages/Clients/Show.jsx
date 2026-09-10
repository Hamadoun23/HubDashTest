import { useState } from 'react';
import { Head } from '@inertiajs/react';
import { Download, ArrowLeft, FileText, ExternalLink } from 'lucide-react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardHeader, CardTitle, CardBody } from '@/Components/ui/Card';
import Badge from '@/Components/ui/Badge';
import Button from '@/Components/ui/Button';
import Modal from '@/Components/ui/Modal';

function Field({ label, children }) {
    return (
        <li className="border-b border-ardoise-100 px-5 py-3 last:border-0">
            <p className="text-xs text-ardoise-500">{label}</p>
            <p className="mt-0.5 font-medium text-ardoise-900">{children}</p>
        </li>
    );
}

export default function ClientShow({ client }) {
    const [exportOpen, setExportOpen] = useState(false);

    return (
        <AppLayout
            title={client.nom_complet}
            subtitle={`Client #${client.id}`}
            actions={
                <div className="flex items-center gap-2">
                    <Button onClick={() => setExportOpen(true)} size="sm"><Download size={14} /> Exporter</Button>
                    <Button href={route('clients.index')} variant="outline" size="sm"><ArrowLeft size={14} /> Liste</Button>
                </div>
            }
        >
            <Head title="Fiche client" />

            <div className="grid gap-4 lg:grid-cols-12">
                <Card className="lg:col-span-5">
                    <CardHeader><CardTitle>Coordonnées</CardTitle></CardHeader>
                    <ul>
                        <Field label="Téléphone">{client.telephone ?? '—'}</Field>
                        <Field label="Ville">{client.ville ?? '—'}</Field>
                        <Field label="Quartier">{client.quartier ?? '—'}</Field>
                        <Field label="Type de carte"><Badge tone="blue">{client.type_carte}</Badge></Field>
                        <Field label="Statut carte"><Badge>{client.statut_carte}</Badge></Field>
                        <Field label="Commercial">{client.commercial}</Field>
                        <Field label="Agence">{client.agence ?? '—'}</Field>
                        <Field label="Enregistré le">{client.created_at}</Field>
                    </ul>
                </Card>

                <div className="space-y-4 lg:col-span-7">
                    <Card>
                        <CardHeader><CardTitle>Pièce d'identité</CardTitle></CardHeader>
                        <CardBody>
                            {client.carte_identite_url ? (
                                <Button href={client.carte_identite_url} target="_blank" variant="outline" size="sm">
                                    <ExternalLink size={14} /> Voir le fichier
                                </Button>
                            ) : (
                                <p className="text-sm text-ardoise-500">Aucun fichier.</p>
                            )}
                        </CardBody>
                    </Card>

                    <Card>
                        <CardHeader><CardTitle>Ventes associées</CardTitle></CardHeader>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead>
                                    <tr className="border-b border-ardoise-100 text-xs uppercase tracking-wide text-ardoise-500">
                                        <th className="px-5 py-2.5 font-medium">Date</th>
                                        <th className="px-5 py-2.5 font-medium">Type</th>
                                        <th className="px-5 py-2.5 font-medium">Commercial</th>
                                        <th className="px-5 py-2.5 font-medium">Agence</th>
                                        <th className="px-5 py-2.5 font-medium">Activation</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-ardoise-100">
                                    {client.ventes.length === 0 ? (
                                        <tr><td colSpan={5} className="px-5 py-6 text-center text-ardoise-500">Aucune vente.</td></tr>
                                    ) : (
                                        client.ventes.map((v) => (
                                            <tr key={v.id}>
                                                <td className="px-5 py-2.5 text-ardoise-600">{v.date}</td>
                                                <td className="px-5 py-2.5"><Badge tone="blue">{v.type_carte}</Badge></td>
                                                <td className="px-5 py-2.5 text-ardoise-600">{v.commercial}</td>
                                                <td className="px-5 py-2.5 text-ardoise-600">{v.agence}</td>
                                                <td className="px-5 py-2.5"><Badge>{v.statut_activation}</Badge></td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>
            </div>

            <Modal open={exportOpen} onClose={() => setExportOpen(false)} title="Exporter la fiche client" description="Choisissez le format du fichier à télécharger.">
                <div className="flex flex-col gap-2">
                    <Button href={route('clients.export', { client: client.id, format: 'pdf' })} target="_blank" variant="outline">
                        <FileText size={14} /> PDF
                    </Button>
                    <Button href={route('clients.export', { client: client.id, format: 'excel' })} target="_blank" variant="outline">
                        <FileText size={14} /> Excel (.xlsx)
                    </Button>
                    <Button href={route('clients.export', { client: client.id, format: 'word' })} target="_blank" variant="outline">
                        <FileText size={14} /> Word (.doc)
                    </Button>
                </div>
            </Modal>
        </AppLayout>
    );
}
