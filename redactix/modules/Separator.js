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
     * Вставка через DOM API (тот же путь, что у SlashCommands и Markdown):
     * execCommand('insertHTML') с блочным div'ом разбивал текущий параграф
     * и не оставлял места для ввода после сепаратора.
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

            // Курсор — в параграф после сепаратора
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
