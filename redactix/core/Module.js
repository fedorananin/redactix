export default class Module {
    constructor(instance) {
        this.instance = instance;
        this.editor = instance.core;
        this.name = this.constructor.name;
    }

    /**
     * Module initialization.
     * Here you can attach event listeners or modify the DOM.
     */
    init() {}

    /**
     * Must return an array of buttons for the toolbar if the module needs buttons.
     * @returns {Array} [{ label: 'B', icon: '...', action: func, active: bool }]
     */
    getButtons() {
        return [];
    }

    /**
     * Hide all floating UI elements of the module (handles, menus, panels).
     * Called when the visual editor is hidden (HTML mode):
     * otherwise, absolutely positioned overlays in the wrapper remain
     * hanging on top of the code. Modules with overlays override this method.
     */
    hideUI() {}
    
    /**
     * Shorthand for getting translations
     * @param {string} key - Translation key (e.g., 'toolbar.bold')
     * @param {object} params - Optional interpolation params
     * @returns {string}
     */
    t(key, params = {}) {
        return this.instance.t(key, params);
    }
}
