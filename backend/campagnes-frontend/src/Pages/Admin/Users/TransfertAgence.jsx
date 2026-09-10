import { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardHeader, CardTitle, CardBody } from '@/Components/ui/Card';
import Badge from '@/Components/ui/Badge';
import Button from '@/Components/ui/Button';
import { Input, Label, Textarea } from '@/Components/ui/Input';
import { Select } from '@/Components/ui/Select';
import Checkbox from '@/Components/ui/Checkbox';
import Pagination from '@/Components/ui/Pagination';

export default function TransfertAgence({ user, ventes, campagnes, agences, returnCampagne, modeProfil, filters, qFilters }) {
    const [du, setDu] = useState(filters.du);
    const [au, setAu] = useState(filters.au);
    const [campagneId, setCampagneId] = useState(filters.campagne_id);
    const [agenceId, setAgenceId] = useState(filters.agence_id);

    const [selected, setSelected] = useState([]);
    const [agenceCibleId, setAgenceCibleId] = useState('');
    const [note, setNote] = useState('');
    const [majProfil, setMajProfil] = useState(modeProfil);
    const [error, setError] = useState('');

    function applyFilters(e) {
        e.preventDefault();
        router.get(route('admin.users.transfert-agence', user.id), {
            ...qFilters, du, au, campagne_id: campagneId, agence_id: agenceId,
        }, { preserveState: true });
    }

    function toggleAll(e) {
        setSelected(e.target.checked ? ventes.data.map((v) => v.id) : []);
    }

    function toggleOne(id, checked) {
        setSelected((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)));
    }

    function submit(e) {
        e.preventDefault();
        if (selected.length === 0 && !majProfil) {
            setError('Cochez « Mettre à jour l’agence du profil » et/ou sélectionnez des ventes à réattribuer.');
            return;
        }
        const msg = majProfil && selected.length === 0
            ? 'Confirmer le changement d’agence du profil ? Les ventes existantes ne seront pas modifiées.'
            : 'Confirmer le transfert (profil et/ou ventes cochées) ?';
        if (!confirm(msg)) return;

        router.post(route('admin.users.transfert-agence.apply', user.id), {
            ...qFilters,
            agence_cible_id: agenceCibleId,
            vente_ids: selected,
            note,
            maj_profil: majProfil,
        });
    }

    return (
        <AppLayout
            title={`Transfert d'agence — ${user.nom_complet}`}
            subtitle={`Agence actuelle du profil : ${user.agence_nom ?? '—'}`}
            actions={
                <div className="flex items-center gap-2">
                    {returnCampagne && (
                        <Button href={route('admin.campagnes.show', { campagne: returnCampagne.id, tab: 'commerciaux' })} variant="outline" size="sm">
                            <ArrowLeft size={14} /> Retour campagne
                        </Button>
                    )}
                    <Button href={route('admin.users.edit', user.id)} variant="outline" size="sm">Fiche utilisateur</Button>
                </div>
            }
        >
            <Head title={`Transfert d'agence — ${user.nom_complet}`} />

            {returnCampagne && (
                <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                    <strong>Changement d’agence (cas le plus fréquent)</strong> — cochez uniquement « Mettre à jour l’agence du profil »,
                    choisissez la nouvelle agence, <em>sans</em> cocher de ventes. Les ventes déjà enregistrées restent rattachées à leur
                    agence d’origine ; seules les <strong>prochaines ventes</strong> utiliseront la nouvelle agence.
                </div>
            )}

            <Card className="mb-4">
                <CardHeader><CardTitle>Filtres (liste des ventes)</CardTitle></CardHeader>
                <CardBody>
                    <form onSubmit={applyFilters} className="flex flex-wrap items-end gap-3">
                        <div>
                            <Label htmlFor="f_du">Du</Label>
                            <Input id="f_du" type="date" value={du} onChange={(e) => setDu(e.target.value)} />
                        </div>
                        <div>
                            <Label htmlFor="f_au">Au</Label>
                            <Input id="f_au" type="date" value={au} onChange={(e) => setAu(e.target.value)} />
                        </div>
                        <div className="w-56">
                            <Label htmlFor="f_campagne">Campagne</Label>
                            <Select id="f_campagne" value={campagneId} onChange={(e) => setCampagneId(e.target.value)}>
                                <option value="">— Toutes —</option>
                                {campagnes.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
                            </Select>
                        </div>
                        <div className="w-56">
                            <Label htmlFor="f_agence">Agence (sur la vente)</Label>
                            <Select id="f_agence" value={agenceId} onChange={(e) => setAgenceId(e.target.value)}>
                                <option value="">— Toutes —</option>
                                {agences.map((a) => <option key={a.id} value={a.id}>{a.nom}</option>)}
                            </Select>
                        </div>
                        <Button type="submit" size="sm">Filtrer</Button>
                    </form>
                </CardBody>
            </Card>

            <form onSubmit={submit}>
                <Card className="mb-4 overflow-hidden">
                    <CardHeader>
                        <CardTitle>Ventes existantes</CardTitle>
                        <span className="text-sm text-ardoise-500">({ventes.total} au total sur les filtres) — cochez seulement si vous voulez aussi déplacer l’historique</span>
                    </CardHeader>

                    {error && <div className="mx-4 mb-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-ardoise-100 text-xs uppercase tracking-wide text-ardoise-500">
                                    <th className="px-4 py-2.5">
                                        <input type="checkbox" onChange={toggleAll} checked={selected.length > 0 && selected.length === ventes.data.length} title="Tout sélectionner sur cette page" />
                                    </th>
                                    <th className="px-4 py-2.5 font-medium">Date</th>
                                    <th className="px-4 py-2.5 font-medium">Campagne</th>
                                    <th className="px-4 py-2.5 font-medium">Type</th>
                                    <th className="px-4 py-2.5 font-medium">Agence (vente — figée)</th>
                                    <th className="px-4 py-2.5 text-right font-medium">#</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-ardoise-100">
                                {ventes.data.length === 0 ? (
                                    <tr><td colSpan={6} className="px-4 py-6 text-center text-ardoise-500">Aucune vente pour ces filtres.</td></tr>
                                ) : (
                                    ventes.data.map((v) => (
                                        <tr key={v.id} className="hover:bg-ardoise-50">
                                            <td className="px-4 py-2.5">
                                                <input type="checkbox" className="vente-cb" checked={selected.includes(v.id)} onChange={(e) => toggleOne(v.id, e.target.checked)} />
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-2.5 text-ardoise-600">{v.date}</td>
                                            <td className="px-4 py-2.5 text-ardoise-900">{v.campagne_nom ?? '—'}</td>
                                            <td className="px-4 py-2.5"><Badge>{v.type_carte_code ?? '—'}</Badge></td>
                                            <td className="px-4 py-2.5 text-ardoise-600">{v.agence_nom ?? '—'}</td>
                                            <td className="px-4 py-2.5 text-right text-xs text-ardoise-400">{v.id}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    <Pagination links={ventes.links} from={ventes.from} to={ventes.to} total={ventes.total} />
                </Card>

                <Card>
                    <CardBody>
                        <div className="mb-4 grid gap-4 sm:grid-cols-2">
                            <div>
                                <Label htmlFor="agence_cible_id">Nouvelle agence *</Label>
                                <Select id="agence_cible_id" value={agenceCibleId} onChange={(e) => setAgenceCibleId(e.target.value)} required>
                                    <option value="">— Choisir —</option>
                                    {agences.map((a) => <option key={a.id} value={a.id}>{a.nom}</option>)}
                                </Select>
                            </div>
                            <div>
                                <Label htmlFor="note">Note (journal interne)</Label>
                                <Textarea id="note" rows={2} maxLength={2000} placeholder="Optionnel" value={note} onChange={(e) => setNote(e.target.value)} />
                            </div>
                        </div>
                        <Checkbox id="maj_profil" checked={majProfil} onChange={(e) => setMajProfil(e.target.checked)} label={<><strong>Mettre à jour l’agence du profil</strong> (prochaines ventes)</>} />
                        <p className="mb-0 mt-2 text-sm text-ardoise-500">
                            Laissez les ventes <em>non cochées</em> pour conserver l’historique sur l’ancienne agence.
                            Cochez des ventes uniquement si vous souhaitez aussi corriger rétroactivement leur agence.
                        </p>
                        <div className="mt-4">
                            <Button type="submit">Appliquer le transfert</Button>
                        </div>
                    </CardBody>
                </Card>
            </form>
        </AppLayout>
    );
}
