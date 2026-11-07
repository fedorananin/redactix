import Module from '../core/Module.js';
import Icons from '../ui/Icons.js';

export default class Separator extends Module {
    static moduleName = 'Separator';

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
     * Insert a separator at the caret as one undo step.
     *
     * Goes through Selection.insertNode (same as tables / code): an <hr> is
     * allowed in a callout but not in a quote-card or list, so there it
     * lands after the container. insertNode also replaces an empty
     * paragraph at the caret and puts the caret into the next editable
     * block, creating an empty <p> only when nothing editable follows.
     * @returns {HTMLElement} the separator wrapper
     */
    insertSeparator() {
        const wrapper = document.createElement('div');
        wrapper.className = 'redactix-separator';
        wrapper.contentEditable = 'false';
        wrapper.appendChild(document.createElement('hr'));

        this.transact(() => {
            this.instance.selection.insertNode(wrapper);
            if (!wrapper.parentNode) this.instance.editorEl.appendChild(wrapper);
        });
        return wrapper;
    }
}
