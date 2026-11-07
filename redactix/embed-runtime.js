/**
 * Redactix embed runtime (~4KB of code, ~1.5KB gzipped, no dependencies).
 *
 * 1. Auto-resizes <figure class="redactix-embed"> blocks based on
 *    postMessage events sent by Instagram, Twitter/X, TikTok, Reddit and
 *    Bluesky embed iframes. Layout itself comes from the inline styles the
 *    editor writes into the saved HTML — this script only updates the
 *    height live. Messages are accepted only from each provider's own
 *    origin, and heights are clamped to 50..5000px.
 * 2. Adds the current hostname to Twitch embeds' `parent=` parameter.
 *    Twitch refuses to play on hosts not listed there, and the editor can
 *    only know the host the article was WRITTEN on (the admin panel).
 *
 * Without this script:
 *   - Aspect-ratio embeds (YouTube, Vimeo, Loom, Maps, …) work fine —
 *     their layout is self-contained inline CSS in the saved HTML.
 *   - Pixel-height embeds (Instagram, Twitter, TikTok, Reddit, Bluesky)
 *     stay at the editor-side height. If the actual content is taller,
 *     the iframe scrolls or clips internally.
 *   - Twitch embeds play only if the site's host equals the editor's host.
 *
 * Usage:
 *   <script src="/redactix/embed-runtime.js" defer></script>
 * Content added later (infinite scroll, SPA navigation) — call
 * window.RedactixEmbedRuntime.refresh() after inserting it.
 *
 * No CSP changes required — only listens for window message events.
 *
 * KEEP IN SYNC with redactix/core/embed-protocol.js (the editor's copy of
 * the same parser); tests/cases/media.js checks that both agree.
 */
(function () {
    'use strict';

    var RESIZE_MIN = 50;
    var RESIZE_MAX = 5000;
    var RESIZE_ORIGINS = {
        instagram: ['https://www.instagram.com', 'https://instagram.com'],
        twitter: ['https://platform.twitter.com', 'https://platform.x.com'],
        tiktok: ['https://www.tiktok.com'],
        reddit: ['https://www.redditmedia.com', 'https://embed.reddit.com'],
        bluesky: ['https://embed.bsky.app']
    };
    var SELECTOR = 'figure.redactix-embed > .redactix-embed-frame > iframe';

    function isResizeOrigin(provider, origin) {
        var list = Object.prototype.hasOwnProperty.call(RESIZE_ORIGINS, provider) ? RESIZE_ORIGINS[provider] : null;
        return !!list && list.indexOf(origin) !== -1;
    }

    function isKnownResizeOrigin(origin) {
        for (var key in RESIZE_ORIGINS) {
            if (Object.prototype.hasOwnProperty.call(RESIZE_ORIGINS, key) &&
                RESIZE_ORIGINS[key].indexOf(origin) !== -1) return true;
        }
        return false;
    }

    function toHeight(value) {
        var n = Number(value);
        if (!isFinite(n) || n < RESIZE_MIN) return null;
        return Math.min(Math.round(n), RESIZE_MAX);
    }

    function parseResizeMessage(provider, raw) {
        var data = raw;
        if (typeof raw === 'string') {
            if (raw.length > 10000) return null;
            try { data = JSON.parse(raw); } catch (e) { return null; }
        }
        if (!data || typeof data !== 'object') return null;

        switch (provider) {
            case 'instagram':
                if (data.type === 'MEASURE' && data.details && typeof data.details === 'object') {
                    return toHeight(data.details.height);
                }
                return null;
            case 'twitter':
                if (data.method === 'twttr.private.resize' &&
                    Array.isArray(data.params) && data.params[0] && typeof data.params[0] === 'object') {
                    return toHeight(data.params[0].height);
                }
                return null;
            case 'tiktok':
                if (data.frameHeight != null) return toHeight(data.frameHeight);
                if (data.height != null && /tiktok/i.test(String(data.type || data.src || ''))) return toHeight(data.height);
                return null;
            case 'reddit':
                if (data.type === 'embed-resize') return toHeight(data.height);
                return null;
            case 'bluesky':
                if (data.id != null && data.height != null) return toHeight(data.height);
                return null;
            default:
                return null;
        }
    }

    // contentWindow → iframe. Rebuilt lazily on a miss instead of scanning
    // every embed on every message.
    var cache = typeof WeakMap === 'function' ? new WeakMap() : null;

    function findIframe(source) {
        if (!source) return null;
        var hit = cache ? cache.get(source) : null;
        if (hit && hit.isConnected && hit.contentWindow === source) return hit;
        var iframes = document.querySelectorAll(SELECTOR);
        for (var i = 0; i < iframes.length; i++) {
            if (iframes[i].contentWindow === source) {
                if (cache) cache.set(source, iframes[i]);
                return iframes[i];
            }
        }
        return null;
    }

    window.addEventListener('message', function (e) {
        // Cheap bail-outs before touching the DOM: unknown origin, or a
        // payload that can't be a resize message.
        if (!isKnownResizeOrigin(e.origin)) return;
        var data = e.data;
        if (data === null || (typeof data !== 'string' && typeof data !== 'object')) return;

        var iframe = findIframe(e.source);
        if (!iframe) return;
        var frame = iframe.parentElement;
        var figure = frame.parentElement;
        var provider = figure.getAttribute('data-provider') || '';
        if (!isResizeOrigin(provider, e.origin)) return;

        var height = parseResizeMessage(provider, data);
        if (height === null) return;
        var px = height + 'px';
        if (frame.style.height !== px) frame.style.height = px;
    });

    function withTwitchParent(src, hostname) {
        var url;
        try { url = new URL(src); } catch (e) { return null; }
        if (!/(^|\.)twitch\.tv$/i.test(url.hostname)) return null;
        var host = hostname || 'localhost';
        if (url.searchParams.getAll('parent').indexOf(host) !== -1) return src;
        url.searchParams.append('parent', host);
        return url.toString();
    }

    function refresh() {
        var iframes = document.querySelectorAll('figure.redactix-embed[data-provider="twitch"] > .redactix-embed-frame > iframe');
        for (var i = 0; i < iframes.length; i++) {
            var src = iframes[i].getAttribute('src') || '';
            var fixed = withTwitchParent(src, location.hostname);
            if (fixed && fixed !== src) iframes[i].setAttribute('src', fixed);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', refresh);
    } else {
        refresh();
    }

    window.RedactixEmbedRuntime = {
        refresh: refresh,
        parseResizeMessage: parseResizeMessage,
        isResizeOrigin: isResizeOrigin
    };
}());
