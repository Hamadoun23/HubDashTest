import { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import { Chart as ChartJS, registerables } from 'chart.js';
import { Bar, Doughnut, Pie } from 'react-chartjs-2';
import { ArrowLeft, List } from 'lucide-react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardHeader, CardTitle, CardBody } from '@/Components/ui/Card';
import StatCard from '@/Components/ui/StatCard';
import Badge from '@/Components/ui/Badge';
import Button from '@/Components/ui/Button';
import { Input, Label } from '@/Components/ui/Input';
import { Select } from '@/Components/ui/Select';
import { cn } from '@/lib/cn';

ChartJS.register(...registerables);
const nf = new Intl.NumberFormat('fr-FR');

export default function CampagneSynthese({
    campagne, periode, filtres, agencesChoix, commerciauxChoix, resume, commerciaux, agences,
    parTypeCarte, parSemaine, parMois, telephonique, chartCommerciaux, chartAgences, qExp, estEnrolement,
}) {
    const [du, setDu] = useState(filtres.du);
    const [au, setAu] = useState(filtres.au);
    const [agenceId, setAgenceId] = useState(filtres.agence_id ?? '');
    const [userId, setUserId] = useState(filtres.user_id ?? '');
    const [tab, setTab] = useState('commerciaux');

    // Le client de cette campagne a-t-il un réseau d'agences ? La liste des
    // agences du périmètre répond seule à la question : vide, il n'y en a pas.
    const aDesAgences = agencesChoix.length > 0;
    // Un catalogue d'une seule carte ne se répartit pas.
    const aPlusieursTypes = !estEnrolement && parTypeCarte.length > 1;
    // Trois graphiques possibles : types de carte, commerciaux, agences. La
    // grille se resserre sur ceux que ce client a effectivement.
    const colonnesGraphiques = {
        1: 'lg:grid-cols-1',
        2: 'lg:grid-cols-2',
        3: 'lg:grid-cols-3',
    }[1 + Number(aPlusieursTypes) + Number(aDesAgences)];

    const libelleVentes = estEnrolement ? 'Enrôlements' : 'Ventes';
    const TABS = [
        { key: 'commerciaux', label: 'Commerciaux' },
        ...(aDesAgences ? [{ key: 'agences', label: 'Agences' }] : []),
        ...(aPlusieursTypes ? [{ key: 'types', label: 'Types de carte' }] : []),
        { key: 'temps', label: 'Semaines / Mois' },
    ];
    // `key` = section attendue par la route d'export ; `label` = ce que lit l'utilisateur.
    const sectionsExport = [
        { key: 'ventes', label: libelleVentes },
        { key: 'commerciaux', label: 'Commerciaux' },
        ...(aDesAgences ? [{ key: 'agences', label: 'Agences' }] : []),
        ...(aPlusieursTypes ? [{ key: 'types', label: 'Types' }] : []),
        { key: 'semaines', label: 'Semaines' },
        { key: 'mois', label: 'Mois' },
    ];

    function applyFilters(e) {
        e.preventDefault();
        router.get(route('rapports.campagnes.synthese', campagne.id), {
            du, au, agence_id: aDesAgences ? agenceId : '', user_id: userId,
        });
    }

    const ventesUrl = (extra = {}) => route('rapports.campagnes.ventes', { campagne: campagne.id, ...qExp, ...extra });

    return (
        <AppLayout
            title={`Synthèse — ${campagne.nom}`}
            subtitle={`Période affichée : ${periode.debut} → ${periode.fin} (limitée aux dates de la campagne)`}
            actions={
                <div className="flex items-center gap-2">
                    <Button href={ventesUrl()} variant="outline" size="sm"><List size={14} /> Liste {libelleVentes.toLowerCase()}</Button>
                    <Button href={route('rapports.index')} variant="outline" size="sm"><ArrowLeft size={14} /> Rapports</Button>
                </div>
            }
        >
            <Head title={`Synthèse — ${campagne.nom}`} />

            <form onSubmit={applyFilters} className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-ardoise-200 bg-white p-4 shadow-card">
                <div>
                    <Label htmlFor="du">Du</Label>
                    <Input id="du" type="date" value={du} onChange={(e) => setDu(e.target.value)} min={campagne.date_debut_iso} max={campagne.date_fin_iso} />
                </div>
                <div>
                    <Label htmlFor="au">Au</Label>
                    <Input id="au" type="date" value={au} onChange={(e) => setAu(e.target.value)} min={campagne.date_debut_iso} max={campagne.date_fin_iso} />
                </div>
                {aDesAgences && (
                    <div className="w-56">
                        <Label htmlFor="agence_id">Agence</Label>
                        <Select id="agence_id" value={agenceId} onChange={(e) => setAgenceId(e.target.value)}>
                            <option value="">— Toutes (périmètre campagne) —</option>
                            {agencesChoix.map((a) => <option key={a.id} value={a.id}>{a.nom}</option>)}
                        </Select>
                    </div>
                )}
                <div className="w-56">
                    <Label htmlFor="user_id">Commercial</Label>
                    <Select id="user_id" value={userId} onChange={(e) => setUserId(e.target.value)}>
                        <option value="">— Tous —</option>
                        {commerciauxChoix.map((u) => <option key={u.id} value={u.id}>{u.nom}</option>)}
                    </Select>
                </div>
                <Button type="submit" size="sm">Appliquer</Button>
            </form>

            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-ardoise-200 bg-white p-3 shadow-card">
                <span className="text-xs text-ardoise-500">Excel (.xlsx) :</span>
                <Button href={route('rapports.campagnes.export', { campagne: campagne.id, section: 'all', ...qExp, format: 'xlsx' })} target="_blank" size="sm">Classeur complet</Button>
                {sectionsExport.map((s) => (
                    <Button key={s.key} href={route('rapports.campagnes.export', { campagne: campagne.id, section: s.key, ...qExp, format: 'xlsx' })} target="_blank" variant="outline" size="sm">{s.label}</Button>
                ))}
            </div>

            <div className={cn('mb-6 grid grid-cols-2 gap-3', aDesAgences ? 'lg:grid-cols-5' : 'lg:grid-cols-4')}>
                <StatCard label={`Total ${libelleVentes.toLowerCase()}`} value={nf.format(resume.total_ventes)} tone="orange" />
                <StatCard label="Commerciaux (périmètre)" value={resume.nb_commerciaux_perimetre} tone="gray" />
                <StatCard label={`Avec ${libelleVentes.toLowerCase()}`} value={resume.nb_avec_ventes} tone="green" />
                <StatCard label="À 0" value={resume.nb_zero_vente} tone="gray" />
                {aDesAgences && (
                    <StatCard label="Agences actives" value={resume.nb_agences_avec_ventes} tone="blue" />
                )}
            </div>

            <div className="mb-3 flex justify-end gap-2">
                <Button href={route('rapports.campagnes.synthese.export-graphiques-excel', { campagne: campagne.id, ...qExp })} target="_blank" size="sm">Export graphiques (Excel)</Button>
                <Button href={route('rapports.campagnes.synthese.export-graphiques-word', { campagne: campagne.id, ...qExp })} target="_blank" variant="outline" size="sm">Export graphiques (Word)</Button>
            </div>

            {(aPlusieursTypes || chartCommerciaux.length > 0 || (aDesAgences && chartAgences.length > 0)) && (
                <div className={cn('mb-6 grid gap-4', colonnesGraphiques)}>
                    {aPlusieursTypes && (
                        <Card>
                            <CardHeader><CardTitle>Mix des ventes par type de carte</CardTitle></CardHeader>
                            <CardBody style={{ height: 240 }}>
                                <Doughnut
                                    data={{ labels: parTypeCarte.map((r) => r.code), datasets: [{ data: parTypeCarte.map((r) => r.total_ventes), backgroundColor: parTypeCarte.map((_, i) => ['#FF6A3A', '#0d6efd', '#6610f2', '#20c997', '#d63384', '#fd7e14', '#198754', '#6f42c1', '#ffc107', '#4d8ef7'][i % 10]) }] }}
                                    options={{ maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } } }}
                                />
                            </CardBody>
                        </Card>
                    )}
                    <Card>
                        <CardHeader><CardTitle>Top 5 commerciaux — part du total</CardTitle></CardHeader>
                        <CardBody style={{ height: 280 }}>
                            <Bar
                                data={{ labels: chartCommerciaux.map((r) => r.label), datasets: [{ label: 'Part (%)', data: chartCommerciaux.map((r) => r.pct_part), backgroundColor: chartCommerciaux.map((r) => r.label.startsWith('Autres') ? 'rgba(108,117,125,0.75)' : '#FF6A3A'), borderRadius: 4 }] }}
                                options={{ indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { min: 0, max: 100, ticks: { callback: (v) => `${v} %` } }, y: { ticks: { font: { size: 10 } } } } }}
                            />
                        </CardBody>
                    </Card>
                    {aDesAgences && (
                        <Card>
                            <CardHeader><CardTitle>Part des agences</CardTitle></CardHeader>
                            <CardBody style={{ height: 240 }}>
                                <Pie
                                    data={{ labels: chartAgences.map((r) => r.label), datasets: [{ data: chartAgences.map((r) => r.total_ventes), backgroundColor: chartAgences.map((_, i) => ['#6f42c1', '#d63384', '#fd7e14', '#198754', '#20c997', '#ffc107', '#FF6A3A', '#0d6efd', '#4d8ef7', '#6610f2'][i % 10]) }] }}
                                    options={{ maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } } }}
                                />
                            </CardBody>
                        </Card>
                    )}
                </div>
            )}

            {!estEnrolement && telephonique && (
                <Card className="mb-6">
                    <CardHeader className="flex flex-wrap items-center justify-between gap-2">
                        <CardTitle>Reporting téléphonique (période et filtres comme ci-dessus)</CardTitle>
                        <Button href={route('rapports.campagnes.reporting-telephonique', { campagne: campagne.id, date_debut: filtres.du, date_fin: filtres.au, user_id: filtres.user_id, agence_id: filtres.agence_id })} size="sm">Liste des fiches</Button>
                    </CardHeader>
                    <CardBody className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                        <div>Fiches : <strong>{nf.format(telephonique.nb_fiches)}</strong></div>
                        <div>Appels émis : <strong>{nf.format(telephonique.appels_emis)}</strong></div>
                        <div>Joignables : <strong>{nf.format(telephonique.appels_joignables)}</strong></div>
                        <div>Non joignables : <strong>{nf.format(telephonique.appels_non_joignables)}</strong></div>
                        <div>Intéressés : <strong>{nf.format(telephonique.clients_interesses)}</strong></div>
                        <div>Déjà servis : <strong>{nf.format(telephonique.clients_deja_servis)}</strong></div>
                    </CardBody>
                </Card>
            )}

            <div className="mb-3 flex flex-wrap gap-1 border-b border-ardoise-200">
                {TABS.map((t) => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        className={cn(
                            'rounded-t-lg px-4 py-2 text-sm font-medium transition-colors',
                            tab === t.key ? 'border-b-2 border-marque-500 text-marque-700' : 'text-ardoise-500 hover:text-ardoise-700',
                        )}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {tab === 'commerciaux' && (
                <Card className="overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-ardoise-100 text-xs uppercase tracking-wide text-ardoise-500">
                                <th className="px-4 py-2.5 font-medium">Rang</th>
                                <th className="px-4 py-2.5 font-medium">Commercial</th>
                                {aDesAgences && <th className="px-4 py-2.5 font-medium">Agence</th>}
                                <th className="px-4 py-2.5 text-right font-medium">{libelleVentes}</th>
                                <th className="px-4 py-2.5"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-ardoise-100">
                            {commerciaux.map((l) => (
                                <tr key={l.user_id} className={cn('hover:bg-ardoise-50', l.total_ventes === 0 && 'bg-amber-50/40')}>
                                    <td className="px-4 py-2.5">{l.rang}ᵉ</td>
                                    <td className="px-4 py-2.5 font-medium text-ardoise-900">{l.user_name}</td>
                                    {aDesAgences && <td className="px-4 py-2.5 text-ardoise-600">{l.agence_nom ?? '—'}</td>}
                                    <td className="px-4 py-2.5 text-right">{nf.format(l.total_ventes)}</td>
                                    <td className="px-4 py-2.5 text-right">
                                        <Button href={ventesUrl({ user_id: l.user_id })} variant="outline" size="sm">Détail</Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Card>
            )}

            {tab === 'agences' && (
                <Card className="overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-ardoise-100 text-xs uppercase tracking-wide text-ardoise-500">
                                <th className="px-4 py-2.5 font-medium">Agence</th>
                                <th className="px-4 py-2.5 text-right font-medium">{libelleVentes}</th>
                                <th className="px-4 py-2.5 text-right font-medium">Part %</th>
                                <th className="px-4 py-2.5 text-right font-medium">Commerciaux</th>
                                <th className="px-4 py-2.5"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-ardoise-100">
                            {agences.length === 0 ? (
                                <tr><td colSpan={5} className="px-4 py-8 text-center text-ardoise-500">Aucun{estEnrolement ? ' enrôlement' : 'e vente'} sur cette période.</td></tr>
                            ) : (
                                agences.map((l, i) => (
                                    <tr key={i} className="hover:bg-ardoise-50">
                                        <td className="px-4 py-2.5 font-medium text-ardoise-900">{l.agence_nom}</td>
                                        <td className="px-4 py-2.5 text-right">{nf.format(l.total_ventes)}</td>
                                        <td className="px-4 py-2.5 text-right">{l.pct_volume.toFixed(2).replace('.', ',')} %</td>
                                        <td className="px-4 py-2.5 text-right">{l.nb_commerciaux}</td>
                                        <td className="px-4 py-2.5 text-right">
                                            <Button href={ventesUrl({ agence_id: l.agence_id })} variant="outline" size="sm">Détail</Button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </Card>
            )}

            {tab === 'types' && (
                <Card className="overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-ardoise-100 text-xs uppercase tracking-wide text-ardoise-500">
                                <th className="px-4 py-2.5 font-medium">Type</th>
                                <th className="px-4 py-2.5 text-right font-medium">{libelleVentes}</th>
                                <th className="px-4 py-2.5 text-right font-medium">Part %</th>
                                <th className="px-4 py-2.5"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-ardoise-100">
                            {parTypeCarte.length === 0 ? (
                                <tr><td colSpan={4} className="px-4 py-8 text-center text-ardoise-500">Aucune vente.</td></tr>
                            ) : (
                                parTypeCarte.map((l, i) => (
                                    <tr key={i} className="hover:bg-ardoise-50">
                                        <td className="px-4 py-2.5"><Badge>{l.code}</Badge></td>
                                        <td className="px-4 py-2.5 text-right">{nf.format(l.total_ventes)}</td>
                                        <td className="px-4 py-2.5 text-right">{l.pct_volume.toFixed(2).replace('.', ',')} %</td>
                                        <td className="px-4 py-2.5 text-right">
                                            {l.type_carte_id !== null ? (
                                                <Button href={ventesUrl({ type_carte_id: l.type_carte_id })} variant="outline" size="sm">Détail</Button>
                                            ) : <span className="text-xs text-ardoise-300">—</span>}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </Card>
            )}

            {tab === 'temps' && (
                <div className="grid gap-4 lg:grid-cols-2">
                    <Card className="overflow-hidden">
                        <table className="w-full text-left text-sm">
                            <thead><tr className="border-b border-ardoise-100 text-xs uppercase tracking-wide text-ardoise-500"><th className="px-4 py-2.5 font-medium">Période</th><th className="px-4 py-2.5 text-right font-medium">{libelleVentes}</th></tr></thead>
                            <tbody className="divide-y divide-ardoise-100">
                                {parSemaine.length === 0 ? <tr><td colSpan={2} className="px-4 py-4 text-ardoise-400">—</td></tr> : parSemaine.map((l, i) => (
                                    <tr key={i}><td className="px-4 py-2.5 text-ardoise-600">{l.libelle}</td><td className="px-4 py-2.5 text-right">{l.total_ventes}</td></tr>
                                ))}
                            </tbody>
                        </table>
                    </Card>
                    <Card className="overflow-hidden">
                        <table className="w-full text-left text-sm">
                            <thead><tr className="border-b border-ardoise-100 text-xs uppercase tracking-wide text-ardoise-500"><th className="px-4 py-2.5 font-medium">Mois</th><th className="px-4 py-2.5 text-right font-medium">{libelleVentes}</th></tr></thead>
                            <tbody className="divide-y divide-ardoise-100">
                                {parMois.length === 0 ? <tr><td colSpan={2} className="px-4 py-4 text-ardoise-400">—</td></tr> : parMois.map((l, i) => (
                                    <tr key={i}><td className="px-4 py-2.5 text-ardoise-600">{l.libelle}</td><td className="px-4 py-2.5 text-right">{l.total_ventes}</td></tr>
                                ))}
                            </tbody>
                        </table>
                    </Card>
                </div>
            )}
        </AppLayout>
    );
}
