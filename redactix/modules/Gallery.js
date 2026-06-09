import Module from '../core/Module.js';
import Icons from '../ui/Icons.js';
import { sanitizeUrl, sanitizeImageSrc, sanitizeInlineHtml, composeLinkRel } from '../core/dom-utils.js';

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
    constructor(instance) {
        super(instance);
        this.liteMode = instance.config.liteMode || false;
        this.uploadUrl = instance.config.uploadUrl || null;
        this.browseUrl = instance.config.browseUrl || null;
        this.allowDelete = !!instance.config.allowImageDelete;
    }

    init() {
        if (this.liteMode) return;

        // Click on a gallery image (or its wrapping link) → open the
        // gallery modal. We listen at the editor level so the handler
        // wins regardless of nested links / event ordering.
        this.instance.editorEl.addEventListener('click', (e) => {
            const figure = e.target.closest && e.target.closest('figure.redactix-gallery');
            if (!figure) return;
            const img = e.target.closest && e.target.closest('img');
            const editBtn = e.target.closest && e.target.closest('.redactix-gallery-edit-btn');
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
            if (!this.liteMode && !figure.querySelector(':scope > .redactix-gallery-edit-btn')) {
                const editBtn = document.createElement('button');
                editBtn.type = 'button';
                editBtn.className = 'redactix-gallery-edit-btn';
                editBtn.setAttribute('data-redactix-ui', '');
                editBtn.contentEditable = 'false';
                editBtn.textContent = this.t('gallery.edit');
                figure.appendChild(editBtn);
            }
        });
    }

    /**
     * Sync-side cleanup. Operates on a clone of editorEl, NOT live DOM.
     */
    cleanGalleriesForSync(clone) {
        clone.querySelectorAll('.redactix-gallery-edit-btn').forEach(el => el.remove());
        clone.querySelectorAll('figure.redactix-gallery').forEach(figure => {
            figure.removeAttribute('contenteditable');
            const figcaption = figure.querySelector(':scope > figcaption');
            if (figcaption) {
                figcaption.removeAttribute('contenteditable');
                const text = (figcaption.textContent || '').trim();
                if (!text) figcaption.remove();
            }
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

        const items = existingFigure ? this.readFigure(existingFigure) : [];
        const initialCaption = existingFigure ? this.readCaption(existingFigure) : '';

        // ---- Layout state held in closure: the modal mutates `items`
        // until the user hits Save, then we render the figure once. ----
        const state = { items: items.slice(), caption: initialCaption };

        const form = document.createElement('div');

        // Items list (sortable, with thumbnail + URL/alt/link fields).
        const list = document.createElement('div');
        list.className = 'redactix-gallery-items';
        list.style.display = 'flex';
        list.style.flexDirection = 'column';
        list.style.gap = '8px';
        list.style.marginBottom = '12px';
        // Tall enough to fit several rows on a typical desktop viewport
        // without overshooting the modal's 90vh cap.
        list.style.maxHeight = 'min(60vh, 600px)';
        list.style.overflowY = 'auto';
        list.style.padding = '8px';
        list.style.background = 'var(--redactix-bg-secondary)';
        list.style.border = '1px solid var(--redactix-border)';
        list.style.borderRadius = '8px';
        form.appendChild(list);

        const renderList = () => {
            list.innerHTML = '';
            if (state.items.length === 0) {
                const empty = document.createElement('div');
                empty.style.color = 'var(--redactix-text-placeholder)';
                empty.style.textAlign = 'center';
                empty.style.padding = '24px 8px';
                empty.style.fontSize = '13px';
                empty.textContent = this.t('gallery.empty');
                list.appendChild(empty);
                return;
            }
            state.items.forEach((item, idx) => {
                list.appendChild(this.renderItem(item, idx, state, renderList));
            });
        };
        renderList();

        // ---- "Add image" controls: upload / URL / browse panel ----
        const addRow = document.createElement('div');
        addRow.style.display = 'flex';
        addRow.style.gap = '8px';
        addRow.style.flexWrap = 'wrap';
        addRow.style.marginBottom = '12px';

        const addUrlBtn = this.makeAddButton(this.t('gallery.addByUrl'), () => {
            const url = prompt(this.t('gallery.promptUrl'), 'https://');
            if (url && url !== 'https://') {
                state.items.push({ url, alt: '', linkUrl: '', isBlank: false, isNofollow: false });
                renderList();
            }
        });
        addRow.appendChild(addUrlBtn);

        let fileInput = null;
        if (this.uploadUrl) {
            fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = 'image/*';
            fileInput.multiple = true;
            fileInput.style.display = 'none';

            const addUploadBtn = this.makeAddButton(this.t('gallery.addUpload'), () => fileInput.click());
            addRow.appendChild(addUploadBtn);
            addRow.appendChild(fileInput);

            fileInput.addEventListener('change', async () => {
                const files = Array.from(fileInput.files || []);
                fileInput.value = '';
                for (const file of files) {
                    if (!file.type.startsWith('image/')) continue;
                    const placeholder = { url: '', alt: '', linkUrl: '', isBlank: false, isNofollow: false, _uploading: true };
                    state.items.push(placeholder);
                    renderList();
                    try {
                        const fd = new FormData();
                        fd.append('image', file);
                        const r = await fetch(this.uploadUrl, { method: 'POST', body: fd });
                        const data = await r.json();
                        if (data.success) {
                            placeholder.url = data.src;
                            if (data.alt) placeholder.alt = data.alt;
                            placeholder._uploading = false;
                        } else {
                            // Drop the placeholder on failure.
                            const idx = state.items.indexOf(placeholder);
                            if (idx >= 0) state.items.splice(idx, 1);
                        }
                    } catch (err) {
                        const idx = state.items.indexOf(placeholder);
                        if (idx >= 0) state.items.splice(idx, 1);
                    }
                    renderList();
                }
            });
        }

        let browsePanel = null;
        if (this.browseUrl) {
            const addBrowseBtn = this.makeAddButton(this.t('gallery.addFromGallery'), () => {
                if (browsePanel.style.display === 'none') {
                    browsePanel.style.display = 'block';
                    this.openBrowsePanel(browsePanel, (data) => {
                        state.items.push({ url: data.src, alt: data.alt || '', linkUrl: '', isBlank: false, isNofollow: false });
                        renderList();
                    });
                } else {
                    browsePanel.style.display = 'none';
                }
            });
            addRow.appendChild(addBrowseBtn);
        }

        form.appendChild(addRow);

        if (this.browseUrl) {
            browsePanel = document.createElement('div');
            browsePanel.style.display = 'none';
            browsePanel.style.marginBottom = '12px';
            form.appendChild(browsePanel);
        }

        // ---- Caption ----
        const captionGroup = this.makeInputGroup(this.t('gallery.caption'), 'text', state.caption);
        captionGroup.className = 'redactix-modal-full-width';
        const captionInput = captionGroup.querySelector('input');
        captionInput.placeholder = this.t('gallery.captionPlaceholder');
        form.appendChild(captionGroup);

        const isEditing = !!existingFigure;
        const extraButtons = [];
        if (isEditing) {
            extraButtons.push({
                text: this.t('gallery.removeGallery'),
                danger: true,
                onClick: () => {
                    existingFigure.remove();
                    this.instance.sync();
                    this.instance.modal.close();
                }
            });
        }

        this.instance.modal.open({
            title: isEditing ? this.t('gallery.editTitle') : this.t('gallery.title'),
            body: form,
            extraButtons,
            onSave: () => {
                state.caption = captionInput.value.trim();
                // Drop placeholder rows that never resolved.
                const finalItems = state.items.filter(i => i.url && !i._uploading);
                if (finalItems.length === 0) return;
                if (isEditing) {
                    this.populateFigure(existingFigure, finalItems, state.caption);
                } else {
                    const figure = document.createElement('figure');
                    this.populateFigure(figure, finalItems, state.caption);
                    this.instance.selection.restore();
                    this.instance.selection.insertNode(figure);
                    if (this.instance.core) this.instance.core.ensureTrailingParagraph();
                }
                this.setupGalleries(this.instance.editorEl);
                this.instance.sync();
            }
        });
    }

    /**
     * Render a single editable row in the modal items list. Mutates
     * `state.items[index]` in place; calls `rerender` after structural
     * changes (delete / move).
     */
    renderItem(item, index, state, rerender) {
        const row = document.createElement('div');
        row.style.display = 'grid';
        row.style.gridTemplateColumns = '24px 60px 1fr auto';
        row.style.gap = '8px';
        row.style.alignItems = 'center';
        row.style.padding = '6px';
        row.style.background = 'var(--redactix-bg)';
        row.style.border = '1px solid var(--redactix-border)';
        row.style.borderRadius = '6px';
        // Row itself stays non-draggable — otherwise the inputs inside
        // can't do native text selection (browser starts a drag instead).

        // Drag handle — the only element that initiates the drag.
        const handle = document.createElement('div');
        handle.textContent = '⋮⋮';
        handle.style.cursor = 'grab';
        handle.style.color = 'var(--redactix-text-placeholder)';
        handle.style.fontSize = '14px';
        handle.style.textAlign = 'center';
        handle.style.userSelect = 'none';
        handle.title = this.t('gallery.drag');
        handle.draggable = true;
        row.appendChild(handle);

        // Thumbnail
        const thumb = document.createElement('div');
        thumb.style.width = '60px';
        thumb.style.height = '60px';
        thumb.style.borderRadius = '4px';
        thumb.style.overflow = 'hidden';
        thumb.style.background = 'var(--redactix-bg-hover)';
        thumb.style.display = 'flex';
        thumb.style.alignItems = 'center';
        thumb.style.justifyContent = 'center';
        if (item._uploading) {
            thumb.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="32"><animate attributeName="stroke-dashoffset" values="32;0" dur="1s" repeatCount="indefinite"/></circle></svg>`;
        } else if (item.url) {
            const img = document.createElement('img');
            img.src = item.url;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';
            thumb.appendChild(img);
        }
        row.appendChild(thumb);

        // Fields column
        const fields = document.createElement('div');
        fields.style.display = 'flex';
        fields.style.flexDirection = 'column';
        fields.style.gap = '4px';

        const urlInput = this.makeRowInput(this.t('gallery.itemUrl'), item.url, (v) => { item.url = v; });
        const altInput = this.makeRowInput(this.t('gallery.itemAlt'), item.alt || '', (v) => { item.alt = v; });
        const linkInput = this.makeRowInput(this.t('gallery.itemLink'), item.linkUrl || '', (v) => { item.linkUrl = v; });

        // Compact link checkboxes row
        const linkChecks = document.createElement('div');
        linkChecks.style.display = 'flex';
        linkChecks.style.gap = '12px';
        linkChecks.style.fontSize = '12px';
        linkChecks.style.color = 'var(--redactix-text-muted)';

        const blankLabel = document.createElement('label');
        blankLabel.style.display = 'inline-flex';
        blankLabel.style.alignItems = 'center';
        blankLabel.style.gap = '4px';
        blankLabel.style.cursor = 'pointer';
        const blankCheck = document.createElement('input');
        blankCheck.type = 'checkbox';
        blankCheck.style.width = 'auto';
        blankCheck.checked = !!item.isBlank;
        blankCheck.addEventListener('change', () => { item.isBlank = blankCheck.checked; });
        blankLabel.append(blankCheck, this.t('gallery.openNewWindow'));

        const nofollowLabel = document.createElement('label');
        nofollowLabel.style.display = 'inline-flex';
        nofollowLabel.style.alignItems = 'center';
        nofollowLabel.style.gap = '4px';
        nofollowLabel.style.cursor = 'pointer';
        const nofollowCheck = document.createElement('input');
        nofollowCheck.type = 'checkbox';
        nofollowCheck.style.width = 'auto';
        nofollowCheck.checked = !!item.isNofollow;
        nofollowCheck.addEventListener('change', () => { item.isNofollow = nofollowCheck.checked; });
        nofollowLabel.append(nofollowCheck, this.t('gallery.nofollow'));

        linkChecks.append(blankLabel, nofollowLabel);

        fields.append(urlInput, altInput, linkInput, linkChecks);
        row.appendChild(fields);

        // Remove button
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.innerHTML = '×';
        removeBtn.title = this.t('gallery.removeItem');
        removeBtn.style.width = '28px';
        removeBtn.style.height = '28px';
        removeBtn.style.background = 'var(--redactix-danger-light)';
        removeBtn.style.color = 'var(--redactix-danger)';
        removeBtn.style.border = 'none';
        removeBtn.style.borderRadius = '4px';
        removeBtn.style.cursor = 'pointer';
        removeBtn.style.fontSize = '16px';
        removeBtn.style.lineHeight = '1';
        removeBtn.addEventListener('click', () => {
            state.items.splice(index, 1);
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
            row.style.opacity = '0.5';
            handle.style.cursor = 'grabbing';
            // Auto-scroll the items list while the cursor sits near its
            // top / bottom edge — otherwise long galleries can't be
            // reordered end-to-end without the scrollbar.
            this.startAutoScroll(row.parentNode);
        });
        handle.addEventListener('dragend', () => {
            row.style.opacity = '';
            handle.style.cursor = 'grab';
            this.stopAutoScroll();
        });
        row.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            row.style.borderColor = 'var(--redactix-primary)';
        });
        row.addEventListener('dragleave', () => {
            row.style.borderColor = 'var(--redactix-border)';
        });
        row.addEventListener('drop', (e) => {
            e.preventDefault();
            row.style.borderColor = 'var(--redactix-border)';
            const from = parseInt(e.dataTransfer.getData('text/plain'), 10);
            if (Number.isFinite(from) && from !== index) {
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
     * Call from `dragstart`; matched by `stopAutoScroll()` on `dragend`.
     */
    startAutoScroll(scrollTarget) {
        const EDGE_ZONE = 80;   // px — how deep from the edge the zone reaches
        const MAX_SPEED = 18;   // px per frame ≈ ~1080px/s at 60fps

        this.stopAutoScroll(); // clear any previous run
        this._scrollTarget = scrollTarget;
        this._lastClientY = -1;

        this._dragoverHandler = (e) => { this._lastClientY = e.clientY; };
        document.addEventListener('dragover', this._dragoverHandler);

        const tick = () => {
            if (!this._scrollTarget) return;
            if (this._lastClientY >= 0) {
                const rect = this._scrollTarget.getBoundingClientRect();
                const distTop = this._lastClientY - rect.top;
                const distBottom = rect.bottom - this._lastClientY;
                let delta = 0;
                if (distTop < EDGE_ZONE) {
                    const f = Math.max(0, Math.min(1, 1 - distTop / EDGE_ZONE));
                    delta = -MAX_SPEED * f;
                } else if (distBottom < EDGE_ZONE) {
                    const f = Math.max(0, Math.min(1, 1 - distBottom / EDGE_ZONE));
                    delta = MAX_SPEED * f;
                }
                if (delta !== 0) this._scrollTarget.scrollTop += delta;
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
        this._lastClientY = -1;
    }

    makeRowInput(placeholder, value, onChange) {
        const input = document.createElement('input');
        input.type = 'text';
        input.value = value;
        input.placeholder = placeholder;
        input.style.padding = '4px 6px';
        input.style.fontSize = '12px';
        input.style.border = '1px solid var(--redactix-border)';
        input.style.borderRadius = '4px';
        input.style.boxSizing = 'border-box';
        input.addEventListener('input', () => onChange(input.value));
        return input;
    }

    makeAddButton(label, onClick) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = label;
        btn.style.padding = '8px 14px';
        btn.style.background = 'var(--redactix-bg-hover)';
        btn.style.border = '1px solid var(--redactix-border)';
        btn.style.borderRadius = '6px';
        btn.style.cursor = 'pointer';
        btn.style.fontSize = '13px';
        btn.style.color = 'var(--redactix-text)';
        btn.style.transition = 'background 0.15s';
        btn.addEventListener('mouseenter', () => { btn.style.background = 'var(--redactix-bg-active)'; });
        btn.addEventListener('mouseleave', () => { btn.style.background = 'var(--redactix-bg-hover)'; });
        btn.addEventListener('click', onClick);
        return btn;
    }

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

    // ---------- read existing figure ----------

    /**
     * Walk the gallery's grid and return a list of items in the
     * editor's current order. Each item has src + alt + optional link.
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
            if (!img) return null;
            return {
                url: img.getAttribute('src') || '',
                alt: img.getAttribute('alt') || '',
                linkUrl: link ? (link.getAttribute('href') || '') : '',
                isBlank: link ? link.getAttribute('target') === '_blank' : false,
                isNofollow: link ? (link.getAttribute('rel') || '').includes('nofollow') : false
            };
        }).filter(Boolean);
    }

    readCaption(figure) {
        const figcaption = figure.querySelector(':scope > figcaption');
        if (!figcaption) return '';
        return (figcaption.innerHTML || '').replace(/<br\s*\/?>/gi, '').trim();
    }

    /**
     * Build the figure DOM from a list of items + caption. Mutates the
     * given figure (works for both create and edit paths).
     */
    populateFigure(figure, items, caption) {
        figure.className = 'redactix-gallery';
        figure.setAttribute('contenteditable', 'false');

        // Wipe existing children — simpler than diffing for this UX.
        figure.innerHTML = '';

        const grid = document.createElement('div');
        grid.className = 'redactix-gallery-grid';
        items.forEach(item => {
            // Санитизация — та же поверхность, что и у одиночной картинки:
            // src через sanitizeImageSrc, href через sanitizeUrl, rel через
            // composeLinkRel (noopener при _blank).
            const src = sanitizeImageSrc(item.url);
            if (!src) return;
            const img = document.createElement('img');
            img.setAttribute('src', src);
            if (item.alt) img.setAttribute('alt', item.alt);
            const linkUrl = item.linkUrl ? sanitizeUrl(item.linkUrl) : null;
            if (linkUrl) {
                const a = document.createElement('a');
                a.setAttribute('href', linkUrl);
                if (item.isBlank) a.setAttribute('target', '_blank');
                const rel = composeLinkRel({ nofollow: item.isNofollow, blank: item.isBlank });
                if (rel) a.setAttribute('rel', rel);
                a.appendChild(img);
                grid.appendChild(a);
            } else {
                grid.appendChild(img);
            }
        });
        figure.appendChild(grid);

        const safeCaption = sanitizeInlineHtml(caption || '');
        if (safeCaption) {
            const figcaption = document.createElement('figcaption');
            figcaption.setAttribute('contenteditable', 'true');
            figcaption.innerHTML = safeCaption;
            figure.appendChild(figcaption);
        }
    }

    // ---------- browse panel (mirrors Image module) ----------

    openBrowsePanel(container, onSelect) {
        container.innerHTML = `
            <div style="text-align: center; padding: 16px; color: var(--redactix-text-muted); font-size: 13px;">
                ${this.t('gallery.loadingImages')}
            </div>
        `;

        const fd = new FormData();
        fd.append('action', 'browse');
        fetch(this.browseUrl, { method: 'POST', body: fd })
            .then(r => r.json())
            .then(data => {
                if (!data.success) {
                    container.innerHTML = `<div style="color:var(--redactix-danger);padding:8px;font-size:13px;">${data.error || 'Failed to load images'}</div>`;
                    return;
                }
                if (!data.images || data.images.length === 0) {
                    container.innerHTML = `<div style="color:var(--redactix-text-muted);padding:16px;text-align:center;font-size:13px;">${this.t('gallery.noImages')}</div>`;
                    return;
                }
                this.renderBrowseGrid(container, data.images, onSelect);
            })
            .catch(() => {
                container.innerHTML = `<div style="color:var(--redactix-danger);padding:8px;font-size:13px;">Connection error</div>`;
            });
    }

    renderBrowseGrid(container, images, onSelect) {
        container.innerHTML = '';
        const grid = document.createElement('div');
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(80px, 1fr))';
        grid.style.gap = '6px';
        grid.style.maxHeight = '180px';
        grid.style.overflowY = 'auto';
        grid.style.padding = '8px';
        grid.style.background = 'var(--redactix-bg-secondary)';
        grid.style.borderRadius = '6px';
        grid.style.border = '1px solid var(--redactix-border)';

        images.forEach(img => {
            const tile = document.createElement('div');
            tile.style.position = 'relative';
            tile.style.aspectRatio = '1';
            tile.style.borderRadius = '4px';
            tile.style.overflow = 'hidden';
            tile.style.cursor = 'pointer';
            tile.style.border = '2px solid transparent';
            const preview = document.createElement('img');
            preview.src = img.src;
            preview.style.width = '100%';
            preview.style.height = '100%';
            preview.style.objectFit = 'cover';
            tile.title = img.filename;
            tile.appendChild(preview);
            tile.addEventListener('mouseenter', () => { tile.style.borderColor = 'var(--redactix-primary)'; });
            tile.addEventListener('mouseleave', () => { tile.style.borderColor = 'transparent'; });
            tile.addEventListener('click', () => onSelect(img));
            grid.appendChild(tile);
        });

        container.appendChild(grid);
    }
}
