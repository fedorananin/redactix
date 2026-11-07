// Shared UI for the media modules (Image, Gallery, Video): upload
// placeholders in the editor, the modal's drop zone, the "or enter URL"
// divider and the "choose from uploaded" browse panel.
//
// Every string that may come from a server (file names, sizes, error
// messages) is written with textContent — never interpolated into HTML.
// Styling lives in Redactix.css.

import { SPINNER_SVG } from './form-helpers.js';
import { browse, remove, errorMessage } from '../core/media-client.js';

const UPLOAD_ICON_SVG = '<svg class="redactix-upload-icon" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>';
const ERROR_ICON_SVG = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';

// ---------------------------------------------------------------------
// In-editor upload placeholder
// ---------------------------------------------------------------------

/**
 * Block shown in the editor while a dropped / pasted file uploads. Marked
 * data-redactix-ui (and classed .redactix-upload-placeholder), so it never
 * reaches saved HTML or undo snapshots.
 */
export function createUploadPlaceholder(label) {
    const placeholder = document.createElement('figure');
    placeholder.className = 'redactix-upload-placeholder';
    placeholder.setAttribute('data-redactix-ui', '');
    placeholder.contentEditable = 'false';
    const box = document.createElement('div');
    box.className = 'redactix-upload-loading';
    box.innerHTML = SPINNER_SVG; // static markup
    const span = document.createElement('span');
    span.textContent = label;
    box.appendChild(span);
    placeholder.appendChild(box);
    return placeholder;
}

/** Update the placeholder's label (progress). */
export function setPlaceholderLabel(placeholder, label) {
    const span = placeholder.querySelector('.redactix-upload-loading > span');
    if (span) span.textContent = label;
}

/** Turn a placeholder into an error box with a "Remove" button. */
export function showPlaceholderError(placeholder, message, removeLabel, onRemove) {
    placeholder.replaceChildren();
    const box = document.createElement('div');
    box.className = 'redactix-upload-error';
    box.innerHTML = ERROR_ICON_SVG; // static markup
    const span = document.createElement('span');
    span.textContent = message; // server text — never HTML
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'redactix-upload-error-close';
    btn.textContent = removeLabel;
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        placeholder.remove();
        if (onRemove) onRemove();
    });
    box.append(span, btn);
    placeholder.appendChild(box);
}

// ---------------------------------------------------------------------
// Modal pieces
// ---------------------------------------------------------------------

function matchesAccept(file, accept) {
    if (!accept) return true;
    const prefix = accept.replace(/\*$/, '');
    return (file.type || '').startsWith(prefix);
}

/**
 * Dashed "click or drop a file" zone.
 * @param {Object} o
 * @param {string} o.title
 * @param {string} o.hint
 * @param {string} o.accept     e.g. 'image/*'
 * @param {boolean} [o.multiple]
 * @param {Function} o.onFiles  Called with an array of accepted files.
 * @returns {{ element, input, setStatus(text, kind?) }}
 *          kind: 'progress' | 'success' | 'error' | '' (plain)
 */
export function createUploadZone({ title, hint, accept, multiple = false, onFiles }) {
    const element = document.createElement('div');
    element.className = 'redactix-upload-group';

    const label = document.createElement('label');
    label.className = 'redactix-upload-label';
    label.innerHTML = UPLOAD_ICON_SVG; // static markup
    const titleEl = document.createElement('div');
    titleEl.className = 'redactix-upload-title';
    titleEl.textContent = title;
    const hintEl = document.createElement('div');
    hintEl.className = 'redactix-upload-hint';
    hintEl.textContent = hint || '';

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept || '';
    input.multiple = !!multiple;
    input.hidden = true;
    label.append(titleEl, hintEl, input);

    const status = document.createElement('div');
    status.className = 'redactix-upload-status';
    status.setAttribute('role', 'status');

    element.append(label, status);

    const deliver = (fileList) => {
        const files = Array.from(fileList || []).filter(f => matchesAccept(f, accept));
        if (files.length) onFiles(multiple ? files : files.slice(0, 1));
    };

    input.addEventListener('change', () => {
        deliver(input.files);
        input.value = ''; // picking the same file again must fire change
    });
    element.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        element.classList.add('is-dragover');
    });
    element.addEventListener('dragleave', (e) => {
        if (element.contains(e.relatedTarget)) return;
        element.classList.remove('is-dragover');
    });
    element.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        element.classList.remove('is-dragover');
        if (e.dataTransfer) deliver(e.dataTransfer.files);
    });

    const setStatus = (text, kind = '') => {
        status.className = 'redactix-upload-status' + (kind ? ' is-' + kind : '');
        status.replaceChildren();
        if (!text) return;
        if (kind === 'progress') status.insertAdjacentHTML('afterbegin', SPINNER_SVG);
        status.appendChild(document.createTextNode(text));
    };

    return { element, input, setStatus };
}

/** "— or enter URL —" divider. */
export function createOrDivider(text) {
    const div = document.createElement('div');
    div.className = 'redactix-or-divider';
    const span = document.createElement('span');
    span.textContent = text;
    div.appendChild(span);
    return div;
}

// ---------------------------------------------------------------------
// Browse panel
// ---------------------------------------------------------------------

/**
 * Generic "choose from uploaded" panel: a button that turns into a grid of
 * tiles (with paging, optional delete) and back.
 *
 * @param {Object} o
 * @param {Object} o.labels  { button, loading, empty, close, loadMore, deleteTooltip }
 * @param {string} [o.variant='image']  Tile layout ('image' | 'video').
 * @param {boolean} [o.withButton=true] Show the opener button when closed
 *        (false: the caller toggles open()/close() from its own control).
 * @param {boolean} [o.stayOpen=false]  Keep the grid open after a pick.
 * @param {number} [o.pageSize=60]
 * @param {Function} o.fetchPage   ({ offset, limit, signal }) → media-client result
 * @param {Function} o.renderTile  (item, whenVisible) → Element (tile preview)
 * @param {boolean} [o.allowDelete=false]  Client-side permission; the
 *        server's own allowDelete must ALSO be true for the button to show.
 * @param {Function} [o.confirmDelete]  item → boolean
 * @param {Function} [o.deleteItem]     item → Promise<result>
 * @param {Function} o.selectedText    item → string
 * @param {Function} o.errorText       result → string
 * @param {Function} o.onSelect        item → void
 * @returns {{ element, open, close, destroy, isOpen }}
 */
export function createBrowsePanel(o) {
    const labels = o.labels || {};
    const pageSize = o.pageSize || 60;
    const element = document.createElement('div');
    element.className = 'redactix-browse';

    let controller = null;
    let timer = null;
    let observer = null;
    let open = false;

    const reset = () => {
        if (controller) controller.abort();
        controller = null;
        if (timer) clearTimeout(timer);
        timer = null;
        if (observer) observer.disconnect();
        observer = null;
    };

    const makeButton = (text, className, onClick) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = className;
        btn.textContent = text;
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            onClick();
        });
        return btn;
    };

    const status = (text, kind = '') => {
        const div = document.createElement('div');
        div.className = 'redactix-browse-status' + (kind ? ' is-' + kind : '');
        div.textContent = text;
        return div;
    };

    const close = () => {
        reset();
        open = false;
        element.replaceChildren();
        if (o.withButton !== false) {
            element.appendChild(makeButton(labels.button, 'redactix-browse-btn', () => load()));
        }
    };

    const whenVisible = (el, cb) => {
        if (typeof IntersectionObserver !== 'function') { cb(); return; }
        if (!observer) {
            observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (!entry.isIntersecting) return;
                    observer.unobserve(entry.target);
                    const fn = entry.target._redactixOnVisible;
                    delete entry.target._redactixOnVisible;
                    if (fn) fn();
                });
            }, { rootMargin: '100px' });
        }
        el._redactixOnVisible = cb;
        observer.observe(el);
    };

    const renderTile = (item, serverAllowsDelete) => {
        const tile = document.createElement('div');
        tile.className = 'redactix-browse-tile';
        tile.tabIndex = 0;
        tile.setAttribute('role', 'button');
        tile.title = item.filename + (item.size ? '\n' + item.size : '');
        const preview = o.renderTile(item, (cb) => whenVisible(tile, cb));
        if (preview) tile.appendChild(preview);

        const info = document.createElement('div');
        info.className = 'redactix-browse-info';
        info.textContent = o.variant === 'video' && item.filename ? `${item.filename} · ${item.size}` : item.size;
        tile.appendChild(info);

        const pick = () => {
            o.onSelect(item);
            if (o.stayOpen) {
                tile.classList.add('is-picked');
                return;
            }
            reset();
            open = false;
            element.replaceChildren(status(o.selectedText(item), 'success'));
            timer = setTimeout(close, 1500);
        };
        tile.addEventListener('click', pick);
        tile.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation(); // Enter must not also "save" the modal
                pick();
            }
        });

        if (o.allowDelete && serverAllowsDelete && o.deleteItem) {
            const del = document.createElement('button');
            del.type = 'button';
            del.className = 'redactix-browse-delete';
            del.textContent = '×';
            del.title = labels.deleteTooltip || '';
            del.setAttribute('aria-label', labels.deleteTooltip || '×');
            del.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (o.confirmDelete && !o.confirmDelete(item)) return;
                del.disabled = true;
                const result = await o.deleteItem(item);
                if (result.ok) {
                    load();
                } else {
                    del.disabled = false;
                    const err = element.querySelector(':scope > .redactix-browse-status.is-error');
                    const line = status(o.errorText(result), 'error');
                    if (err) err.replaceWith(line);
                    else element.insertBefore(line, element.firstChild);
                }
            });
            tile.appendChild(del);
        }
        return tile;
    };

    async function load() {
        reset();
        open = true;
        const ctrl = new AbortController();
        controller = ctrl;
        const loading = status(labels.loading);
        loading.insertAdjacentHTML('afterbegin', SPINNER_SVG);
        element.replaceChildren(loading);

        const result = await o.fetchPage({ offset: 0, limit: pageSize, signal: ctrl.signal });
        if (controller !== ctrl) return; // superseded / closed meanwhile
        controller = null;

        const closeBtn = makeButton(labels.close, 'redactix-browse-close', close);
        if (!result.ok) {
            element.replaceChildren(status(o.errorText(result), 'error'), closeBtn);
            return;
        }
        const { items, allowDelete, total } = result.data;
        if (!items.length) {
            element.replaceChildren(status(labels.empty), closeBtn);
            return;
        }

        const grid = document.createElement('div');
        grid.className = 'redactix-browse-grid' + (o.variant === 'video' ? ' is-video' : '');
        items.forEach(item => grid.appendChild(renderTile(item, allowDelete)));
        element.replaceChildren(grid);

        let loaded = items.length;
        if (total !== null && loaded < total) {
            const more = makeButton(labels.loadMore, 'redactix-browse-more', async () => {
                more.disabled = true;
                const c = new AbortController();
                controller = c;
                const page = await o.fetchPage({ offset: loaded, limit: pageSize, signal: c.signal });
                if (controller !== c) return;
                controller = null;
                more.disabled = false;
                if (!page.ok) {
                    more.before(status(o.errorText(page), 'error'));
                    return;
                }
                page.data.items.forEach(item => grid.appendChild(renderTile(item, page.data.allowDelete)));
                loaded += page.data.items.length;
                if (!page.data.items.length || (page.data.total !== null && loaded >= page.data.total)) more.remove();
            });
            element.appendChild(more);
        }
        element.appendChild(closeBtn);
    }

    close();

    return {
        element,
        open: () => load(),
        close,
        destroy: () => { reset(); open = false; },
        get isOpen() { return open; }
    };
}

/**
 * createBrowsePanel wired to the Redactix media protocol for `type`
 * ('image' | 'video'), with the module's translations.
 *
 * @param {Object} o
 * @param {Function} o.t        Translator (module.t bound).
 * @param {'image'|'video'} o.type
 * @param {string} o.url        browseUrl / videoBrowseUrl
 * @param {boolean} [o.allowDelete]  allowImageDelete / allowVideoDelete
 * @param {Function} o.onSelect
 * @param {boolean} [o.withButton]
 * @param {boolean} [o.stayOpen]
 * @param {string} [o.buttonLabel]
 */
export function createMediaBrowsePanel({ t, type = 'image', url, allowDelete = false, onSelect, withButton = true, stayOpen = false, buttonLabel }) {
    const ns = type === 'video' ? 'video' : 'image';
    return createBrowsePanel({
        variant: type,
        withButton,
        stayOpen,
        labels: {
            button: buttonLabel || t(ns + '.chooseFromUploaded'),
            loading: t(type === 'video' ? 'video.loadingVideos' : 'image.loadingImages'),
            empty: t(type === 'video' ? 'video.noVideos' : 'image.noImages'),
            close: t(ns + '.closeGallery'),
            loadMore: t('upload.loadMore'),
            deleteTooltip: t(ns + '.deleteTooltip')
        },
        fetchPage: ({ offset, limit, signal }) => browse(url, type, { offset, limit, signal }),
        renderTile: (item, whenVisible) => {
            if (type === 'video') {
                // One <video preload=metadata> per file used to fire a
                // request for every video at once. Load only when visible.
                const video = document.createElement('video');
                video.muted = true;
                video.preload = 'none';
                video.playsInline = true;
                whenVisible(() => {
                    video.preload = 'metadata';
                    video.src = item.src;
                });
                return video;
            }
            const img = document.createElement('img');
            img.loading = 'lazy';
            img.decoding = 'async';
            img.alt = item.alt || item.filename || '';
            img.src = item.src;
            return img;
        },
        allowDelete,
        confirmDelete: (item) => window.confirm(t(ns + '.confirmDelete', { filename: item.filename })),
        deleteItem: (item) => remove(url, type, item.filename),
        selectedText: (item) => `${t(type === 'video' ? 'video.videoSelected' : 'image.imageSelected')}: ${item.filename}`,
        errorText: (result) => errorMessage(result, t),
        onSelect
    });
}
