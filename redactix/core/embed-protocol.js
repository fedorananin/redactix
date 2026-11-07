// Embed runtime protocol — the bits shared by the editor (modules/Embed.js)
// and the production-side runtime (redactix/embed-runtime.js).
//
// embed-runtime.js is a standalone IIFE that host sites include without ES
// modules, so it carries its OWN copy of everything below. Keep the two in
// sync: tests/cases/media.js loads the runtime and checks that both parsers
// return the same result for a set of sample messages.

/** Heights outside this range are ignored (below) or clamped (above). */
export const RESIZE_MIN = 50;
export const RESIZE_MAX = 5000;

/**
 * Origins allowed to resize an embed of a given provider. A message from
 * any other origin is ignored — without this check any frame on the page
 * (an ad, another widget) could post a fake "resize" and stretch an embed.
 */
export const RESIZE_ORIGINS = {
    instagram: ['https://www.instagram.com', 'https://instagram.com'],
    twitter: ['https://platform.twitter.com', 'https://platform.x.com'],
    tiktok: ['https://www.tiktok.com'],
    reddit: ['https://www.redditmedia.com', 'https://embed.reddit.com'],
    bluesky: ['https://embed.bsky.app']
};

const ALL_ORIGINS = new Set(Object.values(RESIZE_ORIGINS).flat());

/** Is `origin` allowed to resize embeds of `provider`? */
export function isResizeOrigin(provider, origin) {
    const list = Object.prototype.hasOwnProperty.call(RESIZE_ORIGINS, provider) ? RESIZE_ORIGINS[provider] : null;
    return !!list && list.includes(origin);
}

/** Cheap pre-filter: could a message from `origin` be a resize at all? */
export function isKnownResizeOrigin(origin) {
    return ALL_ORIGINS.has(origin);
}

function toHeight(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < RESIZE_MIN) return null;
    return Math.min(Math.round(n), RESIZE_MAX);
}

/**
 * Provider-specific decoder for a postMessage payload asking the host to
 * resize the embed. Returns the height in px (clamped) or null.
 */
export function parseResizeMessage(provider, raw) {
    let data = raw;
    if (typeof raw === 'string') {
        // Resize messages are tiny; don't JSON.parse megabytes of someone
        // else's chatter.
        if (raw.length > 10000) return null;
        try { data = JSON.parse(raw); } catch (e) { return null; }
    }
    if (!data || typeof data !== 'object') return null;

    switch (provider) {
        case 'instagram':
            // {"type":"MEASURE","details":{"height":N,"width":N}}
            if (data.type === 'MEASURE' && data.details && typeof data.details === 'object') {
                return toHeight(data.details.height);
            }
            return null;
        case 'twitter':
            // {"method":"twttr.private.resize","params":[{"height":N,"width":N,...}]}
            if (data.method === 'twttr.private.resize' &&
                Array.isArray(data.params) && data.params[0] && typeof data.params[0] === 'object') {
                return toHeight(data.params[0].height);
            }
            return null;
        case 'tiktok':
            // {"src":"...","type":"...","frameHeight":N}
            if (data.frameHeight != null) return toHeight(data.frameHeight);
            if (data.height != null && /tiktok/i.test(String(data.type || data.src || ''))) return toHeight(data.height);
            return null;
        case 'reddit':
            // {"type":"embed-resize","height":N,"id":"..."}
            if (data.type === 'embed-resize') return toHeight(data.height);
            return null;
        case 'bluesky':
            // {"id":"...","height":N}
            if (data.id != null && data.height != null) return toHeight(data.height);
            return null;
        default:
            return null;
    }
}

/** Origin check + payload decode in one call. */
export function resolveResize(provider, origin, raw) {
    if (!isResizeOrigin(provider, origin)) return null;
    return parseResizeMessage(provider, raw);
}

/**
 * Twitch refuses to play unless every embedding host is listed in a
 * `parent=` query parameter. The host that renders the embed (production
 * site) is generally not the host where it was written (admin panel), so the
 * parent can't be frozen at edit time: both the editor and embed-runtime.js
 * append the CURRENT hostname when it's missing. Returns the (possibly)
 * updated src, or null when `src` isn't a Twitch player URL.
 */
export function withTwitchParent(src, hostname) {
    let url;
    try { url = new URL(src); } catch (e) { return null; }
    if (!/(^|\.)twitch\.tv$/i.test(url.hostname)) return null;
    const host = hostname || 'localhost';
    if (url.searchParams.getAll('parent').includes(host)) return src;
    url.searchParams.append('parent', host);
    return url.toString();
}
