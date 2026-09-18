import { useState } from 'react';
import { ArrowLeft, UserPlus } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { EtatChargement, EtatErreur } from '../../components/ui/EtatRequete';
import { PageHeader } from '../../components/ui/PageHeader';
import { useAction, useApi } from '../../lib/hooks/useApi';
import { creerHabilitation, creerUtilisateurAdmin, listerApplicationsAdmin, listerDepartementsAdmin } from '../../lib/api/identity';

const CHAMP =
  'w-full rounded-xl border border-border bg-surface2 px-3 py-2 text-sm text-white placeholder:text-muted focus:border-accent focus:outline-none';
const LABEL = 'mb-1.5 block text-xs font-semibold text-muted';

export default function NouveauCompte() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const departementPreselectionne = searchParams.get('departement') ?? '';
  const applications = useApi(listerApplicationsAdmin, []);
  const departements = useApi(listerDepartementsAdmin, []);
  const creationCompte = useAction(creerUtilisateurAdmin);
  const creationHabilitation = useAction(creerHabilitation);

  const [identifiant, setIdentifiant] = useState('');
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [email, setEmail] = useState('');
  const [fonction, setFonction] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [departementCible, setDepartementCible] = useState(departementPreselectionne);

  const [applicationCible, setApplicationCible] = useState('');
  const [rolesCibles, setRolesCibles] = useState<string[]>([]);

  if (applications.chargement || departements.chargement) return <EtatChargement texte="Chargement…" />;
  if (applications.erreur) return <EtatErreur message={applications.erreur} recharger={applications.recharger} />;
  if (departements.erreur) return <EtatErreur message={departements.erreur} recharger={departements.recharger} />;

  const catalogue = applications.donnees ?? [];
  const listeDepartements = departements.donnees ?? [];
  const appCible = catalogue.find((a) => String(a.id) === applicationCible);

  function basculerRole(code: string) {
    setRolesCibles((precedent) => (precedent.includes(code) ? precedent.filter((r) => r !== code) : [...precedent, code]));
  }

  async function envoyer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const compte = await creationCompte.executer({
      identifiant,
      nom,
      prenom,
      email,
      fonction,
      mot_de_passe: motDePasse,
      departement: departementCible ? Number(departementCible) : null,
    });
    if (applicationCible && rolesCibles.length > 0) {
      await creationHabilitation.executer({
        utilisateur: compte.id,
        application: Number(applicationCible),
        roles: rolesCibles,
      });
    }
    navigate(`/administration/comptes/${compte.id}`);
  }

  const enCours = creationCompte.enCours || creationHabilitation.enCours;
  const erreur = creationCompte.erreur ?? creationHabilitation.erreur;

  return (
    <div>
      <Link
        to={departementPreselectionne ? `/administration/departements/${departementPreselectionne}` : '/administration'}
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-white"
      >
        <ArrowLeft size={14} /> {departementPreselectionne ? 'Retour au département' : "Retour à l'administration"}
      </Link>

      <PageHeader icon={UserPlus} titre="Nouveau compte" sousTitre="Créer un accès au hub et, si besoin, l'attribuer à une application" />

      <Card className="max-w-xl">
        <form className="flex flex-col gap-3" onSubmit={envoyer}>
          <div>
            <label className={LABEL}>Identifiant (email professionnel)</label>
            <input value={identifiant} onChange={(e) => setIdentifiant(e.target.value)} placeholder="prenom.nom@gdamali.net" required className={CHAMP} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Prénom</label>
              <input value={prenom} onChange={(e) => setPrenom(e.target.value)} required className={CHAMP} />
            </div>
            <div>
              <label className={LABEL}>Nom</label>
              <input value={nom} onChange={(e) => setNom(e.target.value)} required className={CHAMP} />
            </div>
          </div>
          <div>
            <label className={LABEL}>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={CHAMP} />
          </div>
          <div>
            <label className={LABEL}>Fonction</label>
            <input value={fonction} onChange={(e) => setFonction(e.target.value)} className={CHAMP} />
          </div>
          <div>
            <label className={LABEL}>Département</label>
            <select value={departementCible} onChange={(e) => setDepartementCible(e.target.value)} className={CHAMP}>
              <option value="">Non rattaché</option>
              {listeDepartements.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nom}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL}>Mot de passe initial</label>
            <input type="password" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} required minLength={4} className={CHAMP} />
          </div>

          <div className="mt-2 border-t border-border pt-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-muted">Accès initial (optionnel)</p>
            <div>
              <label className={LABEL}>Application</label>
              <select
                value={applicationCible}
                onChange={(e) => {
                  setApplicationCible(e.target.value);
                  setRolesCibles([]);
                }}
                className={CHAMP}
              >
                <option value="">Aucun pour l'instant</option>
                {catalogue.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nom}
                  </option>
                ))}
              </select>
            </div>
            {appCible ? (
              <div className="mt-3">
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
          </div>

          {erreur && <p className="text-xs font-semibold text-red-400">{erreur}</p>}

          <button type="submit" disabled={enCours} className="mt-1 rounded-xl bg-accent px-4 py-2.5 text-xs font-bold text-black disabled:opacity-50">
            {enCours ? 'Création...' : 'Créer le compte'}
          </button>
        </form>
      </Card>
    </div>
  );
}
