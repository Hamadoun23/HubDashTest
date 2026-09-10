import { Card, CardHeader, CardTitle, CardBody } from '@/Components/ui/Card';
import Badge from '@/Components/ui/Badge';

const actionTone = { arreter: 'amber', annuler: 'red' };
const actionLabel = { arreter: 'Arrêt', annuler: 'Annulation', reprogrammer: 'Reprogrammation' };

export default function Historique({ campagne }) {
    return (
        <Card>
            <CardHeader><CardTitle>Historique des actions</CardTitle></CardHeader>
            <CardBody>
                <p className="mb-3 text-sm text-ardoise-500">Arrêts, annulations et reprogrammations documentés avec justification.</p>
                {campagne.actions.length === 0 ? (
                    <p className="text-sm text-ardoise-500">Aucune action enregistrée.</p>
                ) : (
                    <ul className="divide-y divide-ardoise-100">
                        {campagne.actions.map((a) => (
                            <li key={a.id} className="py-3">
                                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                                    <Badge tone={actionTone[a.action] ?? 'neutral'}>{actionLabel[a.action] ?? a.action}</Badge>
                                    <span className="text-xs text-ardoise-400">{a.created_at}</span>
                                    {a.user_name && <span className="text-xs text-ardoise-400">par {a.user_name}</span>}
                                </div>
                                <p className="mb-1 border-l-2 border-ardoise-100 pl-2 text-sm text-ardoise-700">{a.description}</p>
                                {a.action === 'reprogrammer' && a.avant && a.apres && (
                                    <div className="grid gap-1 text-xs text-ardoise-400 sm:grid-cols-2">
                                        <div>Avant : {a.avant.date_debut ?? '—'} → {a.avant.date_fin ?? '—'}</div>
                                        <div>Après : {a.apres.date_debut ?? '—'} → {a.apres.date_fin ?? '—'}</div>
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </CardBody>
        </Card>
    );
}
