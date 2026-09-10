import {
  ArrowLeft,
  Camera,
  Cloud,
  FileText,
  HardHat,
  History,
  LayoutDashboard,
  ListTree,
  PencilLine,
} from 'lucide-react';
import { Link, NavLink, Outlet, useParams } from 'react-router-dom';
import { EtatChargement, EtatErreur } from '../../components/ui/EtatRequete';
import { Badge } from '../../components/ui/Table';
import { useApi } from '../../lib/hooks/useApi';
import { obtenirProjet, type Projet } from '../../lib/api/chantiers';

const ONGLETS = [
  { label: 'Tableau de bord', suffixe: '', icon: LayoutDashboard, bout: true },
  { label: 'Saisie du jour', suffixe: 'saisie', icon: PencilLine },
  { label: 'Toutes les tâches', suffixe: 'taches', icon: ListTree },
  { label: 'Galerie photos', suffixe: 'photos', icon: Camera },
  { label: 'Structure', suffixe: 'structure', icon: HardHat },
  { label: "Journal d'activité", suffixe: 'journal', icon: History },
  { label: 'Prévisions météo', suffixe: 'meteo', icon: Cloud },
  { label: 'Rapport', suffixe: 'rapport', icon: FileText },
];

const STATUTS_TERMINES = new Set(['termine']);

export type ContexteChantier = { projet: Projet; recharger: () => void };

export default function ChantierLayout() {
  const { id } = useParams();
  const chantierId = Number(id);
  const idValide = id !== undefined && Number.isFinite(chantierId);

  const { donnees: projet, chargement, erreur, recharger } = useApi(
    () => obtenirProjet(chantierId),
    [chantierId],
  );

  if (!idValide) {
    return (
      <div>
        <Link to="/chantiers" className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-accent2">
          <ArrowLeft size={14} />
          Retour aux chantiers
        </Link>
        <p className="text-sm text-muted">Chantier introuvable.</p>
      </div>
    );
  }

  return (
    <div>
      <Link to="/chantiers" className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-accent2">
        <ArrowLeft size={14} />
        Retour aux chantiers
      </Link>

      {chargement ? (
        <EtatChargement texte="Chargement du chantier…" />
      ) : erreur || !projet ? (
        <EtatErreur message={erreur ?? 'Chantier introuvable'} recharger={recharger} />
      ) : (
        <>
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/20">
                <HardHat size={18} className="text-accent2" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">{projet.name}</h1>
                <p className="text-xs text-muted">{projet.client || `Chantier n°${projet.id}`}</p>
              </div>
            </div>
            <Badge tone={STATUTS_TERMINES.has(projet.status) ? 'success' : 'warning'}>{projet.status_display}</Badge>
          </div>

          <div className="mb-5 flex flex-wrap gap-2">
            {ONGLETS.map((onglet) => (
              <NavLink
                key={onglet.suffixe}
                to={onglet.suffixe ? `/chantiers/${projet.id}/${onglet.suffixe}` : `/chantiers/${projet.id}`}
                end={onglet.bout}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition-colors ${
                    isActive ? 'bg-accent text-black' : 'bg-surface2 text-muted hover:text-white'
                  }`
                }
              >
                <onglet.icon size={13} />
                {onglet.label}
              </NavLink>
            ))}
          </div>

          <Outlet context={{ projet, recharger } satisfies ContexteChantier} />
        </>
      )}
    </div>
  );
}
