// The BlockControl context menu: rendering, placement and closing.
//
// The menu is portaled to <body> (so no overflow on the host page clips it)
// and placed with position:fixed via the shared placePopover(). It mirrors
// the wrapper's theme classes so the CSS variables resolve the same way.
//
// Modules can contribute groups through an optional hook:
//   getBlockMenuItems(block) → [{ label?, items: [{ icon, label, action, danger?, active? }] }]
// Callout (emoji) and QuoteCard (caption / author photo) use it.

import { placePopover, mirrorTheme } from '../../ui/popover.js';
import { pushEscapeLayer } from '../../core/layers.js';
import { TEXT_BLOCK_TAGS, isAllowedIn } from '../../core/schema.js';
import { isListEl } from './BlockResolver.js';
import { currentPresetClass } from './BlockCommands.js';

// Text block types offered under "Transform to".
const TRANSFORMS = [
    { tag: 'P', key: 'blockControl.paragraph', icon: '¶' },
    { tag: 'H1', key: 'blockControl.heading1', icon: 'H1' },
    { tag: 'H2', key: 'blockControl.heading2', icon: 'H2' },
    { tag: 'H3', key: 'blockControl.heading3', icon: 'H3' },
    { tag: 'ASIDE', key: 'blockControl.callout', icon: '💡' }
];

export default class BlockMenu {
    constructor(ctrl) {
        this.ctrl = ctrl;
        this.instance = ctrl.instance;
        this.popEscape = null;

        this.el = document.createElement('div');
        this.el.className = 'redactix-block-menu';
        this.el.setAttribute('role', 'menu');
        this.el.style.display = 'none';
        document.body.appendChild(this.el);
        this.instance.onDestroy(() => {
            this.hide();
            this.el.remove();
        });
    }

    get isOpen() {
        return this.el.style.display === 'block';
    }

    contains(node) {
        return !!node && this.el.contains(node);
    }

    /** Open the menu for `block`, anchored to `anchorEl` (a handle). */
    open(block, anchorEl) {
        const root = this.instance.editorEl;
        if (!block || !root.contains(block)) {
            this.hide();
            return;
        }
        this.build(block);

        // `redactix-wrapper` defines the CSS variables; theme / RTL / lite
        // classes are mirrored from the real wrapper.
        this.el.className = 'redactix-block-menu redactix-wrapper';
        mirrorTheme(this.el, this.instance.wrapper);
        this.el.classList.toggle('redactix-lite-mode', !!this.instance.config.liteMode);

        this.el.style.display = 'block';
        placePopover(this.el, anchorEl.getBoundingClientRect(), { side: 'bottom', align: 'start', offset: 5 });

        if (!this.popEscape) {
            this.popEscape = pushEscapeLayer(() => this.hide(), { scope: [this.instance.wrapper, this.el] });
        }
    }

    hide() {
        this.el.style.display = 'none';
        if (this.popEscape) {
            this.popEscape();
            this.popEscape = null;
        }
    }

    build(block) {
        const ctrl = this.ctrl;
        const t = (k) => ctrl.t(k);
        const root = this.instance.editorEl;
        const liteMode = !!this.instance.config.liteMode;
        const tag = block.tagName;
        const groups = [];

        // Transform (text blocks and callouts).
        if (TEXT_BLOCK_TAGS.includes(tag) || tag === 'ASIDE') {
            const host = block.parentElement;
            const items = TRANSFORMS
                .filter(tr => tr.tag !== tag && isAllowedIn(host, tr.tag, root))
                .map(tr => ({ icon: tr.icon, label: t(tr.key), action: () => ctrl.transformBlock(tr.tag) }));
            if (items.length) groups.push({ label: t('blockControl.transformTo'), items });
        }

        // Presets (callout / quote-card).
        const presetSet = this.presetsFor(block);
        if (presetSet) {
            const current = currentPresetClass(block, presetSet.presets);
            groups.push({
                label: presetSet.label,
                items: presetSet.presets.map(preset => {
                    const active = (preset.class === null && !current) || preset.class === current;
                    return {
                        icon: active ? '✓' : ' ',
                        label: preset.label,
                        active,
                        action: () => ctrl.setPresetClass(preset.class, presetSet.presets)
                    };
                })
            });
        }

        // Module-contributed groups.
        this.instance.modules.forEach(m => {
            if (typeof m.getBlockMenuItems !== 'function') return;
            try {
                const extra = m.getBlockMenuItems(block);
                if (Array.isArray(extra)) groups.push(...extra.filter(g => g && g.items && g.items.length));
            } catch (err) {
                console.error('Redactix: ' + m.name + '.getBlockMenuItems failed', err);
            }
        });

        // Media edit entries (modules owned elsewhere — looked up by name).
        if (tag === 'FIGURE') {
            const media = [
                { cls: 'redactix-embed', module: 'Embed', group: 'embed.menuGroup', label: 'embed.edit', lite: false },
                { cls: 'redactix-video', module: 'Video', group: 'video.menuGroup', label: 'video.edit', lite: true },
                { cls: 'redactix-gallery', module: 'Gallery', group: 'gallery.menuGroup', label: 'gallery.edit', lite: false }
            ];
            media.forEach(entry => {
                if (!block.classList.contains(entry.cls) || (liteMode && !entry.lite)) return;
                const mod = ctrl.getModule(entry.module);
                if (!mod || typeof mod.openModal !== 'function') return;
                groups.push({
                    label: t(entry.group),
                    items: [{ icon: '✎', label: t(entry.label), action: () => mod.openModal(block) }]
                });
            });
        }

        // List type.
        if (tag === 'LI' || isListEl(block)) {
            const listTag = tag === 'LI' ? block.parentElement.tagName : tag;
            const items = [];
            if (listTag !== 'UL') items.push({ icon: '•', label: t('blockControl.bulleted'), action: () => ctrl.convertListType('UL') });
            if (listTag !== 'OL') items.push({ icon: '1.', label: t('blockControl.numbered'), action: () => ctrl.convertListType('OL') });
            groups.push({ label: t('blockControl.listType'), items });
        }

        // Actions.
        const actions = [
            { icon: '⊕', label: t('blockControl.insertBlockBelow'), action: () => ctrl.insertElementAfter() },
            { icon: '⧉', label: t('blockControl.duplicate'), action: () => ctrl.duplicateBlock() }
        ];
        if (!liteMode) {
            const attributes = ctrl.getModule('Attributes');
            if (attributes) {
                actions.push({
                    icon: '⚙',
                    label: t('blockControl.attributes'),
                    action: () => {
                        // A separator is edited through its <hr>.
                        let target = block;
                        if (target.classList.contains('redactix-separator')) {
                            target = target.querySelector('hr') || target;
                        }
                        attributes.openModal(target);
                    }
                });
            }
        }
        actions.push({ icon: '🗑', label: t('delete'), danger: true, action: () => ctrl.deleteBlock() });
        groups.push({ label: t('blockControl.actions'), items: actions });

        this.render(groups);
    }

    presetsFor(block) {
        if (block.tagName === 'ASIDE') {
            return { label: this.ctrl.t('blockControl.calloutStyle'), presets: this.ctrl.calloutPresets };
        }
        if (block.tagName === 'FIGURE' && block.classList.contains('quote-card')) {
            return { label: this.ctrl.t('blockControl.quoteStyle'), presets: this.ctrl.quotePresets };
        }
        return null;
    }

    render(groups) {
        this.el.innerHTML = '';
        groups.forEach((group, i) => {
            if (i > 0) {
                const divider = document.createElement('div');
                divider.className = 'redactix-menu-divider';
                this.el.appendChild(divider);
            }
            const groupEl = document.createElement('div');
            groupEl.className = 'redactix-menu-group';
            if (group.label) {
                const label = document.createElement('div');
                label.className = 'redactix-menu-group-label';
                label.textContent = group.label;
                groupEl.appendChild(label);
            }
            group.items.forEach(item => groupEl.appendChild(this.renderItem(item)));
            this.el.appendChild(groupEl);
        });
    }

    renderItem({ icon, label, action, danger = false, active = false }) {
        const item = document.createElement('div');
        item.className = 'redactix-menu-item' +
            (danger ? ' redactix-menu-item-danger' : '') +
            (active ? ' is-active' : '');
        item.setAttribute('role', 'menuitem');
        // Labels can come from user config (preset names) — text only.
        const iconEl = document.createElement('span');
        iconEl.className = 'redactix-menu-icon';
        iconEl.textContent = icon || '';
        const labelEl = document.createElement('span');
        labelEl.textContent = label;
        item.append(iconEl, labelEl);
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            this.hide();
            action();
        });
        return item;
    }
}
