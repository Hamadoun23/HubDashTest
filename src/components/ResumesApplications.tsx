import { AlertTriangle, ArrowUpRight, Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Card } from './ui/Card';
import { useAuth } from '../lib/auth/AuthContext';
import { useApi } from '../lib/hooks/useApi';
import { APPLICATIONS_HUB, type AppKey } from '../lib/navigation';
import { demandesAValider, mesDemandes, monSolde } from '../lib/api/rh';
import { obtenirSummary } from '../lib/api/jus';
import { listerProjets } from '../lib/api/chantiers';
import { listerClients, tableauDeBord } from '../lib/api/planning';
import { requeteInertia } from '../campagnes/inertia/noyau';
import { usePermissionsPlanning } from '../pages/planning/permissions';

const NOMBRE = new Intl.NumberFormat('fr-FR');
const fcfa = (v: number) => `${NOMBRE.format(Math.round(v))} F`;
const MAINTENANT = new Date();

type Chiffre = { valeur: ReactNode; libelle: string };

/** Carte de synthèse d'une appli : en-tête, 2-3 chiffres, une alerte éventuelle. */
function CarteApp({
  app,
  chiffres,
  alerte,
  lienAlerte,
  chargement,
  indisponible,
  pied,
}: {
  app: AppKey;
  chiffres: Chiffre[];
  alerte?: string | null;
  lienAlerte?: string;
  chargement?: boolean;
  indisponible?: string | null;
  pied?: ReactNode;
}) {
  const meta = APPLICATIONS_HUB.find((a) => a.key === app)!;
  const Icone = meta.icon;
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${meta.couleur} text-black`}>
            <Icone size={19} />
          </span>
          <div className="min-w-0">
            <p className="truncate font-display text-base font-bold text-white">{meta.nom}</p>
            <p className="truncate text-xs text-muted">{meta.description}</p>
          </div>
        </div>
        <Link
          to={app === 'campagnes' ? '/campagnes/dashboard' : meta.chemin}
          className="flex shrink-0 items-center gap-1 rounded-xl bg-surface2 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-accent hover:text-black"
        >
          Ouvrir <ArrowUpRight size={13} />
        </Link>
      </div>

      {chargement ? (
        <p className="flex items-center gap-2 py-3 text-xs text-muted">
          <Loader2 size={14} className="animate-spin" /> Chargement…
        </p>
      ) : indisponible ? (
        <p className="py-3 text-xs text-muted">{indisponible}</p>
      ) : (
        <div className={`grid gap-2 ${chiffres.length >= 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
          {chiffres.map((c) => (
            <div key={c.libelle} className="min-w-0 rounded-2xl bg-surface2 px-3 py-2.5">
              <p className="truncate font-display text-lg font-bold tabular-nums text-white">{c.valeur}</p>
              <p className="text-[11px] leading-tight text-muted">{c.libelle}</p>
            </div>
          ))}
        </div>
      )}

      {pied}

      {alerte &&
        (lienAlerte ? (
          <Link to={lienAlerte} className="flex items-center gap-2 rounded-xl border border-accent/40 bg-accent/15 px-3 py-2 text-xs font-semibold text-accent2 hover:bg-accent/25">
            <AlertTriangle size={14} className="shrink-0" />
            <span className="flex-1">{alerte}</span>
            <ArrowUpRight size={13} />
          </Link>
        ) : (
          <p className="flex items-center gap-2 rounded-xl border border-accent/40 bg-accent/15 px-3 py-2 text-xs font-semibold text-accent2">
            <AlertTriangle size={14} className="shrink-0" /> {alerte}
          </p>
        ))}
    </Card>
  );
}

function ResumeRh() {
  const solde = useApi(() => monSolde(MAINTENANT.getFullYear()), []);
  const aValider = useApi(demandesAValider, []);
  const demandes = useApi(mesDemandes, []);
  const enCours = (demandes.donnees ?? []).filter((d) => d.statut === 'EN_VALIDATION' || d.statut === 'BROUILLON').length;
  const attente = (demandes.donnees ?? []).filter((d) => d.en_attente).length;
  const nbValider = aValider.donnees?.length ?? 0;
  return (
    <CarteApp
      app="rh"
      chargement={solde.chargement && aValider.chargement}
      chiffres={[
        { valeur: solde.donnees ? `${solde.donnees.jours_restants} j` : '—', libelle: 'Congés restants' },
        { valeur: enCours, libelle: 'Mes demandes en cours' },
        { valeur: nbValider, libelle: 'Dossiers à valider' },
      ]}
      alerte={
        attente > 0
          ? `${attente} de vos demandes attend${attente > 1 ? 'ent' : ''} un complément`
          : nbValider > 0
            ? `${nbValider} dossier${nbValider > 1 ? 's' : ''} attend${nbValider > 1 ? 'ent' : ''} votre décision`
            : null
      }
      lienAlerte={attente > 0 ? '/rh/absences' : '/rh/validations'}
    />
  );
}

function ResumeJus() {
  const resume = useApi(obtenirSummary, []);
  const k = resume.donnees?.kpi;
  return (
    <CarteApp
      app="jus"
      chargement={resume.chargement}
      indisponible={resume.erreur ? 'Les indicateurs de synthèse ne sont pas ouverts à votre rôle — ouvrez l’appli pour vos écrans.' : null}
      chiffres={
        k
          ? [
              { valeur: fcfa(k.ca_total), libelle: "Chiffre d'affaires" },
              { valeur: NOMBRE.format(k.jus_stock), libelle: 'Bouteilles de jus en stock' },
              { valeur: `${NOMBRE.format(k.recolte_total)} kg`, libelle: 'Oranges récoltées' },
            ]
          : []
      }
      alerte={k && k.articles_sous_seuil > 0 ? `${k.articles_sous_seuil} article${k.articles_sous_seuil > 1 ? 's' : ''} sous le seuil d'alerte` : null}
      lienAlerte="/jus/production/articles"
    />
  );
}

function ResumeChantiers() {
  const projets = useApi(() => listerProjets(), []);
  const liste = projets.donnees ?? [];
  const enCours = liste.filter((p) => p.status === 'en_cours');
  const suivis = (enCours.length ? enCours : liste).slice(0, 3);
  const moyenne = liste.length ? liste.reduce((s, p) => s + (p.overall_progress ?? 0), 0) / liste.length : 0;
  return (
    <CarteApp
      app="chantiers"
      chargement={projets.chargement}
      indisponible={projets.erreur ? 'Chantiers indisponible pour le moment.' : liste.length === 0 && !projets.chargement ? 'Aucun chantier ne vous est ouvert.' : null}
      chiffres={[
        { valeur: liste.length, libelle: 'Chantiers' },
        { valeur: enCours.length, libelle: 'En cours' },
        { valeur: `${Math.round(moyenne)} %`, libelle: 'Avancement moyen' },
      ]}
      pied={
        suivis.length > 0 && (
          <div className="space-y-2">
            {suivis.map((p) => (
              <Link key={p.id} to={`/chantiers/${p.id}`} className="block rounded-xl px-1 hover:bg-surface2/60">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate font-semibold text-white">{p.name}</span>
                  <span className="shrink-0 tabular-nums text-muted">{Math.round(p.overall_progress ?? 0)} %</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-white/10">
                  <div className="h-1.5 rounded-full bg-emerald-400" style={{ width: `${Math.min(100, p.overall_progress ?? 0)}%` }} />
                </div>
              </Link>
            ))}
          </div>
        )
      }
    />
  );
}

function ResumePlanningCarte() {
  const { estClient } = usePermissionsPlanning();
  const dashboard = useApi(() => (estClient ? Promise.resolve(null) : tableauDeBord(MAINTENANT.getMonth() + 1, MAINTENANT.getFullYear())), [estClient]);
  const client = useApi(() => (estClient ? listerClients() : Promise.resolve([])), [estClient]);
  if (estClient) {
    const c = client.donnees?.[0];
    return (
      <CarteApp
        app="planning"
        chargement={client.chargement}
        chiffres={c ? [{ valeur: c.tournages_count, libelle: 'Tournages' }, { valeur: c.publications_count, libelle: 'Publications' }] : []}
      />
    );
  }
  const d = dashboard.donnees;
  const retards = d ? d.publications_en_retard.length + d.tournages_en_retard.length : 0;
  return (
    <CarteApp
      app="planning"
      chargement={dashboard.chargement}
      indisponible={dashboard.erreur ? 'Planning indisponible pour le moment.' : null}
      chiffres={
        d
          ? [
              { valeur: d.stats.publications_this_month, libelle: 'Publications ce mois' },
              { valeur: d.stats.shootings_this_month, libelle: 'Tournages ce mois' },
              { valeur: d.stats.clients_count, libelle: 'Clients suivis' },
            ]
          : []
      }
      alerte={retards > 0 ? `${retards} publication${retards > 1 ? 's' : ''} ou tournage${retards > 1 ? 's' : ''} en retard` : null}
      lienAlerte="/planning"
    />
  );
}

type PageInertia = { component?: string; props?: Record<string, unknown>; externe?: string };

function ResumeCampagnes() {
  const page = useApi(() => requeteInertia('/campagnes/dashboard') as Promise<PageInertia>, []);
  const p = (page.donnees?.props ?? {}) as Record<string, any>;
  const variant = p.variant as string | undefined;
  let chiffres: Chiffre[] = [];
  let indisponible: string | null = null;
  if (page.erreur) indisponible = 'Campagnes indisponible pour le moment.';
  else if (page.donnees && page.donnees.component !== 'Dashboard') indisponible = 'Choisissez le client (BDM, UBA…) en ouvrant l’appli.';
  else if (variant === 'admin') {
    chiffres = [
      { valeur: NOMBRE.format(Number(p.ventesTotal ?? 0)), libelle: 'Ventes (total)' },
      { valeur: NOMBRE.format(Number(p.ventesMois ?? 0)), libelle: 'Ventes ce mois' },
      { valeur: `${Math.round(Number(p.pctCommerciauxActifs ?? 0))} %`, libelle: 'Commerciaux actifs' },
    ];
  } else if (variant === 'commercial') {
    const bloc = (p.vente ?? p.enrolement ?? {}) as Record<string, any>;
    chiffres = [
      { valeur: NOMBRE.format(Number(bloc.mesVentes ?? bloc.mesEnrolements ?? 0)), libelle: p.vente ? 'Mes ventes' : 'Mes enrôlements' },
      { valeur: bloc.monRang ? `${bloc.monRang}ᵉ` : '—', libelle: 'Mon classement' },
    ];
  } else if (page.donnees) indisponible = 'Ouvrez l’appli pour votre tableau de bord.';
  const campagne = (p.campagneActive ?? p.vente?.campagneActive ?? p.enrolement?.campagneActive) as { nom?: string } | null | undefined;
  return (
    <CarteApp
      app="campagnes"
      chargement={page.chargement}
      indisponible={indisponible}
      chiffres={chiffres}
      pied={campagne?.nom ? <p className="truncate text-xs text-muted">Campagne en cours : <span className="font-semibold text-white">{campagne.nom}</span></p> : null}
    />
  );
}

const RESUMES: Record<AppKey, (() => ReactNode) | null> = {
  hub: null,
  rh: () => <ResumeRh />,
  jus: () => <ResumeJus />,
  chantiers: () => <ResumeChantiers />,
  planning: () => <ResumePlanningCarte />,
  campagnes: () => <ResumeCampagnes />,
};

/**
 * Accueil du hub : une carte par application ouverte à la personne
 * connectée, avec l'essentiel et ce qui l'attend. Chaque carte charge ses
 * propres chiffres ; une appli en panne n'empêche pas les autres de s'afficher.
 */
export function ResumesApplications() {
  const { applications } = useAuth();
  const accessibles = APPLICATIONS_HUB.filter((app) =>
    applications.some((a) => a.active && a.chemin.split('/')[1] === app.chemin.split('/')[1]),
  );
  if (accessibles.length === 0) {
    return (
      <Card className="py-10 text-center text-sm text-muted">
        Votre tableau de bord apparaîtra ici une fois rattaché à une application du hub.
      </Card>
    );
  }
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {accessibles.map((app) => (
        <div key={app.key} className="min-w-0">
          {RESUMES[app.key]?.()}
        </div>
      ))}
    </div>
  );
}
