import { useState } from 'react';
import { ArrowLeft, Check, CircleDot, Package, X } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { EtatChargement, EtatErreur } from '../../components/ui/EtatRequete';
import { PageHeader } from '../../components/ui/PageHeader';
import { Badge, TableVirtus } from '../../components/ui/Table';
import { useAuth } from '../../lib/auth/AuthContext';
import { useAction, useApi } from '../../lib/hooks/useApi';
import { obtenirRequisition, rejeterRequisition, soumettreRequisition, validerRequisition, type Requisition } from '../../lib/api/finance';

const TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  APPROUVE: 'success',
  REJETE: 'danger',
  CLOTURE: 'success',
  EN_VALIDATION: 'warning',
  BROUILLON: 'neutral',
  ANNULE: 'neutral',
};

const TONE_DECISION: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  APPROUVE: 'success',
  REJETE: 'danger',
  EN_ATTENTE: 'neutral',
  IGNORE: 'neutral',
};

/** Approximation côté client de `EtapeValidation.peut_etre_decidee_par` :
 * une correspondance nommée ou de rôle. Le serveur reste seul juge — un clic
 * refusé revient simplement avec l'erreur qu'il renvoie. */
function etapeDecidablePar(etape: Requisition['etapes'][number], utilisateurId?: number, role?: string) {
  if (etape.decision !== 'EN_ATTENTE') return false;
  if (etape.valideur_attendu) return etape.valideur_attendu === utilisateurId;
  return etape.role_valideur === role;
}

export default function RequisitionDetail() {
  const { id } = useParams();
  const requisitionId = Number(id);
  const { utilisateur } = useAuth();

  const requisition = useApi(() => obtenirRequisition(requisitionId), [requisitionId]);
  const soumission = useAction(soumettreRequisition);
  const validation = useAction(validerRequisition);
  const rejet = useAction(rejeterRequisition);
  const [rejetOuvert, setRejetOuvert] = useState(false);
  const [commentaireRejet, setCommentaireRejet] = useState('');

  if (requisition.chargement) return <EtatChargement texte="Chargement de la réquisition…" />;
  if (requisition.erreur) return <EtatErreur message={requisition.erreur} recharger={requisition.recharger} />;

  const r = requisition.donnees;
  if (!r) return null;

  const etapeADecider = r.etapes.find((e) => etapeDecidablePar(e, utilisateur?.id, utilisateur?.role));

  async function envoyer() {
    await soumission.executer(r!.id);
    requisition.recharger();
  }

  async function approuver() {
    await validation.executer(r!.id);
    requisition.recharger();
  }

  async function confirmerRejet() {
    if (!commentaireRejet.trim()) return;
    await rejet.executer(r!.id, commentaireRejet);
    setRejetOuvert(false);
    setCommentaireRejet('');
    requisition.recharger();
  }

  return (
    <div>
      <Link to="/rh/mes-demandes" className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-white">
        <ArrowLeft size={14} /> Retour à mes demandes
      </Link>

      <PageHeader icon={Package} titre={r.numero} sousTitre={r.objet} action={<Badge tone={TONE[r.statut] ?? 'neutral'}>{r.statut_libelle}</Badge>} />

      <div className="grid grid-cols-[1.3fr_1fr] gap-6">
        <div className="flex flex-col gap-4">
          <Card>
            <h2 className="mb-3 text-sm font-bold text-white">Dossier</h2>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
              <div>
                <dt className="text-xs font-semibold text-muted">Demandeur</dt>
                <dd className="text-white">{r.demandeur_nom}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-muted">Département</dt>
                <dd className="text-white">{r.departement_nom || r.demandeur_departement_nom || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-muted">Priorité</dt>
                <dd className="text-white">{r.priorite_libelle}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-muted">Besoin pour le</dt>
                <dd className="text-white">{r.date_besoin ?? '—'}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs font-semibold text-muted">Justification</dt>
                <dd className="text-white">{r.justification || '—'}</dd>
              </div>
              {r.motif_rejet ? (
                <div className="col-span-2">
                  <dt className="text-xs font-semibold text-red-400">Motif du rejet</dt>
                  <dd className="text-red-300">{r.motif_rejet}</dd>
                </div>
              ) : null}
            </dl>
          </Card>

          <div>
            <h2 className="mb-3 text-sm font-bold text-white">Lignes</h2>
            <TableVirtus
              colonnes={['Désignation', 'Qté', 'Unité', 'P.U.', 'Montant']}
              lignes={r.lignes.map((l) => [
                l.designation,
                String(l.quantite),
                l.unite || '—',
                `${Number(l.prix_unitaire).toLocaleString('fr-FR')}`,
                `${Number(l.montant ?? 0).toLocaleString('fr-FR')}`,
              ])}
            />
            <p className="mt-2 text-right text-sm font-bold text-white">
              Total : {Number(r.montant).toLocaleString('fr-FR')} {r.devise}
              {r.montant_estime ? <span className="ml-1.5 text-xs font-semibold text-muted">(estimatif)</span> : null}
            </p>
          </div>

          {r.statut === 'BROUILLON' ? (
            <button
              onClick={envoyer}
              disabled={soumission.enCours}
              className="self-start rounded-xl bg-accent px-4 py-2.5 text-xs font-bold text-black disabled:opacity-50"
            >
              {soumission.enCours ? 'Envoi...' : 'Soumettre au circuit de validation'}
            </button>
          ) : null}

          {etapeADecider ? (
            <Card className="border-accent/40 bg-accent/10">
              <h2 className="mb-2 text-sm font-bold text-white">Votre décision — {etapeADecider.libelle}</h2>
              {rejetOuvert ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    autoFocus
                    value={commentaireRejet}
                    onChange={(e) => setCommentaireRejet(e.target.value)}
                    placeholder="Motif du rejet..."
                    rows={2}
                    className="w-full rounded-lg border border-border bg-surface2 px-2.5 py-1.5 text-xs text-white placeholder:text-muted focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={confirmerRejet}
                      disabled={rejet.enCours || !commentaireRejet.trim()}
                      className="rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-bold text-red-300 disabled:opacity-50"
                    >
                      Confirmer le rejet
                    </button>
                    <button onClick={() => setRejetOuvert(false)} className="text-xs font-semibold text-muted">
                      Annuler
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={approuver}
                    disabled={validation.enCours}
                    className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-black disabled:opacity-50"
                  >
                    <Check size={14} /> Approuver
                  </button>
                  <button
                    onClick={() => setRejetOuvert(true)}
                    className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted hover:text-white"
                  >
                    <X size={14} /> Refuser
                  </button>
                </div>
              )}
              {(validation.erreur || rejet.erreur) && (
                <p className="mt-2 text-xs font-semibold text-red-400">{validation.erreur ?? rejet.erreur}</p>
              )}
            </Card>
          ) : null}
        </div>

        <div>
          <h2 className="mb-3 text-sm font-bold text-white">Circuit de validation</h2>
          {r.etapes.length === 0 ? (
            <p className="rounded-3xl border border-border bg-surface p-6 text-center text-xs text-muted">
              {r.statut === 'BROUILLON' ? 'Le circuit sera généré à la soumission.' : "Aucune étape — le dossier n'a pas nécessité de validation."}
            </p>
          ) : (
            <ol className="flex flex-col">
              {r.etapes.map((etape, index) => (
                <li key={etape.id} className="relative flex gap-3 pb-6 last:pb-0">
                  {index < r.etapes.length - 1 ? (
                    <span className="absolute left-[9px] top-6 h-full w-px bg-border" />
                  ) : null}
                  <span className="relative z-10 mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-surface">
                    {etape.decision === 'APPROUVE' ? (
                      <Check size={16} className="text-emerald-400" />
                    ) : etape.decision === 'REJETE' ? (
                      <X size={16} className="text-red-400" />
                    ) : (
                      <CircleDot size={16} className={etape.decision === 'EN_ATTENTE' ? 'text-amber-400' : 'text-muted'} />
                    )}
                  </span>
                  <div className="flex-1 pt-[-2px]">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-white">{etape.libelle}</p>
                      <Badge tone={TONE_DECISION[etape.decision] ?? 'neutral'}>{etape.decision_libelle}</Badge>
                    </div>
                    <p className="text-xs text-muted">
                      {etape.valideur_attendu_nom || etape.role_valideur_libelle}
                      {etape.nature === 'AVIS' ? ' · avis consultatif' : etape.nature === 'INFORMATION' ? ' · pour information' : ' · décision'}
                    </p>
                    {etape.decide_par_nom ? (
                      <p className="mt-1 text-xs text-muted">
                        Par <span className="font-semibold text-white">{etape.decide_par_nom}</span>
                        {etape.date_decision ? ` le ${new Date(etape.date_decision).toLocaleDateString('fr-FR')}` : ''}
                      </p>
                    ) : null}
                    {etape.commentaire ? <p className="mt-1 text-xs italic text-muted">« {etape.commentaire} »</p> : null}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
