import { useEffect, useState } from 'react';
import { Award, Calendar, Check, Pencil, UserCog } from 'lucide-react';
import { Card } from '../../components/ui-light/Card';
import { EtatChargement, EtatErreur } from '../../components/ui-light/EtatRequete';
import { PageHeader } from '../../components/ui-light/PageHeader';
import { StatTile } from '../../components/ui-light/StatTile';
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
      <PageHeader icon={UserCog} titre="Mon espace" sousTitre="Solde de congés, ancienneté, contrat" accent="#d03e0d" />

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
          <h2 className="text-sm font-bold text-slate-900">Informations</h2>
          {edition ? (
            <button onClick={enregistrer} disabled={modification.enCours} className="flex items-center gap-1.5 text-xs font-semibold text-rh-marque700">
              <Check size={13} /> {modification.enCours ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          ) : (
            <button onClick={() => setEdition(true)} className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900">
              <Pencil size={13} /> Modifier
            </button>
          )}
        </div>
        {modification.erreur ? <p className="mt-2 text-xs font-semibold text-rose-600">{modification.erreur}</p> : null}
        <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-xs text-slate-500">Poste</dt>
            <dd className="mt-1 text-slate-900">{utilisateur.poste || '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Département</dt>
            <dd className="mt-1 text-slate-900">{utilisateur.departement_nom || '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Date d'entrée</dt>
            <dd className="mt-1 text-slate-900">{utilisateur.date_embauche ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Responsable</dt>
            <dd className="mt-1 text-slate-900">{utilisateur.manager_nom || '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Email</dt>
            <dd className="mt-1 text-slate-900">{utilisateur.email}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Téléphone</dt>
            <dd className="mt-1 text-slate-900">
              {edition ? (
                <input
                  value={telephone}
                  onChange={(e) => setTelephone(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 focus:border-rh-marque500 focus:outline-none"
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
