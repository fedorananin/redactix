// Block schema — the single source of truth for "what may live where".
//
// Before this file existed the same knowledge (which tags a callout accepts,
// what counts as a quote-card body, which containers are "gap-aware", where a
// pasted / inserted block may land) was hard-coded in ~15 places across the
// core and the modules, and the copies had already drifted apart. Every
// structural decision now goes through the helpers below.
//
// Terminology:
//   • root      — the editor's contenteditable element.
//   • host      — an element whose direct children are blocks: the root,
//                 a callout <aside>, or a quote-card's inner <blockquote>.
//   • block     — a direct child of a host.
//   • kind      — the tag name used for "is this allowed here" checks.
//                 A separator wrapper (div.redactix-separator) has kind 'HR'.

export const TEXT_BLOCK_TAGS = ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'];
export const HEADING_TAGS = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'];
export const LIST_TAGS = ['UL', 'OL'];

// Block containers other than the root. Order matters only for readability.
export const CONTAINER_RULES = [
    {
        name: 'callout',
        // A callout is the <aside> itself — its direct children are blocks.
        match: (el) => el.tagName === 'ASIDE',
        outer: (host) => host,
        allowed: ['P', 'H1', 'H2', 'H3', 'UL', 'OL', 'HR'],
        // Which embedded children make an otherwise text-less block "non-empty".
        mediaSelector: 'img, iframe, hr'
    },
    {
        name: 'quote',
        // A quote-card's body is the <blockquote> inside figure.quote-card.
        match: (el) => el.tagName === 'BLOCKQUOTE' &&
            !!el.parentElement &&
            el.parentElement.tagName === 'FIGURE' &&
            el.parentElement.classList.contains('quote-card'),
        outer: (host) => host.parentElement,
        allowed: ['P', 'H1', 'H2', 'H3', 'UL', 'OL'],
        mediaSelector: 'img, iframe'
    }
];

function isElement(node) {
    return !!node && node.nodeType === Node.ELEMENT_NODE;
}

/** Kind of a block element for allowed-children checks. */
export function blockKind(el) {
    if (!isElement(el)) return '#text';
    if (el.tagName === 'DIV' && el.classList.contains('redactix-separator')) return 'HR';
    return el.tagName;
}

/** Container rule for `el` (callout / quote body), or null. */
export function getContainerRule(el) {
    if (!isElement(el)) return null;
    for (const rule of CONTAINER_RULES) {
        if (rule.match(el)) return rule;
    }
    return null;
}

/** Is `el` a host (root or block container)? */
export function isHost(el, root) {
    if (!isElement(el)) return false;
    return el === root || !!getContainerRule(el);
}

/** Tags allowed as direct children of `host`, or null for "anything". */
export function allowedChildrenOf(host, root) {
    if (host === root) return null;
    const rule = getContainerRule(host);
    return rule ? rule.allowed : null;
}

/** May an element of `kind` (tag name, or an element) be a direct child of `host`? */
export function isAllowedIn(host, kind, root) {
    const allowed = allowedChildrenOf(host, root);
    if (!allowed) return true;
    const k = typeof kind === 'string' ? kind.toUpperCase() : blockKind(kind);
    return allowed.includes(k);
}

/**
 * Nearest { host, block } for `node`: `block` is the ancestor-or-self of
 * `node` whose parent is a host. Returns null when `node` is the root itself,
 * outside the root, or a bare node sitting directly in the root.
 */
export function findHostChild(node, root) {
    if (!node || !root || !root.contains(node) || node === root) return null;
    let cur = node;
    while (cur && cur !== root) {
        const parent = cur.parentNode;
        if (isHost(parent, root)) {
            return { host: parent, block: cur };
        }
        cur = parent;
    }
    return null;
}

/**
 * Like findHostChild, but keeps climbing until the host accepts every kind
 * in `kinds` (e.g. a table can't go into a quote-card, so the insertion point
 * becomes the quote-card itself at the level above).
 */
export function findInsertionPoint(node, kinds, root) {
    const list = (Array.isArray(kinds) ? kinds : [kinds]).filter(Boolean);
    let point = findHostChild(node, root);
    while (point && !list.every(k => isAllowedIn(point.host, k, root))) {
        if (point.host === root) break;
        point = findHostChild(point.host, root);
    }
    return point;
}

/** All hosts inside `root` (root first, then nested containers in document order). */
export function getAllHosts(root) {
    const hosts = [root];
    root.querySelectorAll('aside, figure.quote-card > blockquote').forEach(el => {
        if (getContainerRule(el)) hosts.push(el);
    });
    return hosts;
}

/**
 * Snapshot of where `node` sits — used by slash commands, markdown shortcuts
 * and toolbar inserts to decide which actions make sense at the caret.
 */
export function getEditingContext(node, root) {
    const el = isElement(node) ? node : (node && node.parentElement);
    const ctx = {
        inRoot: !!el && !!root && root.contains(el),
        host: root,
        container: null,      // 'callout' | 'quote' | null
        inList: false,
        inListItem: false,
        inTable: false,
        inFigcaption: false,
        inPre: false,
        inHeading: false,
        block: null
    };
    if (!ctx.inRoot) return ctx;

    const point = findHostChild(el, root);
    if (point) {
        ctx.host = point.host;
        ctx.block = point.block;
        const rule = getContainerRule(point.host);
        ctx.container = rule ? rule.name : null;
    }

    let cur = el;
    while (cur && cur !== root) {
        const tag = cur.tagName;
        if (tag === 'LI') ctx.inListItem = true;
        if (tag === 'UL' || tag === 'OL') ctx.inList = true;
        if (tag === 'TD' || tag === 'TH' || tag === 'TABLE') ctx.inTable = true;
        if (tag === 'FIGCAPTION') ctx.inFigcaption = true;
        if (tag === 'PRE') ctx.inPre = true;
        if (HEADING_TAGS.includes(tag)) ctx.inHeading = true;
        cur = cur.parentElement;
    }
    return ctx;
}

/**
 * Is `kind` insertable at `node`, given the container rules? Climbing out of
 * a container is allowed (findInsertionPoint does that), but some contexts
 * simply refuse block inserts: table cells, captions, code.
 */
export function canInsertBlockAt(node, kind, root) {
    const ctx = getEditingContext(node, root);
    if (!ctx.inRoot) return false;
    if (ctx.inTable || ctx.inFigcaption || ctx.inPre) return false;
    if (ctx.container && !isAllowedIn(ctx.host, kind, root)) return false;
    return true;
}

/**
 * Move every direct child of `host` whose kind isn't allowed out of the
 * container, right after its outer element (preserving order); wrap stray
 * inline content into <p>. Idempotent. Returns true if anything changed.
 */
export function normalizeContainerChildren(host, root) {
    const rule = getContainerRule(host);
    if (!rule) return false;
    const outer = rule.outer(host);
    if (!outer || !outer.parentNode) return false;

    let changed = false;
    let pendingP = null;
    let ejectRef = outer.nextSibling;
    const ejected = [];

    Array.from(host.childNodes).forEach(child => {
        if (child.nodeType === Node.TEXT_NODE) {
            if (!child.textContent.trim()) {
                // Whitespace between blocks is noise; inside a run of inline
                // content it is meaningful.
                if (pendingP) pendingP.appendChild(child);
                else child.remove();
                return;
            }
            if (!pendingP) {
                pendingP = document.createElement('p');
                host.insertBefore(pendingP, child);
            }
            pendingP.appendChild(child);
            changed = true;
            return;
        }
        if (!isElement(child)) {
            child.remove();
            return;
        }
        const kind = blockKind(child);
        if (rule.allowed.includes(kind)) {
            pendingP = null;
            return;
        }
        // Inline element (b, a, br, img, span …) → gather into a paragraph.
        if (!isBlockLike(child)) {
            if (!pendingP) {
                pendingP = document.createElement('p');
                host.insertBefore(pendingP, child);
            }
            pendingP.appendChild(child);
            changed = true;
            return;
        }
        // Disallowed block (pre, table, figure, nested blockquote …) —
        // eject it after the container instead of nesting it in a <p>.
        pendingP = null;
        ejected.push(child);
        changed = true;
    });

    ejected.forEach(el => {
        outer.parentNode.insertBefore(el, ejectRef);
    });

    // A container must never be empty.
    if (!host.firstElementChild) {
        const p = document.createElement('p');
        p.innerHTML = '<br>';
        host.appendChild(p);
        changed = true;
    }
    return changed;
}

const BLOCK_LIKE = new Set([
    'P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI',
    'BLOCKQUOTE', 'ASIDE', 'PRE', 'TABLE', 'FIGURE', 'HR', 'SECTION',
    'ARTICLE', 'HEADER', 'FOOTER', 'NAV', 'MAIN', 'DL', 'DETAILS', 'FORM'
]);

export function isBlockLike(el) {
    return isElement(el) && BLOCK_LIKE.has(el.tagName);
}
