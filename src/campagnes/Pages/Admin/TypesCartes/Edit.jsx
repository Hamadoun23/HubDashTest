import { Head, useForm } from '@inertiajs/react';
import AppLayout from '@campagnes/Layouts/AppLayout';
import { Card, CardBody } from '@campagnes/Components/ui/Card';
import Checkbox from '@campagnes/Components/ui/Checkbox';
import Button from '@campagnes/Components/ui/Button';

export default function TypesCartesEdit({ typeCarte }) {
    const { data, setData, put, processing } = useForm({
        actif: typeCarte.actif,
    });

    function submit(e) {
        e.preventDefault();
        put(route('admin.types-cartes.update', typeCarte.id));
    }

    return (
        <AppLayout title={`Modifier : ${typeCarte.code}`} subtitle="Type de carte">
            <Head title="Modifier type de carte" />
            <Card className="mx-auto max-w-lg">
                <CardBody>
                    <p className="mb-4 text-sm text-gray-500">
                        Code : <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-700">{typeCarte.code}</code> (non modifiable)
                    </p>
                    <form onSubmit={submit} className="space-y-4">
                        <Checkbox
                            id="actif"
                            label="Actif"
                            checked={data.actif}
                            onChange={(e) => setData('actif', e.target.checked)}
                        />
                        <div className="flex gap-2 pt-2">
                            <Button type="submit" disabled={processing}>Enregistrer</Button>
                            <Button href={route('admin.types-cartes.index')} variant="outline">Annuler</Button>
                        </div>
                    </form>
                </CardBody>
            </Card>
        </AppLayout>
    );
}
