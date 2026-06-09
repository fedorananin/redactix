import Module from '../core/Module.js';
import Icons from '../ui/Icons.js';

export default class BaseStyles extends Module {
    init() {
        // Formatting is available via the floating toolbar and browser hotkeys
    }

    applyStyle(command) {
        this.instance.selection.excludeTrailingSpacesFromSelection();
        document.execCommand(command);
        this.instance.sync();
    }

    // Buttons are removed from the main toolbar - formatting is done via floating toolbar
    getButtons() {
        return [];
    }
}
