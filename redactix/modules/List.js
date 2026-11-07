import Module from '../core/Module.js';
import { LIST_TAGS, isBlockLike } from '../core/schema.js';

/**
 * Tab / Shift+Tab in lists, implemented on the DOM.
 *
 * execCommand('indent'/'outdent') produced invalid <ul><ul> nesting in
 * Chrome, and outdenting a top-level item left raw text in the editor root
 * (or directly in a callout). Here:
 *   indent  — the item moves into a sub-list of the previous item (reused if
 *             that item already ends with one);
 *   outdent — a nested item moves after its parent item, taking its
 *             following siblings along as its own sub-list; a top-level item
 *             becomes a <p> right after the list (the list is split around
 *             it), in whatever host the list lives in (root, callout, quote).
 * Each Tab press is one undo step.
 */
export default class List extends Module {
    static moduleName = 'List';

    init() {
        this.editor.el.addEventListener('keydown', (e) => {
            if (e.key !== 'Tab' || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
            const sel = window.getSelection();
            if (!sel.rangeCount) return;
            const range = sel.getRangeAt(0);
            const items = this.selectedItems(range);
            if (!items.length) return;
            e.preventDefault();
            if (e.shiftKey) this.outdent(items);
            else this.indent(items);
        });
    }

    getButtons() {
        return [];
    }

    closestItem(node) {
        const el = node && (node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement);
        const li = el ? el.closest('li') : null;
        return li && this.editor.el.contains(li) ? li : null;
    }

    /**
     * The list items touched by the selection: the caret's item, or the run
     * of sibling items from the selection's start item to its end item.
     */
    selectedItems(range) {
        const start = this.closestItem(range.startContainer);
        if (!start) return [];
        const end = range.collapsed ? start : this.closestItem(range.endContainer);
        if (!end || end === start || end.parentElement !== start.parentElement) return [start];
        const items = [];
        for (let li = start; li; li = li.nextElementSibling) {
            if (li.tagName === 'LI') items.push(li);
            if (li === end) return items;
        }
        return [start];
    }

    /** Indent items (siblings, in document order). Returns false if impossible. */
    indent(items) {
        const first = items[0];
        const prev = first && first.previousElementSibling;
        // The first item of a list has nothing to nest under.
        if (!prev || prev.tagName !== 'LI') return false;
        this.withCaret(() => this.transact(() => {
            items.forEach(li => {
                const parentItem = li.previousElementSibling;
                let sub = parentItem.lastElementChild;
                if (!sub || !LIST_TAGS.includes(sub.tagName)) {
                    sub = document.createElement(li.parentElement.tagName);
                    parentItem.appendChild(sub);
                }
                sub.appendChild(li);
            });
        }));
        return true;
    }

    /**
     * Outdent items (processed last-to-first so their order is kept).
     * Returns via withCaret the block that replaced the first item.
     */
    outdent(items) {
        this.withCaret(() => this.transact(() => {
            let firstResult = null;
            items.slice().reverse().forEach(li => {
                firstResult = this.outdentItem(li) || firstResult;
            });
            return firstResult;
        }));
        return true;
    }

    outdentItem(li) {
        const list = li.parentElement;
        if (!list || !LIST_TAGS.includes(list.tagName)) return;
        const parentItem = list.parentElement && list.parentElement.tagName === 'LI' ? list.parentElement : null;

        // Following siblings stay below the item: nested level → they become
        // its sub-list; top level → they form the rest of the split list.
        const following = [];
        for (let n = li.nextSibling; n; n = n.nextSibling) following.push(n);

        if (parentItem) {
            if (following.length) {
                let sub = li.lastElementChild;
                if (!sub || !LIST_TAGS.includes(sub.tagName)) {
                    sub = document.createElement(list.tagName);
                    li.appendChild(sub);
                }
                following.forEach(n => sub.appendChild(n));
            }
            parentItem.parentNode.insertBefore(li, parentItem.nextSibling);
            if (!list.querySelector(':scope > li')) list.remove();
            return li;
        }

        // Top level: <p> (plus any sub-lists / blocks the item held) after
        // the list, then the remaining items as a new list.
        const host = list.parentNode;
        let ref = list.nextSibling;
        const out = this.itemToBlocks(li);
        out.forEach(node => host.insertBefore(node, ref));
        if (following.length) {
            const rest = document.createElement(list.tagName);
            Array.from(list.attributes).forEach(a => {
                if (a.name !== 'id') rest.setAttribute(a.name, a.value);
            });
            following.forEach(n => rest.appendChild(n));
            host.insertBefore(rest, ref);
        }
        li.remove();
        if (!list.querySelector(':scope > li')) list.remove();
        return out.find(n => n.tagName === 'P') || null;
    }

    /** Content of an <li> as blocks: inline runs → <p>, lists / blocks as they are. */
    itemToBlocks(li) {
        const out = [];
        let p = null;
        Array.from(li.childNodes).forEach(child => {
            if (isBlockLike(child)) {
                p = null;
                out.push(child);
                return;
            }
            if (!p) {
                p = document.createElement('p');
                out.push(p);
            }
            p.appendChild(child);
        });
        out.forEach(node => {
            if (node.tagName === 'P' && !node.textContent.trim() && !node.querySelector('img, br')) {
                node.innerHTML = '<br>';
            }
        });
        if (!out.some(n => n.tagName === 'P')) {
            const empty = document.createElement('p');
            empty.innerHTML = '<br>';
            out.unshift(empty);
        }
        return out;
    }

    /**
     * Moving nodes collapses a live range sitting inside them, so remember
     * the caret / selection by its nodes and put it back afterwards. If the
     * caret's node is gone (an empty <li> turned into a <p>), the caret goes
     * to the start of the block `fn` returns.
     */
    withCaret(fn) {
        const sel = window.getSelection();
        const range = sel.rangeCount ? sel.getRangeAt(0) : null;
        const saved = range ? {
            sc: range.startContainer, so: range.startOffset,
            ec: range.endContainer, eo: range.endOffset
        } : null;
        const fallback = fn();
        if (!saved) return;
        const root = this.editor.el;
        const r = document.createRange();
        try {
            if (root.contains(saved.sc) && root.contains(saved.ec)) {
                r.setStart(saved.sc, saved.so);
                r.setEnd(saved.ec, saved.eo);
            } else if (fallback && root.contains(fallback)) {
                r.setStart(fallback, 0);
                r.collapse(true);
            } else {
                return;
            }
        } catch (err) {
            return;
        }
        sel.removeAllRanges();
        sel.addRange(r);
    }
}
