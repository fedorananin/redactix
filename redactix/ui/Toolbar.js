export default class Toolbar {
    constructor(instance) {
        this.instance = instance;
        this.element = document.createElement('div');
        this.element.className = 'redactix-toolbar';
        this.buttons = new Map();
        this.isSticky = false;
        this.stickyPlaceholder = null;
        
        // Инициализируем sticky поведение только если нет maxHeight
        if (!instance.config.maxHeight) {
            this.initStickyBehavior();
        }
    }
    
    /**
     * Initialization of sticky behavior of the toolbar
     */
    initStickyBehavior() {
        // Create placeholder to preserve space when the toolbar becomes fixed
        this.stickyPlaceholder = document.createElement('div');
        this.stickyPlaceholder.className = 'redactix-toolbar-placeholder';
        this.stickyPlaceholder.style.display = 'none';
        
        // Insert placeholder after the toolbar is in DOM
        requestAnimationFrame(() => {
            if (this.element.parentNode) {
                this.element.parentNode.insertBefore(this.stickyPlaceholder, this.element);
            }
        });
        
        // Listen for scroll on window (removed in instance.destroy())
        this.instance.listen(window, 'scroll', () => this.updateStickyState(), { passive: true });
        this.instance.listen(window, 'resize', () => this.updateStickyState(), { passive: true });
    }
    
    /**
     * Updating sticky state
     */
    updateStickyState() {
        if (!this.stickyPlaceholder || this.instance.config.maxHeight) return;
        
        const wrapper = this.instance.wrapper;
        
        // Disable sticky in fullscreen mode
        if (wrapper.classList.contains('redactix-fullscreen')) {
            if (this.isSticky) {
                // Reset sticky if it was enabled
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
        
        // The toolbar should be sticky when:
        // 1. Top of wrapper is above top of viewport
        // 2. Bottom of wrapper is still visible (there is space for the toolbar)
        const shouldBeSticky = wrapperRect.top < 0 && wrapperRect.bottom > toolbarHeight + 20;
        
        if (shouldBeSticky && !this.isSticky) {
            // Enable sticky
            this.isSticky = true;
            
            // Insert placeholder before toolbar
            this.element.parentNode.insertBefore(this.stickyPlaceholder, this.element);
            this.stickyPlaceholder.style.display = 'block';
            this.stickyPlaceholder.style.height = toolbarHeight + 'px';
            
            // Make toolbar fixed
            this.element.style.position = 'fixed';
            this.element.style.top = '0';
            this.element.style.left = wrapperRect.left + 'px';
            this.element.style.width = wrapperRect.width + 'px';
            this.element.style.borderRadius = '0';
            this.element.style.borderTop = 'none';
            this.element.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
            
        } else if (!shouldBeSticky && this.isSticky) {
            // Disable sticky
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
            // Update position (on resize)
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
        
        const run = () => {
            if (btnConfig.action) btnConfig.action();
            this.instance.sync();
        };

        // Use mousedown instead of click to not lose editor focus.
        // Primary button only — a right-click used to run the action too.
        btn.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            run();
        });

        // Keyboard activation (Tab + Enter/Space): such click comes
        // with detail === 0 and mousedown does not precede it.
        btn.addEventListener('click', (e) => {
            if (e.detail === 0) run();
        });

        this.element.appendChild(btn);
        this.buttons.set(btnConfig.name, btn);
    }
}
