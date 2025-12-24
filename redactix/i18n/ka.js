/**
 * Georgian localization for Redactix Editor
 */
export default {
    // General
    chars: 'სიმბ.',
    words: 'სიტყვა',
    
    // Modal buttons
    save: 'შენახვა',
    cancel: 'გაუქმება',
    remove: 'წაშლა',
    close: 'დახურვა',
    delete: 'წაშლა',
    
    // Toolbar tooltips
    toolbar: {
        insertImage: 'სურათის ჩასმა',
        insertTable: 'ცხრილის ჩასმა',
        insertYoutube: 'YouTube ვიდეოს ჩასმა',
        insertCode: 'კოდის ბლოკის ჩასმა',
        findReplace: 'ძებნა და ჩანაცვლება (Ctrl+F)',
        fullscreen: 'სრულეკრანიანი რეჟიმი',
        editHtml: 'HTML-ის რედაქტირება',
        bold: 'მსხვილი',
        italic: 'დახრილი',
        underline: 'ხაზგასმული',
        strikethrough: 'გადახაზული',
        highlight: 'მონიშვნა',
        monospace: 'მონოსპეისი',
        spoiler: 'სპოილერი',
        link: 'ბმული'
    },
    
    // Image module
    image: {
        title: 'სურათის ჩასმა',
        editTitle: 'სურათის რედაქტირება',
        url: 'სურათის URL',
        alt: 'Alt ტექსტი',
        altDescription: 'Alt ტექსტი (აღწერა)',
        title_attr: 'სათაური (მინიშნება)',
        srcset: 'Srcset (არასავალდებულო)',
        srcsetPlaceholder: 'small.jpg 320w, large.jpg 800w',
        loading: 'ჩატვირთვა',
        loadingDefault: 'ნაგულისხმევი',
        loadingLazy: 'lazy (გადავადებული ჩატვირთვა)',
        loadingEager: 'eager (დაუყოვნებელი ჩატვირთვა)',
        caption: 'წარწერა',
        captionPlaceholder: 'HTML მხარდაჭერილია',
        linkSection: 'ბმული სურათზე დაჭერისას',
        linkUrl: 'ბმულის URL (არასავალდებულო)',
        linkUrlPlaceholder: 'https://...',
        relExceptNofollow: 'Rel (nofollow-ს გარდა)',
        relPlaceholder: 'sponsored, ugc, ...',
        openNewWindow: 'ახალ ფანჯარაში გახსნა',
        nofollow: 'nofollow',
        removeImage: 'სურათის წაშლა',
        uploadReplace: 'სურათის ჩანაცვლება: დააჭირეთ ატვირთვისთვის',
        uploadClick: 'დააჭირეთ ატვირთვისთვის ან გადმოიტანეთ',
        uploadFormats: 'JPG, PNG, GIF, WebP, AVIF, HEIC, SVG',
        uploading: 'იტვირთება...',
        uploadSuccess: 'წარმატებით აიტვირთა',
        chooseFromUploaded: 'აირჩიეთ ატვირთული სურათებიდან',
        orEnterUrl: 'ან შეიყვანეთ URL',
        loadingImages: 'სურათების ჩატვირთვა...',
        noImages: 'სურათები ჯერ არ არის ატვირთული',
        imageSelected: 'სურათი არჩეულია',
        closeGallery: 'გალერეის დახურვა',
        deleteConfirm: 'წაშლა'
    },
    
    // Link module
    link: {
        title: 'ბმულის ჩასმა',
        editTitle: 'ბმულის რედაქტირება',
        url: 'URL',
        linkText: 'ბმულის ტექსტი',
        titleAttr: 'სათაური (მინიშნება)',
        openNewWindow: 'ახალ ფანჯარაში გახსნა',
        nofollow: 'nofollow',
        removeLink: 'ბმულის წაშლა',
        relExceptNofollow: 'Rel (nofollow-ს გარდა)',
        relPlaceholder: 'sponsored, ugc, ...'
    },
    
    // Table module
    table: {
        title: 'ცხრილის ჩასმა',
        rows: 'მწკრივები',
        columns: 'სვეტები',
        firstRowHeader: 'პირველი მწკრივი სათაურია',
        insertColumnLeft: 'სვეტის ჩასმა მარცხნივ',
        insertColumnRight: 'სვეტის ჩასმა მარჯვნივ',
        insertRowAbove: 'მწკრივის ჩასმა ზემოთ',
        insertRowBelow: 'მწკრივის ჩასმა ქვემოთ',
        makeRegular: 'ჩვეულებრივად გადაკეთება (TD)',
        makeHeader: 'სათაურად გადაკეთება (TH)',
        makeRowHeader: 'მწკრივის სათაურად გადაკეთება',
        cellAttributes: 'უჯრედის ატრიბუტები',
        rowAttributes: 'მწკრივის ატრიბუტები',
        deleteColumn: 'სვეტის წაშლა',
        deleteRow: 'მწკრივის წაშლა',
        deleteTable: 'ცხრილის წაშლა',
        headerPrefix: 'სათაური'
    },
    
    // YouTube module
    youtube: {
        title: 'YouTube',
        videoLink: 'YouTube ვიდეოს ბმული',
        invalidUrl: 'არასწორი YouTube URL'
    },
    
    // Code module
    code: {
        title: 'კოდის ბლოკის ჩასმა',
        editTitle: 'კოდის ბლოკის რედაქტირება',
        language: 'პროგრამირების ენა',
        languageNone: 'არცერთი',
        codePlaceholder: 'ჩასვით კოდი აქ...',
        removeCodeBlock: 'კოდის ბლოკის წაშლა'
    },
    
    // Find & Replace module
    findReplace: {
        findPlaceholder: 'ძებნა...',
        replacePlaceholder: 'ჩანაცვლება...',
        replace: 'ჩანაცვლება',
        replaceAll: 'ყველა',
        noResults: 'შედეგები არ მოიძებნა',
        ofCount: '-დან',
        previousTooltip: 'წინა (Shift+Enter)',
        nextTooltip: 'შემდეგი (Enter)',
        closeTooltip: 'დახურვა (Esc)'
    },
    
    // Block Control module
    blockControl: {
        transformTo: 'გარდაქმნა',
        paragraph: 'აბზაცი',
        heading1: 'სათაური 1',
        heading2: 'სათაური 2',
        heading3: 'სათაური 3',
        quote: 'ციტატა',
        callout: 'გამოძახება',
        calloutStyle: 'გამოძახების სტილი',
        quoteStyle: 'ციტატის სტილი',
        noStyle: 'სტილის გარეშე',
        warning: 'გაფრთხილება',
        danger: 'საშიშროება',
        information: 'ინფორმაცია',
        success: 'წარმატება',
        standard: 'სტანდარტული',
        big: 'დიდი',
        listType: 'სიის ტიპი',
        bulleted: 'მარკირებული',
        numbered: 'ნომრირებული',
        actions: 'მოქმედებები',
        insertBlockBelow: 'ბლოკის ჩასმა ქვემოთ',
        duplicate: 'დუბლირება',
        attributes: 'ატრიბუტები',
        cellSettings: 'უჯრედის პარამეტრები',
        rowSettings: 'მწკრივის პარამეტრები',
        dragEntireList: 'მთელი სიის გადატანა'
    },
    
    // Attributes module
    attributes: {
        title: 'ელემენტის ატრიბუტები',
        editing: 'რედაქტირება',
        idAnchor: 'ID (ღუზა)',
        idPlaceholder: 'მაგალითი-ღუზა',
        linkPrefix: 'ბმული',
        classes: 'კლასები (გამოყოფილი ინტერვალით)',
        quickSelect: 'სწრაფი არჩევა'
    },
    
    // Slash Commands
    slashCommands: {
        noCommands: 'ბრძანებები ვერ მოიძებნა',
        heading1: 'სათაური 1',
        heading1Desc: 'სექციის დიდი სათაური',
        heading2: 'სათაური 2',
        heading2Desc: 'სექციის საშუალო სათაური',
        heading3: 'სათაური 3',
        heading3Desc: 'სექციის პატარა სათაური',
        quote: 'ციტატა',
        quoteDesc: 'ციტატის ბლოკი',
        callout: 'გამოძახება',
        calloutDesc: 'გამოყოფილი ინფორმაციის ბლოკი',
        codeBlock: 'კოდის ბლოკი',
        codeBlockDesc: 'კოდი სინტაქსის მონიშვნით',
        image: 'სურათი',
        imageDesc: 'სურათის ჩასმა',
        youtube: 'YouTube',
        youtubeDesc: 'ვიდეოს ჩასმა',
        table: 'ცხრილი',
        tableDesc: 'ცხრილის ჩასმა',
        divider: 'გამყოფი',
        dividerDesc: 'ჰორიზონტალური ხაზი',
        numberedList: 'ნომრირებული სია',
        numberedListDesc: 'სია ნომრებით',
        bulletList: 'მარკირებული სია',
        bulletListDesc: 'სია მარკერებით'
    },
    
    // Upload errors
    upload: {
        error: 'ატვირთვა ვერ მოხერხდა',
        connectionError: 'კავშირის შეცდომა',
        serverError: 'სერვერის შეცდომა',
        invalidResponse: 'არასწორი სერვერის პასუხი',
        remove: 'წაშლა'
    },
    
    // Counter
    counter: {
        chars: 'სიმბ.',
        words: 'სიტყვა'
    }
};
