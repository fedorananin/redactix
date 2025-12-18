import Editor from './core/Editor.js';
import Toolbar from './ui/Toolbar.js';
import Selection from './core/Selection.js';
import Modal from './ui/Modal.js';

// Импорт модулей (в будущем можно сделать динамическим конфигом)
import BaseStyles from './modules/BaseStyles.js';
import BlockStyles from './modules/BlockStyles.js';
import List from './modules/List.js';
import Link from './modules/Link.js';
import Image from './modules/Image.js';
import Table from './modules/Table.js';
import Youtube from './modules/Youtube.js';
import Separator from './modules/Separator.js';
import Code from './modules/Code.js';
import Markdown from './modules/Markdown.js';
import HtmlMode from './modules/HtmlMode.js';
import Fullscreen from './modules/Fullscreen.js';
import FindReplace from './modules/FindReplace.js';
import Attributes from './modules/Attributes.js';
import BlockControl from './modules/BlockControl.js';
import FloatingToolbar from './modules/FloatingToolbar.js';
import History from './modules/History.js';
import SlashCommands from './modules/SlashCommands.js';

export default class Redactix {
    constructor(options = {}) {
        this.selector = options.selector || '.redactix';
        // Конфиг для модулей (например, список классов)
        this.predefinedClasses = options.classes || ['red', 'blue', 'large-text', 'hidden-mobile'];
        
        // Пользовательские пресеты для callout и цитат
        // Формат: [{ name: 'custom', label: 'Мой стиль', class: 'custom-class' }]
        this.calloutPresets = options.calloutPresets || [];
        this.quotePresets = options.quotePresets || [];
        
        // URL для загрузки изображений (если указан - включается drag&drop, paste и upload)
        this.uploadUrl = options.uploadUrl || null;
        
        // URL для просмотра загруженных изображений
        this.browseUrl = options.browseUrl || null;
        
        // Разрешить удаление изображений через браузер
        this.allowImageDelete = options.allowImageDelete || false;
        
        // Максимальная высота редактора (например: '500px', '50vh')
        this.maxHeight = options.maxHeight || null;
        
        // Классы для quick select в атрибутах (если не указано - блок не отображается)
        this.predefinedClasses = options.classes || null;
        
        // Lite mode - упрощённый редактор для комментариев
        // Отключает: fullscreen, html mode, find/replace, атрибуты, загрузку фото, расширенные настройки
        this.liteMode = options.liteMode || false;
        
        // Theme: 'light' (default), 'dark', or 'auto' (follows system preference)
        this.theme = options.theme || 'light';
        
        this.elements = document.querySelectorAll(this.selector);
        this.instances = [];
        // Список классов модулей для подключения
        this.modulesConfig = [History, BaseStyles, BlockStyles, List, Link, Image, Table, Youtube, Separator, Code, Markdown, FindReplace, HtmlMode, Fullscreen, Attributes, BlockControl, FloatingToolbar, SlashCommands];

        this.init();
    }

    init() {
        if (this.elements.length === 0) {
            console.warn('Redactix: No elements found for selector', this.selector);
            return;
        }

        this.elements.forEach(el => {
            // Пропускаем, если уже инициализирован
            if (el.dataset.redactixInit) return;
            
            // Формируем конфиг для инстанса
            const instanceConfig = {
                modulesConfig: this.modulesConfig,
                predefinedClasses: this.predefinedClasses,
                calloutPresets: this.calloutPresets,
                quotePresets: this.quotePresets,
                uploadUrl: this.liteMode ? null : this.uploadUrl, // В lite mode отключаем загрузку
                browseUrl: this.liteMode ? null : this.browseUrl, // В lite mode отключаем галерею
                allowImageDelete: this.allowImageDelete,
                maxHeight: this.maxHeight,
                liteMode: this.liteMode,
                theme: this.theme
            };

            // Передаем this (экземпляр Redactix с конфигами)
            const instance = new RedactixInstance(el, instanceConfig);
            this.instances.push(instance);
            el.dataset.redactixInit = "true";
            
            // Сохраняем ссылку на инстанс в textarea для внешнего доступа
            el.redactix = instance;
        });
    }
}

class RedactixInstance {
    constructor(textarea, config) {
        this.textarea = textarea;
        this.config = config; // Сохраняем весь конфиг
        this.wrapper = null;
        this.editorEl = null;
        
        // Core components
        this.toolbar = null;
        this.core = null;
        this.modules = [];
        this.selection = null;
        this.modal = null;

        this.render();
    }

render() {
        // 1. Создаем обертку
        this.wrapper = document.createElement('div');
        this.wrapper.className = 'redactix-wrapper';
        
        // Добавляем класс для lite mode
        if (this.config.liteMode) {
            this.wrapper.classList.add('redactix-lite-mode');
        }
        
        // Добавляем класс темы
        if (this.config.theme === 'dark') {
            this.wrapper.classList.add('redactix-dark');
        } else if (this.config.theme === 'auto') {
            this.wrapper.classList.add('redactix-auto');
        }

        // 2. Вставляем обертку перед textarea
        this.textarea.parentNode.insertBefore(this.wrapper, this.textarea);

        // 3. Создаем тулбар
        this.toolbar = new Toolbar(this);
        this.wrapper.appendChild(this.toolbar.getElement());

        // 4. Создаем область редактирования
        this.editorEl = document.createElement('div');
        this.editorEl.className = 'redactix-editor';
        this.editorEl.contentEditable = true;
        
        // Применяем максимальную высоту если указана
        if (this.config.maxHeight) {
            this.editorEl.style.maxHeight = this.config.maxHeight;
            this.editorEl.style.overflowY = 'auto';
            this.wrapper.classList.add('redactix-has-max-height');
        }
        
        // Чистим исходный HTML от лишних пробелов и переносов строк между тегами
        // Это уберет отступы кода, но сохранит контент
        const cleanHtml = this.textarea.value
            .replace(/>\s+</g, '><') // Убираем пробелы между тегами
            .trim();
            
        this.editorEl.innerHTML = cleanHtml;

        // Пост-обработка: оборачиваем hr, настраиваем figure и code blocks
        this.wrapSeparators();
        this.setupFigures();
        this.setupCodeBlocks();

        this.wrapper.appendChild(this.editorEl);

        // 5. Создаём счётчик символов/слов (не в lite mode)
        if (!this.config.liteMode) {
            this.createCounter();
        }

        // 6. Прячем textarea
        this.textarea.style.display = 'none';

        // 7. Инициализируем ядро
        this.core = new Editor(this);
        this.selection = new Selection(this.core);
        this.modal = new Modal(this.wrapper);

        // 8. Инициализируем модули
        this.initModules();
        
        // 9. Обновляем счётчик (не в lite mode)
        if (!this.config.liteMode) {
            this.updateCounter();
        }
    }

    createCounter() {
        this.counter = document.createElement('div');
        this.counter.className = 'redactix-counter';
        this.wrapper.appendChild(this.counter);
    }

    updateCounter() {
        // В lite mode счётчик не создаётся
        if (!this.counter) return;
        
        // Получаем текст для подсчёта (без HTML-тегов, но с figcaption)
        const clone = this.editorEl.cloneNode(true);
        
        // Удаляем alt и title атрибуты из изображений, ссылок и фреймов чтобы не считать их
        clone.querySelectorAll('img, a, iframe').forEach(el => {
            el.removeAttribute('alt');
            el.removeAttribute('title');
        });
        
        const text = clone.innerText || '';
        
        // Подсчёт символов (без пробелов в начале/конце)
        const chars = text.trim().length;
        // Подсчёт слов
        const words = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;

        this.counter.textContent = `${chars} chars | ${words} words`;
    }

    initModules() {
        this.config.modulesConfig.forEach(ModuleClass => {
            const moduleInstance = new ModuleClass(this);
            moduleInstance.init();
            this.modules.push(moduleInstance);
        });

        // После инициализации всех модулей, просим тулбар отрисовать кнопки
        this.toolbar.addButtonsFromModules(this.modules);
    }

    // Получить чистый HTML контент (без служебных обёрток)
    getContent() {
        this.sync();
        return this.textarea.value;
    }

    // Установить HTML контент в редактор
    setContent(html) {
        // Чистим HTML от лишних пробелов между тегами
        const cleanHtml = html.replace(/>\s+</g, '><').trim();
        
        // Устанавливаем в визуальный редактор
        this.editorEl.innerHTML = cleanHtml;
        
        // Пост-обработка как при инициализации
        this.wrapSeparators();
        this.setupFigures();
        this.setupCodeBlocks();
        
        // Синхронизируем с textarea
        this.sync();
        
        // Уведомляем модуль истории о новом контенте (сброс истории)
        const historyModule = this.modules.find(m => m.constructor.name === 'History');
        if (historyModule && historyModule.reset) {
            historyModule.reset();
        }
    }

    // Метод для обновления оригинальной textarea
    sync() {
        // Создаем клон для очистки служебных элементов перед сохранением
        const clone = this.editorEl.cloneNode(true);
        
        // Убираем обертки сепараторов
        clone.querySelectorAll('.redactix-separator').forEach(wrapper => {
            const hr = wrapper.querySelector('hr');
            if (hr) {
                // Убираем служебный атрибут contenteditable (если он есть в HTML)
                hr.removeAttribute('contenteditable');
                wrapper.parentNode.replaceChild(hr, wrapper);
            } else {
                // Если внутри пусто, просто удаляем обертку
                wrapper.remove();
            }
        });
        
        // Убираем contenteditable у figure и figcaption
        clone.querySelectorAll('figure').forEach(figure => {
            figure.removeAttribute('contenteditable');
            const figcaption = figure.querySelector('figcaption');
            if (figcaption) {
                figcaption.removeAttribute('contenteditable');
                // Убираем пустые figcaption (только <br> или пустые)
                const innerHtml = figcaption.innerHTML.replace(/<br\s*\/?>/gi, '').trim();
                if (!innerHtml && !figcaption.querySelector('img, iframe')) {
                    figcaption.remove();
                }
            }
        });
        
        // Убираем служебные атрибуты contenteditable у всех элементов
        clone.querySelectorAll('[contenteditable]').forEach(el => {
            el.removeAttribute('contenteditable');
        });
        
        // Убираем contenteditable у pre
        clone.querySelectorAll('pre').forEach(pre => {
            pre.removeAttribute('contenteditable');
        });
        
        // Убираем подсветку поиска
        clone.querySelectorAll('.redactix-find-highlight').forEach(mark => {
            const text = document.createTextNode(mark.textContent);
            mark.parentNode.replaceChild(text, mark);
        });
        clone.normalize();
        
        // Получаем чистый HTML
        let html = clone.innerHTML;
        
        // Убираем лишние пробелы между тегами (сжимаем)
        // html = html.replace(/>\s+</g, '><').trim(); 
        // Примечание: выше строка может быть опасной для pre тегов, 
        // пока оставим как есть или используем более аккуратную очистку.
        // Оставим просто копирование innerHTML, но без оберток.
        
        this.textarea.value = html;
        
        // Триггерим событие change на textarea, чтобы внешние скрипты знали об изменении
        this.textarea.dispatchEvent(new Event('change', { bubbles: true }));
        this.textarea.dispatchEvent(new Event('input', { bubbles: true }));
        
        // Обновляем счётчик
        this.updateCounter();
    }

    wrapSeparators() {
        this.editorEl.querySelectorAll('hr').forEach(hr => {
             if (hr.parentNode.classList.contains('redactix-separator')) return;
             
             const wrapper = document.createElement('div');
             wrapper.className = 'redactix-separator';
             wrapper.contentEditable = false;
             wrapper.innerHTML = ''; // Очистим, если вдруг что-то попало
             
             hr.parentNode.replaceChild(wrapper, hr);
             wrapper.appendChild(hr);
        });
    }

    setupFigures() {
        // Настраиваем contenteditable для figure и figcaption
        this.editorEl.querySelectorAll('figure').forEach(figure => {
            // Пропускаем video wrapper
            if (figure.classList.contains('redactix-video-wrapper')) return;
            
            figure.contentEditable = 'false';
            
            let figcaption = figure.querySelector('figcaption');
            if (!figcaption) {
                // Создаём пустой figcaption для возможности ввода
                figcaption = document.createElement('figcaption');
                figcaption.innerHTML = '<br>';
                figure.appendChild(figcaption);
            }
            figcaption.contentEditable = 'true';
        });
    }

    setupCodeBlocks() {
        // Настраиваем contenteditable для блоков кода
        this.editorEl.querySelectorAll('pre').forEach(pre => {
            pre.contentEditable = 'false';
        });
    }
}
