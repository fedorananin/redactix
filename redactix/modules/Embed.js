import Module from '../core/Module.js';
import Icons from '../ui/Icons.js';
import { parseHtmlInert, sanitizeUrl, sanitizeIframeSrc, sanitizeIframeAllow, sanitizeIframeSandbox } from '../core/dom-utils.js';
import { readCaption, writeCaption, cleanCaptionForSync, ensureEditButton, setOwnClass } from '../core/figure-utils.js';
import { inputGroup, textareaGroup, statusLine } from '../ui/form-helpers.js';
import { isKnownResizeOrigin, resolveResize, parseResizeMessage, withTwitchParent, RESIZE_MIN, RESIZE_MAX } from '../core/embed-protocol.js';

// Padding-top ratios for the aspect-based layouts (see applyFrameLayout).
const PADDING_ASPECTS = { '16:9': '56.25%', '4:3': '75%', '1:1': '100%' };
const ASPECTS = ['16:9', '4:3', '1:1', '9:16', 'auto'];

// Query parameters that only track the share (never change what is shown).
const TRACKING_PARAMS = ['si', 'feature', 'fbclid', 'gclid', 'igsh', 'igshid', 'ref_src', 'ref_url', 'pp', 'share_id', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];

const IFRAME_ATTRS = ['src', 'width', 'height', 'allow', 'allowfullscreen',
    'frameborder', 'scrolling', 'title', 'loading', 'referrerpolicy', 'sandbox'];

/** Valid persisted height (data-height / custom iframe height) or null. */
function clampHeight(value) {
    const n = parseInt(value, 10);
    if (!Number.isFinite(n) || n < RESIZE_MIN) return null;
    return Math.min(n, RESIZE_MAX);
}

/** URL object for a user-typed URL (scheme optional), or null. */
function parseLooseUrl(url) {
    if (!url) return null;
    try {
        return new URL(/^[a-z][a-z0-9+.-]*:/i.test(url) ? url : 'https://' + url);
    } catch (e) {
        return null;
    }
}

/** Query + hash parameters of a user-typed URL (YouTube puts t= in either). */
function urlParams(url) {
    const u = parseLooseUrl(url);
    const params = new URLSearchParams(u ? u.search : '');
    if (u && u.hash.length > 1) {
        new URLSearchParams(u.hash.slice(1)).forEach((v, k) => {
            if (!params.has(k)) params.set(k, v);
        });
    }
    return params;
}

/** "90", "90s", "1m30s", "1h2m3s" → seconds (0 when unparseable). */
function parseStartTime(value) {
    if (!value) return 0;
    const v = String(value).trim().toLowerCase();
    if (/^\d+$/.test(v)) return parseInt(v, 10);
    const m = v.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
    if (!m || !(m[1] || m[2] || m[3])) return 0;
    return (parseInt(m[1] || 0, 10) * 3600) + (parseInt(m[2] || 0, 10) * 60) + parseInt(m[3] || 0, 10);
}

function safeDecode(value) {
    try { return decodeURIComponent(value); } catch (e) { return ''; }
}

/**
 * Embed module.
 *
 * Single source of truth for any third-party embed (YouTube, Spotify,
 * Twitter, etc.). All embeds share one DOM shape:
 *
 *   <figure class="redactix-embed"
 *           data-provider="..."
 *           data-aspect="16:9|4:3|1:1|9:16|auto"
 *           data-height="..."            (aspect=auto only)
 *           data-source-url="...">
 *     <div class="redactix-embed-frame">
 *       <iframe src="..." allow="..." allowfullscreen></iframe>
 *     </div>
 *     <figcaption>...optional caption...</figcaption>
 *   </figure>
 *
 * data-height is the embed's real initial height (a Spotify track is 152px,
 * an album 352px; a custom iframe keeps its own height attribute). Sync and
 * setup rebuild the inline layout from it, so it survives save / reload.
 * Live postMessage resizes are NOT persisted — the production runtime
 * re-measures.
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
    static moduleName = 'Embed';

    constructor(instance) {
        super(instance);
        this.liteMode = instance.config.liteMode || false;
        this.providers = this.buildProviderRegistry();
        // contentWindow → iframe, so a postMessage doesn't rescan the editor.
        this._iframeCache = new WeakMap();
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
        // Глобальный слушатель — через registry (снимается в destroy()).
        this.instance.listen(window, 'message', (e) => this.onProviderMessage(e));
    }

    onProviderMessage(e) {
        // Cheap bail-outs first: unknown origin or a payload that can't be
        // a resize message — no DOM work for unrelated chatter.
        if (!isKnownResizeOrigin(e.origin)) return;
        const data = e.data;
        if (data === null || (typeof data !== 'string' && typeof data !== 'object')) return;

        const iframe = this.findIframeBySource(e.source);
        if (!iframe) return;
        const frame = iframe.parentElement;
        const figure = frame.parentElement;
        const provider = figure.getAttribute('data-provider') || '';
        const height = resolveResize(provider, e.origin, data);
        if (height === null) return;
        // Live snapshot only — sync() rebuilds the layout from data-height
        // before writing to textarea, so it doesn't leak into saved HTML.
        const px = `${height}px`;
        if (frame.style.height !== px) frame.style.height = px;
    }

    findIframeBySource(source) {
        const editor = this.instance.editorEl;
        if (!source || !editor || !editor.isConnected) return null;
        const hit = this._iframeCache.get(source);
        if (hit && hit.contentWindow === source && editor.contains(hit)) return hit;
        const iframes = editor.querySelectorAll('figure.redactix-embed > .redactix-embed-frame > iframe');
        for (const iframe of iframes) {
            if (iframe.contentWindow === source) {
                this._iframeCache.set(source, iframe);
                return iframe;
            }
        }
        return null;
    }

    /**
     * Provider-specific decoder for the postMessage payload (see
     * core/embed-protocol.js). Returns the height in px or null.
     */
    parseResizeMessage(provider, raw) {
        return parseResizeMessage(provider, raw);
    }

    // ---------- public API ----------

    findProviderByName(name) {
        return this.providers.find(p => p.name === name) || null;
    }

    /**
     * Provider for a user-typed URL. Every matchUrl is anchored at the start
     * of the URL (scheme optional), so a provider's host buried in another
     * URL's path or query never matches.
     */
    findProviderByUrl(url) {
        const value = typeof url === 'string' ? url.trim() : '';
        if (!value) return null;
        for (const p of this.providers) {
            if (!p.matchUrl) continue;
            const m = value.match(p.matchUrl);
            if (m) return { provider: p, match: m };
        }
        return null;
    }

    /**
     * Is `src` really served by a registered provider? Only https, and the
     * match must start at the URL's host (matchUrl is anchored).
     */
    findProviderForIframeSrc(src) {
        let url;
        try { url = new URL(src); } catch (e) { return null; }
        if (url.protocol !== 'https:') return null;
        const candidate = 'https://' + url.host.toLowerCase() + url.pathname + url.search;
        for (const p of this.providers) {
            if (!p.matchUrl) continue;
            const m = candidate.match(p.matchUrl);
            if (m && m.index === 0) return { provider: p, match: m };
        }
        return null;
    }

    resolveAspect(provider, match, url) {
        const aspect = typeof provider.aspect === 'function' ? provider.aspect(match, url) : provider.aspect;
        return ASPECTS.includes(aspect) ? aspect : 'auto';
    }

    resolveHeight(provider, match, url) {
        const h = typeof provider.defaultHeight === 'function'
            ? provider.defaultHeight(match, url)
            : provider.defaultHeight;
        return clampHeight(h) || 0;
    }

    /**
     * Height an aspect="auto" embed should have: the persisted data-height,
     * else the provider default recomputed from the stored URL (so a legacy
     * Spotify track still gets 152, not the album height).
     */
    heightForFigure(figure) {
        const stored = clampHeight(figure.getAttribute('data-height'));
        if (stored) return stored;
        const provider = this.findProviderByName(figure.getAttribute('data-provider') || '');
        if (!provider) return 0;
        const iframe = figure.querySelector(':scope > .redactix-embed-frame > iframe');
        if (provider.name === 'custom') {
            return clampHeight(iframe && iframe.getAttribute('height')) || this.resolveHeight(provider, null, '');
        }
        const sourceUrl = figure.getAttribute('data-source-url') || '';
        const src = iframe ? (iframe.getAttribute('src') || '') : '';
        const detected = this.findProviderByUrl(sourceUrl) || this.findProviderForIframeSrc(src);
        const match = detected && detected.provider === provider ? detected.match : null;
        return this.resolveHeight(provider, match, sourceUrl || src);
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
                    this.transact(() => existingFigure.remove());
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
                if (!this.applyEmbed(existingFigure, data)) {
                    // Invalid input — say so and keep the modal (and the
                    // user's input) open.
                    form.showError(this.t(data.mode === 'custom' ? 'embed.invalidHtml' : 'embed.invalidUrl'));
                    return false;
                }
            }
        });
    }

    /**
     * Apply form data: build / refresh the figure and insert it (or
     * update existing). Returns false if the input produced no embed.
     */
    applyEmbed(existingFigure, data) {
        const built = this.buildEmbedSpec(data);
        if (!built) return false;

        if (existingFigure) {
            this.transact(() => {
                this.populateFigure(existingFigure, built, data.caption);
                // Re-wire contenteditable in case figcaption was just (re)created.
                this.setupEmbeds(existingFigure.parentNode || this.instance.editorEl);
            });
            return true;
        }

        const figure = document.createElement('figure');
        this.populateFigure(figure, built, data.caption);

        this.instance.selection.restore();
        this.transact(() => {
            this.instance.selection.insertNode(figure);
            this.setupEmbeds(figure.parentNode || this.instance.editorEl);
        });
        return true;
    }

    /**
     * Build the iframe spec + provider metadata from form data.
     * Returns null if neither URL nor HTML produces a valid iframe.
     *
     * Aspect-based providers (16:9 etc.) scale from the wrapping width;
     * the rest get a pixel height (provider default for that kind of
     * content, or the pasted iframe's own height for custom embeds) that
     * is persisted in data-height. The on-site runtime auto-resizes the
     * social ones to fit their content.
     */
    buildEmbedSpec(data) {
        if (data.mode === 'custom') {
            const iframe = this.parseAndSanitizeCustomHtml(data.html);
            if (!iframe) return null;
            return {
                providerName: 'custom',
                aspect: 'auto',
                initialHeight: clampHeight(iframe.getAttribute('height')) || this.resolveHeight(this.findProviderByName('custom'), null, ''),
                iframeAttrs: this.iframeToAttrs(iframe)
            };
        }

        let url = (data.url || '').trim();
        if (!url) return null;
        // People paste the whole "<iframe src=…>" snippet into the URL field
        // (Google Maps' "Embed a map" dialog only offers that) — use its src.
        if (/<iframe[\s>]/i.test(url)) {
            const iframe = parseHtmlInert(url).querySelector('iframe');
            url = iframe ? (iframe.getAttribute('src') || '').trim() : '';
            if (!url) return null;
        }

        const detected = this.findProviderByUrl(url);
        if (!detected) return null;

        const { provider, match } = detected;
        const attrs = provider.buildIframe(match, url);
        // buildIframe can return null (unrecognised variant) — without the
        // guard populateFigure would crash on Object.entries(null).
        if (!attrs || !sanitizeIframeSrc(attrs.src || '')) return null;
        const aspect = this.resolveAspect(provider, match, url);
        return {
            providerName: provider.name,
            aspect,
            initialHeight: aspect === 'auto' ? this.resolveHeight(provider, match, url) : 0,
            iframeAttrs: attrs,
            sourceUrl: this.cleanSourceUrl(url, provider)
        };
    }

    /** User URL with share-tracking parameters (si=, utm_*, …) removed. */
    cleanSourceUrl(url, provider) {
        const safe = sanitizeUrl(url, { allowedSchemes: ['http', 'https'] });
        if (!safe) return '';
        const hasScheme = /^https?:\/\//i.test(safe);
        const u = parseLooseUrl(safe);
        if (!u) return safe;
        const drop = TRACKING_PARAMS.concat((provider && provider.trackingParams) || []);
        let changed = false;
        Array.from(u.searchParams.keys()).forEach(key => {
            if (drop.includes(key) || /^utm_/i.test(key)) {
                u.searchParams.delete(key);
                changed = true;
            }
        });
        if (!changed) return safe;
        const out = u.toString();
        return hasScheme ? out : out.replace(/^https:\/\//, '');
    }

    populateFigure(figure, built, caption) {
        setOwnClass(figure, 'redactix-embed');
        figure.setAttribute('data-provider', built.providerName);
        figure.setAttribute('data-aspect', built.aspect);
        if (built.aspect === 'auto' && built.initialHeight > 0) {
            figure.setAttribute('data-height', String(built.initialHeight));
        } else {
            figure.removeAttribute('data-height');
        }
        // Remember the user's original URL so edit-modal can show it back
        // even when the iframe.src is a provider-specific embed URL.
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
        frame.replaceChildren();
        const iframe = document.createElement('iframe');
        for (const [k, v] of Object.entries(built.iframeAttrs)) {
            if (!IFRAME_ATTRS.includes(k)) continue;
            if (v === true) iframe.setAttribute(k, '');
            else if (v != null && v !== false) iframe.setAttribute(k, String(v));
        }
        // Provider specs go through the same permission filters as pasted
        // and loaded iframes, so what the editor writes is what survives
        // the next load.
        this.sanitizeIframe(iframe);
        // Critical layout written inline so the embed renders correctly
        // standalone — without depending on Redactix.css being loaded.
        this.applyFrameLayout(frame, built);
        this.applyIframeLayout(iframe, built);
        frame.appendChild(iframe);

        // Floating "Edit" button — sits on top of the iframe in the
        // top-right corner, visible on hover. This is the only reliable
        // path to the edit modal because iframes swallow mouse events.
        // Marked with data-redactix-ui so sync() strips it from output.
        if (!this.liteMode) ensureEditButton(frame, 'redactix-embed-edit-btn', this.t('embed.edit'));

        // Figcaption — inline HTML round-trip (sanitised in writeCaption) so
        // inline links / formatting added through the floating toolbar
        // survive a re-edit.
        writeCaption(figure, caption);
    }

    /**
     * Inline layout for .redactix-embed-frame + its iframe so the embed
     * works without Redactix.css.
     *
     * Three modes:
     *   • 16:9 / 4:3 / 1:1 → padding-top % trick + absolutely-positioned
     *     iframe inside.
     *   • 9:16 (vertical: YouTube Shorts) → aspect-ratio box capped at
     *     360px wide (a padding-top box can't be width-capped: its % is
     *     relative to the PARENT's width).
     *   • fixed-height (aspect="auto") → width + pixel height; the iframe
     *     fills it as a block element.
     */
    applyFrameLayout(frame, built) {
        const s = frame.style;
        // Reset any leftover styles from another mode
        s.position = '';
        s.overflow = '';
        s.paddingTop = '';
        s.maxWidth = '';
        s.aspectRatio = '';
        s.margin = '';
        s.width = '';
        s.height = '';

        if (PADDING_ASPECTS[built.aspect]) {
            s.position = 'relative';
            s.width = '100%';
            s.overflow = 'hidden';
            s.paddingTop = PADDING_ASPECTS[built.aspect];
            s.height = '0';
        } else if (built.aspect === '9:16') {
            s.position = 'relative';
            s.width = '100%';
            s.maxWidth = '360px';
            s.margin = '0 auto';
            s.aspectRatio = '9 / 16';
            s.overflow = 'hidden';
            s.paddingTop = '0';
            s.height = 'auto';
        } else if (built.initialHeight && built.initialHeight > 0) {
            s.width = '100%';
            s.height = `${built.initialHeight}px`;
        }
    }

    applyIframeLayout(iframe, built) {
        const absolute = built && (PADDING_ASPECTS[built.aspect] || built.aspect === '9:16');
        iframe.style.border = '0';
        if (absolute) {
            // Absolute fill of the aspect box
            iframe.style.display = '';
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
        const caption = readCaption(figure);
        const iframe = figure.querySelector(':scope > .redactix-embed-frame > iframe');
        const src = iframe ? (iframe.getAttribute('src') || '') : '';

        if (providerName === 'custom') {
            let html = '';
            if (iframe) {
                // Show the code without the editor's inline layout.
                const copy = iframe.cloneNode(false);
                copy.removeAttribute('style');
                html = copy.outerHTML;
            }
            return { providerName, mode: 'custom', url: '', html, caption };
        }
        // Prefer the original user-supplied URL so re-saving works even
        // when the iframe.src is an embed-only URL.
        return { providerName, mode: 'url', url: sourceUrl || src, html: '', caption };
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
        const urlGroup = inputGroup(this.t('embed.urlLabel'), 'text', initial.url, { placeholder: 'https://...' });
        const urlInput = urlGroup.field;
        urlPanel.appendChild(urlGroup);
        const urlHint = document.createElement('div');
        urlHint.className = 'redactix-embed-hint';
        urlHint.textContent = this.t('embed.urlHint');
        urlPanel.appendChild(urlHint);

        // Custom panel
        const customPanel = document.createElement('div');
        const customGroup = textareaGroup(this.t('embed.customLabel'), initial.html || '', {
            rows: 6,
            placeholder: '<iframe src="https://..."></iframe>'
        });
        customGroup.field.classList.add('redactix-embed-code');
        customPanel.appendChild(customGroup);
        const customHint = document.createElement('div');
        customHint.className = 'redactix-embed-hint';
        customHint.textContent = this.t('embed.customHint');
        customPanel.appendChild(customHint);

        // Caption (shared). Height is not user-editable — embeds either
        // follow their aspect-ratio or auto-resize via postMessage.
        const captionGroup = inputGroup(this.t('embed.captionLabel'), 'text', initial.caption, { placeholder: this.t('embed.captionPlaceholder') });
        const captionInput = captionGroup.field;

        const status = statusLine('', { error: true });

        wrap.append(urlPanel, customPanel, captionGroup, status);

        let mode = initial.mode || 'url';
        const applyMode = () => {
            tabUrl.classList.toggle('is-active', mode === 'url');
            tabCustom.classList.toggle('is-active', mode === 'custom');
            urlPanel.style.display = mode === 'url' ? '' : 'none';
            customPanel.style.display = mode === 'custom' ? '' : 'none';
            status.textContent = '';
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
                url: urlInput.value.trim(),
                html: customGroup.field.value,
                caption: captionInput.value
            }),
            showError: (text) => {
                status.textContent = text;
                (mode === 'custom' ? customGroup.field : urlInput).focus();
            }
        };
    }

    makeTabButton(label, active) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'redactix-embed-tab' + (active ? ' is-active' : '');
        b.textContent = label;
        return b;
    }

    // ---------- custom-html sanitizer ----------

    /**
     * Accept arbitrary embed HTML, return a single sanitized <iframe>
     * element or null. Strips everything but a single <iframe> with a
     * known-safe attribute whitelist; src must be https://.
     */
    parseAndSanitizeCustomHtml(html) {
        if (!html || !html.trim()) return null;
        const tmp = parseHtmlInert(html);
        const iframe = tmp.querySelector('iframe');
        if (!iframe) return null;
        return this.sanitizeIframe(iframe);
    }

    /**
     * Strip an iframe to a known-safe set of attributes (mutates in place).
     * Returns the iframe, or null when its src is unusable (src removed).
     *
     * Which HOST an embed points at is the user's call — any domain is fair
     * game. Which SCHEME it uses is not: only absolute https:// (a
     * `javascript:` URL in an iframe runs in the parent's origin, a relative
     * one frames same-origin documents such as uploads). Permissions are
     * filtered: `allow` loses camera / microphone / geolocation …,
     * `sandbox` loses the tokens that let the frame escape it.
     */
    sanitizeIframe(iframe) {
        Array.from(iframe.attributes).forEach(attr => {
            if (!IFRAME_ATTRS.includes(attr.name.toLowerCase())) {
                iframe.removeAttribute(attr.name);
            }
        });
        if (iframe.hasAttribute('allow')) {
            const allow = sanitizeIframeAllow(iframe.getAttribute('allow'));
            if (allow) iframe.setAttribute('allow', allow);
            else iframe.removeAttribute('allow');
        }
        if (iframe.hasAttribute('sandbox')) {
            iframe.setAttribute('sandbox', sanitizeIframeSandbox(iframe.getAttribute('sandbox')));
        }
        if (iframe.hasAttribute('loading') && !['lazy', 'eager'].includes(iframe.getAttribute('loading').toLowerCase())) {
            iframe.removeAttribute('loading');
        }
        const src = sanitizeIframeSrc(iframe.getAttribute('src') || '');
        if (src === null) {
            iframe.removeAttribute('src');
            return null;
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
     * inert in the editor), re-apply the inline layout and the Edit button.
     * Idempotent.
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

            // Twitch needs the CURRENT host in parent= (see withTwitchParent).
            if (figure.getAttribute('data-provider') === 'twitch') {
                const src = iframe.getAttribute('src') || '';
                const fixed = withTwitchParent(src, location.hostname);
                if (fixed && fixed !== src) iframe.setAttribute('src', fixed);
            }

            // Re-apply inline layout for embeds loaded from saved HTML or
            // migrated from the old .redactix-video-wrapper. Don't overwrite
            // a live-resized height — only set when the frame has no inline
            // layout yet (i.e. fresh load).
            const aspect = figure.getAttribute('data-aspect') || 'auto';
            const initialHeight = aspect === 'auto' ? this.heightForFigure(figure) : 0;
            if (!frame.style.height && !frame.style.position) {
                this.applyFrameLayout(frame, { aspect, initialHeight });
            }
            this.applyIframeLayout(iframe, { aspect });

            // Make sure the floating Edit button exists (legacy embeds
            // migrated from .redactix-video-wrapper don't have one). Lite
            // mode has no embed modal, so no button either.
            if (!this.liteMode) ensureEditButton(frame, 'redactix-embed-edit-btn', this.t('embed.edit'));
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
            if (!iframe || !this.sanitizeIframe(iframe)) {
                wrapper.remove();
                return;
            }
            const figure = document.createElement('figure');
            figure.className = 'redactix-embed';
            figure.setAttribute('data-provider', this.guessProviderFromSrc(iframe.getAttribute('src') || ''));
            figure.setAttribute('data-aspect', '16:9');

            const frame = document.createElement('div');
            frame.className = 'redactix-embed-frame';
            frame.appendChild(iframe);
            figure.appendChild(frame);

            wrapper.parentNode.replaceChild(figure, wrapper);
        });
    }

    guessProviderFromSrc(src) {
        const detected = this.findProviderForIframeSrc(src);
        if (detected) return detected.provider.name;
        for (const p of this.providers) {
            if (p.srcMarker && src.includes(p.srcMarker)) return p.name;
        }
        return 'custom';
    }

    /**
     * Sync-side cleanup. Operates on a clone of editorEl, NOT live DOM.
     */
    cleanEmbedsForSync(clone) {
        clone.querySelectorAll('.redactix-embed-edit-btn').forEach(el => el.remove());

        clone.querySelectorAll('figure.redactix-embed').forEach(figure => {
            // Rebuild the frame's inline layout from scratch so the saved
            // HTML is self-contained (no Redactix.css required) and live
            // editor snapshots from postMessage don't leak into output.
            const frame = figure.querySelector(':scope > .redactix-embed-frame');
            if (frame) {
                const aspect = figure.getAttribute('data-aspect') || 'auto';
                const initialHeight = aspect === 'auto' ? this.heightForFigure(figure) : 0;
                this.applyFrameLayout(frame, { aspect, initialHeight });
                const iframe = frame.querySelector(':scope > iframe');
                if (iframe) this.applyIframeLayout(iframe, { aspect });
            }
            cleanCaptionForSync(figure);
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
        //   aspect          — '16:9' | '4:3' | '1:1' | '9:16' | 'auto'
        //                     (or fn(match, url))
        //   defaultHeight   — px height (number or fn(match, url)) for
        //                     aspect="auto"; persisted as data-height
        //   matchUrl        — RegExp ANCHORED at the URL start (scheme
        //                     optional). Must accept both the share URL a
        //                     user types AND the provider's own embed src,
        //                     so pasting saved output keeps the iframe.
        //   buildIframe(m,url) → { src, allow?, sandbox?, ... } | null
        //   srcMarker       — substring fallback for legacy migration
        //   trackingParams  — extra share-tracking query keys to strip
        const host = () => (typeof location !== 'undefined' && location.hostname) || 'localhost';
        return [
            {
                name: 'youtube', label: 'YouTube',
                // Shorts are vertical.
                aspect: (m) => (m && m.groups && m.groups.shorts ? '9:16' : '16:9'),
                srcMarker: 'youtube.com/embed',
                matchUrl: /^(?:https?:\/\/)?(?:(?:www|m|music)\.)?(?:youtube(?:-nocookie)?\.com\/(?:(?:watch|attribution_link)\/?\?(?:[^#\s]*?&)?v=|(?:embed|v|e|live|(?<shorts>shorts))\/)(?<id>(?!videoseries)[\w-]{11})(?![\w-])|youtu\.be\/(?<shortId>[\w-]{11})(?![\w-])|youtube(?:-nocookie)?\.com\/(?:embed\/videoseries|playlist)\/?\?(?:[^#\s]*?&)?list=(?<list>[\w-]+))/i,
                buildIframe: (m, url) => {
                    const g = m.groups || {};
                    const id = g.id || g.shortId;
                    const q = urlParams(url);
                    const params = new URLSearchParams();
                    const list = g.list || q.get('list');
                    if (list && /^[\w-]+$/.test(list)) params.set('list', list);
                    const start = parseStartTime(q.get('t') || q.get('start'));
                    if (start > 0) params.set('start', String(start));
                    if (!id && !params.has('list')) return null;
                    const base = `https://www.youtube.com/embed/${id || 'videoseries'}`;
                    const qs = params.toString();
                    return {
                        src: qs ? `${base}?${qs}` : base,
                        allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
                        allowfullscreen: true
                    };
                }
            },
            {
                name: 'vimeo', label: 'Vimeo', aspect: '16:9',
                srcMarker: 'player.vimeo.com',
                // vimeo.com/ID, /ID/HASH (unlisted), channels/x/ID,
                // groups/x/videos/ID, album|showcase/N/video/ID, player.vimeo.com/video/ID?h=HASH
                matchUrl: /^(?:https?:\/\/)?(?:www\.|player\.)?vimeo\.com\/(?:video\/|channels\/[\w-]+\/|groups\/[\w-]+\/videos\/|(?:album|showcase)\/\d+\/video\/)?(?<id>\d+)(?:\/(?<hash>[\da-f]+))?(?![\w-])/i,
                buildIframe: (m, url) => {
                    const g = m.groups || {};
                    const hash = g.hash || urlParams(url).get('h');
                    const h = hash && /^[\da-f]+$/i.test(hash) ? `?h=${hash}` : '';
                    return {
                        src: `https://player.vimeo.com/video/${g.id}${h}`,
                        allow: 'autoplay; fullscreen; picture-in-picture',
                        allowfullscreen: true
                    };
                }
            },
            {
                name: 'spotify', label: 'Spotify', aspect: 'auto',
                // Track / single episode → compact 152; album / playlist /
                // show / artist → tall visual player.
                defaultHeight: (m) => {
                    const type = m && m.groups ? m.groups.type.toLowerCase() : '';
                    return type === 'track' || type === 'episode' ? 152 : 352;
                },
                srcMarker: 'open.spotify.com/embed',
                matchUrl: /^(?:https?:\/\/)?open\.spotify\.com\/(?:embed\/)?(?:intl-[a-z-]+\/)?(?<type>track|album|playlist|episode|show|artist)\/(?<id>[a-zA-Z0-9]+)/i,
                buildIframe: (m) => ({
                    src: `https://open.spotify.com/embed/${m.groups.type.toLowerCase()}/${m.groups.id}`,
                    allow: 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture',
                    loading: 'lazy'
                })
            },
            {
                name: 'apple-music', label: 'Apple Music', aspect: 'auto',
                // A single song (or ?i=track in an album URL) is the compact
                // player; albums / playlists list their tracks.
                defaultHeight: (m, url) => {
                    const type = m && m.groups ? m.groups.type.toLowerCase() : '';
                    if (type === 'song' || /^\d+$/.test(urlParams(url).get('i') || '')) return 175;
                    return 450;
                },
                srcMarker: 'embed.music.apple.com',
                matchUrl: /^(?:https?:\/\/)?(?:embed\.)?music\.apple\.com\/(?<country>[a-z]{2})\/(?<type>album|playlist|song|music-video)\/(?:[^/?#\s]+\/)?(?<id>\d+|pl\.[\w-]+)(?![\w.-])/i,
                buildIframe: (m, url) => {
                    const g = m.groups;
                    const i = urlParams(url).get('i');
                    const qs = i && /^\d+$/.test(i) ? `?i=${i}` : '';
                    return {
                        src: `https://embed.music.apple.com/${g.country.toLowerCase()}/${g.type.toLowerCase()}/${g.id}${qs}`,
                        allow: 'autoplay *; encrypted-media *; clipboard-write',
                        sandbox: 'allow-forms allow-popups allow-same-origin allow-scripts allow-storage-access-by-user-activation'
                    };
                }
            },
            {
                name: 'soundcloud', label: 'SoundCloud', aspect: 'auto', defaultHeight: 166,
                srcMarker: 'w.soundcloud.com/player',
                matchUrl: /^(?:https?:\/\/)?(?:(?:(?:www|m)\.)?soundcloud\.com\/(?<path>[\w-]+\/[\w-]+(?:\/[\w-]+)?)|w\.soundcloud\.com\/player\/?\?(?:[^#\s]*?&)?url=(?<enc>[^&#\s]+))/i,
                buildIframe: (m) => {
                    const g = m.groups || {};
                    let target = g.path ? `https://soundcloud.com/${g.path}` : safeDecode(g.enc || '');
                    if (!/^https:\/\/(?:(?:www|api|m)\.)?soundcloud\.com\//i.test(target)) return null;
                    return {
                        src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(target)}`,
                        allow: 'autoplay'
                    };
                }
            },
            {
                name: 'bandcamp', label: 'Bandcamp', aspect: 'auto', defaultHeight: 120,
                srcMarker: 'bandcamp.com/EmbeddedPlayer',
                // Share URLs don't expose ids — only the EmbeddedPlayer src
                // (from Bandcamp's "Embed" dialog) is recognised.
                matchUrl: /^(?:https?:\/\/)?bandcamp\.com\/EmbeddedPlayer\/(?<path>[\w=/,.-]+)/i,
                buildIframe: (m) => ({
                    src: `https://bandcamp.com/EmbeddedPlayer/${m.groups.path}`,
                    loading: 'lazy'
                })
            },
            {
                name: 'twitch', label: 'Twitch', aspect: '16:9',
                srcMarker: 'player.twitch.tv',
                // parent= gets the editing host here; setupEmbeds() and
                // embed-runtime.js append the RENDERING host when it differs
                // (Twitch accepts several parent parameters).
                matchUrl: /^(?:https?:\/\/)?(?:(?:(?:www|m)\.)?twitch\.tv\/(?:videos\/(?<video>\d+)|(?<clipChannel>[\w-]+)\/clip\/(?<clip>[\w-]+)|(?<channel>(?!(?:videos|directory|p|settings|downloads|jobs|search)(?:[/?#]|$))[\w-]+)\/?(?=$|[?#]))|clips\.twitch\.tv\/(?:embed\/?\?(?:[^#\s]*?&)?clip=(?<embedClip>[\w-]+)|(?<clipSlug>(?!embed(?:[/?#]|$))[\w-]+))|player\.twitch\.tv\/\?(?:[^#\s]*?&)?(?:video=v?(?<playerVideo>\d+)|channel=(?<playerChannel>[\w-]+)))/i,
                buildIframe: (m) => {
                    const g = m.groups || {};
                    const parent = encodeURIComponent(host());
                    const video = g.video || g.playerVideo;
                    const clip = g.clip || g.embedClip || g.clipSlug;
                    const channel = g.channel || g.playerChannel;
                    if (video) return { src: `https://player.twitch.tv/?video=${video}&parent=${parent}`, allowfullscreen: true };
                    if (clip) return { src: `https://clips.twitch.tv/embed?clip=${clip}&parent=${parent}`, allowfullscreen: true };
                    if (channel) return { src: `https://player.twitch.tv/?channel=${channel}&parent=${parent}`, allowfullscreen: true };
                    return null;
                }
            },
            {
                name: 'codepen', label: 'CodePen', aspect: 'auto', defaultHeight: 400,
                srcMarker: 'codepen.io',
                matchUrl: /^(?:https?:\/\/)?codepen\.io\/(?<user>[\w-]+)\/(?:pen|details|full|embed(?:\/preview)?)\/(?<id>[\w-]+)/i,
                buildIframe: (m) => ({
                    src: `https://codepen.io/${m.groups.user}/embed/${m.groups.id}?default-tab=result`,
                    allowfullscreen: true,
                    loading: 'lazy'
                })
            },
            {
                name: 'loom', label: 'Loom', aspect: '16:9',
                srcMarker: 'loom.com/embed',
                matchUrl: /^(?:https?:\/\/)?(?:www\.)?loom\.com\/(?:share|embed)\/(?<id>[a-f0-9]+)/i,
                buildIframe: (m) => ({
                    src: `https://www.loom.com/embed/${m.groups.id}`,
                    allow: 'autoplay; fullscreen',
                    allowfullscreen: true
                })
            },
            {
                name: 'mixcloud', label: 'Mixcloud', aspect: 'auto', defaultHeight: 120,
                srcMarker: 'mixcloud.com/widget',
                matchUrl: /^(?:https?:\/\/)?(?:(?:www|m|player-widget)\.)?mixcloud\.com\/(?:widget\/iframe\/?\?(?:[^#\s]*?&)?feed=(?<feed>[^&#\s]+)|(?<path>(?!widget\/)[\w.-]+\/[\w.-]+)\/?(?=$|[?#]))/i,
                buildIframe: (m) => {
                    const g = m.groups || {};
                    let feed = g.path ? `/${g.path}/` : safeDecode(g.feed || '');
                    feed = feed.replace(/^https?:\/\/(?:www\.)?mixcloud\.com/i, '');
                    if (!/^\/[\w.-]+\/[\w.-]+\/?$/.test(feed)) return null;
                    if (!feed.endsWith('/')) feed += '/';
                    return { src: `https://www.mixcloud.com/widget/iframe/?feed=${encodeURIComponent(feed)}` };
                }
            },
            {
                name: 'dailymotion', label: 'Dailymotion', aspect: '16:9',
                srcMarker: 'dailymotion.com/embed',
                matchUrl: /^(?:https?:\/\/)?(?:(?:www|geo)\.)?(?:dailymotion\.com\/(?:video\/|embed\/video\/|player(?:\/[\w-]+)?\.html\?(?:[^#\s]*?&)?video=)|dai\.ly\/)(?<id>[a-zA-Z0-9]+)/i,
                buildIframe: (m) => ({
                    src: `https://www.dailymotion.com/embed/video/${m.groups.id}`,
                    allow: 'autoplay; fullscreen; picture-in-picture',
                    allowfullscreen: true
                })
            },
            {
                name: 'google-maps', label: 'Google Maps', aspect: '4:3',
                srcMarker: 'google.com/maps/embed',
                // The iframe src from Maps' "Embed a map" dialog.
                matchUrl: /^(?:https?:\/\/)?(?:(?:www|maps)\.)?(?<path>google\.(?:com|[a-z]{2,3}|co\.[a-z]{2}|com\.[a-z]{2})\/maps\/embed(?:\/v1\/\w+)?\?[^"'<>\s]+)/i,
                buildIframe: (m) => ({
                    src: `https://www.${m.groups.path}`,
                    loading: 'lazy',
                    referrerpolicy: 'no-referrer-when-downgrade'
                })
            },
            {
                name: 'twitter', label: 'X (Twitter)', aspect: 'auto', defaultHeight: 600,
                srcMarker: 'platform.twitter.com/embed',
                trackingParams: ['s', 't'],
                matchUrl: /^(?:https?:\/\/)?(?:(?:(?:www|mobile)\.)?(?:twitter|x)\.com\/(?:\w+|i\/web)\/status(?:es)?\/(?<id>\d+)|platform\.(?:twitter|x)\.com\/embed\/Tweet\.html\?(?:[^#\s]*?&)?id=(?<embedId>\d+))/i,
                buildIframe: (m) => ({
                    src: `https://platform.twitter.com/embed/Tweet.html?id=${m.groups.id || m.groups.embedId}`,
                    sandbox: 'allow-popups allow-popups-to-escape-sandbox allow-scripts allow-same-origin'
                })
            },
            {
                name: 'instagram', label: 'Instagram', aspect: 'auto', defaultHeight: 700,
                srcMarker: 'instagram.com/p/',
                matchUrl: /^(?:https?:\/\/)?(?:www\.)?instagram\.com\/(?:[\w.]+\/)?(?:p|reel|reels|tv)\/(?<id>[\w-]+)/i,
                buildIframe: (m) => ({
                    src: `https://www.instagram.com/p/${m.groups.id}/embed/`,
                    sandbox: 'allow-popups allow-popups-to-escape-sandbox allow-scripts allow-same-origin',
                    loading: 'lazy'
                })
            },
            {
                name: 'tiktok', label: 'TikTok', aspect: 'auto', defaultHeight: 750,
                srcMarker: 'tiktok.com/embed',
                matchUrl: /^(?:https?:\/\/)?(?:(?:www|m)\.)?tiktok\.com\/(?:@[\w.-]+\/video\/|embed\/(?:v2\/)?|player\/v1\/)(?<id>\d+)/i,
                buildIframe: (m) => ({
                    src: `https://www.tiktok.com/embed/v2/${m.groups.id}`,
                    allow: 'encrypted-media; clipboard-write'
                })
            },
            {
                name: 'reddit', label: 'Reddit', aspect: 'auto', defaultHeight: 500,
                srcMarker: 'redditmedia.com',
                matchUrl: /^(?:https?:\/\/)?(?:(?:www|old|new|np)\.)?(?:reddit\.com|redditmedia\.com|embed\.reddit\.com)\/r\/(?<sub>\w+)\/comments\/(?<id>[a-z0-9]+)/i,
                buildIframe: (m) => ({
                    src: `https://www.redditmedia.com/r/${m.groups.sub}/comments/${m.groups.id}/?embed=true`,
                    sandbox: 'allow-scripts allow-same-origin allow-popups'
                })
            },
            {
                name: 'bluesky', label: 'Bluesky', aspect: 'auto', defaultHeight: 500,
                srcMarker: 'embed.bsky.app',
                // bsky.app/profile/HANDLE/post/POSTID, or the embed src itself
                matchUrl: /^(?:https?:\/\/)?(?:bsky\.app\/profile\/(?<handle>[\w.:-]+)\/post\/(?<id>[a-z0-9]+)|embed\.bsky\.app\/embed\/(?<did>[\w.:%-]+)\/app\.bsky\.feed\.post\/(?<eid>[a-z0-9]+))/i,
                buildIframe: (m) => {
                    const g = m.groups || {};
                    return {
                        src: `https://embed.bsky.app/embed/${g.handle || g.did}/app.bsky.feed.post/${g.id || g.eid}`,
                        sandbox: 'allow-scripts allow-same-origin allow-popups'
                    };
                }
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

    // ---------- content lifecycle hooks (called by RedactixInstance) ----------

    setupContent(root) {
        this.migrate(root);
        this.setupEmbeds(root);
    }

    cleanForSync(clone) {
        this.cleanEmbedsForSync(clone);
    }

    ownsFigure(figure) {
        return figure.classList.contains('redactix-embed') ||
            figure.classList.contains('redactix-video-wrapper');
    }

    get pasteAllowedClasses() {
        return this.instance.config.liteMode ? [] : ['redactix-embed', 'redactix-embed-frame'];
    }

    get pasteAllowedAttributes() {
        return this.instance.config.liteMode ? [] : [{
            selector: 'figure.redactix-embed',
            attrs: ['data-provider', 'data-aspect', 'data-height', 'data-source-url']
        }];
    }

    /**
     * Paste: keep an iframe only when its src belongs to a registered
     * provider. Wrapping an arbitrary iframe in figure.redactix-embed no
     * longer vouches for it — anyone can write that markup. Kept iframes
     * are normalised into the canonical figure > frame > iframe shape.
     */
    preparePaste(root, ctx) {
        if (this.instance.config.liteMode) return;
        Array.from(root.querySelectorAll('iframe')).forEach(iframe => {
            const src = iframe.getAttribute('src') || '';
            const detected = this.findProviderForIframeSrc(src);
            if (!detected) return; // dropped by the forbidden-tag sweep
            if (!this.sanitizeIframe(iframe)) return;
            ctx.keep.add(iframe);

            const { provider, match } = detected;
            const existingFigure = iframe.closest('figure.redactix-embed');
            if (existingFigure) {
                existingFigure.setAttribute('data-provider', provider.name);
                const aspect = existingFigure.getAttribute('data-aspect');
                if (!ASPECTS.includes(aspect)) existingFigure.setAttribute('data-aspect', this.resolveAspect(provider, match, src));
                return;
            }
            const figure = iframe.ownerDocument.createElement('figure');
            figure.className = 'redactix-embed';
            figure.setAttribute('data-provider', provider.name);
            const aspect = this.resolveAspect(provider, match, src);
            figure.setAttribute('data-aspect', aspect);
            if (aspect === 'auto') {
                const h = clampHeight(iframe.getAttribute('height')) || this.resolveHeight(provider, match, src);
                if (h) figure.setAttribute('data-height', String(h));
            }
            const frame = iframe.ownerDocument.createElement('div');
            frame.className = 'redactix-embed-frame';
            iframe.parentNode.insertBefore(figure, iframe);
            frame.appendChild(iframe);
            figure.appendChild(frame);
        });
    }
}
