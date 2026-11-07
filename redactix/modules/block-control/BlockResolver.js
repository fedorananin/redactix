// Pure structure / geometry helpers for BlockControl.
//
// Given an element (usually what's under the pointer) work out which block
// the handles attach to, and where a dragged block would land. Everything
// structural goes through core/schema.js — no hand-written tag lists here.
//
// The only DOM *reads* are getBoundingClientRect / elementFromPoint; nothing
// in this file mutates the document.

import { findHostChild, getContainerRule, LIST_TAGS } from '../../core/schema.js';

export function isElement(node) {
    return !!node && node.nodeType === Node.ELEMENT_NODE;
}

export function isListEl(el) {
    return isElement(el) && LIST_TAGS.includes(el.tagName);
}

function isQuoteCard(el) {
    return isElement(el) && el.tagName === 'FIGURE' && el.classList.contains('quote-card');
}

/**
 * Host (callout <aside> / quote-card body <blockquote>) for a container
 * element — accepts the aside, the quote-card figure or the quote body
 * itself. Null for anything else.
 */
export function containerHost(el) {
    if (!isElement(el)) return null;
    if (getContainerRule(el)) return el;
    if (isQuoteCard(el)) {
        const bq = el.querySelector(':scope > blockquote');
        return bq && getContainerRule(bq) ? bq : null;
    }
    return null;
}

/**
 * Outer element (aside / figure.quote-card) of the nearest container that
 * `node` sits in, excluding `node` itself. Null at the top level. Used to
 * keep drags inside the container they started in.
 */
export function containerAncestor(node, root) {
    let cur = node && node.parentElement;
    while (cur && cur !== root) {
        if (cur.tagName === 'ASIDE' || isQuoteCard(cur)) return cur;
        cur = cur.parentElement;
    }
    return null;
}

/**
 * The container host `block` is a direct child of (aside / quote body), or
 * null when the block sits in the root or isn't a host child at all.
 */
export function innerHostOf(block) {
    const parent = block && block.parentElement;
    return parent && getContainerRule(parent) ? parent : null;
}

function inY(el, y) {
    const r = el.getBoundingClientRect();
    return y >= r.top && y <= r.bottom;
}

/** Direct element child of `host` whose vertical extent contains `y`. */
export function childAtY(host, y) {
    return Array.from(host.children).find(c => inY(c, y)) || null;
}

/** Direct element child of `host` closest to `y` (pointer in a margin gap). */
export function childNearY(host, y) {
    let best = null;
    let bestDist = Infinity;
    for (const child of host.children) {
        if (child.hasAttribute('data-redactix-ui')) continue;
        const r = child.getBoundingClientRect();
        if (r.height === 0 && r.width === 0) continue;
        const dist = y < r.top ? r.top - y : (y > r.bottom ? y - r.bottom : 0);
        if (dist < bestDist) {
            bestDist = dist;
            best = child;
        }
    }
    return best;
}

/**
 * Deepest <li> of `list` under the pointer: the LI containing `target` if
 * there is one, otherwise picked by Y (pointer on the list's own padding /
 * marker area), drilling into nested lists.
 */
export function listItemAt(list, target, y) {
    const li = isElement(target) && target.closest ? target.closest('li') : null;
    if (li && list.contains(li)) return li;

    let cur = list;
    let found = null;
    while (cur) {
        const item = Array.from(cur.children).find(c => c.tagName === 'LI' && inY(c, y));
        if (!item) break;
        found = item;
        cur = Array.from(item.children).find(c => isListEl(c) && inY(c, y)) || null;
    }
    return found;
}

/**
 * The pointer is over the editor root itself (its padding): probe a few X
 * positions on the same line so centred / narrow blocks (max-width embeds,
 * big quote cards) are still found.
 */
export function probeRow(root, y) {
    const rect = root.getBoundingClientRect();
    const xs = [rect.left + 60, rect.left + rect.width / 2, rect.right - 60];
    for (const x of xs) {
        const el = document.elementFromPoint(x, y);
        if (el && el !== root && root.contains(el)) return el;
    }
    return null;
}

/**
 * Resolve what the handles should attach to for a pointer over `target`
 * at viewport Y `y`.
 *
 * @returns {{ block: Element|null, list: Element|null, container: Element|null, suppress: boolean }}
 *   block     — main handle target (an LI, or a direct child of a host)
 *   list      — UL/OL for the "whole list" handle
 *   container — aside / figure.quote-card for the container handle
 *   suppress  — pointer is over editor UI (edit buttons …): hide everything
 */
export function resolveHover(target, y, root) {
    const result = { block: null, list: null, container: null, suppress: false };
    if (!isElement(target) || !root.contains(target) || target === root) return result;

    if (target.closest('[data-redactix-ui]')) {
        result.suppress = true;
        return result;
    }

    // Anywhere inside a callout / quote-card: container handle + the inner
    // block at this Y (padding included, so it's found from the gutter).
    const container = target.closest('aside, figure.quote-card');
    if (container && root.contains(container)) {
        result.container = container;
        // Author photo / name: only the container handle.
        if (target.closest('figure.quote-card > figcaption')) return result;
        const host = containerHost(container);
        const inner = host ? childAtY(host, y) : null;
        if (inner) attachBlock(result, inner, target, y);
        return result;
    }

    const point = findHostChild(target, root);
    if (!point || !isElement(point.block)) return result;
    attachBlock(result, point.block, target, y);
    return result;
}

function attachBlock(result, block, target, y) {
    if (isListEl(block)) {
        const li = listItemAt(block, target, y);
        if (li) {
            result.block = li;
            result.list = li.parentElement;
        } else {
            // Over the list but not over an item: the main handle grabs
            // the whole list.
            result.block = block;
        }
        return;
    }
    result.block = block;
}

/**
 * Where would `source` land if dropped at pointer element `el` / Y `y`?
 *
 * A block can only move among the children of the host it already lives in
 * (top level ↔ top level, inside the same callout / quote body); a list item
 * can move to any list inside the same container. The target is therefore
 * always the nearest ancestor of `el` whose parent is that host — never a
 * node inside an atomic block (figure, pre, table, separator wrapper).
 *
 * @returns {{ parent: Element, before: Node|null } | null}
 */
export function computeDropTarget(source, el, y, root) {
    if (!isElement(source) || !isElement(el)) return null;
    if (el !== root && !root.contains(el)) return null;
    if (source === el || source.contains(el)) return null;
    if (el.closest('[data-redactix-ui]')) return null;
    // Author caption of a quote-card can never receive blocks.
    if (el.closest('figure.quote-card > figcaption')) return null;

    if (source.tagName === 'LI') return dropListItem(source, el, y, root);

    const sourceHost = source.parentElement;
    if (!sourceHost) return null;

    let target;
    if (el === sourceHost || containerHost(el) === sourceHost) {
        // Pointer on the host's own box (padding / margins between blocks).
        target = childNearY(sourceHost, y);
    } else {
        target = el;
        while (target && target.parentElement !== sourceHost) {
            if (target === root) return null;
            target = target.parentElement;
        }
    }
    if (!target || target === source) return null;
    return placeAround(sourceHost, target, y);
}

function dropListItem(source, el, y, root) {
    let li = el.closest('li');
    if (li && !root.contains(li)) li = null;
    if (!li) {
        const list = el.closest('ul, ol');
        if (list && root.contains(list)) li = listItemAt(list, el, y);
    }
    if (!li || li === source || source.contains(li)) return null;
    if (containerAncestor(li, root) !== containerAncestor(source, root)) return null;
    return placeAround(li.parentNode, li, y);
}

function placeAround(parent, ref, y) {
    const r = ref.getBoundingClientRect();
    const before = y < r.top + r.height / 2 ? ref : ref.nextSibling;
    return { parent, before };
}

/** Does `drop` describe the position `source` is already in? */
export function isSamePosition(source, drop) {
    return drop.parent === source.parentNode &&
        (drop.before === source || drop.before === source.nextSibling);
}

