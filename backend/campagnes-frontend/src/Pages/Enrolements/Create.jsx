import { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import { CheckCircle2 } from 'lucide-react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardBody } from '@/Components/ui/Card';
import { Input, Textarea, Label, FieldError } from '@/Components/ui/Input';
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

export default function EnrolementsCreate({ campagnesOuvertes, peutEnroler, contratAccepte }) {
    const [form, setForm] = useState({
        campagne_id: campagnesOuvertes.length === 1 ? campagnesOuvertes[0].id : '',
        prenom: '',
        nom: '',
        numero_compte: '',
        telephone: '',
        adresse: '',
    });
    const [errors, setErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);

    function set(key, value) {
        setForm((f) => ({ ...f, [key]: value }));
    }

    async function submit(e) {
        e.preventDefault();
        setSubmitting(true);
        setErrors({});

        try {
            await window.axios.post('/api/enrolements', form);
            router.visit(route('enrolements.index'));
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
        <AppLayout title="Nouvel enrôlement" subtitle="Enrôler un client BDM sur l'application mobile">
            <Head title="Nouvel enrôlement" />

            {!peutEnroler ? (
                <Blocked title="Aucune campagne d'enrôlement active">Il n'y a pas de campagne d'enrôlement ouverte pour votre agence en ce moment.</Blocked>
            ) : !contratAccepte ? (
                <Blocked title="Contrat non accepté" actionHref={route('commercial.contrat')} actionLabel="Voir mon contrat">
                    Vous devez accepter le contrat de prestation de la campagne en cours avant de pouvoir enregistrer un enrôlement.
                </Blocked>
            ) : (
                <Card className="mx-auto max-w-xl">
                    <CardBody>
                        {campagnesOuvertes.length === 1 && (
                            <div className="mb-5 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3.5 py-2.5 text-sm text-green-800">
                                <CheckCircle2 size={16} />
                                Enrôlement rattaché à <strong>{campagnesOuvertes[0].nom}</strong> (fin le {campagnesOuvertes[0].date_fin})
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
                                <Label htmlFor="numero_compte">Numéro de compte *</Label>
                                <Input id="numero_compte" value={form.numero_compte} onChange={(e) => set('numero_compte', e.target.value)} error={errors.numero_compte} required />
                                <FieldError>{errors.numero_compte}</FieldError>
                            </div>

                            <div>
                                <Label htmlFor="telephone">Téléphone</Label>
                                <Input id="telephone" type="tel" value={form.telephone} onChange={(e) => set('telephone', e.target.value)} error={errors.telephone} />
                                <FieldError>{errors.telephone}</FieldError>
                            </div>

                            <div>
                                <Label htmlFor="adresse">Adresse <span className="font-normal text-ardoise-400">(optionnel)</span></Label>
                                <Textarea id="adresse" rows={2} value={form.adresse} onChange={(e) => set('adresse', e.target.value)} error={errors.adresse} />
                                <FieldError>{errors.adresse}</FieldError>
                            </div>

                            <div className="flex flex-col gap-2 pt-2">
                                <Button type="submit" size="lg" disabled={submitting}>
                                    {submitting ? 'Enregistrement…' : 'Valider l\'enrôlement'}
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
