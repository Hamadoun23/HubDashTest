import { useState } from 'react';
import { router } from '@inertiajs/react';
import { Card, CardHeader, CardTitle, CardBody } from '@/Components/ui/Card';
import StatCard from '@/Components/ui/StatCard';
import Badge from '@/Components/ui/Badge';
import Button from '@/Components/ui/Button';
import { Input, Label } from '@/Components/ui/Input';
import { Select } from '@/Components/ui/Select';

const nf = new Intl.NumberFormat('fr-FR');
const presetLabels = { campagne: 'Toute la campagne', semaine: 'Semaine en cours', mois: 'Mois en cours', perso: 'Dates au choix' };

export default function Performances({ campagne, estEnrolement, preset, periode, telephoniqueCampagne, telephoniqueListUrl, stats, classement, primes }) {
    const [localPreset, setLocalPreset] = useState(preset);
    const [du, setDu] = useState(periode.debut);
    const [au, setAu] = useState(periode.fin);

    function apply(e) {
        e.preventDefault();
        router.get(window.location.pathname, { tab: 'performances', periode: localPreset, date_debut: du, date_fin: au }, { preserveState: true });
    }

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader className="flex items-center justify-between">
                    <CardTitle>Période d'analyse</CardTitle>
                    <Badge>{periode.debut_affiche} → {periode.fin_affiche}</Badge>
                </CardHeader>
                <CardBody>
                    <form onSubmit={apply} className="mb-2 flex flex-wrap items-end gap-3">
                        <div className="w-48">
                            <Label htmlFor="perf_preset">Préréglage</Label>
                            <Select id="perf_preset" value={localPreset} onChange={(e) => setLocalPreset(e.target.value)}>
                                {Object.entries(presetLabels).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="perf_du">Du</Label>
                            <Input id="perf_du" type="date" value={du} onChange={(e) => setDu(e.target.value)} disabled={localPreset !== 'perso'} />
                        </div>
                        <div>
                            <Label htmlFor="perf_au">Au</Label>
                            <Input id="perf_au" type="date" value={au} onChange={(e) => setAu(e.target.value)} disabled={localPreset !== 'perso'} />
                        </div>
                        <Button type="submit" size="sm">Appliquer</Button>
                    </form>
                    <p className="text-sm text-ardoise-500">{presetLabels[preset]}</p>
                </CardBody>
            </Card>

            {!estEnrolement && (
                <Card>
                    <CardHeader className="flex items-center justify-between">
                        <CardTitle>Reporting téléphonique</CardTitle>
                        <Button href={telephoniqueListUrl} variant="outline" size="sm">Liste des fiches</Button>
                    </CardHeader>
                    <CardBody className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                        <div>Fiches : <strong>{nf.format(telephoniqueCampagne.nb_fiches)}</strong></div>
                        <div>Appels émis : <strong>{nf.format(telephoniqueCampagne.appels_emis)}</strong></div>
                        <div>Joignables : <strong>{nf.format(telephoniqueCampagne.appels_joignables)}</strong></div>
                        <div>Non joignables : <strong>{nf.format(telephoniqueCampagne.appels_non_joignables)}</strong></div>
                        <div>Intéressés : <strong>{nf.format(telephoniqueCampagne.clients_interesses)}</strong></div>
                        <div>Déjà servis : <strong>{nf.format(telephoniqueCampagne.clients_deja_servis)}</strong></div>
                    </CardBody>
                </Card>
            )}

            <Card>
                <CardHeader><CardTitle>{estEnrolement ? "Performances d'enrôlement" : 'Performances commerciales'}</CardTitle></CardHeader>
                <CardBody>
                    <div className="mb-4">
                        <StatCard label={estEnrolement ? 'Total enrôlements' : 'Total ventes'} value={stats.total_ventes} tone="orange" className="max-w-xs" />
                    </div>
                    <div className="mb-4 grid gap-4 sm:grid-cols-2">
                        {!estEnrolement && (
                            <div>
                                <p className="mb-2 text-sm font-semibold text-ardoise-900">Ventes par type de carte</p>
                                <table className="w-full text-left text-sm">
                                    <thead><tr className="text-xs uppercase text-ardoise-500"><th className="py-1">Type</th><th className="py-1 text-right">Nombre</th></tr></thead>
                                    <tbody className="divide-y divide-ardoise-100">
                                        {stats.par_type.map((t) => (
                                            <tr key={t.code}><td className="py-1.5">{t.code}</td><td className="py-1.5 text-right">{t.nb}</td></tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        <div>
                            <p className="mb-2 text-sm font-semibold text-ardoise-900">{estEnrolement ? 'Enrôlements par agence' : 'Ventes par agence'}</p>
                            <table className="w-full text-left text-sm">
                                <thead><tr className="text-xs uppercase text-ardoise-500"><th className="py-1">Agence</th><th className="py-1 text-right">Nombre</th></tr></thead>
                                <tbody className="divide-y divide-ardoise-100">
                                    {stats.par_agence.length === 0 ? (
                                        <tr><td colSpan={2} className="py-2 text-center text-ardoise-400">{estEnrolement ? 'Aucun enrôlement' : 'Aucune vente'}</td></tr>
                                    ) : (
                                        stats.par_agence.map((a, i) => (
                                            <tr key={i}><td className="py-1.5">{a.agence_nom}</td><td className="py-1.5 text-right">{a.nb}</td></tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <p className="mb-2 text-sm font-semibold text-ardoise-900">Classement des commerciaux</p>
                    <table className="w-full text-left text-sm">
                        <thead><tr className="border-b border-ardoise-100 text-xs uppercase tracking-wide text-ardoise-500"><th className="py-2">Rang</th><th className="py-2">Commercial</th><th className="py-2 text-right">{estEnrolement ? 'Enrôlements' : 'Ventes'}</th></tr></thead>
                        <tbody className="divide-y divide-ardoise-100">
                            {classement.length === 0 ? (
                                <tr><td colSpan={3} className="py-3 text-center text-ardoise-500">{estEnrolement ? 'Aucun enrôlement' : 'Aucune vente'} sur la période</td></tr>
                            ) : (
                                classement.map((c) => (
                                    <tr key={c.user_name}>
                                        <td className="py-2">{c.rang === 1 ? <Badge tone="amber">Top 1</Badge> : c.rang === 2 ? <Badge>Top 2</Badge> : c.rang}</td>
                                        <td className="py-2 text-ardoise-900">{c.user_name}</td>
                                        <td className="py-2 text-right">{c.total_ventes}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </CardBody>
            </Card>

            {/* Prime « meilleur vendeur » : notion propre aux campagnes de vente. */}
            {!estEnrolement && primes.length > 0 && (
                <Card className="overflow-hidden">
                    <CardHeader><CardTitle>Primes versées</CardTitle></CardHeader>
                    <table className="w-full text-left text-sm">
                        <thead><tr className="border-b border-ardoise-100 text-xs uppercase tracking-wide text-ardoise-500"><th className="px-4 py-2.5">Période</th><th className="px-4 py-2.5">Commercial</th><th className="px-4 py-2.5">Rang</th><th className="px-4 py-2.5 text-right">Montant</th></tr></thead>
                        <tbody className="divide-y divide-ardoise-100">
                            {primes.map((p, i) => (
                                <tr key={i}>
                                    <td className="px-4 py-2.5 text-ardoise-600">{p.periode}</td>
                                    <td className="px-4 py-2.5 text-ardoise-900">{p.user_name}</td>
                                    <td className="px-4 py-2.5 text-ardoise-600">{p.rang}</td>
                                    <td className="px-4 py-2.5 text-right">{p.montant} F</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Card>
            )}
        </div>
    );
}
