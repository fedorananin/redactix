// Block-level commands behind the BlockControl menu. Every command is one
// undo step (instance.transact) and never touches nodes that have already
// been detached from the editor (stale handle targets after undo / delete).

import {
    TEXT_BLOCK_TAGS, isAllowedIn, isHost, normalizeContainerChildren
} from '../../core/schema.js';
import { isListEl } from './BlockResolver.js';

// Attributes carried over when a block changes *type* (callout ↔ text).
// Classes are deliberately not among them: a callout preset class means
// nothing on a paragraph and vice versa.
const SAFE_CROSS_TYPE_ATTRS = ['id', 'dir', 'lang'];

function copyAttributes(from, to, only = null) {
    Array.from(from.attributes).forEach(attr => {
        if (only && !only.includes(attr.name)) return;
        if (attr.name === 'contenteditable') return;
        to.setAttribute(attr.name, attr.value);
    });
}

function emptyParagraph() {
    const p = document.createElement('p');
    p.innerHTML = '<br>';
    return p;
}

/** Remove a drag-state class and an empty class attribute left behind. */
export function cleanClassAttr(el) {
    if (!el || !el.classList) return;
    el.classList.remove('redactix-block-dragging');
    if (el.classList.length === 0) el.removeAttribute('class');
}

/**
 * Pure DOM: swap the preset class of `el` for `newClass` (null = none).
 * Exported so Callout / QuoteCard menus share the exact same logic.
 */
export function applyPresetClass(el, newClass, presets) {
    presets.forEach(preset => {
        if (preset.class) el.classList.remove(preset.class);
    });
    if (newClass) el.classList.add(newClass);
    if (el.classList.length === 0) el.removeAttribute('class');
}

/** Preset class of `el` among `presets`, or null. */
export function currentPresetClass(el, presets) {
    if (!el) return null;
    for (const preset of presets) {
        if (preset.class && el.classList.contains(preset.class)) return preset.class;
    }
    return null;
}

export default class BlockCommands {
    constructor(ctrl) {
        this.ctrl = ctrl;
        this.instance = ctrl.instance;
    }

    get root() {
        return this.instance.editorEl;
    }

    live(block) {
        return !!block && block !== this.root && this.root.contains(block);
    }

    /**
     * After removing something from `parent`: drop lists that became empty,
     * normalise the enclosing container (never left empty) and keep at least
     * one paragraph in the editor.
     */
    tidyAfterRemoval(parent) {
        const root = this.root;
        let cur = parent;
        while (cur && cur !== root && isListEl(cur) && !cur.querySelector(':scope > li')) {
            const up = cur.parentElement;
            cur.remove();
            cur = up;
        }
        let host = cur;
        while (host && host !== root && !isHost(host, root)) host = host.parentElement;
        if (host && host !== root && root.contains(host)) normalizeContainerChildren(host, root);
        if (!root.firstElementChild) root.appendChild(emptyParagraph());
    }

    delete(block) {
        if (!this.live(block)) return;
        this.instance.transact(() => {
            const parent = block.parentElement;
            block.remove();
            this.tidyAfterRemoval(parent);
        });
        this.ctrl.hideUI();
    }

    duplicate(block) {
        if (!this.live(block)) return null;
        return this.instance.transact(() => {
            const clone = block.cloneNode(true);
            // Editor UI (edit buttons) is re-created by the owning module's
            // setup pass; a cloned copy would have no listeners.
            clone.querySelectorAll('[data-redactix-ui]').forEach(el => el.remove());
            cleanClassAttr(clone);
            block.parentNode.insertBefore(clone, block.nextSibling);
            this.instance.setupContent();
            return clone;
        });
    }

    /** Insert an empty paragraph (or list item) after `block` and focus it. */
    insertAfter(block) {
        if (!this.live(block)) return null;
        const el = this.instance.transact(() => {
            let ref = block;
            let tag = 'p';
            if (block.tagName === 'LI') {
                tag = 'li';
            } else if (isListEl(block) && block.parentElement && block.parentElement.tagName === 'LI') {
                // Nested list handle → new item after the item owning it.
                ref = block.parentElement;
                tag = 'li';
            }
            const node = document.createElement(tag);
            node.innerHTML = '<br>';
            ref.parentNode.insertBefore(node, ref.nextSibling);
            return node;
        });
        this.focusStart(el);
        return el;
    }

    focusStart(el) {
        if (!el || !el.isConnected) return;
        // The menu lives in <body>; clicking it took focus away.
        this.root.focus({ preventScroll: true });
        const range = document.createRange();
        range.setStart(el, 0);
        range.collapse(true);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
    }

    /**
     * Change the type of a text block or callout.
     *
     *  • text ↔ text (P / H1-H3): same element type family — all attributes
     *    (classes, styles, id …) are kept.
     *  • text → callout: the block's inline content becomes a <p> inside a
     *    new <aside>; only id / dir / lang carry over.
     *  • callout → text: the callout is dissolved — its blocks are lifted to
     *    the callout's position and the FIRST of them is re-tagged to the
     *    requested type (if it's a text block). Lists and the remaining
     *    blocks stay as they are, so nothing gets nested in a <p>.
     *
     * @returns {Element|null} The element that now stands for the block.
     */
    transform(block, newTag) {
        if (!this.live(block)) return null;
        newTag = String(newTag).toUpperCase();
        const tag = block.tagName;
        if (tag === newTag) return block;
        const parent = block.parentElement;
        if (!isHost(parent, this.root)) return null;
        if (!isAllowedIn(parent, newTag, this.root)) return null;

        return this.instance.transact(() => {
            if (tag === 'ASIDE') return this.unwrapCallout(block, newTag);
            if (newTag === 'ASIDE') return this.wrapInCallout(block);
            const el = document.createElement(newTag);
            copyAttributes(block, el);
            while (block.firstChild) el.appendChild(block.firstChild);
            block.parentNode.replaceChild(el, block);
            return el;
        });
    }

    unwrapCallout(aside, newTag) {
        const parent = aside.parentNode;
        const nodes = Array.from(aside.childNodes);
        nodes.forEach(n => parent.insertBefore(n, aside));
        aside.remove();

        let first = nodes.find(n => n.nodeType === Node.ELEMENT_NODE) || null;
        if (!first) {
            first = emptyParagraph();
            parent.insertBefore(first, nodes.length ? nodes[nodes.length - 1].nextSibling : null);
        }
        if (TEXT_BLOCK_TAGS.includes(first.tagName) && first.tagName !== newTag) {
            const el = document.createElement(newTag);
            copyAttributes(first, el);
            while (first.firstChild) el.appendChild(first.firstChild);
            first.parentNode.replaceChild(el, first);
            first = el;
        }
        SAFE_CROSS_TYPE_ATTRS.forEach(name => {
            if (aside.hasAttribute(name) && !first.hasAttribute(name)) {
                first.setAttribute(name, aside.getAttribute(name));
            }
        });
        return first;
    }

    wrapInCallout(block) {
        const aside = document.createElement('aside');
        copyAttributes(block, aside, SAFE_CROSS_TYPE_ATTRS);
        const p = document.createElement('p');
        while (block.firstChild) p.appendChild(block.firstChild);
        if (!p.textContent.trim() && !p.querySelector('img, br')) p.innerHTML = '<br>';
        aside.appendChild(p);
        block.parentNode.replaceChild(aside, block);
        return aside;
    }

    /** Switch a list (or the list of a list item) between UL and OL. */
    convertList(block, newTag) {
        if (!this.live(block)) return null;
        const list = block.tagName === 'LI' ? block.parentElement : block;
        newTag = String(newTag).toUpperCase();
        if (!isListEl(list) || list.tagName === newTag) return null;
        return this.instance.transact(() => {
            const el = document.createElement(newTag);
            copyAttributes(list, el);
            while (list.firstChild) el.appendChild(list.firstChild);
            list.parentNode.replaceChild(el, list);
            return el;
        });
    }

    setPreset(block, newClass, presets) {
        if (!this.live(block)) return;
        this.instance.transact(() => applyPresetClass(block, newClass, presets));
    }
}
