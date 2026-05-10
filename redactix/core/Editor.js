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
            const checkContent = child.innerHTML.replace(/<br\s*\/?>/gi, '').trim();

            if (!checkContent && ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'ASIDE'].includes(child.tagName)) {
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
            // Save cursor position before wrapping
            const sel = window.getSelection();
            let savedOffset = 0;
            let savedNode = null;
            if (sel.rangeCount) {
                const range = sel.getRangeAt(0);
                savedNode = range.startContainer;
                savedOffset = range.startOffset;
            }

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

            // Restore cursor position after wrapping
            if (savedNode && p.contains(savedNode)) {
                try {
                    const newRange = document.createRange();
                    newRange.setStart(savedNode, savedOffset);
                    newRange.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(newRange);
                } catch (e) {
                    // Fallback: place cursor at end of p
                    const newRange = document.createRange();
                    newRange.selectNodeContents(p);
                    newRange.collapse(false);
                    sel.removeAllRanges();
                    sel.addRange(newRange);
                }
            }
        }
    }

    // Ensure there is an empty paragraph at the end of the editor
    // if the last element is an uneditable block (figure, table, hr, etc.)
    ensureTrailingParagraph() {
        const lastChild = this.el.lastElementChild;
        if (lastChild && (
            ['FIGURE', 'TABLE', 'HR', 'PRE'].includes(lastChild.tagName) ||
            (lastChild.tagName === 'DIV' && (lastChild.classList.contains('redactix-separator') || lastChild.classList.contains('redactix-video-wrapper')))
        )) {
            const p = document.createElement('p');
            p.innerHTML = '<br>';
            this.el.appendChild(p);
        }
    }

    bindEvents() {
        // Observer для любых изменений DOM (самый надежный способ синхронизации)
        this.observer = new MutationObserver((mutations) => {
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

        // Ensure trailing paragraph after programmatic DOM changes settle
        // Uses click on editor area to check if last element needs a trailing p
        this.el.addEventListener('click', (e) => {
            this.ensureTrailingParagraph();
        });

        // Обработка paste
        this.el.addEventListener('paste', (e) => {
            e.preventDefault();
            this.handlePaste(e);
        });

        // Обработка нажатий клавиш
        this.el.addEventListener('keydown', (e) => {
            // Shift+Enter inside aside/blockquote — insert <br> explicitly
            if (e.key === 'Enter' && e.shiftKey) {
                if (this.handleShiftEnter(e)) {
                    return;
                }
            }

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

            // Delete (forward) — protect atomic blocks (figure / pre / table /
            // hr / video-wrapper / separator) from being destroyed when the
            // user is just trying to remove an adjacent empty paragraph.
            if (e.key === 'Delete') {
                if (this.handleDelete(e)) {
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

            // Parse into temp element to check structure
            const temp = document.createElement('div');
            temp.innerHTML = html;

            const blockSelector = 'p, h1, h2, h3, h4, h5, h6, blockquote, aside, figure, pre, table, ul, ol, hr, div';
            const hasBlocks = !!temp.querySelector(blockSelector);

            if (!hasBlocks) {
                // Inline-only content — insertHTML works fine for this
                document.execCommand('insertHTML', false, html);
            } else {
                // Block content — manual DOM insertion to avoid browser quirks
                this.insertBlockContent(temp);
            }

            // Настраиваем вставленные figure
            if (this.instance.setupFigures) {
                this.instance.setupFigures();
            }

            // Migrate any pasted legacy blockquotes and wire up quote-cards
            if (this.instance.runQuoteCardSetup) {
                this.instance.runQuoteCardSetup();
            }
            if (this.instance.runCalloutSetup) {
                this.instance.runCalloutSetup();
            }
            if (this.instance.runEmbedSetup) {
                this.instance.runEmbedSetup();
            }
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
        this.ensureTrailingParagraph();
    }

    /**
     * Insert block-level content from a parsed container using DOM API.
     * Avoids insertHTML quirks with block elements inside blocks.
     */
    insertBlockContent(container) {
        const sel = window.getSelection();
        if (!sel.rangeCount) return;

        const range = sel.getRangeAt(0);
        range.deleteContents();

        // Find the top-level block the cursor is in
        let currentBlock = range.startContainer;
        while (currentBlock && currentBlock !== this.el && currentBlock.parentNode !== this.el) {
            currentBlock = currentBlock.parentNode;
        }

        // If we couldn't find a block or we're at editor root level
        if (!currentBlock || currentBlock === this.el) {
            // Just insert all children at cursor position
            const frag = document.createDocumentFragment();
            while (container.firstChild) {
                frag.appendChild(container.firstChild);
            }
            range.insertNode(frag);
            range.collapse(false);
            sel.removeAllRanges();
            sel.addRange(range);
            return;
        }

        // Check if current block is empty (only <br> or whitespace)
        const currentContent = currentBlock.innerHTML.replace(/<br\s*\/?>/gi, '').trim();
        const isCurrentEmpty = !currentContent;

        // Collect all nodes to insert
        const nodesToInsert = [];
        while (container.firstChild) {
            nodesToInsert.push(container.firstChild);
            container.removeChild(container.firstChild);
        }

        if (nodesToInsert.length === 0) return;

        // Insert each node after the current block
        let insertionRef = currentBlock.nextSibling;
        for (const node of nodesToInsert) {
            this.el.insertBefore(node, insertionRef);
        }

        // If current block was empty, remove it (pasted content replaces it)
        if (isCurrentEmpty) {
            currentBlock.remove();
        }

        // Place cursor at the end of the last inserted node
        const lastInserted = insertionRef
            ? insertionRef.previousSibling
            : this.el.lastChild;
        if (lastInserted) {
            const newRange = document.createRange();
            if (lastInserted.nodeType === Node.ELEMENT_NODE) {
                newRange.selectNodeContents(lastInserted);
                newRange.collapse(false);
            } else {
                newRange.setStartAfter(lastInserted);
                newRange.collapse(true);
            }
            sel.removeAllRanges();
            sel.addRange(newRange);
        }
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

        // Spare iframes that belong to a known embed provider (or already
        // sit inside a redactix-embed figure) before the dangerousTags
        // sweep. Sanitize them in place so the attribute-cleanup loop
        // below doesn't strip src/allow/etc.
        const embedModule = this.instance.modules.find(m => m.constructor.name === 'Embed');
        const safeIframes = new Set();
        if (embedModule) {
            Array.from(temp.querySelectorAll('iframe')).forEach(iframe => {
                const insideEmbed = iframe.closest && iframe.closest('figure.redactix-embed');
                const src = iframe.getAttribute('src') || '';
                const detected = embedModule.findProviderByUrl(src);
                if (insideEmbed || detected) {
                    embedModule.sanitizeIframe(iframe);
                    safeIframes.add(iframe);

                    // If the iframe wasn't wrapped in a redactix-embed figure,
                    // wrap it now so it survives later passes and renders
                    // correctly with our CSS.
                    if (!insideEmbed) {
                        const figure = document.createElement('figure');
                        figure.className = 'redactix-embed';
                        figure.setAttribute('data-provider', detected ? detected.provider.name : 'custom');
                        figure.setAttribute('data-aspect', detected ? (detected.provider.aspect || 'auto') : 'auto');
                        const frame = document.createElement('div');
                        frame.className = 'redactix-embed-frame';
                        iframe.parentNode.insertBefore(figure, iframe);
                        frame.appendChild(iframe);
                        figure.appendChild(frame);
                    }
                }
            });
        }

        // Spare <video> tags that already sit inside a figure.redactix-video
        // (i.e. saved Redactix output being pasted back). They get a safe
        // attribute set, then survive the global attribute sweep below.
        // Standalone <video> tags pasted from elsewhere are stripped — we
        // only re-render videos the editor itself produced.
        const videoModule = this.instance.modules.find(m => m.constructor.name === 'Video');
        const safeVideos = new Set();
        if (videoModule) {
            Array.from(temp.querySelectorAll('figure.redactix-video > video')).forEach(video => {
                const src = video.getAttribute('src') || '';
                if (!src || src.toLowerCase().startsWith('javascript:')) return;
                // Whitelisted attribute set: src + controls + preload + style
                // (only when style declares aspect-ratio).
                const aspectStyle = (video.getAttribute('style') || '').match(/aspect-ratio\s*:\s*[^;]+/i);
                Array.from(video.attributes).forEach(attr => {
                    video.removeAttribute(attr.name);
                });
                video.setAttribute('src', src);
                video.setAttribute('controls', '');
                video.setAttribute('preload', 'metadata');
                if (aspectStyle) video.setAttribute('style', aspectStyle[0]);
                safeVideos.add(video);
            });
        }

        // Удаляем опасные и ненужные теги
        const dangerousTags = ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'meta', 'colgroup'];
        dangerousTags.forEach(tag => {
            const elements = Array.from(temp.getElementsByTagName(tag));
            elements.forEach(el => {
                if (tag === 'iframe' && safeIframes.has(el)) return;
                if (el.parentNode) el.parentNode.removeChild(el);
            });
        });

        // Strip standalone <video> tags that aren't wrapped in a redactix-video
        // figure — we only render videos through our own pipeline.
        Array.from(temp.querySelectorAll('video')).forEach(video => {
            if (safeVideos.has(video)) return;
            if (video.parentNode) video.parentNode.removeChild(video);
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
        // Разрешённые классы. Структурные имена редактора зашиты, а
        // классы коллаут/цитат-пресетов берутся из конфига — так у юзера,
        // отключившего дефолтные пресеты, при вставке не выживут
        // соответствующие классы; и наоборот, кастомные классы
        // (calloutPresets / quotePresets) пройдут без явного whitelist'а.
        const allowedClasses = ['spoiler', 'quote-card',
            'redactix-embed', 'redactix-embed-frame',
            'redactix-video', 'redactix-gallery', 'redactix-gallery-grid'];
        const presetClasses = [
            ...(this.instance.config.calloutPresets || []),
            ...(this.instance.config.quotePresets || [])
        ].map(p => p.class).filter(Boolean);
        allowedClasses.push(...presetClasses);
        const allElements = temp.getElementsByTagName('*');

        for (let i = 0; i < allElements.length; i++) {
            const el = allElements[i];
            // Iframes that we've spared above were already sanitized to a
            // safe attribute set — don't re-strip them here.
            if (el.tagName === 'IFRAME' && safeIframes.has(el)) continue;
            // Same for safe <video> tags inside figure.redactix-video.
            if (el.tagName === 'VIDEO' && safeVideos.has(el)) continue;
            const attrs = Array.from(el.attributes);

            attrs.forEach(attr => {
                if (!allowedAttributes.includes(attr.name.toLowerCase())) {
                    // Allow data-emoji on aside elements
                    if (attr.name.toLowerCase() === 'data-emoji' && el.tagName === 'ASIDE') {
                        return;
                    }
                    // Allow data-provider / data-aspect / data-height /
                    // data-source-url on redactix-embed figures
                    if ((attr.name.toLowerCase() === 'data-provider' ||
                         attr.name.toLowerCase() === 'data-aspect' ||
                         attr.name.toLowerCase() === 'data-height' ||
                         attr.name.toLowerCase() === 'data-source-url') &&
                        el.tagName === 'FIGURE' &&
                        el.classList.contains('redactix-embed')) {
                        return;
                    }
                    // Allow data-aspect on redactix-video figures
                    if (attr.name.toLowerCase() === 'data-aspect' &&
                        el.tagName === 'FIGURE' &&
                        el.classList.contains('redactix-video')) {
                        return;
                    }
                    // For class — filter, keeping only allowed ones
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

            // Удаляем inline стили — кроме <video> внутри figure.redactix-video,
            // у которого мы выше уже оставили только aspect-ratio.
            if (!(el.tagName === 'VIDEO' && safeVideos.has(el))) {
                el.removeAttribute('style');
            }
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

        return html.trim();
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Insert a <br> element at the current cursor position via DOM API.
     * We avoid document.execCommand('insertLineBreak') because with
     * white-space:pre-wrap it inserts a \n text node instead of a <br> tag.
     */
    insertBrAtCursor() {
        const sel = window.getSelection();
        if (!sel.rangeCount) return;

        const range = sel.getRangeAt(0);
        range.deleteContents();

        const br = document.createElement('br');
        range.insertNode(br);

        // If <br> is at the very end of its parent (no meaningful content after),
        // browsers won't render a visible new line. Add a second <br> so the
        // cursor has a line to land on.
        const next = br.nextSibling;
        const needsExtra = !next ||
            (next.nodeType === Node.TEXT_NODE && next.textContent === '');
        if (needsExtra) {
            const extraBr = document.createElement('br');
            br.parentNode.insertBefore(extraBr, br.nextSibling);
        }

        // Place cursor after the first <br>
        const newRange = document.createRange();
        newRange.setStartAfter(br);
        newRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newRange);
    }

    /**
     * Handle Shift+Enter inside aside and blockquote elements.
     * Insert a real <br> tag instead of relying on browser default.
     */
    handleShiftEnter(e) {
        const selection = window.getSelection();
        if (!selection.rangeCount) return false;

        const range = selection.getRangeAt(0);
        let node = range.startContainer;

        // Walk up to find if we are inside an aside or blockquote
        while (node && node !== this.el) {
            if (node.nodeType === Node.ELEMENT_NODE &&
                (node.tagName === 'ASIDE' || node.tagName === 'BLOCKQUOTE')) {
                e.preventDefault();
                this.insertBrAtCursor();
                this.instance.sync();
                return true;
            }
            node = node.parentNode;
        }

        return false;
    }

    handleEnterKey(e) {
        const selection = window.getSelection();
        if (!selection.rangeCount) return false;

        const range = selection.getRangeAt(0);
        let block = range.startContainer;

        // Check if we are inside a figcaption — special-case quote-card (block
        // Enter entirely; single-line author field) vs. plain figure (insert <br>).
        let inlineEditable = block;
        while (inlineEditable && inlineEditable !== this.el) {
            if (inlineEditable.nodeType === Node.ELEMENT_NODE &&
                inlineEditable.tagName === 'FIGCAPTION') {
                const card = inlineEditable.parentElement;
                if (card && card.tagName === 'FIGURE' && card.classList.contains('quote-card')) {
                    e.preventDefault();
                    return true;
                }
                e.preventDefault();
                this.insertBrAtCursor();
                this.instance.sync();
                return true;
            }
            inlineEditable = inlineEditable.parentNode;
        }

        // Находим блочный элемент
        while (block && block !== this.el) {
            if (block.nodeType === Node.ELEMENT_NODE) {
                const tag = block.tagName;
                if (['LI', 'BLOCKQUOTE', 'ASIDE', 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(tag)) {
                    break;
                }
            }
            block = block.parentNode;
        }

        if (!block || block === this.el) return false;

        // Quote-card: Enter on the empty last block exits the card.
        const card = block.closest && block.closest('figure.quote-card');
        if (card && block.tagName !== 'LI') {
            const bq = card.querySelector(':scope > blockquote');
            if (bq && block.parentNode === bq) {
                const isLast = block === bq.lastElementChild;
                const isEmpty = !block.textContent.trim() &&
                    !block.querySelector('img, iframe');
                if (isLast && isEmpty) {
                    e.preventDefault();
                    block.remove();
                    if (bq.children.length === 0) {
                        const filler = document.createElement('p');
                        filler.innerHTML = '<br>';
                        bq.appendChild(filler);
                    }
                    const exitP = document.createElement('p');
                    exitP.innerHTML = '<br>';
                    card.parentNode.insertBefore(exitP, card.nextSibling);
                    const newRange = document.createRange();
                    newRange.setStart(exitP, 0);
                    newRange.collapse(true);
                    selection.removeAllRanges();
                    selection.addRange(newRange);
                    this.instance.sync();
                    return true;
                }
                // Otherwise let the browser create a sibling block inside the blockquote.
                return false;
            }
        }

        // Callout: Enter on the empty last block exits the aside.
        // Mirrors the quote-card behavior.
        const aside = block.closest && block.closest('aside');
        if (aside && block.tagName !== 'LI' && block.parentNode === aside) {
            const isLast = block === aside.lastElementChild;
            const isEmpty = !block.textContent.trim() &&
                !block.querySelector('img, iframe, hr');
            if (isLast && isEmpty) {
                e.preventDefault();
                block.remove();
                if (aside.children.length === 0) {
                    const filler = document.createElement('p');
                    filler.innerHTML = '<br>';
                    aside.appendChild(filler);
                }
                const exitP = document.createElement('p');
                exitP.innerHTML = '<br>';
                aside.parentNode.insertBefore(exitP, aside.nextSibling);
                const newRange = document.createRange();
                newRange.setStart(exitP, 0);
                newRange.collapse(true);
                selection.removeAllRanges();
                selection.addRange(newRange);
                this.instance.sync();
                return true;
            }
            // Otherwise let the browser create a sibling block inside the aside.
            return false;
        }

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
                // P is included so we can detect blocks inside quote-card
                if (['LI', 'BLOCKQUOTE', 'ASIDE', 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(tag)) {
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

        // Quote-card: don't let backspace escape the card
        const card = block.closest && block.closest('figure.quote-card');
        if (card && block.tagName !== 'LI') {
            const bq = card.querySelector(':scope > blockquote');
            if (bq && block.parentNode === bq) {
                const isFirst = block === bq.firstElementChild;
                if (!isFirst) {
                    // Let the browser merge with the previous block inside blockquote
                    return false;
                }
                const isEmpty = !block.textContent.trim() &&
                    !block.querySelector('img, iframe');
                if (!isEmpty) {
                    // Don't merge with content outside the card
                    e.preventDefault();
                    return true;
                }
                e.preventDefault();
                block.remove();
                if (bq.children.length === 0) {
                    // Card became empty — replace whole card with a paragraph
                    const replacement = document.createElement('p');
                    replacement.innerHTML = '<br>';
                    card.parentNode.replaceChild(replacement, card);
                    const r = document.createRange();
                    r.setStart(replacement, 0);
                    r.collapse(true);
                    selection.removeAllRanges();
                    selection.addRange(r);
                } else {
                    const newFirst = bq.firstElementChild;
                    const r = document.createRange();
                    r.setStart(newFirst, 0);
                    r.collapse(true);
                    selection.removeAllRanges();
                    selection.addRange(r);
                }
                this.instance.sync();
                return true;
            }
        }

        // Callout: same idea — don't let backspace escape the aside.
        const aside = block.closest && block.closest('aside');
        if (aside && block.tagName !== 'LI' && block.parentNode === aside) {
            const isFirst = block === aside.firstElementChild;
            if (!isFirst) {
                // Let the browser merge with the previous block inside aside
                return false;
            }
            const isEmpty = !block.textContent.trim() &&
                !block.querySelector('img, iframe, hr');
            if (!isEmpty) {
                e.preventDefault();
                return true;
            }
            e.preventDefault();
            block.remove();
            if (aside.children.length === 0) {
                // Aside became empty — replace whole aside with a paragraph
                const replacement = document.createElement('p');
                replacement.innerHTML = '<br>';
                aside.parentNode.replaceChild(replacement, aside);
                const r = document.createRange();
                r.setStart(replacement, 0);
                r.collapse(true);
                selection.removeAllRanges();
                selection.addRange(r);
            } else {
                const newFirst = aside.firstElementChild;
                const r = document.createRange();
                r.setStart(newFirst, 0);
                r.collapse(true);
                selection.removeAllRanges();
                selection.addRange(r);
            }
            this.instance.sync();
            return true;
        }

        // Standalone P at top level — protect adjacent atomic blocks
        // (figure / pre / table / hr / video-wrapper / separator) from
        // browser's default backspace-merge, which deletes the whole atomic
        // block when its only "neighbour" content is non-editable.
        if (block.tagName === 'P' && block.parentNode === this.el) {
            const prev = block.previousElementSibling;
            if (prev && this.isAtomicBlock(prev) &&
                this.isCursorAtStartOfBlock(range, block)) {
                e.preventDefault();
                const isEmpty = !block.textContent.trim() &&
                    !block.querySelector('img, iframe, video, audio, table, hr');
                if (!isEmpty) {
                    // Don't merge content into / destroy the atomic block.
                    return true;
                }
                this.removeBlockNextToAtomic(block, prev, 'end');
                this.instance.sync();
                return true;
            }
            return false;
        }
        if (block.tagName === 'P') return false;

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

        // Defensive fallback: top-level <aside> with no inner block (shouldn't
        // happen after migration, but kept just in case) — convert to paragraph.
        if (block.tagName === 'ASIDE') {
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

    /**
     * Forward Delete handler — symmetric to handleBackspace's protection of
     * adjacent atomic blocks. Triggered on Delete pressed at the END of a
     * top-level P that's followed by figure / pre / table / hr / .redactix-
     * separator / .redactix-video-wrapper. Browser's default would merge the
     * atomic block into the empty paragraph, destroying both.
     */
    handleDelete(e) {
        const selection = window.getSelection();
        if (!selection.rangeCount || !selection.isCollapsed) return false;

        const range = selection.getRangeAt(0);

        // Find the top-level block (direct child of the editor) that
        // contains the cursor. We deliberately do NOT stop at the nearest
        // P/H — going to top level lets us correctly handle cases like a
        // cursor in the last paragraph of a list/aside followed by an atomic
        // block, and cases where the immediate nearest editable block is the
        // top-level block itself.
        const block = this.findTopLevelBlock(range.endContainer);
        if (!block) return false;
        // Cursor inside an atomic block (e.g. figcaption of a figure) — let
        // the browser handle Delete inside it.
        if (this.isAtomicBlock(block)) return false;

        // Cursor must have nothing meaningful between it and the end of the
        // block. toString() on a Range ignores <br> and other non-text
        // nodes, so this correctly treats trailing <br>, empty inline
        // wrappers, and empty paragraphs as "at end".
        if (!this.isCursorAtEndOfBlock(range, block)) return false;

        const next = block.nextElementSibling;
        if (!next || !this.isAtomicBlock(next)) return false;

        e.preventDefault();
        const isEmpty = !block.textContent.trim() &&
            !block.querySelector('img, iframe, video, audio, table, hr');
        if (!isEmpty) {
            // Block has content — don't merge the atomic block backward
            // (which would also destroy it). Just no-op.
            return true;
        }
        this.removeBlockNextToAtomic(block, next, 'start');
        this.instance.sync();
        return true;
    }

    /** Top-level block (direct child of editorEl) that contains `node`. */
    findTopLevelBlock(node) {
        while (node && node.parentNode !== this.el) {
            node = node.parentNode;
        }
        return (node && node !== this.el) ? node : null;
    }

    /**
     * Range-based "is the cursor at the start of `block`?" — robust to
     * inline wrappers, leading <br>, etc. Returns true iff there is no
     * visible text between the start of the block and the cursor.
     */
    isCursorAtStartOfBlock(range, block) {
        if (!range.collapsed) return false;
        const head = document.createRange();
        head.setStart(block, 0);
        head.setEnd(range.startContainer, range.startOffset);
        return head.toString() === '';
    }

    /**
     * Range-based "is the cursor at the end of `block`?" — robust to
     * trailing <br>, inline wrappers, etc. Returns true iff there is no
     * visible text between the cursor and the end of the block.
     */
    isCursorAtEndOfBlock(range, block) {
        if (!range.collapsed) return false;
        const tail = document.createRange();
        tail.setStart(range.endContainer, range.endOffset);
        tail.setEnd(block, block.childNodes.length);
        return tail.toString() === '';
    }

    /**
     * Atomic blocks are top-level elements that should never be destroyed by
     * a browser-default merge with an adjacent empty paragraph: image/video/
     * embed/gallery figures (FIGURE), code blocks (PRE), tables, separators
     * (HR / .redactix-separator), and the legacy .redactix-video-wrapper.
     */
    isAtomicBlock(el) {
        if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
        const tag = el.tagName;
        if (tag === 'FIGURE' || tag === 'PRE' || tag === 'TABLE' || tag === 'HR') return true;
        if (tag === 'DIV' && (el.classList.contains('redactix-separator') || el.classList.contains('redactix-video-wrapper'))) return true;
        return false;
    }

    /**
     * Remove an empty paragraph that sits next to an atomic block, placing
     * the cursor in a sensible existing landing spot. We deliberately do NOT
     * create new figcaptions — for video/embed without a caption a phantom
     * figcaption looks like an unwanted caption box, and for quote-cards
     * the figcaption is reserved for author info (img + span) and managed
     * by the QuoteCard module.
     *
     * If no good landing spot exists, leave the empty paragraph alone — the
     * caller has already preventDefault'd, so the only effect is that
     * backspace/delete is a visible no-op rather than destroying the figure.
     *
     * @param {HTMLElement} block       The empty P to remove.
     * @param {HTMLElement} atomic      The adjacent atomic block.
     * @param {'start'|'end'} edge      Where to land the cursor relative to
     *                                  any editable target inside the atomic
     *                                  ('start' = top — used for forward
     *                                  Delete; 'end' = bottom — used for
     *                                  Backspace).
     */
    removeBlockNextToAtomic(block, atomic, edge) {
        const targetRange = this.findCursorTargetForAtomic(atomic, edge);
        if (!targetRange) return; // preventDefault was already called

        block.remove();
        this.ensureTrailingParagraph();

        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(targetRange);
    }

    /**
     * Where should the cursor land after removing a paragraph adjacent to
     * `atomic`? Returns a Range positioned in the most natural editable
     * spot, or null when none exists.
     *
     *   • Quote-card  → inside its inner blockquote's first/last <p>.
     *   • Other FIGURE with an EXISTING editable <figcaption> (typically the
     *     image module always creates one, video/embed only when caption
     *     was supplied) → that figcaption.
     *   • Non-figure atomic, or figure without figcaption → "jump over" the
     *     atomic into the nearest non-atomic editable sibling on the side
     *     the user was deleting toward (end of prev for Backspace, start of
     *     next for Delete).
     */
    findCursorTargetForAtomic(atomic, edge) {
        if (atomic.tagName === 'FIGURE') {
            if (atomic.classList.contains('quote-card')) {
                const bq = atomic.querySelector(':scope > blockquote');
                const innerP = bq && (edge === 'end' ? bq.lastElementChild : bq.firstElementChild);
                if (innerP) {
                    const r = document.createRange();
                    r.selectNodeContents(innerP);
                    r.collapse(edge === 'start');
                    return r;
                }
            } else {
                const figcaption = atomic.querySelector(':scope > figcaption');
                if (figcaption && figcaption.isContentEditable) {
                    const r = document.createRange();
                    r.selectNodeContents(figcaption);
                    r.collapse(edge === 'start');
                    return r;
                }
            }
        }

        // Fall back to jumping over the atomic into the nearest non-atomic
        // editable sibling — direction follows the keystroke:
        //   Backspace (edge='end') → end of atomic.previousElementSibling.
        //   Delete    (edge='start') → start of atomic.nextElementSibling.
        const target = edge === 'end'
            ? atomic.previousElementSibling
            : atomic.nextElementSibling;
        if (target && target.isContentEditable !== false && !this.isAtomicBlock(target)) {
            const r = document.createRange();
            r.selectNodeContents(target);
            r.collapse(edge === 'start');
            return r;
        }
        return null;
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
