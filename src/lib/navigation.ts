import {
  Boxes,
  Building2,
  Calendar,
  Citrus,
  Clapperboard,
  ClipboardList,
  Clock,
  CreditCard,
  FileSignature,
  FileText,
  FlaskConical,
  HardHat,
  Home,
  Landmark,
  LayoutDashboard,
  Lightbulb,
  Map,
  Megaphone,
  Package,
  PackageOpen,
  ReceiptText,
  Settings,
  ShoppingCart,
  Sprout,
  Trophy,
  UserCog,
  UserPlus,
  UserRound,
  Users,
  Video,
  Wallet,
  Wine,
  type LucideIcon,
} from 'lucide-react';

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

/** `app` identifie à quelle application métier ce groupe appartient — 'hub' pour les
 * groupes visibles à la racine (accueil, board). Sert à n'afficher, une fois dans une
 * appli, que sa propre navigation (voir Sidebar) : on quitte visuellement le hub. */
export type AppKey = 'hub' | 'rh' | 'jus' | 'chantiers' | 'planning' | 'campagnes';

export type NavGroup = {
  key: string;
  label: string;
  color: string;
  app: AppKey;
  items: NavItem[];
};

/** Métadonnées du lanceur d'applications (écran d'accueil) et de l'en-tête de sidebar
 * une fois dans une appli. `chemin` doit correspondre au premier `href` de ses groupes. */
export const APPLICATIONS_HUB: { key: AppKey; nom: string; description: string; chemin: string; icon: LucideIcon; couleur: string }[] = [
  { key: 'rh', nom: 'RH & Finance', description: 'Congés, présences, validations, annuaire', chemin: '/rh', icon: Users, couleur: 'bg-blue-400' },
  { key: 'jus', nom: "Jus d'orange", description: 'Production, commercial, finance, reporting', chemin: '/jus/production', icon: Citrus, couleur: 'bg-amber-400' },
  { key: 'chantiers', nom: 'Chantiers', description: 'Suivi de chantier, équipes, avancement', chemin: '/chantiers', icon: HardHat, couleur: 'bg-emerald-400' },
  { key: 'planning', nom: 'Planning', description: 'Calendrier, tournages, publications', chemin: '/planning', icon: Calendar, couleur: 'bg-rose-400' },
  { key: 'campagnes', nom: 'Campagnes', description: 'Ventes, enrôlements, campagnes bancaires', chemin: '/campagnes', icon: Clapperboard, couleur: 'bg-violet-400' },
];

/** Reprend fidèlement la structure réelle du hub (voir `frontend/src/rh/lib/navigation.ts`,
 * `frontend/src/jus/lib/nav.ts`, `frontend/src/planning/composants/espace-planning.tsx`) —
 * mêmes libellés, mêmes chemins, réorganisés en groupes pour la sidebar Virtus. */
export const NAVIGATION: NavGroup[] = [
  {
    key: 'accueil',
    label: 'Accueil',
    color: 'bg-accent',
    app: 'hub',
    items: [{ label: 'Mes applications', href: '/', icon: Home }],
  },
  {
    key: 'board',
    label: 'Board',
    color: 'bg-violet-400',
    app: 'hub',
    items: [{ label: 'Administration', href: '/administration', icon: Building2 }],
  },
  {
    key: 'rh',
    label: 'RH & Finance',
    color: 'bg-blue-400',
    app: 'rh',
    items: [
      { label: 'Tableau de bord', href: '/rh', icon: Home },
      { label: 'À valider', href: '/rh/validations', icon: ClipboardList },
      { label: 'Historique', href: '/rh/historique', icon: FileText },
      { label: 'Mes congés', href: '/rh/absences', icon: Calendar },
      { label: 'Présences', href: '/rh/presences', icon: Clock },
      { label: 'Mes permissions', href: '/rh/permissions', icon: UserRound },
      { label: 'Signaler un retard', href: '/rh/retards', icon: HardHat },
      { label: 'Mes demandes', href: '/rh/mes-demandes', icon: ReceiptText },
      { label: 'Organisation', href: '/rh/organisation', icon: Users },
      { label: 'Annuaire', href: '/rh/annuaire', icon: Users },
      { label: 'Mon espace', href: '/rh/mon-espace', icon: UserCog },
    ],
  },
  {
    key: 'orange-direction',
    label: "Jus d'orange — Direction",
    color: 'bg-violet-400',
    app: 'jus',
    items: [
      { label: 'Tableau de bord', href: '/jus/direction', icon: LayoutDashboard },
      { label: 'Utilisateurs', href: '/jus/direction/utilisateurs', icon: Users },
    ],
  },
  {
    key: 'orange-production',
    label: "Jus d'orange — Production",
    color: 'bg-amber-400',
    app: 'jus',
    items: [
      { label: 'Tableau de bord', href: '/jus/production', icon: LayoutDashboard },
      { label: 'Producteurs', href: '/jus/production/producteurs', icon: UserRound },
      { label: 'Cueillettes', href: '/jus/production/cueillettes', icon: Sprout },
      { label: 'Articles / Stock', href: '/jus/production/articles', icon: Boxes },
      { label: 'Réceptions', href: '/jus/production/receptions', icon: PackageOpen },
      { label: 'Productions', href: '/jus/production/productions', icon: FlaskConical },
      { label: 'Conditionnements', href: '/jus/production/conditionnements', icon: Package },
      { label: 'Bouteilles', href: '/jus/production/bouteilles', icon: Wine },
      { label: 'Inventaires', href: '/jus/production/inventaires', icon: ClipboardList },
    ],
  },
  {
    key: 'orange-commercial',
    label: "Jus d'orange — Commercial",
    color: 'bg-blue-400',
    app: 'jus',
    items: [
      { label: 'Tableau de bord', href: '/jus/commercial', icon: LayoutDashboard },
      { label: 'Prospection', href: '/jus/commercial/prospection', icon: Map },
      { label: 'Clients', href: '/jus/commercial/clients', icon: UserRound },
      { label: 'Ventes', href: '/jus/commercial/ventes', icon: Citrus },
      { label: 'Commandes', href: '/jus/commercial/commandes', icon: ShoppingCart },
      { label: 'Factures', href: '/jus/commercial/factures', icon: ReceiptText },
      { label: 'Paiements', href: '/jus/commercial/paiements', icon: Wallet },
    ],
  },
  {
    key: 'orange-finance',
    label: "Jus d'orange — Finance",
    color: 'bg-emerald-400',
    app: 'jus',
    items: [
      { label: 'Tableau de bord', href: '/jus/finance', icon: LayoutDashboard },
      { label: 'Trésorerie', href: '/jus/finance/tresorerie', icon: Landmark },
    ],
  },
  {
    key: 'orange-reporting',
    label: "Jus d'orange — Reporting",
    color: 'bg-rose-400',
    app: 'jus',
    items: [
      { label: "Vue d'ensemble", href: '/jus/reporting', icon: Boxes },
      { label: 'Récolte', href: '/jus/reporting/recolte', icon: Sprout },
      { label: 'Approvisionnement', href: '/jus/reporting/appro', icon: PackageOpen },
      { label: 'Fabrication', href: '/jus/reporting/fabrication', icon: FlaskConical },
      { label: 'Emballage', href: '/jus/reporting/emballage', icon: Package },
      { label: 'Entrepôt', href: '/jus/reporting/entrepot', icon: Boxes },
      { label: 'Distribution', href: '/jus/reporting/distribution', icon: FileText },
    ],
  },
  {
    key: 'chantiers',
    label: 'Chantiers',
    color: 'bg-emerald-400',
    app: 'chantiers',
    items: [{ label: 'Suivi de chantier', href: '/chantiers', icon: HardHat }],
  },
  {
    key: 'planning',
    label: 'Planning',
    color: 'bg-rose-400',
    app: 'planning',
    items: [
      { label: 'Tableau de bord', href: '/planning', icon: Home },
      { label: 'Clients', href: '/planning/clients', icon: Users },
      { label: 'Idées de contenu', href: '/planning/idees-contenu', icon: Lightbulb },
      { label: 'Tournages', href: '/planning/tournages', icon: Video },
      { label: 'Publications', href: '/planning/publications', icon: Megaphone },
    ],
  },
  {
    key: 'campagnes',
    label: 'Campagnes',
    color: 'bg-violet-400',
    app: 'campagnes',
    items: [
      { label: 'Tableau de bord', href: '/campagnes', icon: Home },
      { label: 'Mes ventes', href: '/campagnes/ventes', icon: CreditCard },
      { label: 'Mes enrôlements', href: '/campagnes/enrolements', icon: UserPlus },
      { label: 'Campagnes', href: '/campagnes/admin/campagnes', icon: Clapperboard },
      { label: 'Performances', href: '/campagnes/performances', icon: Trophy },
      { label: 'Mon contrat', href: '/campagnes/mon-contrat', icon: FileSignature },
    ],
  },
];

export const PIED_NAVIGATION: NavItem[] = [
  { label: 'Mon compte', href: '/mon-compte', icon: Settings },
];
