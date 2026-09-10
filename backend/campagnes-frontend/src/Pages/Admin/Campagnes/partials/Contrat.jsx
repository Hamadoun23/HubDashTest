import { router } from '@inertiajs/react';
import { Card, CardHeader, CardTitle, CardBody } from '@/Components/ui/Card';
import Badge from '@/Components/ui/Badge';
import Button from '@/Components/ui/Button';
import ContratArticles from '../ContratArticles';

const tone = { accepte: 'green', rejete: 'red', en_attente: 'neutral' };
const label = { accepte: 'Accepté', rejete: 'Refusé', en_attente: 'En attente' };

export default function Contrat({ campagne, isDirectionDetail }) {
    function republier() {
        if (confirm('Republier le contrat ? Toutes les réponses repasseront en attente avec un nouveau délai de 5 jours.')) {
            router.post(route('admin.campagnes.republier-contrat', campagne.id));
        }
    }

    function reset(reponseId) {
        if (confirm('Réinitialiser cette réponse ?')) {
            router.post(route('admin.campagnes.contrat-reponses.reset', [campagne.id, reponseId]));
        }
    }

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader className="flex items-center justify-between">
                    <CardTitle>Contrat de prestation</CardTitle>
                    {!isDirectionDetail && <Button size="sm" variant="secondary" onClick={republier}>Republier le contrat</Button>}
                </CardHeader>
                <CardBody>
                    <div className="mb-4 grid gap-1 text-sm sm:grid-cols-2">
                        <p><strong>Émolument :</strong> {campagne.contrat_emolument_forfait} F</p>
                        <p><strong>Représentant :</strong> {campagne.contrat_representant_nom}</p>
                        <p><strong>Communication :</strong> {campagne.contrat_forfait_communication} F</p>
                        <p><strong>Lieu :</strong> {campagne.contrat_lieu_signature}</p>
                        <p><strong>Déplacement :</strong> {campagne.contrat_forfait_deplacement} F</p>
                        {campagne.contrat_publie_at && <p className="text-ardoise-500">Publié le {campagne.contrat_publie_at} — délai 5 jours</p>}
                    </div>
                    {campagne.contrat_clause_libre && (
                        <p className="mb-4 border-l-2 border-ardoise-200 pl-3 text-sm text-ardoise-500">{campagne.contrat_clause_libre}</p>
                    )}

                    <p className="mb-2 text-sm font-semibold text-ardoise-900">Réponses des commerciaux</p>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-ardoise-100 text-xs uppercase tracking-wide text-ardoise-500">
                                    <th className="py-2 pr-4 font-medium">Commercial</th>
                                    <th className="py-2 pr-4 font-medium">Statut</th>
                                    <th className="py-2 pr-4 font-medium">Répondu le</th>
                                    {!isDirectionDetail && <th className="py-2"></th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-ardoise-100">
                                {campagne.contrat_reponses.length === 0 ? (
                                    <tr><td colSpan={isDirectionDetail ? 3 : 4} className="py-3 text-ardoise-500">Aucune réponse — enregistrez des signataires dans l'onglet Commerciaux.</td></tr>
                                ) : (
                                    campagne.contrat_reponses.map((rep) => (
                                        <tr key={rep.id}>
                                            <td className="py-2 pr-4 text-ardoise-900">{rep.user_name}</td>
                                            <td className="py-2 pr-4">
                                                <Badge tone={tone[rep.statut]}>{label[rep.statut]}</Badge>
                                                {rep.verrou && <span className="ml-1 text-xs text-ardoise-400">(délai expiré)</span>}
                                            </td>
                                            <td className="py-2 pr-4 text-ardoise-500">{rep.repondu_at ?? '—'}</td>
                                            {!isDirectionDetail && (
                                                <td className="py-2">
                                                    {rep.statut !== 'en_attente' && (
                                                        <Button variant="outline" size="sm" onClick={() => reset(rep.id)}>Réinitialiser</Button>
                                                    )}
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

            {isDirectionDetail ? (
                <Card>
                    <CardHeader><CardTitle>Articles du contrat ({campagne.contrat_articles.length})</CardTitle></CardHeader>
                    <CardBody className="space-y-2">
                        {campagne.contrat_articles.length === 0 ? (
                            <p className="text-sm text-ardoise-500">Aucun article.</p>
                        ) : (
                            campagne.contrat_articles.map((a) => (
                                <details key={a.id} className="rounded-lg border border-ardoise-200 p-3">
                                    <summary className="cursor-pointer text-sm font-medium text-ardoise-900">{a.titre}</summary>
                                    <p className="mt-2 whitespace-pre-line text-sm text-ardoise-600">{a.contenu}</p>
                                </details>
                            ))
                        )}
                    </CardBody>
                </Card>
            ) : (
                <ContratArticles campagneId={campagne.id} articles={campagne.contrat_articles} />
            )}
        </div>
    );
}
