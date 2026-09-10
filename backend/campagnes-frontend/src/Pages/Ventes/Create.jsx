import { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import { Upload, CreditCard, CheckCircle2, IdCard } from 'lucide-react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardBody } from '@/Components/ui/Card';
import { Input, Label, FieldError } from '@/Components/ui/Input';
import { Select } from '@/Components/ui/Select';
import Button from '@/Components/ui/Button';
import { cn } from '@/lib/cn';

function Chip({ selected, onClick, children }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors',
                selected
                    ? 'border-marque-500 bg-marque-50 text-marque-700'
                    : 'border-ardoise-200 bg-white text-ardoise-600 hover:border-ardoise-300',
            )}
        >
            {children}
        </button>
    );
}

function Blocked({ title, children, actionHref, actionLabel }) {
    return (
        <Card>
            <CardBody className="text-center">
                <p className="font-medium text-ardoise-900">{title}</p>
                <p className="mt-1 text-sm text-ardoise-500">{children}</p>
                <div className="mt-4 flex justify-center gap-2">
                    {actionHref && <Button href={actionHref}>{actionLabel}</Button>}
                    <Button href={route('dashboard')} variant="outline">Retour au dashboard</Button>
                </div>
            </CardBody>
        </Card>
    );
}

/**
 * Champs de la demande d'adhésion VISA prépayée, exigés par certains clients de
 * GDA (UBA). Ils ne sont montés dans le formulaire que si `ficheAdhesion` est
 * vrai : la vente BDM reste le formulaire court d'origine.
 */
const CHAMPS_ADHESION = {
    date_naissance: '',
    lieu_naissance: '',
    nationalite: 'Malienne',
    email: '',
    adresse: '',
    pays_residence: 'Mali',
    nom_sur_carte: '',
    piece_type: '',
    piece_numero: '',
    piece_delivree_le: '',
    piece_expire_le: '',
    piece_autorite: '',
    numero_compte_uba: '',
    profession: '',
    employeur: '',
};

function Section({ icon: Icon, titre, description, children }) {
    return (
        <div className="space-y-4 border-t border-ardoise-100 pt-5">
            <div>
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ardoise-500">
                    {Icon && <Icon size={14} />}
                    {titre}
                </p>
                {description && <p className="mt-1 text-xs text-ardoise-400">{description}</p>}
            </div>
            {children}
        </div>
    );
}

export default function VentesCreate({
    typesCartes,
    campagnesOuvertes,
    peutVendre,
    contratAccepte,
    ficheAdhesion = false,
    clientNom,
    typesPiece = [],
}) {
    const [form, setForm] = useState({
        campagne_id: campagnesOuvertes.length === 1 ? campagnesOuvertes[0].id : '',
        type_carte_id: '',
        prenom: '',
        nom: '',
        telephone: '',
        ville: '',
        quartier: '',
        carte_identite: null,
        ...(ficheAdhesion ? CHAMPS_ADHESION : {}),
    });
    const [errors, setErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [fileName, setFileName] = useState('');

    function set(key, value) {
        setForm((f) => ({ ...f, [key]: value }));
    }

    async function submit(e) {
        e.preventDefault();
        setSubmitting(true);
        setErrors({});

        const fd = new FormData();
        Object.entries(form).forEach(([k, v]) => {
            if (v !== null && v !== '') fd.append(k, v);
        });

        try {
            await window.axios.post('/api/ventes', fd, {
                headers: { Accept: 'application/json' },
            });
            router.visit(route('dashboard'));
        } catch (err) {
            const res = err.response?.data;
            if (res?.errors) {
                const flat = {};
                Object.entries(res.errors).forEach(([k, v]) => { flat[k] = Array.isArray(v) ? v[0] : v; });
                setErrors(flat);
            } else {
                setErrors({ _general: res?.message || 'Erreur lors de l\'enregistrement.' });
            }
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <AppLayout title="Nouvelle vente" subtitle="Enregistrer une vente terrain">
            <Head title="Nouvelle vente" />

            {typesCartes.length === 0 ? (
                <Blocked title="Aucun type de carte actif">Contactez l'administrateur pour activer au moins un type de carte.</Blocked>
            ) : !peutVendre ? (
                <Blocked title="Aucune campagne active">Il n'y a pas de campagne ouverte pour votre périmètre en ce moment.</Blocked>
            ) : !contratAccepte ? (
                <Blocked title="Contrat non accepté" actionHref={route('commercial.contrat')} actionLabel="Voir mon contrat">
                    Vous devez accepter le contrat de prestation de la campagne en cours avant de pouvoir enregistrer une vente.
                </Blocked>
            ) : (
                <Card className={ficheAdhesion ? 'mx-auto max-w-2xl' : 'mx-auto max-w-xl'}>
                    <CardBody>
                        {campagnesOuvertes.length === 1 && (
                            <div className="mb-5 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3.5 py-2.5 text-sm text-green-800">
                                <CheckCircle2 size={16} />
                                Vente rattachée à <strong>{campagnesOuvertes[0].nom}</strong> (fin le {campagnesOuvertes[0].date_fin})
                            </div>
                        )}

                        {errors._general && (
                            <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
                                {errors._general}
                            </div>
                        )}

                        <form onSubmit={submit} className="space-y-5">
                            {campagnesOuvertes.length > 1 && (
                                <div>
                                    <Label>Campagne *</Label>
                                    <div className="flex flex-wrap gap-2">
                                        {campagnesOuvertes.map((c) => (
                                            <Chip key={c.id} selected={form.campagne_id === c.id} onClick={() => set('campagne_id', c.id)}>
                                                {c.nom} — fin {c.date_fin}
                                            </Chip>
                                        ))}
                                    </div>
                                    <FieldError>{errors.campagne_id}</FieldError>
                                </div>
                            )}

                            <div>
                                <Label>Type de carte *</Label>
                                <div className="flex flex-wrap gap-2">
                                    {typesCartes.map((t) => (
                                        <Chip key={t.id} selected={form.type_carte_id === t.id} onClick={() => set('type_carte_id', t.id)}>
                                            <span className="flex items-center gap-1.5"><CreditCard size={14} /> {t.code}</span>
                                        </Chip>
                                    ))}
                                </div>
                                <FieldError>{errors.type_carte_id}</FieldError>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <Label htmlFor="prenom">Prénom *</Label>
                                    <Input id="prenom" value={form.prenom} onChange={(e) => set('prenom', e.target.value)} error={errors.prenom} required />
                                    <FieldError>{errors.prenom}</FieldError>
                                </div>
                                <div>
                                    <Label htmlFor="nom">Nom *</Label>
                                    <Input id="nom" value={form.nom} onChange={(e) => set('nom', e.target.value)} error={errors.nom} required />
                                    <FieldError>{errors.nom}</FieldError>
                                </div>
                            </div>

                            <div>
                                <Label htmlFor="telephone">Téléphone</Label>
                                <Input id="telephone" type="tel" value={form.telephone} onChange={(e) => set('telephone', e.target.value)} error={errors.telephone} />
                                <FieldError>{errors.telephone}</FieldError>
                            </div>

                            <div>
                                <Label htmlFor="carte_identite">Pièce d'identité <span className="font-normal text-ardoise-400">(image ou PDF)</span></Label>
                                <label
                                    htmlFor="carte_identite"
                                    className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-ardoise-300 px-4 py-6 text-sm text-ardoise-500 hover:border-marque-500 hover:text-marque-700"
                                >
                                    <Upload size={16} />
                                    {fileName || 'Choisir un fichier (JPG, PNG, GIF, WebP, PDF — max 10 Mo)'}
                                </label>
                                <input
                                    id="carte_identite"
                                    type="file"
                                    className="hidden"
                                    accept="image/jpeg,image/png,image/gif,image/webp,.pdf,application/pdf"
                                    onChange={(e) => {
                                        const f = e.target.files?.[0] ?? null;
                                        set('carte_identite', f);
                                        setFileName(f?.name ?? '');
                                    }}
                                />
                                <FieldError>{errors.carte_identite}</FieldError>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <Label htmlFor="ville">Ville</Label>
                                    <Input id="ville" value={form.ville} onChange={(e) => set('ville', e.target.value)} error={errors.ville} />
                                </div>
                                <div>
                                    <Label htmlFor="quartier">Quartier</Label>
                                    <Input id="quartier" value={form.quartier} onChange={(e) => set('quartier', e.target.value)} error={errors.quartier} />
                                </div>
                            </div>

                            {ficheAdhesion && (
                                <>
                                    <Section
                                        icon={IdCard}
                                        titre="Demande d'adhésion"
                                        description={`${clientNom || 'Ce client'} exige la demande d'adhésion carte VISA prépayée pour émettre la carte.`}
                                    >
                                        <div>
                                            <Label htmlFor="nom_sur_carte">Nom à imprimer sur la carte *</Label>
                                            <Input
                                                id="nom_sur_carte"
                                                value={form.nom_sur_carte}
                                                onChange={(e) => set('nom_sur_carte', e.target.value.toUpperCase())}
                                                error={errors.nom_sur_carte}
                                                required
                                            />
                                            <p className="mt-1 text-xs text-ardoise-500">Tel que le titulaire veut le voir gravé.</p>
                                            <FieldError>{errors.nom_sur_carte}</FieldError>
                                        </div>

                                        <div className="grid gap-4 sm:grid-cols-2">
                                            <div>
                                                <Label htmlFor="date_naissance">Date de naissance</Label>
                                                <Input id="date_naissance" type="date" value={form.date_naissance} onChange={(e) => set('date_naissance', e.target.value)} error={errors.date_naissance} />
                                                <FieldError>{errors.date_naissance}</FieldError>
                                            </div>
                                            <div>
                                                <Label htmlFor="lieu_naissance">Lieu de naissance</Label>
                                                <Input id="lieu_naissance" value={form.lieu_naissance} onChange={(e) => set('lieu_naissance', e.target.value)} error={errors.lieu_naissance} />
                                            </div>
                                        </div>

                                        <div className="grid gap-4 sm:grid-cols-2">
                                            <div>
                                                <Label htmlFor="nationalite">Nationalité</Label>
                                                <Input id="nationalite" value={form.nationalite} onChange={(e) => set('nationalite', e.target.value)} error={errors.nationalite} />
                                            </div>
                                            <div>
                                                <Label htmlFor="email">E-mail</Label>
                                                <Input id="email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} error={errors.email} />
                                                <FieldError>{errors.email}</FieldError>
                                            </div>
                                        </div>

                                        <div className="grid gap-4 sm:grid-cols-2">
                                            <div>
                                                <Label htmlFor="adresse">Adresse</Label>
                                                <Input id="adresse" value={form.adresse} onChange={(e) => set('adresse', e.target.value)} error={errors.adresse} />
                                            </div>
                                            <div>
                                                <Label htmlFor="pays_residence">Pays de résidence</Label>
                                                <Input id="pays_residence" value={form.pays_residence} onChange={(e) => set('pays_residence', e.target.value)} error={errors.pays_residence} />
                                            </div>
                                        </div>
                                    </Section>

                                    <Section titre="Pièce d'identité présentée">
                                        <div className="grid gap-4 sm:grid-cols-2">
                                            <div>
                                                <Label htmlFor="piece_type">Nature du document *</Label>
                                                <Select id="piece_type" value={form.piece_type} onChange={(e) => set('piece_type', e.target.value)} error={errors.piece_type}>
                                                    <option value="">— Sélectionner —</option>
                                                    {typesPiece.map((t) => (
                                                        <option key={t.valeur} value={t.valeur}>{t.libelle}</option>
                                                    ))}
                                                </Select>
                                                <FieldError>{errors.piece_type}</FieldError>
                                            </div>
                                            <div>
                                                <Label htmlFor="piece_numero">Numéro du document *</Label>
                                                <Input id="piece_numero" value={form.piece_numero} onChange={(e) => set('piece_numero', e.target.value)} error={errors.piece_numero} required />
                                                <FieldError>{errors.piece_numero}</FieldError>
                                            </div>
                                        </div>

                                        <div className="grid gap-4 sm:grid-cols-3">
                                            <div>
                                                <Label htmlFor="piece_delivree_le">Délivrée le</Label>
                                                <Input id="piece_delivree_le" type="date" value={form.piece_delivree_le} onChange={(e) => set('piece_delivree_le', e.target.value)} error={errors.piece_delivree_le} />
                                            </div>
                                            <div>
                                                <Label htmlFor="piece_expire_le">Expire le</Label>
                                                <Input id="piece_expire_le" type="date" value={form.piece_expire_le} onChange={(e) => set('piece_expire_le', e.target.value)} error={errors.piece_expire_le} />
                                            </div>
                                            <div>
                                                <Label htmlFor="piece_autorite">Autorité de délivrance</Label>
                                                <Input id="piece_autorite" value={form.piece_autorite} onChange={(e) => set('piece_autorite', e.target.value)} error={errors.piece_autorite} />
                                            </div>
                                        </div>
                                    </Section>

                                    <Section titre="Complément" description="Facultatif — renseigné si le titulaire le communique.">
                                        <div>
                                            <Label htmlFor="numero_compte_uba">N° de compte {clientNom || ''} (si déjà client)</Label>
                                            <Input id="numero_compte_uba" value={form.numero_compte_uba} onChange={(e) => set('numero_compte_uba', e.target.value)} error={errors.numero_compte_uba} />
                                        </div>
                                        <div className="grid gap-4 sm:grid-cols-2">
                                            <div>
                                                <Label htmlFor="profession">Profession / occupation</Label>
                                                <Input id="profession" value={form.profession} onChange={(e) => set('profession', e.target.value)} error={errors.profession} />
                                            </div>
                                            <div>
                                                <Label htmlFor="employeur">Employeur</Label>
                                                <Input id="employeur" value={form.employeur} onChange={(e) => set('employeur', e.target.value)} error={errors.employeur} />
                                            </div>
                                        </div>
                                    </Section>
                                </>
                            )}

                            <div className="flex flex-col gap-2 pt-2">
                                <Button type="submit" size="lg" disabled={submitting}>
                                    {submitting ? 'Enregistrement…' : 'Valider la vente'}
                                </Button>
                                <Button href={route('dashboard')} variant="outline">Retour au dashboard</Button>
                            </div>
                        </form>
                    </CardBody>
                </Card>
            )}
        </AppLayout>
    );
}
