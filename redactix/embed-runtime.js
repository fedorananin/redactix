/**
 * Redactix embed runtime (~1KB, no dependencies).
 *
 * Auto-resizes <figure class="redactix-embed"> blocks based on postMessage
 * events sent by Instagram, Twitter/X, TikTok, Reddit and Bluesky embed
 * iframes. Layout itself comes from the inline styles the editor writes
 * into the saved HTML — this script only updates the height live.
 *
 * Without this script:
 *   - Aspect-ratio embeds (YouTube, Vimeo, Twitch, Loom, Maps, …) work
 *     fine — their layout is self-contained inline CSS in the saved HTML.
 *   - Pixel-height embeds (Instagram, Twitter, TikTok, Reddit, Bluesky)
 *     stay at the editor-side default height. If the actual content is
 *     taller, the iframe scrolls or clips internally.
 *
 * With this script:
 *   - Pixel-height embeds resize to fit current content (e.g. Instagram
 *     reel updated, Twitter thread expanded, TikTok rotated).
 *
 * Optional. Only worth including if you display social embeds.
 *
 * Usage:
 *   <script src="/redactix/embed-runtime.js" defer></script>
 *
 * No CSP changes required — only listens for window message events.
 */
(function () {
    'use strict';

    function parseResizeMessage(provider, raw) {
        var data = raw;
        if (typeof raw === 'string') {
            try { data = JSON.parse(raw); } catch (e) { return null; }
        }
        if (!data || typeof data !== 'object') return null;

        switch (provider) {
            case 'instagram':
                if (data.type === 'MEASURE' && data.details && data.details.height) {
                    return data.details.height;
                }
                return null;
            case 'twitter':
                if (data.method === 'twttr.private.resize' &&
                    Array.isArray(data.params) && data.params[0] && data.params[0].height) {
                    return data.params[0].height;
                }
                return null;
            case 'tiktok':
                if (data.frameHeight) return data.frameHeight;
                if (data.height && /tiktok/i.test(data.type || data.src || '')) return data.height;
                return null;
            case 'reddit':
                if (data.type === 'embed-resize' && data.height) return data.height;
                return null;
            case 'bluesky':
                if (data.height && data.id) return data.height;
                return null;
            default:
                return null;
        }
    }

    window.addEventListener('message', function (e) {
        var iframes = document.querySelectorAll(
            'figure.redactix-embed > .redactix-embed-frame > iframe'
        );
        for (var i = 0; i < iframes.length; i++) {
            var iframe = iframes[i];
            if (iframe.contentWindow !== e.source) continue;
            var figure = iframe.closest('figure.redactix-embed');
            if (!figure) return;
            var provider = figure.getAttribute('data-provider') || '';
            var height = parseResizeMessage(provider, e.data);
            if (height && height > 50) {
                var px = height + 'px';
                if (iframe.parentElement.style.height !== px) {
                    iframe.parentElement.style.height = px;
                }
            }
            return;
        }
    });
}());
