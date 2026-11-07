import Module from '../core/Module.js';
import Icons from '../ui/Icons.js';
import { sanitizeUrl, sanitizeImageSrc, sanitizeSrcset, sanitizeRel, composeLinkRel, parseHtmlInert } from '../core/dom-utils.js';
import { findInsertionPoint, TEXT_BLOCK_TAGS } from '../core/schema.js';
import { upload, errorMessage } from '../core/media-client.js';
import { readCaption, writeCaption } from '../core/figure-utils.js';
import { createUploadPlaceholder, setPlaceholderLabel, showPlaceholderError, createUploadZone, createOrDivider, createMediaBrowsePanel } from '../ui/media-ui.js';
import { inputGroup, textareaGroup, selectGroup, linkFields, statusLine } from '../ui/form-helpers.js';

// Extensions for files rebuilt from pasted data: URLs. No SVG — the paste
// sanitizer never keeps data:image/svg+xml in the first place.
const DATA_URL_EXT = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/avif': 'avif',
    'image/bmp': 'bmp',
    'image/x-icon': 'ico'
};

// rel tokens the modal manages itself (checkboxes / target=_blank).
const MANAGED_REL = new Set(['nofollow', 'noopener', 'noreferrer']);

export default class Image extends Module {
    static moduleName = 'Image';

    constructor(instance) {
        super(instance);
        const config = instance.config;
        this.liteMode = !!config.liteMode; // Lite mode - simplified modal
        this.uploadUrl = config.uploadUrl || null; // URL for uploading images
        this.browseUrl = config.browseUrl || null; // URL for browsing images
        // Delete in the browse panel needs BOTH this flag and the server's
        // own allowDelete.
        this.allowDelete = !!config.allowImageDelete;
        // In-flight uploads started from the editor (drop / paste) — aborted
        // on destroy.
        this._uploads = new Set();
    }

    init() {
        // Click on image opens edit modal
        this.instance.editorEl.addEventListener('click', (e) => {
            const img = e.target.closest && e.target.closest('img');
            if (!img) return;
            // Photo galleries handle their own clicks (Gallery module).
            // Quote-card author photos are managed by QuoteCard.
            if (img.closest('figure.redactix-gallery, figure.quote-card, .redactix-upload-placeholder')) return;
            e.preventDefault();
            const figure = img.closest('figure');
            if (figure) {
                this.openModal(figure);
            } else {
                // If img is without figure - create figure and edit
                this.openModal(null, img);
            }
        });

        // Upload paths exist only with an upload URL (core nulls it in lite
        // mode). Pasted data: images are dropped by the paste sanitizer when
        // there is nowhere to upload them.
        if (this.uploadUrl) {
            this.initDragDrop();
            this.initPasteUpload();
            this.instance.on('contentInserted', () => this.uploadPastedImages());
        }

        this.instance.onDestroy(() => this.abortUploads());
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

    // ------------------------------------------------------------------
    // Content lifecycle
    // ------------------------------------------------------------------

    cleanForSync(clone) {
        // Upload-in-progress marker on a pasted image's figure.
        clone.querySelectorAll('.redactix-uploading').forEach(el => {
            el.classList.remove('redactix-uploading');
            if (!el.classList.length) el.removeAttribute('class');
        });
    }

    // ------------------------------------------------------------------
    // Uploads from the editor surface (drop, paste, pasted data: images)
    // ------------------------------------------------------------------

    /** Upload through the shared client; aborted on destroy. */
    async runUpload(file, { onProgress } = {}) {
        const controller = new AbortController();
        this._uploads.add(controller);
        try {
            return await upload(this.uploadUrl, 'image', file, { signal: controller.signal, onProgress });
        } finally {
            this._uploads.delete(controller);
        }
    }

    abortUploads() {
        this._uploads.forEach(c => c.abort());
        this._uploads.clear();
    }

    /**
     * Pasted data: images. The paste sanitizer marks them with
     * data-redactix-paste-upload (only when uploadUrl is set) and emits
     * 'contentInserted' after insertion. Undo / redo / HTML mode never emit
     * that event, so restored content is left alone.
     */
    uploadPastedImages() {
        const images = Array.from(this.instance.editorEl.querySelectorAll('img[data-redactix-paste-upload]'));
        images.forEach(img => {
            img.removeAttribute('data-redactix-paste-upload');
            this.uploadDataImage(img);
        });
    }

    async uploadDataImage(img) {
        const file = this.base64ToFile(img.getAttribute('src') || '');
        if (!file) {
            this.transact(() => this.removeImageNode(img));
            return;
        }

        const figure = img.closest('figure');
        if (figure) figure.classList.add('redactix-uploading');

        const result = await this.runUpload(file);

        if (figure) {
            figure.classList.remove('redactix-uploading');
            if (!figure.classList.length) figure.removeAttribute('class');
        }
        // Removed, undone or replaced while uploading — nothing to update.
        if (!img.isConnected || !this.instance.editorEl.contains(img)) return;

        if (result.ok) {
            const data = result.data;
            this.transact(() => {
                img.setAttribute('src', data.src);
                if (data.srcset) img.setAttribute('srcset', data.srcset);
                if (data.alt && !img.getAttribute('alt')) img.setAttribute('alt', data.alt);
                if (data.title && !img.getAttribute('title')) img.setAttribute('title', data.title);
            });
        } else if (result.code !== 'aborted') {
            console.warn('Redactix: failed to upload pasted image:', errorMessage(result, (k, p) => this.t(k, p)));
            this.transact(() => this.removeImageNode(img));
        }
    }

    /**
     * Remove a single <img> — and only what it leaves empty: an image-only
     * link around it, and a PLAIN image figure with nothing else in it.
     * Galleries, quote-cards and other managed figures are never removed
     * wholesale here (closest('figure').remove() used to delete them).
     */
    removeImageNode(img) {
        const parent = img.parentElement;
        const link = parent && parent.tagName === 'A' ? parent : null;
        const figure = img.closest('figure');
        img.remove();
        if (link && !link.textContent.trim() && !link.querySelector('img, video, iframe')) link.remove();
        if (figure && figure.isConnected && !this.instance.isManagedFigure(figure) &&
            !figure.querySelector('img, video, iframe') && !(figure.textContent || '').trim()) {
            figure.remove();
        }
    }

    /**
     * data: URL → File. Tolerates extra parameters (`;name=x.png;base64`),
     * line breaks inside the payload and percent-encoded (non-base64) data.
     * Returns null for anything that isn't a raster image.
     */
    base64ToFile(dataUrl) {
        if (typeof dataUrl !== 'string') return null;
        const m = dataUrl.trim().match(/^data:([^;,]+)((?:;[^;,]*)*),([\s\S]*)$/i);
        if (!m) return null;
        const mimeType = m[1].trim().toLowerCase();
        const ext = DATA_URL_EXT[mimeType];
        if (!ext) return null;
        const isBase64 = /;base64$/i.test(m[2]);

        let bytes;
        try {
            if (isBase64) {
                const binary = atob(m[3].replace(/\s+/g, ''));
                bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            } else {
                bytes = new TextEncoder().encode(decodeURIComponent(m[3]));
            }
        } catch (e) {
            return null;
        }
        if (!bytes.length) return null;
        return new File([bytes], `pasted-image.${ext}`, { type: mimeType });
    }

    /** Initializing drag & drop upload */
    initDragDrop() {
        const editor = this.instance.editorEl;

        // Native dragstart inside contenteditable is silenced in Editor.js
        // (bindEvents) unconditionally - only the upload zone remains here.
        editor.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (hasFiles(e.dataTransfer)) editor.classList.add('redactix-dragover');
        });

        editor.addEventListener('dragleave', (e) => {
            // Verify that we actually left the editor
            if (!editor.contains(e.relatedTarget)) {
                editor.classList.remove('redactix-dragover');
            }
        });

        editor.addEventListener('drop', (e) => {
            editor.classList.remove('redactix-dragover');
            const files = Array.from((e.dataTransfer && e.dataTransfer.files) || [])
                .filter(file => (file.type || '').startsWith('image/'));
            if (files.length === 0) return;
            e.preventDefault();
            // Insert where the files were dropped, not at the old caret.
            this.editor.placeCaretAtPoint(e.clientX, e.clientY);
            this.uploadFiles(files);
        });
    }

    /**
     * Upload via paste (Ctrl+V) of image FILES (screenshots, "copy image").
     *
     * Only intercepts when the clipboard has no HTML, or the HTML is just a
     * single <img>. Excel / Word / Google Sheets put a PNG rendering of the
     * selection next to the real text/html — those pastes belong to the
     * normal paste handler, not to an image upload.
     */
    initPasteUpload() {
        this.instance.editorEl.addEventListener('paste', (e) => {
            const cd = e.clipboardData;
            if (!cd) return;
            const files = clipboardImageFiles(cd);
            if (files.length === 0) return;
            const html = cd.getData('text/html');
            if (html && !isSingleImageHtml(html)) return;

            e.preventDefault();
            e.stopImmediatePropagation();
            this.uploadFiles(files);
        }, true); // capture: runs before the core paste handler
    }

    /**
     * Upload files at the caret. All placeholders are inserted first so the
     * images end up in the order they were dropped / pasted.
     */
    async uploadFiles(files) {
        const placeholders = files.map(() => {
            const placeholder = createUploadPlaceholder(this.t('image.uploading'));
            this.instance.selection.insertNode(placeholder);
            return placeholder;
        });
        for (let i = 0; i < files.length; i++) {
            await this.uploadIntoPlaceholder(files[i], placeholders[i]);
        }
    }

    async uploadIntoPlaceholder(file, placeholder) {
        const result = await this.runUpload(file, {
            onProgress: (f) => setPlaceholderLabel(placeholder, this.t('upload.progress', { percent: Math.round(f * 100) }))
        });
        if (!placeholder.isConnected) return; // removed / undone meanwhile
        if (result.ok) {
            // One undo step: the placeholder is UI (not in snapshots), so
            // undo removes exactly the uploaded image.
            this.transact(() => placeholder.replaceWith(this.buildFigure(result.data)));
        } else if (result.code !== 'aborted') {
            showPlaceholderError(placeholder, errorMessage(result, (k, p) => this.t(k, p)), this.t('upload.remove'));
        }
    }

    /** Plain image figure from a sanitised media record (see media-client). */
    buildFigure(data) {
        const figure = document.createElement('figure');
        figure.contentEditable = 'false';
        const img = document.createElement('img');
        img.setAttribute('src', data.src);
        if (data.srcset) img.setAttribute('srcset', data.srcset);
        if (data.alt) img.setAttribute('alt', data.alt);
        if (data.title) img.setAttribute('title', data.title);
        if (data.loading) img.setAttribute('loading', data.loading);
        figure.appendChild(img);
        writeCaption(figure, data.caption || '', { keepEmpty: true });
        return figure;
    }

    // ------------------------------------------------------------------
    // Modal
    // ------------------------------------------------------------------

    /**
     * The image a figure / standalone img stands for. Lookups are scoped to
     * the figure's own children: an unscoped querySelector('a') used to pick
     * up a link inside the figcaption, and clearing the link field then
     * moved the image into the caption and deleted it.
     */
    resolveTarget(figure, img) {
        if (figure) {
            const own = figure.querySelector(':scope > img, :scope > a > img');
            const link = own && own.parentElement !== figure ? own.parentElement : null;
            return { figure, img: own, link };
        }
        if (img) {
            const parent = img.parentElement;
            // Only an image-only link counts as "the image's link". An image
            // sitting inside a text link doesn't own that link.
            const link = parent && parent.tagName === 'A' && !parent.textContent.trim() &&
                parent.querySelectorAll('img').length === 1 ? parent : null;
            return { figure: null, img, link };
        }
        return { figure: null, img: null, link: null };
    }

    readImageData({ figure, img, link }) {
        const rel = link ? (link.getAttribute('rel') || '') : '';
        const relTokens = rel.split(/\s+/).filter(Boolean);
        return {
            url: img ? (img.getAttribute('src') || '') : '',
            alt: img ? (img.getAttribute('alt') || '') : '',
            srcset: img ? (img.getAttribute('srcset') || '') : '',
            title: img ? (img.getAttribute('title') || '') : '',
            loading: img ? (img.getAttribute('loading') || '') : '',
            caption: figure ? readCaption(figure) : '',
            linkUrl: link ? (link.getAttribute('href') || '') : '',
            isBlank: link ? link.getAttribute('target') === '_blank' : false,
            isNofollow: relTokens.includes('nofollow'),
            // Additional rel values (sponsored, ugc …) — the managed ones are
            // re-derived from the checkboxes.
            relExtra: relTokens.filter(r => !MANAGED_REL.has(r.toLowerCase())).join(' ')
        };
    }

    /**
     * Insert / edit modal. Lite mode shows only URL + alt; every other value
     * of an edited image is preserved as is.
     */
    openModal(existingFigure = null, existingImg = null) {
        this.instance.selection.save();

        const t = (k, p) => this.t(k, p);
        const full = !this.liteMode;
        const target = this.resolveTarget(existingFigure, existingImg);
        const data = this.readImageData(target);
        const isEditing = !!(existingFigure || existingImg);

        const form = document.createElement('div');
        const status = statusLine('', { error: true });
        const modalUploads = new AbortController();
        let pendingUploads = 0;
        let browsePanel = null;

        const urlGroup = inputGroup(t('image.url') + ' *', 'text', data.url, { placeholder: 'https://example.com/image.jpg' });
        const altGroup = inputGroup(full ? t('image.alt') : t('image.altDescription'), 'text', data.alt);
        const fields = { url: urlGroup.field, alt: altGroup.field };

        if (full) {
            // File upload block (if uploadUrl is present)
            if (this.uploadUrl) {
                const zone = createUploadZone({
                    title: isEditing ? t('image.uploadReplace') : t('image.uploadClick'),
                    hint: t('image.uploadFormats'),
                    accept: 'image/*',
                    onFiles: async ([file]) => {
                        pendingUploads++;
                        zone.setStatus(t('image.uploading'), 'progress');
                        const result = await upload(this.uploadUrl, 'image', file, {
                            signal: modalUploads.signal,
                            onProgress: (f) => zone.setStatus(t('upload.progress', { percent: Math.round(f * 100) }), 'progress')
                        });
                        pendingUploads--;
                        if (result.ok) {
                            zone.setStatus(t('image.uploadSuccess'), 'success');
                            status.textContent = '';
                            this.fillFields(fields, result.data);
                        } else if (result.code !== 'aborted') {
                            zone.setStatus(errorMessage(result, t), 'error');
                        }
                    }
                });
                form.appendChild(zone.element);
            }

            // Image browser block (if browseUrl is present)
            if (this.browseUrl) {
                browsePanel = this.createBrowsePanel((item) => this.fillFields(fields, item));
                form.appendChild(browsePanel.element);
            }

            if (this.uploadUrl || this.browseUrl) {
                form.appendChild(createOrDivider(t('image.orEnterUrl')));
            }

            // Fields grid (2 columns on PC, 1 on mobile)
            const grid = document.createElement('div');
            grid.className = 'redactix-modal-grid';

            urlGroup.classList.add('redactix-modal-full-width');
            const titleGroup = inputGroup(t('image.title_attr'), 'text', data.title);
            const srcsetGroup = inputGroup(t('image.srcset'), 'text', data.srcset, { placeholder: t('image.srcsetPlaceholder') });
            srcsetGroup.classList.add('redactix-modal-full-width');
            const loadingGroup = selectGroup(t('image.loading'), data.loading, [
                { value: '', label: t('image.loadingDefault') },
                { value: 'lazy', label: t('image.loadingLazy') },
                { value: 'eager', label: t('image.loadingEager') }
            ]);
            const captionGroup = textareaGroup(t('image.caption'), data.caption, { placeholder: t('image.captionPlaceholder') });
            captionGroup.classList.add('redactix-modal-full-width');
            grid.append(urlGroup, altGroup, titleGroup, srcsetGroup, loadingGroup, captionGroup);

            // Link section
            const linkSection = document.createElement('div');
            linkSection.className = 'redactix-modal-full-width redactix-image-link-section';
            const linkTitle = document.createElement('div');
            linkTitle.className = 'redactix-image-link-title';
            linkTitle.textContent = t('image.linkSection');
            const link = linkFields({
                urlLabel: t('image.linkUrl'),
                blankLabel: t('image.openNewWindow'),
                nofollowLabel: t('image.nofollow'),
                url: data.linkUrl,
                blank: data.isBlank,
                nofollow: data.isNofollow,
                placeholder: t('image.linkUrlPlaceholder')
            });
            const relGroup = inputGroup(t('image.relExceptNofollow'), 'text', data.relExtra, { placeholder: t('image.relPlaceholder') });
            linkSection.append(linkTitle, link.element, relGroup);
            grid.appendChild(linkSection);

            form.appendChild(grid);
            Object.assign(fields, {
                title: titleGroup.field,
                srcset: srcsetGroup.field,
                loading: loadingGroup.field,
                caption: captionGroup.field,
                linkUrl: link.url,
                isBlank: link.blank,
                isNofollow: link.nofollow,
                relExtra: relGroup.field
            });
        } else {
            form.append(urlGroup, altGroup);
        }
        form.appendChild(status);

        const showError = (key, field) => {
            status.textContent = t(key);
            if (field) field.focus();
            return false;
        };

        const extraButtons = [];
        if (isEditing) {
            extraButtons.push({
                text: t('image.removeImage'),
                danger: true,
                onClick: () => {
                    this.transact(() => this.removeTarget(target));
                    this.instance.modal.close();
                }
            });
        }

        this.instance.modal.open({
            title: isEditing ? t('image.editTitle') : t('image.title'),
            body: form,
            extraButtons,
            onClose: () => {
                modalUploads.abort();
                if (browsePanel) browsePanel.destroy();
            },
            onSave: () => {
                if (pendingUploads > 0) return showError('upload.pending');

                // Hidden fields (lite mode) keep the image's current values.
                const values = { ...data };
                values.url = fields.url.value.trim();
                values.alt = fields.alt.value;
                if (full) {
                    values.title = fields.title.value;
                    values.srcset = fields.srcset.value.trim();
                    values.loading = fields.loading.value;
                    values.caption = fields.caption.value;
                    values.linkUrl = fields.linkUrl.value.trim();
                    values.isBlank = fields.isBlank.checked;
                    values.isNofollow = fields.isNofollow.checked;
                    values.relExtra = fields.relExtra.value.trim();
                } else if (!isEditing || !values.loading) {
                    values.loading = 'lazy'; // lite mode default
                }

                if (!values.url || values.url === 'https://' || !sanitizeImageSrc(values.url)) {
                    return showError('image.invalidUrl', fields.url);
                }
                if (values.linkUrl && sanitizeUrl(values.linkUrl) === null) {
                    return showError('image.invalidLinkUrl', fields.linkUrl);
                }

                if (isEditing) {
                    this.transact(() => this.updateImage(existingFigure, existingImg, values));
                } else {
                    this.instance.selection.restore();
                    this.transact(() => this.insertImage(values));
                }
            }
        });
    }

    /** Fill modal fields from an upload / browse record (sanitised). */
    fillFields(fields, item) {
        if (item.src) fields.url.value = item.src;
        if (item.alt) fields.alt.value = item.alt;
        if (fields.srcset && item.srcset) fields.srcset.value = item.srcset;
        if (fields.title && item.title) fields.title.value = item.title;
        if (fields.caption && item.caption) fields.caption.value = item.caption;
    }

    /** "Choose from uploaded images" panel for this editor's browseUrl. */
    createBrowsePanel(onSelect, options = {}) {
        return createMediaBrowsePanel({
            t: (k, p) => this.t(k, p),
            type: 'image',
            url: this.browseUrl,
            allowDelete: this.allowDelete,
            onSelect,
            ...options
        });
    }

    /**
     * Back-compat entry point (QuoteCard's author-photo picker): replaces
     * `container`'s contents with an open browse panel.
     */
    openBrowsePanel(container, onSelect) {
        if (!this.browseUrl) return null;
        const panel = this.createBrowsePanel(onSelect);
        container.replaceChildren(panel.element);
        panel.open();
        return panel;
    }

    removeTarget({ figure, img, link }) {
        if (figure) {
            figure.remove();
            return;
        }
        if (!img) return;
        // Remove only the image: a link that held nothing else goes with it,
        // a text link around it stays.
        if (link) link.remove();
        else img.remove();
    }

    applyImageAttributes(img, src, values) {
        img.setAttribute('src', src);
        const set = (name, value) => {
            if (value) img.setAttribute(name, value);
            else img.removeAttribute(name);
        };
        set('alt', values.alt);
        set('title', values.title);
        set('srcset', sanitizeSrcset(values.srcset || ''));
        set('loading', ['lazy', 'eager'].includes(values.loading) ? values.loading : '');
    }

    /**
     * Create / update / remove the link around `img`. Returns the link or null.
     */
    applyLink(img, link, values) {
        const href = values.linkUrl ? sanitizeUrl(values.linkUrl) : null;
        if (href) {
            if (!link) {
                link = document.createElement('a');
                img.parentNode.insertBefore(link, img);
                link.appendChild(img);
            }
            link.setAttribute('href', href);
            if (values.isBlank) link.setAttribute('target', '_blank');
            else link.removeAttribute('target');
            const rel = composeLinkRel({ nofollow: values.isNofollow, blank: values.isBlank, extra: sanitizeRel(values.relExtra || '') });
            if (rel) link.setAttribute('rel', rel);
            else link.removeAttribute('rel');
            return link;
        }
        if (link) {
            // Remove link, keep img
            link.parentNode.insertBefore(img, link);
            link.remove();
        }
        return null;
    }

    updateImage(existingFigure, existingImg, values) {
        // Same sanitization as on paste path: src - only http(s)/
        // relative/raster data:, href link - safe schema,
        // rel is built via composeLinkRel (noopener for _blank).
        const src = sanitizeImageSrc(values.url);
        if (!src) return false;

        if (existingFigure) {
            const figure = existingFigure;
            let { img, link } = this.resolveTarget(figure, null);
            if (!img) {
                img = document.createElement('img');
                figure.insertBefore(img, figure.firstChild);
            }
            this.applyImageAttributes(img, src, values);
            this.applyLink(img, link, values);
            figure.contentEditable = 'false';
            writeCaption(figure, values.caption, { keepEmpty: true });
            return true;
        }

        if (existingImg) {
            this.figureFromStandalone(existingImg, src, values);
            return true;
        }
        return false;
    }

    /**
     * Turn a standalone <img> (e.g. inside a paragraph) into a figure placed
     * NEXT TO its block — wrapping it in place produced <p><figure>, which
     * is invalid HTML and breaks on the next parse.
     */
    figureFromStandalone(img, src, values) {
        const root = this.instance.editorEl;
        const { link: ownLink } = this.resolveTarget(null, img);
        const node = ownLink || img;
        const point = findInsertionPoint(node, ['FIGURE'], root);

        let host;
        let ref;
        if (point && point.block !== node) {
            host = point.host;
            ref = isAtBlockStart(point.block, node) ? point.block : point.block.nextSibling;
        } else {
            host = node.parentNode;
            ref = node.nextSibling;
        }

        const figure = document.createElement('figure');
        figure.contentEditable = 'false';
        figure.appendChild(img);
        if (ownLink) ownLink.remove();
        this.applyImageAttributes(img, src, values);
        this.applyLink(img, null, values);
        writeCaption(figure, values.caption, { keepEmpty: true });
        host.insertBefore(figure, ref && ref.parentNode === host ? ref : null);

        // The paragraph the image lived in may now be empty.
        const block = point && point.block !== node ? point.block : null;
        if (block && block.isConnected && TEXT_BLOCK_TAGS.includes(block.tagName) &&
            !block.textContent.trim() && !block.querySelector('img, video, iframe')) {
            block.remove();
        }
        return figure;
    }

    insertImage(values) {
        const src = sanitizeImageSrc(values.url);
        if (!src) return false;

        // Always create figure (even without caption)
        const figure = document.createElement('figure');
        figure.contentEditable = 'false';
        const img = document.createElement('img');
        figure.appendChild(img);
        this.applyImageAttributes(img, src, values);
        this.applyLink(img, null, values);
        // Empty figcaption to allow caption input
        writeCaption(figure, values.caption, { keepEmpty: true });

        this.instance.selection.insertNode(figure);
        return true;
    }
}

// ----------------------------------------------------------------------
// helpers
// ----------------------------------------------------------------------

function hasFiles(dt) {
    return !!dt && Array.from(dt.types || []).includes('Files');
}

/** Image files on a clipboard (deduplicated across items / files). */
function clipboardImageFiles(cd) {
    const files = [];
    Array.from(cd.items || []).forEach(item => {
        if (item.kind === 'file' && (item.type || '').startsWith('image/')) {
            const file = item.getAsFile();
            if (file) files.push(file);
        }
    });
    if (files.length === 0) {
        Array.from(cd.files || []).forEach(file => {
            if ((file.type || '').startsWith('image/')) files.push(file);
        });
    }
    return files;
}

/** Is the clipboard HTML nothing but one <img> ("Copy image" in a browser)? */
function isSingleImageHtml(html) {
    const body = parseHtmlInert(html);
    body.querySelectorAll('meta, style, script, title, link').forEach(el => el.remove());
    if ((body.textContent || '').trim()) return false;
    return body.querySelectorAll('img').length === 1 &&
        !body.querySelector('table, iframe, video, svg, canvas');
}

/** Is `node` preceded by nothing visible inside `block`? */
function isAtBlockStart(block, node) {
    const range = document.createRange();
    range.setStart(block, 0);
    range.setEndBefore(node);
    if (range.toString().trim()) return false;
    return !range.cloneContents().querySelector('img, video, iframe');
}
