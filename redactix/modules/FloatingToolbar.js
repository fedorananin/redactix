import Module from '../core/Module.js';
import Icons from '../ui/Icons.js';
import { sanitizeUrl, composeLinkRel } from '../core/dom-utils.js';

export default class FloatingToolbar extends Module {
    constructor(instance) {
        super(instance);
        this.toolbar = null;
        this.isVisible = false;
        this.hideTimeout = null;
        this.savedRange = null;
        this.liteMode = instance.config.liteMode || false;
    }

    init() {
        this.createToolbar();
        this.bindEvents();
    }

    createToolbar() {
        this.toolbar = document.createElement('div');
        this.toolbar.className = 'redactix-floating-toolbar';
        this.toolbar.style.display = 'none';
        
        // Formatting buttons
        const buttons = [
            { name: 'bold', icon: Icons.bold, title: this.t('toolbar.bold'), command: 'bold' },
            { name: 'italic', icon: Icons.italic, title: this.t('toolbar.italic'), command: 'italic' },
            { name: 'underline', icon: Icons.underline, title: this.t('toolbar.underline'), command: 'underline' },
            { name: 'strike', icon: Icons.strike, title: this.t('toolbar.strikethrough'), command: 'strikeThrough' },
            { name: 'mark', icon: Icons.mark, title: this.t('toolbar.highlight'), action: () => this.toggleInlineTag('mark') },
            { type: 'separator' },
            { name: 'code', icon: Icons.code, title: this.t('toolbar.monospace'), action: () => this.toggleInlineTag('code') },
            { name: 'spoiler', icon: Icons.spoiler, title: this.t('toolbar.spoiler'), action: () => this.toggleInlineTag('span', 'spoiler') },
            { type: 'separator' },
            { name: 'link', icon: Icons.link, title: this.t('toolbar.link'), action: () => this.openLinkModal() },
        ];

        buttons.forEach(btn => {
            if (btn.type === 'separator') {
                const sep = document.createElement('div');
                sep.className = 'redactix-floating-separator';
                this.toolbar.appendChild(sep);
                return;
            }

            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'redactix-floating-btn';
            button.innerHTML = btn.icon;
            button.title = btn.title;
            button.dataset.name = btn.name;
            
            const run = () => {
                if (btn.command) {
                    this.instance.selection.excludeTrailingSpacesFromSelection();
                    document.execCommand(btn.command);
                    this.instance.sync();
                    this.updateButtonStates();
                } else if (btn.action) {
                    btn.action();
                }
            };

            button.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                run();
            });

            // Keyboard activation (click with detail === 0)
            button.addEventListener('click', (e) => {
                if (e.detail === 0) run();
            });

            this.toolbar.appendChild(button);
        });

        this.instance.wrapper.appendChild(this.toolbar);
    }

    bindEvents() {
        // Global listeners — via registry so that destroy() removes them.
        this.instance.listen(document, 'selectionchange', () => {
            this.onSelectionChange();
        });

        this.instance.listen(document, 'mousedown', (e) => {
            if (!this.instance.wrapper.contains(e.target) &&
                !e.target.closest('.redactix-modal-overlay')) {
                this.hide();
            }
        });

        this.instance.editorEl.addEventListener('scroll', () => {
            if (this.isVisible) {
                this.updatePosition();
            }
        });
    }

    onSelectionChange() {
        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
            this.hideTimeout = null;
        }

        const selection = window.getSelection();
        
        if (!selection.rangeCount) {
            this.hide();
            return;
        }

        const range = selection.getRangeAt(0);
        
        if (!this.instance.editorEl.contains(range.commonAncestorContainer)) {
            this.hide();
            return;
        }

        if (range.collapsed) {
            this.hide();
            return;
        }

        const selectedText = selection.toString().trim();
        
        if (selectedText.length < 1) {
            this.hide();
            return;
        }

        this.hideTimeout = setTimeout(() => {
            this.show();
            this.updatePosition();
            this.updateButtonStates();
        }, 100);
    }

    show() {
        this.toolbar.style.display = 'flex';
        this.isVisible = true;
    }

    hide() {
        this.toolbar.style.display = 'none';
        this.isVisible = false;
    }

    /** Hide floating toolbar (called when entering HTML mode). */
    hideUI() {
        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
            this.hideTimeout = null;
        }
        this.hide();
    }

    updatePosition() {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        const wrapperRect = this.instance.wrapper.getBoundingClientRect();
        const toolbarRect = this.toolbar.getBoundingClientRect();

        let top = rect.top - wrapperRect.top - toolbarRect.height - 10;
        let left = rect.left - wrapperRect.left + (rect.width / 2) - (toolbarRect.width / 2);

        if (top < 0) {
            top = rect.bottom - wrapperRect.top + 10;
        }
        
        if (left < 5) {
            left = 5;
        }
        
        const maxLeft = wrapperRect.width - toolbarRect.width - 5;
        if (left > maxLeft) {
            left = maxLeft;
        }

        this.toolbar.style.top = `${top}px`;
        this.toolbar.style.left = `${left}px`;
    }

    updateButtonStates() {
        const buttons = this.toolbar.querySelectorAll('.redactix-floating-btn');
        
        buttons.forEach(btn => {
            const name = btn.dataset.name;
            let isActive = false;
            
            switch (name) {
                case 'bold':
                    isActive = document.queryCommandState('bold');
                    break;
                case 'italic':
                    isActive = document.queryCommandState('italic');
                    break;
                case 'underline':
                    isActive = document.queryCommandState('underline');
                    break;
                case 'strike':
                    isActive = document.queryCommandState('strikeThrough');
                    break;
                case 'link':
                case 'code':
                case 'spoiler':
                case 'mark':
                    // Check if we are inside the corresponding tag
                    const selection = window.getSelection();
                    if (selection.rangeCount) {
                        let node = selection.getRangeAt(0).commonAncestorContainer;
                        while (node && node !== this.instance.editorEl) {
                            if (node.nodeType === Node.ELEMENT_NODE) {
                                if (name === 'link' && node.tagName === 'A') {
                                    isActive = true;
                                    break;
                                }
                                if (name === 'code' && node.tagName === 'CODE') {
                                    isActive = true;
                                    break;
                                }
                                if (name === 'spoiler' && node.tagName === 'SPAN' && node.classList.contains('spoiler')) {
                                    isActive = true;
                                    break;
                                }
                                if (name === 'mark' && node.tagName === 'MARK') {
                                    isActive = true;
                                    break;
                                }
                            }
                            node = node.parentNode;
                        }
                    }
                    break;
            }
            
            btn.classList.toggle('active', isActive);
        });
    }

    openLinkModal() {
        // В lite mode используем упрощённую версию
        if (this.liteMode) {
            this.openLiteLinkModal();
            return;
        }
        
        const selection = window.getSelection();
        
        // Check if there is already a link
        let existingLink = null;
        if (selection.rangeCount) {
            let node = selection.getRangeAt(0).commonAncestorContainer;
            while (node && node !== this.instance.editorEl) {
                if (node.tagName === 'A') {
                    existingLink = node;
                    break;
                }
                node = node.parentNode;
            }
        }
        
        // If part of the link is selected - expand the selection to the entire link
        if (existingLink) {
            const range = document.createRange();
            range.selectNodeContents(existingLink);
            selection.removeAllRanges();
            selection.addRange(range);
        }
        
        // Save selection
        this.instance.selection.save();
        
        const selectedText = selection.toString();

        // Create form
        const form = document.createElement('div');
        
        // URL — read the attribute, not the property: .href expands
        // relative links into absolute ones.
        const urlGroup = this.createInputGroup(this.t('link.url'), 'text', existingLink ? (existingLink.getAttribute('href') || '') : 'https://');
        const urlInput = urlGroup.querySelector('input');

        // Link text
        const textGroup = this.createInputGroup(this.t('link.linkText'), 'text', selectedText);
        const textInput = textGroup.querySelector('input');

        // Title
        const titleGroup = this.createInputGroup(this.t('link.titleAttr'), 'text', existingLink ? existingLink.title || '' : '');
        const titleInput = titleGroup.querySelector('input');
        
        // Rel (extra values)
        const relGroup = this.createInputGroup(this.t('link.relExceptNofollow'), 'text', existingLink ? (existingLink.rel || '').replace('nofollow', '').trim() : '');
        const relInput = relGroup.querySelector('input');
        relInput.placeholder = this.t('link.relPlaceholder');
        
        // Checkboxes
        const checksDiv = document.createElement('div');
        checksDiv.style.marginTop = '10px';

        const targetLabel = document.createElement('label');
        targetLabel.style.fontWeight = 'normal';
        targetLabel.style.display = 'inline-flex';
        targetLabel.style.alignItems = 'center';
        targetLabel.style.marginRight = '15px';
        targetLabel.style.cursor = 'pointer';
        const targetCheck = document.createElement('input');
        targetCheck.type = 'checkbox';
        targetCheck.style.width = 'auto';
        targetCheck.style.marginRight = '5px';
        targetCheck.checked = existingLink ? existingLink.target === '_blank' : false;
        targetLabel.append(targetCheck, this.t('link.openNewWindow'));

        const nofollowLabel = document.createElement('label');
        nofollowLabel.style.fontWeight = 'normal';
        nofollowLabel.style.display = 'inline-flex';
        nofollowLabel.style.alignItems = 'center';
        nofollowLabel.style.cursor = 'pointer';
        const nofollowCheck = document.createElement('input');
        nofollowCheck.type = 'checkbox';
        nofollowCheck.style.width = 'auto';
        nofollowCheck.style.marginRight = '5px';
        nofollowCheck.checked = existingLink ? (existingLink.rel || '').includes('nofollow') : false;
        nofollowLabel.append(nofollowCheck, this.t('link.nofollow'));

        checksDiv.append(targetLabel, nofollowLabel);

        form.append(urlGroup, textGroup, titleGroup, relGroup, checksDiv);

        this.hide();

        // Prepare extra buttons (Remove for existing link)
        const extraButtons = [];
        if (existingLink) {
            extraButtons.push({
                text: this.t('link.removeLink'),
                danger: true,
                onClick: () => {
                    this.instance.selection.restore();
                    document.execCommand('unlink');
                    this.instance.sync();
                    this.instance.modal.close();
                    this.hide();
                }
            });
        }

        this.instance.modal.open({
            title: existingLink ? this.t('link.editTitle') : this.t('link.title'),
            body: form,
            extraButtons: extraButtons,
            onSave: () => {
                const url = urlInput.value;
                const text = textInput.value || url;
                const title = titleInput.value;
                const relExtra = relInput.value.trim();
                
                if (url && url !== 'https://') {
                    // Validate URL scheme — javascript:/data:text/html are rejected.
                    const safeUrl = sanitizeUrl(url);
                    if (!safeUrl) return;

                    this.instance.selection.restore();

                    // Remove old link if present
                    if (existingLink) {
                        document.execCommand('unlink');
                    }

                    const a = document.createElement('a');
                    a.href = safeUrl;
                    a.textContent = text;
                    if (title) a.title = title;
                    if (targetCheck.checked) a.target = '_blank';

                    // composeLinkRel will automatically add noopener+noreferrer
                    // for target=_blank and filter custom
                    // rel tokens to a safe whitelist.
                    const rel = composeLinkRel({
                        nofollow: nofollowCheck.checked,
                        blank: targetCheck.checked,
                        extra: relExtra
                    });
                    if (rel) a.rel = rel;

                    this.instance.selection.insertNode(a);
                    this.instance.sync();
                }
            }
        });
    }

    /**
     * Simplified modal for links in lite mode
     * Only URL and text, always nofollow, no title/rel settings
     */
    openLiteLinkModal() {
        const selection = window.getSelection();
        
        // Check if there is already a link
        let existingLink = null;
        if (selection.rangeCount) {
            let node = selection.getRangeAt(0).commonAncestorContainer;
            while (node && node !== this.instance.editorEl) {
                if (node.tagName === 'A') {
                    existingLink = node;
                    break;
                }
                node = node.parentNode;
            }
        }
        
        // If part of the link is selected - expand the selection to the entire link
        if (existingLink) {
            const range = document.createRange();
            range.selectNodeContents(existingLink);
            selection.removeAllRanges();
            selection.addRange(range);
        }
        
        // Save selection
        this.instance.selection.save();
        
        const selectedText = selection.toString();

        // Create a simple form
        const form = document.createElement('div');
        
        // URL — getAttribute, so that relative links are not expanded
        const urlGroup = this.createInputGroup(this.t('link.url'), 'text', existingLink ? (existingLink.getAttribute('href') || '') : 'https://');
        const urlInput = urlGroup.querySelector('input');
        urlInput.placeholder = 'https://example.com';
        
        // Link text
        const textGroup = this.createInputGroup(this.t('link.linkText'), 'text', selectedText);
        const textInput = textGroup.querySelector('input');

        form.append(urlGroup, textGroup);

        this.hide();

        // Prepare extra buttons (Remove for existing link)
        const extraButtons = [];
        if (existingLink) {
            extraButtons.push({
                text: this.t('link.removeLink'),
                danger: true,
                onClick: () => {
                    this.instance.selection.restore();
                    document.execCommand('unlink');
                    this.instance.sync();
                    this.instance.modal.close();
                    this.hide();
                }
            });
        }

        this.instance.modal.open({
            title: existingLink ? this.t('link.editTitle') : this.t('link.title'),
            body: form,
            extraButtons: extraButtons,
            onSave: () => {
                const url = urlInput.value;
                const text = textInput.value || url;
                
                if (url && url !== 'https://') {
                    const safeUrl = sanitizeUrl(url);
                    if (!safeUrl) return;

                    this.instance.selection.restore();

                    // Remove old link if present
                    if (existingLink) {
                        document.execCommand('unlink');
                    }

                    // In lite mode always nofollow + _blank.
                    // composeLinkRel will add noopener/noreferrer.
                    const a = document.createElement('a');
                    a.href = safeUrl;
                    a.textContent = text;
                    a.target = '_blank';
                    a.rel = composeLinkRel({ nofollow: true, blank: true });

                    this.instance.selection.insertNode(a);
                    this.instance.sync();
                }
            }
        });
    }

    createInputGroup(labelText, type, value = '') {
        const div = document.createElement('div');
        const label = document.createElement('label');
        label.textContent = labelText;
        const input = document.createElement('input');
        input.type = type;
        input.value = value;
        div.append(label, input);
        return div;
    }

    toggleInlineTag(tagName, className = null) {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        // Exclude spaces from selection
        this.instance.selection.excludeTrailingSpacesFromSelection();
        
        const range = selection.getRangeAt(0);
        
        // Check if we are inside such a tag
        let existingTag = null;
        let node = range.commonAncestorContainer;
        while (node && node !== this.instance.editorEl) {
            if (node.nodeType === Node.ELEMENT_NODE) {
                if (node.tagName.toLowerCase() === tagName.toLowerCase()) {
                    if (!className || node.classList.contains(className)) {
                        existingTag = node;
                        break;
                    }
                }
            }
            node = node.parentNode;
        }

        if (existingTag) {
            // Remove tag - unwrap content
            const parent = existingTag.parentNode;
            while (existingTag.firstChild) {
                parent.insertBefore(existingTag.firstChild, existingTag);
            }
            parent.removeChild(existingTag);
        } else {
            // Wrap selected in tag
            const selectedContent = range.extractContents();
            const wrapper = document.createElement(tagName);
            if (className) {
                wrapper.className = className;
            }
            wrapper.appendChild(selectedContent);
            range.insertNode(wrapper);
            
            // Select back
            selection.removeAllRanges();
            const newRange = document.createRange();
            newRange.selectNodeContents(wrapper);
            selection.addRange(newRange);
        }

        this.instance.sync();
        this.updateButtonStates();
    }
}
