/**
 * French localization for Redactix Editor
 */
export default {
    // General
    chars: 'caract.',
    words: 'mots',
    
    // Modal buttons
    save: 'Enregistrer',
    cancel: 'Annuler',
    remove: 'Supprimer',
    close: 'Fermer',
    delete: 'Supprimer',
    
    // Toolbar tooltips
    toolbar: {
        insertImage: 'Insérer une image',
        insertTable: 'Insérer un tableau',
        insertYoutube: 'Insérer une vidéo YouTube',
        insertCode: 'Insérer un bloc de code',
        findReplace: 'Rechercher et remplacer (Ctrl+F)',
        fullscreen: 'Mode plein écran',
        editHtml: 'Modifier le HTML',
        bold: 'Gras',
        italic: 'Italique',
        underline: 'Souligné',
        strikethrough: 'Barré',
        highlight: 'Surligner',
        monospace: 'Monospace',
        spoiler: 'Spoiler',
        link: 'Lien'
    },
    
    // Image module
    image: {
        title: 'Insérer une image',
        editTitle: 'Modifier l\'image',
        url: 'URL de l\'image',
        alt: 'Texte alt',
        altDescription: 'Texte alt (description)',
        title_attr: 'Titre (info-bulle)',
        srcset: 'Srcset (optionnel)',
        srcsetPlaceholder: 'small.jpg 320w, large.jpg 800w',
        loading: 'Chargement',
        loadingDefault: 'Par défaut',
        loadingLazy: 'lazy (chargement différé)',
        loadingEager: 'eager (chargement immédiat)',
        caption: 'Légende',
        captionPlaceholder: 'HTML supporté',
        linkSection: 'Lien au clic sur l\'image',
        linkUrl: 'URL du lien (optionnel)',
        linkUrlPlaceholder: 'https://...',
        relExceptNofollow: 'Rel (sauf nofollow)',
        relPlaceholder: 'sponsored, ugc, ...',
        openNewWindow: 'Ouvrir dans un nouvel onglet',
        nofollow: 'nofollow',
        removeImage: 'Supprimer l\'image',
        uploadReplace: 'Remplacer l\'image : cliquer pour charger',
        uploadClick: 'Cliquer pour charger ou glisser-déposer',
        uploadFormats: 'JPG, PNG, GIF, WebP, AVIF, HEIC, SVG',
        uploading: 'Chargement...',
        uploadSuccess: 'Chargé avec succès',
        chooseFromUploaded: 'Choisir parmi les images chargées',
        orEnterUrl: 'ou entrer une URL',
        loadingImages: 'Chargement des images...',
        noImages: 'Aucune image chargée',
        imageSelected: 'Image sélectionnée',
        closeGallery: 'Fermer la galerie',
        deleteConfirm: 'Supprimer'
    },
    
    // Link module
    link: {
        title: 'Insérer un lien',
        editTitle: 'Modifier le lien',
        url: 'URL',
        linkText: 'Texte du lien',
        titleAttr: 'Titre (info-bulle)',
        openNewWindow: 'Ouvrir dans un nouvel onglet',
        nofollow: 'nofollow',
        removeLink: 'Supprimer le lien',
        relExceptNofollow: 'Rel (sauf nofollow)',
        relPlaceholder: 'sponsored, ugc, ...'
    },
    
    // Table module
    table: {
        title: 'Insérer un tableau',
        rows: 'Lignes',
        columns: 'Colonnes',
        firstRowHeader: 'Première ligne en en-tête',
        insertColumnLeft: 'Insérer une colonne à gauche',
        insertColumnRight: 'Insérer une colonne à droite',
        insertRowAbove: 'Insérer une ligne au-dessus',
        insertRowBelow: 'Insérer une ligne en dessous',
        makeRegular: 'Rendre normal (TD)',
        makeHeader: 'Rendre en-tête (TH)',
        makeRowHeader: 'Rendre la ligne en en-tête',
        cellAttributes: 'Attributs de la cellule',
        rowAttributes: 'Attributs de la ligne',
        deleteColumn: 'Supprimer la colonne',
        deleteRow: 'Supprimer la ligne',
        deleteTable: 'Supprimer le tableau',
        headerPrefix: 'En-tête'
    },
    
    // YouTube module
    youtube: {
        title: 'YouTube',
        videoLink: 'Lien vidéo YouTube',
        invalidUrl: 'URL YouTube invalide'
    },
    
    // Code module
    code: {
        title: 'Insérer un bloc de code',
        editTitle: 'Modifier le bloc de code',
        language: 'Langage de programmation',
        languageNone: 'Aucun',
        codePlaceholder: 'Collez votre code ici...',
        removeCodeBlock: 'Supprimer le bloc de code'
    },
    
    // Find & Replace module
    findReplace: {
        findPlaceholder: 'Rechercher...',
        replacePlaceholder: 'Remplacer par...',
        replace: 'Remplacer',
        replaceAll: 'Tout',
        noResults: 'Aucun résultat',
        ofCount: 'sur',
        previousTooltip: 'Précédent (Shift+Entrée)',
        nextTooltip: 'Suivant (Entrée)',
        closeTooltip: 'Fermer (Échap)'
    },
    
    // Block Control module
    blockControl: {
        transformTo: 'Transformer en',
        paragraph: 'Paragraphe',
        heading1: 'Titre 1',
        heading2: 'Titre 2',
        heading3: 'Titre 3',
        quote: 'Citation',
        callout: 'Encadré',
        calloutStyle: 'Style d\'encadré',
        quoteStyle: 'Style de citation',
        noStyle: 'Sans style',
        warning: 'Avertissement',
        danger: 'Danger',
        information: 'Information',
        success: 'Succès',
        standard: 'Standard',
        big: 'Grand',
        listType: 'Type de liste',
        bulleted: 'À puces',
        numbered: 'Numérotée',
        actions: 'Actions',
        insertBlockBelow: 'Insérer un bloc en dessous',
        duplicate: 'Dupliquer',
        attributes: 'Attributs',
        cellSettings: 'Paramètres de la cellule',
        rowSettings: 'Paramètres de la ligne',
        dragEntireList: 'Faire glisser toute la liste'
    },
    
    // Attributes module
    attributes: {
        title: 'Attributs de l\'élément',
        editing: 'Modification',
        idAnchor: 'ID (Ancre)',
        idPlaceholder: 'exemple-ancre',
        linkPrefix: 'Lien',
        classes: 'Classes (séparées par des espaces)',
        quickSelect: 'Sélection rapide'
    },
    
    // Slash Commands
    slashCommands: {
        noCommands: 'Aucune commande trouvée',
        heading1: 'Titre 1',
        heading1Desc: 'Grand titre de section',
        heading2: 'Titre 2',
        heading2Desc: 'Moyen titre de section',
        heading3: 'Titre 3',
        heading3Desc: 'Petit titre de section',
        quote: 'Citation',
        quoteDesc: 'Bloc de citation',
        callout: 'Encadré',
        calloutDesc: 'Bloc d\'information mis en évidence',
        codeBlock: 'Bloc de code',
        codeBlockDesc: 'Code avec coloration syntaxique',
        image: 'Image',
        imageDesc: 'Insérer une image',
        youtube: 'YouTube',
        youtubeDesc: 'Intégrer une vidéo',
        table: 'Tableau',
        tableDesc: 'Insérer un tableau',
        divider: 'Séparateur',
        dividerDesc: 'Ligne de séparation horizontale',
        numberedList: 'Liste numérotée',
        numberedListDesc: 'Liste avec numéros',
        bulletList: 'Liste à puces',
        bulletListDesc: 'Liste avec puces'
    },
    
    // Upload errors
    upload: {
        error: 'Échec du chargement',
        connectionError: 'Erreur de connexion',
        serverError: 'Erreur serveur',
        invalidResponse: 'Réponse serveur invalide',
        remove: 'Supprimer'
    },
    
    // Counter
    counter: {
        chars: 'caract.',
        words: 'mots'
    }
};
