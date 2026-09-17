import { ArrowRight, Briefcase, ClipboardList, Mail, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { EtatChargement } from '../../components/ui/EtatRequete';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatTile } from '../../components/ui/StatTile';
import { useAuth } from '../../lib/auth/AuthContext';
import { useApi } from '../../lib/hooks/useApi';
import { demandesAValider, mesDemandes } from '../../lib/api/rh';
import { mesRequisitions, requisitionsAValider } from '../../lib/api/finance';

const LIBELLE_ROLE: Record<string, string> = {
  agent: 'Agent',
  gestionnaire: 'Gestionnaire',
  direction: 'Direction',
  admin: 'Administrateur',
};

/** Ce que l'utilisateur connecté voit de lui-même : son identité, les
 * applications auxquelles il a accès (et avec quel rôle sur chacune), et un
 * aperçu de son activité en cours dans les modules qui exposent un circuit
 * de validation. Symétrique de VueGlobale, réservée aux administrateurs. */
export default function MesAcces() {
  const { identite, applications, habilitations, chargement } = useAuth();

  const aAccesRh = Boolean(habilitations['rh']);
  const aAccesFinance = Boolean(habilitations['finance']);

  const demandes = useApi(() => (aAccesRh ? mesDemandes() : Promise.resolve([])), [aAccesRh]);
  const aValiderRh = useApi(() => (aAccesRh ? demandesAValider() : Promise.resolve([])), [aAccesRh]);
  const requisitions = useApi(() => (aAccesFinance ? mesRequisitions() : Promise.resolve([])), [aAccesFinance]);
  const aValiderFinance = useApi(() => (aAccesFinance ? requisitionsAValider() : Promise.resolve([])), [aAccesFinance]);

  if (chargement) return <EtatChargement texte="Chargement de votre profil…" />;
  if (!identite) return null;

  const enCoursPersonnel =
    (demandes.donnees ?? []).filter((d) => d.statut === 'EN_VALIDATION').length +
    (requisitions.donnees ?? []).filter((r) => r.statut === 'EN_VALIDATION').length;
  const enAttenteDeMoi = (aValiderRh.donnees?.length ?? 0) + (aValiderFinance.donnees?.length ?? 0);

  return (
    <div>
      <PageHeader icon={ShieldCheck} titre="Mes accès" sousTitre="Votre rôle, vos applications, votre activité en cours" />

      <div className="grid grid-cols-[1fr_1.6fr] gap-6">
        <Card className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            {identite.photo ? (
              <img src={identite.photo} alt="" className="h-12 w-12 rounded-full object-cover" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/20 text-sm font-bold text-accent2">
                {identite.nom_complet
                  .split(' ')
                  .map((mot) => mot[0])
                  .slice(0, 2)
                  .join('')}
              </div>
            )}
            <div>
              <p className="text-sm font-bold text-white">{identite.nom_complet}</p>
              <p className="text-xs text-muted">{identite.fonction || '—'}</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 text-xs text-muted">
            <span className="flex items-center gap-2">
              <Mail size={13} /> {identite.email || identite.identifiant}
            </span>
            <span className="flex items-center gap-2">
              <Briefcase size={13} /> {identite.est_superadmin ? 'Super administrateur' : 'Collaborateur'}
            </span>
          </div>

          {(aAccesRh || aAccesFinance) && (
            <div className="grid grid-cols-2 gap-3 border-t border-border pt-4">
              <StatTile icon={ClipboardList} valeur={enCoursPersonnel} libelle="Mes demandes en cours" />
              <StatTile icon={ShieldCheck} valeur={enAttenteDeMoi} libelle="Dossiers en attente de moi" teinte="#f59e0b" />
            </div>
          )}
        </Card>

        <div>
          <h2 className="mb-3 text-sm font-bold text-white">Mes applications</h2>
          {applications.length === 0 ? (
            <p className="rounded-3xl border border-border bg-surface p-8 text-center text-sm text-muted">
              Aucune application ne vous a été attribuée pour le moment.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {applications.map((app) => (
                <Card key={app.id} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-white">{app.nom}</p>
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: app.couleur || '#ff8a4c' }} />
                  </div>
                  <p className="text-xs text-muted">{app.description}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(habilitations[app.code] ?? []).map((role) => (
                      <span key={role} className="rounded-full bg-surface2 px-2 py-0.5 text-[11px] font-semibold text-muted">
                        {LIBELLE_ROLE[role] ?? role}
                      </span>
                    ))}
                  </div>
                  <Link
                    to={app.chemin}
                    className="mt-1 flex items-center gap-1 text-xs font-semibold text-accent2 hover:underline"
                  >
                    Ouvrir <ArrowRight size={13} />
                  </Link>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
