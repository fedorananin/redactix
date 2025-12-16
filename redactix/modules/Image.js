import Module from '../core/Module.js';
import Icons from '../ui/Icons.js';

export default class Image extends Module {
    constructor(instance) {
        super(instance);
        this.currentFigure = null; // Для редактирования существующего изображения
        this.liteMode = instance.config.liteMode || false; // Lite mode - упрощённый режим
        this.uploadUrl = instance.config.uploadUrl || null; // URL для загрузки изображений
        this.browseUrl = instance.config.browseUrl || null; // URL для просмотра изображений
        this.allowDelete = instance.config.allowImageDelete || false; // Разрешить удаление изображений
    }

    init() {
        // Клик по изображению открывает модалку редактирования
        this.instance.editorEl.addEventListener('click', (e) => {
            const img = e.target.closest('img');
            if (img) {
                e.preventDefault();
                const figure = img.closest('figure');
                if (figure) {
                    this.openModal(figure);
                } else {
                    // Если img без figure - создаём figure и редактируем
                    this.openModal(null, img);
                }
            }
        });

        // Drag & Drop загрузка (отключено в lite mode)
        if (this.uploadUrl && !this.liteMode) {
            this.initDragDrop();
            this.initPasteUpload();
        }
        
        // Обработка base64 изображений после вставки (из Google Docs и т.п.)
        // В lite mode base64 изображения удаляются
        this.initBase64Handler();
    }
    
    /**
     * Обработка base64 изображений после вставки
     */
    initBase64Handler() {
        // Используем MutationObserver для отслеживания новых изображений
        const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Ищем все изображения с base64 src
                        const images = node.tagName === 'IMG' ? [node] : node.querySelectorAll ? Array.from(node.querySelectorAll('img')) : [];
                        images.forEach(img => {
                            const src = img.getAttribute('src') || '';
                            if (src.startsWith('data:image/')) {
                                this.handleBase64Image(img);
                            }
                        });
                    }
                });
            });
        });
        
        observer.observe(this.instance.editorEl, {
            childList: true,
            subtree: true
        });
    }
    
    /**
     * Обработка одного base64 изображения
     */
    async handleBase64Image(img) {
        // В lite mode или если нет uploadUrl - удаляем base64 изображение
        if (!this.uploadUrl || this.liteMode) {
            const figure = img.closest('figure');
            if (figure) {
                figure.remove();
            } else {
                img.remove();
            }
            this.instance.sync();
            console.warn('Redactix: Base64 image removed' + (this.liteMode ? ' (lite mode)' : ' (no uploadUrl configured)'));
            return;
        }
        
        const src = img.getAttribute('src');
        if (!src || !src.startsWith('data:image/')) return;
        
        // Показываем индикатор загрузки
        const figure = img.closest('figure');
        if (figure) {
            figure.classList.add('redactix-uploading');
        }
        img.style.opacity = '0.5';
        
        try {
            // Конвертируем base64 в File
            const file = this.base64ToFile(src);
            
            // Загружаем на сервер
            const formData = new FormData();
            formData.append('image', file);
            
            const response = await fetch(this.uploadUrl, {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok && response.status !== 400) {
                throw new Error(`Server error (${response.status})`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                // Заменяем src на URL с сервера
                img.setAttribute('src', result.src);
                if (result.srcset) img.setAttribute('srcset', result.srcset);
                if (result.alt) img.setAttribute('alt', result.alt);
                if (result.title) img.setAttribute('title', result.title);
                
                img.style.opacity = '';
                if (figure) {
                    figure.classList.remove('redactix-uploading');
                }
                
                this.instance.sync();
            } else {
                throw new Error(result.error || 'Upload failed');
            }
        } catch (error) {
            console.error('Redactix: Failed to upload base64 image:', error);
            
            // Показываем ошибку и удаляем изображение
            img.style.opacity = '';
            if (figure) {
                figure.classList.remove('redactix-uploading');
                figure.remove();
            } else {
                img.remove();
            }
            this.instance.sync();
        }
    }
    
    /**
     * Конвертация base64 в File
     */
    base64ToFile(dataUrl) {
        // Парсим data URL
        const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (!matches) {
            throw new Error('Invalid data URL');
        }
        
        const mimeType = matches[1];
        const base64Data = matches[2];
        
        // Декодируем base64
        const byteString = atob(base64Data);
        const byteArray = new Uint8Array(byteString.length);
        for (let i = 0; i < byteString.length; i++) {
            byteArray[i] = byteString.charCodeAt(i);
        }
        
        // Определяем расширение
        const extMap = {
            'image/jpeg': 'jpg',
            'image/png': 'png',
            'image/gif': 'gif',
            'image/webp': 'webp',
            'image/svg+xml': 'svg',
            'image/avif': 'avif'
        };
        const ext = extMap[mimeType] || 'png';
        
        // Создаём File
        const blob = new Blob([byteArray], { type: mimeType });
        return new File([blob], `pasted-image.${ext}`, { type: mimeType });
    }

    /**
     * Инициализация drag & drop загрузки
     */
    initDragDrop() {
        const editor = this.instance.editorEl;

        editor.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            editor.classList.add('redactix-dragover');
        });

        editor.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            // Проверяем, что действительно покинули редактор
            if (!editor.contains(e.relatedTarget)) {
                editor.classList.remove('redactix-dragover');
            }
        });

        editor.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            editor.classList.remove('redactix-dragover');

            const files = e.dataTransfer.files;
            if (files.length > 0) {
                // Фильтруем только изображения
                const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
                if (imageFiles.length > 0) {
                    // Сохраняем позицию курсора для вставки
                    this.instance.selection.save();
                    this.uploadFiles(imageFiles);
                }
            }
        });
    }

    /**
     * Инициализация загрузки через paste (Ctrl+V)
     */
    initPasteUpload() {
        // Используем capture phase чтобы перехватить событие до других обработчиков
        this.instance.editorEl.addEventListener('paste', (e) => {
            const items = e.clipboardData?.items;
            if (!items) return;

            const imageFiles = [];
            for (const item of items) {
                if (item.type.startsWith('image/')) {
                    const file = item.getAsFile();
                    if (file) {
                        imageFiles.push(file);
                    }
                }
            }

            if (imageFiles.length > 0) {
                // Полностью блокируем вставку, чтобы браузер не вставил HTML с оригинальной ссылкой
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                
                this.uploadFilesAtCursor(imageFiles);
            }
        }, true); // capture: true - перехватываем на фазе погружения
    }

    /**
     * Загрузка файлов на сервер (для drag&drop с сохранением позиции)
     */
    async uploadFiles(files) {
        for (const file of files) {
            await this.uploadFile(file);
        }
    }

    /**
     * Загрузка файлов в текущую позицию курсора (для paste)
     */
    async uploadFilesAtCursor(files) {
        for (const file of files) {
            await this.uploadFileAtCursor(file);
        }
    }

    /**
     * Загрузка одного файла (с restore позиции - для drag&drop)
     */
    async uploadFile(file) {
        const placeholder = this.createUploadPlaceholder();
        this.instance.selection.restore();
        this.instance.selection.insertNode(placeholder);
        this.instance.selection.save();

        await this.processUpload(file, placeholder);
    }

    /**
     * Загрузка одного файла в текущую позицию курсора (для paste)
     */
    async uploadFileAtCursor(file) {
        const placeholder = this.createUploadPlaceholder();
        this.instance.selection.insertNode(placeholder);

        await this.processUpload(file, placeholder);
    }

    /**
     * Общая логика загрузки файла
     */
    async processUpload(file, placeholder) {
        try {
            const formData = new FormData();
            formData.append('image', file);

            const response = await fetch(this.uploadUrl, {
                method: 'POST',
                body: formData
            });

            // Проверяем HTTP статус
            if (!response.ok && response.status !== 400) {
                throw new Error(`Server error (${response.status})`);
            }

            // Пробуем распарсить JSON
            let result;
            try {
                result = await response.json();
            } catch (e) {
                throw new Error('Invalid server response');
            }

            if (result.success) {
                // Заменяем placeholder на реальное изображение
                this.replacePlaceholderWithImage(placeholder, result);
            } else {
                // Ошибка от сервера
                this.showUploadError(placeholder, result.error || 'Upload failed');
            }
        } catch (error) {
            // Сетевая ошибка или ошибка парсинга
            this.showUploadError(placeholder, error.message || 'Connection error');
        }
    }

    /**
     * Создание placeholder во время загрузки
     */
    createUploadPlaceholder() {
        const placeholder = document.createElement('figure');
        placeholder.className = 'redactix-upload-placeholder';
        placeholder.contentEditable = 'false';
        placeholder.innerHTML = `
            <div class="redactix-upload-loading">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="32">
                        <animate attributeName="stroke-dashoffset" values="32;0" dur="1s" repeatCount="indefinite"/>
                    </circle>
                </svg>
                <span>Uploading...</span>
            </div>
        `;
        return placeholder;
    }

    /**
     * Замена placeholder на загруженное изображение
     */
    replacePlaceholderWithImage(placeholder, data) {
        const figure = document.createElement('figure');
        figure.contentEditable = 'false';

        const img = document.createElement('img');
        img.setAttribute('src', data.src);
        if (data.srcset) img.setAttribute('srcset', data.srcset);
        if (data.alt) img.setAttribute('alt', data.alt);
        if (data.title) img.setAttribute('title', data.title);

        figure.appendChild(img);

        const figcaption = document.createElement('figcaption');
        figcaption.contentEditable = 'true';
        figcaption.innerHTML = data.caption || '<br>';
        figure.appendChild(figcaption);

        placeholder.replaceWith(figure);
        this.instance.sync();
    }

    /**
     * Показ ошибки загрузки
     */
    showUploadError(placeholder, message) {
        placeholder.innerHTML = `
            <div class="redactix-upload-error">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="15" y1="9" x2="9" y2="15"/>
                    <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
                <span>${message}</span>
                <button type="button" class="redactix-upload-error-close">Remove</button>
            </div>
        `;

        const closeBtn = placeholder.querySelector('.redactix-upload-error-close');
        closeBtn.addEventListener('click', () => {
            placeholder.remove();
            this.instance.sync();
        });
    }

    getButtons() {
        return [
            {
                name: 'image',
                label: 'Img',
                icon: Icons.image,
                title: 'Insert Image',
                action: () => this.openModal()
            }
        ];
    }

    openModal(existingFigure = null, existingImg = null) {
        // В lite mode используем упрощённую версию модалки
        if (this.liteMode) {
            this.openLiteModal(existingFigure, existingImg);
            return;
        }
        
        this.instance.selection.save();
        this.currentFigure = existingFigure;
        
        // Извлекаем существующие данные
        let existingData = {
            url: 'https://',
            alt: '',
            srcset: '',
            title: '',
            loading: '',
            caption: '',
            linkUrl: '',
            isBlank: false,
            isNofollow: false,
            relExtra: '' // Дополнительные значения rel (кроме nofollow)
        };
        
        if (existingFigure) {
            const img = existingFigure.querySelector('img');
            const figcaption = existingFigure.querySelector('figcaption');
            const link = existingFigure.querySelector('a');
            
            if (img) {
                existingData.url = img.getAttribute('src') || 'https://';
                existingData.alt = img.getAttribute('alt') || '';
                existingData.srcset = img.getAttribute('srcset') || '';
                existingData.title = img.getAttribute('title') || '';
                existingData.loading = img.getAttribute('loading') || '';
            }
            if (figcaption) {
                // Убираем <br> из caption для отображения
                let caption = figcaption.innerHTML || '';
                caption = caption.replace(/<br\s*\/?>/gi, '').trim();
                existingData.caption = caption;
            }
            if (link) {
                existingData.linkUrl = link.getAttribute('href') || '';
                existingData.isBlank = link.target === '_blank';
                existingData.isNofollow = (link.rel || '').includes('nofollow');
                // Извлекаем дополнительные значения rel (кроме nofollow)
                existingData.relExtra = (link.rel || '').split(/\s+/).filter(r => r && r !== 'nofollow').join(' ');
            }
        } else if (existingImg) {
            existingData.url = existingImg.getAttribute('src') || 'https://';
            existingData.alt = existingImg.getAttribute('alt') || '';
            existingData.srcset = existingImg.getAttribute('srcset') || '';
            existingData.title = existingImg.getAttribute('title') || '';
            existingData.loading = existingImg.getAttribute('loading') || '';
            
            const link = existingImg.closest('a');
            if (link) {
                existingData.linkUrl = link.getAttribute('href') || '';
                existingData.isBlank = link.target === '_blank';
                existingData.isNofollow = (link.rel || '').includes('nofollow');
                existingData.relExtra = (link.rel || '').split(/\s+/).filter(r => r && r !== 'nofollow').join(' ');
            }
        }
        
        const isEditing = existingFigure || existingImg;

        const form = document.createElement('div');

        // Блок загрузки файла (если есть uploadUrl)
        let fileInput = null;
        let uploadStatus = null;
        
        if (this.uploadUrl) {
            const uploadGroup = document.createElement('div');
            uploadGroup.className = 'redactix-upload-group';
            uploadGroup.style.marginBottom = '16px';
            uploadGroup.style.padding = '16px';
            uploadGroup.style.border = '2px dashed #e5e7eb';
            uploadGroup.style.borderRadius = '8px';
            uploadGroup.style.textAlign = 'center';
            uploadGroup.style.transition = 'border-color 0.2s, background-color 0.2s';

            const uploadLabel = document.createElement('label');
            uploadLabel.style.display = 'block';
            uploadLabel.style.cursor = 'pointer';
            uploadLabel.innerHTML = `
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1.5" style="margin-bottom: 8px;">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                <div style="color: #6b7280; font-size: 14px;">${isEditing ? 'Replace image: click to upload' : 'Click to upload or drag & drop'}</div>
                <div style="color: #9ca3af; font-size: 12px; margin-top: 4px;">JPG, PNG, GIF, WebP, AVIF, HEIC, SVG</div>
            `;

            fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = 'image/*';
            fileInput.style.display = 'none';
            uploadLabel.appendChild(fileInput);

            uploadStatus = document.createElement('div');
            uploadStatus.style.marginTop = '8px';
            uploadStatus.style.fontSize = '13px';
            uploadStatus.style.display = 'none';

            uploadGroup.appendChild(uploadLabel);
            uploadGroup.appendChild(uploadStatus);

            // Drag & drop для зоны загрузки
            uploadGroup.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadGroup.style.borderColor = '#3b82f6';
                uploadGroup.style.backgroundColor = '#eff6ff';
            });

            uploadGroup.addEventListener('dragleave', (e) => {
                e.preventDefault();
                uploadGroup.style.borderColor = '#e5e7eb';
                uploadGroup.style.backgroundColor = '';
            });

            uploadGroup.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadGroup.style.borderColor = '#e5e7eb';
                uploadGroup.style.backgroundColor = '';

                const files = e.dataTransfer.files;
                if (files.length > 0 && files[0].type.startsWith('image/')) {
                    fileInput.files = files;
                    fileInput.dispatchEvent(new Event('change'));
                }
            });

            form.appendChild(uploadGroup);
        }

        // Блок браузера изображений (если есть browseUrl)
        let browseContainer = null;
        if (this.browseUrl) {
            browseContainer = document.createElement('div');
            browseContainer.style.marginBottom = '16px';
            
            const browseBtn = document.createElement('button');
            browseBtn.type = 'button';
            browseBtn.textContent = 'Choose from uploaded images';
            browseBtn.style.width = '100%';
            browseBtn.style.padding = '10px';
            browseBtn.style.background = '#f3f4f6';
            browseBtn.style.border = '1px solid #e5e7eb';
            browseBtn.style.borderRadius = '6px';
            browseBtn.style.cursor = 'pointer';
            browseBtn.style.fontSize = '14px';
            browseBtn.style.color = '#374151';
            browseBtn.style.transition = 'background 0.15s';
            
            browseBtn.addEventListener('mouseenter', () => {
                browseBtn.style.background = '#e5e7eb';
            });
            browseBtn.addEventListener('mouseleave', () => {
                browseBtn.style.background = '#f3f4f6';
            });
            
            browseBtn.addEventListener('click', () => {
                this.openBrowsePanel(browseContainer, (imageData) => {
                    // Заполняем поля данными выбранного изображения
                    if (urlInput) urlInput.value = imageData.src;
                    if (srcsetInput && imageData.srcset) srcsetInput.value = imageData.srcset;
                    if (altInput && imageData.alt) altInput.value = imageData.alt;
                    if (titleInput && imageData.title) titleInput.value = imageData.title;
                });
            });
            
            browseContainer.appendChild(browseBtn);
            form.appendChild(browseContainer);
        }
        
        // Разделитель "или" (если есть upload или browse)
        if (this.uploadUrl || this.browseUrl) {
            const orDivider = document.createElement('div');
            orDivider.style.textAlign = 'center';
            orDivider.style.color = '#9ca3af';
            orDivider.style.fontSize = '13px';
            orDivider.style.margin = '12px 0';
            orDivider.style.position = 'relative';
            orDivider.innerHTML = `
                <span style="background: white; padding: 0 12px; position: relative; z-index: 1;">or enter URL</span>
                <div style="position: absolute; top: 50%; left: 0; right: 0; height: 1px; background: #e5e7eb; z-index: 0;"></div>
            `;
            form.appendChild(orDivider);
        }
        
        // Сетка для полей (2 колонки на ПК, 1 на мобильных)
        const grid = document.createElement('div');
        grid.className = 'redactix-modal-grid';
        
        // Основные поля
        const urlGroup = this.createInputGroup('Image URL *', 'text', existingData.url);
        urlGroup.className = 'redactix-modal-full-width';
        const urlInput = urlGroup.querySelector('input');

        const altGroup = this.createInputGroup('Alt text', 'text', existingData.alt);
        const altInput = altGroup.querySelector('input');

        const titleGroup = this.createInputGroup('Title (tooltip)', 'text', existingData.title);
        const titleInput = titleGroup.querySelector('input');

        const srcsetGroup = this.createInputGroup('Srcset (optional)', 'text', existingData.srcset);
        srcsetGroup.className = 'redactix-modal-full-width';
        const srcsetInput = srcsetGroup.querySelector('input');
        srcsetInput.placeholder = 'small.jpg 320w, large.jpg 800w';

        // Loading атрибут
        const loadingGroup = this.createSelectGroup('Loading', existingData.loading, [
            { value: '', label: 'Default' },
            { value: 'lazy', label: 'lazy (deferred loading)' },
            { value: 'eager', label: 'eager (immediate loading)' }
        ]);
        const loadingSelect = loadingGroup.querySelector('select');

        // Caption (подпись)
        const captionGroup = this.createTextareaGroup('Caption', existingData.caption);
        captionGroup.className = 'redactix-modal-full-width';
        const captionInput = captionGroup.querySelector('textarea');
        captionInput.placeholder = 'HTML supported';

        // Добавляем поля в сетку
        grid.append(urlGroup, altGroup, titleGroup, srcsetGroup, loadingGroup, captionGroup);

        // Разделитель - секция ссылки
        const linkSection = document.createElement('div');
        linkSection.className = 'redactix-modal-full-width';
        linkSection.style.borderTop = '1px solid #e5e7eb';
        linkSection.style.marginTop = '8px';
        linkSection.style.paddingTop = '15px';
        
        const linkTitle = document.createElement('div');
        linkTitle.textContent = 'Link on image click';
        linkTitle.style.fontWeight = '600';
        linkTitle.style.marginBottom = '10px';
        linkTitle.style.fontSize = '14px';
        linkSection.appendChild(linkTitle);
        
        // Сетка для полей ссылки
        const linkGrid = document.createElement('div');
        linkGrid.className = 'redactix-modal-grid';

        // Ссылка для изображения
        const linkGroup = this.createInputGroup('Link URL (optional)', 'text', existingData.linkUrl);
        const linkInput = linkGroup.querySelector('input');
        linkInput.placeholder = 'https://...';
        
        // Rel (дополнительные значения)
        const relGroup = this.createInputGroup('Rel (except nofollow)', 'text', existingData.relExtra);
        const relInput = relGroup.querySelector('input');
        relInput.placeholder = 'sponsored, ugc, ...';
        
        linkGrid.append(linkGroup, relGroup);
        linkSection.appendChild(linkGrid);

        // Чекбоксы для ссылки
        const checksDiv = document.createElement('div');
        checksDiv.style.marginTop = '10px';

        const targetLabel = document.createElement('label');
        targetLabel.style.fontWeight = 'normal';
        targetLabel.style.display = 'inline-flex';
        targetLabel.style.alignItems = 'center';
        targetLabel.style.marginRight = '15px';
        targetLabel.style.cursor = 'pointer';
        const targetCheck = document.createElement('input');
        targetCheck.type = 'checkbox';
        targetCheck.style.width = 'auto';
        targetCheck.style.marginRight = '5px';
        targetCheck.checked = existingData.isBlank;
        targetLabel.append(targetCheck, 'Open in new window');

        const nofollowLabel = document.createElement('label');
        nofollowLabel.style.fontWeight = 'normal';
        nofollowLabel.style.display = 'inline-flex';
        nofollowLabel.style.alignItems = 'center';
        nofollowLabel.style.cursor = 'pointer';
        const nofollowCheck = document.createElement('input');
        nofollowCheck.type = 'checkbox';
        nofollowCheck.style.width = 'auto';
        nofollowCheck.style.marginRight = '5px';
        nofollowCheck.checked = existingData.isNofollow;
        nofollowLabel.append(nofollowCheck, 'nofollow');

        checksDiv.append(targetLabel, nofollowLabel);
        linkSection.appendChild(checksDiv);
        
        // Добавляем секцию ссылки в основную сетку
        grid.appendChild(linkSection);

        form.appendChild(grid);

        // Обработчик загрузки файла в модалке
        if (fileInput) {
            fileInput.addEventListener('change', async () => {
                const file = fileInput.files[0];
                if (!file) return;

                uploadStatus.style.display = 'block';
                uploadStatus.style.color = '#3b82f6';
                uploadStatus.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: inline-block; vertical-align: middle; margin-right: 6px; animation: spin 1s linear infinite;">
                        <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="32">
                            <animate attributeName="stroke-dashoffset" values="32;0" dur="1s" repeatCount="indefinite"/>
                        </circle>
                    </svg>
                    Uploading...
                `;

                try {
                    const formData = new FormData();
                    formData.append('image', file);

                    const response = await fetch(this.uploadUrl, {
                        method: 'POST',
                        body: formData
                    });

                    // Проверяем HTTP статус
                    if (!response.ok && response.status !== 400) {
                        throw new Error(`Server error (${response.status})`);
                    }

                    // Пробуем распарсить JSON
                    let result;
                    try {
                        result = await response.json();
                    } catch (e) {
                        throw new Error('Invalid server response');
                    }

                    if (result.success) {
                        uploadStatus.style.color = '#10b981';
                        uploadStatus.innerHTML = `
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: inline-block; vertical-align: middle; margin-right: 6px;">
                                <polyline points="20 6 9 17 4 12"/>
                            </svg>
                            Uploaded successfully
                        `;

                        // Заполняем поля данными с сервера
                        urlInput.value = result.src;
                        if (result.srcset) srcsetInput.value = result.srcset;
                        if (result.alt) altInput.value = result.alt;
                        if (result.title) titleInput.value = result.title;
                        if (result.caption) captionInput.value = result.caption;
                    } else {
                        // Ошибка от сервера
                        uploadStatus.style.color = '#ef4444';
                        uploadStatus.textContent = result.error || 'Upload failed';
                    }
                } catch (error) {
                    // Сетевая ошибка или ошибка парсинга
                    uploadStatus.style.color = '#ef4444';
                    uploadStatus.textContent = error.message || 'Connection error';
                }
            });
        }

        // Подготовка дополнительных кнопок (Delete для редактирования)
        const extraButtons = [];
        if (isEditing) {
            extraButtons.push({
                text: 'Remove Image',
                danger: true,
                onClick: () => {
                    if (existingFigure) {
                        existingFigure.remove();
                    } else if (existingImg) {
                        const link = existingImg.closest('a');
                        if (link) {
                            link.remove();
                        } else {
                            existingImg.remove();
                        }
                    }
                    this.instance.sync();
                    this.instance.modal.close();
                }
            });
        }

        this.instance.modal.open({
            title: isEditing ? 'Edit Image' : 'Insert Image',
            body: form,
            extraButtons: extraButtons,
            onSave: () => {
                const url = urlInput.value;
                const alt = altInput.value;
                const title = titleInput.value;
                const srcset = srcsetInput.value;
                const loading = loadingSelect.value;
                const caption = captionInput.value;
                const linkUrl = linkInput.value;
                const isBlank = targetCheck.checked;
                const isNofollow = nofollowCheck.checked;
                const relExtra = relInput.value.trim();

                if (url && url !== 'https://') {
                    if (isEditing) {
                        // Обновляем существующее изображение
                        this.updateImage(existingFigure, existingImg, {
                            url,
                            alt,
                            title,
                            srcset,
                            loading,
                            caption,
                            linkUrl,
                            isBlank,
                            isNofollow,
                            relExtra
                        });
                    } else {
                        this.instance.selection.restore();
                        this.insertImage({
                            url,
                            alt,
                            title,
                            srcset,
                            loading,
                            caption,
                            linkUrl,
                            isBlank,
                            isNofollow,
                            relExtra
                        });
                    }
                    this.instance.sync();
                }
            }
        });
    }

    /**
     * Упрощённая модалка для lite mode
     * Только URL и alt, без загрузки, srcset, ссылок и т.д.
     */
    openLiteModal(existingFigure = null, existingImg = null) {
        this.instance.selection.save();
        this.currentFigure = existingFigure;
        
        // Извлекаем существующие данные
        let existingData = {
            url: 'https://',
            alt: ''
        };
        
        if (existingFigure) {
            const img = existingFigure.querySelector('img');
            if (img) {
                existingData.url = img.getAttribute('src') || 'https://';
                existingData.alt = img.getAttribute('alt') || '';
            }
        } else if (existingImg) {
            existingData.url = existingImg.getAttribute('src') || 'https://';
            existingData.alt = existingImg.getAttribute('alt') || '';
        }
        
        const isEditing = existingFigure || existingImg;

        const form = document.createElement('div');
        
        // Только URL и Alt - простая форма
        const urlGroup = this.createInputGroup('Image URL *', 'text', existingData.url);
        const urlInput = urlGroup.querySelector('input');
        urlInput.placeholder = 'https://example.com/image.jpg';

        const altGroup = this.createInputGroup('Alt text (description)', 'text', existingData.alt);
        const altInput = altGroup.querySelector('input');
        altInput.placeholder = 'Describe the image';

        form.append(urlGroup, altGroup);

        // Подготовка дополнительных кнопок (Delete для редактирования)
        const extraButtons = [];
        if (isEditing) {
            extraButtons.push({
                text: 'Remove Image',
                danger: true,
                onClick: () => {
                    if (existingFigure) {
                        existingFigure.remove();
                    } else if (existingImg) {
                        existingImg.remove();
                    }
                    this.instance.sync();
                    this.instance.modal.close();
                }
            });
        }

        this.instance.modal.open({
            title: isEditing ? 'Edit Image' : 'Insert Image',
            body: form,
            extraButtons: extraButtons,
            onSave: () => {
                const url = urlInput.value;
                const alt = altInput.value;

                if (url && url !== 'https://') {
                    if (isEditing) {
                        // Обновляем существующее изображение (упрощённо)
                        this.updateImageLite(existingFigure, existingImg, { url, alt });
                    } else {
                        this.instance.selection.restore();
                        this.insertImageLite({ url, alt });
                    }
                    this.instance.sync();
                }
            }
        });
    }

    /**
     * Обновление изображения в lite mode
     */
    updateImageLite(existingFigure, existingImg, options) {
        const { url, alt } = options;
        
        if (existingFigure) {
            let img = existingFigure.querySelector('img');
            if (!img) {
                img = document.createElement('img');
                img.setAttribute('loading', 'lazy'); // По умолчанию lazy в lite mode
                existingFigure.insertBefore(img, existingFigure.firstChild);
            }
            img.setAttribute('src', url);
            if (alt) img.setAttribute('alt', alt); else img.removeAttribute('alt');
            // Убеждаемся что loading="lazy" установлен
            if (!img.hasAttribute('loading')) {
                img.setAttribute('loading', 'lazy');
            }
        } else if (existingImg) {
            // Оборачиваем в figure для консистентности
            const figure = document.createElement('figure');
            figure.contentEditable = 'false';
            
            existingImg.setAttribute('src', url);
            if (alt) existingImg.setAttribute('alt', alt); else existingImg.removeAttribute('alt');
            existingImg.setAttribute('loading', 'lazy');
            
            existingImg.parentNode.insertBefore(figure, existingImg);
            figure.appendChild(existingImg);
            
            // Добавляем пустой figcaption
            const figcaption = document.createElement('figcaption');
            figcaption.contentEditable = 'true';
            figcaption.innerHTML = '<br>';
            figure.appendChild(figcaption);
        }
    }

    /**
     * Вставка изображения в lite mode
     */
    insertImageLite(options) {
        const { url, alt } = options;
        
        // Создаём figure для консистентности с полной версией
        const figure = document.createElement('figure');
        figure.contentEditable = 'false';
        
        const img = document.createElement('img');
        img.setAttribute('src', url);
        img.setAttribute('loading', 'lazy'); // По умолчанию lazy в lite mode
        if (alt) img.setAttribute('alt', alt);
        
        figure.appendChild(img);
        
        // Добавляем пустой figcaption для возможности ввода подписи
        const figcaption = document.createElement('figcaption');
        figcaption.contentEditable = 'true';
        figcaption.innerHTML = '<br>';
        figure.appendChild(figcaption);

        this.instance.selection.insertNode(figure);
    }

    /**
     * Открытие панели просмотра загруженных изображений
     */
    openBrowsePanel(container, onSelect) {
        // Очищаем контейнер и показываем загрузку
        container.innerHTML = `
            <div style="text-align: center; padding: 20px; color: #6b7280;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite; display: inline-block;">
                    <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="32">
                        <animate attributeName="stroke-dashoffset" values="32;0" dur="1s" repeatCount="indefinite"/>
                    </circle>
                </svg>
                <div style="margin-top: 8px;">Loading images...</div>
            </div>
        `;
        
        fetch(this.browseUrl + '?action=browse')
            .then(response => response.json())
            .then(data => {
                if (!data.success) {
                    container.innerHTML = `<div style="color: #dc2626; padding: 10px;">Error: ${data.error || 'Failed to load images'}</div>`;
                    return;
                }
                
                if (data.images.length === 0) {
                    container.innerHTML = `<div style="color: #6b7280; padding: 20px; text-align: center;">No images uploaded yet</div>`;
                    return;
                }
                
                this.renderBrowseGrid(container, data.images, data.allowDelete, onSelect);
            })
            .catch(error => {
                container.innerHTML = `<div style="color: #dc2626; padding: 10px;">Connection error</div>`;
            });
    }

    /**
     * Рендер сетки изображений для выбора
     */
    renderBrowseGrid(container, images, allowDelete, onSelect) {
        container.innerHTML = '';
        
        const grid = document.createElement('div');
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(100px, 1fr))';
        grid.style.gap = '8px';
        grid.style.maxHeight = '250px';
        grid.style.overflowY = 'auto';
        grid.style.padding = '8px';
        grid.style.background = '#f9fafb';
        grid.style.borderRadius = '8px';
        grid.style.border = '1px solid #e5e7eb';
        
        images.forEach(img => {
            const item = document.createElement('div');
            item.style.position = 'relative';
            item.style.aspectRatio = '1';
            item.style.borderRadius = '6px';
            item.style.overflow = 'hidden';
            item.style.cursor = 'pointer';
            item.style.border = '2px solid transparent';
            item.style.transition = 'border-color 0.15s, transform 0.15s';
            item.style.background = '#fff';
            
            // Превью изображения
            const preview = document.createElement('img');
            preview.src = img.src;
            preview.style.width = '100%';
            preview.style.height = '100%';
            preview.style.objectFit = 'cover';
            preview.alt = img.filename;
            
            // Tooltip с информацией
            item.title = `${img.filename}\n${img.size}`;
            
            // Hover эффект
            item.addEventListener('mouseenter', () => {
                item.style.borderColor = '#3b82f6';
                item.style.transform = 'scale(1.02)';
            });
            item.addEventListener('mouseleave', () => {
                item.style.borderColor = 'transparent';
                item.style.transform = 'scale(1)';
            });
            
            // Клик для выбора
            item.addEventListener('click', () => {
                onSelect(img);
                // Закрываем панель после выбора
                container.innerHTML = `<div style="color: #10b981; padding: 10px; text-align: center;">Image selected: ${img.filename}</div>`;
                setTimeout(() => {
                    // Восстанавливаем кнопку browse
                    this.restoreBrowseButton(container, onSelect);
                }, 1500);
            });
            
            item.appendChild(preview);
            
            // Кнопка удаления (если разрешено)
            if (allowDelete) {
                const deleteBtn = document.createElement('button');
                deleteBtn.type = 'button';
                deleteBtn.innerHTML = '×';
                deleteBtn.style.position = 'absolute';
                deleteBtn.style.top = '4px';
                deleteBtn.style.right = '4px';
                deleteBtn.style.width = '20px';
                deleteBtn.style.height = '20px';
                deleteBtn.style.padding = '0';
                deleteBtn.style.background = 'rgba(220, 38, 38, 0.9)';
                deleteBtn.style.color = 'white';
                deleteBtn.style.border = 'none';
                deleteBtn.style.borderRadius = '50%';
                deleteBtn.style.cursor = 'pointer';
                deleteBtn.style.fontSize = '14px';
                deleteBtn.style.lineHeight = '1';
                deleteBtn.style.display = 'none';
                deleteBtn.title = 'Delete image';
                
                item.addEventListener('mouseenter', () => {
                    deleteBtn.style.display = 'block';
                });
                item.addEventListener('mouseleave', () => {
                    deleteBtn.style.display = 'none';
                });
                
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (confirm(`Delete ${img.filename}?`)) {
                        this.deleteImage(img.filename, container, onSelect);
                    }
                });
                
                item.appendChild(deleteBtn);
            }
            
            // Информация о файле
            const info = document.createElement('div');
            info.style.position = 'absolute';
            info.style.bottom = '0';
            info.style.left = '0';
            info.style.right = '0';
            info.style.background = 'linear-gradient(transparent, rgba(0,0,0,0.7))';
            info.style.color = 'white';
            info.style.padding = '20px 6px 6px';
            info.style.fontSize = '10px';
            info.style.whiteSpace = 'nowrap';
            info.style.overflow = 'hidden';
            info.style.textOverflow = 'ellipsis';
            info.textContent = img.size;
            
            item.appendChild(info);
            grid.appendChild(item);
        });
        
        container.appendChild(grid);
        
        // Кнопка "Закрыть"
        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.textContent = 'Close gallery';
        closeBtn.style.width = '100%';
        closeBtn.style.marginTop = '8px';
        closeBtn.style.padding = '8px';
        closeBtn.style.background = '#e5e7eb';
        closeBtn.style.border = 'none';
        closeBtn.style.borderRadius = '6px';
        closeBtn.style.cursor = 'pointer';
        closeBtn.style.fontSize = '13px';
        closeBtn.style.color = '#374151';
        
        closeBtn.addEventListener('click', () => {
            this.restoreBrowseButton(container, onSelect);
        });
        
        container.appendChild(closeBtn);
    }

    /**
     * Восстановление кнопки browse
     */
    restoreBrowseButton(container, onSelect) {
        container.innerHTML = '';
        
        const browseBtn = document.createElement('button');
        browseBtn.type = 'button';
        browseBtn.textContent = 'Choose from uploaded images';
        browseBtn.style.width = '100%';
        browseBtn.style.padding = '10px';
        browseBtn.style.background = '#f3f4f6';
        browseBtn.style.border = '1px solid #e5e7eb';
        browseBtn.style.borderRadius = '6px';
        browseBtn.style.cursor = 'pointer';
        browseBtn.style.fontSize = '14px';
        browseBtn.style.color = '#374151';
        browseBtn.style.transition = 'background 0.15s';
        
        browseBtn.addEventListener('mouseenter', () => {
            browseBtn.style.background = '#e5e7eb';
        });
        browseBtn.addEventListener('mouseleave', () => {
            browseBtn.style.background = '#f3f4f6';
        });
        
        browseBtn.addEventListener('click', () => {
            this.openBrowsePanel(container, onSelect);
        });
        
        container.appendChild(browseBtn);
    }

    /**
     * Удаление изображения
     */
    deleteImage(filename, container, onSelect) {
        const formData = new FormData();
        formData.append('action', 'delete');
        formData.append('file', filename);
        
        fetch(this.browseUrl, {
            method: 'POST',
            body: formData
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Перезагружаем список
                    this.openBrowsePanel(container, onSelect);
                } else {
                    alert(data.error || 'Failed to delete image');
                }
            })
            .catch(() => {
                alert('Connection error');
            });
    }

    createInputGroup(labelText, type, value = '') {
        const div = document.createElement('div');
        const label = document.createElement('label');
        label.textContent = labelText;
        const input = document.createElement('input');
        input.type = type;
        input.value = value;
        div.append(label, input);
        return div;
    }

    createTextareaGroup(labelText, value = '') {
        const div = document.createElement('div');
        const label = document.createElement('label');
        label.textContent = labelText;
        const textarea = document.createElement('textarea');
        textarea.value = value;
        textarea.style.width = '100%';
        textarea.style.minHeight = '60px';
        textarea.style.padding = '8px';
        textarea.style.border = '1px solid #e5e7eb';
        textarea.style.borderRadius = '6px';
        textarea.style.fontFamily = 'inherit';
        textarea.style.fontSize = '14px';
        textarea.style.resize = 'vertical';
        textarea.style.boxSizing = 'border-box';
        div.append(label, textarea);
        return div;
    }

    createSelectGroup(labelText, value = '', options = []) {
        const div = document.createElement('div');
        const label = document.createElement('label');
        label.textContent = labelText;
        const select = document.createElement('select');
        select.style.width = '100%';
        select.style.padding = '10px 12px';
        select.style.marginBottom = '16px';
        select.style.boxSizing = 'border-box';
        select.style.border = '1px solid #e5e7eb';
        select.style.borderRadius = '6px';
        select.style.fontSize = '14px';
        
        options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.label;
            if (opt.value === value) {
                option.selected = true;
            }
            select.appendChild(option);
        });
        
        div.append(label, select);
        return div;
    }

    updateImage(existingFigure, existingImg, options) {
        const { url, alt, title, srcset, loading, caption, linkUrl, isBlank, isNofollow, relExtra } = options;
        
        if (existingFigure) {
            // Обновляем figure
            existingFigure.contentEditable = 'false';
            let img = existingFigure.querySelector('img');
            let link = existingFigure.querySelector('a');
            let figcaption = existingFigure.querySelector('figcaption');
            
            // Обновляем или создаём img
            if (!img) {
                img = document.createElement('img');
            }
            img.setAttribute('src', url);
            if (alt) img.setAttribute('alt', alt); else img.removeAttribute('alt');
            if (title) img.setAttribute('title', title); else img.removeAttribute('title');
            if (srcset) img.setAttribute('srcset', srcset); else img.removeAttribute('srcset');
            if (loading) img.setAttribute('loading', loading); else img.removeAttribute('loading');
            
            // Обрабатываем ссылку
            if (linkUrl) {
                if (!link) {
                    link = document.createElement('a');
                    // Вставляем ссылку, оборачивая img
                    if (img.parentNode === existingFigure) {
                        existingFigure.insertBefore(link, img);
                    } else {
                        existingFigure.insertBefore(link, existingFigure.firstChild);
                    }
                    link.appendChild(img);
                }
                link.href = linkUrl;
                if (isBlank) link.target = '_blank'; else link.removeAttribute('target');
                // Собираем rel
                const relParts = [];
                if (isNofollow) relParts.push('nofollow');
                if (relExtra) relParts.push(relExtra);
                if (relParts.length > 0) link.rel = relParts.join(' '); else link.removeAttribute('rel');
            } else if (link) {
                // Убираем ссылку, оставляем img
                link.parentNode.insertBefore(img, link);
                link.remove();
            }
            
            // Убеждаемся что img/link в figure
            if (!link && img.parentNode !== existingFigure) {
                existingFigure.insertBefore(img, existingFigure.firstChild);
            }
            
            // Всегда есть figcaption
            if (!figcaption) {
                figcaption = document.createElement('figcaption');
                existingFigure.appendChild(figcaption);
            }
            figcaption.contentEditable = 'true';
            figcaption.innerHTML = caption || '<br>';
        } else if (existingImg) {
            // Обновляем отдельный img (без figure) - превращаем в figure
            const figure = document.createElement('figure');
            figure.contentEditable = 'false';
            
            existingImg.setAttribute('src', url);
            if (alt) existingImg.setAttribute('alt', alt); else existingImg.removeAttribute('alt');
            if (title) existingImg.setAttribute('title', title); else existingImg.removeAttribute('title');
            if (srcset) existingImg.setAttribute('srcset', srcset); else existingImg.removeAttribute('srcset');
            if (loading) existingImg.setAttribute('loading', loading); else existingImg.removeAttribute('loading');
            
            let imgOrLink = existingImg;
            const oldLink = existingImg.closest('a');
            
            if (linkUrl) {
                const link = oldLink || document.createElement('a');
                link.href = linkUrl;
                if (isBlank) link.target = '_blank'; else link.removeAttribute('target');
                // Собираем rel
                const relParts = [];
                if (isNofollow) relParts.push('nofollow');
                if (relExtra) relParts.push(relExtra);
                if (relParts.length > 0) link.rel = relParts.join(' '); else link.removeAttribute('rel');
                if (!oldLink) {
                    link.appendChild(existingImg);
                }
                imgOrLink = link;
            } else if (oldLink) {
                // Убираем ссылку
                oldLink.parentNode.insertBefore(existingImg, oldLink);
                oldLink.remove();
                imgOrLink = existingImg;
            }
            
            // Заменяем img/link на figure
            const parent = imgOrLink.parentNode;
            parent.insertBefore(figure, imgOrLink);
            figure.appendChild(imgOrLink);
            
            // Всегда добавляем figcaption
            const figcaption = document.createElement('figcaption');
            figcaption.contentEditable = 'true';
            figcaption.innerHTML = caption || '<br>';
            figure.appendChild(figcaption);
        }
    }

    insertImage(options) {
        const { url, alt, srcset, caption, linkUrl, isBlank, isNofollow, relExtra, title, loading } = options;
        
        // Создаем изображение
        const img = document.createElement('img');
        img.setAttribute('src', url);
        if (alt) img.setAttribute('alt', alt);
        if (srcset) img.setAttribute('srcset', srcset);
        if (title) img.setAttribute('title', title);
        if (loading) img.setAttribute('loading', loading);

        let imgOrLink = img;

        // Если есть ссылка - оборачиваем
        if (linkUrl) {
            const a = document.createElement('a');
            a.href = linkUrl;
            if (isBlank) a.target = '_blank';
            // Собираем rel
            const relParts = [];
            if (isNofollow) relParts.push('nofollow');
            if (relExtra) relParts.push(relExtra);
            if (relParts.length > 0) a.rel = relParts.join(' ');
            a.appendChild(img);
            imgOrLink = a;
        }

        // Всегда создаем figure (даже без caption)
        const figure = document.createElement('figure');
        figure.contentEditable = 'false';
        figure.appendChild(imgOrLink);
        
        // Если есть caption - добавляем figcaption
        const figcaption = document.createElement('figcaption');
        figcaption.contentEditable = 'true';
        figcaption.innerHTML = caption || '<br>'; // Пустой figcaption для возможности ввода
        figure.appendChild(figcaption);

        this.instance.selection.insertNode(figure);
    }
}
