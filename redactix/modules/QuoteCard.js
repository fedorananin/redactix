import Module from '../core/Module.js';
import { isBlockEmpty, sanitizeImageSrc, sanitizeInlineHtml } from '../core/dom-utils.js';
import { CONTAINER_RULES, isBlockLike, normalizeContainerChildren } from '../core/schema.js';
import { inputGroup } from '../ui/form-helpers.js';
import { coercePlainDivs } from './Callout.js';

const QUOTE_RULE = CONTAINER_RULES.find(r => r.name === 'quote');

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
 *   normalizeBodies(rootEl)          — schema rules for every card body
 *   setupCards(rootEl)               — set contenteditable / structure
 *   cleanCardsForSync(clone)         — sync()-side cleanup
 *   getBlockMenuItems(block)         — BlockControl menu hook
 *
 * Structural rules (what a card body may contain) come from
 * core/schema.js CONTAINER_RULES — see normalizeBodies().
 */
export default class QuoteCard extends Module {
    static moduleName = 'QuoteCard';

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
     * Tags allowed as direct children of <blockquote> inside a quote-card
     * (core/schema.js CONTAINER_RULES).
     */
    isAllowedInnerTag(tag) {
        return QUOTE_RULE.allowed.includes(tag);
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
     * Goes through Selection.insertNode, so container rules apply (a card
     * can't go into a callout → it lands after it) and an empty text block
     * at the caret is replaced. Inside a quote-card it does nothing.
     */
    insertEmpty() {
        const sel = window.getSelection();
        if (sel.rangeCount) {
            const node = sel.getRangeAt(0).startContainer;
            if (this.instance.editorEl.contains(node) && this.isInsideQuoteCard(node)) return;
        }
        const card = this.createEmptyCard();
        this.transact(() => {
            this.instance.selection.insertNode(card);
            if (!card.parentNode) this.instance.editorEl.appendChild(card);
            this.setupCards(this.instance.editorEl);
            if (this.instance.core) this.instance.core.ensureTrailingParagraph();
        });

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
    }

    // ---------- caption toggle ----------

    /**
     * Add an empty figcaption to a card (text part only) and focus it.
     * Photo, if present, stays where it is.
     */
    addCaption(card) {
        if (!this.isQuoteCard(card) || !this.instance.editorEl.contains(card)) return;
        const span = this.transact(() => this.ensureCaptionSpan(card));
        // Focus the span
        const range = document.createRange();
        range.setStart(span, 0);
        range.collapse(true);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
    }

    ensureCaptionSpan(card) {
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
        return span;
    }

    /**
     * Remove only the text part of figcaption. If photo is also missing,
     * remove the whole figcaption.
     */
    removeCaption(card) {
        if (!this.isQuoteCard(card)) return;
        const figcaption = card.querySelector(':scope > figcaption');
        if (!figcaption) return;
        this.transact(() => {
            figcaption.querySelectorAll(':scope > span').forEach(s => s.remove());
            const hasImg = !!figcaption.querySelector(':scope > img');
            if (!hasImg) figcaption.remove();
        });
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
            authorText: existingSpan ? this.extractAuthorHtml(existingSpan) : ''
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
                const imageModule = this.getModule('Image');
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

            const urlGroup = inputGroup(this.t('quoteCard.photoUrl'), 'text', data.photoUrl, { placeholder: 'https://...' });
            urlGroup.classList.add('redactix-modal-full-width');
            photoUrlInput = urlGroup.field;

            const altGroup = inputGroup(this.t('quoteCard.photoAlt'), 'text', data.photoAlt);
            altGroup.classList.add('redactix-modal-full-width');
            photoAltInput = altGroup.field;

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

        const nameGroup = inputGroup(this.t('quoteCard.authorName'), 'text', data.authorText,
            { placeholder: this.t('quoteCard.authorNamePlaceholder') });
        nameGroup.classList.add('redactix-modal-full-width');
        const nameInput = nameGroup.field;

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
                    if (figcaption && this.instance.editorEl.contains(figcaption)) {
                        this.transact(() => figcaption.remove());
                    }
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

                // The card may have been deleted / replaced (undo) meanwhile.
                if (!this.instance.editorEl.contains(card)) return;
                this.transact(() => this.applyAuthor(card, { photoUrl, photoAlt, authorText }));
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

        // The author name field accepts HTML (inline links and formatting
        // survive repeated editing), so we pass it through
        // the inline sanitizer; photo URL - via sanitizeImageSrc. Otherwise the modal
        // would be a workaround around the paste sanitizer (especially in lite mode).
        const safePhotoUrl = photoUrl ? sanitizeImageSrc(photoUrl) : null;
        const safeAuthor = sanitizeInlineHtml(authorText || '');

        let figcaption = card.querySelector(':scope > figcaption');

        // If both empty — drop the figcaption entirely
        if (!safePhotoUrl && !safeAuthor) {
            if (figcaption) figcaption.remove();
            return;
        }

        if (!figcaption) {
            figcaption = document.createElement('figcaption');
            card.appendChild(figcaption);
        }

        // --- Image ---
        let img = figcaption.querySelector(':scope > img');
        if (safePhotoUrl) {
            if (!img) {
                img = document.createElement('img');
                figcaption.insertBefore(img, figcaption.firstChild);
            }
            img.setAttribute('src', safePhotoUrl);
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
        if (safeAuthor) {
            if (!span) {
                span = document.createElement('span');
                figcaption.appendChild(span);
            }
            if ((span.innerHTML || '') !== safeAuthor) {
                span.innerHTML = safeAuthor;
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
        this.transact(() => {
            const img = figcaption.querySelector(':scope > img');
            if (img) img.remove();
            if (!this.hasCaptionText(card)) {
                figcaption.remove();
            }
        });
    }

    /**
     * Read author HTML for the modal input — keeps inline tags (links,
     * bold, etc.) so they round-trip through the modal. Mirrors the
     * approach used by Image.js for figcaptions.
     */
    extractAuthorHtml(span) {
        const html = span.innerHTML || '';
        return html.replace(/<br\s*\/?>/gi, '').trim();
    }

    // ---------- Migration ----------

    /**
     * Migrate legacy blockquotes to figure.quote-card. Idempotent.
     * - Nested blockquotes are flattened into their outer quote first
     *   (a quote card can't contain another one).
     * - A class-less <figure><blockquote/><figcaption/></figure> — the
     *   standard semantic markup for an attributed quote — is upgraded in
     *   place to figure.quote-card.
     * - Any other <blockquote> outside a card is wrapped in a new card;
     *   its classes (presets) move to the figure.
     * - An attribution <cite> (direct child, or alone in a wrapper such as
     *   <footer>) becomes the figcaption author, inline links kept.
     */
    migrate(rootEl) {
        const root = rootEl || this.instance.editorEl;

        this.flattenNestedQuotes(root);

        const orphans = Array.from(root.querySelectorAll('blockquote'))
            .filter(bq => !this.isCardBody(bq));

        orphans.forEach(bq => {
            if (!bq.parentNode) return;
            let figure = bq.parentElement;
            const upgrade = this.isPlainQuoteFigure(figure, bq);
            if (!upgrade) {
                figure = document.createElement('figure');
                bq.parentNode.replaceChild(figure, bq);
                figure.appendChild(bq);
            }
            figure.classList.add('quote-card');
            // Carry over blockquote's own classes (presets) onto the figure
            if (bq.className) {
                bq.classList.forEach(cls => figure.classList.add(cls));
                bq.removeAttribute('class');
            }

            const hasCaption = !!figure.querySelector(':scope > figcaption');
            const citeHtml = this.extractCite(bq);
            if (citeHtml && !hasCaption) {
                const figcaption = document.createElement('figcaption');
                const span = document.createElement('span');
                span.innerHTML = citeHtml;
                figcaption.appendChild(span);
                figure.appendChild(figcaption);
            }
        });
    }

    /** Is `bq` the content body of a quote-card (figure.quote-card > blockquote)? */
    isCardBody(bq) {
        const parent = bq.parentElement;
        return !!parent && this.isQuoteCard(parent);
    }

    /**
     * Unwrap blockquotes nested inside other blockquotes (deepest first),
     * so their content joins the outer quote. Blockquotes that are the body
     * of a quote-card nested somewhere inside are left alone — that whole
     * card is moved out by the body normalisation instead.
     */
    flattenNestedQuotes(root) {
        const nested = Array.from(root.querySelectorAll('blockquote blockquote'))
            .filter(bq => !this.isCardBody(bq))
            .reverse();
        nested.forEach(bq => {
            const parent = bq.parentNode;
            if (!parent) return;
            while (bq.firstChild) parent.insertBefore(bq.firstChild, bq);
            bq.remove();
        });
    }

    /**
     * <figure> whose only element children are this blockquote and an
     * optional figcaption, and which no other module claims.
     */
    isPlainQuoteFigure(figure, bq) {
        if (!figure || figure.tagName !== 'FIGURE') return false;
        if (this.isQuoteCard(figure)) return false;
        if (Array.from(figure.classList).some(c => c.startsWith('redactix-'))) return false;
        let quotes = 0;
        for (const node of figure.childNodes) {
            if (node.nodeType === Node.TEXT_NODE) {
                if (node.textContent.trim()) return false;
                continue;
            }
            if (node.nodeType !== Node.ELEMENT_NODE) continue;
            if (node === bq) quotes++;
            else if (node.tagName !== 'FIGCAPTION') return false;
        }
        return quotes === 1;
    }

    /**
     * Pull attribution <cite> elements out of a legacy blockquote and return
     * their content as sanitised inline HTML ('' if none). A <cite> counts
     * as an attribution when it's a direct child of the quote or the only
     * text of the wrapper chain up to the quote (<footer>— <cite>X</cite>
     * </footer>, <p><cite>X</cite></p>). A <cite> inside running text
     * (a cited work's title) stays where it is.
     */
    extractCite(bq) {
        const parts = [];
        Array.from(bq.querySelectorAll('cite')).forEach(cite => {
            if (!bq.contains(cite)) return;
            const citeText = cite.textContent.trim();
            let wrapper = cite;
            while (wrapper.parentElement && wrapper.parentElement !== bq) {
                const parentText = wrapper.parentElement.textContent.replace(/^[\s—–-]+/, '').trim();
                if (parentText !== citeText) return;
                wrapper = wrapper.parentElement;
            }
            if (wrapper.parentElement !== bq) return;
            const html = sanitizeInlineHtml(cite.innerHTML).trim();
            if (html) parts.push(html);
            wrapper.remove();
        });
        return parts.join(' ');
    }

    /**
     * Normalise the body of every quote-card (not only freshly migrated
     * ones — content pasted into an existing card needs it too): inline
     * runs → <p>, disallowed blocks (pre, table, figure, …) moved out after
     * the card, body never empty. See core/schema.js.
     */
    normalizeBodies(rootEl) {
        const root = rootEl || this.instance.editorEl;
        root.querySelectorAll('figure.quote-card').forEach(card => {
            const bq = this.ensureBody(card);
            coercePlainDivs(bq);
            normalizeContainerChildren(bq, this.instance.editorEl);
        });
    }

    /**
     * Exactly one <blockquote> per card, first; figcaption last. Extra
     * blockquotes are merged into the first one.
     */
    ensureBody(card) {
        const quotes = Array.from(card.children).filter(c => c.tagName === 'BLOCKQUOTE');
        let bq = quotes[0];
        if (!bq) {
            bq = document.createElement('blockquote');
            bq.innerHTML = '<p><br></p>';
        }
        quotes.slice(1).forEach(extra => {
            while (extra.firstChild) bq.appendChild(extra.firstChild);
            extra.remove();
        });
        if (card.firstElementChild !== bq) card.insertBefore(bq, card.firstChild);
        const figcaption = card.querySelector(':scope > figcaption');
        if (figcaption && card.lastElementChild !== figcaption) card.appendChild(figcaption);
        return bq;
    }

    /**
     * Backwards-compatible name: normalise one blockquote body.
     */
    normalizeBlockquoteChildren(bq) {
        coercePlainDivs(bq);
        normalizeContainerChildren(bq, this.instance.editorEl);
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
                this.normalizeCaption(card, figcaption);

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
     * A caption is [<img>] [<span>author</span>]. Bring anything else into
     * that shape without losing content:
     *  - loose text / inline elements (`<figcaption>John</figcaption>`,
     *    `— <a>John</a>`, several spans) are gathered, in order, into ONE
     *    <span> — otherwise they'd be uneditable and dropped on save;
     *  - block elements are moved out, after the card, in their order;
     *  - the photo goes first.
     */
    normalizeCaption(card, figcaption) {
        const nodes = Array.from(figcaption.childNodes);
        const spans = nodes.filter(n => n.nodeType === Node.ELEMENT_NODE && n.tagName === 'SPAN');
        const loose = nodes.filter(n => {
            if (n.nodeType === Node.TEXT_NODE) return !!n.textContent.trim();
            if (n.nodeType !== Node.ELEMENT_NODE) return false;
            return n.tagName !== 'SPAN' && n.tagName !== 'IMG' && !isBlockLike(n);
        });
        const blocks = nodes.filter(n => n.nodeType === Node.ELEMENT_NODE && isBlockLike(n));

        if (blocks.length && card.parentNode) {
            const ref = card.nextSibling;
            blocks.forEach(b => card.parentNode.insertBefore(b, ref));
        }

        if (loose.length || spans.length > 1) {
            const span = spans.find(sp => !sp.classList.contains('spoiler')) || document.createElement('span');
            const parts = Array.from(figcaption.childNodes).filter(n => n.nodeName !== 'IMG');
            // Trim whitespace-only text at the edges; keep it between parts.
            while (parts.length && parts[0].nodeType === Node.TEXT_NODE && !parts[0].textContent.trim()) parts.shift().remove();
            while (parts.length && parts[parts.length - 1].nodeType === Node.TEXT_NODE && !parts[parts.length - 1].textContent.trim()) parts.pop().remove();
            const merged = document.createDocumentFragment();
            parts.forEach(n => {
                if (n.nodeType === Node.ELEMENT_NODE && n.tagName === 'SPAN' && !n.classList.contains('spoiler')) {
                    while (n.firstChild) merged.appendChild(n.firstChild);
                    if (n !== span) n.remove();
                } else {
                    merged.appendChild(n);
                }
            });
            span.innerHTML = '';
            span.appendChild(merged);
            figcaption.appendChild(span);
        }

        const img = figcaption.querySelector(':scope > img');
        if (img && figcaption.firstChild !== img) figcaption.insertBefore(img, figcaption.firstChild);
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
            // OUTSIDE the figure, in order, to avoid silent data loss.
            const figcaption = card.querySelector(':scope > figcaption');
            if (figcaption && card.parentNode) {
                const ref = card.nextSibling;
                Array.from(figcaption.children).forEach(child => {
                    if (child.tagName !== 'IMG' && child.tagName !== 'SPAN') {
                        card.parentNode.insertBefore(child, ref);
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
                    if (isBlockEmpty(block, QUOTE_RULE.mediaSelector)) block.remove();
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

    // ---------- BlockControl menu hook ----------

    /** Caption and author-photo entries for the block menu of a card. */
    getBlockMenuItems(block) {
        if (!this.isQuoteCard(block)) return [];
        const groups = [];
        const hasText = this.hasCaptionText(block);
        groups.push({
            label: this.t('quoteCard.menuCaption'),
            items: [{
                icon: hasText ? '✕' : '✎',
                label: this.t(hasText ? 'quoteCard.removeCaption' : 'quoteCard.addCaption'),
                action: () => (hasText ? this.removeCaption(block) : this.addCaption(block))
            }]
        });
        // Author photo — not in lite mode
        if (!this.liteMode) {
            const hasPhoto = this.hasAuthorPhoto(block);
            const items = [{
                icon: '🖼',
                label: this.t(hasPhoto ? 'quoteCard.editAuthor' : 'quoteCard.addAuthor'),
                action: () => this.openAuthorModal(block)
            }];
            if (hasPhoto) {
                items.push({ icon: '✕', label: this.t('quoteCard.removePhoto'), action: () => this.removeAuthorPhoto(block) });
            }
            groups.push({ label: this.t('quoteCard.menuPhoto'), items });
        }
        return groups;
    }

    getButtons() {
        return [];
    }

    // ---------- content lifecycle hooks (called by RedactixInstance) ----------

    setupContent(root) {
        this.migrate(root);
        this.normalizeBodies(root);
        this.setupCards(root);
    }

    cleanForSync(clone) {
        this.cleanCardsForSync(clone);
    }

    ownsFigure(figure) {
        return figure.classList.contains('quote-card');
    }

    get pasteAllowedClasses() {
        return ['quote-card'];
    }
}
