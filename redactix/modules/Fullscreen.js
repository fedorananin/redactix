import Module from '../core/Module.js';
import Icons from '../ui/Icons.js';

export default class Fullscreen extends Module {
    constructor(instance) {
        super(instance);
        this.isFullscreen = false;
        this.originalMaxHeight = null;

        // If the instance is destroyed in fullscreen mode — remove
        // the Escape listener and class from <body>, otherwise the page will
        // remain "locked" under fullscreen.
        if (instance.onDestroy) {
            instance.onDestroy(() => {
                if (this.escHandler) {
                    document.removeEventListener('keydown', this.escHandler);
                    this.escHandler = null;
                }
                if (this.isFullscreen) {
                    document.body.classList.remove('redactix-fullscreen-active');
                }
            });
        }
    }

    getButtons() {
        // In lite mode, do not show the fullscreen mode button
        if (this.instance.config.liteMode) {
            return [];
        }
        
        return [
            {
                name: 'fullscreen',
                icon: Icons.fullscreen,
                title: this.t('toolbar.fullscreen'),
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
            // Enable fullscreen mode
            wrapper.classList.add('redactix-fullscreen');
            document.body.classList.add('redactix-fullscreen-active');
            
            // Save original maxHeight and reset it
            this.originalMaxHeight = editor.style.maxHeight;
            editor.style.maxHeight = '';
            
            // Reset sticky state of toolbar (if present)
            if (this.instance.toolbar.updateStickyState) {
                this.instance.toolbar.updateStickyState();
            }
            
            if (btn) {
                btn.classList.add('active');
                btn.innerHTML = Icons.fullscreenExit;
            }
            
            // Listen for Escape to exit
            this.escHandler = (e) => {
                if (e.key === 'Escape') {
                    this.toggleFullscreen();
                }
            };
            document.addEventListener('keydown', this.escHandler);
        } else {
            // Disable fullscreen mode
            wrapper.classList.remove('redactix-fullscreen');
            document.body.classList.remove('redactix-fullscreen-active');
            
            // Restore original maxHeight
            if (this.originalMaxHeight) {
                editor.style.maxHeight = this.originalMaxHeight;
            }
            
            // Restore sticky state of toolbar (if it was active)
            if (this.instance.toolbar.updateStickyState) {
                setTimeout(() => this.instance.toolbar.updateStickyState(), 0);
            }
            
            if (btn) {
                btn.classList.remove('active');
                btn.innerHTML = Icons.fullscreen;
            }
            
            // Remove Escape listener
            if (this.escHandler) {
                document.removeEventListener('keydown', this.escHandler);
                this.escHandler = null;
            }
        }
    }
}
