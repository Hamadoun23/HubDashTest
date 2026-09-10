import { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import { Search } from 'lucide-react';
import AppLayout from '@/Layouts/AppLayout';
import { Card } from '@/Components/ui/Card';
import Badge from '@/Components/ui/Badge';
import Button from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { Select } from '@/Components/ui/Select';
import Pagination from '@/Components/ui/Pagination';

export default function LoginLogsIndex({ logs, utilisateurs, filters }) {
    const [userId, setUserId] = useState(filters.user_id ?? '');
    const [dateDebut, setDateDebut] = useState(filters.date_debut ?? '');
    const [dateFin, setDateFin] = useState(filters.date_fin ?? '');

    function applyFilters(e) {
        e.preventDefault();
        router.get(route('admin.login-logs.index'), { user_id: userId, date_debut: dateDebut, date_fin: dateFin }, { preserveState: true });
    }

    function reset() {
        setUserId(''); setDateDebut(''); setDateFin('');
        router.get(route('admin.login-logs.index'));
    }

    const hasFilters = filters.user_id || filters.date_debut || filters.date_fin;

    return (
        <AppLayout title="Journal des connexions" subtitle="Chaque ligne correspond à une authentification réussie (tous rôles)">
            <Head title="Journal des connexions" />

            <form onSubmit={applyFilters} className="mb-4 flex flex-wrap items-end gap-3">
                <div className="w-full max-w-xs">
                    <label className="mb-1.5 block text-xs font-medium text-ardoise-500">Utilisateur</label>
                    <Select value={userId} onChange={(e) => setUserId(e.target.value)}>
                        <option value="">— Tous —</option>
                        {utilisateurs.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
                    </Select>
                </div>
                <div>
                    <label className="mb-1.5 block text-xs font-medium text-ardoise-500">Du</label>
                    <Input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} />
                </div>
                <div>
                    <label className="mb-1.5 block text-xs font-medium text-ardoise-500">Au</label>
                    <Input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} />
                </div>
                <Button type="submit" variant="outline"><Search size={14} /> Filtrer</Button>
                {hasFilters && <Button type="button" variant="ghost" onClick={reset}>Réinitialiser</Button>}
            </form>

            <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-ardoise-100 text-xs uppercase tracking-wide text-ardoise-500">
                                <th className="px-5 py-3 font-medium">Date / heure</th>
                                <th className="px-5 py-3 font-medium">Utilisateur</th>
                                <th className="px-5 py-3 font-medium">Rôle</th>
                                <th className="px-5 py-3 font-medium">IP</th>
                                <th className="px-5 py-3 font-medium">Navigateur</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-ardoise-100">
                            {logs.data.map((log) => (
                                <tr key={log.id} className="hover:bg-ardoise-50">
                                    <td className="whitespace-nowrap px-5 py-3 text-ardoise-600">{log.date}</td>
                                    <td className="px-5 py-3 font-medium text-ardoise-900">{log.user_nom}</td>
                                    <td className="px-5 py-3"><Badge>{log.role}</Badge></td>
                                    <td className="px-5 py-3 text-ardoise-500">{log.ip ?? '—'}</td>
                                    <td className="max-w-xs truncate px-5 py-3 text-xs text-ardoise-500" title={log.user_agent_full}>{log.user_agent}</td>
                                </tr>
                            ))}
                            {logs.data.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-5 py-8 text-center text-ardoise-500">Aucune entrée.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <Pagination links={logs.links} from={logs.from} to={logs.to} total={logs.total} />
            </Card>
        </AppLayout>
    );
}
