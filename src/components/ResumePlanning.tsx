import { ArrowUpRight, Calendar, Clapperboard, FileText, Video } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from './ui/Card';
import { StatTile } from './ui/StatTile';
import { Badge } from './ui/Table';
import { useApi } from '../lib/hooks/useApi';
import { calendrierClient, listerClients, tableauDeBord, LIBELLES_STATUT, type Publication, type Tournage } from '../lib/api/planning';
import { usePermissionsPlanning } from '../pages/planning/permissions';

const MAINTENANT = new Date();
const MOIS = MAINTENANT.getMonth() + 1;
const ANNEE = MAINTENANT.getFullYear();

type EvenementResume = { id: number; type: 'Tournage' | 'Publication'; date: string; description: string; status: Tournage['status']; client_nom: string };

function fusionnerEtTrier(tournages: Tournage[], publications: Publication[]): EvenementResume[] {
  const t = tournages.map((e) => ({ id: e.id, type: 'Tournage' as const, date: e.date, description: e.description, status: e.status, client_nom: e.client_nom }));
  const p = publications.map((e) => ({ id: e.id, type: 'Publication' as const, date: e.date, description: e.description, status: e.status, client_nom: e.client_nom }));
  return [...t, ...p].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4);
}

function ListeAVenir({ evenements, sousTitre }: { evenements: EvenementResume[]; sousTitre: (e: EvenementResume) => string }) {
  if (evenements.length === 0) return <p className="py-6 text-center text-xs text-muted">Rien de prévu prochainement.</p>;
  return (
    <div className="space-y-2">
      {evenements.map((e) => (
        <div key={`${e.type}-${e.id}`} className="flex items-center justify-between rounded-xl bg-surface2 px-3 py-2">
          <div>
            <p className="text-xs font-semibold text-white">
              {e.type} · {sousTitre(e)}
            </p>
            <p className="text-xs text-muted">{new Date(e.date).toLocaleDateString('fr-FR')}</p>
          </div>
          <Badge tone="neutral">{LIBELLES_STATUT[e.status]}</Badge>
        </div>
      ))}
    </div>
  );
}

/** Résumé Planning affiché sur l'accueil du hub pour les comptes qui n'ont
 * accès qu'à cette application (typiquement les comptes client) — le hub
 * doit toujours montrer un tableau de bord réel, même avec une seule app. */
export function ResumePlanning() {
  const { estClient } = usePermissionsPlanning();

  const monClient = useApi(() => (estClient ? listerClients() : Promise.resolve([])), [estClient]);
  const clientId = monClient.donnees?.[0]?.id;

  const calendrier = useApi(
    () => (estClient && clientId ? calendrierClient(clientId, MOIS, ANNEE) : Promise.resolve(null)),
    [estClient, clientId],
  );
  const dashboard = useApi(() => (!estClient ? tableauDeBord(MOIS, ANNEE) : Promise.resolve(null)), [estClient]);

  if (estClient) {
    const monEntreprise = monClient.donnees?.[0];
    if (!clientId || !monEntreprise || !calendrier.donnees) {
      return <Card className="py-10 text-center text-sm text-muted">Chargement de votre espace Planning...</Card>;
    }
    const c = calendrier.donnees;
    const rapportsCount = c.rapports_mensuels.length + c.rapports_annuels.length;
    const aVenir = fusionnerEtTrier(c.tournages_a_venir, c.publications_a_venir);

    return (
      <>
        <div className="mb-4 grid grid-cols-3 gap-3">
          <StatTile icon={Video} valeur={monEntreprise.tournages_count} libelle="Tournages au total" teinte="#fb7185" />
          <StatTile icon={Clapperboard} valeur={monEntreprise.publications_count} libelle="Publications au total" teinte="#60a5fa" />
          <StatTile icon={FileText} valeur={rapportsCount} libelle="Rapports disponibles" teinte="#facc15" />
        </div>
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">À venir — {monEntreprise.nom_entreprise}</h2>
            <Link to={`/planning/clients/${clientId}`} className="flex items-center gap-1 text-xs font-semibold text-accent2 hover:text-white">
              Voir mon espace <ArrowUpRight size={13} />
            </Link>
          </div>
          <ListeAVenir evenements={aVenir} sousTitre={(e) => e.description || 'Sans titre'} />
        </Card>
      </>
    );
  }

  const d = dashboard.donnees;
  const aVenir = d ? fusionnerEtTrier(d.tournages_prochains, d.publications_prochains) : [];

  return (
    <>
      <div className="mb-4 grid grid-cols-3 gap-3">
        <StatTile icon={Calendar} valeur={d?.stats.clients_count ?? '—'} libelle="Clients suivis" teinte="#fb7185" />
        <StatTile icon={Video} valeur={d?.stats.shootings_this_month ?? '—'} libelle="Tournages ce mois" teinte="#60a5fa" />
        <StatTile icon={Clapperboard} valeur={d?.stats.publications_this_month ?? '—'} libelle="Publications ce mois" teinte="#facc15" />
      </div>
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-white">Prochains évènements Planning</h2>
          <Link to="/planning" className="flex items-center gap-1 text-xs font-semibold text-accent2 hover:text-white">
            Ouvrir Planning <ArrowUpRight size={13} />
          </Link>
        </div>
        <ListeAVenir evenements={aVenir} sousTitre={(e) => e.client_nom} />
      </Card>
    </>
  );
}
