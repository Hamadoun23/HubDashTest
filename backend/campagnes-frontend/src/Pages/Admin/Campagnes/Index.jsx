import { useState } from 'react';
import { Head, router, useForm } from '@inertiajs/react';
import { Plus, Pause, XCircle, CalendarClock, Eye, Pencil, Trash2 } from 'lucide-react';
import AppLayout from '@/Layouts/AppLayout';
import Badge from '@/Components/ui/Badge';
import Button from '@/Components/ui/Button';
import Modal from '@/Components/ui/Modal';
import Pagination from '@/Components/ui/Pagination';
import { Label, Textarea, Input, FieldError } from '@/Components/ui/Input';
import { Table, TableHead, TableBody } from '@/Components/ui/Table';

const statutTones = {
    en_cours: 'green',
    programmee: 'blue',
    arretee: 'amber',
    annulee: 'red',
    terminee: 'neutral',
};

const statutLabels = {
    en_cours: 'En cours',
    programmee: 'Programmée',
    arretee: 'Arrêtée',
    annulee: 'Annulée',
    terminee: 'Terminée',
};

function ActionModal({ modal, onClose }) {
    const isReprogrammer = modal?.type === 'reprogrammer';
    const { data, setData, post, processing, errors, reset } = useForm({
        description: '',
        date_debut: modal?.campagne?.date_debut_iso ?? '',
        date_fin: modal?.campagne?.date_fin_iso ?? '',
    });

    if (!modal) return null;

    const routes = {
        arreter: 'admin.campagnes.arreter',
        annuler: 'admin.campagnes.annuler',
        reprogrammer: 'admin.campagnes.reprogrammer',
    };
    const titles = {
        arreter: `Arrêter la campagne « ${modal.campagne.nom} »`,
        annuler: `Annuler la campagne « ${modal.campagne.nom} »`,
        reprogrammer: `Reprogrammer « ${modal.campagne.nom} »`,
    };
    const confirmLabel = {
        arreter: 'Arrêter la campagne',
        annuler: 'Annuler la campagne',
        reprogrammer: 'Reprogrammer',
    };

    function submit(e) {
        e.preventDefault();
        post(route(routes[modal.type], modal.campagne.id), {
            onSuccess: () => {
                reset();
                onClose();
            },
        });
    }

    return (
        <Modal open onClose={onClose} title={titles[modal.type]}>
            <form onSubmit={submit} className="space-y-4">
                {isReprogrammer && (
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label htmlFor="date_debut">Nouvelle date début</Label>
                            <Input
                                id="date_debut"
                                type="date"
                                value={data.date_debut}
                                onChange={(e) => setData('date_debut', e.target.value)}
                                error={errors.date_debut}
                            />
                            <FieldError>{errors.date_debut}</FieldError>
                        </div>
                        <div>
                            <Label htmlFor="date_fin">Nouvelle date fin</Label>
                            <Input
                                id="date_fin"
                                type="date"
                                value={data.date_fin}
                                onChange={(e) => setData('date_fin', e.target.value)}
                                error={errors.date_fin}
                            />
                            <FieldError>{errors.date_fin}</FieldError>
                        </div>
                    </div>
                )}
                <div>
                    <Label htmlFor="description">Description (min. 10 caractères)</Label>
                    <Textarea
                        id="description"
                        rows={3}
                        value={data.description}
                        onChange={(e) => setData('description', e.target.value)}
                        error={errors.description}
                        placeholder="Justifiez cette décision…"
                    />
                    <FieldError>{errors.description}</FieldError>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                    <Button type="button" variant="outline" onClick={onClose}>Fermer</Button>
                    <Button
                        type="submit"
                        disabled={processing}
                        variant={modal.type === 'annuler' ? 'destructive' : 'primary'}
                    >
                        {confirmLabel[modal.type]}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}

export default function CampagnesIndex({ campagnes }) {
    const [modal, setModal] = useState(null);

    function destroy(c) {
        if (confirm(`Supprimer la campagne « ${c.nom} » ?`)) {
            router.delete(route('admin.campagnes.destroy', c.id));
        }
    }

    return (
        <AppLayout
            title="Campagnes"
            subtitle="Périodes commerciales, statuts et pilotage"
            actions={<Button href={route('admin.campagnes.create')} size="sm"><Plus size={15} /> Nouvelle campagne</Button>}
        >
            <Head title="Campagnes" />

            <Table
                footer={<Pagination links={campagnes.links} from={campagnes.from} to={campagnes.to} total={campagnes.total} />}
            >
                <TableHead>
                    <tr>
                        <th className="px-5 py-3 font-medium">Nom</th>
                        <th className="px-5 py-3 font-medium">Période</th>
                        <th className="px-5 py-3 font-medium">Prime 1<sup>er</sup></th>
                        <th className="px-5 py-3 font-medium">Statut</th>
                        <th className="px-5 py-3 font-medium">Actions</th>
                    </tr>
                </TableHead>
                <TableBody>
                    {campagnes.data.map((c) => (
                                <tr key={c.id} className="hover:bg-ardoise-50">
                                    <td className="px-5 py-3 font-medium text-ardoise-900">
                                        {c.nom}
                                        {c.estEnrolement && <Badge tone="blue" className="ml-2">Enrôlement</Badge>}
                                    </td>
                                    <td className="px-5 py-3 text-ardoise-600">{c.date_debut} – {c.date_fin}</td>
                                    {/* Prime « meilleur vendeur » : sans objet pour une campagne d'enrôlement. */}
                                    <td className="px-5 py-3 text-ardoise-600">{c.estEnrolement ? '—' : `${c.prime_meilleur_vendeur} F`}</td>
                                    <td className="px-5 py-3">
                                        <Badge tone={statutTones[c.statut]}>{statutLabels[c.statut]}</Badge>
                                    </td>
                                    <td className="px-5 py-3">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            {c.peut_piloter && (
                                                <>
                                                    <button title="Arrêter" onClick={() => setModal({ type: 'arreter', campagne: c })} className="rounded-md p-1.5 text-amber-600 hover:bg-amber-50">
                                                        <Pause size={15} />
                                                    </button>
                                                    <button title="Annuler" onClick={() => setModal({ type: 'annuler', campagne: c })} className="rounded-md p-1.5 text-red-600 hover:bg-red-50">
                                                        <XCircle size={15} />
                                                    </button>
                                                    <button title="Reprogrammer" onClick={() => setModal({ type: 'reprogrammer', campagne: c })} className="rounded-md p-1.5 text-ardoise-500 hover:bg-ardoise-100">
                                                        <CalendarClock size={15} />
                                                    </button>
                                                </>
                                            )}
                                            <Button href={route('admin.campagnes.show', c.id)} variant="ghost" size="sm" title="Détail">
                                                <Eye size={15} />
                                            </Button>
                                            <Button href={route('admin.campagnes.edit', c.id)} variant="ghost" size="sm" title="Modifier">
                                                <Pencil size={15} />
                                            </Button>
                                            <button title="Supprimer" onClick={() => destroy(c)} className="rounded-md p-1.5 text-red-600 hover:bg-red-50">
                                                <Trash2 size={15} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                    {campagnes.data.length === 0 && (
                        <tr>
                            <td colSpan={5} className="px-5 py-8 text-center text-ardoise-500">Aucune campagne.</td>
                        </tr>
                    )}
                </TableBody>
            </Table>

            <ActionModal
                key={modal ? `${modal.type}-${modal.campagne.id}` : 'none'}
                modal={modal}
                onClose={() => setModal(null)}
            />
        </AppLayout>
    );
}
