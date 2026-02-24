/**
 * Uzbek localization for Redactix Editor
 */
export default {
    // General
    chars: 'belgi',
    words: 'so\'z',

    // Modal buttons
    save: 'Saqlash',
    cancel: 'Bekor qilish',
    remove: 'O\'chirish',
    close: 'Yopish',
    delete: 'O\'chirish',

    // Toolbar tooltips
    toolbar: {
        insertImage: 'Rasm qo\'shish',
        insertTable: 'Jadval qo\'shish',
        insertYoutube: 'YouTube video qo\'shish',
        insertCode: 'Kod blokini qo\'shish',
        findReplace: 'Topish va almashtirish (Ctrl+F)',
        fullscreen: 'To\'liq ekran rejimi',
        editHtml: 'HTML tahrirlash',
        bold: 'Qalin',
        italic: 'Qiyshiq',
        underline: 'Tagiga chizilgan',
        strikethrough: 'Chizilgan',
        highlight: 'Ajratib ko\'rsatish',
        monospace: 'Monoshrift',
        spoiler: 'Spoyler',
        link: 'Havola'
    },

    // Image module
    image: {
        title: 'Rasm qo\'shish',
        editTitle: 'Rasmni tahrirlash',
        url: 'Rasm URL',
        alt: 'Alt matn',
        altDescription: 'Alt matn (tavsif)',
        title_attr: 'Sarlavha (maslahat)',
        srcset: 'Srcset (ixtiyoriy)',
        srcsetPlaceholder: 'small.jpg 320w, large.jpg 800w',
        loading: 'Yuklash',
        loadingDefault: 'Standart',
        loadingLazy: 'lazy (kechiktirilgan yuklash)',
        loadingEager: 'eager (tezkor yuklash)',
        caption: 'Izoh',
        captionPlaceholder: 'HTML qo\'llab-quvvatlanadi',
        linkSection: 'Rasmni bosganingizda havola',
        linkUrl: 'Havola URL (ixtiyoriy)',
        linkUrlPlaceholder: 'https://...',
        relExceptNofollow: 'Rel (nofollow dan tashqari)',
        relPlaceholder: 'sponsored, ugc, ...',
        openNewWindow: 'Yangi oynada ochish',
        nofollow: 'nofollow',
        removeImage: 'Rasmni o\'chirish',
        uploadReplace: 'Rasmni almashtirish: yuklash uchun bosing',
        uploadClick: 'Yuklash uchun bosing yoki tortib qo\'ying',
        uploadFormats: 'JPG, PNG, GIF, WebP, AVIF, HEIC, SVG',
        uploading: 'Yuklanmoqda...',
        uploadSuccess: 'Muvaffaqiyatli yuklandi',
        chooseFromUploaded: 'Yuklangan rasmlardan tanlang',
        orEnterUrl: 'yoki URL kiriting',
        loadingImages: 'Rasmlar yuklanmoqda...',
        noImages: 'Yuklangan rasmlar yo\'q',
        imageSelected: 'Rasm tanlandi',
        closeGallery: 'Galereyani yopish',
        deleteConfirm: 'O\'chirish'
    },

    // Link module
    link: {
        title: 'Havola qo\'shish',
        editTitle: 'Havolani tahrirlash',
        url: 'URL',
        linkText: 'Havola matni',
        titleAttr: 'Sarlavha (maslahat)',
        openNewWindow: 'Yangi oynada ochish',
        nofollow: 'nofollow',
        removeLink: 'Havolani o\'chirish',
        relExceptNofollow: 'Rel (nofollow dan tashqari)',
        relPlaceholder: 'sponsored, ugc, ...'
    },

    // Table module
    table: {
        title: 'Jadval qo\'shish',
        rows: 'Qatorlar',
        columns: 'Ustunlar',
        firstRowHeader: 'Birinchi qator sarlavha',
        insertColumnLeft: 'Chapga ustun qo\'shish',
        insertColumnRight: 'O\'ngga ustun qo\'shish',
        insertRowAbove: 'Yuqoriga qator qo\'shish',
        insertRowBelow: 'Pastga qator qo\'shish',
        makeRegular: 'Oddiy qilish (TD)',
        makeHeader: 'Sarlavha qilish (TH)',
        makeRowHeader: 'Qatorni sarlavha qilish',
        cellAttributes: 'Katak atributlari',
        rowAttributes: 'Qator atributlari',
        deleteColumn: 'Ustunni o\'chirish',
        deleteRow: 'Qatorni o\'chirish',
        deleteTable: 'Jadvalni o\'chirish',
        headerPrefix: 'Sarlavha'
    },

    // YouTube module
    youtube: {
        title: 'YouTube',
        videoLink: 'YouTube video havolasi',
        invalidUrl: 'Noto\'g\'ri YouTube URL'
    },

    // Code module
    code: {
        title: 'Kod blokini qo\'shish',
        editTitle: 'Kod blokini tahrirlash',
        language: 'Dasturlash tili',
        languageNone: 'Yo\'q',
        codePlaceholder: 'Kodingizni shu yerga qo\'ying...',
        removeCodeBlock: 'Kod blokini o\'chirish'
    },

    // Find & Replace module
    findReplace: {
        findPlaceholder: 'Topish...',
        replacePlaceholder: 'Almashtirish...',
        replace: 'Almashtirish',
        replaceAll: 'Barchasi',
        noResults: 'Natija yo\'q',
        ofCount: '/',
        previousTooltip: 'Oldingi (Shift+Enter)',
        nextTooltip: 'Keyingi (Enter)',
        closeTooltip: 'Yopish (Esc)'
    },

    // Block Control module
    blockControl: {
        transformTo: 'Aylantirish',
        paragraph: 'Paragraf',
        heading1: 'Sarlavha 1',
        heading2: 'Sarlavha 2',
        heading3: 'Sarlavha 3',
        quote: 'Iqtibos',
        callout: 'Eslatma',
        calloutStyle: 'Eslatma uslubi',
        quoteStyle: 'Iqtibos uslubi',
        noStyle: 'Uslubsiz',
        warning: 'Ogohlantirish',
        danger: 'Xavf',
        information: 'Ma\'lumot',
        success: 'Muvaffaqiyat',
        standard: 'Standart',
        big: 'Katta',
        listType: 'Ro\'yxat turi',
        bulleted: 'Belgilangan',
        numbered: 'Raqamlangan',
        actions: 'Amallar',
        insertBlockBelow: 'Pastga blok qo\'shish',
        duplicate: 'Nusxalash',
        attributes: 'Atributlar',
        cellSettings: 'Katak sozlamalari',
        rowSettings: 'Qator sozlamalari',
        dragEntireList: 'Butun ro\'yxatni sudrab boring',
        citePlaceholder: 'Iqtibos qo\'shish...',
        addCitation: 'Iqtibos qo\'shish',
        removeCitation: 'Iqtibosni olib tashlash'
    },

    // Attributes module
    attributes: {
        title: 'Element atributlari',
        editing: 'Tahrirlash',
        idAnchor: 'ID (Langar)',
        idPlaceholder: 'misol-langar',
        linkPrefix: 'Havola',
        classes: 'Klasslar (bo\'sh joy bilan ajratilgan)',
        quickSelect: 'Tezkor tanlash'
    },

    // Slash Commands
    slashCommands: {
        noCommands: 'Buyruqlar topilmadi',
        heading1: 'Sarlavha 1',
        heading1Desc: 'Katta bo\'lim sarlavhasi',
        heading2: 'Sarlavha 2',
        heading2Desc: 'O\'rta bo\'lim sarlavhasi',
        heading3: 'Sarlavha 3',
        heading3Desc: 'Kichik bo\'lim sarlavhasi',
        quote: 'Iqtibos',
        quoteDesc: 'Iqtibos bloki',
        callout: 'Eslatma',
        calloutDesc: 'Ajratilgan ma\'lumot bloki',
        codeBlock: 'Kod bloki',
        codeBlockDesc: 'Sintaksis bilan ajratilgan kod',
        image: 'Rasm',
        imageDesc: 'Rasm qo\'shish',
        youtube: 'YouTube',
        youtubeDesc: 'Video joylashtirish',
        table: 'Jadval',
        tableDesc: 'Jadval qo\'shish',
        divider: 'Ajratgich',
        dividerDesc: 'Gorizontal ajratuvchi chiziq',
        numberedList: 'Raqamlangan ro\'yxat',
        numberedListDesc: 'Raqamli ro\'yxat',
        bulletList: 'Belgilangan ro\'yxat',
        bulletListDesc: 'Belgilangan ro\'yxat'
    },

    // Upload errors
    upload: {
        error: 'Yuklash muvaffaqiyatsiz',
        connectionError: 'Ulanish xatosi',
        serverError: 'Server xatosi',
        invalidResponse: 'Noto\'g\'ri server javobi',
        remove: 'O\'chirish'
    },

    // Counter
    counter: {
        chars: 'belgi',
        words: 'so\'z'
    }
};
