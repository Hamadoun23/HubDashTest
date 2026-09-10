import { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import { Chart as ChartJS, registerables } from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { Download, FileSpreadsheet, FileText, Layers, Eye } from 'lucide-react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardHeader, CardTitle, CardBody } from '@/Components/ui/Card';
import StatCard from '@/Components/ui/StatCard';
import Badge from '@/Components/ui/Badge';
import Button from '@/Components/ui/Button';
import { Input, Label } from '@/Components/ui/Input';
import { Select } from '@/Components/ui/Select';
import Checkbox from '@/Components/ui/Checkbox';

ChartJS.register(...registerables);

const PALETTE = ['#FF6A3A', '#0d6efd', '#6610f2', '#20c997', '#d63384', '#fd7e14', '#198754', '#6f42c1', '#ffc107', '#4d8ef7'];
const nf = new Intl.NumberFormat('fr-FR');

function rangLabel(r) {
    if (!r || r < 1) return '—';
    return r === 1 ? '1ᵉʳ' : `${r}ᵉ`;
}

/**
 * Sans aucune activité, tout le monde est ex æquo au rang 1 : afficher « Top 1 »
 * sur les dizaines de lignes à 0 donnait une page entièrement badgée, illisible.
 * Le badge de podium n'apparaît donc que si la ligne a réellement du volume.
 */
function RangBadge({ rang, total = 0 }) {
    if (total > 0 && rang === 1) return <Badge tone="amber">Top 1</Badge>;
    if (total > 0 && rang === 2) return <Badge tone="neutral">Top 2</Badge>;
    return <span className="tabular-nums text-ardoise-500">{rang}</span>;
}

export default function PerformancesIndex(props) {
    const {
        filters, canFilterAgence, aDesAgences = true, agencesSelect, campagnesSelect, libellePeriode,
        vueCommerciale, canExport, exportQuery,
        stats, statsPrev, compareDelta, compareEnabled, typesCartes,
        topCommerciauxChart, ventesParAgenceChart, campagneRefNom, primeMeilleurVendeur,
        classement, classementLigneTop1, ligneCommercialConnecte, userEstPremier, monDetailUrl,
        classementAgences, classementTypesCartes, estEnrolement,
    } = props;

    const [du, setDu] = useState(filters.du || '');
    const [au, setAu] = useState(filters.au || '');
    const [agence, setAgence] = useState(filters.agence || '');
    const [campagneId, setCampagneId] = useState(filters.campagne_id || '');
    const [compare, setCompare] = useState(filters.compare);

    function applyFilters(e) {
        e.preventDefault();
        router.get(route('performances.index'), { du, au, agence, campagne_id: campagneId, compare: compare ? 1 : '' });
    }

    const totalVentes = stats.total_ventes ?? 0;
    const showCharts = !vueCommerciale && totalVentes > 0;
    const libelle = estEnrolement ? 'Enrôlements' : 'Ventes';
    const libelleUn = estEnrolement ? 'enrôlement(s)' : 'vente(s)';

    return (
        <AppLayout
            title="Tableau de bord des performances"
            actions={
                <div className="flex items-center gap-2">
                    {(canFilterAgence) && (
                        <Button href={route('rapports.index') + '#cumul-campagnes'} variant="secondary" size="sm">
                            <Layers size={14} /> Cumul
                        </Button>
                    )}
                    {canExport && (
                        <>
                            <Button href={route('performances.export-excel', exportQuery)} target="_blank" size="sm">
                                <Download size={14} /> Excel
                            </Button>
                            <Button href={route('performances.export-graphiques-excel', exportQuery)} target="_blank" variant="outline" size="sm">
                                <FileSpreadsheet size={14} /> Graph. Excel
                            </Button>
                            <Button href={route('performances.export-graphiques-word', exportQuery)} target="_blank" variant="outline" size="sm">
                                <FileText size={14} /> Graph. Word
                            </Button>
                        </>
                    )}
                </div>
            }
        >
            <Head title="Performances" />

            <Card className="mb-4 border-l-4 border-l-marque-500">
                <CardBody>
                    <p className="mb-2 text-sm font-semibold text-ardoise-900">À retenir pour la réunion</p>
                    <ul className="ml-4 list-disc space-y-1 text-sm text-ardoise-600">
                        <li><strong>Période :</strong> {libellePeriode}</li>
                        {!vueCommerciale ? (
                            <li>
                                <strong>Volume :</strong> {nf.format(totalVentes)} {libelleUn}
                                {compareEnabled && compareDelta?.ventes_pct !== null && compareDelta?.ventes_pct !== undefined && (
                                    <span className="text-ardoise-400"> ({compareDelta.ventes_pct >= 0 ? '+' : ''}{compareDelta.ventes_pct.toFixed(1).replace('.', ',')} % vs période précédente)</span>
                                )}
                                {compareEnabled && compareDelta && compareDelta.ventes_pct === null && totalVentes > 0 && (
                                    <span className="text-ardoise-400"> (nouvelle activité vs 0 sur la période précédente)</span>
                                )}
                            </li>
                        ) : (
                            <>
                                <li><strong>Mes {libelle.toLowerCase()} :</strong> {nf.format(stats.mes_ventes ?? 0)}</li>
                                {stats.mon_rang && <li><strong>Mon rang :</strong> {rangLabel(stats.mon_rang)}</li>}
                            </>
                        )}
                        {compareEnabled && compareDelta && <li className="text-ardoise-400">{compareDelta.libelle}</li>}
                    </ul>
                </CardBody>
            </Card>

            <form onSubmit={applyFilters} className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-ardoise-200 bg-white p-4 shadow-card">
                <div>
                    <Label htmlFor="du">Du</Label>
                    <Input id="du" type="date" value={du} onChange={(e) => setDu(e.target.value)} />
                </div>
                <div>
                    <Label htmlFor="au">Au</Label>
                    <Input id="au" type="date" value={au} onChange={(e) => setAu(e.target.value)} />
                </div>
                {canFilterAgence && (
                    <div className="w-48">
                        <Label htmlFor="agence">Agence</Label>
                        <Select id="agence" value={agence} onChange={(e) => setAgence(e.target.value)}>
                            <option value="">Toutes</option>
                            {agencesSelect.map((a) => <option key={a.id} value={a.id}>{a.nom}</option>)}
                        </Select>
                    </div>
                )}
                {campagnesSelect.length > 0 && (
                    <div className="w-64">
                        <Label htmlFor="campagne_id">Campagne</Label>
                        <Select id="campagne_id" value={campagneId} onChange={(e) => setCampagneId(e.target.value)}>
                            <option value="">— Par défaut (réf. performances) —</option>
                            {campagnesSelect.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                        </Select>
                    </div>
                )}
                <Checkbox id="compare" label="Comparer à la période précédente" checked={compare} onChange={(e) => setCompare(e.target.checked)} />
                <div className="flex gap-2">
                    <Button type="submit" size="sm">Appliquer</Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => router.get(route('performances.index'), agence ? { agence } : {})}>
                        Réinit. filtres
                    </Button>
                </div>
                <p className="w-full text-xs text-ardoise-400">
                    Sans dates : période = campagne choisie ou campagne de référence pour votre agence. Avec Du et Au, la plage personnalisée prime sur les dates de campagne.
                </p>
            </form>

            {vueCommerciale ? (
                <>
                    <div className="mb-4">
                        <Button href={monDetailUrl} variant="outline" size="sm">
                            <Eye size={14} /> {estEnrolement ? 'Voir mon détail (enrôlements, clients)' : 'Voir mon détail (ventes, clients, cartes)'}
                        </Button>
                    </div>
                    <div className="mb-6 grid gap-4 sm:grid-cols-2">
                        <StatCard label={`Mes ${libelle.toLowerCase()}`} value={stats.mes_ventes ?? 0} tone="orange" />
                        <StatCard label="Mon rang" value={stats.mon_rang ? rangLabel(stats.mon_rang) : '—'} tone="blue" />
                    </div>
                </>
            ) : (
                <>
                    <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <StatCard label={`Total ${libelle.toLowerCase()}`} value={nf.format(totalVentes)} sub={compareEnabled && statsPrev ? `Avant : ${nf.format(statsPrev.total_ventes)}` : undefined} tone="orange" />
                        {typesCartes.length > 1 && typesCartes.map((tc) => (
                            <StatCard key={tc.id} label={tc.code} value={stats.par_type?.[tc.id] ?? 0} tone="gray" />
                        ))}
                    </div>

                    {showCharts && (
                        <div className="mb-6 grid gap-4 lg:grid-cols-3">
                            <Card>
                                <CardHeader><CardTitle>Top commercial — {libelle.toLowerCase()}</CardTitle></CardHeader>
                                <CardBody style={{ height: 280 }}>
                                    <Bar
                                        data={{
                                            labels: topCommerciauxChart.map((r) => r.label),
                                            datasets: [{ label: libelle, data: topCommerciauxChart.map((r) => r.ventes), backgroundColor: 'rgba(255,106,58,0.85)', borderColor: '#FF6A3A', borderWidth: 1 }],
                                        }}
                                        options={{
                                            indexAxis: 'y',
                                            maintainAspectRatio: false,
                                            plugins: { legend: { display: false } },
                                            scales: { x: { beginAtZero: true, ticks: { callback: (v) => nf.format(v) } } },
                                        }}
                                    />
                                </CardBody>
                            </Card>
                            {aDesAgences && (
                                <Card>
                                    <CardHeader><CardTitle>Répartition — part des agences</CardTitle></CardHeader>
                                    <CardBody style={{ height: 280 }}>
                                        <Doughnut
                                            data={{
                                                labels: ventesParAgenceChart.map((r) => r.label),
                                                datasets: [{ data: ventesParAgenceChart.map((r) => r.ventes), backgroundColor: ventesParAgenceChart.map((_, i) => PALETTE[i % PALETTE.length]), borderWidth: 1, borderColor: '#fff' }],
                                            }}
                                            options={{ maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } } }}
                                        />
                                    </CardBody>
                                </Card>
                            )}
                            {!estEnrolement && typesCartes.length > 1 && (
                                <Card>
                                    <CardHeader><CardTitle>Ventes par type de carte</CardTitle></CardHeader>
                                    <CardBody style={{ height: 280 }}>
                                        <Bar
                                            data={{
                                                labels: typesCartes.map((t) => t.code),
                                                datasets: [{ label: 'Ventes par type', data: typesCartes.map((t) => stats.par_type?.[t.id] ?? 0), backgroundColor: typesCartes.map((_, i) => PALETTE[i % PALETTE.length]) }],
                                            }}
                                            options={{ maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true, ticks: { callback: (v) => nf.format(v) } } } }}
                                        />
                                    </CardBody>
                                </Card>
                            )}
                        </div>
                    )}
                </>
            )}

            <Card className="overflow-hidden">
                <CardHeader>
                    <CardTitle>
                        {vueCommerciale ? '1re place de la campagne et ma position' : 'Classement des commerciaux'}
                        {vueCommerciale && campagneRefNom && <span className="ml-1.5 font-normal text-ardoise-400">— {campagneRefNom}</span>}
                    </CardTitle>
                </CardHeader>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-ardoise-100 text-xs uppercase tracking-wide text-ardoise-500">
                                <th className="px-5 py-3 font-medium">Rang</th>
                                <th className="px-5 py-3 font-medium">Commercial</th>
                                <th className="px-5 py-3 text-right font-medium">{libelle}</th>
                                {!vueCommerciale && <th className="px-5 py-3 text-right font-medium">Part %</th>}
                                {!estEnrolement && <th className="px-5 py-3 font-medium">Prime (estimée)</th>}
                                {!vueCommerciale && <th className="px-5 py-3"></th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-ardoise-100">
                            {vueCommerciale ? (
                                <>
                                    {classementLigneTop1 && (
                                        <tr>
                                            <td className="px-5 py-3"><Badge tone="amber">Top 1</Badge></td>
                                            <td className="px-5 py-3 font-medium text-ardoise-900">
                                                {classementLigneTop1.user_name}
                                                {userEstPremier && <Badge tone="neutral" className="ml-1.5">vous</Badge>}
                                            </td>
                                            <td className="px-5 py-3 text-right">{nf.format(classementLigneTop1.total_ventes)}</td>
                                            {!estEnrolement && <td className="px-5 py-3">{primeMeilleurVendeur ? `${primeMeilleurVendeur} F` : '-'}</td>}
                                        </tr>
                                    )}
                                    {ligneCommercialConnecte && !userEstPremier && (
                                        <>
                                            <tr className="bg-ardoise-50"><td colSpan={estEnrolement ? 3 : 4} className="px-5 py-2 text-xs font-semibold text-ardoise-500">Ma position</td></tr>
                                            <tr className="bg-blue-50/40">
                                                <td className="px-5 py-3"><Badge>{rangLabel(ligneCommercialConnecte.rang)}</Badge></td>
                                                <td className="px-5 py-3 font-medium text-ardoise-900">{ligneCommercialConnecte.user_name} <Badge tone="neutral" className="ml-1.5">vous</Badge></td>
                                                <td className="px-5 py-3 text-right">{nf.format(ligneCommercialConnecte.total_ventes)}</td>
                                                {!estEnrolement && <td className="px-5 py-3">-</td>}
                                            </tr>
                                        </>
                                    )}
                                    {!classementLigneTop1 && !ligneCommercialConnecte && (
                                        <tr><td colSpan={estEnrolement ? 3 : 4} className="px-5 py-8 text-center text-ardoise-500">Aucun classement à afficher pour cette période.</td></tr>
                                    )}
                                </>
                            ) : (
                                <>
                                    {classement.map((c) => (
                                        <tr key={c.user_id} className="hover:bg-ardoise-50">
                                            <td className="px-5 py-3"><RangBadge rang={c.rang} total={c.total_ventes} /></td>
                                            <td className="px-5 py-3 font-medium text-ardoise-900">{c.user_name}</td>
                                            <td className="px-5 py-3 text-right">{nf.format(c.total_ventes)}</td>
                                            <td className="px-5 py-3 text-right">{c.pct_volume !== null ? `${c.pct_volume.toFixed(1).replace('.', ',')} %` : '—'}</td>
                                            {!estEnrolement && <td className="px-5 py-3">{primeMeilleurVendeur && c.rang === 1 ? `${primeMeilleurVendeur} F` : '-'}</td>}
                                            <td className="px-5 py-3 text-right">
                                                <Button href={c.detail_url} variant="outline" size="sm">Détail</Button>
                                            </td>
                                        </tr>
                                    ))}
                                    {classement.length === 0 && (
                                        <tr><td colSpan={estEnrolement ? 5 : 6} className="px-5 py-8 text-center text-ardoise-500">Aucun commercial à afficher.</td></tr>
                                    )}
                                </>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {!vueCommerciale && (
                <>
                    {aDesAgences && (
                    <Card className="mt-4 overflow-hidden">
                        <CardHeader><CardTitle>Classement des agences</CardTitle></CardHeader>
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-ardoise-100 text-xs uppercase tracking-wide text-ardoise-500">
                                    <th className="px-5 py-3 font-medium">Rang</th>
                                    <th className="px-5 py-3 font-medium">Agence</th>
                                    <th className="px-5 py-3 text-right font-medium">{libelle}</th>
                                    <th className="px-5 py-3 text-right font-medium">Part %</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-ardoise-100">
                                {classementAgences.length === 0 ? (
                                    <tr><td colSpan={4} className="px-5 py-8 text-center text-ardoise-500">Aucun{estEnrolement ? ' enrôlement' : 'e vente'} sur la période et les filtres choisis.</td></tr>
                                ) : (
                                    classementAgences.map((a) => (
                                        <tr key={a.agence_nom} className="hover:bg-ardoise-50">
                                            <td className="px-5 py-3"><RangBadge rang={a.rang} total={a.total_ventes} /></td>
                                            <td className="px-5 py-3 font-medium text-ardoise-900">{a.agence_nom}</td>
                                            <td className="px-5 py-3 text-right">{nf.format(a.total_ventes)}</td>
                                            <td className="px-5 py-3 text-right">{a.pct_volume.toFixed(1).replace('.', ',')} %</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </Card>
                    )}

                    {!estEnrolement && classementTypesCartes.length > 1 && (
                        <Card className="mt-4 overflow-hidden">
                            <CardHeader><CardTitle>Classement des types de cartes</CardTitle></CardHeader>
                            <table className="w-full text-left text-sm">
                                <thead>
                                    <tr className="border-b border-ardoise-100 text-xs uppercase tracking-wide text-ardoise-500">
                                        <th className="px-5 py-3 font-medium">Rang</th>
                                        <th className="px-5 py-3 font-medium">Type</th>
                                        <th className="px-5 py-3 text-right font-medium">Ventes</th>
                                        <th className="px-5 py-3 text-right font-medium">Part %</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-ardoise-100">
                                    {classementTypesCartes.length === 0 ? (
                                        <tr><td colSpan={4} className="px-5 py-8 text-center text-ardoise-500">Aucune vente sur la période et les filtres choisis.</td></tr>
                                    ) : (
                                        classementTypesCartes.map((t) => (
                                            <tr key={t.code} className="hover:bg-ardoise-50">
                                                <td className="px-5 py-3"><RangBadge rang={t.rang} total={t.total_ventes} /></td>
                                                <td className="px-5 py-3"><code className="text-xs">{t.code}</code></td>
                                                <td className="px-5 py-3 text-right">{nf.format(t.total_ventes)}</td>
                                                <td className="px-5 py-3 text-right">{t.pct_volume.toFixed(1).replace('.', ',')} %</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </Card>
                    )}
                </>
            )}
        </AppLayout>
    );
}
