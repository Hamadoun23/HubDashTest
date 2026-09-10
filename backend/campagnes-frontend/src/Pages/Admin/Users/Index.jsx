import { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import AppLayout from '@/Layouts/AppLayout';
import Badge from '@/Components/ui/Badge';
import Button from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { Select } from '@/Components/ui/Select';
import Pagination from '@/Components/ui/Pagination';
import { Table, TableHead, TableBody } from '@/Components/ui/Table';

const roleBadge = {
    direction: { label: 'direction', tone: 'neutral' },
    commercial_telephonique: { label: 'téléphonique', tone: 'blue' },
    commercial: { label: 'terrain', tone: 'green' },
};

const contratBadge = {
    accepte: { label: 'Accepté', tone: 'green' },
    rejete: { label: 'Refusé', tone: 'red' },
    en_attente: { label: 'En attente', tone: 'amber' },
    non_signataire: { label: 'Non concerné', tone: 'neutral' },
};

export default function UsersIndex({ users, filters, aDesAgences = true }) {
    const [q, setQ] = useState(filters.q ?? '');
    const [role, setRole] = useState(filters.role ?? '');
    const [contrat, setContrat] = useState(filters.contrat ?? '');

    function applyFilters(e) {
        e.preventDefault();
        router.get(route('admin.users.index'), { q, role, contrat }, { preserveState: true });
    }

    function reset() {
        setQ(''); setRole(''); setContrat('');
        router.get(route('admin.users.index'));
    }

    function destroy(u) {
        if (confirm(`Supprimer l'utilisateur « ${u.nom_complet} » ?`)) {
            router.delete(route('admin.users.destroy', u.id));
        }
    }

    const hasFilters = filters.q || filters.role || filters.contrat;

    return (
        <AppLayout
            title="Utilisateurs"
            subtitle="Commerciaux, téléopératrices & direction"
            actions={<Button href={route('admin.users.create')} size="sm"><Plus size={15} /> Nouvel utilisateur</Button>}
        >
            <Head title="Utilisateurs" />

            <form onSubmit={applyFilters} className="mb-4 flex flex-wrap items-end gap-3">
                <div className="w-full max-w-xs">
                    <label className="mb-1.5 block text-xs font-medium text-ardoise-500">Recherche</label>
                    <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom, prénom, téléphone…" />
                </div>
                <div className="w-44">
                    <label className="mb-1.5 block text-xs font-medium text-ardoise-500">Rôle</label>
                    <Select value={role} onChange={(e) => setRole(e.target.value)}>
                        <option value="">Tous</option>
                        <option value="commercial">Commercial terrain</option>
                        <option value="commercial_telephonique">Commercial téléphonique</option>
                        <option value="direction">Direction</option>
                    </Select>
                </div>
                <div className="w-48">
                    <label className="mb-1.5 block text-xs font-medium text-ardoise-500">Contrat (campagne active)</label>
                    <Select value={contrat} onChange={(e) => setContrat(e.target.value)}>
                        <option value="">—</option>
                        <option value="accepte">Accepté</option>
                        <option value="en_attente">En attente</option>
                        <option value="rejete">Refusé</option>
                        <option value="non_signataire">Non signataire / sans campagne</option>
                    </Select>
                </div>
                <Button type="submit" variant="outline"><Search size={14} /> Filtrer</Button>
                {hasFilters && <Button type="button" variant="ghost" onClick={reset}>Réinitialiser</Button>}
            </form>

            <Table
                footer={<Pagination links={users.links} from={users.from} to={users.to} total={users.total} />}
            >
                <TableHead>
                    <tr>
                        <th className="px-5 py-3 font-medium">Nom</th>
                        <th className="px-5 py-3 font-medium">Téléphone / e-mail</th>
                        <th className="px-5 py-3 font-medium">Rôle</th>
                        <th className="px-5 py-3 font-medium">Contrat</th>
                        <th className="px-5 py-3 font-medium">Statut</th>
                        {aDesAgences && <th className="px-5 py-3 font-medium">Agence</th>}
                        <th className="px-5 py-3 text-right font-medium">Actions</th>
                    </tr>
                </TableHead>
                <TableBody>
                    {users.data.map((u) => {
                                const rb = roleBadge[u.role] ?? roleBadge.commercial;
                                const cb = u.contrat_statut ? contratBadge[u.contrat_statut] : null;
                                return (
                                    <tr key={u.id} className="hover:bg-ardoise-50">
                                        <td className="px-5 py-3 font-medium text-ardoise-900">{u.nom_complet}</td>
                                        <td className="px-5 py-3 text-ardoise-600">
                                            {u.telephone}
                                            {u.email && <div className="text-xs text-ardoise-400">{u.email}</div>}
                                            {!u.telephone && !u.email && '—'}
                                        </td>
                                        <td className="px-5 py-3"><Badge tone={rb.tone}>{rb.label}</Badge></td>
                                        <td className="px-5 py-3">{cb ? <Badge tone={cb.tone}>{cb.label}</Badge> : <span className="text-ardoise-300">—</span>}</td>
                                        <td className="px-5 py-3"><Badge tone={u.actif ? 'green' : 'neutral'}>{u.actif ? 'Actif' : 'Désactivé'}</Badge></td>
                                        {aDesAgences && <td className="px-5 py-3 text-ardoise-600">{u.agence_nom ?? '—'}</td>}
                                        <td className="px-5 py-3">
                                            <div className="flex justify-end gap-1.5">
                                                <Button href={route('admin.users.edit', u.id)} variant="ghost" size="sm" title="Modifier">
                                                    <Pencil size={15} />
                                                </Button>
                                                {!u.is_self && (
                                                    <button title="Supprimer" onClick={() => destroy(u)} className="rounded-md p-1.5 text-red-600 hover:bg-red-50">
                                                        <Trash2 size={15} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                    {users.data.length === 0 && (
                        <tr>
                            <td colSpan={7} className="px-5 py-8 text-center text-ardoise-500">Aucun utilisateur.</td>
                        </tr>
                    )}
                </TableBody>
            </Table>
        </AppLayout>
    );
}
