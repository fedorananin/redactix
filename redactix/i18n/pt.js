/**
 * Portuguese localization for Redactix Editor
 */
export default {
    // General
    chars: 'caract.',
    words: 'palavras',

    // Modal buttons
    save: 'Salvar',
    cancel: 'Cancelar',
    remove: 'Remover',
    close: 'Fechar',
    delete: 'Excluir',

    // Toolbar tooltips
    toolbar: {
        insertImage: 'Inserir imagem',
        insertTable: 'Inserir tabela',
        insertYoutube: 'Inserir vídeo do YouTube',
        insertCode: 'Inserir bloco de código',
        findReplace: 'Localizar e substituir (Ctrl+F)',
        fullscreen: 'Modo tela cheia',
        editHtml: 'Editar HTML',
        bold: 'Negrito',
        italic: 'Itálico',
        underline: 'Sublinhado',
        strikethrough: 'Tachado',
        highlight: 'Destacar',
        monospace: 'Monoespaçado',
        spoiler: 'Spoiler',
        link: 'Link'
    },

    // Image module
    image: {
        title: 'Inserir imagem',
        editTitle: 'Editar imagem',
        url: 'URL da imagem',
        alt: 'Texto alt',
        altDescription: 'Texto alt (descrição)',
        title_attr: 'Título (tooltip)',
        srcset: 'Srcset (opcional)',
        srcsetPlaceholder: 'small.jpg 320w, large.jpg 800w',
        loading: 'Carregamento',
        loadingDefault: 'Padrão',
        loadingLazy: 'lazy (carregamento adiado)',
        loadingEager: 'eager (carregamento imediato)',
        caption: 'Legenda',
        captionPlaceholder: 'HTML suportado',
        linkSection: 'Link ao clicar na imagem',
        linkUrl: 'URL do link (opcional)',
        linkUrlPlaceholder: 'https://...',
        relExceptNofollow: 'Rel (exceto nofollow)',
        relPlaceholder: 'sponsored, ugc, ...',
        openNewWindow: 'Abrir em nova aba',
        nofollow: 'nofollow',
        removeImage: 'Remover imagem',
        uploadReplace: 'Substituir imagem: clique para enviar',
        uploadClick: 'Clique para enviar ou arraste e solte',
        uploadFormats: 'JPG, PNG, GIF, WebP, AVIF, HEIC, SVG',
        uploading: 'Enviando...',
        uploadSuccess: 'Enviado com sucesso',
        chooseFromUploaded: 'Escolher entre imagens enviadas',
        orEnterUrl: 'ou inserir URL',
        loadingImages: 'Carregando imagens...',
        noImages: 'Nenhuma imagem enviada ainda',
        imageSelected: 'Imagem selecionada',
        closeGallery: 'Fechar galeria',
        deleteConfirm: 'Excluir'
    },

    // Link module
    link: {
        title: 'Inserir link',
        editTitle: 'Editar link',
        url: 'URL',
        linkText: 'Texto do link',
        titleAttr: 'Título (tooltip)',
        openNewWindow: 'Abrir em nova aba',
        nofollow: 'nofollow',
        removeLink: 'Remover link',
        relExceptNofollow: 'Rel (exceto nofollow)',
        relPlaceholder: 'sponsored, ugc, ...'
    },

    // Table module
    table: {
        title: 'Inserir tabela',
        rows: 'Linhas',
        columns: 'Colunas',
        firstRowHeader: 'Primeira linha como cabeçalho',
        insertColumnLeft: 'Inserir coluna à esquerda',
        insertColumnRight: 'Inserir coluna à direita',
        insertRowAbove: 'Inserir linha acima',
        insertRowBelow: 'Inserir linha abaixo',
        makeRegular: 'Tornar normal (TD)',
        makeHeader: 'Tornar cabeçalho (TH)',
        makeRowHeader: 'Tornar linha cabeçalho',
        cellAttributes: 'Atributos da célula',
        rowAttributes: 'Atributos da linha',
        deleteColumn: 'Excluir coluna',
        deleteRow: 'Excluir linha',
        deleteTable: 'Excluir tabela',
        headerPrefix: 'Cabeçalho'
    },

    // YouTube module
    youtube: {
        title: 'YouTube',
        videoLink: 'Link do vídeo do YouTube',
        invalidUrl: 'URL do YouTube inválido'
    },

    // Code module
    code: {
        title: 'Inserir bloco de código',
        editTitle: 'Editar bloco de código',
        language: 'Linguagem de programação',
        languageNone: 'Nenhum',
        codePlaceholder: 'Cole seu código aqui...',
        removeCodeBlock: 'Remover bloco de código'
    },

    // Find & Replace module
    findReplace: {
        findPlaceholder: 'Localizar...',
        replacePlaceholder: 'Substituir por...',
        replace: 'Substituir',
        replaceAll: 'Todos',
        noResults: 'Sem resultados',
        ofCount: 'de',
        previousTooltip: 'Anterior (Shift+Enter)',
        nextTooltip: 'Próximo (Enter)',
        closeTooltip: 'Fechar (Esc)'
    },

    // Block Control module
    blockControl: {
        transformTo: 'Transformar em',
        paragraph: 'Parágrafo',
        heading1: 'Título 1',
        heading2: 'Título 2',
        heading3: 'Título 3',
        quote: 'Citação',
        callout: 'Chamada',
        calloutStyle: 'Estilo de chamada',
        quoteStyle: 'Estilo de citação',
        noStyle: 'Sem estilo',
        warning: 'Aviso',
        danger: 'Perigo',
        information: 'Informação',
        success: 'Sucesso',
        standard: 'Padrão',
        big: 'Grande',
        listType: 'Tipo de lista',
        bulleted: 'Com marcadores',
        numbered: 'Numerada',
        actions: 'Ações',
        insertBlockBelow: 'Inserir bloco abaixo',
        duplicate: 'Duplicar',
        attributes: 'Atributos',
        cellSettings: 'Configurações da célula',
        rowSettings: 'Configurações da linha',
        dragEntireList: 'Arrastar lista inteira',
        citePlaceholder: 'Adicionar citação...',
        addCitation: 'Adicionar citação',
        removeCitation: 'Remover citação'
    },

    // Attributes module
    attributes: {
        title: 'Atributos do elemento',
        editing: 'Edição',
        idAnchor: 'ID (Âncora)',
        idPlaceholder: 'exemplo-ancora',
        linkPrefix: 'Link',
        classes: 'Classes (separadas por espaço)',
        quickSelect: 'Seleção rápida'
    },

    // Slash Commands
    slashCommands: {
        noCommands: 'Nenhum comando encontrado',
        heading1: 'Título 1',
        heading1Desc: 'Título de seção grande',
        heading2: 'Título 2',
        heading2Desc: 'Título de seção médio',
        heading3: 'Título 3',
        heading3Desc: 'Título de seção pequeno',
        quote: 'Citação',
        quoteDesc: 'Bloco de citação',
        callout: 'Chamada',
        calloutDesc: 'Bloco de informações destacado',
        codeBlock: 'Bloco de código',
        codeBlockDesc: 'Código com destaque de sintaxe',
        image: 'Imagem',
        imageDesc: 'Inserir uma imagem',
        youtube: 'YouTube',
        youtubeDesc: 'Incorporar vídeo',
        table: 'Tabela',
        tableDesc: 'Inserir uma tabela',
        divider: 'Divisor',
        dividerDesc: 'Linha de separação horizontal',
        numberedList: 'Lista numerada',
        numberedListDesc: 'Lista com números',
        bulletList: 'Lista com marcadores',
        bulletListDesc: 'Lista com marcadores'
    },

    // Upload errors
    upload: {
        error: 'Falha no envio',
        connectionError: 'Erro de conexão',
        serverError: 'Erro do servidor',
        invalidResponse: 'Resposta de servidor inválida',
        remove: 'Remover'
    },

    // Counter
    counter: {
        chars: 'caract.',
        words: 'palavras'
    }
};
