import { isAtomicBlock, isBlockEmpty, sanitizeUrl, sanitizeImageSrc, sanitizeRel, sanitizeTarget, normalizeInlineSynonyms, parseHtmlInert, sanitizeLoadedRoot, normalizeWhitespace, FORBIDDEN_TAGS } from './dom-utils.js';
import { getContainerRule, findHostChild, getEditingContext, isBlockLike, TEXT_BLOCK_TAGS, HEADING_TAGS } from './schema.js';

// Tags removed from pasted HTML on top of the shared FORBIDDEN_TAGS baseline.
// iframe / video survive only when a module's preparePaste() vouched for them.
const PASTE_EXTRA_FORBIDDEN = ['iframe', 'video', 'audio', 'source', 'track', 'colgroup', 'canvas', 'map', 'area', 'dialog'];

// Attributes kept on pasted elements (URL / rel / target are filtered below).
const PASTE_ALLOWED_ATTRIBUTES = ['href', 'src', 'alt', 'title', 'colspan', 'rowspan', 'rel', 'target', 'download'];

const BLOCK_SELECTOR = 'p, h1, h2, h3, h4, h5, h6, blockquote, aside, figure, pre, table, ul, ol, hr, div';

export default class Editor {
    constructor(instance) {
        this.instance = instance;
        this.el = instance.editorEl;

        this.bindEvents();
        this.setupParagraphSeparator();
        this.setupPlaceholder();
    }

    /**
     * `defaultParagraphSeparator` is a document-wide setting: setting it once
     * globally changed how every other contenteditable on the host page
     * behaves. Apply it only while this editor has focus.
     */
    setupParagraphSeparator() {
        let previous = null;
        this.el.addEventListener('focusin', () => {
            try {
                previous = document.queryCommandValue('defaultParagraphSeparator') || null;
                document.execCommand('defaultParagraphSeparator', false, 'p');
            } catch (e) { /* unsupported — harmless */ }
        });
        this.el.addEventListener('focusout', (e) => {
            if (e.relatedTarget && this.el.contains(e.relatedTarget)) return;
            if (previous && previous !== 'p') {
                try { document.execCommand('defaultParagraphSeparator', false, previous); } catch (err) { /* ignore */ }
            }
        });
    }

    setupPlaceholder() {
        this.el.dataset.placeholder = this.instance.t('editor.placeholder');
        this.updatePlaceholder();
    }

    updatePlaceholder() {
        const isEmpty = !this.el.textContent.trim() && !this.el.querySelector('img, iframe, hr, table, video');
        this.el.classList.toggle('is-empty', isEmpty);
    }

    /** Fire a synthetic input event after a manual DOM edit of typed text. */
    notifyInput(data = null, inputType = 'insertText') {
        let event;
        try {
            event = new InputEvent('input', { bubbles: true, inputType, data });
        } catch (e) {
            event = new Event('input', { bubbles: true });
        }
        this.el.dispatchEvent(event);
    }

    // Guarantees proper structure of the editor (at least one paragraph,
    // no naked inline content at root level). Runs on every input, so it
    // works on direct children only — no innerHTML serialisation.
    ensureEditorStructure() {
        const el = this.el;

        // Completely empty, or only <br> / whitespace left.
        let onlyTrivia = true;
        for (const n of el.childNodes) {
            if (n.nodeType === Node.TEXT_NODE ? n.data.trim() : n.nodeName !== 'BR') {
                onlyTrivia = false;
                break;
            }
        }
        if (onlyTrivia) {
            el.innerHTML = '<p><br></p>';
            this.placeCaret(el.firstChild, 0);
            return;
        }

        // One empty non-P block left (select-all + delete) → paragraph.
        if (el.children.length === 1 && el.childNodes.length === 1) {
            const child = el.children[0];
            const isEmpty = !child.textContent.trim() && !child.querySelector('*:not(br)');
            if (isEmpty && ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'ASIDE'].includes(child.tagName)) {
                const p = document.createElement('p');
                p.innerHTML = '<br>';
                el.replaceChild(p, child);
                this.placeCaret(p, 0);
                return;
            }
        }

        this.wrapRootInlineRuns();
    }

    /**
     * Wrap runs of naked text / inline elements sitting directly in the
     * editor root into <p>. Happens after "delete everything and type", or
     * when the caret was left between two blocks.
     */
    wrapRootInlineRuns() {
        const el = this.el;
        const isInlineNode = (n) => n.nodeType === Node.TEXT_NODE ||
            (n.nodeType === Node.ELEMENT_NODE && !isBlockLike(n) && !n.classList.contains('redactix-separator'));

        let hasNaked = false;
        for (const n of el.childNodes) {
            if (n.nodeType === Node.TEXT_NODE ? n.data.trim() : (isInlineNode(n) && n.nodeName !== 'BR')) {
                hasNaked = true;
                break;
            }
        }
        if (!hasNaked) return;

        const sel = window.getSelection();
        let savedNode = null;
        let savedOffset = 0;
        if (sel.rangeCount) {
            const range = sel.getRangeAt(0);
            savedNode = range.startContainer;
            savedOffset = range.startOffset;
        }

        let run = [];
        const flush = () => {
            const meaningful = run.some(n => n.nodeType === Node.TEXT_NODE ? n.data.trim() : n.nodeName !== 'BR');
            if (meaningful) {
                const p = document.createElement('p');
                el.insertBefore(p, run[0]);
                run.forEach(n => p.appendChild(n));
            } else {
                run.forEach(n => { if (n.nodeType === Node.TEXT_NODE) n.remove(); });
            }
            run = [];
        };
        Array.from(el.childNodes).forEach(n => {
            if (isInlineNode(n)) run.push(n);
            else if (run.length) flush();
        });
        if (run.length) flush();

        if (savedNode && el.contains(savedNode)) {
            try {
                const r = document.createRange();
                r.setStart(savedNode, Math.min(savedOffset,
                    savedNode.nodeType === Node.TEXT_NODE ? savedNode.length : savedNode.childNodes.length));
                r.collapse(true);
                sel.removeAllRanges();
                sel.addRange(r);
            } catch (e) { /* keep whatever selection we have */ }
        }
    }

    // Ensure there is an empty paragraph at the end of the editor
    // if the last element is an uneditable block (figure, table, hr, etc.)
    ensureTrailingParagraph() {
        const lastChild = this.el.lastElementChild;
        if (lastChild && isAtomicBlock(lastChild)) {
            const p = document.createElement('p');
            p.innerHTML = '<br>';
            this.el.appendChild(p);
        }
    }

    placeCaret(node, offset = 0) {
        if (!node) return;
        const range = document.createRange();
        range.setStart(node, offset);
        range.collapse(true);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
    }

    bindEvents() {
        // Observer for any DOM changes (the most reliable synchronization method)
        this.observer = new MutationObserver(() => {
            // Any structural edit gets a landing <p> after a trailing atomic
            // block (kept out of _doSync so getContent() never mutates DOM).
            this.ensureTrailingParagraph();
            this.instance.sync();
            this.updatePlaceholder();
        });

        this.observer.observe(this.el, {
            childList: true,
            subtree: true,
            characterData: true
        });

        // Disconnect observer when the instance is destroyed.
        if (this.instance.onDestroy) {
            this.instance.onDestroy(() => this.observer.disconnect());
        }

        // Completely disable native HTML5 drag for the editor's content:
        // otherwise, the browser can drag <img> inside contenteditable
        // and drop them anywhere (up to inserting <img> inside <h2>).
        // Block dragging is implemented via mousedown in BlockControl.
        this.el.addEventListener('dragstart', (e) => {
            e.preventDefault();
        });

        // Synchronization on input (as an addition for instant feedback)
        this.el.addEventListener('input', () => {
            this.ensureEditorStructure();
            this.instance.sync();
            this.updatePlaceholder();
        });

        // Paste handling
        this.el.addEventListener('paste', (e) => {
            e.preventDefault();
            this.handlePaste(e);
        });

        // Drop handling. Registered unconditionally and BEFORE the modules,
        // so foreign markup dragged into the editor can never reach the DOM
        // unsanitised.
        this.el.addEventListener('drop', (e) => {
            this.handleDrop(e);
        });

        // Keydown handling
        this.el.addEventListener('keydown', (e) => {
            // During IME composition (Japanese/Korean/Chinese input,
            // many Android keyboards) space and Enter control candidate selection —
            // custom handlers break composition.
            if (e.isComposing || e.keyCode === 229) return;

            // Keys pressed on a focused control inside the editor (the
            // floating Edit buttons of videos / galleries / embeds) are not
            // text editing — Space must activate the button, not insert text.
            if (!e.target || !e.target.isContentEditable) return;

            // Shift+Enter inside aside/blockquote — insert <br> explicitly
            if (e.key === 'Enter' && e.shiftKey) {
                if (this.handleShiftEnter(e)) {
                    return;
                }
            }

            // Enter in empty blocks to exit lists/quotes
            if (e.key === 'Enter' && !e.shiftKey) {
                if (this.handleEnterKey(e)) {
                    return;
                }
            }

            // Backspace at the beginning of a block to convert
            if (e.key === 'Backspace') {
                if (this.handleBackspace(e)) {
                    return;
                }
            }

            // Delete (forward) — protect atomic blocks (figure / pre / table /
            // hr / video-wrapper / separator) from being destroyed when the
            // user is just trying to remove an adjacent empty paragraph.
            if (e.key === 'Delete') {
                if (this.handleDelete(e)) {
                    return;
                }
            }

            // Space - smart handling
            if (e.key === ' ' && !e.ctrlKey && !e.metaKey && !e.altKey) {
                e.preventDefault();
                this.handleSpace();
            }
        });
    }

    // ------------------------------------------------------------------
    // Paste / drop
    // ------------------------------------------------------------------

    handlePaste(e) {
        const clipboardData = e.clipboardData || window.clipboardData;
        if (!clipboardData) return;

        const html = clipboardData.getData('text/html');
        const text = clipboardData.getData('text/plain');
        if (!html && !text) return;

        // One paste = one undo step.
        this.instance.transact(() => {
            if (html) {
                this.insertSanitizedHtml(html, 'paste');
            } else {
                this.insertPlainText(text);
            }
        });
        this.updatePlaceholder();
    }

    /**
     * Drop is a second, entirely independent way for foreign markup to reach
     * the editor: dragging a selection out of another page makes the browser
     * insert its HTML natively, never touching the paste handler. So every
     * drop is cancelled and re-inserted through the same sanitiser as paste.
     *
     * File drops stay with the Image / Video modules — their listeners sit on
     * the same element and run after this one. We still preventDefault for
     * them, so that when no module is listening (no uploadUrl, or lite mode)
     * the browser can't navigate away to the dropped file.
     */
    handleDrop(e) {
        const dt = e.dataTransfer;
        if (!dt) return;

        e.preventDefault();

        // Files are somebody else's job.
        if (dt.files && dt.files.length > 0) return;

        const html = dt.getData('text/html');
        const text = dt.getData('text/plain');
        if (!html && !text) return;

        // Land the caret where the content was actually dropped, then reuse
        // the paste insertion path verbatim.
        this.el.focus();
        this.placeCaretAtPoint(e.clientX, e.clientY);

        this.instance.transact(() => {
            if (html) {
                this.insertSanitizedHtml(html, 'drop');
            } else {
                this.insertPlainText(text);
            }
        });
        this.updatePlaceholder();
    }

    /** Collapse the selection to the caret position under (x, y). */
    placeCaretAtPoint(x, y) {
        let range = null;

        if (document.caretRangeFromPoint) {
            range = document.caretRangeFromPoint(x, y);
        } else if (document.caretPositionFromPoint) {
            const pos = document.caretPositionFromPoint(x, y);
            if (pos) {
                range = document.createRange();
                range.setStart(pos.offsetNode, pos.offset);
            }
        }

        // Outside the editable area (or unsupported) — keep whatever
        // selection we already have.
        if (!range || !this.el.contains(range.startContainer)) return false;

        range.collapse(true);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        return true;
    }

    /** Context of the current caret (see schema.getEditingContext). */
    getCaretContext() {
        const sel = window.getSelection();
        if (!sel.rangeCount) return getEditingContext(null, this.el);
        return getEditingContext(sel.getRangeAt(0).startContainer, this.el);
    }

    /**
     * Sanitize a foreign HTML string and insert it at the caret. Shared by
     * paste and drop. The sanitized tree is adopted directly from the inert
     * document it was cleaned in — no serialise / re-parse round trip, which
     * is where mutation-XSS lives.
     */
    insertSanitizedHtml(rawHtml, source = 'paste') {
        const root = this.sanitizePasteRoot(rawHtml);
        if (!root.firstChild) return;

        const hasBlocks = !!root.querySelector(BLOCK_SELECTOR);
        const ctx = this.getCaretContext();

        if (hasBlocks && (ctx.inFigcaption || ctx.inTable || ctx.inPre)) {
            // Captions and table cells hold inline content only.
            this.insertPlainText(this.blockTextOf(root));
            return;
        }

        if (!hasBlocks) {
            // Inline-only content — insertHTML keeps native undo/caret
            // behaviour and merges into the current paragraph.
            document.execCommand('insertHTML', false, root.innerHTML);
        } else {
            this.insertBlockContent(root);
        }

        this.instance.setupContent();
        this.instance.emit('contentInserted', { source });
    }

    /** Text of a tree with block boundaries turned into newlines. */
    blockTextOf(root) {
        const clone = root.cloneNode(true);
        clone.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
        clone.querySelectorAll(BLOCK_SELECTOR + ', li, figcaption').forEach(el => el.append('\n'));
        return clone.textContent.replace(/\n{3,}/g, '\n\n').trim();
    }

    /** Insert plain text at the caret, preserving line breaks. */
    insertPlainText(text) {
        const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
        if (lines.length === 1) {
            document.execCommand('insertText', false, lines[0]);
            return;
        }

        const ctx = this.getCaretContext();
        if (ctx.inFigcaption || ctx.inTable || ctx.inListItem || ctx.inHeading) {
            // Inline-only contexts: keep the lines, separated by <br>.
            const html = lines.map(line => this.escapeHtml(line)).join('<br>');
            document.execCommand('insertHTML', false, html);
            return;
        }

        const container = document.createElement('div');
        lines.forEach(line => {
            const p = document.createElement('p');
            if (line.trim() === '') p.innerHTML = '<br>';
            else p.textContent = line;
            container.appendChild(p);
        });
        this.insertBlockContent(container);
    }

    /**
     * Insert block-level content from a parsed container using DOM API.
     * Avoids insertHTML quirks with block elements inside blocks.
     *
     * Insertion host is not always the editor root: when the caret sits
     * inside a callout (<aside>) or a quote-card's <blockquote>, pasted
     * blocks land INSIDE that container. Disallowed tags are moved out by
     * the container normalisers that run right after paste.
     *
     * The current paragraph is split at the caret, so content pasted in the
     * middle of a paragraph lands in the middle — not after it.
     */
    insertBlockContent(container) {
        const sel = window.getSelection();
        if (!sel.rangeCount) return;

        const range = sel.getRangeAt(0);
        if (!this.el.contains(range.startContainer)) return;
        range.deleteContents();

        this.wrapInlineRuns(container);
        const nodesToInsert = Array.from(container.childNodes);
        if (nodesToInsert.length === 0) return;

        const point = findHostChild(range.startContainer, this.el);

        if (!point) {
            // Caret directly in the editor root (between blocks).
            const frag = document.createDocumentFragment();
            nodesToInsert.forEach(n => frag.appendChild(n));
            range.insertNode(frag);
            this.placeCaretAtEndOf(nodesToInsert[nodesToInsert.length - 1]);
            return;
        }

        const { host, block } = point;
        let ref;
        if (isBlockEmpty(block, 'img, iframe, video, audio, table, hr') && TEXT_BLOCK_TAGS.includes(block.tagName)) {
            // Pasted content replaces the empty paragraph.
            ref = block.nextSibling;
            block.remove();
        } else if (TEXT_BLOCK_TAGS.includes(block.tagName) && block.contains(range.startContainer)) {
            const head = document.createRange();
            head.setStart(block, 0);
            head.setEnd(range.startContainer, range.startOffset);
            const tail = document.createRange();
            tail.setStart(range.startContainer, range.startOffset);
            tail.setEnd(block, block.childNodes.length);

            const headEmpty = head.toString().trim() === '' && !head.cloneContents().querySelector('img, iframe, video');
            const tailEmpty = tail.toString().trim() === '' && !tail.cloneContents().querySelector('img, iframe, video');

            if (headEmpty) {
                ref = block;                       // insert before the paragraph
            } else if (tailEmpty) {
                ref = block.nextSibling;           // insert after it
            } else {
                // Split: the part after the caret becomes a new block.
                const after = block.cloneNode(false);
                after.removeAttribute('id');
                after.appendChild(tail.extractContents());
                block.parentNode.insertBefore(after, block.nextSibling);
                ref = after;
            }
        } else {
            ref = block.nextSibling;
        }

        nodesToInsert.forEach(node => host.insertBefore(node, ref));
        this.placeCaretAtEndOf(nodesToInsert[nodesToInsert.length - 1]);
    }

    /** Group naked text / inline runs of a container into <p> elements. */
    wrapInlineRuns(container) {
        let run = [];
        const flush = () => {
            if (run.some(n => n.nodeType === Node.TEXT_NODE ? n.data.trim() : true)) {
                const p = document.createElement('p');
                container.insertBefore(p, run[0]);
                run.forEach(n => p.appendChild(n));
            } else {
                run.forEach(n => n.remove());
            }
            run = [];
        };
        Array.from(container.childNodes).forEach(n => {
            const inline = n.nodeType === Node.TEXT_NODE || (n.nodeType === Node.ELEMENT_NODE && !isBlockLike(n));
            if (inline) run.push(n);
            else if (run.length) flush();
        });
        if (run.length) flush();
    }

    placeCaretAtEndOf(node) {
        if (!node || !node.parentNode) return;
        const sel = window.getSelection();
        const r = document.createRange();
        if (node.nodeType === Node.ELEMENT_NODE && !isAtomicBlock(node) && node.isContentEditable) {
            r.selectNodeContents(node);
            r.collapse(false);
        } else {
            // Atomic block: land in the following editable block if any.
            const next = node.nextElementSibling;
            if (next && !isAtomicBlock(next) && next.isContentEditable) {
                r.setStart(next, 0);
                r.collapse(true);
            } else {
                r.setStartAfter(node);
                r.collapse(true);
            }
        }
        sel.removeAllRanges();
        sel.addRange(r);
    }

    /**
     * Paste sanitizer — a *normaliser*: rewrites foreign markup into the
     * editor's own shapes and drops everything it doesn't recognise.
     * Works entirely on an inert document; returns its <body>.
     */
    sanitizePasteRoot(html) {
        const temp = parseHtmlInert(html);
        const config = this.instance.config;
        const modules = this.instance.modules;

        // 1. Office / comment garbage, removed on the DOM — string regexes
        // over serialised HTML could cut across node boundaries and turn
        // inert text back into markup.
        const walker = temp.ownerDocument.createTreeWalker(temp, NodeFilter.SHOW_COMMENT);
        const comments = [];
        while (walker.nextNode()) comments.push(walker.currentNode);
        comments.forEach(c => c.remove());
        Array.from(temp.querySelectorAll('*')).forEach(el => {
            if (!el.tagName.includes(':')) return;
            if (el.tagName === 'O:P') { el.remove(); return; }
            // Other namespaced Office tags (st1:…) wrap real text — unwrap.
            this.unwrap(el);
        });
        temp.querySelectorAll('[class]').forEach(el => {
            const kept = el.getAttribute('class').split(/\s+/).filter(c => c && !/^Mso/i.test(c));
            if (kept.length) el.setAttribute('class', kept.join(' '));
            else el.removeAttribute('class');
        });

        // 2. Remove Google Docs helper wrappers (b with id="docs-internal-guid-...")
        temp.querySelectorAll('b[id^="docs-internal-guid"]').forEach(wrapper => this.unwrap(wrapper));

        // Unwrap editor separator wrappers to bare <hr> (copying from the
        // editor's live DOM puts them on the clipboard). setupContent()
        // restores the wrapper after insertion.
        temp.querySelectorAll('div.redactix-separator').forEach(wrapper => {
            const hr = wrapper.querySelector('hr');
            if (hr) wrapper.parentNode.replaceChild(hr, wrapper);
            else wrapper.remove();
        });

        // <picture> → its <img>.
        temp.querySelectorAll('picture').forEach(pic => this.unwrap(pic));

        // 3. Module hooks: Embed spares provider iframes, Video spares its
        // own <video> markup, before the sweeps below would strip them.
        const pasteCtx = { keep: new Set(), liteMode: !!config.liteMode };
        modules.forEach(m => {
            if (typeof m.preparePaste === 'function') {
                try { m.preparePaste(temp, pasteCtx); } catch (e) { console.error('Redactix: ' + m.name + '.preparePaste failed', e); }
            }
        });
        const keep = pasteCtx.keep;

        // 4. Remove dangerous and unnecessary tags.
        [...FORBIDDEN_TAGS, ...PASTE_EXTRA_FORBIDDEN].forEach(tag => {
            Array.from(temp.getElementsByTagName(tag)).forEach(el => {
                if (keep.has(el)) return;
                if (el.parentNode) el.parentNode.removeChild(el);
            });
        });

        // 5. Shared baseline: event handlers, script URLs, srcdoc, unsafe
        // CSS, iframe permissions — the same pass content loads go through.
        sanitizeLoadedRoot(temp);

        // 6. Convert styled spans into semantic tags (before style removal!)
        // Google Docs uses inline styles instead of b/i/u tags
        Array.from(temp.querySelectorAll('span[style]')).forEach(span => {
            const style = span.getAttribute('style') || '';
            const isBold = /font-weight:\s*(bold|700|800|900)/i.test(style);
            const isItalic = /font-style:\s*italic/i.test(style);
            const isUnderline = /text-decoration:[^;]*underline/i.test(style);
            const isStrike = /text-decoration:[^;]*line-through/i.test(style);

            if (isBold || isItalic || isUnderline || isStrike) {
                const content = temp.ownerDocument.createDocumentFragment();
                while (span.firstChild) {
                    content.appendChild(span.firstChild);
                }
                // Wrap in tags (from inner to outer)
                let result = content;
                [[isStrike, 's'], [isUnderline, 'u'], [isItalic, 'i'], [isBold, 'b']].forEach(([on, tag]) => {
                    if (!on) return;
                    const wrap = temp.ownerDocument.createElement(tag);
                    wrap.appendChild(result);
                    result = wrap;
                });
                span.parentNode.replaceChild(result, span);
            }
        });

        // 7. Attribute sweep. Allowed classes: editor structural names come
        // from the modules (pasteAllowedClasses), preset classes from config —
        // so disabled default presets don't survive pasting and custom ones
        // pass without explicit whitelisting. Multi-token preset classes
        // ("callout warning") are split into tokens.
        const allowedClasses = new Set(['spoiler']);
        const attributeRules = [];
        modules.forEach(m => {
            (m.pasteAllowedClasses || []).forEach(c => allowedClasses.add(c));
            (m.pasteAllowedAttributes || []).forEach(rule => attributeRules.push(rule));
        });
        [...(config.calloutPresets || []), ...(config.quotePresets || [])]
            .map(p => p.class).filter(Boolean)
            .forEach(cls => cls.split(/\s+/).filter(Boolean).forEach(c => allowedClasses.add(c)));

        Array.from(temp.getElementsByTagName('*')).forEach(el => {
            // Elements spared by a module were already reduced to a safe set.
            if (keep.has(el)) return;

            const extraAttrs = new Set();
            attributeRules.forEach(rule => {
                if (el.matches(rule.selector)) rule.attrs.forEach(a => extraAttrs.add(a));
            });

            Array.from(el.attributes).forEach(attr => {
                const name = attr.name.toLowerCase();
                if (name === 'class') {
                    const classes = attr.value.split(/\s+/).filter(c => allowedClasses.has(c));
                    if (classes.length > 0) el.setAttribute('class', classes.join(' '));
                    else el.removeAttribute('class');
                    return;
                }
                if (!PASTE_ALLOWED_ATTRIBUTES.includes(name) && !extraAttrs.has(name)) {
                    el.removeAttribute(attr.name);
                    return;
                }

                // href / src: http(s), mailto, tel, relative, and raster
                // data:image/* for <img>. rel / target: whitelisted tokens.
                if (name === 'href') {
                    if (sanitizeUrl(attr.value) === null) el.removeAttribute(attr.name);
                } else if (name === 'src') {
                    const safe = (el.tagName === 'IMG') ? sanitizeImageSrc(attr.value) : sanitizeUrl(attr.value);
                    if (safe === null) el.removeAttribute(attr.name);
                } else if (name === 'rel') {
                    const cleaned = el.tagName === 'A' ? sanitizeRel(attr.value) : '';
                    if (cleaned) el.setAttribute('rel', cleaned);
                    else el.removeAttribute('rel');
                } else if (name === 'target') {
                    const cleaned = el.tagName === 'A' ? sanitizeTarget(attr.value) : '';
                    if (cleaned) {
                        el.setAttribute('target', cleaned);
                        // target=_blank without noopener/noreferrer — tab-jacking vector.
                        if (cleaned === '_blank') {
                            const existing = sanitizeRel(el.getAttribute('rel') || '');
                            const tokens = new Set(existing ? existing.split(/\s+/) : []);
                            tokens.add('noopener');
                            tokens.add('noreferrer');
                            el.setAttribute('rel', Array.from(tokens).join(' '));
                        }
                    } else {
                        el.removeAttribute('target');
                    }
                }
            });
        });

        // 8. Divs, deepest first (moving children — copying innerHTML left
        // nested divs detached and unconverted). Structural editor divs
        // (embed frame, gallery grid) keep a whitelisted class and are
        // skipped; a div holding blocks is unwrapped; a div holding only
        // inline content becomes a paragraph.
        Array.from(temp.querySelectorAll('div')).reverse().forEach(div => {
            if (!div.parentNode) return;
            if (div.hasAttribute('class')) return;
            const hasContent = div.textContent.trim() || div.querySelector('img, iframe, video, hr, table');
            if (!hasContent) {
                div.remove();
                return;
            }
            const hasBlockChild = Array.from(div.children).some(c => isBlockLike(c));
            if (hasBlockChild) {
                this.wrapInlineRuns(div);
                this.unwrap(div);
            } else {
                const p = temp.ownerDocument.createElement('p');
                while (div.firstChild) p.appendChild(div.firstChild);
                div.parentNode.replaceChild(p, div);
            }
        });

        // 9. Simplify list structure: if li contains only paragraphs — unwrap
        temp.querySelectorAll('li').forEach(li => {
            const children = Array.from(li.children);
            const paragraphs = children.filter(c => c.tagName === 'P');
            if (paragraphs.length > 0 && children.every(c => c.tagName === 'P' || c.tagName === 'BR')) {
                const fragment = temp.ownerDocument.createDocumentFragment();
                children.forEach((child, index) => {
                    if (child.tagName === 'P') {
                        while (child.firstChild) fragment.appendChild(child.firstChild);
                        if (index < children.length - 1) {
                            fragment.appendChild(temp.ownerDocument.createElement('br'));
                        }
                    }
                });
                li.innerHTML = '';
                li.appendChild(fragment);
            }
        });

        // 10. Fix incorrect nesting (Google Docs): <h1><p>text</p></h1> -> <h1>text</h1>
        temp.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(h => {
            h.querySelectorAll(':scope > p').forEach(p => {
                if (p.nextSibling && p.nextElementSibling) p.after(temp.ownerDocument.createElement('br'));
                this.unwrap(p);
            });
        });
        temp.querySelectorAll('h1, h2, h3, h4, h5, h6, p').forEach(el => {
            const inner = el.innerHTML.replace(/<br\s*\/?>/gi, '').trim();
            if (!inner) el.remove();
        });

        // 11. Clean up empty / attribute-less spans and fonts.
        temp.querySelectorAll('span:empty, font:empty').forEach(el => el.remove());
        Array.from(temp.querySelectorAll('span, font')).forEach(el => {
            if (el.attributes.length === 0) this.unwrap(el);
        });

        // Canonicalize synonymous inline tags: <strong>→<b>, <em>→<i>, <strike>→<s>.
        normalizeInlineSynonyms(temp);

        // 12. Images. data: images can only be kept when there is somewhere
        // to upload them; the Image module uploads the marked ones after
        // insertion (contentInserted event).
        Array.from(temp.querySelectorAll('img')).forEach(img => {
            const src = img.getAttribute('src') || '';
            const isData = /^data:/i.test(src);
            if (!src || (isData && !config.uploadUrl)) {
                const link = img.parentElement && img.parentElement.tagName === 'A' ? img.parentElement : null;
                img.remove();
                if (link && !link.textContent.trim() && !link.querySelector('img')) link.remove();
                return;
            }
            if (isData) img.setAttribute('data-redactix-paste-upload', '');
        });

        // Wrap img in figure (if not already wrapped). A link around a lone
        // image moves into the figure with it.
        Array.from(temp.querySelectorAll('img')).forEach(img => {
            if (img.closest('figure')) return;

            img.removeAttribute('style');
            let target = img;
            const parentLink = img.parentElement;
            if (parentLink && parentLink.tagName === 'A' && !parentLink.textContent.trim() &&
                parentLink.querySelectorAll('img').length === 1) {
                target = parentLink;
            }

            const figure = temp.ownerDocument.createElement('figure');
            const figcaption = temp.ownerDocument.createElement('figcaption');
            figcaption.innerHTML = '<br>';

            const parent = target.parentNode;
            const blockParent = parent && parent.nodeType === Node.ELEMENT_NODE &&
                (TEXT_BLOCK_TAGS.includes(parent.tagName)) ? parent : null;

            if (blockParent && blockParent.parentNode) {
                // Figures can't live inside a paragraph — place it before.
                blockParent.parentNode.insertBefore(figure, blockParent);
                figure.appendChild(target);
                if (!blockParent.textContent.trim() && !blockParent.querySelector('img, iframe')) {
                    blockParent.remove();
                }
            } else {
                parent.insertBefore(figure, target);
                figure.appendChild(target);
            }
            figure.appendChild(figcaption);
        });

        // Remove empty class attributes
        temp.querySelectorAll('[class=""]').forEach(el => el.removeAttribute('class'));

        // 13. Source-formatting whitespace (web pages are pretty-printed;
        // the editor renders pre-wrap).
        normalizeWhitespace(temp);

        return temp;
    }

    /** String form of sanitizePasteRoot (kept for external callers). */
    sanitizeHtml(html) {
        return this.sanitizePasteRoot(html).innerHTML.trim();
    }

    unwrap(el) {
        const parent = el.parentNode;
        if (!parent) return;
        while (el.firstChild) parent.insertBefore(el.firstChild, el);
        parent.removeChild(el);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ------------------------------------------------------------------
    // Keyboard
    // ------------------------------------------------------------------

    /**
     * Insert a <br> element at the current cursor position via DOM API.
     * We avoid document.execCommand('insertLineBreak') because with
     * white-space:pre-wrap it inserts a \n text node instead of a <br> tag.
     */
    insertBrAtCursor() {
        const sel = window.getSelection();
        if (!sel.rangeCount) return;

        const range = sel.getRangeAt(0);
        range.deleteContents();

        const br = document.createElement('br');
        range.insertNode(br);

        // If <br> is at the very end of its parent (no meaningful content after),
        // browsers won't render a visible new line. Add a second <br> so the
        // cursor has a line to land on.
        const next = br.nextSibling;
        const needsExtra = !next ||
            (next.nodeType === Node.TEXT_NODE && next.textContent === '');
        if (needsExtra) {
            const extraBr = document.createElement('br');
            br.parentNode.insertBefore(extraBr, br.nextSibling);
        }

        // Place cursor after the first <br>
        const newRange = document.createRange();
        newRange.setStartAfter(br);
        newRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newRange);
    }

    /**
     * Handle Shift+Enter inside aside and blockquote elements.
     * Insert a real <br> tag instead of relying on browser default.
     */
    handleShiftEnter(e) {
        const selection = window.getSelection();
        if (!selection.rangeCount) return false;

        const range = selection.getRangeAt(0);
        let node = range.startContainer;

        // Walk up to find if we are inside an aside or blockquote
        while (node && node !== this.el) {
            if (node.nodeType === Node.ELEMENT_NODE &&
                (node.tagName === 'ASIDE' || node.tagName === 'BLOCKQUOTE')) {
                e.preventDefault();
                this.insertBrAtCursor();
                this.notifyInput(null, 'insertLineBreak');
                return true;
            }
            node = node.parentNode;
        }

        return false;
    }

    /** Nearest text-ish block around the caret (LI / P / H* / container). */
    findCaretBlock(node) {
        let block = node;
        while (block && block !== this.el) {
            if (block.nodeType === Node.ELEMENT_NODE &&
                ['LI', 'BLOCKQUOTE', 'ASIDE', 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(block.tagName)) {
                return block;
            }
            block = block.parentNode;
        }
        return null;
    }

    /**
     * If `block` is a direct child of a block container (callout body or
     * quote-card body), describe that container; otherwise null.
     */
    getBlockContainer(block) {
        if (!block || block.tagName === 'LI') return null;
        const host = block.parentNode;
        const rule = getContainerRule(host);
        if (!rule) return null;
        return { host, outer: rule.outer(host), mediaSelector: rule.mediaSelector };
    }

    /** Ensure a container is never left without a block. */
    fillEmptyHost(host) {
        if (host.children.length === 0) {
            const filler = document.createElement('p');
            filler.innerHTML = '<br>';
            host.appendChild(filler);
        }
    }

    handleEnterKey(e) {
        const selection = window.getSelection();
        if (!selection.rangeCount) return false;

        const range = selection.getRangeAt(0);

        // Check if we are inside a figcaption — special-case quote-card (block
        // Enter entirely; single-line author field) vs. plain figure (insert <br>).
        let inlineEditable = range.startContainer;
        while (inlineEditable && inlineEditable !== this.el) {
            if (inlineEditable.nodeType === Node.ELEMENT_NODE &&
                inlineEditable.tagName === 'FIGCAPTION') {
                const card = inlineEditable.parentElement;
                e.preventDefault();
                if (card && card.tagName === 'FIGURE' && card.classList.contains('quote-card')) {
                    return true;
                }
                this.insertBrAtCursor();
                this.notifyInput(null, 'insertLineBreak');
                return true;
            }
            inlineEditable = inlineEditable.parentNode;
        }

        const block = this.findCaretBlock(range.startContainer);
        if (!block) return false;

        // Callout / quote-card: Enter on the empty last block exits the container.
        const container = this.getBlockContainer(block);
        if (container) {
            const isLast = block === container.host.lastElementChild;
            if (isLast && isBlockEmpty(block, container.mediaSelector)) {
                e.preventDefault();
                block.remove();
                this.fillEmptyHost(container.host);
                const exitP = document.createElement('p');
                exitP.innerHTML = '<br>';
                container.outer.parentNode.insertBefore(exitP, container.outer.nextSibling);
                this.placeCaret(exitP, 0);
                this.notifyInput(null, 'insertParagraph');
                return true;
            }
            // Otherwise let the browser create a sibling block inside the container.
            return false;
        }

        // Exit from the list on empty LI
        if (block.tagName === 'LI' && isBlockEmpty(block, 'img, iframe')) {
            e.preventDefault();
            this.exitListItem(block);
            this.notifyInput(null, 'insertParagraph');
            return true;
        }

        return false;
    }

    /** Enter on an empty <li>: outdent one level, or leave the list. */
    exitListItem(block) {
        const list = block.parentElement;
        const nextSibling = block.nextElementSibling;

        // 1. Standard nesting: the list parent is LI
        const parentLi = list.parentElement.closest('li');
        // 2. Non-standard (incorrect) nesting: list inside a list
        const parentIsList = ['UL', 'OL'].includes(list.parentElement.tagName);

        if (parentLi || parentIsList) {
            const targetList = parentLi ? parentLi.parentElement : list.parentElement;
            const referenceNode = parentLi || list;

            const newLi = document.createElement('li');
            if (nextSibling) {
                // Remaining items move into a new nested list under the new LI.
                const newNestedList = document.createElement(list.tagName);
                let current = nextSibling;
                while (current) {
                    const next = current.nextElementSibling;
                    newNestedList.appendChild(current);
                    current = next;
                }
                newLi.appendChild(document.createTextNode(''));
                newLi.appendChild(newNestedList);
            } else {
                newLi.innerHTML = '<br>';
            }

            targetList.insertBefore(newLi, referenceNode.nextSibling);
            block.remove();
            if (list.children.length === 0) list.remove();
            this.placeCaret(newLi, 0);
            return;
        }

        // Top-level list — exit to a paragraph, splitting the list if needed.
        const p = document.createElement('p');
        p.innerHTML = '<br>';
        list.parentNode.insertBefore(p, list.nextSibling);
        if (nextSibling) {
            const newList = document.createElement(list.tagName);
            let current = nextSibling;
            while (current) {
                const next = current.nextElementSibling;
                newList.appendChild(current);
                current = next;
            }
            p.parentNode.insertBefore(newList, p.nextSibling);
        }
        block.remove();
        if (list.children.length === 0) list.remove();
        this.placeCaret(p, 0);
    }

    handleBackspace(e) {
        const selection = window.getSelection();
        if (!selection.rangeCount || !selection.isCollapsed) return false;

        const range = selection.getRangeAt(0);

        // Check that cursor is at the beginning
        if (range.startOffset !== 0) return false;

        const block = this.findCaretBlock(range.startContainer);
        if (!block) return false;

        // Check that cursor is at the very beginning of the block
        let node = range.startContainer;
        while (node && node !== block) {
            if (node.previousSibling) return false;
            node = node.parentNode;
        }

        // Callout / quote-card: don't let backspace escape the container.
        const container = this.getBlockContainer(block);
        if (container) {
            if (block !== container.host.firstElementChild) {
                // Let the browser merge with the previous block inside the container
                return false;
            }
            e.preventDefault();
            if (!isBlockEmpty(block, container.mediaSelector)) {
                // Don't merge with content outside the container
                return true;
            }
            block.remove();
            if (container.host.children.length === 0) {
                // Container became empty — replace the whole thing with a paragraph
                const replacement = document.createElement('p');
                replacement.innerHTML = '<br>';
                container.outer.parentNode.replaceChild(replacement, container.outer);
                this.placeCaret(replacement, 0);
            } else {
                this.placeCaret(container.host.firstElementChild, 0);
            }
            this.notifyInput(null, 'deleteContentBackward');
            return true;
        }

        // Standalone P at top level — protect adjacent atomic blocks
        // (figure / pre / table / hr / video-wrapper / separator) from
        // browser's default backspace-merge, which deletes the whole atomic
        // block when its only "neighbour" content is non-editable.
        if (block.tagName === 'P' && block.parentNode === this.el) {
            const prev = block.previousElementSibling;
            if (prev && this.isAtomicBlock(prev) &&
                this.isCursorAtStartOfBlock(range, block)) {
                e.preventDefault();
                if (!isBlockEmpty(block)) {
                    // Don't merge content into / destroy the atomic block.
                    return true;
                }
                this.removeBlockNextToAtomic(block, prev, 'end');
                this.notifyInput(null, 'deleteContentBackward');
                return true;
            }
            return false;
        }
        if (block.tagName === 'P') return false;

        // Convert heading (or a stray top-level aside) to paragraph
        if (HEADING_TAGS.includes(block.tagName) || block.tagName === 'ASIDE') {
            e.preventDefault();

            const p = document.createElement('p');
            while (block.firstChild) {
                p.appendChild(block.firstChild);
            }
            if (!p.innerHTML.trim()) p.innerHTML = '<br>';

            block.parentNode.replaceChild(p, block);
            this.placeCaret(p, 0);
            this.notifyInput(null, 'deleteContentBackward');
            return true;
        }

        return false;
    }

    /**
     * Forward Delete handler — symmetric to handleBackspace's protection of
     * adjacent atomic blocks. Triggered on Delete pressed at the END of a
     * top-level P that's followed by figure / pre / table / hr / .redactix-
     * separator / .redactix-video-wrapper. Browser's default would merge the
     * atomic block into the empty paragraph, destroying both.
     */
    handleDelete(e) {
        const selection = window.getSelection();
        if (!selection.rangeCount || !selection.isCollapsed) return false;

        const range = selection.getRangeAt(0);

        // Find the top-level block (direct child of the editor) that
        // contains the cursor.
        const block = this.findTopLevelBlock(range.endContainer);
        if (!block) return false;
        // Cursor inside an atomic block (e.g. figcaption of a figure) — let
        // the browser handle Delete inside it.
        if (this.isAtomicBlock(block)) return false;

        if (!this.isCursorAtEndOfBlock(range, block)) return false;

        const next = block.nextElementSibling;
        if (!next || !this.isAtomicBlock(next)) return false;

        e.preventDefault();
        if (!isBlockEmpty(block)) {
            // Block has content — don't merge the atomic block backward
            // (which would also destroy it). Just no-op.
            return true;
        }
        this.removeBlockNextToAtomic(block, next, 'start');
        this.notifyInput(null, 'deleteContentForward');
        return true;
    }

    /** Top-level block (direct child of editorEl) that contains `node`. */
    findTopLevelBlock(node) {
        while (node && node.parentNode !== this.el) {
            node = node.parentNode;
        }
        return (node && node !== this.el) ? node : null;
    }

    /**
     * Range-based "is the cursor at the start of `block`?" — robust to
     * inline wrappers, leading <br>, etc.
     */
    isCursorAtStartOfBlock(range, block) {
        if (!range.collapsed) return false;
        const head = document.createRange();
        head.setStart(block, 0);
        head.setEnd(range.startContainer, range.startOffset);
        return head.toString() === '';
    }

    /**
     * Range-based "is the cursor at the end of `block`?" — robust to
     * trailing <br>, inline wrappers, etc.
     */
    isCursorAtEndOfBlock(range, block) {
        if (!range.collapsed) return false;
        const tail = document.createRange();
        tail.setStart(range.endContainer, range.endOffset);
        tail.setEnd(block, block.childNodes.length);
        return tail.toString() === '';
    }

    /** Thin wrapper over the shared helper (kept for existing callsites). */
    isAtomicBlock(el) {
        return isAtomicBlock(el);
    }

    /**
     * Remove an empty paragraph that sits next to an atomic block, placing
     * the cursor in a sensible existing landing spot. If no good landing
     * spot exists, leave the empty paragraph alone — the caller has already
     * preventDefault'd, so backspace/delete is a visible no-op rather than
     * destroying the figure.
     */
    removeBlockNextToAtomic(block, atomic, edge) {
        const targetRange = this.findCursorTargetForAtomic(atomic, edge);
        if (!targetRange) return; // preventDefault was already called

        block.remove();
        this.ensureTrailingParagraph();

        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(targetRange);
    }

    /**
     * Where should the cursor land after removing a paragraph adjacent to
     * `atomic`? Returns a Range positioned in the most natural editable
     * spot, or null when none exists.
     */
    findCursorTargetForAtomic(atomic, edge) {
        if (atomic.tagName === 'FIGURE') {
            if (atomic.classList.contains('quote-card')) {
                const bq = atomic.querySelector(':scope > blockquote');
                const innerP = bq && (edge === 'end' ? bq.lastElementChild : bq.firstElementChild);
                if (innerP) {
                    const r = document.createRange();
                    r.selectNodeContents(innerP);
                    r.collapse(edge === 'start');
                    return r;
                }
            } else {
                const figcaption = atomic.querySelector(':scope > figcaption');
                if (figcaption && figcaption.isContentEditable) {
                    const r = document.createRange();
                    r.selectNodeContents(figcaption);
                    r.collapse(edge === 'start');
                    return r;
                }
            }
        }

        const target = edge === 'end'
            ? atomic.previousElementSibling
            : atomic.nextElementSibling;
        if (target && target.isContentEditable !== false && !this.isAtomicBlock(target)) {
            const r = document.createRange();
            r.selectNodeContents(target);
            r.collapse(edge === 'start');
            return r;
        }
        return null;
    }

    handleSpace() {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        // With a selection — let the browser replace it natively: it merges
        // blocks correctly across paragraph boundaries and fires `input`.
        if (!selection.isCollapsed) {
            document.execCommand('insertText', false, ' ');
            return;
        }

        const range = selection.getRangeAt(0);
        const inlineTags = ['B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'A', 'CODE', 'SPAN', 'SUB', 'SUP', 'MARK'];

        const node = range.endContainer;
        const offset = range.endOffset;
        let targetTag = null;

        // Check previous character for double spaces
        let prevChar = '';
        if (node.nodeType === Node.TEXT_NODE && offset > 0) {
            prevChar = node.textContent[offset - 1];
        }
        const charToInsert = (prevChar === ' ') ? ' ' : ' ';

        // Formatting exit logic: a space typed at the very end of an inline
        // format element goes after it, so the next word isn't formatted.
        const isAtEnd = (n, off) => {
            if (n.nodeType === Node.TEXT_NODE) return off === n.textContent.length;
            return off === n.childNodes.length;
        };

        if (isAtEnd(node, offset)) {
            let current = node;
            while (current && current !== this.el) {
                if (current.nodeType === Node.ELEMENT_NODE && inlineTags.includes(current.tagName)) {
                    targetTag = current;
                }
                if (current.nextSibling) break;
                current = current.parentNode;
            }
        }

        if (targetTag) {
            const space = document.createTextNode(charToInsert);
            targetTag.parentNode.insertBefore(space, targetTag.nextSibling);

            const newRange = document.createRange();
            newRange.setStartAfter(space);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
        } else if (range.startContainer.nodeType === Node.TEXT_NODE) {
            const textNode = range.startContainer;
            const text = textNode.data;
            textNode.data = text.slice(0, offset) + charToInsert + text.slice(offset);

            const newRange = document.createRange();
            newRange.setStart(textNode, offset + 1);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
        } else {
            this.instance.selection.insertNode(document.createTextNode(charToInsert));
        }

        // The keystroke was cancelled, so the browser fires no input event —
        // History, slash menu and markdown shortcuts must still hear it.
        this.notifyInput(' ');
    }
}
