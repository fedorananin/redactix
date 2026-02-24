/**
 * Arabic localization for Redactix Editor
 */
export default {
    // General
    chars: 'حرف',
    words: 'كلمة',

    // Modal buttons
    save: 'حفظ',
    cancel: 'إلغاء',
    remove: 'إزالة',
    close: 'إغلاق',
    delete: 'حذف',

    // Toolbar tooltips
    toolbar: {
        insertImage: 'إدراج صورة',
        insertTable: 'إدراج جدول',
        insertYoutube: 'إدراج فيديو يوتيوب',
        insertCode: 'إدراج كتلة برمجية',
        findReplace: 'بحث واستبدال (Ctrl+F)',
        fullscreen: 'وضع ملء الشاشة',
        editHtml: 'تحرير HTML',
        bold: 'عريض',
        italic: 'مائل',
        underline: 'تسطير',
        strikethrough: 'يتوسطه خط',
        highlight: 'تمييز',
        monospace: 'خط ثابت العرض',
        spoiler: 'مخفي',
        link: 'رابط'
    },

    // Image module
    image: {
        title: 'إدراج صورة',
        editTitle: 'تحرير الصورة',
        url: 'رابط الصورة',
        alt: 'النص البديل',
        altDescription: 'النص البديل (الوصف)',
        title_attr: 'العنوان (تلميح)',
        srcset: 'Srcset (اختياري)',
        srcsetPlaceholder: 'small.jpg 320w, large.jpg 800w',
        loading: 'التحميل',
        loadingDefault: 'افتراضي',
        loadingLazy: 'lazy (تحميل مؤجل)',
        loadingEager: 'eager (تحميل فوري)',
        caption: 'التسمية التوضيحية',
        captionPlaceholder: 'يدعم HTML',
        linkSection: 'رابط عند النقر على الصورة',
        linkUrl: 'رابط URL (اختياري)',
        linkUrlPlaceholder: 'https://...',
        relExceptNofollow: 'Rel (باستثناء nofollow)',
        relPlaceholder: 'sponsored, ugc, ...',
        openNewWindow: 'فتح في نافذة جديدة',
        nofollow: 'nofollow',
        removeImage: 'إزالة الصورة',
        uploadReplace: 'استبدال الصورة: انقر للرفع',
        uploadClick: 'انقر للرفع أو اسحب وأفلت',
        uploadFormats: 'JPG, PNG, GIF, WebP, AVIF, HEIC, SVG',
        uploading: 'جاري الرفع...',
        uploadSuccess: 'تم الرفع بنجاح',
        chooseFromUploaded: 'اختر من الصور المرفوعة',
        orEnterUrl: 'أو أدخل رابط URL',
        loadingImages: 'جاري تحميل الصور...',
        noImages: 'لا توجد صور مرفوعة بعد',
        imageSelected: 'تم اختيار الصورة',
        closeGallery: 'إغلاق المعرض',
        deleteConfirm: 'حذف'
    },

    // Link module
    link: {
        title: 'إدراج رابط',
        editTitle: 'تحرير الرابط',
        url: 'الرابط',
        linkText: 'نص الرابط',
        titleAttr: 'العنوان (تلميح)',
        openNewWindow: 'فتح في نافذة جديدة',
        nofollow: 'nofollow',
        removeLink: 'إزالة الرابط',
        relExceptNofollow: 'Rel (باستثناء nofollow)',
        relPlaceholder: 'sponsored, ugc, ...'
    },

    // Table module
    table: {
        title: 'إدراج جدول',
        rows: 'الصفوف',
        columns: 'الأعمدة',
        firstRowHeader: 'الصف الأول كعنوان',
        insertColumnLeft: 'إدراج عمود يساراً',
        insertColumnRight: 'إدراج عمود يميناً',
        insertRowAbove: 'إدراج صف أعلى',
        insertRowBelow: 'إدراج صف أسفل',
        makeRegular: 'جعلها عادية (TD)',
        makeHeader: 'جعلها عنوان (TH)',
        makeRowHeader: 'جعل الصف عنواناً',
        cellAttributes: 'خصائص الخلية',
        rowAttributes: 'خصائص الصف',
        deleteColumn: 'حذف العمود',
        deleteRow: 'حذف الصف',
        deleteTable: 'حذف الجدول',
        headerPrefix: 'العنوان'
    },

    // YouTube module
    youtube: {
        title: 'يوتيوب',
        videoLink: 'رابط فيديو يوتيوب',
        invalidUrl: 'رابط يوتيوب غير صالح'
    },

    // Code module
    code: {
        title: 'إدراج كتلة برمجية',
        editTitle: 'تحرير الكتلة البرمجية',
        language: 'لغة البرمجة',
        languageNone: 'لا شيء',
        codePlaceholder: 'الصق الكود هنا...',
        removeCodeBlock: 'إزالة الكتلة البرمجية'
    },

    // Find & Replace module
    findReplace: {
        findPlaceholder: 'بحث...',
        replacePlaceholder: 'استبدال بـ...',
        replace: 'استبدال',
        replaceAll: 'الكل',
        noResults: 'لا توجد نتائج',
        ofCount: 'من',
        previousTooltip: 'السابق (Shift+Enter)',
        nextTooltip: 'التالي (Enter)',
        closeTooltip: 'إغلاق (Esc)'
    },

    // Block Control module
    blockControl: {
        transformTo: 'تحويل إلى',
        paragraph: 'فقرة',
        heading1: 'عنوان 1',
        heading2: 'عنوان 2',
        heading3: 'عنوان 3',
        quote: 'اقتباس',
        callout: 'تنبيه',
        calloutStyle: 'نمط التنبيه',
        quoteStyle: 'نمط الاقتباس',
        noStyle: 'بدون نمط',
        warning: 'تحذير',
        danger: 'خطر',
        information: 'معلومات',
        success: 'نجاح',
        standard: 'قياسي',
        big: 'كبير',
        listType: 'نوع القائمة',
        bulleted: 'نقطية',
        numbered: 'مرقمة',
        actions: 'إجراءات',
        insertBlockBelow: 'إدراج كتلة أدناه',
        duplicate: 'تكرار',
        attributes: 'الخصائص',
        cellSettings: 'إعدادات الخلية',
        rowSettings: 'إعدادات الصف',
        dragEntireList: 'سحب القائمة بأكملها',
        citePlaceholder: 'إضافة اقتباس...',
        addCitation: 'إضافة اقتباس',
        removeCitation: 'إزالة الاقتباس'
    },

    // Attributes module
    attributes: {
        title: 'خصائص العنصر',
        editing: 'تحرير',
        idAnchor: 'المعرف (مرساة)',
        idPlaceholder: 'مثال-مرساة',
        linkPrefix: 'رابط',
        classes: 'الفئات (مفصولة بمسافات)',
        quickSelect: 'اختيار سريع'
    },

    // Slash Commands
    slashCommands: {
        noCommands: 'لم يتم العثور على أوامر',
        heading1: 'عنوان 1',
        heading1Desc: 'عنوان قسم كبير',
        heading2: 'عنوان 2',
        heading2Desc: 'عنوان قسم متوسط',
        heading3: 'عنوان 3',
        heading3Desc: 'عنوان قسم صغير',
        quote: 'اقتباس',
        quoteDesc: 'كتلة اقتباس',
        callout: 'تنبيه',
        calloutDesc: 'كتلة معلومات مميزة',
        codeBlock: 'كتلة برمجية',
        codeBlockDesc: 'كود مع تلوين النحو',
        image: 'صورة',
        imageDesc: 'إدراج صورة',
        youtube: 'يوتيوب',
        youtubeDesc: 'تضمين فيديو',
        table: 'جدول',
        tableDesc: 'إدراج جدول',
        divider: 'فاصل',
        dividerDesc: 'خط فاصل أفقي',
        numberedList: 'قائمة مرقمة',
        numberedListDesc: 'قائمة بأرقام',
        bulletList: 'قائمة نقطية',
        bulletListDesc: 'قائمة بنقاط'
    },

    // Upload errors
    upload: {
        error: 'فشل الرفع',
        connectionError: 'خطأ في الاتصال',
        serverError: 'خطأ في الخادم',
        invalidResponse: 'استجابة خادم غير صالحة',
        remove: 'إزالة'
    },

    // Counter
    counter: {
        chars: 'حرف',
        words: 'كلمة'
    }
};
