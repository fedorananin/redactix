export default class Selection {
    constructor(editor) {
        this.editor = editor;
        this.savedRange = null;
    }

    /**
     * Сохраняет текущее выделение (Range)
     */
    save() {
        const sel = window.getSelection();
        if (sel.rangeCount > 0) {
            this.savedRange = sel.getRangeAt(0).cloneRange();
        }
    }

    /**
     * Восстанавливает сохраненное выделение
     */
    restore() {
        if (this.savedRange) {
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(this.savedRange);
        }
    }

    /**
     * Возвращает текущий Range
     */
    getRange() {
        const sel = window.getSelection();
        return sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
    }

    /**
     * Вставляет узел в текущую позицию курсора
     * @param {Node} node 
     */
    insertNode(node) {
        const range = this.getRange();
        if (!range) return;

        const isBlockElement = node.nodeType === Node.ELEMENT_NODE && 
            ['FIGURE', 'DIV', 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'TABLE', 'BLOCKQUOTE', 'PRE', 'HR', 'ASIDE'].includes(node.tagName);

        if (isBlockElement) {
            // Для блочных элементов: вставляем на уровне блока
            let block = range.startContainer;
            
            // Находим ближайший блочный родитель
            while (block && block !== this.editor.editorEl) {
                if (block.nodeType === Node.ELEMENT_NODE && 
                    ['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'BLOCKQUOTE', 'FIGURE', 'PRE', 'ASIDE'].includes(block.tagName)) {
                    break;
                }
                block = block.parentNode;
            }

            if (block && block !== this.editor.editorEl && block.parentNode) {
                // Проверяем, пустой ли текущий блок
                const isEmpty = block.textContent.trim() === '' && 
                    !block.querySelector('img, iframe, video, audio, table');
                
                // Вставляем после текущего блока
                block.parentNode.insertBefore(node, block.nextSibling);
                
                // Удаляем пустой блок
                if (isEmpty) {
                    block.remove();
                }
            } else {
                // Если не нашли блок, вставляем в конец редактора
                this.editor.editorEl.appendChild(node);
            }

            // Перемещаем курсор после вставленного элемента
            const newRange = document.createRange();
            newRange.setStartAfter(node);
            newRange.setEndAfter(node);
            
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(newRange);
        } else {
            // Для инлайн-элементов: стандартное поведение
            range.deleteContents();
            range.insertNode(node);
            
            // Перемещаем курсор после вставленного элемента
            range.setStartAfter(node);
            range.setEndAfter(node); 
            
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        }
    }

    /**
     * Исключает завершающие пробелы из выделения
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

            // Проверяем пробелы (обычные и неразрывные)
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
