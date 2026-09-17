import { useState } from 'react';
import { ArrowLeft, Crown, ShieldPlus, UserCog } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { EtatChargement, EtatErreur } from '../../components/ui/EtatRequete';
import { PageHeader } from '../../components/ui/PageHeader';
import { Badge } from '../../components/ui/Table';
import { useAction, useApi } from '../../lib/hooks/useApi';
import {
  creerHabilitation,
  listerApplicationsAdmin,
  listerDepartementsAdmin,
  listerUtilisateursAdmin,
  modifierDepartementAdmin,
  modifierHabilitation,
  modifierUtilisateurAdmin,
} from '../../lib/api/identity';

const CHAMP =
  'w-full rounded-xl border border-border bg-surface2 px-3 py-2 text-sm text-white placeholder:text-muted focus:border-accent focus:outline-none';
const LABEL = 'mb-1.5 block text-xs font-semibold text-muted';

export default function DetailCompte() {
  const { id } = useParams();
  const utilisateurId = Number(id);

  // Pas d'endpoint « un seul compte, avec ses habilitations » séparé : on
  // relit la liste complète, déjà utilisée par VueGlobale et mise en cache
  // par le navigateur pour un aller-retour immédiat.
  const utilisateurs = useApi(() => listerUtilisateursAdmin(), []);
  const applications = useApi(listerApplicationsAdmin, []);
  const departements = useApi(listerDepartementsAdmin, []);
  const activation = useAction(modifierUtilisateurAdmin);
  const affectation = useAction(modifierUtilisateurAdmin);
  const nomination = useAction(modifierDepartementAdmin);
  const creationHabilitation = useAction(creerHabilitation);
  const bascule = useAction(modifierHabilitation);

  const [applicationCible, setApplicationCible] = useState('');
  const [rolesCibles, setRolesCibles] = useState<string[]>([]);

  if (utilisateurs.chargement || applications.chargement || departements.chargement) {
    return <EtatChargement texte="Chargement du compte…" />;
  }
  if (utilisateurs.erreur) return <EtatErreur message={utilisateurs.erreur} recharger={utilisateurs.recharger} />;
  if (applications.erreur) return <EtatErreur message={applications.erreur} recharger={applications.recharger} />;
  if (departements.erreur) return <EtatErreur message={departements.erreur} recharger={departements.recharger} />;

  const utilisateur = (utilisateurs.donnees ?? []).find((u) => u.id === utilisateurId);
  if (!utilisateur) return <EtatErreur message="Ce compte est introuvable." recharger={utilisateurs.recharger} />;

  const catalogue = applications.donnees ?? [];
  const listeDepartements = departements.donnees ?? [];
  const departementActuel = listeDepartements.find((d) => d.id === utilisateur.departement);
  const estChefDeDepartement = departementActuel?.responsable === utilisateur.id;
  const appsDejaAccordees = new Set(utilisateur.habilitations.filter((h) => h.active).map((h) => h.application));
  const catalogueDisponible = catalogue.filter((a) => !appsDejaAccordees.has(a.id));
  const appCible = catalogue.find((a) => String(a.id) === applicationCible);

  function basculerRole(code: string) {
    setRolesCibles((precedent) => (precedent.includes(code) ? precedent.filter((r) => r !== code) : [...precedent, code]));
  }

  async function basculerActif() {
    await activation.executer(utilisateurId, { est_actif: !utilisateur!.est_actif });
    utilisateurs.recharger();
  }

  async function changerDepartement(valeur: string) {
    const ancien = departementActuel;
    await affectation.executer(utilisateurId, { departement: valeur ? Number(valeur) : null });
    // Quitter un département retire aussi la casquette de chef, sans quoi
    // « responsable » pointerait vers quelqu'un qui n'en fait plus partie.
    if (ancien && ancien.responsable === utilisateurId) {
      await nomination.executer(ancien.id, { responsable: null });
    }
    utilisateurs.recharger();
    departements.recharger();
  }

  async function basculerChef() {
    if (!departementActuel) return;
    await nomination.executer(departementActuel.id, { responsable: estChefDeDepartement ? null : utilisateurId });
    departements.recharger();
  }

  async function basculerHabilitation(habilitationId: number, actuel: boolean) {
    await bascule.executer(habilitationId, { active: !actuel });
    utilisateurs.recharger();
  }

  async function accorder(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!applicationCible || rolesCibles.length === 0) return;
    await creationHabilitation.executer({ utilisateur: utilisateurId, application: Number(applicationCible), roles: rolesCibles });
    setApplicationCible('');
    setRolesCibles([]);
    utilisateurs.recharger();
  }

  return (
    <div>
      <Link to="/administration" className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-white">
        <ArrowLeft size={14} /> Retour à l'administration
      </Link>

      <PageHeader
        icon={UserCog}
        titre={utilisateur.nom_complet}
        sousTitre={utilisateur.identifiant}
        action={<Badge tone={utilisateur.est_actif ? 'success' : 'danger'}>{utilisateur.est_actif ? 'Actif' : 'Désactivé'}</Badge>}
      />

      <div className="grid grid-cols-[1fr_1.3fr] gap-6">
        <Card className="flex flex-col gap-3">
          <h2 className="text-sm font-bold text-white">Fiche</h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <dt className="text-xs font-semibold text-muted">Email</dt>
              <dd className="text-white">{utilisateur.email || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-muted">Téléphone</dt>
              <dd className="text-white">{utilisateur.telephone || '—'}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-xs font-semibold text-muted">Fonction</dt>
              <dd className="text-white">{utilisateur.fonction || '—'}</dd>
            </div>
          </dl>

          <div className="border-t border-border pt-3">
            <label className={LABEL}>Département</label>
            <select
              value={utilisateur.departement ?? ''}
              onChange={(e) => changerDepartement(e.target.value)}
              disabled={affectation.enCours}
              className={CHAMP}
            >
              <option value="">Non rattaché</option>
              {listeDepartements.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nom}
                </option>
              ))}
            </select>
            {departementActuel ? (
              <button
                onClick={basculerChef}
                disabled={nomination.enCours}
                className={`mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold disabled:opacity-50 ${
                  estChefDeDepartement ? 'border-accent bg-accent/15 text-accent2' : 'border-border text-muted hover:text-white'
                }`}
              >
                <Crown size={13} />
                {estChefDeDepartement ? `Chef de ${departementActuel.nom}` : `Nommer chef de ${departementActuel.nom}`}
              </button>
            ) : null}
          </div>

          <button
            onClick={basculerActif}
            disabled={activation.enCours}
            className="self-start rounded-xl border border-border px-3 py-2 text-xs font-semibold text-muted hover:text-white disabled:opacity-50"
          >
            {utilisateur.est_actif ? 'Désactiver ce compte' : 'Réactiver ce compte'}
          </button>
        </Card>

        <div className="flex flex-col gap-4">
          <div>
            <h2 className="mb-3 text-sm font-bold text-white">Accès actuels</h2>
            {utilisateur.habilitations.length === 0 ? (
              <p className="rounded-3xl border border-border bg-surface p-6 text-center text-xs text-muted">Aucun accès attribué.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {utilisateur.habilitations.map((h) => (
                  <Card key={h.id} className="flex items-center justify-between gap-3 !p-3.5">
                    <div>
                      <p className="text-sm font-semibold text-white">{h.application_nom}</p>
                      <p className="text-xs text-muted">{h.roles.join(', ') || '—'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={h.active ? 'success' : 'neutral'}>{h.active ? 'Actif' : 'Coupé'}</Badge>
                      <button
                        onClick={() => basculerHabilitation(h.id, h.active)}
                        disabled={bascule.enCours}
                        className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-muted hover:text-white disabled:opacity-50"
                      >
                        {h.active ? 'Couper' : 'Rétablir'}
                      </button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {catalogueDisponible.length > 0 ? (
            <Card>
              <h2 className="flex items-center gap-2 text-sm font-bold text-white">
                <ShieldPlus size={15} /> Accorder un nouvel accès
              </h2>
              <form className="mt-3 flex flex-col gap-3" onSubmit={accorder}>
                <div>
                  <label className={LABEL}>Application</label>
                  <select
                    value={applicationCible}
                    onChange={(e) => {
                      setApplicationCible(e.target.value);
                      setRolesCibles([]);
                    }}
                    required
                    className={CHAMP}
                  >
                    <option value="">Sélectionner...</option>
                    {catalogueDisponible.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.nom}
                      </option>
                    ))}
                  </select>
                </div>
                {appCible ? (
                  <div>
                    <label className={LABEL}>Rôles</label>
                    <div className="flex flex-wrap gap-2">
                      {appCible.roles_disponibles.map((role) => (
                        <button
                          type="button"
                          key={role.code}
                          onClick={() => basculerRole(role.code)}
                          className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
                            rolesCibles.includes(role.code) ? 'border-accent bg-accent/20 text-accent2' : 'border-border bg-surface2 text-muted'
                          }`}
                        >
                          {role.libelle}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                {creationHabilitation.erreur && <p className="text-xs font-semibold text-red-400">{creationHabilitation.erreur}</p>}
                <button
                  type="submit"
                  disabled={creationHabilitation.enCours || !applicationCible || rolesCibles.length === 0}
                  className="self-start rounded-xl bg-accent px-3 py-2 text-xs font-bold text-black disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {creationHabilitation.enCours ? 'Attribution...' : 'Accorder'}
                </button>
              </form>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
