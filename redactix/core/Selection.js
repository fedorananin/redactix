import { isBlockTag, isAtomicBlock } from './dom-utils.js';
import { findInsertionPoint, blockKind } from './schema.js';

export default class Selection {
    constructor(editor) {
        this.editor = editor;
        this.savedRange = null;
    }

    /**
     * Saves the current selection (Range) — only if it is inside this editor.
     */
    save() {
        const sel = window.getSelection();
        if (sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            if (this.editor.el.contains(range.startContainer)) {
                this.savedRange = range.cloneRange();
            }
        }
    }

    /**
     * Restores the saved selection (if its nodes are still in this editor).
     */
    restore() {
        if (this.savedRange && this.editor.el.contains(this.savedRange.startContainer)) {
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(this.savedRange);
            return true;
        }
        return false;
    }

    /**
     * Returns the current Range
     */
    getRange() {
        const sel = window.getSelection();
        return sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
    }

    /** Range to insert at: the live selection if it is inside the editor, else the saved one. */
    getInsertionRange() {
        const liveRange = this.getRange();
        if (liveRange && this.editor.el.contains(liveRange.startContainer)) return liveRange;
        if (this.savedRange && this.editor.el.contains(this.savedRange.startContainer)) return this.savedRange;
        return null;
    }

    /**
     * Inserts a node (or a DocumentFragment) at the current cursor position.
     *
     * Block content is inserted at block level, respecting container rules:
     * a table can't go into a quote-card, so it lands after the card; with the
     * caret in a list item it lands after the list, in a table cell — after
     * the table. An empty paragraph at the caret is replaced.
     *
     * @param {Node} node
     */
    insertNode(node) {
        const isFragment = node.nodeType === Node.DOCUMENT_FRAGMENT_NODE;
        const topNodes = isFragment ? Array.from(node.childNodes) : [node];
        const elements = topNodes.filter(n => n.nodeType === Node.ELEMENT_NODE);
        const isBlockContent = elements.length > 0 && elements.every(el => isBlockTag(el.tagName) && el.tagName !== 'LI');

        // Prefer the live selection, but if it points outside the editor
        // (Chrome doesn't always honour addRange() when focus is on a modal
        // button), fall back to the explicitly saved range. As a last resort,
        // append the block to the end of the editor so the user at least
        // sees the result. Inline inserts have no good last-resort, so they bail.
        const range = this.getInsertionRange();
        const root = this.editor.el;

        if (!isBlockContent) {
            if (!range) return;
            range.deleteContents();
            range.insertNode(node);
            const last = topNodes[topNodes.length - 1];
            const r = document.createRange();
            if (last && last.parentNode) r.setStartAfter(last);
            else r.setStart(range.startContainer, range.startOffset);
            r.collapse(true);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(r);
            return;
        }

        const kinds = elements.map(el => blockKind(el));
        const point = range ? findInsertionPoint(range.startContainer, kinds, root) : null;

        if (point) {
            const { host, block } = point;
            const isEmptyTextBlock = ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(block.tagName) &&
                block.textContent.trim() === '' &&
                !block.querySelector('img, iframe, video, audio, table');
            host.insertBefore(node, block.nextSibling);
            if (isEmptyTextBlock) block.remove();
        } else if (range && range.startContainer === root) {
            // Caret between two top-level blocks.
            root.insertBefore(node, root.childNodes[range.startOffset] || null);
        } else {
            root.appendChild(node);
        }

        this.placeCaretAfterBlock(topNodes[topNodes.length - 1]);
    }

    /**
     * After inserting a block, put the caret somewhere the user can type:
     * the next editable block, or a new paragraph if the inserted block is
     * atomic and nothing editable follows it.
     */
    placeCaretAfterBlock(block) {
        if (!block || !block.parentNode) return;
        const sel = window.getSelection();
        const r = document.createRange();

        let target = block.nodeType === Node.ELEMENT_NODE && !isAtomicBlock(block) && block.isContentEditable
            ? block : null;
        if (!target) {
            const next = block.nextElementSibling;
            if (next && !isAtomicBlock(next) && next.isContentEditable) {
                r.setStart(next, 0);
                r.collapse(true);
                sel.removeAllRanges();
                sel.addRange(r);
                return;
            }
            if (isAtomicBlock(block)) {
                const p = document.createElement('p');
                p.innerHTML = '<br>';
                block.parentNode.insertBefore(p, block.nextSibling);
                r.setStart(p, 0);
                r.collapse(true);
                sel.removeAllRanges();
                sel.addRange(r);
                return;
            }
            r.setStartAfter(block);
            r.collapse(true);
        } else {
            r.selectNodeContents(target);
            r.collapse(false);
        }
        sel.removeAllRanges();
        sel.addRange(r);
    }

    /**
     * Excludes trailing spaces from selection
     */
    excludeTrailingSpacesFromSelection() {
        const sel = window.getSelection();
        if (!sel.rangeCount) return;

        const range = sel.getRangeAt(0);
        if (range.collapsed) return;

        if (range.endContainer.nodeType === Node.TEXT_NODE) {
            const text = range.endContainer.textContent;
            let endOffset = range.endOffset;

            const startOffset = (range.startContainer === range.endContainer) ? range.startOffset : 0;

            // Check spaces (normal and non-breaking)
            while (endOffset > startOffset && /[\s ]/.test(text[endOffset - 1])) {
                endOffset--;
            }

            if (endOffset < range.endOffset) {
                range.setEnd(range.endContainer, endOffset);
                sel.removeAllRanges();
                sel.addRange(range);
            }
        }
    }
}
