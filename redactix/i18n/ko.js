/**
 * Korean localization for Redactix Editor
 */
export default {
    // General
    chars: '자',
    words: '단어',
    
    // Modal buttons
    save: '저장',
    cancel: '취소',
    remove: '제거',
    close: '닫기',
    delete: '삭제',
    
    // Toolbar tooltips
    toolbar: {
        insertImage: '이미지 삽입',
        insertTable: '표 삽입',
        insertYoutube: 'YouTube 동영상 삽입',
        insertCode: '코드 블록 삽입',
        findReplace: '찾기 및 바꾸기 (Ctrl+F)',
        fullscreen: '전체 화면',
        editHtml: 'HTML 편집',
        bold: '굵게',
        italic: '기울임꼴',
        underline: '밑줄',
        strikethrough: '취소선',
        highlight: '강조',
        monospace: '고정폭',
        spoiler: '스포일러',
        link: '링크'
    },
    
    // Image module
    image: {
        title: '이미지 삽입',
        editTitle: '이미지 편집',
        url: '이미지 URL',
        alt: '대체 텍스트',
        altDescription: '대체 텍스트 (설명)',
        title_attr: '제목 (툴팁)',
        srcset: 'Srcset (선택사항)',
        srcsetPlaceholder: 'small.jpg 320w, large.jpg 800w',
        loading: '로딩',
        loadingDefault: '기본값',
        loadingLazy: 'lazy (지연 로딩)',
        loadingEager: 'eager (즉시 로딩)',
        caption: '캡션',
        captionPlaceholder: 'HTML 지원',
        linkSection: '이미지 클릭 시 링크',
        linkUrl: '링크 URL (선택사항)',
        linkUrlPlaceholder: 'https://...',
        relExceptNofollow: 'Rel (nofollow 제외)',
        relPlaceholder: 'sponsored, ugc, ...',
        openNewWindow: '새 창에서 열기',
        nofollow: 'nofollow',
        removeImage: '이미지 제거',
        uploadReplace: '이미지 교체: 클릭하여 업로드',
        uploadClick: '클릭하여 업로드 또는 드래그 앤 드롭',
        uploadFormats: 'JPG, PNG, GIF, WebP, AVIF, HEIC, SVG',
        uploading: '업로드 중...',
        uploadSuccess: '업로드 완료',
        chooseFromUploaded: '업로드된 이미지에서 선택',
        orEnterUrl: '또는 URL 입력',
        loadingImages: '이미지 로딩 중...',
        noImages: '업로드된 이미지가 없습니다',
        imageSelected: '이미지 선택됨',
        closeGallery: '갤러리 닫기',
        deleteConfirm: '삭제'
    },
    
    // Link module
    link: {
        title: '링크 삽입',
        editTitle: '링크 편집',
        url: 'URL',
        linkText: '링크 텍스트',
        titleAttr: '제목 (툴팁)',
        openNewWindow: '새 창에서 열기',
        nofollow: 'nofollow',
        removeLink: '링크 제거',
        relExceptNofollow: 'Rel (nofollow 제외)',
        relPlaceholder: 'sponsored, ugc, ...'
    },
    
    // Table module
    table: {
        title: '표 삽입',
        rows: '행',
        columns: '열',
        firstRowHeader: '첫 번째 행을 헤더로',
        insertColumnLeft: '왼쪽에 열 삽입',
        insertColumnRight: '오른쪽에 열 삽입',
        insertRowAbove: '위에 행 삽입',
        insertRowBelow: '아래에 행 삽입',
        makeRegular: '일반 셀로 만들기 (TD)',
        makeHeader: '헤더로 만들기 (TH)',
        makeRowHeader: '행을 헤더로 만들기',
        cellAttributes: '셀 속성',
        rowAttributes: '행 속성',
        deleteColumn: '열 삭제',
        deleteRow: '행 삭제',
        deleteTable: '표 삭제',
        headerPrefix: '헤더'
    },
    
    // YouTube module
    youtube: {
        title: 'YouTube',
        videoLink: 'YouTube 동영상 링크',
        invalidUrl: '잘못된 YouTube URL'
    },
    
    // Code module
    code: {
        title: '코드 블록 삽입',
        editTitle: '코드 블록 편집',
        language: '프로그래밍 언어',
        languageNone: '없음',
        codePlaceholder: '여기에 코드를 붙여넣으세요...',
        removeCodeBlock: '코드 블록 제거'
    },
    
    // Find & Replace module
    findReplace: {
        findPlaceholder: '찾기...',
        replacePlaceholder: '바꿀 내용...',
        replace: '바꾸기',
        replaceAll: '모두',
        noResults: '결과 없음',
        ofCount: '/',
        previousTooltip: '이전 (Shift+Enter)',
        nextTooltip: '다음 (Enter)',
        closeTooltip: '닫기 (Esc)'
    },
    
    // Block Control module
    blockControl: {
        transformTo: '변환',
        paragraph: '단락',
        heading1: '제목 1',
        heading2: '제목 2',
        heading3: '제목 3',
        quote: '인용',
        callout: '콜아웃',
        calloutStyle: '콜아웃 스타일',
        quoteStyle: '인용 스타일',
        noStyle: '스타일 없음',
        warning: '경고',
        danger: '위험',
        information: '정보',
        success: '성공',
        standard: '표준',
        big: '크게',
        listType: '목록 유형',
        bulleted: '글머리 기호',
        numbered: '번호 매기기',
        actions: '작업',
        insertBlockBelow: '아래에 블록 삽입',
        duplicate: '복제',
        attributes: '속성',
        cellSettings: '셀 설정',
        rowSettings: '행 설정',
        dragEntireList: '전체 목록 드래그'
    },
    
    // Attributes module
    attributes: {
        title: '요소 속성',
        editing: '편집 중',
        idAnchor: 'ID (앵커)',
        idPlaceholder: 'example-anchor',
        linkPrefix: '링크',
        classes: '클래스 (공백으로 구분)',
        quickSelect: '빠른 선택'
    },
    
    // Slash Commands
    slashCommands: {
        noCommands: '명령을 찾을 수 없습니다',
        heading1: '제목 1',
        heading1Desc: '큰 섹션 제목',
        heading2: '제목 2',
        heading2Desc: '중간 섹션 제목',
        heading3: '제목 3',
        heading3Desc: '작은 섹션 제목',
        quote: '인용',
        quoteDesc: '인용 블록',
        callout: '콜아웃',
        calloutDesc: '강조된 정보 블록',
        codeBlock: '코드 블록',
        codeBlockDesc: '구문 강조 코드',
        image: '이미지',
        imageDesc: '이미지 삽입',
        youtube: 'YouTube',
        youtubeDesc: '동영상 삽입',
        table: '표',
        tableDesc: '표 삽입',
        divider: '구분선',
        dividerDesc: '가로 구분선',
        numberedList: '번호 목록',
        numberedListDesc: '번호가 있는 목록',
        bulletList: '글머리 기호 목록',
        bulletListDesc: '글머리 기호가 있는 목록'
    },
    
    // Upload errors
    upload: {
        error: '업로드 실패',
        connectionError: '연결 오류',
        serverError: '서버 오류',
        invalidResponse: '잘못된 서버 응답',
        remove: '제거'
    },
    
    // Counter
    counter: {
        chars: '자',
        words: '단어'
    }
};
