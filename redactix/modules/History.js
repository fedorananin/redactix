import Module from '../core/Module.js';

/**
 * Undo / redo.
 *
 * Model: `undoStack` holds committed states, the top one is the state the
 * editor was in at the last commit. A state is the CLEAN serialisation
 * (instance.serializeClean — exactly what gets saved) plus a caret path.
 *
 * What gets recorded:
 *   • typing and any other DOM change — a MutationObserver schedules a
 *     debounced commit, so programmatic edits by modules (tables, media,
 *     find & replace, attributes …) are recorded even though they fire no
 *     `input` event;
 *   • explicit transactions — instance.transact(fn) commits pending typing
 *     before `fn` and the result after it, making `fn` exactly one step;
 *   • batches — beginBatch()/endBatch() for gestures spanning many events
 *     (block drag): intermediate states are not recorded.
 *
 * undo() first commits anything not yet recorded, so pressing Ctrl+Z right
 * after typing (inside the debounce window) undoes exactly that typing
 * instead of jumping two steps back.
 */
export default class History extends Module {
    static moduleName = 'History';

    constructor(instance) {
        super(instance);
        this.undoStack = [];
        this.redoStack = [];
        // Bound by total size rather than count: a single base64 image can
        // make each snapshot megabytes long. ~16M UTF-16 chars ≈ 32 MB.
        this.maxChars = 16 * 1024 * 1024;
        this.maxHistory = 200;
        this.debounceDelay = 300;
        this.debounceTimer = null;
        this.lastSavedContent = '';
        this.batchInProgress = false;
        this.transactionDepth = 0;
        this.isUndoRedo = false;
        this.totalChars = 0;
    }

    init() {
        // Initial state; reset() is called again once the content is fully
        // set up (end of render / setContent).
        this.reset();

        // Any DOM change → debounced commit. Attributes are included so that
        // class / preset / data-* edits are undoable; UI-only attribute churn
        // is filtered out by comparing clean serialisations.
        this.observer = new MutationObserver(() => {
            if (this.isUndoRedo || this.batchInProgress || this.transactionDepth > 0) return;
            this.debounceSave();
        });
        this.observer.observe(this.instance.editorEl, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true
        });
        this.instance.onDestroy(() => {
            this.observer.disconnect();
            clearTimeout(this.debounceTimer);
        });

        // Handle Ctrl+Z and Ctrl+Y (use e.code to be layout-independent)
        this.instance.editorEl.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && !e.altKey && e.code === 'KeyZ' && !e.shiftKey) {
                e.preventDefault();
                this.undo();
            } else if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.code === 'KeyY' || (e.code === 'KeyZ' && e.shiftKey))) {
                e.preventDefault();
                this.redo();
            }
        });
    }

    /** Clean HTML of the current visual content. */
    snapshot() {
        return this.instance.serializeClean().html;
    }

    debounceSave() {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
            this.debounceTimer = null;
            this.saveState();
        }, this.debounceDelay);
    }

    /** Commit any pending (debounced) change right now. */
    flush() {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
        if (!this.isUndoRedo) this.saveState();
    }

    saveState() {
        if (this.instance.destroyed) return false;
        const currentContent = this.snapshot();

        // Do not save if content hasn't changed
        if (currentContent === this.lastSavedContent) {
            return false;
        }

        this.pushUndo({
            html: currentContent,
            selection: this.saveSelection()
        });

        // Clear redo on new change
        this.redoStack = [];
        this.lastSavedContent = currentContent;
        return true;
    }

    pushUndo(state) {
        this.undoStack.push(state);
        this.totalChars += state.html.length;
        // Trim the oldest states, always keeping at least two (current +
        // one step back).
        while (this.undoStack.length > 2 &&
            (this.totalChars > this.maxChars || this.undoStack.length > this.maxHistory)) {
            const dropped = this.undoStack.shift();
            this.totalChars -= dropped.html.length;
        }
    }

    popUndo() {
        const state = this.undoStack.pop();
        if (state) this.totalChars -= state.html.length;
        return state;
    }

    saveSelection() {
        const selection = window.getSelection();
        if (!selection.rangeCount) return null;

        const range = selection.getRangeAt(0);
        const root = this.instance.editorEl;
        if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;

        // Save position as node path
        return {
            startPath: this.getNodePath(range.startContainer),
            startOffset: range.startOffset,
            endPath: this.getNodePath(range.endContainer),
            endOffset: range.endOffset,
            collapsed: range.collapsed
        };
    }

    restoreSelection(selectionData) {
        if (!selectionData) return;

        try {
            const startNode = this.getNodeByPath(selectionData.startPath);
            const endNode = this.getNodeByPath(selectionData.endPath);

            if (!startNode || !endNode) return;

            const maxOffset = (n) => n.nodeType === Node.TEXT_NODE ? n.length : n.childNodes.length;
            const range = document.createRange();
            range.setStart(startNode, Math.min(selectionData.startOffset, maxOffset(startNode)));
            range.setEnd(endNode, Math.min(selectionData.endOffset, maxOffset(endNode)));

            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
        } catch (e) {
            // Cursor position might be invalid after undo/redo
        }
    }

    getNodePath(node) {
        const path = [];
        let current = node;

        while (current && current !== this.instance.editorEl) {
            const parent = current.parentNode;
            if (!parent) break;

            const index = Array.prototype.indexOf.call(parent.childNodes, current);
            path.unshift(index);
            current = parent;
        }

        return path;
    }

    getNodeByPath(path) {
        let current = this.instance.editorEl;

        for (const index of path) {
            if (!current.childNodes[index]) {
                return current;
            }
            current = current.childNodes[index];
        }

        return current;
    }

    undo() {
        // Record whatever is on screen but not yet committed (typing within
        // the debounce window, or a module change) so it becomes the step
        // that gets undone.
        this.flush();
        if (this.batchInProgress || this.transactionDepth > 0) return;
        if (this.undoStack.length <= 1) return;

        const current = this.popUndo();
        this.redoStack.push(current);
        this.applyState(this.undoStack[this.undoStack.length - 1]);
    }

    redo() {
        this.flush();
        if (this.batchInProgress || this.transactionDepth > 0) return;
        if (this.redoStack.length === 0) return;

        const nextState = this.redoStack.pop();
        this.pushUndo(nextState);
        this.applyState(nextState);
    }

    applyState(state) {
        this.isUndoRedo = true;
        try {
            // The state is our own clean output: no sanitising or whitespace
            // collapsing needed, just the regular setup pass to put the
            // presentational wrappers back.
            this.instance.replaceContent(state.html, { sanitize: false });
            this.restoreSelection(state.selection);
            // Mutation records produced by the restore itself are not a
            // user change.
            this.observer.takeRecords();
            // What setup produced may differ cosmetically from the stored
            // string — compare future edits against the real result.
            this.lastSavedContent = this.snapshot();
            this.instance.sync();
        } finally {
            this.isUndoRedo = false;
        }
    }

    // Force save state (kept for external callers)
    forceSave() {
        this.flush();
    }

    // ---- transactions (instance.transact) ----

    beginTransaction() {
        if (this.transactionDepth === 0 && !this.batchInProgress) this.flush();
        this.transactionDepth++;
    }

    endTransaction() {
        this.transactionDepth = Math.max(0, this.transactionDepth - 1);
        if (this.transactionDepth === 0 && !this.batchInProgress) {
            this.observer.takeRecords();
            this.saveState();
        }
    }

    // ---- batches (multi-event gestures such as block drag) ----

    // Begin batch operation: commits pending typing, then suspends recording.
    beginBatch() {
        if (this.batchInProgress) return;
        this.flush();
        this.batchInProgress = true;
    }

    // End batch operation: the gesture's end result becomes one step.
    endBatch() {
        if (!this.batchInProgress) return;
        this.batchInProgress = false;
        this.observer.takeRecords();
        this.saveState();
    }

    // Reset history (on load / setContent)
    reset() {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = null;
        this.undoStack = [];
        this.redoStack = [];
        this.totalChars = 0;
        this.batchInProgress = false;
        this.transactionDepth = 0;
        this.lastSavedContent = this.snapshot();
        this.pushUndo({
            html: this.lastSavedContent,
            selection: null
        });
        if (this.observer) this.observer.takeRecords();
    }
}
