// Helpers shared by the media modules (Image, Gallery, Video, Embed) for
// the parts of a <figure> they all have: the caption and the floating
// "Edit" button.

import { sanitizeInlineHtml } from './dom-utils.js';

/**
 * Caption HTML of a figcaption, for a modal field. Only the browser's
 * placeholder / trailing <br> is dropped — inner <br>s are real line breaks
 * (multi-line captions) and survive a re-edit.
 */
export function captionHtml(figcaption) {
    if (!figcaption) return '';
    const html = (figcaption.innerHTML || '').replace(/(?:\s|&nbsp;|<br\s*\/?>)+$/i, '').trim();
    return hasCaptionContent(html) ? html : '';
}

/** Caption of `figure` (its direct <figcaption>), or ''. */
export function readCaption(figure) {
    return captionHtml(figure ? figure.querySelector(':scope > figcaption') : null);
}

function hasCaptionContent(html) {
    if (!html) return false;
    if (/<img\b/i.test(html)) return true;
    return html.replace(/<br\s*\/?>/gi, '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() !== '';
}

/**
 * Write a caption (inline HTML, sanitised here) into `figure`'s direct
 * <figcaption>. An empty caption removes the figcaption, unless `keepEmpty`
 * — plain image figures keep an editable '<br>' placeholder so the caption
 * can be typed in place. Returns the figcaption or null.
 */
export function writeCaption(figure, html, { keepEmpty = false } = {}) {
    const safe = sanitizeInlineHtml(html || '');
    const hasContent = hasCaptionContent(safe);
    let figcaption = figure.querySelector(':scope > figcaption');
    if (!hasContent && !keepEmpty) {
        if (figcaption) figcaption.remove();
        return null;
    }
    if (!figcaption) {
        figcaption = document.createElement('figcaption');
        figure.appendChild(figcaption);
    }
    figcaption.innerHTML = hasContent ? safe : '<br>';
    figcaption.setAttribute('contenteditable', 'true');
    return figcaption;
}

/** Sync-side: strip the editing flag, drop an empty caption. Clone only. */
export function cleanCaptionForSync(figure) {
    const figcaption = figure.querySelector(':scope > figcaption');
    if (!figcaption) return;
    figcaption.removeAttribute('contenteditable');
    if (!(figcaption.textContent || '').trim() && !figcaption.querySelector('img')) {
        figcaption.remove();
    }
}

/**
 * Make sure `parent` has a floating Edit button with `className`. Marked
 * data-redactix-ui so it never reaches saved HTML or undo snapshots.
 */
export function ensureEditButton(parent, className, label) {
    let btn = parent.querySelector(':scope > .' + className);
    if (!btn) {
        btn = document.createElement('button');
        btn.type = 'button';
        btn.className = className;
        btn.setAttribute('data-redactix-ui', '');
        btn.contentEditable = 'false';
        parent.appendChild(btn);
    }
    if (btn.textContent !== label) btn.textContent = label;
    return btn;
}

/**
 * Re-point a figure at this module's class without wiping classes the user
 * added through the Attributes dialog (figure.className = '…' used to).
 */
export function setOwnClass(figure, className) {
    if (!figure.classList.contains(className)) figure.classList.add(className);
}
