# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Redactix is a zero-dependency, vanilla-JavaScript WYSIWYG editor distributed as native ES Modules. There is **no build system, no package manager and no transpilation** — files are served directly to the browser. A zero-dependency regression suite lives in [tests/](tests/) (see Testing). The repo is set up as an OpenServer document root; opening [index.html](index.html) in a browser via the local web server (or any static server pointed at this directory) is how you "run" the project. Image and (opt-in) native video upload/browse/delete relies on two PHP scripts at the repo root.

## Architecture

The editor wraps a `<textarea>` with a contenteditable `<div>` and keeps the textarea synced so any backend that already reads `<textarea>.value` works unchanged.

### Boot flow ([redactix/Redactix.js](redactix/Redactix.js))

1. `new Redactix({ selector, ... })` finds matching textareas.
2. For each textarea it constructs a `RedactixInstance`, which:
   - Builds a `.redactix-wrapper` containing `Toolbar` + `.redactix-editor` (contenteditable).
   - Hides the original textarea and exposes the instance back on the DOM node as `textarea.redactix` (this is the public API surface — `getContent()`, `setContent()`, `sync()`, `setTheme()`, `destroy()`).
   - Instantiates `Editor` (core editing/paste/structure logic), `Selection`, `Modal`, then constructs every module from `modulesConfig`, registers it under its `static moduleName`, and only then calls `init()` on each (so any module can look up any other from `init()`).
   - Asks the toolbar to gather buttons from each module via `module.getButtons()`.
   - Runs `setupContent()` once, writes the normalised value to the textarea **silently** (no input/change on load) and resets History.

The `modulesConfig` array in the `Redactix` constructor ([Redactix.js](redactix/Redactix.js)) is the registration point for modules. `History` is first so its observer sees every later module's changes.

**Module lookup:** `instance.getModule('Image')` / `this.getModule('Image')`, keyed by `static moduleName = 'Image'` on each class. Never use `constructor.name` — a host bundler that minifies class names would silently break every lookup.

**Events:** `instance.on(name, cb)` (returns unsubscribe) / `instance.emit(name, …)`. Emitted by core: `contentSetup` (root) after every setup pass, `contentReplaced` after setContent / undo / redo / HTML-mode return (the whole DOM was swapped — drop references to old nodes), `contentInserted` ({ source: 'paste' | 'drop' }), `themeChanged`.

### Teardown (listener registry + destroy)

Modules must register `document`/`window` listeners via `instance.listen(target, type, handler, options)` and other persistent resources (MutationObservers, `<body>` portals like the BlockControl menu, timers, in-flight uploads) via `instance.onDestroy(cb)`. Gesture-scoped listeners (a drag in progress) may be added directly as long as they are removed on gesture end AND from an `onDestroy` callback. `RedactixInstance.destroy()` first flushes the pending sync (the last keystrokes reach the textarea), then removes every registered listener, runs the cleanups, removes the wrapper, and un-hides the original textarea (which can then be re-initialized). Listeners on elements inside the wrapper don't need registration — they die with `wrapper.remove()`. **If you add a module with a global listener, route it through `instance.listen`.**

### Module system ([redactix/core/Module.js](redactix/core/Module.js))

Every feature is a class extending `Module`. A module receives the `RedactixInstance` and can:
- Access the contenteditable via `this.instance.editorEl` and the core editor via `this.editor` / `this.instance.core`.
- Read config via `this.instance.config` (this includes `liteMode`, `uploadUrl`, `browseUrl`, `videoUploadUrl`, `videoBrowseUrl`, `allowVideoDelete`, `calloutPresets`, `quotePresets`, `predefinedClasses`, `maxHeight`, `theme`, `gapInsertHandle`, `i18n`).
- Return toolbar buttons from `getButtons()` (`{ name, icon, title, action, active? }`).
- Translate strings via `this.t('namespace.key')`.
- Override `hideUI(reason)` if the module renders floating overlays positioned over the editor (block handles, gap "+", menus, panels). `instance.hideAllUI(reason)` calls it on every module when HTML mode hides the visual editor, and with `reason === 'contentReplaced'` after any wholesale content swap (overlays must never keep acting on detached nodes; guard with `editorEl.contains(node)`).
- Implement optional **content-lifecycle hooks** (the core calls them on every module that defines them, so the core never needs to know about individual block types):
  - `setupContent(root)` — idempotent migrate + wiring of the live DOM (contenteditable flags, edit buttons …).
  - `cleanForSync(clone)` — strip presentational markup from the detached clone that becomes `textarea.value`.
  - `ownsFigure(figure)` — true if the module manages that `<figure>`, so the generic image-figure logic skips it.
  - `preparePaste(root, ctx)` — runs on the inert pasted tree before the tag/attribute sweep; put elements that must survive the sweep into `ctx.keep`.
  - getters `pasteAllowedClasses` (array) / `pasteAllowedAttributes` (`[{ selector, attrs }]`).
  - `getContentOverride()` — return a string to save instead of the visual editor (HtmlMode while the code view is open).
  - `getBlockMenuItems(block)` — contribute sections to the BlockControl menu (Callout, QuoteCard).

To add a new feature: create a file in [redactix/modules/](redactix/modules/), extend `Module`, set `static moduleName`, then add the class to the `modulesConfig` array in [Redactix.js](redactix/Redactix.js).

### Undo / redo and transactions ([History.js](redactix/modules/History.js))

States are **clean serialisations** (`instance.serializeClean()`) plus a caret path; restoring goes through `instance.replaceContent(html, { sanitize: false })`, i.e. the normal setup pipeline. A MutationObserver records any DOM change (300 ms debounce), and `undo()` first commits anything pending — so typing followed by Ctrl+Z never skips a step. History is bounded by total size (base64 images can make snapshots huge), not by count alone.

**Every programmatic DOM change a user would undo as a unit goes through `instance.transact(fn)` / `this.transact(fn)`**: it commits pending typing, runs `fn`, records the result as one step and syncs. Nested calls collapse. Multi-event gestures (block drag) use `history.beginBatch()` … `history.endBatch()` — start the batch only when the gesture really starts and end it on every exit path.

### Block schema, layers, popovers, forms

- [core/schema.js](redactix/core/schema.js) is the **single source of truth for block structure**: which containers exist (callout `<aside>`, quote-card `<blockquote>`) and which children they allow, `findHostChild` / `findInsertionPoint` / `getEditingContext` / `canInsertBlockAt` / `normalizeContainerChildren`. Slash commands, Markdown, toolbar inserts (`Selection.insertNode`), paste, drag & drop, BlockGap and the container normalisers all consult it — never hand-write tag lists in a module.
- [core/layers.js](redactix/core/layers.js) — `pushEscapeLayer(handler, { scope })`: every "Escape closes X" (modal, fullscreen, find panel, menus) registers here while open; only the topmost matching layer handles the key.
- [ui/popover.js](redactix/ui/popover.js) — `placePopover()` (position:fixed, flip + viewport clamp — never clipped by the wrapper's `overflow`), `getSelectionRect()`, `mirrorTheme()` for elements portaled to `<body>`.
- [ui/form-helpers.js](redactix/ui/form-helpers.js) — `inputGroup`, `textareaGroup`, `selectGroup`, `checkbox`, `linkFields`, `statusLine`, `SPINNER_SVG` for modal forms. Styling lives in CSS, not inline.
- [ui/Modal.js](redactix/ui/Modal.js) — buttons are `type="button"` (the editor usually sits inside the host's `<form>`), Enter in a single-line input saves, `onSave` may return `false` (or `Promise<false>`) to keep the modal open — use it with an inline `statusLine` for validation errors. Pass `onClose` to `open()`; to react to a modal another module opened, use `modal.addCloseListener(cb)`.

URL / rel / target / inline-HTML sanitisation is centralised in [redactix/core/dom-utils.js](redactix/core/dom-utils.js) (`sanitizeUrl`, `sanitizeImageSrc`, `sanitizeSrcset`, `sanitizeIframeSrc` / `sanitizeIframeAllow` / `sanitizeIframeSandbox`, `composeLinkRel`, `sanitizeInlineHtml`, `normalizeInlineSynonyms` — the latter canonicalises `<strong>`→`<b>`, `<em>`→`<i>`, `<strike>`→`<s>` on paste, content load, HTML-mode return and on the sync clone, so saved output never mixes synonym tags). **Every** path that writes user input into the document goes through it — both the paste sanitizer and all modal forms (Image, Gallery, Video, Embed, QuoteCard author, Link, FloatingToolbar). Captions / author names accept inline HTML, but only through `sanitizeInlineHtml`. When adding a module with a URL or rich-text field, use these helpers instead of writing values raw, and never interpolate untrusted strings (server responses, ids, labels) into `innerHTML` — build nodes / use `textContent`.

Two sanitiser passes share one baseline (`FORBIDDEN_TAGS` + `sanitizeLoadedRoot`): **load** (`textarea.value`, `setContent()`, HTML-mode return) keeps the markup and removes only what can execute; **paste/drop** (`Editor.sanitizePasteRoot()`) additionally normalises foreign markup into the editor's shapes. Office/comment cleanup is done on the DOM, and the cleaned tree is adopted directly from the inert document — never serialise + re-parse (that is where mutation-XSS lives). Source-formatting whitespace is removed by `normalizeWhitespace()` on the DOM; never use a `>\s+<` regex (it glues inline words and rewrites `<pre>`).

### Lite mode

`liteMode: true` is the comments/forum profile. It is enforced in two places:
- The instance-config assembly in [Redactix.js](redactix/Redactix.js) (`init()`) — strips `uploadUrl`/`browseUrl`/`videoUploadUrl`/`videoBrowseUrl` from the per-instance config so upload paths are inert.
- The wrapper gets the `redactix-lite-mode` class; CSS hides the toolbar and individual modules check `this.instance.config.liteMode` to disable features (advanced link options, attribute editing, base64 paste, counter, etc.).
- The paste sanitizer: in lite mode modules' `preparePaste` / `pasteAllowedClasses` return nothing, so embeds, videos and galleries don't survive paste; `data:` images are dropped when there is no `uploadUrl`.

When changing module behavior, check whether lite mode needs a branch.

### Block gap insert handle

The `BlockGap` module ([redactix/modules/BlockGap.js](redactix/modules/BlockGap.js)) draws a Notion-style horizontal line with a centred `+` button between adjacent blocks on hover; click → empty `<p>` is inserted at that gap and focused. `findGap()` checks the direct children of every "gap-aware" container — the editor itself, each callout (`<aside>`), and each quote-card's inner `<blockquote>` — with inner containers taking priority, so hovering between two paragraphs inside a callout snaps to the inner gap. Toggle with `gapInsertHandle: false` in the Redactix constructor — the module short-circuits in `init()` and renders nothing.

### Content lifecycle (sync invariant)

The editor stores presentational wrappers (e.g. `.redactix-separator` around `<hr>`, `contenteditable` flags on `<figure>`/`<pre>`/`figure.quote-card`, floating Edit buttons) that must NOT leak into saved HTML. Two functions in [Redactix.js](redactix/Redactix.js) own the two directions:

- `setupContent(root)` — the ONE post-processing pipeline, run after initial load, `setContent()`, paste/drop, undo/redo and HTML-mode return: inline-synonym normalisation → `wrapSeparators()` → every module's `setupContent(root)` hook (migrations first) → `setupFigures()` for figures no module owns → `setupCodeBlocks()` → trailing paragraph.
- `serializeClean()` → `{ html, clone }` — exactly what gets saved; used by sync, History and HTML-mode entry. Generic cleanup removes anything marked `data-redactix-ui` and `.redactix-upload-placeholder`, unwraps search highlights (keeping their children), then runs every module's `cleanForSync(clone)` hook.

`replaceContent(html, opts)` = sanitize + innerHTML + `setupContent()` + `hideAllUI('contentReplaced')` + `contentReplaced` event. Sync (`sync()` = once per animation frame, `syncImmediate()`, also on the host form's `submit`) writes the textarea and dispatches `input`/`change` **only when the value actually changed**, never re-entrantly.

**If you add a module that introduces a new presentational wrapper, implement both hooks** (`setupContent` + `cleanForSync`, plus `ownsFigure` for a new figure type) in that module — the core needs no changes. Mark pure UI elements inside the content with `data-redactix-ui` and they are stripped automatically.

### Quote cards (single quote model)

Every quote in the editor is `<figure class="quote-card"><blockquote>…</blockquote><figcaption>…</figcaption></figure>`. There is **no** standalone `<blockquote>` and **no** `<cite>` — `QuoteCard.migrate()` runs from its `setupContent` hook (load, setContent, undo/redo, paste, HTML-mode return) to convert legacy markup, flattening nested blockquotes. Every card body and every callout is normalised with `schema.normalizeContainerChildren()` on each setup pass: disallowed blocks are moved out after the container (never wrapped into `<p>`). The blockquote is a real block container: P / H1-H3 / UL / OL are allowed inside; everything else is filtered out by SlashCommands and Markdown when the cursor is inside a quote-card. The figcaption is split into an optional `<img>` (author photo, no width/height — stripped in sync) and an optional `<span>` containing the author name. There is no dedicated author-link field — links inside the author name are added inline via the floating toolbar; the author-modal value round-trips through `sanitizeInlineHtml`. Lite mode hides the photo field entirely.

User-supplied `quotePresets` apply their `class` to the outer `<figure>`, not to the inner `<blockquote>` — relevant when scoping CSS.

### Preset configuration (callout + quote)

Both `calloutPresets` and `quotePresets` are normalised in [Redactix.js](redactix/Redactix.js) by `resolvePresets()` into a single flat array `[{ name, label, class }, …]` that downstream consumers (BlockControl menu, Editor sanitizer) read from `instance.config`. Two input shapes:

- Array form (legacy): `calloutPresets: [{ name, label, class }, …]` — extends defaults.
- Object form: `calloutPresets: { defaults: false, custom: [...] }` — `defaults: false` drops the built-ins; omitting `defaults` keeps them.

Defaults live inline in the constructor (labels translated via `blockControl.*` keys): warning/danger/information/success for callouts, `big` for quotes. The "No Style" / "Standard" placeholder entry is added by [BlockControl.js](redactix/modules/BlockControl.js) on read so the menu always offers a way to clear styling.

[Editor.js](redactix/core/Editor.js) `sanitizePasteRoot()` builds `allowedClasses` dynamically (multi-token preset classes are split into tokens) from these resolved arrays — so user-defined preset classes survive paste without manual whitelisting, and disabled defaults DON'T survive paste (consistent with the user's intent). When adding a new preset-style block, push its class names through this same path.

### Photo galleries (Gallery module)

`<figure class="redactix-gallery"><div class="redactix-gallery-grid"><a href="..."><img …></a><img …>…</div><figcaption>…</figcaption></figure>` — multiple images grouped under a single shared figcaption. The inner `.redactix-gallery-grid` is just a wrapper so the figcaption is unambiguously separate from the images (mirrors the embed/video pattern).

Each image can carry its own optional link with `target="_blank"` / `rel="nofollow"`. The modal supports drag-to-reorder, add via URL paste / multi-file upload / browse panel, per-item alt + link, and a single shared caption. Click on any image inside the gallery opens the modal — the [Image module](redactix/modules/Image.js) explicitly bails on clicks where `img.closest('figure.redactix-gallery')` is truthy, so the two click handlers don't compete.

The module is on by default; no separate flag. Upload uses the existing `uploadUrl`; browse uses the existing `browseUrl`. Lite mode disables it entirely (forum / comment editors don't need galleries).

Gallery's `pasteAllowedClasses` whitelists `redactix-gallery` and `redactix-gallery-grid` (not in lite mode). Inner `<a>` and `<img>` go through the standard attribute sweep — same surface as a single image. The div sweep in the paste sanitizer skips any `<div>` that still carries a whitelisted class (structural divs such as `.redactix-gallery-grid` / `.redactix-embed-frame`) — without that, `setupGalleries()`/`setupEmbeds()` would treat the figures as broken and delete them after paste.

### Native videos (Video module)

`<figure class="redactix-video" data-aspect="16:9|4:3|1:1|9:16|auto"><video src="..." controls preload="metadata"[ style="aspect-ratio:..."]></video><figcaption>…</figcaption></figure>` is what the [Video module](redactix/modules/Video.js) emits. Different from `redactix-embed`: it's a real `<video>` tag, not an iframe — for self-hosted MP4/WebM/OGG/MOV files. The user uploads or pastes a URL via the `/video` slash command.

The module follows the same on/off contract as Image: **always loaded, URL inserts always work**. File upload appears in the modal only when `videoUploadUrl` is configured (POST `multipart/form-data` with a `video` field); `videoBrowseUrl` adds the "choose from already uploaded" panel; `allowVideoDelete` mirrors the image flag. Lite mode strips the upload/browse URLs (commenters fall back to URL only) but keeps the `/video` command alive. Stripping happens in [Redactix.js](redactix/Redactix.js) the same way image upload is stripped.

Aspect ratio is the only visual layout the editor enforces: when the user picks `16:9` / `4:3` / `1:1` / `9:16`, an inline `style="aspect-ratio:16 / 9"` lands on the `<video>` element so the production site renders the same shape — no Redactix.css required. Inside the editor a single CSS rule (`figure.redactix-video > video { max-height:450px }`, mirroring the image rule) keeps vertical clips from blowing up the editor; on the production site the admin's stylesheet decides everything.

Video's `preparePaste` hook keeps a `<video>` only when it already sits inside `figure.redactix-video` (i.e. saved Redactix output being pasted back). Standalone videos are stripped — same defense-in-depth posture as iframes. Allowed attributes are reduced to `src` + `controls` + `preload="metadata"` + an optional `aspect-ratio` style; everything else is dropped.

The Video module is also where the floating "Edit" button lives (top-right of the figure on hover, marked with `data-redactix-ui` so sync strips it). Click goes to the modal — clicks on the `<video>` itself drive the native HTML5 controls, so we never hijack play/pause.

### Embeds (single embed model)

All third-party embeds (videos, posts, players) live in `<figure class="redactix-embed" data-provider="..." data-aspect="16:9|4:3|1:1|9:16|auto"[ data-height="N"]>` (`data-height` persists the real height of auto-height embeds, e.g. a 152px Spotify track) with an inner `<div class="redactix-embed-frame"><iframe>` and an optional `<figcaption>`. No external scripts are loaded — everything is plain iframes. Provider registry is in [Embed.js buildProviderRegistry()](redactix/modules/Embed.js); each entry maps a URL regex to an iframe spec. The `custom` provider accepts raw iframe HTML pasted by the user (LinkedIn, Facebook, niche services); only one `<iframe>` survives sanitisation, attributes are whitelisted, src must be `https://`.

There is a single `/embed` slash command. Provider names (youtube, spotify, twitter, instagram, tiktok, …) are listed as keywords on that command, so fuzzy search surfaces it whether the user types `/embed`, `/youtube`, or `/spotify`. The modal then auto-detects the provider from the URL the user pastes. The command is filtered out entirely in lite mode. Legacy `<div class="redactix-video-wrapper">` is migrated to the new shape on load.

Embed's `preparePaste` hook keeps a pasted iframe only when `findProviderForIframeSrc()` matches a registered provider **anchored at the URL's host** (provider regexes are anchored too); being wrapped in `figure.redactix-embed` vouches for nothing, since anyone can write that markup. Unknown iframes are stripped. A new provider becomes paste-safe only if its `matchUrl` also recognises its own embed `src` form — add a round-trip test.

**Self-contained inline layout.** All critical layout (frame `position`, `width`, `overflow`, aspect-ratio padding-top OR fixed height, plus iframe `position:absolute`/`top`/`left`/`width:100%`/`height:100%`/`border:0`) is written **inline** by `applyFrameLayout()` and `applyIframeLayout()` in [Embed.js](redactix/modules/Embed.js) — both at create-time and during `cleanEmbedsForSync()`. The production site doesn't need `Redactix.css` to render embeds; only the cosmetic `max-width` / `margin` / `border-radius` rules live in CSS, and they're optional.

**Production-side runtime.** [redactix/embed-runtime.js](redactix/embed-runtime.js) is a small standalone IIFE — opt-in. It listens for `postMessage` resize events from Instagram / Twitter / TikTok / Reddit / Bluesky iframes (checking each provider's origin, clamping heights to 50–5000) and updates `frame.style.height` live; it also adds Twitch's `parent=` for the current host. Call `window.RedactixEmbedRuntime.refresh()` after injecting embeds dynamically. The editor uses the same logic from [core/embed-protocol.js](redactix/core/embed-protocol.js); the runtime keeps a copy because production pages load it without modules. If you add a provider that posts size messages, update BOTH — the media test suite compares the two parsers.

### i18n ([redactix/i18n/](redactix/i18n/))

Locales are plain JS objects keyed by dot paths (e.g. `toolbar.bold`). Currently shipped: `en` and `ru`. Adding a new string means updating **every** locale file — there is no fallback at the key level. To add a language: create a new file using `en.js` as a template, import it in [i18n/index.js](redactix/i18n/index.js), and add the code to `rtlLocales` if it's right-to-left.

### Theming

All colors are CSS custom properties (light defaults on `:root`, so elements portaled to `<body>` resolve them too). The dark theme is `.redactix-wrapper.redactix-dark` (and `.redactix-auto` under `prefers-color-scheme: dark`) overriding the same variables; portaled elements copy the theme classes via `mirrorTheme()`. Keyframes are prefixed `redactix-`. Strings in CSS-generated content come from CSS variables set by `render()` (`--redactix-caption-placeholder`, `--redactix-uploading-label`) so they are localised in [redactix/Redactix.css](redactix/Redactix.css). When customizing, override at the same selector specificity (see README "Method 1"). Never use `!important` — with one sanctioned exception: the HTML-mode code-editor rules (`.redactix-code-*`) deliberately use `!important` on metric-critical properties (font, size, line-height, padding, white-space, the transparent-text overlay and `::selection`). That block is armor against host-page CSS (CMS admin themes aggressively styling `textarea`/`pre`/`code`/`::selection`) — any metric drift between the textarea, the highlight backdrop and the line-number gutter breaks the pixel-perfect overlay. JS-set inline styles (height, transform) are intentionally NOT covered by those rules.

### Image / video upload contract

Both [redactix_images.php](redactix_images.php) (real) and [redactix_images_demo.php](redactix_images_demo.php) (demo — always returns `uploads/default.jpg` for images and `uploads/default.mp4` for videos) implement the same JSON protocol consumed through [redactix/core/media-client.js](redactix/core/media-client.js) (the only place that talks to the server and sanitises its responses — `cleanMediaRecord`): POST `multipart/form-data`, with `action=browse` (optional `offset`/`limit`; response adds `total`/`offset`/`limit`) / `action=delete` switches plus a `type=image|video` parameter (default `image` — kept for backward compat), and a default upload action that dispatches by the file field name (`image` → image upload, `video` → video upload). Errors are `{ success: false, error, code? }`; a request over `post_max_size` gets HTTP 413 with `code: 'tooLarge'`; OPTIONS gets 405. SVG upload is off by default (`$allowSvg`), and [uploads/.htaccess](uploads/.htaccess) serves uploads with `nosniff` (SVG sandboxed + download-only). The delete button appears only when the client flag (`allowImageDelete` / `allowVideoDelete`) AND the server's `allowDelete` are both true. Upload / browse UI is shared via [ui/media-ui.js](redactix/ui/media-ui.js); caption read/write and Edit buttons via [core/figure-utils.js](redactix/core/figure-utils.js). Video upload is gated by `$allowVideoUpload`: `false` in the real script (flip to true to enable), `true` in the demo script so the showcase works out of the box. If you change the response shape on the PHP side, update both JS clients and vice versa. The bundled scripts intentionally ship without auth/CSRF — that is a deployment concern flagged in the README. The root [.htaccess](.htaccess) therefore denies `redactix_images.php`, `*.md`, dot-files/directories (except `.well-known`) and `tests/` so the whole repository can be uploaded to a public Apache host; keep it in sync when adding development-only files or directories.

## Conventions

- Source comments are mixed Russian/English — preserve the existing language when editing a region rather than translating it wholesale.
- No semicolons-vs-not debates: existing code uses semicolons; match it.
- Prefer adding to existing modules over creating new files for closely related functionality. Exception: BlockControl is split by concern into [modules/block-control/](redactix/modules/block-control/) (`BlockResolver` — pointer/element → block and drop target, `HandleLayer`, `BlockMenu`, `BlockCommands` — every command via `transact`, `DragController` — one Pointer Events implementation for mouse/pen/touch); `BlockControl.js` only wires them.
- Versioning: there's no `package.json`. The version badge at the top of [README.md](README.md) is the canonical version reference — read it from there rather than trusting any number quoted in docs/comments.

## Testing

- **Regression suite:** [tests/regression.html](tests/regression.html) runs the cases in [tests/cases/](tests/cases/) (`core`, `blocks`, `media`, `editing`) with helpers from [tests/lib.js](tests/lib.js) (`makeEditor`, `caret`, `paste`, `key`, `type`, `eq` …). Serve the repo root (`php -S 127.0.0.1:8765 -t .`) and either open the page or run `node tests/run-headless.mjs` (zero-dependency: drives Chrome over the DevTools protocol with Node's built-in WebSocket; set `CHROME_PATH` if needed). Exit code is non-zero on any failure or page error.
- **Smoke:** `node tests/run-headless.mjs http://127.0.0.1:8765/index.html --smoke` loads the demo and reports uncaught errors.
- **Add a regression test for every bug you fix**, in the suite of the area you touched. Manual verification via [index.html](index.html) (dark mode, lite mode, custom presets, multi-instance) is still useful for visual changes.
