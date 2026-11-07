// Minimal zero-dependency test helpers for tests/regression.html.
import Redactix from '../redactix/Redactix.js';

export const results = [];
window.__testResults = results;

let counter = 0;
const created = [];

/** Run one test case; failures are recorded, never thrown. */
export async function test(name, fn) {
    try {
        await fn();
        results.push({ name, ok: true });
    } catch (err) {
        results.push({ name, ok: false, detail: (err && err.stack) || String(err) });
    } finally {
        // Tear down editors created by the test.
        while (created.length) {
            const inst = created.pop();
            try { if (!inst.destroyed) inst.destroy(); } catch (e) { /* ignore */ }
        }
        document.querySelectorAll('textarea.redactix-test').forEach(t => t.remove());
        // Close anything left open.
        document.querySelectorAll('.redactix-modal-overlay.is-open').forEach(o => o.classList.remove('is-open'));
    }
}

export function assert(cond, message = 'assertion failed') {
    if (!cond) throw new Error(message);
}

export function eq(actual, expected, message = '') {
    if (actual !== expected) {
        throw new Error(`${message}\n         expected: ${JSON.stringify(expected)}\n         actual:   ${JSON.stringify(actual)}`);
    }
}

export function includes(haystack, needle, message = '') {
    if (!String(haystack).includes(needle)) {
        throw new Error(`${message}\n         expected to contain: ${JSON.stringify(needle)}\n         in: ${JSON.stringify(haystack)}`);
    }
}

export function excludes(haystack, needle, message = '') {
    if (String(haystack).includes(needle)) {
        throw new Error(`${message}\n         expected NOT to contain: ${JSON.stringify(needle)}\n         in: ${JSON.stringify(haystack)}`);
    }
}

/**
 * Create an editor on a fresh textarea.
 * @returns {RedactixInstance}
 */
export function makeEditor(html = '', options = {}, { inForm = false } = {}) {
    const cls = 'redactix-test-' + (++counter);
    const ta = document.createElement('textarea');
    ta.className = 'redactix-test ' + cls;
    ta.value = html;
    let host = document.getElementById('sandbox');
    if (inForm) {
        const form = document.createElement('form');
        form.addEventListener('submit', e => e.preventDefault());
        host.appendChild(form);
        host = form;
    }
    host.appendChild(ta);
    const r = new Redactix({ selector: '.' + cls, ...options });
    const inst = ta.redactix;
    if (inst) created.push(inst);
    return inst;
}

export const frame = () => new Promise(r => requestAnimationFrame(() => r()));
export const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/** Collapse the caret at (node, offset). */
export function caret(node, offset = 0) {
    const r = document.createRange();
    r.setStart(node, offset);
    r.collapse(true);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
}

/** Select a range between two (node, offset) points. */
export function select(startNode, startOffset, endNode, endOffset) {
    const r = document.createRange();
    r.setStart(startNode, startOffset);
    r.setEnd(endNode, endOffset);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
}

/** First text node under `el` containing `text`. */
export function textNode(el, text) {
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    while (w.nextNode()) {
        if (w.currentNode.data.includes(text)) return w.currentNode;
    }
    throw new Error('text node not found: ' + text);
}

/** Dispatch a paste event carrying the given HTML / text. */
export function paste(target, { html = '', text = '' } = {}) {
    const dt = new DataTransfer();
    if (html) dt.setData('text/html', html);
    if (text) dt.setData('text/plain', text);
    const ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
    target.dispatchEvent(ev);
}

export function key(target, keyName, opts = {}) {
    const ev = new KeyboardEvent('keydown', { key: keyName, bubbles: true, cancelable: true, ...opts });
    target.dispatchEvent(ev);
    return ev;
}

/** Type text at the caret via the native editing command (fires input). */
export function type(text) {
    document.execCommand('insertText', false, text);
}

export function done() {
    window.__testsDone = true;
    const out = document.getElementById('out');
    if (out) {
        const failed = results.filter(r => !r.ok);
        out.textContent = results.map(r => (r.ok ? 'ok   ' : 'FAIL ') + r.name + (r.ok ? '' : '\n      ' + r.detail)).join('\n') +
            `\n\n${results.length - failed.length}/${results.length} passed`;
    }
}
