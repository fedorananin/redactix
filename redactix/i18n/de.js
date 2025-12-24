/**
 * German localization for Redactix Editor
 */
export default {
    // General
    chars: 'Zeichen',
    words: 'Wörter',
    
    // Modal buttons
    save: 'Speichern',
    cancel: 'Abbrechen',
    remove: 'Entfernen',
    close: 'Schließen',
    delete: 'Löschen',
    
    // Toolbar tooltips
    toolbar: {
        insertImage: 'Bild einfügen',
        insertTable: 'Tabelle einfügen',
        insertYoutube: 'YouTube-Video einfügen',
        insertCode: 'Codeblock einfügen',
        findReplace: 'Suchen und Ersetzen (Strg+F)',
        fullscreen: 'Vollbildmodus',
        editHtml: 'HTML bearbeiten',
        bold: 'Fett',
        italic: 'Kursiv',
        underline: 'Unterstrichen',
        strikethrough: 'Durchgestrichen',
        highlight: 'Hervorheben',
        monospace: 'Monospace',
        spoiler: 'Spoiler',
        link: 'Link'
    },
    
    // Image module
    image: {
        title: 'Bild einfügen',
        editTitle: 'Bild bearbeiten',
        url: 'Bild-URL',
        alt: 'Alt-Text',
        altDescription: 'Alt-Text (Beschreibung)',
        title_attr: 'Titel (Tooltip)',
        srcset: 'Srcset (optional)',
        srcsetPlaceholder: 'small.jpg 320w, large.jpg 800w',
        loading: 'Laden',
        loadingDefault: 'Standard',
        loadingLazy: 'lazy (verzögertes Laden)',
        loadingEager: 'eager (sofortiges Laden)',
        caption: 'Bildunterschrift',
        captionPlaceholder: 'HTML unterstützt',
        linkSection: 'Link beim Klick auf das Bild',
        linkUrl: 'Link-URL (optional)',
        linkUrlPlaceholder: 'https://...',
        relExceptNofollow: 'Rel (außer nofollow)',
        relPlaceholder: 'sponsored, ugc, ...',
        openNewWindow: 'In neuem Fenster öffnen',
        nofollow: 'nofollow',
        removeImage: 'Bild entfernen',
        uploadReplace: 'Bild ersetzen: Klicken zum Hochladen',
        uploadClick: 'Klicken zum Hochladen oder Drag & Drop',
        uploadFormats: 'JPG, PNG, GIF, WebP, AVIF, HEIC, SVG',
        uploading: 'Wird hochgeladen...',
        uploadSuccess: 'Erfolgreich hochgeladen',
        chooseFromUploaded: 'Aus hochgeladenen Bildern wählen',
        orEnterUrl: 'oder URL eingeben',
        loadingImages: 'Bilder werden geladen...',
        noImages: 'Noch keine Bilder hochgeladen',
        imageSelected: 'Bild ausgewählt',
        closeGallery: 'Galerie schließen',
        deleteConfirm: 'Löschen'
    },
    
    // Link module
    link: {
        title: 'Link einfügen',
        editTitle: 'Link bearbeiten',
        url: 'URL',
        linkText: 'Linktext',
        titleAttr: 'Titel (Tooltip)',
        openNewWindow: 'In neuem Fenster öffnen',
        nofollow: 'nofollow',
        removeLink: 'Link entfernen',
        relExceptNofollow: 'Rel (außer nofollow)',
        relPlaceholder: 'sponsored, ugc, ...'
    },
    
    // Table module
    table: {
        title: 'Tabelle einfügen',
        rows: 'Zeilen',
        columns: 'Spalten',
        firstRowHeader: 'Erste Zeile als Kopfzeile',
        insertColumnLeft: 'Spalte links einfügen',
        insertColumnRight: 'Spalte rechts einfügen',
        insertRowAbove: 'Zeile oberhalb einfügen',
        insertRowBelow: 'Zeile unterhalb einfügen',
        makeRegular: 'Als normal setzen (TD)',
        makeHeader: 'Als Kopfzelle setzen (TH)',
        makeRowHeader: 'Zeile als Kopfzeile setzen',
        cellAttributes: 'Zellenattribute',
        rowAttributes: 'Zeilenattribute',
        deleteColumn: 'Spalte löschen',
        deleteRow: 'Zeile löschen',
        deleteTable: 'Tabelle löschen',
        headerPrefix: 'Kopfzeile'
    },
    
    // YouTube module
    youtube: {
        title: 'YouTube',
        videoLink: 'YouTube-Video-Link',
        invalidUrl: 'Ungültige YouTube-URL'
    },
    
    // Code module
    code: {
        title: 'Codeblock einfügen',
        editTitle: 'Codeblock bearbeiten',
        language: 'Programmiersprache',
        languageNone: 'Keine',
        codePlaceholder: 'Code hier einfügen...',
        removeCodeBlock: 'Codeblock entfernen'
    },
    
    // Find & Replace module
    findReplace: {
        findPlaceholder: 'Suchen...',
        replacePlaceholder: 'Ersetzen durch...',
        replace: 'Ersetzen',
        replaceAll: 'Alle',
        noResults: 'Keine Ergebnisse',
        ofCount: 'von',
        previousTooltip: 'Vorheriger (Umschalt+Eingabe)',
        nextTooltip: 'Nächster (Eingabe)',
        closeTooltip: 'Schließen (Esc)'
    },
    
    // Block Control module
    blockControl: {
        transformTo: 'Umwandeln in',
        paragraph: 'Absatz',
        heading1: 'Überschrift 1',
        heading2: 'Überschrift 2',
        heading3: 'Überschrift 3',
        quote: 'Zitat',
        callout: 'Hinweis',
        calloutStyle: 'Hinweisstil',
        quoteStyle: 'Zitatstil',
        noStyle: 'Ohne Stil',
        warning: 'Warnung',
        danger: 'Gefahr',
        information: 'Information',
        success: 'Erfolg',
        standard: 'Standard',
        big: 'Groß',
        listType: 'Listentyp',
        bulleted: 'Aufzählung',
        numbered: 'Nummeriert',
        actions: 'Aktionen',
        insertBlockBelow: 'Block unten einfügen',
        duplicate: 'Duplizieren',
        attributes: 'Attribute',
        cellSettings: 'Zelleneinstellungen',
        rowSettings: 'Zeileneinstellungen',
        dragEntireList: 'Gesamte Liste ziehen'
    },
    
    // Attributes module
    attributes: {
        title: 'Elementattribute',
        editing: 'Bearbeitung',
        idAnchor: 'ID (Anker)',
        idPlaceholder: 'beispiel-anker',
        linkPrefix: 'Link',
        classes: 'Klassen (durch Leerzeichen getrennt)',
        quickSelect: 'Schnellauswahl'
    },
    
    // Slash Commands
    slashCommands: {
        noCommands: 'Keine Befehle gefunden',
        heading1: 'Überschrift 1',
        heading1Desc: 'Große Abschnittsüberschrift',
        heading2: 'Überschrift 2',
        heading2Desc: 'Mittlere Abschnittsüberschrift',
        heading3: 'Überschrift 3',
        heading3Desc: 'Kleine Abschnittsüberschrift',
        quote: 'Zitat',
        quoteDesc: 'Zitatblock',
        callout: 'Hinweis',
        calloutDesc: 'Hervorgehobener Infoblock',
        codeBlock: 'Codeblock',
        codeBlockDesc: 'Code mit Syntaxhervorhebung',
        image: 'Bild',
        imageDesc: 'Bild einfügen',
        youtube: 'YouTube',
        youtubeDesc: 'Video einbetten',
        table: 'Tabelle',
        tableDesc: 'Tabelle einfügen',
        divider: 'Trennlinie',
        dividerDesc: 'Horizontale Trennlinie',
        numberedList: 'Nummerierte Liste',
        numberedListDesc: 'Liste mit Nummern',
        bulletList: 'Aufzählungsliste',
        bulletListDesc: 'Liste mit Aufzählungszeichen'
    },
    
    // Upload errors
    upload: {
        error: 'Hochladen fehlgeschlagen',
        connectionError: 'Verbindungsfehler',
        serverError: 'Serverfehler',
        invalidResponse: 'Ungültige Serverantwort',
        remove: 'Entfernen'
    },
    
    // Counter
    counter: {
        chars: 'Zeichen',
        words: 'Wörter'
    }
};
