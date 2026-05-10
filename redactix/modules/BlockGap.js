import Module from '../core/Module.js';

/**
 * BlockGap module.
 *
 * Notion-style "+" insert handle that appears in the gap between two
 * top-level blocks on hover. Click → inserts an empty <p> between them
 * and focuses it. Disabled by `gapInsertHandle: false` in config.
 */
export default class BlockGap extends Module {
    constructor(instance) {
        super(instance);
        this.enabled = instance.config.gapInsertHandle !== false;
        this.handle = null;
        this.line = null;
        this.button = null;
        this.currentGap = null; // { before, after, midY }
    }

    init() {
        if (!this.enabled) return;

        this.createHandle();

        // Mousemove inside editor — recompute current gap.
        this.instance.editorEl.addEventListener('mousemove', (e) => this.onMouseMove(e));

        // Hide when leaving the editor area, unless we're moving onto the
        // handle itself (it sits inside the wrapper but technically hovers
        // over the editor padding).
        this.instance.wrapper.addEventListener('mouseleave', (e) => {
            if (e.relatedTarget && this.handle.contains(e.relatedTarget)) return;
            this.hide();
        });

        // Editor scroll (maxHeight) and window resize — recompute or hide.
        this.instance.editorEl.addEventListener('scroll', () => this.hide());
        window.addEventListener('scroll', () => this.hide(), { passive: true });
        window.addEventListener('resize', () => this.hide());
    }

    createHandle() {
        this.handle = document.createElement('div');
        this.handle.className = 'redactix-gap-handle';
        this.handle.setAttribute('data-redactix-ui', '');
        this.handle.contentEditable = 'false';
        this.handle.style.display = 'none';

        this.lineLeft = document.createElement('div');
        this.lineLeft.className = 'redactix-gap-line';

        this.lineRight = document.createElement('div');
        this.lineRight.className = 'redactix-gap-line';

        this.button = document.createElement('button');
        this.button.type = 'button';
        this.button.className = 'redactix-gap-button';
        this.button.title = this.t('blockGap.insertBlock');
        this.button.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';

        // mousedown (not click) — same trick as toolbar buttons, keeps the
        // click from blurring the editor and stealing the live selection.
        this.button.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.insertAtCurrentGap();
        });

        // Whole strip is clickable too — feels good when aiming roughly.
        this.handle.addEventListener('mousedown', (e) => {
            if (e.target === this.button || this.button.contains(e.target)) return;
            e.preventDefault();
            e.stopPropagation();
            this.insertAtCurrentGap();
        });

        // Keep visible while hovering the strip itself.
        this.handle.addEventListener('mouseenter', () => {
            if (this.currentGap) this.handle.style.display = 'flex';
        });

        this.handle.appendChild(this.lineLeft);
        this.handle.appendChild(this.button);
        this.handle.appendChild(this.lineRight);
        this.instance.wrapper.appendChild(this.handle);
    }

    onMouseMove(e) {
        // Do nothing while a modal is open.
        const modalOpen = this.instance.wrapper.querySelector('.redactix-modal-overlay.is-open');
        if (modalOpen) {
            this.hide();
            return;
        }

        const gap = this.findGap(e.clientY);
        if (!gap) {
            this.hide();
            return;
        }
        this.currentGap = gap;
        this.showAt(gap);
    }

    /**
     * Find the gap between two top-level children whose vertical zone
     * contains clientY. Returns null if cursor is inside a block (or in
     * editor padding above the first block / below the last one — those
     * aren't useful gap targets, the existing block-handle / trailing P
     * already cover those cases).
     */
    findGap(clientY) {
        const editor = this.instance.editorEl;
        const children = Array.from(editor.children).filter(c => c.offsetHeight > 0 || c.tagName === 'HR');
        if (children.length < 2) return null;

        // 4px tolerance — matches the visual margin between blocks well
        // enough that the line "snaps" without feeling sticky.
        const TOLERANCE = 4;

        for (let i = 0; i < children.length - 1; i++) {
            const a = children[i].getBoundingClientRect();
            const b = children[i + 1].getBoundingClientRect();
            // Skip overlapping rects (shouldn't happen at top-level but safe).
            if (a.bottom > b.top) continue;
            if (clientY >= a.bottom - TOLERANCE && clientY <= b.top + TOLERANCE) {
                return {
                    before: children[i],
                    after: children[i + 1],
                    midY: (a.bottom + b.top) / 2
                };
            }
        }
        return null;
    }

    showAt(gap) {
        const editor = this.instance.editorEl;
        const wrapper = this.instance.wrapper;
        const editorRect = editor.getBoundingClientRect();
        const wrapperRect = wrapper.getBoundingClientRect();

        const cs = window.getComputedStyle(editor);
        const padL = parseFloat(cs.paddingLeft) || 0;
        const padR = parseFloat(cs.paddingRight) || 0;

        const left = (editorRect.left + padL) - wrapperRect.left;
        const width = editorRect.width - padL - padR;
        const top = gap.midY - wrapperRect.top;

        this.handle.style.display = 'flex';
        this.handle.style.top = `${top}px`;
        this.handle.style.left = `${left}px`;
        this.handle.style.width = `${width}px`;
    }

    hide() {
        if (this.handle) this.handle.style.display = 'none';
        this.currentGap = null;
    }

    insertAtCurrentGap() {
        if (!this.currentGap) return;
        const { after } = this.currentGap;
        if (!after || !after.parentNode) return;

        const history = this.instance.modules.find(m => m.constructor.name === 'History');
        if (history) history.beginBatch();

        const p = document.createElement('p');
        p.innerHTML = '<br>';
        after.parentNode.insertBefore(p, after);

        this.instance.editorEl.focus();
        const range = document.createRange();
        range.setStart(p, 0);
        range.collapse(true);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);

        this.instance.sync();
        if (history) history.endBatch();
        this.hide();
    }

    getButtons() {
        return [];
    }
}
