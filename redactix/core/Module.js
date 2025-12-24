export default class Module {
    constructor(instance) {
        this.instance = instance;
        this.editor = instance.core;
        this.name = this.constructor.name;
    }

    /**
     * Инициализация модуля.
     * Здесь можно вешать слушатели событий или модифицировать DOM.
     */
    init() {
        console.log(`Module ${this.name} initialized`);
    }

    /**
     * Должен вернуть массив кнопок для тулбара, если модулю нужны кнопки.
     * @returns {Array} [{ label: 'B', icon: '...', action: func, active: bool }]
     */
    getButtons() {
        return [];
    }
    
    /**
     * Shorthand for getting translations
     * @param {string} key - Translation key (e.g., 'toolbar.bold')
     * @param {object} params - Optional interpolation params
     * @returns {string}
     */
    t(key, params = {}) {
        return this.instance.t(key, params);
    }
}
