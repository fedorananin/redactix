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

    /**
     * Replace a panel's contents with a single status line (loading state,
     * "nothing here", error text).
     *
     * Exists so that strings coming back from the upload backend — error
     * messages, file names — are never interpolated into an HTML template.
     * Redactix's own PHP generates random file names, but a browse listing
     * shows whatever is in the directory, and a custom backend's `error`
     * field is frequently an echo of user input.
     *
     * @param {HTMLElement} container - Panel to fill.
     * @param {string} text - Message, inserted as text.
     * @param {string} cssText - Inline styles for the message element.
     * @returns {HTMLElement} The created message element.
     */
    setStatusMessage(container, text, cssText = '') {
        container.innerHTML = '';
        const msg = document.createElement('div');
        if (cssText) msg.style.cssText = cssText;
        msg.textContent = text;
        container.appendChild(msg);
        return msg;
    }
}
