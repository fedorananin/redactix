/**
 * Ukrainian localization for Redactix Editor
 */
export default {
    // General
    chars: 'симв.',
    words: 'слів',
    
    // Modal buttons
    save: 'Зберегти',
    cancel: 'Скасувати',
    remove: 'Видалити',
    close: 'Закрити',
    delete: 'Видалити',
    
    // Toolbar tooltips
    toolbar: {
        insertImage: 'Вставити зображення',
        insertTable: 'Вставити таблицю',
        insertYoutube: 'Вставити відео YouTube',
        insertCode: 'Вставити блок коду',
        findReplace: 'Знайти та замінити (Ctrl+F)',
        fullscreen: 'Повноекранний режим',
        editHtml: 'Редагувати HTML',
        bold: 'Жирний',
        italic: 'Курсив',
        underline: 'Підкреслений',
        strikethrough: 'Закреслений',
        highlight: 'Виділення',
        monospace: 'Моноширинний',
        spoiler: 'Спойлер',
        link: 'Посилання'
    },
    
    // Image module
    image: {
        title: 'Вставити зображення',
        editTitle: 'Редагувати зображення',
        url: 'URL зображення',
        alt: 'Alt текст',
        altDescription: 'Alt текст (опис)',
        title_attr: 'Title (підказка)',
        srcset: 'Srcset (опціонально)',
        srcsetPlaceholder: 'small.jpg 320w, large.jpg 800w',
        loading: 'Завантаження',
        loadingDefault: 'За замовчуванням',
        loadingLazy: 'lazy (відкладене завантаження)',
        loadingEager: 'eager (негайне завантаження)',
        caption: 'Підпис',
        captionPlaceholder: 'Підтримується HTML',
        linkSection: 'Посилання при кліку на зображення',
        linkUrl: 'URL посилання (опціонально)',
        linkUrlPlaceholder: 'https://...',
        relExceptNofollow: 'Rel (крім nofollow)',
        relPlaceholder: 'sponsored, ugc, ...',
        openNewWindow: 'Відкривати в новому вікні',
        nofollow: 'nofollow',
        removeImage: 'Видалити зображення',
        uploadReplace: 'Замінити зображення: натисніть для завантаження',
        uploadClick: 'Натисніть для завантаження або перетягніть файл',
        uploadFormats: 'JPG, PNG, GIF, WebP, AVIF, HEIC, SVG',
        uploading: 'Завантаження...',
        uploadSuccess: 'Завантажено успішно',
        chooseFromUploaded: 'Вибрати із завантажених',
        orEnterUrl: 'або введіть URL',
        loadingImages: 'Завантаження зображень...',
        noImages: 'Немає завантажених зображень',
        imageSelected: 'Зображення вибрано',
        closeGallery: 'Закрити галерею',
        deleteConfirm: 'Видалити'
    },
    
    // Link module
    link: {
        title: 'Вставити посилання',
        editTitle: 'Редагувати посилання',
        url: 'URL',
        linkText: 'Текст посилання',
        titleAttr: 'Title (підказка)',
        openNewWindow: 'Відкривати в новому вікні',
        nofollow: 'nofollow',
        removeLink: 'Видалити посилання',
        relExceptNofollow: 'Rel (крім nofollow)',
        relPlaceholder: 'sponsored, ugc, ...'
    },
    
    // Table module
    table: {
        title: 'Вставити таблицю',
        rows: 'Рядки',
        columns: 'Стовпці',
        firstRowHeader: 'Перший рядок — заголовок',
        insertColumnLeft: 'Вставити стовпець зліва',
        insertColumnRight: 'Вставити стовпець справа',
        insertRowAbove: 'Вставити рядок вище',
        insertRowBelow: 'Вставити рядок нижче',
        makeRegular: 'Зробити звичайною (TD)',
        makeHeader: 'Зробити заголовком (TH)',
        makeRowHeader: 'Зробити рядок заголовком',
        cellAttributes: 'Атрибути комірки',
        rowAttributes: 'Атрибути рядка',
        deleteColumn: 'Видалити стовпець',
        deleteRow: 'Видалити рядок',
        deleteTable: 'Видалити таблицю',
        headerPrefix: 'Заголовок'
    },
    
    // YouTube module
    youtube: {
        title: 'YouTube',
        videoLink: 'Посилання на відео YouTube',
        invalidUrl: 'Невірний URL YouTube'
    },
    
    // Code module
    code: {
        title: 'Вставити блок коду',
        editTitle: 'Редагувати блок коду',
        language: 'Мова програмування',
        languageNone: 'Не вказано',
        codePlaceholder: 'Вставте ваш код тут...',
        removeCodeBlock: 'Видалити блок коду'
    },
    
    // Find & Replace module
    findReplace: {
        findPlaceholder: 'Знайти...',
        replacePlaceholder: 'Замінити на...',
        replace: 'Замінити',
        replaceAll: 'Усі',
        noResults: 'Не знайдено',
        ofCount: 'з',
        previousTooltip: 'Попередній (Shift+Enter)',
        nextTooltip: 'Наступний (Enter)',
        closeTooltip: 'Закрити (Esc)'
    },
    
    // Block Control module
    blockControl: {
        transformTo: 'Перетворити на',
        paragraph: 'Параграф',
        heading1: 'Заголовок 1',
        heading2: 'Заголовок 2',
        heading3: 'Заголовок 3',
        quote: 'Цитата',
        callout: 'Виноска',
        calloutStyle: 'Стиль виноски',
        quoteStyle: 'Стиль цитати',
        noStyle: 'Без стилю',
        warning: 'Попередження',
        danger: 'Небезпека',
        information: 'Інформація',
        success: 'Успіх',
        standard: 'Стандартний',
        big: 'Великий',
        listType: 'Тип списку',
        bulleted: 'Маркований',
        numbered: 'Нумерований',
        actions: 'Дії',
        insertBlockBelow: 'Вставити блок нижче',
        duplicate: 'Дублювати',
        attributes: 'Атрибути',
        cellSettings: 'Налаштування комірки',
        rowSettings: 'Налаштування рядка',
        dragEntireList: 'Перетягнути весь список'
    },
    
    // Attributes module
    attributes: {
        title: 'Атрибути елемента',
        editing: 'Редагування',
        idAnchor: 'ID (Якір)',
        idPlaceholder: 'example-anchor',
        linkPrefix: 'Посилання',
        classes: 'Класи (через пробіл)',
        quickSelect: 'Швидкий вибір'
    },
    
    // Slash Commands
    slashCommands: {
        noCommands: 'Команди не знайдено',
        heading1: 'Заголовок 1',
        heading1Desc: 'Великий заголовок розділу',
        heading2: 'Заголовок 2',
        heading2Desc: 'Середній заголовок розділу',
        heading3: 'Заголовок 3',
        heading3Desc: 'Малий заголовок розділу',
        quote: 'Цитата',
        quoteDesc: 'Блок цитати',
        callout: 'Виноска',
        calloutDesc: 'Виділений інформаційний блок',
        codeBlock: 'Блок коду',
        codeBlockDesc: 'Код з підсвіткою синтаксису',
        image: 'Зображення',
        imageDesc: 'Вставити зображення',
        youtube: 'YouTube',
        youtubeDesc: 'Вбудувати відео',
        table: 'Таблиця',
        tableDesc: 'Вставити таблицю',
        divider: 'Роздільник',
        dividerDesc: 'Горизонтальна лінія',
        numberedList: 'Нумерований список',
        numberedListDesc: 'Список з номерами',
        bulletList: 'Маркований список',
        bulletListDesc: 'Список з маркерами'
    },
    
    // Upload errors
    upload: {
        error: 'Помилка завантаження',
        connectionError: 'Помилка з\'єднання',
        serverError: 'Помилка сервера',
        invalidResponse: 'Некоректна відповідь сервера',
        remove: 'Видалити'
    },
    
    // Counter
    counter: {
        chars: 'симв.',
        words: 'слів'
    }
};
