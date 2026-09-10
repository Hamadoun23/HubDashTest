import { Cloud, CloudRain, CloudSnow, Sun, Zap } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { EtatChargement, EtatErreur } from '../../components/ui/EtatRequete';
import { useApi } from '../../lib/hooks/useApi';
import { obtenirMeteo } from '../../lib/api/chantiers';
import type { ContexteChantier } from './ChantierLayout';

// Coordonnées de Bamako, Mali : l'API du chantier ne renvoie pas de lat/lon par
// chantier (non exposé par /projets/{id}/ ni /structure/), donc pas de position
// précise disponible — le siège du groupe se trouvant à Bamako, on l'utilise
// par défaut plutôt que de laisser cet écran vide.
const LAT_DEFAUT = 12.6392;
const LON_DEFAUT = -8.0029;

function iconePourCode(code: number | undefined) {
  if (code === undefined) return Sun;
  if (code >= 95) return Zap;
  if (code >= 71 && code <= 77) return CloudSnow;
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return CloudRain;
  if (code >= 1 && code <= 48) return Cloud;
  return Sun;
}

export default function Meteo() {
  const { projet } = useOutletContext<ContexteChantier>();
  const meteo = useApi(() => obtenirMeteo(LAT_DEFAUT, LON_DEFAUT), [projet.id]);

  if (meteo.chargement) return <EtatChargement texte="Chargement de la météo…" />;
  if (meteo.erreur || !meteo.donnees) return <EtatErreur message={meteo.erreur ?? 'Météo indisponible'} recharger={meteo.recharger} />;

  const daily = meteo.donnees.daily as
    | { time?: string[]; temperature_2m_max?: number[]; temperature_2m_min?: number[]; weathercode?: number[] }
    | undefined;
  const jours = daily?.time ?? [];

  if (jours.length === 0) {
    return (
      <Card className="py-10 text-center text-sm text-muted">
        Prévisions indisponibles pour le moment.
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-4">
      {jours.map((jour, i) => {
        const code = daily?.weathercode?.[i];
        const Icone = iconePourCode(code);
        const max = daily?.temperature_2m_max?.[i];
        const min = daily?.temperature_2m_min?.[i];
        return (
          <Card key={jour} className="flex flex-col items-center gap-2 text-center">
            <p className="text-xs text-muted">{new Date(jour).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })}</p>
            <Icone size={28} className="text-accent2" />
            <p className="font-display text-2xl font-bold tabular-nums text-white">
              {max !== undefined ? `${Math.round(max)}°` : '—'}
            </p>
            <p className="text-xs text-muted">{min !== undefined ? `min ${Math.round(min)}°` : ''}</p>
          </Card>
        );
      })}
    </div>
  );
}
