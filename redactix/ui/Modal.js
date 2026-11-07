import { pushEscapeLayer } from '../core/layers.js';

let modalIdCounter = 0;

export default class Modal {
    constructor(wrapper = null, instance = null) {
        this.overlay = null;
        this.container = null;
        this.onSave = null;
        this.onClose = null;
        this.wrapper = wrapper; // Reference to redactix-wrapper for theme classes
        this.instance = instance; // Reference to RedactixInstance for i18n
        this._popEscape = null;
        this._returnFocus = null;
        this._pointerDownTarget = null;
        this._closeListeners = [];
        this.isOpen = false;
        this.render();

        // If the instance is destroyed with an open modal — release the
        // Escape layer.
        if (instance && instance.onDestroy) {
            instance.onDestroy(() => {
                if (this._popEscape) {
                    this._popEscape();
                    this._popEscape = null;
                }
            });
        }
    }

    /**
     * Shorthand for getting translations
     * @param {string} key - Translation key
     * @returns {string}
     */
    t(key) {
        return this.instance ? this.instance.t(key) : key;
    }

    render() {
        this.overlay = document.createElement('div');
        this.overlay.className = 'redactix-modal-overlay';
        // display: none is now in CSS by default

        this.container = document.createElement('div');
        this.container.className = 'redactix-modal-content';
        this.container.setAttribute('role', 'dialog');
        this.container.setAttribute('aria-modal', 'true');
        this.titleId = 'redactix-modal-title-' + (++modalIdCounter);
        this.container.setAttribute('aria-labelledby', this.titleId);

        this.overlay.appendChild(this.container);

        // Append to wrapper if available (inherits CSS variables), otherwise to body
        if (this.wrapper) {
            this.wrapper.appendChild(this.overlay);
        } else {
            document.body.appendChild(this.overlay);
        }

        // Close on background click — but only when the press also started
        // on the background. Selecting text in a field and releasing the
        // mouse over the overlay used to close the modal and lose the input.
        this.overlay.addEventListener('mousedown', (e) => {
            this._pointerDownTarget = e.target;
        });
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay && this._pointerDownTarget === this.overlay) this.close();
            this._pointerDownTarget = null;
        });

        this.container.addEventListener('keydown', (e) => this.onKeyDown(e));
    }

    onKeyDown(e) {
        // Enter in a single-line field = Save. Without this, Enter triggered
        // implicit submission of the host page's <form> (the editor usually
        // lives inside one).
        if (e.key === 'Enter' && !e.isComposing && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
            const t = e.target;
            const isSingleLine = t && t.tagName === 'INPUT' &&
                !['button', 'submit', 'reset', 'file', 'checkbox', 'radio'].includes((t.type || '').toLowerCase());
            if (isSingleLine) {
                e.preventDefault();
                this.save();
                return;
            }
        }

        // Keep Tab focus inside the dialog.
        if (e.key === 'Tab') {
            const focusables = Array.from(this.container.querySelectorAll(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            )).filter(el => !el.disabled && el.offsetParent !== null);
            if (focusables.length === 0) return;
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
    }

    /**
     * Opens modal window
     * @param {Object} options
     * @param {string} options.title Title
     * @param {HTMLElement} options.body Content (form)
     * @param {Function} options.onSave Save callback. Return false (or a
     *        Promise resolving to false) to keep the modal open.
     * @param {Function} options.onClose Close callback (called on any close)
     * @param {Array} options.extraButtons Additional buttons on the left (e.g. Delete)
     */
    open({ title, body, onSave, onClose, extraButtons = [] }) {
        // Opening over an already open modal: close the previous one
        // properly (its onClose runs, its Escape layer is released).
        if (this.isOpen) this.close({ restoreFocus: false });

        this._returnFocus = document.activeElement;
        this._closeListeners = [];
        this.onSave = onSave;
        this.onClose = onClose;
        this.isOpen = true;

        this.container.innerHTML = '';

        // Header
        const header = document.createElement('h3');
        header.id = this.titleId;
        header.textContent = title;
        header.style.marginTop = '0';
        this.container.appendChild(header);

        // Body
        this.container.appendChild(body);

        // Footer / Buttons
        const footer = document.createElement('div');
        footer.className = 'redactix-modal-footer';

        // Left side - extra buttons (Delete, etc.)
        const leftButtons = document.createElement('div');
        leftButtons.className = 'redactix-modal-footer-left';

        extraButtons.forEach(btnConfig => {
            const btn = this.createButton(btnConfig.text,
                `redactix-modal-btn ${btnConfig.danger ? 'redactix-modal-btn-danger' : 'redactix-modal-btn-gray'}`);
            btn.addEventListener('click', () => {
                if (btnConfig.onClick) btnConfig.onClick();
            });
            leftButtons.appendChild(btn);
        });

        // Right side - Save/Cancel
        const rightButtons = document.createElement('div');
        rightButtons.className = 'redactix-modal-footer-right';

        this.saveBtn = this.createButton(this.t('save'), 'redactix-modal-btn redactix-modal-btn-primary');
        this.saveBtn.addEventListener('click', () => this.save());

        const cancelBtn = this.createButton(this.t('cancel'), 'redactix-modal-btn redactix-modal-btn-secondary');
        cancelBtn.addEventListener('click', () => this.close());

        rightButtons.appendChild(this.saveBtn);
        rightButtons.appendChild(cancelBtn);

        footer.appendChild(leftButtons);
        footer.appendChild(rightButtons);
        this.container.appendChild(footer);

        this.overlay.classList.add('is-open');

        // Close on Escape — topmost layer only (doesn't also close
        // fullscreen or the find panel underneath).
        this._popEscape = pushEscapeLayer(() => this.close());

        // Autofocus on the first form field
        const firstField = this.container.querySelector('input:not([type="file"]):not([type="hidden"]), textarea, select');
        if (firstField) firstField.focus();
        else this.saveBtn.focus();
    }

    /**
     * Run `cb` once when the currently open modal closes (after its own
     * onClose). Lets a caller react to a modal another module opened —
     * e.g. slash commands restoring the caret after Cancel — without
     * overwriting that module's onClose.
     */
    addCloseListener(cb) {
        if (this.isOpen && typeof cb === 'function') this._closeListeners.push(cb);
    }

    /** Buttons are type="button": they must never submit the host form. */
    createButton(text, className) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = text;
        btn.className = className;
        return btn;
    }

    /**
     * Run onSave and close unless it returned false. Async handlers are
     * supported: the modal closes when the promise resolves to anything but
     * false.
     */
    save() {
        if (!this.isOpen) return;
        if (!this.onSave) {
            this.close();
            return;
        }
        let result;
        try {
            result = this.onSave();
        } catch (err) {
            console.error('Redactix: modal save failed', err);
            return; // keep the modal (and the user's input) on errors
        }
        if (result && typeof result.then === 'function') {
            if (this.saveBtn) this.saveBtn.disabled = true;
            result.then(value => {
                if (this.saveBtn) this.saveBtn.disabled = false;
                if (value !== false) this.close();
            }, err => {
                if (this.saveBtn) this.saveBtn.disabled = false;
                console.error('Redactix: modal save failed', err);
            });
            return;
        }
        if (result === false) return;
        this.close();
    }

    close({ restoreFocus = true } = {}) {
        if (!this.isOpen) return;
        this.isOpen = false;
        this.overlay.classList.remove('is-open');
        this.container.innerHTML = '';
        this.saveBtn = null;

        if (this._popEscape) {
            this._popEscape();
            this._popEscape = null;
        }

        const onClose = this.onClose;
        this.onSave = null;
        this.onClose = null;

        const listeners = this._closeListeners;
        this._closeListeners = [];

        // Call onClose callback if defined, then the extra listeners.
        try {
            if (onClose) onClose();
        } finally {
            listeners.forEach(cb => {
                try { cb(); } catch (e) { console.error('Redactix: modal close listener failed', e); }
            });
        }

        // Give focus back to where it was (usually the editor), unless the
        // close handler already moved it somewhere meaningful.
        const ret = this._returnFocus;
        this._returnFocus = null;
        if (restoreFocus && ret && ret.isConnected && typeof ret.focus === 'function') {
            const active = document.activeElement;
            if (!active || active === document.body || this.overlay.contains(active)) {
                try { ret.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
            }
        }
    }
}
