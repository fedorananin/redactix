import Module from '../core/Module.js';
import HandleLayer from './block-control/HandleLayer.js';
import BlockMenu from './block-control/BlockMenu.js';
import BlockCommands from './block-control/BlockCommands.js';
import DragController from './block-control/DragController.js';
import { resolveHover, probeRow } from './block-control/BlockResolver.js';

/**
 * Block handles, block menu and block drag & drop.
 *
 * This class only wires the pieces together:
 *   block-control/BlockResolver   — pointer / element → block, drop target
 *   block-control/HandleLayer     — the three handles and their placement
 *   block-control/BlockMenu       — the context menu
 *   block-control/BlockCommands   — delete / duplicate / transform … (undoable)
 *   block-control/DragController  — pointer-events drag & drop
 *
 * Public surface (kept for tests and other modules): currentBlock /
 * currentList / currentContainer, deleteBlock(), duplicateBlock(),
 * insertElementAfter(), transformBlock(tag), convertListType(tag),
 * setPresetClass(cls, presets), hideMenu(), hideUI(), isDragging.
 */
export default class BlockControl extends Module {
    static moduleName = 'BlockControl';

    constructor(instance) {
        super(instance);
        this.currentBlock = null;      // main handle target (block or LI)
        this.currentList = null;       // list handle target (UL/OL)
        this.currentContainer = null;  // container handle target (aside / quote-card)
        this.activeHandle = null;      // kind of the handle the menu was opened from
        this.liteMode = instance.config.liteMode || false;
        this._hoverFrame = null;
        this._hoverEvent = null;
        this._suppressClickUntil = 0;

        // Resolved preset arrays come from Redactix.js (resolvePresets()).
        // A "no style" entry is prepended so users can clear the styling.
        this.calloutPresets = [
            { name: 'none', label: this.t('blockControl.noStyle'), class: null },
            ...(instance.config.calloutPresets || [])
        ];
        this.quotePresets = [
            { name: 'none', label: this.t('blockControl.standard'), class: null },
            ...(instance.config.quotePresets || [])
        ];
    }

    get isDragging() {
        return !!(this.drag && this.drag.active);
    }

    // Backwards-compatible accessors for the handle / menu elements.
    get handle() { return this.handles.el('block'); }
    get listHandle() { return this.handles.el('list'); }
    get containerHandle() { return this.handles.el('container'); }

    init() {
        this.handles = new HandleLayer(this);
        this.menu = new BlockMenu(this);
        this.commands = new BlockCommands(this);
        this.drag = new DragController(this);

        const editor = this.instance.editorEl;

        ['block', 'list', 'container'].forEach(kind => {
            const el = this.handles.el(kind);
            el.addEventListener('pointerdown', (e) => this.drag.onPointerDown(e, kind));
            el.addEventListener('click', (e) => this.onHandleClick(e, kind));
            // Leaving a handle for somewhere that is neither the editor nor
            // the menu hides it (unless the menu is open).
            el.addEventListener('mouseleave', (e) => {
                const to = e.relatedTarget;
                if (to && (editor.contains(to) || this.menu.contains(to) || this.handles.contains(to))) return;
                if (!this.menu.isOpen && !this.isDragging) this.handles.hide(kind);
            });
        });

        // Hover → handles. Coalesced to one resolve per animation frame.
        editor.addEventListener('mousemove', (e) => this.scheduleHover(e));

        // On touch devices there is no hover: show handles for the tapped block.
        if (window.matchMedia && window.matchMedia('(hover: none)').matches) {
            editor.addEventListener('click', (e) => {
                if (!this.isDragging) this.processHover(e.target, e.clientY);
            });
        }

        // Editor scroll (maxHeight): handles follow their blocks.
        editor.addEventListener('scroll', () => {
            if (!this.isDragging) this.handles.reposition();
        }, { passive: true });

        this.instance.wrapper.addEventListener('mouseleave', (e) => {
            const to = e.relatedTarget;
            if (to && (this.handles.contains(to) || this.menu.contains(to))) return;
            if (!this.isDragging && !this.menu.isOpen) this.clearHandles();
        });

        // Click anywhere else closes the menu.
        this.instance.listen(document, 'click', (e) => {
            if (this.menu.isOpen && !this.menu.contains(e.target) && !this.handles.contains(e.target)) {
                this.hideMenu();
            }
        });

        // The menu is position:fixed in <body>; it would stay put while its
        // handle scrolls away — close it on any scroll (capture: inner
        // scroll containers too).
        this.instance.listen(window, 'scroll', () => {
            if (this.menu.isOpen) this.hideMenu();
        }, { capture: true, passive: true });

        this.instance.onDestroy(() => {
            if (this._hoverFrame != null) cancelAnimationFrame(this._hoverFrame);
        });
        this.instance.on('contentReplaced', () => this.hideUI());
    }

    // ------------------------------------------------------------------
    // Hover
    // ------------------------------------------------------------------

    scheduleHover(e) {
        this._hoverEvent = { target: e.target, y: e.clientY };
        if (this._hoverFrame != null) return;
        this._hoverFrame = requestAnimationFrame(() => {
            this._hoverFrame = null;
            const ev = this._hoverEvent;
            this._hoverEvent = null;
            if (ev && !this.instance.destroyed) this.processHover(ev.target, ev.y);
        });
    }

    processHover(target, y) {
        if (this.isDragging || this.menu.isOpen) return;
        const root = this.instance.editorEl;
        if (target === root) target = probeRow(root, y) || root;

        const hit = resolveHover(target, y, root);
        if (hit.suppress) {
            this.clearHandles();
            return;
        }

        this.currentContainer = hit.container;
        this.currentBlock = hit.block;
        this.currentList = hit.list;

        this.handles.setTargets({ block: hit.block, list: hit.list, container: hit.container });
    }

    clearHandles() {
        this.handles.hideAll();
        this.currentBlock = null;
        this.currentList = null;
        this.currentContainer = null;
    }

    /** Target element of a handle kind. */
    getTarget(kind) {
        if (kind === 'list') return this.currentList;
        if (kind === 'container') return this.currentContainer;
        return this.currentBlock;
    }

    /** Hide all module overlays (HTML mode, content replaced, deletes). */
    hideUI() {
        if (this.drag) this.drag.finish();
        if (this.menu) this.hideMenu();
        if (this.handles) this.clearHandles();
        this.activeHandle = null;
    }

    // ------------------------------------------------------------------
    // Menu
    // ------------------------------------------------------------------

    suppressNextClick() {
        this._suppressClickUntil = Date.now() + 500;
    }

    onHandleClick(e, kind) {
        e.stopPropagation();
        e.preventDefault();
        if (Date.now() < this._suppressClickUntil) {
            this._suppressClickUntil = 0;
            return;
        }
        if (this.menu.isOpen) {
            this.hideMenu();
            return;
        }
        this.openMenu(kind);
    }

    /** Open the block menu for the target of handle `kind`. */
    openMenu(kind = 'block') {
        const target = this.getTarget(kind);
        if (!target || !this.instance.editorEl.contains(target)) {
            this.clearHandles();
            return;
        }
        this.activeHandle = kind;
        // Menu actions operate on currentBlock.
        this.currentBlock = target;
        this.menu.open(target, this.handles.el(kind));
    }

    /** Kept for compatibility: opens the menu for currentBlock. */
    showMenu() {
        this.openMenu(this.activeHandle || 'block');
    }

    hideMenu() {
        if (this.menu) this.menu.hide();
    }

    // ------------------------------------------------------------------
    // Commands (operate on currentBlock; each is one undo step)
    // ------------------------------------------------------------------

    deleteBlock() {
        this.commands.delete(this.currentBlock);
    }

    duplicateBlock() {
        this.commands.duplicate(this.currentBlock);
    }

    insertElementAfter() {
        const el = this.commands.insertAfter(this.currentBlock);
        if (el) this.clearHandles();
    }

    transformBlock(newTag) {
        const el = this.commands.transform(this.currentBlock, newTag);
        if (el) {
            this.currentBlock = el;
            this.handles.hideAll();
        }
    }

    convertListType(newListTag) {
        const wasList = this.currentBlock && this.currentBlock.tagName !== 'LI';
        const list = this.commands.convertList(this.currentBlock, newListTag);
        if (list && wasList) this.currentBlock = list;
        if (list) this.handles.hideAll();
    }

    setPresetClass(newClass, presets) {
        this.commands.setPreset(this.currentBlock, newClass, presets);
    }
}
