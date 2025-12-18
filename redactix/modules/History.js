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
        // Сохраняем начальное состояние
        this.lastSavedContent = this.instance.editorEl.innerHTML;
        this.undoStack.push({
            html: this.lastSavedContent,
            selection: null
        });

        // Слушаем изменения для записи в историю
        this.instance.editorEl.addEventListener('input', () => {
            if (!this.isUndoRedo && !this.batchInProgress) {
                this.debounceSave();
            }
        });

        // Обработка Ctrl+Z и Ctrl+Y (используем e.code для независимости от раскладки)
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
        
        // Не сохраняем если контент не изменился (если не принудительно)
        if (!force && currentContent === this.lastSavedContent) {
            return;
        }

        // Сохраняем позицию курсора
        const selectionData = this.saveSelection();

        this.undoStack.push({
            html: currentContent,
            selection: selectionData
        });

        // Ограничиваем размер истории
        if (this.undoStack.length > this.maxHistory) {
            this.undoStack.shift();
        }

        // Очищаем redo при новом изменении
        this.redoStack = [];
        
        this.lastSavedContent = currentContent;
    }

    saveSelection() {
        const selection = window.getSelection();
        if (!selection.rangeCount) return null;

        const range = selection.getRangeAt(0);
        
        // Сохраняем позицию как путь к узлу
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
            // Позиция курсора может быть невалидной после undo/redo
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

        // Сохраняем текущее состояние в redo
        const currentState = {
            html: this.instance.editorEl.innerHTML,
            selection: this.saveSelection()
        };
        this.redoStack.push(currentState);

        // Восстанавливаем предыдущее состояние
        this.undoStack.pop(); // Убираем текущее
        const prevState = this.undoStack[this.undoStack.length - 1];

        this.applyState(prevState);
    }

    redo() {
        if (this.redoStack.length === 0) return;

        // Сохраняем текущее состояние
        const currentState = {
            html: this.instance.editorEl.innerHTML,
            selection: this.saveSelection()
        };
        this.undoStack.push(currentState);

        // Восстанавливаем следующее состояние
        const nextState = this.redoStack.pop();
        this.applyState(nextState);
    }

    applyState(state) {
        this.isUndoRedo = true;
        
        this.instance.editorEl.innerHTML = state.html;
        this.lastSavedContent = state.html;
        
        // Восстанавливаем обёртки и настройки
        if (this.instance.wrapSeparators) {
            this.instance.wrapSeparators();
        }
        if (this.instance.setupFigures) {
            this.instance.setupFigures();
        }
        if (this.instance.setupCodeBlocks) {
            this.instance.setupCodeBlocks();
        }
        
        // Восстанавливаем позицию курсора
        this.restoreSelection(state.selection);
        
        // Синхронизируем с textarea
        this.instance.sync();
        
        this.isUndoRedo = false;
    }

    // Принудительное сохранение состояния (вызывается из других модулей)
    forceSave() {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        this.saveState();
    }

    // Начать групповую операцию (сохраняет состояние ДО изменений)
    beginBatch() {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        this.batchInProgress = true;
        // Сохраняем текущее состояние как точку возврата
        this.saveState(true);
    }

    // Завершить групповую операцию (обновляет lastSavedContent)
    endBatch() {
        this.batchInProgress = false;
        // Обновляем lastSavedContent чтобы следующие изменения сравнивались с новым состоянием
        this.lastSavedContent = this.instance.editorEl.innerHTML;
    }

    // Сброс истории (при setContent)
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
