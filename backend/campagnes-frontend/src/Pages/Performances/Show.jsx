import { Head } from '@inertiajs/react';
import { Download, ArrowLeft } from 'lucide-react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardHeader, CardTitle, CardBody } from '@/Components/ui/Card';
import StatCard from '@/Components/ui/StatCard';
import Badge from '@/Components/ui/Badge';
import Button from '@/Components/ui/Button';

export default function PerformanceShow({ displayName, agenceNom, libellePeriode, backUrl, exportUrl, ventesCount, clientsCount, cartesVendues, clients, ventes, estEnrolement }) {
    const libelle = estEnrolement ? 'Enrôlements' : 'Ventes';
    return (
        <AppLayout
            title={`Détail — ${displayName}`}
            subtitle={`Période : ${libellePeriode}`}
            actions={
                <div className="flex items-center gap-2">
                    <Button href={exportUrl} target="_blank" size="sm"><Download size={14} /> Exporter Excel</Button>
                    <Button href={backUrl} variant="outline" size="sm"><ArrowLeft size={14} /> Performances</Button>
                </div>
            }
        >
            <Head title={`Détail performances — ${displayName}`} />

            {agenceNom && <p className="mb-3 text-sm text-ardoise-500">Agence : <strong className="text-ardoise-900">{agenceNom}</strong></p>}

            <div className="mb-6 grid gap-4 sm:grid-cols-2">
                <StatCard label={`${libelle} (période)`} value={ventesCount} tone="orange" />
                <StatCard label="Clients touchés" value={clientsCount} tone="blue" />
            </div>

            {!estEnrolement && (
                <Card className="mb-4">
                    <CardHeader><CardTitle>Cartes vendues (volume)</CardTitle></CardHeader>
                    <CardBody className="p-0">
                        {cartesVendues.length === 0 ? (
                            <p className="px-5 py-4 text-sm text-ardoise-500">Aucune vente sur cette période.</p>
                        ) : (
                            <table className="w-full text-left text-sm">
                                <thead>
                                    <tr className="border-b border-ardoise-100 text-xs uppercase tracking-wide text-ardoise-500">
                                        <th className="px-5 py-2.5 font-medium">Type de carte</th>
                                        <th className="px-5 py-2.5 text-right font-medium">Quantité</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-ardoise-100">
                                    {cartesVendues.map((r) => (
                                        <tr key={r.code}>
                                            <td className="px-5 py-2.5"><Badge tone="blue">{r.code}</Badge></td>
                                            <td className="px-5 py-2.5 text-right">{r.total}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </CardBody>
                </Card>
            )}

            <Card className="mb-4 overflow-hidden">
                <CardHeader><CardTitle>Clients ({clientsCount})</CardTitle></CardHeader>
                {clients.length === 0 ? (
                    <p className="px-5 py-4 text-sm text-ardoise-500">Aucun client sur cette période.</p>
                ) : (
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-ardoise-100 text-xs uppercase tracking-wide text-ardoise-500">
                                <th className="px-5 py-2.5 font-medium">Nom</th>
                                {estEnrolement && <th className="px-5 py-2.5 font-medium">N° de compte</th>}
                                <th className="px-5 py-2.5 font-medium">Téléphone</th>
                                <th className="px-5 py-2.5 font-medium">{estEnrolement ? 'Adresse' : 'Ville'}</th>
                                {!estEnrolement && <th className="px-5 py-2.5 font-medium">Carte</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-ardoise-100">
                            {clients.map((c, i) => (
                                <tr key={i} className="hover:bg-ardoise-50">
                                    <td className="px-5 py-2.5 font-medium text-ardoise-900">{c.nom_complet}</td>
                                    {estEnrolement && <td className="px-5 py-2.5 font-mono text-ardoise-600">{c.numero_compte ?? '—'}</td>}
                                    <td className="px-5 py-2.5 text-ardoise-600">{c.telephone}</td>
                                    <td className="px-5 py-2.5 text-ardoise-600">{c.ville ?? '—'}</td>
                                    {!estEnrolement && <td className="px-5 py-2.5 text-ardoise-600">{c.type_carte ?? '—'}</td>}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </Card>

            <Card className="overflow-hidden">
                <CardHeader><CardTitle>{libelle} ({ventesCount})</CardTitle></CardHeader>
                {ventes.length === 0 ? (
                    <p className="px-5 py-4 text-sm text-ardoise-500">Aucun{estEnrolement ? ' enrôlement enregistré' : 'e vente enregistrée'} sur cette période.</p>
                ) : (
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-ardoise-100 text-xs uppercase tracking-wide text-ardoise-500">
                                <th className="px-5 py-2.5 font-medium">Date</th>
                                <th className="px-5 py-2.5 font-medium">Client</th>
                                {estEnrolement && <th className="px-5 py-2.5 font-medium">N° de compte</th>}
                                {!estEnrolement && <th className="px-5 py-2.5 font-medium">Carte vendue</th>}
                                <th className="px-5 py-2.5 font-medium">Agence</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-ardoise-100">
                            {ventes.map((v, i) => (
                                <tr key={i} className="hover:bg-ardoise-50">
                                    <td className="px-5 py-2.5 text-ardoise-600">{v.date}</td>
                                    <td className="px-5 py-2.5 font-medium text-ardoise-900">{v.client_nom}</td>
                                    {estEnrolement && <td className="px-5 py-2.5 font-mono text-ardoise-600">{v.numero_compte ?? '—'}</td>}
                                    {!estEnrolement && <td className="px-5 py-2.5 text-ardoise-600">{v.type_carte ?? '—'}</td>}
                                    <td className="px-5 py-2.5 text-ardoise-600">{v.agence_nom ?? '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </Card>
        </AppLayout>
    );
}
