import { useState } from 'react';
import { Activity, CheckCircle2, HardHat, ListChecks } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { CircularProgress } from '../../components/ui/CircularProgress';
import { EtatErreur } from '../../components/ui/EtatRequete';
import { FormulaireEtHistorique } from '../../components/ui/FormulaireEtHistorique';
import { StatTile } from '../../components/ui/StatTile';
import { Badge } from '../../components/ui/Table';
import { useAction, useApi } from '../../lib/hooks/useApi';
import { creerProjet, listerProjets, modifierProjet, supprimerProjet, type StatutProjet } from '../../lib/api/chantiers';

const TONE: Record<StatutProjet, 'success' | 'warning' | 'danger' | 'neutral'> = {
  termine: 'success',
  en_cours: 'warning',
  planifie: 'neutral',
  suspendu: 'danger',
};

export default function Liste() {
  const projets = useApi(() => listerProjets(), []);
  const creation = useAction(creerProjet);
  const modification = useAction(modifierProjet);
  const suppression = useAction(supprimerProjet);

  const [nom, setNom] = useState('');
  const [client, setClient] = useState('');
  const [debut, setDebut] = useState('');
  const [fin, setFin] = useState('');
  const [description, setDescription] = useState('');
  const [idEnEdition, setIdEnEdition] = useState<number | null>(null);

  function modifier(p: NonNullable<typeof projets.donnees>[number]) {
    setIdEnEdition(p.id);
    setNom(p.name);
    setClient(p.client ?? '');
    setDebut(p.start_date ?? '');
    setFin(p.end_date ?? '');
    setDescription(p.description ?? '');
  }

  function annulerEdition() {
    setIdEnEdition(null);
    setNom('');
    setClient('');
    setDebut('');
    setFin('');
    setDescription('');
  }

  async function envoyer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const payload = { name: nom, client, start_date: debut || undefined, end_date: fin || undefined, description };
    if (idEnEdition !== null) {
      await modification.executer(idEnEdition, payload);
      annulerEdition();
    } else {
      await creation.executer(payload);
      setNom('');
      setClient('');
      setDebut('');
      setFin('');
      setDescription('');
    }
    projets.recharger();
  }

  async function supprimer(id: number) {
    if (!window.confirm('Supprimer définitivement ce chantier ?')) return;
    await suppression.executer(id);
    projets.recharger();
  }

  if (projets.erreur) return <EtatErreur message={projets.erreur} recharger={projets.recharger} />;

  const liste = projets.donnees ?? [];
  const totalChantiers = liste.length;
  const enCours = liste.filter((p) => p.status === 'en_cours').length;
  const termines = liste.filter((p) => p.status === 'termine').length;
  const totalTaches = liste.reduce((somme, p) => somme + p.tasks_count, 0);
  const avancementMoyen = totalChantiers > 0 ? liste.reduce((somme, p) => somme + p.overall_progress, 0) / totalChantiers : 0;

  return (
    <div>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-[auto_1fr]">
        <Card className="flex items-center gap-4">
          <CircularProgress progress={avancementMoyen} size={72} strokeWidth={7} gradientId="chantiers-avancement-moyen" />
          <div>
            <p className="text-sm font-semibold text-white">Avancement moyen</p>
            <p className="text-xs text-muted">Tous les chantiers confondus</p>
          </div>
        </Card>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatTile icon={HardHat} valeur={totalChantiers} libelle="Chantiers au total" />
          <StatTile icon={Activity} valeur={enCours} libelle="En cours" teinte="#ffb673" />
          <StatTile icon={CheckCircle2} valeur={termines} libelle="Terminés" teinte="#4ade80" />
          <StatTile icon={ListChecks} valeur={totalTaches} libelle="Tâches au total" />
        </div>
      </div>

      <FormulaireEtHistorique
        icon={HardHat}
        titre="Chantiers"
        sousTitre={idEnEdition !== null ? 'Modifier le chantier sélectionné' : 'Suivi de chantier'}
        onSubmit={envoyer}
        envoiEnCours={creation.enCours || modification.enCours}
        erreurEnvoi={creation.erreur ?? modification.erreur ?? suppression.erreur}
        texteBouton={idEnEdition !== null ? 'Mettre à jour' : 'Créer le chantier'}
        champs={[
          { label: 'Nom du chantier', placeholder: 'Résidence Sotuba', valeur: nom, onChange: setNom, requis: true },
          { label: 'Client', placeholder: 'Particulier — M. Sangaré', valeur: client, onChange: setClient },
          { label: 'Début', type: 'date', valeur: debut, onChange: setDebut },
          { label: 'Fin prévue', type: 'date', valeur: fin, onChange: setFin },
          { label: 'Description (optionnel)', type: 'textarea', placeholder: 'Détails du projet...', valeur: description, onChange: setDescription },
        ]}
        entete={
          idEnEdition !== null ? (
            <button onClick={annulerEdition} className="mb-3 text-xs font-semibold text-accent2 hover:text-accent">
              ← Annuler la modification
            </button>
          ) : undefined
        }
        colonnesHistorique={['Référence', 'Chantier', 'Client', 'Avancement', 'Statut', '']}
        lignesHistorique={liste.map((p) => [
          `#${p.id}`,
          p.name,
          p.client || '—',
          `${Math.round(p.overall_progress)}%`,
          <Badge tone={TONE[p.status] ?? 'neutral'}>{p.status_display}</Badge>,
          <div className="flex items-center gap-2">
            <Link to={`/chantiers/${p.id}`} className="text-xs font-semibold text-accent2">
              Détail →
            </Link>
            <button onClick={() => modifier(p)} className="text-xs font-semibold text-muted hover:text-white">
              Modifier
            </button>
            <button onClick={() => supprimer(p.id)} disabled={suppression.enCours} className="text-xs font-semibold text-red-400 hover:text-red-300">
              Supprimer
            </button>
          </div>,
        ])}
      />
    </div>
  );
}
