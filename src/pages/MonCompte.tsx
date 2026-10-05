import { useRef, useState } from 'react';
import { Settings } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { PageHeader } from '../components/ui/PageHeader';
import { Avatar } from '../components/ui/Avatar';
import { useAuth } from '../lib/auth/AuthContext';
import { useAction } from '../lib/hooks/useApi';
import { changerMotDePasseIdentity, changerPhoto, supprimerPhoto } from '../lib/api/identity';
import { reduirePhoto } from '../lib/image';
import { rafraichirPhotos } from '../lib/photos';

export default function MonCompte() {
  const { identite, appliquerProfil } = useAuth();
  const [erreurPhoto, setErreurPhoto] = useState<string | null>(null);
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
    e.target.value = '';
    if (!fichier) return;
    setErreurPhoto(null);
    try {
      // Réduite dans le navigateur : n'importe quelle photo de téléphone passe.
      const profil = await uploadPhoto.executer(await reduirePhoto(fichier));
      appliquerProfil(profil);
      rafraichirPhotos();
    } catch (erreur) {
      if (erreur instanceof Error && !uploadPhoto.erreur) setErreurPhoto(erreur.message);
    }
  }

  async function retirerPhoto() {
    appliquerProfil(await retraitPhoto.executer());
    rafraichirPhotos();
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

      <div className="grid gap-6 md:grid-cols-[auto_1fr]">
        <Card className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => inputPhoto.current?.click()}
            title="Changer la photo"
            className="group relative rounded-full focus:outline-none focus:ring-2 focus:ring-accent"
          >
            {identite?.photo ? (
              <img src={identite.photo} alt={identite.nom_complet} className="h-24 w-24 rounded-full object-cover" />
            ) : (
              <Avatar label={identite?.nom_complet ?? '?'} size={96} />
            )}
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/55 text-xs font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">
              {uploadPhoto.enCours ? 'Envoi…' : 'Modifier'}
            </span>
          </button>
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
          {(erreurPhoto || uploadPhoto.erreur || retraitPhoto.erreur) && (
            <p className="max-w-[12rem] text-center text-xs font-semibold text-red-400">{erreurPhoto ?? uploadPhoto.erreur ?? retraitPhoto.erreur}</p>
          )}
          <p className="max-w-[12rem] text-center text-[11px] text-muted">JPEG, PNG ou WEBP — la photo est réduite automatiquement.</p>
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
