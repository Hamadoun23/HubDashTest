import { KeyRound } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { changerMotDePasseIdentity } from '../lib/api/identity';
import { useAuth } from '../lib/auth/AuthContext';
import { useAction } from '../lib/hooks/useApi';

const CHAMP =
  'w-full rounded-xl border border-border bg-surface2 px-3.5 py-3 text-sm text-white placeholder:text-muted/70 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20';

/**
 * Premier passage avec un mot de passe provisoire : la personne en choisit un
 * personnel avant d'accéder au moindre écran. Le serveur ferme alors toutes
 * ses sessions ; on la renvoie se connecter avec le nouveau.
 */
export default function ChangementObligatoire() {
  const { identite, deconnecter } = useAuth();
  const navigate = useNavigate();
  const changer = useAction(changerMotDePasseIdentity);
  const [ancien, setAncien] = useState('');
  const [nouveau, setNouveau] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [erreurLocale, setErreurLocale] = useState<string | null>(null);

  async function soumettre(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErreurLocale(null);
    if (nouveau !== confirmation) {
      setErreurLocale('Les deux saisies du nouveau mot de passe diffèrent.');
      return;
    }
    try {
      await changer.executer(ancien, nouveau);
    } catch {
      return;
    }
    deconnecter();
    navigate('/connexion', { replace: true, state: { message: 'Mot de passe changé : reconnectez-vous avec le nouveau.' } });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <form onSubmit={soumettre} className="w-full max-w-md space-y-4 rounded-3xl border border-border bg-surface p-6 backdrop-blur-xl">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/15 text-accent">
          <KeyRound size={20} />
        </span>
        <div>
          <h1 className="font-display text-xl font-bold text-white">Choisissez votre mot de passe</h1>
          <p className="mt-1 text-sm text-muted">
            {identite?.nom_complet ? `${identite.nom_complet}, votre` : 'Votre'} mot de passe actuel est provisoire. Choisissez-en un
            personnel pour continuer (8 caractères au moins, pas uniquement des chiffres).
          </p>
        </div>
        <input type="password" autoComplete="current-password" required placeholder="Mot de passe actuel (provisoire)" value={ancien} onChange={(e) => setAncien(e.target.value)} className={CHAMP} />
        <input type="password" autoComplete="new-password" required placeholder="Nouveau mot de passe" value={nouveau} onChange={(e) => setNouveau(e.target.value)} className={CHAMP} />
        <input type="password" autoComplete="new-password" required placeholder="Confirmer le nouveau mot de passe" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} className={CHAMP} />
        {(erreurLocale || changer.erreur) && <p className="text-sm font-semibold text-red-400">{erreurLocale ?? changer.erreur}</p>}
        <button type="submit" disabled={changer.enCours} className="w-full rounded-xl bg-accent py-3 text-sm font-bold text-white disabled:opacity-60">
          {changer.enCours ? 'Enregistrement…' : 'Enregistrer et continuer'}
        </button>
        <button type="button" onClick={() => { deconnecter(); navigate('/connexion', { replace: true }); }} className="w-full text-xs text-muted hover:text-white">
          Se déconnecter
        </button>
      </form>
    </div>
  );
}
