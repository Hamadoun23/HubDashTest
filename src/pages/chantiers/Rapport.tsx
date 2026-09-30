import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { genererRapport, telechargerRapportPdf } from '../../lib/api/chantiers';
import ApercuRapport from './ApercuRapport';
import type { ContexteChantier } from './ChantierLayout';
import { useToast } from './toast';

const METEOS = ['Ensoleillé', 'Ensoleillé et venteux', 'Nuageux', 'Pluvieux', 'Venteux', 'Orageux'];

function aujourdhui() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Port de la page `#page-report` : paramètres, aperçu en direct, téléchargement direct du PDF.
 * L'aperçu reprend les sections du PDF avec les composants du tableau de bord.
 */
export default function Rapport() {
  const { projet, tableau, estPartenaire, langue } = useOutletContext<ContexteChantier>();
  const [date, setDate] = useState(aujourdhui());
  const [temperature, setTemperature] = useState('37');
  const [meteo, setMeteo] = useState('Ensoleillé et venteux');
  const [titre, setTitre] = useState(projet.name);
  const [impression, setImpression] = useState(false);
  const { toast, element: toastEl } = useToast();

  useEffect(() => setTitre(projet.name), [projet.name]);

  const nomFichier = (jour: string) => `rapport-${projet.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${jour}.pdf`;

  async function imprimer() {
    setImpression(true);
    try {
      const resultat = await genererRapport(projet.id, { report_date: date, temperature: temperature || undefined, weather: meteo });
      await telechargerRapportPdf(resultat.report.id, nomFichier(date), langue, titre);
      toast('PDF téléchargé', 'ok');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erreur', 'err');
    } finally {
      setImpression(false);
    }
  }

  return (
    <div className="page active gda-legacy" id="page-report">
      <div className="page-header">
        <div>
          <div className="page-title">Rapport journalier</div>
          <div className="page-sub">Génération et export PDF</div>
        </div>
        {!estPartenaire && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-primary" disabled={impression} onClick={imprimer}>
              {impression ? 'Préparation…' : '⬇ Télécharger le PDF'}
            </button>
          </div>
        )}
      </div>

      {!estPartenaire && (
        <div className="card">
          <div className="card-head">Paramètres du rapport</div>
          <div className="form-row cols3">
            <div className="form-group">
              <label className="form-label">Date du rapport</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Température (°C)</label>
              <input type="number" value={temperature} placeholder="37" onChange={(e) => setTemperature(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Météo</label>
              <select value={meteo} onChange={(e) => setMeteo(e.target.value)}>
                {METEOS.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Nom du projet</label>
              <input type="text" value={titre} onChange={(e) => setTitre(e.target.value)} />
            </div>
          </div>
        </div>
      )}

      <div className="rapport-libelle">Aperçu du rapport</div>
      <ApercuRapport projet={projet} tableau={tableau} date={date} temperature={temperature} meteo={meteo} titre={titre} langue={langue} />

      {toastEl}
    </div>
  );
}
