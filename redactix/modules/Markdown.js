import Module from '../core/Module.js';
import { isBlockEmpty } from '../core/dom-utils.js';
import { getEditingContext, isAllowedIn, normalizeContainerChildren, HEADING_TAGS } from '../core/schema.js';

// Markdown-style block shortcuts, typed at the start of a line followed by
// a space. `kind` is what the block becomes — checked against the
// container rules (a quote-card body accepts no nested quote, a callout
// accepts no nested callout, …).
const RULES = [
    { prefix: '#', action: 'heading', tag: 'H1', kind: 'H1' },
    { prefix: '##', action: 'heading', tag: 'H2', kind: 'H2' },
    { prefix: '###', action: 'heading', tag: 'H3', kind: 'H3' },
    { prefix: '*', action: 'list', tag: 'UL', kind: 'UL' },
    { prefix: '-', action: 'list', tag: 'UL', kind: 'UL' },
    { prefix: '1.', action: 'list', tag: 'OL', kind: 'OL' },
    { prefix: '>', action: 'quote', kind: 'FIGURE' },
    { prefix: '!', action: 'callout', kind: 'ASIDE' },
    { prefix: '---', action: 'separator', kind: 'HR' }
];

const LINE_BLOCK_SELECTOR = 'p, h1, h2, h3, h4, h5, h6, li';

export default class Markdown extends Module {
    static moduleName = 'Markdown';

    init() {
        // Triggered from `input`, not keyup: with fast typing ("# H") the
        // keyup of the space arrives after the next character and the
        // shortcut was missed; on Android key === 'Unidentified' and keyup
        // never matched at all. The core dispatches a synthetic input event
        // for the space it inserts itself.
        this.editor.el.addEventListener('input', (e) => this.handleInput(e));
    }

    handleInput(e) {
        // Do not interfere with IME composition (Space selects a candidate)
        if (e.isComposing) return;
        if (e.inputType !== 'insertText' || typeof e.data !== 'string' || !/[ \u00A0]$/.test(e.data)) return;

        const selection = window.getSelection();
        if (!selection.rangeCount || !selection.isCollapsed) return;
        const caret = selection.getRangeAt(0);
        const root = this.editor.el;
        if (!root.contains(caret.startContainer)) return;

        const ctx = getEditingContext(caret.startContainer, root);
        // No block shortcuts inside captions, table cells or code.
        if (!ctx.inRoot || ctx.inFigcaption || ctx.inTable || ctx.inPre) return;

        const startEl = caret.startContainer.nodeType === Node.ELEMENT_NODE
            ? caret.startContainer : caret.startContainer.parentElement;
        let block = startEl && startEl !== root ? startEl.closest(LINE_BLOCK_SELECTOR) : null;
        if (block && !root.contains(block)) block = null;

        // Naked root text is wrapped into a <p> by the core's own input
        // handler (it runs first), so a missing block means "not a line".
        if (!block) return;

        const line = this.getLineBeforeCaret(block, caret);
        if (!line) return;
        const text = line.text.replace(/\u00A0/g, ' ');
        const rule = RULES.find(r => text === r.prefix + ' ');
        if (!rule) return;

        // Inside a list item only list rules make sense: "- " / "1. "
        // nests the item; headings / quotes would land directly in <ul>.
        if (ctx.inListItem) {
            if (rule.action !== 'list') return;
            this.transact(() => {
                line.range.deleteContents();
                document.execCommand('indent');
            });
            return;
        }

        if (!['P', ...HEADING_TAGS].includes(block.tagName)) return;
        // Only blocks that sit directly in a host (root / callout / quote
        // body) are converted.
        if (block.parentNode !== ctx.host) return;
        if (!isAllowedIn(ctx.host, rule.kind, root)) return;
        if (rule.action === 'heading' && block.tagName === rule.tag) return;

        this.transact(() => this.apply(rule, block, line, caret));
    }

    /**
     * Text between the start of the current line and the caret. A "line"
     * starts at the beginning of the block or right after a <br> that is a
     * direct child of the block.
     * @returns {{ text: string, range: Range, br: Element|null } | null}
     */
    getLineBeforeCaret(block, caret) {
        const range = document.createRange();
        range.setStart(block, 0);
        range.setEnd(caret.startContainer, caret.startOffset);

        let br = null;
        const brs = Array.from(block.querySelectorAll('br')).filter(b => range.intersectsNode(b));
        if (brs.length) {
            br = brs[brs.length - 1];
            if (br.parentNode !== block) return null;
            range.setStartAfter(br);
        }
        return { text: range.toString(), range, br };
    }

    apply(rule, block, line, caret) {
        const root = this.editor.el;

        // Caret marker: survives the node moves below (a Range boundary in a
        // moved node would collapse).
        const marker = document.createElement('span');
        caret.insertNode(marker);

        // Remove the typed prefix
        line.range.setEndBefore(marker);
        line.range.deleteContents();

        if (line.br) {
            // The shortcut was typed on a later line of the block
            // ("text<br># "): split the block at the <br>.
            const newBlock = block.cloneNode(false);
            newBlock.removeAttribute('id');
            let cur = line.br.nextSibling;
            while (cur) {
                const next = cur.nextSibling;
                newBlock.appendChild(cur);
                cur = next;
            }
            line.br.remove();
            block.parentNode.insertBefore(newBlock, block.nextSibling);
            block = newBlock;
        }

        let caretTarget = marker;

        switch (rule.action) {
            case 'heading': {
                const el = this.retag(block, rule.tag);
                block = el;
                break;
            }
            case 'callout': {
                const aside = this.retag(block, 'ASIDE');
                // Callout contract: the content of <aside> is block children.
                normalizeContainerChildren(aside, root);
                break;
            }
            case 'quote': {
                const figure = document.createElement('figure');
                figure.className = 'quote-card';
                const bq = document.createElement('blockquote');
                const p = document.createElement('p');
                while (block.firstChild) p.appendChild(block.firstChild);
                bq.appendChild(p);
                figure.appendChild(bq);
                block.parentNode.replaceChild(figure, block);
                // Wire the new card (contenteditable flags etc.)
                this.instance.setupContent();
                break;
            }
            case 'list': {
                const list = document.createElement(rule.tag);
                const li = document.createElement('li');
                while (block.firstChild) li.appendChild(block.firstChild);
                list.appendChild(li);
                block.parentNode.replaceChild(list, block);
                // Merge with a preceding list of the same type
                const prev = list.previousElementSibling;
                if (prev && prev.tagName === rule.tag) {
                    prev.appendChild(li);
                    list.remove();
                }
                break;
            }
            case 'separator': {
                const separator = this.getModule('Separator');
                if (!separator) break;
                // Separator before the block, caret in a fresh paragraph after
                // it; any text after the caret stays in the block below.
                marker.remove();
                caretTarget = null;
                let target = block;
                if (!isBlockEmpty(block, 'img, iframe')) {
                    target = document.createElement('p');
                    target.innerHTML = '<br>';
                    block.parentNode.insertBefore(target, block);
                } else if (block.tagName !== 'P') {
                    target = this.retag(block, 'P');
                }
                target.innerHTML = '<br>';
                const r = document.createRange();
                r.setStart(target, 0);
                r.collapse(true);
                const sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(r);
                separator.insertSeparator();
                break;
            }
        }

        if (caretTarget) this.placeCaretAtMarker(caretTarget);
    }

    /** Replace `el` with a new element of `tag`, moving its children. */
    retag(el, tag) {
        const next = document.createElement(tag);
        while (el.firstChild) next.appendChild(el.firstChild);
        el.parentNode.replaceChild(next, el);
        return next;
    }

    placeCaretAtMarker(marker) {
        const parent = marker.parentNode;
        if (!parent) return;
        const r = document.createRange();
        r.setStartBefore(marker);
        r.collapse(true);
        marker.remove();
        // An emptied block needs a <br> to keep its height and the caret.
        const block = parent.closest(LINE_BLOCK_SELECTOR) || parent;
        if (!block.textContent && !block.querySelector('br, img, iframe')) {
            block.appendChild(document.createElement('br'));
            r.setStart(block, 0);
            r.collapse(true);
        }
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(r);
    }
}
