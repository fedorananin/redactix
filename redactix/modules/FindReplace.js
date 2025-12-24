import Module from '../core/Module.js';
import Icons from '../ui/Icons.js';

export default class FindReplace extends Module {
    constructor(instance) {
        super(instance);
        this.panel = null;
        this.isOpen = false;
        this.currentMatches = [];
        this.currentIndex = -1;
        this.originalContents = null;
    }

    init() {
        // В lite mode полностью отключаем поиск и замену
        if (this.instance.config.liteMode) {
            return;
        }
        
        // Ctrl+F / Ctrl+H для открытия поиска и замены
        // Используем e.code для корректной работы с любой раскладкой
        document.addEventListener('keydown', (e) => {
            // Ctrl+F или Ctrl+H (работает на любой раскладке)
            if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyF' || e.code === 'KeyH')) {
                // Проверяем что фокус в нашем редакторе
                if (this.instance.wrapper.contains(document.activeElement) || 
                    this.instance.editorEl.contains(document.activeElement)) {
                    e.preventDefault();
                    this.open();
                }
            }
            // Escape для закрытия
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });
    }

    getButtons() {
        // В lite mode не показываем кнопку поиска
        if (this.instance.config.liteMode) {
            return [];
        }
        
        return [
            {
                name: 'find',
                icon: Icons.search,
                title: this.t('toolbar.findReplace'),
                action: () => this.open()
            }
        ];
    }

    open() {
        if (this.isOpen) {
            // Если уже открыто, фокусируемся на поле поиска
            const searchInput = this.panel.querySelector('.redactix-find-input');
            if (searchInput) {
                searchInput.focus();
                searchInput.select();
            }
            return;
        }

        this.isOpen = true;
        this.createPanel();
        this.instance.wrapper.appendChild(this.panel);

        const searchInput = this.panel.querySelector('.redactix-find-input');
        searchInput.focus();

        // Если есть выделенный текст, вставляем его в поле поиска
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const selectedText = selection.toString().trim();
            if (selectedText && selectedText.length < 100) {
                searchInput.value = selectedText;
                this.search(selectedText);
            }
        }
    }

    close() {
        this.clearHighlights();
        if (this.panel && this.panel.parentNode) {
            this.panel.parentNode.removeChild(this.panel);
        }
        this.panel = null;
        this.isOpen = false;
        this.currentMatches = [];
        this.currentIndex = -1;
        
        // Возвращаем фокус в редактор
        this.instance.editorEl.focus();
    }

    createPanel() {
        this.panel = document.createElement('div');
        this.panel.className = 'redactix-find-panel';
        
this.panel.innerHTML = `
            <div class="redactix-find-row">
                <input type="text" class="redactix-find-input" placeholder="${this.t('findReplace.findPlaceholder')}">
                <span class="redactix-find-count"></span>
                <button type="button" class="redactix-find-btn" data-action="prev" title="${this.t('findReplace.previousTooltip')}">
                    ${Icons.chevronUp}
                </button>
                <button type="button" class="redactix-find-btn" data-action="next" title="${this.t('findReplace.nextTooltip')}">
                    ${Icons.chevronDown}
                </button>
                <button type="button" class="redactix-find-btn" data-action="close" title="${this.t('findReplace.closeTooltip')}">
                    ${Icons.close}
                </button>
            </div>
            <div class="redactix-replace-row">
                <input type="text" class="redactix-replace-input" placeholder="${this.t('findReplace.replacePlaceholder')}">
                <button type="button" class="redactix-find-btn redactix-replace-btn" data-action="replace" title="${this.t('findReplace.replace')}">
                    ${this.t('findReplace.replace')}
                </button>
                <button type="button" class="redactix-find-btn redactix-replace-btn" data-action="replaceAll" title="${this.t('findReplace.replaceAll')}">
                    ${this.t('findReplace.replaceAll')}
                </button>
            </div>
        `;

        // Обработчики
        const searchInput = this.panel.querySelector('.redactix-find-input');
        const replaceInput = this.panel.querySelector('.redactix-replace-input');

        searchInput.addEventListener('input', (e) => {
            this.search(e.target.value);
        });

        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (e.shiftKey) {
                    this.goToPrev();
                } else {
                    this.goToNext();
                }
            }
            if (e.key === 'Tab' && !e.shiftKey) {
                e.preventDefault();
                replaceInput.focus();
            }
        });

        replaceInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (e.shiftKey) {
                    this.replaceAll();
                } else {
                    this.replaceCurrent();
                }
            }
        });

        // Кнопки
        this.panel.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;

            const action = btn.dataset.action;
            switch (action) {
                case 'prev':
                    this.goToPrev();
                    break;
                case 'next':
                    this.goToNext();
                    break;
                case 'close':
                    this.close();
                    break;
                case 'replace':
                    this.replaceCurrent();
                    break;
                case 'replaceAll':
                    this.replaceAll();
                    break;
            }
        });
    }

    search(query) {
        this.clearHighlights();
        this.currentMatches = [];
        this.currentIndex = -1;

        if (!query || query.length === 0) {
            this.updateCount();
            return;
        }

        // Поиск текстовых узлов
        const walker = document.createTreeWalker(
            this.instance.editorEl,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );

        const textNodes = [];
        let node;
        while (node = walker.nextNode()) {
            // Пропускаем пустые узлы и узлы внутри скрытых элементов
            if (node.textContent.trim() && node.parentElement.offsetParent !== null) {
                textNodes.push(node);
            }
        }

        const lowerQuery = query.toLowerCase();

        textNodes.forEach(textNode => {
            const text = textNode.textContent;
            const lowerText = text.toLowerCase();
            let startIndex = 0;
            let index;

            while ((index = lowerText.indexOf(lowerQuery, startIndex)) !== -1) {
                this.currentMatches.push({
                    node: textNode,
                    index: index,
                    length: query.length
                });
                startIndex = index + 1;
            }
        });

        this.highlightAll();
        this.updateCount();

        if (this.currentMatches.length > 0) {
            this.currentIndex = 0;
            this.highlightCurrent();
        }
    }

    highlightAll() {
        // Подсвечиваем все совпадения
        // Идём с конца, чтобы не сбивать индексы
        const matchesByNode = new Map();
        
        this.currentMatches.forEach(match => {
            if (!matchesByNode.has(match.node)) {
                matchesByNode.set(match.node, []);
            }
            matchesByNode.get(match.node).push(match);
        });

        matchesByNode.forEach((matches, textNode) => {
            // Сортируем по индексу в обратном порядке
            matches.sort((a, b) => b.index - a.index);
            
            let text = textNode.textContent;
            const parent = textNode.parentNode;
            
            // Создаём фрагмент с подсвеченными совпадениями
            const fragment = document.createDocumentFragment();
            let lastIndex = text.length;
            
            matches.forEach((match, i) => {
                // Текст после совпадения
                if (match.index + match.length < lastIndex) {
                    fragment.insertBefore(
                        document.createTextNode(text.substring(match.index + match.length, lastIndex)),
                        fragment.firstChild
                    );
                }
                
                // Само совпадение
                const mark = document.createElement('mark');
                mark.className = 'redactix-find-highlight';
                mark.textContent = text.substring(match.index, match.index + match.length);
                mark.dataset.matchIndex = this.currentMatches.indexOf(match);
                fragment.insertBefore(mark, fragment.firstChild);
                
                lastIndex = match.index;
            });
            
            // Текст до первого совпадения
            if (lastIndex > 0) {
                fragment.insertBefore(
                    document.createTextNode(text.substring(0, lastIndex)),
                    fragment.firstChild
                );
            }
            
            parent.replaceChild(fragment, textNode);
        });

        // Обновляем ссылки на mark элементы
        const marks = this.instance.editorEl.querySelectorAll('.redactix-find-highlight');
        this.currentMatches = Array.from(marks).map((mark, i) => ({
            element: mark,
            index: i
        }));
    }

    clearHighlights() {
        const marks = this.instance.editorEl.querySelectorAll('.redactix-find-highlight');
        marks.forEach(mark => {
            const parent = mark.parentNode;
            const text = document.createTextNode(mark.textContent);
            parent.replaceChild(text, mark);
            // Нормализуем соседние текстовые узлы
            parent.normalize();
        });
    }

    highlightCurrent() {
        // Убираем предыдущую текущую подсветку
        const prevCurrent = this.instance.editorEl.querySelector('.redactix-find-current');
        if (prevCurrent) {
            prevCurrent.classList.remove('redactix-find-current');
        }

        if (this.currentIndex >= 0 && this.currentIndex < this.currentMatches.length) {
            const match = this.currentMatches[this.currentIndex];
            if (match.element) {
                match.element.classList.add('redactix-find-current');
                match.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }

        this.updateCount();
    }

    goToNext() {
        if (this.currentMatches.length === 0) return;
        this.currentIndex = (this.currentIndex + 1) % this.currentMatches.length;
        this.highlightCurrent();
    }

    goToPrev() {
        if (this.currentMatches.length === 0) return;
        this.currentIndex = (this.currentIndex - 1 + this.currentMatches.length) % this.currentMatches.length;
        this.highlightCurrent();
    }

    updateCount() {
        const countEl = this.panel?.querySelector('.redactix-find-count');
        if (!countEl) return;

if (this.currentMatches.length === 0) {
            const searchInput = this.panel.querySelector('.redactix-find-input');
            if (searchInput.value) {
                countEl.textContent = this.t('findReplace.noResults');
                countEl.classList.add('not-found');
            } else {
                countEl.textContent = '';
                countEl.classList.remove('not-found');
            }
        } else {
            countEl.textContent = `${this.currentIndex + 1} ${this.t('findReplace.ofCount')} ${this.currentMatches.length}`;
            countEl.classList.remove('not-found');
        }
    }

    replaceCurrent() {
        if (this.currentIndex < 0 || this.currentIndex >= this.currentMatches.length) return;

        const replaceInput = this.panel.querySelector('.redactix-replace-input');
        const replaceText = replaceInput.value;
        
        const match = this.currentMatches[this.currentIndex];
        if (match.element) {
            const text = document.createTextNode(replaceText);
            match.element.parentNode.replaceChild(text, match.element);
            text.parentNode.normalize();
        }

        // Перезапускаем поиск
        const searchInput = this.panel.querySelector('.redactix-find-input');
        this.search(searchInput.value);
        
        this.instance.sync();
    }

    replaceAll() {
        if (this.currentMatches.length === 0) return;

        const replaceInput = this.panel.querySelector('.redactix-replace-input');
        const replaceText = replaceInput.value;

        // Заменяем все с конца
        for (let i = this.currentMatches.length - 1; i >= 0; i--) {
            const match = this.currentMatches[i];
            if (match.element) {
                const text = document.createTextNode(replaceText);
                match.element.parentNode.replaceChild(text, match.element);
                text.parentNode.normalize();
            }
        }

        // Перезапускаем поиск
        const searchInput = this.panel.querySelector('.redactix-find-input');
        this.search(searchInput.value);
        
        this.instance.sync();
    }
}
