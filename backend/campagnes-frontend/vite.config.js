import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Le build produit frontend/dist ; Django lit le manifeste `.vite/manifest.json`
// pour retrouver les fichiers hachés (cf. backend/core/templatetags/vite.py).
// En développement, Django pointe directement vers ce serveur (port 5173).
export default defineConfig(({ command }) => ({
    // En production, Django sert les assets compilés sous /static/. Sans cette
    // base, Vite écrit des URL absolues en /assets/... dans le CSS et dans les
    // imports dynamiques des pages : polices et chunks partent en 404.
    // En développement, Vite sert depuis la racine de son propre serveur.
    // En production a la racine, Django sert les assets sous /static/. Servie
    // sous un chemin — /campagnes/ dans GDA Hub — c'est ce prefixe qu'il faut
    // graver ici : Vite y ecrit les imports dynamiques du bundle, et lui seul
    // sait ou les morceaux iront les chercher. Sans cela ils partent vers
    // /static/assets/..., qui appartient a un autre service, et la page reste
    // bloquee sur « Chargement de votre espace... ».
    base: command === 'build' ? (process.env.VITE_BASE || '/static/') : '/',
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src'),
        },
    },
    plugins: [react()],
    build: {
        manifest: true,
        outDir: 'dist',
        emptyOutDir: true,
        rollupOptions: {
            input: 'src/app.jsx',
        },
    },
    server: {
        port: 5173,
        strictPort: true,
        // Django sert les pages ; seuls les assets viennent d'ici.
        origin: 'http://localhost:5173',
        cors: true,
    },
}));
