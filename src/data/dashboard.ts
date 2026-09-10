export const chartDays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

export const highPerformance = [28, 38, 60, 52, 78, 85, 62];
export const goodPerformance = [20, 45, 30, 55, 35, 60, 48];

export const statTiles = [
  { id: 'done', value: 76, label: 'Tâches complétées', tint: '#34d399' },
  { id: 'productivity', value: 85, label: 'Productivité', tint: '#ff8a4c' },
  { id: 'realtime', value: 49, label: 'En temps réel', tint: '#a78bfa' },
] as const;

export const goals = [
  { id: 'dashboard', title: 'Tableau de bord', subtitle: 'Design UI/UX', progress: 64 },
  { id: 'movement', title: 'Mouvement', subtitle: 'Développement', progress: 87 },
];

export const assignments = [
  {
    id: '1500',
    code: '#1500',
    duration: '1h',
    title: 'Création de marque',
    status: 'En cours' as const,
    avatars: ['CH', 'JL'],
  },
  {
    id: '1400',
    code: '#1400',
    duration: '1h',
    title: 'Documents de réorganisation',
    status: 'En attente' as const,
    avatars: ['CH', 'JL'],
  },
];

export const navItems = [
  { id: 'accueil', label: 'Accueil', icon: 'Home' as const },
  { id: 'planning', label: 'Planning', icon: 'Calendar' as const },
  { id: 'projets', label: 'Projets', icon: 'Folder' as const },
  { id: 'taches', label: 'Tâches', icon: 'CheckSquare' as const },
  { id: 'chat', label: 'Chat', icon: 'MessageCircle' as const },
];
