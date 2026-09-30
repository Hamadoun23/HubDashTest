// Le préambule et le pied de contrat, communs à tous les clients de GDA.
// Transcription fidèle de resources/views/contrats/prestation.blade.php et
// prestation_emoluments_annexes.blade.php — ne pas reformuler le texte
// juridique, seulement la présentation.
//
// Le corps du contrat, lui, vient des articles de la campagne : ils sont
// propres au client (cf. backend/campagnes/articles_defaut.py).
export default function ContratDocument({ d }) {
    return (
        <div className="space-y-4 text-sm leading-relaxed text-gray-800">
            <p className="text-center text-base font-bold uppercase">Contrat de prestation de services commerciaux</p>

            <p><strong>Entre les soussignés :</strong></p>
            <p>
                Le Groupe GDA,<br />
                Société spécialisée en prestations commerciales et marketing opérationnel,<br />
                Représentée par {d.representant_nom}, dûment habilité(e) à l'effet des présentes,<br />
                Ci-après dénommée « <strong>GDA</strong> »,
            </p>
            <p>
                <strong>Et :</strong><br />
                <strong>{d.nom_presta}</strong><br />
                Demeurant à : {d.adresse}<br />
                Contact : {d.contact_presta}<br />
                Pièce d'identité : {d.piece_id}<br />
                Ci-après dénommé(e) « <strong>la Prestataire</strong> »,
            </p>
            <p className="pt-2 font-bold">IL A ÉTÉ CONVENU ET ARRÊTÉ CE QUI SUIT :</p>

            <p className="border-l-2 border-gray-300 pl-3 text-xs text-gray-500">
                Période indicative : du {d.lundi_effectif} au {d.date_fin} — campagne « {d.nom_campagne} »
                {d.client_nom ? ` pour le compte de ${d.client_nom}` : ''}.
            </p>

            {d.articles.length === 0 ? (
                <p className="italic text-gray-500">Aucun article de contrat n'a encore été défini par l'administration pour cette campagne.</p>
            ) : (
                d.articles.map((a, i) => (
                    <div key={i}>
                        <p className="mb-1 font-semibold">{a.titre}</p>
                        <p className="whitespace-pre-line">{a.contenu}</p>
                    </div>
                ))
            )}

            {/* Certains contrats — celui d'UBA — énoncent déjà la rémunération dans
                leurs propres articles : ce bloc ferait alors doublon. */}
            {!d.remuneration_dans_articles && (
                <>
                    <p className="pt-2 font-semibold">Rémunération, forfaits et aides</p>
                    <p>
                        En contrepartie des prestations fournies, la Prestataire percevra de GDA un émolument forfaitaire de{' '}
                        <strong>{d.emolument_forfait} FCFA</strong> TTC pour la durée totale de la mission.
                    </p>
                    <ul className="ml-4 list-none space-y-1">
                        <li>— Forfait communication : <strong>{d.forfait_communication} FCFA</strong></li>
                        <li>— Forfait déplacement : <strong>{d.forfait_deplacement} FCFA</strong></li>
                        <li>— Une prime de performance hebdomadaire de <strong>{d.prime_meilleur_vendeur} FCFA</strong> sera attribuée au meilleur vendeur de la semaine, sur la base des rapports et résultats transmis.</li>
                    </ul>
                    {d.aide_hebdo_active && (
                        <p>
                            Outre ce forfait, une aide hebdomadaire de <strong>{d.aide_hebdo_montant} FCFA</strong> par semaine
                            de campagne est prévue (dont carburant {d.aide_hebdo_carburant} FCFA et crédit téléphonique{' '}
                            {d.aide_hebdo_credit_tel} FCFA), sous réserve des versements effectifs et de leur accusé de
                            réception par la Prestataire.
                        </p>
                    )}
                    <p>Le paiement interviendra en une seule fois à la fin de la campagne, après validation du rapport final et contrôle des résultats (sauf disposition contraire de GDA).</p>
                </>
            )}

            {d.clause_libre && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <strong>Dispositions complémentaires :</strong>
                    <p className="mt-2 whitespace-pre-line">{d.clause_libre}</p>
                </div>
            )}

            <p className="pt-2">
                Fait à {d.lieu_signature}, le {d.date_signature_affichee}<br />
                En deux exemplaires originaux, dont un remis à chaque partie.
            </p>

            <div className="mt-6 grid gap-4 border-t border-gray-200 pt-4 sm:grid-cols-2">
                <div>
                    <p className="font-semibold">La Prestataire</p>
                    <p>{d.nom_presta}</p>
                </div>
                <div className="sm:text-right">
                    <p className="font-semibold">Le Représentant de GDA</p>
                    <p>{d.representant_nom}</p>
                </div>
            </div>
        </div>
    );
}
