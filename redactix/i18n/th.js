/**
 * Thai localization for Redactix Editor
 */
export default {
    // General
    chars: 'ตัวอักษร',
    words: 'คำ',
    
    // Modal buttons
    save: 'บันทึก',
    cancel: 'ยกเลิก',
    remove: 'ลบ',
    close: 'ปิด',
    delete: 'ลบ',
    
    // Toolbar tooltips
    toolbar: {
        insertImage: 'แทรกรูปภาพ',
        insertTable: 'แทรกตาราง',
        insertYoutube: 'แทรกวิดีโอ YouTube',
        insertCode: 'แทรกบล็อกโค้ด',
        findReplace: 'ค้นหาและแทนที่ (Ctrl+F)',
        fullscreen: 'โหมดเต็มหน้าจอ',
        editHtml: 'แก้ไข HTML',
        bold: 'ตัวหนา',
        italic: 'ตัวเอียง',
        underline: 'ขีดเส้นใต้',
        strikethrough: 'ขีดทับ',
        highlight: 'ไฮไลท์',
        monospace: 'Monospace',
        spoiler: 'สปอยเลอร์',
        link: 'ลิงก์'
    },
    
    // Image module
    image: {
        title: 'แทรกรูปภาพ',
        editTitle: 'แก้ไขรูปภาพ',
        url: 'URL รูปภาพ',
        alt: 'ข้อความ Alt',
        altDescription: 'ข้อความ Alt (คำอธิบาย)',
        title_attr: 'หัวเรื่อง (tooltip)',
        srcset: 'Srcset (ไม่บังคับ)',
        srcsetPlaceholder: 'small.jpg 320w, large.jpg 800w',
        loading: 'การโหลด',
        loadingDefault: 'ค่าเริ่มต้น',
        loadingLazy: 'lazy (โหลดแบบหน่วง)',
        loadingEager: 'eager (โหลดทันที)',
        caption: 'คำบรรยาย',
        captionPlaceholder: 'รองรับ HTML',
        linkSection: 'ลิงก์เมื่อคลิกรูปภาพ',
        linkUrl: 'URL ลิงก์ (ไม่บังคับ)',
        linkUrlPlaceholder: 'https://...',
        relExceptNofollow: 'Rel (ยกเว้น nofollow)',
        relPlaceholder: 'sponsored, ugc, ...',
        openNewWindow: 'เปิดในหน้าต่างใหม่',
        nofollow: 'nofollow',
        removeImage: 'ลบรูปภาพ',
        uploadReplace: 'แทนที่รูปภาพ: คลิกเพื่ออัปโหลด',
        uploadClick: 'คลิกเพื่ออัปโหลดหรือลากและวาง',
        uploadFormats: 'JPG, PNG, GIF, WebP, AVIF, HEIC, SVG',
        uploading: 'กำลังอัปโหลด...',
        uploadSuccess: 'อัปโหลดสำเร็จ',
        chooseFromUploaded: 'เลือกจากรูปภาพที่อัปโหลด',
        orEnterUrl: 'หรือป้อน URL',
        loadingImages: 'กำลังโหลดรูปภาพ...',
        noImages: 'ยังไม่มีรูปภาพที่อัปโหลด',
        imageSelected: 'เลือกรูปภาพแล้ว',
        closeGallery: 'ปิดแกลเลอรี',
        deleteConfirm: 'ลบ'
    },
    
    // Link module
    link: {
        title: 'แทรกลิงก์',
        editTitle: 'แก้ไขลิงก์',
        url: 'URL',
        linkText: 'ข้อความลิงก์',
        titleAttr: 'หัวเรื่อง (tooltip)',
        openNewWindow: 'เปิดในหน้าต่างใหม่',
        nofollow: 'nofollow',
        removeLink: 'ลบลิงก์',
        relExceptNofollow: 'Rel (ยกเว้น nofollow)',
        relPlaceholder: 'sponsored, ugc, ...'
    },
    
    // Table module
    table: {
        title: 'แทรกตาราง',
        rows: 'แถว',
        columns: 'คอลัมน์',
        firstRowHeader: 'แถวแรกเป็นหัวตาราง',
        insertColumnLeft: 'แทรกคอลัมน์ทางซ้าย',
        insertColumnRight: 'แทรกคอลัมน์ทางขวา',
        insertRowAbove: 'แทรกแถวด้านบน',
        insertRowBelow: 'แทรกแถวด้านล่าง',
        makeRegular: 'ตั้งเป็นเซลล์ปกติ (TD)',
        makeHeader: 'ตั้งเป็นหัวตาราง (TH)',
        makeRowHeader: 'ตั้งแถวเป็นหัวตาราง',
        cellAttributes: 'คุณสมบัติเซลล์',
        rowAttributes: 'คุณสมบัติแถว',
        deleteColumn: 'ลบคอลัมน์',
        deleteRow: 'ลบแถว',
        deleteTable: 'ลบตาราง',
        headerPrefix: 'หัวตาราง'
    },
    
    // YouTube module
    youtube: {
        title: 'YouTube',
        videoLink: 'ลิงก์วิดีโอ YouTube',
        invalidUrl: 'URL YouTube ไม่ถูกต้อง'
    },
    
    // Code module
    code: {
        title: 'แทรกบล็อกโค้ด',
        editTitle: 'แก้ไขบล็อกโค้ด',
        language: 'ภาษาโปรแกรม',
        languageNone: 'ไม่มี',
        codePlaceholder: 'วางโค้ดของคุณที่นี่...',
        removeCodeBlock: 'ลบบล็อกโค้ด'
    },
    
    // Find & Replace module
    findReplace: {
        findPlaceholder: 'ค้นหา...',
        replacePlaceholder: 'แทนที่ด้วย...',
        replace: 'แทนที่',
        replaceAll: 'ทั้งหมด',
        noResults: 'ไม่พบผลลัพธ์',
        ofCount: 'จาก',
        previousTooltip: 'ก่อนหน้า (Shift+Enter)',
        nextTooltip: 'ถัดไป (Enter)',
        closeTooltip: 'ปิด (Esc)'
    },
    
    // Block Control module
    blockControl: {
        transformTo: 'แปลงเป็น',
        paragraph: 'ย่อหน้า',
        heading1: 'หัวเรื่อง 1',
        heading2: 'หัวเรื่อง 2',
        heading3: 'หัวเรื่อง 3',
        quote: 'คำพูดอ้างอิง',
        callout: 'คำเตือน',
        calloutStyle: 'รูปแบบคำเตือน',
        quoteStyle: 'รูปแบบคำพูดอ้างอิง',
        noStyle: 'ไม่มีรูปแบบ',
        warning: 'คำเตือน',
        danger: 'อันตราย',
        information: 'ข้อมูล',
        success: 'สำเร็จ',
        standard: 'มาตรฐาน',
        big: 'ใหญ่',
        listType: 'ประเภทรายการ',
        bulleted: 'มีสัญลักษณ์',
        numbered: 'มีหมายเลข',
        actions: 'การกระทำ',
        insertBlockBelow: 'แทรกบล็อกด้านล่าง',
        duplicate: 'ทำซ้ำ',
        attributes: 'คุณสมบัติ',
        cellSettings: 'การตั้งค่าเซลล์',
        rowSettings: 'การตั้งค่าแถว',
        dragEntireList: 'ลากรายการทั้งหมด'
    },
    
    // Attributes module
    attributes: {
        title: 'คุณสมบัติองค์ประกอบ',
        editing: 'กำลังแก้ไข',
        idAnchor: 'ID (จุดยึด)',
        idPlaceholder: 'ตัวอย่าง-จุดยึด',
        linkPrefix: 'ลิงก์',
        classes: 'คลาส (คั่นด้วยช่องว่าง)',
        quickSelect: 'เลือกด่วน'
    },
    
    // Slash Commands
    slashCommands: {
        noCommands: 'ไม่พบคำสั่ง',
        heading1: 'หัวเรื่อง 1',
        heading1Desc: 'หัวเรื่องส่วนใหญ่',
        heading2: 'หัวเรื่อง 2',
        heading2Desc: 'หัวเรื่องส่วนกลาง',
        heading3: 'หัวเรื่อง 3',
        heading3Desc: 'หัวเรื่องส่วนเล็ก',
        quote: 'คำพูดอ้างอิง',
        quoteDesc: 'บล็อกคำพูดอ้างอิง',
        callout: 'คำเตือน',
        calloutDesc: 'บล็อกข้อมูลที่เน้น',
        codeBlock: 'บล็อกโค้ด',
        codeBlockDesc: 'โค้ดพร้อมการเน้นไวยากรณ์',
        image: 'รูปภาพ',
        imageDesc: 'แทรกรูปภาพ',
        youtube: 'YouTube',
        youtubeDesc: 'ฝังวิดีโอ',
        table: 'ตาราง',
        tableDesc: 'แทรกตาราง',
        divider: 'เส้นแบ่ง',
        dividerDesc: 'เส้นแบ่งแนวนอน',
        numberedList: 'รายการแบบหมายเลข',
        numberedListDesc: 'รายการที่มีหมายเลข',
        bulletList: 'รายการแบบสัญลักษณ์',
        bulletListDesc: 'รายการที่มีสัญลักษณ์'
    },
    
    // Upload errors
    upload: {
        error: 'อัปโหลดล้มเหลว',
        connectionError: 'ข้อผิดพลาดการเชื่อมต่อ',
        serverError: 'ข้อผิดพลาดเซิร์ฟเวอร์',
        invalidResponse: 'การตอบกลับเซิร์ฟเวอร์ไม่ถูกต้อง',
        remove: 'ลบ'
    },
    
    // Counter
    counter: {
        chars: 'ตัวอักษร',
        words: 'คำ'
    }
};
