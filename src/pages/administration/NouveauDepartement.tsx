import { useState } from 'react';
import { ArrowLeft, Building2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { useAction } from '../../lib/hooks/useApi';
import { creerDepartementAdmin } from '../../lib/api/identity';

const CHAMP =
  'w-full rounded-xl border border-border bg-surface2 px-3 py-2 text-sm text-white placeholder:text-muted focus:border-accent focus:outline-none';
const LABEL = 'mb-1.5 block text-xs font-semibold text-muted';

function glisser(texte: string) {
  return texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export default function NouveauDepartement() {
  const navigate = useNavigate();
  const creation = useAction(creerDepartementAdmin);

  const [nom, setNom] = useState('');
  const [code, setCode] = useState('');
  const [codeModifieManuel, setCodeModifieManuel] = useState(false);

  function changerNom(valeur: string) {
    setNom(valeur);
    if (!codeModifieManuel) setCode(glisser(valeur));
  }

  async function envoyer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await creation.executer({ code, nom });
    navigate('/administration');
  }

  return (
    <div>
      <Link to="/administration" className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-white">
        <ArrowLeft size={14} /> Retour à l'administration
      </Link>

      <PageHeader icon={Building2} titre="Nouveau département" sousTitre="Un pôle réel de l'organisation, indépendant des applications" />

      <Card className="max-w-lg">
        <form className="flex flex-col gap-3" onSubmit={envoyer}>
          <div>
            <label className={LABEL}>Nom</label>
            <input value={nom} onChange={(e) => changerNom(e.target.value)} placeholder="Communication" required className={CHAMP} />
          </div>
          <div>
            <label className={LABEL}>Code</label>
            <input
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setCodeModifieManuel(true);
              }}
              placeholder="com"
              required
              pattern="[a-z0-9-]+"
              className={CHAMP}
            />
            <p className="mt-1 text-[11px] text-muted">Identifiant technique, sans espace ni accent — rempli automatiquement depuis le nom.</p>
          </div>

          {creation.erreur && <p className="text-xs font-semibold text-red-400">{creation.erreur}</p>}

          <button type="submit" disabled={creation.enCours} className="mt-1 self-start rounded-xl bg-accent px-4 py-2.5 text-xs font-bold text-black disabled:opacity-50">
            {creation.enCours ? 'Création...' : 'Créer le département'}
          </button>
        </form>
      </Card>
    </div>
  );
}
