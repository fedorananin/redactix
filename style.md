# Redactix Output Reference

This is the exhaustive list of every HTML tag and structure that Redactix can produce in its saved output (i.e. what ends up in `textarea.value` after the user types and the editor syncs). Use it as a checklist:

- Make sure your site CSS handles every block / inline form below.
- Make sure your sanitizer / renderer is OK with the attributes used.
- Make sure any JS that processes article HTML (search indexer, RSS exporter, comment renderer, etc.) recognises these structures.

Output is **clean semantic HTML** — Redactix strips its own presentational wrappers (`.redactix-separator` around `<hr>`, `contenteditable` flags on figures, etc.) before writing to the textarea. None of the editor-only classes leak.

---

## Block-level elements

| Element | Output shape | Notes |
|---|---|---|
| Paragraph | `<p>…</p>` | Empty paragraphs serialise as `<p><br></p>`. |
| Headings | `<h1>…</h1>` … `<h3>…</h3>` | Only H1–H3 are reachable from the toolbar / slash menu. H4–H6 can survive a paste but aren't produced natively. |
| Unordered list | `<ul><li>…</li>…</ul>` | `<li>` may contain inline content directly, or nested `<ul>` / `<ol>` for sub-lists. |
| Ordered list | `<ol><li>…</li>…</ol>` | Same nesting rules as `<ul>`. |
| Horizontal rule | `<hr>` | Bare tag, no wrapper. The editor's `.redactix-separator` div is stripped on save. |
| Table | `<table><thead><tr><th>…</th></tr></thead><tbody><tr><td>…</td></tr></tbody></table>` | `colspan` / `rowspan` survive sanitisation; `<colgroup>` is stripped. |
| Image | `<figure><img …><figcaption>…</figcaption></figure>` | See [Images](#images). |
| Photo gallery | `<figure class="redactix-gallery"><div class="redactix-gallery-grid">…imgs…</div><figcaption>…</figcaption></figure>` | See [Photo galleries](#photo-galleries). |
| Quote card | `<figure class="quote-card">…</figure>` (optionally `quote-card big`) | See [Quote cards](#quote-cards). |
| Callout | `<aside class="…" data-emoji="…">…</aside>` | See [Callouts (aside)](#callouts-aside). |
| Embed | `<figure class="redactix-embed" data-provider="…" data-aspect="…">…</figure>` | See [Embeds](#embeds). |
| Native video | `<figure class="redactix-video" data-aspect="…"><video src="…" controls preload="metadata">…</figure>` | Always available — URL inserts work out of the box; provide `videoUploadUrl` for file uploads. See [Native videos](#native-videos). |
| Code block | `<pre><code class="language-…">…</code></pre>` | See [Code blocks](#code-blocks). |

### Allowed children of `<blockquote>` (inside a quote card)

When the user is editing inside a quote-card, Redactix restricts allowed inner blocks to: `<p>`, `<h1>`, `<h2>`, `<h3>`, `<ul>`, `<ol>`. Anything else gets filtered or unwrapped. So your renderer can assume a quote-card's `<blockquote>` only ever contains those.

### Allowed children of `<aside>` (callout)

A callout can contain any block-level content the editor produces *except* nested callouts and quote-cards. In practice you'll see paragraphs, headings, lists, and `<hr>`.

---

## Inline elements

| Tag | Meaning | Notes |
|---|---|---|
| `<b>` | Bold | The **only** bold form in output — pasted `<strong>` is automatically converted to `<b>`. |
| `<i>` | Italic | The only italic form — pasted `<em>` is converted to `<i>`. |
| `<u>` | Underline | |
| `<s>` | Strikethrough | The only strikethrough form — legacy `<strike>` is converted to `<s>`. |
| `<code>` | Inline code | Distinct from the block `<pre><code>` form. |
| `<mark>` | Highlight | |
| `<span class="spoiler">` | Spoiler | Class is the only valid form; `<span>` without `class="spoiler"` is stripped (only `class="spoiler"` is whitelisted on `<span>`). |
| `<a href="…" …>` | Link | Allowed attrs: `href`, `title`, `target`, `rel`, `download`. |
| `<sub>` / `<sup>` | Subscript / superscript | No toolbar button — survive a paste and round-trip through captions, but aren't produced natively. |
| `<br>` | Soft line break | Inside paragraphs and inside `<aside>`/`<figcaption>` text. |

### Link attributes you might see

- `target="_blank"` — opens in new tab. Every `target="_blank"` link the editor produces (link modal, image link, gallery item link) automatically carries `rel="noopener noreferrer"` — tab-jacking protection, don't strip it server-side.
- `rel` is filtered to a whitelist of tokens: `nofollow`, `noopener`, `noreferrer`, `ugc`, `sponsored`, `author`, `external`, `license`, `tag`, `help`, `me`. Typical combinations: `rel="nofollow"`, `rel="nofollow noopener noreferrer"`.
- `title="…"` — tooltip.
- In **lite mode** every link is forced to `rel="nofollow noopener noreferrer"` and `target="_blank"` automatically.

---

## Images

```html
<figure>
  <img src="/uploads/photo.jpg" alt="Description" loading="lazy">
  <figcaption>Optional caption — may contain <a href="…">links</a>, <b>bold</b>, etc.</figcaption>
</figure>
```

The `<figcaption>` is **rich text**, limited to a fixed inline whitelist: `<a>`, `<b>`, `<i>`, `<u>`, `<s>`, `<code>`, `<span class="spoiler">`, `<mark>`, `<sub>`, `<sup>`, `<br>` (entered `<strong>`/`<em>`/`<strike>` are accepted and converted to `<b>`/`<i>`/`<s>`). Anything else entered through the caption field is unwrapped to plain text. Plan for that surface in any renderer that walks captions — it applies to every figcaption (images, galleries, embeds, videos) and to the quote-card author `<span>`.

Possible attributes on `<img>`: `src`, `alt`, `title`, `srcset`, `loading="lazy"`. In lite mode `loading="lazy"` is added automatically.

If the user wraps an image in a link, the link sits **inside** the figure, around the img (note the automatic `noopener noreferrer` on `_blank`):

```html
<figure>
  <a href="https://example.com" target="_blank" rel="nofollow noopener noreferrer">
    <img src="/uploads/photo.jpg" alt="…">
  </a>
  <figcaption>Caption</figcaption>
</figure>
```

### Drop-in CSS

```css
figure {
  margin: 1em 0;
  padding: 0;
  text-align: center;
}
figure > img,
figure > a > img {
  max-width: 100%;
  height: auto;
  border-radius: 4px;
}
figure > figcaption {
  margin-top: 8px;
  font-size: 14px;
  color: #6b7280;
  text-align: center;
}
```

> The selector `figure` also matches `figure.quote-card` and `figure.redactix-embed`. The class-specific rules below override these defaults. Order in your stylesheet doesn't matter — class selectors win on specificity.

---

## Quote cards

There is no standalone `<blockquote>` and no `<cite>`. Every quote is a `<figure class="quote-card">` with an inner `<blockquote>` for the body and an optional `<figcaption>` for the author.

### Default

```html
<figure class="quote-card">
  <blockquote>
    <p>Quote text — multiple paragraphs allowed.</p>
    <p>Plus a second one if you want.</p>
  </blockquote>
</figure>
```

### With author photo and link

```html
<figure class="quote-card">
  <blockquote>
    <p>Quote text.</p>
  </blockquote>
  <figcaption>
    <img src="/uploads/photo.jpg" alt="">
    <span>— <a href="https://author.example">Author Name</a></span>
  </figcaption>
</figure>
```

`<figcaption>` only ever contains an optional `<img>` followed by an optional `<span>`. The `<span>` is rich text (same inline whitelist as figcaptions — see [Images](#images)). There is no dedicated "author link" field — links inside the author name are added by the user via the floating toolbar, so they carry whatever `target`/`rel` the user picked there; the editor does **not** emit `rel="author"` on its own.

### Big preset

The `big` modifier class lives on the outer `<figure>`, **not** on the inner `<blockquote>` — important when scoping CSS:

```html
<figure class="quote-card big">
  <blockquote><p>Pull quote — large, centred, italic.</p></blockquote>
</figure>
```

### User-defined presets

If the editor was initialised with `quotePresets`, those custom classes also land on the outer `<figure>`:

```html
<figure class="quote-card my-pull-quote">
  <blockquote><p>…</p></blockquote>
</figure>
```

Pass `quotePresets: { defaults: false, custom: [...] }` to drop the built-in `big` modifier and replace it with your own. The sanitizer auto-allows your preset classes — no extra setup. See [README → Custom Presets](README.md#custom-presets) for full details.

### Drop-in CSS

```css
figure.quote-card {
  margin: 1em 0;
  padding: 0.6em 1em;
  border-left: 4px solid #2563eb;
  background: #f8fafc;
  color: #4b5563;
  text-align: left;
}
figure.quote-card > blockquote {
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
}
figure.quote-card > blockquote > * { margin: 0.5em 0; }
figure.quote-card > blockquote > *:first-child { margin-top: 0; }
figure.quote-card > blockquote > *:last-child  { margin-bottom: 0; }

figure.quote-card > figcaption {
  margin-top: 0.6em;
  padding-top: 0.6em;
  border-top: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 0.875em;
  color: #6b7280;
}
figure.quote-card > figcaption > img {
  flex: 0 0 auto;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
}
figure.quote-card > figcaption > span { flex: 1 1 auto; min-width: 0; }

/* Big preset */
figure.quote-card.big {
  border-left: none;
  border-top: 3px solid #2563eb;
  border-bottom: 3px solid #2563eb;
  background: transparent;
  padding: 1em;
  text-align: center;
  color: #111827;
}
figure.quote-card.big > blockquote { font-size: 1.5em; font-style: italic; }
figure.quote-card.big > figcaption {
  justify-content: center;
  border-top: none;
  margin-top: 0.8em;
  padding-top: 0;
  font-size: 0.7em;
}
```

---

## Callouts (`<aside>`)

```html
<!-- Default (no class) -->
<aside>Standard callout — neutral grey.</aside>

<!-- Preset class -->
<aside class="warning">Warning callout.</aside>
<aside class="danger">Danger callout.</aside>
<aside class="information">Info callout.</aside>
<aside class="success">Success callout.</aside>

<!-- With emoji prefix -->
<aside data-emoji="💡" class="information">
  <p>Multi-block callout with an emoji.</p>
  <h3>Inner heading</h3>
  <ul><li>Inside a callout</li></ul>
  <hr>
  <p>And another paragraph.</p>
</aside>
```

`<aside>` is a real block container — it can hold paragraphs, headings, lists and `<hr>`. The `data-emoji` attribute holds the literal emoji character(s) and is rendered via `::before` (CSS, no JS).

### Drop-in CSS

```css
aside {
  margin: 1em 0;
  padding: 1em;
  border-radius: 6px;
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  color: #374151;
}
aside > * { margin: 0.5em 0; }
aside > *:first-child { margin-top: 0; }
aside > *:last-child  { margin-bottom: 0; }

/* Presets */
aside.warning     { background: #fef3c7; border-color: #f59e0b; color: #92400e; }
aside.danger      { background: #fee2e2; border-color: #ef4444; color: #991b1b; }
aside.information { background: #dbeafe; border-color: #3b82f6; color: #1e40af; }
aside.success     { background: #dcfce7; border-color: #22c55e; color: #166534; }

/* Emoji prefix rendered from data-emoji */
aside[data-emoji] {
  padding-left: 3.25em;
  position: relative;
}
aside[data-emoji]::before {
  content: attr(data-emoji);
  position: absolute;
  left: 0.75em;
  top: 0.75em;
  font-size: 1.25em;
  line-height: 1;
}

/* HR inside callout uses currentColor so it's visible on tinted bg */
aside hr {
  border: 0;
  border-top: 1px solid currentColor;
  opacity: 0.25;
}
```

### User-defined presets

Custom classes from `calloutPresets` go on the `<aside>` directly:

```html
<aside class="my-tip" data-emoji="🔥">…</aside>
```

```css
aside.my-tip {
  background: #f0f9ff;
  border-color: #0ea5e9;
  color: #075985;
}
```

Pass `calloutPresets: { defaults: false, custom: [...] }` to drop the built-in warning/danger/information/success entries and replace them with your own. The sanitizer auto-allows your preset classes — no extra setup. See [README → Custom Presets](README.md#custom-presets) for full details.

---

## Embeds

All third-party embeds (videos, posts, players) share one shape — `<figure class="redactix-embed">` with provider metadata in `data-*` attributes and a single `<iframe>` inside a `<div class="redactix-embed-frame">`. No external scripts are loaded; everything is plain iframes.

### Aspect-based provider (YouTube, Vimeo, Twitch, Loom, Maps…)

```html
<figure class="redactix-embed" data-provider="youtube" data-aspect="16:9"
        data-source-url="https://www.youtube.com/watch?v=dQw4w9WgXcQ">
  <div class="redactix-embed-frame"
       style="position:relative;width:100%;padding-top:56.25%;overflow:hidden">
    <iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"
            style="position:absolute;top:0;left:0;width:100%;height:100%;border:0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowfullscreen loading="lazy"></iframe>
  </div>
  <figcaption>Optional caption — supports inline formatting.</figcaption>
</figure>
```

### Fixed-height provider (Spotify, Instagram, X/Twitter, TikTok, Reddit, Bluesky, SoundCloud, Bandcamp, Mixcloud, CodePen…)

```html
<figure class="redactix-embed" data-provider="instagram" data-aspect="auto"
        data-source-url="https://www.instagram.com/p/.../">
  <div class="redactix-embed-frame" style="width:100%;height:700px">
    <iframe src="https://www.instagram.com/p/.../embed/"
            style="display:block;width:100%;height:100%;border:0"
            sandbox="allow-popups allow-popups-to-escape-sandbox allow-scripts allow-same-origin"
            loading="lazy"></iframe>
  </div>
</figure>
```

The initial frame height comes from the provider's default (e.g. 700px for Instagram) and is written inline; the optional [auto-resize runtime](#optional-auto-resize-runtime) then adjusts it to the real content height. A legacy `data-height` attribute may exist in HTML saved by old versions — current versions strip it on save.

### Custom HTML embed (LinkedIn, Facebook, niche services)

The user pastes raw iframe HTML; the editor strips everything except the `<iframe>`, requires `https://` src, and wraps it in the same shape:

```html
<figure class="redactix-embed" data-provider="custom" data-aspect="auto">
  <div class="redactix-embed-frame" style="width:100%;height:500px">
    <iframe src="https://…" style="display:block;width:100%;height:100%;border:0"
            allowfullscreen></iframe>
  </div>
</figure>
```

(For custom embeds the height comes from the pasted iframe's `height` attribute when present, otherwise 500px. Whitelisted iframe attributes: `src`, `width`, `height`, `allow`, `allowfullscreen`, `frameborder`, `scrolling`, `title`, `loading`, `referrerpolicy`, `sandbox`.)

### Layout is self-contained

All critical layout (frame `position`/`width`/`overflow`/aspect-ratio padding-top **or** fixed height, plus iframe `position:absolute`/`top`/`left`/`width:100%`/`height:100%`/`border:0`) is written **inline** by the editor. The production site renders embeds correctly **without `Redactix.css`** — only cosmetics (margins, max-width per provider, border-radius) are optional CSS on your end.

### Drop-in CSS (cosmetics only)

```css
figure.redactix-embed { margin: 1em 0; text-align: center; }
figure.redactix-embed .redactix-embed-frame {
  border-radius: 8px;
  overflow: hidden;
}

/* Per-provider max-width — social posts read better in a narrow column */
figure.redactix-embed[data-provider="instagram"] { max-width: 540px; margin-inline: auto; }
figure.redactix-embed[data-provider="twitter"]   { max-width: 550px; margin-inline: auto; }
figure.redactix-embed[data-provider="tiktok"]    { max-width: 325px; margin-inline: auto; }
figure.redactix-embed[data-provider="spotify"]   { max-width: 700px; margin-inline: auto; }
figure.redactix-embed[data-provider="bluesky"],
figure.redactix-embed[data-provider="reddit"],
figure.redactix-embed[data-provider="bandcamp"],
figure.redactix-embed[data-provider="mixcloud"]  { max-width: 600px; margin-inline: auto; }

figure.redactix-embed > figcaption {
  margin-top: 8px;
  font-size: 14px;
  color: #6b7280;
  text-align: center;
}
```

## Photo galleries

```html
<figure class="redactix-gallery">
  <div class="redactix-gallery-grid">
    <img src="/uploads/a.jpg" alt="">
    <a href="https://example.com" target="_blank" rel="nofollow noopener noreferrer">
      <img src="/uploads/b.jpg" alt="">
    </a>
    <img src="/uploads/c.jpg" alt="">
  </div>
  <figcaption>Optional shared caption — supports inline formatting.</figcaption>
</figure>
```

The inner `<div class="redactix-gallery-grid">` wraps the image list so the `<figcaption>` is unambiguously separate. Each direct child of the grid is either a bare `<img>` or `<a><img></a>` — mixing both shapes in the same gallery is fine.

Per-image attributes are the same as single images: `src`, `alt`, `title`. Per-image link attributes: `href`, optional `target="_blank"`, `rel` — `nofollow` if ticked, plus automatic `noopener noreferrer` whenever `target="_blank"` is set. The `figcaption` is rich text (same inline whitelist as image captions).

### Drop-in CSS

The editor renders the gallery as a flex row where every image keeps its native aspect ratio at a uniform 200px height — wide panoramas take more width, verticals take less, rows wrap when they run out of space. The simplest production CSS just mirrors that:

```css
figure.redactix-gallery {
  margin: 1em 0;
}
figure.redactix-gallery > .redactix-gallery-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
figure.redactix-gallery > .redactix-gallery-grid > img,
figure.redactix-gallery > .redactix-gallery-grid > a {
  display: block;
  height: 220px;
  width: auto;
  max-width: 100%;
  margin: 0;
  border-radius: 4px;
}
figure.redactix-gallery > .redactix-gallery-grid > a > img {
  display: block;
  height: 100%;
  width: auto;
  max-width: 100%;
  border-radius: 4px;
}
figure.redactix-gallery > figcaption {
  margin-top: 8px;
  font-size: 14px;
  color: #6b7280;
  text-align: center;
}
```

If you want strict equal-width tiles instead, swap the flex declaration for `display: grid; grid-template-columns: repeat(3, 1fr)` plus `width: 100%; height: 220px; object-fit: cover` on the imgs. For a masonry look, switch to CSS columns (`column-count: 3`) and drop the height/object-fit rules.

---

## Native videos

Same on/off contract as images: the `/video` command is always available; URL inserts work without any extra config; file upload + a "choose from already uploaded" panel light up only when `videoUploadUrl` (and optionally `videoBrowseUrl`) are passed to the editor. The shape is a real HTML5 `<video>`, not an iframe:

```html
<figure class="redactix-video" data-aspect="16:9">
  <video src="/uploads/clip.mp4" controls preload="metadata"
         style="aspect-ratio:16 / 9"></video>
  <figcaption>Optional caption</figcaption>
</figure>
```

For `data-aspect="auto"` no inline `style` is set — the video uses its natural dimensions. The other shapes (`16:9`, `4:3`, `1:1`, `9:16`) emit a single inline `aspect-ratio:…` declaration so the player keeps its shape without any CSS on your end.

Allowed attributes on `<video>` are intentionally narrow: `src`, `controls`, `preload="metadata"`, optional `style="aspect-ratio:…"`. No `autoplay`, no `muted`, no `loop`, no `poster` — they're stripped on paste. Same for the `<figure>`: only the `redactix-video` class and `data-aspect` attribute survive.

### Drop-in CSS

Editor scope (inside `Redactix.css`) caps the video at 450px tall so vertical clips don't dominate the editor. On your site there's no such cap — pick whatever feels right:

```css
figure.redactix-video {
  margin: 1em 0;
  text-align: center;
}
figure.redactix-video > video {
  max-width: 100%;
  border-radius: 4px;
  background: #000;
  /* aspect-ratio comes inline from the editor */
}
figure.redactix-video > figcaption {
  margin-top: 8px;
  font-size: 14px;
  color: #6b7280;
  text-align: center;
}
```

If you'd rather force every video into a full-width landscape frame, override the inline aspect with `aspect-ratio: 16 / 9 !important` (the only legitimate use of `!important` here is the inline-style override).

### Optional auto-resize runtime

Instagram, X (Twitter), TikTok, Reddit and Bluesky iframes `postMessage` their actual content height. Without a runtime they stay at the editor's initial height guess; with it the frame matches real content as soon as the iframe loads. Tiny IIFE, no dependencies, no third-party requests:

```html
<script src="/redactix/embed-runtime.js" defer></script>
```

Skip it if your articles only contain video embeds (YouTube / Vimeo / Twitch / Loom / Maps) — those use aspect-ratio and don't need the runtime.

If you want to add support for a new provider that posts size messages, edit `parseResizeMessage` in **both** `redactix/modules/Embed.js` (so the editor matches) and `redactix/embed-runtime.js` (so prod matches).

---

## Code blocks

```html
<pre><code class="language-javascript">function greet(name) {
    console.log(`Hello, ${name}!`);
}</code></pre>
```

The `class="language-…"` lives on the inner `<code>`. Common values produced by the editor: `language-javascript`, `language-typescript`, `language-python`, `language-html`, `language-css`, `language-bash`, `language-json`, `language-sql`, plus whatever else the user picks from the modal. If no language is selected, the class may be absent.

The editor itself does not syntax-highlight — it just preserves the language tag. Plug in your own highlighter on the production side.

### With Prism.js

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/prismjs@1/themes/prism-tomorrow.min.css">
<script src="https://cdn.jsdelivr.net/npm/prismjs@1/components/prism-core.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/prismjs@1/plugins/autoloader/prism-autoloader.min.js"></script>
```

Prism auto-detects the `language-*` class on `<code>` and highlights on page load.

### With highlight.js

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/highlight.js@11/styles/atom-one-dark.min.css">
<script src="https://cdn.jsdelivr.net/npm/highlight.js@11/lib/common.min.js"></script>
<script>hljs.highlightAll();</script>
```

### Drop-in fallback CSS (no highlighter)

```css
pre {
  margin: 1em 0;
  padding: 1em;
  background: #1f2937;
  color: #e5e7eb;
  border-radius: 6px;
  overflow-x: auto;
  font-size: 0.9em;
  line-height: 1.5;
}
pre > code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  background: none;
  padding: 0;
  color: inherit;
}
```

---

## Spoilers

```html
<p>Plot point: <span class="spoiler">the butler did it</span>.</p>
```

The editor emits the markup but **adds no JS behaviour** — on production you decide whether spoilers are click-to-reveal, hover-to-reveal, or always visible.

### Click-to-reveal (CSS + JS)

```css
span.spoiler {
  background: #1f2937;
  color: #1f2937; /* hides the text by matching bg */
  border-radius: 3px;
  padding: 0 4px;
  cursor: pointer;
  transition: color 0.2s;
}
span.spoiler.is-revealed { color: #f3f4f6; }
```

```html
<script>
document.addEventListener('click', (e) => {
  const sp = e.target.closest('span.spoiler');
  if (sp) sp.classList.toggle('is-revealed');
});
</script>
```

### Hover-to-reveal (CSS only)

```css
span.spoiler {
  background: #1f2937;
  color: #1f2937;
  border-radius: 3px;
  padding: 0 4px;
  transition: color 0.2s;
}
span.spoiler:hover,
span.spoiler:focus { color: #f3f4f6; }
```

---

## Inline code, marks

```html
<p>Use <code>git status</code> to inspect the working tree.</p>
<p>The deadline is <mark>March 5</mark>.</p>
```

Drop-in CSS:

```css
code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  background: #f3f4f6;
  color: #e11d48;
  padding: 0.15em 0.4em;
  border-radius: 3px;
  font-size: 0.9em;
}
mark {
  background: #fef08a;
  color: inherit;
  padding: 0.1em 0.3em;
  border-radius: 2px;
}
```

(Note that `code` inside `pre` should reset these — the snippet in [Code blocks](#code-blocks) above does that.)

---

## Tables

```html
<table>
  <thead>
    <tr><th>Header</th><th>Other header</th></tr>
  </thead>
  <tbody>
    <tr><td>Cell</td><td colspan="1" rowspan="1">Cell</td></tr>
    <tr><td>Cell</td><td>Cell</td></tr>
  </tbody>
</table>
```

`colspan` / `rowspan` are preserved. `<colgroup>` is stripped. No table classes are produced.

### Drop-in CSS

```css
table {
  width: 100%;
  border-collapse: collapse;
  margin: 1em 0;
}
table th,
table td {
  border: 1px solid #e5e7eb;
  padding: 8px 12px;
  text-align: left;
  vertical-align: top;
}
table th {
  background: #f9fafb;
  font-weight: 600;
}
table tbody tr:hover { background: #f9fafb; }
```

---

## Anchors & custom attributes (Attributes dialog)

Outside of lite mode, the block menu (⋮⋮ → ⚙ Attributes) lets the user set two things on **any** block element — and both land in the saved output:

```html
<h2 id="installation">Installation</h2>
<p class="lead intro-note">Custom-classed paragraph.</p>
```

- **`id`** — anchor for in-page links (`#installation`). The editor slugifies the value to `a-z0-9-_` (lowercase, spaces → dashes), so ids are always URL-safe.
- **`class`** — free-form classes typed by the user (or picked from the `classes` quick-select list passed to the constructor). Unlike pasted content, classes set through this dialog are **not** filtered against the whitelist — they're an intentional authoring feature.

Implications for your site:

- If you sanitise on the server, allow `id` and `class` on block elements — or strip them knowingly.
- In-page anchor links (`<a href="#installation">`) are valid output; make sure your renderer doesn't rewrite them.

---

## Sanitiser cheat-sheet

What survives a paste from the outside world (Google Docs, Word, websites):

- **Tags kept:** all of the above. Synonym tags are normalised to one canonical form everywhere (paste, content load, HTML mode, save): `<strong>`→`<b>`, `<em>`→`<i>`, `<strike>`→`<s>` — saved output only ever contains the short forms.
- **Tags stripped:** `<script>`, `<style>`, `<object>`, `<embed>`, `<form>`, `<input>`, `<button>`, `<meta>`, `<colgroup>`. `<iframe>` is stripped **unless** its `src` matches a registered embed provider, in which case it's kept and wrapped in a `figure.redactix-embed`. `<video>` is stripped **unless** it already sits inside a `figure.redactix-video` (i.e. saved Redactix output being pasted back) — and then only `src`, `controls`, `preload` and an `aspect-ratio` inline style survive.
- **Attributes kept globally:** `href`, `src`, `alt`, `title`, `colspan`, `rowspan`, `download`, plus `rel` / `target` on `<a>` — both filtered through whitelists (`rel` → the token list above, `target` → `_blank`/`_self`/`_parent`/`_top`; `target="_blank"` automatically gains `noopener noreferrer`).
- **Attributes stripped:** `style` (except the video `aspect-ratio` case above), event handlers, every other attribute not in the whitelist.
- **URL schemes:** `href`/`src` must be `http(s)`, `mailto`, `tel` or relative; `<img src>` additionally accepts raster `data:image/*` (never `data:image/svg+xml`). `javascript:`, `data:text/html`, `vbscript:` etc. are stripped, including entity-encoded and control-character-obfuscated variants.
- **Classes whitelisted:** `spoiler`, `quote-card`, `redactix-embed`, `redactix-embed-frame`, `redactix-video`, `redactix-gallery`, `redactix-gallery-grid` — always. Plus the classes of every active preset in `calloutPresets` / `quotePresets` (defaults: `warning`, `danger`, `information`, `success`, `big` — disable with `{ defaults: false }`). Any other class is silently dropped on paste.
- **`data-emoji`** is allowed only on `<aside>`. **`data-provider`** / **`data-aspect`** / **`data-source-url`** (and legacy `data-height`, stripped again on save) are allowed only on `<figure class="redactix-embed">`. **`data-aspect`** is also allowed on `<figure class="redactix-video">`.
- **Modal inputs go through the same sanitisation** — URLs typed into the image / gallery / video / link dialogs are scheme-checked, and caption / author-name fields are filtered to the inline whitelist. There is no path around the sanitiser from inside the editor UI.

So your renderer only ever sees a small, predictable surface.

---

## Quick checklist for site setup

- [ ] CSS for `figure` (images), `figure.redactix-gallery`, `figure.quote-card`, `figure.redactix-embed`, `figure.redactix-video`, `aside` (+ presets + `data-emoji`).
- [ ] CSS for `code`, `pre > code`, `mark`, `span.spoiler`.
- [ ] CSS for `table` (borders, hover).
- [ ] If your articles use Instagram / X / TikTok / Reddit / Bluesky embeds, include `redactix/embed-runtime.js`.
- [ ] If you want syntax highlighting in code blocks, plug in Prism or highlight.js — they read the `language-*` class automatically.
- [ ] If you want spoilers click-to-reveal, ship the 3-line listener above.
- [ ] If you sanitise on the server, allow the tag/attr surface listed in [Sanitiser cheat-sheet](#sanitiser-cheat-sheet) — including `id` / `class` on blocks if your authors use the Attributes dialog.
