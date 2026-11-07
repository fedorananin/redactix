import Module from '../core/Module.js';
import Icons from '../ui/Icons.js';
import { sanitizeUrl } from '../core/dom-utils.js';
import { upload, errorMessage } from '../core/media-client.js';
import { readCaption, writeCaption, cleanCaptionForSync, ensureEditButton, setOwnClass } from '../core/figure-utils.js';
import { createUploadPlaceholder, setPlaceholderLabel, showPlaceholderError, createUploadZone, createOrDivider, createMediaBrowsePanel } from '../ui/media-ui.js';
import { inputGroup, selectGroup, statusLine } from '../ui/form-helpers.js';

const ASPECTS = ['auto', '16:9', '4:3', '1:1', '9:16'];
const ASPECT_STYLE = {
    '16:9': '16 / 9',
    '4:3': '4 / 3',
    '1:1': '1 / 1',
    '9:16': '9 / 16'
};

/** <video> src: http(s) or relative only. */
function safeVideoSrc(url) {
    return sanitizeUrl(url || '', { allowedSchemes: ['http', 'https'] });
}

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
    static moduleName = 'Video';

    constructor(instance) {
        super(instance);
        this.liteMode = instance.config.liteMode || false;
        this.uploadUrl = instance.config.videoUploadUrl || null;
        this.browseUrl = instance.config.videoBrowseUrl || null;
        // Delete in the browse panel needs this flag AND the server's.
        this.allowDelete = !!instance.config.allowVideoDelete;
        this._uploads = new Set();
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

        // Drag&drop upload of video files to the editor. Enable only
        // when videoUploadUrl is configured (lite mode nulls it).
        if (this.uploadUrl && !this.liteMode) {
            this.initDragDrop();
        }

        this.instance.onDestroy(() => {
            this._uploads.forEach(c => c.abort());
            this._uploads.clear();
        });
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
     * every video figure. Runs from setupContent after every load.
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

            ensureEditButton(figure, 'redactix-video-edit-btn', this.t('video.edit'));
        });
    }

    /**
     * Sync-side cleanup: drop the floating Edit button and any empty
     * figcaption. Reapply inline aspect-ratio so the saved HTML matches
     * the editor state. Operates on a clone of editorEl, NOT live DOM.
     */
    cleanVideosForSync(clone) {
        clone.querySelectorAll('.redactix-video-edit-btn').forEach(el => el.remove());

        clone.querySelectorAll('figure.redactix-video').forEach(figure => {
            figure.removeAttribute('contenteditable');
            const video = figure.querySelector(':scope > video');
            if (video) {
                this.applyAspectStyle(video, figure.getAttribute('data-aspect') || 'auto');
            }
            cleanCaptionForSync(figure);
        });
    }

    // ------------------------------------------------------------------
    // Uploads from the editor surface
    // ------------------------------------------------------------------

    /**
     * Editor-wide drag&drop upload for video files. Coexists with the
     * Image module's listeners; video files are filtered by MIME 'video/*',
     * images and other files go to the Image module.
     */
    initDragDrop() {
        const editor = this.instance.editorEl;

        // Native dragstart is silenced unconditionally in Editor.js (bindEvents).

        editor.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files')) {
                editor.classList.add('redactix-dragover');
            }
        });

        editor.addEventListener('dragleave', (e) => {
            if (!editor.contains(e.relatedTarget)) {
                editor.classList.remove('redactix-dragover');
            }
        });

        editor.addEventListener('drop', (e) => {
            editor.classList.remove('redactix-dragover');
            const files = Array.from((e.dataTransfer && e.dataTransfer.files) || [])
                .filter(f => (f.type || '').startsWith('video/'));
            if (files.length === 0) return;
            e.preventDefault();
            // Insert at the drop point, not at the old caret.
            this.editor.placeCaretAtPoint(e.clientX, e.clientY);
            this.uploadFiles(files);
        });
    }

    async uploadFiles(files) {
        const placeholders = files.map(() => {
            const placeholder = createUploadPlaceholder(this.t('video.uploading'));
            this.instance.selection.insertNode(placeholder);
            return placeholder;
        });
        for (let i = 0; i < files.length; i++) {
            await this.uploadIntoPlaceholder(files[i], placeholders[i]);
        }
    }

    async uploadIntoPlaceholder(file, placeholder) {
        const controller = new AbortController();
        this._uploads.add(controller);
        let result;
        try {
            result = await upload(this.uploadUrl, 'video', file, {
                signal: controller.signal,
                onProgress: (f) => setPlaceholderLabel(placeholder, this.t('upload.progress', { percent: Math.round(f * 100) }))
            });
        } finally {
            this._uploads.delete(controller);
        }
        if (!placeholder.isConnected) return;
        if (result.ok) {
            const figure = this.buildFigure({ url: result.data.src, aspect: 'auto', caption: result.data.caption });
            if (!figure) return;
            this.transact(() => {
                placeholder.replaceWith(figure);
                this.setupVideos(figure.parentNode || this.instance.editorEl);
            });
        } else if (result.code !== 'aborted') {
            showPlaceholderError(placeholder, errorMessage(result, (k, p) => this.t(k, p)), this.t('upload.remove'));
        }
    }

    /**
     * Set the inline aspect-ratio style on a video element based on the
     * chosen aspect. For "auto" the style is cleared so the video uses
     * its native dimensions.
     */
    applyAspectStyle(video, aspect) {
        if (ASPECT_STYLE[aspect]) {
            // Width is intentionally left to the host stylesheet (or to
            // the editor CSS for max-height capping). Aspect-ratio alone
            // shapes the player.
            video.style.aspectRatio = ASPECT_STYLE[aspect];
        } else {
            video.style.aspectRatio = '';
            // Clean up the attribute entirely if no other styles remain.
            if (!video.getAttribute('style')) video.removeAttribute('style');
        }
    }

    // ------------------------------------------------------------------
    // Modal
    // ------------------------------------------------------------------

    openModal(existingFigure = null) {
        this.instance.selection.save();

        const t = (k, p) => this.t(k, p);
        const initial = existingFigure
            ? this.readFigure(existingFigure)
            : { url: '', aspect: 'auto', caption: '' };

        const isEditing = !!existingFigure;
        const form = document.createElement('div');
        const status = statusLine('', { error: true });
        const modalUploads = new AbortController();
        let pendingUploads = 0;
        let browsePanel = null;

        const urlGroup = inputGroup(t('video.url') + ' *', 'text', initial.url, { placeholder: 'https://example.com/video.mp4' });
        urlGroup.classList.add('redactix-modal-full-width');
        const urlInput = urlGroup.field;

        // Upload zone (only when an upload URL is configured).
        if (this.uploadUrl) {
            const zone = createUploadZone({
                title: isEditing ? t('video.uploadReplace') : t('video.uploadClick'),
                hint: t('video.uploadFormats'),
                accept: 'video/*',
                onFiles: async ([file]) => {
                    pendingUploads++;
                    zone.setStatus(t('video.uploading'), 'progress');
                    const result = await upload(this.uploadUrl, 'video', file, {
                        signal: modalUploads.signal,
                        onProgress: (f) => zone.setStatus(t('upload.progress', { percent: Math.round(f * 100) }), 'progress')
                    });
                    pendingUploads--;
                    if (result.ok) {
                        zone.setStatus(t('video.uploadSuccess'), 'success');
                        status.textContent = '';
                        urlInput.value = result.data.src;
                        if (result.data.caption) captionInput.value = result.data.caption;
                    } else if (result.code !== 'aborted') {
                        zone.setStatus(errorMessage(result, t), 'error');
                    }
                }
            });
            form.appendChild(zone.element);
        }

        // Browse panel (only when a browse URL is configured).
        if (this.browseUrl) {
            browsePanel = createMediaBrowsePanel({
                t,
                type: 'video',
                url: this.browseUrl,
                allowDelete: this.allowDelete,
                onSelect: (item) => { urlInput.value = item.src; }
            });
            form.appendChild(browsePanel.element);
        }

        // "or enter URL" divider when there's at least one of upload / browse.
        if (this.uploadUrl || this.browseUrl) {
            form.appendChild(createOrDivider(t('video.orEnterUrl')));
        }

        const grid = document.createElement('div');
        grid.className = 'redactix-modal-grid';

        const aspectGroup = selectGroup(t('video.aspect'), initial.aspect, [
            { value: 'auto', label: t('video.aspectAuto') },
            { value: '16:9', label: '16:9' },
            { value: '4:3', label: '4:3' },
            { value: '1:1', label: '1:1' },
            { value: '9:16', label: t('video.aspectVertical') }
        ]);
        const aspectSelect = aspectGroup.field;

        const captionGroup = inputGroup(t('video.caption'), 'text', initial.caption, { placeholder: t('video.captionPlaceholder') });
        captionGroup.classList.add('redactix-modal-full-width');
        const captionInput = captionGroup.field;

        grid.append(urlGroup, aspectGroup, captionGroup);
        form.append(grid, status);

        const extraButtons = [];
        if (isEditing) {
            extraButtons.push({
                text: t('video.removeVideo'),
                danger: true,
                onClick: () => {
                    this.transact(() => existingFigure.remove());
                    this.instance.modal.close();
                }
            });
        }

        this.instance.modal.open({
            title: isEditing ? t('video.editTitle') : t('video.title'),
            body: form,
            extraButtons,
            onClose: () => {
                modalUploads.abort();
                if (browsePanel) browsePanel.destroy();
            },
            onSave: () => {
                if (pendingUploads > 0) {
                    status.textContent = t('upload.pending');
                    return false;
                }
                const url = urlInput.value.trim();
                if (!url || !safeVideoSrc(url)) {
                    status.textContent = t('video.invalidUrl');
                    urlInput.focus();
                    return false;
                }
                const values = { url, aspect: aspectSelect.value, caption: captionInput.value };
                if (isEditing) {
                    this.transact(() => {
                        this.updateFigure(existingFigure, values);
                        this.setupVideos(existingFigure.parentNode || this.instance.editorEl);
                    });
                } else {
                    this.instance.selection.restore();
                    this.transact(() => this.insertVideo(values));
                }
            }
        });
    }

    readFigure(figure) {
        const video = figure.querySelector(':scope > video');
        return {
            url: video ? (video.getAttribute('src') || '') : '',
            aspect: figure.getAttribute('data-aspect') || 'auto',
            caption: readCaption(figure)
        };
    }

    updateFigure(figure, { url, aspect, caption }) {
        // src — только безопасные схемы (http(s)/relative); подпись —
        // через инлайн-санитайзер, как у остальных figcaption-путей.
        const safeUrl = safeVideoSrc(url);
        if (!safeUrl) return false;
        const safeAspect = ASPECTS.includes(aspect) ? aspect : 'auto';

        setOwnClass(figure, 'redactix-video');
        figure.setAttribute('data-aspect', safeAspect);
        let video = figure.querySelector(':scope > video');
        if (!video) {
            video = document.createElement('video');
            figure.insertBefore(video, figure.firstChild);
        }
        video.setAttribute('src', safeUrl);
        if (!video.hasAttribute('controls')) video.setAttribute('controls', '');
        if (!video.hasAttribute('preload')) video.setAttribute('preload', 'metadata');
        this.applyAspectStyle(video, safeAspect);
        writeCaption(figure, caption);
        return true;
    }

    /** New figure.redactix-video (not inserted), or null for an unsafe URL. */
    buildFigure(values) {
        const figure = document.createElement('figure');
        figure.className = 'redactix-video';
        return this.updateFigure(figure, values) ? figure : null;
    }

    insertVideo(values) {
        const figure = this.buildFigure(values);
        if (!figure) return false;
        this.instance.selection.insertNode(figure);
        this.setupVideos(figure.parentNode || this.instance.editorEl);
        return true;
    }

    // ---------- content lifecycle hooks (called by RedactixInstance) ----------

    setupContent(root) {
        this.setupVideos(root);
    }

    cleanForSync(clone) {
        this.cleanVideosForSync(clone);
    }

    ownsFigure(figure) {
        return figure.classList.contains('redactix-video');
    }

    get pasteAllowedClasses() {
        return this.instance.config.liteMode ? [] : ['redactix-video'];
    }

    get pasteAllowedAttributes() {
        return this.instance.config.liteMode ? [] : [{ selector: 'figure.redactix-video', attrs: ['data-aspect'] }];
    }

    /**
     * Paste: keep a <video> only when it already sits inside
     * figure.redactix-video (saved Redactix output pasted back), reduced to
     * a safe attribute set. Standalone videos are dropped by the sweep.
     */
    preparePaste(root, ctx) {
        if (this.instance.config.liteMode) return;
        Array.from(root.querySelectorAll('figure.redactix-video > video')).forEach(video => {
            const src = safeVideoSrc(video.getAttribute('src') || '');
            if (!src) return;
            // Whitelisted attribute set: src + controls + preload + style
            // (only when style declares aspect-ratio).
            const aspectStyle = (video.getAttribute('style') || '').match(/aspect-ratio\s*:\s*[0-9.\s/]+/i);
            Array.from(video.attributes).forEach(attr => video.removeAttribute(attr.name));
            video.setAttribute('src', src);
            video.setAttribute('controls', '');
            video.setAttribute('preload', 'metadata');
            if (aspectStyle) video.setAttribute('style', aspectStyle[0].trim());
            ctx.keep.add(video);
        });
    }
}
