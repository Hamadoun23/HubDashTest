import { useForm, router } from '@inertiajs/react';
import { Card, CardHeader, CardTitle, CardBody } from '@/Components/ui/Card';
import { Input, Label } from '@/Components/ui/Input';
import { Select } from '@/Components/ui/Select';
import Badge from '@/Components/ui/Badge';
import Button from '@/Components/ui/Button';

export default function Aide({ campagne, isDirectionDetail }) {
    const { data, setData, post, processing, reset } = useForm({
        user_id: '',
        semaine_debut: '',
        montant_carburant: campagne.aide_hebdo_carburant,
        montant_credit_tel: campagne.aide_hebdo_credit_tel,
    });

    function submit(e) {
        e.preventDefault();
        post(route('admin.campagnes.versements.store', campagne.id), { onSuccess: () => reset('user_id', 'semaine_debut') });
    }

    function destroy(id) {
        if (confirm('Supprimer ce versement ?')) {
            router.delete(route('admin.campagnes.versements.destroy', [campagne.id, id]));
        }
    }

    if (!campagne.aide_hebdo_active) {
        return (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                L'aide hebdomadaire n'est pas activée pour cette campagne.
                {!isDirectionDetail && (
                    <> <a href={route('admin.campagnes.edit', campagne.id)} className="underline">Activer dans les paramètres</a>.</>
                )}
            </div>
        );
    }

    return (
        <Card className="overflow-hidden">
            <CardHeader><CardTitle>Versements aide hebdo — accusés de réception</CardTitle></CardHeader>
            <CardBody>
                <p className="mb-4 text-sm text-ardoise-500">
                    Montants par défaut : carburant {campagne.aide_hebdo_carburant} F + crédit {campagne.aide_hebdo_credit_tel} F = {campagne.aide_hebdo_montant} F / semaine.
                </p>

                {!isDirectionDetail && (
                    <form onSubmit={submit} className="mb-4 flex flex-wrap items-end gap-3">
                        <div className="w-56">
                            <Label htmlFor="aide_user_id">Commercial</Label>
                            <Select id="aide_user_id" value={data.user_id} onChange={(e) => setData('user_id', e.target.value)} required>
                                <option value="">—</option>
                                {campagne.signataires_pour_versement.map((u) => <option key={u.id} value={u.id}>{u.nom}</option>)}
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="aide_semaine">Semaine (lundi)</Label>
                            <Input id="aide_semaine" type="date" value={data.semaine_debut} onChange={(e) => setData('semaine_debut', e.target.value)} required />
                        </div>
                        <div className="w-32">
                            <Label htmlFor="aide_carburant">Carburant (F)</Label>
                            <Input id="aide_carburant" type="number" min={0} value={data.montant_carburant} onChange={(e) => setData('montant_carburant', e.target.value)} required />
                        </div>
                        <div className="w-32">
                            <Label htmlFor="aide_credit">Crédit tel. (F)</Label>
                            <Input id="aide_credit" type="number" min={0} value={data.montant_credit_tel} onChange={(e) => setData('montant_credit_tel', e.target.value)} required />
                        </div>
                        <Button type="submit" size="sm" disabled={processing}>Enregistrer</Button>
                    </form>
                )}

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-ardoise-100 text-xs uppercase tracking-wide text-ardoise-500">
                                <th className="py-2 pr-4 font-medium">Semaine</th>
                                <th className="py-2 pr-4 font-medium">Commercial</th>
                                <th className="py-2 pr-4 font-medium">Carburant</th>
                                <th className="py-2 pr-4 font-medium">Crédit</th>
                                <th className="py-2 pr-4 font-medium">Accusé</th>
                                {!isDirectionDetail && <th className="py-2"></th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-ardoise-100">
                            {campagne.aide_versements.length === 0 ? (
                                <tr><td colSpan={isDirectionDetail ? 5 : 6} className="py-3 text-ardoise-500">Aucun versement.</td></tr>
                            ) : (
                                campagne.aide_versements.map((v) => (
                                    <tr key={v.id}>
                                        <td className="py-2 pr-4 text-ardoise-600">{v.semaine_debut}</td>
                                        <td className="py-2 pr-4 text-ardoise-900">{v.user_name}</td>
                                        <td className="py-2 pr-4 text-ardoise-600">{v.montant_carburant}</td>
                                        <td className="py-2 pr-4 text-ardoise-600">{v.montant_credit_tel}</td>
                                        <td className="py-2 pr-4">
                                            {v.accuse_at ? <Badge tone="green">{v.accuse_at}</Badge> : <Badge tone="amber">En attente</Badge>}
                                        </td>
                                        {!isDirectionDetail && (
                                            <td className="py-2">
                                                {!v.accuse_at && <Button variant="destructive" size="sm" onClick={() => destroy(v.id)}>Suppr.</Button>}
                                            </td>
                                        )}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </CardBody>
        </Card>
    );
}
