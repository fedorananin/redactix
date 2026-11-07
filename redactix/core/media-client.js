// Client for the upload / browse / delete protocol spoken by
// redactix_images.php (and any custom backend implementing it).
//
// Image, Video and Gallery used to carry six copies of "POST a FormData,
// check the status, parse JSON, read success/error". They now all go through
// here, and so does the sanitisation of what the server sends back: a
// backend is not a trusted source of markup (a browse listing shows whatever
// files are on disk, a custom backend's `error` is often an echo of user
// input), so every field is reduced to a safe value in ONE place.
//
// Every function resolves (never rejects) to
//   { ok: true,  data }                       on success
//   { ok: false, code, error, status }        on failure
// where `code` is one of: 'aborted' | 'network' | 'http' | 'parse' |
// 'tooLarge' | 'server', and `error` is the server's own message (plain
// text, may be empty). errorMessage() turns that into a translated string.

import { sanitizeImageSrc, sanitizeSrcset, sanitizeUrl, sanitizeInlineHtml } from './dom-utils.js';

const MAX_TEXT = 500;
const MAX_URL = 4096;

function text(value, max = MAX_TEXT) {
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    return typeof value === 'string' ? value.slice(0, max) : '';
}

/**
 * Reduce one media record from the server to safe values. Returns null if
 * its src is unusable. `type` is 'image' or 'video'.
 */
export function cleanMediaRecord(raw, type = 'image') {
    if (!raw || typeof raw !== 'object') return null;
    const srcRaw = text(raw.src, MAX_URL);
    const src = type === 'video'
        ? sanitizeUrl(srcRaw, { allowedSchemes: ['http', 'https'] })
        : sanitizeImageSrc(srcRaw);
    if (!src) return null;
    return {
        src,
        srcset: type === 'image' ? sanitizeSrcset(text(raw.srcset, MAX_URL)) : '',
        alt: text(raw.alt),
        title: text(raw.title),
        // Captions are the only field allowed to carry markup — inline only.
        caption: sanitizeInlineHtml(text(raw.caption, 5000)),
        filename: text(raw.filename, 255),
        size: text(raw.size, 50)
    };
}

function interpret(status, body) {
    let json = null;
    try { json = JSON.parse(body); } catch (e) { /* handled below */ }
    const serverError = json && typeof json === 'object' ? text(json.error) : '';

    if (status === 413) return { ok: false, code: 'tooLarge', status, error: serverError };
    if (!json || typeof json !== 'object') {
        return { ok: false, code: status >= 200 && status < 300 ? 'parse' : 'http', status, error: '' };
    }
    if (json.success !== true) {
        const code = json.code === 'tooLarge' ? 'tooLarge' : 'server';
        return { ok: false, code, status, error: serverError };
    }
    if (status < 200 || status >= 300) return { ok: false, code: 'http', status, error: serverError };
    return { ok: true, json, status };
}

async function post(url, formData, signal) {
    let response;
    try {
        response = await fetch(url, { method: 'POST', body: formData, signal });
    } catch (err) {
        return { ok: false, code: err && err.name === 'AbortError' ? 'aborted' : 'network', status: 0, error: '' };
    }
    let body = '';
    try { body = await response.text(); } catch (err) {
        return { ok: false, code: err && err.name === 'AbortError' ? 'aborted' : 'network', status: response.status, error: '' };
    }
    return interpret(response.status, body);
}

/**
 * Upload one file. Uses XHR so progress is reported; abort via `signal`.
 * @param {string} url
 * @param {'image'|'video'} field  Form field name — also the media type.
 * @param {File|Blob} file
 * @param {Object} [opts]
 * @param {AbortSignal} [opts.signal]
 * @param {Function} [opts.onProgress]  Called with a fraction 0..1.
 */
export function upload(url, field, file, { signal, onProgress } = {}) {
    const type = field === 'video' ? 'video' : 'image';
    return new Promise(resolve => {
        let settled = false;
        const xhr = new XMLHttpRequest();
        const onAbort = () => {
            try { xhr.abort(); } catch (e) { /* ignore */ }
            finish({ ok: false, code: 'aborted', status: 0, error: '' });
        };
        const finish = (result) => {
            if (settled) return;
            settled = true;
            if (signal) signal.removeEventListener('abort', onAbort);
            resolve(result);
        };

        if (signal && signal.aborted) {
            finish({ ok: false, code: 'aborted', status: 0, error: '' });
            return;
        }
        if (signal) signal.addEventListener('abort', onAbort);

        const fd = new FormData();
        fd.append(field, file, file && file.name ? file.name : field);

        xhr.open('POST', url);
        if (onProgress && xhr.upload) {
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable && e.total > 0) {
                    try { onProgress(e.loaded / e.total); } catch (err) { /* UI only */ }
                }
            });
        }
        xhr.onload = () => {
            const result = interpret(xhr.status, xhr.responseText || '');
            if (!result.ok) { finish(result); return; }
            const data = cleanMediaRecord(result.json, type);
            finish(data ? { ok: true, data } : { ok: false, code: 'parse', status: xhr.status, error: '' });
        };
        xhr.onerror = () => finish({ ok: false, code: 'network', status: 0, error: '' });
        xhr.onabort = () => finish({ ok: false, code: 'aborted', status: 0, error: '' });
        xhr.send(fd);
    });
}

/**
 * List uploaded files.
 * @param {string} url
 * @param {'image'|'video'} type
 * @param {Object} [opts]  { offset, limit, signal } — offset/limit are only
 *        sent when given (backends without paging simply return everything).
 * @returns {Promise} data = { items, allowDelete, total|null, offset, limit|null }
 */
export async function browse(url, type = 'image', { offset, limit, signal } = {}) {
    const fd = new FormData();
    fd.append('action', 'browse');
    fd.append('type', type);
    if (Number.isFinite(offset)) fd.append('offset', String(offset));
    if (Number.isFinite(limit)) fd.append('limit', String(limit));
    const result = await post(url, fd, signal);
    if (!result.ok) return result;
    const json = result.json;
    const list = type === 'video' ? json.videos : json.images;
    const items = (Array.isArray(list) ? list : [])
        .map(item => cleanMediaRecord(item, type))
        .filter(Boolean);
    return {
        ok: true,
        data: {
            items,
            allowDelete: json.allowDelete === true,
            total: Number.isFinite(json.total) ? json.total : null,
            offset: Number.isFinite(json.offset) ? json.offset : (offset || 0),
            limit: Number.isFinite(json.limit) ? json.limit : null
        }
    };
}

/** Delete an uploaded file by name. */
export async function remove(url, type = 'image', filename = '', { signal } = {}) {
    const fd = new FormData();
    fd.append('action', 'delete');
    fd.append('type', type);
    fd.append('file', String(filename));
    const result = await post(url, fd, signal);
    if (!result.ok) return result;
    return { ok: true, data: {} };
}

/** Human-readable (translated) text for a failed result. '' for aborts. */
export function errorMessage(result, t) {
    if (!result || result.ok) return '';
    switch (result.code) {
        case 'aborted': return '';
        case 'tooLarge': return result.error || t('upload.tooLarge');
        case 'network': return t('upload.connectionError');
        case 'parse': return t('upload.invalidResponse');
        case 'http': return t('upload.serverError') + (result.status ? ` (${result.status})` : '');
        default: return result.error || t('upload.error');
    }
}
