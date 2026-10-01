import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import '../../styles/gda-daily.css';
import '../../styles/gda-daily-theme.css';
import { useApi } from '../../lib/hooks/useApi';
import {
  creerPhase,
  creerProjet,
  creerSousPhase,
  creerTache,
  listerProjets,
  modifierPhase,
  modifierProjet,
  modifierSousPhase,
  modifierTache,
  obtenirStructure,
  reordonnerPhases,
  reordonnerProjets,
  reordonnerSousPhases,
  reordonnerTaches,
  supprimerPhase,
  supprimerProjet,
  supprimerSousPhase,
  supprimerTache,
  type Projet,
} from '../../lib/api/chantiers';
import { CLE_DERNIER_CHANTIER } from './Accueil';
import { useEstPartenaire } from './ChantierLayout';
import EnteteGda, { STYLE_COQUILLE, langueInitiale } from './EnteteGda';
import { useToast } from './toast';

type Entite = 'project' | 'phase' | 'subphase' | 'task';
type Editeur = {
  action: 'create' | 'edit' | 'delete';
  entite: Entite;
  projetId?: number;
  phaseId?: number;
  sousPhaseId?: number;
  tacheId?: number;
  nom?: string;
  activite?: string;
  startDay?: number;
  duree?: number;
  client?: string;
  debut?: string | null;
  fin?: string | null;
};

const TITRES: Record<string, string> = {
  project_create: 'Nouveau projet',
  project_edit: 'Modifier le projet',
  project_delete: 'Supprimer le projet',
  phase_create: 'Nouvelle phase',
  phase_edit: 'Modifier la phase',
  phase_delete: 'Supprimer la phase',
  subphase_create: 'Nouvelle sous-phase',
  subphase_edit: 'Modifier la sous-phase',
  subphase_delete: 'Supprimer la sous-phase',
  task_create: 'Nouvelle activité',
  task_edit: 'Modifier l’activité',
  task_delete: 'Supprimer l’activité',
};

const AIDES: Record<string, string> = {
  project_create: 'Nommez le chantier avant d’ajouter phases et activités.',
  project_edit: 'Le nom est affiché dans la liste des projets et sur le chantier.',
  phase_create: 'Une phase regroupe plusieurs sous-phases.',
  phase_edit: 'Le libellé est visible dans la structure et sur le chantier.',
  subphase_create: 'La sous-phase accueillera les activités du chantier.',
  subphase_edit: 'Le libellé est visible dans la structure et sur le chantier.',
  task_create: 'Définissez l’activité, sa date de début et sa durée.',
  task_edit: 'Ajustez le libellé, la date de début et la durée de l’activité.',
};

function dateVersStartDay(debutProjet: string, date: string) {
  const [a, m, j] = debutProjet.split('-').map(Number);
  const [a2, m2, j2] = date.split('-').map(Number);
  const ecart = Math.round((new Date(a2, m2 - 1, j2).getTime() - new Date(a, m - 1, j).getTime()) / 86400000);
  return Math.max(1, ecart + 1);
}

function startDayVersDate(debutProjet: string, startDay: number) {
  const [a, m, j] = debutProjet.split('-').map(Number);
  const d = new Date(a, m - 1, j);
  d.setDate(d.getDate() + Math.max(0, startDay - 1));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function aujourdhui() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Déplace `id` à la place de `cible` dans la liste d'identifiants. */
function deplacer(ids: number[], id: number, cible: number) {
  const reste = ids.filter((x) => x !== id);
  const index = reste.indexOf(cible);
  const origine = ids.indexOf(id);
  const destination = ids.indexOf(cible);
  reste.splice(origine < destination ? index + 1 : index, 0, id);
  return reste;
}

function Poignee({ onDebut }: { onDebut: () => void }) {
  return (
    <span
      className="gda-drag-handle"
      draggable
      role="button"
      aria-label="Glisser pour réordonner"
      title="Glisser pour réordonner"
      onDragStart={(e) => {
        e.stopPropagation();
        e.dataTransfer.effectAllowed = 'move';
        onDebut();
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <i />
      <i />
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}

/** Ancienne route `/chantiers/:id/structure` : la structure vit désormais dans la page Projets, comme dans Laravel. */
export function RedirectionStructure() {
  const { id } = useParams();
  return <Navigate to={`/chantiers/projets?structure=${id}`} replace />;
}

/** Port de `projects/index.blade.php` + `gda-projects.js` (gestion des projets et de leur structure). */
export default function Projets() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const estPartenaire = useEstPartenaire();
  const [langue, setLangue] = useState(langueInitiale);
  const projets = useApi(listerProjets, []);
  const [structureId, setStructureId] = useState<number | null>(() => Number(params.get('structure')) || null);
  const structure = useApi(() => (structureId ? obtenirStructure(structureId) : Promise.resolve(null)), [structureId]);
  const [editeur, setEditeur] = useState<Editeur | null>(null);
  const [nom, setNom] = useState('');
  const [client, setClient] = useState('');
  const [debut, setDebut] = useState('');
  const [fin, setFin] = useState('');
  const [activite, setActivite] = useState('');
  const [dateDebut, setDateDebut] = useState('');
  const [duree, setDuree] = useState('1');
  const glisse = useRef<{ niveau: string; parent: number; id: number } | null>(null);
  const panneauStructure = useRef<HTMLDivElement>(null);
  const panneauEditeur = useRef<HTMLDivElement>(null);
  const { toast, element: toastEl } = useToast();

  const liste = projets.donnees ?? [];
  const projetStructure = liste.find((p) => p.id === structureId);
  const debutProjet = (id?: number) => liste.find((p) => p.id === id)?.start_date?.slice(0, 10) ?? aujourdhui();
  const courant = localStorage.getItem(CLE_DERNIER_CHANTIER);

  useEffect(() => {
    if (structureId) panneauStructure.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [structureId]);

  useEffect(() => {
    if (editeur) panneauEditeur.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [editeur]);

  function ouvrirStructure(p: Projet) {
    setEditeur(null);
    setStructureId(p.id);
    setParams({ structure: String(p.id) }, { replace: true });
  }

  function fermerStructure() {
    setStructureId(null);
    setEditeur(null);
    setParams({}, { replace: true });
  }

  function ouvrirEditeur(config: Editeur) {
    setEditeur(config);
    setNom(config.nom ?? '');
    setClient(config.client ?? '');
    setDebut(config.debut ?? '');
    setFin(config.fin ?? '');
    setActivite(config.activite ?? '');
    setDateDebut(startDayVersDate(debutProjet(config.projetId), config.startDay ?? 1));
    setDuree(String(config.duree ?? 1));
  }

  async function executer(action: () => Promise<unknown>, message: string, rechargerStructure = true) {
    try {
      await action();
      toast(message, 'ok');
      setEditeur(null);
      projets.recharger();
      if (rechargerStructure) structure.recharger();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erreur', 'err');
    }
  }

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    if (!editeur) return;
    const { entite, action, projetId } = editeur;
    if (entite === 'task') {
      if (!activite.trim()) return toast('Le libellé de l’activité est obligatoire.', 'err');
      if (!dateDebut) return toast('La date de début est obligatoire.', 'err');
      const dureeJours = Number(duree);
      if (!Number.isInteger(dureeJours) || dureeJours < 1) return toast('Durée invalide.', 'err');
      const valeurs = { activity: activite.trim(), start_day: dateVersStartDay(debutProjet(projetId), dateDebut), duration_days: dureeJours };
      if (action === 'create') {
        return executer(() => creerTache(projetId!, { sous_phase: editeur.sousPhaseId!, ...valeurs }), 'Activité ajoutée');
      }
      return executer(() => modifierTache(projetId!, editeur.tacheId!, valeurs), 'Activité mise à jour');
    }
    if (!nom.trim()) return toast('Le nom est obligatoire.', 'err');
    if (entite === 'project') {
      const valeurs = { name: nom.trim(), client, start_date: debut || undefined, end_date: fin || undefined };
      if (action === 'create') {
        return executer(() => creerProjet({ ...valeurs, status: 'planifie' }), 'Projet créé — cliquez sur la ligne pour ajouter les phases.', false);
      }
      return executer(() => modifierProjet(projetId!, valeurs), 'Projet mis à jour');
    }
    if (entite === 'phase') {
      if (action === 'create') return executer(() => creerPhase({ projet: projetId!, name: nom.trim() }), 'Phase ajoutée');
      return executer(() => modifierPhase(editeur.phaseId!, { name: nom.trim() }), 'Phase mise à jour');
    }
    if (action === 'create') return executer(() => creerSousPhase({ phase: editeur.phaseId!, name: nom.trim() }), 'Sous-phase ajoutée');
    return executer(() => modifierSousPhase(editeur.sousPhaseId!, { name: nom.trim() }), 'Sous-phase mise à jour');
  }

  function confirmerSuppression() {
    if (!editeur) return;
    const { entite, projetId } = editeur;
    if (entite === 'task') return executer(() => supprimerTache(projetId!, editeur.tacheId!), 'Activité supprimée');
    if (entite === 'phase') return executer(() => supprimerPhase(editeur.phaseId!), 'Phase supprimée');
    if (entite === 'subphase') return executer(() => supprimerSousPhase(editeur.sousPhaseId!), 'Sous-phase supprimée');
    return executer(async () => {
      await supprimerProjet(projetId!);
      if (courant === String(projetId)) localStorage.removeItem(CLE_DERNIER_CHANTIER);
      if (structureId === projetId) fermerStructure();
    }, 'Projet supprimé', false);
  }

  function messageSuppression(ed: Editeur) {
    if (ed.entite === 'project') return `Le projet « ${ed.nom || 'ce projet'} » et toute sa structure (phases, sous-phases, activités) seront supprimés définitivement.`;
    if (ed.entite === 'task') return 'Cette activité sera retirée du chantier.';
    if (ed.entite === 'phase') return 'La phase et tout son contenu (sous-phases, activités) seront supprimés.';
    return 'La sous-phase et ses activités seront supprimées.';
  }

  async function visibilite(entite: 'phase' | 'subphase' | 'task', id: number, masquer: boolean) {
    await executer(
      () =>
        entite === 'phase'
          ? modifierPhase(id, { hidden_from_partner: masquer })
          : entite === 'subphase'
            ? modifierSousPhase(id, { hidden_from_partner: masquer })
            : modifierTache(structureId!, id, { hidden_from_partner: masquer }),
      'Visibilité partenaire mise à jour',
    );
  }

  function deposer(niveau: string, parent: number, ids: number[], cible: number, enregistrer: (ordre: number[]) => Promise<unknown>) {
    const g = glisse.current;
    glisse.current = null;
    if (!g || g.niveau !== niveau || g.parent !== parent || g.id === cible) return;
    void executer(() => enregistrer(deplacer(ids, g.id, cible)), 'Ordre enregistré', niveau !== 'projet');
  }

  const cibleDepot = (niveau: string, parent: number) => ({
    onDragOver: (e: React.DragEvent) => {
      if (glisse.current?.niveau === niveau && glisse.current.parent === parent) e.preventDefault();
    },
  });

  function boutonVisibilite(entite: 'phase' | 'subphase' | 'task', id: number, masque: boolean, herite: boolean) {
    if (herite) {
      return (
        <span className="partner-hidden-badge partner-hidden-badge--inherited" title="Masqué (parent)">
          Masqué (parent)
        </span>
      );
    }
    return (
      <button
        type="button"
        className={`btn btn-secondary btn-sm ${masque ? 'partner-show-btn' : 'partner-hide-btn'}`}
        onClick={() => void visibilite(entite, id, !masque)}
      >
        {masque ? 'Afficher partenaire' : 'Masquer partenaire'}
      </button>
    );
  }

  const phases = structure.donnees?.phases ?? [];
  const nbSous = phases.reduce((s, ph) => s + ph.sub_phases.length, 0);
  const nbTaches = phases.reduce((s, ph) => s + ph.sub_phases.reduce((t, sp) => t + sp.tasks.length, 0), 0);
  const cleEditeur = editeur ? `${editeur.entite}_${editeur.action}` : '';

  return (
    <div className="gda-daily" style={STYLE_COQUILLE}>
      <EnteteGda libelle="Gestion des projets" chantier={false} langue={langue} onLangue={setLangue} />

      <main className="main main--solo gda-legacy">
        {estPartenaire ? (
          <div className="card" style={{ textAlign: 'center', color: 'var(--muted)' }}>
            La gestion des projets est réservée à l’équipe interne.{' '}
            <Link to="/chantiers" style={{ color: 'var(--blanc)', textDecoration: 'underline' }}>
              ← Retour au chantier
            </Link>
          </div>
        ) : (
          <>
            <div className="page-header">
              <div>
                <div className="page-title">Projets</div>
                <div className="page-sub">
                  Créez un projet, ouvrez « Phases », puis ajoutez les phases et sous-phases avant les activités sur le chantier.
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Link to="/chantiers" className="btn btn-secondary">
                  ← Retour au chantier
                </Link>
                <button type="button" className="btn btn-primary" onClick={() => ouvrirEditeur({ action: 'create', entite: 'project' })}>
                  + Nouveau projet
                </button>
              </div>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="card-head" style={{ margin: 0, borderRadius: 0 }}>
                Liste des projets
              </div>
              {projets.chargement && !projets.donnees ? (
                <div style={{ padding: 24, color: 'var(--muted)', textAlign: 'center' }}>Chargement…</div>
              ) : projets.erreur ? (
                <div style={{ padding: 24, color: 'var(--danger)', textAlign: 'center' }}>{projets.erreur}</div>
              ) : liste.length === 0 ? (
                <div style={{ padding: 24, color: 'var(--muted)', textAlign: 'center' }}>Aucun projet accessible.</div>
              ) : (
                <table className="tbl">
                  <thead>
                    <tr>
                      <th className="tbl-col-drag" aria-hidden="true" />
                      <th>Nom</th>
                      <th>Statut</th>
                      <th style={{ textAlign: 'center' }}>Progression</th>
                      <th style={{ textAlign: 'center' }}>Tâches</th>
                      <th style={{ textAlign: 'right', width: '1%' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {liste.map((p) => (
                      <tr
                        key={p.id}
                        className="project-row sortable-project-row"
                        style={{ cursor: 'pointer' }}
                        onClick={() => ouvrirStructure(p)}
                        {...cibleDepot('projet', 0)}
                        onDrop={() =>
                          deposer(
                            'projet',
                            0,
                            liste.map((x) => x.id),
                            p.id,
                            reordonnerProjets,
                          )
                        }
                      >
                        <td className="tbl-col-drag">
                          <Poignee onDebut={() => (glisse.current = { niveau: 'projet', parent: 0, id: p.id })} />
                        </td>
                        <td>
                          <strong>{p.name}</strong>
                          {courant === String(p.id) && <span style={{ color: 'var(--blanc-discret)', fontSize: 11 }}> · ouvert</span>}
                        </td>
                        <td>{p.status_display || '—'}</td>
                        <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--accent2)' }}>{Math.round(p.overall_progress ?? 0)}%</td>
                        <td style={{ textAlign: 'center' }}>{p.tasks_count ?? 0}</td>
                        <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() =>
                                ouvrirEditeur({ action: 'edit', entite: 'project', projetId: p.id, nom: p.name, client: p.client, debut: p.start_date, fin: p.end_date })
                              }
                            >
                              Modifier
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{ color: 'var(--danger)', borderColor: 'rgba(192,26,26,.35)' }}
                              onClick={() => ouvrirEditeur({ action: 'delete', entite: 'project', projetId: p.id, nom: p.name })}
                            >
                              Supprimer
                            </button>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => {
                                localStorage.setItem(CLE_DERNIER_CHANTIER, String(p.id));
                                navigate(`/chantiers/${p.id}`);
                              }}
                            >
                              Chantier
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {structureId !== null && (
              <div ref={panneauStructure} id="structure-panel" className="card" style={{ marginTop: 20 }}>
                <div
                  className="card-head"
                  style={{ margin: 0, borderRadius: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}
                >
                  <span className="structure-panel-title">{projetStructure?.name ?? structure.donnees?.name ?? 'Structure du projet'}</span>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() =>
                        projetStructure &&
                        ouvrirEditeur({
                          action: 'edit',
                          entite: 'project',
                          projetId: projetStructure.id,
                          nom: projetStructure.name,
                          client: projetStructure.client,
                          debut: projetStructure.start_date,
                          fin: projetStructure.end_date,
                        })
                      }
                    >
                      Modifier le projet
                    </button>
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => ouvrirEditeur({ action: 'create', entite: 'phase', projetId: structureId })}>
                      + Phase
                    </button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={fermerStructure}>
                      Fermer
                    </button>
                  </div>
                </div>
                {structure.chargement && !structure.donnees ? (
                  <div style={{ padding: 20, color: 'var(--muted)' }}>Chargement…</div>
                ) : structure.erreur ? (
                  <div style={{ padding: 24, color: 'var(--danger)', textAlign: 'center' }}>{structure.erreur}</div>
                ) : phases.length === 0 ? (
                  <div style={{ padding: 24, color: 'var(--muted)', textAlign: 'center' }}>Aucune phase. Cliquez sur « + Phase » pour commencer.</div>
                ) : (
                  <>
                    <div style={{ padding: '12px 20px 0', color: 'var(--muted)', fontSize: 12 }}>
                      {phases.length} phases · {nbSous} sous-phases · {nbTaches} activités
                    </div>
                    <div style={{ padding: '0 20px 20px', maxHeight: '70vh', overflowY: 'auto' }}>
                      <div className="structure-sort-phases">
                        {phases.map((ph) => (
                          <div
                            key={ph.id}
                            className={`structure-phase-block sortable-phase${ph.hidden_from_partner ? ' structure-partner-hidden' : ''}`}
                            style={{ borderBottom: '1px solid var(--border)', padding: '16px 0' }}
                            {...cibleDepot('phase', structureId)}
                            onDrop={() =>
                              deposer(
                                'phase',
                                structureId,
                                phases.map((x) => x.id),
                                ph.id,
                                (ordre) => reordonnerPhases(structureId, ordre),
                              )
                            }
                          >
                            <div className="structure-phase-head structure-sort-row">
                              <div className="structure-row-label">
                                <strong style={{ fontSize: 15, color: 'var(--accent2)' }}>{ph.name}</strong>
                                {ph.hidden_from_partner && <span className="partner-hidden-badge">Masqué partenaire</span>}
                              </div>
                              <div className="structure-row-grip">
                                <Poignee onDebut={() => (glisse.current = { niveau: 'phase', parent: structureId, id: ph.id })} />
                              </div>
                              <div className="structure-row-actions">
                                {boutonVisibilite('phase', ph.id, ph.hidden_from_partner, false)}
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => ouvrirEditeur({ action: 'edit', entite: 'phase', projetId: structureId, phaseId: ph.id, nom: ph.name })}
                                >
                                  Modifier
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => ouvrirEditeur({ action: 'create', entite: 'subphase', projetId: structureId, phaseId: ph.id })}
                                >
                                  + Sous-phase
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  style={{ color: 'var(--danger)', borderColor: 'rgba(192,26,26,.35)' }}
                                  onClick={() => ouvrirEditeur({ action: 'delete', entite: 'phase', projetId: structureId, phaseId: ph.id })}
                                >
                                  Supprimer phase
                                </button>
                              </div>
                            </div>
                            <ul className="structure-sort-sub">
                              {ph.sub_phases.length === 0 ? (
                                <li style={{ color: 'var(--muted)', fontSize: 13, padding: '8px 0' }}>Aucune sous-phase — utilisez « + Sous-phase ».</li>
                              ) : (
                                ph.sub_phases.map((sp) => (
                                  <li
                                    key={sp.id}
                                    className={`sortable-subphase${ph.hidden_from_partner || sp.hidden_from_partner ? ' structure-partner-hidden' : ''}`}
                                    {...cibleDepot('sous', ph.id)}
                                    onDrop={(e) => {
                                      e.stopPropagation();
                                      deposer(
                                        'sous',
                                        ph.id,
                                        ph.sub_phases.map((x) => x.id),
                                        sp.id,
                                        (ordre) => reordonnerSousPhases(ph.id, ordre),
                                      );
                                    }}
                                  >
                                    <div className="structure-sub-head structure-sort-row">
                                      <div className="structure-row-label">
                                        <span style={{ fontWeight: 600 }}>{sp.name}</span>
                                        {sp.hidden_from_partner && !ph.hidden_from_partner && <span className="partner-hidden-badge">Masqué partenaire</span>}
                                      </div>
                                      <div className="structure-row-grip">
                                        <Poignee onDebut={() => (glisse.current = { niveau: 'sous', parent: ph.id, id: sp.id })} />
                                      </div>
                                      <div className="structure-row-actions">
                                        {boutonVisibilite('subphase', sp.id, sp.hidden_from_partner, ph.hidden_from_partner)}
                                        <button
                                          type="button"
                                          className="btn btn-secondary btn-sm"
                                          onClick={() =>
                                            ouvrirEditeur({ action: 'edit', entite: 'subphase', projetId: structureId, phaseId: ph.id, sousPhaseId: sp.id, nom: sp.name })
                                          }
                                        >
                                          Modifier
                                        </button>
                                        <button
                                          type="button"
                                          className="btn btn-secondary btn-sm"
                                          onClick={() => ouvrirEditeur({ action: 'create', entite: 'task', projetId: structureId, sousPhaseId: sp.id })}
                                        >
                                          + Activité
                                        </button>
                                        <button
                                          type="button"
                                          className="btn btn-secondary btn-sm"
                                          style={{ fontSize: 10, color: 'var(--danger)', flexShrink: 0 }}
                                          onClick={() => ouvrirEditeur({ action: 'delete', entite: 'subphase', projetId: structureId, sousPhaseId: sp.id })}
                                        >
                                          Retirer
                                        </button>
                                      </div>
                                    </div>
                                    <ul className="structure-sort-task">
                                      {sp.tasks.length === 0 ? (
                                        <li style={{ color: 'var(--muted)', fontSize: 12, padding: '6px 0' }}>Aucune activité — utilisez « + Activité ».</li>
                                      ) : (
                                        sp.tasks.map((t) => {
                                          const herite = ph.hidden_from_partner || sp.hidden_from_partner;
                                          return (
                                            <li
                                              key={t.id}
                                              className={herite || t.hidden_from_partner ? 'structure-partner-hidden' : ''}
                                              {...cibleDepot('tache', sp.id)}
                                              onDrop={(e) => {
                                                e.stopPropagation();
                                                deposer(
                                                  'tache',
                                                  sp.id,
                                                  sp.tasks.map((x) => x.id),
                                                  t.id,
                                                  (ordre) => reordonnerTaches(structureId, sp.id, ordre),
                                                );
                                              }}
                                            >
                                              <div className="structure-task-row">
                                                <div className="structure-row-label">
                                                  <div>
                                                    {t.activity}
                                                    {t.hidden_from_partner && !herite && <span className="partner-hidden-badge"> Masqué partenaire</span>}
                                                  </div>
                                                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                                                    Début{' '}
                                                    {new Date(`${startDayVersDate(debutProjet(structureId), t.start_day ?? 1)}T12:00:00`).toLocaleDateString('fr-FR')} ·{' '}
                                                    {t.duration_days ?? 1} j
                                                  </div>
                                                </div>
                                                <div className="structure-row-grip">
                                                  <Poignee onDebut={() => (glisse.current = { niveau: 'tache', parent: sp.id, id: t.id })} />
                                                </div>
                                                <div className="structure-row-actions">
                                                  {boutonVisibilite('task', t.id, t.hidden_from_partner, herite)}
                                                  <button
                                                    type="button"
                                                    className="btn btn-secondary btn-sm"
                                                    style={{ fontSize: 10 }}
                                                    onClick={() =>
                                                      ouvrirEditeur({
                                                        action: 'edit',
                                                        entite: 'task',
                                                        projetId: structureId,
                                                        sousPhaseId: sp.id,
                                                        tacheId: t.id,
                                                        activite: t.activity,
                                                        startDay: t.start_day ?? 1,
                                                        duree: t.duration_days ?? 1,
                                                      })
                                                    }
                                                  >
                                                    Modifier
                                                  </button>
                                                  <button
                                                    type="button"
                                                    className="btn btn-secondary btn-sm"
                                                    style={{ fontSize: 10, color: 'var(--danger)' }}
                                                    onClick={() => ouvrirEditeur({ action: 'delete', entite: 'task', projetId: structureId, tacheId: t.id })}
                                                  >
                                                    Supprimer
                                                  </button>
                                                </div>
                                              </div>
                                            </li>
                                          );
                                        })
                                      )}
                                    </ul>
                                  </li>
                                ))
                              )}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {editeur && (
              <div ref={panneauEditeur} className="card" style={{ marginTop: 16 }}>
                <div
                  className="card-head"
                  style={{ margin: 0, borderRadius: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}
                >
                  <span>{TITRES[cleEditeur] ?? 'Formulaire'}</span>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditeur(null)}>
                    Fermer
                  </button>
                </div>
                <div style={{ padding: 20 }}>
                  {AIDES[cleEditeur] && <p style={{ color: 'var(--muted)', fontSize: 13, margin: '0 0 14px' }}>{AIDES[cleEditeur]}</p>}
                  {editeur.action === 'delete' ? (
                    <div>
                      <p style={{ margin: '0 0 16px', color: 'var(--text)' }}>{messageSuppression(editeur)}</p>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditeur(null)}>
                          Annuler
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }}
                          onClick={() => void confirmerSuppression()}
                        >
                          Confirmer la suppression
                        </button>
                      </div>
                    </div>
                  ) : (
                    <form noValidate onSubmit={soumettre}>
                      {editeur.entite === 'task' ? (
                        <>
                          <div className="form-group" style={{ marginBottom: 14 }}>
                            <label className="form-label">Activité</label>
                            <input type="text" value={activite} maxLength={500} autoFocus onChange={(e) => setActivite(e.target.value)} />
                          </div>
                          <div className="form-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
                            <div className="form-group">
                              <label className="form-label">Date de début</label>
                              <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} />
                            </div>
                            <div className="form-group">
                              <label className="form-label">Durée (jours)</label>
                              <input type="number" min={1} step={1} value={duree} onChange={(e) => setDuree(e.target.value)} />
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="form-group" style={{ marginBottom: 14 }}>
                            <label className="form-label">
                              {editeur.entite === 'project' ? 'Nom du projet' : editeur.entite === 'phase' ? 'Nom de la phase' : 'Nom de la sous-phase'}
                            </label>
                            <input type="text" value={nom} maxLength={255} autoFocus onChange={(e) => setNom(e.target.value)} />
                          </div>
                          {editeur.entite === 'project' && (
                            <div className="form-row cols3">
                              <div className="form-group">
                                <label className="form-label">Client</label>
                                <input type="text" value={client} onChange={(e) => setClient(e.target.value)} />
                              </div>
                              <div className="form-group">
                                <label className="form-label">Début</label>
                                <input type="date" value={debut} onChange={(e) => setDebut(e.target.value)} />
                              </div>
                              <div className="form-group">
                                <label className="form-label">Fin prévue</label>
                                <input type="date" value={fin} onChange={(e) => setFin(e.target.value)} />
                              </div>
                            </div>
                          )}
                        </>
                      )}
                      <div className="modal-actions">
                        <button type="button" className="btn btn-secondary" onClick={() => setEditeur(null)}>
                          Annuler
                        </button>
                        <button type="submit" className="btn btn-primary">
                          Enregistrer
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            )}
          </>
        )}
        {toastEl}
      </main>
    </div>
  );
}
