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
     * Find the gap between two adjacent direct children of one of the
     * "gap-aware" containers — the editor itself, every callout (<aside>),
     * and every quote-card's inner <blockquote>. Inner containers are
     * checked first so a hover between two paragraphs inside a callout
     * snaps to the inner gap rather than to whatever outer-editor gap
     * happens to share the same Y. Returns null if the cursor is inside a
     * block (or in container padding outside any actual gap — those cases
     * are already covered by the block-handle / trailing P).
     */
    findGap(clientY) {
        const editor = this.instance.editorEl;

        const containers = [];
        editor.querySelectorAll('aside, figure.quote-card > blockquote').forEach(el => {
            containers.push(el);
        });
        containers.push(editor);

        // 4px tolerance — matches the visual margin between blocks well
        // enough that the line "snaps" without feeling sticky.
        const TOLERANCE = 4;

        for (const container of containers) {
            const children = Array.from(container.children).filter(c => c.offsetHeight > 0 || c.tagName === 'HR');
            if (children.length < 2) continue;

            for (let i = 0; i < children.length - 1; i++) {
                const a = children[i].getBoundingClientRect();
                const b = children[i + 1].getBoundingClientRect();
                // Skip overlapping rects (shouldn't happen but safe).
                if (a.bottom > b.top) continue;
                if (clientY >= a.bottom - TOLERANCE && clientY <= b.top + TOLERANCE) {
                    return {
                        container,
                        before: children[i],
                        after: children[i + 1],
                        midY: (a.bottom + b.top) / 2
                    };
                }
            }
        }
        return null;
    }

    showAt(gap) {
        const wrapper = this.instance.wrapper;
        const wrapperRect = wrapper.getBoundingClientRect();

        // Anchor horizontal extent to the gap's actual container so the
        // line spans the inside of a callout / quote-card instead of the
        // full editor width when we're between inner blocks.
        const container = gap.container || this.instance.editorEl;
        const containerRect = container.getBoundingClientRect();
        const cs = window.getComputedStyle(container);
        const padL = parseFloat(cs.paddingLeft) || 0;
        const padR = parseFloat(cs.paddingRight) || 0;

        const left = (containerRect.left + padL) - wrapperRect.left;
        const width = containerRect.width - padL - padR;
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

        // preventScroll: avoid the editor jumping back to the top when its
        // contents are taller than the viewport. We're inserting at a known
        // position and setting the selection there ourselves — letting the
        // browser's focus-scroll align the top of the contenteditable wins
        // over our own range placement and feels like a glitch.
        this.instance.editorEl.focus({ preventScroll: true });
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
