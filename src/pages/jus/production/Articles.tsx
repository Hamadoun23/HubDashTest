import { useState } from 'react';
import { Boxes } from 'lucide-react';
import { EtatErreur } from '../../../components/ui/EtatRequete';
import { FormulaireEtHistorique } from '../../../components/ui/FormulaireEtHistorique';
import { Badge } from '../../../components/ui/Table';
import { useAction, useApi } from '../../../lib/hooks/useApi';
import { actualiserArticle, listerArticles, modifierArticle, obtenirOptions, supprimerArticle } from '../../../lib/api/jus';

export default function Articles() {
  const articles = useApi(() => listerArticles(), []);
  const options = useApi(() => obtenirOptions(), []);
  const actualisation = useAction(actualiserArticle);
  const modification = useAction(modifierArticle);
  const suppression = useAction(supprimerArticle);

  const [articleId, setArticleId] = useState('');
  const [ajout, setAjout] = useState('');

  // Le formulaire principal de cette page sert à actualiser une quantité (creerArticle n'a
  // pas d'écran de saisie dédié), donc modifier/supprimer un article sont proposés à part,
  // via un panneau d'édition ouvert depuis la ligne du tableau (mêmes seuils/prix que NouvelArticle).
  const [idEnEdition, setIdEnEdition] = useState<number | null>(null);
  const [seuilAlerte, setSeuilAlerte] = useState('');
  const [prix33, setPrix33] = useState('');
  const [prix1l, setPrix1l] = useState('');

  async function envoyer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await actualisation.executer(Number(articleId), Number(ajout));
    setArticleId('');
    setAjout('');
    articles.recharger();
  }

  async function enregistrerModification(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (idEnEdition === null) return;
    await modification.executer(idEnEdition, {
      seuil_alerte: Number(seuilAlerte),
      prix_33cl: prix33 ? Number(prix33) : undefined,
      prix_1l: prix1l ? Number(prix1l) : undefined,
    });
    setIdEnEdition(null);
    setSeuilAlerte('');
    setPrix33('');
    setPrix1l('');
    articles.recharger();
  }

  function annulerEdition() {
    setIdEnEdition(null);
    setSeuilAlerte('');
    setPrix33('');
    setPrix1l('');
  }

  async function supprimer(id: number) {
    if (!window.confirm('Supprimer définitivement cet article ?')) return;
    await suppression.executer(id);
    if (idEnEdition === id) annulerEdition();
    articles.recharger();
  }

  return articles.erreur ? (
    <EtatErreur message={articles.erreur} recharger={articles.recharger} />
  ) : (
    <div>
      <FormulaireEtHistorique
        icon={Boxes}
        titre="Articles / Stock"
        sousTitre="Actualiser le stock d'un article"
        onSubmit={envoyer}
        envoiEnCours={actualisation.enCours}
        erreurEnvoi={actualisation.erreur}
        texteBouton="Ajouter au stock"
        champs={[
          {
            label: 'Article',
            valeur: articleId,
            onChange: setArticleId,
            requis: true,
            options: (options.donnees?.articles_actualisables ?? []).map((a) => ({ valeur: String(a.value), libelle: a.label })),
          },
          { label: 'Quantité à ajouter', placeholder: '50', valeur: ajout, onChange: setAjout, requis: true },
        ]}
        colonnesHistorique={['Article', 'Quantité', 'Seuil', '', '']}
        lignesHistorique={(articles.donnees ?? []).map((a) => [
          a.type_art_display,
          a.qte_art,
          a.seuil_alerte,
          <Badge tone={a.sous_seuil ? 'danger' : 'success'}>{a.sous_seuil ? 'Sous le seuil' : 'OK'}</Badge>,
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setIdEnEdition(a.id);
                setSeuilAlerte(String(a.seuil_alerte));
                setPrix33(a.prix_33cl !== null ? String(a.prix_33cl) : '');
                setPrix1l(a.prix_1l !== null ? String(a.prix_1l) : '');
              }}
              className="text-xs font-semibold text-accent2 hover:text-accent"
            >
              Modifier
            </button>
            <button
              type="button"
              onClick={() => supprimer(a.id)}
              disabled={suppression.enCours}
              className="text-xs font-semibold text-red-400 hover:text-red-300 disabled:opacity-50"
            >
              Supprimer
            </button>
          </div>,
        ])}
      />
      {suppression.erreur ? <p className="mt-2 text-xs font-semibold text-red-400">{suppression.erreur}</p> : null}

      {idEnEdition !== null && (
        <form onSubmit={enregistrerModification} className="mt-4 flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-surface p-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted">Seuil d'alerte</label>
            <input
              value={seuilAlerte}
              onChange={(e) => setSeuilAlerte(e.target.value)}
              required
              className="w-28 rounded-lg border border-border bg-surface2 px-2.5 py-1.5 text-sm text-white focus:border-accent focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted">Prix 33cl</label>
            <input
              value={prix33}
              onChange={(e) => setPrix33(e.target.value)}
              className="w-28 rounded-lg border border-border bg-surface2 px-2.5 py-1.5 text-sm text-white focus:border-accent focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted">Prix 1L</label>
            <input
              value={prix1l}
              onChange={(e) => setPrix1l(e.target.value)}
              className="w-28 rounded-lg border border-border bg-surface2 px-2.5 py-1.5 text-sm text-white focus:border-accent focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={modification.enCours}
            className="rounded-xl bg-accent px-4 py-2 text-xs font-bold text-black disabled:opacity-60"
          >
            {modification.enCours ? 'Envoi...' : 'Mettre à jour'}
          </button>
          <button type="button" onClick={annulerEdition} className="text-xs font-semibold text-muted hover:text-white">
            Annuler la modification
          </button>
          {modification.erreur ? <p className="text-xs font-semibold text-red-400">{modification.erreur}</p> : null}
        </form>
      )}
    </div>
  );
}
