import { useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useApi } from '../../lib/hooks/useApi';
import { listerPhotos, supprimerPhotos, televerserPhoto, type CategoriePhoto, type Photo } from '../../lib/api/chantiers';
import type { ContexteChantier } from './ChantierLayout';
import { useToast } from './toast';

const ONGLETS: { cle: CategoriePhoto; libelle: string; description: string }[] = [
  { cle: 'avant', libelle: 'Avant travaux', description: 'Documentation avant le démarrage des travaux' },
  { cle: 'pendant', libelle: 'Pendant travaux', description: 'Suivi photographique en cours de chantier' },
  { cle: 'apres', libelle: 'Après travaux', description: 'Réception et livraison finale' },
  { cle: 'securite', libelle: 'Sécurité', description: 'Equipements de protection et zonage' },
  { cle: 'qualite', libelle: 'Contrôle qualité', description: 'Inspection, tests et vérifications' },
];

function estImage(f: File) {
  return f.type.startsWith('image/') || /\.(jpe?g|png|gif|webp|bmp|heic|heif)$/i.test(f.name);
}

function dateAffichee(p: Photo) {
  return new Date(p.taken_at ?? p.created_at).toLocaleDateString('fr-FR');
}

/** Port de la page `#page-photos` (renderPhotos / photoThumb / addPhotos / lightbox). */
export default function Photos() {
  const { projet, estPartenaire } = useOutletContext<ContexteChantier>();
  const photos = useApi(() => listerPhotos(projet.id), [projet.id]);
  const [onglet, setOnglet] = useState<CategoriePhoto>('avant');
  const [modeSelection, setModeSelection] = useState(false);
  const [selection, setSelection] = useState<Set<number>>(new Set());
  const [survol, setSurvol] = useState(false);
  const [visionneuse, setVisionneuse] = useState<number | null>(null);
  const champFichier = useRef<HTMLInputElement>(null);
  const { toast, element: toastEl } = useToast();

  const infos = ONGLETS.find((o) => o.cle === onglet)!;
  const liste = (photos.donnees ?? []).filter((p) => p.category === onglet);

  useEffect(() => {
    if (visionneuse === null) return;
    const clavier = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setVisionneuse(null);
      if (e.key === 'ArrowLeft') setVisionneuse((i) => (i === null ? i : (i - 1 + liste.length) % liste.length));
      if (e.key === 'ArrowRight') setVisionneuse((i) => (i === null ? i : (i + 1) % liste.length));
    };
    window.addEventListener('keydown', clavier);
    return () => window.removeEventListener('keydown', clavier);
  }, [visionneuse, liste.length]);

  function changerOnglet(cle: CategoriePhoto) {
    setOnglet(cle);
    setModeSelection(false);
    setSelection(new Set());
  }

  async function ajouter(fichiers: FileList | null) {
    if (!fichiers || estPartenaire) return;
    let ok = 0;
    let echecs = 0;
    let ignores = 0;
    for (const f of Array.from(fichiers)) {
      if (!estImage(f)) {
        ignores++;
        continue;
      }
      try {
        await televerserPhoto(projet.id, f, { category: onglet });
        ok++;
      } catch (e) {
        echecs++;
        toast(`${f.name} — ${e instanceof Error ? e.message : 'Erreur'}`, 'err');
      }
    }
    photos.recharger();
    if (ok > 0 && !echecs && !ignores) toast('Photo(s) envoyée(s)', 'ok');
    else if (ok > 0) toast(`${ok} photo(s) envoyée(s).`, echecs ? 'err' : 'ok');
    else if (ignores && !echecs) toast('Format de fichier non reconnu (JPG, PNG, GIF, WebP).', 'err');
    else if (echecs) toast('Aucune photo n’a pu être envoyée.', 'err');
  }

  async function supprimer(p: Photo) {
    if (!confirm('Supprimer cette photo ?')) return;
    try {
      await supprimerPhotos(projet.id, [p.id]);
      photos.recharger();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erreur', 'err');
    }
  }

  async function supprimerSelection() {
    const ids = [...selection];
    if (!ids.length || !confirm(`Supprimer ${ids.length} photo(s) ?`)) return;
    try {
      await supprimerPhotos(projet.id, ids);
      setSelection(new Set());
      setModeSelection(false);
      photos.recharger();
      toast('Photos supprimées', 'ok');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erreur', 'err');
    }
  }

  function basculer(id: number) {
    setSelection((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function toutSelectionner() {
    const ids = liste.map((p) => p.id);
    setSelection((s) => (ids.length && ids.every((id) => s.has(id)) ? new Set() : new Set(ids)));
  }

  return (
    <div className="page active gda-legacy" id="page-photos">
      <div className="page-header">
        <div>
          <div className="page-title">Galerie photos</div>
          <div className="page-sub">Documentation visuelle du chantier</div>
        </div>
      </div>

      <div className="photo-gallery-shell">
        <div className="photo-tabs" role="tablist" aria-label="Catégories de photos">
          {ONGLETS.map((o) => (
            <div key={o.cle} className={`photo-tab${o.cle === onglet ? ' active' : ''}`} role="tab" onClick={() => changerOnglet(o.cle)}>
              {o.libelle}
              <span className="photo-tab__nb">{(photos.donnees ?? []).filter((p) => p.category === o.cle).length}</span>
            </div>
          ))}
        </div>

        <div>
          <section className="photo-stage">
            <header className="photo-hero">
              <div className="photo-hero-copy">
                <span className="photo-hero-eyebrow">Documentation visuelle</span>
                <h2 className="photo-hero-title">{infos.libelle}</h2>
                <p className="photo-hero-desc">{infos.description}</p>
              </div>
              <div className="photo-hero-meta">
                <span className="photo-count-badge">{liste.length === 1 ? '1 photo' : `${liste.length} photos`}</span>
                {liste.length > 0 && !estPartenaire && (
                  <button
                    type="button"
                    className="btn btn-secondary photo-select-toggle"
                    onClick={() => {
                      setModeSelection((v) => !v);
                      setSelection(new Set());
                    }}
                  >
                    {modeSelection ? 'Annuler' : 'Sélectionner'}
                  </button>
                )}
              </div>
            </header>

            {modeSelection && (
              <div className="photo-select-toolbar">
                <span className="photo-select-count">{selection.size} sélectionnée(s)</span>
                <button type="button" className="btn btn-secondary" onClick={toutSelectionner}>
                  Tout sélectionner
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ color: 'var(--danger)', borderColor: 'rgba(192,26,26,.35)' }}
                  disabled={selection.size === 0}
                  onClick={supprimerSelection}
                >
                  Supprimer la sélection
                </button>
              </div>
            )}

            <div className="photo-upload-card">
              <div
                className={`drop-zone${survol ? ' drag-active' : ''}`}
                style={estPartenaire ? { opacity: 0.55, pointerEvents: 'none' } : undefined}
                onClick={() => champFichier.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setSurvol(true);
                }}
                onDragLeave={() => setSurvol(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setSurvol(false);
                  void ajouter(e.dataTransfer.files);
                }}
              >
                <div className="dz-icon-ring">📷</div>
                <div className="dz-text">
                  <strong>Cliquez ici</strong> ou glissez vos photos dans <strong>{infos.libelle}</strong>
                  <span>JPG, PNG · max 64 Mo</span>
                </div>
              </div>
              <input
                ref={champFichier}
                type="file"
                multiple
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  void ajouter(e.target.files);
                  e.target.value = '';
                }}
              />
            </div>

            <div className="photo-grid">
              {liste.length === 0 ? (
                <div className="photo-empty">
                  <div className="photo-empty-icon">◇</div>
                  <p className="photo-empty-title">Aucune photo pour l’instant</p>
                  <p className="photo-empty-text">Importez vos premières images avec la zone de dépôt ci-dessus.</p>
                </div>
              ) : (
                liste.map((p, i) => {
                  const choisie = selection.has(p.id);
                  return (
                    <article
                      key={p.id}
                      className={`photo-item${modeSelection ? ' photo-item--select' : ''}${choisie ? ' photo-item--selected' : ''}`}
                      onClick={() => (modeSelection ? basculer(p.id) : setVisionneuse(i))}
                    >
                      <div className="photo-frame">
                        {modeSelection && <div className={`photo-select-check${choisie ? ' checked' : ''}`}>{choisie ? '✓' : ''}</div>}
                        <img src={p.url} alt="" loading="lazy" />
                        <div className="photo-date-badge">{dateAffichee(p)}</div>
                        <div className="photo-overlay">
                          <span className="photo-zoom-hint">Agrandir</span>
                          {!estPartenaire && (
                            <div className="photo-overlay-btns">
                              <button
                                className="photo-action-btn del"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void supprimer(p);
                                }}
                              >
                                Supprimer
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="photo-caption">
                        <span className="photo-caption-label">{p.caption || infos.libelle}</span>
                        <span className="photo-caption-date">{dateAffichee(p)}</span>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </div>

      {visionneuse !== null && liste[visionneuse] && (
        <div className="lightbox open gda-legacy" onClick={() => setVisionneuse(null)}>
          <button type="button" className="lb-close" onClick={() => setVisionneuse(null)}>
            ✕
          </button>
          <button
            type="button"
            className="lb-nav lb-prev"
            onClick={(e) => {
              e.stopPropagation();
              setVisionneuse((visionneuse - 1 + liste.length) % liste.length);
            }}
          >
            ‹
          </button>
          <img src={liste[visionneuse].url} alt="" onClick={(e) => e.stopPropagation()} />
          <button
            type="button"
            className="lb-nav lb-next"
            onClick={(e) => {
              e.stopPropagation();
              setVisionneuse((visionneuse + 1) % liste.length);
            }}
          >
            ›
          </button>
        </div>
      )}
      {toastEl}
    </div>
  );
}
