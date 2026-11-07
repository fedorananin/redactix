// Shared builders for modal forms. Every module used to carry its own copy
// of createInputGroup / makeInputGroup / createSelectGroup (seven of them,
// with diverging inline styles). Styling lives in Redactix.css under
// .redactix-modal-content — nothing here sets visual inline styles.

let fieldIdCounter = 0;

function nextId() {
    fieldIdCounter += 1;
    return 'redactix-field-' + fieldIdCounter;
}

function makeLabel(text, forId) {
    const label = document.createElement('label');
    label.textContent = text;
    if (forId) label.htmlFor = forId;
    return label;
}

/**
 * <div><label/><input/></div>
 * @returns {HTMLDivElement} group; the input is group.querySelector('input')
 *          and also exposed as group.field.
 */
export function inputGroup(labelText, type = 'text', value = '', { placeholder = '' } = {}) {
    const div = document.createElement('div');
    div.className = 'redactix-form-group';
    const input = document.createElement('input');
    input.id = nextId();
    input.type = type;
    input.value = value == null ? '' : value;
    if (placeholder) input.placeholder = placeholder;
    div.append(makeLabel(labelText, input.id), input);
    div.field = input;
    return div;
}

/** <div><label/><textarea/></div> — field exposed as group.field. */
export function textareaGroup(labelText, value = '', { rows = 3, placeholder = '' } = {}) {
    const div = document.createElement('div');
    div.className = 'redactix-form-group';
    const textarea = document.createElement('textarea');
    textarea.id = nextId();
    textarea.rows = rows;
    textarea.value = value == null ? '' : value;
    if (placeholder) textarea.placeholder = placeholder;
    div.append(makeLabel(labelText, textarea.id), textarea);
    div.field = textarea;
    return div;
}

/**
 * <div><label/><select/></div>. `options` = [{ value, label }]. If `value`
 * isn't among the options it is added (so editing never silently resets an
 * unknown value, e.g. an unlisted code language).
 */
export function selectGroup(labelText, value = '', options = []) {
    const div = document.createElement('div');
    div.className = 'redactix-form-group';
    const select = document.createElement('select');
    select.id = nextId();
    const list = options.slice();
    if (value && !list.some(o => o.value === value)) {
        list.push({ value, label: value });
    }
    list.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.label;
        if (opt.value === value) option.selected = true;
        select.appendChild(option);
    });
    div.append(makeLabel(labelText, select.id), select);
    div.field = select;
    return div;
}

/** Inline checkbox with its label. Returns the <label>; checkbox at label.field. */
export function checkbox(labelText, checked = false) {
    const label = document.createElement('label');
    label.className = 'redactix-checkbox-label';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = !!checked;
    label.append(input, document.createTextNode(labelText));
    label.field = input;
    return label;
}

/**
 * Link fields used by image / gallery forms: URL + "open in new window" +
 * "nofollow". Returns { element, url, blank, nofollow } where the last three
 * are the form controls.
 */
export function linkFields({ urlLabel, blankLabel, nofollowLabel, url = '', blank = false, nofollow = false, placeholder = 'https://' }) {
    const element = document.createElement('div');
    element.className = 'redactix-link-fields';
    const urlGroup = inputGroup(urlLabel, 'text', url, { placeholder });
    const row = document.createElement('div');
    row.className = 'redactix-checkbox-row';
    const blankBox = checkbox(blankLabel, blank);
    const nofollowBox = checkbox(nofollowLabel, nofollow);
    row.append(blankBox, nofollowBox);
    element.append(urlGroup, row);
    return { element, url: urlGroup.field, blank: blankBox.field, nofollow: nofollowBox.field };
}

/** Small inline status line (errors, hints). Text only — never HTML. */
export function statusLine(text = '', { error = false } = {}) {
    const div = document.createElement('div');
    div.className = 'redactix-form-status' + (error ? ' is-error' : '');
    div.setAttribute('role', error ? 'alert' : 'status');
    div.textContent = text;
    return div;
}

/** Spinner SVG markup (static, no user data) — was copied 7 times. */
export const SPINNER_SVG = '<svg class="redactix-spinner" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke-opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>';
