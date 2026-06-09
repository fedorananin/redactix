import Module from '../core/Module.js';
import Icons from '../ui/Icons.js';

export default class List extends Module {
    init() {
        this.editor.el.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                const selection = window.getSelection();
                if (!selection.rangeCount) return;

                const node = selection.anchorNode;
                // Check if we are inside a list
                if (node && node.nodeType === Node.TEXT_NODE && node.parentElement.closest('li')) {
                    e.preventDefault();
                    if (e.shiftKey) {
                        document.execCommand('outdent');
                    } else {
                        document.execCommand('indent');
                    }
                } else if (node && node.nodeType === Node.ELEMENT_NODE && node.closest('li')) {
                     // If selection is on the element itself
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
