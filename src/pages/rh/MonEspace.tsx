import { useEffect, useState } from 'react';
import { Award, Calendar, Check, Pencil, UserCog } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { EtatChargement, EtatErreur } from '../../components/ui/EtatRequete';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatTile } from '../../components/ui/StatTile';
import { useAuth } from '../../lib/auth/AuthContext';
import { useAction, useApi } from '../../lib/hooks/useApi';
import { modifierProfil } from '../../lib/api/auth';
import { monSolde } from '../../lib/api/rh';

export default function MonEspace() {
  const { utilisateur, rafraichirProfil } = useAuth();
  const annee = new Date().getFullYear();
  const solde = useApi(() => monSolde(annee), [annee]);
  const modification = useAction(modifierProfil);

  const [edition, setEdition] = useState(false);
  const [telephone, setTelephone] = useState(utilisateur?.telephone ?? '');

  useEffect(() => setTelephone(utilisateur?.telephone ?? ''), [utilisateur?.telephone]);

  if (!utilisateur) return <EtatChargement texte="Chargement du profil…" />;

  async function enregistrer() {
    await modification.executer({ telephone });
    await rafraichirProfil();
    setEdition(false);
  }

  const anneesAnciennete = Math.floor(utilisateur.anciennete_mois / 12);
  const moisAnciennete = utilisateur.anciennete_mois % 12;

  return (
    <div>
      <PageHeader icon={UserCog} titre="Mon espace" sousTitre="Solde de congés, ancienneté, contrat" />

      <div className="grid grid-cols-3 gap-4">
        <StatTile
          icon={Calendar}
          valeur={solde.donnees ? `${solde.donnees.jours_restants} j` : solde.chargement ? '…' : '—'}
          libelle="Solde de congés"
          teinte="#34d399"
        />
        <StatTile
          icon={Award}
          valeur={anneesAnciennete > 0 ? `${anneesAnciennete} an${anneesAnciennete > 1 ? 's' : ''}` : `${moisAnciennete} mois`}
          libelle="Ancienneté"
          teinte="#ff8a4c"
        />
        <StatTile icon={UserCog} valeur={utilisateur.type_contrat || '—'} libelle="Type de contrat" teinte="#a78bfa" />
      </div>

      {solde.erreur ? <EtatErreur message={solde.erreur} recharger={solde.recharger} /> : null}

      <Card className="mt-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white">Informations</h2>
          {edition ? (
            <button onClick={enregistrer} disabled={modification.enCours} className="flex items-center gap-1.5 text-xs font-semibold text-accent2">
              <Check size={13} /> {modification.enCours ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          ) : (
            <button onClick={() => setEdition(true)} className="flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-white">
              <Pencil size={13} /> Modifier
            </button>
          )}
        </div>
        {modification.erreur ? <p className="mt-2 text-xs font-semibold text-red-400">{modification.erreur}</p> : null}
        <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-xs text-muted">Poste</dt>
            <dd className="mt-1 text-white">{utilisateur.poste || '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Département</dt>
            <dd className="mt-1 text-white">{utilisateur.departement_nom || '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Date d'entrée</dt>
            <dd className="mt-1 text-white">{utilisateur.date_embauche ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Responsable</dt>
            <dd className="mt-1 text-white">{utilisateur.manager_nom || '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Email</dt>
            <dd className="mt-1 text-white">{utilisateur.email}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Téléphone</dt>
            <dd className="mt-1 text-white">
              {edition ? (
                <input
                  value={telephone}
                  onChange={(e) => setTelephone(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface2 px-2.5 py-1.5 text-sm text-white focus:border-accent focus:outline-none"
                />
              ) : (
                utilisateur.telephone || '—'
              )}
            </dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}
