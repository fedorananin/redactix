/**
 * Swahili localization for Redactix Editor
 */
export default {
    // General
    chars: 'herufi',
    words: 'maneno',
    
    // Modal buttons
    save: 'Hifadhi',
    cancel: 'Ghairi',
    remove: 'Ondoa',
    close: 'Funga',
    delete: 'Futa',
    
    // Toolbar tooltips
    toolbar: {
        insertImage: 'Ingiza picha',
        insertTable: 'Ingiza jedwali',
        insertYoutube: 'Ingiza video ya YouTube',
        insertCode: 'Ingiza kipande cha msimbo',
        findReplace: 'Tafuta na Badilisha (Ctrl+F)',
        fullscreen: 'Hali ya skrini kamili',
        editHtml: 'Hariri HTML',
        bold: 'Nono',
        italic: 'Italiki',
        underline: 'Pigia mstari',
        strikethrough: 'Piga mstari katikati',
        highlight: 'Angazia',
        monospace: 'Monospace',
        spoiler: 'Spoiler',
        link: 'Kiungo'
    },
    
    // Image module
    image: {
        title: 'Ingiza picha',
        editTitle: 'Hariri picha',
        url: 'URL ya picha',
        alt: 'Maandishi ya Alt',
        altDescription: 'Maandishi ya Alt (maelezo)',
        title_attr: 'Kichwa (tooltip)',
        srcset: 'Srcset (hiari)',
        srcsetPlaceholder: 'small.jpg 320w, large.jpg 800w',
        loading: 'Inapakia',
        loadingDefault: 'Chaguo-msingi',
        loadingLazy: 'lazy (upakiaji ulioahirishwa)',
        loadingEager: 'eager (upakiaji wa haraka)',
        caption: 'Maelezo',
        captionPlaceholder: 'HTML inakubalika',
        linkSection: 'Kiungo unapobofya picha',
        linkUrl: 'URL ya kiungo (hiari)',
        linkUrlPlaceholder: 'https://...',
        relExceptNofollow: 'Rel (isipokuwa nofollow)',
        relPlaceholder: 'sponsored, ugc, ...',
        openNewWindow: 'Fungua kwenye dirisha jipya',
        nofollow: 'nofollow',
        removeImage: 'Ondoa picha',
        uploadReplace: 'Badilisha picha: bofya kupakia',
        uploadClick: 'Bofya kupakia au buruta na udondoshe',
        uploadFormats: 'JPG, PNG, GIF, WebP, AVIF, HEIC, SVG',
        uploading: 'Inapakia...',
        uploadSuccess: 'Imepakiwa kwa mafanikio',
        chooseFromUploaded: 'Chagua kutoka picha zilizopakiwa',
        orEnterUrl: 'au ingiza URL',
        loadingImages: 'Inapakia picha...',
        noImages: 'Hakuna picha zilizopakiwa bado',
        imageSelected: 'Picha imechaguliwa',
        closeGallery: 'Funga matunzio',
        deleteConfirm: 'Futa'
    },
    
    // Link module
    link: {
        title: 'Ingiza kiungo',
        editTitle: 'Hariri kiungo',
        url: 'URL',
        linkText: 'Maandishi ya kiungo',
        titleAttr: 'Kichwa (tooltip)',
        openNewWindow: 'Fungua kwenye dirisha jipya',
        nofollow: 'nofollow',
        removeLink: 'Ondoa kiungo',
        relExceptNofollow: 'Rel (isipokuwa nofollow)',
        relPlaceholder: 'sponsored, ugc, ...'
    },
    
    // Table module
    table: {
        title: 'Ingiza jedwali',
        rows: 'Safu mlalo',
        columns: 'Safu wima',
        firstRowHeader: 'Safu ya kwanza ni kichwa',
        insertColumnLeft: 'Ingiza safu wima kushoto',
        insertColumnRight: 'Ingiza safu wima kulia',
        insertRowAbove: 'Ingiza safu mlalo juu',
        insertRowBelow: 'Ingiza safu mlalo chini',
        makeRegular: 'Fanya kawaida (TD)',
        makeHeader: 'Fanya kichwa (TH)',
        makeRowHeader: 'Fanya safu mlalo kuwa kichwa',
        cellAttributes: 'Sifa za seli',
        rowAttributes: 'Sifa za safu mlalo',
        deleteColumn: 'Futa safu wima',
        deleteRow: 'Futa safu mlalo',
        deleteTable: 'Futa jedwali',
        headerPrefix: 'Kichwa'
    },
    
    // YouTube module
    youtube: {
        title: 'YouTube',
        videoLink: 'Kiungo cha video ya YouTube',
        invalidUrl: 'URL ya YouTube si sahihi'
    },
    
    // Code module
    code: {
        title: 'Ingiza kipande cha msimbo',
        editTitle: 'Hariri kipande cha msimbo',
        language: 'Lugha ya programu',
        languageNone: 'Hakuna',
        codePlaceholder: 'Bandika msimbo wako hapa...',
        removeCodeBlock: 'Ondoa kipande cha msimbo'
    },
    
    // Find & Replace module
    findReplace: {
        findPlaceholder: 'Tafuta...',
        replacePlaceholder: 'Badilisha na...',
        replace: 'Badilisha',
        replaceAll: 'Zote',
        noResults: 'Hakuna matokeo',
        ofCount: 'ya',
        previousTooltip: 'Uliopita (Shift+Enter)',
        nextTooltip: 'Unaofuata (Enter)',
        closeTooltip: 'Funga (Esc)'
    },
    
    // Block Control module
    blockControl: {
        transformTo: 'Badilisha kuwa',
        paragraph: 'Aya',
        heading1: 'Kichwa 1',
        heading2: 'Kichwa 2',
        heading3: 'Kichwa 3',
        quote: 'Nukuu',
        callout: 'Onyo',
        calloutStyle: 'Mtindo wa onyo',
        quoteStyle: 'Mtindo wa nukuu',
        noStyle: 'Bila mtindo',
        warning: 'Tahadhari',
        danger: 'Hatari',
        information: 'Taarifa',
        success: 'Mafanikio',
        standard: 'Kawaida',
        big: 'Kubwa',
        listType: 'Aina ya orodha',
        bulleted: 'Yenye vitone',
        numbered: 'Yenye nambari',
        actions: 'Vitendo',
        insertBlockBelow: 'Ingiza kipande chini',
        duplicate: 'Nakili',
        attributes: 'Sifa',
        cellSettings: 'Mipangilio ya seli',
        rowSettings: 'Mipangilio ya safu mlalo',
        dragEntireList: 'Buruta orodha nzima'
    },
    
    // Attributes module
    attributes: {
        title: 'Sifa za kipengele',
        editing: 'Kuhariri',
        idAnchor: 'ID (Nanga)',
        idPlaceholder: 'mfano-nanga',
        linkPrefix: 'Kiungo',
        classes: 'Madarasa (yaliyotenganishwa na nafasi)',
        quickSelect: 'Chaguo la haraka'
    },
    
    // Slash Commands
    slashCommands: {
        noCommands: 'Hakuna amri zilizopatikana',
        heading1: 'Kichwa 1',
        heading1Desc: 'Kichwa kikubwa cha sehemu',
        heading2: 'Kichwa 2',
        heading2Desc: 'Kichwa cha kati cha sehemu',
        heading3: 'Kichwa 3',
        heading3Desc: 'Kichwa kidogo cha sehemu',
        quote: 'Nukuu',
        quoteDesc: 'Kipande cha nukuu',
        callout: 'Onyo',
        calloutDesc: 'Kipande kilichoangaziwa cha taarifa',
        codeBlock: 'Kipande cha msimbo',
        codeBlockDesc: 'Msimbo wenye uangaziaji wa sintaksia',
        image: 'Picha',
        imageDesc: 'Ingiza picha',
        youtube: 'YouTube',
        youtubeDesc: 'Weka video',
        table: 'Jedwali',
        tableDesc: 'Ingiza jedwali',
        divider: 'Kigawanyo',
        dividerDesc: 'Mstari wa mlalo wa kugawanya',
        numberedList: 'Orodha yenye nambari',
        numberedListDesc: 'Orodha yenye nambari',
        bulletList: 'Orodha yenye vitone',
        bulletListDesc: 'Orodha yenye vitone'
    },
    
    // Upload errors
    upload: {
        error: 'Upakiaji umeshindwa',
        connectionError: 'Hitilafu ya muunganisho',
        serverError: 'Hitilafu ya seva',
        invalidResponse: 'Jibu la seva si sahihi',
        remove: 'Ondoa'
    },
    
    // Counter
    counter: {
        chars: 'herufi',
        words: 'maneno'
    }
};
