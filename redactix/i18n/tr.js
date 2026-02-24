/**
 * Turkish localization for Redactix Editor
 */
export default {
    // General
    chars: 'karakter',
    words: 'kelime',

    // Modal buttons
    save: 'Kaydet',
    cancel: 'İptal',
    remove: 'Kaldır',
    close: 'Kapat',
    delete: 'Sil',

    // Toolbar tooltips
    toolbar: {
        insertImage: 'Resim Ekle',
        insertTable: 'Tablo Ekle',
        insertYoutube: 'YouTube Videosu Ekle',
        insertCode: 'Kod Bloğu Ekle',
        findReplace: 'Bul ve Değiştir (Ctrl+F)',
        fullscreen: 'Tam Ekran Modu',
        editHtml: 'HTML Düzenle',
        bold: 'Kalın',
        italic: 'İtalik',
        underline: 'Altı Çizili',
        strikethrough: 'Üstü Çizili',
        highlight: 'Vurgula',
        monospace: 'Monospace',
        spoiler: 'Spoiler',
        link: 'Bağlantı'
    },

    // Image module
    image: {
        title: 'Resim Ekle',
        editTitle: 'Resmi Düzenle',
        url: 'Resim URL',
        alt: 'Alt metni',
        altDescription: 'Alt metni (açıklama)',
        title_attr: 'Başlık (araç ipucu)',
        srcset: 'Srcset (isteğe bağlı)',
        srcsetPlaceholder: 'small.jpg 320w, large.jpg 800w',
        loading: 'Yükleme',
        loadingDefault: 'Varsayılan',
        loadingLazy: 'lazy (gecikmeli yükleme)',
        loadingEager: 'eager (anında yükleme)',
        caption: 'Altyazı',
        captionPlaceholder: 'HTML desteklenir',
        linkSection: 'Resme tıklandığında bağlantı',
        linkUrl: 'Bağlantı URL (isteğe bağlı)',
        linkUrlPlaceholder: 'https://...',
        relExceptNofollow: 'Rel (nofollow hariç)',
        relPlaceholder: 'sponsored, ugc, ...',
        openNewWindow: 'Yeni pencerede aç',
        nofollow: 'nofollow',
        removeImage: 'Resmi Kaldır',
        uploadReplace: 'Resmi değiştir: yüklemek için tıkla',
        uploadClick: 'Yüklemek için tıkla veya sürükle bırak',
        uploadFormats: 'JPG, PNG, GIF, WebP, AVIF, HEIC, SVG',
        uploading: 'Yükleniyor...',
        uploadSuccess: 'Başarıyla yüklendi',
        chooseFromUploaded: 'Yüklenen resimlerden seç',
        orEnterUrl: 'veya URL gir',
        loadingImages: 'Resimler yükleniyor...',
        noImages: 'Henüz yüklenmiş resim yok',
        imageSelected: 'Resim seçildi',
        closeGallery: 'Galeriyi kapat',
        deleteConfirm: 'Sil'
    },

    // Link module
    link: {
        title: 'Bağlantı Ekle',
        editTitle: 'Bağlantıyı Düzenle',
        url: 'URL',
        linkText: 'Bağlantı Metni',
        titleAttr: 'Başlık (araç ipucu)',
        openNewWindow: 'Yeni pencerede aç',
        nofollow: 'nofollow',
        removeLink: 'Bağlantıyı Kaldır',
        relExceptNofollow: 'Rel (nofollow hariç)',
        relPlaceholder: 'sponsored, ugc, ...'
    },

    // Table module
    table: {
        title: 'Tablo Ekle',
        rows: 'Satırlar',
        columns: 'Sütunlar',
        firstRowHeader: 'İlk satır başlık olsun',
        insertColumnLeft: 'Sola sütun ekle',
        insertColumnRight: 'Sağa sütun ekle',
        insertRowAbove: 'Üste satır ekle',
        insertRowBelow: 'Alta satır ekle',
        makeRegular: 'Normal yap (TD)',
        makeHeader: 'Başlık yap (TH)',
        makeRowHeader: 'Satırı başlık yap',
        cellAttributes: 'Hücre Özellikleri',
        rowAttributes: 'Satır Özellikleri',
        deleteColumn: 'Sütunu sil',
        deleteRow: 'Satırı sil',
        deleteTable: 'Tabloyu sil',
        headerPrefix: 'Başlık'
    },

    // YouTube module
    youtube: {
        title: 'YouTube',
        videoLink: 'YouTube Video Bağlantısı',
        invalidUrl: 'Geçersiz YouTube URL'
    },

    // Code module
    code: {
        title: 'Kod Bloğu Ekle',
        editTitle: 'Kod Bloğunu Düzenle',
        language: 'Programlama Dili',
        languageNone: 'Hiçbiri',
        codePlaceholder: 'Kodunuzu buraya yapıştırın...',
        removeCodeBlock: 'Kod Bloğunu Kaldır'
    },

    // Find & Replace module
    findReplace: {
        findPlaceholder: 'Bul...',
        replacePlaceholder: 'Şununla değiştir...',
        replace: 'Değiştir',
        replaceAll: 'Tümü',
        noResults: 'Sonuç yok',
        ofCount: '/',
        previousTooltip: 'Önceki (Shift+Enter)',
        nextTooltip: 'Sonraki (Enter)',
        closeTooltip: 'Kapat (Esc)'
    },

    // Block Control module
    blockControl: {
        transformTo: 'Dönüştür',
        paragraph: 'Paragraf',
        heading1: 'Başlık 1',
        heading2: 'Başlık 2',
        heading3: 'Başlık 3',
        quote: 'Alıntı',
        callout: 'Bilgi Kutusu',
        calloutStyle: 'Bilgi Kutusu Stili',
        quoteStyle: 'Alıntı Stili',
        noStyle: 'Stil Yok',
        warning: 'Uyarı',
        danger: 'Tehlike',
        information: 'Bilgi',
        success: 'Başarı',
        standard: 'Standart',
        big: 'Büyük',
        listType: 'Liste Türü',
        bulleted: 'Madde İşaretli',
        numbered: 'Numaralı',
        actions: 'İşlemler',
        insertBlockBelow: 'Aşağıya blok ekle',
        duplicate: 'Çoğalt',
        attributes: 'Özellikler',
        cellSettings: 'Hücre Ayarları',
        rowSettings: 'Satır Ayarları',
        dragEntireList: 'Tüm listeyi sürükle',
        citePlaceholder: 'Alıntı ekle...',
        addCitation: 'Alıntı ekle',
        removeCitation: 'Alıntıyı kaldır'
    },

    // Attributes module
    attributes: {
        title: 'Eleman Özellikleri',
        editing: 'Düzenleme',
        idAnchor: 'ID (Çapa)',
        idPlaceholder: 'ornek-capa',
        linkPrefix: 'Bağlantı',
        classes: 'Sınıflar (boşlukla ayırın)',
        quickSelect: 'Hızlı seçim'
    },

    // Slash Commands
    slashCommands: {
        noCommands: 'Komut bulunamadı',
        heading1: 'Başlık 1',
        heading1Desc: 'Büyük bölüm başlığı',
        heading2: 'Başlık 2',
        heading2Desc: 'Orta bölüm başlığı',
        heading3: 'Başlık 3',
        heading3Desc: 'Küçük bölüm başlığı',
        quote: 'Alıntı',
        quoteDesc: 'Alıntı bloğu',
        callout: 'Bilgi Kutusu',
        calloutDesc: 'Vurgulanan bilgi bloğu',
        codeBlock: 'Kod Bloğu',
        codeBlockDesc: 'Sözdizimi vurgulu kod',
        image: 'Resim',
        imageDesc: 'Resim ekle',
        youtube: 'YouTube',
        youtubeDesc: 'Video yerleştir',
        table: 'Tablo',
        tableDesc: 'Tablo ekle',
        divider: 'Ayırıcı',
        dividerDesc: 'Yatay ayırıcı çizgi',
        numberedList: 'Numaralı Liste',
        numberedListDesc: 'Numaralı liste',
        bulletList: 'Madde İşaretli Liste',
        bulletListDesc: 'Madde işaretli liste'
    },

    // Upload errors
    upload: {
        error: 'Yükleme başarısız',
        connectionError: 'Bağlantı hatası',
        serverError: 'Sunucu hatası',
        invalidResponse: 'Geçersiz sunucu yanıtı',
        remove: 'Kaldır'
    },

    // Counter
    counter: {
        chars: 'karakter',
        words: 'kelime'
    }
};
