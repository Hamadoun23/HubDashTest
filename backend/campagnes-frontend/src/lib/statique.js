/**
 * L'adresse d'un fichier statique — logo, image, police.
 *
 * Le prefixe ne peut pas etre ecrit ici : il depend de la ou l'application
 * est servie. A la racine sur bdm.gdamali.net c'est « /static/ » ; derriere
 * la passerelle de GDA Hub c'est « /campagnes/static/ ». Django connait la
 * reponse (STATIC_URL) et la depose dans la page ; ce module la relit.
 *
 * Les chemins ecrits en dur — src="/logo/gdamoney-mark.png" — sortaient du
 * perimetre de l'application : le navigateur demandait le logo au hub, qui
 * repondait sa page 404 en HTML, et l'image restait cassee.
 */
const PREFIXE_PAR_DEFAUT = '/static/';

export function statique(chemin) {
    const base = (typeof window !== 'undefined' && window.CampagnesStatique) || PREFIXE_PAR_DEFAUT;
    return base.replace(/\/$/, '') + '/' + String(chemin).replace(/^\//, '');
}
