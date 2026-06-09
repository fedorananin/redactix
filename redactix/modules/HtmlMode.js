import Module from '../core/Module.js';
import Icons from '../ui/Icons.js';

export default class HtmlMode extends Module {
    constructor(instance) {
        super(instance);
        this.isHtmlMode = false;
        this.editorContainer = null;
        this.textarea = null;
        this.lineNumbers = null;

        // Подсветка синтаксиса: прозрачная textarea лежит поверх <pre>
        // с раскрашенной копией текста (overlay-паттерн). textarea
        // остаётся источником правды — каретка, выделение и undo нативные.
        this.codeMain = null;       // обёртка textarea + backdrop
        this.backdrop = null;       // <pre> с подсветкой
        this.backdropCode = null;   // <code> внутри backdrop
        this.lineHighlight = null;  // полоса подсветки строки при hover на номер
        this._redrawFrame = null;   // rAF-коалесинг перерисовки

        // Метрики строки. Должны совпадать с CSS (.redactix-code-editor:
        // line-height 21px; паддинг 16px у textarea, backdrop и колонки
        // номеров) — на этом держится точное соответствие номера и строки.
        this.LINE_HEIGHT = 21;
        this.PAD_TOP = 16;
    }

    getButtons() {
        // В lite mode не показываем кнопку редактирования HTML
        if (this.instance.config.liteMode) {
            return [];
        }
        
        return [
            {
                name: 'html',
                icon: Icons.code,
                title: this.t('toolbar.editHtml'),
                action: () => this.toggleHtmlMode()
            }
        ];
    }

    toggleHtmlMode() {
        this.isHtmlMode = !this.isHtmlMode;
        const wrapper = this.instance.wrapper;
        const editorEl = this.instance.editorEl;

        if (this.isHtmlMode) {
            // --- ПЕРЕХОД В HTML РЕЖИМ ---

            // 1. Получаем HTML и форматируем
            let rawHtml = editorEl.innerHTML;
            
            // Убираем служебные элементы для чистого кода
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = rawHtml;
            
            // Убираем обертки hr
            tempDiv.querySelectorAll('.redactix-separator').forEach(wrapper => {
                const hr = wrapper.querySelector('hr');
                if (hr) {
                    wrapper.parentNode.replaceChild(hr, wrapper);
                }
            });
            
            // Убираем подсветку поиска
            tempDiv.querySelectorAll('.redactix-find-highlight').forEach(mark => {
                const text = document.createTextNode(mark.textContent);
                mark.parentNode.replaceChild(text, mark);
            });
            
            // Убираем пустые figcaption
            tempDiv.querySelectorAll('figcaption').forEach(figcaption => {
                const innerHtml = figcaption.innerHTML.replace(/<br\s*\/?>/gi, '').trim();
                if (!innerHtml && !figcaption.querySelector('img, iframe')) {
                    figcaption.remove();
                }
            });
            
            // Убираем style и пустой alt у img
            tempDiv.querySelectorAll('img').forEach(img => {
                img.removeAttribute('style');
                if (img.alt === '') img.removeAttribute('alt');
            });
            
            // Убираем contenteditable
            tempDiv.querySelectorAll('[contenteditable]').forEach(el => {
                el.removeAttribute('contenteditable');
            });

            // Apply per-module cleanups so HTML mode shows the same output
            // sync() writes to the textarea (no edit-button, no live frame
            // snapshots, no quote-card UI artifacts, etc.).
            const quoteCardModule = this.instance.modules.find(m => m.constructor.name === 'QuoteCard');
            if (quoteCardModule && quoteCardModule.cleanCardsForSync) {
                quoteCardModule.cleanCardsForSync(tempDiv);
            }
            const calloutModule = this.instance.modules.find(m => m.constructor.name === 'Callout');
            if (calloutModule && calloutModule.cleanCalloutsForSync) {
                calloutModule.cleanCalloutsForSync(tempDiv);
            }
            const embedModule = this.instance.modules.find(m => m.constructor.name === 'Embed');
            if (embedModule && embedModule.cleanEmbedsForSync) {
                embedModule.cleanEmbedsForSync(tempDiv);
            }
            const videoModule = this.instance.modules.find(m => m.constructor.name === 'Video');
            if (videoModule && videoModule.cleanVideosForSync) {
                videoModule.cleanVideosForSync(tempDiv);
            }
            const galleryModule = this.instance.modules.find(m => m.constructor.name === 'Gallery');
            if (galleryModule && galleryModule.cleanGalleriesForSync) {
                galleryModule.cleanGalleriesForSync(tempDiv);
            }

            tempDiv.normalize();

            rawHtml = tempDiv.innerHTML;

            const prettyHtml = this.beautifyHtml(rawHtml);

            // 2. Создаём контейнер редактора кода
            this.createCodeEditor(prettyHtml);

            // 3. Скрываем визуальный редактор, показываем редактор кода
            editorEl.style.display = 'none';
            wrapper.appendChild(this.editorContainer);

            // 4. Отключаем кнопки тулбара
            this.disableToolbar(true);
            
            // 5. Скрываем счётчик символов
            if (this.instance.counter) {
                this.instance.counter.style.display = 'none';
            }

            // 6. Фокус на textarea
            this.textarea.focus();
            this.redraw();

        } else {
            // --- ВОЗВРАТ В ВИЗУАЛЬНЫЙ РЕЖИМ ---

            // 1. Получаем значение из textarea
            let code = this.textarea ? this.textarea.value : '';

            // 2. Обновляем редактор
            const minifiedCode = this.minifyHtmlPreservePre(code);
            editorEl.innerHTML = minifiedCode;

            // Восстанавливаем обертки и настройки
            if (this.instance.normalizeInlineMarkup) {
                this.instance.normalizeInlineMarkup();
            }
            if (this.instance.wrapSeparators) {
                this.instance.wrapSeparators();
            }
            if (this.instance.setupFigures) {
                this.instance.setupFigures();
            }
            if (this.instance.setupCodeBlocks) {
                this.instance.setupCodeBlocks();
            }
            // Re-attach module-managed setup so quote-cards / callouts /
            // embeds / videos / galleries get their contenteditable,
            // edit buttons, etc. back.
            if (this.instance.runQuoteCardSetup) {
                this.instance.runQuoteCardSetup();
            }
            if (this.instance.runCalloutSetup) {
                this.instance.runCalloutSetup();
            }
            if (this.instance.runEmbedSetup) {
                this.instance.runEmbedSetup();
            }
            if (this.instance.runVideoSetup) {
                this.instance.runVideoSetup();
            }
            if (this.instance.runGallerySetup) {
                this.instance.runGallerySetup();
            }

            // 3. Убираем редактор кода
            if (this._redrawFrame != null) {
                cancelAnimationFrame(this._redrawFrame);
                this._redrawFrame = null;
            }
            if (this.editorContainer && this.editorContainer.parentNode) {
                this.editorContainer.parentNode.removeChild(this.editorContainer);
            }
            this.editorContainer = null;
            this.textarea = null;
            this.lineNumbers = null;
            this.codeMain = null;
            this.backdrop = null;
            this.backdropCode = null;
            this.lineHighlight = null;

            // 4. Показываем визуальный редактор
            editorEl.style.display = 'block';

            // 5. Включаем кнопки
            this.disableToolbar(false);
            
            // 6. Показываем счётчик символов
            if (this.instance.counter) {
                this.instance.counter.style.display = '';
            }
            
            // 7. Синхронизируем
            this.instance.sync();
        }
    }

    createCodeEditor(content) {
        // Основной контейнер
        this.editorContainer = document.createElement('div');
        this.editorContainer.className = 'redactix-code-editor';

        // Номера строк
        this.lineNumbers = document.createElement('div');
        this.lineNumbers.className = 'redactix-code-lines';

        // Колонка кода: подсвеченный backdrop позади + прозрачная textarea сверху
        this.codeMain = document.createElement('div');
        this.codeMain.className = 'redactix-code-main';

        this.lineHighlight = document.createElement('div');
        this.lineHighlight.className = 'redactix-code-line-highlight';

        this.backdrop = document.createElement('pre');
        this.backdrop.className = 'redactix-code-backdrop';
        this.backdrop.setAttribute('aria-hidden', 'true');
        this.backdropCode = document.createElement('code');
        this.backdrop.appendChild(this.backdropCode);

        // Textarea для редактирования
        this.textarea = document.createElement('textarea');
        this.textarea.className = 'redactix-code-textarea';
        this.textarea.value = content;
        this.textarea.spellcheck = false;
        this.textarea.autocomplete = 'off';
        this.textarea.autocorrect = 'off';
        this.textarea.autocapitalize = 'off';
        // Жёстко выключаем мягкий перенос: одна логическая строка = одна
        // визуальная = один номер. Без этого номера строк "уезжают" на
        // длинных строках (одна строка занимает две визуальные).
        this.textarea.setAttribute('wrap', 'off');

        // Обработчики событий
        this.textarea.addEventListener('input', () => this.scheduleRedraw());
        this.textarea.addEventListener('keydown', (e) => this.handleKeydown(e));
        // Скролл textarea зеркалится на подсвеченный слой через transform —
        // в отличие от scrollLeft/scrollTop это работает независимо от
        // того, есть ли у backdrop'а собственная переполненная область
        // (по вертикали её нет: высота backdrop'а равна контенту).
        this.textarea.addEventListener('scroll', () => this.syncBackdropScroll());

        // Hover по номеру строки — подсветка соответствующей строки кода
        this.lineNumbers.addEventListener('mouseover', (e) => {
            const num = e.target.closest('.redactix-code-line-number');
            if (num) this.showLineHighlight(parseInt(num.dataset.line, 10));
        });
        this.lineNumbers.addEventListener('mouseleave', () => this.hideLineHighlight());

        // Порядок отрисовки: полоса подсветки → подсвеченный код → textarea
        this.codeMain.appendChild(this.lineHighlight);
        this.codeMain.appendChild(this.backdrop);
        this.codeMain.appendChild(this.textarea);

        this.editorContainer.appendChild(this.lineNumbers);
        this.editorContainer.appendChild(this.codeMain);

        this.redraw();
    }

    /**
     * Полная перерисовка: номера строк + подсветка. Дёргается с rAF-
     * коалесингом на input, синхронно — из handleKeydown (ручные правки
     * value) и при создании редактора.
     */
    redraw() {
        this.updateLineNumbers();
        this.updateHighlight();
    }

    scheduleRedraw() {
        if (this._redrawFrame != null) return;
        this._redrawFrame = requestAnimationFrame(() => {
            this._redrawFrame = null;
            if (this.textarea) this.redraw();
        });
    }

    updateLineNumbers() {
        const lines = this.textarea.value.split('\n');
        const lineCount = lines.length;

        let numbersHtml = '';
        for (let i = 1; i <= lineCount; i++) {
            numbersHtml += `<div class="redactix-code-line-number" data-line="${i - 1}">${i}</div>`;
        }

        this.lineNumbers.innerHTML = numbersHtml;

        // Автовысота textarea (wrap выключен — высота детерминирована
        // числом строк)
        this.textarea.style.height = 'auto';
        this.textarea.style.height = Math.max(300, this.textarea.scrollHeight) + 'px';

        // Компенсация горизонтального скроллбара: он отъедает внутреннюю
        // высоту, и textarea получает возможность прокрутиться по
        // вертикали на его толщину. Браузер делает это сам при движении
        // каретки — и выделение/каретка уезжают относительно подсветки.
        // Добавляем толщину скроллбара к высоте, чтобы вертикального
        // скролла не существовало в принципе.
        const deficit = this.textarea.scrollHeight - this.textarea.clientHeight;
        if (deficit > 0) {
            this.textarea.style.height = (this.textarea.offsetHeight + deficit) + 'px';
        }
    }

    /**
     * Сдвиг подсвеченного слоя вслед за скроллом textarea (горизонтальным —
     * длинные строки; вертикальный в норме невозможен, но зеркалим и его
     * на случай переходных состояний).
     */
    syncBackdropScroll() {
        if (!this.backdropCode || !this.textarea) return;
        this.backdropCode.style.transform =
            `translate(${-this.textarea.scrollLeft}px, ${-this.textarea.scrollTop}px)`;
    }

    // ---------- Подсветка синтаксиса (свой токенайзер, без зависимостей) ----------

    /**
     * Перерисовать подсвеченную копию в backdrop. Завершающий \n нужен,
     * чтобы <pre> не схлопнул последнюю пустую строку (textarea её
     * показывает, и высоты должны совпадать).
     */
    updateHighlight() {
        if (!this.backdropCode) return;
        this.backdropCode.innerHTML = this.highlightHtml(this.textarea.value) + '\n';
        this.syncBackdropScroll();
    }

    escapeToken(s) {
        return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    /**
     * HTML-токенайзер: комментарии, doctype, теги (имя / атрибуты /
     * значения), сущности в тексте. Принимает сырой код, возвращает
     * безопасный HTML со span'ами rx-tok-*.
     */
    highlightHtml(code) {
        let out = '';
        let lastIndex = 0;
        const re = /<!--[\s\S]*?(?:-->|$)|<!DOCTYPE[^>]*>?|<\/?[a-zA-Z][^>]*(?:>|$)/gi;
        let m;
        while ((m = re.exec(code)) !== null) {
            out += this.highlightText(code.slice(lastIndex, m.index));
            const tok = m[0];
            if (tok.startsWith('<!--')) {
                out += `<span class="rx-tok-comment">${this.escapeToken(tok)}</span>`;
            } else if (/^<!doctype/i.test(tok)) {
                out += `<span class="rx-tok-punct">${this.escapeToken(tok)}</span>`;
            } else {
                out += this.highlightTag(tok);
            }
            lastIndex = m.index + tok.length;
        }
        out += this.highlightText(code.slice(lastIndex));
        return out;
    }

    /** Текст между тегами: подсвечиваем только HTML-сущности. */
    highlightText(raw) {
        if (!raw) return '';
        const escaped = this.escapeToken(raw);
        // После эскейпа исходное "&nbsp;" выглядит как "&amp;nbsp;"
        return escaped.replace(/&amp;(#?[a-zA-Z0-9]{1,32});/g,
            '<span class="rx-tok-entity">&amp;$1;</span>');
    }

    /** Один тег: <(/)имя атрибут="значение" ... (/)> */
    highlightTag(rawTag) {
        const m = rawTag.match(/^(<\/?)([a-zA-Z][\w:-]*)([\s\S]*?)(\/?>?)$/);
        if (!m) return this.escapeToken(rawTag);
        const [, open, name, attrs, close] = m;

        let out = `<span class="rx-tok-punct">${this.escapeToken(open)}</span>` +
            `<span class="rx-tok-tag">${this.escapeToken(name)}</span>`;

        // Атрибуты: имя(=значение)? — всё, что между ними (пробелы), как есть
        let i = 0;
        const attrRe = /([a-zA-Z_:@][\w:.-]*)(?:(\s*=\s*)("[^"]*"?|'[^']*'?|[^\s"'=<>`]+))?/g;
        let am;
        while ((am = attrRe.exec(attrs)) !== null) {
            out += this.escapeToken(attrs.slice(i, am.index));
            out += `<span class="rx-tok-attr">${this.escapeToken(am[1])}</span>`;
            if (am[2]) out += `<span class="rx-tok-punct">${this.escapeToken(am[2])}</span>`;
            if (am[3]) out += `<span class="rx-tok-value">${this.escapeToken(am[3])}</span>`;
            i = am.index + am[0].length;
        }
        out += this.escapeToken(attrs.slice(i));
        out += `<span class="rx-tok-punct">${this.escapeToken(close)}</span>`;
        return out;
    }

    // ---------- Hover-подсветка строки ----------

    showLineHighlight(lineIndex) {
        if (!this.lineHighlight || !Number.isFinite(lineIndex)) return;
        this.lineHighlight.style.top = `${this.PAD_TOP + lineIndex * this.LINE_HEIGHT}px`;
        this.lineHighlight.style.height = `${this.LINE_HEIGHT}px`;
        this.lineHighlight.style.display = 'block';
    }

    hideLineHighlight() {
        if (this.lineHighlight) this.lineHighlight.style.display = 'none';
    }

    handleKeydown(e) {
        // Tab - вставить отступ
        if (e.key === 'Tab') {
            e.preventDefault();
            const start = this.textarea.selectionStart;
            const end = this.textarea.selectionEnd;
            const value = this.textarea.value;
            
            if (e.shiftKey) {
                // Shift+Tab - убрать отступ
                const beforeCursor = value.substring(0, start);
                const lineStart = beforeCursor.lastIndexOf('\n') + 1;
                const lineIndent = value.substring(lineStart, start);
                
                if (lineIndent.startsWith('  ')) {
                    this.textarea.value = value.substring(0, lineStart) + value.substring(lineStart + 2);
                    this.textarea.selectionStart = this.textarea.selectionEnd = start - 2;
                }
            } else {
                // Tab - добавить отступ
                this.textarea.value = value.substring(0, start) + '  ' + value.substring(end);
                this.textarea.selectionStart = this.textarea.selectionEnd = start + 2;
            }

            this.redraw();
        }
        
        // Enter - сохранить отступ предыдущей строки
        if (e.key === 'Enter') {
            e.preventDefault();
            const start = this.textarea.selectionStart;
            const value = this.textarea.value;
            
            // Находим начало текущей строки
            const beforeCursor = value.substring(0, start);
            const lineStart = beforeCursor.lastIndexOf('\n') + 1;
            const currentLine = value.substring(lineStart, start);
            
            // Определяем отступ текущей строки
            const indentMatch = currentLine.match(/^(\s*)/);
            const indent = indentMatch ? indentMatch[1] : '';
            
            // Вставляем перенос с тем же отступом
            this.textarea.value = value.substring(0, start) + '\n' + indent + value.substring(start);
            this.textarea.selectionStart = this.textarea.selectionEnd = start + 1 + indent.length;

            this.redraw();
        }
    }

    disableToolbar(disable) {
        const buttons = this.instance.toolbar.element.querySelectorAll('button');
        buttons.forEach(btn => {
            // Не отключаем кнопки HTML и Fullscreen
            if (btn.dataset.command === 'html' || btn.dataset.command === 'fullscreen') return;
            
            btn.disabled = disable;
            btn.style.opacity = disable ? '0.5' : '1';
            btn.style.pointerEvents = disable ? 'none' : 'auto';
        });
    }

    // Минификация HTML с сохранением содержимого <pre>
    minifyHtmlPreservePre(html) {
        // Сохраняем и минифицируем содержимое <pre> тегов
        const prePlaceholders = [];
        
        // Заменяем pre вместе с окружающими пробелами
        let result = html.replace(/\s*<pre([^>]*)>([\s\S]*?)<\/pre>\s*/gi, (match, preAttrs, content) => {
            // Убираем форматирование внутри pre, но сохраняем контент кода
            let minifiedPre = '';
            
            // Проверяем есть ли code внутри
            const codeMatch = content.match(/^[\s\n]*<code([^>]*)>([\s\S]*)<\/code>[\s\n]*$/i);
            if (codeMatch) {
                const codeAttrs = codeMatch[1];
                let codeContent = codeMatch[2];
                
                // Убираем общий отступ форматирования
                const lines = codeContent.split('\n');
                
                // Убираем первую пустую строку если есть
                if (lines.length > 0 && lines[0].trim() === '') {
                    lines.shift();
                }
                // Убираем последнюю пустую строку если есть
                if (lines.length > 0 && lines[lines.length - 1].trim() === '') {
                    lines.pop();
                }
                
                // Находим минимальный отступ
                let minIndent = Infinity;
                lines.forEach(line => {
                    if (line.trim().length > 0) {
                        const indent = line.match(/^(\s*)/)[1].length;
                        if (indent < minIndent) {
                            minIndent = indent;
                        }
                    }
                });
                
                if (minIndent === Infinity) minIndent = 0;
                
                // Убираем общий отступ
                codeContent = lines.map(line => {
                    if (line.trim().length === 0) return '';
                    return line.substring(minIndent);
                }).join('\n');
                
                minifiedPre = `<pre${preAttrs}><code${codeAttrs}>${codeContent}</code></pre>`;
            } else {
                minifiedPre = `<pre${preAttrs}>${content.trim()}</pre>`;
            }
            
            prePlaceholders.push(minifiedPre);
            return `__PRE_PLACEHOLDER_${prePlaceholders.length - 1}__`;
        });
        
        // Убираем переносы строк и пробелы между тегами
        result = result.replace(/>\s+</g, '><');
        
        // Восстанавливаем <pre> теги
        prePlaceholders.forEach((pre, index) => {
            result = result.replace(`__PRE_PLACEHOLDER_${index}__`, pre);
        });
        
        return result;
    }

    // Простой Beautifier
    beautifyHtml(html) {
        // Убираем contenteditable из всех тегов
        let cleanedHtml = html.replace(/\s+contenteditable=["'][^"']*["']/gi, '');
        
        // Сохраняем содержимое <pre> тегов
        const prePlaceholders = [];
        let processedHtml = cleanedHtml.replace(/<pre[^>]*>[\s\S]*?<\/pre>/gi, (match) => {
            let formatted = match.replace(/<pre([^>]*)>/, '<pre$1>');
            prePlaceholders.push(formatted);
            return `__PRE_PLACEHOLDER_${prePlaceholders.length - 1}__`;
        });
        
        // Заменяем переносы и множественные пробелы на один пробел
        processedHtml = processedHtml.replace(/\s+/g, ' ').trim();
        
        let formatted = '';
        let indent = 0;
        const pad = '  '; 
        
        const placeholderIndents = {};
        
        const blockTags = [
            'address', 'article', 'aside', 'blockquote', 'canvas', 'dd', 'div', 'dl', 'dt', 
            'fieldset', 'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 
            'header', 'hr', 'li', 'main', 'nav', 'noscript', 'ol', 'p', 'pre', 'section', 
            'table', 'tfoot', 'tbody', 'thead', 'tr', 'td', 'th', 'ul', 'video', 'iframe'
        ];
        
        const voidTags = [
            'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'
        ];

        const tokens = processedHtml.split(/(<[^>]+>)/g);
        let isPrevInline = false;

        tokens.forEach(token => {
            if (token.length === 0) return;
            
            const placeholderMatch = token.match(/__PRE_PLACEHOLDER_(\d+)__/);
            if (placeholderMatch) {
                placeholderIndents[placeholderMatch[1]] = indent;
                formatted += '\n' + pad.repeat(indent) + token;
                isPrevInline = false;
                return;
            }

            let isBlock = false;
            let isClosing = false;
            let tagName = '';
            
            if (token.match(/^<\//)) {
                isClosing = true;
                tagName = token.replace(/[<\/>]/g, '').toLowerCase();
                isBlock = blockTags.includes(tagName);
            } else if (token.match(/^<[^\/]/)) {
                tagName = token.replace(/[<>]/g, '').split(' ')[0].toLowerCase();
                isBlock = blockTags.includes(tagName);
            }

            if (isBlock) {
                if (isClosing) {
                    indent--;
                    if (indent < 0) indent = 0;
                    
                    if (!isPrevInline) {
                        formatted += '\n' + pad.repeat(indent);
                    }
                    formatted += token.trim();
                    isPrevInline = false;
                } else {
                    if (formatted.length > 0) {
                         formatted += '\n' + pad.repeat(indent);
                    }
                    formatted += token.trim();
                    
                    if (!voidTags.includes(tagName)) {
                        indent++;
                    }
                    isPrevInline = false;
                }
            } else {
                if (token.trim().length === 0) {
                    if (isPrevInline) {
                        formatted += token;
                    }
                } else {
                    formatted += token;
                    isPrevInline = true;
                }
            }
        });

        // Восстанавливаем <pre> теги с форматированием
        prePlaceholders.forEach((pre, index) => {
            const indentLevel = placeholderIndents[index] || 0;
            const preIndent = pad.repeat(indentLevel);
            const codeIndent = pad.repeat(indentLevel + 1);
            const contentIndent = pad.repeat(indentLevel + 2);
            
            let formattedPre = pre;
            
            const codeMatch = formattedPre.match(/<pre([^>]*)><code([^>]*)>([\s\S]*)<\/code><\/pre>/);
            if (codeMatch) {
                const preAttrs = codeMatch[1];
                const codeAttrs = codeMatch[2];
                let content = codeMatch[3];
                
                const lines = content.split('\n');
                const indentedContent = lines.map(line => contentIndent + line).join('\n');
                
                formattedPre = `<pre${preAttrs}>\n${codeIndent}<code${codeAttrs}>\n${indentedContent}\n${codeIndent}</code>\n${preIndent}</pre>`;
            }
            
            formatted = formatted.replace(`__PRE_PLACEHOLDER_${index}__`, formattedPre);
        });

        return formatted.trim();
    }
}
