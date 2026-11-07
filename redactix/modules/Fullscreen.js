import Module from '../core/Module.js';
import Icons from '../ui/Icons.js';
import { pushEscapeLayer } from '../core/layers.js';

// Page-scroll lock shared by every editor on the page. With two editors in
// fullscreen, whichever exited first used to unlock the page under the other
// one — now the lock is released only when the last one leaves.
let scrollLockCount = 0;

function lockPageScroll() {
    scrollLockCount += 1;
    if (scrollLockCount === 1) {
        document.body.classList.add('redactix-fullscreen-active');
    }
}

function unlockPageScroll() {
    if (scrollLockCount === 0) return;
    scrollLockCount -= 1;
    if (scrollLockCount === 0) {
        document.body.classList.remove('redactix-fullscreen-active');
    }
}

export default class Fullscreen extends Module {
    static moduleName = 'Fullscreen';

    constructor(instance) {
        super(instance);
        this.isFullscreen = false;
        this.originalMaxHeight = null;
        this.popEscape = null;
    }

    init() {
        // If the instance is destroyed in fullscreen mode, release the
        // Escape layer and the page scroll lock — otherwise the page stays
        // "locked" under a fullscreen editor that no longer exists.
        this.instance.onDestroy(() => {
            if (this.isFullscreen) this.exit();
        });
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
        if (this.isFullscreen) this.exit();
        else this.enter();
    }

    enter() {
        if (this.isFullscreen) return;
        this.isFullscreen = true;
        const wrapper = this.instance.wrapper;
        const editor = this.instance.editorEl;

        wrapper.classList.add('redactix-fullscreen');
        lockPageScroll();

        // Save original maxHeight and reset it
        this.originalMaxHeight = editor.style.maxHeight;
        editor.style.maxHeight = '';

        // Reset sticky state of toolbar (if present)
        if (this.instance.toolbar.updateStickyState) {
            this.instance.toolbar.updateStickyState();
        }

        this.updateButton();

        // Escape exits — through the shared layer stack, so a modal / menu
        // opened on top of the fullscreen editor closes first.
        this.popEscape = pushEscapeLayer(() => this.exit());
    }

    exit() {
        if (!this.isFullscreen) return;
        this.isFullscreen = false;
        const wrapper = this.instance.wrapper;
        const editor = this.instance.editorEl;

        wrapper.classList.remove('redactix-fullscreen');
        unlockPageScroll();

        // Restore original maxHeight (also when it was empty)
        if (this.originalMaxHeight != null) {
            editor.style.maxHeight = this.originalMaxHeight;
        }
        this.originalMaxHeight = null;

        if (this.popEscape) {
            this.popEscape();
            this.popEscape = null;
        }

        if (this.instance.destroyed) return;

        // Restore sticky state of toolbar (if it was active)
        if (this.instance.toolbar.updateStickyState) {
            setTimeout(() => {
                if (!this.instance.destroyed) this.instance.toolbar.updateStickyState();
            }, 0);
        }

        this.updateButton();
    }

    updateButton() {
        const btn = this.instance.toolbar.buttons.get('fullscreen');
        if (!btn) return;
        btn.classList.toggle('active', this.isFullscreen);
        btn.innerHTML = this.isFullscreen ? Icons.fullscreenExit : Icons.fullscreen;
    }
}
