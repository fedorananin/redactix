export default class Toolbar {
    constructor(instance) {
        this.instance = instance;
        this.element = document.createElement('div');
        this.element.className = 'redactix-toolbar';
        this.buttons = new Map();
        this.isSticky = false;
        this.stickyPlaceholder = null;
        
        // Обновляем состояния кнопок при изменении выделения
        document.addEventListener('selectionchange', () => {
            this.updateButtonStates();
        });
        
        // Инициализируем sticky поведение только если нет maxHeight
        if (!instance.config.maxHeight) {
            this.initStickyBehavior();
        }
    }
    
    /**
     * Инициализация sticky поведения тулбара
     */
    initStickyBehavior() {
        // Создаём placeholder для сохранения места когда тулбар становится fixed
        this.stickyPlaceholder = document.createElement('div');
        this.stickyPlaceholder.className = 'redactix-toolbar-placeholder';
        this.stickyPlaceholder.style.display = 'none';
        
        // Вставляем placeholder после того как тулбар в DOM
        requestAnimationFrame(() => {
            if (this.element.parentNode) {
                this.element.parentNode.insertBefore(this.stickyPlaceholder, this.element);
            }
        });
        
        // Слушаем скролл на window
        window.addEventListener('scroll', () => this.updateStickyState(), { passive: true });
        window.addEventListener('resize', () => this.updateStickyState(), { passive: true });
    }
    
    /**
     * Обновление sticky состояния
     */
    updateStickyState() {
        if (!this.stickyPlaceholder || this.instance.config.maxHeight) return;
        
        const wrapper = this.instance.wrapper;
        
        // Отключаем sticky в fullscreen режиме
        if (wrapper.classList.contains('redactix-fullscreen')) {
            if (this.isSticky) {
                // Сбрасываем sticky если был включен
                this.isSticky = false;
                this.stickyPlaceholder.style.display = 'none';
                this.element.style.position = '';
                this.element.style.top = '';
                this.element.style.left = '';
                this.element.style.width = '';
                this.element.style.borderRadius = '';
                this.element.style.borderTop = '';
                this.element.style.boxShadow = '';
            }
            return;
        }
        
        const wrapperRect = wrapper.getBoundingClientRect();
        const toolbarHeight = this.element.offsetHeight;
        
        // Тулбар должен быть sticky когда:
        // 1. Верх wrapper'а выше верха viewport
        // 2. Низ wrapper'а ещё виден (есть место для тулбара)
        const shouldBeSticky = wrapperRect.top < 0 && wrapperRect.bottom > toolbarHeight + 20;
        
        if (shouldBeSticky && !this.isSticky) {
            // Включаем sticky
            this.isSticky = true;
            
            // Вставляем placeholder перед тулбаром
            this.element.parentNode.insertBefore(this.stickyPlaceholder, this.element);
            this.stickyPlaceholder.style.display = 'block';
            this.stickyPlaceholder.style.height = toolbarHeight + 'px';
            
            // Делаем тулбар fixed
            this.element.style.position = 'fixed';
            this.element.style.top = '0';
            this.element.style.left = wrapperRect.left + 'px';
            this.element.style.width = wrapperRect.width + 'px';
            this.element.style.borderRadius = '0';
            this.element.style.borderTop = 'none';
            this.element.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
            
        } else if (!shouldBeSticky && this.isSticky) {
            // Выключаем sticky
            this.isSticky = false;
            
            this.stickyPlaceholder.style.display = 'none';
            
            this.element.style.position = '';
            this.element.style.top = '';
            this.element.style.left = '';
            this.element.style.width = '';
            this.element.style.borderRadius = '';
            this.element.style.borderTop = '';
            this.element.style.boxShadow = '';
            
        } else if (this.isSticky) {
            // Обновляем позицию (при ресайзе)
            this.element.style.left = wrapperRect.left + 'px';
            this.element.style.width = wrapperRect.width + 'px';
        }
    }

    getElement() {
        return this.element;
    }

    addButtonsFromModules(modules) {
        modules.forEach(module => {
            const buttons = module.getButtons();
            buttons.forEach(btnConfig => this.addButton(btnConfig));
        });
    }

    addButton(btnConfig) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.innerHTML = btnConfig.icon || btnConfig.label; 
        btn.title = btnConfig.title || '';
        btn.className = 'redactix-btn';
        btn.dataset.command = btnConfig.name;
        
        // Используем mousedown вместо click, чтобы не терять фокус редактора
        btn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            if (btnConfig.action) btnConfig.action();
            this.instance.sync();
            // Обновляем состояние после действия
            setTimeout(() => this.updateButtonStates(), 10);
        });

        this.element.appendChild(btn);
        this.buttons.set(btnConfig.name, btn);
    }

    updateButtonStates() {
        // Проверяем что фокус в редакторе
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        
        const range = selection.getRangeAt(0);
        if (!this.instance.editorEl.contains(range.commonAncestorContainer)) return;

        // Обновляем состояние для команд форматирования
        const formatCommands = {
            'bold': 'bold',
            'italic': 'italic',
            'underline': 'underline',
            'strike': 'strikeThrough'
        };

        Object.entries(formatCommands).forEach(([name, command]) => {
            const btn = this.buttons.get(name);
            if (btn) {
                const isActive = document.queryCommandState(command);
                btn.classList.toggle('active', isActive);
            }
        });

        // Обновляем состояние для блочных элементов
        let block = range.commonAncestorContainer;
        if (block.nodeType === Node.TEXT_NODE) {
            block = block.parentElement;
        }
        
        while (block && block !== this.instance.editorEl) {
            const tag = block.tagName;
            
            // Проверяем заголовки и параграфы
            ['h1', 'h2', 'h3', 'p', 'blockquote'].forEach(name => {
                const btn = this.buttons.get(name);
                if (btn) {
                    btn.classList.toggle('active', tag === name.toUpperCase());
                }
            });

            // Проверяем списки
            if (tag === 'UL' || tag === 'OL' || tag === 'LI') {
                const listType = tag === 'LI' ? block.parentElement?.tagName : tag;
                const ulBtn = this.buttons.get('ul');
                const olBtn = this.buttons.get('ol');
                
                if (ulBtn) ulBtn.classList.toggle('active', listType === 'UL');
                if (olBtn) olBtn.classList.toggle('active', listType === 'OL');
            }

            block = block.parentElement;
        }
    }
}
