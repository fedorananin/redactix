import Editor from './core/Editor.js';
import Toolbar from './ui/Toolbar.js';
import Selection from './core/Selection.js';
import Modal from './ui/Modal.js';
import I18n from './i18n/index.js';
import { normalizeInlineSynonyms, sanitizeLoadedHtml } from './core/dom-utils.js';

// Import modules (can be a dynamic config in the future)
import List from './modules/List.js';
import Image from './modules/Image.js';
import Gallery from './modules/Gallery.js';
import Video from './modules/Video.js';
import Table from './modules/Table.js';
import Embed from './modules/Embed.js';
import Separator from './modules/Separator.js';
import Code from './modules/Code.js';
import Markdown from './modules/Markdown.js';
import HtmlMode from './modules/HtmlMode.js';
import Fullscreen from './modules/Fullscreen.js';
import FindReplace from './modules/FindReplace.js';
import Attributes from './modules/Attributes.js';
import BlockControl from './modules/BlockControl.js';
import BlockGap from './modules/BlockGap.js';
import FloatingToolbar from './modules/FloatingToolbar.js';
import History from './modules/History.js';
import SlashCommands from './modules/SlashCommands.js';
import QuoteCard from './modules/QuoteCard.js';
import Callout from './modules/Callout.js';

export default class Redactix {
    constructor(options = {}) {
        this.selector = options.selector || '.redactix';

        // Language/locale: 'en' (default), 'ru', etc. Created first so that
        // default preset labels below can be translated.
        this.locale = options.locale || 'en';
        this.i18n = new I18n(this.locale);
        const t = (key) => this.i18n.t(key);

        // Quick-select classes shown in the Attributes modal. When omitted,
        // the quick-select block is hidden (Attributes.js checks for null /
        // empty array).
        this.predefinedClasses = options.classes || null;

        // Presets for callout and quotes. Accept two shapes:
        //   1) Array of custom presets — extends defaults:
        //        calloutPresets: [{ name, label, class }, …]
        //   2) Object { defaults?, custom? } — full control:
        //        calloutPresets: { defaults: false, custom: [...] }
        // Resolving to the final flat array (without the "none" plug — BlockControl
        // will add it itself) is done by resolvePresets() below.
        this.calloutPresets = this.resolvePresets(options.calloutPresets, [
            { name: 'warning', label: t('blockControl.warning'), class: 'warning' },
            { name: 'danger', label: t('blockControl.danger'), class: 'danger' },
            { name: 'information', label: t('blockControl.information'), class: 'information' },
            { name: 'success', label: t('blockControl.success'), class: 'success' }
        ]);
        this.quotePresets = this.resolvePresets(options.quotePresets, [
            { name: 'big', label: t('blockControl.big'), class: 'big' }
        ]);

        // URL for uploading images (if specified - drag&drop, paste and upload are enabled)
        this.uploadUrl = options.uploadUrl || null;

        // URL for browsing uploaded images
        this.browseUrl = options.browseUrl || null;

        // Allow deleting images via browser (the server must allow it too)
        this.allowImageDelete = options.allowImageDelete || false;

        // Video module works by the same logic as Image: always
        // enabled, always can insert via external URL. File upload
        // to server appears only if videoUploadUrl is set;
        // browser gallery — videoBrowseUrl.
        this.videoUploadUrl = options.videoUploadUrl || null;
        this.videoBrowseUrl = options.videoBrowseUrl || null;
        this.allowVideoDelete = options.allowVideoDelete || false;

        // Max height of the editor (e.g., '500px', '50vh')
        this.maxHeight = options.maxHeight || null;

        // Lite mode - simplified editor for comments
        // Disables: fullscreen, html mode, find/replace, attributes, photo upload, advanced settings
        this.liteMode = options.liteMode || false;

        // Hover-gap "+" between blocks. Default on; pass false to disable
        // for users who find the constant hover affordance distracting.
        this.gapInsertHandle = options.gapInsertHandle !== false;

        // Theme: 'light' (default), 'dark', or 'auto' (follows system preference)
        this.theme = options.theme || 'light';

        this.elements = document.querySelectorAll(this.selector);
        this.instances = [];
        // List of module classes to connect. History comes first so it
        // observes every later module's changes.
        this.modulesConfig = [History, List, Image, Gallery, Video, QuoteCard, Callout, Table, Embed, Separator, Code, Markdown, FindReplace, HtmlMode, Fullscreen, Attributes, BlockControl, BlockGap, FloatingToolbar, SlashCommands];

        this.init();
    }

    /**
     * Normalize a preset config (array OR { defaults?, custom? } object)
     * into a flat array of { name, label, class }. Used for both
     * calloutPresets and quotePresets.
     */
    resolvePresets(input, defaults) {
        if (!input) return [...defaults];
        // Old-style array form — extends defaults.
        if (Array.isArray(input)) return [...defaults, ...input];
        // Object form — explicit control.
        const useDefaults = input.defaults !== false;
        const custom = Array.isArray(input.custom) ? input.custom : [];
        return useDefaults ? [...defaults, ...custom] : [...custom];
    }

    init() {
        if (this.elements.length === 0) {
            console.warn('Redactix: No elements found for selector', this.selector);
            return;
        }

        this.elements.forEach(el => {
            // Skip if already initialized
            if (el.dataset.redactixInit) return;

            if (el.tagName !== 'TEXTAREA') {
                console.warn('Redactix: selector matched a non-textarea element, skipped', el);
                return;
            }

            // Build config for instance
            const instanceConfig = {
                modulesConfig: this.modulesConfig,
                predefinedClasses: this.predefinedClasses,
                calloutPresets: this.calloutPresets,
                quotePresets: this.quotePresets,
                uploadUrl: this.liteMode ? null : this.uploadUrl, // In lite mode disable upload
                browseUrl: this.liteMode ? null : this.browseUrl, // In lite mode disable gallery
                allowImageDelete: this.allowImageDelete,
                // In lite mode keep video module working (URL-only,
                // same as Image), but disable file upload and gallery —
                // commenters do not need file uploads to the server.
                videoUploadUrl: this.liteMode ? null : this.videoUploadUrl,
                videoBrowseUrl: this.liteMode ? null : this.videoBrowseUrl,
                allowVideoDelete: this.allowVideoDelete,
                maxHeight: this.maxHeight,
                liteMode: this.liteMode,
                theme: this.theme,
                gapInsertHandle: this.gapInsertHandle,
                i18n: this.i18n // Pass i18n instance to each editor instance
            };

            // One broken textarea must not stop the rest of the page from
            // initialising.
            let instance;
            try {
                instance = new RedactixInstance(el, instanceConfig);
            } catch (err) {
                console.error('Redactix: failed to initialise editor', el, err);
                return;
            }
            this.instances.push(instance);
            instance.onDestroy(() => {
                const i = this.instances.indexOf(instance);
                if (i >= 0) this.instances.splice(i, 1);
            });
            el.dataset.redactixInit = "true";

            // Save link to the instance in textarea for external access
            el.redactix = instance;
        });
    }
}

class RedactixInstance {
    constructor(textarea, config) {
        this.textarea = textarea;
        this.config = config; // Save entire config
        this.wrapper = null;
        this.editorEl = null;

        // i18n - translation helper
        this.i18n = config.i18n;

        // Core components
        this.toolbar = null;
        this.core = null;
        this.modules = [];
        this._modulesByName = new Map();
        this.selection = null;
        this.modal = null;

        // rAF-frame id used to debounce sync(). Every caller (input event,
        // MutationObserver, explicit module calls) schedules at most one
        // sync per animation frame.
        this._syncFrame = null;
        this._syncing = false;
        // Last HTML written to the textarea — input/change are dispatched
        // only when the saved value actually changes.
        this._lastSyncedHtml = null;

        // Registry for global (document/window) listeners and other
        // module resources — released in destroy(). Listeners on
        // elements inside the wrapper do not need to be registered: they
        // die together with wrapper.remove().
        this._managedListeners = [];
        this._destroyCallbacks = [];
        this._events = Object.create(null);
        this.destroyed = false;

        this.render();
    }

    // ------------------------------------------------------------------
    // Registry, events, transactions
    // ------------------------------------------------------------------

    /** Module instance by its static moduleName ('Image', 'History' …), or null. */
    getModule(name) {
        return this._modulesByName.get(name) || null;
    }

    /**
     * Subscribe to an instance event. Returns an unsubscribe function.
     * Events: 'contentSetup' (root), 'contentReplaced', 'contentInserted'
     * ({ nodes, source }).
     */
    on(name, cb) {
        (this._events[name] || (this._events[name] = [])).push(cb);
        return () => {
            const list = this._events[name];
            if (!list) return;
            const i = list.indexOf(cb);
            if (i >= 0) list.splice(i, 1);
        };
    }

    emit(name, ...args) {
        const list = this._events[name];
        if (!list) return;
        list.slice().forEach(cb => {
            try { cb(...args); } catch (e) { console.error('Redactix: listener for "' + name + '" failed', e); }
        });
    }

    /**
     * Run a programmatic DOM change as exactly one undo step: any pending
     * typing is recorded first, the state after `fn` is recorded after it.
     * Nested calls collapse into the outermost one. Always syncs.
     */
    transact(fn) {
        const history = this.getModule('History');
        if (history) history.beginTransaction();
        try {
            return fn();
        } finally {
            if (history) history.endTransaction();
            this.sync();
        }
    }

    /**
     * addEventListener with automatic removal in destroy(). Use
     * for objects that outlive the wrapper: document, window.
     */
    listen(target, type, handler, options) {
        target.addEventListener(type, handler, options);
        this._managedListeners.push({ target, type, handler, options });
    }

    /**
     * Register a custom cleanup (observer disconnect,
     * removal of portal elements from <body>, etc.) to be executed in destroy().
     */
    onDestroy(cb) {
        this._destroyCallbacks.push(cb);
    }

    /**
     * Full teardown of the instance: flushes the pending sync, removes global
     * listeners and observers, deletes the wrapper (along with toolbar, modal
     * and handles), returns the original textarea to its place. After
     * destroy() the textarea can be re-initialized with a new Redactix(...).
     */
    destroy() {
        if (this.destroyed) return;

        // Flush the last keystrokes into the textarea before tearing down.
        try { this.syncImmediate(); } catch (e) { /* never block destroy */ }

        this.destroyed = true;

        if (this._syncFrame != null) {
            cancelAnimationFrame(this._syncFrame);
            this._syncFrame = null;
        }

        this._managedListeners.forEach(({ target, type, handler, options }) => {
            target.removeEventListener(type, handler, options);
        });
        this._managedListeners = [];

        this._destroyCallbacks.forEach(cb => {
            try { cb(); } catch (e) { /* cleanup should not crash destroy */ }
        });
        this._destroyCallbacks = [];
        this._events = Object.create(null);

        if (this.wrapper && this.wrapper.parentNode) {
            this.wrapper.remove();
        }

        this.textarea.style.display = this._originalDisplay || '';
        delete this.textarea.dataset.redactixInit;
        if (this.textarea.redactix === this) {
            delete this.textarea.redactix;
        }
    }

    /**
     * Shorthand for getting translations
     * @param {string} key - Translation key (e.g., 'toolbar.bold')
     * @param {object} params - Optional interpolation params
     * @returns {string}
     */
    t(key, params = {}) {
        return this.i18n.t(key, params);
    }

    // ------------------------------------------------------------------
    // Construction
    // ------------------------------------------------------------------

    render() {
        // 1. Create wrapper
        this.wrapper = document.createElement('div');
        this.wrapper.className = 'redactix-wrapper';

        // Add class for lite mode
        if (this.config.liteMode) {
            this.wrapper.classList.add('redactix-lite-mode');
        }

        // Add theme class
        if (this.config.theme === 'dark') {
            this.wrapper.classList.add('redactix-dark');
        } else if (this.config.theme === 'auto') {
            this.wrapper.classList.add('redactix-auto');
        }

        // Add RTL support for Arabic and other RTL languages
        if (this.i18n.isRTL()) {
            this.wrapper.classList.add('redactix-rtl');
            this.wrapper.setAttribute('dir', 'rtl');
        }

        // Localised strings used by CSS-generated content (::before / ::after).
        const cssString = (s) => '"' + String(s).replace(/["\\]/g, '\\$&').replace(/\n/g, ' ') + '"';
        this.wrapper.style.setProperty('--redactix-caption-placeholder', cssString(this.t('editor.captionPlaceholder')));
        this.wrapper.style.setProperty('--redactix-uploading-label', cssString(this.t('editor.uploading')));

        // 2. Insert wrapper before textarea
        this.textarea.parentNode.insertBefore(this.wrapper, this.textarea);

        // 3. Create toolbar
        this.toolbar = new Toolbar(this);
        this.wrapper.appendChild(this.toolbar.getElement());

        // 4. Create editing area
        this.editorEl = document.createElement('div');
        this.editorEl.className = 'redactix-editor';
        this.editorEl.contentEditable = true;

        // Apply max height if specified
        if (this.config.maxHeight) {
            this.editorEl.style.maxHeight = this.config.maxHeight;
            this.editorEl.style.overflowY = 'auto';
            this.wrapper.classList.add('redactix-has-max-height');
        }

        // Content from the textarea comes from the host application's
        // storage, which may well contain text some other user wrote —
        // sanitizeLoadedHtml strips anything executable and drops
        // source-formatting whitespace (without gluing inline words).
        this.editorEl.innerHTML = sanitizeLoadedHtml(this.textarea.value) || '<p><br></p>';

        this.wrapper.appendChild(this.editorEl);

        // 5. Create character/word counter (not in lite mode)
        if (!this.config.liteMode) {
            this.createCounter();
        }

        // 6. Hide textarea (remember the host's own inline display value)
        this._originalDisplay = this.textarea.style.display;
        this.textarea.style.display = 'none';

        // 7. Initialize core
        this.core = new Editor(this);
        this.selection = new Selection(this.core);
        this.modal = new Modal(this.wrapper, this);

        // 8. Initialize modules
        this.initModules();

        // 9. Migrations + wiring of the live DOM (quote-cards, callouts,
        // embeds, videos, galleries, separators, figures, code blocks).
        this.setupContent();

        // 10. Write the normalised value silently: loading must not look
        // like a user edit to the host page ("unsaved changes" trackers).
        const { html, clone } = this.serializeClean();
        this.textarea.value = html;
        this._lastSyncedHtml = html;
        this.updateCounter(clone);

        // 11. History starts from the fully set-up state.
        const history = this.getModule('History');
        if (history && history.reset) history.reset();

        // 12. Make sure a form submit always carries the latest content,
        // even if it fires between a keystroke and the next sync frame.
        if (this.textarea.form) {
            this.listen(this.textarea.form, 'submit', () => this.syncImmediate(), true);
        }
    }

    createCounter() {
        this.counter = document.createElement('div');
        this.counter.className = 'redactix-counter';
        this.wrapper.appendChild(this.counter);
    }

    updateCounter(preparedClone = null) {
        // In lite mode counter is not created
        if (!this.counter) return;

        // _doSync passes its already-cleaned clone (not used further) to
        // avoid cloning the entire DOM a second time on every input.
        const clone = preparedClone || this.serializeClean().clone;

        // Characters: visible text only.
        const chars = (clone.textContent || '').trim().length;

        // Words: block boundaries and <br> separate words. textContent on a
        // detached tree has no such separators — "<p>Hello</p><p>World</p>"
        // used to count as one word.
        clone.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, td, th, figcaption, pre, blockquote, aside, div, dt, dd, br')
            .forEach(el => el.after(document.createTextNode(' ')));
        const text = (clone.textContent || '').trim();
        const words = text === '' ? 0 : text.split(/\s+/).length;

        this.counter.textContent = `${chars} ${this.t('counter.chars')} | ${words} ${this.t('counter.words')}`;
    }

    initModules() {
        this.config.modulesConfig.forEach(ModuleClass => {
            const moduleInstance = new ModuleClass(this);
            this.modules.push(moduleInstance);
            this._modulesByName.set(moduleInstance.name, moduleInstance);
        });
        // init() after every module is registered, so a module may look up
        // any other one from its init().
        this.modules.forEach(m => m.init());

        // After initializing all modules, ask toolbar to render buttons
        this.toolbar.addButtonsFromModules(this.modules);
    }

    // ------------------------------------------------------------------
    // Content lifecycle
    // ------------------------------------------------------------------

    /**
     * Idempotent post-processing of live DOM content. The ONE place that
     * runs after any wholesale content change: initial load, setContent(),
     * paste/drop, undo/redo, return from HTML mode. Module-specific work is
     * delegated to each module's optional setupContent(root) hook.
     */
    setupContent(root = this.editorEl) {
        normalizeInlineSynonyms(root);
        this.wrapSeparators(root);
        // Module migrations first (legacy markup → current shapes), so that
        // the generic figure/code wiring below sees the final structure.
        this.modules.forEach(m => {
            if (typeof m.setupContent === 'function') {
                try { m.setupContent(root); } catch (e) { console.error('Redactix: ' + m.name + '.setupContent failed', e); }
            }
        });
        this.setupFigures(root);
        this.setupCodeBlocks(root);
        if (this.core) this.core.ensureTrailingParagraph();
        this.emit('contentSetup', root);
    }

    /**
     * Replace the whole visual content. Used by setContent(), undo/redo and
     * the HTML-mode return path.
     * @param {string} html
     * @param {Object} [opts]
     * @param {boolean} [opts.sanitize=true]           Run the load sanitizer.
     * @param {boolean} [opts.collapseWhitespace=true] Drop source formatting.
     */
    replaceContent(html, { sanitize = true, collapseWhitespace = true } = {}) {
        const source = typeof html === 'string' ? html : '';
        const clean = sanitize ? sanitizeLoadedHtml(source, { collapseWhitespace }) : source;
        this.editorEl.innerHTML = clean || '<p><br></p>';
        this.setupContent();
        this.hideAllUI('contentReplaced');
        this.emit('contentReplaced');
    }

    /**
     * Ask every module to hide its floating overlays.
     * @param {string} [reason] 'contentReplaced' when the DOM was swapped
     *        wholesale (undo/redo, setContent) — panels that don't point at
     *        specific nodes (find panel) may stay open and just refresh.
     */
    hideAllUI(reason) {
        this.modules.forEach(m => {
            if (typeof m.hideUI === 'function') {
                try { m.hideUI(reason); } catch (e) { /* overlays are best-effort */ }
            }
        });
    }

    /** Does a module (quote-card, embed, video, gallery …) manage this figure? */
    isManagedFigure(figure) {
        if (figure.classList.contains('redactix-video-wrapper')) return true;
        return this.modules.some(m => typeof m.ownsFigure === 'function' && m.ownsFigure(figure));
    }

    // Get clean HTML content (without utility wrappers)
    getContent() {
        this.syncImmediate();
        return this.textarea.value;
    }

    // Set HTML content into editor
    setContent(html) {
        // Same treatment as content loaded from the textarea, since callers
        // routinely feed this straight from a database.
        this.replaceContent(html == null ? '' : String(html));

        // Sync with textarea (immediately — external code
        // calling setContent often reads textarea right away).
        this.syncImmediate();

        // Notify history module of new content (reset history)
        const historyModule = this.getModule('History');
        if (historyModule && historyModule.reset) {
            historyModule.reset();
        }
    }

    /**
     * Schedule textarea sync on the next animation frame. Coalesces multiple
     * calls within a single frame (input + MutationObserver + manual calls
     * from modules) into a single pass.
     */
    sync() {
        if (this.destroyed || this._syncFrame != null) return;
        this._syncFrame = requestAnimationFrame(() => {
            this._syncFrame = null;
            this._doSync();
        });
    }

    /**
     * Run the sync pass right now, cancelling any pending scheduled one.
     * Used by getContent() and setContent() where external callers expect
     * textarea.value to be up-to-date the moment the call returns.
     */
    syncImmediate() {
        if (this._syncFrame != null) {
            cancelAnimationFrame(this._syncFrame);
            this._syncFrame = null;
        }
        this._doSync();
    }

    /**
     * Clean serialisation of the visual editor — exactly what is saved.
     * Clones the live DOM and strips every presentational wrapper and UI
     * element. Also used by History (snapshots) and HTML mode (entry).
     * @returns {{ html: string, clone: HTMLElement }}
     */
    serializeClean() {
        const clone = this.editorEl.cloneNode(true);
        this.cleanClone(clone);
        return { html: clone.innerHTML, clone };
    }

    /** Strip editor-only markup from a detached clone, in place. */
    cleanClone(clone) {
        // Generic UI: anything flagged data-redactix-ui (edit buttons, gap
        // handles …) and in-flight upload placeholders never belong in output.
        clone.querySelectorAll('[data-redactix-ui], .redactix-upload-placeholder').forEach(el => el.remove());
        clone.querySelectorAll('[data-redactix-paste-upload]').forEach(el => el.removeAttribute('data-redactix-paste-upload'));

        // Remove separator wrappers
        clone.querySelectorAll('.redactix-separator').forEach(wrapper => {
            const hr = wrapper.querySelector('hr');
            if (hr) {
                hr.removeAttribute('contenteditable');
                wrapper.parentNode.replaceChild(hr, wrapper);
            } else {
                wrapper.remove();
            }
        });

        // Module-specific cleanup (quote-cards, callouts, embeds, videos,
        // galleries …) — each module owns its own presentational markup.
        this.modules.forEach(m => {
            if (typeof m.cleanForSync === 'function') {
                try { m.cleanForSync(clone); } catch (e) { console.error('Redactix: ' + m.name + '.cleanForSync failed', e); }
            }
        });

        // Plain image figures: drop the empty placeholder figcaption.
        clone.querySelectorAll('figure').forEach(figure => {
            figure.removeAttribute('contenteditable');
            if (this.isManagedFigure(figure)) return;
            const figcaption = figure.querySelector(':scope > figcaption');
            if (figcaption) {
                figcaption.removeAttribute('contenteditable');
                const innerHtml = figcaption.innerHTML.replace(/<br\s*\/?>/gi, '').trim();
                if (!innerHtml && !figcaption.querySelector('img, iframe')) {
                    figcaption.remove();
                }
            }
        });

        // Remove utility contenteditable attributes from all elements
        clone.querySelectorAll('[contenteditable]').forEach(el => {
            el.removeAttribute('contenteditable');
        });

        // Unwrap search highlights, keeping whatever formatting the user
        // applied inside them.
        clone.querySelectorAll('.redactix-find-highlight').forEach(mark => {
            while (mark.firstChild) mark.parentNode.insertBefore(mark.firstChild, mark);
            mark.remove();
        });
        clone.normalize();

        // Final guarantee of canonical inline tags: even if the browser
        // produced <strike> (execCommand) or <strong>/<em> slipped into the
        // DOM, only <b>/<i>/<s> reach the textarea.
        normalizeInlineSynonyms(clone);
        return clone;
    }

    // The actual sync work. Called via sync() / syncImmediate().
    _doSync() {
        if (this.destroyed || this._syncing) return;
        this._syncing = true;
        try {
            // A module may own the content right now (HTML mode shows a code
            // editor while the visual editor is hidden and stale).
            let html = null;
            for (const m of this.modules) {
                if (typeof m.getContentOverride === 'function') {
                    const override = m.getContentOverride();
                    if (typeof override === 'string') { html = override; break; }
                }
            }

            let clone = null;
            if (html === null) {
                const result = this.serializeClean();
                html = result.html;
                clone = result.clone;
            }

            if (html !== this._lastSyncedHtml || this.textarea.value !== html) {
                this._lastSyncedHtml = html;
                this.textarea.value = html;
                // Let external scripts know — but only on real changes, and
                // never re-entrantly (a host 'input' listener calling
                // getContent() used to recurse forever).
                this.textarea.dispatchEvent(new Event('change', { bubbles: true }));
                this.textarea.dispatchEvent(new Event('input', { bubbles: true }));
            }

            if (clone) this.updateCounter(clone);
        } finally {
            this._syncing = false;
        }
    }

    // Change editor theme at runtime
    // @param {string} theme - 'light', 'dark', or 'auto'
    setTheme(theme) {
        // Remove existing theme classes
        this.wrapper.classList.remove('redactix-dark', 'redactix-auto');

        // Apply new theme
        if (theme === 'dark') {
            this.wrapper.classList.add('redactix-dark');
        } else if (theme === 'auto') {
            this.wrapper.classList.add('redactix-auto');
        }

        // Update config
        this.config.theme = theme;
        this.emit('themeChanged', theme);
    }

    wrapSeparators(root = this.editorEl) {
        root.querySelectorAll('hr').forEach(hr => {
            if (hr.parentNode.classList && hr.parentNode.classList.contains('redactix-separator')) return;

            const wrapper = document.createElement('div');
            wrapper.className = 'redactix-separator';
            wrapper.contentEditable = false;

            hr.parentNode.replaceChild(wrapper, hr);
            wrapper.appendChild(hr);
        });
        // Anything that ended up inside a separator wrapper (e.g. a block
        // dropped onto it) is moved out — sync replaces the wrapper with the
        // bare <hr>, which would otherwise silently delete that content.
        root.querySelectorAll('.redactix-separator').forEach(wrapper => {
            Array.from(wrapper.childNodes).forEach(child => {
                if (child.nodeType === Node.ELEMENT_NODE && child.tagName === 'HR') return;
                if (child.nodeType === Node.TEXT_NODE && !child.textContent.trim()) {
                    child.remove();
                    return;
                }
                wrapper.parentNode.insertBefore(child, wrapper.nextSibling);
            });
        });
    }

    setupFigures(root = this.editorEl) {
        // Setup contenteditable for plain image figures and their captions.
        root.querySelectorAll('figure').forEach(figure => {
            if (this.isManagedFigure(figure)) return;

            figure.contentEditable = 'false';

            let figcaption = figure.querySelector(':scope > figcaption');
            if (!figcaption) {
                // Create empty figcaption for input possibility
                figcaption = document.createElement('figcaption');
                figcaption.innerHTML = '<br>';
                figure.appendChild(figcaption);
            }
            figcaption.contentEditable = 'true';
        });
    }

    setupCodeBlocks(root = this.editorEl) {
        // Setup contenteditable for code blocks
        root.querySelectorAll('pre').forEach(pre => {
            pre.contentEditable = 'false';
        });
    }
}
