// Régénère src/styles/gda-daily.css depuis le CSS d'origine de daily.gdamali.net :
//   node scripts/scope-gda-css.cjs
// Chaque sélecteur est limité à `.gda-daily` (la coquille Chantiers). Les règles
// sur éléments nus (reset `*`, input, select, textarea) ne visent que `.gda-legacy`
// — les zones reprises de Laravel — pour ne pas écraser les utilitaires Tailwind
// des pages Chantiers pas encore portées.
const fs = require('fs');
const path = require('path');
const postcss = require('postcss');

const racine = path.resolve(__dirname, '..');
const source = path.join(racine, 'DailyGda-main/public/css/gda.css');
const cible = path.join(racine, 'src/styles/gda-daily.css');
const SCOPE = '.gda-daily';
const LEGACY = '.gda-legacy';

const arbre = postcss.parse(fs.readFileSync(source, 'utf8'));
arbre.walkRules((regle) => {
  if (regle.parent && regle.parent.type === 'atrule' && /keyframes$/.test(regle.parent.name)) return;
  regle.selectors = regle.selectors.flatMap((selecteur) => {
    const s = selecteur.trim();
    if (s === ':root' || s === 'html' || s === 'body') return [SCOPE];
    if (/^(html|body)(?=[.:[\s])/.test(s)) return [s.replace(/^(html|body)/, SCOPE)];
    if (s.startsWith('*')) return [`${LEGACY} ${s}`, `${LEGACY}${s.slice(1)}`];
    if (/^(input|select|textarea)\b/.test(s)) return [`${LEGACY} ${s}`];
    return [`${SCOPE} ${s}`];
  });
});

fs.writeFileSync(
  cible,
  '/* Généré par scripts/scope-gda-css.cjs depuis DailyGda-main/public/css/gda.css — ne pas éditer à la main. */\n' + arbre.toString(),
);
console.log(`écrit : ${path.relative(racine, cible)}`);
