import { useRef, useState } from 'react';
import { Settings } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { PageHeader } from '../components/ui/PageHeader';
import { Avatar } from '../components/ui/Avatar';
import { useAuth } from '../lib/auth/AuthContext';
import { useAction } from '../lib/hooks/useApi';
import { changerMotDePasseIdentity, changerPhoto, supprimerPhoto } from '../lib/api/identity';

export default function MonCompte() {
  const { identite, definirIdentite } = useAuth();
  const inputPhoto = useRef<HTMLInputElement>(null);

  const uploadPhoto = useAction(changerPhoto);
  const retraitPhoto = useAction(supprimerPhoto);
  const majMotDePasse = useAction(changerMotDePasseIdentity);

  const [ancien, setAncien] = useState('');
  const [nouveau, setNouveau] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [succesMotDePasse, setSuccesMotDePasse] = useState(false);

  async function surChangementPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const fichier = e.target.files?.[0];
    if (!fichier) return;
    const identiteMaj = await uploadPhoto.executer(fichier);
    definirIdentite(identiteMaj);
    e.target.value = '';
  }

  async function retirerPhoto() {
    const identiteMaj = await retraitPhoto.executer();
    definirIdentite(identiteMaj);
  }

  async function soumettreMotDePasse(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSuccesMotDePasse(false);
    if (nouveau !== confirmation) return;
    await majMotDePasse.executer(ancien, nouveau);
    setAncien('');
    setNouveau('');
    setConfirmation('');
    setSuccesMotDePasse(true);
  }

  return (
    <div>
      <PageHeader icon={Settings} titre="Mon compte" sousTitre="Informations personnelles et mot de passe" />

      <div className="grid grid-cols-[auto_1fr] gap-6">
        <Card className="flex flex-col items-center gap-3">
          {identite?.photo ? (
            <img src={identite.photo} alt={identite.nom_complet} className="h-[72px] w-[72px] rounded-full object-cover" />
          ) : (
            <Avatar label={identite?.nom_complet ?? '?'} size={72} />
          )}
          <input ref={inputPhoto} type="file" accept="image/*" hidden onChange={surChangementPhoto} />
          <button
            onClick={() => inputPhoto.current?.click()}
            disabled={uploadPhoto.enCours}
            className="rounded-xl border border-border bg-surface2 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
          >
            {uploadPhoto.enCours ? 'Envoi...' : 'Changer la photo'}
          </button>
          {identite?.photo ? (
            <button onClick={retirerPhoto} disabled={retraitPhoto.enCours} className="text-xs text-muted hover:text-white">
              Retirer la photo
            </button>
          ) : null}
          {(uploadPhoto.erreur || retraitPhoto.erreur) && (
            <p className="text-center text-xs font-semibold text-red-400">{uploadPhoto.erreur ?? retraitPhoto.erreur}</p>
          )}
        </Card>

        <Card className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted">Nom complet</label>
              <input
                readOnly
                value={identite?.nom_complet ?? ''}
                className="w-full cursor-not-allowed rounded-xl border border-border bg-surface2 px-3 py-2 text-sm text-white/70 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted">Fonction</label>
              <input
                readOnly
                value={identite?.fonction ?? ''}
                className="w-full cursor-not-allowed rounded-xl border border-border bg-surface2 px-3 py-2 text-sm text-white/70 focus:outline-none"
              />
            </div>
            <div className="col-span-2">
              <label className="mb-1.5 block text-xs font-semibold text-muted">Adresse professionnelle</label>
              <input
                readOnly
                value={identite?.email ?? ''}
                className="w-full cursor-not-allowed rounded-xl border border-border bg-surface2 px-3 py-2 text-sm text-white/70 focus:outline-none"
              />
            </div>
          </div>
          <p className="text-xs text-muted">
            Le nom, la fonction et l'adresse sont gérés par l'administration RH — contactez-la pour toute correction.
          </p>
        </Card>
      </div>

      <Card className="mt-4">
        <h2 className="text-sm font-bold text-white">Mot de passe</h2>
        <form onSubmit={soumettreMotDePasse} className="mt-4 flex flex-col gap-3">
          <input
            type="password"
            placeholder="Mot de passe actuel"
            value={ancien}
            onChange={(e) => setAncien(e.target.value)}
            required
            className="w-full max-w-sm rounded-xl border border-border bg-surface2 px-3 py-2 text-sm text-white placeholder:text-muted focus:border-accent focus:outline-none"
          />
          <div className="grid max-w-lg grid-cols-2 gap-3">
            <input
              type="password"
              placeholder="Nouveau mot de passe"
              value={nouveau}
              onChange={(e) => setNouveau(e.target.value)}
              required
              minLength={8}
              className="w-full rounded-xl border border-border bg-surface2 px-3 py-2 text-sm text-white placeholder:text-muted focus:border-accent focus:outline-none"
            />
            <input
              type="password"
              placeholder="Confirmer"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              required
              className="w-full rounded-xl border border-border bg-surface2 px-3 py-2 text-sm text-white placeholder:text-muted focus:border-accent focus:outline-none"
            />
          </div>
          {nouveau && confirmation && nouveau !== confirmation && (
            <p className="text-xs font-semibold text-red-400">Les deux mots de passe ne correspondent pas.</p>
          )}
          {majMotDePasse.erreur ? <p className="text-xs font-semibold text-red-400">{majMotDePasse.erreur}</p> : null}
          {succesMotDePasse ? <p className="text-xs font-semibold text-emerald-400">Mot de passe mis à jour.</p> : null}
          <button
            type="submit"
            disabled={majMotDePasse.enCours}
            className="mt-1 w-fit rounded-xl border border-border bg-surface2 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-60"
          >
            {majMotDePasse.enCours ? 'Mise à jour...' : 'Mettre à jour le mot de passe'}
          </button>
        </form>
      </Card>
    </div>
  );
}
