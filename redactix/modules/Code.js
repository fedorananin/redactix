import Module from '../core/Module.js';
import Icons from '../ui/Icons.js';

export default class Code extends Module {
    constructor(instance) {
        super(instance);
        this.currentCodeBlock = null;
    }

    init() {
        // Клик по блоку кода для редактирования
        this.instance.editorEl.addEventListener('click', (e) => {
            const pre = e.target.closest('pre');
            if (pre) {
                e.preventDefault();
                this.openModal(pre);
            }
        });
    }

    getButtons() {
        return [
            {
                name: 'codeblock',
                label: 'Code',
                icon: Icons.codeblock,
                title: 'Insert Code Block',
                action: () => this.openModal()
            }
        ];
    }

    openModal(existingPre = null) {
        this.instance.selection.save();
        this.currentCodeBlock = existingPre;
        
        const isEditing = !!existingPre;
        let existingCode = '';
        let existingLanguage = '';
        
        if (existingPre) {
            const codeEl = existingPre.querySelector('code');
            if (codeEl) {
                existingCode = codeEl.textContent || '';
                // Извлекаем язык из класса
                const classList = codeEl.className.split(' ');
                for (const cls of classList) {
                    if (cls.startsWith('language-')) {
                        existingLanguage = cls.replace('language-', '');
                        break;
                    }
                }
            } else {
                existingCode = existingPre.textContent || '';
            }
        }

        const form = document.createElement('div');
        
        // Выбор языка
        const languageGroup = this.createSelectGroup('Programming Language', existingLanguage, [
            { value: '', label: 'None' },
            { value: 'javascript', label: 'JavaScript' },
            { value: 'typescript', label: 'TypeScript' },
            { value: 'html', label: 'HTML' },
            { value: 'css', label: 'CSS' },
            { value: 'python', label: 'Python' },
            { value: 'php', label: 'PHP' },
            { value: 'java', label: 'Java' },
            { value: 'csharp', label: 'C#' },
            { value: 'cpp', label: 'C++' },
            { value: 'c', label: 'C' },
            { value: 'go', label: 'Go' },
            { value: 'rust', label: 'Rust' },
            { value: 'ruby', label: 'Ruby' },
            { value: 'swift', label: 'Swift' },
            { value: 'kotlin', label: 'Kotlin' },
            { value: 'sql', label: 'SQL' },
            { value: 'bash', label: 'Bash/Shell' },
            { value: 'json', label: 'JSON' },
            { value: 'xml', label: 'XML' },
            { value: 'yaml', label: 'YAML' },
            { value: 'markdown', label: 'Markdown' }
        ]);
        const languageSelect = languageGroup.querySelector('select');

        // Textarea для кода
        const codeGroup = this.createTextareaGroup('Code', existingCode);
        const codeTextarea = codeGroup.querySelector('textarea');
        codeTextarea.style.fontFamily = "'SF Mono', 'Consolas', 'Monaco', monospace";
        codeTextarea.style.minHeight = '200px';
        codeTextarea.style.tabSize = '2';
        codeTextarea.placeholder = 'Paste your code here...';
        
        // Обработка Tab в textarea
        codeTextarea.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = codeTextarea.selectionStart;
                const end = codeTextarea.selectionEnd;
                codeTextarea.value = codeTextarea.value.substring(0, start) + '  ' + codeTextarea.value.substring(end);
                codeTextarea.selectionStart = codeTextarea.selectionEnd = start + 2;
            }
        });
        
        // Кнопка удаления (при редактировании)
        if (isEditing) {
            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.textContent = 'Remove Code Block';
            removeBtn.style.marginTop = '15px';
            removeBtn.style.background = '#dc2626';
            removeBtn.style.color = 'white';
            removeBtn.style.border = 'none';
            removeBtn.style.padding = '8px 16px';
            removeBtn.style.borderRadius = '4px';
            removeBtn.style.cursor = 'pointer';
            removeBtn.addEventListener('click', () => {
                if (existingPre) {
                    existingPre.remove();
                    this.instance.sync();
                }
                this.instance.modal.close();
            });
            form.append(languageGroup, codeGroup, removeBtn);
        } else {
            form.append(languageGroup, codeGroup);
        }

        this.instance.modal.open({
            title: isEditing ? 'Edit Code Block' : 'Insert Code Block',
            body: form,
            onSave: () => {
                const language = languageSelect.value;
                const code = codeTextarea.value;

                if (code.trim()) {
                    if (isEditing && existingPre) {
                        this.updateCodeBlock(existingPre, code, language);
                    } else {
                        this.instance.selection.restore();
                        this.insertCodeBlock(code, language);
                    }
                    this.instance.sync();
                }
            }
        });
    }

    createSelectGroup(labelText, value = '', options = []) {
        const div = document.createElement('div');
        const label = document.createElement('label');
        label.textContent = labelText;
        const select = document.createElement('select');
        select.style.width = '100%';
        select.style.padding = '10px 12px';
        select.style.marginBottom = '16px';
        select.style.boxSizing = 'border-box';
        select.style.border = '1px solid #e5e7eb';
        select.style.borderRadius = '6px';
        select.style.fontSize = '14px';
        
        options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.label;
            if (opt.value === value) {
                option.selected = true;
            }
            select.appendChild(option);
        });
        
        div.append(label, select);
        return div;
    }

    createTextareaGroup(labelText, value = '') {
        const div = document.createElement('div');
        const label = document.createElement('label');
        label.textContent = labelText;
        const textarea = document.createElement('textarea');
        textarea.value = value;
        textarea.style.width = '100%';
        textarea.style.minHeight = '100px';
        textarea.style.padding = '8px';
        textarea.style.border = '1px solid #e5e7eb';
        textarea.style.borderRadius = '6px';
        textarea.style.fontFamily = 'inherit';
        textarea.style.fontSize = '14px';
        textarea.style.resize = 'vertical';
        textarea.style.boxSizing = 'border-box';
        div.append(label, textarea);
        return div;
    }

    insertCodeBlock(code, language) {
        const pre = document.createElement('pre');
        pre.contentEditable = 'false';
        
        const codeEl = document.createElement('code');
        if (language) {
            codeEl.className = `language-${language}`;
        }
        codeEl.textContent = code;
        pre.appendChild(codeEl);
        
        this.instance.selection.insertNode(pre);
    }

    updateCodeBlock(pre, code, language) {
        let codeEl = pre.querySelector('code');
        if (!codeEl) {
            codeEl = document.createElement('code');
            pre.innerHTML = '';
            pre.appendChild(codeEl);
        }
        
        codeEl.className = language ? `language-${language}` : '';
        codeEl.textContent = code;
    }
}
