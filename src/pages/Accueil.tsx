import {
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Crown,
  Download,
  ListChecks,
  MoreVertical,
  Pencil,
  Settings,
  Target,
  Trophy,
  Users2,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, AvatarStack } from '../components/ui/Avatar';
import { Card } from '../components/ui/Card';
import { CircularProgress } from '../components/ui/CircularProgress';
import { DualTrendChart } from '../components/ui/DualTrendChart';
import { PageHeader } from '../components/ui/PageHeader';
import { ProgressBar } from '../components/ui/ProgressBar';
import { Badge } from '../components/ui/Table';
import { ResumePlanning } from '../components/ResumePlanning';
import { useAuth } from '../lib/auth/AuthContext';
import { useApi } from '../lib/hooks/useApi';
import { mesDemandes, monSolde } from '../lib/api/rh';
import { NOM_APP, useUrgences } from '../lib/urgences';
import type { AppKey } from '../lib/navigation';
import { listerClients } from '../lib/api/planning';
import { usePermissionsPlanning } from './planning/permissions';

const MOIS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

/** Écran d'accueil du hub : le vrai tableau de bord de l'utilisateur, pas un lanceur
 * d'applications — celles-ci vivent en permanence dans la Sidebar (voir Sidebar.tsx). */
export default function Accueil() {
  const { identite, applications } = useAuth();
  const annee = new Date().getFullYear();
  const [ongletObjectif, setOngletObjectif] = useState<'maintenant' | 'progression'>('maintenant');
  const [ongletTout, setOngletTout] = useState<'taches' | 'controle' | 'historique'>('taches');

  const accesRh = applications.some((a) => a.chemin.startsWith('/rh'));
  const accesPlanning = applications.some((a) => a.chemin.startsWith('/planning'));
  const { estClient: estClientPlanning } = usePermissionsPlanning();
  const monClientPlanning = useApi(
    () => (accesPlanning && estClientPlanning ? listerClients() : Promise.resolve([])),
    [accesPlanning, estClientPlanning],
  );
  const nomAffiche = monClientPlanning.donnees?.[0]?.nom_entreprise ?? identite?.nom_complet.split(' ')[0];
  const solde = useApi(() => (accesRh ? monSolde(annee) : Promise.resolve(null)), [accesRh, annee]);
  const demandes = useApi(() => (accesRh ? mesDemandes() : Promise.resolve([])), [accesRh]);
  // Urgences de toutes mes applis (RH, Jus, Chantiers, Planning) : elles
  // alimentent le suivi des tâches, la priorité et « À traiter ».
  const { urgences, hautes, parApp, projets } = useUrgences();
  const prioritaire = urgences[0];
  const avecUrgences = applications.length > 0;

  const listeDemandes = demandes.donnees ?? [];
  const enCours = listeDemandes.filter((d) => d.statut === 'EN_VALIDATION' || d.statut === 'BROUILLON');
  const approuvees = listeDemandes.filter((d) => d.statut === 'APPROUVE' || d.statut === 'CLOTURE');
  const tauxApprobation = listeDemandes.length > 0 ? (approuvees.length / listeDemandes.length) * 100 : 0;
  const pctUrgents = urgences.length > 0 ? (hautes.length / urgences.length) * 100 : 0;
  const avancementChantiers = projets.length ? projets.reduce((t, p) => t + (p.overall_progress ?? 0), 0) / projets.length : null;

  const ratioConges = solde.donnees
    ? (solde.donnees.jours_restants / (solde.donnees.jours_acquis + solde.donnees.jours_reportes || 1)) * 100
    : 0;

  // Deux séries réelles, calculées sur les 6 derniers mois de mes demandes :
  // taux d'approbation du mois, et volume de demandes relatif au mois le plus chargé.
  const parMois = new Map<string, { total: number; approuvees: number }>();
  for (const d of listeDemandes) {
    const cle = d.cree_le.slice(0, 7);
    const entree = parMois.get(cle) ?? { total: 0, approuvees: 0 };
    entree.total += 1;
    if (d.statut === 'APPROUVE' || d.statut === 'CLOTURE') entree.approuvees += 1;
    parMois.set(cle, entree);
  }
  const moisTries = Array.from(parMois.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-6);
  const volumeMax = Math.max(...moisTries.map(([, v]) => v.total), 1);
  const labelsChart = moisTries.map(([cle]) => MOIS[Number(cle.slice(5, 7)) - 1] ?? cle);
  const serieApprobation = moisTries.map(([, v]) => (v.total > 0 ? (v.approuvees / v.total) * 100 : 0));
  const serieVolume = moisTries.map(([, v]) => (v.total / volumeMax) * 100);

  return (
    <div>
      <PageHeader
        icon={ListChecks}
        titre={identite ? `Bonjour ${nomAffiche}` : 'Tableau de bord'}
        sousTitre="Ce qui vous concerne aujourd'hui"
      />

      {!accesRh && accesPlanning && estClientPlanning ? (
        <ResumePlanning />
      ) : !avecUrgences ? (
        <Card className="py-10 text-center text-sm text-muted">
          Votre tableau de bord personnel apparaîtra ici une fois rattaché à une application du hub.
        </Card>
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr] lg:gap-4">
            {/* --- Colonne gauche : suivi de mes tâches ------------------- */}
            <div>
              <div className="mb-3 flex items-center gap-2">
                <ListChecks size={16} className="text-accent2" />
                <h2 className="text-sm font-bold text-white">Suivi de mes tâches</h2>
                <span className="text-xs font-semibold text-muted">
                  {hautes.length}/{urgences.length}
                </span>
                <ChevronRight size={14} className="ml-auto text-muted" />
              </div>

              <div className="mb-4 grid gap-4 sm:grid-cols-2">
                {accesRh ? (
                <Card className="flex flex-col gap-3">
                  <div className="flex items-start justify-between">
                    <p className="text-xs text-muted">Mes congés</p>
                    <ArrowUpRight size={14} className="text-muted" />
                  </div>
                  <div className="flex items-center gap-3">
                    <CircularProgress progress={ratioConges} size={56} strokeWidth={6} gradientId="accueil-conges-mini-gradient" />
                    <div>
                      <p className="text-lg font-bold text-white">{Math.round(ratioConges)}%</p>
                      <p className="text-xs text-muted">Solde disponible</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted">
                    <Calendar size={12} />
                    {solde.donnees ? `${solde.donnees.jours_restants} jours restants` : '—'}
                  </div>
                  <Link to="/rh/absences" className="flex items-center justify-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-xs font-bold text-black">
                    Voir mes congés
                    <ArrowUpRight size={13} />
                  </Link>
                </Card>
                ) : (
                <Card className="flex flex-col gap-3">
                  <div className="flex items-start justify-between">
                    <p className="text-xs text-muted">Par application</p>
                    <ArrowUpRight size={14} className="text-muted" />
                  </div>
                  {Object.keys(parApp).length === 0 ? (
                    <p className="py-6 text-center text-xs text-muted">Rien d'urgent dans vos applis.</p>
                  ) : (
                    (Object.entries(parApp) as [AppKey, number][]).map(([app, n]) => (
                      <div key={app} className="flex items-center justify-between text-xs">
                        <span className="text-white">{NOM_APP[app]}</span>
                        <span className="font-semibold text-accent2">{n}</span>
                      </div>
                    ))
                  )}
                </Card>
                )}

                <Card className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <Zap size={16} className="text-accent2" />
                    {prioritaire && prioritaire.gravite === 'haute' && (
                      <Badge tone="danger">Priorité haute</Badge>
                    )}
                  </div>
                  {prioritaire ? (
                    <>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-accent2">{NOM_APP[prioritaire.app]}</p>
                      <p className="text-sm font-bold text-white">{prioritaire.titre}</p>
                      <p className="truncate text-xs text-muted">{prioritaire.detail}</p>
                      <div className="mt-1 flex items-center justify-between text-xs">
                        <span className="text-muted">Éléments à traiter</span>
                        <span className="font-semibold text-white">{urgences.length}</span>
                      </div>
                      <ProgressBar progress={100 - pctUrgents} />
                      <Link to={prioritaire.lien} className="mt-1 flex items-center justify-center gap-1.5 rounded-xl border border-border bg-surface2 px-4 py-2 text-xs font-bold text-white">
                        Voir les détails
                        <ArrowUpRight size={13} />
                      </Link>
                    </>
                  ) : (
                    <p className="py-6 text-center text-xs text-muted">Rien d'urgent dans vos applis.</p>
                  )}
                </Card>
              </div>

              {prioritaire ? (
                <Card className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-br from-accent to-accent2">
                  <div className="flex items-center gap-3">
                    <Avatar label={prioritaire.personne} email={prioritaire.email} size={38} />
                    <div>
                      <p className="text-sm font-bold text-black">{prioritaire.personne}</p>
                      <p className="text-xs text-black/70">
                        {urgences.length} élément{urgences.length > 1 ? 's' : ''} à traiter dans vos applis !
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {urgences.length > 1 && <AvatarStack labels={urgences.slice(1, 4).map((u) => u.personne)} size={22} />}
                    <Link to={prioritaire.lien} className="flex items-center gap-1 rounded-xl bg-black/15 px-3 py-2 text-xs font-bold text-black">
                      <Calendar size={12} />
                      Traiter
                      <ChevronRight size={13} />
                    </Link>
                  </div>
                </Card>
              ) : (
                <Card className="text-center text-sm text-muted">Aucun élément urgent pour le moment.</Card>
              )}
            </div>

            {/* --- Colonne droite : performance --------------------------- */}
            <div>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold text-white">Ma performance</h2>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                    <ArrowUpRight size={12} className="text-accent2" />
                    Vue sur les 6 derniers mois
                  </p>
                </div>
                <div className="flex items-center gap-1 rounded-full border border-border bg-surface2 p-0.5 text-xs">
                  <button className="rounded-full px-2.5 py-1 text-muted">Tout</button>
                  <button className="rounded-full bg-accent px-2.5 py-1 font-bold text-black">Mensuel</button>
                </div>
              </div>

              <div className="mb-4 grid grid-cols-3 gap-2 sm:gap-3">
                <Card className="flex flex-col gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-400/20">
                    <CheckCircle2 size={15} className="text-emerald-400" />
                  </span>
                  <p className="font-display text-xl font-bold text-white">
                    {accesRh || avancementChantiers === null ? `${Math.round(tauxApprobation)}%` : `${Math.round(avancementChantiers)}%`}
                  </p>
                  <p className="text-xs text-muted">{accesRh || avancementChantiers === null ? 'Approuvées' : 'Avancement chantiers'}</p>
                </Card>
                <Card className="flex flex-col gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/20">
                    <ArrowUpRight size={15} className="text-accent2" />
                  </span>
                  <p className="font-display text-xl font-bold text-white">
                    {accesRh ? `${listeDemandes.length > 0 ? Math.round((enCours.length / listeDemandes.length) * 100) : 0}%` : urgences.length}
                  </p>
                  <p className="text-xs text-muted">{accesRh ? 'En cours' : 'À traiter'}</p>
                </Card>
                <Card className="flex flex-col gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-400/20">
                    <Users2 size={15} className="text-violet-400" />
                  </span>
                  <p className="font-display text-xl font-bold text-white">{hautes.length}</p>
                  <p className="text-xs text-muted">Urgences</p>
                </Card>
              </div>

              <Card>
                <div className="mb-1 flex items-center justify-between">
                  <h2 className="text-sm font-bold text-white">Taux d'approbation & volume</h2>
                  <button className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted">
                    <Download size={13} />
                  </button>
                </div>
                {labelsChart.length > 0 ? (
                  <DualTrendChart
                    labels={labelsChart}
                    series={[
                      { nom: "Taux d'approbation", couleur: '#ff6a2b', points: serieApprobation },
                      { nom: 'Volume de demandes', couleur: '#c9b8ab', points: serieVolume },
                    ]}
                  />
                ) : (
                  <p className="py-10 text-center text-xs text-muted">Pas encore assez de demandes pour tracer une tendance.</p>
                )}
              </Card>
            </div>
          </div>

          {/* --- Tout sur vous ------------------------------------------- */}
          <div className="mt-6 mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Crown size={16} className="text-accent2" />
              <h2 className="text-sm font-bold text-white">Tout sur vous</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  { cle: 'taches', libelle: 'Mes demandes' },
                  { cle: 'controle', libelle: 'Points de contrôle' },
                  { cle: 'historique', libelle: 'Historique' },
                ] as const
              ).map((o) => (
                <button
                  key={o.cle}
                  onClick={() => setOngletTout(o.cle)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    ongletTout === o.cle ? 'bg-accent text-black' : 'bg-surface2 text-muted hover:text-white'
                  }`}
                >
                  {o.libelle}
                </button>
              ))}
              <div className="ml-2 flex items-center gap-1.5">
                <Link to="/rh/absences" className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted hover:text-white">
                  <Calendar size={14} />
                </Link>
                <Link to="/mon-compte" className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted hover:text-white">
                  <Pencil size={14} />
                </Link>
                <Link to="/rh/annuaire" className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted hover:text-white">
                  <Users2 size={14} />
                </Link>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted">
                  <Trophy size={14} />
                </span>
                <Link to="/mon-compte" className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted hover:text-white">
                  <Settings size={14} />
                </Link>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Card>
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target size={15} className="text-accent2" />
                  <h3 className="text-sm font-bold text-white">Objectif principal</h3>
                </div>
                <div className="flex items-center gap-1 rounded-full border border-border bg-surface2 p-0.5 text-[11px]">
                  <button
                    onClick={() => setOngletObjectif('maintenant')}
                    className={`rounded-full px-2 py-1 font-semibold ${ongletObjectif === 'maintenant' ? 'bg-accent text-black' : 'text-muted'}`}
                  >
                    Maintenant
                  </button>
                  <button
                    onClick={() => setOngletObjectif('progression')}
                    className={`rounded-full px-2 py-1 font-semibold ${ongletObjectif === 'progression' ? 'bg-accent text-black' : 'text-muted'}`}
                  >
                    Progression
                  </button>
                </div>
              </div>
              {listeDemandes.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted">Aucune demande cette année.</p>
              ) : (
                <div className="flex flex-col gap-4">
                  <div>
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-semibold text-white">Congés pris</p>
                        <p className="text-muted">Solde {annee}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{Math.round(100 - ratioConges)}%</span>
                        <CheckCircle2 size={14} className="text-emerald-400" />
                      </div>
                    </div>
                    <ProgressBar progress={100 - ratioConges} />
                  </div>
                  <div>
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-semibold text-white">Demandes approuvées</p>
                        <p className="text-muted">
                          {approuvees.length}/{listeDemandes.length}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{Math.round(tauxApprobation)}%</span>
                        <CheckCircle2 size={14} className="text-emerald-400" />
                      </div>
                    </div>
                    <ProgressBar progress={tauxApprobation} />
                  </div>
                </div>
              )}
            </Card>

            <Card>
              <div className="mb-1 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users2 size={15} className="text-accent2" />
                  <h3 className="text-sm font-bold text-white">À traiter</h3>
                </div>
                <ArrowUpRight size={14} className="text-muted" />
              </div>
              <p className="mb-3 text-xs text-muted">Toutes vos applis</p>
              {urgences.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted">Rien d'urgent pour le moment.</p>
              ) : (
                <div className="space-y-2">
                  {urgences.slice(0, 3).map((u) => (
                    <Link key={u.cle} to={u.lien} className="flex items-center justify-between gap-2 rounded-xl bg-surface2 px-3 py-2 hover:bg-surface2/70">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Avatar label={u.personne} email={u.email} size={26} />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-white">{u.titre}</p>
                          <p className="truncate text-xs text-muted">{u.detail}</p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge tone={u.gravite === 'haute' ? 'warning' : 'neutral'}>{NOM_APP[u.app]}</Badge>
                        <MoreVertical size={14} className="text-muted" />
                      </div>
                    </Link>
                  ))}
                  <Link to={accesRh ? '/rh/validations' : urgences[0].lien} className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-2 text-xs font-semibold text-muted hover:text-white">
                    Tout voir
                  </Link>
                </div>
              )}
            </Card>

            <Card className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <ArrowUpRight size={15} className="text-accent2" />
                <h3 className="text-sm font-bold text-white">Progression globale</h3>
              </div>
              <div className="flex items-center gap-4">
                <div>
                  <p className="font-display text-2xl font-bold text-white">{Math.round(ratioConges)}%</p>
                  <p className="text-xs text-muted">Congés</p>
                  <p className="mt-1 text-xs text-muted">
                    {solde.donnees ? `${solde.donnees.jours_restants} jours restants` : '—'}
                  </p>
                </div>
                <div className="ml-auto">
                  <CircularProgress progress={ratioConges} size={84} gradientId="accueil-conges-grand-gradient" label={<Zap size={20} className="text-accent2" />} />
                </div>
              </div>
              <Link to="/rh/absences" className="flex items-center justify-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-xs font-bold text-black">
                <CheckCircle2 size={13} />
                Poser un congé
              </Link>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
