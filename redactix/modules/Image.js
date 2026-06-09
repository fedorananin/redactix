import Module from '../core/Module.js';
import Icons from '../ui/Icons.js';
import { sanitizeUrl, sanitizeImageSrc, sanitizeInlineHtml, composeLinkRel } from '../core/dom-utils.js';

export default class Image extends Module {
    constructor(instance) {
        super(instance);
        this.currentFigure = null; // For editing an existing image
        this.liteMode = instance.config.liteMode || false; // Lite mode - simplified mode
        this.uploadUrl = instance.config.uploadUrl || null; // URL for uploading images
        this.browseUrl = instance.config.browseUrl || null; // URL for browsing images
        this.allowDelete = instance.config.allowImageDelete || false; // Allow deleting images
    }

    init() {
        // Click on image opens edit modal
        this.instance.editorEl.addEventListener('click', (e) => {
            const img = e.target.closest('img');
            if (img) {
                // Photo galleries handle their own clicks (Gallery module).
                // Quote-card author photos are managed by QuoteCard.
                if (img.closest('figure.redactix-gallery')) return;
                if (img.closest('figure.quote-card')) return;
                e.preventDefault();
                const figure = img.closest('figure');
                if (figure) {
                    this.openModal(figure);
                } else {
                    // If img is without figure - create figure and edit
                    this.openModal(null, img);
                }
            }
        });

        // Drag & Drop upload (disabled in lite mode)
        if (this.uploadUrl && !this.liteMode) {
            this.initDragDrop();
            this.initPasteUpload();
        }

        // Processing of base64 images after pasting (from Google Docs etc.)
        // In lite mode base64 images are removed
        this.initBase64Handler();
    }

    /**
     * Processing base64 images after pasting
     */
    initBase64Handler() {
        // Use MutationObserver to monitor new images
        const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Find all images with base64 src
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

        if (this.instance.onDestroy) {
            this.instance.onDestroy(() => observer.disconnect());
        }
    }

    /**
     * Processing a single base64 image
     */
    async handleBase64Image(img) {
        // In lite mode or if there is no uploadUrl - remove base64 image
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

        // Show loading indicator
        const figure = img.closest('figure');
        if (figure) {
            figure.classList.add('redactix-uploading');
        }
        img.style.opacity = '0.5';

        try {
            // Convert base64 to File
            const file = this.base64ToFile(src);

            // Upload to server
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
                // Replace src with server URL
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

            // Show error and remove image
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
     * Converting base64 to File
     */
    base64ToFile(dataUrl) {
        // Parse data URL
        const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (!matches) {
            throw new Error('Invalid data URL');
        }

        const mimeType = matches[1];
        const base64Data = matches[2];

        // Decode base64
        const byteString = atob(base64Data);
        const byteArray = new Uint8Array(byteString.length);
        for (let i = 0; i < byteString.length; i++) {
            byteArray[i] = byteString.charCodeAt(i);
        }

        // Determine extension
        const extMap = {
            'image/jpeg': 'jpg',
            'image/png': 'png',
            'image/gif': 'gif',
            'image/webp': 'webp',
            'image/svg+xml': 'svg',
            'image/avif': 'avif'
        };
        const ext = extMap[mimeType] || 'png';

        // Create File
        const blob = new Blob([byteArray], { type: mimeType });
        return new File([blob], `pasted-image.${ext}`, { type: mimeType });
    }

    /**
     * Initializing drag & drop upload
     */
    initDragDrop() {
        const editor = this.instance.editorEl;

        // Native dragstart inside contenteditable is silenced in Editor.js
        // (bindEvents) unconditionally - only the upload zone remains here.

        editor.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            editor.classList.add('redactix-dragover');
        });

        editor.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            // Verify that we actually left the editor
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
                // Filter only images
                const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
                if (imageFiles.length > 0) {
                    // Save cursor position for insertion
                    this.instance.selection.save();
                    this.uploadFiles(imageFiles);
                }
            }
        });
    }

    /**
     * Initializing upload via paste (Ctrl+V)
     */
    initPasteUpload() {
        // Use capture phase to intercept event before other handlers
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
                // Fully block paste to prevent browser from inserting HTML with original link
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();

                this.uploadFilesAtCursor(imageFiles);
            }
        }, true); // capture: true - intercepting on capture phase
    }

    /**
     * Uploading files to server (for drag&drop with position preservation)
     */
    async uploadFiles(files) {
        for (const file of files) {
            await this.uploadFile(file);
        }
    }

    /**
     * Uploading files to current cursor position (for paste)
     */
    async uploadFilesAtCursor(files) {
        for (const file of files) {
            await this.uploadFileAtCursor(file);
        }
    }

    /**
     * Uploading a single file (with position restore - for drag&drop)
     */
    async uploadFile(file) {
        const placeholder = this.createUploadPlaceholder();
        this.instance.selection.restore();
        this.instance.selection.insertNode(placeholder);
        this.instance.selection.save();

        await this.processUpload(file, placeholder);
    }

    /**
     * Uploading a single file at current cursor position (for paste)
     */
    async uploadFileAtCursor(file) {
        const placeholder = this.createUploadPlaceholder();
        this.instance.selection.insertNode(placeholder);

        await this.processUpload(file, placeholder);
    }

    /**
     * General file upload logic
     */
    async processUpload(file, placeholder) {
        try {
            const formData = new FormData();
            formData.append('image', file);

            const response = await fetch(this.uploadUrl, {
                method: 'POST',
                body: formData
            });

            // Check HTTP status
            if (!response.ok && response.status !== 400) {
                throw new Error(`Server error (${response.status})`);
            }

            // Try to parse JSON
            let result;
            try {
                result = await response.json();
            } catch (e) {
                throw new Error('Invalid server response');
            }

            if (result.success) {
                // Replace placeholder with real image
                this.replacePlaceholderWithImage(placeholder, result);
            } else {
                // Error from server
                this.showUploadError(placeholder, result.error || 'Upload failed');
            }
        } catch (error) {
            // Network error or parsing error
            this.showUploadError(placeholder, error.message || 'Connection error');
        }
    }

    /**
     * Creating placeholder during upload
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
                <span>${this.t('image.uploading')}</span>
            </div>
        `;
        return placeholder;
    }

    /**
     * Replacing placeholder with uploaded image
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
        if (this.instance.core) this.instance.core.ensureTrailingParagraph();
    }

    /**
     * Showing upload error
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
                <button type="button" class="redactix-upload-error-close">${this.t('upload.remove')}</button>
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
                title: this.t('toolbar.insertImage'),
                action: () => this.openModal()
            }
        ];
    }

    openModal(existingFigure = null, existingImg = null) {
        // In lite mode, use simplified version of the modal
        if (this.liteMode) {
            this.openLiteModal(existingFigure, existingImg);
            return;
        }

        this.instance.selection.save();
        this.currentFigure = existingFigure;

        // Extract existing data
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
            relExtra: '' // Additional rel values (except nofollow)
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
                // Remove <br> from caption for display
                let caption = figcaption.innerHTML || '';
                caption = caption.replace(/<br\s*\/?>/gi, '').trim();
                existingData.caption = caption;
            }
            if (link) {
                existingData.linkUrl = link.getAttribute('href') || '';
                existingData.isBlank = link.target === '_blank';
                existingData.isNofollow = (link.rel || '').includes('nofollow');
                // Extract additional rel values (except nofollow)
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

        // File upload block (if uploadUrl is present)
        let fileInput = null;
        let uploadStatus = null;

        if (this.uploadUrl) {
            const uploadGroup = document.createElement('div');
            uploadGroup.className = 'redactix-upload-group';
            uploadGroup.style.marginBottom = '16px';
            uploadGroup.style.padding = '16px';
            uploadGroup.style.border = '2px dashed var(--redactix-border)';
            uploadGroup.style.borderRadius = '8px';
            uploadGroup.style.textAlign = 'center';
            uploadGroup.style.transition = 'border-color 0.2s, background-color 0.2s';

            const uploadLabel = document.createElement('label');
            uploadLabel.style.display = 'block';
            uploadLabel.style.cursor = 'pointer';
            uploadLabel.innerHTML = `
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 8px; color: var(--redactix-text-placeholder);">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                <div style="color: var(--redactix-text-muted); font-size: 14px;">${isEditing ? this.t('image.uploadReplace') : this.t('image.uploadClick')}</div>
                <div style="color: var(--redactix-text-placeholder); font-size: 12px; margin-top: 4px;">${this.t('image.uploadFormats')}</div>
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

            // Drag & drop for upload zone
            uploadGroup.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadGroup.style.borderColor = 'var(--redactix-primary)';
                uploadGroup.style.backgroundColor = 'var(--redactix-dragover-bg)';
            });

            uploadGroup.addEventListener('dragleave', (e) => {
                e.preventDefault();
                uploadGroup.style.borderColor = 'var(--redactix-border)';
                uploadGroup.style.backgroundColor = '';
            });

            uploadGroup.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadGroup.style.borderColor = 'var(--redactix-border)';
                uploadGroup.style.backgroundColor = '';

                const files = e.dataTransfer.files;
                if (files.length > 0 && files[0].type.startsWith('image/')) {
                    fileInput.files = files;
                    fileInput.dispatchEvent(new Event('change'));
                }
            });

            form.appendChild(uploadGroup);
        }

        // Image browser block (if browseUrl is present)
        let browseContainer = null;
        if (this.browseUrl) {
            browseContainer = document.createElement('div');
            browseContainer.style.marginBottom = '16px';

            const browseBtn = document.createElement('button');
            browseBtn.type = 'button';
            browseBtn.textContent = this.t('image.chooseFromUploaded');
            browseBtn.style.width = '100%';
            browseBtn.style.padding = '10px';
            browseBtn.style.background = 'var(--redactix-bg-hover)';
            browseBtn.style.border = '1px solid var(--redactix-border)';
            browseBtn.style.borderRadius = '6px';
            browseBtn.style.cursor = 'pointer';
            browseBtn.style.fontSize = '14px';
            browseBtn.style.color = 'var(--redactix-text)';
            browseBtn.style.transition = 'background 0.15s';

            browseBtn.addEventListener('mouseenter', () => {
                browseBtn.style.background = 'var(--redactix-bg-active)';
            });
            browseBtn.addEventListener('mouseleave', () => {
                browseBtn.style.background = 'var(--redactix-bg-hover)';
            });

            browseBtn.addEventListener('click', () => {
                this.openBrowsePanel(browseContainer, (imageData) => {
                    // Fill inputs with selected image data
                    if (urlInput) urlInput.value = imageData.src;
                    if (srcsetInput && imageData.srcset) srcsetInput.value = imageData.srcset;
                    if (altInput && imageData.alt) altInput.value = imageData.alt;
                    if (titleInput && imageData.title) titleInput.value = imageData.title;
                });
            });

            browseContainer.appendChild(browseBtn);
            form.appendChild(browseContainer);
        }

        // Divider "or" (if upload or browse is present)
        if (this.uploadUrl || this.browseUrl) {
            const orDivider = document.createElement('div');
            orDivider.style.textAlign = 'center';
            orDivider.style.color = 'var(--redactix-text-placeholder)';
            orDivider.style.fontSize = '13px';
            orDivider.style.margin = '12px 0';
            orDivider.style.position = 'relative';
            orDivider.innerHTML = `
                <span style="background: var(--redactix-bg); padding: 0 12px; position: relative; z-index: 1;">${this.t('image.orEnterUrl')}</span>
                <div style="position: absolute; top: 50%; left: 0; right: 0; height: 1px; background: var(--redactix-bg-active); z-index: 0;"></div>
            `;
            form.appendChild(orDivider);
        }

        // Fields grid (2 columns on PC, 1 on mobile)
        const grid = document.createElement('div');
        grid.className = 'redactix-modal-grid';

        // Main fields
        const urlGroup = this.createInputGroup(this.t('image.url') + ' *', 'text', existingData.url);
        urlGroup.className = 'redactix-modal-full-width';
        const urlInput = urlGroup.querySelector('input');

        const altGroup = this.createInputGroup(this.t('image.alt'), 'text', existingData.alt);
        const altInput = altGroup.querySelector('input');

        const titleGroup = this.createInputGroup(this.t('image.title_attr'), 'text', existingData.title);
        const titleInput = titleGroup.querySelector('input');

        const srcsetGroup = this.createInputGroup(this.t('image.srcset'), 'text', existingData.srcset);
        srcsetGroup.className = 'redactix-modal-full-width';
        const srcsetInput = srcsetGroup.querySelector('input');
        srcsetInput.placeholder = this.t('image.srcsetPlaceholder');

        // Loading attribute
        const loadingGroup = this.createSelectGroup(this.t('image.loading'), existingData.loading, [
            { value: '', label: this.t('image.loadingDefault') },
            { value: 'lazy', label: this.t('image.loadingLazy') },
            { value: 'eager', label: this.t('image.loadingEager') }
        ]);
        const loadingSelect = loadingGroup.querySelector('select');

        // Caption (signature)
        const captionGroup = this.createTextareaGroup(this.t('image.caption'), existingData.caption);
        captionGroup.className = 'redactix-modal-full-width';
        const captionInput = captionGroup.querySelector('textarea');
        captionInput.placeholder = this.t('image.captionPlaceholder');

        // Добавляем поля в сетку
        grid.append(urlGroup, altGroup, titleGroup, srcsetGroup, loadingGroup, captionGroup);

        // Divider - link section
        const linkSection = document.createElement('div');
        linkSection.className = 'redactix-modal-full-width';
        linkSection.style.borderTop = '1px solid var(--redactix-border)';
        linkSection.style.marginTop = '8px';
        linkSection.style.paddingTop = '15px';

        const linkTitle = document.createElement('div');
        linkTitle.textContent = this.t('image.linkSection');
        linkTitle.style.fontWeight = '600';
        linkTitle.style.marginBottom = '10px';
        linkTitle.style.fontSize = '14px';
        linkSection.appendChild(linkTitle);

        // Grid for link fields
        const linkGrid = document.createElement('div');
        linkGrid.className = 'redactix-modal-grid';

        // Link for image
        const linkGroup = this.createInputGroup(this.t('image.linkUrl'), 'text', existingData.linkUrl);
        const linkInput = linkGroup.querySelector('input');
        linkInput.placeholder = this.t('image.linkUrlPlaceholder');

        // Rel (additional values)
        const relGroup = this.createInputGroup(this.t('image.relExceptNofollow'), 'text', existingData.relExtra);
        const relInput = relGroup.querySelector('input');
        relInput.placeholder = this.t('image.relPlaceholder');

        linkGrid.append(linkGroup, relGroup);
        linkSection.appendChild(linkGrid);

        // Checkboxes for link
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
        targetLabel.append(targetCheck, this.t('image.openNewWindow'));

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
        nofollowLabel.append(nofollowCheck, this.t('image.nofollow'));

        checksDiv.append(targetLabel, nofollowLabel);
        linkSection.appendChild(checksDiv);

        // Добавляем секцию ссылки в основную сетку
        grid.appendChild(linkSection);

        form.appendChild(grid);

        // Handler for file upload in modal
        if (fileInput) {
            fileInput.addEventListener('change', async () => {
                const file = fileInput.files[0];
                if (!file) return;

                uploadStatus.style.display = 'block';
                uploadStatus.style.color = 'var(--redactix-primary)';
                uploadStatus.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: inline-block; vertical-align: middle; margin-right: 6px; animation: spin 1s linear infinite;">
                        <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="32">
                            <animate attributeName="stroke-dashoffset" values="32;0" dur="1s" repeatCount="indefinite"/>
                        </circle>
                    </svg>
                    ${this.t('image.uploading')}
                `;

                try {
                    const formData = new FormData();
                    formData.append('image', file);

                    const response = await fetch(this.uploadUrl, {
                        method: 'POST',
                        body: formData
                    });

                    // Check HTTP status
                    if (!response.ok && response.status !== 400) {
                        throw new Error(`Server error (${response.status})`);
                    }

                    // Try to parse JSON
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
                            ${this.t('image.uploadSuccess')}
                        `;

                        // Fill inputs with server data
                        urlInput.value = result.src;
                        if (result.srcset) srcsetInput.value = result.srcset;
                        if (result.alt) altInput.value = result.alt;
                        if (result.title) titleInput.value = result.title;
                        if (result.caption) captionInput.value = result.caption;
                    } else {
                        // Error from server
                        uploadStatus.style.color = 'var(--redactix-danger)';
                        uploadStatus.textContent = result.error || 'Upload failed';
                    }
                } catch (error) {
                    // Network error or parsing error
                    uploadStatus.style.color = 'var(--redactix-danger)';
                    uploadStatus.textContent = error.message || 'Connection error';
                }
            });
        }

        // Preparing additional buttons (Delete for editing)
        const extraButtons = [];
        if (isEditing) {
            extraButtons.push({
                text: this.t('image.removeImage'),
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
            title: isEditing ? this.t('image.editTitle') : this.t('image.title'),
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
                        // Update existing image
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
     * Simplified modal for lite mode
     * Only URL and alt, without upload, srcset, links, etc.
     */
    openLiteModal(existingFigure = null, existingImg = null) {
        this.instance.selection.save();
        this.currentFigure = existingFigure;

        // Extract existing data
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

        // Only URL and Alt - simple form
        const urlGroup = this.createInputGroup(this.t('image.url') + ' *', 'text', existingData.url);
        const urlInput = urlGroup.querySelector('input');
        urlInput.placeholder = 'https://example.com/image.jpg';

        const altGroup = this.createInputGroup(this.t('image.altDescription'), 'text', existingData.alt);
        const altInput = altGroup.querySelector('input');
        altInput.placeholder = '';

        form.append(urlGroup, altGroup);

        // Preparing additional buttons (Delete for editing)
        const extraButtons = [];
        if (isEditing) {
            extraButtons.push({
                text: this.t('image.removeImage'),
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
            title: isEditing ? this.t('image.editTitle') : this.t('image.title'),
            body: form,
            extraButtons: extraButtons,
            onSave: () => {
                const url = urlInput.value;
                const alt = altInput.value;

                if (url && url !== 'https://') {
                    if (isEditing) {
                        // Update existing image (simplified)
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
     * Update image in lite mode
     */
    updateImageLite(existingFigure, existingImg, options) {
        const { alt } = options;
        const url = sanitizeImageSrc(options.url);
        if (!url) return;

        if (existingFigure) {
            let img = existingFigure.querySelector('img');
            if (!img) {
                img = document.createElement('img');
                img.setAttribute('loading', 'lazy'); // Default lazy in lite mode
                existingFigure.insertBefore(img, existingFigure.firstChild);
            }
            img.setAttribute('src', url);
            if (alt) img.setAttribute('alt', alt); else img.removeAttribute('alt');
            // Ensure that loading="lazy" is set
            if (!img.hasAttribute('loading')) {
                img.setAttribute('loading', 'lazy');
            }
        } else if (existingImg) {
            // Wrap in figure for consistency
            const figure = document.createElement('figure');
            figure.contentEditable = 'false';

            existingImg.setAttribute('src', url);
            if (alt) existingImg.setAttribute('alt', alt); else existingImg.removeAttribute('alt');
            existingImg.setAttribute('loading', 'lazy');

            existingImg.parentNode.insertBefore(figure, existingImg);
            figure.appendChild(existingImg);

            // Add empty figcaption
            const figcaption = document.createElement('figcaption');
            figcaption.contentEditable = 'true';
            figcaption.innerHTML = '<br>';
            figure.appendChild(figcaption);
        }
    }

    /**
     * Insert image in lite mode
     */
    insertImageLite(options) {
        const { alt } = options;
        const url = sanitizeImageSrc(options.url);
        if (!url) return;

        // Create figure for consistency with full version
        const figure = document.createElement('figure');
        figure.contentEditable = 'false';

        const img = document.createElement('img');
        img.setAttribute('src', url);
        img.setAttribute('loading', 'lazy'); // Default lazy in lite mode
        if (alt) img.setAttribute('alt', alt);

        figure.appendChild(img);

        // Add empty figcaption to allow caption input
        const figcaption = document.createElement('figcaption');
        figcaption.contentEditable = 'true';
        figcaption.innerHTML = '<br>';
        figure.appendChild(figcaption);

        this.instance.selection.insertNode(figure);
        if (this.instance.core) this.instance.core.ensureTrailingParagraph();
    }

    /**
     * Open panel for browsing uploaded images
     */
    openBrowsePanel(container, onSelect) {
        // Clear container and show loading
        container.innerHTML = `
            <div style="text-align: center; padding: 20px; color: var(--redactix-text-muted);">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite; display: inline-block;">
                    <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="32">
                        <animate attributeName="stroke-dashoffset" values="32;0" dur="1s" repeatCount="indefinite"/>
                    </circle>
                </svg>
                <div style="margin-top: 8px;">${this.t('image.loadingImages')}</div>
            </div>
        `;

        const browseFormData = new FormData();
        browseFormData.append('action', 'browse');

        fetch(this.browseUrl, {
            method: 'POST',
            body: browseFormData
        })
            .then(response => response.json())
            .then(data => {
                if (!data.success) {
                    container.innerHTML = `<div style="color: var(--redactix-danger); padding: 10px;">Error: ${data.error || 'Failed to load images'}</div>`;
                    return;
                }

                if (data.images.length === 0) {
                    container.innerHTML = `<div style="color: var(--redactix-text-muted); padding: 20px; text-align: center;">${this.t('image.noImages')}</div>`;
                    return;
                }

                this.renderBrowseGrid(container, data.images, data.allowDelete, onSelect);
            })
            .catch(error => {
                container.innerHTML = `<div style="color: var(--redactix-danger); padding: 10px;">Connection error</div>`;
            });
    }

    /**
     * Render grid of images for selection
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
        grid.style.background = 'var(--redactix-bg-secondary)';
        grid.style.borderRadius = '8px';
        grid.style.border = '1px solid var(--redactix-border)';

        images.forEach(img => {
            const item = document.createElement('div');
            item.style.position = 'relative';
            item.style.aspectRatio = '1';
            item.style.borderRadius = '6px';
            item.style.overflow = 'hidden';
            item.style.cursor = 'pointer';
            item.style.border = '2px solid transparent';
            item.style.transition = 'border-color 0.15s, transform 0.15s';
            item.style.background = 'var(--redactix-bg)';

            // Image preview
            const preview = document.createElement('img');
            preview.src = img.src;
            preview.style.width = '100%';
            preview.style.height = '100%';
            preview.style.objectFit = 'cover';
            preview.alt = img.filename;

            // Tooltip with information
            item.title = `${img.filename}\n${img.size}`;

            // Hover effect
            item.addEventListener('mouseenter', () => {
                item.style.borderColor = 'var(--redactix-primary)';
                item.style.transform = 'scale(1.02)';
            });
            item.addEventListener('mouseleave', () => {
                item.style.borderColor = 'transparent';
                item.style.transform = 'scale(1)';
            });

            // Click to select
            item.addEventListener('click', () => {
                onSelect(img);
                // Close the panel after selection
                container.innerHTML = `<div style="color: #10b981; padding: 10px; text-align: center;">${this.t('image.imageSelected')}: ${img.filename}</div>`;
                setTimeout(() => {
                    // Restore browse button
                    this.restoreBrowseButton(container, onSelect);
                }, 1500);
            });

            item.appendChild(preview);

            // Delete button (if allowed)
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
                deleteBtn.title = this.t('image.deleteTooltip');

                // On touch devices there is no hover - the button is always visible.
                const hoverable = window.matchMedia && window.matchMedia('(hover: hover)').matches;
                deleteBtn.style.display = hoverable ? 'none' : 'block';
                if (hoverable) {
                    item.addEventListener('mouseenter', () => {
                        deleteBtn.style.display = 'block';
                    });
                    item.addEventListener('mouseleave', () => {
                        deleteBtn.style.display = 'none';
                    });
                }

                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (confirm(this.t('image.confirmDelete', { filename: img.filename }))) {
                        this.deleteImage(img.filename, container, onSelect);
                    }
                });

                item.appendChild(deleteBtn);
            }

            // File information
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

        // "Close" button
        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.textContent = this.t('image.closeGallery');
        closeBtn.style.width = '100%';
        closeBtn.style.marginTop = '8px';
        closeBtn.style.padding = '8px';
        closeBtn.style.background = 'var(--redactix-bg-active)';
        closeBtn.style.border = 'none';
        closeBtn.style.borderRadius = '6px';
        closeBtn.style.cursor = 'pointer';
        closeBtn.style.fontSize = '13px';
        closeBtn.style.color = 'var(--redactix-text)';

        closeBtn.addEventListener('click', () => {
            this.restoreBrowseButton(container, onSelect);
        });

        container.appendChild(closeBtn);
    }

    /**
     * Restore browse button
     */
    restoreBrowseButton(container, onSelect) {
        container.innerHTML = '';

        const browseBtn = document.createElement('button');
        browseBtn.type = 'button';
        browseBtn.textContent = this.t('image.chooseFromUploaded');
        browseBtn.style.width = '100%';
        browseBtn.style.padding = '10px';
        browseBtn.style.background = 'var(--redactix-bg-hover)';
        browseBtn.style.border = '1px solid var(--redactix-border)';
        browseBtn.style.borderRadius = '6px';
        browseBtn.style.cursor = 'pointer';
        browseBtn.style.fontSize = '14px';
        browseBtn.style.color = 'var(--redactix-text)';
        browseBtn.style.transition = 'background 0.15s';

        browseBtn.addEventListener('mouseenter', () => {
            browseBtn.style.background = 'var(--redactix-bg-active)';
        });
        browseBtn.addEventListener('mouseleave', () => {
            browseBtn.style.background = 'var(--redactix-bg-hover)';
        });

        browseBtn.addEventListener('click', () => {
            this.openBrowsePanel(container, onSelect);
        });

        container.appendChild(browseBtn);
    }

    /**
     * Delete image
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
                    // Reload the list
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
        textarea.style.border = '1px solid var(--redactix-border)';
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
        select.style.border = '1px solid var(--redactix-border)';
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
        const { alt, title, srcset, loading, isBlank, isNofollow, relExtra } = options;

        // Same sanitization as on paste path: src - only http(s)/
        // relative/raster data:, href link - safe schema,
        // rel is built via composeLinkRel (noopener for _blank).
        const url = sanitizeImageSrc(options.url);
        if (!url) return;
        const linkUrl = options.linkUrl ? sanitizeUrl(options.linkUrl) : null;
        const caption = sanitizeInlineHtml(options.caption || '');
        const rel = composeLinkRel({ nofollow: isNofollow, blank: isBlank, extra: relExtra });

        if (existingFigure) {
            // Update figure
            existingFigure.contentEditable = 'false';
            let img = existingFigure.querySelector('img');
            let link = existingFigure.querySelector('a');
            let figcaption = existingFigure.querySelector('figcaption');

            // Update or create img
            if (!img) {
                img = document.createElement('img');
            }
            img.setAttribute('src', url);
            if (alt) img.setAttribute('alt', alt); else img.removeAttribute('alt');
            if (title) img.setAttribute('title', title); else img.removeAttribute('title');
            if (srcset) img.setAttribute('srcset', srcset); else img.removeAttribute('srcset');
            if (loading) img.setAttribute('loading', loading); else img.removeAttribute('loading');

            // Process the link
            if (linkUrl) {
                if (!link) {
                    link = document.createElement('a');
                    // Insert link wrapping img
                    if (img.parentNode === existingFigure) {
                        existingFigure.insertBefore(link, img);
                    } else {
                        existingFigure.insertBefore(link, existingFigure.firstChild);
                    }
                    link.appendChild(img);
                }
                link.href = linkUrl;
                if (isBlank) link.target = '_blank'; else link.removeAttribute('target');
                if (rel) link.rel = rel; else link.removeAttribute('rel');
            } else if (link) {
                // Remove link, keep img
                link.parentNode.insertBefore(img, link);
                link.remove();
            }

            // Ensure that img/link is in figure
            if (!link && img.parentNode !== existingFigure) {
                existingFigure.insertBefore(img, existingFigure.firstChild);
            }

            // There is always a figcaption
            if (!figcaption) {
                figcaption = document.createElement('figcaption');
                existingFigure.appendChild(figcaption);
            }
            figcaption.contentEditable = 'true';
            figcaption.innerHTML = caption || '<br>';
        } else if (existingImg) {
            // Update standalone img (without figure) - turn into figure
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
                if (rel) link.rel = rel; else link.removeAttribute('rel');
                if (!oldLink) {
                    link.appendChild(existingImg);
                }
                imgOrLink = link;
            } else if (oldLink) {
                // Remove the link
                oldLink.parentNode.insertBefore(existingImg, oldLink);
                oldLink.remove();
                imgOrLink = existingImg;
            }

            // Replace img/link with figure
            const parent = imgOrLink.parentNode;
            parent.insertBefore(figure, imgOrLink);
            figure.appendChild(imgOrLink);

            // Always add figcaption
            const figcaption = document.createElement('figcaption');
            figcaption.contentEditable = 'true';
            figcaption.innerHTML = caption || '<br>';
            figure.appendChild(figcaption);
        }
    }

    insertImage(options) {
        const { alt, srcset, isBlank, isNofollow, relExtra, title, loading } = options;

        // Sanitization - same as in updateImage.
        const url = sanitizeImageSrc(options.url);
        if (!url) return;
        const linkUrl = options.linkUrl ? sanitizeUrl(options.linkUrl) : null;
        const caption = sanitizeInlineHtml(options.caption || '');

        // Create image
        const img = document.createElement('img');
        img.setAttribute('src', url);
        if (alt) img.setAttribute('alt', alt);
        if (srcset) img.setAttribute('srcset', srcset);
        if (title) img.setAttribute('title', title);
        if (loading) img.setAttribute('loading', loading);

        let imgOrLink = img;

        // If link exists - wrap it
        if (linkUrl) {
            const a = document.createElement('a');
            a.href = linkUrl;
            if (isBlank) a.target = '_blank';
            const rel = composeLinkRel({ nofollow: isNofollow, blank: isBlank, extra: relExtra });
            if (rel) a.rel = rel;
            a.appendChild(img);
            imgOrLink = a;
        }

        // Always create figure (even without caption)
        const figure = document.createElement('figure');
        figure.contentEditable = 'false';
        figure.appendChild(imgOrLink);

        // If caption exists - add figcaption
        const figcaption = document.createElement('figcaption');
        figcaption.contentEditable = 'true';
        figcaption.innerHTML = caption || '<br>'; // Empty figcaption to allow input
        figure.appendChild(figcaption);

        this.instance.selection.insertNode(figure);
        if (this.instance.core) this.instance.core.ensureTrailingParagraph();
    }
}
