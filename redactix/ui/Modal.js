export default class Modal {
    constructor() {
        this.overlay = null;
        this.container = null;
        this.onSave = null;
        this.onCancel = null;
        this.render();
    }

    render() {
        this.overlay = document.createElement('div');
        this.overlay.className = 'redactix-modal-overlay';
        // display: none is now in CSS by default

        this.container = document.createElement('div');
        this.container.className = 'redactix-modal-content';
        
        this.overlay.appendChild(this.container);
        document.body.appendChild(this.overlay);

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
        footer.style.marginTop = '15px';
        footer.style.display = 'flex';
        footer.style.justifyContent = 'space-between';
        footer.style.alignItems = 'center';
        footer.style.gap = '10px';

        // Left side - extra buttons (Delete, etc.)
        const leftButtons = document.createElement('div');
        leftButtons.style.display = 'flex';
        leftButtons.style.gap = '10px';
        
        extraButtons.forEach(btnConfig => {
            const btn = document.createElement('button');
            btn.textContent = btnConfig.text;
            btn.style.background = btnConfig.danger ? '#dc2626' : '#6b7280';
            btn.style.color = 'white';
            btn.style.border = 'none';
            btn.style.padding = '10px 20px';
            btn.style.borderRadius = '6px';
            btn.style.cursor = 'pointer';
            btn.style.fontSize = '14px';
            btn.style.fontWeight = '500';
            btn.style.transition = 'background 0.15s';
            
            btn.addEventListener('mouseenter', () => {
                btn.style.background = btnConfig.danger ? '#b91c1c' : '#4b5563';
            });
            btn.addEventListener('mouseleave', () => {
                btn.style.background = btnConfig.danger ? '#dc2626' : '#6b7280';
            });
            
            btn.addEventListener('click', () => {
                if (btnConfig.onClick) {
                    btnConfig.onClick();
                }
            });
            
            leftButtons.appendChild(btn);
        });

        // Right side - Save/Cancel
        const rightButtons = document.createElement('div');
        rightButtons.style.display = 'flex';
        rightButtons.style.gap = '10px';
        rightButtons.style.marginLeft = 'auto';

        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save';
        saveBtn.style.background = '#2563eb';
        saveBtn.style.color = 'white';
        saveBtn.style.border = 'none';
        saveBtn.style.padding = '10px 20px';
        saveBtn.style.borderRadius = '6px';
        saveBtn.style.cursor = 'pointer';
        saveBtn.style.fontSize = '14px';
        saveBtn.style.fontWeight = '500';
        saveBtn.addEventListener('click', () => {
            if (this.onSave) {
                this.onSave();
            }
            this.close();
        });

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.style.background = '#f3f4f6';
        cancelBtn.style.color = '#374151';
        cancelBtn.style.border = 'none';
        cancelBtn.style.padding = '10px 20px';
        cancelBtn.style.borderRadius = '6px';
        cancelBtn.style.cursor = 'pointer';
        cancelBtn.style.fontSize = '14px';
        cancelBtn.style.fontWeight = '500';
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
