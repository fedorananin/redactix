import Module from '../core/Module.js';

/**
 * QuoteCard module.
 *
 * Single source of truth for blockquote rendering. Every quote in the
 * editor is wrapped in <figure class="quote-card"> with an inner
 * <blockquote> for content and an optional <figcaption> for the author
 * (photo + name + link, all independent and optional).
 *
 * Public API used by other modules:
 *   insertEmpty()                    — slash / markdown entry point
 *   isQuoteCard(el)                  — selector helper
 *   isInsideQuoteCard(node)          — context detection
 *   getCard(node)                    — closest figure.quote-card
 *   addCaption(card)                 — toggle: create empty figcaption
 *   removeCaption(card)              — strip text part, keep photo if any
 *   openAuthorModal(card)            — modal for photo + name + link
 *   removeAuthorPhoto(card)          — delete <img> from figcaption
 *   migrate(rootEl)                  — convert legacy <blockquote> trees
 *   setupCards(rootEl)               — set contenteditable / structure
 *   cleanCardsForSync(clone)         — sync()-side cleanup
 */
export default class QuoteCard extends Module {
    constructor(instance) {
        super(instance);
        this.liteMode = instance.config.liteMode || false;
        this.uploadUrl = instance.config.uploadUrl || null;
        this.browseUrl = instance.config.browseUrl || null;
    }

    init() {
        // Click on author <img> opens the author modal (intercepts Image.js handler)
        this.instance.editorEl.addEventListener('click', (e) => {
            const img = e.target.closest && e.target.closest('img');
            if (!img) return;
            const card = this.getCard(img);
            if (!card) return;
            e.preventDefault();
            e.stopImmediatePropagation();
            this.openAuthorModal(card);
        }, true); // capture so Image.js click handler doesn't fire first

        // Block native browser drops onto a quote-card figcaption: nothing
        // outside of {img, span} should ever land there.
        const isFigcaptionTarget = (e) => {
            const t = e.target;
            return !!(t && t.closest &&
                t.closest('figure.quote-card > figcaption'));
        };
        this.instance.editorEl.addEventListener('dragover', (e) => {
            if (isFigcaptionTarget(e)) {
                e.preventDefault();
                if (e.dataTransfer) e.dataTransfer.dropEffect = 'none';
            }
        }, true);
        this.instance.editorEl.addEventListener('drop', (e) => {
            if (isFigcaptionTarget(e)) {
                e.preventDefault();
                e.stopPropagation();
            }
        }, true);
    }

    // ---------- helpers ----------

    isQuoteCard(el) {
        return !!(el && el.nodeType === Node.ELEMENT_NODE &&
            el.tagName === 'FIGURE' && el.classList.contains('quote-card'));
    }

    getCard(node) {
        if (!node) return null;
        const el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
        return el ? el.closest('figure.quote-card') : null;
    }

    isInsideQuoteCard(node) {
        return !!this.getCard(node);
    }

    /**
     * Tags allowed as direct children of <blockquote> inside a quote-card.
     */
    isAllowedInnerTag(tag) {
        return ['P', 'H1', 'H2', 'H3', 'UL', 'OL'].includes(tag);
    }

    // ---------- DOM construction ----------

    createEmptyCard() {
        const figure = document.createElement('figure');
        figure.className = 'quote-card';
        const bq = document.createElement('blockquote');
        const p = document.createElement('p');
        p.innerHTML = '<br>';
        bq.appendChild(p);
        figure.appendChild(bq);
        return figure;
    }

    /**
     * Insert empty quote-card. Called from SlashCommands and Markdown.
     * If the cursor sits in an empty paragraph at top level, replace it;
     * otherwise insert after the current top-level block.
     */
    insertEmpty() {
        this.beginHistoryBatch();

        const sel = window.getSelection();
        const card = this.createEmptyCard();
        const editor = this.instance.editorEl;

        let inserted = false;
        if (sel.rangeCount) {
            const range = sel.getRangeAt(0);
            // Find the top-level child of editor that contains the cursor
            let topBlock = range.startContainer;
            while (topBlock && topBlock.parentNode !== editor) {
                topBlock = topBlock.parentNode;
            }

            if (topBlock && topBlock.parentNode === editor) {
                // If we are already inside a quote-card, do nothing
                if (this.isInsideQuoteCard(topBlock)) {
                    this.endHistoryBatch();
                    return;
                }
                const bareText = topBlock.innerHTML.replace(/<br\s*\/?>/gi, '').trim();
                const isEmpty = !bareText &&
                    !topBlock.querySelector('img, iframe, hr, table');
                if (isEmpty && topBlock.tagName === 'P') {
                    topBlock.parentNode.replaceChild(card, topBlock);
                } else {
                    topBlock.parentNode.insertBefore(card, topBlock.nextSibling);
                }
                inserted = true;
            }
        }

        if (!inserted) {
            editor.appendChild(card);
        }

        this.setupCards(editor);

        // Place cursor inside the empty <p>
        const innerP = card.querySelector('blockquote > p');
        if (innerP) {
            const range = document.createRange();
            range.setStart(innerP, 0);
            range.collapse(true);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
        }

        if (this.instance.core) this.instance.core.ensureTrailingParagraph();
        this.instance.sync();
        this.endHistoryBatch();
    }

    // ---------- caption toggle ----------

    /**
     * Add an empty figcaption to a card (text part only) and focus it.
     * Photo, if present, stays where it is.
     */
    addCaption(card) {
        if (!this.isQuoteCard(card)) return;
        this.beginHistoryBatch();
        let figcaption = card.querySelector(':scope > figcaption');
        if (!figcaption) {
            figcaption = document.createElement('figcaption');
            card.appendChild(figcaption);
        }
        // Ensure a writable <span> exists for the author text
        let span = figcaption.querySelector(':scope > span');
        if (!span) {
            span = document.createElement('span');
            span.innerHTML = '<br>';
            figcaption.appendChild(span);
        }
        this.setupCards(this.instance.editorEl);
        // Focus the span
        const range = document.createRange();
        range.setStart(span, 0);
        range.collapse(true);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        this.instance.sync();
        this.endHistoryBatch();
    }

    /**
     * Remove only the text part of figcaption. If photo is also missing,
     * remove the whole figcaption.
     */
    removeCaption(card) {
        if (!this.isQuoteCard(card)) return;
        const figcaption = card.querySelector(':scope > figcaption');
        if (!figcaption) return;
        this.beginHistoryBatch();
        figcaption.querySelectorAll(':scope > span').forEach(s => s.remove());
        const hasImg = !!figcaption.querySelector(':scope > img');
        if (!hasImg) figcaption.remove();
        this.instance.sync();
        this.endHistoryBatch();
    }

    hasCaptionText(card) {
        const span = card && card.querySelector(':scope > figcaption > span');
        if (!span) return false;
        const cleaned = span.innerHTML.replace(/<br\s*\/?>/gi, '').trim();
        return !!cleaned;
    }

    hasAuthorPhoto(card) {
        return !!(card && card.querySelector(':scope > figcaption > img'));
    }

    // ---------- author modal ----------

    /**
     * Open the modal for editing photo + name of the author.
     * Links inside the author text are managed inline via the floating
     * toolbar — there is no dedicated "author link" field.
     * In lite mode the photo field is hidden.
     */
    openAuthorModal(card) {
        if (!this.isQuoteCard(card)) return;

        // Extract existing data
        const figcaption = card.querySelector(':scope > figcaption');
        const existingImg = figcaption && figcaption.querySelector(':scope > img');
        const existingSpan = figcaption && figcaption.querySelector(':scope > span');

        const data = {
            photoUrl: existingImg ? (existingImg.getAttribute('src') || '') : '',
            photoAlt: existingImg ? (existingImg.getAttribute('alt') || '') : '',
            authorText: existingSpan ? this.extractAuthorText(existingSpan) : ''
        };

        const form = document.createElement('div');

        // --- Photo block (hidden in lite mode) ---
        let photoUrlInput = null;
        let photoAltInput = null;
        let photoBrowseContainer = null;

        if (!this.liteMode) {
            const photoSection = document.createElement('div');
            photoSection.className = 'redactix-modal-full-width';
            photoSection.style.marginBottom = '8px';

            const photoTitle = document.createElement('div');
            photoTitle.textContent = this.t('quoteCard.photoSection');
            photoTitle.style.fontWeight = '600';
            photoTitle.style.marginBottom = '10px';
            photoTitle.style.fontSize = '14px';
            photoSection.appendChild(photoTitle);

            // Upload zone (if uploadUrl)
            if (this.uploadUrl) {
                const uploadZone = this.createUploadZone((result) => {
                    photoUrlInput.value = result.src || '';
                });
                photoSection.appendChild(uploadZone);
            }

            // Browse button (if browseUrl) — reuses Image module's browser
            if (this.browseUrl) {
                photoBrowseContainer = document.createElement('div');
                photoBrowseContainer.style.marginBottom = '12px';
                const imageModule = this.instance.modules.find(m => m.constructor.name === 'Image');
                const browseBtn = document.createElement('button');
                browseBtn.type = 'button';
                browseBtn.textContent = this.t('image.chooseFromUploaded');
                browseBtn.className = 'redactix-modal-btn redactix-modal-btn-gray';
                browseBtn.style.width = '100%';
                browseBtn.addEventListener('click', () => {
                    if (imageModule && imageModule.openBrowsePanel) {
                        imageModule.openBrowsePanel(photoBrowseContainer, (img) => {
                            photoUrlInput.value = img.src || '';
                        });
                    }
                });
                photoBrowseContainer.appendChild(browseBtn);
                photoSection.appendChild(photoBrowseContainer);
            }

            const photoGrid = document.createElement('div');
            photoGrid.className = 'redactix-modal-grid';

            const urlGroup = this.createInputGroup(this.t('quoteCard.photoUrl'), 'text', data.photoUrl);
            urlGroup.className = 'redactix-modal-full-width';
            photoUrlInput = urlGroup.querySelector('input');
            photoUrlInput.placeholder = 'https://...';

            const altGroup = this.createInputGroup(this.t('quoteCard.photoAlt'), 'text', data.photoAlt);
            altGroup.className = 'redactix-modal-full-width';
            photoAltInput = altGroup.querySelector('input');

            photoGrid.append(urlGroup, altGroup);
            photoSection.appendChild(photoGrid);

            form.appendChild(photoSection);
        }

        // --- Author text + link ---
        const authorSection = document.createElement('div');
        authorSection.className = 'redactix-modal-full-width';
        if (!this.liteMode) {
            authorSection.style.borderTop = '1px solid var(--redactix-border)';
            authorSection.style.marginTop = '8px';
            authorSection.style.paddingTop = '15px';
        }

        const authorTitle = document.createElement('div');
        authorTitle.textContent = this.t('quoteCard.authorSection');
        authorTitle.style.fontWeight = '600';
        authorTitle.style.marginBottom = '10px';
        authorTitle.style.fontSize = '14px';
        authorSection.appendChild(authorTitle);

        const nameGroup = this.createInputGroup(this.t('quoteCard.authorName'), 'text', data.authorText);
        nameGroup.className = 'redactix-modal-full-width';
        const nameInput = nameGroup.querySelector('input');
        nameInput.placeholder = this.t('quoteCard.authorNamePlaceholder');

        authorSection.appendChild(nameGroup);
        form.appendChild(authorSection);

        // --- Modal ---
        const isEditing = !!figcaption;
        const extraButtons = [];

        if (isEditing) {
            extraButtons.push({
                text: this.t('quoteCard.removeAll'),
                danger: true,
                onClick: () => {
                    this.beginHistoryBatch();
                    if (figcaption) figcaption.remove();
                    this.instance.sync();
                    this.endHistoryBatch();
                    this.instance.modal.close();
                }
            });
        }

        this.instance.modal.open({
            title: isEditing ? this.t('quoteCard.editAuthor') : this.t('quoteCard.addAuthor'),
            body: form,
            extraButtons,
            onSave: () => {
                const photoUrl = photoUrlInput ? photoUrlInput.value.trim() : '';
                const photoAlt = photoAltInput ? photoAltInput.value.trim() : '';
                const authorText = nameInput.value.trim();

                this.beginHistoryBatch();
                this.applyAuthor(card, { photoUrl, photoAlt, authorText });
                this.instance.sync();
                this.endHistoryBatch();
            }
        });
    }

    /**
     * Apply author data to a quote-card.
     * Photo and author text are independent and both optional.
     * If the user already added inline links / formatting to the author
     * span via the floating toolbar, we preserve them as long as the
     * span's plain-text content matches `authorText` exactly.
     */
    applyAuthor(card, { photoUrl, photoAlt, authorText }) {
        if (!this.isQuoteCard(card)) return;

        let figcaption = card.querySelector(':scope > figcaption');

        // If both empty — drop the figcaption entirely
        if (!photoUrl && !authorText) {
            if (figcaption) figcaption.remove();
            return;
        }

        if (!figcaption) {
            figcaption = document.createElement('figcaption');
            card.appendChild(figcaption);
        }

        // --- Image ---
        let img = figcaption.querySelector(':scope > img');
        if (photoUrl) {
            if (!img) {
                img = document.createElement('img');
                figcaption.insertBefore(img, figcaption.firstChild);
            }
            img.setAttribute('src', photoUrl);
            if (photoAlt) img.setAttribute('alt', photoAlt);
            else img.removeAttribute('alt');
            // No width/height — required by spec
            img.removeAttribute('width');
            img.removeAttribute('height');
            img.removeAttribute('srcset');
        } else if (img) {
            img.remove();
        }

        // --- Span with author text ---
        let span = figcaption.querySelector(':scope > span');
        if (authorText) {
            if (!span) {
                span = document.createElement('span');
                figcaption.appendChild(span);
            }
            // Only overwrite the span content if the plain text actually
            // changed — otherwise keep any inline links / formatting the
            // user added through the floating toolbar.
            if ((span.textContent || '') !== authorText) {
                span.textContent = authorText;
            }
        } else if (span) {
            span.remove();
        }

        // Make sure caption parts are positioned correctly: img first, span last
        if (img && span && img.nextSibling !== span) {
            figcaption.appendChild(span);
        }

        // Make figcaption editable for inline tweaks
        this.setupCards(this.instance.editorEl);
    }

    removeAuthorPhoto(card) {
        if (!this.isQuoteCard(card)) return;
        const figcaption = card.querySelector(':scope > figcaption');
        if (!figcaption) return;
        this.beginHistoryBatch();
        const img = figcaption.querySelector(':scope > img');
        if (img) img.remove();
        if (!this.hasCaptionText(card)) {
            figcaption.remove();
        }
        this.instance.sync();
        this.endHistoryBatch();
    }

    /**
     * Read author text as plain text for the modal input. Inline tags
     * (links, bold, etc.) are flattened — they live in the editor span.
     */
    extractAuthorText(span) {
        return span.textContent || '';
    }

    // ---------- Migration ----------

    /**
     * Migrate legacy blockquotes to figure.quote-card.
     * - Wrap top-level <blockquote> in <figure class="quote-card">
     * - Move blockquote classes to figure
     * - Wrap bare text inside blockquote in <p>
     * - Drop <cite>, move its text into a new figcaption span
     */
    migrate(rootEl) {
        const root = rootEl || this.instance.editorEl;

        const orphans = Array.from(root.querySelectorAll('blockquote'))
            .filter(bq => !bq.closest('figure.quote-card'));

        orphans.forEach(bq => {
            const figure = document.createElement('figure');
            figure.className = 'quote-card';
            // Carry over blockquote's own classes (presets) onto the figure
            if (bq.className) {
                figure.className = ('quote-card ' + bq.className).trim();
                bq.removeAttribute('class');
            }

            // Pull cite out before wrapping
            const cite = bq.querySelector(':scope > cite');
            let citeText = '';
            if (cite) {
                citeText = cite.textContent.trim();
                cite.remove();
            }

            // Wrap bare text / inline content in <p>
            this.normalizeBlockquoteChildren(bq);

            bq.parentNode.replaceChild(figure, bq);
            figure.appendChild(bq);

            if (citeText) {
                const figcaption = document.createElement('figcaption');
                const span = document.createElement('span');
                span.textContent = citeText;
                figcaption.appendChild(span);
                figure.appendChild(figcaption);
            }
        });
    }

    /**
     * Ensure every direct child of blockquote is a P/H1-3/UL/OL.
     * Bare inline content gets wrapped in <p>; disallowed blocks get
     * unwrapped to <p>.
     */
    normalizeBlockquoteChildren(bq) {
        const children = Array.from(bq.childNodes);
        let pendingP = null;

        const flushP = () => {
            if (pendingP && pendingP.childNodes.length > 0) {
                bq.appendChild(pendingP);
            }
            pendingP = null;
        };

        bq.innerHTML = '';

        for (const node of children) {
            if (node.nodeType === Node.ELEMENT_NODE) {
                const tag = node.tagName;
                if (this.isAllowedInnerTag(tag)) {
                    flushP();
                    bq.appendChild(node);
                    continue;
                }
                if (tag === 'BR') {
                    // Treat as soft break inside current paragraph
                    if (!pendingP) pendingP = document.createElement('p');
                    pendingP.appendChild(node);
                    continue;
                }
                // Other element (span, b, i, a, etc.) — wrap in p
                if (!pendingP) pendingP = document.createElement('p');
                pendingP.appendChild(node);
            } else if (node.nodeType === Node.TEXT_NODE) {
                if (!pendingP) pendingP = document.createElement('p');
                pendingP.appendChild(node);
            }
        }
        flushP();

        // If blockquote ended up empty, give it an empty paragraph
        if (bq.childNodes.length === 0) {
            const p = document.createElement('p');
            p.innerHTML = '<br>';
            bq.appendChild(p);
        }
    }

    // ---------- contenteditable wiring ----------

    /**
     * Mark every quote-card with the right contenteditable flags so:
     *  - drag handle attaches to the figure (figure is contenteditable=false),
     *  - the inner blockquote and figcaption text remain editable,
     *  - the author <img> is inert.
     */
    setupCards(rootEl) {
        const root = rootEl || this.instance.editorEl;
        root.querySelectorAll('figure.quote-card').forEach(card => {
            card.setAttribute('contenteditable', 'false');
            const bq = card.querySelector(':scope > blockquote');
            if (bq) bq.setAttribute('contenteditable', 'true');
            const figcaption = card.querySelector(':scope > figcaption');
            if (figcaption) {
                // Eject anything that doesn't belong in the figcaption
                // (only <img> and <span> are allowed). Foreign children
                // are moved out, after the card, so no content is lost.
                Array.from(figcaption.children).forEach(child => {
                    if (child.tagName !== 'IMG' && child.tagName !== 'SPAN') {
                        card.parentNode.insertBefore(child, card.nextSibling);
                    }
                });

                // figcaption itself is non-editable so that the browser can't
                // drop arbitrary nodes (paragraphs, lists, etc.) into it.
                // Only the inner <span> with the author name is editable.
                figcaption.setAttribute('contenteditable', 'false');
                const img = figcaption.querySelector(':scope > img');
                if (img) img.setAttribute('contenteditable', 'false');
                const span = figcaption.querySelector(':scope > span');
                if (span) {
                    span.setAttribute('contenteditable', 'true');
                    span.setAttribute('data-placeholder', this.t('quoteCard.authorNamePlaceholder'));
                }
            }
        });
    }

    /**
     * Sync-side cleanup. Operates on a clone of editorEl, NOT live DOM.
     * Removes width/height/srcset from author photos, drops trailing
     * empty paragraphs in blockquote, removes empty figcaptions.
     */
    cleanCardsForSync(clone) {
        clone.querySelectorAll('figure.quote-card').forEach(card => {
            // Strip dimensions from author photo
            card.querySelectorAll(':scope > figcaption > img').forEach(img => {
                img.removeAttribute('width');
                img.removeAttribute('height');
                img.removeAttribute('srcset');
            });

            // figcaption can only legally contain <img> and <span>. Anything
            // else that crept in (rogue paragraph, list, etc.) is moved
            // OUTSIDE the figure to avoid silent data loss.
            const figcaption = card.querySelector(':scope > figcaption');
            if (figcaption) {
                Array.from(figcaption.children).forEach(child => {
                    if (child.tagName !== 'IMG' && child.tagName !== 'SPAN') {
                        card.parentNode.insertBefore(child, card.nextSibling);
                    }
                });
            }

            // Drop figcaption if it has no img and no text; clean up span
            if (figcaption) {
                const img = figcaption.querySelector(':scope > img');
                const span = figcaption.querySelector(':scope > span');
                if (span) span.removeAttribute('data-placeholder');
                const spanText = span ? span.innerHTML.replace(/<br\s*\/?>/gi, '').trim() : '';
                if (!img && !spanText) {
                    figcaption.remove();
                } else if (span && !spanText) {
                    span.remove();
                }
            }

            // Drop trailing empty <p><br></p> from blockquote (but keep at
            // least one block).
            const bq = card.querySelector(':scope > blockquote');
            if (bq) {
                const blocks = Array.from(bq.children);
                for (let i = blocks.length - 1; i > 0; i--) {
                    const block = blocks[i];
                    const isEmpty = !block.textContent.trim() &&
                        !block.querySelector('img, iframe');
                    if (isEmpty) block.remove();
                    else break;
                }
            }
        });
    }

    // ---------- Upload zone helper (mini version of Image's) ----------

    createUploadZone(onSuccess) {
        const zone = document.createElement('label');
        zone.className = 'redactix-upload-group';
        zone.style.display = 'block';
        zone.style.marginBottom = '12px';
        zone.style.padding = '14px';
        zone.style.border = '2px dashed var(--redactix-border)';
        zone.style.borderRadius = '8px';
        zone.style.textAlign = 'center';
        zone.style.cursor = 'pointer';

        const label = document.createElement('div');
        label.style.fontSize = '13px';
        label.style.color = 'var(--redactix-text-muted)';
        label.textContent = this.t('image.uploadClick');
        zone.appendChild(label);

        const status = document.createElement('div');
        status.style.fontSize = '12px';
        status.style.marginTop = '6px';
        status.style.display = 'none';
        zone.appendChild(status);

        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.style.display = 'none';
        zone.appendChild(input);

        const upload = async (file) => {
            status.style.display = 'block';
            status.style.color = 'var(--redactix-primary)';
            status.textContent = this.t('image.uploading');
            try {
                const fd = new FormData();
                fd.append('image', file);
                const resp = await fetch(this.uploadUrl, { method: 'POST', body: fd });
                const result = await resp.json();
                if (result.success) {
                    status.style.color = '#10b981';
                    status.textContent = this.t('image.uploadSuccess');
                    onSuccess(result);
                } else {
                    status.style.color = '#ef4444';
                    status.textContent = result.error || 'Upload failed';
                }
            } catch (err) {
                status.style.color = '#ef4444';
                status.textContent = err.message || 'Connection error';
            }
        };

        input.addEventListener('change', () => {
            const file = input.files && input.files[0];
            if (file) upload(file);
        });

        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            zone.style.borderColor = 'var(--redactix-primary)';
        });
        zone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            zone.style.borderColor = 'var(--redactix-border)';
        });
        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.style.borderColor = 'var(--redactix-border)';
            const file = e.dataTransfer.files && e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) upload(file);
        });

        return zone;
    }

    // ---------- Form helpers ----------

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

    // ---------- History helpers ----------

    beginHistoryBatch() {
        const history = this.instance.modules.find(m => m.constructor.name === 'History');
        if (history) history.beginBatch();
    }

    endHistoryBatch() {
        const history = this.instance.modules.find(m => m.constructor.name === 'History');
        if (history) history.endBatch();
    }

    getButtons() {
        return [];
    }
}
