import Module from '../core/Module.js';
import Icons from '../ui/Icons.js';
import { parseHtmlInert, sanitizeLoadedHtml } from '../core/dom-utils.js';

// Pretty-printer tag sets. Block elements go on their own line; "verbatim"
// elements are printed exactly as serialised — their content is either
// whitespace-sensitive (<pre>) or opaque (media).
const PRETTY_BLOCK_TAGS = new Set([
    'ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'CAPTION', 'COL', 'COLGROUP',
    'DD', 'DETAILS', 'DIV', 'DL', 'DT', 'FIELDSET', 'FIGCAPTION', 'FIGURE',
    'FOOTER', 'FORM', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HEADER', 'HR',
    'IFRAME', 'LI', 'MAIN', 'NAV', 'OL', 'P', 'PRE', 'SECTION', 'SUMMARY',
    'TABLE', 'TBODY', 'TD', 'TFOOT', 'TH', 'THEAD', 'TR', 'UL', 'VIDEO', 'AUDIO'
]);
const VERBATIM_TAGS = new Set(['PRE', 'IFRAME', 'VIDEO', 'AUDIO', 'TEXTAREA']);
const INDENT = '  ';

export default class HtmlMode extends Module {
    static moduleName = 'HtmlMode';

    constructor(instance) {
        super(instance);
        this.isHtmlMode = false;
        this.editorContainer = null;
        this.textarea = null;
        this.lineNumbers = null;

        // Syntax highlighting: transparent textarea sits on top of <pre>
        // with a colored copy of the text (overlay pattern). textarea
        // remains the source of truth — caret, selection, and undo are native.
        this.codeMain = null;       // wrapper for textarea + backdrop
        this.backdrop = null;       // <pre> with highlighting
        this.backdropCode = null;   // <code> inside backdrop
        this.lineHighlight = null;  // line highlight strip on hover on the line number
        this._redrawFrame = null;   // rAF coalescing of redraws
        this._lineCount = 0;        // line numbers currently rendered
        this._highlightedValue = null;
        this._overrideCache = { code: null, html: null };
        this._returning = false;

        // Line metrics. Must match CSS (.redactix-code-editor:
        // line-height 21px; padding 16px in textarea, backdrop and lines column)
        // — this keeps the exact match of the line number and the line.
        this.LINE_HEIGHT = 21;
        this.PAD_TOP = 16;
        this.MIN_HEIGHT = 300;
    }

    init() {
        // Content replaced from outside while the code view is open
        // (host calls setContent): show the new content in the code view,
        // otherwise the next sync would save the stale code over it.
        this.instance.on('contentReplaced', () => {
            if (this.isHtmlMode && !this._returning && this.textarea) {
                this.setCode(this.beautifyHtml(this.instance.serializeClean().html));
            }
        });
        this.instance.onDestroy(() => {
            if (this._redrawFrame != null) cancelAnimationFrame(this._redrawFrame);
            this._redrawFrame = null;
        });
    }

    getButtons() {
        // In lite mode, do not show the HTML editing button
        if (this.instance.config.liteMode) {
            return [];
        }

        return [
            {
                name: 'html',
                icon: Icons.code,
                title: this.t('toolbar.editHtml'),
                action: () => this.toggleHtmlMode()
            }
        ];
    }

    /**
     * While the code view is open it IS the content: textarea.value,
     * getContent(), form submit and destroy() must carry what is typed
     * there. Same sanitiser as the return path, so the saved value is what
     * the visual editor would get back.
     */
    getContentOverride() {
        if (!this.isHtmlMode || !this.textarea) return null;
        const code = this.textarea.value;
        if (this._overrideCache.code !== code) {
            this._overrideCache = { code, html: sanitizeLoadedHtml(code) };
        }
        return this._overrideCache.html;
    }

    toggleHtmlMode() {
        if (this.isHtmlMode) this.exitHtmlMode();
        else this.enterHtmlMode();
    }

    enterHtmlMode() {
        if (this.isHtmlMode) return;
        const wrapper = this.instance.wrapper;
        const editorEl = this.instance.editorEl;

        // 1. Exactly the saved HTML (same cleanup as sync), pretty-printed.
        const prettyHtml = this.beautifyHtml(this.instance.serializeClean().html);

        // 2. Hide floating overlays of all modules (block handles, "+"
        // between blocks, table handles, floating toolbar, search) — they
        // would otherwise hover over the code.
        this.instance.hideAllUI();

        this.isHtmlMode = true;

        // 3. Create the code editor, hide visual editor
        this.createCodeEditor(prettyHtml);
        editorEl.style.display = 'none';
        wrapper.appendChild(this.editorContainer);

        // 4. Disable toolbar buttons
        this.disableToolbar(true);

        // 5. Hide character counter
        if (this.instance.counter) {
            this.instance.counter.style.display = 'none';
        }

        // 6. Focus on textarea
        this.textarea.focus();
        this.textarea.setSelectionRange(0, 0);
        this.redraw();
    }

    exitHtmlMode() {
        if (!this.isHtmlMode) return;
        const editorEl = this.instance.editorEl;
        const code = this.textarea ? this.textarea.value : '';

        // The visual editor owns the content again from here on.
        this.isHtmlMode = false;
        this._overrideCache = { code: null, html: null };

        // 1. Remove code editor
        if (this._redrawFrame != null) {
            cancelAnimationFrame(this._redrawFrame);
            this._redrawFrame = null;
        }
        if (this.editorContainer && this.editorContainer.parentNode) {
            this.editorContainer.parentNode.removeChild(this.editorContainer);
        }
        this.editorContainer = null;
        this.textarea = null;
        this.lineNumbers = null;
        this.codeMain = null;
        this.backdrop = null;
        this.backdropCode = null;
        this.lineHighlight = null;
        this._lineCount = 0;
        this._highlightedValue = null;

        // 2. Show visual editor
        editorEl.style.display = '';

        // 3. Load the code through the same pipeline as stored content
        // (sanitiser + whitespace normalisation + every module's setup) —
        // as ONE undo step. Hand-written code goes through the load-time
        // sanitiser not because the author is untrusted, but so that what
        // comes back from HTML mode is exactly what would survive the next
        // load.
        this._returning = true;
        try {
            this.transact(() => this.instance.replaceContent(code));
        } finally {
            this._returning = false;
        }

        // 4. Enable buttons
        this.disableToolbar(false);

        // 5. Show character counter
        if (this.instance.counter) {
            this.instance.counter.style.display = '';
        }
    }

    /** Replace the code view's text (no undo entry in the textarea). */
    setCode(code) {
        if (!this.textarea) return;
        this.textarea.value = code;
        this.redraw();
        this.instance.sync();
    }

    createCodeEditor(content) {
        // Main container
        this.editorContainer = document.createElement('div');
        this.editorContainer.className = 'redactix-code-editor';

        // Line numbers
        this.lineNumbers = document.createElement('div');
        this.lineNumbers.className = 'redactix-code-lines';
        this._lineCount = 0;

        // Code column: highlighted backdrop behind + transparent textarea on top
        this.codeMain = document.createElement('div');
        this.codeMain.className = 'redactix-code-main';

        this.lineHighlight = document.createElement('div');
        this.lineHighlight.className = 'redactix-code-line-highlight';

        this.backdrop = document.createElement('pre');
        this.backdrop.className = 'redactix-code-backdrop';
        this.backdrop.setAttribute('aria-hidden', 'true');
        this.backdropCode = document.createElement('code');
        this.backdrop.appendChild(this.backdropCode);

        // Textarea for editing
        this.textarea = document.createElement('textarea');
        this.textarea.className = 'redactix-code-textarea';
        this.textarea.value = content;
        this.textarea.spellcheck = false;
        this.textarea.autocomplete = 'off';
        this.textarea.autocorrect = 'off';
        this.textarea.autocapitalize = 'off';
        this.textarea.setAttribute('aria-label', this.t('toolbar.editHtml'));
        // Strictly disable soft wrap: one logical line = one
        // visual = one number. Without this, line numbers "drift" on
        // long lines (one line takes up two visual ones).
        this.textarea.setAttribute('wrap', 'off');

        // Event handlers. Every edit is synced: the code view is the
        // content while it's open (see getContentOverride).
        this.textarea.addEventListener('input', () => {
            this.scheduleRedraw();
            this.instance.sync();
        });
        this.textarea.addEventListener('keydown', (e) => this.handleKeydown(e));
        // Scroll of textarea is mirrored to the highlighted layer via transform —
        // unlike scrollLeft/scrollTop this works regardless of
        // whether the backdrop has its own overflow area
        // (vertically it doesn't: backdrop height is equal to content).
        this.textarea.addEventListener('scroll', () => this.syncBackdropScroll());

        // Hover on line number — highlight the corresponding line of code
        this.lineNumbers.addEventListener('mouseover', (e) => {
            const num = e.target.closest('.redactix-code-line-number');
            if (num) this.showLineHighlight(parseInt(num.dataset.line, 10));
        });
        this.lineNumbers.addEventListener('mouseleave', () => this.hideLineHighlight());

        // Rendering order: highlight strip → highlighted code → textarea
        this.codeMain.appendChild(this.lineHighlight);
        this.codeMain.appendChild(this.backdrop);
        this.codeMain.appendChild(this.textarea);

        this.editorContainer.appendChild(this.lineNumbers);
        this.editorContainer.appendChild(this.codeMain);
    }

    /**
     * Redraw: line numbers (only when the count changes), textarea height
     * and highlighting (only when the text changes). Runs once per frame
     * at most while typing (scheduleRedraw).
     */
    redraw() {
        if (!this.textarea) return;
        const value = this.textarea.value;
        const lineCount = this.countLines(value);
        this.updateLineNumbers(lineCount);
        this.updateHeight(lineCount);
        if (value !== this._highlightedValue) {
            this._highlightedValue = value;
            this.updateHighlight();
        }
    }

    scheduleRedraw() {
        if (this._redrawFrame != null) return;
        this._redrawFrame = requestAnimationFrame(() => {
            this._redrawFrame = null;
            if (this.textarea) this.redraw();
        });
    }

    countLines(value) {
        let count = 1;
        let i = -1;
        while ((i = value.indexOf('\n', i + 1)) !== -1) count++;
        return count;
    }

    updateLineNumbers(lineCount) {
        if (lineCount === this._lineCount) return;
        if (lineCount > this._lineCount) {
            const frag = document.createDocumentFragment();
            for (let i = this._lineCount; i < lineCount; i++) {
                const div = document.createElement('div');
                div.className = 'redactix-code-line-number';
                div.dataset.line = String(i);
                div.textContent = String(i + 1);
                frag.appendChild(div);
            }
            this.lineNumbers.appendChild(frag);
        } else {
            while (this.lineNumbers.childElementCount > lineCount) {
                this.lineNumbers.lastElementChild.remove();
            }
        }
        this._lineCount = lineCount;
    }

    /**
     * Height of the textarea from the line count (wrap is off, so lines ×
     * line-height is exact) — no `height: auto` collapse, which made the
     * page jump on every redraw. A horizontal scrollbar eats inner height
     * and would let the textarea scroll vertically (caret and selection
     * drifting off the highlight), so its thickness is added.
     */
    updateHeight(lineCount) {
        const ta = this.textarea;
        const content = this.PAD_TOP * 2 + lineCount * this.LINE_HEIGHT;
        const scrollbar = ta.isConnected ? Math.max(0, ta.offsetHeight - ta.clientHeight) : 0;
        const height = Math.max(this.MIN_HEIGHT, content + scrollbar) + 'px';
        if (ta.style.height !== height) ta.style.height = height;
    }

    /**
     * Shift of the highlighted layer following textarea scroll (horizontal —
     * long lines; vertical is normally impossible, but we mirror it too
     * just in case of transition states).
     */
    syncBackdropScroll() {
        if (!this.backdropCode || !this.textarea) return;
        this.backdropCode.style.transform =
            `translate(${-this.textarea.scrollLeft}px, ${-this.textarea.scrollTop}px)`;
    }

    // ---------- Syntax highlighting (own tokenizer, no dependencies) ----------

    /**
     * Redraw the highlighted copy in backdrop. Trailing \n is needed
     * so that <pre> does not collapse the last empty line (textarea shows
     * it, and heights must match).
     */
    updateHighlight() {
        if (!this.backdropCode) return;
        this.backdropCode.innerHTML = this.highlightHtml(this.textarea.value) + '\n';
        this.syncBackdropScroll();
    }

    escapeToken(s) {
        return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    /**
     * HTML tokenizer: comments, doctype, tags (name / attributes /
     * values), entities in text. Accepts raw code, returns
     * safe HTML with rx-tok-* spans.
     */
    highlightHtml(code) {
        let out = '';
        let lastIndex = 0;
        const re = /<!--[\s\S]*?(?:-->|$)|<!DOCTYPE[^>]*>?|<\/?[a-zA-Z][^>]*(?:>|$)/gi;
        let m;
        while ((m = re.exec(code)) !== null) {
            out += this.highlightText(code.slice(lastIndex, m.index));
            const tok = m[0];
            if (tok.startsWith('<!--')) {
                out += `<span class="rx-tok-comment">${this.escapeToken(tok)}</span>`;
            } else if (/^<!doctype/i.test(tok)) {
                out += `<span class="rx-tok-punct">${this.escapeToken(tok)}</span>`;
            } else {
                out += this.highlightTag(tok);
            }
            lastIndex = m.index + tok.length;
        }
        out += this.highlightText(code.slice(lastIndex));
        return out;
    }

    /** Text between tags: highlight only HTML entities. */
    highlightText(raw) {
        if (!raw) return '';
        const escaped = this.escapeToken(raw);
        // After escaping, original "&nbsp;" looks like "&amp;nbsp;"
        return escaped.replace(/&amp;(#?[a-zA-Z0-9]{1,32});/g,
            '<span class="rx-tok-entity">&amp;$1;</span>');
    }

    /** One tag: <(/)name attribute="value" ... (/)> */
    highlightTag(rawTag) {
        const m = rawTag.match(/^(<\/?)([a-zA-Z][\w:-]*)([\s\S]*?)(\/?>?)$/);
        if (!m) return this.escapeToken(rawTag);
        const [, open, name, attrs, close] = m;

        let out = `<span class="rx-tok-punct">${this.escapeToken(open)}</span>` +
            `<span class="rx-tok-tag">${this.escapeToken(name)}</span>`;

        // Attributes: name(=value)? — everything in between (spaces), as is
        let i = 0;
        const attrRe = /([a-zA-Z_:@][\w:.-]*)(?:(\s*=\s*)("[^"]*"?|'[^']*'?|[^\s"'=<>`]+))?/g;
        let am;
        while ((am = attrRe.exec(attrs)) !== null) {
            out += this.escapeToken(attrs.slice(i, am.index));
            out += `<span class="rx-tok-attr">${this.escapeToken(am[1])}</span>`;
            if (am[2]) out += `<span class="rx-tok-punct">${this.escapeToken(am[2])}</span>`;
            if (am[3]) out += `<span class="rx-tok-value">${this.escapeToken(am[3])}</span>`;
            i = am.index + am[0].length;
        }
        out += this.escapeToken(attrs.slice(i));
        out += `<span class="rx-tok-punct">${this.escapeToken(close)}</span>`;
        return out;
    }

    // ---------- Hover line highlighting ----------

    showLineHighlight(lineIndex) {
        if (!this.lineHighlight || !Number.isFinite(lineIndex)) return;
        this.lineHighlight.style.top = `${this.PAD_TOP + lineIndex * this.LINE_HEIGHT}px`;
        this.lineHighlight.style.height = `${this.LINE_HEIGHT}px`;
        this.lineHighlight.style.display = 'block';
    }

    hideLineHighlight() {
        if (this.lineHighlight) this.lineHighlight.style.display = 'none';
    }

    /**
     * Insert text at the selection through the browser's editing command,
     * so the textarea's native undo stack (Ctrl+Z) keeps working — assigning
     * textarea.value wiped it. Falls back to setRangeText.
     */
    insertText(text) {
        const ta = this.textarea;
        let ok = false;
        try {
            ok = text === ''
                ? document.execCommand('delete', false)
                : document.execCommand('insertText', false, text);
        } catch (e) {
            ok = false;
        }
        if (!ok) {
            ta.setRangeText(text, ta.selectionStart, ta.selectionEnd, 'end');
            ta.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }

    handleKeydown(e) {
        // Never interfere with IME composition (Enter confirms a candidate).
        if (e.isComposing || e.keyCode === 229) return;
        if (e.ctrlKey || e.metaKey || e.altKey) return;

        if (e.key === 'Tab') {
            e.preventDefault();
            this.handleTab(e.shiftKey);
            return;
        }

        // Enter - preserve indent of the current line
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const ta = this.textarea;
            const value = ta.value;
            const start = ta.selectionStart;
            const lineStart = value.lastIndexOf('\n', start - 1) + 1;
            const indent = value.slice(lineStart, start).match(/^[ \t]*/)[0];
            this.insertText('\n' + indent);
        }
    }

    /**
     * Tab: caret → insert an indent; selection → indent every touched line.
     * Shift+Tab: outdent every touched line (never past its own start).
     */
    handleTab(outdent) {
        const ta = this.textarea;
        const value = ta.value;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;

        if (!outdent && start === end) {
            this.insertText(INDENT);
            return;
        }

        // Lines touched by the selection. A selection ending right after a
        // newline does not include the next line.
        const lineStart = value.lastIndexOf('\n', start - 1) + 1;
        const effEnd = (end > start && value[end - 1] === '\n') ? end - 1 : end;
        let lineEnd = value.indexOf('\n', effEnd);
        if (lineEnd < 0) lineEnd = value.length;

        const lines = value.slice(lineStart, lineEnd).split('\n');
        const starts = [];
        let pos = lineStart;
        lines.forEach(line => {
            starts.push(pos);
            pos += line.length + 1;
        });

        // Characters added (+) / removed (−) at the start of each line
        const deltas = lines.map(line => {
            if (!outdent) return INDENT.length;
            const m = line.match(/^(?: {1,2}|\t)/);
            return m ? -m[0].length : 0;
        });
        if (deltas.every(d => d === 0)) return;

        const newBlock = lines.map((line, i) => (
            deltas[i] > 0 ? INDENT + line : line.slice(-deltas[i])
        )).join('\n');

        // Map an old offset to the new text
        const mapOffset = (p, isSelStart) => {
            let shift = 0;
            for (let i = 0; i < lines.length; i++) {
                const ls = starts[i];
                const le = ls + lines[i].length;
                if (p > le && i < lines.length - 1) {
                    shift += deltas[i];
                    continue;
                }
                if (p > le) return p + shift + deltas[i]; // past the block
                if (deltas[i] > 0) {
                    // Keep a selection that starts at a line start anchored there
                    if (p === ls && isSelStart && start !== end) return p + shift;
                    return p + shift + deltas[i];
                }
                return p + shift - Math.min(-deltas[i], p - ls);
            }
            return p + shift;
        };
        const newStart = mapOffset(start, true);
        const newEnd = mapOffset(end, false);

        ta.setSelectionRange(lineStart, lineEnd);
        this.insertText(newBlock);
        ta.setSelectionRange(newStart, newEnd);
    }

    disableToolbar(disable) {
        const buttons = this.instance.toolbar.element.querySelectorAll('button');
        buttons.forEach(btn => {
            // Do not disable HTML and Fullscreen buttons
            if (btn.dataset.command === 'html' || btn.dataset.command === 'fullscreen') return;

            btn.disabled = disable;
            // Clear (not '1' / 'auto') when enabling, so stylesheet rules apply again
            btn.style.opacity = disable ? '0.5' : '';
            btn.style.pointerEvents = disable ? 'none' : '';
        });
    }

    // ---------- Pretty printer (DOM based) ----------

    /**
     * Pretty-print clean HTML for the code view. Works on the parsed DOM:
     *   • block elements start on their own line, nested blocks indented;
     *   • inline content is printed exactly as serialised (no whitespace
     *     added or removed inside a run of text, so "<b>a</b> <i>b</i>"
     *     keeps its space);
     *   • <pre>, iframes and media are printed verbatim — the content of a
     *     code block round-trips byte for byte.
     * The return path (sanitizeLoadedHtml → normalizeWhitespace) drops the
     * indentation again, and only that.
     */
    beautifyHtml(html) {
        const root = parseHtmlInert(html);
        const lines = [];
        this.formatChildren(root, 0, lines);
        return lines.join('\n');
    }

    formatChildren(parent, depth, lines) {
        const pad = INDENT.repeat(depth);
        let run = [];
        const flushRun = () => {
            if (!run.length) return;
            const text = this.serializeNodes(run).trim();
            if (text) lines.push(pad + text);
            run = [];
        };

        Array.from(parent.childNodes).forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE && PRETTY_BLOCK_TAGS.has(node.tagName)) {
                flushRun();
                this.formatBlock(node, depth, lines);
            } else {
                run.push(node);
            }
        });
        flushRun();
    }

    formatBlock(el, depth, lines) {
        const pad = INDENT.repeat(depth);
        if (VERBATIM_TAGS.has(el.tagName)) {
            lines.push(pad + el.outerHTML);
            return;
        }
        const hasBlockChild = Array.from(el.children).some(c => PRETTY_BLOCK_TAGS.has(c.tagName));
        if (!hasBlockChild) {
            lines.push(pad + el.outerHTML);
            return;
        }
        const { open, close } = this.splitTag(el);
        lines.push(pad + open);
        this.formatChildren(el, depth + 1, lines);
        lines.push(pad + close);
    }

    /** Opening and closing tag of `el` as the serialiser writes them. */
    splitTag(el) {
        const shallow = el.cloneNode(false).outerHTML;
        const close = `</${el.localName}>`;
        const open = shallow.endsWith(close) ? shallow.slice(0, -close.length) : shallow;
        return { open, close };
    }

    serializeNodes(nodes) {
        const tmp = nodes[0].ownerDocument.createElement('div');
        nodes.forEach(n => tmp.appendChild(n.cloneNode(true)));
        return tmp.innerHTML;
    }
}
