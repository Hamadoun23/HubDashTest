import { useState } from 'react';
import { useForm } from '@inertiajs/react';
import { Card, CardHeader, CardTitle, CardBody } from '@/Components/ui/Card';
import { Input, Textarea, Label, FieldError } from '@/Components/ui/Input';
import Checkbox from '@/Components/ui/Checkbox';
import Button from '@/Components/ui/Button';
import { cn } from '@/lib/cn';

function TypeChip({ selected, disabled, onClick, children }) {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            className={cn(
                'rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors',
                selected
                    ? 'border-marque-500 bg-marque-50 text-marque-700'
                    : 'border-ardoise-200 bg-white text-ardoise-600 hover:border-ardoise-300',
                disabled && 'cursor-not-allowed opacity-60 hover:border-ardoise-200',
            )}
        >
            {children}
        </button>
    );
}

export default function CampagneForm({ campagne, agences, commerciaux, aDesAgences = true, clientNom }) {
    const isEdit = !!campagne;
    const { data, setData, post, put, processing, errors } = useForm({
        nom: campagne?.nom ?? '',
        type: campagne?.type ?? 'vente_carte',
        date_debut: campagne?.date_debut ?? '',
        date_fin: campagne?.date_fin ?? '',
        prime_meilleur_vendeur: campagne?.prime_meilleur_vendeur ?? 25000,
        toutes_agences: campagne?.toutes_agences ?? true,
        agences: campagne?.agence_ids ?? [],
        aide_hebdo_tous_commerciaux: campagne?.aide_hebdo_tous_commerciaux ?? true,
        aide_beneficiaires: campagne?.aide_beneficiaire_ids ?? [],
        contrat_emolument_forfait: campagne?.contrat_emolument_forfait ?? 50000,
        contrat_forfait_communication: campagne?.contrat_forfait_communication ?? 2000,
        contrat_forfait_deplacement: campagne?.contrat_forfait_deplacement ?? 3000,
        contrat_representant_nom: campagne?.contrat_representant_nom ?? 'Yaya H DIALLO',
        contrat_lieu_signature: campagne?.contrat_lieu_signature ?? 'Bamako',
        contrat_clause_libre: campagne?.contrat_clause_libre ?? '',
        contrat_republier: false,
        aide_hebdo_active: campagne?.aide_hebdo_active ?? false,
        aide_hebdo_montant: campagne?.aide_hebdo_montant ?? 5000,
        aide_hebdo_carburant: campagne?.aide_hebdo_carburant ?? 3000,
        aide_hebdo_credit_tel: campagne?.aide_hebdo_credit_tel ?? 2000,
    });

    function toggleIn(field, id) {
        const arr = data[field];
        setData(field, arr.includes(id) ? arr.filter((v) => v !== id) : [...arr, id]);
    }

    function submit(e) {
        e.preventDefault();
        if (isEdit) {
            put(route('admin.campagnes.update', campagne.id));
        } else {
            post(route('admin.campagnes.store'));
        }
    }

    return (
        <form onSubmit={submit} className="space-y-4">
            <Card>
                <CardBody className="space-y-4">
                    <p className="text-sm text-ardoise-500">Une campagne est une activité (vente de cartes ou enrôlement de clients) durant une période donnée.</p>

                    <div>
                        <Label>Type de campagne *</Label>
                        <div className="flex flex-wrap gap-2">
                            <TypeChip selected={data.type === 'vente_carte'} disabled={isEdit} onClick={() => setData({ ...data, type: 'vente_carte', prime_meilleur_vendeur: data.prime_meilleur_vendeur || 25000 })}>
                                Vente de cartes
                            </TypeChip>
                            {/* Une campagne d'enrôlement n'a pas de prime « meilleur vendeur » : on la neutralise
                                à la bascule pour ne pas enregistrer un montant jamais versé. */}
                            <TypeChip selected={data.type === 'enrolement_app'} disabled={isEdit} onClick={() => setData({ ...data, type: 'enrolement_app', prime_meilleur_vendeur: 0 })}>
                                Enrôlement app mobile
                            </TypeChip>
                        </div>
                        {isEdit && <p className="mt-1 text-xs text-ardoise-500">Le type ne peut pas être modifié après création.</p>}
                        <FieldError>{errors.type}</FieldError>
                    </div>

                    <div>
                        <Label htmlFor="nom">Nom *</Label>
                        <Input id="nom" value={data.nom} onChange={(e) => setData('nom', e.target.value)} error={errors.nom} required />
                        <FieldError>{errors.nom}</FieldError>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <Label htmlFor="date_debut">Date début *</Label>
                            <Input id="date_debut" type="date" value={data.date_debut} onChange={(e) => setData('date_debut', e.target.value)} error={errors.date_debut} required />
                            <FieldError>{errors.date_debut}</FieldError>
                        </div>
                        <div>
                            <Label htmlFor="date_fin">Date fin *</Label>
                            <Input id="date_fin" type="date" value={data.date_fin} onChange={(e) => setData('date_fin', e.target.value)} error={errors.date_fin} required />
                            <FieldError>{errors.date_fin}</FieldError>
                        </div>
                    </div>
                    {data.type === 'vente_carte' && (
                        <div>
                            <Label htmlFor="prime_meilleur_vendeur">Prime du meilleur vendeur (FCFA) *</Label>
                            <Input id="prime_meilleur_vendeur" type="number" min={0} value={data.prime_meilleur_vendeur} onChange={(e) => setData('prime_meilleur_vendeur', e.target.value)} error={errors.prime_meilleur_vendeur} required />
                            <p className="mt-1 text-xs text-ardoise-500">Attribuée au seul 1ᵉʳ du classement (ventes) sur la période.</p>
                        </div>
                    )}

                    {/* Chez un client sans réseau d'agences, la campagne couvre d'office
                        tous ses commerciaux : il n'y a pas de périmètre à découper. */}
                    {aDesAgences ? (
                        <div>
                            <Label>Agences concernées *</Label>
                            <Checkbox
                                id="toutes_agences"
                                label="Toutes les agences"
                                checked={data.toutes_agences}
                                onChange={(e) => setData('toutes_agences', e.target.checked)}
                            />
                            {!data.toutes_agences && (
                                <div className="mt-2 max-h-56 space-y-1 overflow-y-auto rounded-lg border border-ardoise-200 p-3">
                                    {agences.map((a) => (
                                        <Checkbox
                                            key={a.id}
                                            id={`ag${a.id}`}
                                            label={a.nom}
                                            checked={data.agences.includes(a.id)}
                                            onChange={() => toggleIn('agences', a.id)}
                                        />
                                    ))}
                                </div>
                            )}
                            <FieldError>{errors.agences}</FieldError>
                        </div>
                    ) : (
                        <div>
                            <Label>Périmètre</Label>
                            <p className="rounded-lg bg-ardoise-50 px-3.5 py-2.5 text-xs text-ardoise-500">
                                {clientNom || 'Ce client'} n'a pas d'agences : la campagne couvre
                                l'ensemble de ses commerciaux. Les engagés se désignent ci-dessous.
                            </p>
                        </div>
                    )}
                </CardBody>
            </Card>

            {data.type === 'enrolement_app' && isEdit && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                    Les commerciaux engagés se gèrent depuis l'onglet <strong>Commerciaux</strong> du détail de la campagne (import en masse ou sélection manuelle).
                </div>
            )}
            {data.type === 'enrolement_app' && !isEdit && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                    Une fois la campagne créée, ajoutez les commerciaux engagés depuis l'onglet <strong>Commerciaux</strong> de son détail (import en masse depuis Excel ou sélection manuelle).
                </div>
            )}

            {data.type === 'vente_carte' && (
            <>
            <Card>
                <CardHeader><CardTitle>Commerciaux engagés (contrat de prestation)</CardTitle></CardHeader>
                <CardBody className="space-y-3">
                    <p className="text-sm text-ardoise-500">
                        {aDesAgences
                            ? 'Obligatoire : tous les commerciaux des agences concernées, ou une sélection.'
                            : `Obligatoire : tous les commerciaux de ${clientNom || 'ce client'}, ou une sélection.`}
                    </p>
                    <Checkbox
                        id="aide_hebdo_tous_commerciaux"
                        label={aDesAgences ? 'Tous les commerciaux des agences concernées' : 'Tous les commerciaux du client'}
                        checked={data.aide_hebdo_tous_commerciaux}
                        onChange={(e) => setData('aide_hebdo_tous_commerciaux', e.target.checked)}
                    />
                    {!data.aide_hebdo_tous_commerciaux && (
                        <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-ardoise-200 p-3">
                            {commerciaux.map((c) => (
                                <Checkbox
                                    key={c.id}
                                    id={`cb${c.id}`}
                                    label={aDesAgences ? `${c.nom} — ${c.agence_nom}` : c.nom}
                                    checked={data.aide_beneficiaires.includes(c.id)}
                                    onChange={() => toggleIn('aide_beneficiaires', c.id)}
                                />
                            ))}
                        </div>
                    )}
                    <FieldError>{errors.aide_beneficiaires}</FieldError>
                </CardBody>
            </Card>

            <Card>
                <CardHeader><CardTitle>Paramètres du contrat de prestation</CardTitle></CardHeader>
                <CardBody className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-3">
                        <div>
                            <Label htmlFor="contrat_emolument_forfait">Émolument forfait mission (FCFA)</Label>
                            <Input id="contrat_emolument_forfait" type="number" min={0} value={data.contrat_emolument_forfait} onChange={(e) => setData('contrat_emolument_forfait', e.target.value)} />
                        </div>
                        <div>
                            <Label htmlFor="contrat_forfait_communication">Forfait communication (FCFA)</Label>
                            <Input id="contrat_forfait_communication" type="number" min={0} value={data.contrat_forfait_communication} onChange={(e) => setData('contrat_forfait_communication', e.target.value)} />
                        </div>
                        <div>
                            <Label htmlFor="contrat_forfait_deplacement">Forfait déplacement (FCFA)</Label>
                            <Input id="contrat_forfait_deplacement" type="number" min={0} value={data.contrat_forfait_deplacement} onChange={(e) => setData('contrat_forfait_deplacement', e.target.value)} />
                        </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <Label htmlFor="contrat_representant_nom">Représentant GDA (nom pour le contrat)</Label>
                            <Input id="contrat_representant_nom" value={data.contrat_representant_nom} onChange={(e) => setData('contrat_representant_nom', e.target.value)} />
                        </div>
                        <div>
                            <Label htmlFor="contrat_lieu_signature">Lieu « Fait à … »</Label>
                            <Input id="contrat_lieu_signature" value={data.contrat_lieu_signature} onChange={(e) => setData('contrat_lieu_signature', e.target.value)} />
                        </div>
                    </div>
                    <div>
                        <Label htmlFor="contrat_clause_libre">Clause libre (facultatif)</Label>
                        <Textarea id="contrat_clause_libre" rows={3} value={data.contrat_clause_libre} onChange={(e) => setData('contrat_clause_libre', e.target.value)} placeholder="Texte juridique complémentaire…" />
                    </div>
                    {isEdit && (
                        <>
                            <Checkbox
                                id="contrat_republier"
                                label="Republier le contrat — nouvelle date limite de 5 jours et réinitialisation des réponses en attente"
                                checked={data.contrat_republier}
                                onChange={(e) => setData('contrat_republier', e.target.checked)}
                            />
                            {campagne.contrat_publie_at && (
                                <p className="text-xs text-ardoise-500">Dernière publication : {campagne.contrat_publie_at}</p>
                            )}
                        </>
                    )}
                </CardBody>
            </Card>

            <Card>
                <CardHeader><CardTitle>Coût / aide hebdomadaire commerciaux</CardTitle></CardHeader>
                <CardBody className="space-y-3">
                    <p className="text-sm text-ardoise-500">Montants hebdomadaires. Les bénéficiaires sont les commerciaux engagés définis plus haut.</p>
                    <Checkbox
                        id="aide_hebdo_active"
                        label="Activer l'aide hebdomadaire pour cette campagne"
                        checked={data.aide_hebdo_active}
                        onChange={(e) => setData('aide_hebdo_active', e.target.checked)}
                    />
                    {data.aide_hebdo_active && (
                        <>
                            <div className="grid gap-4 sm:grid-cols-3">
                                <div>
                                    <Label htmlFor="aide_hebdo_montant">Montant total / semaine (FCFA)</Label>
                                    <Input id="aide_hebdo_montant" type="number" min={0} value={data.aide_hebdo_montant} onChange={(e) => setData('aide_hebdo_montant', e.target.value)} error={errors.aide_hebdo_montant} />
                                </div>
                                <div>
                                    <Label htmlFor="aide_hebdo_carburant">Carburant (FCFA)</Label>
                                    <Input id="aide_hebdo_carburant" type="number" min={0} value={data.aide_hebdo_carburant} onChange={(e) => setData('aide_hebdo_carburant', e.target.value)} />
                                </div>
                                <div>
                                    <Label htmlFor="aide_hebdo_credit_tel">Crédit téléphonique (FCFA)</Label>
                                    <Input id="aide_hebdo_credit_tel" type="number" min={0} value={data.aide_hebdo_credit_tel} onChange={(e) => setData('aide_hebdo_credit_tel', e.target.value)} />
                                </div>
                            </div>
                            <p className="text-xs text-ardoise-500">La somme carburant + crédit doit égaler le montant total.</p>
                            <FieldError>{errors.aide_hebdo_montant}</FieldError>
                        </>
                    )}
                </CardBody>
            </Card>
            </>
            )}

            <div className="flex gap-2">
                <Button type="submit" disabled={processing}>{isEdit ? 'Enregistrer la campagne' : 'Créer'}</Button>
                {isEdit ? (
                    <>
                        <Button href={route('admin.campagnes.show', campagne.id)} variant="outline">Retour au détail</Button>
                        <Button href={route('admin.campagnes.index')} variant="ghost">Liste</Button>
                    </>
                ) : (
                    <Button href={route('admin.campagnes.index')} variant="outline">Annuler</Button>
                )}
            </div>
        </form>
    );
}
