/**
 * English localization for Redactix Editor
 */
export default {
    // General
    chars: 'chars',
    words: 'words',

    // Modal buttons
    save: 'Save',
    cancel: 'Cancel',
    remove: 'Remove',
    close: 'Close',
    delete: 'Delete',

    // Toolbar tooltips
    toolbar: {
        insertImage: 'Insert Image',
        insertEmbed: 'Insert Embed',
        insertTable: 'Insert Table',
        insertCode: 'Insert Code Block',
        findReplace: 'Find and Replace (Ctrl+F)',
        fullscreen: 'Fullscreen Mode',
        editHtml: 'Edit HTML',
        bold: 'Bold',
        italic: 'Italic',
        underline: 'Underline',
        strikethrough: 'Strikethrough',
        highlight: 'Highlight',
        monospace: 'Monospace',
        spoiler: 'Spoiler',
        link: 'Link'
    },

    // Image module
    image: {
        title: 'Insert Image',
        editTitle: 'Edit Image',
        url: 'Image URL',
        alt: 'Alt text',
        altDescription: 'Alt text (description)',
        title_attr: 'Title (tooltip)',
        srcset: 'Srcset (optional)',
        srcsetPlaceholder: 'small.jpg 320w, large.jpg 800w',
        loading: 'Loading',
        loadingDefault: 'Default',
        loadingLazy: 'lazy (deferred loading)',
        loadingEager: 'eager (immediate loading)',
        caption: 'Caption',
        captionPlaceholder: 'HTML supported',
        linkSection: 'Link on image click',
        linkUrl: 'Link URL (optional)',
        linkUrlPlaceholder: 'https://...',
        relExceptNofollow: 'Rel (except nofollow)',
        relPlaceholder: 'sponsored, ugc, ...',
        openNewWindow: 'Open in new window',
        nofollow: 'nofollow',
        removeImage: 'Remove Image',
        uploadReplace: 'Replace image: click to upload',
        uploadClick: 'Click to upload or drag & drop',
        uploadFormats: 'JPG, PNG, GIF, WebP, AVIF, HEIC, SVG',
        uploading: 'Uploading...',
        uploadSuccess: 'Uploaded successfully',
        chooseFromUploaded: 'Choose from uploaded images',
        orEnterUrl: 'or enter URL',
        loadingImages: 'Loading images...',
        noImages: 'No images uploaded yet',
        imageSelected: 'Image selected',
        closeGallery: 'Close gallery',
        deleteConfirm: 'Delete'
    },

    // Link module
    link: {
        title: 'Insert Link',
        editTitle: 'Edit Link',
        url: 'URL',
        linkText: 'Link Text',
        titleAttr: 'Title (tooltip)',
        openNewWindow: 'Open in new window',
        nofollow: 'nofollow',
        removeLink: 'Remove Link',
        relExceptNofollow: 'Rel (except nofollow)',
        relPlaceholder: 'sponsored, ugc, ...'
    },

    // Table module
    table: {
        title: 'Insert Table',
        rows: 'Rows',
        columns: 'Columns',
        firstRowHeader: 'First row is header',
        insertColumnLeft: 'Insert column left',
        insertColumnRight: 'Insert column right',
        insertRowAbove: 'Insert row above',
        insertRowBelow: 'Insert row below',
        makeRegular: 'Make regular (TD)',
        makeHeader: 'Make header (TH)',
        makeRowHeader: 'Make row a header',
        cellAttributes: 'Cell Attributes',
        rowAttributes: 'Row Attributes',
        deleteColumn: 'Delete column',
        deleteRow: 'Delete row',
        deleteTable: 'Delete table',
        headerPrefix: 'Header'
    },

    // Embed module (YouTube, Spotify, X, Instagram, TikTok, ...)
    embed: {
        title: 'Insert Embed',
        editTitle: 'Edit Embed',
        removeEmbed: 'Remove Embed',
        tabUrl: 'From URL',
        tabCustom: 'Custom HTML',
        urlLabel: 'URL',
        urlHint: 'YouTube, Vimeo, Spotify, X, Instagram, TikTok, Reddit, Bluesky, SoundCloud, Twitch, CodePen, Loom, Maps, …',
        customLabel: 'Embed code',
        customHint: 'Paste an <iframe> code from the source site (e.g. LinkedIn, Facebook). Only iframe tags are kept.',
        captionLabel: 'Caption',
        captionPlaceholder: 'Optional',
        edit: 'Edit embed',
        menuGroup: 'Embed'
    },

    // Code module
    code: {
        title: 'Insert Code Block',
        editTitle: 'Edit Code Block',
        language: 'Programming Language',
        languageNone: 'None',
        codePlaceholder: 'Paste your code here...',
        removeCodeBlock: 'Remove Code Block'
    },

    // Find & Replace module
    findReplace: {
        findPlaceholder: 'Find...',
        replacePlaceholder: 'Replace with...',
        replace: 'Replace',
        replaceAll: 'All',
        noResults: 'No results',
        ofCount: 'of',
        previousTooltip: 'Previous (Shift+Enter)',
        nextTooltip: 'Next (Enter)',
        closeTooltip: 'Close (Esc)'
    },

    // Block Control module
    blockControl: {
        transformTo: 'Transform to',
        paragraph: 'Paragraph',
        heading1: 'Heading 1',
        heading2: 'Heading 2',
        heading3: 'Heading 3',
        quote: 'Quote',
        callout: 'Callout',
        calloutStyle: 'Callout Style',
        quoteStyle: 'Quote Style',
        noStyle: 'No Style',
        warning: 'Warning',
        danger: 'Danger',
        information: 'Information',
        success: 'Success',
        standard: 'Standard',
        big: 'Big',
        listType: 'List Type',
        bulleted: 'Bulleted',
        numbered: 'Numbered',
        actions: 'Actions',
        insertBlockBelow: 'Insert block below',
        duplicate: 'Duplicate',
        attributes: 'Attributes',
        cellSettings: 'Cell Settings',
        rowSettings: 'Row Settings',
        dragEntireList: 'Drag entire list',
        addEmoji: 'Add Emoji',
        changeEmoji: 'Change Emoji',
        removeEmoji: 'Remove Emoji',
        emojiOnly: 'Emoji only'
    },

    // QuoteCard module
    quoteCard: {
        menuCaption: 'Caption',
        menuPhoto: 'Author photo',
        addCaption: 'Add caption',
        removeCaption: 'Remove caption',
        addAuthor: 'Add author',
        editAuthor: 'Edit author',
        removePhoto: 'Remove photo',
        removeAll: 'Remove caption',
        photoSection: 'Author photo',
        photoUrl: 'Photo URL',
        photoAlt: 'Photo alt text',
        authorSection: 'Author',
        authorName: 'Name',
        authorNamePlaceholder: 'e.g. — Ivan Ivanov'    },

    // Attributes module
    attributes: {
        title: 'Element Attributes',
        editing: 'Editing',
        idAnchor: 'ID (Anchor)',
        idPlaceholder: 'example-anchor',
        linkPrefix: 'Link',
        classes: 'Classes (space separated)',
        quickSelect: 'Quick select'
    },

    // Slash Commands
    slashCommands: {
        noCommands: 'No commands found',
        heading1: 'Heading 1',
        heading1Desc: 'Large section heading',
        heading2: 'Heading 2',
        heading2Desc: 'Medium section heading',
        heading3: 'Heading 3',
        heading3Desc: 'Small section heading',
        quote: 'Quote',
        quoteDesc: 'Blockquote for citations',
        callout: 'Callout',
        calloutDesc: 'Highlighted info block',
        codeBlock: 'Code Block',
        codeBlockDesc: 'Code with syntax highlighting',
        image: 'Image',
        imageDesc: 'Insert an image',
        embed: 'Embed',
        embedDesc: 'Video, post, player from any site',
        table: 'Table',
        tableDesc: 'Insert a table',
        divider: 'Divider',
        dividerDesc: 'Horizontal separator line',
        numberedList: 'Numbered List',
        numberedListDesc: 'List with numbers',
        bulletList: 'Bullet List',
        bulletListDesc: 'List with bullets'
    },

    blockGap: {
        insertBlock: 'Insert block here'
    },

    // Upload errors
    upload: {
        error: 'Upload failed',
        connectionError: 'Connection error',
        serverError: 'Server error',
        invalidResponse: 'Invalid server response',
        remove: 'Remove'
    },

    // Counter
    counter: {
        chars: 'chars',
        words: 'words'
    }
};
