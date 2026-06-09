import Module from '../core/Module.js';

export default class History extends Module {
    constructor(instance) {
        super(instance);
        this.undoStack = [];
        this.redoStack = [];
        this.maxHistory = 100;
        this.isUndoRedo = false;
        this.debounceTimer = null;
        this.lastSavedContent = '';
        this.batchInProgress = false;
    }

    init() {
        // Save initial state
        this.lastSavedContent = this.instance.editorEl.innerHTML;
        this.undoStack.push({
            html: this.lastSavedContent,
            selection: null
        });

        // Listen for changes to write to history
        this.instance.editorEl.addEventListener('input', () => {
            if (!this.isUndoRedo && !this.batchInProgress) {
                this.debounceSave();
            }
        });

        // Handle Ctrl+Z and Ctrl+Y (use e.code to be layout-independent)
        this.instance.editorEl.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ' && !e.shiftKey) {
                e.preventDefault();
                this.undo();
            }
            if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyY' || (e.code === 'KeyZ' && e.shiftKey))) {
                e.preventDefault();
                this.redo();
            }
        });
    }

    debounceSave() {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        this.debounceTimer = setTimeout(() => {
            this.saveState();
        }, 300);
    }

    saveState(force = false) {
        const currentContent = this.instance.editorEl.innerHTML;
        
        // Do not save if content hasn't changed (unless forced)
        if (!force && currentContent === this.lastSavedContent) {
            return;
        }

        // Save cursor position
        const selectionData = this.saveSelection();

        this.undoStack.push({
            html: currentContent,
            selection: selectionData
        });

        // Limit history size
        if (this.undoStack.length > this.maxHistory) {
            this.undoStack.shift();
        }

        // Clear redo on new change
        this.redoStack = [];
        
        this.lastSavedContent = currentContent;
    }

    saveSelection() {
        const selection = window.getSelection();
        if (!selection.rangeCount) return null;

        const range = selection.getRangeAt(0);
        
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

            const range = document.createRange();
            range.setStart(startNode, Math.min(selectionData.startOffset, startNode.length || startNode.childNodes.length));
            range.setEnd(endNode, Math.min(selectionData.endOffset, endNode.length || endNode.childNodes.length));

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
            
            const index = Array.from(parent.childNodes).indexOf(current);
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
        if (this.undoStack.length <= 1) return;

        // Save current state to redo
        const currentState = {
            html: this.instance.editorEl.innerHTML,
            selection: this.saveSelection()
        };
        this.redoStack.push(currentState);

        // Restore previous state
        this.undoStack.pop(); // Remove current
        const prevState = this.undoStack[this.undoStack.length - 1];

        this.applyState(prevState);
    }

    redo() {
        if (this.redoStack.length === 0) return;

        // Save current state
        const currentState = {
            html: this.instance.editorEl.innerHTML,
            selection: this.saveSelection()
        };
        this.undoStack.push(currentState);

        // Restore next state
        const nextState = this.redoStack.pop();
        this.applyState(nextState);
    }

    applyState(state) {
        this.isUndoRedo = true;
        
        this.instance.editorEl.innerHTML = state.html;
        this.lastSavedContent = state.html;
        
        // Restore wrappers and settings
        if (this.instance.wrapSeparators) {
            this.instance.wrapSeparators();
        }
        if (this.instance.setupFigures) {
            this.instance.setupFigures();
        }
        if (this.instance.setupCodeBlocks) {
            this.instance.setupCodeBlocks();
        }
        if (this.instance.runQuoteCardSetup) {
            this.instance.runQuoteCardSetup();
        }
        if (this.instance.runCalloutSetup) {
            this.instance.runCalloutSetup();
        }
        if (this.instance.runEmbedSetup) {
            this.instance.runEmbedSetup();
        }
        if (this.instance.runVideoSetup) {
            this.instance.runVideoSetup();
        }
        if (this.instance.runGallerySetup) {
            this.instance.runGallerySetup();
        }

        // Restore cursor position
        this.restoreSelection(state.selection);
        
        // Sync with textarea
        this.instance.sync();
        
        this.isUndoRedo = false;
    }

    // Force save state (called from other modules)
    forceSave() {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        this.saveState();
    }

    // Begin batch operation (saves state BEFORE changes)
    beginBatch() {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        this.batchInProgress = true;
        // Save current state as return point
        this.saveState(true);
    }

    // End batch operation (updates lastSavedContent)
    endBatch() {
        this.batchInProgress = false;
        // Update lastSavedContent so subsequent changes are compared to the new state
        this.lastSavedContent = this.instance.editorEl.innerHTML;
    }

    // Reset history (on setContent)
    reset() {
        this.undoStack = [];
        this.redoStack = [];
        this.lastSavedContent = this.instance.editorEl.innerHTML;
        this.undoStack.push({
            html: this.lastSavedContent,
            selection: null
        });
    }
}
