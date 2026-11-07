import Module from '../core/Module.js';
import Icons from '../ui/Icons.js';
import { sanitizeUrl, composeLinkRel } from '../core/dom-utils.js';
import { pushEscapeLayer } from '../core/layers.js';
import { placePopover, getSelectionRect } from '../ui/popover.js';
import { inputGroup, checkbox, statusLine } from '../ui/form-helpers.js';

// Elements whose text forms one "line" for inline formatting: a mark / code
// / spoiler is never allowed to swallow one of these.
const INLINE_HOST_TAGS = new Set([
    'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'TD', 'TH', 'FIGCAPTION',
    'PRE', 'DT', 'DD', 'DIV', 'BLOCKQUOTE', 'ASIDE', 'FIGURE'
]);

export default class FloatingToolbar extends Module {
    static moduleName = 'FloatingToolbar';

    constructor(instance) {
        super(instance);
        this.toolbar = null;
        this.isVisible = false;
        this.hideTimeout = null;
        this.popEscape = null;
        this.liteMode = instance.config.liteMode || false;
    }

    init() {
        this.createToolbar();
        this.bindEvents();
        this.instance.onDestroy(() => {
            clearTimeout(this.hideTimeout);
            this.hide();
        });
    }

    createToolbar() {
        this.toolbar = document.createElement('div');
        this.toolbar.className = 'redactix-floating-toolbar';
        this.toolbar.style.display = 'none';

        // Formatting buttons
        const buttons = [
            { name: 'bold', icon: Icons.bold, title: this.t('toolbar.bold'), command: 'bold' },
            { name: 'italic', icon: Icons.italic, title: this.t('toolbar.italic'), command: 'italic' },
            { name: 'underline', icon: Icons.underline, title: this.t('toolbar.underline'), command: 'underline' },
            { name: 'strike', icon: Icons.strike, title: this.t('toolbar.strikethrough'), command: 'strikeThrough' },
            { name: 'mark', icon: Icons.mark, title: this.t('toolbar.highlight'), action: () => this.toggleInlineTag('mark') },
            { type: 'separator' },
            { name: 'code', icon: Icons.code, title: this.t('toolbar.monospace'), action: () => this.toggleInlineTag('code') },
            { name: 'spoiler', icon: Icons.spoiler, title: this.t('toolbar.spoiler'), action: () => this.toggleInlineTag('span', 'spoiler') },
            { type: 'separator' },
            { name: 'link', icon: Icons.link, title: this.t('toolbar.link'), action: () => this.openLinkModal() },
        ];

        buttons.forEach(btn => {
            if (btn.type === 'separator') {
                const sep = document.createElement('div');
                sep.className = 'redactix-floating-separator';
                this.toolbar.appendChild(sep);
                return;
            }

            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'redactix-floating-btn';
            button.innerHTML = btn.icon;
            button.title = btn.title;
            button.setAttribute('aria-label', btn.title);
            button.dataset.name = btn.name;

            const run = () => {
                if (!this.isSelectionEditable()) return;
                if (btn.command) {
                    this.instance.selection.excludeTrailingSpacesFromSelection();
                    this.transact(() => document.execCommand(btn.command));
                    this.updateButtonStates();
                } else if (btn.action) {
                    btn.action();
                }
            };

            button.addEventListener('mousedown', (e) => {
                if (e.button !== 0) return;
                e.preventDefault();
                e.stopPropagation();
                run();
            });

            // Keyboard activation (click with detail === 0)
            button.addEventListener('click', (e) => {
                if (e.detail === 0) run();
            });

            this.toolbar.appendChild(button);
        });

        // Lives in the wrapper (inherits theme variables) but is
        // position: fixed, so the wrapper's overflow never clips it.
        this.instance.wrapper.appendChild(this.toolbar);
    }

    bindEvents() {
        // Global listeners — via registry so that destroy() removes them.
        this.instance.listen(document, 'selectionchange', () => {
            this.onSelectionChange();
        });

        this.instance.listen(document, 'mousedown', (e) => {
            if (!this.instance.wrapper.contains(e.target) &&
                !e.target.closest('.redactix-modal-overlay')) {
                this.hide();
            }
        });

        // Fixed positioning: follow page / container scroll and resizes.
        const reposition = () => {
            if (this.isVisible) this.updatePosition();
        };
        this.instance.listen(window, 'scroll', reposition, true);
        this.instance.listen(window, 'resize', reposition);
    }

    /**
     * Is the current selection inside editable content of this editor?
     * Read-only islands (code blocks, figure chrome — contenteditable=false)
     * must not get inline markup.
     */
    isSelectionEditable() {
        const selection = window.getSelection();
        if (!selection.rangeCount) return false;
        const range = selection.getRangeAt(0);
        const root = this.instance.editorEl;
        if (!root.contains(range.commonAncestorContainer)) return false;
        const editable = (node) => {
            const el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
            return !!el && root.contains(el) && el.isContentEditable;
        };
        return editable(range.startContainer) && editable(range.endContainer);
    }

    onSelectionChange() {
        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
            this.hideTimeout = null;
        }

        const selection = window.getSelection();

        if (!selection.rangeCount) {
            this.hide();
            return;
        }

        const range = selection.getRangeAt(0);

        if (range.collapsed || !this.isSelectionEditable()) {
            this.hide();
            return;
        }

        const selectedText = selection.toString().trim();

        if (selectedText.length < 1) {
            this.hide();
            return;
        }

        this.hideTimeout = setTimeout(() => {
            this.hideTimeout = null;
            if (!this.isSelectionEditable()) return;
            this.show();
            this.updatePosition();
            this.updateButtonStates();
        }, 100);
    }

    show() {
        this.toolbar.style.display = 'flex';
        this.isVisible = true;
        if (!this.popEscape) {
            // Escape hides the toolbar first (before fullscreen etc.)
            this.popEscape = pushEscapeLayer(() => this.hide(), { scope: this.instance.wrapper });
        }
    }

    hide() {
        if (this.toolbar) this.toolbar.style.display = 'none';
        this.isVisible = false;
        if (this.popEscape) {
            this.popEscape();
            this.popEscape = null;
        }
    }

    /** Hide floating toolbar (HTML mode, content replaced). */
    hideUI() {
        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
            this.hideTimeout = null;
        }
        this.hide();
    }

    updatePosition() {
        const rect = getSelectionRect();
        if (!rect) return;
        placePopover(this.toolbar, rect, { side: 'top', align: 'center', offset: 10 });
    }

    updateButtonStates() {
        const buttons = this.toolbar.querySelectorAll('.redactix-floating-btn');
        const selection = window.getSelection();

        const isInside = (test) => {
            if (!selection.rangeCount) return false;
            let node = selection.getRangeAt(0).commonAncestorContainer;
            while (node && node !== this.instance.editorEl) {
                if (node.nodeType === Node.ELEMENT_NODE && test(node)) return true;
                node = node.parentNode;
            }
            return false;
        };

        buttons.forEach(btn => {
            const name = btn.dataset.name;
            let isActive = false;

            switch (name) {
                case 'bold':
                    isActive = document.queryCommandState('bold');
                    break;
                case 'italic':
                    isActive = document.queryCommandState('italic');
                    break;
                case 'underline':
                    isActive = document.queryCommandState('underline');
                    break;
                case 'strike':
                    isActive = document.queryCommandState('strikeThrough');
                    break;
                case 'link':
                    isActive = isInside(n => n.tagName === 'A');
                    break;
                case 'code':
                    isActive = isInside(n => n.tagName === 'CODE');
                    break;
                case 'spoiler':
                    isActive = isInside(n => n.tagName === 'SPAN' && n.classList.contains('spoiler'));
                    break;
                case 'mark':
                    isActive = isInside(n => n.tagName === 'MARK' && !n.classList.contains('redactix-find-highlight'));
                    break;
            }

            btn.classList.toggle('active', isActive);
        });
    }

    // ------------------------------------------------------------------
    // Links
    // ------------------------------------------------------------------

    findAncestorLink(node) {
        while (node && node !== this.instance.editorEl) {
            if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'A') return node;
            node = node.parentNode;
        }
        return null;
    }

    /**
     * Link modal. Full mode: URL, text, title, extra rel, new window,
     * nofollow. Lite mode (comments): URL and text only; links are always
     * nofollow + new window.
     */
    openLinkModal() {
        const lite = this.liteMode;
        const selection = window.getSelection();
        if (!selection.rangeCount || !this.isSelectionEditable()) return;

        const range = selection.getRangeAt(0);
        const existingLink = this.findAncestorLink(range.commonAncestorContainer);

        // Save selection (the modal takes focus)
        this.instance.selection.save();
        const savedRange = range.cloneRange();
        const originalText = existingLink ? existingLink.textContent : selection.toString();

        // Create form
        const form = document.createElement('div');

        // URL — read the attribute, not the property: .href expands
        // relative links into absolute ones.
        const urlGroup = inputGroup(this.t('link.url'), 'text',
            existingLink ? (existingLink.getAttribute('href') || '') : 'https://',
            { placeholder: 'https://example.com' });
        const urlInput = urlGroup.field;
        const status = statusLine('', { error: true });
        urlInput.addEventListener('input', () => { status.textContent = ''; });

        // Link text
        const textGroup = inputGroup(this.t('link.linkText'), 'text', originalText);
        const textInput = textGroup.field;

        form.append(urlGroup, status, textGroup);

        let titleInput = null;
        let relInput = null;
        let targetBox = null;
        let nofollowBox = null;
        if (!lite) {
            const titleGroup = inputGroup(this.t('link.titleAttr'), 'text', existingLink ? existingLink.title || '' : '');
            titleInput = titleGroup.field;

            const existingRel = existingLink ? (existingLink.getAttribute('rel') || '') : '';
            const relExtra = existingRel.split(/\s+/)
                .filter(t => t && !['nofollow', 'noopener', 'noreferrer'].includes(t.toLowerCase()))
                .join(' ');
            const relGroup = inputGroup(this.t('link.relExceptNofollow'), 'text', relExtra, {
                placeholder: this.t('link.relPlaceholder')
            });
            relInput = relGroup.field;

            const row = document.createElement('div');
            row.className = 'redactix-checkbox-row';
            targetBox = checkbox(this.t('link.openNewWindow'), existingLink ? existingLink.target === '_blank' : false);
            nofollowBox = checkbox(this.t('link.nofollow'), /\bnofollow\b/i.test(existingRel));
            row.append(targetBox, nofollowBox);

            form.append(titleGroup, relGroup, row);
        }

        this.hide();

        const applyAttributes = (a, safeUrl) => {
            a.setAttribute('href', safeUrl);
            if (lite) {
                a.target = '_blank';
                a.rel = composeLinkRel({ nofollow: true, blank: true });
                return;
            }
            const title = titleInput.value.trim();
            if (title) a.title = title;
            else a.removeAttribute('title');
            const blank = targetBox.field.checked;
            if (blank) a.target = '_blank';
            else a.removeAttribute('target');
            // composeLinkRel adds noopener+noreferrer for target=_blank and
            // filters custom rel tokens to a safe whitelist.
            const rel = composeLinkRel({ nofollow: nofollowBox.field.checked, blank, extra: relInput.value.trim() });
            if (rel) a.rel = rel;
            else a.removeAttribute('rel');
        };

        // Prepare extra buttons (Remove for existing link)
        const extraButtons = [];
        if (existingLink) {
            extraButtons.push({
                text: this.t('link.removeLink'),
                danger: true,
                onClick: () => {
                    if (existingLink.isConnected) {
                        this.transact(() => this.unwrap(existingLink));
                    }
                    this.instance.modal.close();
                    this.hide();
                }
            });
        }

        this.instance.modal.open({
            title: existingLink ? this.t('link.editTitle') : this.t('link.title'),
            body: form,
            extraButtons: extraButtons,
            onSave: () => {
                const url = urlInput.value.trim();
                // Nothing entered — nothing to do.
                if (!url || url === 'https://') return;

                // Validate URL scheme — javascript:/data:text/html are rejected.
                const safeUrl = sanitizeUrl(url);
                if (!safeUrl) {
                    status.textContent = this.t('link.invalidUrl');
                    urlInput.focus();
                    return false;
                }

                const text = textInput.value;
                const textChanged = text !== originalText && text.trim() !== '';

                this.transact(() => {
                    if (existingLink && existingLink.isConnected) {
                        // Edit in place: inner formatting (<a><b>x</b> y</a>)
                        // survives unless the user retyped the text.
                        applyAttributes(existingLink, safeUrl);
                        if (textChanged) existingLink.textContent = text;
                        this.placeCaretAfter(existingLink);
                        return;
                    }
                    const a = document.createElement('a');
                    applyAttributes(a, safeUrl);
                    this.createLink(a, savedRange, textChanged ? text : null, url);
                });
            }
        });
    }

    /**
     * Wrap `range` into the link `a`. Links overlapping the range are
     * unwrapped first (no nested <a>). The selected markup is kept when the
     * user didn't retype the text; an empty selection or retyped text
     * become plain link text.
     */
    createLink(a, savedRange, newText, url) {
        const root = this.instance.editorEl;
        if (!root.contains(savedRange.startContainer)) return;
        const range = savedRange.cloneRange();

        // Boundary markers survive the DOM moves of the unwraps below
        // (a Range boundary inside a moved node would collapse).
        const startMarker = document.createElement('span');
        const endMarker = document.createElement('span');
        const endRange = range.cloneRange();
        endRange.collapse(false);
        endRange.insertNode(endMarker);
        const startRange = range.cloneRange();
        startRange.collapse(true);
        startRange.insertNode(startMarker);

        const links = new Set();
        const outerStart = this.findAncestorLink(startMarker.parentNode);
        const outerEnd = this.findAncestorLink(endMarker.parentNode);
        if (outerStart) links.add(outerStart);
        if (outerEnd) links.add(outerEnd);
        const span = document.createRange();
        span.setStartAfter(startMarker);
        span.setEndBefore(endMarker);
        root.querySelectorAll('a').forEach(link => {
            if (span.intersectsNode(link)) links.add(link);
        });
        links.forEach(link => this.unwrap(link));

        const r = document.createRange();
        r.setStartAfter(startMarker);
        r.setEndBefore(endMarker);

        const sameHost = this.inlineHostOf(startMarker) === this.inlineHostOf(endMarker);
        let last = a;
        if (newText !== null || r.collapsed || !r.toString().trim()) {
            // Retyped text or nothing selected: plain link text.
            a.textContent = newText !== null ? newText : url;
            r.deleteContents();
            startMarker.parentNode.insertBefore(a, startMarker.nextSibling);
        } else {
            // Keep the selected markup. A selection spanning several blocks
            // gets one link per block — a link must never swallow a <p>.
            const segments = sameHost ? [r] : this.splitRangeByHost(r);
            for (let i = segments.length - 1; i >= 0; i--) {
                const link = i === 0 ? a : a.cloneNode(false);
                link.appendChild(segments[i].extractContents());
                segments[i].insertNode(link);
                if (i === segments.length - 1) last = link;
            }
        }

        const parents = new Set([startMarker.parentNode, endMarker.parentNode]);
        startMarker.remove();
        endMarker.remove();
        parents.forEach(p => { if (p && p.isConnected) p.normalize(); });
        this.placeCaretAfter(last);
    }

    placeCaretAfter(node) {
        if (!node.isConnected) return;
        const r = document.createRange();
        r.setStartAfter(node);
        r.collapse(true);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(r);
    }

    unwrap(el) {
        const parent = el.parentNode;
        if (!parent) return;
        while (el.firstChild) parent.insertBefore(el.firstChild, el);
        parent.removeChild(el);
    }

    // ------------------------------------------------------------------
    // mark / code / spoiler
    // ------------------------------------------------------------------

    /** Nearest element whose text is one formatting "line" (P, LI, TD …). */
    inlineHostOf(node) {
        const root = this.instance.editorEl;
        let el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
        while (el && el !== root) {
            if (INLINE_HOST_TAGS.has(el.tagName)) return el;
            el = el.parentElement;
        }
        return root;
    }

    matchesTag(el, tagName, className) {
        return el.nodeType === Node.ELEMENT_NODE &&
            el.tagName === tagName.toUpperCase() &&
            (!className || el.classList.contains(className)) &&
            !el.classList.contains('redactix-find-highlight');
    }

    toggleInlineTag(tagName, className = null) {
        const selection = window.getSelection();
        if (!selection.rangeCount || !this.isSelectionEditable()) return;

        // Exclude spaces from selection
        this.instance.selection.excludeTrailingSpacesFromSelection();

        const range = selection.getRangeAt(0);
        if (range.collapsed) return;

        // Check if we are inside such a tag
        let existingTag = null;
        let node = range.commonAncestorContainer;
        while (node && node !== this.instance.editorEl) {
            if (this.matchesTag(node, tagName, className)) {
                existingTag = node;
                break;
            }
            node = node.parentNode;
        }

        this.transact(() => {
            if (existingTag) {
                // Remove tag - unwrap content
                this.unwrap(existingTag);
                return;
            }

            // One wrapper per text block: wrapping a range that spans
            // several paragraphs would put whole <p>s inside an inline tag.
            const segments = this.splitRangeByHost(range);
            const wrappers = [];
            for (let i = segments.length - 1; i >= 0; i--) {
                const seg = segments[i];
                const wrapper = document.createElement(tagName);
                if (className) wrapper.className = className;
                wrapper.appendChild(seg.extractContents());
                // No nested copies of the same tag inside the new wrapper
                wrapper.querySelectorAll(tagName).forEach(inner => {
                    if (this.matchesTag(inner, tagName, className)) this.unwrap(inner);
                });
                seg.insertNode(wrapper);
                wrappers.unshift(wrapper);
            }

            if (wrappers.length) {
                selection.removeAllRanges();
                const newRange = document.createRange();
                newRange.setStart(wrappers[0], 0);
                const last = wrappers[wrappers.length - 1];
                newRange.setEnd(last, last.childNodes.length);
                selection.addRange(newRange);
            }
        });

        this.updateButtonStates();
    }

    /**
     * Split `range` into sub-ranges that each stay inside one inline host
     * (paragraph, heading, list item, cell, caption), covering only the
     * editable, non-blank text. Returns them in document order.
     */
    splitRangeByHost(range) {
        const startHost = this.inlineHostOf(range.startContainer);
        const endHost = this.inlineHostOf(range.endContainer);
        if (startHost === endHost) return [range.cloneRange()];

        const container = range.commonAncestorContainer;
        const walker = document.createTreeWalker(
            container.nodeType === Node.ELEMENT_NODE ? container : container.parentNode,
            NodeFilter.SHOW_TEXT
        );
        const groups = [];
        let current = null;
        while (walker.nextNode()) {
            const text = walker.currentNode;
            if (!range.intersectsNode(text)) continue;
            const parent = text.parentElement;
            if (!parent || !parent.isContentEditable) continue;
            let start = 0;
            let end = text.data.length;
            if (text === range.startContainer) start = range.startOffset;
            if (text === range.endContainer) end = range.endOffset;
            if (end <= start) continue;
            const host = this.inlineHostOf(text);
            if (!current || current.host !== host) {
                current = { host, first: text, firstOffset: start, last: text, lastOffset: end, hasText: false };
                groups.push(current);
            } else {
                current.last = text;
                current.lastOffset = end;
            }
            if (text.data.slice(start, end).trim()) current.hasText = true;
        }

        return groups.filter(g => g.hasText).map(g => {
            const r = document.createRange();
            r.setStart(g.first, g.firstOffset);
            r.setEnd(g.last, g.lastOffset);
            return r;
        });
    }
}
