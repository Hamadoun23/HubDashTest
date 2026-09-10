import { Head, useForm } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardBody } from '@/Components/ui/Card';
import { Input, Label, FieldError } from '@/Components/ui/Input';
import Checkbox from '@/Components/ui/Checkbox';
import Button from '@/Components/ui/Button';

export default function TypesCartesCreate() {
    const { data, setData, post, processing, errors } = useForm({
        code: '',
        actif: true,
    });

    function submit(e) {
        e.preventDefault();
        post(route('admin.types-cartes.store'));
    }

    return (
        <AppLayout title="Nouveau type de carte" subtitle="Ajouter un produit au référentiel">
            <Head title="Nouveau type de carte" />
            <Card className="mx-auto max-w-lg">
                <CardBody>
                    <form onSubmit={submit} className="space-y-4">
                        <div>
                            <Label htmlFor="code">Code *</Label>
                            <Input
                                id="code"
                                value={data.code}
                                onChange={(e) => setData('code', e.target.value)}
                                error={errors.code}
                                placeholder="Ex: VIP, ADAN, GDA"
                                required
                            />
                            <p className="mt-1 text-xs text-ardoise-500">Identifiant unique (sera normalisé en majuscules).</p>
                            <FieldError>{errors.code}</FieldError>
                        </div>
                        <Checkbox
                            id="actif"
                            label="Actif (visible pour les ventes)"
                            checked={data.actif}
                            onChange={(e) => setData('actif', e.target.checked)}
                        />
                        <div className="flex gap-2 pt-2">
                            <Button type="submit" disabled={processing}>Créer</Button>
                            <Button href={route('admin.types-cartes.index')} variant="outline">Annuler</Button>
                        </div>
                    </form>
                </CardBody>
            </Card>
        </AppLayout>
    );
}
