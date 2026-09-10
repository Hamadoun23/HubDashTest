import { useForm } from '@inertiajs/react';
import { Card, CardBody } from '@/Components/ui/Card';
import { Input, PasswordInput, Textarea, Label, FieldError } from '@/Components/ui/Input';
import { Select } from '@/Components/ui/Select';
import Checkbox from '@/Components/ui/Checkbox';
import Button from '@/Components/ui/Button';

export default function UserForm({ user, agences, aDesAgences = true, clientNom }) {
    const isEdit = !!user;
    const { data, setData, post, put, processing, errors } = useForm({
        name: user?.name ?? '',
        prenom: user?.prenom ?? '',
        telephone: user?.telephone ?? '',
        email: user?.email ?? '',
        password: '',
        password_confirmation: '',
        role: user?.role ?? 'commercial',
        agence_id: user?.agence_id ?? '',
        actif: user?.actif ?? true,
        adresse_contrat: user?.adresse_contrat ?? '',
        piece_identite_ref: user?.piece_identite_ref ?? '',
    });

    const isDirection = data.role === 'direction';
    const isTerrainOuTel = data.role === 'commercial' || data.role === 'commercial_telephonique';

    function submit(e) {
        e.preventDefault();
        if (isEdit) {
            put(route('admin.users.update', user.id));
        } else {
            post(route('admin.users.store'));
        }
    }

    return (
        <Card className="mx-auto max-w-2xl">
            <CardBody>
                <form onSubmit={submit} className="space-y-5">
                    <div className="grid gap-4 sm:grid-cols-3">
                        <div>
                            <Label htmlFor="name">Nom *</Label>
                            <Input id="name" value={data.name} onChange={(e) => setData('name', e.target.value)} error={errors.name} required />
                            <FieldError>{errors.name}</FieldError>
                        </div>
                        <div>
                            <Label htmlFor="prenom">Prénom</Label>
                            <Input id="prenom" value={data.prenom} onChange={(e) => setData('prenom', e.target.value)} error={errors.prenom} />
                        </div>
                        <div>
                            <Label htmlFor="telephone">Téléphone *</Label>
                            <Input id="telephone" value={data.telephone} onChange={(e) => setData('telephone', e.target.value)} error={errors.telephone} required />
                            <p className="mt-1 text-xs text-ardoise-500">Identifiant de connexion.</p>
                            <FieldError>{errors.telephone}</FieldError>
                        </div>
                    </div>

                    {isDirection && (
                        <div>
                            <Label htmlFor="email">E-mail <span className="font-normal text-ardoise-400">(Direction — facultatif)</span></Label>
                            <Input id="email" type="email" value={data.email} onChange={(e) => setData('email', e.target.value)} error={errors.email} />
                            <FieldError>{errors.email}</FieldError>
                        </div>
                    )}

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <Label htmlFor="password">{isEdit ? 'Nouveau mot de passe' : 'Mot de passe *'}</Label>
                            <PasswordInput
                                id="password"
                                value={data.password}
                                onChange={(e) => setData('password', e.target.value)}
                                error={errors.password}
                                required={!isEdit}
                            />
                            {isEdit && <p className="mt-1 text-xs text-ardoise-500">Laisser vide pour conserver l'actuel.</p>}
                            <FieldError>{errors.password}</FieldError>
                        </div>
                        <div>
                            <Label htmlFor="password_confirmation">Confirmer mot de passe{!isEdit && ' *'}</Label>
                            <PasswordInput
                                id="password_confirmation"
                                value={data.password_confirmation}
                                onChange={(e) => setData('password_confirmation', e.target.value)}
                                required={!isEdit}
                            />
                        </div>
                    </div>

                    <div>
                        <Label htmlFor="role">Rôle *</Label>
                        <Select id="role" value={data.role} onChange={(e) => setData('role', e.target.value)}>
                            <option value="commercial">Commercial terrain (ventes)</option>
                            <option value="commercial_telephonique">Commercial téléphonique (reporting appels)</option>
                            <option value="direction">Direction (lecture & exports)</option>
                        </Select>
                    </div>

                    {/* Un client sans réseau d'agences rattache ses commerciaux directement. */}
                    {aDesAgences ? (
                        <div>
                            <Label htmlFor="agence_id">Agence {!isDirection && <span className="text-ardoise-400">*</span>}</Label>
                            <Select
                                id="agence_id"
                                value={data.agence_id}
                                onChange={(e) => setData('agence_id', e.target.value)}
                                disabled={isDirection}
                                error={errors.agence_id}
                            >
                                <option value="">— Sélectionner —</option>
                                {agences.map((a) => <option key={a.id} value={a.id}>{a.nom}</option>)}
                            </Select>
                            <p className="mt-1 text-xs text-ardoise-500">Obligatoire pour un commercial uniquement.</p>
                            <FieldError>{errors.agence_id}</FieldError>
                        </div>
                    ) : (
                        <p className="rounded-lg bg-ardoise-50 px-3.5 py-2.5 text-xs text-ardoise-500">
                            {clientNom || 'Ce client'} n'a pas de réseau d'agences : ce compte est
                            rattaché directement au client.
                        </p>
                    )}

                    {isTerrainOuTel && (
                        <div className="space-y-4 border-t border-ardoise-100 pt-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-ardoise-500">Contrat de prestation</p>
                            <div>
                                <Label htmlFor="adresse_contrat">Adresse (contrat)</Label>
                                <Textarea id="adresse_contrat" rows={2} value={data.adresse_contrat} onChange={(e) => setData('adresse_contrat', e.target.value)} />
                            </div>
                            <div>
                                <Label htmlFor="piece_identite_ref">Réf. pièce d'identité</Label>
                                <Input id="piece_identite_ref" value={data.piece_identite_ref} onChange={(e) => setData('piece_identite_ref', e.target.value)} />
                            </div>
                        </div>
                    )}

                    <Checkbox
                        id="actif"
                        label="Compte actif (peut se connecter)"
                        checked={data.actif}
                        onChange={(e) => setData('actif', e.target.checked)}
                    />

                    <div className="flex gap-2 pt-2">
                        <Button type="submit" disabled={processing}>{isEdit ? 'Enregistrer' : 'Créer'}</Button>
                        <Button href={route('admin.users.index')} variant="outline">Annuler</Button>
                        {isEdit && aDesAgences && user.is_commercial_ou_telephonique && (
                            <Button href={route('admin.users.transfert-agence', user.id)} variant="ghost" className="ml-auto">
                                Transfert d'agence / ventes
                            </Button>
                        )}
                    </div>
                </form>
            </CardBody>
        </Card>
    );
}
