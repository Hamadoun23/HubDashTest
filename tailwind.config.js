/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#120d0a',
        // Translucentes à dessein : le fond de l'appli est désormais le motif
        // de marque GDA, pas un aplat sombre — cartes, sidebar et barre du
        // haut doivent laisser deviner le motif derrière elles plutôt que le
        // masquer (retour explicite : « ça doit être transparent »).
        surface: 'rgba(26, 19, 14, 0.6)',
        surface2: 'rgba(36, 26, 19, 0.55)',
        border: 'rgba(255, 255, 255, 0.12)',
        muted: '#c9b8ab',
        accent: '#ff6a2b',
        accent2: '#ff9a3d',
        accentDeep: '#e8481b',

        // Identité visuelle propre à chaque app métier (voir
        // retrogradeAppmetier.md dans le dépôt GdaHub) : le hub garde sa
        // charte "Virtus" sombre ci-dessus, ces palettes ne servent qu'aux
        // pages /jus, /rh, /chantiers, /planning une fois entré dans l'app.
        jus: {
          primary: '#eb6834',
          primaryDark: '#d03e0d',
          sidebar: '#fefcfb',
        },
        rh: {
          marque50: '#fff4f0',
          marque100: '#ffe6dc',
          marque500: '#ff6a3a',
          marque700: '#d03e0d',
          marque800: '#a63209',
        },
        chantiers: {
          creme: '#f4f1eb',
          terracotta: '#c8521a',
          marron: '#381419',
          vert: '#1a7a42',
          bleu: '#1a5c8a',
          rouge: '#c01a1a',
          sombre: '#1a1814',
        },
        planning: {
          o1: '#ff8a5c',
          o2: '#ff6a3a',
          o3: '#e8481b',
        },
        // Identité réelle de Campagnes (alias interne "BDM" / "GDA Money"),
        // reprise du dépôt de production `Hamadoun23/Bdm`
        // (frontend/tailwind.config.js : `gda.orange`) — pas de la copie
        // trouvée dans backend/campagnes-frontend/ de ce dépôt, qui s'est
        // avérée être une version déjà "uniformisée" vers la charte sombre
        // du hub, à l'opposé de l'app réelle (rail d'icônes clair, canevas
        // crème #F6F5F2). `primaryDark` sert aux textes/liens sur fond clair
        // (contraste AA) ; `primary` (la teinte de marque exacte, #FF6A3A)
        // sert aux boutons pleins et aux accents, comme dans l'app réelle.
        campagnes: {
          primary: '#ff6a3a',
          primaryDark: '#d03e0d',
        },
      },
      fontFamily: {
        sans: ['Manrope', 'system-ui', 'sans-serif'],
        display: ['Outfit', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
