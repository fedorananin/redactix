// Escape-key layer stack shared by every Redactix instance on the page.
//
// Modal, fullscreen, the find panel, menus and popovers all want "Escape
// closes me". With one document listener each, a single Escape press closed
// all of them at once (stopPropagation can't stop sibling listeners on the
// same target). Now every closable layer pushes itself here while open and
// only the topmost layer whose scope matches the event handles it.

const stack = [];
let bound = false;

function onKeyDown(e) {
    if (e.key !== 'Escape' || e.isComposing) return;
    for (let i = stack.length - 1; i >= 0; i--) {
        const entry = stack[i];
        if (entry.scope && !inScope(entry.scope, e.target)) continue;
        e.preventDefault();
        e.stopImmediatePropagation();
        entry.handler(e);
        return;
    }
}

function inScope(scope, target) {
    const scopes = Array.isArray(scope) ? scope : [scope];
    // Escape pressed with nothing focused (target = body) still counts —
    // the user clearly means "close the thing on screen".
    if (!target || target === document.body || target === document.documentElement) return true;
    return scopes.some(s => s && s.contains && s.contains(target));
}

/**
 * Register a layer that closes on Escape.
 * @param {Function} handler       Called when this layer should close.
 * @param {Object}   [options]
 * @param {Element|Element[]} [options.scope] Only react when the key event
 *        originates inside one of these elements (or from <body>).
 * @returns {Function} Unregister function — call it when the layer closes.
 */
export function pushEscapeLayer(handler, { scope = null } = {}) {
    const entry = { handler, scope };
    stack.push(entry);
    if (!bound) {
        document.addEventListener('keydown', onKeyDown, true);
        bound = true;
    }
    return () => {
        const i = stack.indexOf(entry);
        if (i >= 0) stack.splice(i, 1);
        if (stack.length === 0 && bound) {
            document.removeEventListener('keydown', onKeyDown, true);
            bound = false;
        }
    };
}
