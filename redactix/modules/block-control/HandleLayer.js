// The three drag handles of BlockControl and their positioning.
//
//   block     — main handle: any block, or a list item
//   list      — "whole list" handle shown next to the main one on lists
//   container — handle for the whole callout / quote-card
//
// Handles are absolutely positioned inside the wrapper. All geometry is read
// first, then written, so a reposition costs one layout.

import { getContainerRule } from '../../core/schema.js';
import { innerHostOf, isListEl } from './BlockResolver.js';

const HANDLE_SIZE = 24;
// Gap between a top-level block's start edge and its handle.
const OUTSIDE_GAP = 30;

const DOTS_SVG = `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
    <circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/>
    <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
    <circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
</svg>`;

const LINES_SVG = `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
    <rect x="6" y="4" width="12" height="2" rx="1"/>
    <rect x="6" y="11" width="12" height="2" rx="1"/>
    <rect x="6" y="18" width="12" height="2" rx="1"/>
</svg>`;

export default class HandleLayer {
    constructor(ctrl) {
        this.ctrl = ctrl;
        this.instance = ctrl.instance;
        this.targets = { block: null, list: null, container: null };
        this.els = {
            block: this.create('redactix-block-handle', DOTS_SVG),
            list: this.create('redactix-block-handle redactix-list-handle', LINES_SVG, ctrl.t('blockControl.dragEntireList')),
            container: this.create('redactix-block-handle redactix-container-handle', DOTS_SVG)
        };
    }

    create(className, svg, title = '') {
        const el = document.createElement('div');
        el.className = className;
        el.innerHTML = svg;
        el.contentEditable = 'false';
        if (title) el.title = title;
        el.style.display = 'none';
        this.instance.wrapper.appendChild(el);
        return el;
    }

    /** Handle element for a kind ('block' | 'list' | 'container'). */
    el(kind) {
        return this.els[kind];
    }

    contains(node) {
        return !!node && Object.values(this.els).some(el => el.contains(node));
    }

    show(kind, target) {
        this.targets[kind] = target;
        this.place(kind);
    }

    hide(kind) {
        this.targets[kind] = null;
        this.els[kind].style.display = 'none';
    }

    hideAll() {
        Object.keys(this.els).forEach(k => this.hide(k));
    }

    /**
     * Set the targets of all three handles at once ({ block, list,
     * container }; missing = hidden) — one read pass, then one write pass.
     */
    setTargets(targets) {
        Object.keys(this.els).forEach(k => {
            this.targets[k] = targets[k] || null;
        });
        this.reposition();
    }

    /** Re-place every handle that has a target (editor scroll, drag). */
    reposition() {
        this.apply(Object.keys(this.els));
    }

    place(kind) {
        this.apply([kind]);
    }

    apply(kinds) {
        const root = this.instance.editorEl;
        // Reads first …
        const positions = kinds.map(kind => {
            const target = this.targets[kind];
            if (!target || !root.contains(target)) {
                this.targets[kind] = null;
                return null;
            }
            return this.compute(kind, target);
        });
        // … then writes.
        kinds.forEach((kind, i) => {
            const el = this.els[kind];
            const pos = positions[i];
            if (!pos) {
                el.style.display = 'none';
                return;
            }
            el.style.display = 'flex';
            el.style.top = `${pos.top}px`;
            el.style.left = `${pos.left}px`;
        });
    }

    /**
     * Wrapper-relative { top, left } for the handle of `kind` on `target`,
     * or null when the target is scrolled out of the editor (maxHeight).
     */
    compute(kind, target) {
        const wrapper = this.instance.wrapper;
        const wrapperRect = wrapper.getBoundingClientRect();
        const editorRect = this.instance.editorEl.getBoundingClientRect();
        const rect = target.getBoundingClientRect();
        const rtl = wrapper.classList.contains('redactix-rtl');

        if (!(rect.bottom > editorRect.top && rect.top < editorRect.bottom)) return null;

        // Horizontal: blocks inside a callout / quote-card get the handle in
        // the container's own (widened) start padding; the container handle
        // and top-level blocks sit in the editor's gutter; centred embeds
        // are anchored to the editor edge rather than to the figure.
        const host = kind === 'container' ? null : innerHostOf(target);
        let start;     // viewport x of the edge the handle hugs
        let inset;     // distance from that edge, inwards (+) or outwards (−)
        if (host) {
            const outer = getContainerRule(host).outer(host);
            const outerRect = outer.getBoundingClientRect();
            start = rtl ? outerRect.right : outerRect.left;
            inset = (!rtl && outer.tagName === 'ASIDE' && outer.hasAttribute('data-emoji')) ? 32 : 6;
        } else if (kind === 'block' && target.tagName === 'FIGURE' && target.classList.contains('redactix-embed')) {
            start = rtl ? editorRect.right : editorRect.left;
            inset = 8;
        } else {
            start = rtl ? rect.right : rect.left;
            inset = -OUTSIDE_GAP;
        }
        let left = rtl
            ? (start - wrapperRect.left) - inset - HANDLE_SIZE
            : (start - wrapperRect.left) + inset;
        left = Math.max(2, Math.min(left, wrapperRect.width - HANDLE_SIZE - 2));

        // Vertical: centre on the first line of text.
        let offset;
        if (kind === 'list') offset = 2;
        else if (kind === 'container') offset = 4;
        else if (isListEl(target)) offset = 5;
        else if (target.classList.contains('redactix-separator')) offset = 2;
        else offset = this.firstLineOffset(target);

        return { top: rect.top - wrapperRect.top + offset, left };
    }

    firstLineOffset(block) {
        const style = window.getComputedStyle(block);
        const paddingTop = parseFloat(style.paddingTop) || 0;
        let lineHeight = parseFloat(style.lineHeight);
        if (isNaN(lineHeight)) {
            lineHeight = (parseFloat(style.fontSize) || 16) * 1.2;
        }
        return paddingTop + (lineHeight - HANDLE_SIZE) / 2;
    }
}
