import { useState } from 'react';
import { router } from '@inertiajs/react';
import { Card, CardHeader, CardTitle, CardBody } from '@/Components/ui/Card';
import StatCard from '@/Components/ui/StatCard';
import Badge from '@/Components/ui/Badge';
import Button from '@/Components/ui/Button';
import Checkbox from '@/Components/ui/Checkbox';
import { Textarea, FieldError } from '@/Components/ui/Input';

const contratTone = { accepte: 'green', rejete: 'red', en_attente: 'amber' };
const contratLabel = { accepte: 'Accepté', rejete: 'Refusé', en_attente: 'En attente' };

function ImportCommerciauxCard({ campagne }) {
    const [texte, setTexte] = useState('');
    const [preview, setPreview] = useState(null);
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [importing, setImporting] = useState(false);
    const [error, setError] = useState('');

    async function previsualiser() {
        if (!texte.trim()) return;
        setLoadingPreview(true);
        setError('');
        try {
            const { data } = await window.axios.post(route('admin.campagnes.import-commerciaux.preview'), { texte });
            setPreview(data);
        } catch (err) {
            setError(err.response?.data?.message || 'Erreur lors de l\'analyse.');
        } finally {
            setLoadingPreview(false);
        }
    }

    function importer() {
        router.post(route('admin.campagnes.import-commerciaux', campagne.id), { texte }, {
            onSuccess: () => { setTexte(''); setPreview(null); },
        });
    }

    return (
        <Card>
            <CardHeader><CardTitle>Importer des commerciaux (coller depuis Excel)</CardTitle></CardHeader>
            <CardBody className="space-y-3">
                <p className="text-sm text-ardoise-500">
                    Collez le tableau depuis Excel (colonnes séparées par tabulation) : Nom, Prénom, [Quartier], Agence, Téléphone.
                    Les commerciaux/agences déjà existants sont réutilisés tels quels ; seuls les manquants sont créés.
                    L'import s'ajoute aux commerciaux déjà engagés, sans en retirer.
                </p>
                <Textarea
                    rows={8}
                    value={texte}
                    onChange={(e) => { setTexte(e.target.value); setPreview(null); }}
                    placeholder={'THERA\tMariam\tHippodrome\tYirimadio\t74082712\nNIAMBLE\tAissata N\tHamdallaye\tHamdallaye\t66904040'}
                    className="font-mono text-xs"
                />
                {error && <FieldError>{error}</FieldError>}

                <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={previsualiser} disabled={loadingPreview || !texte.trim()}>
                        {loadingPreview ? 'Analyse…' : 'Prévisualiser'}
                    </Button>
                    {preview && preview.resume.lignes_valides > 0 && (
                        <Button type="button" size="sm" onClick={importer} disabled={importing}>
                            Importer {preview.resume.lignes_valides} ligne(s)
                        </Button>
                    )}
                </div>

                {preview && (
                    <div className="space-y-2">
                        <div className="flex flex-wrap gap-2 text-xs">
                            <Badge>{preview.resume.lignes_valides} ligne(s) valide(s)</Badge>
                            <Badge tone="blue">{preview.resume.commerciaux_a_creer} nouveau(x) compte(s)</Badge>
                            <Badge tone="green">{preview.resume.commerciaux_existants} déjà existant(s)</Badge>
                            <Badge tone="amber">{preview.resume.agences_a_creer} agence(s) à créer</Badge>
                            {preview.resume.erreurs > 0 && <Badge tone="red">{preview.resume.erreurs} ligne(s) ignorée(s)</Badge>}
                        </div>
                        <div className="max-h-64 overflow-y-auto rounded-lg border border-ardoise-200">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-ardoise-50">
                                    <tr className="text-ardoise-500">
                                        <th className="px-3 py-2">Ligne</th>
                                        <th className="px-3 py-2">Nom</th>
                                        <th className="px-3 py-2">Agence</th>
                                        <th className="px-3 py-2">Téléphone</th>
                                        <th className="px-3 py-2">Statut</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-ardoise-100">
                                    {preview.lignes.map((l) => (
                                        <tr key={l.ligne_no}>
                                            <td className="px-3 py-1.5 text-ardoise-400">{l.ligne_no}</td>
                                            <td className="px-3 py-1.5">{l.prenom} {l.nom}</td>
                                            <td className="px-3 py-1.5">
                                                {l.agence_nom}
                                                {l.agence_statut === 'a_creer' && <Badge tone="amber" className="ml-1">nouvelle</Badge>}
                                            </td>
                                            <td className="px-3 py-1.5">{l.telephone}</td>
                                            <td className="px-3 py-1.5">
                                                {l.erreurs.length > 0 ? (
                                                    <span className="text-red-600">{l.erreurs.join(' ')}</span>
                                                ) : l.commercial_statut === 'a_creer' ? (
                                                    <span className="text-blue-600">compte à créer ({l.mot_de_passe_apercu})</span>
                                                ) : l.conflit_agence ? (
                                                    <span className="text-amber-600">existant — agence différente</span>
                                                ) : (
                                                    <span className="text-green-600">existant</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </CardBody>
        </Card>
    );
}

export default function Commerciaux({ campagne, isDirectionDetail, nbCommerciauxActifs, nbCommerciauxInactifs, commerciauxPerimetre, commerciauxCandidats, benefIds }) {
    const [tous, setTous] = useState(campagne.contrat_tous_commerciaux);
    const [selection, setSelection] = useState(benefIds);
    const estEnrolement = campagne.type === 'enrolement_app';

    function toggle(id) {
        setSelection((s) => (s.includes(id) ? s.filter((v) => v !== id) : [...s, id]));
    }

    function save(e) {
        e.preventDefault();
        router.post(route('admin.campagnes.signataires.update', campagne.id), {
            aide_hebdo_tous_commerciaux: tous ? 1 : 0,
            aide_beneficiaires: tous ? [] : selection,
        });
    }

    function syncCommerciaux() {
        router.post(route('admin.campagnes.sync-commerciaux', campagne.id));
    }

    return (
        <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
                <StatCard label="Comptes actifs" value={nbCommerciauxActifs} tone="green" />
                <StatCard label="Comptes inactifs" value={nbCommerciauxInactifs} tone="gray" />
                <StatCard label="Engagés sur la campagne" value={commerciauxPerimetre.length} tone="orange" />
            </div>

            {!isDirectionDetail && estEnrolement && <ImportCommerciauxCard campagne={campagne} />}

            {!isDirectionDetail && (
                <Card>
                    <CardHeader><CardTitle>Gérer les commerciaux engagés</CardTitle></CardHeader>
                    <CardBody>
                        <p className="mb-3 text-sm text-ardoise-500">Liste utilisée pour le contrat, l'accès aux ventes et l'aide hebdomadaire. Après enregistrement, les comptes sont resynchronisés automatiquement.</p>
                        <form onSubmit={save} className="space-y-3">
                            <Checkbox id="detail_aide_tous" label="Tous les commerciaux des agences concernées" checked={tous} onChange={(e) => setTous(e.target.checked)} />
                            {!tous && (
                                <div className="max-h-60 space-y-1 overflow-y-auto rounded-lg border border-ardoise-200 p-3">
                                    {commerciauxCandidats.map((c) => (
                                        <Checkbox key={c.id} id={`detail_cb${c.id}`} label={`${c.nom} — ${c.agence_nom}`} checked={selection.includes(c.id)} onChange={() => toggle(c.id)} />
                                    ))}
                                </div>
                            )}
                            <Button type="submit" size="sm">Enregistrer les commerciaux</Button>
                        </form>
                    </CardBody>
                </Card>
            )}

            <Card className="overflow-hidden">
                <CardHeader className="flex items-center justify-between">
                    <CardTitle>Liste des commerciaux engagés</CardTitle>
                    {!isDirectionDetail && (
                        <Button variant="outline" size="sm" onClick={syncCommerciaux}>Resynchroniser les comptes</Button>
                    )}
                </CardHeader>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-ardoise-100 text-xs uppercase tracking-wide text-ardoise-500">
                                <th className="px-4 py-2.5 font-medium">Commercial</th>
                                <th className="px-4 py-2.5 font-medium">Agence</th>
                                <th className="px-4 py-2.5 font-medium">Téléphone</th>
                                <th className="px-4 py-2.5 font-medium">Compte</th>
                                {!estEnrolement && <th className="px-4 py-2.5 font-medium">Contrat</th>}
                                {!isDirectionDetail && <th className="px-4 py-2.5"></th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-ardoise-100">
                            {commerciauxPerimetre.length === 0 ? (
                                <tr><td colSpan={(estEnrolement ? 4 : 5) + (isDirectionDetail ? 0 : 1)} className="px-4 py-6 text-center text-ardoise-500">Aucun commercial engagé.</td></tr>
                            ) : (
                                commerciauxPerimetre.map((u) => (
                                    <tr key={u.id} className="hover:bg-ardoise-50">
                                        <td className="px-4 py-2.5 font-medium text-ardoise-900">{u.nom}</td>
                                        <td className="px-4 py-2.5 text-ardoise-600">{u.agence_nom}</td>
                                        <td className="px-4 py-2.5 text-ardoise-600">{u.telephone ?? '—'}</td>
                                        <td className="px-4 py-2.5"><Badge tone={u.actif ? 'green' : 'neutral'}>{u.actif ? 'Actif' : 'Inactif'}</Badge></td>
                                        {!estEnrolement && (
                                            <td className="px-4 py-2.5">
                                                {u.contrat_statut ? <Badge tone={contratTone[u.contrat_statut]}>{contratLabel[u.contrat_statut]}</Badge> : <Badge>Non initié</Badge>}
                                            </td>
                                        )}
                                        {!isDirectionDetail && (
                                            <td className="px-4 py-2.5">
                                                <div className="flex gap-1.5">
                                                    <Button href={route('admin.users.edit', u.id)} variant="outline" size="sm">Fiche</Button>
                                                    <Button href={route('admin.users.transfert-agence', { user: u.id, campagne_id: campagne.id, return_campagne: campagne.id, mode: 'profil' })} variant="outline" size="sm">Transfert agence</Button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}
