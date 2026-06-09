export default class Modal {
    constructor(wrapper = null, instance = null) {
        this.overlay = null;
        this.container = null;
        this.onSave = null;
        this.onCancel = null;
        this.wrapper = wrapper; // Reference to redactix-wrapper for theme classes
        this.instance = instance; // Reference to RedactixInstance for i18n
        this._escHandler = null;
        this.render();

        // If the instance is destroyed with an open modal - remove
        // Escape listener from document.
        if (instance && instance.onDestroy) {
            instance.onDestroy(() => {
                if (this._escHandler) {
                    document.removeEventListener('keydown', this._escHandler);
                    this._escHandler = null;
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
        
        this.overlay.appendChild(this.container);
        
        // Append to wrapper if available (inherits CSS variables), otherwise to body
        if (this.wrapper) {
            this.wrapper.appendChild(this.overlay);
        } else {
            document.body.appendChild(this.overlay);
        }

        // Close on background click
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.close();
        });
    }

    /**
     * Opens modal window
     * @param {Object} options 
     * @param {string} options.title Title
     * @param {HTMLElement} options.body Content (form)
     * @param {Function} options.onSave Save callback
     * @param {Function} options.onClose Close callback (called on any close)
     * @param {Array} options.extraButtons Additional buttons on the left (e.g. Delete)
     */
    open({ title, body, onSave, onClose, extraButtons = [] }) {
        this.onSave = onSave;
        this.onClose = onClose;
        
        this.container.innerHTML = '';
        
        // Header
        const header = document.createElement('h3');
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
            const btn = document.createElement('button');
            btn.textContent = btnConfig.text;
            btn.className = `redactix-modal-btn ${btnConfig.danger ? 'redactix-modal-btn-danger' : 'redactix-modal-btn-gray'}`;
            
            btn.addEventListener('click', () => {
                if (btnConfig.onClick) {
                    btnConfig.onClick();
                }
            });
            
            leftButtons.appendChild(btn);
        });

        // Right side - Save/Cancel
        const rightButtons = document.createElement('div');
        rightButtons.className = 'redactix-modal-footer-right';

        const saveBtn = document.createElement('button');
        saveBtn.textContent = this.t('save');
        saveBtn.className = 'redactix-modal-btn redactix-modal-btn-primary';
        saveBtn.addEventListener('click', () => {
            // onSave can return false (or Promise<false>) to keep
            // the modal open - for example, if the form failed validation.
            // Any other value - close as usual.
            if (this.onSave) {
                const result = this.onSave();
                if (result === false) return;
            }
            this.close();
        });

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = this.t('cancel');
        cancelBtn.className = 'redactix-modal-btn redactix-modal-btn-secondary';
        cancelBtn.addEventListener('click', () => this.close());

        rightButtons.appendChild(saveBtn);
        rightButtons.appendChild(cancelBtn);
        
        footer.appendChild(leftButtons);
        footer.appendChild(rightButtons);
        this.container.appendChild(footer);

        this.overlay.classList.add('is-open');

        // Close on Escape - the listener lives only while the modal is open
        this._escHandler = (e) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                this.close();
            }
        };
        document.addEventListener('keydown', this._escHandler);

        // Autofocus on the first form field
        const firstField = this.container.querySelector('input, textarea, select');
        if (firstField) firstField.focus();
    }

    close() {
        this.overlay.classList.remove('is-open');
        this.container.innerHTML = '';

        if (this._escHandler) {
            document.removeEventListener('keydown', this._escHandler);
            this._escHandler = null;
        }

        // Call onClose callback if defined
        if (this.onClose) {
            this.onClose();
        }

        this.onSave = null;
        this.onClose = null;
    }
}
