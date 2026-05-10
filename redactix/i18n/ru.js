/**
 * Russian localization for Redactix Editor
 */
export default {
    // General
    chars: 'симв.',
    words: 'слов',

    // Modal buttons
    save: 'Сохранить',
    cancel: 'Отмена',
    remove: 'Удалить',
    close: 'Закрыть',
    delete: 'Удалить',

    // Toolbar tooltips
    toolbar: {
        insertImage: 'Вставить изображение',
        insertEmbed: 'Вставить embed',
        insertTable: 'Вставить таблицу',
        insertCode: 'Вставить блок кода',
        findReplace: 'Найти и заменить (Ctrl+F)',
        fullscreen: 'Полноэкранный режим',
        editHtml: 'Редактировать HTML',
        bold: 'Жирный',
        italic: 'Курсив',
        underline: 'Подчёркнутый',
        strikethrough: 'Зачёркнутый',
        highlight: 'Выделение',
        monospace: 'Моноширинный',
        spoiler: 'Спойлер',
        link: 'Ссылка'
    },

    // Image module
    image: {
        title: 'Вставить изображение',
        editTitle: 'Редактировать изображение',
        url: 'URL изображения',
        alt: 'Alt текст',
        altDescription: 'Alt текст (описание)',
        title_attr: 'Title (подсказка)',
        srcset: 'Srcset (опционально)',
        srcsetPlaceholder: 'small.jpg 320w, large.jpg 800w',
        loading: 'Загрузка',
        loadingDefault: 'По умолчанию',
        loadingLazy: 'lazy (отложенная загрузка)',
        loadingEager: 'eager (немедленная загрузка)',
        caption: 'Подпись',
        captionPlaceholder: 'Поддерживается HTML',
        linkSection: 'Ссылка при клике на изображение',
        linkUrl: 'URL ссылки (опционально)',
        linkUrlPlaceholder: 'https://...',
        relExceptNofollow: 'Rel (кроме nofollow)',
        relPlaceholder: 'sponsored, ugc, ...',
        openNewWindow: 'Открывать в новом окне',
        nofollow: 'nofollow',
        removeImage: 'Удалить изображение',
        uploadReplace: 'Заменить изображение: нажмите для загрузки',
        uploadClick: 'Нажмите для загрузки или перетащите файл',
        uploadFormats: 'JPG, PNG, GIF, WebP, AVIF, HEIC, SVG',
        uploading: 'Загрузка...',
        uploadSuccess: 'Загружено успешно',
        chooseFromUploaded: 'Выбрать из загруженных',
        orEnterUrl: 'или введите URL',
        loadingImages: 'Загрузка изображений...',
        noImages: 'Нет загруженных изображений',
        imageSelected: 'Изображение выбрано',
        closeGallery: 'Закрыть галерею',
        deleteConfirm: 'Удалить'
    },

    // Link module
    link: {
        title: 'Вставить ссылку',
        editTitle: 'Редактировать ссылку',
        url: 'URL',
        linkText: 'Текст ссылки',
        titleAttr: 'Title (подсказка)',
        openNewWindow: 'Открывать в новом окне',
        nofollow: 'nofollow',
        removeLink: 'Удалить ссылку',
        relExceptNofollow: 'Rel (кроме nofollow)',
        relPlaceholder: 'sponsored, ugc, ...'
    },

    // Table module
    table: {
        title: 'Вставить таблицу',
        rows: 'Строки',
        columns: 'Столбцы',
        firstRowHeader: 'Первая строка — заголовок',
        insertColumnLeft: 'Вставить столбец слева',
        insertColumnRight: 'Вставить столбец справа',
        insertRowAbove: 'Вставить строку выше',
        insertRowBelow: 'Вставить строку ниже',
        makeRegular: 'Сделать обычной (TD)',
        makeHeader: 'Сделать заголовком (TH)',
        makeRowHeader: 'Сделать строку заголовком',
        cellAttributes: 'Атрибуты ячейки',
        rowAttributes: 'Атрибуты строки',
        deleteColumn: 'Удалить столбец',
        deleteRow: 'Удалить строку',
        deleteTable: 'Удалить таблицу',
        headerPrefix: 'Заголовок'
    },

    // Embed module (YouTube, Spotify, X, Instagram, TikTok, ...)
    embed: {
        title: 'Вставить embed',
        editTitle: 'Редактировать embed',
        removeEmbed: 'Удалить embed',
        tabUrl: 'По ссылке',
        tabCustom: 'Свой HTML',
        urlLabel: 'URL',
        urlHint: 'YouTube, Vimeo, Spotify, X, Instagram, TikTok, Reddit, Bluesky, SoundCloud, Twitch, CodePen, Loom, Maps, …',
        customLabel: 'Embed-код',
        customHint: 'Вставьте <iframe>-код с сайта-источника (например, LinkedIn, Facebook). Сохраняется только тег iframe.',
        captionLabel: 'Подпись',
        captionPlaceholder: 'Необязательно',
        edit: 'Редактировать embed',
        menuGroup: 'Embed'
    },

    // Code module
    code: {
        title: 'Вставить блок кода',
        editTitle: 'Редактировать блок кода',
        language: 'Язык программирования',
        languageNone: 'Не указан',
        codePlaceholder: 'Вставьте ваш код здесь...',
        removeCodeBlock: 'Удалить блок кода'
    },

    // Find & Replace module
    findReplace: {
        findPlaceholder: 'Найти...',
        replacePlaceholder: 'Заменить на...',
        replace: 'Заменить',
        replaceAll: 'Все',
        noResults: 'Не найдено',
        ofCount: 'из',
        previousTooltip: 'Предыдущий (Shift+Enter)',
        nextTooltip: 'Следующий (Enter)',
        closeTooltip: 'Закрыть (Esc)'
    },

    // Block Control module
    blockControl: {
        transformTo: 'Преобразовать в',
        paragraph: 'Параграф',
        heading1: 'Заголовок 1',
        heading2: 'Заголовок 2',
        heading3: 'Заголовок 3',
        quote: 'Цитата',
        callout: 'Выноска',
        calloutStyle: 'Стиль выноски',
        quoteStyle: 'Стиль цитаты',
        noStyle: 'Без стиля',
        warning: 'Предупреждение',
        danger: 'Опасность',
        information: 'Информация',
        success: 'Успех',
        standard: 'Стандартный',
        big: 'Большой',
        listType: 'Тип списка',
        bulleted: 'Маркированный',
        numbered: 'Нумерованный',
        actions: 'Действия',
        insertBlockBelow: 'Вставить блок ниже',
        duplicate: 'Дублировать',
        attributes: 'Атрибуты',
        cellSettings: 'Настройки ячейки',
        rowSettings: 'Настройки строки',
        dragEntireList: 'Перетащить весь список',
        addEmoji: 'Добавить эмодзи',
        changeEmoji: 'Изменить эмодзи',
        removeEmoji: 'Убрать эмодзи',
        emojiOnly: 'Только эмодзи'
    },

    // QuoteCard module
    quoteCard: {
        menuCaption: 'Подпись',
        menuPhoto: 'Фото автора',
        addCaption: 'Добавить подпись',
        removeCaption: 'Убрать подпись',
        addAuthor: 'Добавить автора',
        editAuthor: 'Изменить автора',
        removePhoto: 'Убрать фото',
        removeAll: 'Удалить подпись',
        photoSection: 'Фото автора',
        photoUrl: 'URL фотографии',
        photoAlt: 'Alt текст фото',
        authorSection: 'Автор',
        authorName: 'Имя',
        authorNamePlaceholder: 'например, — Иван Иванов'    },

    // Attributes module
    attributes: {
        title: 'Атрибуты элемента',
        editing: 'Редактирование',
        idAnchor: 'ID (Якорь)',
        idPlaceholder: 'example-anchor',
        linkPrefix: 'Ссылка',
        classes: 'Классы (через пробел)',
        quickSelect: 'Быстрый выбор'
    },

    // Slash Commands
    slashCommands: {
        noCommands: 'Команды не найдены',
        heading1: 'Заголовок 1',
        heading1Desc: 'Большой заголовок раздела',
        heading2: 'Заголовок 2',
        heading2Desc: 'Средний заголовок раздела',
        heading3: 'Заголовок 3',
        heading3Desc: 'Малый заголовок раздела',
        quote: 'Цитата',
        quoteDesc: 'Блок цитаты',
        callout: 'Выноска',
        calloutDesc: 'Выделенный информационный блок',
        codeBlock: 'Блок кода',
        codeBlockDesc: 'Код с подсветкой синтаксиса',
        image: 'Изображение',
        imageDesc: 'Вставить изображение',
        embed: 'Embed',
        embedDesc: 'Видео, пост, плеер с любого сайта',
        table: 'Таблица',
        tableDesc: 'Вставить таблицу',
        divider: 'Разделитель',
        dividerDesc: 'Горизонтальная линия',
        numberedList: 'Нумерованный список',
        numberedListDesc: 'Список с номерами',
        bulletList: 'Маркированный список',
        bulletListDesc: 'Список с маркерами'
    },

    blockGap: {
        insertBlock: 'Вставить блок'
    },

    // Upload errors
    upload: {
        error: 'Ошибка загрузки',
        connectionError: 'Ошибка соединения',
        serverError: 'Ошибка сервера',
        invalidResponse: 'Некорректный ответ сервера',
        remove: 'Удалить'
    },

    // Counter
    counter: {
        chars: 'симв.',
        words: 'слов'
    }
};
