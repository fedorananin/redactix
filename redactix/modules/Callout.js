import Module from '../core/Module.js';
import { isBlockEmpty } from '../core/dom-utils.js';
import { CONTAINER_RULES, isBlockLike, normalizeContainerChildren } from '../core/schema.js';
import { pushEscapeLayer } from '../core/layers.js';
import { placePopover } from '../ui/popover.js';

const CALLOUT_RULE = CONTAINER_RULES.find(r => r.name === 'callout');

/**
 * Callout module.
 *
 * Owns the <aside> contract: every callout is a block-level container whose
 * direct children are the kinds listed in core/schema.js (CONTAINER_RULES):
 * P / H1-H3 / UL / OL and the separator wrapper. Stray inline content is
 * wrapped in <p>; disallowed blocks (pre, table, figure …) are moved out,
 * right after the callout.
 *
 * Also owns the callout emoji (aside[data-emoji]) editor and contributes
 * the emoji entries to the BlockControl menu (getBlockMenuItems).
 *
 * Enter/Backspace are handled in Editor.js, command filtering in
 * SlashCommands/Markdown.
 */
export default class Callout extends Module {
    static moduleName = 'Callout';

    constructor(instance) {
        super(instance);
        this.emojiEditor = null;   // { el, aside, input, hint, popEscape, commit }
    }

    init() {
        // Click on the emoji area (the aside's start padding) edits the emoji.
        this.instance.editorEl.addEventListener('click', (e) => {
            const aside = e.target.closest ? e.target.closest('aside[data-emoji]') : null;
            if (!aside || !this.instance.editorEl.contains(aside)) return;
            if (!this.isOverEmojiArea(aside, e.clientX)) return;
            e.preventDefault();
            e.stopPropagation();
            this.openEmojiEditor(aside);
        });

        // The editor is position:fixed — close it (keeping a valid value)
        // when anything scrolls.
        this.instance.listen(window, 'scroll', () => {
            if (this.emojiEditor) this.emojiEditor.commit();
        }, { capture: true, passive: true });
    }

    isOverEmojiArea(aside, clientX) {
        const rect = aside.getBoundingClientRect();
        const style = window.getComputedStyle(aside);
        if (style.direction === 'rtl') {
            return rect.right - clientX < (parseFloat(style.paddingRight) || 0);
        }
        return clientX - rect.left < (parseFloat(style.paddingLeft) || 0);
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
        return CALLOUT_RULE.allowed.includes(tag);
    }

    /**
     * Normalise every callout under `rootEl`. Idempotent — already
     * well-formed callouts pass through unchanged.
     */
    migrate(rootEl) {
        const root = rootEl || this.instance.editorEl;
        root.querySelectorAll('aside').forEach(aside => this.normalizeChildren(aside));
    }

    /**
     * Bring one callout in line with the schema (see core/schema.js
     * normalizeContainerChildren): inline runs → <p>, disallowed blocks →
     * moved after the callout, never left empty. A plain class-less <div>
     * holding only inline content is legacy paragraph markup and becomes a
     * <p> rather than being moved out.
     */
    normalizeChildren(aside) {
        coercePlainDivs(aside);
        normalizeContainerChildren(aside, this.instance.editorEl);
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
                if (isBlockEmpty(block, CALLOUT_RULE.mediaSelector)) block.remove();
                else break;
            }
        });
    }

    getButtons() {
        return [];
    }

    // ---------- emoji ----------

    /** BlockControl menu hook: emoji entries for a callout. */
    getBlockMenuItems(block) {
        if (!this.isCallout(block)) return [];
        const hasEmoji = block.hasAttribute('data-emoji');
        const items = [{
            icon: hasEmoji ? '✎' : '😀',
            label: this.t(hasEmoji ? 'blockControl.changeEmoji' : 'blockControl.addEmoji'),
            action: () => this.openEmojiEditor(block)
        }];
        if (hasEmoji) {
            items.push({
                icon: '✕',
                label: this.t('blockControl.removeEmoji'),
                action: () => this.removeEmoji(block)
            });
        }
        return [{ items }];
    }

    openEmojiEditor(aside) {
        if (!this.isCallout(aside) || !this.instance.editorEl.contains(aside)) return;
        this.hideEmojiEditor();

        const el = document.createElement('div');
        el.className = 'redactix-emoji-input';
        el.contentEditable = 'false';

        const input = document.createElement('input');
        input.type = 'text';
        input.value = aside.getAttribute('data-emoji') || '';
        input.maxLength = 16;
        input.setAttribute('aria-label', this.t('blockControl.changeEmoji'));

        // OS-specific shortcut hint for the native emoji picker.
        const isMac = /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent);
        const hint = document.createElement('div');
        hint.className = 'redactix-emoji-hint';
        const kbd = document.createElement('kbd');
        kbd.textContent = isMac ? '⌘ + ⌃ + Space' : 'Win + .';
        hint.append(document.createTextNode(this.t('blockControl.emojiOnly') + ' · '), kbd);

        el.append(input, hint);
        this.instance.wrapper.appendChild(el);
        placePopover(el, aside.getBoundingClientRect(), { side: 'top', align: 'start', offset: 6 });

        const state = { el, aside, input, hint, popEscape: null, commit: null };
        state.commit = () => {
            if (this.emojiEditor !== state) return;
            const value = input.value.trim();
            if (!value) {
                if (aside.hasAttribute('data-emoji')) this.removeEmoji(aside);
                this.hideEmojiEditor();
            } else if (this.isValidEmoji(value)) {
                if (aside.getAttribute('data-emoji') !== value && this.instance.editorEl.contains(aside)) {
                    this.transact(() => aside.setAttribute('data-emoji', value));
                }
                this.hideEmojiEditor();
            } else {
                hint.classList.add('is-error');
                input.classList.add('invalid');
                return false;
            }
            return true;
        };
        state.popEscape = pushEscapeLayer(() => this.hideEmojiEditor(), { scope: [this.instance.wrapper] });
        this.emojiEditor = state;

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                state.commit();
            }
        });
        input.addEventListener('input', () => {
            hint.classList.remove('is-error');
            input.classList.remove('invalid');
        });
        // Blur saves; an invalid value is simply discarded on blur.
        input.addEventListener('blur', () => {
            setTimeout(() => {
                if (this.emojiEditor === state && state.commit() === false) this.hideEmojiEditor();
            }, 150);
        });
        el.addEventListener('mousedown', (e) => e.stopPropagation());

        input.focus({ preventScroll: true });
        input.select();
    }

    hideEmojiEditor() {
        const state = this.emojiEditor;
        if (!state) return;
        this.emojiEditor = null;
        if (state.popEscape) state.popEscape();
        state.el.remove();
    }

    removeEmoji(aside) {
        if (!this.isCallout(aside) || !aside.hasAttribute('data-emoji')) return;
        if (!this.instance.editorEl.contains(aside)) return;
        this.transact(() => aside.removeAttribute('data-emoji'));
    }

    /**
     * Emoji only: pictographs with their modifiers, ZWJ sequences, flags and
     * keycaps (1️⃣). Plain ASCII — digits, '#', '*' (which Unicode lists as
     * Emoji_Component) — is rejected.
     */
    isValidEmoji(str) {
        const trimmed = String(str || '').trim();
        if (!trimmed) return false;
        const withoutKeycaps = trimmed.replace(/[0-9#*]️?⃣/gu, '');
        if (/[\u0000-\u007F]/.test(withoutKeycaps)) return false;
        const rest = withoutKeycaps.replace(/[\p{Extended_Pictographic}\p{Emoji_Component}‍️︎]/gu, '');
        return rest.length === 0;
    }

    hideUI() {
        this.hideEmojiEditor();
    }

    // ---------- content lifecycle hooks (called by RedactixInstance) ----------

    setupContent(root) {
        this.migrate(root);
    }

    cleanForSync(clone) {
        this.cleanCalloutsForSync(clone);
    }

    get pasteAllowedAttributes() {
        return [{ selector: 'aside', attrs: ['data-emoji'] }];
    }
}

/**
 * Plain class-less <div> children holding only inline content are legacy
 * paragraph markup (contenteditable output, old pastes) — turn them into
 * <p> so normalisation keeps them inside the container instead of moving
 * them out as foreign blocks. Shared with QuoteCard.
 */
export function coercePlainDivs(host) {
    Array.from(host.children).forEach(child => {
        if (child.tagName !== 'DIV' || child.attributes.length > 0) return;
        if (Array.from(child.children).some(isBlockLike)) return;
        const p = document.createElement('p');
        while (child.firstChild) p.appendChild(child.firstChild);
        if (!p.firstChild) p.innerHTML = '<br>';
        host.replaceChild(p, child);
    });
}
