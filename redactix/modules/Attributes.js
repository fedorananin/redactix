import Module from '../core/Module.js';
import { inputGroup, checkbox, statusLine } from '../ui/form-helpers.js';

// Classes the editor itself relies on. A user typing one of them into the
// class field could silently break content: `redactix-separator` on a <p>
// makes sync delete the paragraph, `redactix-find-highlight` flattens a
// block on the next search … so they can't be added by hand. Ones the
// element already carries are kept untouched (and not shown in the field).
const RESERVED_CLASS_PREFIX = 'redactix-';
const RESERVED_CLASSES = ['quote-card'];
// Allowed only on a specific tag.
const TAG_BOUND_CLASSES = { spoiler: 'SPAN' };

export default class Attributes extends Module {
    static moduleName = 'Attributes';

    getButtons() {
        return [];
    }

    isReservedClass(cls) {
        return cls.startsWith(RESERVED_CLASS_PREFIX) || RESERVED_CLASSES.includes(cls);
    }

    openModal(targetNode = null) {
        if (!targetNode) {
            this.instance.selection.save();

            const selection = window.getSelection();
            if (!selection.rangeCount) return;

            targetNode = selection.getRangeAt(0).commonAncestorContainer;
        }

        let currentNode = targetNode;
        if (currentNode.nodeType === Node.TEXT_NODE) currentNode = currentNode.parentNode;

        const root = this.instance.editorEl;
        if (!currentNode || currentNode === root || !root.contains(currentNode)) return;

        // Build ancestry path
        const path = [];
        let temp = currentNode;
        while (temp && temp !== root) {
            if (temp.nodeType === Node.ELEMENT_NODE) {
                // Skip utility wrappers and editor UI
                const isUtility = temp.classList.contains('redactix-separator') ||
                    temp.classList.contains('redactix-find-highlight') ||
                    temp.hasAttribute('data-redactix-ui');
                if (!isUtility) path.unshift(temp);
            }
            temp = temp.parentNode;
        }

        if (path.length === 0) return;

        // State
        let selectedNode = path[path.length - 1];

        // Body Container
        const body = document.createElement('div');
        body.className = 'redactix-attributes';

        // Breadcrumbs
        const nav = document.createElement('div');
        nav.className = 'redactix-attr-nav';

        // Form Container
        const formContainer = document.createElement('div');

        // References for saving
        let classInput = null;
        let idInput = null;
        let status = null;

        const render = () => {
            // 1. Render Breadcrumbs
            nav.innerHTML = '';
            path.forEach((node, index) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'redactix-attr-crumb' + (node === selectedNode ? ' is-active' : '');
                btn.textContent = node.tagName.toLowerCase();
                btn.addEventListener('click', () => {
                    selectedNode = node;
                    render();
                });
                nav.appendChild(btn);

                // Separator
                if (index < path.length - 1) {
                    const sep = document.createElement('span');
                    sep.className = 'redactix-attr-sep';
                    sep.textContent = '›';
                    nav.appendChild(sep);
                }
            });

            // 2. Render Form
            formContainer.innerHTML = '';

            // Info text — built from nodes, never from interpolated markup
            const info = document.createElement('p');
            info.className = 'redactix-attr-info';
            const tagLabel = document.createElement('b');
            tagLabel.textContent = '<' + selectedNode.tagName.toLowerCase() + '>';
            info.append(this.t('attributes.editing') + ': ', tagLabel);
            formContainer.appendChild(info);

            // ID Input (anchor)
            const idGroup = inputGroup(this.t('attributes.idAnchor'), 'text', selectedNode.id || '', {
                placeholder: this.t('attributes.idPlaceholder')
            });
            idInput = idGroup.field;
            formContainer.appendChild(idGroup);

            // Anchor hint. The id comes from document content, which may
            // have been written by someone else — text only.
            if (selectedNode.id) {
                const anchorHint = document.createElement('div');
                anchorHint.className = 'redactix-attr-hint';
                const code = document.createElement('code');
                code.textContent = '#' + selectedNode.id;
                anchorHint.append(this.t('attributes.linkPrefix') + ': ', code);
                formContainer.appendChild(anchorHint);
            }

            // Class Input — editor-internal classes are not shown
            const userClasses = Array.from(selectedNode.classList).filter(c => !this.isReservedClass(c));
            const classGroup = inputGroup(this.t('attributes.classes'), 'text', userClasses.join(' '));
            classInput = classGroup.field;
            formContainer.appendChild(classGroup);

            status = statusLine('', { error: true });
            formContainer.appendChild(status);
            classInput.addEventListener('input', () => { status.textContent = ''; });

            // Predefined classes (shown only if the array is set and not empty)
            const predefined = this.instance.config.predefinedClasses;
            if (predefined && Array.isArray(predefined) && predefined.length > 0) {
                const listDiv = document.createElement('div');
                listDiv.className = 'redactix-attr-quick';
                const listLabel = document.createElement('label');
                listLabel.textContent = this.t('attributes.quickSelect') + ':';
                listDiv.appendChild(listLabel);

                const row = document.createElement('div');
                row.className = 'redactix-checkbox-row';
                predefined.forEach(cls => {
                    const box = checkbox(cls, userClasses.includes(cls));
                    box.field.value = cls;
                    box.field.addEventListener('change', () => {
                        const classes = classInput.value.split(/\s+/).filter(c => c && c !== cls);
                        if (box.field.checked) classes.push(cls);
                        classInput.value = classes.join(' ');
                        status.textContent = '';
                    });
                    row.appendChild(box);
                });
                listDiv.appendChild(row);
                formContainer.appendChild(listDiv);
            }
        };

        // Initial render
        body.appendChild(nav);
        body.appendChild(formContainer);
        render();

        this.instance.modal.open({
            title: this.t('attributes.title'),
            body: body,
            onSave: () => {
                if (!selectedNode || !selectedNode.isConnected) return;

                // Validate classes before touching anything
                const requested = classInput ? classInput.value.split(/\s+/).filter(Boolean) : [];
                const rejected = requested.filter(cls => {
                    if (this.isReservedClass(cls)) return true;
                    const tag = TAG_BOUND_CLASSES[cls];
                    return !!tag && selectedNode.tagName !== tag;
                });
                if (rejected.length) {
                    status.textContent = this.t('attributes.reservedClass', { classes: rejected.join(', ') });
                    classInput.focus();
                    return false;
                }

                this.instance.selection.restore();
                this.transact(() => {
                    // Save ID
                    if (idInput) {
                        const newId = this.sanitizeId(idInput.value);
                        if (newId) {
                            selectedNode.id = newId;
                        } else {
                            selectedNode.removeAttribute('id');
                        }
                    }

                    // Save classes, keeping the editor's own ones
                    if (classInput) {
                        const kept = Array.from(selectedNode.classList).filter(c => this.isReservedClass(c));
                        const classes = [...new Set([...kept, ...requested])];
                        if (classes.length) {
                            selectedNode.className = classes.join(' ');
                        } else {
                            selectedNode.removeAttribute('class');
                        }
                    }
                });
            }
        });
    }

    /**
     * Normalise an anchor id: no leading '#', whitespace → '-', only
     * letters / digits of any script plus '-' and '_' (Cyrillic and other
     * non-ASCII anchors used to vanish entirely).
     */
    sanitizeId(id) {
        if (!id) return '';
        return id
            .trim()
            .replace(/^#+/, '')
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^\p{L}\p{M}\p{N}_-]/gu, '')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
    }
}
