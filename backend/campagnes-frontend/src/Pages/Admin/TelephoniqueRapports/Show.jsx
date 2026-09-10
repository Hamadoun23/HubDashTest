import { Head } from '@inertiajs/react';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardHeader, CardTitle, CardBody } from '@/Components/ui/Card';
import Button from '@/Components/ui/Button';

function Field({ label, children }) {
    return (
        <div>
            <p className="text-xs text-ardoise-500">{label}</p>
            <p className="mt-0.5 font-medium text-ardoise-900">{children ?? '—'}</p>
        </div>
    );
}

export default function TelephoniqueRapportShow({ rapport: r, backUrl }) {
    return (
        <AppLayout
            title={`Détail fiche — ${r.user_nom}`}
            actions={<Button href={backUrl || route('admin.telephonique-rapports.index')} variant="outline" size="sm"><ArrowLeft size={14} /> Liste</Button>}
        >
            <Head title="Fiche reporting téléphonique" />

            {!r.coherent && (
                <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                    Incohérence : la somme des motifs non-joignables ({r.somme_nj_motifs}) dépasse le non joignable enregistré ({r.appels_non_joignables}).
                </div>
            )}

            <div className="space-y-4">
                <Card>
                    <CardHeader><CardTitle>1. Identification</CardTitle></CardHeader>
                    <CardBody className="grid gap-4 sm:grid-cols-4">
                        <Field label="Date rapport">{r.date_rapport}</Field>
                        <Field label="Campagne">{r.campagne_nom ?? '— (non rattachée)'}</Field>
                        <Field label="Agence">{r.agence_nom}</Field>
                        <Field label="Créé le">{r.created_at}</Field>
                    </CardBody>
                </Card>

                <Card>
                    <CardHeader><CardTitle>2. Activité journalière</CardTitle></CardHeader>
                    <CardBody className="grid gap-4 sm:grid-cols-4">
                        <Field label="Appels émis">{r.appels_emis}</Field>
                        <Field label="Joignables">{r.appels_joignables}</Field>
                        <Field label="Non joignables">
                            {r.appels_non_joignables} <span className="text-xs font-normal text-ardoise-400">(calculé : {r.appels_non_joignables_calcule})</span>
                        </Field>
                        <Field label="Taux joignabilité">{r.taux_joignabilite}</Field>
                    </CardBody>
                </Card>

                <Card>
                    <CardHeader><CardTitle>3. Résultats des appels</CardTitle></CardHeader>
                    <CardBody className="grid gap-4 sm:grid-cols-2">
                        <Field label="Clients intéressés (nombre)">{r.clients_interesses_nombre}</Field>
                        <Field label="Clients intéressés %">{r.clients_interesses_pct}</Field>
                        <Field label="Clients déjà servis (nombre)">{r.clients_deja_servis_nombre}</Field>
                        <Field label="Clients déjà servis %">{r.clients_deja_servis_pct}</Field>
                    </CardBody>
                </Card>

                <Card>
                    <CardHeader><CardTitle>4. Types de carte proposées</CardTitle></CardHeader>
                    <CardBody className="p-0">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-ardoise-100 text-xs uppercase tracking-wide text-ardoise-500">
                                    <th className="px-5 py-2.5 text-left font-medium">Type</th>
                                    <th className="px-5 py-2.5 text-right font-medium">Quantité</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-ardoise-100">
                                {r.cartes.length === 0 ? (
                                    <tr><td colSpan={2} className="px-5 py-3 text-ardoise-400">Aucune donnée</td></tr>
                                ) : (
                                    r.cartes.map((c) => (
                                        <tr key={c.code}>
                                            <td className="px-5 py-2.5">{c.code}</td>
                                            <td className="px-5 py-2.5 text-right">{c.quantite}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                        <p className="border-t border-ardoise-100 px-5 py-2.5 text-xs text-ardoise-500">Résumé : {r.cartes_resume}</p>
                    </CardBody>
                </Card>

                <Card>
                    <CardHeader><CardTitle>5. Non joignables — analyse</CardTitle></CardHeader>
                    <CardBody>
                        <div className="grid gap-4 sm:grid-cols-4">
                            <Field label="Répondeur">{r.nj_repondeur}</Field>
                            <Field label="N° erroné">{r.nj_numero_errone}</Field>
                            <Field label="Hors réseau">{r.nj_hors_reseau}</Field>
                            <Field label="Autres (nb)">{r.nj_autres_nombre}</Field>
                        </div>
                        <div className="mt-4 border-t border-ardoise-100 pt-4">
                            <Field label="Autres — précision">{r.nj_autres_precision}</Field>
                        </div>
                        <p className="mt-3 text-xs text-ardoise-500">
                            Somme motifs : <strong>{r.somme_nj_motifs}</strong> / plafond non-joignables <strong>{r.appels_non_joignables}</strong>
                        </p>
                    </CardBody>
                </Card>
            </div>
        </AppLayout>
    );
}
