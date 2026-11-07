export default class Module {
    /**
     * Stable registry key. Subclasses set `static moduleName = 'Image'` —
     * `constructor.name` can't be relied on because a host bundler that
     * minifies class names would silently break every module lookup.
     */
    static moduleName = 'Module';

    constructor(instance) {
        this.instance = instance;
        this.editor = instance.core;
        this.name = this.constructor.moduleName || this.constructor.name;
    }

    /**
     * Module initialization.
     * Here you can attach event listeners or modify the DOM.
     */
    init() {}

    /**
     * Must return an array of buttons for the toolbar if the module needs buttons.
     * @returns {Array} [{ name, icon, title, action }]
     */
    getButtons() {
        return [];
    }

    /**
     * Hide all floating UI elements of the module (handles, menus, panels).
     * Called when the visual editor is hidden (HTML mode) and whenever the
     * editor content is replaced wholesale (undo/redo, setContent): otherwise
     * absolutely positioned overlays stay on screen and keep references to
     * detached nodes. Modules with overlays override this method.
     * @param {string} [reason] 'contentReplaced' for wholesale DOM swaps.
     */
    hideUI(reason) {}

    // ------------------------------------------------------------------
    // Optional content-lifecycle hooks. RedactixInstance calls them on every
    // module that defines them, so the core no longer needs to know about
    // individual block types.
    //
    //   setupContent(root)      — idempotent migrate + wiring of the live DOM
    //                             (contenteditable flags, edit buttons …).
    //                             Runs after load, setContent, paste,
    //                             undo/redo and HTML-mode return.
    //   cleanForSync(clone)     — strip presentational wrappers from the
    //                             detached clone that becomes textarea.value.
    //   ownsFigure(figure)      — true if this module manages that <figure>
    //                             (so the generic image-figure logic skips it).
    //   preparePaste(root, ctx) — runs on the inert pasted tree before the
    //                             tag/attribute sweep; add elements that must
    //                             survive the sweep untouched to ctx.keep.
    //   pasteAllowedClasses     — getter: class names that survive paste.
    //   getContentOverride()    — return a string to use as the saved HTML
    //                             instead of the visual editor (HTML mode).
    // ------------------------------------------------------------------

    /** Another module of the same instance by its moduleName, or null. */
    getModule(name) {
        return this.instance.getModule(name);
    }

    /**
     * Run a DOM mutation as one undo step (see RedactixInstance.transact).
     */
    transact(fn) {
        return this.instance.transact(fn);
    }

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
