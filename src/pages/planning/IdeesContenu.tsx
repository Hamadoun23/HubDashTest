import { useState } from 'react';
import { FileText, Image as ImageIcon, Lightbulb, Pencil, Plus, Trash2, Video, X } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { EtatErreur } from '../../components/ui/EtatRequete';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatTile } from '../../components/ui/StatTile';
import { TableVirtus } from '../../components/ui/Table';
import { useAction, useApi } from '../../lib/hooks/useApi';
import { creerIdee, listerIdees, modifierIdee, supprimerIdee, type IdeeContenu } from '../../lib/api/planning';

const TYPES = ['vidéo', 'image', 'texte'];

const ICONE_TYPE: Record<string, typeof Video> = { vidéo: Video, image: ImageIcon, texte: FileText };

const CHAMP = 'w-full rounded-xl border border-border bg-surface2 px-3 py-2 text-sm text-white placeholder:text-muted focus:border-accent focus:outline-none';
const LABEL = 'mb-1.5 block text-xs font-semibold text-muted';

export default function IdeesContenu() {
  const idees = useApi(listerIdees, []);
  const creation = useAction(creerIdee);
  const modification = useAction(modifierIdee);

  const [ouvert, setOuvert] = useState(false);
  const [idEnEdition, setIdEnEdition] = useState<number | null>(null);
  const [titre, setTitre] = useState('');
  const [type, setType] = useState(TYPES[0]);
  const [filtreType, setFiltreType] = useState('all');
  const [suppressionEnCoursId, setSuppressionEnCoursId] = useState<number | null>(null);

  function ouvrirCreation() {
    setIdEnEdition(null);
    setTitre('');
    setType(TYPES[0]);
    setOuvert(true);
  }

  function ouvrirEdition(idee: IdeeContenu) {
    setIdEnEdition(idee.id);
    setTitre(idee.titre);
    setType(idee.type);
    setOuvert(true);
  }

  async function envoyer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (idEnEdition !== null) {
      await modification.executer(idEnEdition, titre, type);
    } else {
      await creation.executer(titre, type);
    }
    setOuvert(false);
    idees.recharger();
  }

  async function supprimer(idee: IdeeContenu) {
    if (!confirm(`Supprimer l'idée « ${idee.titre} » ?`)) return;
    setSuppressionEnCoursId(idee.id);
    try {
      await supprimerIdee(idee.id);
      idees.recharger();
    } finally {
      setSuppressionEnCoursId(null);
    }
  }

  if (idees.erreur) return <EtatErreur message={idees.erreur} recharger={idees.recharger} />;

  const liste = idees.donnees ?? [];
  const listeFiltree = filtreType === 'all' ? liste : liste.filter((i) => i.type === filtreType);
  const erreurForm = creation.erreur ?? modification.erreur;
  const enCoursForm = creation.enCours || modification.enCours;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={Lightbulb}
        titre="Idées de contenu"
        sousTitre="Ce qui se prépare pour vos clients"
        action={
          <button onClick={ouvrirCreation} className="flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2 text-xs font-bold text-black">
            <Plus size={14} /> Nouvelle idée
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile icon={Lightbulb} valeur={liste.length} libelle="Total idées" teinte="#facc15" />
        {TYPES.map((t) => (
          <StatTile
            key={t}
            icon={ICONE_TYPE[t]}
            valeur={liste.filter((i) => i.type === t).length}
            libelle={t.charAt(0).toUpperCase() + t.slice(1)}
            teinte="#60a5fa"
          />
        ))}
      </div>

      <div className="flex gap-1 self-start rounded-xl border border-border bg-surface2 p-1">
        <button
          onClick={() => setFiltreType('all')}
          className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
            filtreType === 'all' ? 'bg-accent text-black' : 'text-muted hover:text-white'
          }`}
        >
          Tous
        </button>
        {TYPES.map((t) => (
          <button
            key={t}
            onClick={() => setFiltreType(t)}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold capitalize transition-colors ${
              filtreType === t ? 'bg-accent text-black' : 'text-muted hover:text-white'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {listeFiltree.length === 0 ? (
        <p className="rounded-3xl border border-border bg-surface p-8 text-center text-sm text-muted">Aucune idée pour le moment.</p>
      ) : (
        <TableVirtus
          colonnes={['Idée', 'Type', 'Créée le', '', '']}
          lignes={listeFiltree.map((idee) => [
            idee.titre,
            <span className="capitalize">{idee.type}</span>,
            new Date(idee.created_at).toLocaleDateString('fr-FR'),
            <button onClick={() => ouvrirEdition(idee)} className="flex items-center gap-1 text-xs font-semibold text-accent2 hover:text-white">
              <Pencil size={13} /> Modifier
            </button>,
            <button
              onClick={() => supprimer(idee)}
              disabled={suppressionEnCoursId === idee.id}
              className="flex items-center gap-1 text-xs font-semibold text-red-400 hover:text-red-300 disabled:opacity-50"
            >
              <Trash2 size={13} /> Supprimer
            </button>,
          ])}
        />
      )}

      {ouvert ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <Card className="w-full max-w-md !bg-surface">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">{idEnEdition !== null ? "Modifier l'idée" : 'Nouvelle idée'}</h2>
              <button onClick={() => setOuvert(false)} className="rounded-lg p-1 text-muted hover:bg-surface2 hover:text-white">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={envoyer} className="flex flex-col gap-3">
              <div>
                <label className={LABEL}>
                  Titre <span className="text-accent2">*</span>
                </label>
                <input
                  value={titre}
                  onChange={(e) => setTitre(e.target.value)}
                  placeholder='Série "Portrait d&apos;agriculteur"'
                  required
                  className={CHAMP}
                />
              </div>
              <div>
                <label className={LABEL}>
                  Type <span className="text-accent2">*</span>
                </label>
                <select value={type} onChange={(e) => setType(e.target.value)} required className={CHAMP}>
                  {TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              {erreurForm && <p className="text-xs font-semibold text-red-400">{erreurForm}</p>}
              <button type="submit" disabled={enCoursForm} className="mt-1 rounded-xl bg-accent px-3 py-2.5 text-xs font-bold text-black disabled:opacity-60">
                {enCoursForm ? 'Envoi...' : idEnEdition !== null ? 'Mettre à jour' : "Ajouter l'idée"}
              </button>
            </form>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
