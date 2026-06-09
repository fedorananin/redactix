export default class Toolbar {
    constructor(instance) {
        this.instance = instance;
        this.element = document.createElement('div');
        this.element.className = 'redactix-toolbar';
        this.buttons = new Map();
        this.isSticky = false;
        this.stickyPlaceholder = null;
        
        // Update button states when selection changes.
        // Global listener - register via instance.listen,
        // so destroy() can remove it.
        instance.listen(document, 'selectionchange', () => {
            this.updateButtonStates();
        });
        
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
            // Update state after action
            setTimeout(() => this.updateButtonStates(), 10);
        };

        // Use mousedown instead of click to not lose editor focus
        btn.addEventListener('mousedown', (e) => {
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

    updateButtonStates() {
        // Verify that focus is in the editor
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        
        const range = selection.getRangeAt(0);
        if (!this.instance.editorEl.contains(range.commonAncestorContainer)) return;

        // Update state for formatting commands
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

        // Update state for block elements
        let block = range.commonAncestorContainer;
        if (block.nodeType === Node.TEXT_NODE) {
            block = block.parentElement;
        }
        
        while (block && block !== this.instance.editorEl) {
            const tag = block.tagName;
            
            // Verify headings and paragraphs
            ['h1', 'h2', 'h3', 'p', 'blockquote'].forEach(name => {
                const btn = this.buttons.get(name);
                if (btn) {
                    btn.classList.toggle('active', tag === name.toUpperCase());
                }
            });

            // Verify lists
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
