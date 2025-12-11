import Module from '../core/Module.js';
import Icons from '../ui/Icons.js';

export default class Attributes extends Module {
    getButtons() {
        return [];
    }

    openModal(targetNode = null) {
        if (!targetNode) {
            this.instance.selection.save();
            
            const selection = window.getSelection();
            if (!selection.rangeCount) return;
            
            targetNode = selection.getRangeAt(0).commonAncestorContainer;
        }

        let currentNode = targetNode;
        if (currentNode.nodeType === 3) currentNode = currentNode.parentNode;
        
        // Build ancestry path
        const path = [];
        let temp = currentNode;
        while (temp && temp !== this.editor.el) {
            if (temp.nodeType === 1) { 
                // Пропускаем служебные обертки
                if (!temp.classList.contains('redactix-separator')) {
                    path.unshift(temp);
                }
            }
            temp = temp.parentNode;
        }

        if (path.length === 0) {
            // Если ничего не выбрано или мы в корне
            path.push(currentNode.nodeType === 1 ? currentNode : currentNode.parentNode);
        }

        // State
        let selectedNode = path[path.length - 1];
        
        // Body Container
        const body = document.createElement('div');
        
        // Breadcrumbs
        const nav = document.createElement('div');
        nav.style.marginBottom = '15px';
        nav.style.display = 'flex';
        nav.style.gap = '5px';
        nav.style.flexWrap = 'wrap';
        nav.style.borderBottom = '1px solid #eee';
        nav.style.paddingBottom = '10px';

        // Form Container
        const formContainer = document.createElement('div');
        
        // References for saving
        let classInput = null;
        let idInput = null;

        const render = () => {
            // 1. Render Breadcrumbs
            nav.innerHTML = '';
            path.forEach((node, index) => {
                const btn = document.createElement('button');
                btn.textContent = node.tagName.toLowerCase();
                btn.type = 'button';
                btn.style.border = '1px solid #ddd';
                btn.style.background = node === selectedNode ? '#007bff' : '#f8f9fa';
                btn.style.color = node === selectedNode ? '#fff' : '#333';
                btn.style.borderRadius = '4px';
                btn.style.padding = '2px 8px';
                btn.style.cursor = 'pointer';
                btn.style.fontSize = '12px';
                
                btn.onclick = () => {
                    selectedNode = node;
                    render();
                };

                nav.appendChild(btn);
                
                // Separator
                if (index < path.length - 1) {
                    const sep = document.createElement('span');
                    sep.textContent = '›';
                    sep.style.color = '#999';
                    sep.style.padding = '2px';
                    nav.appendChild(sep);
                }
            });

            // 2. Render Form
            formContainer.innerHTML = '';
            
            // Info text
            const info = document.createElement('p');
            info.innerHTML = `Editing: <b>&lt;${selectedNode.tagName.toLowerCase()}&gt;</b>`;
            info.style.marginTop = '0';
            info.style.marginBottom = '10px';
            info.style.color = '#666';
            formContainer.appendChild(info);

            // ID Input (якорь)
            const idGroup = this.createInputGroup('ID (Anchor)', 'text', selectedNode.id || '');
            idInput = idGroup.querySelector('input');
            idInput.placeholder = 'example-anchor';
            formContainer.appendChild(idGroup);
            
            // Подсказка для якоря
            if (selectedNode.id) {
                const anchorHint = document.createElement('div');
                anchorHint.style.cssText = 'margin-bottom: 15px; font-size: 12px; color: #6b7280;';
                anchorHint.innerHTML = `Link: <code style="background: #e5e7eb; padding: 2px 6px; border-radius: 3px;">#${selectedNode.id}</code>`;
                formContainer.appendChild(anchorHint);
            }

            // Class Input
            const classGroup = this.createInputGroup('Classes (space separated)', 'text', selectedNode.className);
            classInput = classGroup.querySelector('input');
            formContainer.appendChild(classGroup);

            // Predefined classes (показываем только если массив задан и не пустой)
            const predefined = this.instance.config.predefinedClasses;
            if (predefined && Array.isArray(predefined) && predefined.length > 0) {
                const listDiv = document.createElement('div');
                listDiv.style.marginTop = '10px';
                const listLabel = document.createElement('label');
                listLabel.textContent = 'Quick select:';
                listLabel.style.display = 'block';
                listLabel.style.marginBottom = '5px';
                listDiv.appendChild(listLabel);

                const currentClasses = selectedNode.className.split(/\s+/);

                predefined.forEach(cls => {
                    const label = document.createElement('label');
                    label.style.fontWeight = 'normal';
                    label.style.display = 'inline-flex';
                    label.style.alignItems = 'center';
                    label.style.marginRight = '10px';
                    label.style.cursor = 'pointer';

                    const check = document.createElement('input');
                    check.type = 'checkbox';
                    check.style.marginRight = '4px';
                    check.value = cls;
                    check.checked = currentClasses.includes(cls);

                    check.addEventListener('change', () => {
                        let classes = classInput.value.split(/\s+/).filter(c => c && c !== cls);
                        if (check.checked) classes.push(cls);
                        classInput.value = classes.join(' ');
                    });

                    label.append(check, cls);
                    listDiv.appendChild(label);
                });
                formContainer.appendChild(listDiv);
            }
        };

        // Initial render
        body.appendChild(nav);
        body.appendChild(formContainer);
        render();

        this.instance.modal.open({
            title: 'Element Attributes',
            body: body,
            onSave: () => {
                this.instance.selection.restore();
                if (selectedNode) {
                    // Сохраняем ID
                    if (idInput) {
                        const newId = this.sanitizeId(idInput.value);
                        if (newId) {
                            selectedNode.id = newId;
                        } else {
                            selectedNode.removeAttribute('id');
                        }
                    }
                    
                    // Сохраняем классы
                    if (classInput) {
                        const classValue = classInput.value.trim();
                        if (classValue) {
                            selectedNode.className = classValue;
                        } else {
                            selectedNode.removeAttribute('class');
                        }
                    }
                    
                    this.instance.sync();
                }
            }
        });
    }

    createInputGroup(labelText, type, value) {
        const div = document.createElement('div');
        const label = document.createElement('label');
        label.textContent = labelText;
        const input = document.createElement('input');
        input.type = type;
        input.value = value;
        div.append(label, input);
        return div;
    }

    sanitizeId(id) {
        if (!id) return '';
        // Убираем # в начале если есть
        id = id.replace(/^#/, '');
        // Заменяем пробелы на дефисы, убираем спецсимволы
        id = id.toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-_]/g, '')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
        return id;
    }

    getTargetNode() {
        const selection = window.getSelection();
        if (!selection.rangeCount) return null;

        const range = selection.getRangeAt(0);
        
        // 1. Проверяем, выбрана ли картинка напрямую (commonContainer)
        // В некоторых браузерах img выбирается как содержимое range
        if (range.commonAncestorContainer.nodeType === 1 && 
            range.commonAncestorContainer.tagName === 'IMG') {
            return range.commonAncestorContainer;
        }

        // 2. Проверяем родительские элементы (снизу вверх)
        let node = range.commonAncestorContainer;
        if (node.nodeType === 3) node = node.parentNode; // Если текст, берем родителя

        // Ищем ближайший значащий тег
        while (node && node !== this.editor.el) {
            const tag = node.tagName.toLowerCase();
            // Если мы внутри ссылки, кнопки, картинки (wrapper), таблицы - возвращаем их
            if (['a', 'img', 'table', 'iframe', 'li', 'td', 'th', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'blockquote', 'pre'].includes(tag)) {
                return node;
            }
            node = node.parentNode;
        }
        
        // Если ничего специфичного не нашли, возвращаем сам блок (обычно P или DIV)
        return node === this.editor.el ? null : node;
    }
}
