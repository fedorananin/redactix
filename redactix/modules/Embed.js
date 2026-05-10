import Module from '../core/Module.js';
import Icons from '../ui/Icons.js';

/**
 * Embed module.
 *
 * Single source of truth for any third-party embed (YouTube, Spotify,
 * Twitter, etc.). All embeds share one DOM shape:
 *
 *   <figure class="redactix-embed"
 *           data-provider="..."
 *           data-aspect="16:9|4:3|1:1|auto"
 *           data-height="...">
 *     <div class="redactix-embed-frame">
 *       <iframe src="..." allow="..." allowfullscreen></iframe>
 *     </div>
 *     <figcaption>...optional caption...</figcaption>
 *   </figure>
 *
 * No external scripts are loaded — every provider must support a plain
 * iframe URL. Anything that doesn't fit (LinkedIn / FB / niche) goes
 * through the "custom" provider, which accepts raw iframe HTML pasted
 * by the user from the source site's "Get embed code" dialog.
 *
 * Disabled in lite mode entirely (slash menu hides all aliases, click
 * on existing embed cannot reach edit modal).
 */
export default class Embed extends Module {
    constructor(instance) {
        super(instance);
        this.liteMode = instance.config.liteMode || false;
        this.providers = this.buildProviderRegistry();
    }

    init() {
        if (this.liteMode) return;

        // Click on the floating "Edit" button (rendered on hover, sits on
        // top of the iframe). Iframes swallow mouse events from the host
        // page, so this is the most reliable path to the edit modal.
        this.instance.editorEl.addEventListener('click', (e) => {
            const btn = e.target.closest && e.target.closest('.redactix-embed-edit-btn');
            if (!btn) return;
            e.preventDefault();
            e.stopPropagation();
            const figure = btn.closest('figure.redactix-embed');
            if (figure) this.openModal(figure);
        });

        // Auto-resize: most social embeds (Instagram, Twitter, TikTok,
        // Reddit) post their natural height to window via postMessage.
        // We listen, match the source to one of our iframes, and resize
        // the wrapping frame so the embed fits its content automatically.
        window.addEventListener('message', (e) => this.onProviderMessage(e));
    }

    onProviderMessage(e) {
        const editor = this.instance.editorEl;
        if (!editor || !editor.isConnected) return;

        const iframes = editor.querySelectorAll(
            'figure.redactix-embed > .redactix-embed-frame > iframe'
        );
        for (const iframe of iframes) {
            if (iframe.contentWindow !== e.source) continue;
            const figure = iframe.closest('figure.redactix-embed');
            if (!figure) return;
            const provider = figure.getAttribute('data-provider') || '';
            const height = this.parseResizeMessage(provider, e.data);
            if (height && height > 50) {
                const frame = iframe.parentElement;
                const px = `${height}px`;
                // Live snapshot only — sync() will reset to the provider's
                // initial height before writing to textarea, so it doesn't
                // leak into saved HTML.
                if (frame.style.height !== px) frame.style.height = px;
            }
            return;
        }
    }

    /**
     * Provider-specific decoder for the postMessage payload that asks
     * the host to resize the embed. Returns the height in px or null.
     */
    parseResizeMessage(provider, raw) {
        let data = raw;
        if (typeof raw === 'string') {
            try { data = JSON.parse(raw); } catch { return null; }
        }
        if (!data || typeof data !== 'object') return null;

        switch (provider) {
            case 'instagram':
                // {"type":"MEASURE","details":{"height":N,"width":N}}
                if (data.type === 'MEASURE' && data.details && data.details.height) {
                    return data.details.height;
                }
                return null;
            case 'twitter': {
                // {"method":"twttr.private.resize","params":[{"height":N,"width":N,...}]}
                if (data.method === 'twttr.private.resize' &&
                    Array.isArray(data.params) && data.params[0] && data.params[0].height) {
                    return data.params[0].height;
                }
                return null;
            }
            case 'tiktok':
                // {"src":"...","type":"...","frameHeight":N}
                if (data.frameHeight) return data.frameHeight;
                if (data.height && /tiktok/i.test(data.type || data.src || '')) return data.height;
                return null;
            case 'reddit':
                // {"type":"embed-resize","height":N,"id":"..."}
                if (data.type === 'embed-resize' && data.height) return data.height;
                return null;
            case 'bluesky':
                // {"id":"...","height":N}
                if (data.height && data.id) return data.height;
                return null;
            default:
                return null;
        }
    }

    // ---------- public API ----------

    findProviderByName(name) {
        return this.providers.find(p => p.name === name) || null;
    }

    findProviderByUrl(url) {
        if (!url) return null;
        for (const p of this.providers) {
            if (!p.matchUrl) continue;
            const m = url.match(p.matchUrl);
            if (m) return { provider: p, match: m };
        }
        return null;
    }

    /**
     * Open the embed modal. If `existingFigure` is given — edit mode,
     * otherwise insert a new embed. Provider is detected from the URL
     * the user types in.
     */
    openModal(existingFigure = null) {
        if (this.liteMode) return;
        this.instance.selection.save();

        const initial = existingFigure
            ? this.readFigure(existingFigure)
            : { url: '', html: '', caption: '', mode: 'url' };

        const form = this.buildModalForm(initial);

        const isEditing = !!existingFigure;
        const extraButtons = [];
        if (isEditing) {
            extraButtons.push({
                text: this.t('embed.removeEmbed'),
                danger: true,
                onClick: () => {
                    existingFigure.remove();
                    this.instance.sync();
                    this.instance.modal.close();
                }
            });
        }

        this.instance.modal.open({
            title: isEditing ? this.t('embed.editTitle') : this.t('embed.title'),
            body: form.element,
            extraButtons,
            onSave: () => {
                const data = form.read();
                this.applyEmbed(existingFigure, data);
            }
        });
    }

    /**
     * Apply form data: build / refresh the figure and insert it (or
     * update existing).
     */
    applyEmbed(existingFigure, data) {
        const built = this.buildEmbedSpec(data);
        if (!built) {
            // Invalid input — keep editor untouched
            return;
        }

        if (existingFigure) {
            this.populateFigure(existingFigure, built, data.caption);
            // Re-wire contenteditable in case figcaption was just (re)created.
            this.setupEmbeds(this.instance.editorEl);
            this.instance.sync();
            return;
        }

        const figure = document.createElement('figure');
        this.populateFigure(figure, built, data.caption);

        this.instance.selection.restore();
        this.instance.selection.insertNode(figure);
        if (this.instance.core) this.instance.core.ensureTrailingParagraph();
        this.setupEmbeds(this.instance.editorEl);
        this.instance.sync();
    }

    /**
     * Build the iframe spec + provider metadata from form data.
     * Returns null if neither URL nor HTML produces a valid iframe.
     *
     * Height is always picked from the provider's defaultHeight — there's
     * no per-embed user override anymore. The on-site runtime auto-resizes
     * embeds to fit current content, and aspect-based providers (16:9 etc.)
     * scale via padding-top trick from the wrapping width.
     */
    buildEmbedSpec(data) {
        if (data.mode === 'custom') {
            const iframe = this.parseAndSanitizeCustomHtml(data.html);
            if (!iframe) return null;
            // For custom embeds, honor the height attribute from the pasted
            // iframe code if it exists; otherwise fall back to a sensible default.
            const customH = parseInt(iframe.getAttribute('height'), 10);
            return {
                providerName: 'custom',
                aspect: 'auto',
                initialHeight: Number.isFinite(customH) && customH > 0 ? customH : 500,
                iframeAttrs: this.iframeToAttrs(iframe)
            };
        }

        const url = (data.url || '').trim();
        if (!url) return null;

        const detected = this.findProviderByUrl(url);
        if (!detected) return null;

        const { provider, match } = detected;
        const attrs = provider.buildIframe(match, url);
        // defaultHeight may be a number or a function (function gets the
        // regex match so e.g. Spotify can return 152 for tracks and 352
        // for albums/playlists).
        const dh = typeof provider.defaultHeight === 'function'
            ? provider.defaultHeight(match)
            : provider.defaultHeight;
        return {
            providerName: provider.name,
            aspect: provider.aspect || 'auto',
            initialHeight: provider.aspect === 'auto' ? (dh || 0) : 0,
            iframeAttrs: attrs,
            sourceUrl: url
        };
    }

    populateFigure(figure, built, caption) {
        figure.className = 'redactix-embed';
        figure.setAttribute('data-provider', built.providerName);
        figure.setAttribute('data-aspect', built.aspect);
        figure.removeAttribute('data-height'); // legacy attribute, no longer used
        // Remember the user's original URL so edit-modal can show it back
        // even when the iframe.src is a provider-specific embed URL that
        // our matchUrl regex doesn't recognise.
        if (built.sourceUrl) {
            figure.setAttribute('data-source-url', built.sourceUrl);
        } else {
            figure.removeAttribute('data-source-url');
        }
        figure.setAttribute('contenteditable', 'false');

        // Frame + iframe
        let frame = figure.querySelector(':scope > .redactix-embed-frame');
        if (!frame) {
            frame = document.createElement('div');
            frame.className = 'redactix-embed-frame';
            figure.insertBefore(frame, figure.firstChild);
        }
        frame.innerHTML = '';
        const iframe = document.createElement('iframe');
        for (const [k, v] of Object.entries(built.iframeAttrs)) {
            if (v === true) iframe.setAttribute(k, '');
            else if (v != null && v !== false) iframe.setAttribute(k, String(v));
        }
        // Critical layout written inline so the embed renders correctly
        // standalone — without depending on Redactix.css being loaded.
        this.applyFrameLayout(frame, built);
        this.applyIframeLayout(iframe, built);
        frame.appendChild(iframe);

        // Floating "Edit" button — sits on top of the iframe in the
        // top-right corner, visible on hover. This is the only reliable
        // path to the edit modal because iframes swallow mouse events.
        // Marked with data-redactix-ui so sync() strips it from output.
        let editBtn = frame.querySelector(':scope > .redactix-embed-edit-btn');
        if (!editBtn) {
            editBtn = document.createElement('button');
            editBtn.type = 'button';
            editBtn.className = 'redactix-embed-edit-btn';
            editBtn.setAttribute('data-redactix-ui', '');
            editBtn.contentEditable = 'false';
            editBtn.textContent = this.t('embed.edit');
            frame.appendChild(editBtn);
        } else {
            editBtn.textContent = this.t('embed.edit');
        }

        // Figcaption — innerHTML round-trip so inline links / formatting
        // added through the floating toolbar survive a re-edit.
        let figcaption = figure.querySelector(':scope > figcaption');
        if (caption && caption.trim()) {
            if (!figcaption) {
                figcaption = document.createElement('figcaption');
                figure.appendChild(figcaption);
            }
            figcaption.innerHTML = caption;
        } else if (figcaption) {
            figcaption.remove();
        }
    }

    /**
     * Inline layout for .redactix-embed-frame + its iframe so the embed
     * works without Redactix.css.
     *
     * Two modes:
     *   • aspect-based (16:9 / 4:3 / 1:1) → padding-top % trick +
     *     absolutely-positioned iframe inside.
     *   • fixed-height (aspect="auto")    → just width + height; iframe
     *     fills it as a block element. No relative/absolute, no
     *     overflow:hidden — minimum styles necessary.
     */
    applyFrameLayout(frame, built) {
        // Reset any leftover styles from the other mode
        frame.style.position = '';
        frame.style.overflow = '';
        frame.style.paddingTop = '';

        const aspectMap = { '16:9': '56.25%', '4:3': '75%', '1:1': '100%' };
        if (aspectMap[built.aspect]) {
            frame.style.position = 'relative';
            frame.style.width = '100%';
            frame.style.overflow = 'hidden';
            frame.style.paddingTop = aspectMap[built.aspect];
            frame.style.height = '0';
        } else if (built.initialHeight && built.initialHeight > 0) {
            frame.style.width = '100%';
            frame.style.height = `${built.initialHeight}px`;
        } else {
            frame.style.width = '';
            frame.style.height = '';
        }
    }

    applyIframeLayout(iframe, built) {
        const isAspect = built && (built.aspect === '16:9' ||
            built.aspect === '4:3' || built.aspect === '1:1');
        iframe.style.border = '0';
        if (isAspect) {
            // Absolute fill of the padding-top box
            iframe.style.position = 'absolute';
            iframe.style.top = '0';
            iframe.style.left = '0';
            iframe.style.width = '100%';
            iframe.style.height = '100%';
        } else {
            // Block element fills the frame's fixed height naturally
            iframe.style.position = '';
            iframe.style.top = '';
            iframe.style.left = '';
            iframe.style.display = 'block';
            iframe.style.width = '100%';
            iframe.style.height = '100%';
        }
    }

    /**
     * Read the data needed to populate the modal back from a figure.
     */
    readFigure(figure) {
        const providerName = figure.getAttribute('data-provider') || '';
        const sourceUrl = figure.getAttribute('data-source-url') || '';
        const figcaption = figure.querySelector(':scope > figcaption');
        const caption = figcaption
            ? (figcaption.innerHTML || '').replace(/<br\s*\/?>/gi, '').trim()
            : '';
        const iframe = figure.querySelector(':scope > .redactix-embed-frame > iframe');
        const src = iframe ? (iframe.getAttribute('src') || '') : '';

        if (providerName === 'custom') {
            return {
                providerName,
                mode: 'custom',
                url: '',
                html: iframe ? iframe.outerHTML : '',
                caption
            };
        }
        // Prefer the original user-supplied URL so re-saving works even
        // when the iframe.src is an embed-only URL the regex won't match.
        return {
            providerName,
            mode: 'url',
            url: sourceUrl || src,
            html: '',
            caption
        };
    }

    // ---------- modal form ----------

    buildModalForm(initial) {
        const wrap = document.createElement('div');

        // Mode toggle: URL vs Custom HTML
        const tabs = document.createElement('div');
        tabs.className = 'redactix-embed-tabs';
        const tabUrl = this.makeTabButton(this.t('embed.tabUrl'), initial.mode !== 'custom');
        const tabCustom = this.makeTabButton(this.t('embed.tabCustom'), initial.mode === 'custom');
        tabs.append(tabUrl, tabCustom);
        wrap.appendChild(tabs);

        // URL panel
        const urlPanel = document.createElement('div');
        const urlGroup = this.makeInputGroup(this.t('embed.urlLabel'), 'text', initial.url);
        urlGroup.querySelector('input').placeholder = 'https://...';
        urlPanel.appendChild(urlGroup);
        const urlHint = document.createElement('div');
        urlHint.className = 'redactix-embed-hint';
        urlHint.textContent = this.t('embed.urlHint');
        urlPanel.appendChild(urlHint);

        // Custom panel
        const customPanel = document.createElement('div');
        const customLabel = document.createElement('label');
        customLabel.textContent = this.t('embed.customLabel');
        const customArea = document.createElement('textarea');
        customArea.value = initial.html || '';
        customArea.rows = 6;
        customArea.placeholder = '<iframe src="https://..."></iframe>';
        customArea.style.width = '100%';
        customArea.style.fontFamily = 'monospace';
        customArea.style.fontSize = '13px';
        customArea.style.padding = '8px';
        customArea.style.border = '1px solid var(--redactix-border)';
        customArea.style.borderRadius = '6px';
        customArea.style.boxSizing = 'border-box';
        customPanel.appendChild(customLabel);
        customPanel.appendChild(customArea);
        const customHint = document.createElement('div');
        customHint.className = 'redactix-embed-hint';
        customHint.textContent = this.t('embed.customHint');
        customPanel.appendChild(customHint);

        // Caption (shared). Height is no longer user-editable — embeds
        // either follow their aspect-ratio (16:9 / 4:3 / 1:1) or auto-resize
        // via postMessage from the provider, so a manual override would
        // just get overwritten.
        const captionGroup = this.makeInputGroup(this.t('embed.captionLabel'), 'text', initial.caption);
        const captionInput = captionGroup.querySelector('input');
        captionInput.placeholder = this.t('embed.captionPlaceholder');

        wrap.appendChild(urlPanel);
        wrap.appendChild(customPanel);
        wrap.appendChild(captionGroup);

        let mode = initial.mode || 'url';
        const applyMode = () => {
            tabUrl.classList.toggle('is-active', mode === 'url');
            tabCustom.classList.toggle('is-active', mode === 'custom');
            urlPanel.style.display = mode === 'url' ? '' : 'none';
            customPanel.style.display = mode === 'custom' ? '' : 'none';
        };
        tabUrl.addEventListener('click', (e) => {
            e.preventDefault();
            mode = 'url';
            applyMode();
        });
        tabCustom.addEventListener('click', (e) => {
            e.preventDefault();
            mode = 'custom';
            applyMode();
        });
        applyMode();

        return {
            element: wrap,
            read: () => ({
                mode,
                url: urlPanel.querySelector('input').value.trim(),
                html: customArea.value,
                caption: captionInput.value.trim()
            })
        };
    }

    makeTabButton(label, active) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'redactix-embed-tab' + (active ? ' is-active' : '');
        b.textContent = label;
        return b;
    }

    makeInputGroup(labelText, type, value) {
        const div = document.createElement('div');
        const label = document.createElement('label');
        label.textContent = labelText;
        const input = document.createElement('input');
        input.type = type;
        input.value = value || '';
        div.append(label, input);
        return div;
    }

    // ---------- custom-html sanitizer ----------

    /**
     * Accept arbitrary embed HTML, return a single sanitized <iframe>
     * element or null. Strips everything but a single <iframe> with a
     * known-safe attribute whitelist; src must be https://.
     */
    parseAndSanitizeCustomHtml(html) {
        if (!html || !html.trim()) return null;
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        const iframe = tmp.querySelector('iframe');
        if (!iframe) return null;

        const src = iframe.getAttribute('src') || '';
        if (!/^https:\/\//i.test(src)) return null;

        return this.sanitizeIframe(iframe);
    }

    /**
     * Strip an iframe to a known-safe set of attributes. Returns the
     * sanitized iframe (mutates in place).
     */
    sanitizeIframe(iframe) {
        const allowed = ['src', 'width', 'height', 'allow', 'allowfullscreen',
            'frameborder', 'scrolling', 'title', 'loading',
            'referrerpolicy', 'sandbox'];
        Array.from(iframe.attributes).forEach(attr => {
            if (!allowed.includes(attr.name.toLowerCase())) {
                iframe.removeAttribute(attr.name);
            }
        });
        const src = iframe.getAttribute('src') || '';
        if (src.toLowerCase().startsWith('javascript:')) {
            iframe.removeAttribute('src');
        }
        return iframe;
    }

    iframeToAttrs(iframe) {
        const attrs = {};
        Array.from(iframe.attributes).forEach(attr => {
            attrs[attr.name] = attr.value === '' ? true : attr.value;
        });
        // Default useful attrs
        if (!attrs.allowfullscreen) attrs.allowfullscreen = true;
        return attrs;
    }

    // ---------- DOM lifecycle ----------

    /**
     * Set contenteditable=false on every embed figure (so the iframe is
     * inert in the editor). figcaption is wired through setupFigures()
     * elsewhere.
     */
    setupEmbeds(rootEl) {
        const root = rootEl || this.instance.editorEl;
        root.querySelectorAll('figure.redactix-embed').forEach(figure => {
            // Drop broken embeds: figures that lost their iframe (e.g. via
            // a stray Backspace, undo glitch, or paste). They can't
            // recover — they'd just be empty boxes with an Edit button
            // pointing at nothing.
            const frame = figure.querySelector(':scope > .redactix-embed-frame');
            const iframe = frame && frame.querySelector(':scope > iframe');
            if (!iframe) {
                figure.remove();
                return;
            }

            figure.setAttribute('contenteditable', 'false');
            const figcaption = figure.querySelector(':scope > figcaption');
            if (figcaption) figcaption.setAttribute('contenteditable', 'true');

            // Re-apply inline layout for legacy embeds (saved before the
            // self-contained inline-styles change, or migrated from the
            // old .redactix-video-wrapper). Idempotent.
            const aspect = figure.getAttribute('data-aspect') || 'auto';
            const providerName = figure.getAttribute('data-provider') || '';
            const provider = this.findProviderByName(providerName);
            let initialHeight = 0;
            if (aspect === 'auto' && provider) {
                initialHeight = typeof provider.defaultHeight === 'function'
                    ? provider.defaultHeight()
                    : provider.defaultHeight;
            }
            // Don't overwrite a live-resized height in the editor — only
            // set when frame has no inline layout yet (i.e. fresh load).
            if (!frame.style.height && !frame.style.position) {
                this.applyFrameLayout(frame, { aspect, initialHeight });
            }
            this.applyIframeLayout(iframe, { aspect });

            // Make sure the floating Edit button exists (legacy embeds
            // migrated from .redactix-video-wrapper don't have one).
            if (!frame.querySelector(':scope > .redactix-embed-edit-btn')) {
                const editBtn = document.createElement('button');
                editBtn.type = 'button';
                editBtn.className = 'redactix-embed-edit-btn';
                editBtn.setAttribute('data-redactix-ui', '');
                editBtn.contentEditable = 'false';
                editBtn.textContent = this.t('embed.edit');
                frame.appendChild(editBtn);
            }
        });
    }

    /**
     * Migrate legacy youtube wrappers (<div class="redactix-video-wrapper">
     * <iframe>...</iframe></div>) into the unified figure.redactix-embed
     * shape. Idempotent.
     */
    migrate(rootEl) {
        const root = rootEl || this.instance.editorEl;
        root.querySelectorAll('.redactix-video-wrapper').forEach(wrapper => {
            const iframe = wrapper.querySelector('iframe');
            if (!iframe) {
                wrapper.remove();
                return;
            }
            const figure = document.createElement('figure');
            figure.className = 'redactix-embed';
            figure.setAttribute('data-provider', this.guessProviderFromSrc(iframe.getAttribute('src') || ''));
            figure.setAttribute('data-aspect', '16:9');

            const frame = document.createElement('div');
            frame.className = 'redactix-embed-frame';
            this.sanitizeIframe(iframe);
            frame.appendChild(iframe);
            figure.appendChild(frame);

            wrapper.parentNode.replaceChild(figure, wrapper);
        });
    }

    guessProviderFromSrc(src) {
        for (const p of this.providers) {
            if (p.srcMarker && src.includes(p.srcMarker)) return p.name;
        }
        return 'custom';
    }

    /**
     * Sync-side cleanup. Operates on a clone of editorEl, NOT live DOM.
     */
    cleanEmbedsForSync(clone) {
        // Drop UI-only nodes (Edit button). Belt + suspenders: by attribute
        // and by class, in case one of them gets stripped by the sanitizer
        // somewhere along the way.
        clone.querySelectorAll('[data-redactix-ui], .redactix-embed-edit-btn').forEach(el => el.remove());

        clone.querySelectorAll('figure.redactix-embed').forEach(figure => {
            // Rebuild the frame's inline layout from scratch so the saved
            // HTML is self-contained (no Redactix.css required) and live
            // editor snapshots from postMessage don't leak into output.
            const frame = figure.querySelector(':scope > .redactix-embed-frame');
            if (frame) {
                const aspect = figure.getAttribute('data-aspect') || 'auto';
                const providerName = figure.getAttribute('data-provider') || '';
                const provider = this.findProviderByName(providerName);
                let initialHeight = 0;
                if (aspect === 'auto' && provider) {
                    initialHeight = typeof provider.defaultHeight === 'function'
                        ? provider.defaultHeight() // no match available here
                        : provider.defaultHeight;
                }
                this.applyFrameLayout(frame, { aspect, initialHeight });

                const iframe = frame.querySelector(':scope > iframe');
                if (iframe) this.applyIframeLayout(iframe, { aspect });
            }

            // Strip the legacy data-height attribute if it's still around.
            figure.removeAttribute('data-height');

            const figcaption = figure.querySelector(':scope > figcaption');
            if (figcaption) {
                const text = (figcaption.textContent || '').trim();
                if (!text) figcaption.remove();
            }
        });
    }

    getButtons() {
        // No embeds in lite mode — same gate as the slash command.
        if (this.liteMode) return [];
        return [
            {
                name: 'embed',
                label: 'Embed',
                icon: Icons.youtube,
                title: this.t('toolbar.insertEmbed'),
                action: () => this.openModal()
            }
        ];
    }

    // ---------- provider registry ----------

    buildProviderRegistry() {
        // Each provider:
        //   name            — internal id (matches data-provider attribute)
        //   label           — display name
        //   aspect          — '16:9' | '4:3' | '1:1' | 'auto'
        //   defaultHeight   — px height (number or fn(match)) for aspect="auto"
        //   matchUrl        — RegExp; first match-group is usually the id
        //   buildIframe(m,url) → { src, allow?, sandbox?, ... }
        //   srcMarker       — substring used by guessProviderFromSrc()
        return [
            {
                name: 'youtube', label: 'YouTube', aspect: '16:9',
                srcMarker: 'youtube.com/embed',
                matchUrl: /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/|music\.youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
                buildIframe: (m) => ({
                    src: `https://www.youtube.com/embed/${m[1]}`,
                    allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
                    allowfullscreen: true
                })
            },
            {
                name: 'vimeo', label: 'Vimeo', aspect: '16:9',
                srcMarker: 'player.vimeo.com',
                matchUrl: /(?:player\.)?vimeo\.com\/(?:video\/)?(\d+)/,
                buildIframe: (m) => ({
                    src: `https://player.vimeo.com/video/${m[1]}`,
                    allow: 'autoplay; fullscreen; picture-in-picture',
                    allowfullscreen: true
                })
            },
            {
                name: 'spotify', label: 'Spotify', aspect: 'auto',
                // Track / single episode → compact 152; album / playlist /
                // show → tall visual player.
                defaultHeight: (m) => (m && (m[1] === 'track' || m[1] === 'episode') ? 152 : 352),
                srcMarker: 'open.spotify.com/embed',
                matchUrl: /open\.spotify\.com\/(?:embed\/)?(?:intl-[a-z]+\/)?(track|album|playlist|episode|show)\/([a-zA-Z0-9]+)/,
                buildIframe: (m) => ({
                    src: `https://open.spotify.com/embed/${m[1]}/${m[2]}`,
                    allow: 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture',
                    loading: 'lazy'
                })
            },
            {
                name: 'apple-music', label: 'Apple Music', aspect: 'auto', defaultHeight: 175,
                srcMarker: 'embed.music.apple.com',
                matchUrl: /(?:embed\.)?music\.apple\.com\/([a-z]{2})\/(album|playlist|song)\/[^/]+\/([0-9]+)(?:\?i=([0-9]+))?/,
                buildIframe: (m) => {
                    const country = m[1];
                    const type = m[2];
                    const id = m[3];
                    const i = m[4];
                    const path = i ? `${country}/${type}/${id}?i=${i}` : `${country}/${type}/${id}`;
                    return {
                        src: `https://embed.music.apple.com/${path}`,
                        allow: 'autoplay *; encrypted-media *; clipboard-write',
                        sandbox: 'allow-forms allow-popups allow-same-origin allow-scripts allow-storage-access-by-user-activation allow-top-navigation-by-user-activation'
                    };
                }
            },
            {
                name: 'soundcloud', label: 'SoundCloud', aspect: 'auto', defaultHeight: 166,
                srcMarker: 'w.soundcloud.com/player',
                matchUrl: /(soundcloud\.com\/[^?\s]+)/,
                buildIframe: (m) => ({
                    src: `https://w.soundcloud.com/player/?url=${encodeURIComponent('https://' + m[1])}`,
                    allow: 'autoplay'
                })
            },
            {
                name: 'bandcamp', label: 'Bandcamp', aspect: 'auto', defaultHeight: 120,
                srcMarker: 'bandcamp.com/EmbeddedPlayer',
                // Bandcamp doesn't expose ids in the URL — user should paste embed code
                matchUrl: null,
                buildIframe: () => null
            },
            {
                name: 'twitch', label: 'Twitch', aspect: '16:9',
                srcMarker: 'player.twitch.tv',
                matchUrl: /twitch\.tv\/(?:videos\/(\d+)|([^/?\s]+)\/clip\/([^/?\s]+)|([^/?\s]+))/,
                buildIframe: (m) => {
                    const parent = (typeof location !== 'undefined' ? location.hostname : '') || 'localhost';
                    if (m[1]) return { src: `https://player.twitch.tv/?video=${m[1]}&parent=${parent}`, allowfullscreen: true };
                    if (m[3]) return { src: `https://clips.twitch.tv/embed?clip=${m[3]}&parent=${parent}`, allowfullscreen: true };
                    if (m[4]) return { src: `https://player.twitch.tv/?channel=${m[4]}&parent=${parent}`, allowfullscreen: true };
                    return null;
                }
            },
            {
                name: 'codepen', label: 'CodePen', aspect: 'auto', defaultHeight: 400,
                srcMarker: 'codepen.io',
                matchUrl: /codepen\.io\/([^/]+)\/(?:pen|details|full|embed)\/([a-zA-Z]+)/,
                buildIframe: (m) => ({
                    src: `https://codepen.io/${m[1]}/embed/${m[2]}?default-tab=result`,
                    allowfullscreen: true,
                    loading: 'lazy'
                })
            },
            {
                name: 'loom', label: 'Loom', aspect: '16:9',
                srcMarker: 'loom.com/embed',
                matchUrl: /loom\.com\/(?:share|embed)\/([a-f0-9]+)/,
                buildIframe: (m) => ({
                    src: `https://www.loom.com/embed/${m[1]}`,
                    allow: 'autoplay; fullscreen',
                    allowfullscreen: true
                })
            },
            {
                name: 'mixcloud', label: 'Mixcloud', aspect: 'auto', defaultHeight: 120,
                srcMarker: 'mixcloud.com/widget',
                matchUrl: /mixcloud\.com\/([^/]+\/[^/?\s]+)\/?/,
                buildIframe: (m) => ({
                    src: `https://www.mixcloud.com/widget/iframe/?feed=${encodeURIComponent('/' + m[1] + '/')}`
                })
            },
            {
                name: 'dailymotion', label: 'Dailymotion', aspect: '16:9',
                srcMarker: 'dailymotion.com/embed',
                matchUrl: /dailymotion\.com\/(?:video\/|embed\/video\/)([a-zA-Z0-9]+)/,
                buildIframe: (m) => ({
                    src: `https://www.dailymotion.com/embed/video/${m[1]}`,
                    allow: 'autoplay; fullscreen; picture-in-picture',
                    allowfullscreen: true
                })
            },
            {
                name: 'google-maps', label: 'Google Maps', aspect: '4:3',
                srcMarker: 'google.com/maps/embed',
                // Accept the share-URL "Embed a map" iframe-src directly
                matchUrl: /(google\.[a-z.]+\/maps\/embed[^"\s]+)/,
                buildIframe: (m) => ({
                    src: `https://${m[1]}`,
                    loading: 'lazy',
                    referrerpolicy: 'no-referrer-when-downgrade'
                })
            },
            {
                name: 'twitter', label: 'X (Twitter)', aspect: 'auto', defaultHeight: 600,
                srcMarker: 'platform.twitter.com/embed',
                matchUrl: /(?:twitter\.com|x\.com)\/[^/]+\/status\/(\d+)/,
                buildIframe: (m) => ({
                    src: `https://platform.twitter.com/embed/Tweet.html?id=${m[1]}`,
                    sandbox: 'allow-popups allow-popups-to-escape-sandbox allow-scripts allow-same-origin'
                })
            },
            {
                name: 'instagram', label: 'Instagram', aspect: 'auto', defaultHeight: 700,
                srcMarker: 'instagram.com/p/',
                matchUrl: /instagram\.com\/(?:p|reel|tv)\/([a-zA-Z0-9_-]+)/,
                buildIframe: (m) => ({
                    src: `https://www.instagram.com/p/${m[1]}/embed/`,
                    sandbox: 'allow-popups allow-popups-to-escape-sandbox allow-scripts allow-same-origin',
                    loading: 'lazy'
                })
            },
            {
                name: 'tiktok', label: 'TikTok', aspect: 'auto', defaultHeight: 750,
                srcMarker: 'tiktok.com/embed',
                matchUrl: /tiktok\.com\/@[^/]+\/video\/(\d+)/,
                buildIframe: (m) => ({
                    src: `https://www.tiktok.com/embed/v2/${m[1]}`,
                    allow: 'encrypted-media; clipboard-write'
                })
            },
            {
                name: 'reddit', label: 'Reddit', aspect: 'auto', defaultHeight: 500,
                srcMarker: 'redditmedia.com',
                matchUrl: /reddit\.com\/r\/([^/]+)\/comments\/([a-z0-9]+)/i,
                buildIframe: (m) => ({
                    src: `https://www.redditmedia.com/r/${m[1]}/comments/${m[2]}/?embed=true`,
                    sandbox: 'allow-scripts allow-same-origin allow-popups'
                })
            },
            {
                name: 'bluesky', label: 'Bluesky', aspect: 'auto', defaultHeight: 500,
                srcMarker: 'embed.bsky.app',
                // bsky.app/profile/HANDLE/post/POSTID
                matchUrl: /bsky\.app\/profile\/([^/]+)\/post\/([a-z0-9]+)/i,
                buildIframe: (m) => ({
                    src: `https://embed.bsky.app/embed/${m[1]}/app.bsky.feed.post/${m[2]}`,
                    sandbox: 'allow-scripts allow-same-origin allow-popups'
                })
            },
            // Custom must be last; it never auto-matches but is reachable
            // through the modal's "Custom HTML" tab.
            {
                name: 'custom', label: 'Custom embed', aspect: 'auto', defaultHeight: 500,
                matchUrl: null,
                buildIframe: () => null
            }
        ];
    }
}
