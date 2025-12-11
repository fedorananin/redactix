import Module from '../core/Module.js';
import Icons from '../ui/Icons.js';

export default class Separator extends Module {
    getButtons() {
        return [
            {
                name: 'hr',
                label: '—',
                icon: Icons.hr,
                title: 'Insert Separator',
            action: () => {
                // Вставляем обертку и параграф
                const wrapperHtml = '<div class="redactix-separator" contenteditable="false"><hr></div>';
                document.execCommand('insertHTML', false, wrapperHtml);
                // insertHTML может не создать параграф после div'а, поэтому проверим
                // Но лучше просто дать пользователю место для ввода
                // document.execCommand('insertHTML') с блочным элементом часто разбивает P.
                this.instance.sync();
            }
            }
        ];
    }
}
