// Shared DOM helpers used across the editor core and modules.
// Keeps the lists of "block / atomic / inline" tags in one place and
// centralises URL / rel / target sanitisation so every link-creation path
// goes through the same checks.

export const BLOCK_TAGS = ['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'BLOCKQUOTE', 'ASIDE', 'PRE', 'TABLE', 'FIGURE', 'HR', 'LI'];
export const ATOMIC_TAGS = ['FIGURE', 'PRE', 'TABLE', 'HR'];
export const INLINE_FORMAT_TAGS = ['B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'A', 'CODE', 'SPAN', 'SUB', 'SUP', 'MARK'];

const BLOCK_TAG_SET = new Set(BLOCK_TAGS);
const ATOMIC_TAG_SET = new Set(ATOMIC_TAGS);

export function isBlockTag(tagName) {
    return BLOCK_TAG_SET.has(String(tagName || '').toUpperCase());
}

// Top-level element that should never be merged with neighbours by
// browser-default backspace/delete behaviour.
export function isAtomicBlock(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
    if (ATOMIC_TAG_SET.has(el.tagName)) return true;
    if (el.tagName === 'DIV' && (
        el.classList.contains('redactix-separator') ||
        el.classList.contains('redactix-video-wrapper')
    )) return true;
    return false;
}

// "No meaningful content" check used by Enter/Backspace handlers and
// markdown shortcuts. `atomicSelector` lets a caller decide which embedded
// children count as content (e.g. inside a quote-card <hr> can't appear, so
// callers pass a tighter selector).
export function isBlockEmpty(block, atomicSelector = 'img, iframe, video, audio, table, hr') {
    if (!block) return true;
    if (block.textContent && block.textContent.trim()) return false;
    if (atomicSelector && block.querySelector(atomicSelector)) return false;
    return true;
}

// Decode common HTML entity forms (decimal / hex) so url="&#106;avascript:..."
// doesn't slip past the scheme check.
// Code points above U+10FFFF make String.fromCodePoint throw a RangeError —
// which used to abort render() and leave every later textarea on the page
// uninitialised — so they decode to nothing.
function codePointToString(code) {
    return (Number.isFinite(code) && code >= 0 && code <= 0x10FFFF) ? String.fromCodePoint(code) : '';
}

// Named entities that can spell out a URL scheme separator or whitespace.
const NAMED_URL_ENTITIES = { colon: ':', tab: '\t', newline: '\n', sol: '/', lpar: '(', rpar: ')' };

function decodeEntities(str) {
    return str.replace(/&#x([0-9a-f]+);?/gi, (_, hex) => codePointToString(parseInt(hex, 16)))
        .replace(/&#(\d+);?/g, (_, dec) => codePointToString(parseInt(dec, 10)))
        .replace(/&(colon|tab|newline|sol|lpar|rpar);/gi, (_, name) => NAMED_URL_ENTITIES[name.toLowerCase()]);
}

// Control-char strip pattern: NUL..US (0x00–0x1F) plus DEL (0x7F).
// Browsers ignore these when parsing a URL scheme, so e.g. "java\tscript:..."
// would otherwise sneak past a naive prefix check. Defined as a function
// instead of a regex literal so the source file doesn't contain raw control
// bytes (which editors strip / git diffs render strangely).
function stripControlChars(s) {
    let out = '';
    for (let i = 0; i < s.length; i++) {
        const code = s.charCodeAt(i);
        if (code < 0x20 || code === 0x7f) continue;
        out += s[i];
    }
    return out;
}

// Parse an untrusted HTML string into an INERT document.
//
// `document.createElement('div').innerHTML = html` is not inert: the nodes
// belong to the live document, so the browser starts fetching resources and
// fires `onerror` / `onload` handlers immediately — i.e. before a sanitizer
// has had a chance to strip them. A document from createHTMLDocument() has
// no browsing context, so nothing loads and no handler runs.
//
// Returns the <body> of that document; use it exactly like the throwaway
// <div> it replaces (querySelectorAll / innerHTML / …). Nodes moved out of
// it into the live DOM are adopted automatically.
export function parseHtmlInert(html) {
    const doc = document.implementation.createHTMLDocument('');
    doc.body.innerHTML = typeof html === 'string' ? html : '';
    return doc.body;
}

// Returns the original (untrimmed-as-typed but minimally normalised) URL if
// its scheme is in `allowedSchemes`, or null otherwise. Relative URLs,
// fragments and query-only strings pass.
export function sanitizeUrl(url, { allowedSchemes = ['http', 'https', 'mailto', 'tel'] } = {}) {
    if (typeof url !== 'string') return null;
    const trimmed = url.trim();
    if (!trimmed) return null;
    const normalized = decodeEntities(stripControlChars(trimmed));
    const m = normalized.match(/^([a-z][a-z0-9+.\-]*):/i);
    if (!m) return trimmed; // relative URL, anchor, query — safe
    const scheme = m[1].toLowerCase();
    if (allowedSchemes.includes(scheme)) return trimmed;
    return null;
}

// Image `src` is allowed to be a regular http(s) URL OR a raster data: URL.
// Explicitly excludes `data:image/svg+xml` (script-bearing) and any
// non-image data: URL.
export function sanitizeImageSrc(url) {
    if (typeof url !== 'string') return null;
    const trimmed = url.trim();
    if (!trimmed) return null;
    const normalized = decodeEntities(stripControlChars(trimmed));
    if (/^data:image\/(jpeg|png|gif|webp|avif|bmp|x-icon)[;,]/i.test(normalized)) {
        return trimmed;
    }
    return sanitizeUrl(url);
}

const SAFE_REL_TOKENS = new Set([
    'noopener', 'noreferrer', 'nofollow', 'ugc', 'sponsored',
    'author', 'external', 'license', 'tag', 'help', 'me'
]);

// Filter rel="..." down to a whitelist of safe tokens.
export function sanitizeRel(rel) {
    if (typeof rel !== 'string') return '';
    const tokens = rel.split(/\s+/)
        .map(t => t.toLowerCase())
        .filter(t => SAFE_REL_TOKENS.has(t));
    return Array.from(new Set(tokens)).join(' ');
}

const SAFE_TARGETS = new Set(['_blank', '_self', '_parent', '_top']);

export function sanitizeTarget(target) {
    if (typeof target !== 'string') return '';
    const t = target.trim().toLowerCase();
    return SAFE_TARGETS.has(t) ? t : '';
}

// Compose rel for a newly-created link. Always force noopener+noreferrer
// when target=_blank to prevent tab-jacking. `extra` is user-supplied
// extra tokens (filtered through sanitizeRel).
export function composeLinkRel({ nofollow = false, blank = false, extra = '' } = {}) {
    const parts = [];
    if (nofollow) parts.push('nofollow');
    if (blank) parts.push('noopener', 'noreferrer');
    if (extra) {
        const cleaned = sanitizeRel(extra);
        if (cleaned) parts.push(...cleaned.split(/\s+/));
    }
    return Array.from(new Set(parts)).join(' ');
}

// Synonymous inline tags are reduced to a single canonical form so that there
// is no mixture of <b>/<strong>, <i>/<em>, <s>/<strike> in the saved HTML.
// Called on paste, content load, and on sync clone.
const INLINE_TAG_SYNONYMS = { STRONG: 'b', EM: 'i', STRIKE: 's' };

export function normalizeInlineSynonyms(root) {
    Object.keys(INLINE_TAG_SYNONYMS).forEach(tag => {
        root.querySelectorAll(tag).forEach(el => {
            const repl = document.createElement(INLINE_TAG_SYNONYMS[el.tagName]);
            // Transfer attributes as they are (class/id from Attributes dialog, etc.)
            Array.from(el.attributes).forEach(a => repl.setAttribute(a.name, a.value));
            while (el.firstChild) repl.appendChild(el.firstChild);
            el.parentNode.replaceChild(repl, el);
        });
    });
}

// Inline tags allowed inside captions / author names that round-trip
// through modal inputs as raw HTML.
const INLINE_HTML_ALLOWED = new Set([
    'A', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE',
    'CODE', 'SPAN', 'MARK', 'SUB', 'SUP', 'BR'
]);

// Sanitize a snippet of inline HTML (figcaption text, quote-card author
// name, embed/video/gallery captions). Modal inputs accept raw HTML so
// inline links and formatting survive a re-edit — but the value must not
// be able to smuggle scripts, block elements or unsafe URLs into the
// document. Keeps only INLINE_HTML_ALLOWED tags (everything else is
// unwrapped, its children kept), strips all attributes except a safe
// href/rel/target/title set on <a> and class="spoiler" on <span>.
export function sanitizeInlineHtml(html) {
    if (typeof html !== 'string' || !html.trim()) return '';
    const tmp = parseHtmlInert(html);

    const clean = (root) => {
        Array.from(root.children).forEach(child => {
            clean(child); // depth-first so unwrapped children are already clean

            if (!INLINE_HTML_ALLOWED.has(child.tagName)) {
                while (child.firstChild) {
                    child.parentNode.insertBefore(child.firstChild, child);
                }
                child.remove();
                return;
            }

            Array.from(child.attributes).forEach(attr => {
                const name = attr.name.toLowerCase();
                if (child.tagName === 'A' && name === 'href') {
                    const safe = sanitizeUrl(attr.value);
                    if (safe === null) child.removeAttribute(attr.name);
                    return;
                }
                if (child.tagName === 'A' && name === 'rel') {
                    const cleaned = sanitizeRel(attr.value);
                    if (cleaned) child.setAttribute('rel', cleaned);
                    else child.removeAttribute('rel');
                    return;
                }
                if (child.tagName === 'A' && name === 'target') {
                    const cleaned = sanitizeTarget(attr.value);
                    if (cleaned) child.setAttribute('target', cleaned);
                    else child.removeAttribute('target');
                    return;
                }
                if (name === 'class' && child.tagName === 'SPAN' &&
                    attr.value.split(/\s+/).includes('spoiler')) {
                    child.setAttribute('class', 'spoiler');
                    return;
                }
                if (name === 'title') return;
                child.removeAttribute(attr.name);
            });

            // target=_blank without noopener is a tab-jacking vector.
            if (child.tagName === 'A' && child.getAttribute('target') === '_blank') {
                const tokens = new Set((child.getAttribute('rel') || '').split(/\s+/).filter(Boolean));
                tokens.add('noopener');
                tokens.add('noreferrer');
                child.setAttribute('rel', Array.from(tokens).join(' '));
            }
        });
    };
    clean(tmp);

    // <strong>/<em>/<strike> are allowed as input, but only canonical
    // <b>/<i>/<s> are written to the document.
    normalizeInlineSynonyms(tmp);

    return tmp.innerHTML;
}

// ---------------------------------------------------------------------------
// Load-time sanitisation
// ---------------------------------------------------------------------------
// The paste sanitizer (Editor.sanitizeHtml) is a *normaliser*: it rewrites
// foreign markup into the editor's own shapes and drops everything it doesn't
// recognise. That's the right posture for clipboard data, but it would mangle
// the editor's OWN saved output — ids from the Attributes dialog,
// `class="language-js"` on code blocks, user-defined preset classes, and so on.
//
// So content arriving through `textarea.value` / setContent() / HTML mode gets
// a narrower pass: keep the markup, remove only what can execute. Anything
// that survives here is exactly what will survive the next load, so the three
// entry points stay consistent with each other.

// Never valid inside editor content, whatever the source. <iframe> is
// deliberately absent — embeds are a first-class feature; its src goes
// through the URL check below instead.
// Also used by the paste sanitizer (Editor.sanitizeHtml) as its baseline,
// so the two entry points can no longer drift apart.
//
// Raw-text elements (xmp / noembed / noframes / plaintext) are here because
// their content serialises as raw text: a later re-parse could turn that text
// into live markup (mutation XSS). <svg> / <math> carry their own scripting
// and SMIL animation surface (<animate to="javascript:…">) — the editor never
// produces them, so they're dropped wholesale.
export const FORBIDDEN_TAGS = [
    'script', 'style', 'link', 'meta', 'base', 'object', 'applet', 'embed',
    'noscript', 'form', 'input', 'button', 'select', 'textarea', 'option',
    'frame', 'frameset', 'template', 'xmp', 'noembed', 'noframes',
    'plaintext', 'svg', 'math', 'portal', 'title', 'head'
];
const LOAD_FORBIDDEN_TAGS = FORBIDDEN_TAGS;

// Permission-policy features an embedded iframe may request. Everything else
// (camera, microphone, geolocation, payment, display-capture …) would surface
// a permission prompt attributed to the host site.
const SAFE_IFRAME_ALLOW = new Set([
    'autoplay', 'encrypted-media', 'fullscreen', 'picture-in-picture',
    'clipboard-write', 'web-share', 'accelerometer', 'gyroscope'
]);

export function sanitizeIframeAllow(value) {
    if (typeof value !== 'string') return '';
    return value.split(';')
        .map(part => part.trim())
        .filter(part => {
            const feature = part.split(/\s+/)[0].toLowerCase();
            return SAFE_IFRAME_ALLOW.has(feature);
        })
        .join('; ');
}

// sandbox tokens that let a framed page navigate the HOST page away are
// removed. allow-popups-to-escape-sandbox stays: it only affects the new tab
// a link inside the embed opens (Twitter / Instagram rely on it), never the
// host page.
export function sanitizeIframeSandbox(value) {
    if (typeof value !== 'string') return '';
    return value.split(/\s+/)
        .filter(t => t && !/^allow-top-navigation/i.test(t))
        .join(' ');
}

// Absolute http(s) URL check for iframe sources. Relative iframe sources are
// refused: they would frame same-origin documents (e.g. an uploaded SVG).
export function sanitizeIframeSrc(src, { allowHttp = false } = {}) {
    const safe = sanitizeUrl(src, { allowedSchemes: allowHttp ? ['http', 'https'] : ['https'] });
    if (safe === null) return null;
    const normalized = decodeEntities(stripControlChars(safe));
    if (!/^https?:\/\//i.test(normalized)) return null;
    return safe;
}

// Attributes whose value is a URL and therefore needs a scheme check.
const URL_ATTRS = new Set([
    'href', 'src', 'xlink:href', 'poster', 'formaction',
    'action', 'data', 'cite', 'background', 'ping'
]);

// CSS constructs that can execute. Whitespace is collapsed before matching so
// `java script:` and friends can't slip through.
function hasUnsafeCss(css) {
    const normalized = decodeEntities(stripControlChars(String(css || '')))
        .toLowerCase()
        .replace(/\s+/g, '');
    return normalized.includes('javascript:') ||
        normalized.includes('vbscript:') ||
        normalized.includes('expression(') ||
        normalized.includes('behavior:') ||
        normalized.includes('-moz-binding');
}

// srcset is a comma-separated candidate list. data: URLs contain commas of
// their own, so rather than write a full parser for a value the editor never
// generates itself, bail out and drop the attribute when one appears.
export function sanitizeSrcset(value) {
    if (typeof value !== 'string' || !value.trim()) return '';
    if (/data:/i.test(value)) return '';
    const candidates = value.split(',').map(s => s.trim()).filter(Boolean);
    const safe = [];
    for (const candidate of candidates) {
        const parts = candidate.split(/\s+/);
        if (sanitizeImageSrc(parts[0]) === null) return '';
        safe.push(parts.join(' '));
    }
    return safe.join(', ');
}

// Strip executable content from an already-parsed root, in place.
// Exported for callers that have a DOM tree rather than a string.
export function sanitizeLoadedRoot(root) {
    if (!root) return root;

    LOAD_FORBIDDEN_TAGS.forEach(tag => {
        Array.from(root.querySelectorAll(tag)).forEach(el => el.remove());
    });

    // Iframes need an absolute http(s) source; permissions are trimmed.
    Array.from(root.querySelectorAll('iframe')).forEach(iframe => {
        if (sanitizeIframeSrc(iframe.getAttribute('src') || '', { allowHttp: true }) === null) {
            iframe.remove();
            return;
        }
        if (iframe.hasAttribute('allow')) {
            const allow = sanitizeIframeAllow(iframe.getAttribute('allow'));
            if (allow) iframe.setAttribute('allow', allow);
            else iframe.removeAttribute('allow');
        }
        if (iframe.hasAttribute('sandbox')) {
            iframe.setAttribute('sandbox', sanitizeIframeSandbox(iframe.getAttribute('sandbox')));
        }
    });

    Array.from(root.querySelectorAll('*')).forEach(el => {
        const isImg = el.tagName === 'IMG';

        Array.from(el.attributes).forEach(attr => {
            const name = attr.name.toLowerCase();

            // Any event handler, in any casing.
            if (name.startsWith('on')) {
                el.removeAttribute(attr.name);
                return;
            }

            // srcdoc turns an <iframe> into an inline document — the one
            // iframe attribute that can carry script through saved HTML.
            if (name === 'srcdoc') {
                el.removeAttribute(attr.name);
                return;
            }

            if (name === 'srcset') {
                const safe = sanitizeSrcset(attr.value);
                if (safe) el.setAttribute(attr.name, safe);
                else el.removeAttribute(attr.name);
                return;
            }

            if (URL_ATTRS.has(name)) {
                const safe = (isImg && name === 'src')
                    ? sanitizeImageSrc(attr.value)
                    : sanitizeUrl(attr.value);
                if (safe === null) el.removeAttribute(attr.name);
                return;
            }

            // Inline styles are load-bearing here (embed frame layout, video
            // aspect-ratio), so they're kept — minus the executable forms.
            if (name === 'style' && hasUnsafeCss(attr.value)) {
                el.removeAttribute(attr.name);
            }
        });
    });

    return root;
}

// String-in / string-out wrapper over sanitizeLoadedRoot(). Parses inertly,
// so nothing loads or fires while the content is being cleaned.
// `collapseWhitespace` (default on) drops source-formatting whitespace —
// indentation and newlines between tags — without touching spaces that
// separate inline elements (see normalizeWhitespace).
export function sanitizeLoadedHtml(html, { collapseWhitespace = true } = {}) {
    if (typeof html !== 'string' || !html.trim()) return '';
    const root = parseHtmlInert(html);
    if (collapseWhitespace) normalizeWhitespace(root);
    return sanitizeLoadedRoot(root).innerHTML.trim();
}

// ---------------------------------------------------------------------------
// Whitespace normalisation
// ---------------------------------------------------------------------------
// Pretty-printed HTML (from a database, or typed in HTML mode) is full of
// indentation and newlines between tags. The editor renders with
// `white-space: pre-wrap`, so that formatting would show up as blank lines.
//
// The previous approach — `html.replace(/>\s+</g, '><')` — also deleted the
// single space in `<b>a</b> <i>b</i>`, gluing words together on every load,
// and rewrote the inside of <pre> blocks. This works on the DOM instead:
//   • whitespace next to a block, or inside list/table structure → removed;
//   • a formatting run (contains a newline/tab) at the edge of a block → removed;
//   • a formatting run between inline content → one space;
//   • plain spaces between inline elements, and anything inside <pre> → kept.

const WS_ONLY = /^[ \t\n\r\f]*$/;
const HAS_FORMATTING_WS = /[\n\r\t\f]/;
const STRUCTURE_ONLY_PARENTS = new Set(['UL', 'OL', 'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'COLGROUP', 'DL', 'SELECT']);
const BLOCKISH_TAGS = new Set([
    ...BLOCK_TAGS, 'TBODY', 'THEAD', 'TFOOT', 'TR', 'TD', 'TH', 'CAPTION',
    'FIGCAPTION', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'NAV', 'MAIN',
    'DL', 'DT', 'DD', 'DETAILS', 'SUMMARY', 'BR', 'IFRAME', 'VIDEO'
]);

function isBlockishNode(node) {
    return !!node && node.nodeType === Node.ELEMENT_NODE && BLOCKISH_TAGS.has(node.tagName);
}

export function normalizeWhitespace(root) {
    if (!root) return root;
    const doc = root.ownerDocument || document;
    const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const texts = [];
    while (walker.nextNode()) texts.push(walker.currentNode);

    texts.forEach(t => {
        const parent = t.parentNode;
        if (!parent) return;
        if (parent.nodeType === Node.ELEMENT_NODE && parent.closest('pre, textarea, code')) {
            // <code> outside <pre> is inline and short; leave it verbatim too.
            return;
        }
        const value = t.data;
        const parentIsBlock = parent === root || isBlockishNode(parent);
        const prev = t.previousSibling;
        const next = t.nextSibling;

        if (WS_ONLY.test(value)) {
            if (isBlockishNode(prev) || isBlockishNode(next) ||
                (parent.nodeType === Node.ELEMENT_NODE && STRUCTURE_ONLY_PARENTS.has(parent.tagName))) {
                t.remove();
                return;
            }
            if (HAS_FORMATTING_WS.test(value)) {
                if (parentIsBlock && (!prev || !next)) {
                    t.remove();
                } else {
                    t.data = ' ';
                }
            }
            return;
        }

        if (!HAS_FORMATTING_WS.test(value)) return;
        let v = value.replace(/[ \t\n\r\f]*[\n\r\t\f][ \t\n\r\f]*/g, ' ');
        if (parentIsBlock && (!prev || isBlockishNode(prev))) v = v.replace(/^ +/, '');
        if (parentIsBlock && (!next || isBlockishNode(next))) v = v.replace(/ +$/, '');
        t.data = v;
    });
    return root;
}
