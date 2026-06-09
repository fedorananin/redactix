import Editor from './core/Editor.js';
import Toolbar from './ui/Toolbar.js';
import Selection from './core/Selection.js';
import Modal from './ui/Modal.js';
import I18n from './i18n/index.js';
import { normalizeInlineSynonyms } from './core/dom-utils.js';

// Import modules (can be a dynamic config in the future)
import BaseStyles from './modules/BaseStyles.js';
import BlockStyles from './modules/BlockStyles.js';
import List from './modules/List.js';
import Link from './modules/Link.js';
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
            { name: 'warning', label: 'Warning', class: 'warning' },
            { name: 'danger', label: 'Danger', class: 'danger' },
            { name: 'information', label: 'Information', class: 'information' },
            { name: 'success', label: 'Success', class: 'success' }
        ]);
        this.quotePresets = this.resolvePresets(options.quotePresets, [
            { name: 'big', label: 'Big', class: 'big' }
        ]);

        // URL for uploading images (if specified - drag&drop, paste and upload are enabled)
        this.uploadUrl = options.uploadUrl || null;

        // URL for browsing uploaded images
        this.browseUrl = options.browseUrl || null;

        // Allow deleting images via browser
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

        // Language/locale: 'en' (default), 'ru', etc.
        this.locale = options.locale || 'en';

        // Initialize i18n
        this.i18n = new I18n(this.locale);

        this.elements = document.querySelectorAll(this.selector);
        this.instances = [];
        // List of module classes to connect
        this.modulesConfig = [History, BaseStyles, BlockStyles, List, Link, Image, Gallery, Video, QuoteCard, Callout, Table, Embed, Separator, Code, Markdown, FindReplace, HtmlMode, Fullscreen, Attributes, BlockControl, BlockGap, FloatingToolbar, SlashCommands];

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

            // Pass this (Redactix instance with configs)
            const instance = new RedactixInstance(el, instanceConfig);
            this.instances.push(instance);
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
        this.selection = null;
        this.modal = null;

        // rAF-frame id used to debounce sync(). Every caller (input event,
        // MutationObserver, explicit module calls) schedules at most one
        // sync per animation frame.
        this._syncFrame = null;

        // Registry for global (document/window) listeners and other
        // module resources — released in destroy(). Listeners on
        // elements inside the wrapper do not need to be registered: they
        // die together with wrapper.remove().
        this._managedListeners = [];
        this._destroyCallbacks = [];
        this.destroyed = false;

        this.render();
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
     * Full teardown of the instance: removes global listeners and
     * observers, deletes the wrapper (along with toolbar, modal and
     * handles), returns the original textarea to its place. After destroy()
     * the textarea can be re-initialized with a new new Redactix(...).
     */
    destroy() {
        if (this.destroyed) return;
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

        if (this.wrapper && this.wrapper.parentNode) {
            this.wrapper.remove();
        }

        this.textarea.style.display = '';
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

        // Clean original HTML from extra spaces and line breaks between tags
        // This will remove code indentations but preserve content
        const cleanHtml = this.textarea.value
            .replace(/>\s+</g, '><') // Убираем пробелы между тегами
            .trim();

        // If textarea is empty, create initial paragraph structure
        this.editorEl.innerHTML = cleanHtml || '<p><br></p>';

        // Post-processing: normalize inline synonyms (<strong>→<b> и т.п.),
        // wrap hr, setup figure, code blocks
        this.normalizeInlineMarkup();
        this.wrapSeparators();
        this.setupFigures();
        this.setupCodeBlocks();

        this.wrapper.appendChild(this.editorEl);

        // 5. Create character/word counter (not in lite mode)
        if (!this.config.liteMode) {
            this.createCounter();
        }

        // 6. Hide textarea
        this.textarea.style.display = 'none';

        // 7. Initialize core
        this.core = new Editor(this);
        this.selection = new Selection(this.core);
        this.modal = new Modal(this.wrapper, this);

        // 8. Initialize modules
        this.initModules();

        // 9. Migration of legacy <blockquote> → <figure class="quote-card">,
        // <aside>plain text</aside> → <aside><p>...</p></aside>,
        // .redactix-video-wrapper → figure.redactix-embed.
        // Done after initModules() because module instances are required.
        this.runQuoteCardSetup();
        this.runCalloutSetup();
        this.runEmbedSetup();
        this.runVideoSetup();
        this.runGallerySetup();

        // 10. Update counter (not in lite mode)
        if (!this.config.liteMode) {
            this.updateCounter();
        }
    }

    /**
     * Migrate legacy blockquotes and wire up contenteditable on every
     * figure.quote-card. Safe to call multiple times.
     */
    runQuoteCardSetup() {
        const m = this.modules.find(mod => mod.constructor.name === 'QuoteCard');
        if (!m) return;
        m.migrate(this.editorEl);
        m.setupCards(this.editorEl);
    }

    /**
     * Migrate legacy flat <aside> bodies into <aside><p>...</p></aside>.
     * Safe to call multiple times.
     */
    runCalloutSetup() {
        const m = this.modules.find(mod => mod.constructor.name === 'Callout');
        if (!m) return;
        m.migrate(this.editorEl);
    }

    /**
     * Migrate legacy <div class="redactix-video-wrapper"> to
     * <figure class="redactix-embed"> and wire contenteditable on every
     * embed figure. Safe to call multiple times.
     */
    runEmbedSetup() {
        const m = this.modules.find(mod => mod.constructor.name === 'Embed');
        if (!m) return;
        m.migrate(this.editorEl);
        m.setupEmbeds(this.editorEl);
    }

    /**
     * Wire contenteditable + Edit button on every figure.redactix-video.
     * Safe to call multiple times.
     */
    runVideoSetup() {
        const m = this.modules.find(mod => mod.constructor.name === 'Video');
        if (!m) return;
        m.setupVideos(this.editorEl);
    }

    /**
     * Wire contenteditable + floating Edit button on every figure.redactix-gallery.
     * Safe to call multiple times.
     */
    runGallerySetup() {
        const m = this.modules.find(mod => mod.constructor.name === 'Gallery');
        if (!m) return;
        m.setupGalleries(this.editorEl);
    }

    /**
     * Normalize synonymous inline tags in the editor's live DOM to canonical
     * form (<strong>→<b>, <em>→<i>, <strike>→<s>). Called on
     * content load (render/setContent) and on return from HTML mode.
     */
    normalizeInlineMarkup() {
        normalizeInlineSynonyms(this.editorEl);
    }

    createCounter() {
        this.counter = document.createElement('div');
        this.counter.className = 'redactix-counter';
        this.wrapper.appendChild(this.counter);
    }

    updateCounter(preparedClone = null) {
        // In lite mode counter is not created
        if (!this.counter) return;

        // Get text for counting (without HTML tags, but with figcaption).
        // _doSync passes a ready-made clone (it is not used further)
        // to avoid cloning the entire DOM a second time on every input.
        const clone = preparedClone || this.editorEl.cloneNode(true);

        // Remove alt and title attributes from images, links and frames so they are not counted
        clone.querySelectorAll('img, a, iframe').forEach(el => {
            el.removeAttribute('alt');
            el.removeAttribute('title');
        });

        const text = clone.innerText || '';

        // Count characters (without spaces at start/end)
        const chars = text.trim().length;
        // Count words
        const words = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;

        this.counter.textContent = `${chars} ${this.t('counter.chars')} | ${words} ${this.t('counter.words')}`;
    }

    initModules() {
        this.config.modulesConfig.forEach(ModuleClass => {
            const moduleInstance = new ModuleClass(this);
            moduleInstance.init();
            this.modules.push(moduleInstance);
        });

        // After initializing all modules, ask toolbar to render buttons
        this.toolbar.addButtonsFromModules(this.modules);
    }

    // Get clean HTML content (without utility wrappers)
    getContent() {
        this.syncImmediate();
        return this.textarea.value;
    }

    // Set HTML content into editor
    setContent(html) {
        // Clean HTML from extra spaces between tags
        const cleanHtml = html.replace(/>\s+</g, '><').trim();

        // Set to visual editor
        this.editorEl.innerHTML = cleanHtml;

        // Post-processing as during initialization
        this.normalizeInlineMarkup();
        this.wrapSeparators();
        this.setupFigures();
        this.setupCodeBlocks();
        this.runQuoteCardSetup();
        this.runCalloutSetup();
        this.runEmbedSetup();
        this.runVideoSetup();
        this.runGallerySetup();

        // Sync with textarea (immediately — external code
        // calling setContent often reads textarea right away).
        this.syncImmediate();

        // Notify history module of new content (reset history)
        const historyModule = this.modules.find(m => m.constructor.name === 'History');
        if (historyModule && historyModule.reset) {
            historyModule.reset();
        }
    }

    /**
     * Schedule textarea sync on the next animation frame. Coalesces multiple
     * calls within a single frame (input + MutationObserver + manual calls
     * from modules) into a single pass — avoids the per-keystroke clone +
     * innerHTML serialisation cost the editor used to pay.
     */
    sync() {
        if (this._syncFrame != null) return;
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

    // The actual sync work: clone, strip presentational wrappers, write to
    // textarea, dispatch input/change. Called via sync() / syncImmediate().
    _doSync() {
        // Make sure the editor never ends with a non-editable atomic block
        // (figure / table / pre / hr) — folded into the sync flow so any
        // structural change naturally gets a trailing landing paragraph
        // before content is serialised.
        if (this.core && this.core.ensureTrailingParagraph) {
            this.core.ensureTrailingParagraph();
        }

        // Create clone to clean utility elements before saving
        const clone = this.editorEl.cloneNode(true);

        // Remove separator wrappers
        clone.querySelectorAll('.redactix-separator').forEach(wrapper => {
            const hr = wrapper.querySelector('hr');
            if (hr) {
                // Remove utility contenteditable attribute (if present in HTML)
                hr.removeAttribute('contenteditable');
                wrapper.parentNode.replaceChild(hr, wrapper);
            } else {
                // If empty inside, just remove wrapper
                wrapper.remove();
            }
        });

        // Quote-card specific cleanup: width/height on author photo, empty
        // figcaption / spans, trailing empty paragraphs in blockquote.
        const quoteCardModule = this.modules.find(m => m.constructor.name === 'QuoteCard');
        if (quoteCardModule) {
            quoteCardModule.cleanCardsForSync(clone);
        }

        // Callout cleanup: trailing empty paragraphs inside <aside>.
        const calloutModule = this.modules.find(m => m.constructor.name === 'Callout');
        if (calloutModule) {
            calloutModule.cleanCalloutsForSync(clone);
        }

        // Embed cleanup: drop empty figcaptions inside figure.redactix-embed.
        const embedModule = this.modules.find(m => m.constructor.name === 'Embed');
        if (embedModule) {
            embedModule.cleanEmbedsForSync(clone);
        }

        // Video cleanup: strip Edit button, reapply inline aspect-ratio,
        // drop empty figcaptions inside figure.redactix-video.
        const videoModule = this.modules.find(m => m.constructor.name === 'Video');
        if (videoModule) {
            videoModule.cleanVideosForSync(clone);
        }

        // Gallery cleanup: strip Edit button + drop empty figcaption.
        const galleryModule = this.modules.find(m => m.constructor.name === 'Gallery');
        if (galleryModule) {
            galleryModule.cleanGalleriesForSync(clone);
        }

        // Clean up figure and figcaption (skip quote-cards, embeds,
        // videos and galleries — already handled by their own cleanup).
        clone.querySelectorAll('figure').forEach(figure => {
            figure.removeAttribute('contenteditable');
            if (figure.classList.contains('quote-card')) return;
            if (figure.classList.contains('redactix-embed')) return;
            if (figure.classList.contains('redactix-video')) return;
            if (figure.classList.contains('redactix-gallery')) return;
            const figcaption = figure.querySelector('figcaption');
            if (figcaption) {
                figcaption.removeAttribute('contenteditable');
                // Remove empty figcaption (only <br> or empty)
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

        // Remove contenteditable from pre
        clone.querySelectorAll('pre').forEach(pre => {
            pre.removeAttribute('contenteditable');
        });

        // Remove search highlights
        clone.querySelectorAll('.redactix-find-highlight').forEach(mark => {
            const text = document.createTextNode(mark.textContent);
            mark.parentNode.replaceChild(text, mark);
        });
        clone.normalize();

        // Финальная гарантия канонических инлайн-тегов: даже если браузер
        // во время живого ввода породил <strike> (execCommand) или в DOM
        // как-то просочились <strong>/<em>, в textarea уходят <b>/<i>/<s>.
        normalizeInlineSynonyms(clone);

        // Get clean HTML
        let html = clone.innerHTML;

        // Remove extra spaces between tags (minify)
        // html = html.replace(/>\s+</g, '><').trim(); 
        // Note: the line above might be dangerous for pre tags,
        // let's leave it as is for now or use a more accurate cleaning.
        // Let's just leave innerHTML copy, but without wrappers.

        this.textarea.value = html;

        // Trigger change event on textarea so external scripts know about the change
        this.textarea.dispatchEvent(new Event('change', { bubbles: true }));
        this.textarea.dispatchEvent(new Event('input', { bubbles: true }));

        // Обновляем счётчик, переиспользуя уже сделанный клон —
        // он отработал своё (innerHTML прочитан) и может мутироваться.
        this.updateCounter(clone);
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
    }

    wrapSeparators() {
        this.editorEl.querySelectorAll('hr').forEach(hr => {
            if (hr.parentNode.classList.contains('redactix-separator')) return;

            const wrapper = document.createElement('div');
            wrapper.className = 'redactix-separator';
            wrapper.contentEditable = false;
            wrapper.innerHTML = ''; // Clear if something got in

            hr.parentNode.replaceChild(wrapper, hr);
            wrapper.appendChild(hr);
        });
    }

    setupFigures() {
        // Setup contenteditable for figure and figcaption
        this.editorEl.querySelectorAll('figure').forEach(figure => {
            // Пропускаем video wrapper, quote-card, redactix-embed и
            // redactix-video — все они управляются собственными модулями.
            if (figure.classList.contains('redactix-video-wrapper')) return;
            if (figure.classList.contains('quote-card')) return;
            if (figure.classList.contains('redactix-embed')) return;
            if (figure.classList.contains('redactix-video')) return;
            if (figure.classList.contains('redactix-gallery')) return;

            figure.contentEditable = 'false';

            let figcaption = figure.querySelector('figcaption');
            if (!figcaption) {
                // Create empty figcaption for input possibility
                figcaption = document.createElement('figcaption');
                figcaption.innerHTML = '<br>';
                figure.appendChild(figcaption);
            }
            figcaption.contentEditable = 'true';
        });
    }

    setupCodeBlocks() {
        // Setup contenteditable for code blocks
        this.editorEl.querySelectorAll('pre').forEach(pre => {
            pre.contentEditable = 'false';
        });
    }
}
