export default class Modal {
    constructor(wrapper = null) {
        this.overlay = null;
        this.container = null;
        this.onSave = null;
        this.onCancel = null;
        this.wrapper = wrapper; // Reference to redactix-wrapper for theme classes
        this.render();
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

        // Закрытие по клику на фон
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.close();
        });
    }

    /**
     * Открывает модальное окно
     * @param {Object} options 
     * @param {string} options.title Заголовок
     * @param {HTMLElement} options.body Содержимое (форма)
     * @param {Function} options.onSave Коллбек сохранения
     * @param {Function} options.onClose Коллбек закрытия (вызывается при любом закрытии)
     * @param {Array} options.extraButtons Дополнительные кнопки слева (например, Delete)
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
        saveBtn.textContent = 'Save';
        saveBtn.className = 'redactix-modal-btn redactix-modal-btn-primary';
        saveBtn.addEventListener('click', () => {
            if (this.onSave) {
                this.onSave();
            }
            this.close();
        });

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.className = 'redactix-modal-btn redactix-modal-btn-secondary';
        cancelBtn.addEventListener('click', () => this.close());

        rightButtons.appendChild(saveBtn);
        rightButtons.appendChild(cancelBtn);
        
        footer.appendChild(leftButtons);
        footer.appendChild(rightButtons);
        this.container.appendChild(footer);

        this.overlay.classList.add('is-open');
    }

    close() {
        this.overlay.classList.remove('is-open');
        this.container.innerHTML = '';
        
        // Call onClose callback if defined
        if (this.onClose) {
            this.onClose();
        }
        
        this.onSave = null;
        this.onClose = null;
    }
}
