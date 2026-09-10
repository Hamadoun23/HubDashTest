import { useState } from 'react';
import { Users } from 'lucide-react';
import { EtatErreur } from '../../components/ui/EtatRequete';
import { FormulaireEtHistorique } from '../../components/ui/FormulaireEtHistorique';
import { Badge } from '../../components/ui/Table';
import { useAction, useApi } from '../../lib/hooks/useApi';
import { creerUtilisateurJus, listerUtilisateursJus, modifierUtilisateurJus, supprimerUtilisateurJus, type RoleJus } from '../../lib/api/jus';

const ROLES: { valeur: RoleJus; libelle: string }[] = [
  { valeur: 'ResProd', libelle: 'Responsable production' },
  { valeur: 'Commercial', libelle: 'Commercial' },
  { valeur: 'Finance', libelle: 'Finance' },
  { valeur: 'Direction', libelle: 'Direction' },
];

export default function Utilisateurs() {
  const utilisateurs = useApi(() => listerUtilisateursJus(), []);
  const creation = useAction(creerUtilisateurJus);
  const modification = useAction(modifierUtilisateurJus);
  const suppression = useAction(supprimerUtilisateurJus);

  const [idEnEdition, setIdEnEdition] = useState<number | null>(null);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [role, setRole] = useState<RoleJus>('Commercial');

  function reinitialiser() {
    setIdEnEdition(null);
    setUsername('');
    setEmail('');
    setMotDePasse('');
    setRole('Commercial');
  }

  async function envoyer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (idEnEdition !== null) {
      // En modification le mot de passe est optionnel : laissé vide, il n'est pas envoyé
      // (donc pas modifié côté serveur) — seul un mot de passe non-vide déclenche un changement.
      await modification.executer(idEnEdition, { username, email, role, ...(motDePasse ? { password: motDePasse } : {}) });
    } else {
      await creation.executer({ username, email, password: motDePasse, role });
    }
    reinitialiser();
    utilisateurs.recharger();
  }

  async function supprimer(id: number) {
    if (!window.confirm('Supprimer définitivement cet utilisateur ?')) return;
    await suppression.executer(id);
    if (idEnEdition === id) reinitialiser();
    utilisateurs.recharger();
  }

  return utilisateurs.erreur ? (
    <EtatErreur message={utilisateurs.erreur} recharger={utilisateurs.recharger} />
  ) : (
    <div>
      {idEnEdition !== null && (
        <div className="mb-3 flex items-center justify-between rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-accent2">
          <span>Modification de l'utilisateur en cours</span>
          <button type="button" onClick={reinitialiser} className="font-semibold text-white hover:text-accent">
            Annuler la modification
          </button>
        </div>
      )}
      <FormulaireEtHistorique
        icon={Users}
        titre="Utilisateurs"
        sousTitre="Accès à l'application Jus d'orange"
        onSubmit={envoyer}
        envoiEnCours={creation.enCours || modification.enCours}
        erreurEnvoi={creation.erreur ?? modification.erreur}
        texteBouton={idEnEdition !== null ? 'Mettre à jour' : "Créer l'utilisateur"}
        champs={[
          { label: 'Identifiant', placeholder: 'j.dupont', valeur: username, onChange: setUsername, requis: true },
          { label: 'Email', placeholder: 'j.dupont@gdamali.net', valeur: email, onChange: setEmail },
          {
            label: idEnEdition !== null ? 'Mot de passe (laisser vide pour ne pas changer)' : 'Mot de passe',
            type: 'password',
            valeur: motDePasse,
            onChange: setMotDePasse,
            requis: idEnEdition === null,
          },
          { label: 'Rôle', valeur: role, onChange: (v) => setRole(v as RoleJus), requis: true, options: ROLES.map((r) => ({ valeur: r.valeur, libelle: r.libelle })) },
        ]}
        colonnesHistorique={['Identifiant', 'Rôles', 'Statut', '']}
        lignesHistorique={(utilisateurs.donnees ?? []).map((u) => [
          u.username,
          u.roles?.join(', ') || '—',
          <Badge tone={u.is_active ? 'success' : 'neutral'}>{u.is_active ? 'Actif' : 'Inactif'}</Badge>,
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setIdEnEdition(u.id);
                setUsername(u.username);
                setEmail(u.email);
                setMotDePasse('');
                setRole((u.roles?.[0] as RoleJus) ?? 'Commercial');
              }}
              className="text-xs font-semibold text-accent2 hover:text-accent"
            >
              Modifier
            </button>
            <button
              type="button"
              onClick={() => supprimer(u.id)}
              disabled={suppression.enCours}
              className="text-xs font-semibold text-red-400 hover:text-red-300 disabled:opacity-50"
            >
              Supprimer
            </button>
          </div>,
        ])}
      />
      {suppression.erreur ? <p className="mt-3 text-xs font-semibold text-red-400">{suppression.erreur}</p> : null}
    </div>
  );
}
