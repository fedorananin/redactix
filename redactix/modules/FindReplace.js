import Module from '../core/Module.js';
import Icons from '../ui/Icons.js';
import { pushEscapeLayer } from '../core/layers.js';

const HIGHLIGHT_CLASS = 'redactix-find-highlight';
const CURRENT_CLASS = 'redactix-find-current';
const SEARCH_DEBOUNCE = 150;

function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default class FindReplace extends Module {
    static moduleName = 'FindReplace';

    constructor(instance) {
        super(instance);
        this.panel = null;
        this.isOpen = false;
        this.currentMatches = [];
        this.currentIndex = -1;
        this.lastQuery = null;
        this.searchTimer = null;
        this.popEscape = null;
    }

    init() {
        // In lite mode, completely disable search and replace
        if (this.instance.config.liteMode) {
            return;
        }

        // Ctrl+F / Ctrl+H to open search and replace
        // Use e.code to work correctly with any keyboard layout.
        // Global listener — via registry (removed in destroy()).
        this.instance.listen(document, 'keydown', (e) => {
            if (!(e.ctrlKey || e.metaKey) || (e.code !== 'KeyF' && e.code !== 'KeyH')) return;
            // Only when focus is in our editor
            if (!this.instance.wrapper.contains(document.activeElement)) return;
            // In HTML mode the visual editor is hidden and stale — leave
            // Ctrl+F to the browser's own find.
            if (this.isHtmlModeActive()) return;
            e.preventDefault();
            this.open();
        });

        this.instance.onDestroy(() => clearTimeout(this.searchTimer));
    }

    isHtmlModeActive() {
        const htmlMode = this.getModule('HtmlMode');
        return !!(htmlMode && htmlMode.isHtmlMode);
    }

    getButtons() {
        // In lite mode do not show the search button
        if (this.instance.config.liteMode) {
            return [];
        }

        return [
            {
                name: 'find',
                icon: Icons.search,
                title: this.t('toolbar.findReplace'),
                action: () => this.open()
            }
        ];
    }

    open() {
        if (this.isHtmlModeActive()) return;

        if (this.isOpen) {
            // If already open, focus on the search field
            const searchInput = this.panel.querySelector('.redactix-find-input');
            if (searchInput) {
                searchInput.focus();
                searchInput.select();
            }
            return;
        }

        // Capture the selection before focus moves into the panel
        const selection = window.getSelection();
        let selectedText = '';
        if (selection.rangeCount > 0 && this.instance.editorEl.contains(selection.anchorNode)) {
            selectedText = selection.toString().trim();
        }

        this.isOpen = true;
        this.createPanel();
        this.instance.wrapper.appendChild(this.panel);

        // Escape closes the panel — but only when pressed inside this
        // editor; Escape elsewhere on the page is none of our business.
        this.popEscape = pushEscapeLayer(() => this.close(), { scope: this.instance.wrapper });

        const searchInput = this.panel.querySelector('.redactix-find-input');
        searchInput.focus();

        // If there is selected text, insert it into the search field
        if (selectedText && selectedText.length < 100 && !selectedText.includes('\n')) {
            searchInput.value = selectedText;
            this.search(selectedText);
        }
    }

    close({ focus = true } = {}) {
        clearTimeout(this.searchTimer);
        this.searchTimer = null;
        if (this.popEscape) {
            this.popEscape();
            this.popEscape = null;
        }
        const hadFocus = !!(this.panel && this.panel.contains(document.activeElement));
        this.clearHighlights();
        if (this.panel && this.panel.parentNode) {
            this.panel.parentNode.removeChild(this.panel);
        }
        this.panel = null;
        this.isOpen = false;
        this.currentMatches = [];
        this.currentIndex = -1;
        this.lastQuery = null;

        // Return focus to the editor — only if it was in the panel
        if (focus && hadFocus && this.instance.editorEl.style.display !== 'none') {
            this.instance.editorEl.focus();
        }
    }

    /**
     * HTML mode → close the panel. Content replaced wholesale (undo/redo,
     * setContent) → keep the panel open, drop matches that point at the
     * detached nodes and search the new content again.
     */
    hideUI(reason) {
        if (!this.isOpen) return;
        if (reason === 'contentReplaced' && !this.isHtmlModeActive()) {
            this.currentMatches = [];
            this.currentIndex = -1;
            this.lastQuery = null;
            this.scheduleSearch();
            return;
        }
        this.close({ focus: false });
    }

    createPanel() {
        this.panel = document.createElement('div');
        this.panel.className = 'redactix-find-panel';

        this.panel.innerHTML = `
            <div class="redactix-find-row">
                <input type="text" class="redactix-find-input">
                <span class="redactix-find-count"></span>
                <button type="button" class="redactix-find-btn" data-action="prev">
                    ${Icons.chevronUp}
                </button>
                <button type="button" class="redactix-find-btn" data-action="next">
                    ${Icons.chevronDown}
                </button>
                <button type="button" class="redactix-find-btn" data-action="close">
                    ${Icons.close}
                </button>
            </div>
            <div class="redactix-replace-row">
                <input type="text" class="redactix-replace-input">
                <button type="button" class="redactix-find-btn redactix-replace-btn" data-action="replace"></button>
                <button type="button" class="redactix-find-btn redactix-replace-btn" data-action="replaceAll"></button>
            </div>
        `;

        // Translated strings are set as properties, never interpolated
        // into the template (a locale string is not markup).
        const searchInput = this.panel.querySelector('.redactix-find-input');
        const replaceInput = this.panel.querySelector('.redactix-replace-input');
        searchInput.placeholder = this.t('findReplace.findPlaceholder');
        replaceInput.placeholder = this.t('findReplace.replacePlaceholder');
        const setBtn = (action, title, text) => {
            const btn = this.panel.querySelector(`[data-action="${action}"]`);
            btn.title = title;
            btn.setAttribute('aria-label', title);
            if (text) btn.textContent = text;
        };
        setBtn('prev', this.t('findReplace.previousTooltip'));
        setBtn('next', this.t('findReplace.nextTooltip'));
        setBtn('close', this.t('findReplace.closeTooltip'));
        setBtn('replace', this.t('findReplace.replace'), this.t('findReplace.replace'));
        setBtn('replaceAll', this.t('findReplace.replaceAll'), this.t('findReplace.replaceAll'));

        // Typing in the search box: debounced — every pass re-wraps the
        // matches in the whole document.
        searchInput.addEventListener('input', () => this.scheduleSearch());

        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.isComposing) {
                e.preventDefault();
                this.flushSearch();
                if (e.shiftKey) {
                    this.goToPrev();
                } else {
                    this.goToNext();
                }
            }
            if (e.key === 'Tab' && !e.shiftKey) {
                e.preventDefault();
                replaceInput.focus();
            }
        });

        replaceInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.isComposing) {
                e.preventDefault();
                this.flushSearch();
                if (e.shiftKey) {
                    this.replaceAll();
                } else {
                    this.replaceCurrent();
                }
            }
        });

        // Buttons
        this.panel.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;

            this.flushSearch();
            const action = btn.dataset.action;
            switch (action) {
                case 'prev':
                    this.goToPrev();
                    break;
                case 'next':
                    this.goToNext();
                    break;
                case 'close':
                    this.close();
                    break;
                case 'replace':
                    this.replaceCurrent();
                    break;
                case 'replaceAll':
                    this.replaceAll();
                    break;
            }
        });
    }

    getQuery() {
        const input = this.panel && this.panel.querySelector('.redactix-find-input');
        return input ? input.value : '';
    }

    scheduleSearch() {
        clearTimeout(this.searchTimer);
        this.searchTimer = setTimeout(() => {
            this.searchTimer = null;
            this.runSearchIfChanged();
        }, SEARCH_DEBOUNCE);
    }

    /** Run a pending debounced search right now (Enter / button click). */
    flushSearch() {
        if (this.searchTimer) {
            clearTimeout(this.searchTimer);
            this.searchTimer = null;
        }
        this.runSearchIfChanged();
    }

    runSearchIfChanged() {
        if (!this.isOpen) return;
        const query = this.getQuery();
        if (query === this.lastQuery) return;
        this.search(query);
    }

    /** Text nodes of the editor that search may touch. */
    collectTextNodes() {
        const root = this.instance.editorEl;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode: (node) => {
                if (!node.data) return NodeFilter.FILTER_REJECT;
                const parent = node.parentElement;
                if (!parent) return NodeFilter.FILTER_REJECT;
                // Editor UI (edit buttons, gap handles …) is not content.
                if (parent.closest('[data-redactix-ui]')) return NodeFilter.FILTER_REJECT;
                // Read-only islands (code blocks, figure chrome): replacing
                // text there would bypass their own editors.
                const ce = parent.closest('[contenteditable]');
                if (ce && ce !== root && ce.getAttribute('contenteditable') === 'false') {
                    return NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_ACCEPT;
            }
        });
        const nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);
        return nodes;
    }

    /**
     * Case-insensitive, non-overlapping matches of `query` inside one string.
     * Matching runs on the ORIGINAL text with a 'iu' RegExp, so characters
     * whose lower-case form has a different length (Turkish İ …) can't
     * shift the match positions.
     */
    findInText(text, query) {
        const re = new RegExp(escapeRegExp(query), 'giu');
        const out = [];
        let m;
        while ((m = re.exec(text)) !== null) {
            if (m[0].length === 0) {
                re.lastIndex++;
                continue;
            }
            out.push({ start: m.index, end: m.index + m[0].length });
        }
        return out;
    }

    search(query) {
        this.clearHighlights();
        this.currentMatches = [];
        this.currentIndex = -1;
        this.lastQuery = query;

        if (!query) {
            this.updateCount();
            return;
        }

        const found = [];
        this.collectTextNodes().forEach(node => {
            this.findInText(node.data, query).forEach(r => {
                found.push({ node, start: r.start, end: r.end });
            });
        });

        this.highlightAll(found);
        this.updateCount();

        if (this.currentMatches.length > 0) {
            this.currentIndex = 0;
            this.highlightCurrent();
        }
    }

    /**
     * Wrap every match in <mark>. Matches inside one text node are applied
     * from the end with splitText, so earlier offsets stay valid; overlapping
     * ranges are skipped (a character is never wrapped twice — the old
     * fragment-rebuild duplicated shared characters on overlap).
     */
    highlightAll(found) {
        const byNode = new Map();
        found.forEach(match => {
            if (!byNode.has(match.node)) byNode.set(match.node, []);
            byNode.get(match.node).push(match);
        });

        byNode.forEach((matches, textNode) => {
            matches.sort((a, b) => a.start - b.start);
            const accepted = [];
            let lastEnd = 0;
            matches.forEach(m => {
                if (m.start < lastEnd || m.end > textNode.data.length || m.end <= m.start) return;
                accepted.push(m);
                lastEnd = m.end;
            });

            for (let i = accepted.length - 1; i >= 0; i--) {
                const { start, end } = accepted[i];
                if (end < textNode.data.length) textNode.splitText(end);
                const middle = start > 0 ? textNode.splitText(start) : textNode;
                const mark = document.createElement('mark');
                mark.className = HIGHLIGHT_CLASS;
                middle.parentNode.insertBefore(mark, middle);
                mark.appendChild(middle);
            }
        });

        // Document order
        const marks = this.instance.editorEl.querySelectorAll('.' + HIGHLIGHT_CLASS);
        this.currentMatches = Array.from(marks).map((mark, i) => ({
            element: mark,
            index: i
        }));
    }

    clearHighlights() {
        const marks = this.instance.editorEl.querySelectorAll('.' + HIGHLIGHT_CLASS);
        const parents = new Set();
        marks.forEach(mark => {
            const parent = mark.parentNode;
            if (!parent) return;
            // Unwrap, keeping whatever the user did inside the mark
            // (formatting applied to a highlighted word).
            while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
            mark.remove();
            parents.add(parent);
        });
        parents.forEach(p => {
            if (p.isConnected) p.normalize();
        });
    }

    highlightCurrent() {
        // Remove previous current highlight
        const prevCurrent = this.instance.editorEl.querySelector('.' + CURRENT_CLASS);
        if (prevCurrent) {
            prevCurrent.classList.remove(CURRENT_CLASS);
        }

        if (this.currentIndex >= 0 && this.currentIndex < this.currentMatches.length) {
            const match = this.currentMatches[this.currentIndex];
            if (match.element && match.element.isConnected) {
                match.element.classList.add(CURRENT_CLASS);
                match.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }

        this.updateCount();
    }

    goToNext() {
        if (this.currentMatches.length === 0) return;
        this.currentIndex = (this.currentIndex + 1) % this.currentMatches.length;
        this.highlightCurrent();
    }

    goToPrev() {
        if (this.currentMatches.length === 0) return;
        this.currentIndex = (this.currentIndex - 1 + this.currentMatches.length) % this.currentMatches.length;
        this.highlightCurrent();
    }

    updateCount() {
        const countEl = this.panel?.querySelector('.redactix-find-count');
        if (!countEl) return;

        if (this.currentMatches.length === 0) {
            if (this.getQuery()) {
                countEl.textContent = this.t('findReplace.noResults');
                countEl.classList.add('not-found');
            } else {
                countEl.textContent = '';
                countEl.classList.remove('not-found');
            }
        } else {
            countEl.textContent = this.t('findReplace.matchCount', {
                current: Math.max(1, this.currentIndex + 1),
                total: this.currentMatches.length
            });
            countEl.classList.remove('not-found');
        }
    }

    /**
     * Character offset of (node, offset) in the concatenated text of the
     * editor. Survives the split/merge of text nodes that re-highlighting
     * does, so it can locate "the first match after X" after a re-search.
     */
    textOffsetOf(node, offset) {
        const walker = document.createTreeWalker(this.instance.editorEl, NodeFilter.SHOW_TEXT);
        let total = 0;
        while (walker.nextNode()) {
            const n = walker.currentNode;
            if (n === node) return total + offset;
            total += n.data.length;
        }
        return total;
    }

    replaceCurrent() {
        if (this.currentIndex < 0 || this.currentIndex >= this.currentMatches.length) return;

        const replaceInput = this.panel.querySelector('.redactix-replace-input');
        const replaceText = replaceInput.value;
        const match = this.currentMatches[this.currentIndex];
        if (!match.element || !match.element.isConnected) return;

        this.transact(() => {
            const text = document.createTextNode(replaceText);
            match.element.parentNode.replaceChild(text, match.element);
            // Remember where the replacement ends — the search must continue
            // AFTER it ("cat" → "cats" must not hit the same word again).
            const resumeAt = this.textOffsetOf(text, text.data.length);

            this.search(this.getQuery());

            if (this.currentMatches.length > 0) {
                let next = this.currentMatches.findIndex(m => {
                    const first = m.element.firstChild;
                    return first && this.textOffsetOf(first, 0) >= resumeAt;
                });
                if (next < 0) next = 0; // wrap around
                this.currentIndex = next;
                this.highlightCurrent();
            }
        });
    }

    replaceAll() {
        if (this.currentMatches.length === 0) return;

        const replaceInput = this.panel.querySelector('.redactix-replace-input');
        const replaceText = replaceInput.value;

        this.transact(() => {
            // Replace all from the end
            for (let i = this.currentMatches.length - 1; i >= 0; i--) {
                const match = this.currentMatches[i];
                if (match.element && match.element.parentNode) {
                    const text = document.createTextNode(replaceText);
                    match.element.parentNode.replaceChild(text, match.element);
                }
            }
            this.instance.editorEl.normalize();

            // Restart search
            this.search(this.getQuery());
        });
    }
}
