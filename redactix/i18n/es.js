/**
 * Spanish localization for Redactix Editor
 */
export default {
    // General
    chars: 'caract.',
    words: 'palabras',
    
    // Modal buttons
    save: 'Guardar',
    cancel: 'Cancelar',
    remove: 'Eliminar',
    close: 'Cerrar',
    delete: 'Eliminar',
    
    // Toolbar tooltips
    toolbar: {
        insertImage: 'Insertar imagen',
        insertTable: 'Insertar tabla',
        insertYoutube: 'Insertar video de YouTube',
        insertCode: 'Insertar bloque de código',
        findReplace: 'Buscar y reemplazar (Ctrl+F)',
        fullscreen: 'Modo pantalla completa',
        editHtml: 'Editar HTML',
        bold: 'Negrita',
        italic: 'Cursiva',
        underline: 'Subrayado',
        strikethrough: 'Tachado',
        highlight: 'Resaltar',
        monospace: 'Monoespaciado',
        spoiler: 'Spoiler',
        link: 'Enlace'
    },
    
    // Image module
    image: {
        title: 'Insertar imagen',
        editTitle: 'Editar imagen',
        url: 'URL de la imagen',
        alt: 'Texto alt',
        altDescription: 'Texto alt (descripción)',
        title_attr: 'Título (tooltip)',
        srcset: 'Srcset (opcional)',
        srcsetPlaceholder: 'small.jpg 320w, large.jpg 800w',
        loading: 'Carga',
        loadingDefault: 'Por defecto',
        loadingLazy: 'lazy (carga diferida)',
        loadingEager: 'eager (carga inmediata)',
        caption: 'Pie de foto',
        captionPlaceholder: 'HTML soportado',
        linkSection: 'Enlace al hacer clic en la imagen',
        linkUrl: 'URL del enlace (opcional)',
        linkUrlPlaceholder: 'https://...',
        relExceptNofollow: 'Rel (excepto nofollow)',
        relPlaceholder: 'sponsored, ugc, ...',
        openNewWindow: 'Abrir en nueva pestaña',
        nofollow: 'nofollow',
        removeImage: 'Eliminar imagen',
        uploadReplace: 'Reemplazar imagen: haz clic para subir',
        uploadClick: 'Haz clic para subir o arrastra y suelta',
        uploadFormats: 'JPG, PNG, GIF, WebP, AVIF, HEIC, SVG',
        uploading: 'Subiendo...',
        uploadSuccess: 'Subido correctamente',
        chooseFromUploaded: 'Elegir entre imágenes subidas',
        orEnterUrl: 'o ingresar URL',
        loadingImages: 'Cargando imágenes...',
        noImages: 'Aún no hay imágenes subidas',
        imageSelected: 'Imagen seleccionada',
        closeGallery: 'Cerrar galería',
        deleteConfirm: 'Eliminar'
    },
    
    // Link module
    link: {
        title: 'Insertar enlace',
        editTitle: 'Editar enlace',
        url: 'URL',
        linkText: 'Texto del enlace',
        titleAttr: 'Título (tooltip)',
        openNewWindow: 'Abrir en nueva pestaña',
        nofollow: 'nofollow',
        removeLink: 'Eliminar enlace',
        relExceptNofollow: 'Rel (excepto nofollow)',
        relPlaceholder: 'sponsored, ugc, ...'
    },
    
    // Table module
    table: {
        title: 'Insertar tabla',
        rows: 'Filas',
        columns: 'Columnas',
        firstRowHeader: 'Primera fila como encabezado',
        insertColumnLeft: 'Insertar columna a la izquierda',
        insertColumnRight: 'Insertar columna a la derecha',
        insertRowAbove: 'Insertar fila arriba',
        insertRowBelow: 'Insertar fila abajo',
        makeRegular: 'Hacer normal (TD)',
        makeHeader: 'Hacer encabezado (TH)',
        makeRowHeader: 'Hacer fila encabezado',
        cellAttributes: 'Atributos de celda',
        rowAttributes: 'Atributos de fila',
        deleteColumn: 'Eliminar columna',
        deleteRow: 'Eliminar fila',
        deleteTable: 'Eliminar tabla',
        headerPrefix: 'Encabezado'
    },
    
    // YouTube module
    youtube: {
        title: 'YouTube',
        videoLink: 'Enlace de video de YouTube',
        invalidUrl: 'URL de YouTube inválida'
    },
    
    // Code module
    code: {
        title: 'Insertar bloque de código',
        editTitle: 'Editar bloque de código',
        language: 'Lenguaje de programación',
        languageNone: 'Ninguno',
        codePlaceholder: 'Pega tu código aquí...',
        removeCodeBlock: 'Eliminar bloque de código'
    },
    
    // Find & Replace module
    findReplace: {
        findPlaceholder: 'Buscar...',
        replacePlaceholder: 'Reemplazar con...',
        replace: 'Reemplazar',
        replaceAll: 'Todos',
        noResults: 'Sin resultados',
        ofCount: 'de',
        previousTooltip: 'Anterior (Shift+Enter)',
        nextTooltip: 'Siguiente (Enter)',
        closeTooltip: 'Cerrar (Esc)'
    },
    
    // Block Control module
    blockControl: {
        transformTo: 'Transformar en',
        paragraph: 'Párrafo',
        heading1: 'Encabezado 1',
        heading2: 'Encabezado 2',
        heading3: 'Encabezado 3',
        quote: 'Cita',
        callout: 'Llamada',
        calloutStyle: 'Estilo de llamada',
        quoteStyle: 'Estilo de cita',
        noStyle: 'Sin estilo',
        warning: 'Advertencia',
        danger: 'Peligro',
        information: 'Información',
        success: 'Éxito',
        standard: 'Estándar',
        big: 'Grande',
        listType: 'Tipo de lista',
        bulleted: 'Con viñetas',
        numbered: 'Numerada',
        actions: 'Acciones',
        insertBlockBelow: 'Insertar bloque abajo',
        duplicate: 'Duplicar',
        attributes: 'Atributos',
        cellSettings: 'Configuración de celda',
        rowSettings: 'Configuración de fila',
        dragEntireList: 'Arrastrar lista completa'
    },
    
    // Attributes module
    attributes: {
        title: 'Atributos del elemento',
        editing: 'Edición',
        idAnchor: 'ID (Ancla)',
        idPlaceholder: 'ejemplo-ancla',
        linkPrefix: 'Enlace',
        classes: 'Clases (separadas por espacio)',
        quickSelect: 'Selección rápida'
    },
    
    // Slash Commands
    slashCommands: {
        noCommands: 'No se encontraron comandos',
        heading1: 'Encabezado 1',
        heading1Desc: 'Encabezado de sección grande',
        heading2: 'Encabezado 2',
        heading2Desc: 'Encabezado de sección mediano',
        heading3: 'Encabezado 3',
        heading3Desc: 'Encabezado de sección pequeño',
        quote: 'Cita',
        quoteDesc: 'Bloque de cita',
        callout: 'Llamada',
        calloutDesc: 'Bloque de información destacado',
        codeBlock: 'Bloque de código',
        codeBlockDesc: 'Código con resaltado de sintaxis',
        image: 'Imagen',
        imageDesc: 'Insertar una imagen',
        youtube: 'YouTube',
        youtubeDesc: 'Incrustar video',
        table: 'Tabla',
        tableDesc: 'Insertar una tabla',
        divider: 'Divisor',
        dividerDesc: 'Línea de separación horizontal',
        numberedList: 'Lista numerada',
        numberedListDesc: 'Lista con números',
        bulletList: 'Lista con viñetas',
        bulletListDesc: 'Lista con viñetas'
    },
    
    // Upload errors
    upload: {
        error: 'Error al subir',
        connectionError: 'Error de conexión',
        serverError: 'Error del servidor',
        invalidResponse: 'Respuesta de servidor inválida',
        remove: 'Eliminar'
    },
    
    // Counter
    counter: {
        chars: 'caract.',
        words: 'palabras'
    }
};
