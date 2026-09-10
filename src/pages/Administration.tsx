import { Building2 } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { PageHeader } from '../components/ui/PageHeader';
import { Badge, TableVirtus } from '../components/ui/Table';

const comptes = [
  { nom: 'Hamadoun Cissé', email: 'hcisse@gdamali.net', role: 'Super administrateur', statut: 'Actif' as const },
  { nom: 'Awa Diarra', email: 'a.diarra@gdamali.net', role: 'RH', statut: 'Actif' as const },
  { nom: 'M. Koné', email: 'm.kone@gdamali.net', role: 'Direction', statut: 'Actif' as const },
  { nom: 'Boubacar Traoré', email: 'b.traore@gdamali.net', role: 'Chantiers', statut: 'Actif' as const },
  { nom: 'Fatou Konaté', email: 'f.konate@gdamali.net', role: "Jus d'orange", statut: 'Suspendu' as const },
];

const applications = [
  'Board — Administration',
  'RH & Finance',
  "Jus d'orange",
  'Chantiers',
  'Planning',
];

export default function Administration() {
  return (
    <div>
      <PageHeader icon={Building2} titre="Administration" sousTitre="Comptes et habilitations" />

      <div className="grid grid-cols-[1fr_1.6fr] gap-6">
        <Card>
          <h2 className="text-sm font-bold text-white">Nouveau compte</h2>
          <div className="mt-4 flex flex-col gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted">Nom complet</label>
              <input
                placeholder="Prénom Nom"
                className="w-full rounded-xl border border-border bg-surface2 px-3 py-2 text-sm text-white placeholder:text-muted focus:border-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted">Adresse professionnelle</label>
              <input
                type="email"
                placeholder="prenom.nom@gdamali.net"
                className="w-full rounded-xl border border-border bg-surface2 px-3 py-2 text-sm text-white placeholder:text-muted focus:border-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted">Application</label>
              <select className="w-full rounded-xl border border-border bg-surface2 px-3 py-2 text-sm text-white focus:border-accent focus:outline-none">
                {applications.map((app) => (
                  <option key={app}>{app}</option>
                ))}
              </select>
            </div>
            <button className="mt-1 rounded-xl bg-accent px-3 py-2.5 text-xs font-bold text-black">
              Créer le compte
            </button>
          </div>
        </Card>

        <div>
          <h2 className="mb-3 text-sm font-bold text-white">Comptes existants</h2>
          <TableVirtus
            colonnes={['Nom', 'Email', 'Application', 'Statut']}
            lignes={comptes.map((c) => [
              c.nom,
              c.email,
              c.role,
              <Badge tone={c.statut === 'Actif' ? 'success' : 'danger'}>{c.statut}</Badge>,
            ])}
          />
        </div>
      </div>
    </div>
  );
}
