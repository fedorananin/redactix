import { isAtomicBlock, isBlockEmpty, sanitizeUrl, sanitizeImageSrc, sanitizeRel, sanitizeTarget, normalizeInlineSynonyms } from './dom-utils.js';

export default class Editor {
    constructor(instance) {
        this.instance = instance;
        this.el = instance.editorEl;

        // Default paragraph separator — global document setting,
        // set once for the entire page even with multiple instances.
        if (!Editor._documentDefaultsApplied) {
            try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch (e) {}
            Editor._documentDefaultsApplied = true;
        }

        this.bindEvents();
        this.setupPlaceholder();
    }

    setupPlaceholder() {
        this.el.dataset.placeholder = this.instance.t('editor.placeholder');
        this.updatePlaceholder();
    }

    updatePlaceholder() {
        const isEmpty = !this.el.textContent.trim() && !this.el.querySelector('img, iframe, hr, table, video');
        this.el.classList.toggle('is-empty', isEmpty);
    }

    // Guarantees proper structure of the editor (at least one paragraph)
    ensureEditorStructure() {
        // If the editor is completely empty or contains only <br>
        const content = this.el.innerHTML.replace(/<br\s*\/?>/gi, '').trim();

        if (!content) {
            // Create an empty paragraph
            this.el.innerHTML = '<p><br></p>';

            // Place cursor in the paragraph
            const p = this.el.querySelector('p');
            if (p) {
                const range = document.createRange();
                const sel = window.getSelection();
                range.setStart(p, 0);
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
            }
            return;
        }

        // Check: if one empty block element remains (not P) — replace with P
        // This happens when the user selects all and deletes
        if (this.el.children.length === 1) {
            const child = this.el.children[0];
            const checkContent = child.innerHTML.replace(/<br\s*\/?>/gi, '').trim();

            if (!checkContent && ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'ASIDE'].includes(child.tagName)) {
                // Replace empty heading/quote with a paragraph
                const p = document.createElement('p');
                p.innerHTML = '<br>';
                this.el.replaceChild(p, child);

                // Place cursor
                const range = document.createRange();
                const sel = window.getSelection();
                range.setStart(p, 0);
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
                return;
            }
        }

        // If there is "naked" text directly in the editor (not in a block element)
        // This can happen after deleting everything and starting input
        const firstChild = this.el.firstChild;
        if (firstChild && firstChild.nodeType === Node.TEXT_NODE && firstChild.textContent.trim()) {
            // Save cursor position before wrapping
            const sel = window.getSelection();
            let savedOffset = 0;
            let savedNode = null;
            if (sel.rangeCount) {
                const range = sel.getRangeAt(0);
                savedNode = range.startContainer;
                savedOffset = range.startOffset;
            }

            // Wrap in a paragraph
            const p = document.createElement('p');

            // Collect all text nodes and inline elements at the beginning
            while (this.el.firstChild &&
                (this.el.firstChild.nodeType === Node.TEXT_NODE ||
                    (this.el.firstChild.nodeType === Node.ELEMENT_NODE &&
                        !['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'BLOCKQUOTE', 'ASIDE', 'PRE', 'TABLE', 'FIGURE', 'HR', 'DIV'].includes(this.el.firstChild.tagName)))) {
                p.appendChild(this.el.firstChild);
            }

            this.el.insertBefore(p, this.el.firstChild);

            // Restore cursor position after wrapping
            if (savedNode && p.contains(savedNode)) {
                try {
                    const newRange = document.createRange();
                    newRange.setStart(savedNode, savedOffset);
                    newRange.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(newRange);
                } catch (e) {
                    // Fallback: place cursor at end of p
                    const newRange = document.createRange();
                    newRange.selectNodeContents(p);
                    newRange.collapse(false);
                    sel.removeAllRanges();
                    sel.addRange(newRange);
                }
            }
        }
    }

    // Ensure there is an empty paragraph at the end of the editor
    // if the last element is an uneditable block (figure, table, hr, etc.)
    ensureTrailingParagraph() {
        const lastChild = this.el.lastElementChild;
        if (lastChild && (
            ['FIGURE', 'TABLE', 'HR', 'PRE'].includes(lastChild.tagName) ||
            (lastChild.tagName === 'DIV' && (lastChild.classList.contains('redactix-separator') || lastChild.classList.contains('redactix-video-wrapper')))
        )) {
            const p = document.createElement('p');
            p.innerHTML = '<br>';
            this.el.appendChild(p);
        }
    }

    bindEvents() {
        // Observer for any DOM changes (the most reliable synchronization method)
        this.observer = new MutationObserver((mutations) => {
            this.instance.sync();
            this.updatePlaceholder();
        });

        this.observer.observe(this.el, {
            childList: true,
            subtree: true,
            characterData: true
        });

        // Disconnect observer when the instance is destroyed.
        if (this.instance.onDestroy) {
            this.instance.onDestroy(() => this.observer.disconnect());
        }

        // Completely disable native HTML5 drag for the editor's content:
        // otherwise, the browser can drag <img> inside contenteditable
        // and drop them anywhere (up to inserting <img> inside <h2>).
        // Block dragging is implemented via mousedown in BlockControl,
        // native dragstart is not needed. Previously this was done by
        // Image/Video modules, but only with configured uploadUrl — now disabled always.
        this.el.addEventListener('dragstart', (e) => {
            e.preventDefault();
        });

        // Synchronization on input (as an addition for instant feedback)
        this.el.addEventListener('input', () => {
            this.ensureEditorStructure();
            this.instance.sync();
            this.updatePlaceholder();
        });

        // ensureTrailingParagraph is now called from RedactixInstance._doSync —
        // any structural edit automatically gets a landing <p> at the end.

        // Paste handling
        this.el.addEventListener('paste', (e) => {
            e.preventDefault();
            this.handlePaste(e);
        });

        // Keydown handling
        this.el.addEventListener('keydown', (e) => {
            // During IME composition (Japanese/Korean/Chinese input,
            // many Android keyboards) space and Enter control candidate selection —
            // custom handlers break composition.
            if (e.isComposing || e.keyCode === 229) return;

            // Shift+Enter inside aside/blockquote — insert <br> explicitly
            if (e.key === 'Enter' && e.shiftKey) {
                if (this.handleShiftEnter(e)) {
                    return;
                }
            }

            // Enter in empty blocks to exit lists/quotes
            if (e.key === 'Enter' && !e.shiftKey) {
                if (this.handleEnterKey(e)) {
                    return;
                }
            }

            // Backspace at the beginning of a block to convert
            if (e.key === 'Backspace') {
                if (this.handleBackspace(e)) {
                    return;
                }
            }

            // Delete (forward) — protect atomic blocks (figure / pre / table /
            // hr / video-wrapper / separator) from being destroyed when the
            // user is just trying to remove an adjacent empty paragraph.
            if (e.key === 'Delete') {
                if (this.handleDelete(e)) {
                    return;
                }
            }

            // Space - smart handling
            if (e.key === ' ' && !e.ctrlKey && !e.metaKey && !e.altKey) {
                e.preventDefault();
                this.handleSpace();
            }
        });
    }

    handlePaste(e) {
        const clipboardData = e.clipboardData || window.clipboardData;

        // Try to get HTML
        let html = clipboardData.getData('text/html');
        let text = clipboardData.getData('text/plain');

        if (html) {
            // Sanitizing HTML
            html = this.sanitizeHtml(html);

            // Parse into temp element to check structure
            const temp = document.createElement('div');
            temp.innerHTML = html;

            const blockSelector = 'p, h1, h2, h3, h4, h5, h6, blockquote, aside, figure, pre, table, ul, ol, hr, div';
            const hasBlocks = !!temp.querySelector(blockSelector);

            if (!hasBlocks) {
                // Inline-only content — insertHTML works fine for this
                document.execCommand('insertHTML', false, html);
            } else {
                // Block content — manual DOM insertion to avoid browser quirks
                this.insertBlockContent(temp);
            }

            // Setup inserted figure tags
            if (this.instance.setupFigures) {
                this.instance.setupFigures();
            }

            // Migrate any pasted legacy blockquotes and wire up quote-cards
            if (this.instance.runQuoteCardSetup) {
                this.instance.runQuoteCardSetup();
            }
            if (this.instance.runCalloutSetup) {
                this.instance.runCalloutSetup();
            }
            if (this.instance.runEmbedSetup) {
                this.instance.runEmbedSetup();
            }
            if (this.instance.runVideoSetup) {
                this.instance.runVideoSetup();
            }
            if (this.instance.runGallerySetup) {
                this.instance.runGallerySetup();
            }
        } else if (text) {
            // If only text - insert preserving line breaks
            const lines = text.split('\n');
            if (lines.length > 1) {
                const html = lines.map(line => {
                    if (line.trim() === '') return '<br>';
                    return `<p>${this.escapeHtml(line)}</p>`;
                }).join('');
                document.execCommand('insertHTML', false, html);
            } else {
                document.execCommand('insertText', false, text);
            }
        }

        this.instance.sync();
        this.updatePlaceholder();
        this.ensureTrailingParagraph();
    }

    /**
     * Insert block-level content from a parsed container using DOM API.
     * Avoids insertHTML quirks with block elements inside blocks.
     *
     * Insertion host is not always the editor root: when the cursor sits
     * inside a callout (<aside>) or a quote-card's <blockquote>, pasted
     * blocks land INSIDE that container (after the current inner block),
     * not after the container at top level. Disallowed tags get cleaned
     * up by the migrate/normalize passes that run right after paste.
     */
    insertBlockContent(container) {
        const sel = window.getSelection();
        if (!sel.rangeCount) return;

        const range = sel.getRangeAt(0);
        range.deleteContents();

        // Containers inside which block insertion is allowed.
        const isInsertionHost = (el) => {
            if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
            if (el === this.el) return true;
            if (el.tagName === 'ASIDE') return true;
            if (el.tagName === 'BLOCKQUOTE' && el.parentElement &&
                el.parentElement.tagName === 'FIGURE' &&
                el.parentElement.classList.contains('quote-card')) return true;
            return false;
        };

        // Find the nearest block whose parent is an insertion host.
        let currentBlock = range.startContainer;
        while (currentBlock && currentBlock !== this.el && !isInsertionHost(currentBlock.parentNode)) {
            currentBlock = currentBlock.parentNode;
        }

        // If we couldn't find a block or we're at editor root level
        if (!currentBlock || currentBlock === this.el) {
            // Just insert all children at cursor position
            const frag = document.createDocumentFragment();
            while (container.firstChild) {
                frag.appendChild(container.firstChild);
            }
            range.insertNode(frag);
            range.collapse(false);
            sel.removeAllRanges();
            sel.addRange(range);
            return;
        }

        // Check if current block is empty (only <br> or whitespace)
        const currentContent = currentBlock.innerHTML.replace(/<br\s*\/?>/gi, '').trim();
        const isCurrentEmpty = !currentContent;

        // Collect all nodes to insert
        const nodesToInsert = [];
        while (container.firstChild) {
            nodesToInsert.push(container.firstChild);
            container.removeChild(container.firstChild);
        }

        if (nodesToInsert.length === 0) return;

        // Insert each node after the current block, inside its host
        // (editor root, aside, or quote-card blockquote).
        const host = currentBlock.parentNode;
        let insertionRef = currentBlock.nextSibling;
        for (const node of nodesToInsert) {
            host.insertBefore(node, insertionRef);
        }

        // If current block was empty, remove it (pasted content replaces it)
        if (isCurrentEmpty) {
            currentBlock.remove();
        }

        // Place cursor at the end of the last inserted node
        const lastInserted = insertionRef
            ? insertionRef.previousSibling
            : host.lastChild;
        if (lastInserted) {
            const newRange = document.createRange();
            if (lastInserted.nodeType === Node.ELEMENT_NODE) {
                newRange.selectNodeContents(lastInserted);
                newRange.collapse(false);
            } else {
                newRange.setStartAfter(lastInserted);
                newRange.collapse(true);
            }
            sel.removeAllRanges();
            sel.addRange(newRange);
        }
    }

    sanitizeHtml(html) {
        // Create temporary element for parsing
        const temp = document.createElement('div');
        temp.innerHTML = html;

        // Remove Google Docs helper wrappers (b with id="docs-internal-guid-...")
        const googleWrappers = temp.querySelectorAll('b[id^="docs-internal-guid"]');
        googleWrappers.forEach(wrapper => {
            // Unwrap content, removing the wrapper
            while (wrapper.firstChild) {
                wrapper.parentNode.insertBefore(wrapper.firstChild, wrapper);
            }
            wrapper.remove();
        });

        // Unwrap editor separator wrappers to bare <hr>.
        // They are not in the saved HTML, but when copying from the editor's
        // live DOM they end up in the buffer; without unwrap, the div cleanup below
        // would turn them into <p><hr></p>. wrapSeparators() will restore the wrapper
        // after insertion.
        temp.querySelectorAll('div.redactix-separator').forEach(wrapper => {
            const hr = wrapper.querySelector('hr');
            if (hr) wrapper.parentNode.replaceChild(hr, wrapper);
            else wrapper.remove();
        });

        // Spare iframes that belong to a known embed provider (or already
        // sit inside a redactix-embed figure) before the dangerousTags
        // sweep. Sanitize them in place so the attribute-cleanup loop
        // below doesn't strip src/allow/etc.
        const embedModule = this.instance.modules.find(m => m.constructor.name === 'Embed');
        const safeIframes = new Set();
        if (embedModule) {
            Array.from(temp.querySelectorAll('iframe')).forEach(iframe => {
                const insideEmbed = iframe.closest && iframe.closest('figure.redactix-embed');
                const src = iframe.getAttribute('src') || '';
                const detected = embedModule.findProviderByUrl(src);
                if (insideEmbed || detected) {
                    embedModule.sanitizeIframe(iframe);
                    safeIframes.add(iframe);

                    // If the iframe wasn't wrapped in a redactix-embed figure,
                    // wrap it now so it survives later passes and renders
                    // correctly with our CSS.
                    if (!insideEmbed) {
                        const figure = document.createElement('figure');
                        figure.className = 'redactix-embed';
                        figure.setAttribute('data-provider', detected ? detected.provider.name : 'custom');
                        figure.setAttribute('data-aspect', detected ? (detected.provider.aspect || 'auto') : 'auto');
                        const frame = document.createElement('div');
                        frame.className = 'redactix-embed-frame';
                        iframe.parentNode.insertBefore(figure, iframe);
                        frame.appendChild(iframe);
                        figure.appendChild(frame);
                    }
                }
            });
        }

        // Spare <video> tags that already sit inside a figure.redactix-video
        // (i.e. saved Redactix output being pasted back). They get a safe
        // attribute set, then survive the global attribute sweep below.
        // Standalone <video> tags pasted from elsewhere are stripped — we
        // only re-render videos the editor itself produced.
        const videoModule = this.instance.modules.find(m => m.constructor.name === 'Video');
        const safeVideos = new Set();
        if (videoModule) {
            Array.from(temp.querySelectorAll('figure.redactix-video > video')).forEach(video => {
                const src = video.getAttribute('src') || '';
                if (!src || src.toLowerCase().startsWith('javascript:')) return;
                // Whitelisted attribute set: src + controls + preload + style
                // (only when style declares aspect-ratio).
                const aspectStyle = (video.getAttribute('style') || '').match(/aspect-ratio\s*:\s*[^;]+/i);
                Array.from(video.attributes).forEach(attr => {
                    video.removeAttribute(attr.name);
                });
                video.setAttribute('src', src);
                video.setAttribute('controls', '');
                video.setAttribute('preload', 'metadata');
                if (aspectStyle) video.setAttribute('style', aspectStyle[0]);
                safeVideos.add(video);
            });
        }

        // Remove dangerous and unnecessary tags
        const dangerousTags = ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'meta', 'colgroup'];
        dangerousTags.forEach(tag => {
            const elements = Array.from(temp.getElementsByTagName(tag));
            elements.forEach(el => {
                if (tag === 'iframe' && safeIframes.has(el)) return;
                if (el.parentNode) el.parentNode.removeChild(el);
            });
        });

        // Strip standalone <video> tags that aren't wrapped in a redactix-video
        // figure — we only render videos through our own pipeline.
        Array.from(temp.querySelectorAll('video')).forEach(video => {
            if (safeVideos.has(video)) return;
            if (video.parentNode) video.parentNode.removeChild(video);
        });

        // Convert styled spans into semantic tags (before style removal!)
        // Google Docs uses inline styles instead of b/i/u tags
        const styledSpans = Array.from(temp.querySelectorAll('span[style]'));
        styledSpans.forEach(span => {
            const style = span.getAttribute('style') || '';
            let wrapper = null;

            // Check styles and create corresponding tags
            // Order is important: outer first, then inner
            const isBold = /font-weight:\s*(bold|700|800|900)/i.test(style);
            const isItalic = /font-style:\s*italic/i.test(style);
            const isUnderline = /text-decoration:[^;]*underline/i.test(style);
            const isStrike = /text-decoration:[^;]*line-through/i.test(style);

            if (isBold || isItalic || isUnderline || isStrike) {
                // Collect span content
                const content = document.createDocumentFragment();
                while (span.firstChild) {
                    content.appendChild(span.firstChild);
                }

                // Wrap in tags (from outer to inner)
                let result = content;

                if (isStrike) {
                    const s = document.createElement('s');
                    s.appendChild(result);
                    result = s;
                }
                if (isUnderline) {
                    const u = document.createElement('u');
                    u.appendChild(result);
                    result = u;
                }
                if (isItalic) {
                    const i = document.createElement('i');
                    i.appendChild(result);
                    result = i;
                }
                if (isBold) {
                    const b = document.createElement('b');
                    b.appendChild(result);
                    result = b;
                }

                span.parentNode.replaceChild(result, span);
            }
        });

        // Remove all attributes except allowed ones.
        // rel/target/download are allowed but filtered by whitelist
        // (sanitizeRel / sanitizeTarget below). href/src are checked for
        // allowed schema via sanitizeUrl — cuts off javascript:, data:
        // (except raster images) and others.
        const allowedAttributes = ['href', 'src', 'alt', 'title', 'colspan', 'rowspan', 'rel', 'target', 'download'];
        // Allowed classes. Editor structural names are hardcoded, and
        // callout/quote preset classes are taken from config — so that if a user
        // disabled default presets, corresponding classes won't survive pasting;
        // and vice versa, custom classes (calloutPresets / quotePresets)
        // will pass without explicit whitelisting.
        const allowedClasses = ['spoiler', 'quote-card',
            'redactix-embed', 'redactix-embed-frame',
            'redactix-video', 'redactix-gallery', 'redactix-gallery-grid'];
        const presetClasses = [
            ...(this.instance.config.calloutPresets || []),
            ...(this.instance.config.quotePresets || [])
        ].map(p => p.class).filter(Boolean);
        allowedClasses.push(...presetClasses);
        const allElements = temp.getElementsByTagName('*');

        for (let i = 0; i < allElements.length; i++) {
            const el = allElements[i];
            // Iframes that we've spared above were already sanitized to a
            // safe attribute set — don't re-strip them here.
            if (el.tagName === 'IFRAME' && safeIframes.has(el)) continue;
            // Same for safe <video> tags inside figure.redactix-video.
            if (el.tagName === 'VIDEO' && safeVideos.has(el)) continue;
            const attrs = Array.from(el.attributes);

            attrs.forEach(attr => {
                if (!allowedAttributes.includes(attr.name.toLowerCase())) {
                    // Allow data-emoji on aside elements
                    if (attr.name.toLowerCase() === 'data-emoji' && el.tagName === 'ASIDE') {
                        return;
                    }
                    // Allow data-provider / data-aspect / data-height /
                    // data-source-url on redactix-embed figures
                    if ((attr.name.toLowerCase() === 'data-provider' ||
                         attr.name.toLowerCase() === 'data-aspect' ||
                         attr.name.toLowerCase() === 'data-height' ||
                         attr.name.toLowerCase() === 'data-source-url') &&
                        el.tagName === 'FIGURE' &&
                        el.classList.contains('redactix-embed')) {
                        return;
                    }
                    // Allow data-aspect on redactix-video figures
                    if (attr.name.toLowerCase() === 'data-aspect' &&
                        el.tagName === 'FIGURE' &&
                        el.classList.contains('redactix-video')) {
                        return;
                    }
                    // For class — filter, keeping only allowed ones
                    if (attr.name.toLowerCase() === 'class') {
                        const classes = attr.value.split(/\s+/).filter(c => allowedClasses.includes(c));
                        if (classes.length > 0) {
                            el.setAttribute('class', classes.join(' '));
                        } else {
                            el.removeAttribute('class');
                        }
                    } else {
                        el.removeAttribute(attr.name);
                    }
                }

                // Check href / src scheme — allow only http(s),
                // mailto, tel, relative and (for image src) data:image/*
                // (except svg+xml). Everything else — javascript:, data:text/html,
                // vbscript: and so on — is discarded.
                const nameLower = attr.name.toLowerCase();
                if (nameLower === 'href') {
                    const safe = sanitizeUrl(attr.value);
                    if (safe === null) el.removeAttribute(attr.name);
                } else if (nameLower === 'src') {
                    const safe = (el.tagName === 'IMG')
                        ? sanitizeImageSrc(attr.value)
                        : sanitizeUrl(attr.value);
                    if (safe === null) el.removeAttribute(attr.name);
                } else if (nameLower === 'rel' && el.tagName === 'A') {
                    const cleaned = sanitizeRel(attr.value);
                    if (cleaned) el.setAttribute('rel', cleaned);
                    else el.removeAttribute('rel');
                } else if (nameLower === 'target' && el.tagName === 'A') {
                    const cleaned = sanitizeTarget(attr.value);
                    if (cleaned) {
                        el.setAttribute('target', cleaned);
                        // target=_blank without noopener/noreferrer — tab-jacking vector,
                        // fix rel automatically.
                        if (cleaned === '_blank') {
                            const existing = sanitizeRel(el.getAttribute('rel') || '');
                            const tokens = new Set(existing ? existing.split(/\s+/) : []);
                            tokens.add('noopener');
                            tokens.add('noreferrer');
                            el.setAttribute('rel', Array.from(tokens).join(' '));
                        }
                    } else {
                        el.removeAttribute('target');
                    }
                }
            });

            // Remove inline styles — except for <video> inside figure.redactix-video,
            // for which we have already left only aspect-ratio above.
            if (!(el.tagName === 'VIDEO' && safeVideos.has(el))) {
                el.removeAttribute('style');
            }
        }

        // Simplify list structure: if li contains only one p — unwrap
        const listItems = Array.from(temp.querySelectorAll('li'));
        listItems.forEach(li => {
            const children = Array.from(li.children);
            const paragraphs = children.filter(c => c.tagName === 'P');

            // If there are only paragraphs (and possibly br) inside li
            if (paragraphs.length > 0 && children.every(c => c.tagName === 'P' || c.tagName === 'BR')) {
                // Разворачиваем содержимое параграфов в li
                const fragment = document.createDocumentFragment();

                children.forEach((child, index) => {
                    if (child.tagName === 'P') {
                        // Transfer p content
                        while (child.firstChild) {
                            fragment.appendChild(child.firstChild);
                        }
                        // Add br between paragraphs (except the last one)
                        if (index < children.length - 1) {
                            fragment.appendChild(document.createElement('br'));
                        }
                    }
                });

                li.innerHTML = '';
                li.appendChild(fragment);
            }
        });

        // Fix incorrect nesting of block elements (Google Docs issue)
        // For example: <h1><p>text</p></h1> -> <h1>text</h1>
        const blockTags = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'BLOCKQUOTE', 'ASIDE'];
        blockTags.forEach(tag => {
            const elements = Array.from(temp.querySelectorAll(tag));
            elements.forEach(el => {
                // If there are other block elements inside the block element
                const nestedBlocks = el.querySelectorAll('p, h1, h2, h3, h4, h5, h6, div');
                if (nestedBlocks.length > 0) {
                    // Collect nested blocks content
                    const fragment = document.createDocumentFragment();

                    Array.from(el.childNodes).forEach(child => {
                        if (child.nodeType === Node.ELEMENT_NODE &&
                            ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'DIV'].includes(child.tagName)) {
                            // This is a nested block element — extract its content
                            // or the element itself, if the parent is a heading and the nested is p
                            if (blockTags.slice(0, 6).includes(el.tagName) && child.tagName === 'P') {
                                // Heading contains p — take only p content
                                while (child.firstChild) {
                                    fragment.appendChild(child.firstChild);
                                }
                            } else {
                                // Pull block outside
                                fragment.appendChild(child.cloneNode(true));
                            }
                        } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName === 'BR') {
                            // Skip extra br between blocks
                        } else if (child.nodeType === Node.TEXT_NODE && !child.textContent.trim()) {
                            // Skip empty text nodes
                        } else {
                            fragment.appendChild(child.cloneNode(true));
                        }
                    });

                    // Заменяем содержимое
                    el.innerHTML = '';
                    el.appendChild(fragment);
                }

                // If after cleanup the element is empty or contains only br — remove
                const innerContent = el.innerHTML.replace(/<br\s*\/?>/gi, '').trim();
                if (!innerContent) {
                    el.remove();
                }
            });
        });

        // Clean up empty span and font tags
        const emptyTags = temp.querySelectorAll('span:empty, font:empty');
        emptyTags.forEach(el => el.remove());

        // Unwrap span tags without attributes (useless wrappers)
        const spans = Array.from(temp.querySelectorAll('span'));
        spans.forEach(span => {
            if (span.attributes.length === 0) {
                while (span.firstChild) {
                    span.parentNode.insertBefore(span.firstChild, span);
                }
                span.remove();
            }
        });

        // Replace font with span
        const fonts = temp.getElementsByTagName('font');
        while (fonts.length > 0) {
            const font = fonts[0];
            const span = document.createElement('span');
            while (font.firstChild) {
                span.appendChild(font.firstChild);
            }
            font.parentNode.replaceChild(span, font);
        }

        // Canonicalize synonymous inline tags: <strong>→<b>, <em>→<i>,
        // <strike>→<s>. In the output HTML each role is represented by exactly
        // one tag.
        normalizeInlineSynonyms(temp);

        // Remove empty divs and replace non-empty ones with p.
        // Structural editor divs (embed-frame, gallery-grid) must not
        // be touched — without them setupEmbeds()/setupGalleries() will consider the figure
        // broken and remove it along with the content.
        const divs = Array.from(temp.querySelectorAll('div'));
        divs.forEach(div => {
            if (div.classList.contains('redactix-embed-frame') ||
                div.classList.contains('redactix-gallery-grid')) {
                return;
            }
            const innerContent = div.innerHTML.replace(/<br\s*\/?>/gi, '').trim();
            if (!innerContent) {
                div.remove();
            } else {
                // Заменяем div на p
                const p = document.createElement('p');
                p.innerHTML = div.innerHTML;
                div.parentNode.replaceChild(p, div);
            }
        });

        // Wrap img in figure (if not already wrapped)
        const images = Array.from(temp.querySelectorAll('img'));
        images.forEach(img => {
            // Skip if already inside figure
            if (img.closest('figure')) return;

            // Remove style on img
            img.removeAttribute('style');

            const figure = document.createElement('figure');
            const figcaption = document.createElement('figcaption');
            figcaption.innerHTML = '<br>';

            const parent = img.parentNode;

            // If img is inside p or div and there is room to move — extract figure one level up
            if ((parent.tagName === 'P' || parent.tagName === 'DIV') && parent.parentNode) {
                parent.parentNode.insertBefore(figure, parent);
            } else {
                parent.insertBefore(figure, img);
            }

            figure.appendChild(img);
            figure.appendChild(figcaption);
        });

        // Remove empty class attributes
        temp.querySelectorAll('[class=""]').forEach(el => {
            el.removeAttribute('class');
        });

        // Remove Microsoft Office garbage
        html = temp.innerHTML;
        html = html.replace(/<!--\[if[\s\S]*?\]>[\s\S]*?<!\[endif\]-->/gi, '');
        html = html.replace(/<!--[\s\S]*?-->/g, '');
        html = html.replace(/<o:p>[\s\S]*?<\/o:p>/gi, '');
        html = html.replace(/class="Mso[^"]*"/gi, '');

        return html.trim();
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Insert a <br> element at the current cursor position via DOM API.
     * We avoid document.execCommand('insertLineBreak') because with
     * white-space:pre-wrap it inserts a \n text node instead of a <br> tag.
     */
    insertBrAtCursor() {
        const sel = window.getSelection();
        if (!sel.rangeCount) return;

        const range = sel.getRangeAt(0);
        range.deleteContents();

        const br = document.createElement('br');
        range.insertNode(br);

        // If <br> is at the very end of its parent (no meaningful content after),
        // browsers won't render a visible new line. Add a second <br> so the
        // cursor has a line to land on.
        const next = br.nextSibling;
        const needsExtra = !next ||
            (next.nodeType === Node.TEXT_NODE && next.textContent === '');
        if (needsExtra) {
            const extraBr = document.createElement('br');
            br.parentNode.insertBefore(extraBr, br.nextSibling);
        }

        // Place cursor after the first <br>
        const newRange = document.createRange();
        newRange.setStartAfter(br);
        newRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newRange);
    }

    /**
     * Handle Shift+Enter inside aside and blockquote elements.
     * Insert a real <br> tag instead of relying on browser default.
     */
    handleShiftEnter(e) {
        const selection = window.getSelection();
        if (!selection.rangeCount) return false;

        const range = selection.getRangeAt(0);
        let node = range.startContainer;

        // Walk up to find if we are inside an aside or blockquote
        while (node && node !== this.el) {
            if (node.nodeType === Node.ELEMENT_NODE &&
                (node.tagName === 'ASIDE' || node.tagName === 'BLOCKQUOTE')) {
                e.preventDefault();
                this.insertBrAtCursor();
                this.instance.sync();
                return true;
            }
            node = node.parentNode;
        }

        return false;
    }

    handleEnterKey(e) {
        const selection = window.getSelection();
        if (!selection.rangeCount) return false;

        const range = selection.getRangeAt(0);
        let block = range.startContainer;

        // Check if we are inside a figcaption — special-case quote-card (block
        // Enter entirely; single-line author field) vs. plain figure (insert <br>).
        let inlineEditable = block;
        while (inlineEditable && inlineEditable !== this.el) {
            if (inlineEditable.nodeType === Node.ELEMENT_NODE &&
                inlineEditable.tagName === 'FIGCAPTION') {
                const card = inlineEditable.parentElement;
                if (card && card.tagName === 'FIGURE' && card.classList.contains('quote-card')) {
                    e.preventDefault();
                    return true;
                }
                e.preventDefault();
                this.insertBrAtCursor();
                this.instance.sync();
                return true;
            }
            inlineEditable = inlineEditable.parentNode;
        }

        // Find block element
        while (block && block !== this.el) {
            if (block.nodeType === Node.ELEMENT_NODE) {
                const tag = block.tagName;
                if (['LI', 'BLOCKQUOTE', 'ASIDE', 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(tag)) {
                    break;
                }
            }
            block = block.parentNode;
        }

        if (!block || block === this.el) return false;

        // Quote-card: Enter on the empty last block exits the card.
        const card = block.closest && block.closest('figure.quote-card');
        if (card && block.tagName !== 'LI') {
            const bq = card.querySelector(':scope > blockquote');
            if (bq && block.parentNode === bq) {
                const isLast = block === bq.lastElementChild;
                // Quote-card не разрешает <hr> внутри, поэтому селектор уже.
                const isEmpty = isBlockEmpty(block, 'img, iframe');
                if (isLast && isEmpty) {
                    e.preventDefault();
                    block.remove();
                    if (bq.children.length === 0) {
                        const filler = document.createElement('p');
                        filler.innerHTML = '<br>';
                        bq.appendChild(filler);
                    }
                    const exitP = document.createElement('p');
                    exitP.innerHTML = '<br>';
                    card.parentNode.insertBefore(exitP, card.nextSibling);
                    const newRange = document.createRange();
                    newRange.setStart(exitP, 0);
                    newRange.collapse(true);
                    selection.removeAllRanges();
                    selection.addRange(newRange);
                    this.instance.sync();
                    return true;
                }
                // Otherwise let the browser create a sibling block inside the blockquote.
                return false;
            }
        }

        // Callout: Enter on the empty last block exits the aside.
        // Mirrors the quote-card behavior.
        const aside = block.closest && block.closest('aside');
        if (aside && block.tagName !== 'LI' && block.parentNode === aside) {
            const isLast = block === aside.lastElementChild;
            // Callout (aside) разрешает <hr> внутри — учитываем в селекторе.
            const isEmpty = isBlockEmpty(block, 'img, iframe, hr');
            if (isLast && isEmpty) {
                e.preventDefault();
                block.remove();
                if (aside.children.length === 0) {
                    const filler = document.createElement('p');
                    filler.innerHTML = '<br>';
                    aside.appendChild(filler);
                }
                const exitP = document.createElement('p');
                exitP.innerHTML = '<br>';
                aside.parentNode.insertBefore(exitP, aside.nextSibling);
                const newRange = document.createRange();
                newRange.setStart(exitP, 0);
                newRange.collapse(true);
                selection.removeAllRanges();
                selection.addRange(newRange);
                this.instance.sync();
                return true;
            }
            // Otherwise let the browser create a sibling block inside the aside.
            return false;
        }

        // Check that the block is empty (general case for LI etc.)
        const isEmpty = isBlockEmpty(block, 'img, iframe');

        // Exit from the list on empty LI
        if (block.tagName === 'LI' && isEmpty) {
            e.preventDefault();

            const list = block.parentElement;
            const nextSibling = block.nextElementSibling;

            // Check if this is a nested list
            // 1. Standard nesting: the list parent is LI
            const parentLi = list.parentElement.closest('li');
            // 2. Non-standard (incorrect) nesting: list inside a list
            const parentIsList = ['UL', 'OL'].includes(list.parentElement.tagName);

            const isNested = !!parentLi || parentIsList;

            if (isNested) {
                // This is a nested list - we need to exit to a higher level

                // Determine where to move the element
                let targetList;
                let referenceNode;

                if (parentLi) {
                    targetList = parentLi.parentElement;
                    referenceNode = parentLi;
                } else {
                    // If the list was nested incorrectly (directly in UL/OL)
                    targetList = list.parentElement;
                    referenceNode = list;
                }

                // Create a new LI for the parent list
                const newLi = document.createElement('li');

                // If there are elements after the current LI in the nested list
                if (nextSibling) {
                    // Create a new nested list for the remaining elements
                    const newNestedList = document.createElement(list.tagName);
                    let current = nextSibling;
                    while (current) {
                        const next = current.nextElementSibling;
                        newNestedList.appendChild(current);
                        current = next;
                    }
                    // Add text node before the nested list for cursor positioning
                    const textNode = document.createTextNode('');
                    newLi.appendChild(textNode);
                    newLi.appendChild(newNestedList);
                } else {
                    newLi.innerHTML = '<br>';
                }

                // Insert new LI after the parent element (LI or nested list)
                if (referenceNode.nextSibling) {
                    targetList.insertBefore(newLi, referenceNode.nextSibling);
                } else {
                    targetList.appendChild(newLi);
                }

                // Remove empty LI from the nested list
                block.remove();

                // If the nested list became empty - remove it
                if (list.children.length === 0) {
                    list.remove();
                }

                // Place cursor in the new LI
                const newRange = document.createRange();
                newRange.setStart(newLi, 0);
                newRange.collapse(true);
                selection.removeAllRanges();
                selection.addRange(newRange);

                this.instance.sync();
                return true;
            }

            // This is a top-level list - exit to a paragraph
            const p = document.createElement('p');
            p.innerHTML = '<br>';

            // If there are elements after the current one - list needs to be split
            if (nextSibling) {
                // Create a new list for the remaining elements
                const newList = document.createElement(list.tagName);
                let current = nextSibling;
                while (current) {
                    const next = current.nextElementSibling;
                    newList.appendChild(current);
                    current = next;
                }

                // Insert paragraph and new list after the current list
                list.parentNode.insertBefore(p, list.nextSibling);
                p.parentNode.insertBefore(newList, p.nextSibling);
            } else {
                // Just insert paragraph after the list
                list.parentNode.insertBefore(p, list.nextSibling);
            }

            // Remove empty LI
            block.remove();

            // If the list became empty - remove it
            if (list.children.length === 0) {
                list.remove();
            }

            // Place cursor in the new paragraph
            const newRange = document.createRange();
            newRange.setStart(p, 0);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);

            this.instance.sync();
            return true;
        }

        return false;
    }

    handleBackspace(e) {
        const selection = window.getSelection();
        if (!selection.rangeCount || !selection.isCollapsed) return false;

        const range = selection.getRangeAt(0);

        // Check that cursor is at the beginning
        if (range.startOffset !== 0) return false;

        let block = range.startContainer;
        while (block && block !== this.el) {
            if (block.nodeType === Node.ELEMENT_NODE) {
                const tag = block.tagName;
                // P is included so we can detect blocks inside quote-card
                if (['LI', 'BLOCKQUOTE', 'ASIDE', 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(tag)) {
                    break;
                }
            }
            block = block.parentNode;
        }

        if (!block || block === this.el) return false;

        // Check that cursor is at the very beginning of the block
        let node = range.startContainer;
        while (node && node !== block) {
            if (node.previousSibling) return false;
            node = node.parentNode;
        }

        // Quote-card: don't let backspace escape the card
        const card = block.closest && block.closest('figure.quote-card');
        if (card && block.tagName !== 'LI') {
            const bq = card.querySelector(':scope > blockquote');
            if (bq && block.parentNode === bq) {
                const isFirst = block === bq.firstElementChild;
                if (!isFirst) {
                    // Let the browser merge with the previous block inside blockquote
                    return false;
                }
                const isEmpty = isBlockEmpty(block, 'img, iframe');
                if (!isEmpty) {
                    // Don't merge with content outside the card
                    e.preventDefault();
                    return true;
                }
                e.preventDefault();
                block.remove();
                if (bq.children.length === 0) {
                    // Card became empty — replace whole card with a paragraph
                    const replacement = document.createElement('p');
                    replacement.innerHTML = '<br>';
                    card.parentNode.replaceChild(replacement, card);
                    const r = document.createRange();
                    r.setStart(replacement, 0);
                    r.collapse(true);
                    selection.removeAllRanges();
                    selection.addRange(r);
                } else {
                    const newFirst = bq.firstElementChild;
                    const r = document.createRange();
                    r.setStart(newFirst, 0);
                    r.collapse(true);
                    selection.removeAllRanges();
                    selection.addRange(r);
                }
                this.instance.sync();
                return true;
            }
        }

        // Callout: same idea — don't let backspace escape the aside.
        const aside = block.closest && block.closest('aside');
        if (aside && block.tagName !== 'LI' && block.parentNode === aside) {
            const isFirst = block === aside.firstElementChild;
            if (!isFirst) {
                // Let the browser merge with the previous block inside aside
                return false;
            }
            const isEmpty = isBlockEmpty(block, 'img, iframe, hr');
            if (!isEmpty) {
                e.preventDefault();
                return true;
            }
            e.preventDefault();
            block.remove();
            if (aside.children.length === 0) {
                // Aside became empty — replace whole aside with a paragraph
                const replacement = document.createElement('p');
                replacement.innerHTML = '<br>';
                aside.parentNode.replaceChild(replacement, aside);
                const r = document.createRange();
                r.setStart(replacement, 0);
                r.collapse(true);
                selection.removeAllRanges();
                selection.addRange(r);
            } else {
                const newFirst = aside.firstElementChild;
                const r = document.createRange();
                r.setStart(newFirst, 0);
                r.collapse(true);
                selection.removeAllRanges();
                selection.addRange(r);
            }
            this.instance.sync();
            return true;
        }

        // Standalone P at top level — protect adjacent atomic blocks
        // (figure / pre / table / hr / video-wrapper / separator) from
        // browser's default backspace-merge, which deletes the whole atomic
        // block when its only "neighbour" content is non-editable.
        if (block.tagName === 'P' && block.parentNode === this.el) {
            const prev = block.previousElementSibling;
            if (prev && this.isAtomicBlock(prev) &&
                this.isCursorAtStartOfBlock(range, block)) {
                e.preventDefault();
                if (!isBlockEmpty(block)) {
                    // Don't merge content into / destroy the atomic block.
                    return true;
                }
                this.removeBlockNextToAtomic(block, prev, 'end');
                this.instance.sync();
                return true;
            }
            return false;
        }
        if (block.tagName === 'P') return false;

        // Convert heading to paragraph
        if (['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(block.tagName)) {
            e.preventDefault();

            const p = document.createElement('p');
            while (block.firstChild) {
                p.appendChild(block.firstChild);
            }
            if (!p.innerHTML.trim()) p.innerHTML = '<br>';

            block.parentNode.replaceChild(p, block);

            const newRange = document.createRange();
            newRange.setStart(p, 0);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);

            this.instance.sync();
            return true;
        }

        // Defensive fallback: top-level <aside> with no inner block (shouldn't
        // happen after migration, but kept just in case) — convert to paragraph.
        if (block.tagName === 'ASIDE') {
            e.preventDefault();

            const p = document.createElement('p');
            while (block.firstChild) {
                p.appendChild(block.firstChild);
            }
            if (!p.innerHTML.trim()) p.innerHTML = '<br>';

            block.parentNode.replaceChild(p, block);

            const newRange = document.createRange();
            newRange.setStart(p, 0);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);

            this.instance.sync();
            return true;
        }

        return false;
    }

    /**
     * Forward Delete handler — symmetric to handleBackspace's protection of
     * adjacent atomic blocks. Triggered on Delete pressed at the END of a
     * top-level P that's followed by figure / pre / table / hr / .redactix-
     * separator / .redactix-video-wrapper. Browser's default would merge the
     * atomic block into the empty paragraph, destroying both.
     */
    handleDelete(e) {
        const selection = window.getSelection();
        if (!selection.rangeCount || !selection.isCollapsed) return false;

        const range = selection.getRangeAt(0);

        // Find the top-level block (direct child of the editor) that
        // contains the cursor. We deliberately do NOT stop at the nearest
        // P/H — going to top level lets us correctly handle cases like a
        // cursor in the last paragraph of a list/aside followed by an atomic
        // block, and cases where the immediate nearest editable block is the
        // top-level block itself.
        const block = this.findTopLevelBlock(range.endContainer);
        if (!block) return false;
        // Cursor inside an atomic block (e.g. figcaption of a figure) — let
        // the browser handle Delete inside it.
        if (this.isAtomicBlock(block)) return false;

        // Cursor must have nothing meaningful between it and the end of the
        // block. toString() on a Range ignores <br> and other non-text
        // nodes, so this correctly treats trailing <br>, empty inline
        // wrappers, and empty paragraphs as "at end".
        if (!this.isCursorAtEndOfBlock(range, block)) return false;

        const next = block.nextElementSibling;
        if (!next || !this.isAtomicBlock(next)) return false;

        e.preventDefault();
        if (!isBlockEmpty(block)) {
            // Block has content — don't merge the atomic block backward
            // (which would also destroy it). Just no-op.
            return true;
        }
        this.removeBlockNextToAtomic(block, next, 'start');
        this.instance.sync();
        return true;
    }

    /** Top-level block (direct child of editorEl) that contains `node`. */
    findTopLevelBlock(node) {
        while (node && node.parentNode !== this.el) {
            node = node.parentNode;
        }
        return (node && node !== this.el) ? node : null;
    }

    /**
     * Range-based "is the cursor at the start of `block`?" — robust to
     * inline wrappers, leading <br>, etc. Returns true iff there is no
     * visible text between the start of the block and the cursor.
     */
    isCursorAtStartOfBlock(range, block) {
        if (!range.collapsed) return false;
        const head = document.createRange();
        head.setStart(block, 0);
        head.setEnd(range.startContainer, range.startOffset);
        return head.toString() === '';
    }

    /**
     * Range-based "is the cursor at the end of `block`?" — robust to
     * trailing <br>, inline wrappers, etc. Returns true iff there is no
     * visible text between the cursor and the end of the block.
     */
    isCursorAtEndOfBlock(range, block) {
        if (!range.collapsed) return false;
        const tail = document.createRange();
        tail.setStart(range.endContainer, range.endOffset);
        tail.setEnd(block, block.childNodes.length);
        return tail.toString() === '';
    }

    /**
     * Atomic blocks are top-level elements that should never be destroyed by
     * a browser-default merge with an adjacent empty paragraph: image/video/
     * embed/gallery figures (FIGURE), code blocks (PRE), tables, separators
     * (HR / .redactix-separator), and the legacy .redactix-video-wrapper.
     * Thin instance-method wrapper over the shared helper so existing
     * `this.isAtomicBlock(...)` callsites keep working.
     */
    isAtomicBlock(el) {
        return isAtomicBlock(el);
    }

    /**
     * Remove an empty paragraph that sits next to an atomic block, placing
     * the cursor in a sensible existing landing spot. We deliberately do NOT
     * create new figcaptions — for video/embed without a caption a phantom
     * figcaption looks like an unwanted caption box, and for quote-cards
     * the figcaption is reserved for author info (img + span) and managed
     * by the QuoteCard module.
     *
     * If no good landing spot exists, leave the empty paragraph alone — the
     * caller has already preventDefault'd, so the only effect is that
     * backspace/delete is a visible no-op rather than destroying the figure.
     *
     * @param {HTMLElement} block       The empty P to remove.
     * @param {HTMLElement} atomic      The adjacent atomic block.
     * @param {'start'|'end'} edge      Where to land the cursor relative to
     *                                  any editable target inside the atomic
     *                                  ('start' = top — used for forward
     *                                  Delete; 'end' = bottom — used for
     *                                  Backspace).
     */
    removeBlockNextToAtomic(block, atomic, edge) {
        const targetRange = this.findCursorTargetForAtomic(atomic, edge);
        if (!targetRange) return; // preventDefault was already called

        block.remove();
        this.ensureTrailingParagraph();

        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(targetRange);
    }

    /**
     * Where should the cursor land after removing a paragraph adjacent to
     * `atomic`? Returns a Range positioned in the most natural editable
     * spot, or null when none exists.
     *
     *   • Quote-card  → inside its inner blockquote's first/last <p>.
     *   • Other FIGURE with an EXISTING editable <figcaption> (typically the
     *     image module always creates one, video/embed only when caption
     *     was supplied) → that figcaption.
     *   • Non-figure atomic, or figure without figcaption → "jump over" the
     *     atomic into the nearest non-atomic editable sibling on the side
     *     the user was deleting toward (end of prev for Backspace, start of
     *     next for Delete).
     */
    findCursorTargetForAtomic(atomic, edge) {
        if (atomic.tagName === 'FIGURE') {
            if (atomic.classList.contains('quote-card')) {
                const bq = atomic.querySelector(':scope > blockquote');
                const innerP = bq && (edge === 'end' ? bq.lastElementChild : bq.firstElementChild);
                if (innerP) {
                    const r = document.createRange();
                    r.selectNodeContents(innerP);
                    r.collapse(edge === 'start');
                    return r;
                }
            } else {
                const figcaption = atomic.querySelector(':scope > figcaption');
                if (figcaption && figcaption.isContentEditable) {
                    const r = document.createRange();
                    r.selectNodeContents(figcaption);
                    r.collapse(edge === 'start');
                    return r;
                }
            }
        }

        // Fall back to jumping over the atomic into the nearest non-atomic
        // editable sibling — direction follows the keystroke:
        //   Backspace (edge='end') → end of atomic.previousElementSibling.
        //   Delete    (edge='start') → start of atomic.nextElementSibling.
        const target = edge === 'end'
            ? atomic.previousElementSibling
            : atomic.nextElementSibling;
        if (target && target.isContentEditable !== false && !this.isAtomicBlock(target)) {
            const r = document.createRange();
            r.selectNodeContents(target);
            r.collapse(edge === 'start');
            return r;
        }
        return null;
    }

    handleSpace() {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        // If there is a selection — replace it with a space (previously handleSpace
        // exited silently because e.preventDefault had already run, and the
        // space was just "eaten"). Insertion as a regular text node.
        if (!selection.isCollapsed) {
            const liveRange = selection.getRangeAt(0);
            liveRange.deleteContents();
            const space = document.createTextNode(' ');
            liveRange.insertNode(space);
            const r = document.createRange();
            r.setStartAfter(space);
            r.collapse(true);
            selection.removeAllRanges();
            selection.addRange(r);
            this.instance.sync();
            return;
        }

        const range = selection.getRangeAt(0);
        const inlineTags = ['B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'A', 'CODE', 'SPAN', 'SUB', 'SUP'];

        let node = range.endContainer;
        let offset = range.endOffset;
        let targetTag = null;

        // Check previous character for double spaces
        let prevChar = '';
        if (node.nodeType === Node.TEXT_NODE && offset > 0) {
            prevChar = node.textContent[offset - 1];
        }
        const charToInsert = (prevChar === ' ') ? '\u00A0' : ' ';

        // Formatting exit logic
        const isAtEnd = (n, off) => {
            if (n.nodeType === Node.TEXT_NODE) return off === n.textContent.length;
            return off === n.childNodes.length;
        };

        if (isAtEnd(node, offset)) {
            let current = node;
            while (current && current !== this.el) {
                if (current.nodeType === Node.ELEMENT_NODE && inlineTags.includes(current.tagName)) {
                    targetTag = current;
                }
                if (current.nextSibling) break;
                current = current.parentNode;
            }
        }

        if (targetTag) {
            const space = document.createTextNode(charToInsert);
            if (targetTag.nextSibling) {
                targetTag.parentNode.insertBefore(space, targetTag.nextSibling);
            } else {
                targetTag.parentNode.appendChild(space);
            }

            const newRange = document.createRange();
            newRange.setStartAfter(space);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);

            this.instance.sync();
            return;
        }

        // Standard insertion
        const textNode = range.startContainer;
        if (textNode.nodeType === Node.TEXT_NODE) {
            const text = textNode.data;
            textNode.data = text.slice(0, offset) + charToInsert + text.slice(offset);

            const newRange = document.createRange();
            newRange.setStart(textNode, offset + 1);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);

            this.instance.sync();
        } else {
            const newTextNode = document.createTextNode(charToInsert);
            this.instance.selection.insertNode(newTextNode);
            this.instance.sync();
        }
    }
}
