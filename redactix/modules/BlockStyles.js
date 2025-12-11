import Module from '../core/Module.js';
import Icons from '../ui/Icons.js';

export default class BlockStyles extends Module {
    // Кнопки убраны - преобразование блоков через контекстное меню и Markdown-шорткаты
    getButtons() {
        return [];
    }
}
