import { Head } from '@inertiajs/react';
import { Chart as ChartJS, registerables } from 'chart.js';
import { Bar, Doughnut, Pie } from 'react-chartjs-2';
import { Download, ArrowLeft, List } from 'lucide-react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardHeader, CardTitle, CardBody } from '@/Components/ui/Card';
import StatCard from '@/Components/ui/StatCard';
import { cn } from '@/lib/cn';
import Badge from '@/Components/ui/Badge';
import Button from '@/Components/ui/Button';
import Pagination from '@/Components/ui/Pagination';

ChartJS.register(...registerables);

const PALETTE = ['#0d6efd', '#4d8ef7', '#6610f2', '#6f42c1', '#d63384', '#fd7e14', '#198754', '#20c997', '#ffc107', '#FF6A3A'];
const nf = new Intl.NumberFormat('fr-FR');

export default function RapportsCumul({
    campagnes, periode, totalVentes, nbClientsDistincts, nbCommerciauxAvecVentes, nbAgencesAvecVentes,
    typesCarteKpi, chartTypes, chartCommerciaux, chartAgences, parCommercial, parAgence, clients, ventes, exportQuery,
    aDesAgences = true,
}) {
    const exportUrl = (section, format = 'xlsx') => route('rapports.cumul.export', { ...exportQuery, section, format });

    return (
        <AppLayout
            title="Cumul multi-campagnes"
            subtitle={`${campagnes.length} campagne(s) — période couverte : ${periode.debut} → ${periode.fin} — ${nf.format(totalVentes)} vente(s), ${nf.format(nbClientsDistincts)} client(s) distinct(s)`}
            actions={
                <div className="flex items-center gap-2">
                    <Button href={route('rapports.index') + '#cumul-campagnes'} variant="outline" size="sm"><ArrowLeft size={14} /> Autre sélection</Button>
                    <Button href={route('rapports.index')} variant="outline" size="sm"><List size={14} /> Liste des rapports</Button>
                </div>
            }
        >
            <Head title="Cumul multi-campagnes" />

            <Card className="mb-4">
                <CardHeader><CardTitle>Campagnes incluses</CardTitle></CardHeader>
                <CardBody>
                    <ul className="space-y-1 text-sm text-ardoise-600">
                        {campagnes.map((c) => (
                            <li key={c.nom}>
                                <strong className="text-ardoise-900">{c.nom}</strong> — {c.date_debut} → {c.date_fin} <Badge className="ml-1">{c.statut}</Badge>
                            </li>
                        ))}
                    </ul>
                </CardBody>
            </Card>

            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-ardoise-200 bg-white p-3 shadow-card">
                <span className="text-xs text-ardoise-500">Exports (.xlsx) :</span>
                <Button href={exportUrl('all')} target="_blank" size="sm">Classeur complet</Button>
                {['ventes', 'clients', 'commerciaux', ...(aDesAgences ? ['agences'] : []), 'types', 'semaines', 'mois'].map((s) => (
                    <Button key={s} href={exportUrl(s)} target="_blank" variant="outline" size="sm" className="capitalize">{s}</Button>
                ))}
                <span className="text-ardoise-300">|</span>
                <Button href={route('rapports.cumul.export', { ...exportQuery, section: 'graphiques-excel' })} target="_blank" size="sm">Excel — graphiques</Button>
                <Button href={route('rapports.cumul.export', { ...exportQuery, section: 'graphiques-word' })} target="_blank" variant="outline" size="sm">Word — graphiques</Button>
            </div>

            <div className={cn('mb-4 grid gap-3 sm:grid-cols-2', aDesAgences ? 'lg:grid-cols-4' : 'lg:grid-cols-3')}>
                <StatCard label="Ventes (lignes)" value={nf.format(totalVentes)} tone="orange" />
                <StatCard label="Commerciaux (avec ventes)" value={nf.format(nbCommerciauxAvecVentes)} tone="green" />
                {aDesAgences && (
                    <StatCard label="Agences (avec ventes)" value={nf.format(nbAgencesAvecVentes)} tone="blue" />
                )}
                <StatCard label="Clients distincts" value={nf.format(nbClientsDistincts)} tone="gray" />
            </div>

            <p className="mb-2 text-sm font-medium text-ardoise-600">Ventes par type de carte (sur le cumul sélectionné)</p>
            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {typesCarteKpi.length === 0 ? (
                    <p className="text-sm text-ardoise-500">Aucune vente par type sur ce cumul.</p>
                ) : (
                    typesCarteKpi.map((tc) => (
                        <StatCard key={tc.code} label={tc.code} value={nf.format(tc.total)} sub={`${tc.pct.toFixed(1).replace('.', ',')} %`} tone="gray" />
                    ))
                )}
            </div>

            {(chartTypes.length > 0 || chartCommerciaux.length > 0 || chartAgences.length > 0) && (
                <div className="mb-6 grid gap-4 lg:grid-cols-3">
                    <Card>
                        <CardHeader><CardTitle>Mix des ventes par type de carte</CardTitle></CardHeader>
                        <CardBody style={{ height: 240 }}>
                            <Doughnut
                                data={{
                                    labels: chartTypes.map((r) => r.code),
                                    datasets: [{ data: chartTypes.map((r) => r.total_ventes), backgroundColor: chartTypes.map((_, i) => PALETTE[i % PALETTE.length]) }],
                                }}
                                options={{ maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } } }}
                            />
                        </CardBody>
                    </Card>
                    <Card>
                        <CardHeader><CardTitle>Top 5 vendeurs — part du total</CardTitle></CardHeader>
                        <CardBody style={{ height: 280 }}>
                            <Bar
                                data={{
                                    labels: chartCommerciaux.map((r) => r.label),
                                    datasets: [{ label: 'Part (%)', data: chartCommerciaux.map((r) => r.pct_part), backgroundColor: chartCommerciaux.map((r) => r.label.startsWith('Autres') ? 'rgba(108,117,125,0.75)' : '#FF6A3A'), borderRadius: 4 }],
                                }}
                                options={{ indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { min: 0, max: 100, ticks: { callback: (v) => `${v} %` } }, y: { ticks: { font: { size: 10 } } } } }}
                            />
                        </CardBody>
                    </Card>
                    {aDesAgences && (
                        <Card>
                            <CardHeader><CardTitle>Part des agences</CardTitle></CardHeader>
                            <CardBody style={{ height: 240 }}>
                                <Pie
                                    data={{
                                        labels: chartAgences.map((r) => r.label),
                                        datasets: [{ data: chartAgences.map((r) => r.total_ventes), backgroundColor: chartAgences.map((_, i) => PALETTE[i % PALETTE.length]) }],
                                    }}
                                    options={{ maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } } }}
                                />
                            </CardBody>
                        </Card>
                    )}
                </div>
            )}

            <div className="mb-4 grid gap-4 lg:grid-cols-2">
                <Card className="overflow-hidden">
                    <CardHeader><CardTitle>Commerciaux (volume cumulé)</CardTitle></CardHeader>
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-ardoise-100 text-xs uppercase tracking-wide text-ardoise-500">
                                <th className="px-4 py-2.5 font-medium">Commercial</th>
                                {aDesAgences && <th className="px-4 py-2.5 font-medium">Agence</th>}
                                <th className="px-4 py-2.5 text-right font-medium">Ventes</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-ardoise-100">
                            {parCommercial.length === 0 ? (
                                <tr><td colSpan={aDesAgences ? 3 : 2} className="px-4 py-6 text-center text-ardoise-500">Aucune vente.</td></tr>
                            ) : (
                                parCommercial.map((r, i) => (
                                    <tr key={i} className="hover:bg-ardoise-50">
                                        <td className="px-4 py-2.5 font-medium text-ardoise-900">{r.nom}</td>
                                        {aDesAgences && <td className="px-4 py-2.5 text-ardoise-600">{r.agence_nom}</td>}
                                        <td className="px-4 py-2.5 text-right">{nf.format(r.total)}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </Card>
                {aDesAgences && (
                <Card className="overflow-hidden">
                    <CardHeader><CardTitle>Agences (volume cumulé)</CardTitle></CardHeader>
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-ardoise-100 text-xs uppercase tracking-wide text-ardoise-500">
                                {aDesAgences && <th className="px-4 py-2.5 font-medium">Agence</th>}
                                <th className="px-4 py-2.5 text-right font-medium">Ventes</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-ardoise-100">
                            {parAgence.length === 0 ? (
                                <tr><td colSpan={2} className="px-4 py-6 text-center text-ardoise-500">Aucune vente.</td></tr>
                            ) : (
                                parAgence.map((r, i) => (
                                    <tr key={i} className="hover:bg-ardoise-50">
                                        <td className="px-4 py-2.5 font-medium text-ardoise-900">{r.nom}</td>
                                        <td className="px-4 py-2.5 text-right">{nf.format(r.total)}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </Card>
                )}
            </div>

            <Card className="mb-4 overflow-hidden">
                <CardHeader className="flex items-center justify-between">
                    <CardTitle>Clients (au moins une vente sur les campagnes sélectionnées)</CardTitle>
                    <span className="text-xs text-ardoise-400">{clients.length} fiche(s)</span>
                </CardHeader>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-ardoise-100 text-xs uppercase tracking-wide text-ardoise-500">
                                <th className="px-4 py-2.5 font-medium">Nom</th>
                                <th className="px-4 py-2.5 font-medium">Téléphone</th>
                                <th className="px-4 py-2.5 font-medium">Ville</th>
                                <th className="px-4 py-2.5 font-medium">Type carte</th>
                                <th className="px-4 py-2.5 font-medium">Commercial</th>
                                <th className="px-4 py-2.5 text-right font-medium">Ventes</th>
                                <th className="px-4 py-2.5"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-ardoise-100">
                            {clients.length === 0 ? (
                                <tr><td colSpan={7} className="px-4 py-6 text-center text-ardoise-500">Aucun client.</td></tr>
                            ) : (
                                clients.map((c) => (
                                    <tr key={c.id} className="hover:bg-ardoise-50">
                                        <td className="px-4 py-2.5 font-medium text-ardoise-900">{c.nom_complet}</td>
                                        <td className="px-4 py-2.5 text-ardoise-600">{c.telephone ?? '—'}</td>
                                        <td className="px-4 py-2.5 text-ardoise-600">{c.ville ?? '—'}</td>
                                        <td className="px-4 py-2.5"><Badge tone="blue">{c.type_carte}</Badge></td>
                                        <td className="px-4 py-2.5 text-ardoise-600">{c.commercial}</td>
                                        <td className="px-4 py-2.5 text-right">{nf.format(c.nb_ventes)}</td>
                                        <td className="px-4 py-2.5 text-right">
                                            <Button href={route('clients.show', c.id)} variant="outline" size="sm">Fiche</Button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            <Card className="overflow-hidden">
                <CardHeader><CardTitle>Détail des ventes (toutes campagnes sélectionnées)</CardTitle></CardHeader>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-ardoise-100 text-xs uppercase tracking-wide text-ardoise-500">
                                <th className="px-4 py-2.5 font-medium">Date</th>
                                <th className="px-4 py-2.5 font-medium">Campagne</th>
                                <th className="px-4 py-2.5 font-medium">Client</th>
                                <th className="px-4 py-2.5 font-medium">Type carte</th>
                                <th className="px-4 py-2.5 font-medium">Commercial</th>
                                <th className="px-4 py-2.5 font-medium">Agence</th>
                                <th className="px-4 py-2.5 font-medium">Activation</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-ardoise-100">
                            {ventes.data.length === 0 ? (
                                <tr><td colSpan={7} className="px-4 py-6 text-center text-ardoise-500">Aucune vente.</td></tr>
                            ) : (
                                ventes.data.map((v, i) => (
                                    <tr key={i} className="hover:bg-ardoise-50">
                                        <td className="px-4 py-2.5 text-ardoise-600">{v.date}</td>
                                        <td className="px-4 py-2.5"><Badge>{v.campagne_nom ?? '—'}</Badge></td>
                                        <td className="px-4 py-2.5 font-medium text-ardoise-900">{v.client_nom}</td>
                                        <td className="px-4 py-2.5"><Badge tone="blue">{v.type_carte}</Badge></td>
                                        <td className="px-4 py-2.5 text-ardoise-600">{v.commercial}</td>
                                        {aDesAgences && <td className="px-4 py-2.5 text-ardoise-600">{v.agence_nom}</td>}
                                        <td className="px-4 py-2.5"><Badge>{v.statut_activation}</Badge></td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                <Pagination links={ventes.links} from={ventes.from} to={ventes.to} total={ventes.total} />
            </Card>
        </AppLayout>
    );
}
