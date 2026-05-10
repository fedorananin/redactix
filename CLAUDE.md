# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Redactix is a zero-dependency, vanilla-JavaScript WYSIWYG editor distributed as native ES Modules. There is **no build system, no package manager, no test suite, and no transpilation** — files are served directly to the browser. The repo is set up as an OpenServer document root; opening [index.html](index.html) in a browser via the local web server (or any static server pointed at this directory) is how you "run" the project. Image and (opt-in) native video upload/browse/delete relies on two PHP scripts at the repo root.

## Architecture

The editor wraps a `<textarea>` with a contenteditable `<div>` and keeps the textarea synced so any backend that already reads `<textarea>.value` works unchanged.

### Boot flow ([redactix/Redactix.js](redactix/Redactix.js))

1. `new Redactix({ selector, ... })` finds matching textareas.
2. For each textarea it constructs a `RedactixInstance`, which:
   - Builds a `.redactix-wrapper` containing `Toolbar` + `.redactix-editor` (contenteditable).
   - Hides the original textarea and exposes the instance back on the DOM node as `textarea.redactix` (this is the public API surface — `getContent()`, `setContent()`, `sync()`, `setTheme()`).
   - Instantiates `Editor` (core editing/paste/structure logic), `Selection`, `Modal`, then iterates `modulesConfig` and calls `new ModuleClass(this).init()` on each.
   - Asks the toolbar to gather buttons from each module via `module.getButtons()`.

The `modulesConfig` array in [Redactix.js:69](redactix/Redactix.js#L69) is the registration point for modules. Order matters for some modules (e.g., `History` is first so it can wrap subsequent module actions).

### Module system ([redactix/core/Module.js](redactix/core/Module.js))

Every feature is a class extending `Module`. A module receives the `RedactixInstance` and can:
- Access the contenteditable via `this.instance.editorEl` and the core editor via `this.editor` / `this.instance.core`.
- Read config via `this.instance.config` (this includes `liteMode`, `uploadUrl`, `browseUrl`, `videoUpload`, `videoUploadUrl`, `videoBrowseUrl`, `allowVideoDelete`, `calloutPresets`, `quotePresets`, `predefinedClasses`, `maxHeight`, `theme`, `gapInsertHandle`, `i18n`).
- Return toolbar buttons from `getButtons()` (`{ name, icon, title, action, active? }`).
- Translate strings via `this.t('namespace.key')`.

To add a new feature: create a file in [redactix/modules/](redactix/modules/), extend `Module`, then add the class to the `modulesConfig` array in [Redactix.js:69](redactix/Redactix.js#L69).

### Lite mode

`liteMode: true` is the comments/forum profile. It is enforced in two places:
- [Redactix.js:90-91](redactix/Redactix.js#L90) — strips `uploadUrl`/`browseUrl` from the per-instance config so image upload paths are inert.
- The wrapper gets the `redactix-lite-mode` class; CSS hides the toolbar and individual modules check `this.instance.config.liteMode` to disable features (advanced link options, attribute editing, base64 paste, counter, etc.).

When changing module behavior, check whether lite mode needs a branch.

### Block gap insert handle

The `BlockGap` module ([redactix/modules/BlockGap.js](redactix/modules/BlockGap.js)) draws a Notion-style horizontal line with a centred `+` button between adjacent top-level blocks on hover; click → empty `<p>` is inserted at that gap and focused. It only inspects direct children of `editorEl`, so internal gaps inside callouts / quote-cards aren't covered (those are handled by the in-container block handle's "insert below"). Toggle with `gapInsertHandle: false` in the Redactix constructor — the module short-circuits in `init()` and renders nothing.

### Content lifecycle (sync invariant)

The editor stores presentational wrappers (e.g. `.redactix-separator` around `<hr>`, `contenteditable` flags on `<figure>`/`<pre>`/`figure.quote-card`) that must NOT leak into saved HTML. `RedactixInstance.sync()` clones `editorEl`, strips those wrappers, and writes the cleaned HTML to `textarea.value`. Conversely, `setContent()` and the constructor run `wrapSeparators()` / `setupFigures()` / `setupCodeBlocks()` / `runQuoteCardSetup()` to re-add the wrappers after injecting raw HTML.

**If you add a module that introduces a new presentational wrapper, you must update both directions** — the post-processing functions in [Redactix.js](redactix/Redactix.js) and the cleanup pass in `sync()`. For QuoteCard the cleanup lives in `QuoteCard.cleanCardsForSync(clone)` and the live-DOM setup in `QuoteCard.setupCards()`; both are invoked from Redactix.js so other modules don't need to know.

### Quote cards (single quote model)

Every quote in the editor is `<figure class="quote-card"><blockquote>…</blockquote><figcaption>…</figcaption></figure>`. There is **no** standalone `<blockquote>` and **no** `<cite>` — `QuoteCard.migrate()` runs in `render()` / `setContent()` / `History.applyState()` / paste to convert legacy markup. The blockquote is a real block container: P / H1-H3 / UL / OL are allowed inside; everything else is filtered out by SlashCommands and Markdown when the cursor is inside a quote-card. The figcaption is split into an optional `<img>` (author photo, no width/height — stripped in sync) and an optional `<span>` containing the author name, optionally wrapped in `<a rel="author">`. Lite mode hides the photo entirely and forces `rel="author nofollow noopener" target="_blank"` on the link.

User-supplied `quotePresets` apply their `class` to the outer `<figure>`, not to the inner `<blockquote>` — relevant when scoping CSS.

### Photo galleries (Gallery module)

`<figure class="redactix-gallery"><div class="redactix-gallery-grid"><a href="..."><img …></a><img …>…</div><figcaption>…</figcaption></figure>` — multiple images grouped under a single shared figcaption. The inner `.redactix-gallery-grid` is just a wrapper so the figcaption is unambiguously separate from the images (mirrors the embed/video pattern).

Each image can carry its own optional link with `target="_blank"` / `rel="nofollow"`. The modal supports drag-to-reorder, add via URL paste / multi-file upload / browse panel, per-item alt + link, and a single shared caption. Click on any image inside the gallery opens the modal — the [Image module](redactix/modules/Image.js) explicitly bails on clicks where `img.closest('figure.redactix-gallery')` is truthy, so the two click handlers don't compete.

The module is on by default; no separate flag. Upload uses the existing `uploadUrl`; browse uses the existing `browseUrl`. Lite mode disables it entirely (forum / comment editors don't need galleries).

The paste sanitizer in [Editor.js](redactix/core/Editor.js) whitelists `redactix-gallery` and `redactix-gallery-grid` classes alongside the rest. Inner `<a>` and `<img>` go through the standard attribute sweep — same surface as a single image.

### Native videos (Video module — off by default)

`<figure class="redactix-video" data-aspect="16:9|4:3|1:1|9:16|auto"><video src="..." controls preload="metadata"[ style="aspect-ratio:..."]></video><figcaption>…</figcaption></figure>` is what the [Video module](redactix/modules/Video.js) emits. Different from `redactix-embed`: it's a real `<video>` tag, not an iframe — for self-hosted MP4/WebM/OGG/MOV files. The user uploads or pastes a URL via the `/video` slash command.

The whole feature is **opt-in**: pass `videoUpload: true` in the constructor. Without it the slash command is filtered out, the toolbar button is hidden, and the module short-circuits in `init()`. `videoUploadUrl` enables file upload inside the modal (POST `multipart/form-data` with a `video` field); `videoBrowseUrl` enables the gallery panel; `allowVideoDelete` mirrors the image flag. Lite mode forces all of these off — videos never appear in comments. Stripping happens in [Redactix.js](redactix/Redactix.js) the same way image upload is stripped.

Aspect ratio is the only visual layout the editor enforces: when the user picks `16:9` / `4:3` / `1:1` / `9:16`, an inline `style="aspect-ratio:16 / 9"` lands on the `<video>` element so the production site renders the same shape — no Redactix.css required. Inside the editor a single CSS rule (`figure.redactix-video > video { max-height:450px }`, mirroring the image rule) keeps vertical clips from blowing up the editor; on the production site the admin's stylesheet decides everything.

The paste sanitizer in [Editor.js](redactix/core/Editor.js) keeps a `<video>` only when it already sits inside `figure.redactix-video` (i.e. saved Redactix output being pasted back). Standalone videos are stripped — same defense-in-depth posture as iframes. Allowed attributes are reduced to `src` + `controls` + `preload="metadata"` + an optional `aspect-ratio` style; everything else is dropped.

The Video module is also where the floating "Edit" button lives (top-right of the figure on hover, marked with `data-redactix-ui` so sync strips it). Click goes to the modal — clicks on the `<video>` itself drive the native HTML5 controls, so we never hijack play/pause.

### Embeds (single embed model)

All third-party embeds (videos, posts, players) live in `<figure class="redactix-embed" data-provider="..." data-aspect="16:9|4:3|1:1|auto">` with an inner `<div class="redactix-embed-frame"><iframe>` and an optional `<figcaption>`. No external scripts are loaded — everything is plain iframes. Provider registry is in [Embed.js buildProviderRegistry()](redactix/modules/Embed.js); each entry maps a URL regex to an iframe spec. The `custom` provider accepts raw iframe HTML pasted by the user (LinkedIn, Facebook, niche services); only one `<iframe>` survives sanitisation, attributes are whitelisted, src must be `https://`.

There is a single `/embed` slash command. Provider names (youtube, spotify, twitter, instagram, tiktok, …) are listed as keywords on that command, so fuzzy search surfaces it whether the user types `/embed`, `/youtube`, or `/spotify`. The modal then auto-detects the provider from the URL the user pastes. The command is filtered out entirely in lite mode. Legacy `<div class="redactix-video-wrapper">` is migrated to the new shape on load.

The paste sanitizer in [Editor.js](redactix/core/Editor.js) keeps an iframe if it's already inside a `figure.redactix-embed` or its src matches a registered provider; everything else (including unknown iframes) still gets stripped. If you add a new provider, it automatically becomes paste-safe.

**Self-contained inline layout.** All critical layout (frame `position`, `width`, `overflow`, aspect-ratio padding-top OR fixed height, plus iframe `position:absolute`/`top`/`left`/`width:100%`/`height:100%`/`border:0`) is written **inline** by `applyFrameLayout()` and `applyIframeLayout()` in [Embed.js](redactix/modules/Embed.js) — both at create-time and during `cleanEmbedsForSync()`. The production site doesn't need `Redactix.css` to render embeds; only the cosmetic `max-width` / `margin` / `border-radius` rules live in CSS, and they're optional.

**Production-side runtime.** [redactix/embed-runtime.js](redactix/embed-runtime.js) is a ~3KB IIFE — opt-in. It listens for `postMessage` resize events from Instagram / Twitter / TikTok / Reddit / Bluesky iframes and updates `frame.style.height` live. The same parser lives in [Embed.js](redactix/modules/Embed.js) so the editor and the rendered site behave identically. If you add a new provider that posts size messages, add a case in BOTH `parseResizeMessage` functions.

### i18n ([redactix/i18n/](redactix/i18n/))

Locales are plain JS objects keyed by dot paths (e.g. `toolbar.bold`). Currently shipped: `en` and `ru`. Adding a new string means updating **every** locale file — there is no fallback at the key level. To add a language: create a new file using `en.js` as a template, import it in [i18n/index.js](redactix/i18n/index.js), and add the code to `rtlLocales` if it's right-to-left.

### Theming

All colors are CSS custom properties on `.redactix-wrapper`. The dark theme is just `.redactix-wrapper.redactix-dark` overriding the same variables in [redactix/Redactix.css](redactix/Redactix.css). When customizing, override at the same selector specificity (see README "Method 1"). Never use `!important`.

### Image / video upload contract

Both [redactix_images.php](redactix_images.php) (real) and [redactix_images_demo.php](redactix_images_demo.php) (demo — always returns `uploads/default.jpg` for images and `uploads/default.mp4` for videos) implement the same JSON protocol consumed by [redactix/modules/Image.js](redactix/modules/Image.js) and [redactix/modules/Video.js](redactix/modules/Video.js): POST `multipart/form-data`, with `action=browse` / `action=delete` switches plus a `type=image|video` parameter (default `image` — kept for backward compat), and a default upload action that dispatches by the file field name (`image` → image upload, `video` → video upload). Video upload is gated by `$allowVideoUpload = false` in both PHP scripts — flip it to true to test end-to-end. If you change the response shape on the PHP side, update both JS clients and vice versa. The bundled scripts intentionally ship without auth/CSRF — that is a deployment concern flagged in the README.

## Conventions

- Source comments are mixed Russian/English — preserve the existing language when editing a region rather than translating it wholesale.
- No semicolons-vs-not debates: existing code uses semicolons; match it.
- Prefer adding to existing modules over creating new files for closely related functionality.
- Versioning: there's no `package.json`. The README badge (currently 1.8.0) is the canonical version reference.

## Testing

No automated tests exist. Verification is manual via [index.html](index.html), which doubles as the live demo and showcases every feature including dark mode, lite mode, custom presets, and multi-instance pages. The README's "Manual Testing Checklist" is the closest thing to a test plan.
