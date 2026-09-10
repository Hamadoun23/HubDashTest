import { useForm } from '@inertiajs/react';
import { Card, CardBody } from '@/Components/ui/Card';
import { Input, Label, FieldError } from '@/Components/ui/Input';
import Button from '@/Components/ui/Button';

export default function AgenceForm({ agence, ordreSuggest }) {
    const isEdit = !!agence;
    const { data, setData, post, put, processing, errors } = useForm({
        ordre: agence?.ordre ?? ordreSuggest ?? 0,
        nom: agence?.nom ?? '',
    });

    function submit(e) {
        e.preventDefault();
        if (isEdit) {
            put(route('admin.agences.update', agence.id));
        } else {
            post(route('admin.agences.store'));
        }
    }

    return (
        <Card className="mx-auto max-w-lg">
            <CardBody>
                <form onSubmit={submit} className="space-y-4">
                    <div>
                        <Label htmlFor="ordre">Numérotation (ordre d'affichage) *</Label>
                        <Input
                            id="ordre"
                            type="number"
                            min={0}
                            value={data.ordre}
                            onChange={(e) => setData('ordre', e.target.value)}
                            error={errors.ordre}
                            required
                        />
                        <FieldError>{errors.ordre}</FieldError>
                    </div>
                    <div>
                        <Label htmlFor="nom">Nom *</Label>
                        <Input
                            id="nom"
                            value={data.nom}
                            onChange={(e) => setData('nom', e.target.value)}
                            error={errors.nom}
                            required
                        />
                        <FieldError>{errors.nom}</FieldError>
                    </div>
                    <div className="flex gap-2 pt-2">
                        <Button type="submit" disabled={processing}>{isEdit ? 'Enregistrer' : 'Créer'}</Button>
                        <Button href={route('admin.agences.index')} variant="outline">Annuler</Button>
                    </div>
                </form>
            </CardBody>
        </Card>
    );
}
