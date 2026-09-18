import { useState } from 'react';
import { Activity, CheckCircle2, HardHat, ListChecks } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/ui-light/Card';
import { CircularProgress } from '../../components/ui-light/CircularProgress';
import { EtatErreur } from '../../components/ui-light/EtatRequete';
import { FormulaireEtHistorique } from '../../components/ui-light/FormulaireEtHistorique';
import { StatTile } from '../../components/ui-light/StatTile';
import { useAction, useApi } from '../../lib/hooks/useApi';
import { creerProjet, listerProjets, modifierProjet, supprimerProjet, type StatutProjet } from '../../lib/api/chantiers';
import { StatutBadge } from './ChantierLayout';

const TONE: Record<StatutProjet, 'vert' | 'bleu' | 'rouge' | 'neutre'> = {
  termine: 'vert',
  en_cours: 'bleu',
  planifie: 'neutre',
  suspendu: 'rouge',
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
          <CircularProgress
            progress={avancementMoyen}
            size={72}
            strokeWidth={7}
            gradientId="chantiers-avancement-moyen"
            accent="#c8521a"
            accentClair="#f0b998"
          />
          <div>
            <p className="text-sm font-semibold text-chantiers-marron">Avancement moyen</p>
            <p className="text-xs text-slate-500">Tous les chantiers confondus</p>
          </div>
        </Card>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatTile icon={HardHat} valeur={totalChantiers} libelle="Chantiers au total" teinte="#c8521a" />
          <StatTile icon={Activity} valeur={enCours} libelle="En cours" teinte="#1a5c8a" />
          <StatTile icon={CheckCircle2} valeur={termines} libelle="Terminés" teinte="#1a7a42" />
          <StatTile icon={ListChecks} valeur={totalTaches} libelle="Tâches au total" teinte="#c8521a" />
        </div>
      </div>

      <FormulaireEtHistorique
        icon={HardHat}
        titre="Chantiers"
        sousTitre={idEnEdition !== null ? 'Modifier le chantier sélectionné' : 'Suivi de chantier'}
        accent="#c8521a"
        onSubmit={envoyer}
        envoiEnCours={creation.enCours || modification.enCours}
        erreurEnvoi={creation.erreur ?? modification.erreur ?? suppression.erreur}
        texteBouton={idEnEdition !== null ? 'Mettre à jour' : 'Créer le chantier'}
        texteAction="Nouveau chantier"
        enEdition={idEnEdition !== null}
        onFermer={annulerEdition}
        champs={[
          { label: 'Nom du chantier', placeholder: 'Résidence Sotuba', valeur: nom, onChange: setNom, requis: true },
          { label: 'Client', placeholder: 'Particulier — M. Sangaré', valeur: client, onChange: setClient },
          { label: 'Début', type: 'date', valeur: debut, onChange: setDebut },
          { label: 'Fin prévue', type: 'date', valeur: fin, onChange: setFin },
          { label: 'Description (optionnel)', type: 'textarea', placeholder: 'Détails du projet...', valeur: description, onChange: setDescription },
        ]}
        colonnesHistorique={['Référence', 'Chantier', 'Client', 'Avancement', 'Statut', '']}
        lignesHistorique={liste.map((p) => [
          `#${p.id}`,
          p.name,
          p.client || '—',
          `${Math.round(p.overall_progress)}%`,
          <StatutBadge ton={TONE[p.status] ?? 'neutre'}>{p.status_display}</StatutBadge>,
          <div className="flex items-center gap-2">
            <Link to={`/chantiers/${p.id}`} className="text-xs font-semibold text-chantiers-terracotta">
              Détail →
            </Link>
            <button onClick={() => modifier(p)} className="text-xs font-semibold text-slate-500 hover:text-chantiers-marron">
              Modifier
            </button>
            <button onClick={() => supprimer(p.id)} disabled={suppression.enCours} className="text-xs font-semibold text-chantiers-rouge hover:opacity-80">
              Supprimer
            </button>
          </div>,
        ])}
      />
    </div>
  );
}
