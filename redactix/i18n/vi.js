/**
 * Vietnamese localization for Redactix Editor
 */
export default {
    // General
    chars: 'ký tự',
    words: 'từ',

    // Modal buttons
    save: 'Lưu',
    cancel: 'Hủy',
    remove: 'Xóa',
    close: 'Đóng',
    delete: 'Xóa',

    // Toolbar tooltips
    toolbar: {
        insertImage: 'Chèn hình ảnh',
        insertTable: 'Chèn bảng',
        insertYoutube: 'Chèn video YouTube',
        insertCode: 'Chèn khối mã',
        findReplace: 'Tìm và thay thế (Ctrl+F)',
        fullscreen: 'Chế độ toàn màn hình',
        editHtml: 'Chỉnh sửa HTML',
        bold: 'Đậm',
        italic: 'Nghiêng',
        underline: 'Gạch chân',
        strikethrough: 'Gạch ngang',
        highlight: 'Tô sáng',
        monospace: 'Monospace',
        spoiler: 'Spoiler',
        link: 'Liên kết'
    },

    // Image module
    image: {
        title: 'Chèn hình ảnh',
        editTitle: 'Chỉnh sửa hình ảnh',
        url: 'URL hình ảnh',
        alt: 'Văn bản alt',
        altDescription: 'Văn bản alt (mô tả)',
        title_attr: 'Tiêu đề (tooltip)',
        srcset: 'Srcset (tùy chọn)',
        srcsetPlaceholder: 'small.jpg 320w, large.jpg 800w',
        loading: 'Tải',
        loadingDefault: 'Mặc định',
        loadingLazy: 'lazy (tải chậm)',
        loadingEager: 'eager (tải ngay)',
        caption: 'Chú thích',
        captionPlaceholder: 'Hỗ trợ HTML',
        linkSection: 'Liên kết khi nhấp vào hình ảnh',
        linkUrl: 'URL liên kết (tùy chọn)',
        linkUrlPlaceholder: 'https://...',
        relExceptNofollow: 'Rel (ngoại trừ nofollow)',
        relPlaceholder: 'sponsored, ugc, ...',
        openNewWindow: 'Mở trong cửa sổ mới',
        nofollow: 'nofollow',
        removeImage: 'Xóa hình ảnh',
        uploadReplace: 'Thay thế hình ảnh: nhấp để tải lên',
        uploadClick: 'Nhấp để tải lên hoặc kéo thả',
        uploadFormats: 'JPG, PNG, GIF, WebP, AVIF, HEIC, SVG',
        uploading: 'Đang tải lên...',
        uploadSuccess: 'Tải lên thành công',
        chooseFromUploaded: 'Chọn từ hình ảnh đã tải lên',
        orEnterUrl: 'hoặc nhập URL',
        loadingImages: 'Đang tải hình ảnh...',
        noImages: 'Chưa có hình ảnh nào được tải lên',
        imageSelected: 'Đã chọn hình ảnh',
        closeGallery: 'Đóng thư viện',
        deleteConfirm: 'Xóa'
    },

    // Link module
    link: {
        title: 'Chèn liên kết',
        editTitle: 'Chỉnh sửa liên kết',
        url: 'URL',
        linkText: 'Văn bản liên kết',
        titleAttr: 'Tiêu đề (tooltip)',
        openNewWindow: 'Mở trong cửa sổ mới',
        nofollow: 'nofollow',
        removeLink: 'Xóa liên kết',
        relExceptNofollow: 'Rel (ngoại trừ nofollow)',
        relPlaceholder: 'sponsored, ugc, ...'
    },

    // Table module
    table: {
        title: 'Chèn bảng',
        rows: 'Hàng',
        columns: 'Cột',
        firstRowHeader: 'Hàng đầu tiên là tiêu đề',
        insertColumnLeft: 'Chèn cột bên trái',
        insertColumnRight: 'Chèn cột bên phải',
        insertRowAbove: 'Chèn hàng phía trên',
        insertRowBelow: 'Chèn hàng phía dưới',
        makeRegular: 'Đặt là ô thường (TD)',
        makeHeader: 'Đặt là tiêu đề (TH)',
        makeRowHeader: 'Đặt hàng là tiêu đề',
        cellAttributes: 'Thuộc tính ô',
        rowAttributes: 'Thuộc tính hàng',
        deleteColumn: 'Xóa cột',
        deleteRow: 'Xóa hàng',
        deleteTable: 'Xóa bảng',
        headerPrefix: 'Tiêu đề'
    },

    // YouTube module
    youtube: {
        title: 'YouTube',
        videoLink: 'Liên kết video YouTube',
        invalidUrl: 'URL YouTube không hợp lệ'
    },

    // Code module
    code: {
        title: 'Chèn khối mã',
        editTitle: 'Chỉnh sửa khối mã',
        language: 'Ngôn ngữ lập trình',
        languageNone: 'Không có',
        codePlaceholder: 'Dán mã của bạn vào đây...',
        removeCodeBlock: 'Xóa khối mã'
    },

    // Find & Replace module
    findReplace: {
        findPlaceholder: 'Tìm...',
        replacePlaceholder: 'Thay thế bằng...',
        replace: 'Thay thế',
        replaceAll: 'Tất cả',
        noResults: 'Không có kết quả',
        ofCount: 'của',
        previousTooltip: 'Trước (Shift+Enter)',
        nextTooltip: 'Tiếp theo (Enter)',
        closeTooltip: 'Đóng (Esc)'
    },

    // Block Control module
    blockControl: {
        transformTo: 'Chuyển thành',
        paragraph: 'Đoạn văn',
        heading1: 'Tiêu đề 1',
        heading2: 'Tiêu đề 2',
        heading3: 'Tiêu đề 3',
        quote: 'Trích dẫn',
        callout: 'Chú thích',
        calloutStyle: 'Kiểu chú thích',
        quoteStyle: 'Kiểu trích dẫn',
        noStyle: 'Không có kiểu',
        warning: 'Cảnh báo',
        danger: 'Nguy hiểm',
        information: 'Thông tin',
        success: 'Thành công',
        standard: 'Tiêu chuẩn',
        big: 'Lớn',
        listType: 'Loại danh sách',
        bulleted: 'Có dấu đầu dòng',
        numbered: 'Đánh số',
        actions: 'Hành động',
        insertBlockBelow: 'Chèn khối bên dưới',
        duplicate: 'Nhân đôi',
        attributes: 'Thuộc tính',
        cellSettings: 'Cài đặt ô',
        rowSettings: 'Cài đặt hàng',
        dragEntireList: 'Kéo toàn bộ danh sách',
        citePlaceholder: 'Thêm trích dẫn...',
        addCitation: 'Thêm trích dẫn',
        removeCitation: 'Xóa trích dẫn'
    },

    // Attributes module
    attributes: {
        title: 'Thuộc tính phần tử',
        editing: 'Đang chỉnh sửa',
        idAnchor: 'ID (Neo)',
        idPlaceholder: 'vi-du-neo',
        linkPrefix: 'Liên kết',
        classes: 'Lớp (cách nhau bằng dấu cách)',
        quickSelect: 'Chọn nhanh'
    },

    // Slash Commands
    slashCommands: {
        noCommands: 'Không tìm thấy lệnh',
        heading1: 'Tiêu đề 1',
        heading1Desc: 'Tiêu đề mục lớn',
        heading2: 'Tiêu đề 2',
        heading2Desc: 'Tiêu đề mục trung bình',
        heading3: 'Tiêu đề 3',
        heading3Desc: 'Tiêu đề mục nhỏ',
        quote: 'Trích dẫn',
        quoteDesc: 'Khối trích dẫn',
        callout: 'Chú thích',
        calloutDesc: 'Khối thông tin nổi bật',
        codeBlock: 'Khối mã',
        codeBlockDesc: 'Mã với tô sáng cú pháp',
        image: 'Hình ảnh',
        imageDesc: 'Chèn hình ảnh',
        youtube: 'YouTube',
        youtubeDesc: 'Nhúng video',
        table: 'Bảng',
        tableDesc: 'Chèn bảng',
        divider: 'Đường phân cách',
        dividerDesc: 'Đường ngang phân cách',
        numberedList: 'Danh sách đánh số',
        numberedListDesc: 'Danh sách có số',
        bulletList: 'Danh sách đầu dòng',
        bulletListDesc: 'Danh sách có dấu đầu dòng'
    },

    // Upload errors
    upload: {
        error: 'Tải lên thất bại',
        connectionError: 'Lỗi kết nối',
        serverError: 'Lỗi máy chủ',
        invalidResponse: 'Phản hồi máy chủ không hợp lệ',
        remove: 'Xóa'
    },

    // Counter
    counter: {
        chars: 'ký tự',
        words: 'từ'
    }
};
