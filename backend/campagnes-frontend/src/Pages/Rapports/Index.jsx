import { useMemo, useState } from 'react';
import { Head } from '@inertiajs/react';
import { Info, Download } from 'lucide-react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardHeader, CardTitle } from '@/Components/ui/Card';
import Badge from '@/Components/ui/Badge';
import Button from '@/Components/ui/Button';

// Les statuts arrivent bruts depuis la base (`en_cours`, `terminee`, …) : sans mapping
// ils s'affichaient tels quels dans l'UI.
const STATUT_LABELS = {
    en_cours: 'En cours',
    programmee: 'Programmée',
    terminee: 'Terminée',
    arretee: 'Arrêtée',
    annulee: 'Annulée',
};

const STATUT_TONES = {
    en_cours: 'green',
    programmee: 'blue',
    terminee: 'neutral',
    arretee: 'amber',
    annulee: 'red',
};

export default function RapportsIndex({ campagnes, libelleStatsCampagne, isAdmin }) {
    const [selected, setSelected] = useState([]);
    // Le cumul multi-campagnes ne gère que les campagnes de vente (pas d'équivalent enrôlement) :
    // on limite la sélection à un seul type à la fois pour éviter un cumul incohérent.
    const campagnesCumulables = campagnes.filter((c) => !c.estEnrolement);
    const allChecked = selected.length === campagnesCumulables.length && campagnesCumulables.length > 0;

    function toggle(id, type) {
        setSelected((s) => {
            if (s.includes(id)) {
                return s.filter((i) => i !== id);
            }
            const typeSelectionne = s.length > 0 ? campagnes.find((c) => c.id === s[0])?.type : null;
            if (s.length > 0 && typeSelectionne && type !== typeSelectionne) {
                return [id];
            }
            return [...s, id];
        });
    }

    function toggleAll() {
        setSelected(allChecked ? [] : campagnesCumulables.map((c) => c.id));
    }

    const cumulUrl = useMemo(() => {
        const params = new URLSearchParams();
        selected.forEach((id) => params.append('campagne_ids[]', id));
        return route('rapports.cumul') + '?' + params.toString();
    }, [selected]);

    return (
        <AppLayout title="Rapports" subtitle="Synthèses et exports par campagne">
            <Head title="Rapports" />

            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ardoise-200 bg-white px-4 py-3 text-sm">
                <p className="flex items-center gap-2 text-ardoise-600">
                    <Info size={15} className="shrink-0 text-ardoise-400" />
                    <span>
                        Cochez des campagnes puis « Voir le cumul » pour une vue agrégée.
                        {libelleStatsCampagne && (
                            <span className="text-ardoise-400"> — Périmètre par défaut : {libelleStatsCampagne}.</span>
                        )}
                    </span>
                </p>
                {isAdmin && (
                    <a
                        href={route('admin.telephonique-rapports.index')}
                        className="shrink-0 text-sm font-medium text-marque-700 hover:underline"
                    >
                        Reporting téléphonique global →
                    </a>
                )}
            </div>

            <Card className="overflow-hidden">
                <CardHeader className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle>Campagnes</CardTitle>
                    <div className="flex gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={toggleAll}>
                            {allChecked ? 'Tout désélectionner' : 'Tout sélectionner'}
                        </Button>
                        <Button href={cumulUrl} size="sm" disabled={selected.length === 0} variant="secondary">
                            Voir le cumul
                        </Button>
                    </div>
                </CardHeader>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-ardoise-100 text-xs uppercase tracking-wide text-ardoise-500">
                                <th className="px-4 py-3"></th>
                                <th className="px-4 py-3 font-medium">Nom</th>
                                <th className="px-4 py-3 font-medium">Période</th>
                                <th className="px-4 py-3 font-medium">Statut</th>
                                <th className="px-4 py-3 text-right font-medium">Total</th>
                                <th className="px-4 py-3 font-medium">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-ardoise-100">
                            {campagnes.map((c) => (
                                <tr key={c.id} className="hover:bg-ardoise-50">
                                    <td className="px-4 py-3">
                                        {!c.estEnrolement && (
                                            <input
                                                type="checkbox"
                                                checked={selected.includes(c.id)}
                                                onChange={() => toggle(c.id, c.type)}
                                                className="h-4 w-4 rounded border-ardoise-300 text-marque-700 focus:ring-marque-500/40"
                                            />
                                        )}
                                    </td>
                                    <td className="px-4 py-3 font-medium text-ardoise-900">
                                        {c.nom}
                                        {c.estEnrolement && <Badge tone="blue" className="ml-2">Enrôlement</Badge>}
                                    </td>
                                    <td className="px-4 py-3 text-ardoise-600">{c.date_debut} → {c.date_fin}</td>
                                    <td className="px-4 py-3">
                                        <Badge tone={STATUT_TONES[c.statut] ?? 'neutral'}>
                                            {STATUT_LABELS[c.statut] ?? c.statut}
                                        </Badge>
                                    </td>
                                    <td className="px-4 py-3 text-right tabular-nums text-ardoise-900">{c.nb_ventes}</td>
                                    <td className="px-4 py-3">
                                        {/* Une seule action principale par ligne : « Synthèse » est le point
                                            d'entrée analytique. Le reste en secondaire, sinon la colonne
                                            devenait un mur de boutons orange sans hiérarchie. */}
                                        <div className="flex flex-wrap gap-1.5">
                                            <Button href={route('rapports.campagnes.synthese', c.id)} size="sm">Synthèse</Button>
                                            <Button href={route('rapports.campagnes.ventes', c.id)} variant="outline" size="sm">
                                                {c.estEnrolement ? 'Enrôlements' : 'Ventes'}
                                            </Button>
                                            <Button href={route('rapports.campagnes.clients', c.id)} variant="outline" size="sm">Clients</Button>
                                            {!c.estEnrolement && (
                                                <Button href={route('rapports.campagnes.reporting-telephonique', c.id)} variant="outline" size="sm">Tél.</Button>
                                            )}
                                            <Button
                                                href={route('rapports.campagnes.export', { campagne: c.id, section: 'all', format: 'xlsx' })}
                                                target="_blank"
                                                variant="ghost"
                                                size="sm"
                                            >
                                                <Download size={13} /> Export
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {campagnes.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-4 py-8 text-center text-ardoise-500">Aucune campagne à afficher.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </AppLayout>
    );
}
