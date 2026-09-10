import { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import { ArrowLeft, Download, Eye } from 'lucide-react';
import AppLayout from '@/Layouts/AppLayout';
import { Card } from '@/Components/ui/Card';
import StatCard from '@/Components/ui/StatCard';
import Button from '@/Components/ui/Button';
import { Input, Label } from '@/Components/ui/Input';
import { Select } from '@/Components/ui/Select';
import Pagination from '@/Components/ui/Pagination';

const nf = new Intl.NumberFormat('fr-FR');

export default function CampagneReportingTelephonique({ campagne, periode, filtres, telephoniques, agencesChoix, agregats, isAdmin, exportQuery, rapports }) {
    const [dateDebut, setDateDebut] = useState(filtres.date_debut);
    const [dateFin, setDateFin] = useState(filtres.date_fin);
    const [userId, setUserId] = useState(filtres.user_id ?? '');
    const [agenceId, setAgenceId] = useState(filtres.agence_id ?? '');
    const aDesAgences = agencesChoix.length > 0;

    function applyFilters(e) {
        e.preventDefault();
        router.get(route('rapports.campagnes.reporting-telephonique', campagne.id), { date_debut: dateDebut, date_fin: dateFin, user_id: userId, agence_id: agenceId });
    }

    return (
        <AppLayout
            title={`Reporting téléphonique — ${campagne.nom}`}
            subtitle={`Période affichée : ${periode.debut} → ${periode.fin} (limitée aux dates de campagne)`}
            actions={
                <div className="flex items-center gap-2">
                    <Button href={route('rapports.campagnes.synthese', campagne.id)} variant="outline" size="sm">Synthèse campagne</Button>
                    <Button href={route('rapports.index')} variant="outline" size="sm"><ArrowLeft size={14} /> Rapports</Button>
                </div>
            }
        >
            <Head title={`Reporting téléphonique — ${campagne.nom}`} />

            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <StatCard label="Fiches" value={nf.format(agregats.nb_fiches)} tone="orange" />
                <StatCard label="Appels émis" value={nf.format(agregats.appels_emis)} tone="gray" />
                <StatCard label="Joignables" value={nf.format(agregats.appels_joignables)} tone="green" />
                <StatCard label="Non joignables" value={nf.format(agregats.appels_non_joignables)} tone="gray" />
                <StatCard label="Intéressés" value={nf.format(agregats.clients_interesses)} tone="blue" />
                <StatCard label="Déjà servis" value={nf.format(agregats.clients_deja_servis)} tone="gray" />
            </div>

            <p className="mb-4 text-xs text-ardoise-400">
                Les fiches sans campagne rattachée sont incluses si la date tombe dans la fenêtre ci-dessus
                et que la téléopératrice appartient au périmètre de la campagne{aDesAgences ? ' (agence concernée)' : ''}.
            </p>

            <form onSubmit={applyFilters} className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-ardoise-200 bg-white p-4 shadow-card">
                <div>
                    <Label htmlFor="date_debut">Du</Label>
                    <Input id="date_debut" type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} min={campagne.date_debut_iso} max={campagne.date_fin_iso} />
                </div>
                <div>
                    <Label htmlFor="date_fin">Au</Label>
                    <Input id="date_fin" type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} min={campagne.date_debut_iso} max={campagne.date_fin_iso} />
                </div>
                <div className="w-64">
                    <Label htmlFor="user_id">Téléopératrice</Label>
                    <Select id="user_id" value={userId} onChange={(e) => setUserId(e.target.value)}>
                        <option value="">— Toutes —</option>
                        {telephoniques.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                    </Select>
                </div>
                {aDesAgences && (
                    <div className="w-48">
                        <Label htmlFor="agence_id">Agence</Label>
                        <Select id="agence_id" value={agenceId} onChange={(e) => setAgenceId(e.target.value)}>
                            <option value="">— Toutes —</option>
                            {agencesChoix.map((a) => <option key={a.id} value={a.id}>{a.nom}</option>)}
                        </Select>
                    </div>
                )}
                <Button type="submit" size="sm">Filtrer</Button>
            </form>

            {isAdmin && (
                <div className="mb-4 flex flex-wrap gap-2">
                    <Button href={route('admin.telephonique-rapports.export', { ...exportQuery, format: 'xlsx' })} target="_blank" size="sm">
                        <Download size={14} /> Exporter Excel
                    </Button>
                    <Button href={route('admin.telephonique-rapports.export', exportQuery)} target="_blank" variant="outline" size="sm">
                        <Download size={14} /> Exporter CSV
                    </Button>
                </div>
            )}

            <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-ardoise-100 text-xs uppercase tracking-wide text-ardoise-500">
                                <th className="px-4 py-3 font-medium">Date</th>
                                <th className="px-4 py-3 font-medium">Campagne</th>
                                <th className="px-4 py-3 font-medium">Collaborateur</th>
                                {aDesAgences && <th className="px-4 py-3 font-medium">Agence</th>}
                                <th className="px-4 py-3 text-right font-medium">Émis</th>
                                <th className="px-4 py-3 text-right font-medium">Joign.</th>
                                <th className="px-4 py-3 text-right font-medium">Non j.</th>
                                <th className="px-4 py-3 text-right font-medium">Intéressés</th>
                                <th className="px-4 py-3 text-right font-medium">Déjà servis</th>
                                <th className="px-4 py-3 font-medium">Cartes</th>
                                <th className="px-4 py-3"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-ardoise-100">
                            {rapports.data.length === 0 ? (
                                <tr><td colSpan={11} className="px-4 py-8 text-center text-ardoise-500">Aucune fiche sur cette période et ces filtres.</td></tr>
                            ) : (
                                rapports.data.map((r) => (
                                    <tr key={r.id} className="hover:bg-ardoise-50">
                                        <td className="px-4 py-3 text-ardoise-600">{r.date}</td>
                                        <td className="px-4 py-3 text-xs text-ardoise-500">{r.campagne_nom ?? '—'}</td>
                                        <td className="px-4 py-3 font-medium text-ardoise-900">{r.user_nom}</td>
                                        {aDesAgences && <td className="px-4 py-3 text-xs text-ardoise-500">{r.agence_nom ?? '—'}</td>}
                                        <td className="px-4 py-3 text-right text-ardoise-600">{r.appels_emis}</td>
                                        <td className="px-4 py-3 text-right text-ardoise-600">{r.appels_joignables}</td>
                                        <td className="px-4 py-3 text-right text-ardoise-600">{r.appels_non_joignables}</td>
                                        <td className="px-4 py-3 text-right text-ardoise-600">{r.clients_interesses_nombre}</td>
                                        <td className="px-4 py-3 text-right text-ardoise-600">{r.clients_deja_servis_nombre}</td>
                                        <td className="px-4 py-3 text-xs text-ardoise-500">{r.cartes_resume}</td>
                                        <td className="px-4 py-3 text-right">
                                            <Button href={route('rapports.campagnes.reporting-telephonique.show', { campagne: campagne.id, telephoniqueRapport: r.id, ...filtres })} variant="outline" size="sm">
                                                <Eye size={13} />
                                            </Button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                        {agregats.nb_fiches > 0 && (
                            <tfoot className="border-t border-ardoise-200 bg-ardoise-50 text-sm font-semibold text-ardoise-700">
                                <tr>
                                    <td colSpan={4} className="px-4 py-2.5 text-right">Total ({agregats.nb_fiches} fiche(s))</td>
                                    <td className="px-4 py-2.5 text-right">{agregats.appels_emis}</td>
                                    <td className="px-4 py-2.5 text-right">{agregats.appels_joignables}</td>
                                    <td className="px-4 py-2.5 text-right">{agregats.appels_non_joignables}</td>
                                    <td className="px-4 py-2.5 text-right">{agregats.clients_interesses}</td>
                                    <td className="px-4 py-2.5 text-right">{agregats.clients_deja_servis}</td>
                                    <td colSpan={2}></td>
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
