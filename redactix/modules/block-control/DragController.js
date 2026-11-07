// Block drag & drop — one Pointer Events implementation for mouse, pen and
// touch. Mouse and touch used to have two diverging copies of the drop
// logic; both now go through BlockResolver.computeDropTarget.
//
// Gesture:
//   pointerdown on a handle   → arm (nothing changes yet)
//   move past a threshold     → drag starts: ONE history batch begins
//   pointermove               → (rAF-coalesced) move the block if its
//                               position actually changes
//   pointerup / cancel / Esc  → drag ends: batch ends, emptied list removed
//   no movement               → it was a click; the handle's click handler
//                               opens the menu. Touch: long press opens it.

import { mirrorTheme } from '../../ui/popover.js';
import { pushEscapeLayer } from '../../core/layers.js';
import { computeDropTarget, isSamePosition, probeRow } from './BlockResolver.js';
import { cleanClassAttr } from './BlockCommands.js';

const MOUSE_THRESHOLD = 3;
const TOUCH_THRESHOLD = 10;
const LONG_PRESS_MS = 500;

export default class DragController {
    constructor(ctrl) {
        this.ctrl = ctrl;
        this.instance = ctrl.instance;
        this.state = null;
        this.instance.onDestroy(() => this.finish());
    }

    /** True while a block is actually being dragged. */
    get active() {
        return !!(this.state && this.state.dragging);
    }

    onPointerDown(e, kind) {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        if (e.isPrimary === false) return;
        const source = this.ctrl.getTarget(kind);
        if (!source || !this.instance.editorEl.contains(source)) return;

        // No text selection, no focus change; on touch the handle has
        // touch-action:none so the page doesn't scroll instead.
        e.preventDefault();
        this.finish();

        const s = {
            kind,
            source,
            handleEl: this.ctrl.handles.el(kind),
            pointerId: e.pointerId,
            pointerType: e.pointerType || 'mouse',
            startX: e.clientX,
            startY: e.clientY,
            lastX: e.clientX,
            lastY: e.clientY,
            dragging: false,
            longPress: false,
            longPressTimer: null,
            frame: null,
            batch: false,
            listeners: []
        };
        this.state = s;

        const on = (type, fn) => {
            document.addEventListener(type, fn, true);
            s.listeners.push([type, fn]);
        };
        on('pointermove', ev => this.onPointerMove(ev));
        on('pointerup', ev => this.onPointerUp(ev));
        on('pointercancel', ev => this.onPointerUp(ev));

        if (s.pointerType !== 'mouse') {
            s.longPressTimer = setTimeout(() => {
                if (this.state !== s || s.dragging) return;
                s.longPress = true;
                this.ctrl.openMenu(kind);
            }, LONG_PRESS_MS);
        }
    }

    onPointerMove(e) {
        const s = this.state;
        if (!s || e.pointerId !== s.pointerId) return;
        s.lastX = e.clientX;
        s.lastY = e.clientY;

        if (!s.dragging) {
            if (s.longPress) return;
            const threshold = s.pointerType === 'mouse' ? MOUSE_THRESHOLD : TOUCH_THRESHOLD;
            if (Math.hypot(e.clientX - s.startX, e.clientY - s.startY) < threshold) return;
            if (!this.start(s)) return;
        }
        e.preventDefault();
        this.moveGhost(s);
        if (s.frame == null) {
            s.frame = requestAnimationFrame(() => {
                s.frame = null;
                if (this.state === s) this.update(s);
            });
        }
    }

    onPointerUp(e) {
        const s = this.state;
        if (!s || e.pointerId !== s.pointerId) return;
        if (s.dragging) {
            // Apply the very last position (it may still be waiting for
            // its animation frame).
            s.lastX = e.clientX || s.lastX;
            s.lastY = e.clientY || s.lastY;
            if (e.type === 'pointerup') this.update(s);
            this.ctrl.suppressNextClick();
        } else if (s.longPress) {
            // The menu is already open; the click that follows the touch
            // must not toggle it closed again.
            this.ctrl.suppressNextClick();
        }
        this.finish();
    }

    /** @returns {boolean} whether the drag really started. */
    start(s) {
        clearTimeout(s.longPressTimer);
        s.longPressTimer = null;
        if (!this.instance.editorEl.contains(s.source)) {
            this.finish();
            return false;
        }

        const history = this.ctrl.getModule('History');
        if (history) {
            history.beginBatch();
            s.batch = true;
        }
        s.dragging = true;
        try {
            s.sourceList = s.source.tagName === 'LI' ? s.source.parentElement : null;
            s.handleEl.classList.add('dragging');
            s.source.classList.add('redactix-block-dragging');
            // Hides the gap "+" and table handles (CSS) and makes every
            // overlay transparent to elementFromPoint.
            this.instance.wrapper.classList.add('redactix-dragging');
            this.instance.isDraggingBlock = true;
            this.ctrl.hideMenu();
            const gap = this.ctrl.getModule('BlockGap');
            if (gap && gap.hide) gap.hide();

            s.ghost = document.createElement('div');
            s.ghost.className = 'redactix-drag-ghost redactix-wrapper';
            mirrorTheme(s.ghost, this.instance.wrapper);
            const text = (s.source.textContent || '').trim();
            s.ghost.textContent = text.length > 50 ? text.substring(0, 50) + '...' : text;
            document.body.appendChild(s.ghost);
            s.popEscape = pushEscapeLayer(() => this.finish());
        } catch (err) {
            this.finish();
            throw err;
        }
        return true;
    }

    moveGhost(s) {
        if (!s.ghost) return;
        s.ghost.style.left = `${s.lastX + 10}px`;
        s.ghost.style.top = `${s.lastY + 10}px`;
    }

    /** Move the dragged block to wherever the pointer currently points. */
    update(s) {
        if (!s.dragging || !this.instance.editorEl.contains(s.source)) return;
        const root = this.instance.editorEl;
        let el = document.elementFromPoint(s.lastX, s.lastY);
        if (el === root) el = probeRow(root, s.lastY) || root;
        const drop = computeDropTarget(s.source, el, s.lastY, root);
        if (!drop || isSamePosition(s.source, drop)) return;
        drop.parent.insertBefore(s.source, drop.before);
        this.ctrl.handles.show(s.kind, s.source);
    }

    /** End (or abort) the current gesture. Safe to call at any time. */
    finish() {
        const s = this.state;
        if (!s) return;
        this.state = null;

        s.listeners.forEach(([type, fn]) => document.removeEventListener(type, fn, true));
        clearTimeout(s.longPressTimer);
        if (s.frame != null) cancelAnimationFrame(s.frame);
        if (s.popEscape) s.popEscape();

        try {
            if (s.dragging) {
                s.handleEl.classList.remove('dragging');
                cleanClassAttr(s.source);
                if (s.ghost) s.ghost.remove();
                this.instance.wrapper.classList.remove('redactix-dragging');
                this.instance.isDraggingBlock = false;

                // The last item was dragged out of its list → drop the
                // empty <ul> instead of saving it.
                const list = s.sourceList;
                if (list && list.isConnected && !list.querySelector(':scope > li')) {
                    const parent = list.parentElement;
                    list.remove();
                    this.ctrl.commands.tidyAfterRemoval(parent);
                }
            }
        } finally {
            if (s.batch) {
                const history = this.ctrl.getModule('History');
                if (history) history.endBatch();
            }
            if (s.dragging && !this.instance.destroyed) this.instance.sync();
        }
    }
}
