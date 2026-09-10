import { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import { Download, ArrowLeft, BarChart3, Users } from 'lucide-react';
import AppLayout from '@/Layouts/AppLayout';
import { Card } from '@/Components/ui/Card';
import Badge from '@/Components/ui/Badge';
import Button from '@/Components/ui/Button';
import { Input, Label } from '@/Components/ui/Input';
import { Select } from '@/Components/ui/Select';
import Pagination from '@/Components/ui/Pagination';
import Modal from '@/Components/ui/Modal';

const nf = new Intl.NumberFormat('fr-FR');

export default function CampagneVentes({ campagne, periode, filtres, agencesChoix, commerciauxChoix, typesChoix, resumeListe, qListe, ventes, estEnrolement }) {
    const [du, setDu] = useState(filtres.du);
    const [au, setAu] = useState(filtres.au);
    const [agenceId, setAgenceId] = useState(filtres.agence_id ?? '');
    // Liste vide = client sans réseau d'agences : la colonne et le filtre
    // n'auraient rien à montrer.
    const aDesAgences = agencesChoix.length > 0;
    const [userId, setUserId] = useState(filtres.user_id ?? '');
    const [typeCarteId, setTypeCarteId] = useState(filtres.type_carte_id ?? '');
    const [detailLigne, setDetailLigne] = useState(null);
    const libelle = estEnrolement ? 'Enrôlements' : 'Ventes';

    function applyFilters(e) {
        e.preventDefault();
        router.get(route('rapports.campagnes.ventes', campagne.id), { du, au, agence_id: agenceId, user_id: userId, type_carte_id: typeCarteId });
    }

    return (
        <AppLayout
            title={`${libelle} — ${campagne.nom}`}
            subtitle={`Campagne : ${campagne.date_debut} → ${campagne.date_fin} — Filtre affiché : ${periode.debut} → ${periode.fin}`}
            actions={
                <div className="flex flex-wrap items-center gap-2">
                    <Button href={route('rapports.campagnes.synthese', campagne.id)} size="sm"><BarChart3 size={14} /> Synthèse</Button>
                    <Button href={route('rapports.campagnes.clients', campagne.id)} variant="outline" size="sm"><Users size={14} /> Clients</Button>
                    <Button href={route('rapports.index')} variant="outline" size="sm"><ArrowLeft size={14} /> Rapports</Button>
                </div>
            }
        >
            <Head title={`${libelle} — ${campagne.nom}`} />

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
                    <div className="w-48">
                        <Label htmlFor="agence_id">Agence</Label>
                        <Select id="agence_id" value={agenceId} onChange={(e) => setAgenceId(e.target.value)}>
                            <option value="">— Toutes —</option>
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
                {!estEnrolement && (
                    <div className="w-40">
                        <Label htmlFor="type_carte_id">Type carte</Label>
                        <Select id="type_carte_id" value={typeCarteId} onChange={(e) => setTypeCarteId(e.target.value)}>
                            <option value="">— Tous —</option>
                            {typesChoix.map((t) => <option key={t.id} value={t.id}>{t.code}</option>)}
                        </Select>
                    </div>
                )}
                <Button type="submit" size="sm">Filtrer</Button>
            </form>

            <div className="mb-4 flex flex-wrap items-center gap-3">
                <div className="rounded-xl border border-ardoise-200 bg-white px-4 py-2.5 shadow-card">
                    <p className="text-xs text-ardoise-500">Lignes (filtre actuel)</p>
                    <p className="text-lg font-semibold text-ardoise-900">{nf.format(resumeListe.count)}</p>
                </div>
                <Button href={route('rapports.campagnes.export', { campagne: campagne.id, section: 'ventes', ...qListe, format: 'xlsx' })} target="_blank" size="sm">
                    <Download size={14} /> Excel
                </Button>
                <Button href={route('rapports.campagnes.export', { campagne: campagne.id, section: 'ventes', ...qListe })} target="_blank" variant="outline" size="sm">
                    <Download size={14} /> CSV
                </Button>
            </div>

            <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-ardoise-100 text-xs uppercase tracking-wide text-ardoise-500">
                                <th className="px-4 py-3 font-medium">Date</th>
                                <th className="px-4 py-3 font-medium">Client</th>
                                {estEnrolement && <th className="px-4 py-3 font-medium">N° de compte</th>}
                                {!estEnrolement && <th className="px-4 py-3 font-medium">Type carte</th>}
                                <th className="px-4 py-3 font-medium">Commercial</th>
                                {aDesAgences && <th className="px-4 py-3 font-medium">Agence</th>}
                                {!estEnrolement && <th className="px-4 py-3 font-medium">Activation</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-ardoise-100">
                            {ventes.data.length === 0 ? (
                                <tr><td colSpan={estEnrolement ? 5 : 6} className="px-4 py-8 text-center text-ardoise-500">Aucun{estEnrolement ? ' enrôlement' : 'e vente'} ne correspond aux critères.</td></tr>
                            ) : (
                                ventes.data.map((v, i) => (
                                    <tr key={i} className="hover:bg-ardoise-50">
                                        <td className="px-4 py-3 text-ardoise-600">{v.date}</td>
                                        <td className="px-4 py-3 font-medium text-ardoise-900">
                                            <button
                                                type="button"
                                                onClick={() => setDetailLigne(v)}
                                                className="text-left font-medium text-marque-700 underline-offset-2 hover:underline"
                                            >
                                                {v.client_nom}
                                            </button>
                                        </td>
                                        {estEnrolement && <td className="px-4 py-3 font-mono text-ardoise-600">{v.numero_compte || '—'}</td>}
                                        {!estEnrolement && <td className="px-4 py-3"><Badge tone="blue">{v.type_carte}</Badge></td>}
                                        <td className="px-4 py-3 text-ardoise-600">{v.commercial}</td>
                                        {aDesAgences && <td className="px-4 py-3 text-ardoise-600">{v.agence_nom}</td>}
                                        {!estEnrolement && <td className="px-4 py-3"><Badge>{v.statut_activation}</Badge></td>}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                <Pagination links={ventes.links} from={ventes.from} to={ventes.to} total={ventes.total} />
            </Card>

            <Modal
                open={!!detailLigne}
                onClose={() => setDetailLigne(null)}
                title={detailLigne ? detailLigne.client_nom : ''}
                description={`${estEnrolement ? 'Enrôlement' : 'Vente'} — ${campagne.nom}`}
            >
                {detailLigne && (
                    <div className="flex flex-col gap-3">
                        <dl className="grid grid-cols-3 gap-x-3 gap-y-2 text-sm">
                            <dt className="text-ardoise-500">Date</dt>
                            <dd className="col-span-2 text-ardoise-900">{detailLigne.date}</dd>
                            {estEnrolement && (
                                <>
                                    <dt className="text-ardoise-500">N° de compte</dt>
                                    <dd className="col-span-2 font-mono text-ardoise-900">{detailLigne.numero_compte || '—'}</dd>
                                </>
                            )}
                            <dt className="text-ardoise-500">Téléphone</dt>
                            <dd className="col-span-2 text-ardoise-900">{detailLigne.telephone || '—'}</dd>
                            <dt className="text-ardoise-500">{estEnrolement ? 'Adresse' : 'Ville'}</dt>
                            <dd className="col-span-2 text-ardoise-900">{detailLigne.adresse || '—'}</dd>
                            {!estEnrolement && (
                                <>
                                    <dt className="text-ardoise-500">Type carte</dt>
                                    <dd className="col-span-2"><Badge tone="blue">{detailLigne.type_carte}</Badge></dd>
                                    <dt className="text-ardoise-500">Activation</dt>
                                    <dd className="col-span-2"><Badge>{detailLigne.statut_activation}</Badge></dd>
                                </>
                            )}
                            <dt className="text-ardoise-500">Commercial</dt>
                            <dd className="col-span-2 text-ardoise-900">{detailLigne.commercial}</dd>
                            {aDesAgences && <>
                                <dt className="text-ardoise-500">Agence</dt>
                                <dd className="col-span-2 text-ardoise-900">{detailLigne.agence_nom}</dd>
                            </>}
                        </dl>
                        {detailLigne.client_id && (
                            <Button href={route('clients.show', detailLigne.client_id)} variant="outline" size="sm">
                                <Users size={14} /> Fiche client complète
                            </Button>
                        )}
                    </div>
                )}
            </Modal>
        </AppLayout>
    );
}
