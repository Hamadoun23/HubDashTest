import axios from 'axios';
window.axios = axios;

window.axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';

// Noms de cookie et d'en-tête CSRF côté Django. Par défaut, axios cherche le
// cookie `XSRF-TOKEN` et envoie `X-XSRF-TOKEN` — les noms de Laravel, d'où le
// fait que rien n'avait à être configuré du temps de Laravel. Django pose son
// propre cookie et attend `X-CSRFToken` : sans ces deux lignes, axios ne
// trouve pas le cookie, n'envoie aucun en-tête, et toute requête POST est
// rejetée en 403.
//
// **Le nom du cookie ne peut pas être écrit ici.** Servie seule sur
// bdm.gdamali.net, l'application pose « csrftoken ». Derrière la passerelle de
// GDA Hub, toutes les applications partagent une seule origine — donc un seul
// espace de cookies — et deux Django qui posent le même nom s'écraseraient
// mutuellement : Campagnes pose alors « campagnes_csrftoken ». Django est
// seul à savoir lequel des deux est en vigueur, et il le dépose dans la page.
//
// Le cookie est relu à chaque requête, et non capturé une fois au démarrage :
// Django fait tourner le jeton à la connexion, et une valeur figée serait
// périmée dès le premier POST suivant.
window.axios.defaults.xsrfCookieName = window.CampagnesCookieCsrf || 'csrftoken';
window.axios.defaults.xsrfHeaderName = 'X-CSRFToken';
