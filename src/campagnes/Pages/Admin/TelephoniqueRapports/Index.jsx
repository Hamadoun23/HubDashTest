import { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import { Search, Download, Eye } from 'lucide-react';
import AppLayout from '@campagnes/Layouts/AppLayout';
import { Card } from '@campagnes/Components/ui/Card';
import Button from '@campagnes/Components/ui/Button';
import Badge from '@campagnes/Components/ui/Badge';
import { Input } from '@campagnes/Components/ui/Input';
import { Select } from '@campagnes/Components/ui/Select';
import Pagination from '@campagnes/Components/ui/Pagination';

export default function TelephoniqueRapportsIndex({ rapports, telephoniques, campagnes, totauxListe, libelleStatsCampagne, filters }) {
    const [userId, setUserId] = useState(filters.user_id ?? '');
    const [campagneId, setCampagneId] = useState(filters.campagne_id ?? '');
    const [dateDebut, setDateDebut] = useState(filters.date_debut ?? '');
    const [dateFin, setDateFin] = useState(filters.date_fin ?? '');

    const query = { user_id: userId, campagne_id: campagneId, date_debut: dateDebut, date_fin: dateFin };
    const cleanQuery = Object.fromEntries(Object.entries(query).filter(([, v]) => v));

    function applyFilters(e) {
        e.preventDefault();
        router.get(route('admin.telephonique-rapports.index'), cleanQuery, { preserveState: true });
    }

    function reset() {
        setUserId(''); setCampagneId(''); setDateDebut(''); setDateFin('');
        router.get(route('admin.telephonique-rapports.index'));
    }

    return (
        <AppLayout title="Reporting téléphonique" subtitle="Vue direction — toutes les fiches">
            <Head title="Reporting téléphonique" />

            {libelleStatsCampagne && !filters.campagne_id && (
                <div className="mb-4 flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-600">
                    <Badge tone="orange">Périmètre par défaut</Badge>
                    <span>{libelleStatsCampagne} (campagnes en cours, sinon dernière campagne)</span>
                </div>
            )}

            <form onSubmit={applyFilters} className="mb-4 flex flex-wrap items-end gap-3">
                <div className="w-56">
                    <label className="mb-1.5 block text-xs font-medium text-gray-500">Téléopératrice</label>
                    <Select value={userId} onChange={(e) => setUserId(e.target.value)}>
                        <option value="">— Toutes —</option>
                        {telephoniques.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                    </Select>
                </div>
                <div className="w-64">
                    <label className="mb-1.5 block text-xs font-medium text-gray-500">Campagne</label>
                    <Select value={campagneId} onChange={(e) => setCampagneId(e.target.value)}>
                        <option value="">— Toutes —</option>
                        {campagnes.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </Select>
                </div>
                <div>
                    <label className="mb-1.5 block text-xs font-medium text-gray-500">Du</label>
                    <Input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} />
                </div>
                <div>
                    <label className="mb-1.5 block text-xs font-medium text-gray-500">Au</label>
                    <Input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} />
                </div>
                <Button type="submit" variant="outline"><Search size={14} /> Filtrer</Button>
                <Button type="button" variant="ghost" onClick={reset}>Réinitialiser</Button>
            </form>

            <div className="mb-4 flex flex-wrap gap-2">
                <Button href={route('admin.telephonique-rapports.export', { ...cleanQuery, format: 'xlsx' })} target="_blank" size="sm">
                    <Download size={14} /> Exporter Excel
                </Button>
                <Button href={route('admin.telephonique-rapports.export', { ...cleanQuery, format: 'csv' })} target="_blank" variant="outline" size="sm">
                    <Download size={14} /> Exporter CSV
                </Button>
            </div>

            <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-500">
                                <th className="px-4 py-3 font-medium">Date</th>
                                <th className="px-4 py-3 font-medium">Campagne</th>
                                <th className="px-4 py-3 font-medium">Collaborateur</th>
                                <th className="px-4 py-3 font-medium">Agence</th>
                                <th className="px-4 py-3 text-right font-medium">Émis</th>
                                <th className="px-4 py-3 text-right font-medium">Joign.</th>
                                <th className="px-4 py-3 text-right font-medium">Non j.</th>
                                <th className="px-4 py-3 text-right font-medium">Intéressés</th>
                                <th className="px-4 py-3 text-right font-medium">Déjà servis</th>
                                <th className="px-4 py-3 font-medium">Cartes</th>
                                <th className="px-4 py-3"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {rapports.data.map((r) => (
                                <tr key={r.id} className="hover:bg-gray-50">
                                    <td className="whitespace-nowrap px-4 py-3 text-gray-600">{r.date}</td>
                                    <td className="px-4 py-3 text-xs text-gray-500">{r.campagne_nom ?? '—'}</td>
                                    <td className="px-4 py-3 font-medium text-gray-900">{r.user_nom}</td>
                                    <td className="px-4 py-3 text-xs text-gray-500">{r.agence_nom ?? '—'}</td>
                                    <td className="px-4 py-3 text-right text-gray-600">{r.appels_emis}</td>
                                    <td className="px-4 py-3 text-right text-gray-600">{r.appels_joignables}</td>
                                    <td className="px-4 py-3 text-right text-gray-600">{r.appels_non_joignables}</td>
                                    <td className="px-4 py-3 text-right text-gray-600">{r.clients_interesses_nombre}</td>
                                    <td className="px-4 py-3 text-right text-gray-600">{r.clients_deja_servis_nombre}</td>
                                    <td className="px-4 py-3 text-xs text-gray-500">{r.cartes_resume}</td>
                                    <td className="px-4 py-3 text-right">
                                        <Button href={route('admin.telephonique-rapports.show', r.id)} variant="ghost" size="sm" title="Détail">
                                            <Eye size={15} />
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                            {rapports.data.length === 0 && (
                                <tr>
                                    <td colSpan={11} className="px-4 py-8 text-center text-gray-500">Aucune fiche.</td>
                                </tr>
                            )}
                        </tbody>
                        {totauxListe?.nb_fiches > 0 && (
                            <tfoot className="border-t border-gray-200 bg-gray-50 text-sm font-semibold text-gray-700">
                                <tr>
                                    <td colSpan={4} className="px-4 py-2.5 text-right">Total ({totauxListe.nb_fiches} fiche(s))</td>
                                    <td className="px-4 py-2.5 text-right">{totauxListe.appels_emis}</td>
                                    <td className="px-4 py-2.5 text-right">{totauxListe.appels_joignables}</td>
                                    <td className="px-4 py-2.5 text-right">{totauxListe.appels_non_joignables}</td>
                                    <td className="px-4 py-2.5 text-right">{totauxListe.clients_interesses}</td>
                                    <td className="px-4 py-2.5 text-right">{totauxListe.clients_deja_servis}</td>
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
