import { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import { CheckCircle2, XCircle } from 'lucide-react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardBody } from '@/Components/ui/Card';
import Badge from '@/Components/ui/Badge';
import Button from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import ContratDocument from './ContratDocument';

export default function ContratShow({ campagne, user, reponse, verrou5j, peutRepondre, echeance, document, versements }) {
    function accepter() {
        router.post(route('commercial.contrat.accepter'));
    }

    function rejeter() {
        if (confirm('Confirmer le refus du contrat ?')) {
            router.post(route('commercial.contrat.rejeter'));
        }
    }

    return (
        <AppLayout title="Mon contrat de prestation" subtitle={`${campagne.nom} · ${campagne.date_debut} → ${campagne.date_fin}`}>
            <Head title="Mon contrat" />

            {!campagne.contrat_publie_at ? (
                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    Le contrat n'a pas encore été publié. Revenez plus tard ou contactez l'administration.
                </div>
            ) : echeance && (
                <p className="mb-4 text-sm text-ardoise-500">
                    Date limite pour accepter ou refuser : <strong>{echeance}</strong> (5 jours après publication).
                </p>
            )}

            <Card className="mb-4 bg-ardoise-50">
                <CardBody>
                    <p className="mb-2 text-sm font-semibold text-ardoise-700">Vos informations pour le contrat (complétez avec l'admin si besoin)</p>
                    <ul className="space-y-1 text-sm text-ardoise-600">
                        <li>Domicile / adresse : {user.adresse_contrat || "— (à renseigner avec l'admin)"}</li>
                        <li>Pièce d'identité (réf.) : {user.piece_identite_ref || '—'}</li>
                    </ul>
                </CardBody>
            </Card>

            <Card className={`mb-4 ${verrou5j && reponse.statut === 'en_attente' ? 'opacity-50' : ''}`}>
                <CardBody className="max-h-[32rem] overflow-y-auto">
                    <ContratDocument d={document} />
                </CardBody>
            </Card>

            <div className="mb-6">
                {reponse.statut === 'accepte' && (
                    <p className="mb-3 flex items-center gap-1.5 font-semibold text-green-700">
                        <CheckCircle2 size={16} /> Vous avez accepté ce contrat le {reponse.repondu_at}.
                    </p>
                )}
                {reponse.statut === 'rejete' && (
                    <p className="mb-3 flex items-center gap-1.5 font-semibold text-red-700">
                        <XCircle size={16} /> Vous avez refusé ce contrat le {reponse.repondu_at}.
                    </p>
                )}
                {verrou5j && reponse.statut === 'en_attente' && (
                    <p className="mb-3 font-semibold text-ardoise-500">Délai de 5 jours dépassé — vous ne pouvez plus accepter ou refuser en ligne.</p>
                )}

                {peutRepondre && (
                    <div className="flex gap-2">
                        <Button onClick={accepter}>J'accepte le contrat</Button>
                        <Button onClick={rejeter} variant="destructive">Je refuse</Button>
                    </div>
                )}
            </div>

            {campagne.aide_hebdo_active && versements.length > 0 && (
                <>
                    <h3 className="mb-1 text-base font-semibold text-ardoise-900">Mes versements aide (carburant / crédit téléphonique)</h3>
                    <p className="mb-3 text-sm text-ardoise-500">Confirmez la réception après chaque versement enregistré par l'administration.</p>
                    <Card className="overflow-hidden">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-ardoise-100 text-xs uppercase tracking-wide text-ardoise-500">
                                    <th className="px-5 py-3 font-medium">Semaine</th>
                                    <th className="px-5 py-3 font-medium">Carburant</th>
                                    <th className="px-5 py-3 font-medium">Crédit tel.</th>
                                    <th className="px-5 py-3 font-medium">Statut</th>
                                    <th className="px-5 py-3 font-medium"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-ardoise-100">
                                {versements.map((v) => (
                                    <VersementRow key={v.id} v={v} />
                                ))}
                            </tbody>
                        </table>
                    </Card>
                </>
            )}
        </AppLayout>
    );
}

function VersementRow({ v }) {
    const [commentaire, setCommentaire] = useState('');

    function attester(e) {
        e.preventDefault();
        router.post(route('commercial.aides.accuser', v.id), { accuse_commentaire: commentaire });
    }

    return (
        <tr className={v.accuse_at ? 'bg-green-50/50' : ''}>
            <td className="px-5 py-3 text-ardoise-700">{v.semaine_debut}</td>
            <td className="px-5 py-3 text-ardoise-600">{v.montant_carburant} F</td>
            <td className="px-5 py-3 text-ardoise-600">{v.montant_credit_tel} F</td>
            <td className="px-5 py-3">
                {v.accuse_at ? (
                    <Badge tone="green">Reçu le {v.accuse_at}</Badge>
                ) : (
                    <Badge tone="amber">En attente de confirmation</Badge>
                )}
            </td>
            <td className="px-5 py-3">
                {!v.accuse_at && (
                    <form onSubmit={attester} className="flex flex-col gap-1.5">
                        <Input
                            value={commentaire}
                            onChange={(e) => setCommentaire(e.target.value)}
                            placeholder="Commentaire (facultatif)"
                            className="text-xs"
                        />
                        <Button type="submit" size="sm">J'atteste avoir reçu</Button>
                    </form>
                )}
            </td>
        </tr>
    );
}
