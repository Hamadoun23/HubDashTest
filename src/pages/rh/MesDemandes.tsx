import { useState } from 'react';
import { Plus, ReceiptText, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { EtatChargement, EtatErreur } from '../../components/ui/EtatRequete';
import { PageHeader } from '../../components/ui/PageHeader';
import { Badge, TableVirtus } from '../../components/ui/Table';
import { useAction, useApi } from '../../lib/hooks/useApi';
import { annulerRequisition, creerRequisition, listerDepartements, mesRequisitions, soumettreRequisition, type Priorite } from '../../lib/api/finance';

const CHAMP = 'w-full rounded-xl border border-border bg-surface2 px-3 py-2 text-sm text-white placeholder:text-muted focus:border-accent focus:outline-none';
const LABEL = 'mb-1.5 block text-xs font-semibold text-muted';

const TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  APPROUVE: 'success',
  REJETE: 'danger',
  CLOTURE: 'success',
  EN_VALIDATION: 'warning',
  BROUILLON: 'neutral',
  ANNULE: 'neutral',
};

const PRIORITES: { valeur: Priorite; libelle: string }[] = [
  { valeur: 'BASSE', libelle: 'Basse' },
  { valeur: 'NORMALE', libelle: 'Normale' },
  { valeur: 'HAUTE', libelle: 'Haute' },
  { valeur: 'URGENTE', libelle: 'Urgente' },
];

/** Demandes d'ordre financier uniquement (achat de matériel/fournitures) —
 * congés, permissions et retards ont chacun leur propre page dédiée, pas
 * besoin de les dupliquer ici. La liste est ce qu'on voit par défaut ; le
 * formulaire ne s'ouvre qu'au clic sur le bouton d'action.
 *
 * Un seul montant global plutôt qu'un détail ligne par ligne — plus simple
 * à saisir pour qui demande juste "achète-moi ça pour environ X" ; le
 * backend garde son modèle de lignes (nécessaire pour le calcul du total
 * ailleurs dans l'appli), on lui en construit une seule en coulisses. */
export default function MesDemandes() {
  const requisitions = useApi(mesRequisitions, []);
  const departements = useApi(listerDepartements, []);

  const creation = useAction(creerRequisition);
  const soumission = useAction(soumettreRequisition);
  const annulation = useAction(annulerRequisition);

  const [ouvert, setOuvert] = useState(false);
  const [objet, setObjet] = useState('');
  const [departement, setDepartement] = useState('');
  const [justification, setJustification] = useState('');
  const [dateBesoin, setDateBesoin] = useState('');
  const [priorite, setPriorite] = useState<Priorite>('NORMALE');
  const [montant, setMontant] = useState('');
  const [montantEstime, setMontantEstime] = useState<'final' | 'estime'>('final');

  if (requisitions.chargement) return <EtatChargement texte="Chargement de vos demandes…" />;
  if (requisitions.erreur) return <EtatErreur message={requisitions.erreur} recharger={requisitions.recharger} />;

  function reinitialiser() {
    setObjet('');
    setDepartement('');
    setJustification('');
    setDateBesoin('');
    setPriorite('NORMALE');
    setMontant('');
    setMontantEstime('final');
  }

  function ouvrir() {
    reinitialiser();
    setOuvert(true);
  }

  async function envoyer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const creee = await creation.executer({
      objet,
      departement: departement ? Number(departement) : null,
      justification,
      date_besoin: dateBesoin || null,
      priorite,
      montant_estime: montantEstime === 'estime',
      lignes: [{ designation: objet, quantite: 1, unite: '', prix_unitaire: montant || 0 }],
    });
    await soumission.executer(creee.id);
    setOuvert(false);
    requisitions.recharger();
  }

  const liste = requisitions.donnees ?? [];
  const erreur = creation.erreur ?? soumission.erreur;
  const enCours = creation.enCours || soumission.enCours;

  return (
    <div>
      <PageHeader
        icon={ReceiptText}
        titre="Mes demandes"
        sousTitre="Demandes financières — achat de matériel ou de fournitures, avec circuit de validation"
        action={
          <button onClick={ouvrir} className="flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2 text-xs font-bold text-black">
            <Plus size={14} /> Nouvelle demande
          </button>
        }
      />

      {liste.length === 0 ? (
        <p className="rounded-3xl border border-border bg-surface p-8 text-center text-sm text-muted">Rien pour le moment.</p>
      ) : (
        <TableVirtus
          colonnes={['Référence', 'Objet', 'Priorité', 'Montant', 'Étape', 'Statut', '']}
          lignes={liste.map((r) => [
            <Link to={`/rh/requisitions/${r.id}`} className="font-semibold text-white hover:text-accent2">
              {r.numero}
            </Link>,
            r.objet,
            r.priorite_libelle,
            <span>
              {Number(r.montant).toLocaleString('fr-FR')} {r.devise}
              {r.montant_estime ? <span className="ml-1.5 text-[10px] font-semibold text-muted">(estimatif)</span> : null}
            </span>,
            r.etape_courante_libelle || '—',
            <Badge tone={TONE[r.statut] ?? 'neutral'}>{r.statut_libelle}</Badge>,
            r.modifiable && r.statut === 'EN_VALIDATION' ? (
              <button
                onClick={() => annulation.executer(r.id).then(() => requisitions.recharger())}
                disabled={annulation.enCours}
                className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-muted hover:text-white"
              >
                Annuler
              </button>
            ) : (
              ''
            ),
          ])}
        />
      )}

      {ouvert ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <Card className="w-full max-w-lg !bg-surface">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">Nouvelle demande</h2>
              <button onClick={() => setOuvert(false)} className="rounded-lg p-1 text-muted hover:bg-surface2 hover:text-white">
                <X size={16} />
              </button>
            </div>
            <form className="flex flex-col gap-3" onSubmit={envoyer}>
              <div>
                <label className={LABEL}>
                  Objet <span className="text-accent2">*</span>
                </label>
                <input value={objet} onChange={(e) => setObjet(e.target.value)} placeholder="Fournitures de bureau — septembre" required className={CHAMP} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Département</label>
                  <select value={departement} onChange={(e) => setDepartement(e.target.value)} className={CHAMP}>
                    <option value="">—</option>
                    {(departements.donnees ?? []).map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.nom}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={LABEL}>Priorité</label>
                  <select value={priorite} onChange={(e) => setPriorite(e.target.value as Priorite)} className={CHAMP}>
                    {PRIORITES.map((p) => (
                      <option key={p.valeur} value={p.valeur}>
                        {p.libelle}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className={LABEL}>Besoin pour le</label>
                <input type="date" value={dateBesoin} onChange={(e) => setDateBesoin(e.target.value)} className={CHAMP} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>
                    Montant (XOF) <span className="text-accent2">*</span>
                  </label>
                  <input type="number" min="0" step="1" value={montant} onChange={(e) => setMontant(e.target.value)} required placeholder="0" className={CHAMP} />
                </div>
                <div>
                  <label className={LABEL}>Ce montant est</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setMontantEstime('final')}
                      className={`flex-1 rounded-xl border px-3 py-2 text-xs font-bold ${montantEstime === 'final' ? 'border-accent bg-accent/15 text-accent2' : 'border-border text-muted'}`}
                    >
                      Final
                    </button>
                    <button
                      type="button"
                      onClick={() => setMontantEstime('estime')}
                      className={`flex-1 rounded-xl border px-3 py-2 text-xs font-bold ${montantEstime === 'estime' ? 'border-accent bg-accent/15 text-accent2' : 'border-border text-muted'}`}
                    >
                      Estimatif
                    </button>
                  </div>
                </div>
              </div>
              <div>
                <label className={LABEL}>Justification</label>
                <textarea value={justification} onChange={(e) => setJustification(e.target.value)} rows={2} placeholder="Pourquoi cette demande..." className={CHAMP} />
              </div>
              {erreur ? <p className="text-xs font-semibold text-red-400">{erreur}</p> : null}
              <button type="submit" disabled={enCours} className="mt-1 rounded-xl bg-accent px-3 py-2.5 text-xs font-bold text-black disabled:cursor-not-allowed disabled:opacity-60">
                {enCours ? 'Envoi...' : 'Envoyer la demande'}
              </button>
            </form>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
