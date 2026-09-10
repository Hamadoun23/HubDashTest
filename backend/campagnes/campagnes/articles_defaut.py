r"""
Articles de contrat créés par défaut à l'ouverture d'une campagne.

Ce sont des clauses contractuelles signées par les commerciaux : leur
formulation est reprise mot pour mot des documents de référence et ne doit pas
être reformulée.

Chaque client de GDA a son propre contrat — les engagements ne sont pas les
mêmes, ni le donneur d'ordre. Le partenaire porte donc le nom d'un **modèle**
(`partenaires.contrat_modele`), et c'est lui qui décide du jeu d'articles :

- `gda_bdm` — repris de App\Models\CampagneContratArticle (Laravel).
- `gda_uba` — docs/UBA/Contrat_prestation_services_commerciaux_GDA_UBA_*.docx.

Les montants et les dates ne sont pas figés dans le texte : ils portent des
marqueurs (`{date_debut}`, `{emolument_forfait}`…) remplis à la création des
articles depuis les champs de la campagne. Un contrat qui annoncerait une date
que l'application contredit ne vaudrait rien.
"""

ARTICLES_VENTE_CARTE = [
    {
        "titre": "Article 1 : Objet du contrat",
        "contenu": "Le présent contrat a pour objet de définir les conditions dans lesquelles la Prestataire s’engage à assurer, pour le compte de GDA, la commercialisation des cartes bancaires BDM SA dans le cadre d’une campagne pilotée par GDA en partenariat avec la Banque de Développement du Mali (BDM SA).",
    },
    {
        "titre": "Article 2 : Durée de la mission",
        "contenu": "La mission du Prestataire est conclue pour une durée déterminée correspondant à la période de la campagne telle qu’enregistrée dans l’application (dates de début et de fin), sauf résiliation anticipée dans les conditions prévues au présent contrat.",
    },
    {
        "titre": "Article 3 : Conditions d’exécution",
        "contenu": "La Prestataire s’engage notamment à :\n\n- Participer activement à la campagne de commercialisation des cartes BDM SA ;\n- Atteindre les objectifs de vente qui lui seront fixés en début de mission ;\n- Être disponible pendant les heures d’ouverture de la banque dans sa zone d’affectation ;\n- Transmettre chaque lundi au plus tard à 12h un rapport hebdomadaire d’activité ;\n- Intégrer et rester actif(ve) dans le groupe WhatsApp de coordination mis en place par GDA ;\n- Respecter l’éthique commerciale, l’image de marque de GDA et les consignes de la BDM SA.",
    },
    {
        "titre": "Article 5 : Matériel fourni",
        "contenu": "Un forfait téléphonique hebdomadaire peut être financé par GDA, pour permettre la transmission des rapports et la coordination des actions, selon les versements enregistrés dans l’application.\n\nLa Prestataire recevra de la BDM SA, pour les besoins de la campagne : un tee-shirt et une casquette de campagne, un argumentaire commercial et les outils nécessaires à la prospection.",
    },
    {
        "titre": "Article 6 : Statut du prestataire",
        "contenu": "La Prestataire intervient en toute indépendance, en tant que prestataire de services non salarié. Il n’existe entre les parties aucun lien de subordination, ni de relation de travail salarié.",
    },
    {
        "titre": "Article 7 : Résiliation",
        "contenu": "Le présent contrat pourra être résilié de plein droit par GDA, sans indemnité, en cas de : non-respect des obligations contractuelles ; résultats commerciaux manifestement insuffisants sans justification ; attitude contraire à l’éthique ou aux règles de la campagne. En cas de résiliation anticipée pour faute du Prestataire, aucun paiement ne sera exigible.",
    },
    {
        "titre": "Article 8 : Confidentialité",
        "contenu": "La Prestataire s’engage à garder confidentielles toutes les informations commerciales, stratégiques ou personnelles auxquelles il pourrait avoir accès dans le cadre de sa mission.",
    },
    {
        "titre": "Article 9 : Engagement de présence et reporting",
        "contenu": "La Prestataire s’engage à respecter les horaires de présence définis, à tenir un discours conforme aux éléments fournis, et à remonter toute difficulté rencontrée à GDA dans les plus brefs délais.",
    },
]

ARTICLES_ENROLEMENT_APP = [
    {
        "titre": "Article 1 : Objet du contrat",
        "contenu": "Le présent contrat a pour objet de définir les conditions dans lesquelles la Prestataire s’engage à assurer, pour le compte de GDA, l’enrôlement des clients de la BDM SA sur leur application mobile, dans le cadre d’une campagne pilotée par GDA en partenariat avec la Banque de Développement du Mali (BDM SA).",
    },
    {
        "titre": "Article 2 : Durée de la mission",
        "contenu": "La mission du Prestataire est conclue pour une durée déterminée correspondant à la période de la campagne telle qu’enregistrée dans l’application (dates de début et de fin), sauf résiliation anticipée dans les conditions prévues au présent contrat.",
    },
    {
        "titre": "Article 3 : Conditions d’exécution",
        "contenu": "La Prestataire s’engage notamment à :\n\n- Participer activement à la campagne d’enrôlement des clients BDM SA sur l’application mobile ;\n- Atteindre les objectifs d’enrôlement qui lui seront fixés en début de mission ;\n- Être disponible pendant les heures d’ouverture de la banque dans sa zone d’affectation ;\n- Transmettre chaque lundi au plus tard à 12h un rapport hebdomadaire d’activité ;\n- Intégrer et rester actif(ve) dans le groupe WhatsApp de coordination mis en place par GDA ;\n- Respecter l’éthique commerciale, l’image de marque de GDA et les consignes de la BDM SA.",
    },
    {
        "titre": "Article 5 : Matériel fourni",
        "contenu": "Un forfait téléphonique hebdomadaire peut être financé par GDA, pour permettre la transmission des rapports et la coordination des actions, selon les versements enregistrés dans l’application.\n\nLa Prestataire recevra de la BDM SA, pour les besoins de la campagne : un tee-shirt et une casquette de campagne, un argumentaire de présentation de l’application et les outils nécessaires à l’enrôlement des clients.",
    },
    {
        "titre": "Article 6 : Statut du prestataire",
        "contenu": "La Prestataire intervient en toute indépendance, en tant que prestataire de services non salarié. Il n’existe entre les parties aucun lien de subordination, ni de relation de travail salarié.",
    },
    {
        "titre": "Article 7 : Résiliation",
        "contenu": "Le présent contrat pourra être résilié de plein droit par GDA, sans indemnité, en cas de : non-respect des obligations contractuelles ; résultats d’enrôlement manifestement insuffisants sans justification ; attitude contraire à l’éthique ou aux règles de la campagne. En cas de résiliation anticipée pour faute du Prestataire, aucun paiement ne sera exigible.",
    },
    {
        "titre": "Article 8 : Confidentialité",
        "contenu": "La Prestataire s’engage à garder confidentielles toutes les informations commerciales, stratégiques ou personnelles (notamment les données des clients enrôlés) auxquelles il pourrait avoir accès dans le cadre de sa mission.",
    },
    {
        "titre": "Article 9 : Engagement de présence et reporting",
        "contenu": "La Prestataire s’engage à respecter les horaires de présence définis, à tenir un discours conforme aux éléments fournis, et à remonter toute difficulté rencontrée à GDA dans les plus brefs délais.",
    },
]



ARTICLES_UBA_VENTE_CARTE = [
    {
        "titre": 'Article 1 : Objet du contrat',
        "contenu": 'Le présent contrat a pour objet de définir les conditions dans lesquelles le/la Prestataire s’engage à assurer, pour le compte de GDA, des prestations de commercialisation et de distribution des cartes prépayées GDA/UBA dans le cadre de la campagne commerciale mise en œuvre par GDA.\n\nLe/la Prestataire participe notamment à la prospection, à la présentation de l’offre, à la commercialisation, à la distribution des cartes et à la remontée des informations et résultats de terrain conformément aux objectifs et consignes communiqués par GDA.',
    },
    {
        "titre": 'Article 2 : Durée de la mission et période d’évaluation',
        "contenu": 'Le présent contrat est conclu pour une durée déterminée d’un (1) mois, prenant effet le {date_debut} et arrivant à échéance le {date_fin}.\n\nUne période d’essai et d’évaluation de deux (2) mois est prévue à compter du début de la collaboration. Cette période d’évaluation a pour objet d’apprécier les performances commerciales, l’assiduité, le respect des consignes, la qualité du reporting et l’implication du/de la Prestataire.\n\nÀ l’issue de cette période d’évaluation, si les performances attendues ne sont pas atteintes ou si la collaboration ne donne pas satisfaction, GDA pourra mettre fin à la collaboration dans les conditions prévues au présent contrat.\n\nCompte tenu de la durée initiale d’un (1) mois indiquée ci-dessus, toute poursuite de la collaboration au-delà du {date_fin} devra faire l’objet d’une prolongation ou d’un nouveau document contractuel convenu entre les parties.',
    },
    {
        "titre": 'Article 3 : Conditions d’exécution de la prestation',
        "contenu": 'Le/la Prestataire s’engage à :\n\n• Participer activement à la campagne de commercialisation et de distribution des cartes prépayées GDA/UBA ;\n\n• Prospecter les clients, présenter les caractéristiques et avantages de l’offre et assurer la distribution des cartes conformément à l’argumentaire fourni ;\n\n• Atteindre les objectifs commerciaux qui lui seront fixés par GDA et suivre les orientations de la coordination commerciale ;\n\n• Être présent(e) et disponible sur les zones de prospection et points d’affectation qui lui seront communiqués ;\n\n• Transmettre régulièrement ses résultats et rapports d’activité selon le format et la fréquence définis par GDA, notamment les ventes réalisées, les références des cartes distribuées et toute information utile au suivi de la campagne ;\n\n• Intégrer et rester actif(ve) dans le groupe WhatsApp ou tout autre canal de coordination mis en place par GDA ;\n\n• Signaler sans délai toute difficulté rencontrée sur le terrain, notamment les problèmes de stock, de paiement, de distribution ou les réclamations clients ;\n\n• Respecter l’éthique commerciale, l’image de marque de GDA/UBA, les règles de conduite et toutes les consignes relatives à la campagne.',
    },
    {
        "titre": 'Article 4 : Rémunération et émoluments',
        "contenu": 'En contrepartie des prestations effectivement réalisées, le/la Prestataire percevra une rémunération fixe mensuelle de {emolument_forfait} FCFA.\n\nÀ cette rémunération s’ajoutent les émoluments suivants, destinés à faciliter l’exécution de la mission :\n\n• Forfait de crédit téléphonique : {forfait_communication} FCFA ;\n\n• Prime de carburant : {forfait_carburant} FCFA.\n\nCes émoluments sont accordés pour les besoins de la campagne et ne constituent pas une rémunération fixe supplémentaire.\n\nLe règlement de la rémunération et des émoluments interviendra selon les modalités administratives définies par GDA, sous réserve de la réalisation effective des prestations et du respect des obligations de reporting.',
    },
    {
        "titre": 'Article 5 : Matériel et moyens fournis',
        "contenu": 'Pour permettre au/à la Prestataire d’assurer correctement sa mission, GDA met à sa disposition, pour les besoins de la campagne :\n\n• Un forfait de crédit téléphonique financé par GDA, destiné notamment à permettre la transmission des rapports, la communication avec les clients et la coordination des actions commerciales ;\n\n• Un t-shirt de campagne destiné à identifier le/la Prestataire sur le terrain ;\n\n• Un argumentaire commercial de vente destiné à encadrer la présentation des cartes prépayées GDA/UBA ;\n\n• Tout autre support commercial ou outil de prospection que GDA pourra mettre à disposition selon les besoins de la campagne.\n\nLe matériel et les supports fournis restent destinés exclusivement à l’exécution de la mission et doivent être utilisés conformément aux instructions de GDA.',
    },
    {
        "titre": 'Article 6 : Statut du/de la Prestataire',
        "contenu": 'Le/la Prestataire intervient en qualité de prestataire de services et non en qualité de salarié(e) de GDA. Le présent contrat ne crée, entre les parties, aucun contrat de travail ni aucun lien de subordination juridique permanent.\n\nLe/la Prestataire demeure tenu(e) de respecter les objectifs, procédures, règles de conduite, consignes commerciales et modalités de reporting nécessaires à la bonne exécution de la campagne.',
    },
    {
        "titre": 'Article 7 : Résiliation et fin de collaboration',
        "contenu": 'Le présent contrat pourra prendre fin à son échéance ou être résilié avant terme par GDA en cas de :\n\n• Non-respect des obligations contractuelles ;\n\n• Absence, abandon de poste ou indisponibilité répétée compromettant la mission ;\n\n• Résultats commerciaux manifestement insuffisants au regard des objectifs fixés, sans justification valable ;\n\n• Défaut répété de reporting ou transmission d’informations inexactes ;\n\n• Attitude contraire à l’éthique commerciale, aux règles de la campagne ou à l’image de GDA/UBA ;\n\n• Toute faute grave ou comportement portant préjudice à GDA, à UBA ou à la campagne.\n\nÀ l’issue de la période d’évaluation de deux (2) mois, l’absence de performance suffisante pourra entraîner la fin de la collaboration. En cas de résiliation pour faute du/de la Prestataire, les sommes correspondant aux prestations effectivement réalisées et validées restent dues, sous réserve des éventuelles sommes légalement ou contractuellement retenues.',
    },
    {
        "titre": 'Article 8 : Confidentialité',
        "contenu": 'Le/la Prestataire s’engage à garder strictement confidentielles toutes les informations commerciales, stratégiques, financières, opérationnelles ou relatives aux clients auxquelles il/elle pourrait avoir accès dans le cadre de sa mission.\n\nIl/elle s’interdit de communiquer ou d’utiliser ces informations à des fins étrangères à la mission confiée par GDA.',
    },
    {
        "titre": 'Article 9 : Engagement de présence et reporting',
        "contenu": 'Le/la Prestataire s’engage à respecter les modalités de présence et de prospection définies par GDA, à utiliser l’argumentaire commercial fourni, à assurer une remontée régulière et fiable des résultats et à signaler rapidement toute difficulté pouvant affecter la campagne.\n\nLe reporting constitue un élément essentiel de l’évaluation de la prestation et de la performance commerciale.',
    },
    {
        "titre": 'Article 10 : Dispositions finales',
        "contenu": 'Le présent contrat constitue l’accord entre les parties concernant la mission décrite ci-dessus. Toute modification substantielle de ses conditions devra être formalisée par écrit et acceptée par les parties.\n\nLe/la Prestataire reconnaît avoir pris connaissance des conditions du présent contrat et s’engage à les respecter.',
    },
]


#: Marqueurs remplaçables dans le texte des articles, et le champ de campagne
#: dont chacun tire sa valeur. Les montants passent par `nombre_format` pour
#: s'écrire comme dans le reste de l'application (« 50 000 »).
MARQUEURS = {
    "{date_debut}": ("date_debut", "date"),
    "{date_fin}": ("date_fin", "date"),
    "{emolument_forfait}": ("contrat_emolument_forfait", "montant"),
    "{forfait_communication}": ("contrat_forfait_communication", "montant"),
    "{forfait_carburant}": ("aide_hebdo_carburant", "montant"),
    "{forfait_deplacement}": ("contrat_forfait_deplacement", "montant"),
}

MODELE_PAR_DEFAUT = "gda_bdm"

#: D'où vient la date du « Fait à …, le … » qui clôt le contrat.
#: `aujourdhui` — le jour où le commercial accepte, comportement historique BDM.
#: `debut_campagne` — la date de prise d'effet inscrite au contrat, comme le
#: prévoit le document UBA.
DATE_SIGNATURE_AUJOURDHUI = "aujourdhui"
DATE_SIGNATURE_DEBUT_CAMPAGNE = "debut_campagne"

#: Un modèle décrit un contrat complet : ses articles selon le type de
#: campagne, et si la rémunération y figure déjà.
#:
#: `remuneration_dans_articles` évite un doublon à l'affichage : le contrat BDM
#: laisse les montants à un bloc calculé depuis les champs de la campagne,
#: tandis que le contrat UBA les énonce dans son article 4. Rendre les deux
#: ferait dire deux fois la même chose, avec le risque de se contredire.
MODELES = {
    "gda_bdm": {
        "libelle": "Contrat GDA — BDM",
        "vente_carte": ARTICLES_VENTE_CARTE,
        "enrolement_app": ARTICLES_ENROLEMENT_APP,
        "remuneration_dans_articles": False,
        "date_signature": DATE_SIGNATURE_AUJOURDHUI,
    },
    "gda_uba": {
        "libelle": "Contrat GDA — UBA",
        "vente_carte": ARTICLES_UBA_VENTE_CARTE,
        # UBA ne mène pas de campagne d'enrôlement ; si cela arrivait, le
        # contrat de vente s'appliquerait faute de texte dédié.
        "enrolement_app": ARTICLES_UBA_VENTE_CARTE,
        "remuneration_dans_articles": True,
        "date_signature": DATE_SIGNATURE_DEBUT_CAMPAGNE,
    },
}


def modele(nom):
    """Modèle de contrat, avec repli sur celui de la BDM si le nom est inconnu."""
    return MODELES.get(nom or MODELE_PAR_DEFAUT, MODELES[MODELE_PAR_DEFAUT])


def remuneration_dans_articles(nom) -> bool:
    return bool(modele(nom)["remuneration_dans_articles"])


def date_signature(nom, campagne):
    """Date à faire figurer au pied du contrat, selon le modèle."""
    from datetime import date as _date

    if modele(nom)["date_signature"] == DATE_SIGNATURE_DEBUT_CAMPAGNE:
        return campagne.date_debut
    return _date.today()


def articles_par_defaut(type_campagne, nom_modele=None):
    """Jeu d'articles correspondant au modèle de contrat et au type de campagne."""
    cle = "enrolement_app" if type_campagne == "enrolement_app" else "vente_carte"
    return modele(nom_modele)[cle]
