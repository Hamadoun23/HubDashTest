import { AlertTriangle, Calendar, ClipboardList, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { CircularProgress } from '../../components/ui/CircularProgress';
import { EtatChargement, EtatErreur } from '../../components/ui/EtatRequete';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatTile } from '../../components/ui/StatTile';
import { Badge } from '../../components/ui/Table';
import { useAuth } from '../../lib/auth/AuthContext';
import { useApi } from '../../lib/hooks/useApi';
import { demandesAValider, monSolde } from '../../lib/api/rh';

export default function TableauDeBordRh() {
  const { utilisateur } = useAuth();
  const annee = new Date().getFullYear();
  const dossiers = useApi(demandesAValider, []);
  const solde = useApi(() => monSolde(annee), [annee]);

  if (dossiers.chargement || solde.chargement) return <EtatChargement texte="Chargement du tableau de bord…" />;
  if (dossiers.erreur) return <EtatErreur message={dossiers.erreur} recharger={dossiers.recharger} />;

  const liste = dossiers.donnees ?? [];
  const urgents = liste.filter((d) => d.categorie === 'RETARD' || d.categorie === 'PERMISSION').length;

  return (
    <div>
      <PageHeader
        icon={Users}
        titre="RH & Finance"
        sousTitre={utilisateur ? `Bonjour ${utilisateur.first_name}, voici ce qui attend votre décision` : 'Ce qui attend votre décision'}
      />

      {solde.donnees && (
        <Card className="mb-4 flex items-center gap-4">
          <CircularProgress
            progress={(solde.donnees.jours_restants / (solde.donnees.jours_acquis + solde.donnees.jours_reportes || 1)) * 100}
            size={64}
            strokeWidth={6}
            gradientId="rh-tableau-de-bord-conges-gradient"
            label={`${solde.donnees.jours_restants}j`}
          />
          <div>
            <p className="text-sm font-semibold text-white">
              {solde.donnees.jours_restants} jours restants sur {solde.donnees.jours_acquis + solde.donnees.jours_reportes}
            </p>
            <p className="text-xs text-muted">{solde.donnees.jours_pris} jours déjà pris cette année</p>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-3 gap-4">
        <StatTile icon={ClipboardList} valeur={liste.length} libelle="Dossiers à valider" teinte="#ff8a4c" />
        <StatTile icon={AlertTriangle} valeur={urgents} libelle="Retards / permissions" teinte="#f87171" />
        <StatTile
          icon={Calendar}
          valeur={solde.donnees ? `${solde.donnees.jours_restants} j` : '—'}
          libelle="Solde de congés restant"
          teinte="#34d399"
        />
      </div>

      <Card className="mt-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white">À valider</h2>
          <Link to="/rh/validations" className="text-xs font-semibold text-accent2">
            Tout voir →
          </Link>
        </div>
        <div className="mt-4 space-y-2">
          {liste.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted">Aucun dossier en attente de votre décision.</p>
          ) : (
            liste.slice(0, 6).map((dossier) => (
              <div key={dossier.id} className="flex items-center justify-between rounded-2xl border border-border bg-surface2 p-3">
                <div>
                  <p className="text-sm font-semibold text-white">{dossier.demandeur_nom}</p>
                  <p className="text-xs text-muted">
                    {dossier.type_absence_libelle} · {dossier.numero} · {dossier.etape_courante_libelle}
                  </p>
                </div>
                <Badge>{dossier.statut_libelle}</Badge>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
