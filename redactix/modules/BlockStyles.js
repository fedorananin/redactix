import Module from '../core/Module.js';
import Icons from '../ui/Icons.js';

export default class BlockStyles extends Module {
    // Buttons removed - block transformation via context menu and Markdown shortcuts
    getButtons() {
        return [];
    }
}
