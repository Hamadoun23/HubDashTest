import { useState } from 'react';
import { Package, Plus, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/ui-light/Card';
import { EtatChargement, EtatErreur } from '../../components/ui-light/EtatRequete';
import { PageHeader } from '../../components/ui-light/PageHeader';
import { Badge, TableVirtus } from '../../components/ui-light/Table';
import { useAction, useApi } from '../../lib/hooks/useApi';
import {
  annulerRequisition,
  creerRequisition,
  listerDepartements,
  mesRequisitions,
  soumettreRequisition,
  type LigneRequisition,
  type Priorite,
} from '../../lib/api/finance';

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

function ligneVide(): LigneRequisition {
  return { designation: '', quantite: 1, unite: '', prix_unitaire: 0 };
}

export default function Requisitions() {
  const requisitions = useApi(mesRequisitions, []);
  const departements = useApi(listerDepartements, []);
  const creation = useAction(creerRequisition);
  const soumission = useAction(soumettreRequisition);
  const annulation = useAction(annulerRequisition);

  const [objet, setObjet] = useState('');
  const [departement, setDepartement] = useState('');
  const [justification, setJustification] = useState('');
  const [dateBesoin, setDateBesoin] = useState('');
  const [priorite, setPriorite] = useState<Priorite>('NORMALE');
  const [lignes, setLignes] = useState<LigneRequisition[]>([ligneVide()]);

  const total = lignes.reduce((somme, l) => somme + (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0), 0);

  function majLigne(index: number, champ: keyof LigneRequisition, valeur: string) {
    setLignes((precedent) => precedent.map((l, i) => (i === index ? { ...l, [champ]: valeur } : l)));
  }

  function ajouterLigne() {
    setLignes((precedent) => [...precedent, ligneVide()]);
  }

  function retirerLigne(index: number) {
    setLignes((precedent) => (precedent.length > 1 ? precedent.filter((_, i) => i !== index) : precedent));
  }

  function reinitialiser() {
    setObjet('');
    setDepartement('');
    setJustification('');
    setDateBesoin('');
    setPriorite('NORMALE');
    setLignes([ligneVide()]);
  }

  async function envoyer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const creee = await creation.executer({
      objet,
      departement: departement ? Number(departement) : null,
      justification,
      date_besoin: dateBesoin || null,
      priorite,
      lignes: lignes
        .filter((l) => l.designation.trim())
        .map((l) => ({ designation: l.designation, quantite: l.quantite, unite: l.unite, prix_unitaire: l.prix_unitaire })),
    });
    await soumission.executer(creee.id);
    reinitialiser();
    requisitions.recharger();
  }

  if (requisitions.chargement) return <EtatChargement texte="Chargement des réquisitions…" />;
  if (requisitions.erreur) return <EtatErreur message={requisitions.erreur} recharger={requisitions.recharger} />;

  const liste = requisitions.donnees ?? [];

  return (
    <div>
      <PageHeader
        icon={Package}
        titre="Réquisitions"
        sousTitre="Demander du matériel ou des fournitures, avec circuit de validation par seuils"
        accent="#d03e0d"
      />

      <div className="grid grid-cols-[1.2fr_1.6fr] gap-6">
        <Card>
          <h2 className="text-sm font-bold text-slate-900">Nouvelle réquisition</h2>
          <form className="mt-4 flex flex-col gap-3" onSubmit={envoyer}>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-500">
                Objet <span className="text-rh-marque500">*</span>
              </label>
              <input
                value={objet}
                onChange={(e) => setObjet(e.target.value)}
                placeholder="Fournitures de bureau — septembre"
                required
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-500">Département</label>
                <select
                  value={departement}
                  onChange={(e) => setDepartement(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none"
                >
                  <option value="">—</option>
                  {(departements.donnees ?? []).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nom}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-500">Priorité</label>
                <select
                  value={priorite}
                  onChange={(e) => setPriorite(e.target.value as Priorite)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none"
                >
                  {PRIORITES.map((p) => (
                    <option key={p.valeur} value={p.valeur}>
                      {p.libelle}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-500">Besoin pour le</label>
              <input
                type="date"
                value={dateBesoin}
                onChange={(e) => setDateBesoin(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-500">Justification</label>
              <textarea
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                rows={2}
                placeholder="Pourquoi cette demande..."
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
              />
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-500">Lignes</label>
                <button type="button" onClick={ajouterLigne} className="flex items-center gap-1 text-xs font-semibold text-rh-marque700 hover:text-rh-marque800">
                  <Plus size={14} /> Ajouter une ligne
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {lignes.map((ligne, index) => (
                  <div key={index} className="grid grid-cols-[2fr_0.7fr_0.7fr_0.9fr_auto] items-center gap-1.5">
                    <input
                      value={ligne.designation}
                      onChange={(e) => majLigne(index, 'designation', e.target.value)}
                      placeholder="Désignation"
                      className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none"
                    />
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={ligne.quantite}
                      onChange={(e) => majLigne(index, 'quantite', e.target.value)}
                      placeholder="Qté"
                      className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:outline-none"
                    />
                    <input
                      value={ligne.unite}
                      onChange={(e) => majLigne(index, 'unite', e.target.value)}
                      placeholder="Unité"
                      className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none"
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={ligne.prix_unitaire}
                      onChange={(e) => majLigne(index, 'prix_unitaire', e.target.value)}
                      placeholder="P.U."
                      className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => retirerLigne(index)}
                      disabled={lignes.length === 1}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-right text-xs font-bold text-slate-900">
                Total : {total.toLocaleString('fr-FR')} XOF
              </p>
            </div>

            {(creation.erreur || soumission.erreur) && (
              <p className="text-xs font-semibold text-rose-600">{creation.erreur ?? soumission.erreur}</p>
            )}

            <button
              type="submit"
              disabled={creation.enCours || soumission.enCours}
              className="mt-1 rounded-xl bg-rh-marque500 px-3 py-2.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {creation.enCours || soumission.enCours ? 'Envoi...' : 'Envoyer la réquisition'}
            </button>
          </form>
        </Card>

        <div>
          <h2 className="mb-3 text-sm font-bold text-slate-900">Mes réquisitions</h2>
          {liste.length === 0 ? (
            <p className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
              Aucune réquisition envoyée pour le moment.
            </p>
          ) : (
            <TableVirtus
              colonnes={['Référence', 'Objet', 'Priorité', 'Montant', 'Étape', 'Statut', '']}
              lignes={liste.map((r) => [
                <Link to={`/rh/requisitions/${r.id}`} className="font-semibold text-rh-marque700 hover:text-rh-marque800">
                  {r.numero}
                </Link>,
                r.objet,
                r.priorite_libelle,
                `${Number(r.montant).toLocaleString('fr-FR')} ${r.devise}`,
                r.etape_courante_libelle || '—',
                <Badge tone={TONE[r.statut] ?? 'neutral'}>{r.statut_libelle}</Badge>,
                r.modifiable && r.statut === 'EN_VALIDATION' ? (
                  <button
                    onClick={() => annulation.executer(r.id).then(() => requisitions.recharger())}
                    disabled={annulation.enCours}
                    className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-500 hover:text-slate-900"
                  >
                    Annuler
                  </button>
                ) : (
                  ''
                ),
              ])}
            />
          )}
        </div>
      </div>
    </div>
  );
}
