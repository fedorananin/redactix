import Module from '../core/Module.js';
import Icons from '../ui/Icons.js';
import { isBlockEmpty } from '../core/dom-utils.js';
import { getEditingContext, isAllowedIn, findHostChild, normalizeContainerChildren, TEXT_BLOCK_TAGS } from '../core/schema.js';
import { pushEscapeLayer } from '../core/layers.js';
import { placePopover, getSelectionRect } from '../ui/popover.js';

// Commands that transform the current block in place — meaningless with the
// caret in a list item (they would put a heading / callout into <ul>).
const BLOCK_CONVERSION_IDS = ['h1', 'h2', 'h3', 'callout', 'ol', 'ul'];
const LINE_BLOCK_SELECTOR = 'p, h1, h2, h3, h4, h5, h6, li';

/**
 * Slash Commands Module
 * Notion-like "/" command menu for quick block insertion
 */
export default class SlashCommands extends Module {
    static moduleName = 'SlashCommands';

    constructor(instance) {
        super(instance);
        this.menu = null;
        this.selectedIndex = 0;
        this.filteredCommands = [];
        this.slashRange = null; // Range where "/" was typed
        this.isOpen = false;
        this.popEscape = null;
        this.liteMode = instance.config.liteMode || false;
    }

    init() {
        this.createMenu();
        this.bindEvents();
        this.instance.onDestroy(() => this.closeMenu());
    }

    /**
     * Available commands configuration. `kind` is the block the command
     * produces (checked against the container rules), `modal` marks
     * commands that open another module's modal.
     */
    getCommands() {
        const commands = [
            {
                id: 'h1',
                kind: 'H1',
                label: this.t('slashCommands.heading1'),
                description: this.t('slashCommands.heading1Desc'),
                icon: Icons.h1,
                keywords: ['h1', 'heading', 'title', 'header', 'заголовок'],
                action: () => this.formatBlock('h1')
            },
            {
                id: 'h2',
                kind: 'H2',
                label: this.t('slashCommands.heading2'),
                description: this.t('slashCommands.heading2Desc'),
                icon: Icons.h2,
                keywords: ['h2', 'heading', 'subtitle', 'заголовок'],
                action: () => this.formatBlock('h2')
            },
            {
                id: 'h3',
                kind: 'H3',
                label: this.t('slashCommands.heading3'),
                description: this.t('slashCommands.heading3Desc'),
                icon: Icons.h3,
                keywords: ['h3', 'heading', 'заголовок'],
                action: () => this.formatBlock('h3')
            },
            {
                id: 'quote',
                kind: 'FIGURE',
                label: this.t('slashCommands.quote'),
                description: this.t('slashCommands.quoteDesc'),
                icon: Icons.blockquote,
                keywords: ['quote', 'blockquote', 'citation', 'цитата'],
                action: () => this.insertQuoteCard()
            },
            {
                id: 'callout',
                kind: 'ASIDE',
                label: this.t('slashCommands.callout'),
                description: this.t('slashCommands.calloutDesc'),
                icon: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
                keywords: ['callout', 'aside', 'info', 'warning', 'alert', 'note', 'выноска'],
                action: () => this.formatBlock('aside')
            },
            {
                id: 'code',
                kind: 'PRE',
                modal: true,
                label: this.t('slashCommands.codeBlock'),
                description: this.t('slashCommands.codeBlockDesc'),
                icon: Icons.codeblock,
                keywords: ['code', 'pre', 'snippet', 'programming', 'код'],
                action: () => this.openModuleModal('Code')
            },
            {
                id: 'image',
                kind: 'FIGURE',
                modal: true,
                label: this.t('slashCommands.image'),
                description: this.t('slashCommands.imageDesc'),
                icon: Icons.image,
                keywords: ['image', 'picture', 'photo', 'img', 'изображение', 'картинка'],
                action: () => this.openModuleModal('Image')
            },
            {
                id: 'video',
                kind: 'FIGURE',
                modal: true,
                label: this.t('slashCommands.video'),
                description: this.t('slashCommands.videoDesc'),
                icon: Icons.video,
                keywords: ['video', 'mp4', 'movie', 'clip', 'видео', 'ролик'],
                action: () => this.openModuleModal('Video')
            },
            {
                id: 'gallery',
                kind: 'FIGURE',
                modal: true,
                label: this.t('slashCommands.gallery'),
                description: this.t('slashCommands.galleryDesc'),
                icon: Icons.gallery,
                keywords: ['gallery', 'photos', 'mosaic', 'multiple', 'images', 'галерея', 'фото'],
                category: 'gallery',
                action: () => this.openModuleModal('Gallery')
            },
            // Universal embed — provider auto-detected from the pasted URL.
            // Keywords cover popular services so /youtube, /spotify, /tiktok
            // etc. all surface the same command.
            {
                id: 'embed',
                kind: 'FIGURE',
                modal: true,
                label: this.t('slashCommands.embed'),
                description: this.t('slashCommands.embedDesc'),
                icon: Icons.youtube,
                keywords: ['embed', 'iframe', 'видео', 'video',
                    'youtube', 'yt', 'vimeo', 'twitch', 'loom', 'dailymotion',
                    'spotify', 'apple', 'applemusic', 'soundcloud', 'sc',
                    'bandcamp', 'mixcloud', 'codepen', 'pen',
                    'twitter', 'x', 'tweet', 'instagram', 'ig',
                    'tiktok', 'reddit', 'bluesky', 'bsky',
                    'map', 'maps'],
                category: 'embed',
                action: () => this.openModuleModal('Embed')
            },
            {
                id: 'table',
                kind: 'TABLE',
                modal: true,
                label: this.t('slashCommands.table'),
                description: this.t('slashCommands.tableDesc'),
                icon: Icons.table,
                keywords: ['table', 'grid', 'spreadsheet', 'таблица'],
                action: () => this.openModuleModal('Table')
            },
            {
                id: 'hr',
                kind: 'HR',
                label: this.t('slashCommands.divider'),
                description: this.t('slashCommands.dividerDesc'),
                icon: Icons.hr,
                keywords: ['hr', 'divider', 'separator', 'line', 'horizontal', 'разделитель'],
                action: () => this.insertSeparator()
            },
            {
                id: 'ol',
                kind: 'OL',
                label: this.t('slashCommands.numberedList'),
                description: this.t('slashCommands.numberedListDesc'),
                icon: Icons.ol,
                keywords: ['ol', 'ordered', 'numbered', 'list', 'нумерованный', 'список'],
                action: () => this.insertList('ol')
            },
            {
                id: 'ul',
                kind: 'UL',
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
     * Create the menu element. It lives in the wrapper (inherits the theme
     * variables) but is position: fixed and placed in viewport coordinates,
     * so the wrapper's overflow never clips it in short editors.
     */
    createMenu() {
        this.menu = document.createElement('div');
        this.menu.className = 'redactix-slash-menu';
        this.menu.style.display = 'none';
        this.menu.setAttribute('role', 'listbox');
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

        // Keyboard navigation. Capture phase: runs before the core's own
        // Enter / Tab handling on the same element, so Enter picks the
        // highlighted command instead of splitting the paragraph.
        this.instance.editorEl.addEventListener('keydown', (e) => {
            if (this.isOpen) {
                this.handleKeydown(e);
            }
        }, true);

        // Close menu on click outside (via registry - removed in destroy())
        this.instance.listen(document, 'click', (e) => {
            if (this.isOpen && !this.menu.contains(e.target)) {
                this.closeMenu();
            }
        });

        // Fixed positioning: follow any scroll (page, editor with maxHeight,
        // fullscreen container) and resizes.
        const reposition = () => {
            if (this.isOpen) this.updateMenuPosition();
        };
        this.instance.listen(window, 'scroll', reposition, true);
        this.instance.listen(window, 'resize', reposition);
    }

    /**
     * Handle input events to detect "/" trigger
     */
    handleInput(e) {
        if (e && e.isComposing) return;
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        const node = range.startContainer;

        // Only work with text nodes
        if (!range.collapsed || node.nodeType !== Node.TEXT_NODE) {
            if (this.isOpen) this.closeMenu();
            return;
        }

        // No block commands in table cells, captions or code.
        const ctx = getEditingContext(node, this.instance.editorEl);
        if (!ctx.inRoot || ctx.inTable || ctx.inFigcaption || ctx.inPre ||
            !node.parentElement || !node.parentElement.isContentEditable) {
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

        // Whitespace after "/" (incl. the nbsp the core inserts for a
        // second space) means the command is finished / abandoned.
        if (/\s/.test(filterText)) {
            if (this.isOpen) this.closeMenu();
            return;
        }

        // Save the range where "/" starts
        this.slashRange = document.createRange();
        this.slashRange.setStart(node, lastSlashIndex);
        this.slashRange.setEnd(node, offset);

        // Filter and show commands
        this.filterCommands(filterText, ctx);

        if (this.filteredCommands.length > 0) {
            this.openMenu();
        } else {
            this.closeMenu();
        }
    }

    /**
     * Commands that make sense at the caret: lite-mode restrictions plus the
     * container rules (a quote-card body accepts P/H1-H3/lists only, a
     * callout also <hr>), and no in-place block conversions in list items.
     */
    getAvailableCommands(ctx) {
        let commands = this.getCommands();
        const root = this.instance.editorEl;

        // Lite mode: hide every embed entry (universal /embed and all
        // provider aliases) plus galleries. Image / table / code are
        // already constrained by their own modules.
        if (this.liteMode) {
            commands = commands.filter(cmd => cmd.category !== 'embed' && cmd.category !== 'gallery');
        }

        if (ctx) {
            if (ctx.inListItem) {
                commands = commands.filter(cmd => !BLOCK_CONVERSION_IDS.includes(cmd.id));
            }
            if (ctx.container) {
                commands = commands.filter(cmd => isAllowedIn(ctx.host, cmd.kind, root));
            }
        }
        return commands;
    }

    /**
     * Filter commands based on search text
     */
    filterCommands(searchText, ctx = null) {
        const commands = this.getAvailableCommands(ctx);
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
     * Render menu items. Labels come from locale files — set as text, never
     * interpolated into markup; icons are the library's static SVGs.
     */
    renderMenu() {
        this.menu.innerHTML = '';

        if (this.filteredCommands.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'redactix-slash-empty';
            empty.textContent = this.t('slashCommands.noCommands');
            this.menu.appendChild(empty);
            return;
        }

        this.filteredCommands.forEach((cmd, index) => {
            const item = document.createElement('div');
            item.className = 'redactix-slash-item' + (index === this.selectedIndex ? ' selected' : '');
            item.setAttribute('role', 'option');

            const icon = document.createElement('div');
            icon.className = 'redactix-slash-icon';
            icon.innerHTML = cmd.icon;

            const content = document.createElement('div');
            content.className = 'redactix-slash-content';
            const label = document.createElement('div');
            label.className = 'redactix-slash-label';
            label.textContent = cmd.label;
            const desc = document.createElement('div');
            desc.className = 'redactix-slash-desc';
            desc.textContent = cmd.description;
            content.append(label, desc);
            item.append(icon, content);

            item.addEventListener('mouseenter', () => {
                this.selectedIndex = index;
                this.updateSelection();
            });

            // mousedown: keep the editor's focus and caret
            item.addEventListener('mousedown', (e) => {
                e.preventDefault();
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
     * Handle keyboard navigation (Escape is handled by the layer stack).
     */
    handleKeydown(e) {
        if (e.isComposing || e.keyCode === 229) return;
        const count = this.filteredCommands.length;
        const consume = () => {
            e.preventDefault();
            e.stopImmediatePropagation();
        };
        switch (e.key) {
            case 'ArrowDown':
                consume();
                if (count) {
                    this.selectedIndex = (this.selectedIndex + 1) % count;
                    this.updateSelection();
                }
                break;

            case 'ArrowUp':
                consume();
                if (count) {
                    this.selectedIndex = (this.selectedIndex - 1 + count) % count;
                    this.updateSelection();
                }
                break;

            case 'Enter':
            case 'Tab':
                if (e.shiftKey && e.key === 'Enter') return;
                consume();
                if (this.filteredCommands[this.selectedIndex]) {
                    this.executeCommand(this.filteredCommands[this.selectedIndex]);
                }
                break;
        }
    }

    /**
     * Execute selected command. The typed "/command" text is removed first;
     * for modal commands that happens when the modal opens (cancelling the
     * modal leaves the caret in the now-empty block).
     */
    executeCommand(cmd) {
        const slashRange = this.slashRange ? this.slashRange.cloneRange() : null;
        this.closeMenu();

        if (cmd.modal) {
            const block = this.transact(() => this.deleteSlash(slashRange));
            this.instance.selection.save();
            cmd.action();
            this.restoreCursorOnModalClose(block);
        } else {
            this.transact(() => {
                this.deleteSlash(slashRange);
                cmd.action();
            });
        }
    }

    /**
     * Delete the "/command" text. If its block ends up empty it keeps a
     * <br> (height + caret). Leaves the caret where the slash was.
     * @returns {Element|null} the block the slash was typed in
     */
    deleteSlash(range) {
        const root = this.instance.editorEl;
        if (!range || !root.contains(range.startContainer)) return null;

        const startEl = range.startContainer.nodeType === Node.ELEMENT_NODE
            ? range.startContainer : range.startContainer.parentElement;
        let block = startEl ? startEl.closest(LINE_BLOCK_SELECTOR) : null;
        if (!block || !root.contains(block)) {
            const point = findHostChild(range.startContainer, root);
            block = point && point.block.nodeType === Node.ELEMENT_NODE ? point.block : null;
        }

        try {
            range.deleteContents();
        } catch (e) {
            return block;
        }

        const sel = window.getSelection();
        const caret = document.createRange();
        if (block && isBlockEmpty(block, 'img, iframe, hr, table, video')) {
            // Drop leftover empty text nodes, keep the block tall
            Array.from(block.childNodes).forEach(n => {
                if (n.nodeType === Node.TEXT_NODE && !n.data) n.remove();
            });
            if (!block.querySelector('br')) block.appendChild(document.createElement('br'));
            caret.setStart(block, 0);
        } else {
            caret.setStart(range.startContainer, range.startOffset);
        }
        caret.collapse(true);
        sel.removeAllRanges();
        sel.addRange(caret);
        return block;
    }

    /**
     * After a modal command: if the modal is closed without inserting
     * anything (Cancel / Escape), put the caret back into the block the
     * command was typed in — otherwise focus returns to the start of the
     * editor.
     *
     * The other modules open their modals themselves, so a close listener
     * is attached to the modal they opened (their own onClose stays intact).
     */
    restoreCursorOnModalClose(block) {
        const modal = this.instance.modal;
        if (!block || !modal || !modal.isOpen) return;
        modal.addCloseListener(() => this.restoreCursor(block));
    }

    restoreCursor(block) {
        const root = this.instance.editorEl;
        // The module inserted something and placed the caret itself.
        const sel = window.getSelection();
        if (sel.rangeCount && root.contains(sel.getRangeAt(0).startContainer) &&
            document.activeElement === root) {
            return;
        }
        if (!block || !block.isConnected || !root.contains(block)) {
            // Saved / inserted content took the block's place.
            if (sel.rangeCount && root.contains(sel.getRangeAt(0).startContainer)) root.focus({ preventScroll: true });
            return;
        }
        root.focus({ preventScroll: true });
        const range = document.createRange();
        range.setStart(block, 0);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
    }

    /**
     * Open the menu
     */
    openMenu() {
        this.isOpen = true;
        this.menu.style.display = 'block';
        if (!this.popEscape) {
            this.popEscape = pushEscapeLayer(() => this.closeMenu(), { scope: this.instance.wrapper });
        }
        this.updateMenuPosition();
    }

    /**
     * Close the menu
     */
    closeMenu() {
        this.isOpen = false;
        if (this.menu) this.menu.style.display = 'none';
        this.slashRange = null;
        this.selectedIndex = 0;
        if (this.popEscape) {
            this.popEscape();
            this.popEscape = null;
        }
    }

    /** Close slash menu (HTML mode, content replaced). */
    hideUI() {
        if (this.isOpen) this.closeMenu();
    }

    /**
     * Position the menu under the "/" (flips above when there's no room
     * below in the viewport).
     */
    updateMenuPosition() {
        let rect = null;
        if (this.slashRange && this.instance.editorEl.contains(this.slashRange.startContainer)) {
            const r = this.slashRange.getBoundingClientRect();
            if (r && (r.width || r.height)) rect = r;
        }
        if (!rect) rect = getSelectionRect();
        if (!rect) return;
        placePopover(this.menu, rect, { side: 'bottom', align: 'start', offset: 5 });
    }

    // ==================== Command Actions ====================

    /** Current block for in-place commands: { host, block } or null. */
    getCaretBlock() {
        const selection = window.getSelection();
        if (!selection.rangeCount) return null;
        const root = this.instance.editorEl;
        const node = selection.getRangeAt(0).startContainer;
        const point = findHostChild(node, root);
        if (!point) return null;

        // Naked inline content directly in a host — wrap it first
        if (point.block.nodeType !== Node.ELEMENT_NODE || !TEXT_BLOCK_TAGS.includes(point.block.tagName)) {
            if (point.block.nodeType === Node.TEXT_NODE) {
                const p = document.createElement('p');
                point.host.insertBefore(p, point.block);
                p.appendChild(point.block);
                return { host: point.host, block: p };
            }
            return null;
        }
        return point;
    }

    /**
     * Turn the current text block into `tagName` (h1-h3 or a callout).
     */
    formatBlock(tagName) {
        const point = this.getCaretBlock();
        if (!point) return;
        const block = point.block;
        const root = this.instance.editorEl;

        const newBlock = document.createElement(tagName);
        while (block.firstChild) {
            newBlock.appendChild(block.firstChild);
        }

        // Keep the author's classes
        if (block.className) {
            newBlock.className = block.className;
        }

        // Ensure the block has content for proper height
        if (!newBlock.textContent.trim() && !newBlock.querySelector('br, img, iframe')) {
            newBlock.innerHTML = '<br>';
        }

        block.parentNode.replaceChild(newBlock, block);

        // Callout contract: <aside> is a block container, direct children
        // must be P/H1-H3/UL/OL/HR.
        let cursorTarget = newBlock;
        if (tagName.toLowerCase() === 'aside') {
            normalizeContainerChildren(newBlock, root);
            cursorTarget = newBlock.firstElementChild || newBlock;
        }

        // Place cursor in the new block
        const selection = window.getSelection();
        const newRange = document.createRange();
        if (cursorTarget.firstChild && cursorTarget.firstChild.nodeType === Node.TEXT_NODE) {
            newRange.setStart(cursorTarget.firstChild, 0);
        } else if (cursorTarget.firstChild) {
            newRange.setStartBefore(cursorTarget.firstChild);
        } else {
            newRange.setStart(cursorTarget, 0);
        }
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);
    }

    /**
     * Open another module's modal (image, gallery, video, embed, table, code).
     */
    openModuleModal(name) {
        if (name === 'Gallery' && this.liteMode) return;
        const module = this.getModule(name);
        if (module && typeof module.openModal === 'function') {
            module.openModal();
        }
    }

    /**
     * Insert a new empty quote-card via QuoteCard module.
     */
    insertQuoteCard() {
        const quoteCardModule = this.getModule('QuoteCard');
        if (quoteCardModule) {
            quoteCardModule.insertEmpty();
        }
    }

    /**
     * Insert horizontal separator (Separator module owns the markup).
     */
    insertSeparator() {
        const separator = this.getModule('Separator');
        if (separator) separator.insertSeparator();
    }

    /**
     * Insert list (ordered or unordered): replaces an empty text block,
     * otherwise goes right after the current block.
     */
    insertList(type) {
        const list = document.createElement(type);
        const li = document.createElement('li');
        li.innerHTML = '<br>';
        list.appendChild(li);

        const point = this.getCaretBlock();
        if (point) {
            const { block } = point;
            if (isBlockEmpty(block, 'img, iframe, video')) {
                block.parentNode.replaceChild(list, block);
            } else {
                block.parentNode.insertBefore(list, block.nextSibling);
            }
        } else {
            this.instance.selection.insertNode(list);
        }

        // Place cursor in the list item
        const selection = window.getSelection();
        const newRange = document.createRange();
        newRange.setStart(li, 0);
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);
    }

    getButtons() {
        return [];
    }
}
