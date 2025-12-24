/**
 * Polish localization for Redactix Editor
 */
export default {
    // General
    chars: 'znaków',
    words: 'słów',
    
    // Modal buttons
    save: 'Zapisz',
    cancel: 'Anuluj',
    remove: 'Usuń',
    close: 'Zamknij',
    delete: 'Usuń',
    
    // Toolbar tooltips
    toolbar: {
        insertImage: 'Wstaw obraz',
        insertTable: 'Wstaw tabelę',
        insertYoutube: 'Wstaw film YouTube',
        insertCode: 'Wstaw blok kodu',
        findReplace: 'Znajdź i zamień (Ctrl+F)',
        fullscreen: 'Tryb pełnoekranowy',
        editHtml: 'Edytuj HTML',
        bold: 'Pogrubienie',
        italic: 'Kursywa',
        underline: 'Podkreślenie',
        strikethrough: 'Przekreślenie',
        highlight: 'Wyróżnienie',
        monospace: 'Monospace',
        spoiler: 'Spoiler',
        link: 'Link'
    },
    
    // Image module
    image: {
        title: 'Wstaw obraz',
        editTitle: 'Edytuj obraz',
        url: 'URL obrazu',
        alt: 'Tekst alt',
        altDescription: 'Tekst alt (opis)',
        title_attr: 'Tytuł (podpowiedź)',
        srcset: 'Srcset (opcjonalnie)',
        srcsetPlaceholder: 'small.jpg 320w, large.jpg 800w',
        loading: 'Ładowanie',
        loadingDefault: 'Domyślne',
        loadingLazy: 'lazy (opóźnione ładowanie)',
        loadingEager: 'eager (natychmiastowe ładowanie)',
        caption: 'Podpis',
        captionPlaceholder: 'Obsługiwany HTML',
        linkSection: 'Link po kliknięciu obrazu',
        linkUrl: 'URL linku (opcjonalnie)',
        linkUrlPlaceholder: 'https://...',
        relExceptNofollow: 'Rel (oprócz nofollow)',
        relPlaceholder: 'sponsored, ugc, ...',
        openNewWindow: 'Otwórz w nowym oknie',
        nofollow: 'nofollow',
        removeImage: 'Usuń obraz',
        uploadReplace: 'Zamień obraz: kliknij, aby przesłać',
        uploadClick: 'Kliknij, aby przesłać lub przeciągnij i upuść',
        uploadFormats: 'JPG, PNG, GIF, WebP, AVIF, HEIC, SVG',
        uploading: 'Przesyłanie...',
        uploadSuccess: 'Przesłano pomyślnie',
        chooseFromUploaded: 'Wybierz z przesłanych obrazów',
        orEnterUrl: 'lub wprowadź URL',
        loadingImages: 'Ładowanie obrazów...',
        noImages: 'Brak przesłanych obrazów',
        imageSelected: 'Obraz wybrany',
        closeGallery: 'Zamknij galerię',
        deleteConfirm: 'Usuń'
    },
    
    // Link module
    link: {
        title: 'Wstaw link',
        editTitle: 'Edytuj link',
        url: 'URL',
        linkText: 'Tekst linku',
        titleAttr: 'Tytuł (podpowiedź)',
        openNewWindow: 'Otwórz w nowym oknie',
        nofollow: 'nofollow',
        removeLink: 'Usuń link',
        relExceptNofollow: 'Rel (oprócz nofollow)',
        relPlaceholder: 'sponsored, ugc, ...'
    },
    
    // Table module
    table: {
        title: 'Wstaw tabelę',
        rows: 'Wiersze',
        columns: 'Kolumny',
        firstRowHeader: 'Pierwszy wiersz jako nagłówek',
        insertColumnLeft: 'Wstaw kolumnę po lewej',
        insertColumnRight: 'Wstaw kolumnę po prawej',
        insertRowAbove: 'Wstaw wiersz powyżej',
        insertRowBelow: 'Wstaw wiersz poniżej',
        makeRegular: 'Ustaw jako zwykłą (TD)',
        makeHeader: 'Ustaw jako nagłówek (TH)',
        makeRowHeader: 'Ustaw wiersz jako nagłówek',
        cellAttributes: 'Atrybuty komórki',
        rowAttributes: 'Atrybuty wiersza',
        deleteColumn: 'Usuń kolumnę',
        deleteRow: 'Usuń wiersz',
        deleteTable: 'Usuń tabelę',
        headerPrefix: 'Nagłówek'
    },
    
    // YouTube module
    youtube: {
        title: 'YouTube',
        videoLink: 'Link do filmu YouTube',
        invalidUrl: 'Nieprawidłowy URL YouTube'
    },
    
    // Code module
    code: {
        title: 'Wstaw blok kodu',
        editTitle: 'Edytuj blok kodu',
        language: 'Język programowania',
        languageNone: 'Brak',
        codePlaceholder: 'Wklej swój kod tutaj...',
        removeCodeBlock: 'Usuń blok kodu'
    },
    
    // Find & Replace module
    findReplace: {
        findPlaceholder: 'Znajdź...',
        replacePlaceholder: 'Zamień na...',
        replace: 'Zamień',
        replaceAll: 'Wszystkie',
        noResults: 'Brak wyników',
        ofCount: 'z',
        previousTooltip: 'Poprzedni (Shift+Enter)',
        nextTooltip: 'Następny (Enter)',
        closeTooltip: 'Zamknij (Esc)'
    },
    
    // Block Control module
    blockControl: {
        transformTo: 'Przekształć w',
        paragraph: 'Akapit',
        heading1: 'Nagłówek 1',
        heading2: 'Nagłówek 2',
        heading3: 'Nagłówek 3',
        quote: 'Cytat',
        callout: 'Wyróżnik',
        calloutStyle: 'Styl wyróżnika',
        quoteStyle: 'Styl cytatu',
        noStyle: 'Bez stylu',
        warning: 'Ostrzeżenie',
        danger: 'Niebezpieczeństwo',
        information: 'Informacja',
        success: 'Sukces',
        standard: 'Standardowy',
        big: 'Duży',
        listType: 'Typ listy',
        bulleted: 'Punktowana',
        numbered: 'Numerowana',
        actions: 'Akcje',
        insertBlockBelow: 'Wstaw blok poniżej',
        duplicate: 'Duplikuj',
        attributes: 'Atrybuty',
        cellSettings: 'Ustawienia komórki',
        rowSettings: 'Ustawienia wiersza',
        dragEntireList: 'Przeciągnij całą listę'
    },
    
    // Attributes module
    attributes: {
        title: 'Atrybuty elementu',
        editing: 'Edycja',
        idAnchor: 'ID (Kotwica)',
        idPlaceholder: 'przykład-kotwicy',
        linkPrefix: 'Link',
        classes: 'Klasy (rozdzielone spacją)',
        quickSelect: 'Szybki wybór'
    },
    
    // Slash Commands
    slashCommands: {
        noCommands: 'Nie znaleziono poleceń',
        heading1: 'Nagłówek 1',
        heading1Desc: 'Duży nagłówek sekcji',
        heading2: 'Nagłówek 2',
        heading2Desc: 'Średni nagłówek sekcji',
        heading3: 'Nagłówek 3',
        heading3Desc: 'Mały nagłówek sekcji',
        quote: 'Cytat',
        quoteDesc: 'Blok cytatu',
        callout: 'Wyróżnik',
        calloutDesc: 'Wyróżniony blok informacyjny',
        codeBlock: 'Blok kodu',
        codeBlockDesc: 'Kod z podświetlaniem składni',
        image: 'Obraz',
        imageDesc: 'Wstaw obraz',
        youtube: 'YouTube',
        youtubeDesc: 'Osadź film',
        table: 'Tabela',
        tableDesc: 'Wstaw tabelę',
        divider: 'Separator',
        dividerDesc: 'Pozioma linia oddzielająca',
        numberedList: 'Lista numerowana',
        numberedListDesc: 'Lista z numerami',
        bulletList: 'Lista punktowana',
        bulletListDesc: 'Lista z punktami'
    },
    
    // Upload errors
    upload: {
        error: 'Błąd przesyłania',
        connectionError: 'Błąd połączenia',
        serverError: 'Błąd serwera',
        invalidResponse: 'Nieprawidłowa odpowiedź serwera',
        remove: 'Usuń'
    },
    
    // Counter
    counter: {
        chars: 'znaków',
        words: 'słów'
    }
};
