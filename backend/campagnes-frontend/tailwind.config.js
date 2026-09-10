import defaultTheme from 'tailwindcss/defaultTheme';
import forms from '@tailwindcss/forms';

/** @type {import('tailwindcss').Config} */
export default {
    content: [
        './src/**/*.{js,jsx}',
        // Gabarit racine servi par Django (ex-app.blade.php).
        '../backend/templates/**/*.html',
    ],

    theme: {
        extend: {
            fontFamily: {
                // Inter (auto-hébergée via @fontsource) pour une UI plus nette. Futura reste
                // réservée à la marque (logo/wordmark) via `font-brand`.
                sans: [
                    'Inter',
                    '-apple-system',
                    'BlinkMacSystemFont',
                    '"Segoe UI"',
                    'Roboto',
                    '"Helvetica Neue"',
                    'Arial',
                    ...defaultTheme.fontFamily.sans,
                ],
                brand: [
                    'Futura',
                    '"Futura PT"',
                    '"Futura Std"',
                    '"Century Gothic"',
                    '"Trebuchet MS"',
                    ...defaultTheme.fontFamily.sans,
                ],
            },
            colors: {
                gda: {
                    brun: '#381419',
                    gris: '#303030',
                    cuivre: '#b26440',
                    orange: '#FF6A3A',
                    blanc: '#ffffff',
                },
                // Les memes echelles que le reste du hub (RH, Jus d'orange,
                // Chantiers, Planning) : Campagnes utilisait jusqu'ici
                // l'orange seul (`gda.orange`, deja identique a `marque-500`)
                // et le gris Tailwind par defaut pour tout le reste. Refondre
                // l'UI sans ces deux echelles aurait voulu dire choisir de
                // nouvelles teintes de gris au hasard — recopier celles du
                // hub garantit que « en harmonie » ne reste pas approximatif.
                marque: {
                    50: '#fff4f0',
                    100: '#ffe6dc',
                    200: '#ffc9b4',
                    300: '#ffa98b',
                    400: '#ff8a62',
                    500: '#ff6a3a',
                    600: '#ea4e17',
                    700: '#d03e0d',
                    800: '#a63209',
                    900: '#7e270a',
                },
                ardoise: {
                    50: '#f7f7f8',
                    100: '#efeff0',
                    200: '#dededf',
                    300: '#c4c5c6',
                    400: '#9b9c9d',
                    500: '#6f7071',
                    600: '#5c5d5e',
                    700: '#4a4b4c',
                    800: '#3a3b3c',
                    900: '#2c2d2e',
                    950: '#1c1d1e',
                },
            },
            boxShadow: {
                card: '0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 3px 0 rgb(0 0 0 / 0.04)',
            },
        },
    },

    plugins: [forms],
};
