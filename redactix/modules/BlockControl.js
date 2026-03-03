import Module from '../core/Module.js';
import Icons from '../ui/Icons.js';

export default class BlockControl extends Module {
    constructor(instance) {
        super(instance);
        this.handle = null;        // Основная ручка (для блоков и LI)
        this.listHandle = null;    // Ручка для UL/OL целиком
        this.menu = null;
        this.currentBlock = null;
        this.currentList = null;   // Текущий список для listHandle
        this.isDragging = false;
        this.dragPlaceholder = null;
        this.dragGhost = null;
        this.activeHandle = null;  // Какая ручка активна
        this.liteMode = instance.config.liteMode || false; // Lite mode
        this.emojiInput = null;    // Emoji input popup for callouts

        // Пресеты для callout (aside)
        this.calloutPresets = [
            { name: 'none', label: 'No Style', class: null },
            { name: 'warning', label: 'Warning', class: 'warning' },
            { name: 'danger', label: 'Danger', class: 'danger' },
            { name: 'information', label: 'Information', class: 'information' },
            { name: 'success', label: 'Success', class: 'success' }
        ];

        // Пресеты для цитат (blockquote)
        this.quotePresets = [
            { name: 'none', label: 'Standard', class: null },
            { name: 'big', label: 'Big', class: 'big' }
        ];

        // Добавляем пользовательские пресеты из конфига
        if (instance.config.calloutPresets) {
            this.calloutPresets = [...this.calloutPresets, ...instance.config.calloutPresets];
        }
        if (instance.config.quotePresets) {
            this.quotePresets = [...this.quotePresets, ...instance.config.quotePresets];
        }
    }

    init() {
        this.createHandle();
        this.createListHandle();
        this.createMenu();

        // Слушаем движения мыши по редактору для отображения ручки
        this.instance.editorEl.addEventListener('mousemove', (e) => this.onMouseMove(e));

        // Обновляем позиции ручек при скролле editor'а (для maxHeight)
        this.instance.editorEl.addEventListener('scroll', () => {
            if (this.currentBlock && this.handle.style.display !== 'none') {
                this.showHandle(this.currentBlock);
            }
            if (this.currentList && this.listHandle.style.display !== 'none') {
                this.showListHandle(this.currentList);
            }
        });

        // Click on callout emoji area to edit
        this.instance.editorEl.addEventListener('click', (e) => {
            const aside = e.target.closest ? e.target.closest('aside[data-emoji]') : null;
            if (aside && this.instance.editorEl.contains(aside)) {
                const asideRect = aside.getBoundingClientRect();
                const emojiAreaWidth = parseFloat(window.getComputedStyle(aside).paddingLeft);
                if (e.clientX - asideRect.left < emojiAreaWidth) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.currentBlock = aside;
                    this.showEmojiInput();
                }
            }
        });

        // Скрываем меню при клике в любом месте
        document.addEventListener('click', (e) => {
            if (this.menu && !this.menu.contains(e.target) &&
                !this.handle.contains(e.target) &&
                !this.listHandle.contains(e.target)) {
                this.hideMenu();
            }
        });

        // Скрываем ручки, если мышь ушла с редактора
        this.instance.wrapper.addEventListener('mouseleave', (e) => {
            // Проверяем, что мышь не перешла на ручки или меню
            const relatedTarget = e.relatedTarget;
            if (relatedTarget && (
                this.handle.contains(relatedTarget) ||
                this.listHandle.contains(relatedTarget) ||
                (this.menu && this.menu.contains(relatedTarget))
            )) {
                return;
            }

            if (!this.isDragging && (!this.menu || this.menu.style.display === 'none')) {
                this.hideHandle();
                this.hideListHandle();
            }
        });

        // Предотвращаем скрытие ручки когда мышь на ней
        this.handle.addEventListener('mouseenter', () => {
            this.handle.style.display = 'flex';
        });

        this.listHandle.addEventListener('mouseenter', () => {
            this.listHandle.style.display = 'flex';
        });

        // Когда мышь уходит с ручки - проверяем куда
        this.handle.addEventListener('mouseleave', (e) => {
            const relatedTarget = e.relatedTarget;
            // Если перешли на редактор или текущий блок - не скрываем
            if (relatedTarget && (
                this.instance.editorEl.contains(relatedTarget) ||
                (this.menu && this.menu.contains(relatedTarget))
            )) {
                return;
            }
            // Иначе скрываем, если меню не открыто
            if (!this.menu || this.menu.style.display === 'none') {
                this.hideHandle();
            }
        });

        this.listHandle.addEventListener('mouseleave', (e) => {
            const relatedTarget = e.relatedTarget;
            if (relatedTarget && (
                this.instance.editorEl.contains(relatedTarget) ||
                (this.menu && this.menu.contains(relatedTarget))
            )) {
                return;
            }
            if (!this.menu || this.menu.style.display === 'none') {
                this.hideListHandle();
            }
        });
    }

    createHandle() {
        this.handle = document.createElement('div');
        this.handle.className = 'redactix-block-handle';
        this.handle.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
            <circle cx="9" cy="6" r="1.5"/>
            <circle cx="15" cy="6" r="1.5"/>
            <circle cx="9" cy="12" r="1.5"/>
            <circle cx="15" cy="12" r="1.5"/>
            <circle cx="9" cy="18" r="1.5"/>
            <circle cx="15" cy="18" r="1.5"/>
        </svg>`;
        this.handle.contentEditable = false;

        this.handle.addEventListener('mousedown', (e) => {
            this.activeHandle = 'block';
            this.onDragStart(e);
        });
        this.handle.addEventListener('click', (e) => {
            this.activeHandle = 'block';
            this.onHandleClick(e);
        });

        // Touch события для мобильных
        this.handle.addEventListener('touchstart', (e) => {
            this.activeHandle = 'block';
            this.onTouchStart(e);
        }, { passive: false });

        this.instance.wrapper.appendChild(this.handle);
    }

    createListHandle() {
        this.listHandle = document.createElement('div');
        this.listHandle.className = 'redactix-block-handle redactix-list-handle';
        this.listHandle.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
            <rect x="6" y="4" width="12" height="2" rx="1"/>
            <rect x="6" y="11" width="12" height="2" rx="1"/>
            <rect x="6" y="18" width="12" height="2" rx="1"/>
        </svg>`;
        this.listHandle.contentEditable = false;
        this.listHandle.title = this.t('blockControl.dragEntireList');

        this.listHandle.addEventListener('mousedown', (e) => {
            this.activeHandle = 'list';
            this.currentBlock = this.currentList;
            this.onDragStart(e);
        });
        this.listHandle.addEventListener('click', (e) => {
            this.activeHandle = 'list';
            this.currentBlock = this.currentList;
            this.onHandleClick(e);
        });

        // Touch события для мобильных
        this.listHandle.addEventListener('touchstart', (e) => {
            this.activeHandle = 'list';
            this.currentBlock = this.currentList;
            this.onTouchStart(e);
        }, { passive: false });

        this.instance.wrapper.appendChild(this.listHandle);
    }

    createMenu() {
        this.menu = document.createElement('div');
        this.menu.className = 'redactix-block-menu';
        this.menu.style.display = 'none';
        this.instance.wrapper.appendChild(this.menu);
    }

    buildMenu() {
        this.menu.innerHTML = '';

        if (!this.currentBlock) return;

        const tag = this.currentBlock.tagName;
        const parentTag = this.currentBlock.parentElement?.tagName;

        // Группа: Преобразование блока
        if (['P', 'H1', 'H2', 'H3', 'BLOCKQUOTE', 'ASIDE'].includes(tag)) {
            const transformGroup = this.createMenuGroup(this.t('blockControl.transformTo'));
            const transforms = [
                { label: this.t('blockControl.paragraph'), tag: 'P', icon: '¶' },
                { label: this.t('blockControl.heading1'), tag: 'H1', icon: 'H1' },
                { label: this.t('blockControl.heading2'), tag: 'H2', icon: 'H2' },
                { label: this.t('blockControl.heading3'), tag: 'H3', icon: 'H3' },
                { label: this.t('blockControl.quote'), tag: 'BLOCKQUOTE', icon: '❝' },
                { label: this.t('blockControl.callout'), tag: 'ASIDE', icon: '💡' }
            ];

            transforms.forEach(t => {
                if (t.tag !== tag) {
                    const item = this.createMenuItem(t.icon, t.label, () => {
                        this.transformBlock(t.tag);
                    });
                    transformGroup.appendChild(item);
                }
            });
            this.menu.appendChild(transformGroup);
            this.menu.appendChild(this.createMenuDivider());
        }

        // Группа: Пресеты для Callout (aside)
        if (tag === 'ASIDE') {
            const presetGroup = this.createMenuGroup(this.t('blockControl.calloutStyle'));
            const currentClass = this.getCurrentPresetClass(this.calloutPresets);

            this.calloutPresets.forEach(preset => {
                const isActive = (preset.class === null && !currentClass) ||
                    (preset.class === currentClass);
                const icon = isActive ? '✓' : ' ';
                const item = this.createMenuItem(icon, preset.label, () => {
                    this.setPresetClass(preset.class, this.calloutPresets);
                });
                if (isActive) {
                    item.style.fontWeight = '600';
                }
                presetGroup.appendChild(item);
            });
            this.menu.appendChild(presetGroup);
            this.menu.appendChild(this.createMenuDivider());

            // Emoji for callout
            const hasEmoji = this.currentBlock.hasAttribute('data-emoji');
            const emojiLabel = hasEmoji
                ? this.t('blockControl.changeEmoji')
                : this.t('blockControl.addEmoji');
            const emojiIcon = hasEmoji ? '✎' : '😀';

            const emojiItem = this.createMenuItem(emojiIcon, emojiLabel, () => {
                this.showEmojiInput();
            });
            this.menu.appendChild(emojiItem);

            if (hasEmoji) {
                const removeItem = this.createMenuItem('✕', this.t('blockControl.removeEmoji'), () => {
                    this.removeCalloutEmoji();
                });
                this.menu.appendChild(removeItem);
            }

            this.menu.appendChild(this.createMenuDivider());
        }

        // Группа: Пресеты для цитат (blockquote)
        if (tag === 'BLOCKQUOTE') {
            const presetGroup = this.createMenuGroup(this.t('blockControl.quoteStyle'));
            const currentClass = this.getCurrentPresetClass(this.quotePresets);

            this.quotePresets.forEach(preset => {
                const isActive = (preset.class === null && !currentClass) ||
                    (preset.class === currentClass);
                const icon = isActive ? '✓' : ' ';
                const item = this.createMenuItem(icon, preset.label, () => {
                    this.setPresetClass(preset.class, this.quotePresets);
                });
                if (isActive) {
                    item.style.fontWeight = '600';
                }
                presetGroup.appendChild(item);
            });
            this.menu.appendChild(presetGroup);

            // Citation toggle: add or remove cite element
            const hasCite = !!this.currentBlock.querySelector('cite');
            const citeIcon = hasCite ? '✕' : '✎';
            const citeLabel = hasCite
                ? this.t('blockControl.removeCitation')
                : this.t('blockControl.addCitation');
            const citeItem = this.createMenuItem(citeIcon, citeLabel, () => {
                this.toggleCitation();
            });
            this.menu.appendChild(citeItem);

            this.menu.appendChild(this.createMenuDivider());
        }

        // Группа: Преобразование списка
        if (tag === 'LI' || tag === 'UL' || tag === 'OL') {
            const listGroup = this.createMenuGroup(this.t('blockControl.listType'));
            const currentListType = tag === 'LI' ? parentTag : tag;

            if (currentListType !== 'UL') {
                listGroup.appendChild(this.createMenuItem('•', this.t('blockControl.bulleted'), () => {
                    this.convertListType('UL');
                }));
            }
            if (currentListType !== 'OL') {
                listGroup.appendChild(this.createMenuItem('1.', this.t('blockControl.numbered'), () => {
                    this.convertListType('OL');
                }));
            }

            this.menu.appendChild(listGroup);
            this.menu.appendChild(this.createMenuDivider());
        }

        // Группа: Действия
        const actionsGroup = this.createMenuGroup(this.t('blockControl.actions'));

        actionsGroup.appendChild(this.createMenuItem('⊕', this.t('blockControl.insertBlockBelow'), () => {
            this.insertElementAfter();
        }));

        actionsGroup.appendChild(this.createMenuItem('⧉', this.t('blockControl.duplicate'), () => {
            this.duplicateBlock();
        }));

        // Атрибуты не показываем в lite mode
        if (!this.liteMode) {
            actionsGroup.appendChild(this.createMenuItem('⚙', this.t('blockControl.attributes'), () => {
                const attributesModule = this.instance.modules.find(m => m.constructor.name === 'Attributes');
                if (attributesModule) {
                    let target = this.currentBlock;
                    // Если это обертка разделителя, редактируем сам HR
                    if (target.classList.contains('redactix-separator')) {
                        const hr = target.querySelector('hr');
                        if (hr) target = hr;
                    }
                    attributesModule.openModal(target);
                }
            }));
        }

        actionsGroup.appendChild(this.createMenuItem('🗑', this.t('delete'), () => {
            this.deleteBlock();
        }, true));

        this.menu.appendChild(actionsGroup);
    }

    createMenuGroup(title) {
        const group = document.createElement('div');
        group.className = 'redactix-menu-group';

        const label = document.createElement('div');
        label.className = 'redactix-menu-group-label';
        label.textContent = title;
        group.appendChild(label);

        return group;
    }

    createMenuItem(icon, label, action, isDanger = false) {
        const item = document.createElement('div');
        item.className = 'redactix-menu-item' + (isDanger ? ' redactix-menu-item-danger' : '');
        item.innerHTML = `<span class="redactix-menu-icon">${icon}</span><span>${label}</span>`;
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            action();
            this.hideMenu();
        });
        return item;
    }

    createMenuDivider() {
        const divider = document.createElement('div');
        divider.className = 'redactix-menu-divider';
        return divider;
    }

    onMouseMove(e) {
        if (this.isDragging || (this.menu && this.menu.style.display === 'block')) return;

        let target = e.target;

        // Если курсор над редактором (например в паддинге слева), 
        // пробуем найти элемент чуть правее курсора (по оси Y того же уровня)
        if (target === this.instance.editorEl) {
            const editorRect = this.instance.editorEl.getBoundingClientRect();
            // Смещаемся на 60px от левого края редактора (примерно начало контента)
            const contentX = editorRect.left + 60;
            // Ищем элемент в этой точке
            const elementAtPoint = document.elementFromPoint(contentX, e.clientY);
            if (elementAtPoint && this.instance.editorEl.contains(elementAtPoint)) {
                target = elementAtPoint;
            }
        }

        // Поднимаемся вверх до блочного элемента
        while (target && target !== this.instance.editorEl) {
            const display = window.getComputedStyle(target).display;
            if (display === 'block' || display === 'list-item' || display === 'table' || target.tagName === 'LI' || target.tagName === 'HR') {
                break;
            }
            target = target.parentNode;
        }

        // Для списков: показываем две ручки - для LI и для UL/OL
        if (target && target.tagName === 'LI') {
            // Нашли LI - показываем ручку для него
            this.currentBlock = target;
            this.showHandle(target);

            // Также показываем ручку для родительского списка
            const parentList = target.parentElement;
            if (parentList && (parentList.tagName === 'UL' || parentList.tagName === 'OL')) {
                // Показываем ручку списка всегда (даже для вложенных)
                this.currentList = parentList;
                this.showListHandle(parentList);
            }
        } else if (target && (target.tagName === 'UL' || target.tagName === 'OL')) {
            // Навели на сам список (не на LI внутри)
            const listItems = Array.from(target.children).filter(child => child.tagName === 'LI');
            const mouseY = e.clientY;

            // Ищем LI под курсором
            const closestLi = listItems.find(li => {
                const r = li.getBoundingClientRect();
                return mouseY >= r.top && mouseY <= r.bottom;
            });

            if (closestLi) {
                this.currentBlock = closestLi;
                this.showHandle(closestLi);

                this.currentList = target;
                this.showListHandle(target);
            } else {
                // Нет LI под курсором - показываем только ручку списка
                this.currentBlock = target;
                this.currentList = target;
                this.showHandle(target);
                this.hideListHandle();
            }
        } else if (target && target !== this.instance.editorEl) {
            // Обычный блок
            this.currentBlock = target;
            this.showHandle(target);
            this.hideListHandle();
            this.currentList = null;
        } else {
            this.hideHandle();
            this.hideListHandle();
        }
    }

    showHandle(block) {
        const rect = block.getBoundingClientRect();
        const wrapperRect = this.instance.wrapper.getBoundingClientRect();
        const editorRect = this.instance.editorEl.getBoundingClientRect();

        let offset = 0;

        // Рассчитываем позицию слева динамически на основе отступа блока
        // Смещаем влево на ширину ручки (24px) + небольшой отступ
        let leftPos = (rect.left - wrapperRect.left) - 30;

        // Ограничиваем минимальную позицию, чтобы не уезжало за край
        if (leftPos < 2) leftPos = 2;

        if (block.tagName === 'UL' || block.tagName === 'OL') {
            offset = 5;
        } else if (block.classList.contains('redactix-separator')) {
            offset = 2;
        } else if (block.tagName === 'HR') {
            offset = -8;
        } else if (block.tagName === 'LI') {
            const style = window.getComputedStyle(block);
            const paddingTop = parseFloat(style.paddingTop) || 0;
            let lineHeight = parseFloat(style.lineHeight);

            if (isNaN(lineHeight)) {
                const fontSize = parseFloat(style.fontSize) || 16;
                lineHeight = fontSize * 1.2;
            }
            const handleHeight = 24;
            offset = paddingTop + (lineHeight - handleHeight) / 2;
        } else {
            const style = window.getComputedStyle(block);
            const paddingTop = parseFloat(style.paddingTop) || 0;
            let lineHeight = parseFloat(style.lineHeight);

            if (isNaN(lineHeight)) {
                const fontSize = parseFloat(style.fontSize) || 16;
                lineHeight = fontSize * 1.2;
            }
            const handleHeight = 24;
            offset = paddingTop + (lineHeight - handleHeight) / 2;
        }

        // Позиция относительно wrapper (ручки абсолютно позиционированы в wrapper)
        const top = rect.top - wrapperRect.top + offset;

        // Проверяем, виден ли блок в области editor'а (для maxHeight режима)
        const isVisible = rect.bottom > editorRect.top && rect.top < editorRect.bottom;

        if (isVisible) {
            this.handle.style.display = 'flex';
            this.handle.style.top = `${top}px`;
            this.handle.style.left = `${leftPos}px`;
        } else {
            this.handle.style.display = 'none';
        }
    }

    hideHandle() {
        this.handle.style.display = 'none';
    }

    showListHandle(list) {
        const rect = list.getBoundingClientRect();
        const wrapperRect = this.instance.wrapper.getBoundingClientRect();
        const editorRect = this.instance.editorEl.getBoundingClientRect();

        // Рассчитываем leftPos так же, как и для обычных блоков - чуть левее самого элемента
        let leftPos = (rect.left - wrapperRect.left) - 30;

        // Ограничиваем минимум
        if (leftPos < 2) leftPos = 2;

        // Позиция относительно wrapper
        const top = rect.top - wrapperRect.top + 2;

        // Проверяем, виден ли список в области editor'а
        const isVisible = rect.bottom > editorRect.top && rect.top < editorRect.bottom;

        if (isVisible) {
            this.listHandle.style.display = 'flex';
            this.listHandle.style.top = `${top}px`;
            this.listHandle.style.left = `${leftPos}px`;
        } else {
            this.listHandle.style.display = 'none';
        }
    }

    hideListHandle() {
        this.listHandle.style.display = 'none';
    }

    onHandleClick(e) {
        e.stopPropagation();
        e.preventDefault();

        // Если меню уже открыто - закрываем
        if (this.menu.style.display === 'block') {
            this.hideMenu();
            return;
        }

        this.showMenu();
    }

    showMenu() {
        this.buildMenu();

        const handleRect = this.handle.getBoundingClientRect();
        const wrapperRect = this.instance.wrapper.getBoundingClientRect();
        const editorRect = this.instance.editorEl.getBoundingClientRect();

        this.menu.style.display = 'block';

        // Получаем размеры меню после отображения
        const menuRect = this.menu.getBoundingClientRect();

        // Рассчитываем позицию по умолчанию (вниз)
        let top = handleRect.bottom - wrapperRect.top + 5;
        let left = handleRect.left - wrapperRect.left;

        // Проверяем, уместится ли меню внизу
        const spaceBelow = editorRect.bottom - handleRect.bottom;
        const spaceAbove = handleRect.top - editorRect.top;

        if (spaceBelow < menuRect.height && spaceAbove > menuRect.height) {
            // Открываем вверх
            top = handleRect.top - wrapperRect.top - menuRect.height - 5;
        }

        // Проверяем, не выходит ли меню за левый край
        if (left < 5) {
            left = 5;
        }

        // Проверяем, не выходит ли меню за правый край
        const maxLeft = wrapperRect.width - menuRect.width - 5;
        if (left > maxLeft) {
            left = maxLeft;
        }

        this.menu.style.top = `${top}px`;
        this.menu.style.left = `${left}px`;
    }

    hideMenu() {
        if (this.menu) {
            this.menu.style.display = 'none';
        }
    }

    // --- Actions ---

    deleteBlock() {
        if (this.currentBlock) {
            this.beginHistoryBatch();

            const parent = this.currentBlock.parentElement;
            this.currentBlock.remove();

            // Если удалили последний LI в списке - удаляем и список
            if (parent && (parent.tagName === 'UL' || parent.tagName === 'OL')) {
                if (parent.children.length === 0) {
                    parent.remove();
                }
            }

            this.currentBlock = null;
            this.hideHandle();
            this.instance.sync();
            this.endHistoryBatch();
        }
    }

    duplicateBlock() {
        if (this.currentBlock) {
            this.beginHistoryBatch();

            const clone = this.currentBlock.cloneNode(true);
            if (clone.classList && clone.classList.length === 0) {
                clone.removeAttribute('class');
            }
            this.currentBlock.parentNode.insertBefore(clone, this.currentBlock.nextSibling);
            this.instance.sync();
            this.endHistoryBatch();
        }
    }

    insertElementAfter() {
        if (this.currentBlock) {
            this.beginHistoryBatch();

            const isListItem = this.currentBlock.tagName === 'LI';
            const tag = isListItem ? 'li' : 'p';

            const newEl = document.createElement(tag);
            newEl.innerHTML = '<br>';

            if (this.currentBlock.nextSibling) {
                this.currentBlock.parentNode.insertBefore(newEl, this.currentBlock.nextSibling);
            } else {
                this.currentBlock.parentNode.appendChild(newEl);
            }

            // Ставим курсор в новый элемент
            const range = document.createRange();
            const sel = window.getSelection();
            range.setStart(newEl, 0);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);

            this.instance.sync();
            this.endHistoryBatch();
        }
    }

    toggleCitation() {
        if (!this.currentBlock || this.currentBlock.tagName !== 'BLOCKQUOTE') return;

        this.beginHistoryBatch();

        const existingCite = this.currentBlock.querySelector('cite');
        if (existingCite) {
            // Remove citation
            existingCite.remove();
        } else {
            // Add citation
            const cite = document.createElement('cite');
            cite.innerHTML = '<br>';
            this.currentBlock.appendChild(cite);
            this.instance.setupBlockquotes();

            // Focus the new cite element
            const range = document.createRange();
            range.setStart(cite, 0);
            range.collapse(true);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        }

        this.instance.sync();
        this.endHistoryBatch();
    }

    transformBlock(newTag) {
        if (!this.currentBlock) return;

        this.beginHistoryBatch();

        const oldTag = this.currentBlock.tagName;
        const newEl = document.createElement(newTag);

        // Copy children, skip cite when leaving blockquote
        while (this.currentBlock.firstChild) {
            if (oldTag === 'BLOCKQUOTE' && newTag !== 'BLOCKQUOTE' &&
                this.currentBlock.firstChild.nodeType === Node.ELEMENT_NODE &&
                this.currentBlock.firstChild.tagName === 'CITE') {
                this.currentBlock.firstChild.remove();
                continue;
            }
            newEl.appendChild(this.currentBlock.firstChild);
        }

        // Copy classes if present
        if (this.currentBlock.className) {
            newEl.className = this.currentBlock.className;
        }

        this.currentBlock.parentNode.replaceChild(newEl, this.currentBlock);
        this.currentBlock = newEl;

        this.instance.sync();
        this.endHistoryBatch();
    }

    convertListType(newListTag) {
        if (!this.currentBlock) return;

        this.beginHistoryBatch();

        // Находим список
        let list = this.currentBlock;
        if (list.tagName === 'LI') {
            list = list.parentElement;
        }

        if (!list || (list.tagName !== 'UL' && list.tagName !== 'OL')) return;

        // Создаем новый список
        const newList = document.createElement(newListTag);

        // Переносим все LI
        while (list.firstChild) {
            newList.appendChild(list.firstChild);
        }

        // Копируем классы
        if (list.className) {
            newList.className = list.className;
        }

        list.parentNode.replaceChild(newList, list);
        this.instance.sync();
        this.endHistoryBatch();
    }

    convertListToParagraph() {
        if (!this.currentBlock) return;

        let list = this.currentBlock;
        let targetLi = null;

        if (list.tagName === 'LI') {
            targetLi = list;
            list = list.parentElement;
        }

        if (!list || (list.tagName !== 'UL' && list.tagName !== 'OL')) return;

        if (targetLi) {
            // Преобразуем только один LI в параграф
            const p = document.createElement('p');
            while (targetLi.firstChild) {
                p.appendChild(targetLi.firstChild);
            }
            if (!p.innerHTML.trim()) p.innerHTML = '<br>';

            // Вставляем после списка
            list.parentNode.insertBefore(p, list.nextSibling);
            targetLi.remove();

            // Если список опустел - удаляем
            if (list.children.length === 0) {
                list.remove();
            }
        } else {
            // Преобразуем весь список
            const fragment = document.createDocumentFragment();
            Array.from(list.children).forEach(li => {
                if (li.tagName === 'LI') {
                    const p = document.createElement('p');
                    while (li.firstChild) {
                        p.appendChild(li.firstChild);
                    }
                    if (!p.innerHTML.trim()) p.innerHTML = '<br>';
                    fragment.appendChild(p);
                }
            });
            list.parentNode.replaceChild(fragment, list);
        }

        this.currentBlock = null;
        this.hideHandle();
        this.instance.sync();
    }

    getCurrentPresetClass(presets) {
        if (!this.currentBlock) return null;

        for (const preset of presets) {
            if (preset.class && this.currentBlock.classList.contains(preset.class)) {
                return preset.class;
            }
        }
        return null;
    }

    // --- Callout Emoji ---

    showEmojiInput() {
        if (!this.currentBlock || this.currentBlock.tagName !== 'ASIDE') return;

        // Remove existing emoji input if any
        this.hideEmojiInput();

        const aside = this.currentBlock;
        const currentEmoji = aside.getAttribute('data-emoji') || '';

        // Create the input popup
        this.emojiInput = document.createElement('div');
        this.emojiInput.className = 'redactix-emoji-input';
        this.emojiInput.contentEditable = 'false';

        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentEmoji;
        input.maxLength = 10;

        // Detect OS for emoji picker shortcut hint
        const isMac = /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent);
        const shortcut = isMac ? '⌘ + ⌃ + Space' : 'Win + .';

        const hint = document.createElement('div');
        hint.className = 'redactix-emoji-hint';
        hint.innerHTML = `${this.t('blockControl.emojiOnly')} &middot; <kbd>${shortcut}</kbd>`;

        this.emojiInput.appendChild(input);
        this.emojiInput.appendChild(hint);

        // Position near the aside
        const asideRect = aside.getBoundingClientRect();
        const wrapperRect = this.instance.wrapper.getBoundingClientRect();

        let top = asideRect.top - wrapperRect.top - 44;
        let left = asideRect.left - wrapperRect.left;

        // If above would go off-screen, show below
        if (top < 0) {
            top = asideRect.bottom - wrapperRect.top + 5;
        }
        if (left < 5) left = 5;

        this.emojiInput.style.top = `${top}px`;
        this.emojiInput.style.left = `${left}px`;

        this.instance.wrapper.appendChild(this.emojiInput);

        input.focus();
        input.select();

        this._emojiHistoryStarted = false;

        // Save handler
        const save = () => {
            const value = input.value.trim();
            if (!value) {
                // Empty = remove emoji
                if (aside.hasAttribute('data-emoji')) {
                    if (!this._emojiHistoryStarted) {
                        this.beginHistoryBatch();
                        this._emojiHistoryStarted = true;
                    }
                    aside.removeAttribute('data-emoji');
                }
                this.hideEmojiInput();
                if (this._emojiHistoryStarted) {
                    this.instance.sync();
                    this.endHistoryBatch();
                }
            } else if (this.isValidEmoji(value)) {
                if (!this._emojiHistoryStarted) {
                    this.beginHistoryBatch();
                    this._emojiHistoryStarted = true;
                }
                aside.setAttribute('data-emoji', value);
                this.hideEmojiInput();
                this.instance.sync();
                this.endHistoryBatch();
            } else {
                // Show error
                hint.classList.add('is-error');
                input.classList.add('invalid');
            }
        };

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                save();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                this.hideEmojiInput();
            }
        });

        input.addEventListener('input', () => {
            // Reset error on new input
            hint.classList.remove('is-error');
            input.classList.remove('invalid');
        });

        input.addEventListener('blur', () => {
            // Small delay to allow Enter keydown to fire first
            setTimeout(() => {
                if (this.emojiInput) {
                    save();
                }
            }, 150);
        });

        // Prevent clicks inside from propagating
        this.emojiInput.addEventListener('mousedown', (e) => {
            e.stopPropagation();
        });
    }

    hideEmojiInput() {
        if (this.emojiInput) {
            this.emojiInput.remove();
            this.emojiInput = null;
        }
    }

    removeCalloutEmoji() {
        if (!this.currentBlock || this.currentBlock.tagName !== 'ASIDE') return;

        this.beginHistoryBatch();
        this.currentBlock.removeAttribute('data-emoji');
        this.instance.sync();
        this.endHistoryBatch();
    }

    isValidEmoji(str) {
        const trimmed = str.trim();
        if (!trimmed) return false;

        // Remove all valid emoji characters, modifiers, ZWJ, variation selectors
        const withoutEmoji = trimmed.replace(/[\p{Extended_Pictographic}\p{Emoji_Component}\u200D\uFE0F\uFE0E]/gu, '');
        return withoutEmoji.length === 0;
    }

    setPresetClass(newClass, presets) {
        if (!this.currentBlock) return;

        this.beginHistoryBatch();

        // Убираем все классы пресетов
        presets.forEach(preset => {
            if (preset.class) {
                this.currentBlock.classList.remove(preset.class);
            }
        });

        // Добавляем новый класс если не null
        if (newClass) {
            this.currentBlock.classList.add(newClass);
        }

        // Убираем пустой атрибут class
        if (this.currentBlock.classList.length === 0) {
            this.currentBlock.removeAttribute('class');
        }

        this.instance.sync();
        this.endHistoryBatch();
    }

    // --- Drag & Drop ---

    onDragStart(e) {
        // Проверяем что это не правый клик (для меню)
        if (e.button !== 0) return;

        e.preventDefault();
        e.stopPropagation();

        // Начинаем batch-операцию (сохраняет состояние ДО изменений)
        this.beginHistoryBatch();

        this.isDragging = true;
        this.handle.classList.add('dragging');
        this.currentBlock.classList.add('redactix-block-dragging');

        // Создаем placeholder
        this.dragPlaceholder = document.createElement('div');
        this.dragPlaceholder.className = 'redactix-drag-placeholder';

        // Создаем призрак для визуализации перетаскивания
        this.dragGhost = document.createElement('div');
        this.dragGhost.className = 'redactix-drag-ghost';
        this.dragGhost.textContent = this.currentBlock.textContent.substring(0, 50) + (this.currentBlock.textContent.length > 50 ? '...' : '');
        document.body.appendChild(this.dragGhost);

        const moveHandler = (moveEvent) => this.onDragMove(moveEvent);
        const upHandler = () => {
            this.onDragEnd();
            document.removeEventListener('mousemove', moveHandler);
            document.removeEventListener('mouseup', upHandler);
        };

        document.addEventListener('mousemove', moveHandler);
        document.addEventListener('mouseup', upHandler);
    }

    onDragMove(e) {
        // Обновляем позицию призрака
        if (this.dragGhost) {
            this.dragGhost.style.left = `${e.clientX + 10}px`;
            this.dragGhost.style.top = `${e.clientY + 10}px`;
        }

        this.handle.style.display = 'none';
        let elementBelow = document.elementFromPoint(e.clientX, e.clientY);
        this.handle.style.display = 'flex';

        if (!elementBelow) return;

        // Prevent dragging outside the editor
        if (!this.instance.editorEl.contains(elementBelow) && elementBelow !== this.instance.editorEl) return;

        // Ищем целевой блок
        let targetBlock = elementBelow;
        while (targetBlock && targetBlock !== this.instance.editorEl) {
            const display = window.getComputedStyle(targetBlock).display;
            if (display === 'block' || display === 'list-item') {
                break;
            }
            targetBlock = targetBlock.parentNode;
        }

        if (targetBlock && targetBlock !== this.instance.editorEl && targetBlock !== this.currentBlock) {
            const currentTag = this.currentBlock.tagName;
            const targetTag = targetBlock.tagName;

            // Правила перемещения:
            if (currentTag === 'LI') {
                // LI можно перемещать только к другим LI внутри списков
                if (targetTag === 'LI') {
                    // Перемещение LI к другому LI - вставляем в тот же список
                    const rect = targetBlock.getBoundingClientRect();
                    const offset = e.clientY - rect.top;

                    if (offset < rect.height / 2) {
                        targetBlock.parentNode.insertBefore(this.currentBlock, targetBlock);
                    } else {
                        targetBlock.parentNode.insertBefore(this.currentBlock, targetBlock.nextSibling);
                    }
                    this.showHandle(this.currentBlock);
                    return;
                } else if (targetTag === 'UL' || targetTag === 'OL') {
                    // Если навели на сам список - находим ближайший LI или вставляем в конец
                    const items = targetBlock.querySelectorAll(':scope > li');
                    if (items.length === 0) {
                        targetBlock.appendChild(this.currentBlock);
                        this.showHandle(this.currentBlock);
                    }
                    return;
                } else {
                    // LI нельзя тащить к обычным блокам
                    return;
                }
            } else if (currentTag === 'UL' || currentTag === 'OL') {
                // UL/OL можно перемещать к другим блочным элементам (не внутрь списков)
                if (targetTag === 'LI') {
                    // Вставляем список рядом с родительским списком LI
                    const parentList = targetBlock.parentElement;
                    if (parentList) {
                        const rect = parentList.getBoundingClientRect();
                        const offset = e.clientY - rect.top;

                        if (offset < rect.height / 2) {
                            parentList.parentNode.insertBefore(this.currentBlock, parentList);
                        } else {
                            parentList.parentNode.insertBefore(this.currentBlock, parentList.nextSibling);
                        }
                        this.showHandle(this.currentBlock);
                    }
                    return;
                } else if (targetTag === 'UL' || targetTag === 'OL') {
                    // Список к списку - вставляем рядом
                    const rect = targetBlock.getBoundingClientRect();
                    const offset = e.clientY - rect.top;

                    if (offset < rect.height / 2) {
                        targetBlock.parentNode.insertBefore(this.currentBlock, targetBlock);
                    } else {
                        targetBlock.parentNode.insertBefore(this.currentBlock, targetBlock.nextSibling);
                    }
                    this.showHandle(this.currentBlock);
                    return;
                }
                // Иначе - к обычным блокам, продолжаем ниже
            } else {
                // Обычные блоки нельзя тащить внутрь списков
                if (targetTag === 'LI') return;
                if (targetTag === 'UL' || targetTag === 'OL') {
                    // Ставим рядом со списками, а не внутрь
                    const rect = targetBlock.getBoundingClientRect();
                    const offset = e.clientY - rect.top;

                    if (offset < rect.height / 2) {
                        targetBlock.parentNode.insertBefore(this.currentBlock, targetBlock);
                    } else {
                        targetBlock.parentNode.insertBefore(this.currentBlock, targetBlock.nextSibling);
                    }
                    this.showHandle(this.currentBlock);
                    return;
                }

                // Проверяем что цель не внутри списка
                if (targetBlock.parentNode &&
                    (targetBlock.parentNode.tagName === 'UL' ||
                        targetBlock.parentNode.tagName === 'OL' ||
                        targetBlock.parentNode.tagName === 'LI')) {
                    return;
                }
            }

            // Финальная проверка - не вставляем в список
            if (targetBlock.parentNode &&
                (targetBlock.parentNode.tagName === 'UL' ||
                    targetBlock.parentNode.tagName === 'OL')) {
                return;
            }

            const rect = targetBlock.getBoundingClientRect();
            const offset = e.clientY - rect.top;

            if (offset < rect.height / 2) {
                targetBlock.parentNode.insertBefore(this.currentBlock, targetBlock);
            } else {
                targetBlock.parentNode.insertBefore(this.currentBlock, targetBlock.nextSibling);
            }

            this.showHandle(this.currentBlock);
        }
    }

    onDragEnd() {
        this.isDragging = false;
        this.handle.classList.remove('dragging');

        if (this.currentBlock) {
            this.currentBlock.classList.remove('redactix-block-dragging');
            if (this.currentBlock.classList.length === 0) {
                this.currentBlock.removeAttribute('class');
            }
        }

        if (this.dragPlaceholder) {
            this.dragPlaceholder.remove();
            this.dragPlaceholder = null;
        }

        if (this.dragGhost) {
            this.dragGhost.remove();
            this.dragGhost = null;
        }

        this.instance.sync();

        // Завершаем batch-операцию
        this.endHistoryBatch();
    }

    // Вспомогательные методы для работы с историей
    getHistoryModule() {
        return this.instance.modules.find(m => m.constructor.name === 'History');
    }

    beginHistoryBatch() {
        const history = this.getHistoryModule();
        if (history) {
            history.beginBatch();
        }
    }

    endHistoryBatch() {
        const history = this.getHistoryModule();
        if (history) {
            history.endBatch();
        }
    }

    // --- Touch Events ---

    onTouchStart(e) {
        // Prevent default to avoid scrolling while dragging
        e.preventDefault();

        const touch = e.touches[0];
        this.touchStartX = touch.clientX;
        this.touchStartY = touch.clientY;
        this.touchStartTime = Date.now();
        this.touchMoved = false;

        // Таймер для определения long press (открытие меню)
        this.touchHoldTimer = setTimeout(() => {
            if (!this.touchMoved) {
                // Long press - открываем меню
                this.onHandleClick(e);
            }
        }, 500);

        const touchMoveHandler = (moveEvent) => this.onTouchMove(moveEvent);
        const touchEndHandler = (endEvent) => {
            this.onTouchEnd(endEvent);
            document.removeEventListener('touchmove', touchMoveHandler);
            document.removeEventListener('touchend', touchEndHandler);
            document.removeEventListener('touchcancel', touchEndHandler);
        };

        document.addEventListener('touchmove', touchMoveHandler, { passive: false });
        document.addEventListener('touchend', touchEndHandler);
        document.addEventListener('touchcancel', touchEndHandler);
    }

    onTouchMove(e) {
        if (!this.currentBlock) return;

        const touch = e.touches[0];
        const deltaX = Math.abs(touch.clientX - this.touchStartX);
        const deltaY = Math.abs(touch.clientY - this.touchStartY);

        // Если движение достаточно значительное - начинаем drag
        if (deltaX > 10 || deltaY > 10) {
            this.touchMoved = true;

            // Отменяем таймер long press
            if (this.touchHoldTimer) {
                clearTimeout(this.touchHoldTimer);
                this.touchHoldTimer = null;
            }

            // Если ещё не начали drag - начинаем
            if (!this.isDragging) {
                this.startTouchDrag(e);
            }

            // Выполняем drag move
            this.onTouchDragMove(e);
        }

        e.preventDefault();
    }

    onTouchEnd(e) {
        // Отменяем таймер long press
        if (this.touchHoldTimer) {
            clearTimeout(this.touchHoldTimer);
            this.touchHoldTimer = null;
        }

        // Если был короткий tap без движения - открываем меню
        if (!this.touchMoved && Date.now() - this.touchStartTime < 300) {
            this.onHandleClick(e);
        }

        // Если был drag - завершаем
        if (this.isDragging) {
            this.onDragEnd();
        }
    }

    startTouchDrag(e) {
        this.beginHistoryBatch();

        this.isDragging = true;
        this.handle.classList.add('dragging');
        this.currentBlock.classList.add('redactix-block-dragging');

        // Создаем placeholder
        this.dragPlaceholder = document.createElement('div');
        this.dragPlaceholder.className = 'redactix-drag-placeholder';

        // Создаем призрак для визуализации перетаскивания
        this.dragGhost = document.createElement('div');
        this.dragGhost.className = 'redactix-drag-ghost';
        this.dragGhost.textContent = this.currentBlock.textContent.substring(0, 50) + (this.currentBlock.textContent.length > 50 ? '...' : '');
        document.body.appendChild(this.dragGhost);
    }

    onTouchDragMove(e) {
        const touch = e.touches[0];

        // Обновляем позицию призрака
        if (this.dragGhost) {
            this.dragGhost.style.left = `${touch.clientX + 10}px`;
            this.dragGhost.style.top = `${touch.clientY + 10}px`;
        }

        // Находим элемент под пальцем
        this.dragGhost.style.display = 'none';
        this.handle.style.display = 'none';
        let elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
        this.handle.style.display = 'flex';
        this.dragGhost.style.display = 'block';

        if (!elementBelow) return;

        // Prevent dragging outside the editor
        if (!this.instance.editorEl.contains(elementBelow) && elementBelow !== this.instance.editorEl) return;

        // Ищем целевой блок
        let targetBlock = elementBelow;
        while (targetBlock && targetBlock !== this.instance.editorEl) {
            const display = window.getComputedStyle(targetBlock).display;
            if (display === 'block' || display === 'list-item') {
                break;
            }
            targetBlock = targetBlock.parentNode;
        }

        if (targetBlock && targetBlock !== this.instance.editorEl && targetBlock !== this.currentBlock) {
            const currentTag = this.currentBlock.tagName;
            const targetTag = targetBlock.tagName;

            // Применяем те же правила что и для мыши
            if (currentTag === 'LI' && targetTag !== 'LI') return;
            if (currentTag !== 'LI' && (targetTag === 'LI' || targetTag === 'UL' || targetTag === 'OL')) {
                if (targetTag === 'UL' || targetTag === 'OL') {
                    // Вставляем рядом со списком
                    const rect = targetBlock.getBoundingClientRect();
                    const offset = touch.clientY - rect.top;

                    if (offset < rect.height / 2) {
                        targetBlock.parentNode.insertBefore(this.currentBlock, targetBlock);
                    } else {
                        targetBlock.parentNode.insertBefore(this.currentBlock, targetBlock.nextSibling);
                    }
                    this.showHandle(this.currentBlock);
                }
                return;
            }

            const rect = targetBlock.getBoundingClientRect();
            const offset = touch.clientY - rect.top;

            if (offset < rect.height / 2) {
                targetBlock.parentNode.insertBefore(this.currentBlock, targetBlock);
            } else {
                targetBlock.parentNode.insertBefore(this.currentBlock, targetBlock.nextSibling);
            }

            this.showHandle(this.currentBlock);
        }
    }
}