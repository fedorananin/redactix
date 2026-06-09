import Module from '../core/Module.js';
import Icons from '../ui/Icons.js';

export default class HtmlMode extends Module {
    constructor(instance) {
        super(instance);
        this.isHtmlMode = false;
        this.editorContainer = null;
        this.textarea = null;
        this.lineNumbers = null;

        // Syntax highlighting: transparent textarea sits on top of <pre>
        // with a colored copy of the text (overlay pattern). textarea
        // remains the source of truth — caret, selection, and undo are native.
        this.codeMain = null;       // wrapper for textarea + backdrop
        this.backdrop = null;       // <pre> with highlighting
        this.backdropCode = null;   // <code> inside backdrop
        this.lineHighlight = null;  // line highlight strip on hover on the line number
        this._redrawFrame = null;   // rAF coalescing of redraws

        // Line metrics. Must match CSS (.redactix-code-editor:
        // line-height 21px; padding 16px in textarea, backdrop and lines column)
        // — this keeps the exact match of the line number and the line.
        this.LINE_HEIGHT = 21;
        this.PAD_TOP = 16;
    }

    getButtons() {
        // In lite mode, do not show the HTML editing button
        if (this.instance.config.liteMode) {
            return [];
        }
        
        return [
            {
                name: 'html',
                icon: Icons.code,
                title: this.t('toolbar.editHtml'),
                action: () => this.toggleHtmlMode()
            }
        ];
    }

    toggleHtmlMode() {
        this.isHtmlMode = !this.isHtmlMode;
        const wrapper = this.instance.wrapper;
        const editorEl = this.instance.editorEl;

        if (this.isHtmlMode) {
            // --- ENTERING HTML MODE ---

            // 1. Get HTML and format it
            let rawHtml = editorEl.innerHTML;
            
            // Remove helper elements for clean code
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = rawHtml;
            
            // Remove hr wrappers
            tempDiv.querySelectorAll('.redactix-separator').forEach(wrapper => {
                const hr = wrapper.querySelector('hr');
                if (hr) {
                    wrapper.parentNode.replaceChild(hr, wrapper);
                }
            });
            
            // Remove search highlighting
            tempDiv.querySelectorAll('.redactix-find-highlight').forEach(mark => {
                const text = document.createTextNode(mark.textContent);
                mark.parentNode.replaceChild(text, mark);
            });
            
            // Remove empty figcaption
            tempDiv.querySelectorAll('figcaption').forEach(figcaption => {
                const innerHtml = figcaption.innerHTML.replace(/<br\s*\/?>/gi, '').trim();
                if (!innerHtml && !figcaption.querySelector('img, iframe')) {
                    figcaption.remove();
                }
            });
            
            // Remove style and empty alt attributes from img
            tempDiv.querySelectorAll('img').forEach(img => {
                img.removeAttribute('style');
                if (img.alt === '') img.removeAttribute('alt');
            });
            
            // Remove contenteditable
            tempDiv.querySelectorAll('[contenteditable]').forEach(el => {
                el.removeAttribute('contenteditable');
            });

            // Apply per-module cleanups so HTML mode shows the same output
            // sync() writes to the textarea (no edit-button, no live frame
            // snapshots, no quote-card UI artifacts, etc.).
            const quoteCardModule = this.instance.modules.find(m => m.constructor.name === 'QuoteCard');
            if (quoteCardModule && quoteCardModule.cleanCardsForSync) {
                quoteCardModule.cleanCardsForSync(tempDiv);
            }
            const calloutModule = this.instance.modules.find(m => m.constructor.name === 'Callout');
            if (calloutModule && calloutModule.cleanCalloutsForSync) {
                calloutModule.cleanCalloutsForSync(tempDiv);
            }
            const embedModule = this.instance.modules.find(m => m.constructor.name === 'Embed');
            if (embedModule && embedModule.cleanEmbedsForSync) {
                embedModule.cleanEmbedsForSync(tempDiv);
            }
            const videoModule = this.instance.modules.find(m => m.constructor.name === 'Video');
            if (videoModule && videoModule.cleanVideosForSync) {
                videoModule.cleanVideosForSync(tempDiv);
            }
            const galleryModule = this.instance.modules.find(m => m.constructor.name === 'Gallery');
            if (galleryModule && galleryModule.cleanGalleriesForSync) {
                galleryModule.cleanGalleriesForSync(tempDiv);
            }

            tempDiv.normalize();

            rawHtml = tempDiv.innerHTML;

            const prettyHtml = this.beautifyHtml(rawHtml);

            // 2. Create the code editor container
            this.createCodeEditor(prettyHtml);

            // 3. Hide floating overlays of other modules (block handles,
            // "+" between blocks, table handles, floating toolbar, search).
            // They are absolutely positioned in the wrapper and would otherwise remain
            // hovering on top of the code: mousemove on hidden editorEl no longer
            // triggers, so there is nothing to hide them.
            this.instance.modules.forEach(m => {
                if (m !== this && typeof m.hideUI === 'function') {
                    m.hideUI();
                }
            });

            // 4. Hide visual editor, show code editor
            editorEl.style.display = 'none';
            wrapper.appendChild(this.editorContainer);

            // 5. Disable toolbar buttons
            this.disableToolbar(true);
            
            // 6. Hide character counter
            if (this.instance.counter) {
                this.instance.counter.style.display = 'none';
            }

            // 7. Focus on textarea
            this.textarea.focus();
            this.redraw();

        } else {
            // --- RETURNING TO VISUAL MODE ---

            // 1. Get value from textarea
            let code = this.textarea ? this.textarea.value : '';

            // 2. Update editor
            const minifiedCode = this.minifyHtmlPreservePre(code);
            editorEl.innerHTML = minifiedCode;

            // Restore wrappers and settings
            if (this.instance.normalizeInlineMarkup) {
                this.instance.normalizeInlineMarkup();
            }
            if (this.instance.wrapSeparators) {
                this.instance.wrapSeparators();
            }
            if (this.instance.setupFigures) {
                this.instance.setupFigures();
            }
            if (this.instance.setupCodeBlocks) {
                this.instance.setupCodeBlocks();
            }
            // Re-attach module-managed setup so quote-cards / callouts /
            // embeds / videos / galleries get their contenteditable,
            // edit buttons, etc. back.
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

            // 3. Remove code editor
            if (this._redrawFrame != null) {
                cancelAnimationFrame(this._redrawFrame);
                this._redrawFrame = null;
            }
            if (this.editorContainer && this.editorContainer.parentNode) {
                this.editorContainer.parentNode.removeChild(this.editorContainer);
            }
            this.editorContainer = null;
            this.textarea = null;
            this.lineNumbers = null;
            this.codeMain = null;
            this.backdrop = null;
            this.backdropCode = null;
            this.lineHighlight = null;

            // 4. Show visual editor
            editorEl.style.display = 'block';

            // 5. Enable buttons
            this.disableToolbar(false);
            
            // 6. Show character counter
            if (this.instance.counter) {
                this.instance.counter.style.display = '';
            }
            
            // 7. Sync
            this.instance.sync();
        }
    }

    createCodeEditor(content) {
        // Main container
        this.editorContainer = document.createElement('div');
        this.editorContainer.className = 'redactix-code-editor';

        // Line numbers
        this.lineNumbers = document.createElement('div');
        this.lineNumbers.className = 'redactix-code-lines';

        // Code column: highlighted backdrop behind + transparent textarea on top
        this.codeMain = document.createElement('div');
        this.codeMain.className = 'redactix-code-main';

        this.lineHighlight = document.createElement('div');
        this.lineHighlight.className = 'redactix-code-line-highlight';

        this.backdrop = document.createElement('pre');
        this.backdrop.className = 'redactix-code-backdrop';
        this.backdrop.setAttribute('aria-hidden', 'true');
        this.backdropCode = document.createElement('code');
        this.backdrop.appendChild(this.backdropCode);

        // Textarea for editing
        this.textarea = document.createElement('textarea');
        this.textarea.className = 'redactix-code-textarea';
        this.textarea.value = content;
        this.textarea.spellcheck = false;
        this.textarea.autocomplete = 'off';
        this.textarea.autocorrect = 'off';
        this.textarea.autocapitalize = 'off';
        // Strictly disable soft wrap: one logical line = one
        // visual = one number. Without this, line numbers "drift" on
        // long lines (one line takes up two visual ones).
        this.textarea.setAttribute('wrap', 'off');

        // Event handlers
        this.textarea.addEventListener('input', () => this.scheduleRedraw());
        this.textarea.addEventListener('keydown', (e) => this.handleKeydown(e));
        // Scroll of textarea is mirrored to the highlighted layer via transform —
        // unlike scrollLeft/scrollTop this works regardless of
        // whether the backdrop has its own overflow area
        // (vertically it doesn't: backdrop height is equal to content).
        this.textarea.addEventListener('scroll', () => this.syncBackdropScroll());

        // Hover on line number — highlight the corresponding line of code
        this.lineNumbers.addEventListener('mouseover', (e) => {
            const num = e.target.closest('.redactix-code-line-number');
            if (num) this.showLineHighlight(parseInt(num.dataset.line, 10));
        });
        this.lineNumbers.addEventListener('mouseleave', () => this.hideLineHighlight());

        // Rendering order: highlight strip → highlighted code → textarea
        this.codeMain.appendChild(this.lineHighlight);
        this.codeMain.appendChild(this.backdrop);
        this.codeMain.appendChild(this.textarea);

        this.editorContainer.appendChild(this.lineNumbers);
        this.editorContainer.appendChild(this.codeMain);

        this.redraw();
    }

    /**
     * Full redraw: line numbers + highlighting. Called with rAF
     * coalescing on input, synchronously — from handleKeydown (manual value
     * edits) and during editor creation.
     */
    redraw() {
        this.updateLineNumbers();
        this.updateHighlight();
    }

    scheduleRedraw() {
        if (this._redrawFrame != null) return;
        this._redrawFrame = requestAnimationFrame(() => {
            this._redrawFrame = null;
            if (this.textarea) this.redraw();
        });
    }

    updateLineNumbers() {
        const lines = this.textarea.value.split('\n');
        const lineCount = lines.length;

        let numbersHtml = '';
        for (let i = 1; i <= lineCount; i++) {
            numbersHtml += `<div class="redactix-code-line-number" data-line="${i - 1}">${i}</div>`;
        }

        this.lineNumbers.innerHTML = numbersHtml;

        // Auto-height of textarea (wrap is disabled — height is determined
        // by the number of lines)
        this.textarea.style.height = 'auto';
        this.textarea.style.height = Math.max(300, this.textarea.scrollHeight) + 'px';

        // Horizontal scrollbar compensation: it consumes inner
        // height, allowing textarea to scroll vertically by its width.
        // The browser does this itself when moving the caret — and selection/caret
        // drift relative to the highlight. We add scrollbar thickness to the height
        // so that vertical scroll does not exist at all.
        const deficit = this.textarea.scrollHeight - this.textarea.clientHeight;
        if (deficit > 0) {
            this.textarea.style.height = (this.textarea.offsetHeight + deficit) + 'px';
        }
    }

    /**
     * Shift of the highlighted layer following textarea scroll (horizontal —
     * long lines; vertical is normally impossible, but we mirror it too
     * just in case of transition states).
     */
    syncBackdropScroll() {
        if (!this.backdropCode || !this.textarea) return;
        this.backdropCode.style.transform =
            `translate(${-this.textarea.scrollLeft}px, ${-this.textarea.scrollTop}px)`;
    }

    // ---------- Syntax highlighting (own tokenizer, no dependencies) ----------

    /**
     * Redraw the highlighted copy in backdrop. Trailing \n is needed
     * so that <pre> does not collapse the last empty line (textarea shows
     * it, and heights must match).
     */
    updateHighlight() {
        if (!this.backdropCode) return;
        this.backdropCode.innerHTML = this.highlightHtml(this.textarea.value) + '\n';
        this.syncBackdropScroll();
    }

    escapeToken(s) {
        return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    /**
     * HTML tokenizer: comments, doctype, tags (name / attributes /
     * values), entities in text. Accepts raw code, returns
     * safe HTML with rx-tok-* spans.
     */
    highlightHtml(code) {
        let out = '';
        let lastIndex = 0;
        const re = /<!--[\s\S]*?(?:-->|$)|<!DOCTYPE[^>]*>?|<\/?[a-zA-Z][^>]*(?:>|$)/gi;
        let m;
        while ((m = re.exec(code)) !== null) {
            out += this.highlightText(code.slice(lastIndex, m.index));
            const tok = m[0];
            if (tok.startsWith('<!--')) {
                out += `<span class="rx-tok-comment">${this.escapeToken(tok)}</span>`;
            } else if (/^<!doctype/i.test(tok)) {
                out += `<span class="rx-tok-punct">${this.escapeToken(tok)}</span>`;
            } else {
                out += this.highlightTag(tok);
            }
            lastIndex = m.index + tok.length;
        }
        out += this.highlightText(code.slice(lastIndex));
        return out;
    }

    /** Text between tags: highlight only HTML entities. */
    highlightText(raw) {
        if (!raw) return '';
        const escaped = this.escapeToken(raw);
        // After escaping, original "&nbsp;" looks like "&amp;nbsp;"
        return escaped.replace(/&amp;(#?[a-zA-Z0-9]{1,32});/g,
            '<span class="rx-tok-entity">&amp;$1;</span>');
    }

    /** One tag: <(/)name attribute="value" ... (/)> */
    highlightTag(rawTag) {
        const m = rawTag.match(/^(<\/?)([a-zA-Z][\w:-]*)([\s\S]*?)(\/?>?)$/);
        if (!m) return this.escapeToken(rawTag);
        const [, open, name, attrs, close] = m;

        let out = `<span class="rx-tok-punct">${this.escapeToken(open)}</span>` +
            `<span class="rx-tok-tag">${this.escapeToken(name)}</span>`;

        // Attributes: name(=value)? — everything in between (spaces), as is
        let i = 0;
        const attrRe = /([a-zA-Z_:@][\w:.-]*)(?:(\s*=\s*)("[^"]*"?|'[^']*'?|[^\s"'=<>`]+))?/g;
        let am;
        while ((am = attrRe.exec(attrs)) !== null) {
            out += this.escapeToken(attrs.slice(i, am.index));
            out += `<span class="rx-tok-attr">${this.escapeToken(am[1])}</span>`;
            if (am[2]) out += `<span class="rx-tok-punct">${this.escapeToken(am[2])}</span>`;
            if (am[3]) out += `<span class="rx-tok-value">${this.escapeToken(am[3])}</span>`;
            i = am.index + am[0].length;
        }
        out += this.escapeToken(attrs.slice(i));
        out += `<span class="rx-tok-punct">${this.escapeToken(close)}</span>`;
        return out;
    }

    // ---------- Hover line highlighting ----------

    showLineHighlight(lineIndex) {
        if (!this.lineHighlight || !Number.isFinite(lineIndex)) return;
        this.lineHighlight.style.top = `${this.PAD_TOP + lineIndex * this.LINE_HEIGHT}px`;
        this.lineHighlight.style.height = `${this.LINE_HEIGHT}px`;
        this.lineHighlight.style.display = 'block';
    }

    hideLineHighlight() {
        if (this.lineHighlight) this.lineHighlight.style.display = 'none';
    }

    handleKeydown(e) {
        // Tab - insert indent
        if (e.key === 'Tab') {
            e.preventDefault();
            const start = this.textarea.selectionStart;
            const end = this.textarea.selectionEnd;
            const value = this.textarea.value;
            
            if (e.shiftKey) {
                // Shift+Tab - remove indent
                const beforeCursor = value.substring(0, start);
                const lineStart = beforeCursor.lastIndexOf('\n') + 1;
                const lineIndent = value.substring(lineStart, start);
                
                if (lineIndent.startsWith('  ')) {
                    this.textarea.value = value.substring(0, lineStart) + value.substring(lineStart + 2);
                    this.textarea.selectionStart = this.textarea.selectionEnd = start - 2;
                }
            } else {
                // Tab - add indent
                this.textarea.value = value.substring(0, start) + '  ' + value.substring(end);
                this.textarea.selectionStart = this.textarea.selectionEnd = start + 2;
            }

            this.redraw();
        }
        
        // Enter - preserve indent of the previous line
        if (e.key === 'Enter') {
            e.preventDefault();
            const start = this.textarea.selectionStart;
            const value = this.textarea.value;
            
            // Find beginning of the current line
            const beforeCursor = value.substring(0, start);
            const lineStart = beforeCursor.lastIndexOf('\n') + 1;
            const currentLine = value.substring(lineStart, start);
            
            // Determine indent of the current line
            const indentMatch = currentLine.match(/^(\s*)/);
            const indent = indentMatch ? indentMatch[1] : '';
            
            // Insert newline with the same indent
            this.textarea.value = value.substring(0, start) + '\n' + indent + value.substring(start);
            this.textarea.selectionStart = this.textarea.selectionEnd = start + 1 + indent.length;

            this.redraw();
        }
    }

    disableToolbar(disable) {
        const buttons = this.instance.toolbar.element.querySelectorAll('button');
        buttons.forEach(btn => {
            // Do not disable HTML and Fullscreen buttons
            if (btn.dataset.command === 'html' || btn.dataset.command === 'fullscreen') return;
            
            btn.disabled = disable;
            btn.style.opacity = disable ? '0.5' : '1';
            btn.style.pointerEvents = disable ? 'none' : 'auto';
        });
    }

    // Minify HTML preserving <pre> content
    minifyHtmlPreservePre(html) {
        // Save and minify <pre> tag contents
        const prePlaceholders = [];
        
        // Replace pre along with surrounding whitespace
        let result = html.replace(/\s*<pre([^>]*)>([\s\S]*?)<\/pre>\s*/gi, (match, preAttrs, content) => {
            // Remove formatting inside pre, but preserve code content
            let minifiedPre = '';
            
            // Check if there is code inside
            const codeMatch = content.match(/^[\s\n]*<code([^>]*)>([\s\S]*)<\/code>[\s\n]*$/i);
            if (codeMatch) {
                const codeAttrs = codeMatch[1];
                let codeContent = codeMatch[2];
                
                // Remove common formatting indent
                const lines = codeContent.split('\n');
                
                // Remove first empty line if present
                if (lines.length > 0 && lines[0].trim() === '') {
                    lines.shift();
                }
                // Remove last empty line if present
                if (lines.length > 0 && lines[lines.length - 1].trim() === '') {
                    lines.pop();
                }
                
                // Find minimal indent
                let minIndent = Infinity;
                lines.forEach(line => {
                    if (line.trim().length > 0) {
                        const indent = line.match(/^(\s*)/)[1].length;
                        if (indent < minIndent) {
                            minIndent = indent;
                        }
                    }
                });
                
                if (minIndent === Infinity) minIndent = 0;
                
                // Remove common indent
                codeContent = lines.map(line => {
                    if (line.trim().length === 0) return '';
                    return line.substring(minIndent);
                }).join('\n');
                
                minifiedPre = `<pre${preAttrs}><code${codeAttrs}>${codeContent}</code></pre>`;
            } else {
                minifiedPre = `<pre${preAttrs}>${content.trim()}</pre>`;
            }
            
            prePlaceholders.push(minifiedPre);
            return `__PRE_PLACEHOLDER_${prePlaceholders.length - 1}__`;
        });
        
        // Remove line breaks and spaces between tags
        result = result.replace(/>\s+</g, '><');
        
        // Restore <pre> tags
        prePlaceholders.forEach((pre, index) => {
            result = result.replace(`__PRE_PLACEHOLDER_${index}__`, pre);
        });
        
        return result;
    }

    // Simple Beautifier
    beautifyHtml(html) {
        // Remove contenteditable from all tags
        let cleanedHtml = html.replace(/\s+contenteditable=["'][^"']*["']/gi, '');
        
        // Save <pre> tag contents
        const prePlaceholders = [];
        let processedHtml = cleanedHtml.replace(/<pre[^>]*>[\s\S]*?<\/pre>/gi, (match) => {
            let formatted = match.replace(/<pre([^>]*)>/, '<pre$1>');
            prePlaceholders.push(formatted);
            return `__PRE_PLACEHOLDER_${prePlaceholders.length - 1}__`;
        });
        
        // Replace line breaks and multiple spaces with a single space
        processedHtml = processedHtml.replace(/\s+/g, ' ').trim();
        
        let formatted = '';
        let indent = 0;
        const pad = '  '; 
        
        const placeholderIndents = {};
        
        const blockTags = [
            'address', 'article', 'aside', 'blockquote', 'canvas', 'dd', 'div', 'dl', 'dt', 
            'fieldset', 'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 
            'header', 'hr', 'li', 'main', 'nav', 'noscript', 'ol', 'p', 'pre', 'section', 
            'table', 'tfoot', 'tbody', 'thead', 'tr', 'td', 'th', 'ul', 'video', 'iframe'
        ];
        
        const voidTags = [
            'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'
        ];

        const tokens = processedHtml.split(/(<[^>]+>)/g);
        let isPrevInline = false;

        tokens.forEach(token => {
            if (token.length === 0) return;
            
            const placeholderMatch = token.match(/__PRE_PLACEHOLDER_(\d+)__/);
            if (placeholderMatch) {
                placeholderIndents[placeholderMatch[1]] = indent;
                formatted += '\n' + pad.repeat(indent) + token;
                isPrevInline = false;
                return;
            }

            let isBlock = false;
            let isClosing = false;
            let tagName = '';
            
            if (token.match(/^<\//)) {
                isClosing = true;
                tagName = token.replace(/[<\/>]/g, '').toLowerCase();
                isBlock = blockTags.includes(tagName);
            } else if (token.match(/^<[^\/]/)) {
                tagName = token.replace(/[<>]/g, '').split(' ')[0].toLowerCase();
                isBlock = blockTags.includes(tagName);
            }

            if (isBlock) {
                if (isClosing) {
                    indent--;
                    if (indent < 0) indent = 0;
                    
                    if (!isPrevInline) {
                        formatted += '\n' + pad.repeat(indent);
                    }
                    formatted += token.trim();
                    isPrevInline = false;
                } else {
                    if (formatted.length > 0) {
                         formatted += '\n' + pad.repeat(indent);
                    }
                    formatted += token.trim();
                    
                    if (!voidTags.includes(tagName)) {
                        indent++;
                    }
                    isPrevInline = false;
                }
            } else {
                if (token.trim().length === 0) {
                    if (isPrevInline) {
                        formatted += token;
                    }
                } else {
                    formatted += token;
                    isPrevInline = true;
                }
            }
        });

        // Restore formatted <pre> tags
        prePlaceholders.forEach((pre, index) => {
            const indentLevel = placeholderIndents[index] || 0;
            const preIndent = pad.repeat(indentLevel);
            const codeIndent = pad.repeat(indentLevel + 1);
            const contentIndent = pad.repeat(indentLevel + 2);
            
            let formattedPre = pre;
            
            const codeMatch = formattedPre.match(/<pre([^>]*)><code([^>]*)>([\s\S]*)<\/code><\/pre>/);
            if (codeMatch) {
                const preAttrs = codeMatch[1];
                const codeAttrs = codeMatch[2];
                let content = codeMatch[3];
                
                const lines = content.split('\n');
                const indentedContent = lines.map(line => contentIndent + line).join('\n');
                
                formattedPre = `<pre${preAttrs}>\n${codeIndent}<code${codeAttrs}>\n${indentedContent}\n${codeIndent}</code>\n${preIndent}</pre>`;
            }
            
            formatted = formatted.replace(`__PRE_PLACEHOLDER_${index}__`, formattedPre);
        });

        return formatted.trim();
    }
}
