import Module from '../core/Module.js';
import Icons from '../ui/Icons.js';

export default class Fullscreen extends Module {
    constructor(instance) {
        super(instance);
        this.isFullscreen = false;
        this.originalMaxHeight = null;
    }

    getButtons() {
        // В lite mode не показываем кнопку полноэкранного режима
        if (this.instance.config.liteMode) {
            return [];
        }
        
        return [
            {
                name: 'fullscreen',
                icon: Icons.fullscreen,
                title: 'Fullscreen Mode',
                action: () => this.toggleFullscreen()
            }
        ];
    }

    toggleFullscreen() {
        this.isFullscreen = !this.isFullscreen;
        const wrapper = this.instance.wrapper;
        const editor = this.instance.editorEl;
        const btn = this.instance.toolbar.buttons.get('fullscreen');

        if (this.isFullscreen) {
            // Включаем полноэкранный режим
            wrapper.classList.add('redactix-fullscreen');
            document.body.classList.add('redactix-fullscreen-active');
            
            // Сохраняем оригинальный maxHeight и сбрасываем его
            this.originalMaxHeight = editor.style.maxHeight;
            editor.style.maxHeight = '';
            
            // Сбрасываем sticky состояние toolbar (если есть)
            if (this.instance.toolbar.updateStickyState) {
                this.instance.toolbar.updateStickyState();
            }
            
            if (btn) {
                btn.classList.add('active');
                btn.innerHTML = Icons.fullscreenExit;
            }
            
            // Слушаем Escape для выхода
            this.escHandler = (e) => {
                if (e.key === 'Escape') {
                    this.toggleFullscreen();
                }
            };
            document.addEventListener('keydown', this.escHandler);
        } else {
            // Выключаем полноэкранный режим
            wrapper.classList.remove('redactix-fullscreen');
            document.body.classList.remove('redactix-fullscreen-active');
            
            // Восстанавливаем оригинальный maxHeight
            if (this.originalMaxHeight) {
                editor.style.maxHeight = this.originalMaxHeight;
            }
            
            // Восстанавливаем sticky состояние toolbar (если было)
            if (this.instance.toolbar.updateStickyState) {
                setTimeout(() => this.instance.toolbar.updateStickyState(), 0);
            }
            
            if (btn) {
                btn.classList.remove('active');
                btn.innerHTML = Icons.fullscreen;
            }
            
            // Убираем слушатель Escape
            if (this.escHandler) {
                document.removeEventListener('keydown', this.escHandler);
                this.escHandler = null;
            }
        }
    }
}
