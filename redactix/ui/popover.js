// Shared placement for floating UI (block menu, table menu, slash menu,
// floating toolbar). Each used to have its own positioning maths — some
// flipped, some didn't, some were clipped by the wrapper's overflow.
//
// All placement is done in VIEWPORT coordinates with `position: fixed`, so a
// popover is never clipped by `overflow` on the editor / wrapper and keeps
// working in fullscreen and inside `maxHeight` scroll containers.

const MARGIN = 8;

/**
 * Position `el` (must be `position: fixed`, already in the DOM so it can be
 * measured) next to `anchor`.
 *
 * @param {HTMLElement} el
 * @param {DOMRect|{left,top,right,bottom,width,height}} anchor  Viewport rect.
 * @param {Object} [opts]
 * @param {'bottom'|'top'|'right'|'left'} [opts.side='bottom'] Preferred side.
 * @param {'start'|'center'|'end'} [opts.align='start']
 * @param {number} [opts.offset=6]  Gap between anchor and popover.
 * @returns {{ side: string }} The side actually used (after flipping).
 */
export function placePopover(el, anchor, { side = 'bottom', align = 'start', offset = 6 } = {}) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = el.offsetWidth;
    const h = el.offsetHeight;

    const fits = {
        bottom: anchor.bottom + offset + h <= vh - MARGIN,
        top: anchor.top - offset - h >= MARGIN,
        right: anchor.right + offset + w <= vw - MARGIN,
        left: anchor.left - offset - w >= MARGIN
    };
    const opposite = { bottom: 'top', top: 'bottom', left: 'right', right: 'left' };
    let used = side;
    if (!fits[side] && fits[opposite[side]]) used = opposite[side];

    let left;
    let top;
    if (used === 'bottom' || used === 'top') {
        top = used === 'bottom' ? anchor.bottom + offset : anchor.top - offset - h;
        if (align === 'center') left = anchor.left + (anchor.width - w) / 2;
        else if (align === 'end') left = anchor.right - w;
        else left = anchor.left;
    } else {
        left = used === 'right' ? anchor.right + offset : anchor.left - offset - w;
        if (align === 'center') top = anchor.top + (anchor.height - h) / 2;
        else if (align === 'end') top = anchor.bottom - h;
        else top = anchor.top;
    }

    // Clamp into the viewport.
    left = Math.max(MARGIN, Math.min(left, vw - w - MARGIN));
    top = Math.max(MARGIN, Math.min(top, vh - h - MARGIN));

    el.style.left = Math.round(left) + 'px';
    el.style.top = Math.round(top) + 'px';
    return { side: used };
}

/** Rect of the current text selection / caret, or null. */
export function getSelectionRect() {
    const sel = window.getSelection();
    if (!sel.rangeCount) return null;
    const range = sel.getRangeAt(0);
    let rect = range.getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) {
        const rects = range.getClientRects();
        if (rects.length) rect = rects[0];
        else {
            const node = range.startContainer.nodeType === Node.ELEMENT_NODE
                ? range.startContainer : range.startContainer.parentElement;
            rect = node ? node.getBoundingClientRect() : null;
        }
    }
    return rect;
}

/**
 * Copy the theme of `wrapper` onto a popover that lives outside it (portaled
 * to <body>) so CSS variables resolve to the same light / dark values.
 */
export function mirrorTheme(el, wrapper) {
    ['redactix-dark', 'redactix-auto', 'redactix-rtl'].forEach(cls => {
        el.classList.toggle(cls, wrapper.classList.contains(cls));
    });
    const dir = wrapper.getAttribute('dir');
    if (dir) el.setAttribute('dir', dir);
    else el.removeAttribute('dir');
}
