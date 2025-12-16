import Module from '../core/Module.js';
import Icons from '../ui/Icons.js';

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
        
        // Кнопки форматирования
        const buttons = [
            { name: 'bold', icon: Icons.bold, title: 'Bold', command: 'bold' },
            { name: 'italic', icon: Icons.italic, title: 'Italic', command: 'italic' },
            { name: 'underline', icon: Icons.underline, title: 'Underline', command: 'underline' },
            { name: 'strike', icon: Icons.strike, title: 'Strikethrough', command: 'strikeThrough' },
            { name: 'mark', icon: Icons.mark, title: 'Highlight', action: () => this.toggleInlineTag('mark') },
            { type: 'separator' },
            { name: 'code', icon: Icons.code, title: 'Monospace', action: () => this.toggleInlineTag('code') },
            { name: 'spoiler', icon: Icons.spoiler, title: 'Spoiler', action: () => this.toggleInlineTag('span', 'spoiler') },
            { type: 'separator' },
            { name: 'link', icon: Icons.link, title: 'Link', action: () => this.openLinkModal() },
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
            
            button.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                if (btn.command) {
                    this.instance.selection.excludeTrailingSpacesFromSelection();
                    document.execCommand(btn.command);
                    this.instance.sync();
                    this.updateButtonStates();
                } else if (btn.action) {
                    btn.action();
                }
            });

            this.toolbar.appendChild(button);
        });

        this.instance.wrapper.appendChild(this.toolbar);
    }

    bindEvents() {
        document.addEventListener('selectionchange', () => {
            this.onSelectionChange();
        });

        document.addEventListener('mousedown', (e) => {
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
                    // Проверяем, находимся ли мы внутри соответствующего тега
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
        
        // Проверяем, есть ли уже ссылка
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
        
        // Если выделена часть ссылки - расширяем выделение на всю ссылку
        if (existingLink) {
            const range = document.createRange();
            range.selectNodeContents(existingLink);
            selection.removeAllRanges();
            selection.addRange(range);
        }
        
        // Сохраняем выделение
        this.instance.selection.save();
        
        const selectedText = selection.toString();

        // Создаем форму
        const form = document.createElement('div');
        
        // URL
        const urlGroup = this.createInputGroup('URL', 'text', existingLink ? existingLink.href : 'https://');
        const urlInput = urlGroup.querySelector('input');
        
        // Текст ссылки
        const textGroup = this.createInputGroup('Link Text', 'text', selectedText);
        const textInput = textGroup.querySelector('input');
        
        // Title
        const titleGroup = this.createInputGroup('Title (tooltip)', 'text', existingLink ? existingLink.title || '' : '');
        const titleInput = titleGroup.querySelector('input');
        
        // Rel (дополнительные значения)
        const relGroup = this.createInputGroup('Rel (except nofollow)', 'text', existingLink ? (existingLink.rel || '').replace('nofollow', '').trim() : '');
        const relInput = relGroup.querySelector('input');
        relInput.placeholder = 'sponsored, ugc, ...';
        
        // Чекбоксы
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
        targetLabel.append(targetCheck, 'Open in new window');

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
        nofollowLabel.append(nofollowCheck, 'nofollow');

        checksDiv.append(targetLabel, nofollowLabel);

        form.append(urlGroup, textGroup, titleGroup, relGroup, checksDiv);

        this.hide();

        // Подготовка дополнительных кнопок (Remove для существующей ссылки)
        const extraButtons = [];
        if (existingLink) {
            extraButtons.push({
                text: 'Remove Link',
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
            title: existingLink ? 'Edit Link' : 'Insert Link',
            body: form,
            extraButtons: extraButtons,
            onSave: () => {
                const url = urlInput.value;
                const text = textInput.value || url;
                const title = titleInput.value;
                const relExtra = relInput.value.trim();
                
                if (url && url !== 'https://') {
                    this.instance.selection.restore();
                    
                    // Удаляем старую ссылку если есть
                    if (existingLink) {
                        document.execCommand('unlink');
                    }
                    
                    // Создаем ссылку
                    const a = document.createElement('a');
                    a.href = url;
                    a.textContent = text;
                    if (title) a.title = title;
                    if (targetCheck.checked) a.target = '_blank';
                    
                    // Собираем rel
                    const relParts = [];
                    if (nofollowCheck.checked) relParts.push('nofollow');
                    if (relExtra) relParts.push(relExtra);
                    if (relParts.length > 0) a.rel = relParts.join(' ');
                    
                    this.instance.selection.insertNode(a);
                    this.instance.sync();
                }
            }
        });
    }

    /**
     * Упрощённая модалка для ссылок в lite mode
     * Только URL и текст, всегда nofollow, без title/rel настроек
     */
    openLiteLinkModal() {
        const selection = window.getSelection();
        
        // Проверяем, есть ли уже ссылка
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
        
        // Если выделена часть ссылки - расширяем выделение на всю ссылку
        if (existingLink) {
            const range = document.createRange();
            range.selectNodeContents(existingLink);
            selection.removeAllRanges();
            selection.addRange(range);
        }
        
        // Сохраняем выделение
        this.instance.selection.save();
        
        const selectedText = selection.toString();

        // Создаем простую форму
        const form = document.createElement('div');
        
        // URL
        const urlGroup = this.createInputGroup('URL', 'text', existingLink ? existingLink.href : 'https://');
        const urlInput = urlGroup.querySelector('input');
        urlInput.placeholder = 'https://example.com';
        
        // Текст ссылки
        const textGroup = this.createInputGroup('Link Text', 'text', selectedText);
        const textInput = textGroup.querySelector('input');

        form.append(urlGroup, textGroup);

        this.hide();

        // Подготовка дополнительных кнопок (Remove для существующей ссылки)
        const extraButtons = [];
        if (existingLink) {
            extraButtons.push({
                text: 'Remove Link',
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
            title: existingLink ? 'Edit Link' : 'Insert Link',
            body: form,
            extraButtons: extraButtons,
            onSave: () => {
                const url = urlInput.value;
                const text = textInput.value || url;
                
                if (url && url !== 'https://') {
                    this.instance.selection.restore();
                    
                    // Удаляем старую ссылку если есть
                    if (existingLink) {
                        document.execCommand('unlink');
                    }
                    
                    // Создаем ссылку - в lite mode всегда nofollow и _blank
                    const a = document.createElement('a');
                    a.href = url;
                    a.textContent = text;
                    a.rel = 'nofollow';
                    a.target = '_blank';
                    
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

        // Исключаем пробелы из выделения
        this.instance.selection.excludeTrailingSpacesFromSelection();
        
        const range = selection.getRangeAt(0);
        
        // Проверяем, находимся ли мы внутри такого тега
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
            // Убираем тег - разворачиваем содержимое
            const parent = existingTag.parentNode;
            while (existingTag.firstChild) {
                parent.insertBefore(existingTag.firstChild, existingTag);
            }
            parent.removeChild(existingTag);
        } else {
            // Оборачиваем выделенное в тег
            const selectedContent = range.extractContents();
            const wrapper = document.createElement(tagName);
            if (className) {
                wrapper.className = className;
            }
            wrapper.appendChild(selectedContent);
            range.insertNode(wrapper);
            
            // Выделяем обратно
            selection.removeAllRanges();
            const newRange = document.createRange();
            newRange.selectNodeContents(wrapper);
            selection.addRange(newRange);
        }

        this.instance.sync();
        this.updateButtonStates();
    }
}
