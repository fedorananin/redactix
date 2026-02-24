/**
 * Serbian localization for Redactix Editor (Latin script)
 */
export default {
    // General
    chars: 'znakova',
    words: 'reči',

    // Modal buttons
    save: 'Sačuvaj',
    cancel: 'Otkaži',
    remove: 'Ukloni',
    close: 'Zatvori',
    delete: 'Obriši',

    // Toolbar tooltips
    toolbar: {
        insertImage: 'Ubaci sliku',
        insertTable: 'Ubaci tabelu',
        insertYoutube: 'Ubaci YouTube video',
        insertCode: 'Ubaci blok koda',
        findReplace: 'Pronađi i zameni (Ctrl+F)',
        fullscreen: 'Režim celog ekrana',
        editHtml: 'Uredi HTML',
        bold: 'Podebljano',
        italic: 'Kurziv',
        underline: 'Podvučeno',
        strikethrough: 'Precrtano',
        highlight: 'Istakni',
        monospace: 'Monospace',
        spoiler: 'Spojler',
        link: 'Link'
    },

    // Image module
    image: {
        title: 'Ubaci sliku',
        editTitle: 'Uredi sliku',
        url: 'URL slike',
        alt: 'Alt tekst',
        altDescription: 'Alt tekst (opis)',
        title_attr: 'Naslov (tooltip)',
        srcset: 'Srcset (opciono)',
        srcsetPlaceholder: 'small.jpg 320w, large.jpg 800w',
        loading: 'Učitavanje',
        loadingDefault: 'Podrazumevano',
        loadingLazy: 'lazy (odloženo učitavanje)',
        loadingEager: 'eager (trenutno učitavanje)',
        caption: 'Natpis',
        captionPlaceholder: 'HTML podržan',
        linkSection: 'Link na klik slike',
        linkUrl: 'URL linka (opciono)',
        linkUrlPlaceholder: 'https://...',
        relExceptNofollow: 'Rel (osim nofollow)',
        relPlaceholder: 'sponsored, ugc, ...',
        openNewWindow: 'Otvori u novom prozoru',
        nofollow: 'nofollow',
        removeImage: 'Ukloni sliku',
        uploadReplace: 'Zameni sliku: klikni za otpremanje',
        uploadClick: 'Klikni za otpremanje ili prevuci i pusti',
        uploadFormats: 'JPG, PNG, GIF, WebP, AVIF, HEIC, SVG',
        uploading: 'Otpremanje...',
        uploadSuccess: 'Uspešno otpremljeno',
        chooseFromUploaded: 'Izaberi iz otpremljenih slika',
        orEnterUrl: 'ili unesi URL',
        loadingImages: 'Učitavanje slika...',
        noImages: 'Nema otpremljenih slika',
        imageSelected: 'Slika izabrana',
        closeGallery: 'Zatvori galeriju',
        deleteConfirm: 'Obriši'
    },

    // Link module
    link: {
        title: 'Ubaci link',
        editTitle: 'Uredi link',
        url: 'URL',
        linkText: 'Tekst linka',
        titleAttr: 'Naslov (tooltip)',
        openNewWindow: 'Otvori u novom prozoru',
        nofollow: 'nofollow',
        removeLink: 'Ukloni link',
        relExceptNofollow: 'Rel (osim nofollow)',
        relPlaceholder: 'sponsored, ugc, ...'
    },

    // Table module
    table: {
        title: 'Ubaci tabelu',
        rows: 'Redovi',
        columns: 'Kolone',
        firstRowHeader: 'Prvi red kao zaglavlje',
        insertColumnLeft: 'Ubaci kolonu levo',
        insertColumnRight: 'Ubaci kolonu desno',
        insertRowAbove: 'Ubaci red iznad',
        insertRowBelow: 'Ubaci red ispod',
        makeRegular: 'Postavi kao obično (TD)',
        makeHeader: 'Postavi kao zaglavlje (TH)',
        makeRowHeader: 'Postavi red kao zaglavlje',
        cellAttributes: 'Atributi ćelije',
        rowAttributes: 'Atributi reda',
        deleteColumn: 'Obriši kolonu',
        deleteRow: 'Obriši red',
        deleteTable: 'Obriši tabelu',
        headerPrefix: 'Zaglavlje'
    },

    // YouTube module
    youtube: {
        title: 'YouTube',
        videoLink: 'Link YouTube videa',
        invalidUrl: 'Nevažeći YouTube URL'
    },

    // Code module
    code: {
        title: 'Ubaci blok koda',
        editTitle: 'Uredi blok koda',
        language: 'Programski jezik',
        languageNone: 'Nijedan',
        codePlaceholder: 'Nalepi svoj kod ovde...',
        removeCodeBlock: 'Ukloni blok koda'
    },

    // Find & Replace module
    findReplace: {
        findPlaceholder: 'Pronađi...',
        replacePlaceholder: 'Zameni sa...',
        replace: 'Zameni',
        replaceAll: 'Sve',
        noResults: 'Nema rezultata',
        ofCount: 'od',
        previousTooltip: 'Prethodni (Shift+Enter)',
        nextTooltip: 'Sledeći (Enter)',
        closeTooltip: 'Zatvori (Esc)'
    },

    // Block Control module
    blockControl: {
        transformTo: 'Pretvori u',
        paragraph: 'Paragraf',
        heading1: 'Naslov 1',
        heading2: 'Naslov 2',
        heading3: 'Naslov 3',
        quote: 'Citat',
        callout: 'Istaknutо',
        calloutStyle: 'Stil istaknutog',
        quoteStyle: 'Stil citata',
        noStyle: 'Bez stila',
        warning: 'Upozorenje',
        danger: 'Opasnost',
        information: 'Informacija',
        success: 'Uspeh',
        standard: 'Standardno',
        big: 'Veliko',
        listType: 'Tip liste',
        bulleted: 'Sa tačkama',
        numbered: 'Numerisana',
        actions: 'Akcije',
        insertBlockBelow: 'Ubaci blok ispod',
        duplicate: 'Dupliraj',
        attributes: 'Atributi',
        cellSettings: 'Podešavanja ćelije',
        rowSettings: 'Podešavanja reda',
        dragEntireList: 'Prevuci celu listu',
        citePlaceholder: 'Dodaj citat...',
        addCitation: 'Dodaj citat',
        removeCitation: 'Ukloni citat'
    },

    // Attributes module
    attributes: {
        title: 'Atributi elementa',
        editing: 'Uređivanje',
        idAnchor: 'ID (Sidro)',
        idPlaceholder: 'primer-sidra',
        linkPrefix: 'Link',
        classes: 'Klase (razdvojene razmakom)',
        quickSelect: 'Brzi izbor'
    },

    // Slash Commands
    slashCommands: {
        noCommands: 'Komande nisu pronađene',
        heading1: 'Naslov 1',
        heading1Desc: 'Veliki naslov sekcije',
        heading2: 'Naslov 2',
        heading2Desc: 'Srednji naslov sekcije',
        heading3: 'Naslov 3',
        heading3Desc: 'Mali naslov sekcije',
        quote: 'Citat',
        quoteDesc: 'Blok citata',
        callout: 'Istaknutо',
        calloutDesc: 'Istaknuti informativni blok',
        codeBlock: 'Blok koda',
        codeBlockDesc: 'Kod sa isticanjem sintakse',
        image: 'Slika',
        imageDesc: 'Ubaci sliku',
        youtube: 'YouTube',
        youtubeDesc: 'Ugradi video',
        table: 'Tabela',
        tableDesc: 'Ubaci tabelu',
        divider: 'Razdvajač',
        dividerDesc: 'Horizontalna linija',
        numberedList: 'Numerisana lista',
        numberedListDesc: 'Lista sa brojevima',
        bulletList: 'Lista sa tačkama',
        bulletListDesc: 'Lista sa tačkama'
    },

    // Upload errors
    upload: {
        error: 'Otpremanje nije uspelo',
        connectionError: 'Greška veze',
        serverError: 'Greška servera',
        invalidResponse: 'Nevažeći odgovor servera',
        remove: 'Ukloni'
    },

    // Counter
    counter: {
        chars: 'znakova',
        words: 'reči'
    }
};
