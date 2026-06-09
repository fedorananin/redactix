import Module from '../core/Module.js';
import Icons from '../ui/Icons.js';
import { sanitizeUrl, composeLinkRel } from '../core/dom-utils.js';

export default class Link extends Module {
    // Кнопка убрана - ссылки через floating toolbar
    getButtons() {
        return [];
    }

    openModal() {
        // 1. Сохраняем выделение, чтобы не потерять место вставки
        this.instance.selection.save();

        const range = this.instance.selection.getRange();
        const selectedText = range ? range.toString() : '';

        // 2. Создаем форму
        const form = document.createElement('div');
        
        // URL
        const urlGroup = this.createInputGroup(this.t('link.url'), 'text', 'https://');
        const urlInput = urlGroup.querySelector('input');
        
        // Text (если текст не выделен, даем возможность его ввести)
        const textGroup = this.createInputGroup(this.t('link.linkText'), 'text', selectedText);
        const textInput = textGroup.querySelector('input');
        
        // Checkboxes
        const checksDiv = document.createElement('div');
        checksDiv.style.marginTop = '10px';

        const targetLabel = document.createElement('label');
        targetLabel.style.fontWeight = 'normal';
        targetLabel.style.display = 'inline-block';
        targetLabel.style.marginRight = '15px';
        const targetCheck = document.createElement('input');
        targetCheck.type = 'checkbox';
        targetCheck.style.width = 'auto';
        targetCheck.style.marginRight = '5px';
        targetLabel.append(targetCheck, this.t('link.openNewWindow'));

        const nofollowLabel = document.createElement('label');
        nofollowLabel.style.fontWeight = 'normal';
        nofollowLabel.style.display = 'inline-block';
        const nofollowCheck = document.createElement('input');
        nofollowCheck.type = 'checkbox';
        nofollowCheck.style.width = 'auto';
        nofollowCheck.style.marginRight = '5px';
        nofollowLabel.append(nofollowCheck, this.t('link.nofollow'));

        checksDiv.append(targetLabel, nofollowLabel);

        form.append(urlGroup, textGroup, checksDiv);

        // 3. Открываем модалку
        this.instance.modal.open({
            title: this.t('link.title'),
            body: form,
            onSave: () => {
                const url = urlInput.value;
                const text = textInput.value || url;
                
                if (url) {
                    this.instance.selection.restore();
                    this.insertLink(url, text, targetCheck.checked, nofollowCheck.checked);
                    this.instance.sync();
                }
            }
        });
    }

    createInputGroup(labelText, type, value = '') {
        const div = document.createElement('div');
        const label = document.createElement('label');
        label.textContent = labelText;
        const input = document.createElement('input');
        input.type = type;
        input.value = value;
        div.append(label, input);
        return div;
    }

    insertLink(url, text, isBlank, isNofollow) {
        // Валидируем схему URL — отсекает javascript:, data:text/html и т.п.
        const safeUrl = sanitizeUrl(url);
        if (!safeUrl) return;

        const a = document.createElement('a');
        a.href = safeUrl;
        a.textContent = text;
        if (isBlank) a.target = '_blank';
        // composeLinkRel сам добавит noopener+noreferrer когда target=_blank
        // (защита от tab-jacking) и nofollow, если запрошено.
        const rel = composeLinkRel({ nofollow: isNofollow, blank: isBlank });
        if (rel) a.rel = rel;

        this.instance.selection.insertNode(a);
    }
}
