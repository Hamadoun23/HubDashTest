import { Head } from '@inertiajs/react';
import {
    CreditCard, TrendingUp, Megaphone, Trophy, Phone, ArrowRight, CheckCircle2,
    ShieldCheck, FileBarChart, Smartphone,
} from 'lucide-react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardBody } from '@/Components/ui/Card';
import Badge from '@/Components/ui/Badge';
import Button from '@/Components/ui/Button';
import Sparkline from '@/Components/ui/Sparkline';
import Gauge from '@/Components/ui/Gauge';
import StatTile from '@/Components/ui/StatCard';
import { cn } from '@/lib/cn';

function hasData(values) {
    return Array.isArray(values) && values.some((v) => v > 0);
}

function CampagneInfoBanner({ label, children }) {
    return (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-ardoise-200 bg-white px-4 py-2.5 text-sm text-ardoise-600">
            <Badge tone="orange">{label}</Badge>
            <span>{children}</span>
        </div>
    );
}

function DashboardAdmin(props) {
    const {
        readOnly, ventesTotal, ventesMois, venteTrend, pctCommerciauxActifs, classement,
        campagnesTotal, campagneActive, campagnesEnCours, campagnesProgrammees,
        libelleStatsCampagne, user, agencesCount, commerciauxCount, estEnrolement, aDesAgences = true,
    } = props;

    // Sans aucune vente, tous les commerciaux sont ex æquo au rang 1 : afficher la liste
    // telle quelle donnait « 1 » quatre fois de suite, ce qui passait pour un bug.
    const classementActif = classement.filter((c) => (c.total_ventes ?? 0) > 0);
    const meilleur = classementActif[0] ?? null;
    // Périmètre de référence 100 % enrôlement : aucune vente n'existe, tout le vocabulaire suit.
    const libelle = estEnrolement ? 'Enrôlements' : 'Ventes';
    const aucunVolume = estEnrolement ? 'Aucun enrôlement' : 'Aucune vente';

    return (
        <>
            {libelleStatsCampagne && (
                <CampagneInfoBanner label="Campagne">
                    {libelleStatsCampagne}
                    {!campagneActive && ' — aucune campagne en cours, dernière campagne de référence'}
                </CampagneInfoBanner>
            )}

            {/* Ligne 1 — indicateurs clés */}
            <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatTile label={`${libelle} (campagne)`} value={ventesTotal} icon={estEnrolement ? Smartphone : CreditCard} trend={venteTrend} />
                <StatTile label={`${libelle} sur la période`} value={ventesMois} icon={TrendingUp} />
                <StatTile label="Campagnes" value={campagnesTotal} icon={Megaphone} />
                <StatTile
                    label="Meilleur commercial"
                    value={meilleur ? meilleur.user_name : aucunVolume}
                    icon={Trophy}
                    textValue
                    dark
                />
            </div>

            {/* Ligne 2 — tendance, objectif, profil */}
            <div className="mb-4 grid gap-4 lg:grid-cols-5">
                <Card className="lg:col-span-2">
                    <CardBody>
                        <p className="text-sm font-semibold text-ardoise-900">Tendance des {libelle.toLowerCase()}</p>
                        <p className="mb-4 text-xs text-ardoise-500">6 dernières semaines</p>
                        {hasData(venteTrend) ? (
                            <Sparkline values={venteTrend} height={64} />
                        ) : (
                            <p className="flex h-16 items-center text-sm text-ardoise-400">{aucunVolume} sur la période.</p>
                        )}
                    </CardBody>
                </Card>

                <Card className="flex flex-col items-center justify-center lg:col-span-1">
                    <CardBody className="flex flex-col items-center">
                        <Gauge value={pctCommerciauxActifs} label="commerciaux actifs" gradient />
                    </CardBody>
                </Card>

                <Card className="lg:col-span-2">
                    <CardBody>
                        <div className="flex items-center gap-3">
                            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-marque-700 text-sm font-semibold text-white">
                                {(user.display_name || '?').charAt(0).toUpperCase()}
                            </span>
                            <div>
                                <p className="text-sm font-semibold text-ardoise-900">{user.display_name}</p>
                                <p className="text-xs text-ardoise-500">{user.agence_nom || 'Administration globale'}</p>
                            </div>
                        </div>
                        <div className={cn(
                            'mt-4 grid gap-3 border-t border-ardoise-100 pt-3 text-center',
                            aDesAgences ? 'grid-cols-2' : 'grid-cols-1',
                        )}>
                            {aDesAgences && (
                                <div>
                                    <p className="text-lg font-semibold text-ardoise-900">{agencesCount}</p>
                                    <p className="text-xs text-ardoise-500">Agences</p>
                                </div>
                            )}
                            <div>
                                <p className="text-lg font-semibold text-ardoise-900">{commerciauxCount}</p>
                                <p className="text-xs text-ardoise-500">Commerciaux</p>
                            </div>
                        </div>
                    </CardBody>
                </Card>
            </div>

            {/* Ligne 3 — campagne active, top performances, action rapide */}
            <div className="grid items-start gap-4 lg:grid-cols-5">
                <Card className="lg:col-span-2">
                    <CardBody>
                        <p className="text-xs font-medium uppercase tracking-wide text-ardoise-500">Campagne</p>
                        {campagneActive ? (
                            <>
                                <p className="mt-2 text-lg font-semibold text-ardoise-900">{campagneActive.nom}</p>
                                <p className="mt-1 text-sm text-ardoise-500">
                                    {campagneActive.date_debut} – {campagneActive.date_fin}
                                </p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    <Badge tone="orange">En cours</Badge>
                                    {campagnesProgrammees > 0 && (
                                        <Badge>{campagnesProgrammees} programmée(s)</Badge>
                                    )}
                                </div>
                            </>
                        ) : (
                            <p className="mt-2 text-sm text-ardoise-500">
                                {campagnesEnCours || campagnesProgrammees
                                    ? `${campagnesEnCours} en cours • ${campagnesProgrammees} programmée(s)`
                                    : 'Aucune campagne active pour le moment.'}
                            </p>
                        )}
                        <Button
                            href={readOnly ? route('direction.campagnes.index') : route('admin.campagnes.index')}
                            variant="outline"
                            size="sm"
                            className="mt-4"
                        >
                            Voir les campagnes <ArrowRight size={14} />
                        </Button>
                    </CardBody>
                </Card>

                <Card className="lg:col-span-2">
                    <CardBody>
                        <div className="mb-3 flex items-center justify-between">
                            <p className="text-sm font-semibold text-ardoise-900">Top performances</p>
                            <Trophy className="h-4 w-4 text-ardoise-400" size={16} />
                        </div>
                        {classementActif.length === 0 ? (
                            <p className="text-sm text-ardoise-500">
                                {aucunVolume} enregistré{estEnrolement ? '' : 'e'} sur la campagne de référence.
                            </p>
                        ) : (
                            <ul className="space-y-1">
                                {classementActif.slice(0, 4).map((c) => (
                                    <li key={c.user_id} className="flex items-center justify-between py-1.5 text-sm">
                                        <span className="flex min-w-0 items-center gap-2.5">
                                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ardoise-100 text-xs font-semibold text-ardoise-600">
                                                {c.rang}
                                            </span>
                                            <span className="truncate text-ardoise-800">{c.user_name}</span>
                                        </span>
                                        <Badge tone="green">+{c.total_ventes}</Badge>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardBody>
                </Card>

                <Card className="lg:col-span-1">
                    <CardBody className="flex flex-col items-center text-center">
                        <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                            <FileBarChart size={18} />
                        </span>
                        <p className="text-sm font-semibold text-ardoise-900">Rapports</p>
                        <p className="mt-1 text-xs text-ardoise-500">Synthèses et exports par campagne.</p>
                        <Button href={route('rapports.index')} variant="outline" size="sm" className="mt-4 w-full">
                            Consulter
                        </Button>
                    </CardBody>
                </Card>
            </div>
        </>
    );
}

function DashboardCommercial(props) {
    const { peutVendre, peutEnroler, vente, enrolement } = props;

    return (
        <>
            {!peutVendre && !peutEnroler && (
                <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    <strong>Aucune campagne active.</strong> Aucune campagne ouverte pour votre agence en ce moment, ou
                    les campagnes concernées sont terminées / arrêtées.
                </div>
            )}

            {peutVendre && (
                <div className="mb-6">
                    <div className="mb-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                        {vente.campagnesOuvertes.length > 1 ? (
                            <>
                                <p className="mb-1 font-medium">{vente.campagnesOuvertes.length} campagnes de vente ouvertes — précisez laquelle à l'enregistrement.</p>
                                <ul className="ml-4 list-disc space-y-0.5">
                                    {vente.campagnesOuvertes.map((c) => (
                                        <li key={c.nom}>{c.nom} <span className="opacity-70">(jusqu'au {c.date_fin})</span></li>
                                    ))}
                                </ul>
                            </>
                        ) : (
                            <span className="flex items-center gap-1.5">
                                <CheckCircle2 size={15} />
                                Campagne de vente en cours : <strong>{vente.campagneActive?.nom}</strong> (jusqu'au {vente.campagneActive?.date_fin})
                            </span>
                        )}
                    </div>

                    {vente.libelleStatsCampagne && <CampagneInfoBanner label="Stats vente">{vente.libelleStatsCampagne}</CampagneInfoBanner>}

                    <div className="mb-3 grid gap-4 sm:grid-cols-2">
                        <StatTile label="Mes ventes" value={vente.mesVentes} icon={CreditCard} />
                        <StatTile label="Mon classement" value={vente.monRang ? `Top ${vente.monRang}` : '—'} icon={Trophy} />
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <Button href={route('ventes.create')}>Nouvelle vente</Button>
                        <Button href={route('ventes.index')} variant="outline">Historique des ventes</Button>
                    </div>
                </div>
            )}

            {peutEnroler && (
                <div className="mb-6">
                    <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                        {enrolement.campagnesOuvertes.length > 1 ? (
                            <>
                                <p className="mb-1 font-medium">{enrolement.campagnesOuvertes.length} campagnes d'enrôlement ouvertes — précisez laquelle à l'enregistrement.</p>
                                <ul className="ml-4 list-disc space-y-0.5">
                                    {enrolement.campagnesOuvertes.map((c) => (
                                        <li key={c.nom}>{c.nom} <span className="opacity-70">(jusqu'au {c.date_fin})</span></li>
                                    ))}
                                </ul>
                            </>
                        ) : (
                            <span className="flex items-center gap-1.5">
                                <CheckCircle2 size={15} />
                                Campagne d'enrôlement en cours : <strong>{enrolement.campagneActive?.nom}</strong> (jusqu'au {enrolement.campagneActive?.date_fin})
                            </span>
                        )}
                    </div>

                    <div className="mb-3 grid gap-4 sm:grid-cols-2">
                        <StatTile label="Mes enrôlements" value={enrolement.mesEnrolements} icon={Smartphone} />
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <Button href={route('enrolements.create')}>Nouvel enrôlement</Button>
                        <Button href={route('enrolements.index')} variant="outline">Historique des enrôlements</Button>
                    </div>
                </div>
            )}

            <div className="flex flex-wrap gap-2 border-t border-ardoise-100 pt-4">
                <Button href={route('commercial.contrat')} variant="outline">Mon contrat</Button>
                <Button href={route('performances.index')} variant="outline">Performances</Button>
            </div>
        </>
    );
}

function DashboardTelephonique(props) {
    const { campagneActive, signataire } = props;

    return (
        <>
            <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                Vous saisissez le <strong>reporting d'appels</strong> (fiche journalière). Le{' '}
                <strong>contrat de prestation</strong> et les éventuelles aides restent disponibles si vous êtes
                signataire de la campagne en cours.
            </div>

            {campagneActive ? (
                <Card className="mb-6">
                    <CardBody>
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ardoise-500">Campagne concernant votre agence</p>
                        <p className="text-base font-medium text-ardoise-900">{campagneActive.nom}</p>
                        <p className="mt-0.5 text-sm text-ardoise-500">{campagneActive.date_debut} – {campagneActive.date_fin}</p>
                        <div className="mt-3">
                            {signataire ? (
                                <Badge tone="green">Signataire du contrat</Badge>
                            ) : (
                                <Badge tone="amber">Signataire non enregistrée</Badge>
                            )}
                        </div>
                    </CardBody>
                </Card>
            ) : (
                <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    Aucune campagne active pour votre agence pour le moment.
                </div>
            )}

            <div className="flex flex-wrap gap-2">
                <Button href={route('commercial.telephonique.create')}><Phone size={15} /> Saisir la fiche du jour</Button>
                <Button href={route('commercial.telephonique.index')} variant="outline">Historique des fiches</Button>
                <Button href={route('commercial.contrat')} variant="outline">Mon contrat</Button>
                <Button href={route('performances.index')} variant="outline">Performances équipe</Button>
            </div>
        </>
    );
}

function DashboardGuest() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-ardoise-50 text-center">
            <Head title="Accueil" />
            <ShieldCheck className="mb-3 h-10 w-10 text-marque-700" />
            <h2 className="text-2xl font-semibold text-ardoise-900">Bienvenue sur BDM</h2>
            <p className="mt-2 text-sm text-ardoise-500">Système de gestion des ventes de cartes</p>
            <Button href={route('login')} className="mt-5">Se connecter</Button>
        </div>
    );
}

export default function Dashboard(props) {
    const { variant, readOnly } = props;

    // Personne n'est connecte : `AppLayout` suppose le contraire — sa barre
    // laterale lit `auth.user.is_direction` sans le proteger d'un utilisateur
    // nul, et la page plantait avant meme d'afficher le message de bienvenue.
    // Au-dela du plantage, cette coquille n'a de toute facon rien a proposer
    // a un visiteur anonyme : ni menu, ni deconnexion, ni avatar.
    if (variant === 'guest') {
        return <DashboardGuest />;
    }

    const titles = {
        admin: readOnly ? 'Dashboard Direction' : 'Dashboard Admin',
        commercial: null,
        telephonique: 'Espace téléopératrice',
    };

    return (
        <AppLayout title={variant === 'admin' || variant === 'telephonique' ? titles[variant] : undefined}>
            <Head title="Dashboard" />
            {variant === 'admin' && <DashboardAdmin {...props} />}
            {variant === 'commercial' && <DashboardCommercial {...props} />}
            {variant === 'telephonique' && <DashboardTelephonique {...props} />}
        </AppLayout>
    );
}
