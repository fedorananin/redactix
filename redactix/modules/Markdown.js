import Module from '../core/Module.js';

export default class Markdown extends Module {
    init() {
        this.editor.el.addEventListener('keyup', (e) => this.handleInput(e));
    }

    handleInput(e) {
        // Реагируем на пробел
        if (e.key !== ' ' && e.keyCode !== 32) return;

        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        const node = range.startContainer;

        // Работаем только с текстовыми узлами
        if (node.nodeType !== Node.TEXT_NODE) return;

        const text = node.textContent.replace(/\u00A0/g, ' ');

        const rules = [
            { regex: /^#\s/, command: 'formatBlock', value: '<h1>' },
            { regex: /^##\s/, command: 'formatBlock', value: '<h2>' },
            { regex: /^###\s$/, command: 'formatBlock', value: '<h3>' },
            { regex: /^\*\s$/, command: 'insertUnorderedList', value: null },
            { regex: /^-\s$/, command: 'insertUnorderedList', value: null },
            { regex: /^1\.\s$/, command: 'insertOrderedList', value: null },
            { regex: /^>\s$/, command: 'formatBlock', value: '<blockquote>' },
            { regex: /^!\s$/, command: 'formatBlock', value: '<aside>' },
            { regex: /^---\s$/, command: 'insertSeparator', value: null }
        ];

        for (const rule of rules) {
            if (rule.regex.test(text)) {
                // 1. Списки (вложенность)
                const parentListItem = node.parentElement.closest('li');
                if (parentListItem && (rule.command === 'insertUnorderedList' || rule.command === 'insertOrderedList')) {
                    const matchLength = text.match(rule.regex)[0].length;
                    node.textContent = node.textContent.substring(matchLength);
                    document.execCommand('indent');
                    e.preventDefault();
                    return;
                }

                const matchLength = text.match(rule.regex)[0].length;

                // COMMON LOGIC: Identify Block & Split
                let block = node.parentElement;
                while (block && ['P', 'DIV', 'BLOCKQUOTE', 'LI'].indexOf(block.tagName) === -1 && block !== this.editor.el) {
                    block = block.parentElement;
                }
                if (!block) block = this.editor.el;

                // Handle Splitting (if not at start)
                if (block !== this.editor.el) {
                    let needSplit = false;
                    let prev = node.previousSibling;
                    while (prev) {
                        if ((prev.nodeType === Node.ELEMENT_NODE && prev.tagName === 'BR') ||
                            (prev.nodeType === Node.TEXT_NODE && prev.textContent.trim().length > 0) ||
                            (prev.nodeType === Node.ELEMENT_NODE)) {
                            needSplit = true;
                            break;
                        }
                        prev = prev.previousSibling;
                    }

                    if (needSplit) {
                        const newBlock = block.cloneNode(false);
                        newBlock.removeAttribute('id');

                        if (block.nextSibling) {
                            block.parentNode.insertBefore(newBlock, block.nextSibling);
                        } else {
                            block.parentNode.appendChild(newBlock);
                        }

                        const siblingsToMove = [];
                        let curr = node;
                        while (curr) {
                            siblingsToMove.push(curr);
                            curr = curr.nextSibling;
                        }
                        siblingsToMove.forEach(s => newBlock.appendChild(s));

                        block = newBlock;
                    }
                } else {
                    // Root case: Wrap current line in a P
                    const p = document.createElement('p');
                    node.parentNode.insertBefore(p, node);
                    p.appendChild(node);

                    let next = p.nextSibling;
                    while (next) {
                        const candidate = next;
                        next = next.nextSibling;
                        if (candidate.nodeType === Node.ELEMENT_NODE && candidate.tagName === 'BR') {
                            candidate.parentNode.removeChild(candidate);
                            break;
                        }
                        p.appendChild(candidate);
                    }
                    block = p;
                }

                // 2. FormatBlock Specifics
                if (rule.command === 'formatBlock') {
                    const tagName = rule.value.replace(/[<>]/g, '');
                    const newEl = document.createElement(tagName);

                    block.parentNode.insertBefore(newEl, block);
                    while (block.firstChild) {
                        newEl.appendChild(block.firstChild);
                    }
                    block.parentNode.removeChild(block);

                    if (node.textContent.length >= matchLength) {
                        node.textContent = node.textContent.substring(matchLength);
                    }

                    const hasContent = newEl.textContent.trim().length > 0 || newEl.querySelector('img, iframe');
                    let brAdded = false;
                    if (!hasContent) {
                        const br = document.createElement('br');
                        newEl.appendChild(br);
                        brAdded = true;
                    }

                    const newRange = document.createRange();
                    newRange.setStart(node, 0);
                    newRange.collapse(true);

                    const sel = window.getSelection();
                    sel.removeAllRanges();
                    sel.addRange(newRange);

                    e.preventDefault();

                    return;
                }

                // 3. Separator (hr)
                if (rule.command === 'insertSeparator') {
                    // Создаём обёртку с hr
                    const wrapper = document.createElement('div');
                    wrapper.className = 'redactix-separator';
                    wrapper.contentEditable = 'false';
                    const hr = document.createElement('hr');
                    wrapper.appendChild(hr);

                    // Создаём параграф для продолжения ввода
                    const nextP = document.createElement('p');
                    nextP.innerHTML = '<br>';

                    // Очищаем текст в блоке
                    if (node.textContent.length >= matchLength) {
                        node.textContent = node.textContent.substring(matchLength);
                    }

                    // Если после очистки блок пустой, заменяем его на separator
                    const isEmpty = !block.textContent.trim() && !block.querySelector('img, iframe');

                    if (isEmpty) {
                        block.parentNode.replaceChild(wrapper, block);
                        wrapper.parentNode.insertBefore(nextP, wrapper.nextSibling);
                    } else {
                        // Если в блоке остался контент, вставляем separator перед ним
                        block.parentNode.insertBefore(wrapper, block);
                        block.parentNode.insertBefore(nextP, block);
                    }

                    // Ставим курсор в новый параграф
                    const newRange = document.createRange();
                    newRange.setStart(nextP, 0);
                    newRange.collapse(true);

                    const sel = window.getSelection();
                    sel.removeAllRanges();
                    sel.addRange(newRange);

                    // Оборачиваем все hr в обёртки (для консистентности)
                    this.editor.el.querySelectorAll('hr').forEach(h => {
                        if (!h.parentNode.classList.contains('redactix-separator')) {
                            const w = document.createElement('div');
                            w.className = 'redactix-separator';
                            w.contentEditable = 'false';
                            h.parentNode.replaceChild(w, h);
                            w.appendChild(h);
                        }
                    });

                    this.instance.sync();
                    e.preventDefault();
                    return;
                }

                // 4. Lists (Manual Creation)
                if (rule.command === 'insertUnorderedList' || rule.command === 'insertOrderedList') {
                    const listTag = rule.command === 'insertUnorderedList' ? 'ul' : 'ol';
                    const listEl = document.createElement(listTag);
                    const liEl = document.createElement('li');

                    listEl.appendChild(liEl);

                    // Move content from block to li
                    while (block.firstChild) {
                        liEl.appendChild(block.firstChild);
                    }

                    // Replace block with list
                    block.parentNode.replaceChild(listEl, block);

                    // Check for merge with previous list
                    const previousSibling = listEl.previousElementSibling;
                    if (previousSibling && previousSibling.tagName.toLowerCase() === listTag) {
                        previousSibling.appendChild(liEl);
                        listEl.parentNode.removeChild(listEl);
                    }

                    // Clean text
                    if (node.textContent.length >= matchLength) {
                        node.textContent = node.textContent.substring(matchLength);
                    }

                    // Restore cursor
                    const newRange = document.createRange();
                    newRange.setStart(node, 0);
                    newRange.collapse(true);

                    const sel = window.getSelection();
                    sel.removeAllRanges();
                    sel.addRange(newRange);

                    e.preventDefault();
                    return;
                }
            }
        }
    }
}