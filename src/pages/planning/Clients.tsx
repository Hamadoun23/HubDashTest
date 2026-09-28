import { useState } from 'react';
import { Pencil, Plus, Trash2, Users, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { EtatErreur } from '../../components/ui/EtatRequete';
import { PageHeader } from '../../components/ui/PageHeader';
import { TableVirtus } from '../../components/ui/Table';
import { useAction, useApi } from '../../lib/hooks/useApi';
import { creerClient, listerClients, modifierClient, supprimerClient, type ClientPlanning } from '../../lib/api/planning';
import { usePermissionsPlanning } from './permissions';

const CHAMP = 'w-full rounded-xl border border-border bg-surface2 px-3 py-2 text-sm text-white placeholder:text-muted focus:border-accent focus:outline-none';
const LABEL = 'mb-1.5 block text-xs font-semibold text-muted';

export default function Clients() {
  const navigate = useNavigate();
  const { peutEcrire } = usePermissionsPlanning();
  const clients = useApi(listerClients, []);
  const creation = useAction(creerClient);
  const modification = useAction(modifierClient);

  const [ouvert, setOuvert] = useState(false);
  const [idEnEdition, setIdEnEdition] = useState<number | null>(null);
  const [nom, setNom] = useState('');
  const [suppressionEnCoursId, setSuppressionEnCoursId] = useState<number | null>(null);

  function ouvrirCreation() {
    setIdEnEdition(null);
    setNom('');
    setOuvert(true);
  }

  function ouvrirEdition(c: ClientPlanning, e: React.MouseEvent) {
    e.stopPropagation();
    setIdEnEdition(c.id);
    setNom(c.nom_entreprise);
    setOuvert(true);
  }

  async function envoyer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (idEnEdition !== null) {
      await modification.executer(idEnEdition, nom);
    } else {
      await creation.executer(nom);
    }
    setOuvert(false);
    clients.recharger();
  }

  async function supprimer(c: ClientPlanning, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Supprimer « ${c.nom_entreprise} » ? Ses ${c.tournages_count} tournage(s) et ${c.publications_count} publication(s) seront supprimés aussi.`)) return;
    setSuppressionEnCoursId(c.id);
    try {
      await supprimerClient(c.id);
      clients.recharger();
    } finally {
      setSuppressionEnCoursId(null);
    }
  }

  if (clients.erreur) return <EtatErreur message={clients.erreur} recharger={clients.recharger} />;

  const liste = clients.donnees ?? [];
  const erreurForm = creation.erreur ?? modification.erreur;
  const enCoursForm = creation.enCours || modification.enCours;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={Users}
        titre="Clients"
        sousTitre="Comptes suivis par Planning"
        action={
          peutEcrire ? (
            <button onClick={ouvrirCreation} className="flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2 text-xs font-bold text-black">
              <Plus size={14} /> Nouveau client
            </button>
          ) : undefined
        }
      />

      {liste.length === 0 ? (
        <p className="rounded-3xl border border-border bg-surface p-8 text-center text-sm text-muted">Aucun client pour le moment.</p>
      ) : (
        <TableVirtus
          colonnes={peutEcrire ? ['Nom', 'Tournages', 'Publications', '', ''] : ['Nom', 'Tournages', 'Publications']}
          onRowClick={(index) => navigate(`/planning/clients/${liste[index].id}`)}
          lignes={liste.map((c) => {
            const base = [c.nom_entreprise, c.tournages_count, c.publications_count];
            if (!peutEcrire) return base;
            return [
              ...base,
              <button onClick={(e) => ouvrirEdition(c, e)} className="flex items-center gap-1 text-xs font-semibold text-accent2 hover:text-white">
                <Pencil size={13} /> Modifier
              </button>,
              <button
                onClick={(e) => supprimer(c, e)}
                disabled={suppressionEnCoursId === c.id}
                className="flex items-center gap-1 text-xs font-semibold text-red-400 hover:text-red-300 disabled:opacity-50"
              >
                <Trash2 size={13} /> Supprimer
              </button>,
            ];
          })}
        />
      )}

      {ouvert ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <Card className="w-full max-w-md !bg-surface">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">{idEnEdition !== null ? 'Modifier le client' : 'Nouveau client'}</h2>
              <button onClick={() => setOuvert(false)} className="rounded-lg p-1 text-muted hover:bg-surface2 hover:text-white">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={envoyer} className="flex flex-col gap-3">
              <div>
                <label className={LABEL}>
                  Nom de l'entreprise <span className="text-accent2">*</span>
                </label>
                <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Supermarché Azar" required className={CHAMP} />
              </div>
              {erreurForm && <p className="text-xs font-semibold text-red-400">{erreurForm}</p>}
              <button type="submit" disabled={enCoursForm} className="mt-1 rounded-xl bg-accent px-3 py-2.5 text-xs font-bold text-black disabled:opacity-60">
                {enCoursForm ? 'Envoi...' : idEnEdition !== null ? 'Mettre à jour' : 'Ajouter le client'}
              </button>
            </form>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
