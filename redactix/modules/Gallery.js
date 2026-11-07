import Module from '../core/Module.js';
import Icons from '../ui/Icons.js';
import { sanitizeUrl, sanitizeImageSrc, sanitizeSrcset, sanitizeRel, composeLinkRel } from '../core/dom-utils.js';
import { upload, errorMessage } from '../core/media-client.js';
import { readCaption, writeCaption, cleanCaptionForSync, ensureEditButton, setOwnClass } from '../core/figure-utils.js';
import { createMediaBrowsePanel } from '../ui/media-ui.js';
import { inputGroup, checkbox, statusLine, SPINNER_SVG } from '../ui/form-helpers.js';

// Per-image attributes the modal doesn't expose but must not discard on
// re-save (they used to be silently dropped).
const KEPT_IMG_ATTRS = ['title', 'srcset', 'sizes', 'loading', 'width', 'height', 'decoding'];
const MANAGED_REL = new Set(['nofollow', 'noopener', 'noreferrer']);

/**
 * Gallery module.
 *
 * Multiple images grouped under one <figure> with a single shared
 * <figcaption>. Each image can carry its own optional link. Output:
 *
 *   <figure class="redactix-gallery">
 *     <div class="redactix-gallery-grid">
 *       <a href="..."><img src="..." alt="..."></a>
 *       <img src="..." alt="...">
 *       <a href="..." rel="..." target="_blank"><img src="..." alt="..."></a>
 *     </div>
 *     <figcaption>Optional caption</figcaption>
 *   </figure>
 *
 * The inner .redactix-gallery-grid is a wrapper so figcaption is
 * unambiguously separate from the images (mirrors the embed/video
 * pattern). The editor styles it as an auto-fit grid; the production
 * site is expected to override.
 *
 * Click on any image inside a gallery opens this module's modal
 * (the Image module's click handler bails when the img lives inside a
 * figure.redactix-gallery, so the two never compete).
 *
 * Disabled in lite mode entirely.
 */
export default class Gallery extends Module {
    static moduleName = 'Gallery';

    constructor(instance) {
        super(instance);
        this.liteMode = instance.config.liteMode || false;
        this.uploadUrl = instance.config.uploadUrl || null;
        this.browseUrl = instance.config.browseUrl || null;
        this._rafId = null;
        this._dragoverHandler = null;
        this._scrollTarget = null;
    }

    init() {
        // Auto-scroll may still be running if the instance dies mid-drag.
        this.instance.onDestroy(() => this.stopAutoScroll());

        if (this.liteMode) return;

        // Click on a gallery image (or its wrapping link) → open the
        // gallery modal. We listen at the editor level so the handler
        // wins regardless of nested links / event ordering.
        this.instance.editorEl.addEventListener('click', (e) => {
            const figure = e.target.closest && e.target.closest('figure.redactix-gallery');
            if (!figure) return;
            const img = e.target.closest('img');
            const editBtn = e.target.closest('.redactix-gallery-edit-btn');
            if (!img && !editBtn) return;
            e.preventDefault();
            e.stopPropagation();
            this.openModal(figure);
        });
    }

    getButtons() {
        if (this.liteMode) return [];
        return [
            {
                name: 'gallery',
                label: 'Gallery',
                icon: Icons.gallery,
                title: this.t('toolbar.insertGallery'),
                action: () => this.openModal()
            }
        ];
    }

    /**
     * Wire contenteditable on every gallery figure + ensure the floating
     * Edit button exists. Always runs (even in lite mode for the
     * contenteditable side) so old content doesn't fall through to
     * editable inner imgs.
     */
    setupGalleries(rootEl) {
        const root = rootEl || this.instance.editorEl;
        root.querySelectorAll('figure.redactix-gallery').forEach(figure => {
            // Drop empty / broken galleries so the editor doesn't render
            // an empty shell with a non-functional Edit button.
            const grid = figure.querySelector(':scope > .redactix-gallery-grid');
            if (!grid || grid.querySelectorAll('img').length === 0) {
                figure.remove();
                return;
            }
            figure.setAttribute('contenteditable', 'false');
            const figcaption = figure.querySelector(':scope > figcaption');
            if (figcaption) figcaption.setAttribute('contenteditable', 'true');

            // Floating "Edit" button — same UX as embeds / videos, top-right.
            // Only when the feature is reachable (not lite mode).
            if (!this.liteMode) ensureEditButton(figure, 'redactix-gallery-edit-btn', this.t('gallery.edit'));
        });
    }

    /**
     * Sync-side cleanup. Operates on a clone of editorEl, NOT live DOM.
     */
    cleanGalleriesForSync(clone) {
        clone.querySelectorAll('.redactix-gallery-edit-btn').forEach(el => el.remove());
        clone.querySelectorAll('figure.redactix-gallery').forEach(figure => {
            figure.removeAttribute('contenteditable');
            cleanCaptionForSync(figure);
        });
    }

    // ---------- modal ----------

    /**
     * Open the gallery modal. existingFigure null → insert new gallery,
     * non-null → edit existing.
     */
    openModal(existingFigure = null) {
        if (this.liteMode) return;
        this.instance.selection.save();

        const t = (k, p) => this.t(k, p);
        // ---- State held in closure: the modal mutates `items` until the
        // user hits Save, then we render the figure once. ----
        const state = {
            items: existingFigure ? this.readFigure(existingFigure) : [],
            pending: 0
        };
        const modalUploads = new AbortController();
        let browsePanel = null;

        const form = document.createElement('div');

        // Items list (sortable, with thumbnail + URL/alt/link fields).
        const list = document.createElement('div');
        list.className = 'redactix-gallery-items';
        form.appendChild(list);

        // Rows are keyed by item so an upload finishing re-renders ONE row
        // instead of the whole list.
        const rows = new Map();
        const renderList = () => {
            rows.clear();
            list.replaceChildren();
            if (state.items.length === 0) {
                const empty = document.createElement('div');
                empty.className = 'redactix-gallery-empty';
                empty.textContent = t('gallery.empty');
                list.appendChild(empty);
                return;
            }
            state.items.forEach((item, idx) => {
                const row = this.renderItem(item, idx, state, renderList);
                rows.set(item, row);
                list.appendChild(row);
            });
        };
        const renderRow = (item) => {
            const old = rows.get(item);
            const idx = state.items.indexOf(item);
            if (!old || idx < 0 || !old.isConnected) {
                renderList();
                return;
            }
            const row = this.renderItem(item, idx, state, renderList);
            rows.set(item, row);
            old.replaceWith(row);
        };
        renderList();

        // Drops anywhere in the list end the auto-scroll (dragend is not
        // guaranteed when the dragged row is re-rendered away).
        list.addEventListener('drop', () => this.stopAutoScroll());

        const status = statusLine('', { error: true });
        status.style.whiteSpace = 'pre-line'; // one line per failed upload

        // ---- "Add image" controls: upload / URL / browse panel ----
        const addRow = document.createElement('div');
        addRow.className = 'redactix-gallery-add-row';

        addRow.appendChild(this.makeAddButton(t('gallery.addByUrl'), () => {
            const url = prompt(t('gallery.promptUrl'), 'https://');
            if (url && url.trim() && url.trim() !== 'https://') {
                state.items.push(newItem({ url: url.trim() }));
                renderList();
            }
        }));

        if (this.uploadUrl) {
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = 'image/*';
            fileInput.multiple = true;
            fileInput.hidden = true;

            addRow.appendChild(this.makeAddButton(t('gallery.addUpload'), () => fileInput.click()));
            addRow.appendChild(fileInput);

            fileInput.addEventListener('change', async () => {
                const files = Array.from(fileInput.files || []).filter(f => (f.type || '').startsWith('image/'));
                fileInput.value = '';
                if (!files.length) return;
                // All placeholders first (one render), then upload in order.
                const placeholders = files.map(() => newItem({ _uploading: true }));
                state.items.push(...placeholders);
                state.pending += files.length;
                renderList();

                const errors = [];
                for (let i = 0; i < files.length; i++) {
                    const placeholder = placeholders[i];
                    const result = await upload(this.uploadUrl, 'image', files[i], { signal: modalUploads.signal });
                    state.pending--;
                    if (result.code === 'aborted') return; // modal closed
                    if (result.ok) {
                        placeholder.url = result.data.src;
                        if (result.data.alt) placeholder.alt = result.data.alt;
                        if (result.data.srcset) placeholder.attrs.srcset = result.data.srcset;
                        if (result.data.title) placeholder.attrs.title = result.data.title;
                        placeholder._uploading = false;
                        renderRow(placeholder);
                    } else {
                        errors.push(t('gallery.uploadFailed', { filename: files[i].name, error: errorMessage(result, t) }));
                        const idx = state.items.indexOf(placeholder);
                        if (idx >= 0) state.items.splice(idx, 1);
                        renderList();
                    }
                }
                status.textContent = errors.join('\n');
            });
        }

        let browseHolder = null;
        if (this.browseUrl) {
            browsePanel = createMediaBrowsePanel({
                t,
                type: 'image',
                url: this.browseUrl,
                withButton: false,
                stayOpen: true,
                onSelect: (data) => {
                    state.items.push(newItem({
                        url: data.src,
                        alt: data.alt || '',
                        attrs: { srcset: data.srcset || '', title: data.title || '' }
                    }));
                    renderList();
                }
            });
            addRow.appendChild(this.makeAddButton(t('gallery.addFromGallery'), () => {
                if (browsePanel.isOpen) browsePanel.close();
                else browsePanel.open();
            }));
            browseHolder = document.createElement('div');
            browseHolder.className = 'redactix-gallery-browse';
            browseHolder.appendChild(browsePanel.element);
        }

        form.appendChild(addRow);
        if (browseHolder) form.appendChild(browseHolder);

        // ---- Caption ----
        const captionGroup = inputGroup(t('gallery.caption'), 'text', existingFigure ? readCaption(existingFigure) : '',
            { placeholder: t('gallery.captionPlaceholder') });
        captionGroup.classList.add('redactix-modal-full-width');
        const captionInput = captionGroup.field;
        form.append(captionGroup, status);

        const isEditing = !!existingFigure;
        const extraButtons = [];
        if (isEditing) {
            extraButtons.push({
                text: t('gallery.removeGallery'),
                danger: true,
                onClick: () => {
                    this.transact(() => existingFigure.remove());
                    this.instance.modal.close();
                }
            });
        }

        this.instance.modal.open({
            title: isEditing ? t('gallery.editTitle') : t('gallery.title'),
            body: form,
            extraButtons,
            onClose: () => {
                modalUploads.abort();
                this.stopAutoScroll();
                if (browsePanel) browsePanel.destroy();
            },
            onSave: () => {
                // Saving with uploads in flight used to drop them silently.
                if (state.pending > 0) {
                    status.textContent = t('upload.pending');
                    return false;
                }
                const finalItems = state.items.filter(i => !i._uploading && sanitizeImageSrc(i.url || ''));
                if (finalItems.length === 0) {
                    // Never delete the gallery being edited because every
                    // URL is invalid — tell the user instead.
                    status.textContent = t('gallery.invalidUrls');
                    return false;
                }
                const caption = captionInput.value;
                if (isEditing) {
                    this.transact(() => {
                        this.populateFigure(existingFigure, finalItems, caption);
                        this.setupGalleries(existingFigure.parentNode || this.instance.editorEl);
                    });
                } else {
                    const figure = document.createElement('figure');
                    this.populateFigure(figure, finalItems, caption);
                    this.instance.selection.restore();
                    this.transact(() => {
                        this.instance.selection.insertNode(figure);
                        this.setupGalleries(figure.parentNode || this.instance.editorEl);
                    });
                }
            }
        });
    }

    /**
     * Render a single editable row in the modal items list. Mutates
     * `state.items[index]` in place; calls `rerender` after structural
     * changes (delete / move).
     */
    renderItem(item, index, state, rerender) {
        const t = (k, p) => this.t(k, p);
        const row = document.createElement('div');
        row.className = 'redactix-gallery-item';
        // Row itself stays non-draggable — otherwise the inputs inside
        // can't do native text selection (browser starts a drag instead).

        // Drag handle — the only element that initiates the drag.
        const handle = document.createElement('div');
        handle.className = 'redactix-gallery-handle';
        handle.textContent = '⋮⋮';
        handle.title = t('gallery.drag');
        handle.draggable = true;
        row.appendChild(handle);

        // Thumbnail
        const thumb = document.createElement('div');
        thumb.className = 'redactix-gallery-thumb';
        if (item._uploading) {
            thumb.innerHTML = SPINNER_SVG; // static markup
        } else {
            const src = sanitizeImageSrc(item.url || '');
            if (src) {
                const img = document.createElement('img');
                img.src = src;
                img.alt = '';
                thumb.appendChild(img);
            }
        }
        row.appendChild(thumb);

        // Fields column
        const fields = document.createElement('div');
        fields.className = 'redactix-gallery-fields';

        const urlInput = this.makeRowInput(t('gallery.itemUrl'), item.url, (v) => { item.url = v; });
        if (item._uploading) urlInput.disabled = true;
        const altInput = this.makeRowInput(t('gallery.itemAlt'), item.alt || '', (v) => { item.alt = v; });
        const linkInput = this.makeRowInput(t('gallery.itemLink'), item.linkUrl || '', (v) => { item.linkUrl = v; });

        // Compact link checkboxes row
        const linkChecks = document.createElement('div');
        linkChecks.className = 'redactix-gallery-checks';
        const blank = checkbox(t('gallery.openNewWindow'), item.isBlank);
        blank.field.addEventListener('change', () => { item.isBlank = blank.field.checked; });
        const nofollow = checkbox(t('gallery.nofollow'), item.isNofollow);
        nofollow.field.addEventListener('change', () => { item.isNofollow = nofollow.field.checked; });
        linkChecks.append(blank, nofollow);

        fields.append(urlInput, altInput, linkInput, linkChecks);
        row.appendChild(fields);

        // Remove button
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'redactix-gallery-remove';
        removeBtn.textContent = '×';
        removeBtn.title = t('gallery.removeItem');
        removeBtn.setAttribute('aria-label', t('gallery.removeItem'));
        removeBtn.addEventListener('click', () => {
            const idx = state.items.indexOf(item);
            if (idx >= 0) state.items.splice(idx, 1);
            rerender();
        });
        row.appendChild(removeBtn);

        // ---- Drag-and-drop reordering: drag starts ONLY on the handle,
        // but the whole row is a valid drop target. ----
        handle.addEventListener('dragstart', (e) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', String(index));
            // Use the row as the drag image so the user sees what's moving.
            if (e.dataTransfer.setDragImage) {
                e.dataTransfer.setDragImage(row, 20, 20);
            }
            row.classList.add('is-dragging');
            // Auto-scroll the items list while the cursor sits near its
            // top / bottom edge — otherwise long galleries can't be
            // reordered end-to-end without the scrollbar.
            this.startAutoScroll(row.parentNode);
        });
        handle.addEventListener('dragend', () => {
            row.classList.remove('is-dragging');
            this.stopAutoScroll();
        });
        row.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            row.classList.add('is-drop-target');
        });
        row.addEventListener('dragleave', () => {
            row.classList.remove('is-drop-target');
        });
        row.addEventListener('drop', (e) => {
            e.preventDefault();
            row.classList.remove('is-drop-target');
            this.stopAutoScroll();
            const from = parseInt(e.dataTransfer.getData('text/plain'), 10);
            if (Number.isFinite(from) && from !== index && from >= 0 && from < state.items.length) {
                const [moved] = state.items.splice(from, 1);
                state.items.splice(index, 0, moved);
                rerender();
            }
        });

        return row;
    }

    /**
     * Auto-scroll a container while a drag is in progress and the cursor
     * is within EDGE_ZONE px of its top / bottom edge. Speed ramps from
     * 0 at the zone boundary to MAX_SPEED at (and beyond) the edge.
     *
     * Stopped by dragend, by any drop in the list, by closing the modal,
     * by destroy() — and by itself when no dragover arrived for a second
     * (dragend is not guaranteed if the dragged row was re-rendered).
     */
    startAutoScroll(scrollTarget) {
        const EDGE_ZONE = 80;   // px — how deep from the edge the zone reaches
        const MAX_SPEED = 18;   // px per frame ≈ ~1080px/s at 60fps
        const IDLE_MS = 1000;

        this.stopAutoScroll(); // clear any previous run
        if (!scrollTarget) return;
        this._scrollTarget = scrollTarget;
        let lastClientY = -1;
        let lastEvent = performance.now();

        this._dragoverHandler = (e) => {
            lastClientY = e.clientY;
            lastEvent = performance.now();
        };
        document.addEventListener('dragover', this._dragoverHandler);

        const tick = (now) => {
            const target = this._scrollTarget;
            if (!target || !target.isConnected || now - lastEvent > IDLE_MS) {
                this.stopAutoScroll();
                return;
            }
            if (lastClientY >= 0) {
                const rect = target.getBoundingClientRect();
                const distTop = lastClientY - rect.top;
                const distBottom = rect.bottom - lastClientY;
                let delta = 0;
                if (distTop < EDGE_ZONE) {
                    const f = Math.max(0, Math.min(1, 1 - distTop / EDGE_ZONE));
                    delta = -MAX_SPEED * f;
                } else if (distBottom < EDGE_ZONE) {
                    const f = Math.max(0, Math.min(1, 1 - distBottom / EDGE_ZONE));
                    delta = MAX_SPEED * f;
                }
                if (delta !== 0) target.scrollTop += delta;
            }
            this._rafId = requestAnimationFrame(tick);
        };
        this._rafId = requestAnimationFrame(tick);
    }

    stopAutoScroll() {
        if (this._rafId) cancelAnimationFrame(this._rafId);
        if (this._dragoverHandler) document.removeEventListener('dragover', this._dragoverHandler);
        this._rafId = null;
        this._dragoverHandler = null;
        this._scrollTarget = null;
    }

    makeRowInput(placeholder, value, onChange) {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'redactix-gallery-input';
        input.value = value || '';
        input.placeholder = placeholder;
        input.setAttribute('aria-label', placeholder);
        input.addEventListener('input', () => onChange(input.value));
        return input;
    }

    makeAddButton(label, onClick) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'redactix-gallery-add-btn';
        btn.textContent = label;
        btn.addEventListener('click', onClick);
        return btn;
    }

    // ---------- read existing figure ----------

    /**
     * Walk the gallery's grid and return a list of items in the
     * editor's current order. Each item has src + alt + optional link,
     * plus the attributes the modal doesn't edit (kept as is).
     */
    readFigure(figure) {
        const grid = figure.querySelector(':scope > .redactix-gallery-grid');
        if (!grid) return [];
        return Array.from(grid.children).map(child => {
            // Either <a><img></a> or <img>.
            let img = child;
            let link = null;
            if (child.tagName === 'A') {
                link = child;
                img = child.querySelector('img');
            }
            if (!img || img.tagName !== 'IMG') return null;
            const attrs = {};
            KEPT_IMG_ATTRS.forEach(name => {
                if (img.hasAttribute(name)) attrs[name] = img.getAttribute(name);
            });
            const relTokens = link ? (link.getAttribute('rel') || '').split(/\s+/).filter(Boolean) : [];
            return newItem({
                url: img.getAttribute('src') || '',
                alt: img.getAttribute('alt') || '',
                linkUrl: link ? (link.getAttribute('href') || '') : '',
                isBlank: link ? link.getAttribute('target') === '_blank' : false,
                isNofollow: relTokens.includes('nofollow'),
                relExtra: relTokens.filter(r => !MANAGED_REL.has(r.toLowerCase())).join(' '),
                attrs
            });
        }).filter(Boolean);
    }

    readCaption(figure) {
        return readCaption(figure);
    }

    /**
     * Build the figure DOM from a list of items + caption. Mutates the
     * given figure (works for both create and edit paths). Classes and
     * attributes the user put on the figure itself are left alone.
     */
    populateFigure(figure, items, caption) {
        setOwnClass(figure, 'redactix-gallery');
        figure.setAttribute('contenteditable', 'false');

        const grid = document.createElement('div');
        grid.className = 'redactix-gallery-grid';
        items.forEach(item => {
            // Санитизация — та же поверхность, что и у одиночной картинки:
            // src через sanitizeImageSrc, href через sanitizeUrl, rel через
            // composeLinkRel (noopener при _blank).
            const src = sanitizeImageSrc(item.url || '');
            if (!src) return;
            const img = document.createElement('img');
            img.setAttribute('src', src);
            if (item.alt) img.setAttribute('alt', item.alt);
            Object.entries(item.attrs || {}).forEach(([name, value]) => {
                if (!KEPT_IMG_ATTRS.includes(name) || value == null || value === '') return;
                if (name === 'srcset') {
                    const safe = sanitizeSrcset(String(value));
                    if (safe) img.setAttribute('srcset', safe);
                    return;
                }
                img.setAttribute(name, String(value));
            });
            const linkUrl = item.linkUrl ? sanitizeUrl(item.linkUrl) : null;
            if (linkUrl) {
                const a = document.createElement('a');
                a.setAttribute('href', linkUrl);
                if (item.isBlank) a.setAttribute('target', '_blank');
                const rel = composeLinkRel({ nofollow: item.isNofollow, blank: item.isBlank, extra: sanitizeRel(item.relExtra || '') });
                if (rel) a.setAttribute('rel', rel);
                a.appendChild(img);
                grid.appendChild(a);
            } else {
                grid.appendChild(img);
            }
        });

        // Replace the grid; keep the figcaption node (and anything else
        // foreign) so only our own structure is rebuilt.
        figure.querySelectorAll(':scope > .redactix-gallery-grid, :scope > .redactix-gallery-edit-btn').forEach(el => el.remove());
        figure.insertBefore(grid, figure.firstChild);
        writeCaption(figure, caption);
    }

    // ---------- content lifecycle hooks (called by RedactixInstance) ----------

    setupContent(root) {
        this.setupGalleries(root);
    }

    cleanForSync(clone) {
        this.cleanGalleriesForSync(clone);
    }

    ownsFigure(figure) {
        return figure.classList.contains('redactix-gallery');
    }

    // Lite mode has no galleries: pasted gallery markup degrades to images.
    get pasteAllowedClasses() {
        return this.instance.config.liteMode ? [] : ['redactix-gallery', 'redactix-gallery-grid'];
    }
}

function newItem(fields = {}) {
    return {
        url: '',
        alt: '',
        linkUrl: '',
        isBlank: false,
        isNofollow: false,
        relExtra: '',
        attrs: {},
        _uploading: false,
        ...fields
    };
}
