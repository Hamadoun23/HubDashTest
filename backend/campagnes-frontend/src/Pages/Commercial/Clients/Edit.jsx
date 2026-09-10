import { Head, useForm, router } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardHeader, CardTitle, CardBody } from '@/Components/ui/Card';
import Badge from '@/Components/ui/Badge';
import Button from '@/Components/ui/Button';
import { Input, Label, FieldError } from '@/Components/ui/Input';

export default function ClientEdit({ client, delaiHeures }) {
    const { data, setData, post, processing, errors } = useForm({
        _method: 'put',
        prenom: client.prenom ?? '',
        nom: client.nom ?? '',
        telephone: client.telephone ?? '',
        ville: client.ville ?? '',
        quartier: client.quartier ?? '',
        carte_identite: null,
    });

    function submit(e) {
        e.preventDefault();
        if (client.verrouille) return;
        post(route('commercial.clients.update', client.id), { forceFormData: true });
    }

    function destroy() {
        if (confirm('Supprimer ce client et toutes les ventes associées ? Cette action est irréversible.')) {
            router.delete(route('commercial.clients.destroy', client.id));
        }
    }

    return (
        <AppLayout title="Modifier le client" subtitle="Corrigez les erreurs éventuelles">
            <Head title="Modifier le client" />

            <div className="mx-auto max-w-xl">
                <Card>
                    <CardHeader><CardTitle>Modifier les informations du client</CardTitle></CardHeader>
                    <CardBody>
                        {client.verrouille && (
                            <div className="mb-4 rounded-lg border border-ardoise-200 bg-ardoise-50 px-4 py-2.5 text-sm text-ardoise-600">
                                Cette fiche client a été créée il y a plus de {delaiHeures} h : consultation seule.
                            </div>
                        )}

                        <p className="mb-3 text-sm text-ardoise-500">Le type de carte vendu n'est pas modifiable ici.</p>

                        <div className="mb-4 rounded-lg bg-ardoise-50 px-3 py-2 text-sm">
                            <strong>Type de carte (vente)</strong> : <Badge tone="blue">{client.type_carte_code ?? '?'}</Badge>
                        </div>

                        <form onSubmit={submit} encType="multipart/form-data" className="space-y-4">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <Label htmlFor="prenom">Prénom *</Label>
                                    <Input id="prenom" value={data.prenom} onChange={(e) => setData('prenom', e.target.value)} maxLength={100} required readOnly={client.verrouille} error={errors.prenom} />
                                    <FieldError>{errors.prenom}</FieldError>
                                </div>
                                <div>
                                    <Label htmlFor="nom">Nom *</Label>
                                    <Input id="nom" value={data.nom} onChange={(e) => setData('nom', e.target.value)} maxLength={100} required readOnly={client.verrouille} error={errors.nom} />
                                    <FieldError>{errors.nom}</FieldError>
                                </div>
                            </div>

                            <div>
                                <Label htmlFor="telephone">Téléphone</Label>
                                <Input id="telephone" type="tel" value={data.telephone} onChange={(e) => setData('telephone', e.target.value)} maxLength={20} readOnly={client.verrouille} error={errors.telephone} />
                                <FieldError>{errors.telephone}</FieldError>
                            </div>

                            <div>
                                <Label htmlFor="carte_identite">Pièce d'identité <span className="font-normal text-ardoise-400">(nouveau fichier optionnel)</span></Label>
                                <input
                                    id="carte_identite"
                                    type="file"
                                    accept="image/jpeg,image/png,image/gif,image/webp,.pdf,application/pdf"
                                    disabled={client.verrouille}
                                    onChange={(e) => setData('carte_identite', e.target.files[0] ?? null)}
                                    className="block w-full text-sm text-ardoise-600 file:mr-3 file:rounded-lg file:border-0 file:bg-ardoise-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ardoise-700 hover:file:bg-ardoise-200"
                                />
                                <p className="mt-1 text-xs text-ardoise-400">JPG, PNG, GIF, WebP, PDF — max. 10 Mo.</p>
                                <FieldError>{errors.carte_identite}</FieldError>
                                {client.carte_identite_url && (
                                    <a href={client.carte_identite_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-sm text-marque-700 underline">
                                        Fichier actuel
                                    </a>
                                )}
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <Label htmlFor="ville">Ville</Label>
                                    <Input id="ville" value={data.ville} onChange={(e) => setData('ville', e.target.value)} maxLength={100} readOnly={client.verrouille} error={errors.ville} />
                                    <FieldError>{errors.ville}</FieldError>
                                </div>
                                <div>
                                    <Label htmlFor="quartier">Quartier</Label>
                                    <Input id="quartier" value={data.quartier} onChange={(e) => setData('quartier', e.target.value)} maxLength={100} readOnly={client.verrouille} error={errors.quartier} />
                                    <FieldError>{errors.quartier}</FieldError>
                                </div>
                            </div>

                            <div className="grid gap-2 pt-2">
                                {client.verrouille ? (
                                    <>
                                        <Button type="button" variant="outline" disabled className="w-full">Enregistrer</Button>
                                        <p className="text-center text-xs text-ardoise-400">Fiche verrouillée ({delaiHeures} h)</p>
                                    </>
                                ) : (
                                    <Button type="submit" disabled={processing} className="w-full">Enregistrer</Button>
                                )}
                                <Button href={route('ventes.index')} variant="outline" className="w-full">Annuler</Button>
                            </div>
                        </form>

                        <hr className="my-5 border-ardoise-100" />

                        {client.peut_supprimer ? (
                            <>
                                <p className="mb-2 text-sm text-red-600">
                                    Supprimer définitivement cette fiche et les ventes liées (possible pendant {delaiHeures} h après création uniquement).
                                </p>
                                <Button variant="outline" size="sm" onClick={destroy} className="border-red-200 text-red-600 hover:bg-red-50">
                                    Supprimer la fiche client
                                </Button>
                            </>
                        ) : (
                            <>
                                <p className="mb-2 text-sm text-ardoise-500">Suppression par vos soins :</p>
                                <Button variant="outline" size="sm" disabled title={`Suppression impossible après ${delaiHeures} h.`}>
                                    Supprimer la fiche client
                                </Button>
                                <p className="mb-0 mt-2 text-sm text-ardoise-500">Contactez l'administration si besoin.</p>
                            </>
                        )}
                    </CardBody>
                </Card>
            </div>
        </AppLayout>
    );
}
