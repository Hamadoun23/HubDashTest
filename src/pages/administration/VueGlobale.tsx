import { useState } from 'react';
import { Building2, Crown, Search, UserPlus, Users } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { EtatChargement, EtatErreur } from '../../components/ui/EtatRequete';
import { PageHeader } from '../../components/ui/PageHeader';
import { Badge, TableVirtus } from '../../components/ui/Table';
import { useApi } from '../../lib/hooks/useApi';
import { listerApplicationsAdmin, listerDepartementsAdmin, listerUtilisateursAdmin } from '../../lib/api/identity';

/** Vue de l'administrateur du hub : le compte du groupe (identity), pas
 * celui d'une application métier — d'où les libellés `identifiant`/`roles`
 * plutôt que `username`/`role` utilisés côté financerh. Réservée à
 * `est_superadmin` ou au rôle `admin` sur l'application `hub`. */
export default function VueGlobale() {
  const navigate = useNavigate();
  const utilisateurs = useApi(() => listerUtilisateursAdmin(), []);
  const applications = useApi(listerApplicationsAdmin, []);
  const departements = useApi(listerDepartementsAdmin, []);
  const [recherche, setRecherche] = useState('');

  if (utilisateurs.chargement || applications.chargement || departements.chargement) {
    return <EtatChargement texte="Chargement des comptes…" />;
  }
  if (utilisateurs.erreur) return <EtatErreur message={utilisateurs.erreur} recharger={utilisateurs.recharger} />;
  if (applications.erreur) return <EtatErreur message={applications.erreur} recharger={applications.recharger} />;
  if (departements.erreur) return <EtatErreur message={departements.erreur} recharger={departements.recharger} />;

  const liste = utilisateurs.donnees ?? [];
  const catalogue = applications.donnees ?? [];
  const listeDepartements = departements.donnees ?? [];

  const termeRecherche = recherche.trim().toLowerCase();
  const listeAffichee = termeRecherche
    ? liste.filter(
        (u) =>
          u.nom_complet.toLowerCase().includes(termeRecherche) ||
          u.identifiant.toLowerCase().includes(termeRecherche) ||
          (u.departement_nom ?? '').toLowerCase().includes(termeRecherche),
      )
    : liste;

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

      <p className="mb-3 text-xs text-muted">Départements — l'organigramme de l'entreprise, indépendant des accès applicatifs.</p>
      <div className="mb-6 grid grid-cols-4 gap-3">
        {listeDepartements.map((dep) => {
          const comptes = liste.filter((u) => u.departement === dep.id);
          return (
            <Link
              key={dep.id}
              to={`/administration/departements/${dep.id}`}
              className="flex flex-col gap-2 rounded-3xl border border-border bg-surface p-5 text-left transition hover:border-accent/40 hover:bg-surface2/40"
            >
              <Building2 size={16} className="text-muted" />
              <p className="font-display text-2xl font-bold tabular-nums text-white">{comptes.length}</p>
              <p className="text-xs font-semibold text-white">{dep.nom}</p>
              <p className="flex items-center gap-1 text-[11px] text-muted">
                <Crown size={11} className={dep.responsable ? 'text-accent2' : 'text-muted'} />
                {dep.responsable_nom || 'Pas de chef désigné'}
              </p>
            </Link>
          );
        })}
      </div>

      <p className="mb-3 text-xs text-muted">
        Applications — qui a accès à quoi, tous départements confondus. Pour changer un accès, ouvrez la fiche du compte concerné.
      </p>
      <div className="mb-6 grid grid-cols-4 gap-3">
        {catalogue.map((app) => {
          const comptesApp = liste.filter((u) => u.habilitations.some((h) => h.active && h.application === app.id));
          return (
            <Link
              key={app.id}
              to={`/administration/applications/${app.id}`}
              className="flex flex-col gap-2 rounded-3xl border border-border bg-surface p-5 text-left transition hover:border-accent/40 hover:bg-surface2/40"
            >
              <span className="inline-block h-1.5 w-8 rounded-full" style={{ backgroundColor: app.couleur }} />
              <p className="font-display text-2xl font-bold tabular-nums text-white">{comptesApp.length}</p>
              <p className="text-xs font-semibold text-white">{app.nom}</p>
              <p className="text-[11px] text-muted">{comptesApp.length === 1 ? '1 accès actif' : `${comptesApp.length} accès actifs`}</p>
            </Link>
          );
        })}
      </div>

      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-sm font-bold text-white">
          Comptes <span className="font-normal text-muted">({listeAffichee.length})</span>
        </h2>
        <div className="relative w-64">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher un compte…"
            className="w-full rounded-xl border border-border bg-surface2 py-2 pl-8 pr-3 text-xs text-white placeholder:text-muted focus:border-accent focus:outline-none"
          />
        </div>
      </div>
      <TableVirtus
        colonnes={['Nom', 'Identifiant', 'Département', 'Accès', 'Statut']}
        onRowClick={(index) => navigate(`/administration/comptes/${listeAffichee[index].id}`)}
        lignes={listeAffichee.map((u) => {
          const accesActifs = u.habilitations.filter((h) => h.active);
          const accesVisibles = accesActifs.slice(0, 2);
          const accesRestants = accesActifs.length - accesVisibles.length;
          return [
            <span className="font-semibold text-white">
              {u.nom_complet} {u.is_superuser ? <Badge tone="warning">Super admin</Badge> : null}
            </span>,
            u.identifiant,
            u.departement_nom || '—',
            accesActifs.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {accesVisibles.map((h) => (
                  <span key={h.id} className="rounded-full bg-surface2 px-2 py-0.5 text-[10px] font-semibold text-muted">
                    {h.application_nom}
                  </span>
                ))}
                {accesRestants > 0 ? <span className="rounded-full bg-surface2 px-2 py-0.5 text-[10px] font-semibold text-muted">+{accesRestants}</span> : null}
              </div>
            ) : (
              <span className="text-muted">Aucun</span>
            ),
            <Badge tone={u.est_actif ? 'success' : 'danger'}>{u.est_actif ? 'Actif' : 'Désactivé'}</Badge>,
          ];
        })}
      />
    </div>
  );
}
