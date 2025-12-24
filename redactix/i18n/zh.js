/**
 * Chinese (Simplified) localization for Redactix Editor
 */
export default {
    // General
    chars: '字符',
    words: '词',
    
    // Modal buttons
    save: '保存',
    cancel: '取消',
    remove: '移除',
    close: '关闭',
    delete: '删除',
    
    // Toolbar tooltips
    toolbar: {
        insertImage: '插入图片',
        insertTable: '插入表格',
        insertYoutube: '插入YouTube视频',
        insertCode: '插入代码块',
        findReplace: '查找和替换 (Ctrl+F)',
        fullscreen: '全屏模式',
        editHtml: '编辑HTML',
        bold: '粗体',
        italic: '斜体',
        underline: '下划线',
        strikethrough: '删除线',
        highlight: '高亮',
        monospace: '等宽字体',
        spoiler: '剧透',
        link: '链接'
    },
    
    // Image module
    image: {
        title: '插入图片',
        editTitle: '编辑图片',
        url: '图片URL',
        alt: '替代文本',
        altDescription: '替代文本（描述）',
        title_attr: '标题（提示）',
        srcset: 'Srcset（可选）',
        srcsetPlaceholder: 'small.jpg 320w, large.jpg 800w',
        loading: '加载',
        loadingDefault: '默认',
        loadingLazy: 'lazy（延迟加载）',
        loadingEager: 'eager（立即加载）',
        caption: '图片说明',
        captionPlaceholder: '支持HTML',
        linkSection: '点击图片时的链接',
        linkUrl: '链接URL（可选）',
        linkUrlPlaceholder: 'https://...',
        relExceptNofollow: 'Rel（除nofollow外）',
        relPlaceholder: 'sponsored, ugc, ...',
        openNewWindow: '在新窗口中打开',
        nofollow: 'nofollow',
        removeImage: '移除图片',
        uploadReplace: '替换图片：点击上传',
        uploadClick: '点击上传或拖放',
        uploadFormats: 'JPG, PNG, GIF, WebP, AVIF, HEIC, SVG',
        uploading: '上传中...',
        uploadSuccess: '上传成功',
        chooseFromUploaded: '从已上传图片中选择',
        orEnterUrl: '或输入URL',
        loadingImages: '加载图片中...',
        noImages: '暂无上传的图片',
        imageSelected: '已选择图片',
        closeGallery: '关闭图库',
        deleteConfirm: '删除'
    },
    
    // Link module
    link: {
        title: '插入链接',
        editTitle: '编辑链接',
        url: 'URL',
        linkText: '链接文本',
        titleAttr: '标题（提示）',
        openNewWindow: '在新窗口中打开',
        nofollow: 'nofollow',
        removeLink: '移除链接',
        relExceptNofollow: 'Rel（除nofollow外）',
        relPlaceholder: 'sponsored, ugc, ...'
    },
    
    // Table module
    table: {
        title: '插入表格',
        rows: '行',
        columns: '列',
        firstRowHeader: '首行作为表头',
        insertColumnLeft: '在左侧插入列',
        insertColumnRight: '在右侧插入列',
        insertRowAbove: '在上方插入行',
        insertRowBelow: '在下方插入行',
        makeRegular: '设为普通单元格 (TD)',
        makeHeader: '设为表头 (TH)',
        makeRowHeader: '将行设为表头',
        cellAttributes: '单元格属性',
        rowAttributes: '行属性',
        deleteColumn: '删除列',
        deleteRow: '删除行',
        deleteTable: '删除表格',
        headerPrefix: '表头'
    },
    
    // YouTube module
    youtube: {
        title: 'YouTube',
        videoLink: 'YouTube视频链接',
        invalidUrl: '无效的YouTube URL'
    },
    
    // Code module
    code: {
        title: '插入代码块',
        editTitle: '编辑代码块',
        language: '编程语言',
        languageNone: '无',
        codePlaceholder: '在此粘贴代码...',
        removeCodeBlock: '移除代码块'
    },
    
    // Find & Replace module
    findReplace: {
        findPlaceholder: '查找...',
        replacePlaceholder: '替换为...',
        replace: '替换',
        replaceAll: '全部',
        noResults: '无结果',
        ofCount: '/',
        previousTooltip: '上一个 (Shift+Enter)',
        nextTooltip: '下一个 (Enter)',
        closeTooltip: '关闭 (Esc)'
    },
    
    // Block Control module
    blockControl: {
        transformTo: '转换为',
        paragraph: '段落',
        heading1: '标题1',
        heading2: '标题2',
        heading3: '标题3',
        quote: '引用',
        callout: '提示框',
        calloutStyle: '提示框样式',
        quoteStyle: '引用样式',
        noStyle: '无样式',
        warning: '警告',
        danger: '危险',
        information: '信息',
        success: '成功',
        standard: '标准',
        big: '大',
        listType: '列表类型',
        bulleted: '项目符号',
        numbered: '编号',
        actions: '操作',
        insertBlockBelow: '在下方插入块',
        duplicate: '复制',
        attributes: '属性',
        cellSettings: '单元格设置',
        rowSettings: '行设置',
        dragEntireList: '拖动整个列表'
    },
    
    // Attributes module
    attributes: {
        title: '元素属性',
        editing: '编辑',
        idAnchor: 'ID（锚点）',
        idPlaceholder: 'example-anchor',
        linkPrefix: '链接',
        classes: '类（空格分隔）',
        quickSelect: '快速选择'
    },
    
    // Slash Commands
    slashCommands: {
        noCommands: '未找到命令',
        heading1: '标题1',
        heading1Desc: '大型章节标题',
        heading2: '标题2',
        heading2Desc: '中型章节标题',
        heading3: '标题3',
        heading3Desc: '小型章节标题',
        quote: '引用',
        quoteDesc: '引用块',
        callout: '提示框',
        calloutDesc: '高亮信息块',
        codeBlock: '代码块',
        codeBlockDesc: '语法高亮代码',
        image: '图片',
        imageDesc: '插入图片',
        youtube: 'YouTube',
        youtubeDesc: '嵌入视频',
        table: '表格',
        tableDesc: '插入表格',
        divider: '分隔线',
        dividerDesc: '水平分隔线',
        numberedList: '编号列表',
        numberedListDesc: '带编号的列表',
        bulletList: '项目符号列表',
        bulletListDesc: '带项目符号的列表'
    },
    
    // Upload errors
    upload: {
        error: '上传失败',
        connectionError: '连接错误',
        serverError: '服务器错误',
        invalidResponse: '无效的服务器响应',
        remove: '移除'
    },
    
    // Counter
    counter: {
        chars: '字符',
        words: '词'
    }
};
