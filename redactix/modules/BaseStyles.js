import Module from '../core/Module.js';
import Icons from '../ui/Icons.js';

export default class BaseStyles extends Module {
    init() {
        // Форматирование доступно через плавающий тулбар и горячие клавиши браузера
    }

    applyStyle(command) {
        this.instance.selection.excludeTrailingSpacesFromSelection();
        document.execCommand(command);
        this.instance.sync();
    }

    // Кнопки убраны из основного тулбара - форматирование через floating toolbar
    getButtons() {
        return [];
    }
}
