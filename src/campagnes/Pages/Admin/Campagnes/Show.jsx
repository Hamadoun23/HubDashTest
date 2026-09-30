import { useState } from 'react';
import { Head } from '@inertiajs/react';
import { ArrowLeft, Settings } from 'lucide-react';
import AppLayout from '@campagnes/Layouts/AppLayout';
import Badge from '@campagnes/Components/ui/Badge';
import Button from '@campagnes/Components/ui/Button';
import { cn } from '@campagnes/lib/cn';
import Pilotage from './partials/Pilotage';
import Commerciaux from './partials/Commerciaux';
import Contrat from './partials/Contrat';
import Aide from './partials/Aide';
import Performances from './partials/Performances';
import Historique from './partials/Historique';
import CampagneModals from './partials/Modals';

const statutTone = { en_cours: 'green', programmee: 'blue', arretee: 'amber', annulee: 'red', terminee: 'neutral' };
const statutLabel = { en_cours: 'En cours', programmee: 'Programmée', arretee: 'Arrêtée', annulee: 'Annulée', terminee: 'Terminée' };

export default function CampagneShow(props) {
    const { campagne, isDirectionDetail, activeTab: initialTab } = props;
    const [tab, setTab] = useState(initialTab);
    const [modal, setModal] = useState(null);

    const tabs = [
        { key: 'pilotage', label: 'Pilotage' },
        { key: 'commerciaux', label: 'Commerciaux', badge: props.commerciauxPerimetre.length },
        ...(campagne.type === 'vente_carte' ? [{ key: 'contrat', label: 'Contrat' }] : []),
        ...(campagne.aide_hebdo_active ? [{ key: 'aide', label: 'Aide hebdo' }] : []),
        { key: 'performances', label: 'Performances' },
        { key: 'historique', label: 'Historique' },
    ];

    function changeTab(key) {
        setTab(key);
        // GDA Hub : l'adresse de la page est dans le « #/… » (HashRouter),
        // c'est là que l'onglet est mémorisé — et non dans la partie
        // « ?… » de l'adresse réelle, que le hub ignore.
        const [chemin, requete = ''] = window.location.hash.slice(1).split('?');
        const params = new URLSearchParams(requete);
        params.set('tab', key);
        window.history.replaceState(window.history.state, '', `#${chemin}?${params}`);
    }

    const listRoute = isDirectionDetail ? route('direction.campagnes.index') : route('admin.campagnes.index');

    return (
        <AppLayout
            title={campagne.nom}
            subtitle="Pilotage et suivi de campagne"
            actions={
                <div className="flex items-center gap-2">
                    <Button href={listRoute} variant="outline" size="sm"><ArrowLeft size={14} /> Liste</Button>
                    {!isDirectionDetail && (
                        <Button href={route('admin.campagnes.edit', campagne.id)} size="sm"><Settings size={14} /> Paramètres complets</Button>
                    )}
                </div>
            }
        >
            <Head title={campagne.nom} />

            <div className="mb-4">
                <Badge tone={statutTone[campagne.statut]}>{statutLabel[campagne.statut]}</Badge>
            </div>

            <div className="mb-4 flex flex-wrap gap-1 border-b border-gray-200">
                {tabs.map((t) => (
                    <button
                        key={t.key}
                        onClick={() => changeTab(t.key)}
                        className={cn(
                            'flex items-center gap-1.5 rounded-t-lg px-4 py-2 text-sm font-medium transition-colors',
                            tab === t.key ? 'border-b-2 border-gda-orange text-gda-orange' : 'text-gray-500 hover:text-gray-700',
                        )}
                    >
                        {t.label}
                        {t.badge !== undefined && <span className="rounded-full bg-gray-100 px-1.5 text-xs text-gray-600">{t.badge}</span>}
                    </button>
                ))}
            </div>

            {tab === 'pilotage' && <Pilotage campagne={campagne} isDirectionDetail={isDirectionDetail} onOpenModal={setModal} />}
            {tab === 'commerciaux' && (
                <Commerciaux
                    campagne={campagne}
                    isDirectionDetail={isDirectionDetail}
                    nbCommerciauxActifs={props.nbCommerciauxActifs}
                    nbCommerciauxInactifs={props.nbCommerciauxInactifs}
                    commerciauxPerimetre={props.commerciauxPerimetre}
                    commerciauxCandidats={props.commerciauxCandidats}
                    benefIds={props.benefIds}
                />
            )}
            {tab === 'contrat' && campagne.type === 'vente_carte' && <Contrat campagne={campagne} isDirectionDetail={isDirectionDetail} />}
            {tab === 'aide' && campagne.aide_hebdo_active && <Aide campagne={campagne} isDirectionDetail={isDirectionDetail} />}
            {tab === 'performances' && (
                <Performances
                    campagne={campagne}
                    estEnrolement={campagne.type === 'enrolement_app'}
                    preset={props.preset}
                    periode={props.periode}
                    telephoniqueCampagne={props.telephoniqueCampagne}
                    telephoniqueListUrl={props.telephoniqueListUrl}
                    stats={props.stats}
                    classement={props.classement}
                    primes={props.primes}
                />
            )}
            {tab === 'historique' && <Historique campagne={campagne} />}

            {!isDirectionDetail && (
                <CampagneModals campagne={campagne} open={modal} onClose={() => setModal(null)} />
            )}
        </AppLayout>
    );
}
