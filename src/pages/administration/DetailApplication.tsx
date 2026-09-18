import { useState } from 'react';
import { ArrowLeft, LayoutGrid, Plus, ShieldPlus } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { EtatChargement, EtatErreur } from '../../components/ui/EtatRequete';
import { PageHeader } from '../../components/ui/PageHeader';
import { Badge } from '../../components/ui/Table';
import { useAction, useApi } from '../../lib/hooks/useApi';
import { creerHabilitation, listerApplicationsAdmin, listerUtilisateursAdmin, modifierHabilitation } from '../../lib/api/identity';

/** Symétrique de DetailDepartement, mais pour les accès plutôt que
 * l'organigramme : qui a accès à cette application, et donner l'accès à
 * quelqu'un d'autre. Le département de la personne n'entre pas en jeu ici —
 * voir le bandeau d'explication de VueGlobale. */
export default function DetailApplication() {
  const { id } = useParams();
  const applicationId = Number(id);

  const applications = useApi(listerApplicationsAdmin, []);
  const utilisateurs = useApi(() => listerUtilisateursAdmin(), []);
  const bascule = useAction(modifierHabilitation);
  const reactivation = useAction(modifierHabilitation);
  const creation = useAction(creerHabilitation);

  const [recherche, setRecherche] = useState('');
  const [rolesParCandidat, setRolesParCandidat] = useState<Record<number, string[]>>({});

  if (applications.chargement || utilisateurs.chargement) return <EtatChargement texte="Chargement de l'application…" />;
  if (applications.erreur) return <EtatErreur message={applications.erreur} recharger={applications.recharger} />;
  if (utilisateurs.erreur) return <EtatErreur message={utilisateurs.erreur} recharger={utilisateurs.recharger} />;

  const application = (applications.donnees ?? []).find((a) => a.id === applicationId);
  if (!application) return <EtatErreur message="Cette application est introuvable." recharger={applications.recharger} />;

  const liste = utilisateurs.donnees ?? [];

  const titulaires = liste
    .map((u) => ({ utilisateur: u, habilitation: u.habilitations.find((h) => h.active && h.application === applicationId) }))
    .filter((x): x is { utilisateur: (typeof liste)[number]; habilitation: NonNullable<(typeof liste)[number]['habilitations'][number]> } => !!x.habilitation);

  const termeRecherche = recherche.trim().toLowerCase();
  const candidats = liste
    .filter((u) => !u.habilitations.some((h) => h.active && h.application === applicationId))
    .filter(
      (u) => !termeRecherche || u.nom_complet.toLowerCase().includes(termeRecherche) || u.identifiant.toLowerCase().includes(termeRecherche),
    );

  function libelleRole(code: string) {
    return application!.roles_disponibles.find((r) => r.code === code)?.libelle ?? code;
  }

  function recharger() {
    utilisateurs.recharger();
  }

  async function basculerAcces(habilitationId: number, actuel: boolean) {
    await bascule.executer(habilitationId, { active: !actuel });
    recharger();
  }

  function basculerRole(candidatId: number, code: string) {
    setRolesParCandidat((precedent) => {
      const actuel = precedent[candidatId] ?? [];
      const suivant = actuel.includes(code) ? actuel.filter((r) => r !== code) : [...actuel, code];
      return { ...precedent, [candidatId]: suivant };
    });
  }

  async function accorder(candidatId: number) {
    const roles = rolesParCandidat[candidatId] ?? [];
    if (roles.length === 0) return;
    // Un accès révoqué laisse une ligne inactive en base (utilisateur, application
    // est unique) : la réactiver plutôt que d'en recréer une, sous peine de heurter
    // cette contrainte.
    const existante = liste.find((u) => u.id === candidatId)?.habilitations.find((h) => h.application === applicationId);
    if (existante) {
      await reactivation.executer(existante.id, { active: true, roles });
    } else {
      await creation.executer({ utilisateur: candidatId, application: applicationId, roles });
    }
    setRolesParCandidat((precedent) => {
      const suite = { ...precedent };
      delete suite[candidatId];
      return suite;
    });
    recharger();
  }

  return (
    <div>
      <Link to="/administration" className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-white">
        <ArrowLeft size={14} /> Retour à l'administration
      </Link>

      <PageHeader
        icon={LayoutGrid}
        titre={application.nom}
        sousTitre={application.description || 'Gestion des accès'}
        action={<Badge tone="neutral">{titulaires.length === 1 ? '1 accès actif' : `${titulaires.length} accès actifs`}</Badge>}
      />

      <div className="grid grid-cols-[1.1fr_1fr] gap-6">
        <div>
          <h2 className="mb-3 text-sm font-bold text-white">Comptes avec accès</h2>
          {bascule.erreur && <p className="mb-2 text-xs font-semibold text-red-400">{bascule.erreur}</p>}
          {titulaires.length === 0 ? (
            <p className="rounded-3xl border border-border bg-surface p-6 text-center text-xs text-muted">Personne n'a encore accès.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {titulaires.map(({ utilisateur, habilitation }) => (
                <Card key={habilitation.id} className="flex items-center justify-between gap-3 !p-3.5">
                  <Link to={`/administration/comptes/${utilisateur.id}`} className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white hover:text-accent2">{utilisateur.nom_complet}</p>
                    <p className="truncate text-xs text-muted">{utilisateur.departement_nom || utilisateur.identifiant}</p>
                  </Link>
                  <div className="flex shrink-0 items-center gap-2">
                    <div className="flex flex-wrap justify-end gap-1">
                      {habilitation.roles.map((code) => (
                        <span key={code} className="rounded-full bg-surface2 px-2 py-0.5 text-[10px] font-semibold text-muted">
                          {libelleRole(code)}
                        </span>
                      ))}
                    </div>
                    <button
                      onClick={() => basculerAcces(habilitation.id, habilitation.active)}
                      disabled={bascule.enCours}
                      className="shrink-0 rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-muted hover:text-white disabled:opacity-50"
                    >
                      Couper
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-white">
            <ShieldPlus size={15} /> Donner accès à un collaborateur
          </h2>
          <input
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Chercher par nom ou identifiant…"
            className="w-full rounded-xl border border-border bg-surface2 px-3 py-2 text-sm text-white placeholder:text-muted focus:border-accent focus:outline-none"
          />
          {(creation.erreur || reactivation.erreur) && (
            <p className="mt-2 text-xs font-semibold text-red-400">{creation.erreur || reactivation.erreur}</p>
          )}
          <div className="mt-3 flex max-h-[32rem] flex-col gap-2 overflow-y-auto">
            {candidats.length === 0 ? (
              <p className="text-xs text-muted">Personne ne correspond.</p>
            ) : (
              candidats.map((c) => {
                const rolesChoisis = rolesParCandidat[c.id] ?? [];
                return (
                  <Card key={c.id} className="flex flex-col gap-2 !p-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{c.nom_complet}</p>
                      <p className="text-xs text-muted">
                        {c.identifiant}
                        {c.departement_nom ? ` — ${c.departement_nom}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {application.roles_disponibles.map((role) => (
                        <button
                          type="button"
                          key={role.code}
                          onClick={() => basculerRole(c.id, role.code)}
                          className={`rounded-lg border px-2 py-1 text-[11px] font-semibold ${
                            rolesChoisis.includes(role.code) ? 'border-accent bg-accent/20 text-accent2' : 'border-border bg-surface2 text-muted'
                          }`}
                        >
                          {role.libelle}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => accorder(c.id)}
                      disabled={creation.enCours || reactivation.enCours || rolesChoisis.length === 0}
                      className="flex items-center justify-center gap-1.5 self-start rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-black disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Plus size={13} /> Accorder
                    </button>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
