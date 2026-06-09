import Module from '../core/Module.js';
import Icons from '../ui/Icons.js';
import { sanitizeUrl, sanitizeInlineHtml } from '../core/dom-utils.js';

/**
 * Video module.
 *
 * Native HTML5 <video> upload / link, wrapped in figure.redactix-video.
 * Mirrors the Image module's contract: the module is always on. URL
 * insertion always works; file upload + browse panel light up only when
 * `videoUploadUrl` / `videoBrowseUrl` are configured. Lite mode strips
 * those URLs (handled in Redactix.js) so commenters fall back to URL only.
 *
 * Output shape (saved HTML):
 *
 *   <figure class="redactix-video" data-aspect="16:9|4:3|1:1|9:16|auto">
 *     <video src="..." controls preload="metadata"
 *            [style="aspect-ratio:16/9"]></video>
 *     <figcaption>Optional caption</figcaption>
 *   </figure>
 *
 * The aspect-ratio inline style is the only inline layout we emit — for
 * `data-aspect="auto"` no style is set and the video uses its native
 * dimensions. Inside the editor a CSS rule caps video height at 450px
 * (same logic as images); on the production site the admin's stylesheet
 * decides the layout.
 */
export default class Video extends Module {
    constructor(instance) {
        super(instance);
        this.liteMode = instance.config.liteMode || false;
        this.uploadUrl = instance.config.videoUploadUrl || null;
        this.browseUrl = instance.config.videoBrowseUrl || null;
        this.allowDelete = !!instance.config.allowVideoDelete;
        this.currentFigure = null;
    }

    init() {
        // Edit modal opens via the floating "Edit" button (rendered on
        // hover) — clicks on the video itself drive the native controls.
        this.instance.editorEl.addEventListener('click', (e) => {
            const btn = e.target.closest && e.target.closest('.redactix-video-edit-btn');
            if (!btn) return;
            e.preventDefault();
            e.stopPropagation();
            const figure = btn.closest('figure.redactix-video');
            if (figure) this.openModal(figure);
        });

        // Drag&drop загрузка видеофайлов в редактор. Включаем только
        // когда настроен videoUploadUrl и мы не в lite-режиме (lite
        // зануляет uploadUrl в Redactix.js, но проверяем на всякий случай).
        if (this.uploadUrl && !this.liteMode) {
            this.initDragDrop();
        }
    }

    getButtons() {
        return [
            {
                name: 'video',
                label: 'Video',
                icon: Icons.video,
                title: this.t('toolbar.insertVideo'),
                action: () => this.openModal()
            }
        ];
    }

    /**
     * Wire contenteditable + ensure the floating Edit button exists on
     * every video figure. Called from Redactix.js after init / setContent.
     */
    setupVideos(rootEl) {
        const root = rootEl || this.instance.editorEl;
        root.querySelectorAll('figure.redactix-video').forEach(figure => {
            const video = figure.querySelector(':scope > video');
            if (!video) {
                // Broken / orphaned figure — drop it so we don't render an
                // empty box with a non-functional Edit button.
                figure.remove();
                return;
            }
            figure.setAttribute('contenteditable', 'false');
            // Keep the native controls reachable in the editor.
            if (!video.hasAttribute('controls')) video.setAttribute('controls', '');
            if (!video.hasAttribute('preload')) video.setAttribute('preload', 'metadata');

            // Reapply inline aspect-ratio in case it was lost (paste, undo).
            this.applyAspectStyle(video, figure.getAttribute('data-aspect') || 'auto');

            const figcaption = figure.querySelector(':scope > figcaption');
            if (figcaption) figcaption.setAttribute('contenteditable', 'true');

            if (!figure.querySelector(':scope > .redactix-video-edit-btn')) {
                const editBtn = document.createElement('button');
                editBtn.type = 'button';
                editBtn.className = 'redactix-video-edit-btn';
                editBtn.setAttribute('data-redactix-ui', '');
                editBtn.contentEditable = 'false';
                editBtn.textContent = this.t('video.edit');
                figure.appendChild(editBtn);
            }
        });
    }

    /**
     * Sync-side cleanup: drop the floating Edit button and any empty
     * figcaption. Reapply inline aspect-ratio so the saved HTML matches
     * the editor state. Operates on a clone of editorEl, NOT live DOM.
     */
    cleanVideosForSync(clone) {
        clone.querySelectorAll('.redactix-video-edit-btn, [data-redactix-ui]').forEach(el => el.remove());

        clone.querySelectorAll('figure.redactix-video').forEach(figure => {
            figure.removeAttribute('contenteditable');
            const video = figure.querySelector(':scope > video');
            if (video) {
                this.applyAspectStyle(video, figure.getAttribute('data-aspect') || 'auto');
            }
            const figcaption = figure.querySelector(':scope > figcaption');
            if (figcaption) {
                figcaption.removeAttribute('contenteditable');
                const text = (figcaption.textContent || '').trim();
                if (!text) figcaption.remove();
            }
        });
    }

    /**
     * Editor-wide drag&drop upload for video files. Mirrors the Image
     * module's contract — listeners coexist with Image's (the dragover /
     * dragleave handlers are idempotent w.r.t. the .redactix-dragover
     * class, and stopPropagation does NOT block sibling listeners on
     * the same element). Видеофайлы фильтруются по MIME 'video/*';
     * картинки и прочее достанутся Image-модулю.
     */
    initDragDrop() {
        const editor = this.instance.editorEl;

        // Нативный dragstart глушится безусловно в Editor.js (bindEvents).

        editor.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            editor.classList.add('redactix-dragover');
        });

        editor.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!editor.contains(e.relatedTarget)) {
                editor.classList.remove('redactix-dragover');
            }
        });

        editor.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            editor.classList.remove('redactix-dragover');

            const files = e.dataTransfer.files;
            if (files.length === 0) return;
            const videoFiles = Array.from(files).filter(f => f.type.startsWith('video/'));
            if (videoFiles.length === 0) return;

            this.instance.selection.save();
            this.uploadFiles(videoFiles);
        });
    }

    async uploadFiles(files) {
        for (const file of files) {
            await this.uploadFile(file);
        }
    }

    async uploadFile(file) {
        const placeholder = this.createUploadPlaceholder();
        this.instance.selection.restore();
        this.instance.selection.insertNode(placeholder);
        this.instance.selection.save();

        await this.processUpload(file, placeholder);
    }

    async processUpload(file, placeholder) {
        try {
            const formData = new FormData();
            formData.append('video', file);

            const response = await fetch(this.uploadUrl, {
                method: 'POST',
                body: formData
            });

            if (!response.ok && response.status !== 400) {
                throw new Error(`Server error (${response.status})`);
            }

            let result;
            try { result = await response.json(); }
            catch (e) { throw new Error('Invalid server response'); }

            if (result.success) {
                this.replacePlaceholderWithVideo(placeholder, result);
            } else {
                this.showUploadError(placeholder, result.error || 'Upload failed');
            }
        } catch (error) {
            this.showUploadError(placeholder, error.message || 'Connection error');
        }
    }

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
                <span>${this.t('video.uploading')}</span>
            </div>
        `;
        return placeholder;
    }

    replacePlaceholderWithVideo(placeholder, data) {
        const figure = document.createElement('figure');
        figure.className = 'redactix-video';
        figure.setAttribute('data-aspect', 'auto');

        const video = document.createElement('video');
        video.setAttribute('src', data.src);
        video.setAttribute('controls', '');
        video.setAttribute('preload', 'metadata');
        figure.appendChild(video);

        const safeCaption = sanitizeInlineHtml(data.caption || '');
        if (safeCaption) {
            const figcaption = document.createElement('figcaption');
            figcaption.innerHTML = safeCaption;
            figure.appendChild(figcaption);
        }

        placeholder.replaceWith(figure);
        this.setupVideos(this.instance.editorEl);
        if (this.instance.core) this.instance.core.ensureTrailingParagraph();
        this.instance.sync();
    }

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

    /**
     * Set the inline aspect-ratio style on a video element based on the
     * chosen aspect. For "auto" the style is cleared so the video uses
     * its native dimensions.
     */
    applyAspectStyle(video, aspect) {
        const map = {
            '16:9': '16 / 9',
            '4:3': '4 / 3',
            '1:1': '1 / 1',
            '9:16': '9 / 16'
        };
        if (map[aspect]) {
            // Width is intentionally left to the host stylesheet (or to
            // the editor CSS for max-height capping). Aspect-ratio alone
            // shapes the player.
            video.style.aspectRatio = map[aspect];
        } else {
            video.style.aspectRatio = '';
            // Clean up the attribute entirely if no other styles remain.
            if (!video.getAttribute('style')) video.removeAttribute('style');
        }
    }

    openModal(existingFigure = null) {
        this.instance.selection.save();
        this.currentFigure = existingFigure;

        const initial = existingFigure
            ? this.readFigure(existingFigure)
            : { url: '', aspect: 'auto', caption: '' };

        const isEditing = !!existingFigure;
        const form = document.createElement('div');

        // Upload zone (only when an upload URL is configured).
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
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 8px;">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                <div style="color: var(--redactix-text-muted); font-size: 14px;">${isEditing ? this.t('video.uploadReplace') : this.t('video.uploadClick')}</div>
                <div style="color: var(--redactix-text-placeholder); font-size: 12px; margin-top: 4px;">${this.t('video.uploadFormats')}</div>
            `;

            fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = 'video/*';
            fileInput.style.display = 'none';
            uploadLabel.appendChild(fileInput);

            uploadStatus = document.createElement('div');
            uploadStatus.style.marginTop = '8px';
            uploadStatus.style.fontSize = '13px';
            uploadStatus.style.display = 'none';

            uploadGroup.appendChild(uploadLabel);
            uploadGroup.appendChild(uploadStatus);

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
                if (files.length > 0 && files[0].type.startsWith('video/')) {
                    fileInput.files = files;
                    fileInput.dispatchEvent(new Event('change'));
                }
            });

            form.appendChild(uploadGroup);
        }

        // Browse panel (only when a browse URL is configured).
        let browseContainer = null;
        if (this.browseUrl) {
            browseContainer = document.createElement('div');
            browseContainer.style.marginBottom = '16px';

            const browseBtn = this.makeBrowseButton(() => {
                this.openBrowsePanel(browseContainer, (data) => {
                    if (urlInput) urlInput.value = data.src;
                });
            });
            browseContainer.appendChild(browseBtn);
            form.appendChild(browseContainer);
        }

        // "or enter URL" divider when there's at least one of upload / browse.
        if (this.uploadUrl || this.browseUrl) {
            const orDivider = document.createElement('div');
            orDivider.style.textAlign = 'center';
            orDivider.style.color = 'var(--redactix-text-placeholder)';
            orDivider.style.fontSize = '13px';
            orDivider.style.margin = '12px 0';
            orDivider.style.position = 'relative';
            orDivider.innerHTML = `
                <span style="background: var(--redactix-bg); padding: 0 12px; position: relative; z-index: 1;">${this.t('video.orEnterUrl')}</span>
                <div style="position: absolute; top: 50%; left: 0; right: 0; height: 1px; background: var(--redactix-bg-active); z-index: 0;"></div>
            `;
            form.appendChild(orDivider);
        }

        const grid = document.createElement('div');
        grid.className = 'redactix-modal-grid';

        const urlGroup = this.makeInputGroup(this.t('video.url') + ' *', 'text', initial.url);
        urlGroup.className = 'redactix-modal-full-width';
        const urlInput = urlGroup.querySelector('input');
        urlInput.placeholder = 'https://example.com/video.mp4';

        const aspectGroup = this.makeSelectGroup(this.t('video.aspect'), initial.aspect, [
            { value: 'auto', label: this.t('video.aspectAuto') },
            { value: '16:9', label: '16:9' },
            { value: '4:3', label: '4:3' },
            { value: '1:1', label: '1:1' },
            { value: '9:16', label: this.t('video.aspectVertical') }
        ]);
        const aspectSelect = aspectGroup.querySelector('select');

        const captionGroup = this.makeInputGroup(this.t('video.caption'), 'text', initial.caption);
        captionGroup.className = 'redactix-modal-full-width';
        const captionInput = captionGroup.querySelector('input');
        captionInput.placeholder = this.t('video.captionPlaceholder');

        grid.append(urlGroup, aspectGroup, captionGroup);
        form.appendChild(grid);

        if (fileInput) {
            fileInput.addEventListener('change', async () => {
                const file = fileInput.files[0];
                if (!file) return;
                uploadStatus.style.display = 'block';
                uploadStatus.style.color = 'var(--redactix-primary)';
                uploadStatus.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: inline-block; vertical-align: middle; margin-right: 6px;">
                        <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="32">
                            <animate attributeName="stroke-dashoffset" values="32;0" dur="1s" repeatCount="indefinite"/>
                        </circle>
                    </svg>
                    ${this.t('video.uploading')}
                `;
                try {
                    const formData = new FormData();
                    formData.append('video', file);
                    const response = await fetch(this.uploadUrl, { method: 'POST', body: formData });
                    if (!response.ok && response.status !== 400) {
                        throw new Error(`Server error (${response.status})`);
                    }
                    let result;
                    try { result = await response.json(); }
                    catch (e) { throw new Error('Invalid server response'); }

                    if (result.success) {
                        uploadStatus.style.color = '#10b981';
                        uploadStatus.innerHTML = `
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: inline-block; vertical-align: middle; margin-right: 6px;">
                                <polyline points="20 6 9 17 4 12"/>
                            </svg>
                            ${this.t('video.uploadSuccess')}
                        `;
                        urlInput.value = result.src;
                        if (result.caption) captionInput.value = result.caption;
                    } else {
                        uploadStatus.style.color = 'var(--redactix-danger)';
                        uploadStatus.textContent = result.error || 'Upload failed';
                    }
                } catch (error) {
                    uploadStatus.style.color = 'var(--redactix-danger)';
                    uploadStatus.textContent = error.message || 'Connection error';
                }
            });
        }

        const extraButtons = [];
        if (isEditing) {
            extraButtons.push({
                text: this.t('video.removeVideo'),
                danger: true,
                onClick: () => {
                    existingFigure.remove();
                    this.instance.sync();
                    this.instance.modal.close();
                }
            });
        }

        this.instance.modal.open({
            title: isEditing ? this.t('video.editTitle') : this.t('video.title'),
            body: form,
            extraButtons,
            onSave: () => {
                const url = urlInput.value.trim();
                if (!url) return;
                const aspect = aspectSelect.value;
                const caption = captionInput.value.trim();
                if (isEditing) {
                    this.updateFigure(existingFigure, { url, aspect, caption });
                } else {
                    this.instance.selection.restore();
                    this.insertVideo({ url, aspect, caption });
                }
                this.setupVideos(this.instance.editorEl);
                this.instance.sync();
            }
        });
    }

    readFigure(figure) {
        const video = figure.querySelector(':scope > video');
        const figcaption = figure.querySelector(':scope > figcaption');
        return {
            url: video ? (video.getAttribute('src') || '') : '',
            aspect: figure.getAttribute('data-aspect') || 'auto',
            caption: figcaption ? (figcaption.innerHTML || '').replace(/<br\s*\/?>/gi, '').trim() : ''
        };
    }

    updateFigure(figure, { url, aspect, caption }) {
        // src — только безопасные схемы (http(s)/relative); подпись —
        // через инлайн-санитайзер, как у остальных figcaption-путей.
        const safeUrl = sanitizeUrl(url);
        if (!safeUrl) return;
        const safeCaption = sanitizeInlineHtml(caption || '');

        figure.setAttribute('data-aspect', aspect);
        let video = figure.querySelector(':scope > video');
        if (!video) {
            video = document.createElement('video');
            figure.insertBefore(video, figure.firstChild);
        }
        video.setAttribute('src', safeUrl);
        if (!video.hasAttribute('controls')) video.setAttribute('controls', '');
        if (!video.hasAttribute('preload')) video.setAttribute('preload', 'metadata');
        this.applyAspectStyle(video, aspect);

        let figcaption = figure.querySelector(':scope > figcaption');
        if (safeCaption) {
            if (!figcaption) {
                figcaption = document.createElement('figcaption');
                figure.appendChild(figcaption);
            }
            figcaption.innerHTML = safeCaption;
        } else if (figcaption) {
            figcaption.remove();
        }
    }

    insertVideo({ url, aspect, caption }) {
        const safeUrl = sanitizeUrl(url);
        if (!safeUrl) return;
        const safeCaption = sanitizeInlineHtml(caption || '');

        const figure = document.createElement('figure');
        figure.className = 'redactix-video';
        figure.setAttribute('data-aspect', aspect);

        const video = document.createElement('video');
        video.setAttribute('src', safeUrl);
        video.setAttribute('controls', '');
        video.setAttribute('preload', 'metadata');
        this.applyAspectStyle(video, aspect);
        figure.appendChild(video);

        if (safeCaption) {
            const figcaption = document.createElement('figcaption');
            figcaption.innerHTML = safeCaption;
            figure.appendChild(figcaption);
        }

        this.instance.selection.insertNode(figure);
        if (this.instance.core) this.instance.core.ensureTrailingParagraph();
    }

    // ---------- browse panel ----------

    makeBrowseButton(onClick) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = this.t('video.chooseFromUploaded');
        btn.style.width = '100%';
        btn.style.padding = '10px';
        btn.style.background = 'var(--redactix-bg-hover)';
        btn.style.border = '1px solid var(--redactix-border)';
        btn.style.borderRadius = '6px';
        btn.style.cursor = 'pointer';
        btn.style.fontSize = '14px';
        btn.style.color = 'var(--redactix-text)';
        btn.style.transition = 'background 0.15s';
        btn.addEventListener('mouseenter', () => { btn.style.background = 'var(--redactix-bg-active)'; });
        btn.addEventListener('mouseleave', () => { btn.style.background = 'var(--redactix-bg-hover)'; });
        btn.addEventListener('click', onClick);
        return btn;
    }

    openBrowsePanel(container, onSelect) {
        container.innerHTML = `
            <div style="text-align: center; padding: 20px; color: var(--redactix-text-muted);">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: inline-block;">
                    <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="32">
                        <animate attributeName="stroke-dashoffset" values="32;0" dur="1s" repeatCount="indefinite"/>
                    </circle>
                </svg>
                <div style="margin-top: 8px;">${this.t('video.loadingVideos')}</div>
            </div>
        `;

        const fd = new FormData();
        fd.append('action', 'browse');
        fd.append('type', 'video');
        fetch(this.browseUrl, { method: 'POST', body: fd })
            .then(r => r.json())
            .then(data => {
                if (!data.success) {
                    container.innerHTML = `<div style="color: var(--redactix-danger); padding: 10px;">Error: ${data.error || 'Failed to load videos'}</div>`;
                    return;
                }
                const videos = data.videos || [];
                if (videos.length === 0) {
                    container.innerHTML = `<div style="color: var(--redactix-text-muted); padding: 20px; text-align: center;">${this.t('video.noVideos')}</div>`;
                    const closeBtn = this.makeBrowseCloseButton(container, onSelect);
                    container.appendChild(closeBtn);
                    return;
                }
                this.renderBrowseGrid(container, videos, !!data.allowDelete, onSelect);
            })
            .catch(() => {
                container.innerHTML = `<div style="color: var(--redactix-danger); padding: 10px;">Connection error</div>`;
            });
    }

    renderBrowseGrid(container, videos, allowDelete, onSelect) {
        container.innerHTML = '';

        const grid = document.createElement('div');
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(140px, 1fr))';
        grid.style.gap = '8px';
        grid.style.maxHeight = '260px';
        grid.style.overflowY = 'auto';
        grid.style.padding = '8px';
        grid.style.background = 'var(--redactix-bg-secondary)';
        grid.style.borderRadius = '8px';
        grid.style.border = '1px solid var(--redactix-border)';

        videos.forEach(v => {
            const item = document.createElement('div');
            item.style.position = 'relative';
            item.style.borderRadius = '6px';
            item.style.overflow = 'hidden';
            item.style.cursor = 'pointer';
            item.style.border = '2px solid transparent';
            item.style.transition = 'border-color 0.15s, transform 0.15s';
            item.style.background = '#000';

            const preview = document.createElement('video');
            preview.src = v.src;
            preview.muted = true;
            preview.preload = 'metadata';
            preview.style.width = '100%';
            preview.style.height = '90px';
            preview.style.objectFit = 'cover';
            preview.style.display = 'block';

            item.title = `${v.filename}\n${v.size}`;

            item.addEventListener('mouseenter', () => {
                item.style.borderColor = 'var(--redactix-primary)';
                item.style.transform = 'scale(1.02)';
            });
            item.addEventListener('mouseleave', () => {
                item.style.borderColor = 'transparent';
                item.style.transform = 'scale(1)';
            });

            item.addEventListener('click', () => {
                onSelect(v);
                container.innerHTML = `<div style="color: #10b981; padding: 10px; text-align: center;">${this.t('video.videoSelected')}: ${v.filename}</div>`;
                setTimeout(() => this.restoreBrowseButton(container, onSelect), 1500);
            });

            item.appendChild(preview);

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
                deleteBtn.title = this.t('video.deleteTooltip');

                // На touch-устройствах hover-а нет — кнопка видна всегда.
                const hoverable = window.matchMedia && window.matchMedia('(hover: hover)').matches;
                deleteBtn.style.display = hoverable ? 'none' : 'block';
                if (hoverable) {
                    item.addEventListener('mouseenter', () => { deleteBtn.style.display = 'block'; });
                    item.addEventListener('mouseleave', () => { deleteBtn.style.display = 'none'; });
                }

                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (confirm(this.t('video.confirmDelete', { filename: v.filename }))) {
                        this.deleteVideo(v.filename, container, onSelect);
                    }
                });
                item.appendChild(deleteBtn);
            }

            const info = document.createElement('div');
            info.style.padding = '4px 6px';
            info.style.fontSize = '11px';
            info.style.color = '#fff';
            info.style.background = 'rgba(0,0,0,0.55)';
            info.style.whiteSpace = 'nowrap';
            info.style.overflow = 'hidden';
            info.style.textOverflow = 'ellipsis';
            info.textContent = `${v.filename} · ${v.size}`;
            item.appendChild(info);

            grid.appendChild(item);
        });

        container.appendChild(grid);
        container.appendChild(this.makeBrowseCloseButton(container, onSelect));
    }

    makeBrowseCloseButton(container, onSelect) {
        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.textContent = this.t('video.closeGallery');
        closeBtn.style.width = '100%';
        closeBtn.style.marginTop = '8px';
        closeBtn.style.padding = '8px';
        closeBtn.style.background = 'var(--redactix-bg-active)';
        closeBtn.style.border = 'none';
        closeBtn.style.borderRadius = '6px';
        closeBtn.style.cursor = 'pointer';
        closeBtn.style.fontSize = '13px';
        closeBtn.style.color = 'var(--redactix-text)';
        closeBtn.addEventListener('click', () => this.restoreBrowseButton(container, onSelect));
        return closeBtn;
    }

    restoreBrowseButton(container, onSelect) {
        container.innerHTML = '';
        container.appendChild(this.makeBrowseButton(() => this.openBrowsePanel(container, onSelect)));
    }

    deleteVideo(filename, container, onSelect) {
        const fd = new FormData();
        fd.append('action', 'delete');
        fd.append('type', 'video');
        fd.append('file', filename);
        fetch(this.browseUrl, { method: 'POST', body: fd })
            .then(r => r.json())
            .then(data => {
                if (data.success) {
                    this.openBrowsePanel(container, onSelect);
                } else {
                    alert(data.error || 'Failed to delete video');
                }
            })
            .catch(() => alert('Connection error'));
    }

    // ---------- form helpers ----------

    makeInputGroup(labelText, type, value = '') {
        const div = document.createElement('div');
        const label = document.createElement('label');
        label.textContent = labelText;
        const input = document.createElement('input');
        input.type = type;
        input.value = value;
        div.append(label, input);
        return div;
    }

    makeSelectGroup(labelText, value = '', options = []) {
        const div = document.createElement('div');
        const label = document.createElement('label');
        label.textContent = labelText;
        const select = document.createElement('select');
        select.style.width = '100%';
        select.style.padding = '10px 12px';
        select.style.boxSizing = 'border-box';
        select.style.border = '1px solid var(--redactix-border)';
        select.style.borderRadius = '6px';
        select.style.fontSize = '14px';
        options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.label;
            if (opt.value === value) option.selected = true;
            select.appendChild(option);
        });
        div.append(label, select);
        return div;
    }
}
