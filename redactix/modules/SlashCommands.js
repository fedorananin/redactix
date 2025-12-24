import Module from '../core/Module.js';
import Icons from '../ui/Icons.js';

/**
 * Slash Commands Module
 * Notion-like "/" command menu for quick block insertion
 */
export default class SlashCommands extends Module {
    constructor(instance) {
        super(instance);
        this.menu = null;
        this.selectedIndex = 0;
        this.filteredCommands = [];
        this.slashRange = null; // Range where "/" was typed
        this.isOpen = false;
    }

    init() {
        this.createMenu();
        this.bindEvents();
    }

    /**
     * Available commands configuration
     */
    getCommands() {
        const commands = [
            {
                id: 'h1',
                label: this.t('slashCommands.heading1'),
                description: this.t('slashCommands.heading1Desc'),
                icon: Icons.h1,
                keywords: ['h1', 'heading', 'title', 'header', 'заголовок'],
                action: () => this.formatBlock('h1')
            },
            {
                id: 'h2',
                label: this.t('slashCommands.heading2'),
                description: this.t('slashCommands.heading2Desc'),
                icon: Icons.h2,
                keywords: ['h2', 'heading', 'subtitle', 'заголовок'],
                action: () => this.formatBlock('h2')
            },
            {
                id: 'h3',
                label: this.t('slashCommands.heading3'),
                description: this.t('slashCommands.heading3Desc'),
                icon: Icons.h3,
                keywords: ['h3', 'heading', 'заголовок'],
                action: () => this.formatBlock('h3')
            },
            {
                id: 'quote',
                label: this.t('slashCommands.quote'),
                description: this.t('slashCommands.quoteDesc'),
                icon: Icons.blockquote,
                keywords: ['quote', 'blockquote', 'citation', 'цитата'],
                action: () => this.formatBlock('blockquote')
            },
            {
                id: 'callout',
                label: this.t('slashCommands.callout'),
                description: this.t('slashCommands.calloutDesc'),
                icon: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
                keywords: ['callout', 'aside', 'info', 'warning', 'alert', 'note', 'выноска'],
                action: () => this.formatBlock('aside')
            },
            {
                id: 'code',
                label: this.t('slashCommands.codeBlock'),
                description: this.t('slashCommands.codeBlockDesc'),
                icon: Icons.codeblock,
                keywords: ['code', 'pre', 'snippet', 'programming', 'код'],
                action: () => this.insertCodeBlock()
            },
            {
                id: 'image',
                label: this.t('slashCommands.image'),
                description: this.t('slashCommands.imageDesc'),
                icon: Icons.image,
                keywords: ['image', 'picture', 'photo', 'img', 'изображение', 'картинка'],
                action: () => this.openImageModal()
            },
            {
                id: 'youtube',
                label: this.t('slashCommands.youtube'),
                description: this.t('slashCommands.youtubeDesc'),
                icon: Icons.youtube,
                keywords: ['youtube', 'video', 'embed', 'media', 'видео'],
                action: () => this.openYoutubeModal()
            },
            {
                id: 'table',
                label: this.t('slashCommands.table'),
                description: this.t('slashCommands.tableDesc'),
                icon: Icons.table,
                keywords: ['table', 'grid', 'spreadsheet', 'таблица'],
                action: () => this.openTableModal()
            },
            {
                id: 'hr',
                label: this.t('slashCommands.divider'),
                description: this.t('slashCommands.dividerDesc'),
                icon: Icons.hr,
                keywords: ['hr', 'divider', 'separator', 'line', 'horizontal', 'разделитель'],
                action: () => this.insertSeparator()
            },
            {
                id: 'ol',
                label: this.t('slashCommands.numberedList'),
                description: this.t('slashCommands.numberedListDesc'),
                icon: Icons.ol,
                keywords: ['ol', 'ordered', 'numbered', 'list', 'нумерованный', 'список'],
                action: () => this.insertList('ol')
            },
            {
                id: 'ul',
                label: this.t('slashCommands.bulletList'),
                description: this.t('slashCommands.bulletListDesc'),
                icon: Icons.ul,
                keywords: ['ul', 'unordered', 'bullet', 'list', 'маркированный', 'список'],
                action: () => this.insertList('ul')
            }
        ];
        
        return commands;
    }

    /**
     * Create the menu element
     */
    createMenu() {
        this.menu = document.createElement('div');
        this.menu.className = 'redactix-slash-menu';
        this.menu.style.display = 'none';
        this.instance.wrapper.appendChild(this.menu);
    }

    /**
     * Bind event listeners
     */
    bindEvents() {
        // Listen for input to detect "/" command
        this.instance.editorEl.addEventListener('input', (e) => {
            this.handleInput(e);
        });

        // Handle keyboard navigation
        this.instance.editorEl.addEventListener('keydown', (e) => {
            if (this.isOpen) {
                this.handleKeydown(e);
            }
        });

        // Close menu on click outside
        document.addEventListener('click', (e) => {
            if (this.isOpen && !this.menu.contains(e.target)) {
                this.closeMenu();
            }
        });

        // Close menu on scroll
        this.instance.editorEl.addEventListener('scroll', () => {
            if (this.isOpen) {
                this.updateMenuPosition();
            }
        });
    }

    /**
     * Handle input events to detect "/" trigger
     */
    handleInput(e) {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        const node = range.startContainer;

        // Only work with text nodes
        if (node.nodeType !== Node.TEXT_NODE) {
            if (this.isOpen) this.closeMenu();
            return;
        }

        const text = node.textContent;
        const offset = range.startOffset;

        // Find the last "/" before cursor
        const textBeforeCursor = text.substring(0, offset);
        const lastSlashIndex = textBeforeCursor.lastIndexOf('/');

        if (lastSlashIndex === -1) {
            if (this.isOpen) this.closeMenu();
            return;
        }

        // Check if "/" is at the start of a line or after whitespace
        const charBeforeSlash = lastSlashIndex > 0 ? text[lastSlashIndex - 1] : '';
        const isValidPosition = lastSlashIndex === 0 || /\s/.test(charBeforeSlash);

        if (!isValidPosition) {
            if (this.isOpen) this.closeMenu();
            return;
        }

        // Get the filter text after "/"
        const filterText = textBeforeCursor.substring(lastSlashIndex + 1);

        // Check if there's a space after "/" - this means command is completed
        if (filterText.includes(' ')) {
            if (this.isOpen) this.closeMenu();
            return;
        }

        // Save the range where "/" starts
        this.slashRange = document.createRange();
        this.slashRange.setStart(node, lastSlashIndex);
        this.slashRange.setEnd(node, offset);

        // Filter and show commands
        this.filterCommands(filterText);
        
        if (this.filteredCommands.length > 0) {
            this.openMenu();
        } else {
            this.closeMenu();
        }
    }

    /**
     * Filter commands based on search text
     */
    filterCommands(searchText) {
        const commands = this.getCommands();
        const search = searchText.toLowerCase().trim();

        if (!search) {
            this.filteredCommands = commands;
        } else {
            this.filteredCommands = commands.filter(cmd => {
                return cmd.label.toLowerCase().includes(search) ||
                       cmd.id.toLowerCase().includes(search) ||
                       cmd.keywords.some(k => k.toLowerCase().includes(search));
            });
        }

        this.selectedIndex = 0;
        this.renderMenu();
    }

    /**
     * Render menu items
     */
    renderMenu() {
        this.menu.innerHTML = '';

        if (this.filteredCommands.length === 0) {
            this.menu.innerHTML = `<div class="redactix-slash-empty">${this.t('slashCommands.noCommands')}</div>`;
            return;
        }

        this.filteredCommands.forEach((cmd, index) => {
            const item = document.createElement('div');
            item.className = 'redactix-slash-item' + (index === this.selectedIndex ? ' selected' : '');
            item.innerHTML = `
                <div class="redactix-slash-icon">${cmd.icon}</div>
                <div class="redactix-slash-content">
                    <div class="redactix-slash-label">${cmd.label}</div>
                    <div class="redactix-slash-desc">${cmd.description}</div>
                </div>
            `;

            item.addEventListener('mouseenter', () => {
                this.selectedIndex = index;
                this.updateSelection();
            });

            item.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.executeCommand(cmd);
            });

            this.menu.appendChild(item);
        });
    }

    /**
     * Update visual selection
     */
    updateSelection() {
        const items = this.menu.querySelectorAll('.redactix-slash-item');
        items.forEach((item, index) => {
            item.classList.toggle('selected', index === this.selectedIndex);
        });

        // Scroll selected item into view
        const selectedItem = items[this.selectedIndex];
        if (selectedItem) {
            selectedItem.scrollIntoView({ block: 'nearest' });
        }
    }

    /**
     * Handle keyboard navigation
     */
    handleKeydown(e) {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                this.selectedIndex = (this.selectedIndex + 1) % this.filteredCommands.length;
                this.updateSelection();
                break;

            case 'ArrowUp':
                e.preventDefault();
                this.selectedIndex = (this.selectedIndex - 1 + this.filteredCommands.length) % this.filteredCommands.length;
                this.updateSelection();
                break;

            case 'Enter':
                e.preventDefault();
                if (this.filteredCommands[this.selectedIndex]) {
                    this.executeCommand(this.filteredCommands[this.selectedIndex]);
                }
                break;

            case 'Escape':
                e.preventDefault();
                this.closeMenu();
                break;

            case 'Tab':
                e.preventDefault();
                if (this.filteredCommands[this.selectedIndex]) {
                    this.executeCommand(this.filteredCommands[this.selectedIndex]);
                }
                break;
        }
    }

    /**
     * Execute selected command
     */
    executeCommand(cmd) {
        // For modal commands (image, youtube, table, code), don't delete "/" immediately
        // Save the range for later deletion if the modal action succeeds
        const modalCommands = ['image', 'youtube', 'table', 'code'];
        
        if (modalCommands.includes(cmd.id)) {
            // Save range for deferred deletion
            this.pendingSlashRange = this.slashRange ? this.slashRange.cloneRange() : null;
            this.closeMenu();
            cmd.action();
        } else {
            // For immediate commands, delete "/" right away
            this.deleteSlashAndPreserveBlock();
            this.closeMenu();
            cmd.action();
        }
    }
    
    /**
     * Delete "/" and preserve empty block with <br>
     */
    deleteSlashAndPreserveBlock() {
        if (!this.slashRange) return;
        
        try {
            // Get the block element before deleting
            let block = this.slashRange.startContainer;
            while (block && block !== this.instance.editorEl) {
                if (block.nodeType === Node.ELEMENT_NODE && 
                    ['P', 'DIV', 'H1', 'H2', 'H3', 'BLOCKQUOTE', 'ASIDE', 'LI'].includes(block.tagName)) {
                    break;
                }
                block = block.parentNode;
            }
            
            // Select and delete the "/" content
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(this.slashRange);
            this.slashRange.deleteContents();
            
            // Note: For immediate commands (formatBlock, insertList, etc.), 
            // we don't need to preserve the block because the command will transform it
        } catch (e) {
            // Range may be invalid
        }
    }
    
    /**
     * Delete the pending "/" from modal command and save cursor position
     * Called when modal action succeeds
     */
    deletePendingSlash() {
        if (this.pendingSlashRange) {
            try {
                // Get the block element before deleting
                let block = this.pendingSlashRange.startContainer;
                while (block && block !== this.instance.editorEl) {
                    if (block.nodeType === Node.ELEMENT_NODE && 
                        ['P', 'DIV', 'H1', 'H2', 'H3', 'BLOCKQUOTE', 'ASIDE', 'LI'].includes(block.tagName)) {
                        break;
                    }
                    block = block.parentNode;
                }
                
                // Delete the "/" content
                this.pendingSlashRange.deleteContents();
                
                // If the block is now empty, add <br> to keep it visible
                if (block && block !== this.instance.editorEl) {
                    const isEmpty = !block.textContent.trim() && !block.querySelector('img, iframe, hr, table');
                    if (isEmpty && !block.querySelector('br')) {
                        block.innerHTML = '<br>';
                    }
                    
                    // Save this block for cursor restoration after modal closes
                    this.cursorRestoreBlock = block;
                }
            } catch (e) {
                // Range may be invalid if DOM changed
            }
            this.pendingSlashRange = null;
        }
    }
    
    /**
     * Restore cursor to the saved block (called after modal closes)
     */
    restoreCursor() {
        if (this.cursorRestoreBlock && this.instance.editorEl.contains(this.cursorRestoreBlock)) {
            this.instance.editorEl.focus();
            
            const selection = window.getSelection();
            const range = document.createRange();
            
            // Place cursor at the start of the block
            if (this.cursorRestoreBlock.firstChild) {
                range.setStart(this.cursorRestoreBlock, 0);
            } else {
                range.setStart(this.cursorRestoreBlock, 0);
            }
            range.collapse(true);
            
            selection.removeAllRanges();
            selection.addRange(range);
        }
        this.cursorRestoreBlock = null;
    }
    
    /**
     * Clear pending slash without deleting
     * Called when modal is cancelled
     */
    clearPendingSlash() {
        this.pendingSlashRange = null;
    }

    /**
     * Open the menu
     */
    openMenu() {
        this.isOpen = true;
        this.menu.style.display = 'block';
        this.updateMenuPosition();
    }

    /**
     * Close the menu
     */
    closeMenu() {
        this.isOpen = false;
        this.menu.style.display = 'none';
        this.slashRange = null;
        this.selectedIndex = 0;
    }

    /**
     * Update menu position based on cursor
     */
    updateMenuPosition() {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        const wrapperRect = this.instance.wrapper.getBoundingClientRect();
        const editorRect = this.instance.editorEl.getBoundingClientRect();

        // Calculate position
        let left = rect.left - wrapperRect.left;
        let top = rect.bottom - wrapperRect.top + 5;

        // Get menu dimensions
        const menuRect = this.menu.getBoundingClientRect();

        // Adjust horizontal position if needed
        if (left + menuRect.width > wrapperRect.width - 10) {
            left = wrapperRect.width - menuRect.width - 10;
        }
        if (left < 10) left = 10;

        // Check if menu would go below editor - show above instead
        const spaceBelow = editorRect.bottom - rect.bottom;
        if (spaceBelow < menuRect.height + 20 && rect.top - editorRect.top > menuRect.height) {
            top = rect.top - wrapperRect.top - menuRect.height - 5;
        }

        this.menu.style.left = `${left}px`;
        this.menu.style.top = `${top}px`;
    }

    // ==================== Command Actions ====================

    /**
     * Format current block to specified tag
     */
    formatBlock(tagName) {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        let block = range.startContainer;

        // Find the block element
        while (block && block !== this.instance.editorEl) {
            if (block.nodeType === Node.ELEMENT_NODE) {
                const tag = block.tagName;
                if (['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'ASIDE', 'DIV'].includes(tag)) {
                    break;
                }
            }
            block = block.parentNode;
        }

        if (!block || block === this.instance.editorEl) {
            // Create a new block if none found
            document.execCommand('formatBlock', false, `<${tagName}>`);
            
            // Ensure the new block has content for proper height
            const newSelection = window.getSelection();
            if (newSelection.rangeCount) {
                let newBlock = newSelection.getRangeAt(0).startContainer;
                while (newBlock && newBlock.nodeType !== Node.ELEMENT_NODE) {
                    newBlock = newBlock.parentNode;
                }
                if (newBlock && !newBlock.textContent.trim() && !newBlock.querySelector('br')) {
                    newBlock.innerHTML = '<br>';
                    const br = newBlock.querySelector('br');
                    const newRange = document.createRange();
                    newRange.setStartBefore(br);
                    newRange.collapse(true);
                    newSelection.removeAllRanges();
                    newSelection.addRange(newRange);
                }
            }
        } else {
            // Replace the existing block
            const newBlock = document.createElement(tagName);
            while (block.firstChild) {
                newBlock.appendChild(block.firstChild);
            }
            
            // Copy classes for aside/blockquote
            if (block.className) {
                newBlock.className = block.className;
            }
            
            // Ensure the block has content for proper height
            if (!newBlock.textContent.trim() && !newBlock.querySelector('br, img, iframe')) {
                newBlock.innerHTML = '<br>';
            }
            
            block.parentNode.replaceChild(newBlock, block);

            // Place cursor in the new block
            const newRange = document.createRange();
            if (newBlock.firstChild && newBlock.firstChild.nodeType === Node.TEXT_NODE) {
                newRange.setStart(newBlock.firstChild, 0);
            } else if (newBlock.firstChild) {
                newRange.setStartBefore(newBlock.firstChild);
            } else {
                newRange.setStart(newBlock, 0);
            }
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
        }

        this.instance.sync();
    }

    /**
     * Insert a code block
     */
    insertCodeBlock() {
        const codeModule = this.instance.modules.find(m => m.constructor.name === 'Code');
        if (codeModule) {
            this.deletePendingSlash();
            this.setupModalCloseHandler();
            codeModule.openModal();
        }
    }

    /**
     * Open image modal
     */
    openImageModal() {
        const imageModule = this.instance.modules.find(m => m.constructor.name === 'Image');
        if (imageModule) {
            this.deletePendingSlash();
            this.instance.selection.save();
            this.setupModalCloseHandler();
            imageModule.openModal();
        }
    }

    /**
     * Open YouTube modal
     */
    openYoutubeModal() {
        const youtubeModule = this.instance.modules.find(m => m.constructor.name === 'Youtube');
        if (youtubeModule) {
            this.deletePendingSlash();
            this.setupModalCloseHandler();
            youtubeModule.openModal();
        }
    }

    /**
     * Open table modal
     */
    openTableModal() {
        const tableModule = this.instance.modules.find(m => m.constructor.name === 'Table');
        if (tableModule) {
            this.deletePendingSlash();
            this.setupModalCloseHandler();
            tableModule.openModal();
        }
    }
    
    /**
     * Setup handler to restore cursor when modal closes
     */
    setupModalCloseHandler() {
        // Store existing onClose if any
        const existingOnClose = this.instance.modal.onClose;
        
        this.instance.modal.onClose = () => {
            // Call existing handler first
            if (existingOnClose) {
                existingOnClose();
            }
            // Restore cursor position
            this.restoreCursor();
        };
    }

    /**
     * Insert horizontal separator
     */
    insertSeparator() {
        const wrapper = document.createElement('div');
        wrapper.className = 'redactix-separator';
        wrapper.contentEditable = 'false';
        const hr = document.createElement('hr');
        wrapper.appendChild(hr);

        const nextP = document.createElement('p');
        nextP.innerHTML = '<br>';

        this.instance.selection.insertNode(wrapper);
        
        // Insert paragraph after separator
        if (wrapper.nextSibling) {
            wrapper.parentNode.insertBefore(nextP, wrapper.nextSibling);
        } else {
            wrapper.parentNode.appendChild(nextP);
        }

        // Place cursor in new paragraph
        const range = document.createRange();
        range.setStart(nextP, 0);
        range.collapse(true);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);

        this.instance.sync();
    }

    /**
     * Insert list (ordered or unordered)
     */
    insertList(type) {
        const list = document.createElement(type);
        const li = document.createElement('li');
        li.innerHTML = '<br>';
        list.appendChild(li);

        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        let block = range.startContainer;

        // Find the block element
        while (block && block !== this.instance.editorEl) {
            if (block.nodeType === Node.ELEMENT_NODE) {
                const tag = block.tagName;
                if (['P', 'DIV'].includes(tag)) {
                    break;
                }
            }
            block = block.parentNode;
        }

        if (block && block !== this.instance.editorEl && ['P', 'DIV'].includes(block.tagName)) {
            // Replace empty block with list
            const isEmpty = !block.textContent.trim();
            if (isEmpty) {
                block.parentNode.replaceChild(list, block);
            } else {
                // Insert after current block
                if (block.nextSibling) {
                    block.parentNode.insertBefore(list, block.nextSibling);
                } else {
                    block.parentNode.appendChild(list);
                }
            }
        } else {
            // Just insert
            this.instance.selection.insertNode(list);
        }

        // Place cursor in the list item
        const newRange = document.createRange();
        newRange.setStart(li, 0);
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);

        this.instance.sync();
    }

    getButtons() {
        return [];
    }
}
