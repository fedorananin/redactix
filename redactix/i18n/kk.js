/**
 * Kazakh localization for Redactix Editor
 */
export default {
    // General
    chars: 'таңба',
    words: 'сөз',
    
    // Modal buttons
    save: 'Сақтау',
    cancel: 'Болдырмау',
    remove: 'Жою',
    close: 'Жабу',
    delete: 'Өшіру',
    
    // Toolbar tooltips
    toolbar: {
        insertImage: 'Сурет қосу',
        insertTable: 'Кесте қосу',
        insertYoutube: 'YouTube бейнесін қосу',
        insertCode: 'Код блогын қосу',
        findReplace: 'Табу және ауыстыру (Ctrl+F)',
        fullscreen: 'Толық экран режимі',
        editHtml: 'HTML өңдеу',
        bold: 'Қалың',
        italic: 'Көлбеу',
        underline: 'Асты сызылған',
        strikethrough: 'Сызылған',
        highlight: 'Бөлектеу',
        monospace: 'Моноқаріп',
        spoiler: 'Спойлер',
        link: 'Сілтеме'
    },
    
    // Image module
    image: {
        title: 'Сурет қосу',
        editTitle: 'Суретті өңдеу',
        url: 'Сурет URL',
        alt: 'Alt мәтін',
        altDescription: 'Alt мәтін (сипаттама)',
        title_attr: 'Тақырып (кеңес)',
        srcset: 'Srcset (міндетті емес)',
        srcsetPlaceholder: 'small.jpg 320w, large.jpg 800w',
        loading: 'Жүктеу',
        loadingDefault: 'Әдепкі',
        loadingLazy: 'lazy (кейінге қалдырылған жүктеу)',
        loadingEager: 'eager (тез жүктеу)',
        caption: 'Қол қою',
        captionPlaceholder: 'HTML қолдау',
        linkSection: 'Суретті басқанда сілтеме',
        linkUrl: 'Сілтеме URL (міндетті емес)',
        linkUrlPlaceholder: 'https://...',
        relExceptNofollow: 'Rel (nofollow-дан басқа)',
        relPlaceholder: 'sponsored, ugc, ...',
        openNewWindow: 'Жаңа терезеде ашу',
        nofollow: 'nofollow',
        removeImage: 'Суретті жою',
        uploadReplace: 'Суретті ауыстыру: жүктеу үшін басыңыз',
        uploadClick: 'Жүктеу үшін басыңыз немесе сүйреп әкеліңіз',
        uploadFormats: 'JPG, PNG, GIF, WebP, AVIF, HEIC, SVG',
        uploading: 'Жүктелуде...',
        uploadSuccess: 'Сәтті жүктелді',
        chooseFromUploaded: 'Жүктелген суреттерден таңдау',
        orEnterUrl: 'немесе URL енгізіңіз',
        loadingImages: 'Суреттер жүктелуде...',
        noImages: 'Жүктелген суреттер жоқ',
        imageSelected: 'Сурет таңдалды',
        closeGallery: 'Галереяны жабу',
        deleteConfirm: 'Өшіру'
    },
    
    // Link module
    link: {
        title: 'Сілтеме қосу',
        editTitle: 'Сілтемені өңдеу',
        url: 'URL',
        linkText: 'Сілтеме мәтіні',
        titleAttr: 'Тақырып (кеңес)',
        openNewWindow: 'Жаңа терезеде ашу',
        nofollow: 'nofollow',
        removeLink: 'Сілтемені жою',
        relExceptNofollow: 'Rel (nofollow-дан басқа)',
        relPlaceholder: 'sponsored, ugc, ...'
    },
    
    // Table module
    table: {
        title: 'Кесте қосу',
        rows: 'Жолдар',
        columns: 'Бағандар',
        firstRowHeader: 'Бірінші жол тақырып',
        insertColumnLeft: 'Сол жаққа баған қосу',
        insertColumnRight: 'Оң жаққа баған қосу',
        insertRowAbove: 'Жоғарыға жол қосу',
        insertRowBelow: 'Төменге жол қосу',
        makeRegular: 'Қарапайым ету (TD)',
        makeHeader: 'Тақырып ету (TH)',
        makeRowHeader: 'Жолды тақырып ету',
        cellAttributes: 'Ұяшық атрибуттары',
        rowAttributes: 'Жол атрибуттары',
        deleteColumn: 'Бағанды жою',
        deleteRow: 'Жолды жою',
        deleteTable: 'Кестені жою',
        headerPrefix: 'Тақырып'
    },
    
    // YouTube module
    youtube: {
        title: 'YouTube',
        videoLink: 'YouTube бейне сілтемесі',
        invalidUrl: 'Жарамсыз YouTube URL'
    },
    
    // Code module
    code: {
        title: 'Код блогын қосу',
        editTitle: 'Код блогын өңдеу',
        language: 'Бағдарламалау тілі',
        languageNone: 'Жоқ',
        codePlaceholder: 'Кодты осында қойыңыз...',
        removeCodeBlock: 'Код блогын жою'
    },
    
    // Find & Replace module
    findReplace: {
        findPlaceholder: 'Табу...',
        replacePlaceholder: 'Ауыстыру...',
        replace: 'Ауыстыру',
        replaceAll: 'Барлығы',
        noResults: 'Нәтиже жоқ',
        ofCount: '/',
        previousTooltip: 'Алдыңғы (Shift+Enter)',
        nextTooltip: 'Келесі (Enter)',
        closeTooltip: 'Жабу (Esc)'
    },
    
    // Block Control module
    blockControl: {
        transformTo: 'Түрлендіру',
        paragraph: 'Абзац',
        heading1: 'Тақырып 1',
        heading2: 'Тақырып 2',
        heading3: 'Тақырып 3',
        quote: 'Дәйексөз',
        callout: 'Ескертпе',
        calloutStyle: 'Ескертпе стилі',
        quoteStyle: 'Дәйексөз стилі',
        noStyle: 'Стильсіз',
        warning: 'Ескерту',
        danger: 'Қауіп',
        information: 'Ақпарат',
        success: 'Сәттілік',
        standard: 'Стандарт',
        big: 'Үлкен',
        listType: 'Тізім түрі',
        bulleted: 'Маркерлі',
        numbered: 'Нөмірленген',
        actions: 'Әрекеттер',
        insertBlockBelow: 'Төменге блок қосу',
        duplicate: 'Көшіру',
        attributes: 'Атрибуттар',
        cellSettings: 'Ұяшық параметрлері',
        rowSettings: 'Жол параметрлері',
        dragEntireList: 'Бүкіл тізімді сүйреу'
    },
    
    // Attributes module
    attributes: {
        title: 'Элемент атрибуттары',
        editing: 'Өңдеу',
        idAnchor: 'ID (Якорь)',
        idPlaceholder: 'мысал-якорь',
        linkPrefix: 'Сілтеме',
        classes: 'Кластар (бос орынмен бөлінген)',
        quickSelect: 'Жылдам таңдау'
    },
    
    // Slash Commands
    slashCommands: {
        noCommands: 'Командалар табылмады',
        heading1: 'Тақырып 1',
        heading1Desc: 'Үлкен бөлім тақырыбы',
        heading2: 'Тақырып 2',
        heading2Desc: 'Орта бөлім тақырыбы',
        heading3: 'Тақырып 3',
        heading3Desc: 'Кіші бөлім тақырыбы',
        quote: 'Дәйексөз',
        quoteDesc: 'Дәйексөз блогы',
        callout: 'Ескертпе',
        calloutDesc: 'Бөлектелген ақпарат блогы',
        codeBlock: 'Код блогы',
        codeBlockDesc: 'Синтаксис бөлектелген код',
        image: 'Сурет',
        imageDesc: 'Сурет қосу',
        youtube: 'YouTube',
        youtubeDesc: 'Бейне ендіру',
        table: 'Кесте',
        tableDesc: 'Кесте қосу',
        divider: 'Бөлгіш',
        dividerDesc: 'Көлденең бөлгіш сызық',
        numberedList: 'Нөмірленген тізім',
        numberedListDesc: 'Нөмірлі тізім',
        bulletList: 'Маркерлі тізім',
        bulletListDesc: 'Маркерлі тізім'
    },
    
    // Upload errors
    upload: {
        error: 'Жүктеу сәтсіз',
        connectionError: 'Байланыс қатесі',
        serverError: 'Сервер қатесі',
        invalidResponse: 'Жарамсыз сервер жауабы',
        remove: 'Жою'
    },
    
    // Counter
    counter: {
        chars: 'таңба',
        words: 'сөз'
    }
};
