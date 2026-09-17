import { useState } from 'react';
import { ArrowLeft, Building2, Crown, IdCard, Trash2 } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { EtatChargement, EtatErreur } from '../../components/ui/EtatRequete';
import { PageHeader } from '../../components/ui/PageHeader';
import { Badge } from '../../components/ui/Table';
import { useAction, useApi } from '../../lib/hooks/useApi';
import { listerDepartementsAdmin, listerUtilisateursAdmin, modifierDepartementAdmin, modifierUtilisateurAdmin } from '../../lib/api/identity';

const CHAMP =
  'w-full rounded-xl border border-border bg-surface2 px-3 py-2 text-sm text-white placeholder:text-muted focus:border-accent focus:outline-none';
const LABEL = 'mb-1.5 block text-xs font-semibold text-muted';

/** Gère uniquement l'appartenance à ce département (qui en fait partie, qui
 * le dirige). Donner un accès à une application est une autre affaire, gérée
 * depuis la fiche de chaque personne (bouton "Fiche" ci-dessous) — cette
 * page ne fait qu'une chose pour rester simple. */
export default function DetailDepartement() {
  const { id } = useParams();
  const departementId = Number(id);

  const departements = useApi(listerDepartementsAdmin, []);
  const utilisateurs = useApi(() => listerUtilisateursAdmin(), []);
  const edition = useAction(modifierDepartementAdmin);
  const affectation = useAction(modifierUtilisateurAdmin);

  const [nom, setNom] = useState<string | null>(null);
  const [recherche, setRecherche] = useState('');

  if (departements.chargement || utilisateurs.chargement) return <EtatChargement texte="Chargement du département…" />;
  if (departements.erreur) return <EtatErreur message={departements.erreur} recharger={departements.recharger} />;
  if (utilisateurs.erreur) return <EtatErreur message={utilisateurs.erreur} recharger={utilisateurs.recharger} />;

  const departement = (departements.donnees ?? []).find((d) => d.id === departementId);
  if (!departement) return <EtatErreur message="Ce département est introuvable." recharger={departements.recharger} />;

  const liste = (utilisateurs.donnees ?? []).filter((u) => u.est_actif);
  const membres = liste.filter((u) => u.departement === departementId);
  const termeRecherche = recherche.trim().toLowerCase();
  const candidats = liste
    .filter((u) => u.departement !== departementId)
    .filter(
      (u) => !termeRecherche || u.nom_complet.toLowerCase().includes(termeRecherche) || u.identifiant.toLowerCase().includes(termeRecherche),
    );

  function recharger() {
    departements.recharger();
    utilisateurs.recharger();
  }

  async function enregistrerNom() {
    if (nom === null || nom.trim() === departement!.nom) {
      setNom(null);
      return;
    }
    await edition.executer(departementId, { nom: nom.trim() });
    setNom(null);
    recharger();
  }

  async function basculerActif() {
    await edition.executer(departementId, { actif: !departement!.actif });
    recharger();
  }

  async function nommerChef(valeur: string) {
    await edition.executer(departementId, { responsable: valeur ? Number(valeur) : null });
    recharger();
  }

  async function ajouter(utilisateurId: number) {
    await affectation.executer(utilisateurId, { departement: departementId });
    recharger();
  }

  async function retirer(utilisateurId: number) {
    await affectation.executer(utilisateurId, { departement: null });
    if (departement!.responsable === utilisateurId) {
      await edition.executer(departementId, { responsable: null });
    }
    recharger();
  }

  return (
    <div>
      <Link to="/administration" className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-white">
        <ArrowLeft size={14} /> Retour à l'administration
      </Link>

      <PageHeader
        icon={Building2}
        titre={departement.nom}
        sousTitre={`${membres.length} collaborateur${membres.length > 1 ? 's' : ''}`}
        action={<Badge tone={departement.actif ? 'success' : 'danger'}>{departement.actif ? 'Actif' : 'Désactivé'}</Badge>}
      />

      <div className="grid grid-cols-[1fr_1.3fr] gap-6">
        <Card className="flex flex-col gap-4">
          <div>
            <label className={LABEL}>Nom du département</label>
            <input value={nom ?? departement.nom} onChange={(e) => setNom(e.target.value)} onBlur={enregistrerNom} className={CHAMP} />
          </div>
          <div>
            <label className={LABEL}>Chef de département</label>
            <select value={departement.responsable ?? ''} onChange={(e) => nommerChef(e.target.value)} disabled={edition.enCours} className={CHAMP}>
              <option value="">Aucun</option>
              {membres.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nom_complet}
                </option>
              ))}
            </select>
          </div>
          {edition.erreur && <p className="text-xs font-semibold text-red-400">{edition.erreur}</p>}
          <button
            onClick={basculerActif}
            disabled={edition.enCours}
            className="self-start rounded-xl border border-border px-3 py-2 text-xs font-semibold text-muted hover:text-white disabled:opacity-50"
          >
            {departement.actif ? 'Désactiver ce département' : 'Réactiver ce département'}
          </button>
        </Card>

        <div className="flex flex-col gap-4">
          <div>
            <h2 className="mb-3 text-sm font-bold text-white">Collaborateurs</h2>
            {membres.length === 0 ? (
              <p className="rounded-3xl border border-border bg-surface p-6 text-center text-xs text-muted">Personne n'est encore rattaché.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {membres.map((m) => (
                  <Card key={m.id} className="flex items-center justify-between gap-3 !p-3.5">
                    <div className="flex items-center gap-2">
                      {departement.responsable === m.id ? <Crown size={14} className="text-accent2" /> : null}
                      <div>
                        <p className="text-sm font-semibold text-white">{m.nom_complet}</p>
                        <p className="text-xs text-muted">{m.fonction || m.identifiant}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/administration/comptes/${m.id}`}
                        title="Voir sa fiche (pour lui donner accès à une application)"
                        className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-muted hover:text-white"
                      >
                        <IdCard size={12} /> Fiche
                      </Link>
                      <button
                        onClick={() => retirer(m.id)}
                        disabled={affectation.enCours}
                        className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-muted hover:text-white disabled:opacity-50"
                      >
                        <Trash2 size={12} /> Retirer
                      </button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 className="mb-3 text-sm font-bold text-white">Ajouter un collaborateur</h2>
            <input
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Chercher par nom ou identifiant..."
              className={CHAMP}
            />
            {affectation.erreur && <p className="mt-2 text-xs font-semibold text-red-400">{affectation.erreur}</p>}
            <div className="mt-3 flex max-h-96 flex-col gap-1.5 overflow-y-auto">
              {candidats.length === 0 ? (
                <p className="text-xs text-muted">Personne ne correspond.</p>
              ) : (
                candidats.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => ajouter(c.id)}
                    disabled={affectation.enCours}
                    className="flex items-center justify-between rounded-xl border border-border bg-surface2 px-3 py-2 text-left text-xs hover:border-accent/50 disabled:opacity-50"
                  >
                    <span>
                      <span className="font-semibold text-white">{c.nom_complet}</span>{' '}
                      <span className="text-muted">
                        — {c.identifiant}
                        {c.departement_nom ? ` (actuellement ${c.departement_nom})` : ''}
                      </span>
                    </span>
                    <span className="shrink-0 font-semibold text-accent2">Ajouter</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
