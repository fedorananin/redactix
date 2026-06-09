export default class Selection {
    constructor(editor) {
        this.editor = editor;
        this.savedRange = null;
    }

    /**
     * Saves the current selection (Range)
     */
    save() {
        const sel = window.getSelection();
        if (sel.rangeCount > 0) {
            this.savedRange = sel.getRangeAt(0).cloneRange();
        }
    }

    /**
     * Restores the saved selection
     */
    restore() {
        if (this.savedRange) {
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(this.savedRange);
        }
    }

    /**
     * Returns the current Range
     */
    getRange() {
        const sel = window.getSelection();
        return sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
    }

    /**
     * Inserts a node at the current cursor position
     * @param {Node} node 
     */
    insertNode(node) {
        const isBlockElement = node.nodeType === Node.ELEMENT_NODE &&
            ['FIGURE', 'DIV', 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'TABLE', 'BLOCKQUOTE', 'PRE', 'HR', 'ASIDE'].includes(node.tagName);

        // Pick the range to insert at. Prefer the live selection, but if
        // it points outside the editor (Chrome doesn't always honour
        // addRange() when focus is on a modal button — the live range
        // ends up still in the modal), fall back to the explicitly saved
        // range. As a last resort, append the block to the end of the
        // editor so the user at least sees the result instead of a silent
        // no-op. Inline inserts have no good last-resort, so they bail.
        const liveRange = this.getRange();
        let range = null;
        if (liveRange && this.editor.el.contains(liveRange.startContainer)) {
            range = liveRange;
        } else if (this.savedRange && this.editor.el.contains(this.savedRange.startContainer)) {
            range = this.savedRange;
        }

        if (!range) {
            if (!isBlockElement) return;
            this.editor.el.appendChild(node);
            const newRange = document.createRange();
            newRange.setStartAfter(node);
            newRange.setEndAfter(node);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(newRange);
            return;
        }

        if (isBlockElement) {
            // For block elements: insert at block level
            let block = range.startContainer;
            
            // Find the nearest block parent
            while (block && block !== this.editor.el) {
                if (block.nodeType === Node.ELEMENT_NODE && 
                    ['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'BLOCKQUOTE', 'FIGURE', 'PRE', 'ASIDE'].includes(block.tagName)) {
                    break;
                }
                block = block.parentNode;
            }

            if (block && block !== this.editor.el && block.parentNode) {
                // Check if the current block is empty
                const isEmpty = block.textContent.trim() === '' && 
                    !block.querySelector('img, iframe, video, audio, table');
                
                // Insert after the current block
                block.parentNode.insertBefore(node, block.nextSibling);
                
                // Remove empty block
                if (isEmpty) {
                    block.remove();
                }
            } else {
                // If block not found, append to the end of the editor
                this.editor.el.appendChild(node);
            }

            // Move cursor after the inserted element
            const newRange = document.createRange();
            newRange.setStartAfter(node);
            newRange.setEndAfter(node);
            
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(newRange);
        } else {
            // For inline elements: standard behavior
            range.deleteContents();
            range.insertNode(node);
            
            // Move cursor after the inserted element
            range.setStartAfter(node);
            range.setEndAfter(node); 
            
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        }
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
            while (endOffset > startOffset && /[\s\u00A0]/.test(text[endOffset - 1])) {
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
