import Module from '../core/Module.js';
import Icons from '../ui/Icons.js';

export default class Separator extends Module {
    getButtons() {
        return [
            {
                name: 'hr',
                label: '—',
                icon: Icons.hr,
                title: this.t('toolbar.insertSeparator'),
                action: () => this.insertSeparator()
            }
        ];
    }

    /**
     * Insertion via DOM API (same path as SlashCommands and Markdown):
     * execCommand('insertHTML') with a block div split the current paragraph
     * and left no space for input after the separator.
     */
    insertSeparator() {
        const wrapper = document.createElement('div');
        wrapper.className = 'redactix-separator';
        wrapper.contentEditable = 'false';
        wrapper.appendChild(document.createElement('hr'));

        const nextP = document.createElement('p');
        nextP.innerHTML = '<br>';

        this.instance.selection.insertNode(wrapper);

        if (wrapper.parentNode) {
            wrapper.parentNode.insertBefore(nextP, wrapper.nextSibling);

            // Cursor - into the paragraph after the separator
            const range = document.createRange();
            range.setStart(nextP, 0);
            range.collapse(true);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        }

        this.instance.sync();
    }
}
