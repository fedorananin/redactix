# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Redactix is a zero-dependency, vanilla-JavaScript WYSIWYG editor distributed as native ES Modules. There is **no build system, no package manager, no test suite, and no transpilation** — files are served directly to the browser. The repo is set up as an OpenServer document root; opening [index.html](index.html) in a browser via the local web server (or any static server pointed at this directory) is how you "run" the project. Image upload/browse/delete relies on two PHP scripts at the repo root.

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
- Read config via `this.instance.config` (this includes `liteMode`, `uploadUrl`, `browseUrl`, `calloutPresets`, `quotePresets`, `predefinedClasses`, `maxHeight`, `theme`, `i18n`).
- Return toolbar buttons from `getButtons()` (`{ name, icon, title, action, active? }`).
- Translate strings via `this.t('namespace.key')`.

To add a new feature: create a file in [redactix/modules/](redactix/modules/), extend `Module`, then add the class to the `modulesConfig` array in [Redactix.js:69](redactix/Redactix.js#L69).

### Lite mode

`liteMode: true` is the comments/forum profile. It is enforced in two places:
- [Redactix.js:90-91](redactix/Redactix.js#L90) — strips `uploadUrl`/`browseUrl` from the per-instance config so image upload paths are inert.
- The wrapper gets the `redactix-lite-mode` class; CSS hides the toolbar and individual modules check `this.instance.config.liteMode` to disable features (advanced link options, attribute editing, base64 paste, counter, etc.).

When changing module behavior, check whether lite mode needs a branch.

### Content lifecycle (sync invariant)

The editor stores presentational wrappers (e.g. `.redactix-separator` around `<hr>`, `contenteditable` flags on `<figure>`/`<pre>`/`figure.quote-card`) that must NOT leak into saved HTML. `RedactixInstance.sync()` clones `editorEl`, strips those wrappers, and writes the cleaned HTML to `textarea.value`. Conversely, `setContent()` and the constructor run `wrapSeparators()` / `setupFigures()` / `setupCodeBlocks()` / `runQuoteCardSetup()` to re-add the wrappers after injecting raw HTML.

**If you add a module that introduces a new presentational wrapper, you must update both directions** — the post-processing functions in [Redactix.js](redactix/Redactix.js) and the cleanup pass in `sync()`. For QuoteCard the cleanup lives in `QuoteCard.cleanCardsForSync(clone)` and the live-DOM setup in `QuoteCard.setupCards()`; both are invoked from Redactix.js so other modules don't need to know.

### Quote cards (single quote model)

Every quote in the editor is `<figure class="quote-card"><blockquote>…</blockquote><figcaption>…</figcaption></figure>`. There is **no** standalone `<blockquote>` and **no** `<cite>` — `QuoteCard.migrate()` runs in `render()` / `setContent()` / `History.applyState()` / paste to convert legacy markup. The blockquote is a real block container: P / H1-H3 / UL / OL are allowed inside; everything else is filtered out by SlashCommands and Markdown when the cursor is inside a quote-card. The figcaption is split into an optional `<img>` (author photo, no width/height — stripped in sync) and an optional `<span>` containing the author name, optionally wrapped in `<a rel="author">`. Lite mode hides the photo entirely and forces `rel="author nofollow noopener" target="_blank"` on the link.

User-supplied `quotePresets` apply their `class` to the outer `<figure>`, not to the inner `<blockquote>` — relevant when scoping CSS.

### i18n ([redactix/i18n/](redactix/i18n/))

Locales are plain JS objects keyed by dot paths (e.g. `toolbar.bold`). Adding a new string means updating **every** locale file in [redactix/i18n/](redactix/i18n/) — there is no fallback at the key level. RTL detection is automatic for `ar` / `he` and applies the `redactix-rtl` class plus `dir="rtl"` on the wrapper.

### Theming

All colors are CSS custom properties on `.redactix-wrapper`. The dark theme is just `.redactix-wrapper.redactix-dark` overriding the same variables in [redactix/Redactix.css](redactix/Redactix.css). When customizing, override at the same selector specificity (see README "Method 1"). Never use `!important`.

### Image upload contract

Both [redactix_images.php](redactix_images.php) (real) and [redactix_images_demo.php](redactix_images_demo.php) (demo — always returns `uploads/default.jpg`) implement the same JSON protocol consumed by [redactix/modules/Image.js](redactix/modules/Image.js): POST `multipart/form-data`, with `action=browse` / `action=delete` switches and a default upload action when no `action` is sent. If you change the response shape on the PHP side, update the JS client and vice versa. The bundled scripts intentionally ship without auth/CSRF — that is a deployment concern flagged in the README.

## Conventions

- Source comments are mixed Russian/English — preserve the existing language when editing a region rather than translating it wholesale.
- No semicolons-vs-not debates: existing code uses semicolons; match it.
- Prefer adding to existing modules over creating new files for closely related functionality.
- Versioning: there's no `package.json`. The README badge (currently 1.8.0) is the canonical version reference.

## Testing

No automated tests exist. Verification is manual via [index.html](index.html), which doubles as the live demo and showcases every feature including dark mode, lite mode, custom presets, and multi-instance pages. The README's "Manual Testing Checklist" is the closest thing to a test plan.
