import Module from '../core/Module.js';
import Icons from '../ui/Icons.js';

export default class List extends Module {
    init() {
        this.editor.el.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                const selection = window.getSelection();
                if (!selection.rangeCount) return;

                const node = selection.anchorNode;
                // Проверяем, находимся ли мы внутри списка
                if (node && node.nodeType === Node.TEXT_NODE && node.parentElement.closest('li')) {
                    e.preventDefault();
                    if (e.shiftKey) {
                        document.execCommand('outdent');
                    } else {
                        document.execCommand('indent');
                    }
                } else if (node && node.nodeType === Node.ELEMENT_NODE && node.closest('li')) {
                     // Если выделение на самом элементе
                    e.preventDefault();
                    if (e.shiftKey) {
                        document.execCommand('outdent');
                    } else {
                        document.execCommand('indent');
                    }
                }
            }
        });
    }

    getButtons() {
        return [];
    }
}
