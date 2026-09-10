import { router } from '@inertiajs/react';
import { Card, CardHeader, CardTitle, CardBody } from '@/Components/ui/Card';
import { Input, Label } from '@/Components/ui/Input';
import Button from '@/Components/ui/Button';

function Row({ label, children }) {
    return (
        <tr className="border-b border-ardoise-50 last:border-0">
            <td className="py-2 pr-4 text-sm text-ardoise-500">{label}</td>
            <td className="py-2 text-sm text-ardoise-900">{children}</td>
        </tr>
    );
}

export default function Pilotage({ campagne, isDirectionDetail, onOpenModal }) {
    // Prime « meilleur vendeur » et remise sur cartes : notions propres aux campagnes de vente.
    const estEnrolement = campagne.type === 'enrolement_app';

    function syncCommerciaux() {
        router.post(route('admin.campagnes.sync-commerciaux', campagne.id));
    }

    function updateDates(e) {
        e.preventDefault();
        const form = new FormData(e.target);
        router.post(route('admin.campagnes.dates.update', campagne.id), {
            date_debut: form.get('date_debut'),
            date_fin: form.get('date_fin'),
        });
    }

    return (
        <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
                <CardHeader><CardTitle>Informations générales</CardTitle></CardHeader>
                <CardBody>
                    <table className="w-full">
                        <tbody>
                            <Row label="Nom">{campagne.nom}</Row>
                            <Row label="Période">{campagne.date_debut} → {campagne.date_fin}</Row>
                            <Row label="Agences">{campagne.agences_libelle}</Row>
                            <Row label="Type">{estEnrolement ? 'Enrôlement app mobile' : 'Vente de cartes'}</Row>
                            {!estEnrolement && <Row label="Prime 1ᵉʳ">{campagne.prime_meilleur_vendeur} FCFA</Row>}
                            <Row label="Aide hebdo.">{campagne.aide_hebdo_active ? `${campagne.aide_hebdo_montant} F / semaine` : 'Non activée'}</Row>
                            {!estEnrolement && <Row label="Remise">{campagne.remise_libelle ?? 'Aucune'}</Row>}
                            <Row label="Créée le">{campagne.created_at}</Row>
                        </tbody>
                    </table>
                </CardBody>
            </Card>

            {!isDirectionDetail && (
                <Card>
                    <CardHeader><CardTitle>Actions rapides</CardTitle></CardHeader>
                    <CardBody className="flex flex-col gap-2">
                        <Button href={route('admin.campagnes.edit', campagne.id)} size="sm">Modifier tous les paramètres</Button>
                        <Button variant="outline" size="sm" onClick={syncCommerciaux}>Resynchroniser les comptes commerciaux</Button>
                        {campagne.peut_piloter && (
                            <>
                                <Button variant="outline" size="sm" onClick={() => onOpenModal('reprogrammer')}>Reprogrammer (avec justification)</Button>
                                <Button variant="outline" size="sm" onClick={() => onOpenModal('arreter')}>Arrêter la campagne</Button>
                                <Button variant="destructive" size="sm" onClick={() => onOpenModal('annuler')}>Annuler la campagne</Button>
                            </>
                        )}
                        <hr className="my-1 border-ardoise-100" />
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                                if (confirm('Supprimer définitivement cette campagne ?')) {
                                    router.delete(route('admin.campagnes.destroy', campagne.id));
                                }
                            }}
                        >
                            Supprimer la campagne
                        </Button>
                    </CardBody>
                </Card>
            )}

            {!isDirectionDetail && (
                <Card className="lg:col-span-3">
                    <CardHeader><CardTitle>Modifier les dates</CardTitle></CardHeader>
                    <CardBody>
                        <p className="mb-3 text-sm text-ardoise-500">
                            Met à jour la période, recalcule le statut et réactive ou désactive automatiquement les comptes des commerciaux engagés.
                        </p>
                        <form onSubmit={updateDates} className="flex flex-wrap items-end gap-3">
                            <div>
                                <Label htmlFor="pilotage_date_debut">Date début</Label>
                                <Input id="pilotage_date_debut" name="date_debut" type="date" defaultValue={campagne.date_debut_iso} required />
                            </div>
                            <div>
                                <Label htmlFor="pilotage_date_fin">Date fin</Label>
                                <Input id="pilotage_date_fin" name="date_fin" type="date" defaultValue={campagne.date_fin_iso} required />
                            </div>
                            <Button type="submit" size="sm">Enregistrer les dates</Button>
                        </form>
                    </CardBody>
                </Card>
            )}

            <div className="rounded-lg border border-ardoise-200 bg-white px-4 py-3 text-sm text-ardoise-600 lg:col-span-3">
                <strong>Rapports :</strong>{' '}
                <a href={route('rapports.campagnes.synthese', campagne.id)} className="text-marque-700 hover:underline">Synthèse</a> ·{' '}
                <a href={route('rapports.campagnes.ventes', campagne.id)} className="text-marque-700 hover:underline">Ventes</a> ·{' '}
                <a href={route('rapports.campagnes.clients', campagne.id)} className="text-marque-700 hover:underline">Clients</a> ·{' '}
                <a href={route('rapports.campagnes.reporting-telephonique', campagne.id)} className="text-marque-700 hover:underline">Téléphonique</a>
            </div>
        </div>
    );
}
