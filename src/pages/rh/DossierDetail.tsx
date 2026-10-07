import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Info,
  BellRing,
  Check,
  CheckCircle2,
  Circle,
  CircleDot,
  Clock,
  FileText,
  GitCommitVertical,
  History,
  MessageSquare,
  PauseCircle,
  PlayCircle,
  Send,
  X,
  XCircle,
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Avatar } from '../../components/ui/Avatar';
import { Card } from '../../components/ui/Card';
import { EtatChargement, EtatErreur } from '../../components/ui/EtatRequete';
import { Badge } from '../../components/ui/Table';
import { useAction, useApi } from '../../lib/hooks/useApi';
import {
  approuverDossier,
  envoyerMessage,
  estSourceDossier,
  lireDossier,
  mettreEnAttente,
  refuserDossier,
  relancerDossier,
  reprendreDossier,
  type EtatDossier,
  type EvenementDossier,
  type SourceDossier,
} from '../../lib/api/dossiers';

const DATE = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
const dater = (iso?: string | null) => (iso ? DATE.format(new Date(iso)) : '');

type Action = 'approuver' | 'attente' | 'refuser' | null;

/** Couleur du statut, avec la mise en attente qui prime sur « en validation ». */
function badgeStatut(etat: EtatDossier) {
  if (etat.en_attente) return <Badge tone="warning">En attente de complément</Badge>;
  const s = etat.document.statut;
  const tone = s === 'APPROUVE' || s === 'CLOTURE' ? 'success' : s === 'REJETE' || s === 'ANNULE' ? 'danger' : 'neutral';
  return <Badge tone={tone}>{etat.document.statut_libelle}</Badge>;
}

/** Faits du journal affichés comme des repères (pas des bulles de message). */
const REPERES: Record<string, { icone: typeof Check; couleur: string; phrase: (e: EvenementDossier) => string }> = {
  SOUMISSION: { icone: FileText, couleur: 'text-sky-300', phrase: (e) => `${e.auteur} a soumis le dossier${e.version ? ` (version ${e.version})` : ''}` },
  MODIFICATION: { icone: GitCommitVertical, couleur: 'text-sky-300', phrase: (e) => `${e.auteur} a modifié le dossier — version ${e.version}` },
  MISE_EN_ATTENTE: { icone: PauseCircle, couleur: 'text-amber-300', phrase: (e) => `${e.auteur} a mis le dossier en attente` },
  REPRISE: { icone: PlayCircle, couleur: 'text-emerald-300', phrase: (e) => `${e.auteur} a repris le dossier` },
  APPROBATION: { icone: CheckCircle2, couleur: 'text-emerald-300', phrase: (e) => `${e.auteur} a approuvé${e.contexte ? ` — ${e.contexte}` : ''}` },
  REJET: { icone: XCircle, couleur: 'text-red-300', phrase: (e) => `${e.auteur} a refusé${e.contexte ? ` — ${e.contexte}` : ''}` },
  RELANCE: { icone: BellRing, couleur: 'text-accent2', phrase: (e) => `${e.auteur} a relancé les valideurs` },
};

export default function DossierDetail() {
  const { source, id } = useParams();
  const navigate = useNavigate();
  const valide = estSourceDossier(source) && Number(id) > 0;
  const src = source as SourceDossier;
  const num = Number(id);

  const lecture = useApi(() => (valide ? lireDossier(src, num) : Promise.reject(new Error('Dossier introuvable.'))), [source, id]);
  const [etat, setEtat] = useState<EtatDossier | null>(null);
  useEffect(() => {
    if (lecture.donnees) setEtat(lecture.donnees);
  }, [lecture.donnees]);

  const [action, setAction] = useState<Action>(null);
  const [texteAction, setTexteAction] = useState('');
  const [message, setMessage] = useState('');
  const [onglet, setOnglet] = useState<'fil' | 'versions'>('fil');
  const finFil = useRef<HTMLDivElement>(null);

  const envoi = useAction(envoyerMessage);
  const attente = useAction(mettreEnAttente);
  const reprise = useAction(reprendreDossier);
  const approbation = useAction(approuverDossier);
  const refus = useAction(refuserDossier);
  const relance = useAction(relancerDossier);
  const [messageRelance, setMessageRelance] = useState('');
  const [relanceOuverte, setRelanceOuverte] = useState(false);

  useEffect(() => {
    finFil.current?.scrollIntoView({ block: 'end' });
  }, [etat?.evenements.length, onglet]);

  if (!valide) return <EtatErreur message="Dossier introuvable." recharger={() => navigate('/rh/validations')} />;
  if (lecture.chargement && !etat) return <EtatChargement texte="Chargement du dossier…" />;
  if (lecture.erreur && !etat) return <EtatErreur message={lecture.erreur} recharger={lecture.recharger} />;
  if (!etat) return null;

  const doc = etat.document;
  const enCours = envoi.enCours || attente.enCours || reprise.enCours || approbation.enCours || refus.enCours || relance.enCours;
  const erreur = envoi.erreur ?? attente.erreur ?? reprise.erreur ?? approbation.erreur ?? refus.erreur ?? relance.erreur;

  async function relancer() {
    try {
      setEtat(await relance.executer(src, num, messageRelance.trim()));
      setMessageRelance('');
      setRelanceOuverte(false);
    } catch {
      /* erreur affichée sous les actions */
    }
  }

  async function confirmerAction() {
    const texte = texteAction.trim();
    try {
      if (action === 'attente') setEtat(await attente.executer(src, num, texte));
      else if (action === 'refuser') {
        await refus.executer(src, num, texte);
        lecture.recharger();
      } else if (action === 'approuver') {
        await approbation.executer(src, num, texte);
        lecture.recharger();
      }
      setAction(null);
      setTexteAction('');
    } catch {
      /* message d'erreur affiché sous les actions */
    }
  }

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    try {
      setEtat(await envoi.executer(src, num, message.trim()));
      setMessage('');
    } catch {
      /* erreur affichée sous le champ */
    }
  }

  const configAction = {
    approuver: { titre: 'Approuver', aide: 'Commentaire (facultatif)', obligatoire: false, bouton: 'Confirmer l’approbation', classe: 'bg-emerald-500 text-black' },
    attente: { titre: 'Mettre en attente', aide: 'Que manque-t-il ? Votre observation est envoyée au demandeur.', obligatoire: true, bouton: 'Mettre en attente', classe: 'bg-amber-400 text-black' },
    refuser: { titre: 'Refuser', aide: 'Motif du refus (obligatoire)', obligatoire: true, bouton: 'Confirmer le refus', classe: 'bg-red-500 text-white' },
  } as const;

  return (
    <div className="space-y-5">
      {/* --- En-tête -------------------------------------------------------- */}
      <div className="flex flex-wrap items-start gap-3">
        <Link
          to={etat.est_demandeur ? '/rh/mes-demandes' : '/rh/validations'}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface2 text-muted hover:text-white"
          title="Retour à la liste"
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">{etat.type_libelle}</p>
          <h1 className="font-display text-2xl font-bold text-white">{doc.numero}</h1>
          {src === 'requisition' && (
            <Link to={`/rh/requisitions/${num}`} className="text-xs font-semibold text-accent2 hover:underline">
              Voir les lignes de la réquisition →
            </Link>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted">
            {badgeStatut(etat)}
            <span>
              {doc.demandeur_nom}
              {doc.demandeur_departement_nom ? ` · ${doc.demandeur_departement_nom}` : ''}
            </span>
            {doc.etape_courante_libelle && doc.statut === 'EN_VALIDATION' && <span>· Étape : {doc.etape_courante_libelle}</span>}
          </div>
        </div>
      </div>

      {/* --- Bandeau mise en attente --------------------------------------- */}
      {etat.en_attente && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <Clock size={18} className="shrink-0 text-amber-300" />
          <span className="flex-1">
            {etat.est_demandeur
              ? 'Un valideur attend un complément de votre part : répondez dans le fil ou modifiez votre demande.'
              : 'Dossier en attente : le demandeur a été prévenu. Il repartira dès sa réponse.'}
          </span>
          {etat.peut_reprendre && (
            <button
              type="button"
              disabled={enCours}
              onClick={async () => setEtat(await reprise.executer(src, num, '').catch(() => etat))}
              className="rounded-xl bg-amber-400 px-3 py-1.5 text-xs font-bold text-black disabled:opacity-50"
            >
              Reprendre le dossier
            </button>
          )}
        </div>
      )}

      {/* --- Suivi pour le demandeur : qui doit encore se prononcer ----------- */}
      {etat.est_demandeur && doc.statut === 'EN_VALIDATION' && !etat.en_attente && (
        <Card className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">Où en est votre demande</p>
              {etat.attendus.length > 0 ? (
                <ul className="mt-2 space-y-1.5">
                  {etat.attendus.map((a) => (
                    <li key={a.etape} className="flex items-center gap-2 text-sm">
                      <Clock size={14} className="shrink-0 text-accent2" />
                      <span className="text-white">{a.etape}</span>
                      <span className="text-muted">— en attente de {a.qui}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-sm text-muted">Plus aucune décision attendue.</p>
              )}
            </div>
            {etat.attendus.length > 0 && (
              <button
                type="button"
                disabled={!etat.peut_relancer || enCours}
                onClick={() => setRelanceOuverte((v) => !v)}
                title={etat.peut_relancer ? 'Envoyer un rappel aux valideurs en attente' : ''}
                className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-black disabled:opacity-40"
              >
                <BellRing size={16} /> Relancer
              </button>
            )}
          </div>
          {!etat.peut_relancer && etat.prochaine_relance && (
            <p className="text-xs text-muted">Relance envoyée — nouvelle relance possible à partir du {dater(etat.prochaine_relance)}.</p>
          )}
          {relanceOuverte && etat.peut_relancer && (
            <div className="space-y-2 rounded-2xl border border-border bg-surface2 p-3">
              <label className="block text-xs font-semibold text-muted">Message pour les valideurs (facultatif)</label>
              <textarea
                autoFocus
                rows={2}
                value={messageRelance}
                onChange={(e) => setMessageRelance(e.target.value)}
                placeholder="Ex. : mon absence commence demain."
                className="w-full resize-y rounded-xl border border-border bg-surface px-3 py-2 text-sm text-white placeholder:text-muted focus:border-accent focus:outline-none"
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setRelanceOuverte(false)} className="rounded-xl px-3 py-2 text-xs font-semibold text-muted hover:text-white">
                  Annuler
                </button>
                <button type="button" disabled={enCours} onClick={relancer} className="rounded-xl bg-accent px-4 py-2 text-xs font-bold text-black disabled:opacity-50">
                  Envoyer la relance
                </button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* --- Actions du valideur -------------------------------------------- */}
      {etat.peut_decider && (
        <Card className="space-y-3">
          <p className="text-sm font-semibold text-white">Votre décision</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <button type="button" onClick={() => setAction('approuver')} className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold ${action === 'approuver' ? 'bg-emerald-500 text-black' : 'border border-emerald-400/40 text-emerald-300 hover:bg-emerald-500/10'}`}>
              <Check size={16} /> Approuver
            </button>
            <button
              type="button"
              disabled={!etat.peut_mettre_en_attente}
              onClick={() => setAction('attente')}
              title={etat.peut_mettre_en_attente ? '' : 'Déjà en attente'}
              className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold disabled:opacity-40 ${action === 'attente' ? 'bg-amber-400 text-black' : 'border border-amber-400/40 text-amber-200 hover:bg-amber-500/10'}`}
            >
              <PauseCircle size={16} /> Mettre en attente
            </button>
            <button type="button" onClick={() => setAction('refuser')} className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold ${action === 'refuser' ? 'bg-red-500 text-white' : 'border border-red-400/40 text-red-300 hover:bg-red-500/10'}`}>
              <X size={16} /> Refuser
            </button>
          </div>
          {action && (
            <div className="space-y-2 rounded-2xl border border-border bg-surface2 p-3">
              <label className="block text-xs font-semibold text-muted">{configAction[action].aide}</label>
              <textarea
                autoFocus
                rows={3}
                value={texteAction}
                onChange={(e) => setTexteAction(e.target.value)}
                className="w-full resize-y rounded-xl border border-border bg-surface px-3 py-2 text-sm text-white placeholder:text-muted focus:border-accent focus:outline-none"
              />
              <div className="flex flex-wrap justify-end gap-2">
                <button type="button" onClick={() => { setAction(null); setTexteAction(''); }} className="rounded-xl px-3 py-2 text-xs font-semibold text-muted hover:text-white">
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={enCours || (configAction[action].obligatoire && !texteAction.trim())}
                  onClick={confirmerAction}
                  className={`rounded-xl px-4 py-2 text-xs font-bold disabled:opacity-50 ${configAction[action].classe}`}
                >
                  {configAction[action].bouton}
                </button>
              </div>
            </div>
          )}
        </Card>
      )}
      {erreur && <p className="text-sm font-semibold text-red-400">{erreur}</p>}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        {/* --- Colonne gauche : contenu et circuit ---------------------------- */}
        <div className="space-y-5">
          <Card>
            <p className="mb-3 text-sm font-semibold text-white">Détails de la demande</p>
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {etat.resume.map((champ) => (
                <div key={champ.libelle} className="min-w-0">
                  <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted">{champ.libelle}</dt>
                  <dd className="mt-0.5 whitespace-pre-line break-words text-sm text-white">{champ.valeur}</dd>
                </div>
              ))}
            </dl>
            {doc.motif_rejet && (
              <p className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">Motif du refus : {doc.motif_rejet}</p>
            )}
          </Card>

          <Card>
            <p className="mb-3 text-sm font-semibold text-white">Circuit de validation</p>
            <ol className="space-y-3">
              {doc.etapes.map((etape) => {
                // Étape « pour information » : franchie sans qu'un valideur agisse.
                // L'afficher « Approuvé » laisserait croire que quelqu'un a validé.
                const info = etape.nature === 'INFORMATION' && etape.decision !== 'EN_ATTENTE';
                const Icone = info ? Info : etape.decision === 'APPROUVE' ? CheckCircle2 : etape.decision === 'REJETE' ? XCircle : etape.decision === 'EN_ATTENTE' ? CircleDot : Circle;
                const couleur = info ? 'text-sky-300' : etape.decision === 'APPROUVE' ? 'text-emerald-300' : etape.decision === 'REJETE' ? 'text-red-300' : etape.decision === 'EN_ATTENTE' ? 'text-accent2' : 'text-muted';
                return (
                  <li key={etape.id} className="flex gap-3">
                    <Icone size={18} className={`mt-0.5 shrink-0 ${couleur}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-white">{etape.libelle}</p>
                      <p className="text-xs text-muted">
                        {info ? 'Pour information — transmis' : etape.decision_libelle}
                        {etape.decide_par_nom ? ` · ${etape.decide_par_nom}` : ''}
                        {etape.date_decision ? ` · ${dater(etape.date_decision)}` : ''}
                      </p>
                      {etape.commentaire && <p className="mt-1 rounded-lg bg-surface2 px-2.5 py-1.5 text-xs text-white/85">« {etape.commentaire} »</p>}
                    </div>
                  </li>
                );
              })}
            </ol>
          </Card>
        </div>

        {/* --- Colonne droite : fil d'échange et versions --------------------- */}
        <Card className="flex max-h-[80vh] min-h-[420px] flex-col p-0">
          <div className="flex gap-1 border-b border-border p-2">
            {(
              [
                ['fil', 'Échanges', MessageSquare],
                ['versions', `Versions (${etat.versions.length})`, History],
              ] as const
            ).map(([cle, libelle, Icone]) => (
              <button
                key={cle}
                type="button"
                onClick={() => setOnglet(cle)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold ${onglet === cle ? 'bg-accent text-black' : 'text-muted hover:text-white'}`}
              >
                <Icone size={14} /> {libelle}
              </button>
            ))}
          </div>

          {onglet === 'fil' ? (
            <>
              <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
                {etat.evenements.length === 0 && <p className="py-10 text-center text-xs text-muted">Aucun échange pour le moment.</p>}
                {etat.evenements.map((evt) => {
                  const repere = REPERES[evt.type];
                  if (evt.type === 'MESSAGE') {
                    const duDemandeur = evt.auteur_id === doc.demandeur;
                    const aDroite = etat.est_demandeur ? duDemandeur : !duDemandeur;
                    return (
                      <div key={evt.id} className={`flex items-end gap-2 ${aDroite ? 'flex-row-reverse' : ''}`}>
                        <Avatar label={evt.auteur || '?'} email={duDemandeur ? doc.demandeur_email : undefined} size={28} />
                        <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${aDroite ? 'rounded-br-md bg-accent text-black' : 'rounded-bl-md bg-surface2 text-white'}`}>
                          <p className={`text-[11px] font-semibold ${aDroite ? 'text-black/60' : 'text-muted'}`}>
                            {evt.auteur} · {dater(evt.date)}
                          </p>
                          <p className="whitespace-pre-line break-words">{evt.texte}</p>
                        </div>
                      </div>
                    );
                  }
                  const Icone = repere?.icone ?? Circle;
                  return (
                    <div key={evt.id} className="flex gap-2.5 text-xs">
                      <Icone size={16} className={`mt-0.5 shrink-0 ${repere?.couleur ?? 'text-muted'}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-white/85">
                          {repere ? repere.phrase(evt) : evt.type_libelle} <span className="text-muted">· {dater(evt.date)}</span>
                        </p>
                        {evt.texte && (
                          <p className={`mt-1 whitespace-pre-line rounded-lg px-2.5 py-1.5 ${evt.type === 'MISE_EN_ATTENTE' ? 'border border-amber-400/30 bg-amber-500/10 text-amber-100' : 'bg-surface2 text-white/85'}`}>
                            {evt.texte}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={finFil} />
              </div>
              {etat.peut_ecrire && (
                <form onSubmit={envoyer} className="flex items-end gap-2 border-t border-border p-3">
                  <textarea
                    rows={1}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void envoyer(e);
                      }
                    }}
                    placeholder={etat.est_demandeur ? 'Répondre aux valideurs…' : 'Écrire au demandeur…'}
                    enterKeyHint="send"
                    className="max-h-32 min-h-[2.75rem] flex-1 resize-none rounded-xl border border-border bg-surface2 px-3 py-2.5 text-sm text-white placeholder:text-muted focus:border-accent focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={envoi.enCours || !message.trim()}
                    title="Envoyer"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-black disabled:opacity-40"
                  >
                    <Send size={17} />
                  </button>
                </form>
              )}
            </>
          ) : (
            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {etat.versions.length === 0 && <p className="py-10 text-center text-xs text-muted">Pas encore de version.</p>}
              {[...etat.versions].reverse().map((v) => (
                <div key={v.numero} className="rounded-2xl border border-border bg-surface2 p-3">
                  <p className="text-sm font-semibold text-white">
                    Version {v.numero}
                    {v.numero === etat.versions.length && <span className="ml-2 text-[11px] font-semibold text-accent2">actuelle</span>}
                  </p>
                  <p className="text-xs text-muted">
                    {v.type === 'SOUMISSION' ? 'Soumise' : 'Modifiée'} par {v.auteur} · {dater(v.date)}
                  </p>
                  {v.numero === 1 ? (
                    <p className="mt-2 text-xs text-muted">Version initiale du dossier.</p>
                  ) : v.changements.length === 0 ? (
                    <p className="mt-2 text-xs text-muted">Aucun champ modifié.</p>
                  ) : (
                    <ul className="mt-2 space-y-1.5">
                      {v.changements.map((c) => (
                        <li key={c.libelle} className="text-xs">
                          <span className="font-semibold text-white">{c.libelle}</span>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                            <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-red-200 line-through">{c.avant || '—'}</span>
                            <span className="text-muted">→</span>
                            <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-200">{c.apres || '—'}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
