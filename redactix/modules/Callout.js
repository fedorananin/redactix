import Module from '../core/Module.js';

/**
 * Callout module.
 *
 * Owns the <aside> contract: every callout is a block-level container.
 * Direct children may be P / H1-H3 / UL / OL or the separator wrapper
 * (<div class="redactix-separator"><hr></div>). Bare inline content from
 * legacy markup is wrapped in <p> on load.
 *
 * No DOM event wiring of its own — Enter/Backspace handled in Editor.js,
 * menus in BlockControl.js, command filtering in SlashCommands/Markdown.
 */
export default class Callout extends Module {
    init() {
        // Nothing to wire — the module is a normalization helper.
    }

    isCallout(el) {
        return !!(el && el.nodeType === Node.ELEMENT_NODE && el.tagName === 'ASIDE');
    }

    getCallout(node) {
        if (!node) return null;
        const el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
        return el ? el.closest('aside') : null;
    }

    isInsideCallout(node) {
        return !!this.getCallout(node);
    }

    isAllowedInnerTag(tag) {
        return ['P', 'H1', 'H2', 'H3', 'UL', 'OL', 'HR'].includes(tag);
    }

    /**
     * Wrap any flat / inline content in <p>; keep allowed block children
     * as-is. Idempotent — already-migrated callouts pass through unchanged.
     */
    migrate(rootEl) {
        const root = rootEl || this.instance.editorEl;
        const asides = Array.from(root.querySelectorAll('aside'));
        asides.forEach(aside => this.normalizeChildren(aside));
    }

    normalizeChildren(aside) {
        const children = Array.from(aside.childNodes);
        let pendingP = null;

        const flushP = () => {
            if (pendingP && pendingP.childNodes.length > 0) {
                aside.appendChild(pendingP);
            }
            pendingP = null;
        };

        aside.innerHTML = '';

        for (const node of children) {
            if (node.nodeType === Node.ELEMENT_NODE) {
                const tag = node.tagName;
                if (this.isAllowedInnerTag(tag)) {
                    flushP();
                    aside.appendChild(node);
                    continue;
                }
                // Separator wrapper survives as a top-level child
                if (tag === 'DIV' && node.classList.contains('redactix-separator')) {
                    flushP();
                    aside.appendChild(node);
                    continue;
                }
                if (tag === 'BR') {
                    // Treat <br> as soft break inside the current paragraph
                    if (!pendingP) pendingP = document.createElement('p');
                    pendingP.appendChild(node);
                    continue;
                }
                // Other inline element (span, b, i, a, ...) — wrap in p
                if (!pendingP) pendingP = document.createElement('p');
                pendingP.appendChild(node);
            } else if (node.nodeType === Node.TEXT_NODE) {
                if (!pendingP) pendingP = document.createElement('p');
                pendingP.appendChild(node);
            }
        }
        flushP();

        if (aside.childNodes.length === 0) {
            const p = document.createElement('p');
            p.innerHTML = '<br>';
            aside.appendChild(p);
        }
    }

    /**
     * Sync-side cleanup. Operates on a clone, NOT live DOM.
     * Drops trailing empty <p><br></p> from each callout (but keeps at
     * least one block).
     */
    cleanCalloutsForSync(clone) {
        clone.querySelectorAll('aside').forEach(aside => {
            const blocks = Array.from(aside.children);
            for (let i = blocks.length - 1; i > 0; i--) {
                const block = blocks[i];
                const isEmpty = !block.textContent.trim() &&
                    !block.querySelector('img, iframe, hr');
                if (isEmpty) block.remove();
                else break;
            }
        });
    }

    getButtons() {
        return [];
    }
}
