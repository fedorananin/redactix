/**
 * Hebrew localization for Redactix Editor
 */
export default {
    // General
    chars: 'תווים',
    words: 'מילים',

    // Modal buttons
    save: 'שמור',
    cancel: 'ביטול',
    remove: 'הסר',
    close: 'סגור',
    delete: 'מחק',

    // Toolbar tooltips
    toolbar: {
        insertImage: 'הוסף תמונה',
        insertTable: 'הוסף טבלה',
        insertYoutube: 'הוסף סרטון YouTube',
        insertCode: 'הוסף בלוק קוד',
        findReplace: 'חיפוש והחלפה (Ctrl+F)',
        fullscreen: 'מסך מלא',
        editHtml: 'ערוך HTML',
        bold: 'מודגש',
        italic: 'נטוי',
        underline: 'קו תחתון',
        strikethrough: 'קו חוצה',
        highlight: 'הדגשה',
        monospace: 'גופן קבוע',
        spoiler: 'ספוילר',
        link: 'קישור'
    },

    // Image module
    image: {
        title: 'הוסף תמונה',
        editTitle: 'ערוך תמונה',
        url: 'כתובת התמונה',
        alt: 'טקסט חלופי',
        altDescription: 'טקסט חלופי (תיאור)',
        title_attr: 'כותרת (טולטיפ)',
        srcset: 'Srcset (אופציונלי)',
        srcsetPlaceholder: 'small.jpg 320w, large.jpg 800w',
        loading: 'טעינה',
        loadingDefault: 'ברירת מחדל',
        loadingLazy: 'lazy (טעינה מושהית)',
        loadingEager: 'eager (טעינה מיידית)',
        caption: 'כיתוב',
        captionPlaceholder: 'תומך ב-HTML',
        linkSection: 'קישור בלחיצה על התמונה',
        linkUrl: 'כתובת קישור (אופציונלי)',
        linkUrlPlaceholder: 'https://...',
        relExceptNofollow: 'Rel (מלבד nofollow)',
        relPlaceholder: 'sponsored, ugc, ...',
        openNewWindow: 'פתח בחלון חדש',
        nofollow: 'nofollow',
        removeImage: 'הסר תמונה',
        uploadReplace: 'החלף תמונה: לחץ להעלאה',
        uploadClick: 'לחץ להעלאה או גרור ושחרר',
        uploadFormats: 'JPG, PNG, GIF, WebP, AVIF, HEIC, SVG',
        uploading: 'מעלה...',
        uploadSuccess: 'הועלה בהצלחה',
        chooseFromUploaded: 'בחר מתמונות שהועלו',
        orEnterUrl: 'או הזן כתובת',
        loadingImages: 'טוען תמונות...',
        noImages: 'אין תמונות שהועלו',
        imageSelected: 'תמונה נבחרה',
        closeGallery: 'סגור גלריה',
        deleteConfirm: 'מחק'
    },

    // Link module
    link: {
        title: 'הוסף קישור',
        editTitle: 'ערוך קישור',
        url: 'כתובת',
        linkText: 'טקסט הקישור',
        titleAttr: 'כותרת (טולטיפ)',
        openNewWindow: 'פתח בחלון חדש',
        nofollow: 'nofollow',
        removeLink: 'הסר קישור',
        relExceptNofollow: 'Rel (מלבד nofollow)',
        relPlaceholder: 'sponsored, ugc, ...'
    },

    // Table module
    table: {
        title: 'הוסף טבלה',
        rows: 'שורות',
        columns: 'עמודות',
        firstRowHeader: 'שורה ראשונה ככותרת',
        insertColumnLeft: 'הוסף עמודה משמאל',
        insertColumnRight: 'הוסף עמודה מימין',
        insertRowAbove: 'הוסף שורה מעל',
        insertRowBelow: 'הוסף שורה מתחת',
        makeRegular: 'הפוך לרגיל (TD)',
        makeHeader: 'הפוך לכותרת (TH)',
        makeRowHeader: 'הפוך שורה לכותרת',
        cellAttributes: 'מאפייני תא',
        rowAttributes: 'מאפייני שורה',
        deleteColumn: 'מחק עמודה',
        deleteRow: 'מחק שורה',
        deleteTable: 'מחק טבלה',
        headerPrefix: 'כותרת'
    },

    // YouTube module
    youtube: {
        title: 'YouTube',
        videoLink: 'קישור לסרטון YouTube',
        invalidUrl: 'כתובת YouTube לא תקינה'
    },

    // Code module
    code: {
        title: 'הוסף בלוק קוד',
        editTitle: 'ערוך בלוק קוד',
        language: 'שפת תכנות',
        languageNone: 'ללא',
        codePlaceholder: 'הדבק את הקוד כאן...',
        removeCodeBlock: 'הסר בלוק קוד'
    },

    // Find & Replace module
    findReplace: {
        findPlaceholder: 'חיפוש...',
        replacePlaceholder: 'החלף ב...',
        replace: 'החלף',
        replaceAll: 'הכל',
        noResults: 'אין תוצאות',
        ofCount: 'מתוך',
        previousTooltip: 'הקודם (Shift+Enter)',
        nextTooltip: 'הבא (Enter)',
        closeTooltip: 'סגור (Esc)'
    },

    // Block Control module
    blockControl: {
        transformTo: 'המר ל',
        paragraph: 'פסקה',
        heading1: 'כותרת 1',
        heading2: 'כותרת 2',
        heading3: 'כותרת 3',
        quote: 'ציטוט',
        callout: 'הדגשה',
        calloutStyle: 'סגנון הדגשה',
        quoteStyle: 'סגנון ציטוט',
        noStyle: 'ללא סגנון',
        warning: 'אזהרה',
        danger: 'סכנה',
        information: 'מידע',
        success: 'הצלחה',
        standard: 'רגיל',
        big: 'גדול',
        listType: 'סוג רשימה',
        bulleted: 'תבליטים',
        numbered: 'ממוספר',
        actions: 'פעולות',
        insertBlockBelow: 'הוסף בלוק מתחת',
        duplicate: 'שכפל',
        attributes: 'מאפיינים',
        cellSettings: 'הגדרות תא',
        rowSettings: 'הגדרות שורה',
        dragEntireList: 'גרור את כל הרשימה',
        citePlaceholder: 'הוסף ציטוט...',
        addCitation: 'הוסף ציטוט',
        removeCitation: 'הסר ציטוט'
    },

    // Attributes module
    attributes: {
        title: 'מאפייני אלמנט',
        editing: 'עריכה',
        idAnchor: 'מזהה (עוגן)',
        idPlaceholder: 'דוגמה-עוגן',
        linkPrefix: 'קישור',
        classes: 'מחלקות (מופרדות ברווח)',
        quickSelect: 'בחירה מהירה'
    },

    // Slash Commands
    slashCommands: {
        noCommands: 'לא נמצאו פקודות',
        heading1: 'כותרת 1',
        heading1Desc: 'כותרת מקטע גדולה',
        heading2: 'כותרת 2',
        heading2Desc: 'כותרת מקטע בינונית',
        heading3: 'כותרת 3',
        heading3Desc: 'כותרת מקטע קטנה',
        quote: 'ציטוט',
        quoteDesc: 'בלוק ציטוט',
        callout: 'הדגשה',
        calloutDesc: 'בלוק מידע מודגש',
        codeBlock: 'בלוק קוד',
        codeBlockDesc: 'קוד עם הדגשת תחביר',
        image: 'תמונה',
        imageDesc: 'הוסף תמונה',
        youtube: 'YouTube',
        youtubeDesc: 'הטמע סרטון',
        table: 'טבלה',
        tableDesc: 'הוסף טבלה',
        divider: 'מפריד',
        dividerDesc: 'קו מפריד אופקי',
        numberedList: 'רשימה ממוספרת',
        numberedListDesc: 'רשימה עם מספרים',
        bulletList: 'רשימת תבליטים',
        bulletListDesc: 'רשימה עם תבליטים'
    },

    // Upload errors
    upload: {
        error: 'ההעלאה נכשלה',
        connectionError: 'שגיאת חיבור',
        serverError: 'שגיאת שרת',
        invalidResponse: 'תגובת שרת לא תקינה',
        remove: 'הסר'
    },

    // Counter
    counter: {
        chars: 'תווים',
        words: 'מילים'
    }
};
