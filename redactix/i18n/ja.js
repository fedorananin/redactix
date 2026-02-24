/**
 * Japanese localization for Redactix Editor
 */
export default {
    // General
    chars: '文字',
    words: '語',

    // Modal buttons
    save: '保存',
    cancel: 'キャンセル',
    remove: '削除',
    close: '閉じる',
    delete: '削除',

    // Toolbar tooltips
    toolbar: {
        insertImage: '画像を挿入',
        insertTable: '表を挿入',
        insertYoutube: 'YouTube動画を挿入',
        insertCode: 'コードブロックを挿入',
        findReplace: '検索と置換 (Ctrl+F)',
        fullscreen: 'フルスクリーン',
        editHtml: 'HTMLを編集',
        bold: '太字',
        italic: '斜体',
        underline: '下線',
        strikethrough: '取り消し線',
        highlight: 'ハイライト',
        monospace: '等幅フォント',
        spoiler: 'スポイラー',
        link: 'リンク'
    },

    // Image module
    image: {
        title: '画像を挿入',
        editTitle: '画像を編集',
        url: '画像URL',
        alt: '代替テキスト',
        altDescription: '代替テキスト（説明）',
        title_attr: 'タイトル（ツールチップ）',
        srcset: 'Srcset（任意）',
        srcsetPlaceholder: 'small.jpg 320w, large.jpg 800w',
        loading: '読み込み',
        loadingDefault: 'デフォルト',
        loadingLazy: 'lazy（遅延読み込み）',
        loadingEager: 'eager（即時読み込み）',
        caption: 'キャプション',
        captionPlaceholder: 'HTML対応',
        linkSection: '画像クリック時のリンク',
        linkUrl: 'リンクURL（任意）',
        linkUrlPlaceholder: 'https://...',
        relExceptNofollow: 'Rel（nofollow以外）',
        relPlaceholder: 'sponsored, ugc, ...',
        openNewWindow: '新しいウィンドウで開く',
        nofollow: 'nofollow',
        removeImage: '画像を削除',
        uploadReplace: '画像を置換：クリックしてアップロード',
        uploadClick: 'クリックしてアップロードまたはドラッグ＆ドロップ',
        uploadFormats: 'JPG, PNG, GIF, WebP, AVIF, HEIC, SVG',
        uploading: 'アップロード中...',
        uploadSuccess: 'アップロード完了',
        chooseFromUploaded: 'アップロード済み画像から選択',
        orEnterUrl: 'またはURLを入力',
        loadingImages: '画像を読み込み中...',
        noImages: 'アップロードされた画像がありません',
        imageSelected: '画像を選択しました',
        closeGallery: 'ギャラリーを閉じる',
        deleteConfirm: '削除'
    },

    // Link module
    link: {
        title: 'リンクを挿入',
        editTitle: 'リンクを編集',
        url: 'URL',
        linkText: 'リンクテキスト',
        titleAttr: 'タイトル（ツールチップ）',
        openNewWindow: '新しいウィンドウで開く',
        nofollow: 'nofollow',
        removeLink: 'リンクを削除',
        relExceptNofollow: 'Rel（nofollow以外）',
        relPlaceholder: 'sponsored, ugc, ...'
    },

    // Table module
    table: {
        title: '表を挿入',
        rows: '行',
        columns: '列',
        firstRowHeader: '1行目をヘッダーにする',
        insertColumnLeft: '左に列を挿入',
        insertColumnRight: '右に列を挿入',
        insertRowAbove: '上に行を挿入',
        insertRowBelow: '下に行を挿入',
        makeRegular: '通常セルにする (TD)',
        makeHeader: 'ヘッダーにする (TH)',
        makeRowHeader: '行をヘッダーにする',
        cellAttributes: 'セルの属性',
        rowAttributes: '行の属性',
        deleteColumn: '列を削除',
        deleteRow: '行を削除',
        deleteTable: '表を削除',
        headerPrefix: 'ヘッダー'
    },

    // YouTube module
    youtube: {
        title: 'YouTube',
        videoLink: 'YouTube動画リンク',
        invalidUrl: '無効なYouTube URL'
    },

    // Code module
    code: {
        title: 'コードブロックを挿入',
        editTitle: 'コードブロックを編集',
        language: 'プログラミング言語',
        languageNone: 'なし',
        codePlaceholder: 'ここにコードを貼り付け...',
        removeCodeBlock: 'コードブロックを削除'
    },

    // Find & Replace module
    findReplace: {
        findPlaceholder: '検索...',
        replacePlaceholder: '置換...',
        replace: '置換',
        replaceAll: 'すべて',
        noResults: '結果なし',
        ofCount: '/',
        previousTooltip: '前へ (Shift+Enter)',
        nextTooltip: '次へ (Enter)',
        closeTooltip: '閉じる (Esc)'
    },

    // Block Control module
    blockControl: {
        transformTo: '変換',
        paragraph: '段落',
        heading1: '見出し1',
        heading2: '見出し2',
        heading3: '見出し3',
        quote: '引用',
        callout: '注釈',
        calloutStyle: '注釈スタイル',
        quoteStyle: '引用スタイル',
        noStyle: 'スタイルなし',
        warning: '警告',
        danger: '危険',
        information: '情報',
        success: '成功',
        standard: '標準',
        big: '大',
        listType: 'リストタイプ',
        bulleted: '箇条書き',
        numbered: '番号付き',
        actions: 'アクション',
        insertBlockBelow: '下にブロックを挿入',
        duplicate: '複製',
        attributes: '属性',
        cellSettings: 'セル設定',
        rowSettings: '行設定',
        dragEntireList: 'リスト全体をドラッグ',
        citePlaceholder: '引用元を追加...',
        addCitation: '引用元を追加',
        removeCitation: '引用元を削除'
    },

    // Attributes module
    attributes: {
        title: '要素の属性',
        editing: '編集中',
        idAnchor: 'ID（アンカー）',
        idPlaceholder: 'example-anchor',
        linkPrefix: 'リンク',
        classes: 'クラス（スペース区切り）',
        quickSelect: 'クイック選択'
    },

    // Slash Commands
    slashCommands: {
        noCommands: 'コマンドが見つかりません',
        heading1: '見出し1',
        heading1Desc: '大きなセクション見出し',
        heading2: '見出し2',
        heading2Desc: '中くらいのセクション見出し',
        heading3: '見出し3',
        heading3Desc: '小さなセクション見出し',
        quote: '引用',
        quoteDesc: '引用ブロック',
        callout: '注釈',
        calloutDesc: '強調情報ブロック',
        codeBlock: 'コードブロック',
        codeBlockDesc: 'シンタックスハイライト付きコード',
        image: '画像',
        imageDesc: '画像を挿入',
        youtube: 'YouTube',
        youtubeDesc: '動画を埋め込む',
        table: '表',
        tableDesc: '表を挿入',
        divider: '区切り線',
        dividerDesc: '水平区切り線',
        numberedList: '番号付きリスト',
        numberedListDesc: '番号付きのリスト',
        bulletList: '箇条書きリスト',
        bulletListDesc: '箇条書きのリスト'
    },

    // Upload errors
    upload: {
        error: 'アップロード失敗',
        connectionError: '接続エラー',
        serverError: 'サーバーエラー',
        invalidResponse: '無効なサーバー応答',
        remove: '削除'
    },

    // Counter
    counter: {
        chars: '文字',
        words: '語'
    }
};
