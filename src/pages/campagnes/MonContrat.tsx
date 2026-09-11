import { FileSignature } from 'lucide-react';
import { Card } from '../../components/ui-light/Card';
import { EtatChargement, EtatErreur } from '../../components/ui-light/EtatRequete';
import { PageHeader } from '../../components/ui-light/PageHeader';
import { Badge } from '../../components/ui-light/Table';
import { useAction, useApi } from '../../lib/hooks/useApi';
import { accepterContrat, accuserReceptionAide, obtenirMonContrat, rejeterContrat } from '../../lib/api/campagnes';

const ACCENT = '#7c3aed';
const TONE = { en_attente: 'warning', accepte: 'success', rejete: 'danger' } as const;

export default function MonContrat() {
  const contrat = useApi(obtenirMonContrat, []);
  const acceptation = useAction(accepterContrat);
  const rejet = useAction(rejeterContrat);
  const accuse = useAction(accuserReceptionAide);

  if (contrat.chargement) return <EtatChargement texte="Chargement du contrat…" />;
  if (contrat.erreur || !contrat.donnees) return <EtatErreur message={contrat.erreur ?? 'Indisponible'} recharger={contrat.recharger} />;

  const c = contrat.donnees;

  if (!c.campagne) {
    return (
      <div>
        <PageHeader icon={FileSignature} titre="Mon contrat" sousTitre="Contrat de prestation" accent={ACCENT} />
        <Card className="py-10 text-center text-sm text-slate-500">Aucune campagne active ne vous concerne pour le moment.</Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader icon={FileSignature} titre="Mon contrat" sousTitre={c.campagne.nom} accent={ACCENT} />

      <Card className="mb-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">Statut</h2>
          {c.statut ? <Badge tone={TONE[c.statut]}>{c.statut}</Badge> : null}
        </div>

        {c.document?.articles.map((a) => (
          <div key={a.id} className="mb-4">
            <h3 className="text-xs font-bold uppercase tracking-wide text-campagnes-primaryDark">{a.titre}</h3>
            <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{a.contenu}</p>
          </div>
        ))}

        {c.statut === 'en_attente' && !c.verrouille && (
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => acceptation.executer().then(() => contrat.recharger())}
              disabled={acceptation.enCours}
              className="rounded-xl bg-campagnes-primary px-4 py-2.5 text-xs font-bold text-white disabled:opacity-60"
            >
              Accepter le contrat
            </button>
            <button
              onClick={() => rejet.executer().then(() => contrat.recharger())}
              disabled={rejet.enCours}
              className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-600 disabled:opacity-60"
            >
              Rejeter
            </button>
          </div>
        )}
        {(acceptation.erreur || rejet.erreur) && <p className="mt-2 text-xs font-semibold text-rose-600">{acceptation.erreur ?? rejet.erreur}</p>}
      </Card>

      <div>
        <h2 className="mb-3 text-sm font-bold text-slate-900">Aides hebdomadaires</h2>
        {c.aides.length === 0 ? (
          <Card className="text-sm text-slate-500">Aucune aide versée pour le moment.</Card>
        ) : (
          <div className="flex flex-col gap-2">
            {c.aides.map((a) => (
              <Card key={a.id} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Semaine du {a.semaine_debut}</p>
                  <p className="text-xs text-slate-500">
                    Carburant : {a.montant_carburant} · Crédit tél. : {a.montant_credit_tel}
                  </p>
                </div>
                {a.accuse_at ? (
                  <Badge tone="success">Reçu</Badge>
                ) : (
                  <button
                    onClick={() => accuse.executer(a.id).then(() => contrat.recharger())}
                    disabled={accuse.enCours}
                    className="rounded-lg bg-campagnes-primary px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                  >
                    Accuser réception
                  </button>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
