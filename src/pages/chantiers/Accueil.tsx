import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../../styles/gda-daily.css';
import '../../styles/gda-daily-theme.css';
import { EtatChargement, EtatErreur } from './EtatsGda';
import EnteteGda, { STYLE_COQUILLE, langueInitiale } from './EnteteGda';
import { useApi } from '../../lib/hooks/useApi';
import { listerProjets } from '../../lib/api/chantiers';

export const CLE_DERNIER_CHANTIER = 'chantiers_dernier_actif';

/**
 * `/chantiers` n'affiche plus jamais la liste de gestion en premier — comme
 * l'app Laravel d'origine, qui ouvre directement le tableau de bord du
 * chantier courant (mémorisé en `localStorage`, cf. `gda-app.js`). La liste
 * de gestion (créer/modifier/supprimer) vit désormais sur `/chantiers/projets`.
 */
export default function AccueilChantiers() {
  const navigate = useNavigate();
  const [langue, setLangue] = useState(langueInitiale);
  const projets = useApi(() => listerProjets(), []);

  useEffect(() => {
    if (!projets.donnees || projets.donnees.length === 0) return;
    const dernierId = localStorage.getItem(CLE_DERNIER_CHANTIER);
    const liste = projets.donnees;
    // Un chantier vide (aucune tâche) n'est pas un « chantier actif » : on retombe
    // sur un chantier en cours qui a des tâches, sinon sur le premier qui en a.
    const dernier = dernierId ? liste.find((p) => String(p.id) === dernierId && p.tasks_count > 0) : undefined;
    const cible =
      dernier ??
      liste.find((p) => p.status === 'en_cours' && p.tasks_count > 0) ??
      liste.find((p) => p.tasks_count > 0) ??
      liste[0];
    navigate(`/chantiers/${cible.id}`, { replace: true });
  }, [projets.donnees, navigate]);

  return (
    <div className="gda-daily" style={STYLE_COQUILLE}>
      <EnteteGda libelle="Chantier" chantier={false} langue={langue} onLangue={setLangue} />
      <main className="main main--solo gda-legacy">
        {projets.erreur ? (
          <EtatErreur message={projets.erreur} recharger={projets.recharger} />
        ) : projets.donnees && projets.donnees.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '48px 20px' }}>
            <p style={{ color: 'var(--blanc-texte)', marginBottom: 14 }}>Aucun chantier pour le moment.</p>
            <Link to="/chantiers/projets" className="btn btn-primary">
              Créer le premier chantier →
            </Link>
          </div>
        ) : (
          <EtatChargement texte="Ouverture du dernier chantier actif…" />
        )}
      </main>
    </div>
  );
}
