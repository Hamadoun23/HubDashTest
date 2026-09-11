import { useRef, useState } from 'react';
import { Camera, Trash2, Upload } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import { Card } from '../../components/ui-light/Card';
import { EtatChargement, EtatErreur } from '../../components/ui-light/EtatRequete';
import { useAction, useApi } from '../../lib/hooks/useApi';
import { listerPhotos, supprimerPhotos, televerserPhoto, type CategoriePhoto } from '../../lib/api/chantiers';
import type { ContexteChantier } from './ChantierLayout';

const CATEGORIES: { valeur: CategoriePhoto; libelle: string }[] = [
  { valeur: 'avant', libelle: 'Avant' },
  { valeur: 'pendant', libelle: 'Pendant' },
  { valeur: 'apres', libelle: 'Après' },
  { valeur: 'securite', libelle: 'Sécurité' },
  { valeur: 'qualite', libelle: 'Qualité' },
];

export default function Photos() {
  const { projet } = useOutletContext<ContexteChantier>();
  const photos = useApi(() => listerPhotos(projet.id), [projet.id]);
  const televersement = useAction(televerserPhoto);
  const suppression = useAction(supprimerPhotos);
  const inputFichier = useRef<HTMLInputElement>(null);
  const [categorie, setCategorie] = useState<CategoriePhoto>('pendant');

  async function surChoixFichier(e: React.ChangeEvent<HTMLInputElement>) {
    const fichier = e.target.files?.[0];
    if (!fichier) return;
    await televersement.executer(projet.id, fichier, { category: categorie });
    e.target.value = '';
    photos.recharger();
  }

  async function supprimer(id: number) {
    if (!window.confirm('Supprimer définitivement cette photo ?')) return;
    await suppression.executer(projet.id, [id]);
    photos.recharger();
  }

  if (photos.chargement) return <EtatChargement texte="Chargement des photos…" />;
  if (photos.erreur) return <EtatErreur message={photos.erreur} recharger={photos.recharger} />;

  return (
    <div>
      <Card className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-slate-500">Catégorie</label>
          <select
            value={categorie}
            onChange={(e) => setCategorie(e.target.value as CategoriePhoto)}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 focus:border-chantiers-terracotta focus:outline-none"
          >
            {CATEGORIES.map((c) => (
              <option key={c.valeur} value={c.valeur}>
                {c.libelle}
              </option>
            ))}
          </select>
        </div>
        <input ref={inputFichier} type="file" accept="image/*" hidden onChange={surChoixFichier} />
        <button
          onClick={() => inputFichier.current?.click()}
          disabled={televersement.enCours}
          className="flex items-center gap-2 rounded-xl bg-chantiers-terracotta px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
        >
          <Upload size={14} />
          {televersement.enCours ? 'Envoi...' : 'Ajouter une photo'}
        </button>
      </Card>
      {(televersement.erreur ?? suppression.erreur) ? (
        <p className="mb-3 text-xs font-semibold text-chantiers-rouge">{televersement.erreur ?? suppression.erreur}</p>
      ) : null}

      {(photos.donnees ?? []).length === 0 ? (
        <Card className="flex flex-col items-center gap-2 py-10 text-center">
          <Camera size={20} className="text-slate-400" />
          <p className="text-sm text-slate-500">Aucune photo pour ce chantier pour le moment.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {(photos.donnees ?? []).map((photo) => (
            <Card key={photo.id} className="!p-0 overflow-hidden">
              <div className="relative">
                <img src={photo.url} alt={photo.caption || photo.category_display} className="aspect-video w-full object-cover" />
                <button
                  onClick={() => supprimer(photo.id)}
                  disabled={suppression.enCours}
                  title="Supprimer la photo"
                  className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-chantiers-rouge/80 disabled:opacity-50"
                >
                  <Trash2 size={13} />
                </button>
              </div>
              <div className="p-3">
                <p className="text-xs font-semibold text-slate-800">{photo.category_display}</p>
                {photo.caption ? <p className="mt-0.5 text-xs text-slate-500">{photo.caption}</p> : null}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
