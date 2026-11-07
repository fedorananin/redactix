import Module from '../core/Module.js';
import Icons from '../ui/Icons.js';
import { selectGroup, textareaGroup } from '../ui/form-helpers.js';

const LANGUAGES = [
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
];

// language-xxx (HTML spec convention) and lang-xxx (highlight.js / prism alias).
const LANGUAGE_CLASS = /^(?:language|lang)-(.+)$/;

export default class Code extends Module {
    static moduleName = 'Code';

    constructor(instance) {
        super(instance);
        this.currentCodeBlock = null;
    }

    init() {
        // Click on code block to edit
        this.instance.editorEl.addEventListener('click', (e) => {
            const pre = e.target.closest ? e.target.closest('pre') : null;
            if (pre && this.instance.editorEl.contains(pre)) {
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
                title: this.t('toolbar.insertCode'),
                action: () => this.openModal()
            }
        ];
    }

    /** Language of a <code> element from its class, or ''. */
    getLanguage(codeEl) {
        if (!codeEl) return '';
        for (const cls of codeEl.classList) {
            const m = cls.match(LANGUAGE_CLASS);
            if (m) return m[1];
        }
        return '';
    }

    openModal(existingPre = null) {
        this.instance.selection.save();
        this.currentCodeBlock = existingPre;

        const isEditing = !!existingPre;
        let existingCode = '';
        let existingLanguage = '';

        if (existingPre) {
            const codeEl = existingPre.querySelector('code');
            existingCode = (codeEl || existingPre).textContent || '';
            existingLanguage = this.getLanguage(codeEl);
        }

        const form = document.createElement('div');

        // An unlisted language (diff, jsx, …) is kept as an extra option.
        const languageGroup = selectGroup(this.t('code.language'), existingLanguage, [
            { value: '', label: this.t('code.languageNone') },
            ...LANGUAGES
        ]);
        const languageSelect = languageGroup.field;

        const codeGroup = textareaGroup(this.t('code.code'), existingCode, {
            rows: 10,
            placeholder: this.t('code.codePlaceholder')
        });
        const codeTextarea = codeGroup.field;
        codeTextarea.classList.add('redactix-code-input');
        codeTextarea.spellcheck = false;

        // Tab inserts two spaces. insertText keeps the textarea's native
        // undo stack intact (assigning .value wipes it); setRangeText is
        // the fallback where execCommand isn't supported.
        codeTextarea.addEventListener('keydown', (e) => {
            if (e.key !== 'Tab' || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
            e.preventDefault();
            const ok = document.queryCommandSupported && document.queryCommandSupported('insertText') &&
                document.execCommand('insertText', false, '  ');
            if (!ok) codeTextarea.setRangeText('  ', codeTextarea.selectionStart, codeTextarea.selectionEnd, 'end');
        });

        form.append(languageGroup, codeGroup);

        const extraButtons = [];
        if (isEditing) {
            extraButtons.push({
                text: this.t('code.removeCodeBlock'),
                danger: true,
                onClick: () => {
                    if (existingPre && this.instance.editorEl.contains(existingPre)) {
                        this.transact(() => existingPre.remove());
                    }
                    this.instance.modal.close();
                }
            });
        }

        this.instance.modal.open({
            title: isEditing ? this.t('code.editTitle') : this.t('code.title'),
            body: form,
            extraButtons,
            onSave: () => {
                const language = languageSelect.value;
                const code = codeTextarea.value;
                if (!code.trim()) return;

                if (isEditing) {
                    // Deleted / replaced (undo) while the modal was open.
                    if (!this.instance.editorEl.contains(existingPre)) return;
                    this.updateCodeBlock(existingPre, code, language);
                } else {
                    this.instance.selection.restore();
                    this.insertCodeBlock(code, language);
                }
            }
        });
    }

    /** Insert a code block at the caret (one undo step). */
    insertCodeBlock(code, language) {
        const pre = document.createElement('pre');
        pre.contentEditable = 'false';

        const codeEl = document.createElement('code');
        this.setLanguage(codeEl, language);
        codeEl.textContent = code;
        pre.appendChild(codeEl);

        // insertNode applies the container rules (a <pre> can't live in a
        // callout / quote-card / list → it lands after it) and puts the
        // caret in the next editable block.
        this.transact(() => {
            this.instance.selection.insertNode(pre);
            if (!pre.parentNode) this.instance.editorEl.appendChild(pre);
        });
        return pre;
    }

    /** Update code and language of an existing block (one undo step). */
    updateCodeBlock(pre, code, language) {
        this.transact(() => {
            let codeEl = pre.querySelector('code');
            if (!codeEl) {
                codeEl = document.createElement('code');
                pre.innerHTML = '';
                pre.appendChild(codeEl);
            }
            this.setLanguage(codeEl, language);
            codeEl.textContent = code;
        });
    }

    /** Swap the language class, keeping any other classes on <code>. */
    setLanguage(codeEl, language) {
        Array.from(codeEl.classList).forEach(cls => {
            if (LANGUAGE_CLASS.test(cls)) codeEl.classList.remove(cls);
        });
        if (language) codeEl.classList.add(`language-${language}`);
        if (codeEl.classList.length === 0) codeEl.removeAttribute('class');
    }
}
