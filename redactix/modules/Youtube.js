import Module from '../core/Module.js';
import Icons from '../ui/Icons.js';

export default class Youtube extends Module {
    getButtons() {
        return [
            {
                name: 'youtube',
                label: 'YT',
                icon: Icons.youtube,
                title: 'Insert YouTube Video',
                action: () => this.openModal()
            }
        ];
    }

    openModal() {
        this.instance.selection.save();

        const form = document.createElement('div');
        const urlGroup = this.createInputGroup('YouTube Video Link', 'text', '');
        form.append(urlGroup);

        this.instance.modal.open({
            title: 'YouTube',
            body: form,
            onSave: () => {
                const url = urlGroup.querySelector('input').value;
                const videoId = this.extractVideoId(url);

                if (videoId) {
                    this.instance.selection.restore();
                    this.insertVideo(videoId);
                    this.instance.sync();
                } else {
                    alert('Invalid YouTube URL');
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

    extractVideoId(url) {
        // Поддержка стандартных и коротких ссылок
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    }

    insertVideo(videoId) {
        const div = document.createElement('div');
        div.className = 'redactix-video-wrapper';
        
        const iframe = document.createElement('iframe');
        iframe.width = '560';
        iframe.height = '315';
        iframe.src = `https://www.youtube.com/embed/${videoId}`;
        iframe.frameBorder = '0';
        iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
        iframe.allowFullscreen = true;

        div.appendChild(iframe);

        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        
        const range = selection.getRangeAt(0);
        
        // Находим текущий блок
        let block = range.startContainer;
        while (block && block !== this.editor.el && ['P', 'DIV', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE'].indexOf(block.tagName) === -1) {
            block = block.parentElement;
        }

        // Создаем параграф для продолжения ввода
        const nextP = document.createElement('p');
        const br = document.createElement('br');
        nextP.appendChild(br);

        if (block && block !== this.editor.el) {
            // Если мы внутри блока, нужно его разбить
            const rangeAfter = range.cloneRange();
            rangeAfter.setStart(range.endContainer, range.endOffset);
            rangeAfter.setEndAfter(block.lastChild || block);
            
            const contentAfter = rangeAfter.extractContents();
            
            // Если в extracted content что-то есть (текст или элементы), переносим в nextP
            if (contentAfter.textContent.trim().length > 0 || contentAfter.querySelector('img, iframe, br')) {
                 nextP.innerHTML = ''; // очищаем br
                 nextP.appendChild(contentAfter);
            }
            
            // Вставляем видео после текущего блока
            if (block.nextSibling) {
                block.parentNode.insertBefore(div, block.nextSibling);
            } else {
                block.parentNode.appendChild(div);
            }
            
            // Вставляем следующий параграф после видео
            if (div.nextSibling) {
                div.parentNode.insertBefore(nextP, div.nextSibling);
            } else {
                div.parentNode.appendChild(nextP);
            }

            // Проверяем, не остался ли старый блок пустым
            // Если он пуст (нет текста и нет значимых тегов), удаляем его
            const isEmptyText = block.textContent.trim().length === 0;
            const hasSignificantChildren = block.querySelector('img, iframe, hr, table, video');
            
            if (isEmptyText && !hasSignificantChildren) {
                block.parentNode.removeChild(block);
            }

        } else {
            // Если мы в корне или непонятно где
            range.insertNode(div);
            range.collapse(false);
            
            if (div.nextSibling) {
                div.parentNode.insertBefore(nextP, div.nextSibling);
            } else {
                div.parentNode.appendChild(nextP);
            }
        }

        // Ставим курсор в новый параграф
        const newRange = document.createRange();
        newRange.setStart(nextP, 0);
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);
        
        this.instance.sync();
    }
}
