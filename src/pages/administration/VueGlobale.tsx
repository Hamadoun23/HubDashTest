import { useState } from 'react';
import { Building2, Crown, UserPlus, Users, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { EtatChargement, EtatErreur } from '../../components/ui/EtatRequete';
import { PageHeader } from '../../components/ui/PageHeader';
import { Badge, TableVirtus } from '../../components/ui/Table';
import { useApi } from '../../lib/hooks/useApi';
import {
  listerApplicationsAdmin,
  listerDepartementsAdmin,
  listerUtilisateursAdmin,
  type UtilisateurAdmin,
} from '../../lib/api/identity';

/** Vue de l'administrateur du hub : le compte du groupe (identity), pas
 * celui d'une application métier — d'où les libellés `identifiant`/`roles`
 * plutôt que `username`/`role` utilisés côté financerh. Réservée à
 * `est_superadmin` ou au rôle `admin` sur l'application `hub`. */
export default function VueGlobale() {
  const utilisateurs = useApi(() => listerUtilisateursAdmin(), []);
  const applications = useApi(listerApplicationsAdmin, []);
  const departements = useApi(listerDepartementsAdmin, []);
  const [departementFiltre, setDepartementFiltre] = useState<number | null>(null);

  if (utilisateurs.chargement || applications.chargement || departements.chargement) {
    return <EtatChargement texte="Chargement des comptes…" />;
  }
  if (utilisateurs.erreur) return <EtatErreur message={utilisateurs.erreur} recharger={utilisateurs.recharger} />;
  if (applications.erreur) return <EtatErreur message={applications.erreur} recharger={applications.recharger} />;
  if (departements.erreur) return <EtatErreur message={departements.erreur} recharger={departements.recharger} />;

  const liste = utilisateurs.donnees ?? [];
  const catalogue = applications.donnees ?? [];
  const listeDepartements = departements.donnees ?? [];

  // Le rattachement est direct (Utilisateur.departement) : c'est l'affectation
  // faite depuis la fiche de la personne, pas une déduction à partir de ses
  // accès aux applications — un compte peut avoir accès à une app sans
  // travailler dans le département qui l'utilise au quotidien.
  function comptesDuDepartement(departementId: number): UtilisateurAdmin[] {
    return liste.filter((u) => u.departement === departementId);
  }

  // Applications sans département métier (ex. l'administration du hub
  // elle-même) : transverses, affichées à part plutôt qu'ignorées.
  const appsTransverses = catalogue.filter((a) => a.departements.length === 0);

  const liesteAffichee = departementFiltre ? comptesDuDepartement(departementFiltre) : liste;
  const departementActif = listeDepartements.find((d) => d.id === departementFiltre);

  return (
    <div>
      <PageHeader
        icon={Users}
        titre="Administration"
        sousTitre="Comptes et habilitations du groupe, par département"
        action={
          <div className="flex gap-2">
            <Link
              to="/administration/nouveau-departement"
              className="flex items-center gap-1.5 rounded-xl border border-border px-3.5 py-2 text-xs font-bold text-white hover:border-accent/50"
            >
              <Building2 size={14} /> Nouveau département
            </Link>
            <Link
              to="/administration/nouveau-compte"
              className="flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2 text-xs font-bold text-black"
            >
              <UserPlus size={14} /> Nouveau compte
            </Link>
          </div>
        }
      />

      <p className="mb-3 text-xs text-muted">
        L'organigramme, pas les accès : l'application indiquée est celle utilisée au quotidien par ce département, mais n'importe qui peut
        avoir accès à une application sans en faire partie (ex. poser ses congés sur RH).
      </p>
      <div className="mb-6 grid grid-cols-4 gap-3">
        {listeDepartements.map((dep) => {
          const comptes = comptesDuDepartement(dep.id);
          const apps = catalogue.filter((a) => a.departements.some((d) => d.id === dep.id));
          const actif = departementFiltre === dep.id;
          return (
            <div
              key={dep.id}
              onClick={() => setDepartementFiltre(actif ? null : dep.id)}
              className={`flex cursor-pointer flex-col gap-2 rounded-3xl border p-5 text-left transition ${
                actif ? 'border-accent bg-accent/10' : 'border-border bg-surface hover:border-accent/40'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                  {apps.map((a) => a.nom).join(' · ') || 'Aucune application'}
                </span>
                <Link
                  to={`/administration/departements/${dep.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="shrink-0 text-[11px] font-semibold text-muted hover:text-accent2"
                >
                  Gérer
                </Link>
              </div>
              <p className="font-display text-2xl font-bold tabular-nums text-white">{comptes.length}</p>
              <p className="text-xs font-semibold text-white">{dep.nom}</p>
              <p className="flex items-center gap-1 text-[11px] text-muted">
                <Crown size={11} className={dep.responsable ? 'text-accent2' : 'text-muted'} />
                {dep.responsable_nom || 'Pas de chef désigné'}
              </p>
            </div>
          );
        })}

        {appsTransverses.map((app) => {
          const comptesApp = liste.filter((u) => u.habilitations.some((h) => h.active && h.application === app.id));
          return (
            <Card key={app.id} className="flex flex-col gap-2 !border-dashed">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">Transverse</span>
              <p className="font-display text-2xl font-bold tabular-nums text-white">{comptesApp.length}</p>
              <p className="text-xs font-semibold text-white">{app.nom}</p>
              <p className="text-[11px] text-muted">{comptesApp.length === 1 ? '1 compte rattaché' : `${comptesApp.length} comptes rattachés`}</p>
            </Card>
          );
        })}
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-bold text-white">
          {departementActif ? (
            <>
              {departementActif.nom} <span className="font-normal text-muted">({liesteAffichee.length})</span>
            </>
          ) : (
            <>
              Comptes existants <span className="font-normal text-muted">({liste.length})</span>
            </>
          )}
        </h2>
        {departementFiltre ? (
          <button onClick={() => setDepartementFiltre(null)} className="flex items-center gap-1 text-xs font-semibold text-muted hover:text-white">
            <X size={13} /> Tous les départements
          </button>
        ) : null}
      </div>
      <TableVirtus
        colonnes={['Nom', 'Identifiant', 'Fonction', 'Statut', '']}
        lignes={liesteAffichee.map((u) => [
          <Link to={`/administration/comptes/${u.id}`} className="font-semibold text-white hover:text-accent2">
            {u.nom_complet} {u.is_superuser ? <Badge tone="warning">Super admin</Badge> : null}
          </Link>,
          u.identifiant,
          u.fonction || '—',
          <Badge tone={u.est_actif ? 'success' : 'danger'}>{u.est_actif ? 'Actif' : 'Désactivé'}</Badge>,
          <Link to={`/administration/comptes/${u.id}`} className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-muted hover:text-white">
            Gérer
          </Link>,
        ])}
      />
    </div>
  );
}
