import { useForm } from '@inertiajs/react';
import Modal from '@/Components/ui/Modal';
import { Input, Textarea, Label, FieldError } from '@/Components/ui/Input';
import Button from '@/Components/ui/Button';

const titles = {
    arreter: (nom) => `Arrêter « ${nom} »`,
    annuler: (nom) => `Annuler « ${nom} »`,
    reprogrammer: (nom) => `Reprogrammer « ${nom} »`,
};
const routes = { arreter: 'admin.campagnes.arreter', annuler: 'admin.campagnes.annuler', reprogrammer: 'admin.campagnes.reprogrammer' };
const confirmLabels = { arreter: 'Arrêter', annuler: 'Annuler la campagne', reprogrammer: 'Reprogrammer' };

export default function CampagneModals({ campagne, open, onClose }) {
    const isReprogrammer = open === 'reprogrammer';
    const { data, setData, post, processing, errors, reset } = useForm({
        description: '',
        date_debut: campagne.date_debut_iso,
        date_fin: campagne.date_fin_iso,
    });

    if (!open) return null;

    function submit(e) {
        e.preventDefault();
        post(route(routes[open], campagne.id), { onSuccess: () => { reset(); onClose(); } });
    }

    return (
        <Modal open onClose={onClose} title={titles[open](campagne.nom)}>
            <form onSubmit={submit} className="space-y-4">
                {isReprogrammer && (
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label htmlFor="modal_date_debut">Date début *</Label>
                            <Input id="modal_date_debut" type="date" value={data.date_debut} onChange={(e) => setData('date_debut', e.target.value)} required />
                        </div>
                        <div>
                            <Label htmlFor="modal_date_fin">Date fin *</Label>
                            <Input id="modal_date_fin" type="date" value={data.date_fin} onChange={(e) => setData('date_fin', e.target.value)} required />
                        </div>
                    </div>
                )}
                <div>
                    <Label htmlFor="modal_description">Justification * (min. 10 caractères)</Label>
                    <Textarea id="modal_description" rows={3} minLength={10} value={data.description} onChange={(e) => setData('description', e.target.value)} required />
                    <FieldError>{errors.description}</FieldError>
                </div>
                <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={onClose}>Fermer</Button>
                    <Button type="submit" variant={open === 'annuler' ? 'destructive' : 'primary'} disabled={processing}>{confirmLabels[open]}</Button>
                </div>
            </form>
        </Modal>
    );
}
