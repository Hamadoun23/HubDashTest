import { FileSignature } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { EtatChargement, EtatErreur } from '../../components/ui/EtatRequete';
import { PageHeader } from '../../components/ui/PageHeader';
import { Badge } from '../../components/ui/Table';
import { useAction, useApi } from '../../lib/hooks/useApi';
import { accepterContrat, accuserReceptionAide, obtenirMonContrat, rejeterContrat } from '../../lib/api/campagnes';

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
        <PageHeader icon={FileSignature} titre="Mon contrat" sousTitre="Contrat de prestation" />
        <Card className="py-10 text-center text-sm text-muted">Aucune campagne active ne vous concerne pour le moment.</Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader icon={FileSignature} titre="Mon contrat" sousTitre={c.campagne.nom} />

      <Card className="mb-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-bold text-white">Statut</h2>
          {c.statut ? <Badge tone={TONE[c.statut]}>{c.statut}</Badge> : null}
        </div>

        {c.document?.articles.map((a) => (
          <div key={a.id} className="mb-4">
            <h3 className="text-xs font-bold uppercase tracking-wide text-accent2">{a.titre}</h3>
            <p className="mt-1 whitespace-pre-line text-sm text-white/85">{a.contenu}</p>
          </div>
        ))}

        {c.statut === 'en_attente' && !c.verrouille && (
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => acceptation.executer().then(() => contrat.recharger())}
              disabled={acceptation.enCours}
              className="rounded-xl bg-accent px-4 py-2.5 text-xs font-bold text-black disabled:opacity-60"
            >
              Accepter le contrat
            </button>
            <button
              onClick={() => rejet.executer().then(() => contrat.recharger())}
              disabled={rejet.enCours}
              className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-xs font-bold text-red-400 disabled:opacity-60"
            >
              Rejeter
            </button>
          </div>
        )}
        {(acceptation.erreur || rejet.erreur) && <p className="mt-2 text-xs font-semibold text-red-400">{acceptation.erreur ?? rejet.erreur}</p>}
      </Card>

      <div>
        <h2 className="mb-3 text-sm font-bold text-white">Aides hebdomadaires</h2>
        {c.aides.length === 0 ? (
          <Card className="text-sm text-muted">Aucune aide versée pour le moment.</Card>
        ) : (
          <div className="flex flex-col gap-2">
            {c.aides.map((a) => (
              <Card key={a.id} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">Semaine du {a.semaine_debut}</p>
                  <p className="text-xs text-muted">
                    Carburant : {a.montant_carburant} · Crédit tél. : {a.montant_credit_tel}
                  </p>
                </div>
                {a.accuse_at ? (
                  <Badge tone="success">Reçu</Badge>
                ) : (
                  <button
                    onClick={() => accuse.executer(a.id).then(() => contrat.recharger())}
                    disabled={accuse.enCours}
                    className="rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-black disabled:opacity-50"
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
