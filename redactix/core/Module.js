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
}
