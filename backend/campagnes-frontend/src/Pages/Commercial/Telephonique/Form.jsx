import { Head, router, useForm, usePage } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardBody } from '@/Components/ui/Card';
import { Input, Label, FieldError } from '@/Components/ui/Input';
import Button from '@/Components/ui/Button';

function SectionTitle({ children }) {
    return <h3 className="mb-3 border-b border-ardoise-100 pb-2 text-xs font-semibold uppercase tracking-wide text-ardoise-500">{children}</h3>;
}

export default function TelephoniqueForm({ dateRapport, campagneActiveNom, rapportVerrouille, typesCampagne, rapport }) {
    const { auth } = usePage().props;
    const user = auth.user;

    const { data, setData, post, processing, errors } = useForm({
        date_rapport: dateRapport,
        appels_emis: rapport?.appels_emis ?? 0,
        appels_joignables: rapport?.appels_joignables ?? 0,
        clients_interesses_nombre: rapport?.clients_interesses_nombre ?? 0,
        clients_deja_servis_nombre: rapport?.clients_deja_servis_nombre ?? 0,
        propose: rapport?.propose ?? Object.fromEntries(typesCampagne.map((t) => [t.id, 0])),
        nj_repondeur: rapport?.nj_repondeur ?? 0,
        nj_numero_errone: rapport?.nj_numero_errone ?? 0,
        nj_hors_reseau: rapport?.nj_hors_reseau ?? 0,
        nj_autres_nombre: rapport?.nj_autres_nombre ?? 0,
        nj_autres_precision: rapport?.nj_autres_precision ?? '',
    });

    const emis = parseInt(data.appels_emis, 10) || 0;
    const joignablesRaw = parseInt(data.appels_joignables, 10) || 0;
    const joignables = Math.min(joignablesRaw, emis);
    const nonJoignables = Math.max(0, emis - joignables);
    const taux = emis > 0 ? ((joignables / emis) * 100).toFixed(2).replace('.', ',') + ' %' : '—';

    const njSum = ['nj_repondeur', 'nj_numero_errone', 'nj_hors_reseau', 'nj_autres_nombre']
        .reduce((s, k) => s + (parseInt(data[k], 10) || 0), 0);
    const njOver = njSum > nonJoignables;

    function changeDate(newDate) {
        if (rapportVerrouille) {
            router.get(route('commercial.telephonique.create'), { date: newDate });
        } else {
            setData('date_rapport', newDate);
        }
    }

    function submit(e) {
        e.preventDefault();
        if (rapportVerrouille) return;
        post(route('commercial.telephonique.store'));
    }

    return (
        <AppLayout
            title="Fiche de reporting téléopératrice"
            actions={<Button href={route('commercial.telephonique.index')} variant="outline" size="sm"><ArrowLeft size={14} /> Historique</Button>}
        >
            <Head title="Fiche reporting téléphonique" />

            <p className="mb-3 text-sm text-ardoise-500">
                Une fiche par jour. Les chiffres sont enregistrés pour la date indiquée (modifiable si vous devez
                compléter une journée passée).
            </p>

            {campagneActiveNom ? (
                <p className="mb-3 text-sm">
                    <span className="text-ardoise-500">Campagne active :</span> <strong>{campagneActiveNom}</strong> — les
                    types de cartes ci-dessous correspondent à cette campagne.
                </p>
            ) : (
                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
                    Aucune campagne active pour votre agence : la section « types de cartes » est vide. Contactez l'administrateur.
                </div>
            )}

            {rapportVerrouille && (
                <div className="mb-4 rounded-lg border border-ardoise-200 bg-ardoise-50 px-4 py-2.5 text-sm text-ardoise-600">
                    Cette fiche a été enregistrée il y a plus de 48 h : consultation seule. Pour saisir une autre
                    journée, modifiez la date ci-dessous.
                </div>
            )}

            <Card>
                <form onSubmit={submit}>
                    <CardBody className="space-y-6">
                        <div>
                            <SectionTitle>1. Identification</SectionTitle>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <Label htmlFor="date_rapport">Date du reporting *</Label>
                                    <Input
                                        id="date_rapport"
                                        type="date"
                                        value={data.date_rapport}
                                        onChange={(e) => changeDate(e.target.value)}
                                        error={errors.date_rapport}
                                        required
                                    />
                                    <FieldError>{errors.date_rapport}</FieldError>
                                </div>
                                <div className="flex items-end">
                                    <p className="text-sm text-ardoise-500">
                                        Téléopératrice : <strong className="text-ardoise-900">{user.prenom || user.name}</strong>
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div>
                            <SectionTitle>2. Activité journalière</SectionTitle>
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                <div>
                                    <Label htmlFor="appels_emis">Appels émis *</Label>
                                    <Input
                                        id="appels_emis" type="number" min={0} disabled={rapportVerrouille}
                                        value={data.appels_emis} onChange={(e) => setData('appels_emis', e.target.value)}
                                        error={errors.appels_emis} required
                                    />
                                    <FieldError>{errors.appels_emis}</FieldError>
                                </div>
                                <div>
                                    <Label htmlFor="appels_joignables">Joignables *</Label>
                                    <Input
                                        id="appels_joignables" type="number" min={0} disabled={rapportVerrouille}
                                        value={data.appels_joignables} onChange={(e) => setData('appels_joignables', e.target.value)}
                                        error={errors.appels_joignables} required
                                    />
                                    <FieldError>{errors.appels_joignables}</FieldError>
                                </div>
                                <div>
                                    <Label className="text-ardoise-400">Non joignables</Label>
                                    <div className="flex h-9 items-center rounded-lg border border-ardoise-200 bg-ardoise-50 px-3.5 text-sm text-ardoise-500">{nonJoignables}</div>
                                    <p className="mt-1 text-xs text-ardoise-400">Calculé : émis − joignables</p>
                                </div>
                                <div>
                                    <Label className="text-ardoise-400">Taux de joignabilité</Label>
                                    <div className="flex h-9 items-center rounded-lg border border-ardoise-200 bg-ardoise-50 px-3.5 text-sm text-ardoise-500">{taux}</div>
                                    <p className="mt-1 text-xs text-ardoise-400">Calculé automatiquement</p>
                                </div>
                            </div>
                        </div>

                        <div>
                            <SectionTitle>3. Résultats des appels</SectionTitle>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label htmlFor="clients_interesses_nombre">Clients intéressés (nombre) *</Label>
                                    <Input
                                        id="clients_interesses_nombre" type="number" min={0} disabled={rapportVerrouille}
                                        value={data.clients_interesses_nombre} onChange={(e) => setData('clients_interesses_nombre', e.target.value)}
                                        required
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="clients_deja_servis_nombre">Clients déjà servis — cartes récupérées *</Label>
                                    <Input
                                        id="clients_deja_servis_nombre" type="number" min={0} disabled={rapportVerrouille}
                                        value={data.clients_deja_servis_nombre} onChange={(e) => setData('clients_deja_servis_nombre', e.target.value)}
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        <div>
                            <SectionTitle>4. Type de carte proposée (nombre par type, campagne en cours)</SectionTitle>
                            {typesCampagne.length === 0 ? (
                                <p className="text-sm text-ardoise-500">Aucun type de carte disponible pour cette campagne — complétez les autres sections puis enregistrez.</p>
                            ) : (
                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                    {typesCampagne.map((t) => (
                                        <div key={t.id}>
                                            <Label htmlFor={`propose_${t.id}`}>{t.code} *</Label>
                                            <Input
                                                id={`propose_${t.id}`} type="number" min={0} disabled={rapportVerrouille}
                                                value={data.propose[t.id] ?? 0}
                                                onChange={(e) => setData('propose', { ...data.propose, [t.id]: e.target.value })}
                                                error={errors[`propose.${t.id}`]}
                                                required
                                            />
                                            <FieldError>{errors[`propose.${t.id}`]}</FieldError>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div>
                            <SectionTitle>5. Appels non joignables — analyse</SectionTitle>
                            <p className="mb-2 text-sm text-ardoise-500">
                                Le total des quatre cases ci-dessous ne doit pas dépasser le <strong>non joignable</strong> de la section 2 (émis − joignables).
                            </p>
                            {errors.nj_analyse && (
                                <div className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-sm text-red-800">{errors.nj_analyse}</div>
                            )}
                            {njOver && !rapportVerrouille && (
                                <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2 text-sm text-amber-800">
                                    Total section 5 : {njSum} — maximum autorisé (non joignables) : {nonJoignables}. Ajustez les quantités.
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                {[
                                    ['nj_repondeur', 'Répondeur'],
                                    ['nj_numero_errone', 'N° erroné'],
                                    ['nj_hors_reseau', 'Hors réseau'],
                                    ['nj_autres_nombre', 'Autres (nb)'],
                                ].map(([key, label]) => (
                                    <div key={key}>
                                        <Label htmlFor={key}>{label} *</Label>
                                        <Input
                                            id={key} type="number" min={0} disabled={rapportVerrouille}
                                            value={data[key]} onChange={(e) => setData(key, e.target.value)}
                                            error={njOver}
                                            required
                                        />
                                    </div>
                                ))}
                                <div className="col-span-2 sm:col-span-4">
                                    <Label htmlFor="nj_autres_precision">
                                        Autres (précision) {!rapportVerrouille && (parseInt(data.nj_autres_nombre, 10) || 0) > 0 && (
                                            <span className="font-normal text-ardoise-400">— obligatoire si « Autres (nb) » &gt; 0</span>
                                        )}
                                    </Label>
                                    <Input
                                        id="nj_autres_precision" maxLength={500} disabled={rapportVerrouille}
                                        value={data.nj_autres_precision} onChange={(e) => setData('nj_autres_precision', e.target.value)}
                                        error={errors.nj_autres_precision}
                                    />
                                    <FieldError>{errors.nj_autres_precision}</FieldError>
                                </div>
                            </div>
                        </div>
                    </CardBody>

                    <div className="flex items-center gap-2 border-t border-ardoise-100 bg-ardoise-50 px-5 py-4">
                        {rapportVerrouille ? (
                            <>
                                <Button type="button" disabled>Enregistrer la fiche</Button>
                                <span className="text-sm text-ardoise-500">Fiche verrouillée (48 h)</span>
                            </>
                        ) : (
                            <Button type="submit" disabled={processing}>Enregistrer la fiche</Button>
                        )}
                    </div>
                </form>
            </Card>
        </AppLayout>
    );
}
