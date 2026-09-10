import { BarChart3 } from 'lucide-react';
import { Card } from './Card';
import { StatTile } from './StatTile';
import { TableVirtus } from './Table';

function libelle(cle: string) {
  return cle.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

function estListeObjets(valeur: unknown): valeur is Record<string, unknown>[] {
  return Array.isArray(valeur) && valeur.length > 0 && typeof valeur[0] === 'object' && valeur[0] !== null;
}

function formatCellule(valeur: unknown): React.ReactNode {
  if (valeur === null || valeur === undefined) return '—';
  if (typeof valeur === 'boolean') return valeur ? 'Oui' : 'Non';
  if (typeof valeur === 'object') return JSON.stringify(valeur);
  return String(valeur);
}

/** Rend de façon générique la partie variable de `/jus/reporting/{module}/`,
 * dont la forme dépend du module côté serveur (voir rapport d'exploration).
 * Les clés numériques/texte deviennent des `StatTile`, les listes d'objets
 * deviennent des tableaux — pas de supposition sur des noms de champs précis. */
export function RapportGenerique({ donnees }: { donnees: Record<string, unknown> }) {
  const entrees = Object.entries(donnees).filter(([cle]) => cle !== 'periode');

  const stats = entrees.filter(([, v]) => typeof v === 'number' || typeof v === 'string');
  const listes = entrees.filter(([, v]) => estListeObjets(v));

  if (entrees.length === 0) {
    return <Card className="py-8 text-center text-sm text-muted">Aucune donnée pour cette période.</Card>;
  }

  return (
    <div className="flex flex-col gap-4">
      {stats.length > 0 && (
        <div className="grid grid-cols-4 gap-4">
          {stats.map(([cle, valeur]) => (
            <StatTile key={cle} icon={BarChart3} valeur={String(valeur)} libelle={libelle(cle)} />
          ))}
        </div>
      )}
      {listes.map(([cle, valeur]) => {
        const lignes = valeur as Record<string, unknown>[];
        const colonnes = Object.keys(lignes[0]);
        return (
          <div key={cle}>
            <h2 className="mb-2 text-sm font-bold text-white">{libelle(cle)}</h2>
            <TableVirtus
              colonnes={colonnes.map(libelle)}
              lignes={lignes.map((ligne) => colonnes.map((c) => formatCellule(ligne[c])))}
            />
          </div>
        );
      })}
    </div>
  );
}
