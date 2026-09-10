import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, Globe, Lock, Mail, MapPin, Phone } from 'lucide-react';
import { useAuth } from '../lib/auth/AuthContext';

const PHOTOS = ['/login-1.jpg', '/login-2.jpg'];

export default function Connexion() {
  const navigate = useNavigate();
  const { identite, connecter } = useAuth();
  const [photoIndex, setPhotoIndex] = useState(0);
  const [motDePasseVisible, setMotDePasseVisible] = useState(false);
  const [identifiant, setIdentifiant] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    const minuteur = setInterval(() => setPhotoIndex((i) => (i + 1) % PHOTOS.length), 6000);
    return () => clearInterval(minuteur);
  }, []);

  if (identite) return <Navigate to="/" replace />;

  async function soumettre(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEnCours(true);
    setErreur(null);
    try {
      await connecter(identifiant, motDePasse);
      navigate('/');
    } catch {
      setErreur('Identifiant ou mot de passe incorrect.');
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="flex min-h-screen w-full bg-bg text-white">
      {/* Volet gauche : identité visuelle GDA portée par les photos réelles du parc — le logo est déjà floqué sur les véhicules, inutile de le dupliquer ici. */}
      <div className="relative hidden w-[58%] overflow-hidden lg:block">
        {PHOTOS.map((photo, index) => (
          <div
            key={photo}
            className="absolute inset-0 bg-cover bg-center transition-opacity duration-[1500ms] ease-in-out"
            style={{
              backgroundImage: `url('${photo}')`,
              opacity: index === photoIndex ? 1 : 0,
              transform: index === photoIndex ? 'scale(1)' : 'scale(1.04)',
              transition: 'opacity 1.5s ease-in-out, transform 6s ease-out',
            }}
          />
        ))}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-black/10" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-transparent" />
        <div
          className="absolute -bottom-24 -left-24 h-96 w-96 rounded-full opacity-30 blur-3xl"
          style={{ background: 'radial-gradient(circle, #ff6a2b, transparent 70%)' }}
        />

        <div className="relative flex h-full flex-col justify-end p-12">
          <div className="max-w-lg">
            <h1 className="font-display text-[2.75rem] font-bold leading-[1.05] text-white">
              Bienvenue sur
              <br />
              GDA Hub.
            </h1>
            <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-white/75">
              L'espace de travail qui réunit chaque métier du groupe, dans une seule et même
              connexion.
            </p>

            <div className="mt-8 flex items-center gap-5">
              <div className="flex gap-1.5">
                {PHOTOS.map((photo, index) => (
                  <span
                    key={photo}
                    className="h-1 rounded-full transition-all duration-500"
                    style={{
                      width: index === photoIndex ? 22 : 8,
                      backgroundColor: index === photoIndex ? '#ff6a2b' : 'rgba(255,255,255,0.35)',
                    }}
                  />
                ))}
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 border-t border-white/15 pt-5 text-xs text-white/65">
              <span className="flex items-center gap-2">
                <MapPin size={13} />
                Cité El Farako, Rue 817, Porte 50
              </span>
              <span className="flex items-center gap-2">
                <Phone size={13} />
                (+223) 76 05 51 51
              </span>
              <span className="flex items-center gap-2">
                <Globe size={13} />
                www.gdamali.net
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Volet droit : formulaire de connexion, plein cadre sur le motif de marque GDA. */}
      <div
        className="relative flex flex-1 items-center justify-center overflow-hidden bg-cover bg-center px-10"
        style={{ backgroundImage: "url('/motif-orange.jpg')" }}
      >
        <div className="absolute inset-0 bg-black/45" />
        <div className="absolute inset-0 bg-gradient-to-br from-black/25 via-transparent to-black/40" />

        <div className="relative w-full max-w-[400px]">
          <span className="mb-7 block font-display text-sm font-bold uppercase tracking-[0.2em] text-accent2 lg:hidden">
            GDA Hub
          </span>

          <h2 className="font-display text-[1.75rem] font-bold text-white drop-shadow-sm">Bon retour</h2>
          <p className="mt-1.5 text-sm text-white/75">Connectez-vous à votre espace GDA Hub</p>

          <form className="mt-8 flex flex-col gap-4" onSubmit={soumettre}>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-white/80">Identifiant ou adresse professionnelle</label>
              <div className="relative">
                <Mail size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  value={identifiant}
                  onChange={(e) => setIdentifiant(e.target.value)}
                  placeholder="prenom.nom@gdamali.net"
                  autoComplete="username"
                  required
                  className="w-full rounded-xl border border-border bg-surface2 py-3 pl-10 pr-3.5 text-sm text-white placeholder:text-muted/70 transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                />
              </div>
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-xs font-semibold text-white/80">Mot de passe</label>
                <button type="button" className="text-xs font-semibold text-accent2 hover:text-accent">
                  Mot de passe oublié ?
                </button>
              </div>
              <div className="relative">
                <Lock size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type={motDePasseVisible ? 'text' : 'password'}
                  value={motDePasse}
                  onChange={(e) => setMotDePasse(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  className="w-full rounded-xl border border-border bg-surface2 py-3 pl-10 pr-10 text-sm text-white placeholder:text-muted/70 transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                />
                <button
                  type="button"
                  onClick={() => setMotDePasseVisible((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white"
                >
                  {motDePasseVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {erreur ? <p className="text-xs font-semibold text-red-400">{erreur}</p> : null}

            <label className="mt-1 flex w-fit items-center gap-2 text-xs text-white/75">
              <input type="checkbox" className="h-3.5 w-3.5 rounded border-border bg-surface2 accent-accent" />
              Rester connecté
            </label>

            <button
              type="submit"
              disabled={enCours}
              className="group mt-2 flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-bold text-black transition-transform hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {enCours ? 'Connexion...' : 'Se connecter'}
              {!enCours && <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-white/60">
            Accès réservé aux collaborateurs GDA · besoin d'aide ? contactez votre administrateur.
          </p>
        </div>
      </div>
    </div>
  );
}
