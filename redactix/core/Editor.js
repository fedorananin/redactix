export default class Editor {
    constructor(instance) {
        this.instance = instance;
        this.el = instance.editorEl;

        // Настройка дефолтного параграфа
        document.execCommand('defaultParagraphSeparator', false, 'p');

        this.bindEvents();
        this.setupPlaceholder();
    }

    setupPlaceholder() {
        this.el.dataset.placeholder = 'Start typing...';
        this.updatePlaceholder();
    }

    updatePlaceholder() {
        const isEmpty = !this.el.textContent.trim() && !this.el.querySelector('img, iframe, hr, table');
        this.el.classList.toggle('is-empty', isEmpty);
    }

    // Гарантирует правильную структуру редактора (минимум один параграф)
    ensureEditorStructure() {
        // Если редактор полностью пуст или содержит только <br>
        const content = this.el.innerHTML.replace(/<br\s*\/?>/gi, '').trim();
        
        if (!content) {
            // Создаём пустой параграф
            this.el.innerHTML = '<p><br></p>';
            
            // Ставим курсор в параграф
            const p = this.el.querySelector('p');
            if (p) {
                const range = document.createRange();
                const sel = window.getSelection();
                range.setStart(p, 0);
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
            }
            return;
        }
        
        // Проверяем: если остался один пустой блочный элемент (не P) — заменяем на P
        // Это случается когда пользователь выделяет всё и удаляет
        if (this.el.children.length === 1) {
            const child = this.el.children[0];
            const childContent = child.innerHTML.replace(/<br\s*\/?>/gi, '').trim();
            
            if (!childContent && ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'ASIDE'].includes(child.tagName)) {
                // Заменяем пустой заголовок/цитату на параграф
                const p = document.createElement('p');
                p.innerHTML = '<br>';
                this.el.replaceChild(p, child);
                
                // Ставим курсор
                const range = document.createRange();
                const sel = window.getSelection();
                range.setStart(p, 0);
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
                return;
            }
        }
        
        // Если есть "голый" текст напрямую в редакторе (не в блочном элементе)
        // Это может произойти после удаления всего и начала ввода
        const firstChild = this.el.firstChild;
        if (firstChild && firstChild.nodeType === Node.TEXT_NODE && firstChild.textContent.trim()) {
            // Оборачиваем в параграф
            const p = document.createElement('p');
            
            // Собираем все текстовые узлы и inline элементы в начале
            while (this.el.firstChild && 
                   (this.el.firstChild.nodeType === Node.TEXT_NODE || 
                    (this.el.firstChild.nodeType === Node.ELEMENT_NODE && 
                     !['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'BLOCKQUOTE', 'ASIDE', 'PRE', 'TABLE', 'FIGURE', 'HR', 'DIV'].includes(this.el.firstChild.tagName)))) {
                p.appendChild(this.el.firstChild);
            }
            
            this.el.insertBefore(p, this.el.firstChild);
        }
    }

    bindEvents() {
        // Observer для любых изменений DOM (самый надежный способ синхронизации)
        this.observer = new MutationObserver((mutations) => {
            // Проверяем, есть ли реальные изменения контента
            this.instance.sync();
            this.updatePlaceholder();
        });
        
        this.observer.observe(this.el, {
            childList: true,
            subtree: true,
            characterData: true
        });

        // Синхронизация при вводе (как дополнение для мгновенной реакции)
        this.el.addEventListener('input', () => {
            this.ensureEditorStructure();
            this.instance.sync(); 
            this.updatePlaceholder();
        });

        // Обработка paste
        this.el.addEventListener('paste', (e) => {
            e.preventDefault();
            this.handlePaste(e);
        });

        // Обработка нажатий клавиш
        this.el.addEventListener('keydown', (e) => {
            // Enter в пустых блоках для выхода из списков/цитат
            if (e.key === 'Enter' && !e.shiftKey) {
                if (this.handleEnterKey(e)) {
                    return;
                }
            }

            // Backspace в начале блока для преобразования
            if (e.key === 'Backspace') {
                if (this.handleBackspace(e)) {
                    return;
                }
            }

            // Пробел - умная обработка
            if (e.key === ' ' && !e.ctrlKey && !e.metaKey && !e.altKey) {
                e.preventDefault();
                this.handleSpace();
            }
        });
    }

    handlePaste(e) {
        const clipboardData = e.clipboardData || window.clipboardData;
        
        // Пытаемся получить HTML
        let html = clipboardData.getData('text/html');
        let text = clipboardData.getData('text/plain');

        if (html) {
            // Санитизация HTML
            html = this.sanitizeHtml(html);
            document.execCommand('insertHTML', false, html);
            
            // Настраиваем вставленные figure
            if (this.instance.setupFigures) {
                this.instance.setupFigures();
            }
            
            // Убираем пустые параграфы после вставки
            this.el.querySelectorAll('p, div').forEach(el => {
                const inner = el.innerHTML.replace(/<br\s*\/?>/gi, '').trim();
                if (!inner && !el.querySelector('img, iframe, hr, table, figure')) {
                    el.remove();
                }
            });
        } else if (text) {
            // Если только текст - вставляем с сохранением переносов строк
            const lines = text.split('\n');
            if (lines.length > 1) {
                const html = lines.map(line => {
                    if (line.trim() === '') return '<br>';
                    return `<p>${this.escapeHtml(line)}</p>`;
                }).join('');
                document.execCommand('insertHTML', false, html);
            } else {
                document.execCommand('insertText', false, text);
            }
        }

        this.instance.sync();
        this.updatePlaceholder();
    }

    sanitizeHtml(html) {
        // Создаём временный элемент для парсинга
        const temp = document.createElement('div');
        temp.innerHTML = html;

        // Удаляем служебные обёртки Google Docs (b с id="docs-internal-guid-...")
        const googleWrappers = temp.querySelectorAll('b[id^="docs-internal-guid"]');
        googleWrappers.forEach(wrapper => {
            // Разворачиваем содержимое, убирая обёртку
            while (wrapper.firstChild) {
                wrapper.parentNode.insertBefore(wrapper.firstChild, wrapper);
            }
            wrapper.remove();
        });

        // Удаляем опасные и ненужные теги
        const dangerousTags = ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'meta', 'colgroup'];
        dangerousTags.forEach(tag => {
            const elements = temp.getElementsByTagName(tag);
            while (elements.length > 0) {
                elements[0].parentNode.removeChild(elements[0]);
            }
        });

        // Конвертируем стилизованные span в семантические теги (до удаления стилей!)
        // Google Docs использует inline стили вместо тегов b/i/u
        const styledSpans = Array.from(temp.querySelectorAll('span[style]'));
        styledSpans.forEach(span => {
            const style = span.getAttribute('style') || '';
            let wrapper = null;
            
            // Проверяем стили и создаём соответствующие теги
            // Порядок важен: сначала внешние, потом внутренние
            const isBold = /font-weight:\s*(bold|700|800|900)/i.test(style);
            const isItalic = /font-style:\s*italic/i.test(style);
            const isUnderline = /text-decoration:[^;]*underline/i.test(style);
            const isStrike = /text-decoration:[^;]*line-through/i.test(style);
            
            if (isBold || isItalic || isUnderline || isStrike) {
                // Собираем содержимое span
                const content = document.createDocumentFragment();
                while (span.firstChild) {
                    content.appendChild(span.firstChild);
                }
                
                // Оборачиваем в теги (от внешнего к внутреннему)
                let result = content;
                
                if (isStrike) {
                    const s = document.createElement('s');
                    s.appendChild(result);
                    result = s;
                }
                if (isUnderline) {
                    const u = document.createElement('u');
                    u.appendChild(result);
                    result = u;
                }
                if (isItalic) {
                    const i = document.createElement('i');
                    i.appendChild(result);
                    result = i;
                }
                if (isBold) {
                    const b = document.createElement('b');
                    b.appendChild(result);
                    result = b;
                }
                
                span.parentNode.replaceChild(result, span);
            }
        });

        // Удаляем все атрибуты, кроме разрешённых
        const allowedAttributes = ['href', 'src', 'alt', 'title', 'colspan', 'rowspan'];
        // Разрешённые классы (наши внутренние)
        const allowedClasses = ['spoiler', 'warning', 'danger', 'information', 'success', 'big'];
        const allElements = temp.getElementsByTagName('*');
        
        for (let i = 0; i < allElements.length; i++) {
            const el = allElements[i];
            const attrs = Array.from(el.attributes);
            
            attrs.forEach(attr => {
                if (!allowedAttributes.includes(attr.name.toLowerCase())) {
                    // Для class — фильтруем, оставляя только разрешённые
                    if (attr.name.toLowerCase() === 'class') {
                        const classes = attr.value.split(/\s+/).filter(c => allowedClasses.includes(c));
                        if (classes.length > 0) {
                            el.setAttribute('class', classes.join(' '));
                        } else {
                            el.removeAttribute('class');
                        }
                    } else {
                        el.removeAttribute(attr.name);
                    }
                }
                
                // Проверяем href и src на javascript:
                if ((attr.name === 'href' || attr.name === 'src') && 
                    attr.value.toLowerCase().includes('javascript:')) {
                    el.removeAttribute(attr.name);
                }
            });

            // Удаляем inline стили
            el.removeAttribute('style');
        }
        
        // Упрощаем структуру списков: если li содержит только один p — разворачиваем
        const listItems = Array.from(temp.querySelectorAll('li'));
        listItems.forEach(li => {
            const children = Array.from(li.children);
            const paragraphs = children.filter(c => c.tagName === 'P');
            
            // Если внутри li только параграфы (и возможно br)
            if (paragraphs.length > 0 && children.every(c => c.tagName === 'P' || c.tagName === 'BR')) {
                // Разворачиваем содержимое параграфов в li
                const fragment = document.createDocumentFragment();
                
                children.forEach((child, index) => {
                    if (child.tagName === 'P') {
                        // Переносим содержимое p
                        while (child.firstChild) {
                            fragment.appendChild(child.firstChild);
                        }
                        // Добавляем br между параграфами (кроме последнего)
                        if (index < children.length - 1) {
                            fragment.appendChild(document.createElement('br'));
                        }
                    }
                });
                
                li.innerHTML = '';
                li.appendChild(fragment);
            }
        });

        // Исправляем неправильную вложенность блочных элементов (проблема Google Docs)
        // Например: <h1><p>текст</p></h1> -> <h1>текст</h1>
        const blockTags = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'BLOCKQUOTE', 'ASIDE'];
        blockTags.forEach(tag => {
            const elements = Array.from(temp.querySelectorAll(tag));
            elements.forEach(el => {
                // Если внутри блочного элемента есть другие блочные элементы
                const nestedBlocks = el.querySelectorAll('p, h1, h2, h3, h4, h5, h6, div');
                if (nestedBlocks.length > 0) {
                    // Собираем содержимое вложенных блоков
                    const fragment = document.createDocumentFragment();
                    
                    Array.from(el.childNodes).forEach(child => {
                        if (child.nodeType === Node.ELEMENT_NODE && 
                            ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'DIV'].includes(child.tagName)) {
                            // Это вложенный блочный элемент — вытаскиваем его содержимое
                            // или сам элемент, если родитель — заголовок, а вложенный — p
                            if (blockTags.slice(0, 6).includes(el.tagName) && child.tagName === 'P') {
                                // Заголовок содержит p — берём только содержимое p
                                while (child.firstChild) {
                                    fragment.appendChild(child.firstChild);
                                }
                            } else {
                                // Вытаскиваем блок наружу
                                fragment.appendChild(child.cloneNode(true));
                            }
                        } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName === 'BR') {
                            // Пропускаем лишние br между блоками
                        } else if (child.nodeType === Node.TEXT_NODE && !child.textContent.trim()) {
                            // Пропускаем пустые текстовые узлы
                        } else {
                            fragment.appendChild(child.cloneNode(true));
                        }
                    });
                    
                    // Заменяем содержимое
                    el.innerHTML = '';
                    el.appendChild(fragment);
                }
                
                // Если после очистки элемент пустой или содержит только br — удаляем
                const innerContent = el.innerHTML.replace(/<br\s*\/?>/gi, '').trim();
                if (!innerContent) {
                    el.remove();
                }
            });
        });

        // Очищаем пустые span и font
        const emptyTags = temp.querySelectorAll('span:empty, font:empty');
        emptyTags.forEach(el => el.remove());
        
        // Разворачиваем span без атрибутов (бесполезные обёртки)
        const spans = Array.from(temp.querySelectorAll('span'));
        spans.forEach(span => {
            if (span.attributes.length === 0) {
                while (span.firstChild) {
                    span.parentNode.insertBefore(span.firstChild, span);
                }
                span.remove();
            }
        });

        // Заменяем font на span
        const fonts = temp.getElementsByTagName('font');
        while (fonts.length > 0) {
            const font = fonts[0];
            const span = document.createElement('span');
            while (font.firstChild) {
                span.appendChild(font.firstChild);
            }
            font.parentNode.replaceChild(span, font);
        }
        
        // Удаляем пустые div и заменяем непустые на p
        const divs = Array.from(temp.querySelectorAll('div'));
        divs.forEach(div => {
            const innerContent = div.innerHTML.replace(/<br\s*\/?>/gi, '').trim();
            if (!innerContent) {
                div.remove();
            } else {
                // Заменяем div на p
                const p = document.createElement('p');
                p.innerHTML = div.innerHTML;
                div.parentNode.replaceChild(p, div);
            }
        });

        // Оборачиваем img в figure (если ещё не обёрнуты)
        const images = Array.from(temp.querySelectorAll('img'));
        images.forEach(img => {
            // Пропускаем если уже внутри figure
            if (img.closest('figure')) return;
            
            // Убираем style у img
            img.removeAttribute('style');
            
            const figure = document.createElement('figure');
            const figcaption = document.createElement('figcaption');
            figcaption.innerHTML = '<br>';
            
            const parent = img.parentNode;
            
            // Если img внутри p или div и есть куда выносить — выносим figure на уровень выше
            if ((parent.tagName === 'P' || parent.tagName === 'DIV') && parent.parentNode) {
                parent.parentNode.insertBefore(figure, parent);
            } else {
                parent.insertBefore(figure, img);
            }
            
            figure.appendChild(img);
            figure.appendChild(figcaption);
        });

        // Убираем пустые атрибуты class
        temp.querySelectorAll('[class=""]').forEach(el => {
            el.removeAttribute('class');
        });

        // Убираем Microsoft Office мусор
        html = temp.innerHTML;
        html = html.replace(/<!--\[if[\s\S]*?\]>[\s\S]*?<!\[endif\]-->/gi, '');
        html = html.replace(/<!--[\s\S]*?-->/g, '');
        html = html.replace(/<o:p>[\s\S]*?<\/o:p>/gi, '');
        html = html.replace(/class="Mso[^"]*"/gi, '');

        return html;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    handleEnterKey(e) {
        const selection = window.getSelection();
        if (!selection.rangeCount) return false;

        const range = selection.getRangeAt(0);
        let block = range.startContainer;
        
        // Проверяем, находимся ли мы в figcaption - вставляем <br> вместо создания нового figcaption
        let figcaption = block;
        while (figcaption && figcaption !== this.el) {
            if (figcaption.nodeType === Node.ELEMENT_NODE && figcaption.tagName === 'FIGCAPTION') {
                e.preventDefault();
                document.execCommand('insertLineBreak');
                this.instance.sync();
                return true;
            }
            figcaption = figcaption.parentNode;
        }
        
        // Находим блочный элемент
        while (block && block !== this.el) {
            if (block.nodeType === Node.ELEMENT_NODE) {
                const tag = block.tagName;
                if (['LI', 'BLOCKQUOTE', 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(tag)) {
                    break;
                }
            }
            block = block.parentNode;
        }

        if (!block || block === this.el) return false;

        // Проверяем что блок пустой
        const isEmpty = !block.textContent.trim() && !block.querySelector('img, iframe');

        // Выход из списка на пустом LI
        if (block.tagName === 'LI' && isEmpty) {
            e.preventDefault();
            
            const list = block.parentElement;
            const nextSibling = block.nextElementSibling;
            
            // Проверяем, вложенный ли это список
            // 1. Стандартная вложенность: родитель списка это LI
            const parentLi = list.parentElement.closest('li');
            // 2. Нестандартная (ошибочная) вложенность: список внутри списка
            const parentIsList = ['UL', 'OL'].includes(list.parentElement.tagName);
            
            const isNested = !!parentLi || parentIsList;
            
            if (isNested) {
                // Это вложенный список - нужно выйти на уровень выше
                
                // Определяем куда переносить элемент
                let targetList;
                let referenceNode;
                
                if (parentLi) {
                    targetList = parentLi.parentElement;
                    referenceNode = parentLi;
                } else {
                    // Если список был вложен неправильно (напрямую в UL/OL)
                    targetList = list.parentElement;
                    referenceNode = list;
                }
                
                // Создаём новый LI для родительского списка
                const newLi = document.createElement('li');
                
                // Если есть элементы после текущего LI во вложенном списке
                if (nextSibling) {
                    // Создаём новый вложенный список для оставшихся элементов
                    const newNestedList = document.createElement(list.tagName);
                    let current = nextSibling;
                    while (current) {
                        const next = current.nextElementSibling;
                        newNestedList.appendChild(current);
                        current = next;
                    }
                    // Добавляем текстовый узел перед вложенным списком для позиционирования курсора
                    const textNode = document.createTextNode('');
                    newLi.appendChild(textNode);
                    newLi.appendChild(newNestedList);
                } else {
                    newLi.innerHTML = '<br>';
                }
                
                // Вставляем новый LI после родительского элемента (LI или вложенного списка)
                if (referenceNode.nextSibling) {
                    targetList.insertBefore(newLi, referenceNode.nextSibling);
                } else {
                    targetList.appendChild(newLi);
                }
                
                // Удаляем пустой LI из вложенного списка
                block.remove();
                
                // Если вложенный список стал пустым - удаляем его
                if (list.children.length === 0) {
                    list.remove();
                }
                
                // Ставим курсор в новый LI
                const newRange = document.createRange();
                newRange.setStart(newLi, 0);
                newRange.collapse(true);
                selection.removeAllRanges();
                selection.addRange(newRange);
                
                this.instance.sync();
                return true;
            }
            
            // Это список верхнего уровня - выходим в параграф
            const p = document.createElement('p');
            p.innerHTML = '<br>';
            
            // Если есть элементы после текущего - нужно разбить список
            if (nextSibling) {
                // Создаём новый список для оставшихся элементов
                const newList = document.createElement(list.tagName);
                let current = nextSibling;
                while (current) {
                    const next = current.nextElementSibling;
                    newList.appendChild(current);
                    current = next;
                }
                
                // Вставляем параграф и новый список после текущего списка
                list.parentNode.insertBefore(p, list.nextSibling);
                p.parentNode.insertBefore(newList, p.nextSibling);
            } else {
                // Просто вставляем параграф после списка
                list.parentNode.insertBefore(p, list.nextSibling);
            }
            
            // Удаляем пустой LI
            block.remove();
            
            // Если список стал пустым - удаляем
            if (list.children.length === 0) {
                list.remove();
            }
            
            // Ставим курсор в новый параграф
            const newRange = document.createRange();
            newRange.setStart(p, 0);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
            
            this.instance.sync();
            return true;
        }

        // Выход из цитаты на пустом параграфе внутри
        if (block.tagName === 'BLOCKQUOTE' && isEmpty) {
            e.preventDefault();
            
            const p = document.createElement('p');
            p.innerHTML = '<br>';
            
            block.parentNode.insertBefore(p, block.nextSibling);
            block.remove();
            
            const newRange = document.createRange();
            newRange.setStart(p, 0);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
            
            this.instance.sync();
            return true;
        }

        return false;
    }

    handleBackspace(e) {
        const selection = window.getSelection();
        if (!selection.rangeCount || !selection.isCollapsed) return false;

        const range = selection.getRangeAt(0);
        
        // Проверяем что курсор в начале
        if (range.startOffset !== 0) return false;

        let block = range.startContainer;
        while (block && block !== this.el) {
            if (block.nodeType === Node.ELEMENT_NODE) {
                const tag = block.tagName;
                if (['LI', 'BLOCKQUOTE', 'ASIDE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(tag)) {
                    break;
                }
            }
            block = block.parentNode;
        }

        if (!block || block === this.el) return false;

        // Проверяем что курсор в самом начале блока
        let node = range.startContainer;
        while (node && node !== block) {
            if (node.previousSibling) return false;
            node = node.parentNode;
        }

        // Преобразуем заголовок в параграф
        if (['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(block.tagName)) {
            e.preventDefault();
            
            const p = document.createElement('p');
            while (block.firstChild) {
                p.appendChild(block.firstChild);
            }
            if (!p.innerHTML.trim()) p.innerHTML = '<br>';
            
            block.parentNode.replaceChild(p, block);
            
            const newRange = document.createRange();
            newRange.setStart(p, 0);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
            
            this.instance.sync();
            return true;
        }

        // Преобразуем цитату или aside в параграф
        if (block.tagName === 'BLOCKQUOTE' || block.tagName === 'ASIDE') {
            e.preventDefault();
            
            const p = document.createElement('p');
            while (block.firstChild) {
                p.appendChild(block.firstChild);
            }
            if (!p.innerHTML.trim()) p.innerHTML = '<br>';
            
            block.parentNode.replaceChild(p, block);
            
            const newRange = document.createRange();
            newRange.setStart(p, 0);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
            
            this.instance.sync();
            return true;
        }

        return false;
    }

    handleSpace() {
        const selection = window.getSelection();
        if (!selection.rangeCount || !selection.isCollapsed) return;

        const range = selection.getRangeAt(0);
        const inlineTags = ['B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'A', 'CODE', 'SPAN', 'SUB', 'SUP'];
        
        let node = range.endContainer;
        let offset = range.endOffset;
        let targetTag = null;

        // Проверяем предыдущий символ для двойных пробелов
        let prevChar = '';
        if (node.nodeType === Node.TEXT_NODE && offset > 0) {
            prevChar = node.textContent[offset - 1];
        }
        const charToInsert = (prevChar === ' ') ? '\u00A0' : ' ';
        
        // Логика выхода из форматирования
        const isAtEnd = (n, off) => {
            if (n.nodeType === Node.TEXT_NODE) return off === n.textContent.length;
            return off === n.childNodes.length;
        };

        if (isAtEnd(node, offset)) {
            let current = node;
            while (current && current !== this.el) {
                if (current.nodeType === Node.ELEMENT_NODE && inlineTags.includes(current.tagName)) {
                    targetTag = current;
                }
                if (current.nextSibling) break;
                current = current.parentNode;
            }
        }

        if (targetTag) {
            const space = document.createTextNode(charToInsert);
            if (targetTag.nextSibling) {
                targetTag.parentNode.insertBefore(space, targetTag.nextSibling);
            } else {
                targetTag.parentNode.appendChild(space);
            }
            
            const newRange = document.createRange();
            newRange.setStartAfter(space);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
            
            this.instance.sync();
            return;
        }

        // Стандартная вставка
        const textNode = range.startContainer;
        if (textNode.nodeType === Node.TEXT_NODE) {
            const text = textNode.data;
            textNode.data = text.slice(0, offset) + charToInsert + text.slice(offset);
            
            const newRange = document.createRange();
            newRange.setStart(textNode, offset + 1);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
            
            this.instance.sync();
        } else {
            const newTextNode = document.createTextNode(charToInsert);
            this.instance.selection.insertNode(newTextNode);
            this.instance.sync();
        }
    }
}
