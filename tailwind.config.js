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
      },
      fontFamily: {
        sans: ['Manrope', 'system-ui', 'sans-serif'],
        display: ['Outfit', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
