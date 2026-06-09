# Redactix

Modern WYSIWYG editor with Notion-like experience. Clean HTML output. Zero dependencies. Vanilla JS.

![Redactix Editor](https://img.shields.io/badge/version-1.11.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Vanilla JS](https://img.shields.io/badge/vanilla-js-yellow.svg)

**Compatible with everything that can work with a plain `<textarea>`.**

---

## ✨ Features

### Core Features
- 🎨 **Notion-like UI** — Floating toolbar for text selection, block handles for drag & drop
- ⌨️ **Slash Commands** — Type `/` to open command menu with all block types (h1, h2, h3, quote, callout, code, image, embed, table, hr, ol, ul)
- 📝 **Rich Text Formatting** — Bold, italic, underline, strikethrough, inline code, highlights, spoilers
- 🔗 **Advanced Links** — Full control over href, title, target, rel attributes (nofollow, sponsored, ugc)
- 📋 **Lists** — Ordered and unordered lists with drag & drop reordering and nesting
- 🎯 **Block Controls** — Drag handle on hover, context menu for transformations
- ➕ **Block Gap Insert** — Notion-style "+" handle that appears between blocks on hover. Click to insert a paragraph exactly there. Disable with `gapInsertHandle: false`
- 🖼️ **Images** — Upload, browse gallery, drag & drop, paste from clipboard, auto-upload base64
- 🖼️🖼️ **Photo galleries** — Multiple images grouped under a single shared caption. Drag-to-reorder in the modal, per-image alt + optional link. Uses the same image upload / browse pipeline
- 🎞️ **Native videos** — Insert by URL out of the box; provide `videoUploadUrl` to also accept MP4 / WebM / OGG / MOV uploads (and `videoBrowseUrl` for a "choose from already uploaded" panel). Renders as a real `<figure><video controls>` with a chosen aspect ratio
- 📊 **Tables** — Full-featured tables with row/column manipulation
- 💬 **Quote cards** — `<figure class="quote-card">` with multi-paragraph blockquote, headings and lists inside, plus optional author photo, name and link in `<figcaption>`. Aside (callout) blocks have presets (info, warning, danger, success) and optional emoji
- 🔗 **Embeds** — Universal embed for any iframe-able service: YouTube, Vimeo, Spotify, Apple Music, SoundCloud, Twitch, CodePen, X/Twitter, Instagram, TikTok, Reddit, Bluesky, Loom, Google Maps, etc. Plus a Custom HTML mode that accepts pasted iframe code from anywhere (LinkedIn, Facebook, niche services). Wrapped in `<figure>` with optional caption
- 📱 **Touch Support** — Full mobile support with touch events for drag & drop
- ⌨️ **Markdown Shortcuts** — `#`, `##`, `###`, `*`, `-`, `1.`, `>`, `!`, `---` for quick formatting
- 🔍 **Find & Replace** — Built-in search with navigation and replace functionality
- 🕐 **History** — Unlimited undo/redo with smart batching
- 🌐 **HTML Mode** — Switch to raw HTML editing with syntax highlighting
- 🌍 **Internationalization** — Built-in English and Russian; RTL detection ready for additional locales
- 🔄 **Auto-sync** — Automatic synchronization with original textarea
- 🎯 **Element Attributes** — Edit ID (anchors) and CSS classes for any element
- 📏 **Word/Character Counter** — Real-time statistics in the bottom right
- 🖥️ **Fullscreen Mode** — Distraction-free editing experience
- 📐 **Configurable Height** — Set maximum height for the editor area
- 💬 **Lite Mode** — Simplified editor for comments and forums (no uploads, auto-nofollow links)

### Image Management
- 📤 **Upload** — Drag & drop, paste, file picker
- 🖼️ **Gallery Browser** — Visual grid of previously uploaded images
- 🔄 **Replace** — Upload new image while editing existing one
- 🗑️ **Delete** — Optional delete functionality in gallery
- 🔗 **Base64 Auto-upload** — Automatically converts pasted base64 images to uploaded files
- ⚙️ **Full Settings** — src, srcset, alt, title, loading, caption, link with rel attributes

### Developer Experience
- 🎯 **Zero Dependencies** — Pure vanilla JavaScript, no external libraries
- 📦 **Modular Architecture** — Easy to extend with custom modules
- 🎨 **Customizable Styles** — CSS variables for easy theming
- 🔌 **Simple Integration** — Works with any backend, just a textarea
- 🛡️ **XSS Protection** — Built-in HTML sanitization
- 📱 **Responsive** — Works perfectly on mobile devices
- 🌍 **Multi-instance** — Multiple editors on one page
- 🎛️ **Configurable** — Custom presets, classes, upload handlers

---

## 🚀 Quick Start

### 1. Include Files

```html
<link rel="stylesheet" href="/redactix/Redactix.css">
<script type="module">
    import Redactix from './redactix/Redactix.js';
    
    new Redactix({
        selector: '.redactix'
    });
</script>
```

### 2. Create Textarea

```html
<textarea class="redactix">
    <h1>Hello World!</h1>
    <p>Start editing...</p>
</textarea>
```

That's it! The editor will automatically initialize.

---

## 📸 Image Upload & Gallery

### Unified PHP Script

Redactix includes `redactix_images.php` — a unified script for upload, browse, and delete operations.

```javascript
new Redactix({
    selector: '.redactix',
    uploadUrl: '/redactix_images.php',
    browseUrl: '/redactix_images.php',
    allowImageDelete: true  // Show delete buttons in gallery
});
```

### PHP Configuration

```php
// redactix_images.php
$uploadDir = __DIR__ . '/uploads/';
$uploadUrlPrefix = '/uploads/';
$maxFileSize = 5 * 1024 * 1024;  // 5MB
$allowDelete = false;  // Enable delete functionality
```

### Demo Mode

For testing without real uploads, use `redactix_images_demo.php`:
- Always returns `uploads/default.jpg` on upload
- Browse and delete work with real files
- Perfect for demonstrations

### API Endpoints

**Upload**
```
POST /redactix_images.php
Content-Type: multipart/form-data
Body: image file

Response:
{
    "success": true,
    "src": "/uploads/abc123.jpg",
    "srcset": "",
    "alt": "",
    "title": "",
    "caption": ""
}
```

**Browse**
```
POST /redactix_images.php
Content-Type: multipart/form-data
Body: action=browse

Response:
{
    "success": true,
    "images": [
        {
            "src": "/uploads/image.jpg",
            "filename": "image.jpg",
            "size": "1.2 MB",
            "sizeBytes": 1258291,
            "modified": 1638360000
        }
    ],
    "allowDelete": false
}
```

**Delete**
```
POST /redactix_images.php
Content-Type: multipart/form-data
Body: action=delete&file=image.jpg

Response:
{
    "success": true,
    "message": "File deleted successfully"
}
```

---

## 🎞️ Native Video

Redactix supports inline `<video>` for self-hosted MP4 / WebM / OGG / MOV files using the same model as images: the module is always on, URL inserts work out of the box, file upload + the "choose from already uploaded" panel light up only when you provide endpoints.

```javascript
new Redactix({
    selector: '.redactix',
    // URL-only — works with no extra setup, the /video modal accepts a direct URL
    // OR — also accept file uploads:
    videoUploadUrl: '/redactix_images.php',
    videoBrowseUrl: '/redactix_images.php', // optional gallery panel
    allowVideoDelete: false                  // optional delete buttons
});
```

To accept uploads, flip the matching server-side flag too — by default the bundled PHP refuses video uploads:

```php
// redactix_images.php
$allowVideoUpload = true;
$maxVideoSize = 50 * 1024 * 1024;  // 50MB by default
```

**Output shape** (clean, semantic, no inline layout you don't want):

```html
<figure class="redactix-video" data-aspect="16:9">
    <video src="/uploads/clip.mp4" controls preload="metadata"
           style="aspect-ratio:16 / 9"></video>
    <figcaption>Optional caption</figcaption>
</figure>
```

The user picks an aspect ratio (`auto`, `16:9`, `4:3`, `1:1`, or `9:16`) in the modal. Auto means native dimensions — no inline style. The other choices write a single `aspect-ratio` declaration on the `<video>` tag so the player keeps its shape on the production site without extra CSS. Inside the editor a max-height of 450px keeps vertical clips from blowing up the viewport — same as images. On the production site the admin's stylesheet decides everything.

**Allowed attributes** are intentionally narrow: `src`, `controls`, `preload="metadata"`, optional `style="aspect-ratio:…"`. No autoplay, no muted, no loop, no poster — they're stripped on paste so users can't surprise readers with auto-playing audio.

**Lite mode** forces the entire feature off — videos never appear in comments / forums.

**API** — same protocol as image upload, just with a `video` file field (or `type=video` for browse / delete):

```
POST /redactix_images.php
Content-Type: multipart/form-data
Body: video=<file>

Response:
{
    "success": true,
    "src": "/uploads/abc123.mp4",
    "caption": ""
}
```

```
POST /redactix_images.php
Content-Type: multipart/form-data
Body: action=browse&type=video

Response:
{
    "success": true,
    "videos": [...],
    "allowDelete": false
}
```

The demo PHP (`redactix_images_demo.php`) always returns `uploads/default.mp4` so you can wire `videoUploadUrl` through end-to-end without filling your uploads directory.

---

## 🔌 JavaScript API

Each textarea with Redactix gets a reference to its instance via `textarea.redactix`. This allows programmatic control over the editor content.

### Getting and Setting Content

```javascript
// Get textarea element
const textarea = document.querySelector('#my-editor');

// Get clean HTML content (without editor wrappers)
const html = textarea.redactix.getContent();

// Set new HTML content
textarea.redactix.setContent('<h1>New content</h1><p>Hello world!</p>');
```

### Copying Content Between Editors

If you have multiple editors and need to copy content from one to another:

```javascript
// Old way (doesn't work with Redactix):
// targetTextarea.value = sourceTextarea.value;

// New way:
const source = document.querySelector('#source-editor');
const target = document.querySelector('#target-editor');

target.redactix.setContent(source.redactix.getContent());
```

### Syncing with Textarea

The editor automatically syncs with the original textarea on every change. You can also trigger sync manually:

```javascript
// Force sync editor content to textarea
textarea.redactix.sync();

// Now textarea.value contains the latest HTML
console.log(textarea.value);
```

### Changing Theme at Runtime

```javascript
const textarea = document.querySelector('#my-editor');

// Switch to dark theme
textarea.redactix.setTheme('dark');

// Switch to light theme
textarea.redactix.setTheme('light');

// Follow system preference (prefers-color-scheme)
textarea.redactix.setTheme('auto');
```

### API Reference

| Method | Description |
|--------|-------------|
| `getContent()` | Returns clean HTML without editor-specific wrappers |
| `setContent(html)` | Sets new HTML content, re-initializes editor elements, resets history |
| `sync()` | Manually syncs editor content to the original textarea |
| `setTheme(theme)` | Changes the editor theme at runtime. Accepts `'light'`, `'dark'`, or `'auto'` |

---

## ⚙️ Configuration

### Basic Options

```javascript
new Redactix({
    selector: '.redactix',              // CSS selector for textareas
    locale: 'en',                       // Language (en, ru, fr, es, etc.)
    uploadUrl: '/upload.php',           // Image upload endpoint (URL-only without it)
    browseUrl: '/browse.php',           // Image gallery endpoint
    allowImageDelete: true,             // Show delete buttons in image gallery
    videoUploadUrl: '/redactix_images.php', // Video upload endpoint (URL-only without it)
    videoBrowseUrl: '/redactix_images.php', // Optional video gallery endpoint
    allowVideoDelete: false,            // Show delete buttons in the video gallery
    maxHeight: '500px',                 // Maximum editor height
    classes: ['highlight', 'centered'], // Quick-select classes in Attributes
    liteMode: false,                    // Enable lite mode for comments/forums
    gapInsertHandle: true               // "+" between-blocks handle (default true; pass false to hide it)
});
```

### Lite Mode

Lite mode provides a simplified editor perfect for comment forms and forums:

```javascript
new Redactix({
    selector: '.comment-editor',
    liteMode: true
});
```

**What's disabled in lite mode:**
- **Toolbar** — completely hidden (use `/` commands or Markdown shortcuts instead)
- Fullscreen, HTML mode, and Find & Replace
- Image uploads (drag & drop, paste, file picker) — only URL-based images allowed
- Image gallery browser
- Base64 image paste (automatically removed)
- Advanced link settings (title, rel) — all links are automatically `nofollow` and open in new tab
- Element attributes editing (ID, classes)
- Word/character counter
- **Author photo** for quote cards — only text caption + optional link (forced to `rel="author nofollow noopener"` and `target="_blank"`)

**What's simplified:**
- Image dialog: only URL and alt text, images get `loading="lazy"` by default
- Link dialog: only URL and text, all links are `nofollow` with `target="_blank"`

**What still works:**
- All text formatting (bold, italic, underline, strikethrough, code, highlight, spoiler)
- **Slash commands** — type `/` to insert any block type
- **Markdown shortcuts** — `#`, `-`, `>`, etc.
- Links (with automatic nofollow)
- Images by URL (wrapped in `<figure>` with `loading="lazy"`)
- Lists, blockquotes, callouts
- Tables, code blocks, separators
- Block drag & drop
- Undo/redo
- Floating toolbar for text selection

### Custom Presets

Both `calloutPresets` and `quotePresets` accept either an array (legacy — appends to defaults) or a `{ defaults?, custom? }` object (full control). Defaults: `warning`/`danger`/`information`/`success` for callouts, `big` for quotes.

```javascript
new Redactix({
    selector: '.redactix',

    // ----- Array form: extends defaults -----
    calloutPresets: [
        { name: 'note', label: 'Note', class: 'my-note' },
        { name: 'tip',  label: 'Pro Tip', class: 'my-tip' }
    ],

    // ----- Object form: full control -----
    quotePresets: {
        defaults: false,                                // turn off "big"
        custom: [
            { name: 'pull',        label: 'Pull Quote', class: 'pull-quote' },
            { name: 'testimonial', label: 'Testimonial', class: 'testimonial' }
        ]
    }
});
```

`defaults: false` strips the built-in entries; `defaults: true` (or omitting) keeps them. The "No Style" / "Standard" entry that lets users clear styling is always present.

#### Where the class lands in the saved HTML

| Block | Class lands on |
|---|---|
| Callout | `<aside class="my-tip">…</aside>` |
| Quote | `<figure class="quote-card my-pull-quote">…</figure>` (NOT on the inner `<blockquote>`) |

#### Making your custom CSS actually show up — both in the editor and on the published page

The sanitizer auto-allows any class you list in `calloutPresets` / `quotePresets`, so pasted HTML keeps your classes intact — no extra setup on the JS side. The CSS side, on the other hand, has a small subtlety worth understanding.

**Why there's a subtlety.** When the editor renders your content, it wraps it in `<div class="redactix-editor">`. On the published page there's no such wrapper — the article is just plain HTML inside your normal layout. So a rule like `aside.my-tip { ... }` works on the published page but only shows up inside the editor preview if that stylesheet is also loaded on the admin page where the editor lives.

You have three ways to handle this:

**1. Easiest — load the same stylesheet on both sides.** If your site CSS is included on `/admin` (or wherever the editor lives) as well as on the public site, one unscoped rule covers both contexts:

```css
/* site.css — loaded on /admin AND the public site */
aside.my-tip {
    background: #f0f9ff;
    border: 1px solid #0ea5e9;
    color: #075985;
}
```

**2. Editor-only stylesheet.** If your site CSS does NOT load on the admin page, write a separate file scoped to `.redactix-editor` (so it can't leak into your admin chrome) and include it next to `Redactix.css`:

```css
/* redactix-presets.css — loaded only on /admin */
.redactix-editor aside.my-tip {
    background: #f0f9ff;
    border: 1px solid #0ea5e9;
    color: #075985;
}
```

The same rule unscoped lives in your public `site.css` so readers see the same look.

**3. One rule that works in both places.** Combine both selectors with a comma — slightly verbose, but the rule lives in a single file no matter where you load it:

```css
.redactix-editor aside.my-tip,
aside.my-tip {
    background: #f0f9ff;
    border: 1px solid #0ea5e9;
    color: #075985;
}
```

The same idea applies to quote presets — the class lands on `figure.quote-card`, not on the inner `<blockquote>`:

```css
.redactix-editor figure.quote-card.pull-quote,
figure.quote-card.pull-quote {
    border-left: 6px solid #f59e0b;
    background: #fffbeb;
    font-size: 1.25em;
}
```

> **Common mistake:** writing only the unscoped `aside.my-tip { ... }` rule and not including that stylesheet on the admin page. The published page will look right; the editor preview won't. If your custom callout looks like a default grey one inside the editor, that's almost always why.

---

## ⌨️ Keyboard Shortcuts

### Slash Commands

Type `/` anywhere to open the command menu:

| Command | Description |
|---------|-------------|
| `/h1` | Heading 1 |
| `/h2` | Heading 2 |
| `/h3` | Heading 3 |
| `/quote` | Blockquote |
| `/callout` | Callout/aside block |
| `/code` | Code block |
| `/image` | Insert image |
| `/gallery` | Photo gallery — multiple images, single shared caption, per-image link |
| `/video` | Native HTML5 `<video>` — paste a direct URL out of the box; provide `videoUploadUrl` to also accept file uploads. Choose aspect ratio in the modal |
| `/embed` | Universal embed — paste any URL, provider is auto-detected (YouTube, Vimeo, Spotify, Twitter/X, Instagram, TikTok, Reddit, Bluesky, Loom, CodePen, Twitch, SoundCloud, Apple Music, Maps, …). Provider names also work as fuzzy-search keywords (`/youtube`, `/spotify` surface the same command). |
| `/table` | Insert table |
| `/hr` | Horizontal divider |
| `/ol` | Numbered list |
| `/ul` | Bullet list |

Use arrow keys to navigate, Enter to select, Escape to close.

### Markdown-style Shortcuts

Type at the start of a line and press space:

| Shortcut | Result |
|----------|--------|
| `#` | Heading 1 |
| `##` | Heading 2 |
| `###` | Heading 3 |
| `-` or `*` | Bullet list |
| `1.` | Numbered list |
| `>` | Blockquote |
| `!` | Callout (aside) |
| `---` | Horizontal rule |

### Standard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+B` | Bold |
| `Ctrl+I` | Italic |
| `Ctrl+U` | Underline |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` | Redo |
| `Ctrl+F` | Find & Replace |
| `Escape` | Exit fullscreen |

---

## 🎨 UI Components

### Floating Toolbar

Appears when you select text:
- Bold, Italic, Underline, Strikethrough
- Inline Code, Spoiler, Highlight
- Link with full configuration

### Block Handle

Hover over any block to see the drag handle on the left:
- **Click** — Open context menu (transform, duplicate, delete)
- **Drag** — Reorder blocks with drag & drop
- **Touch** — Long press opens menu, drag to reorder

### Block Gap Insert

Hover the gap between two top-level blocks to see a thin line with a centred "+" button. Click anywhere on the strip to insert an empty paragraph exactly there and place the cursor inside it — no need to climb back into the previous block and press Enter. Disable with `gapInsertHandle: false` if the always-visible affordance is distracting.

### Context Menu

Right-click or click the handle to:
- Transform block type (H1, H2, H3, P, Quote, Callout)
- Change callout/quote style
- Add or change callout emoji
- Convert list type (bulleted ↔ numbered)
- Insert block below
- Duplicate block
- Edit attributes (ID, classes)
- Delete block

---

## 🏗️ Architecture

### Modular Structure

```
redactix/
├── core/
│   ├── Editor.js         # Core editing logic, paste handling
│   ├── Module.js         # Base class for modules
│   └── Selection.js      # Selection management utilities
├── modules/
│   ├── Attributes.js     # ID and class editor
│   ├── BaseStyles.js     # Bold, italic, underline, etc.
│   ├── BlockControl.js   # Drag handles and context menu
│   ├── BlockGap.js       # Hover-gap "+" insert between top-level blocks
│   ├── BlockStyles.js    # Headings, paragraphs
│   ├── Code.js           # Code blocks
│   ├── FindReplace.js    # Search functionality
│   ├── FloatingToolbar.js # Text selection toolbar
│   ├── Fullscreen.js     # Fullscreen mode
│   ├── History.js        # Undo/redo
│   ├── HtmlMode.js       # Raw HTML editor
│   ├── Image.js          # Image upload and management
│   ├── Gallery.js        # Photo gallery (multiple imgs, shared caption)
│   ├── Video.js          # Native HTML5 <video> upload (opt-in)
│   ├── Link.js           # Link insertion
│   ├── List.js           # Lists (UL/OL)
│   ├── Markdown.js       # Markdown shortcuts
│   ├── QuoteCard.js      # Quote cards with optional author photo + link
│   ├── Separator.js      # Horizontal rules
│   ├── SlashCommands.js  # "/" command menu (Notion-like)
│   ├── Table.js          # Table management
│   └── Embed.js          # Universal embed (YouTube, Spotify, X, IG, TikTok, custom iframe …)
├── ui/
│   ├── Icons.js          # SVG icon library
│   ├── Modal.js          # Modal dialog component
│   └── Toolbar.js        # Main toolbar with sticky behavior
├── Redactix.css          # Complete styling
└── Redactix.js           # Main entry point
```

### Creating Custom Modules

```javascript
import Module from './core/Module.js';
import Icons from './ui/Icons.js';

export default class MyModule extends Module {
    getButtons() {
        return [
            {
                name: 'myButton',
                icon: Icons.bold,
                title: 'My Feature',
                action: () => {
                    // Your logic here
                    this.instance.sync();
                }
            }
        ];
    }
    
    init() {
        // Initialize your module
        // Access editor: this.instance.editorEl
        // Access config: this.instance.config
    }
}
```

---

## 🎯 HTML Output

Redactix produces clean, semantic HTML:

```html
<h1>Heading</h1>
<p>Paragraph with <b>bold</b>, <i>italic</i>, and <a href="https://example.com">links</a>.</p>

<ul>
    <li>List item</li>
    <li>Another item</li>
</ul>

<figure class="quote-card">
    <blockquote>
        <p>Standard quote — can contain multiple paragraphs, headings, lists.</p>
    </blockquote>
</figure>

<figure class="quote-card big">
    <blockquote>
        <p>Large quote with author photo and link.</p>
    </blockquote>
    <figcaption>
        <img src="/uploads/author.jpg" alt="Portrait of the author">
        <span>— <a href="https://author.example" rel="author">Author Name</a></span>
    </figcaption>
</figure>

<aside class="warning">Warning callout</aside>
<aside data-emoji="💡" class="information">Callout with emoji</aside>

<figure>
    <img src="/uploads/image.jpg" alt="Description">
    <figcaption>Image caption</figcaption>
</figure>

<figure class="redactix-gallery">
    <div class="redactix-gallery-grid">
        <img src="/uploads/a.jpg" alt="">
        <a href="https://example.com" target="_blank" rel="nofollow">
            <img src="/uploads/b.jpg" alt="">
        </a>
        <img src="/uploads/c.jpg" alt="">
    </div>
    <figcaption>Shared caption for the whole gallery</figcaption>
</figure>

<table>
    <thead>
        <tr><th>Header</th></tr>
    </thead>
    <tbody>
        <tr><td>Cell</td></tr>
    </tbody>
</table>

<figure class="redactix-embed" data-provider="youtube" data-aspect="16:9">
    <div class="redactix-embed-frame">
        <iframe src="https://www.youtube.com/embed/VIDEO_ID" allowfullscreen></iframe>
    </div>
    <figcaption>Optional caption</figcaption>
</figure>

<hr>

<pre><code>function hello() {
    console.log('Hello!');
}</code></pre>
```

### Inline Elements

- `<b>` — Bold
- `<i>` — Italic
- `<u>` — Underline
- `<s>` — Strikethrough
- `<code>` — Inline code
- `<mark>` — Highlight
- `<span class="spoiler">` — Spoiler
- `<a>` — Links with full attributes

---

## 🌐 Rendering Output on Your Site

`Redactix.css` is **scoped to `.redactix-editor`** — it styles the editor itself, not your published HTML. Saved content lands on your site as plain semantic markup, and you decide how it looks. This section is the practical checklist: which content types need CSS, which need a runtime script, and a copy-paste stylesheet that gets you 90% of the way there.

### What needs what

| Content type | HTML on production | CSS required? | JS required? |
|---|---|---|---|
| Headings, paragraphs, lists, links, inline formatting | `<h1>`, `<p>`, `<ul>`, `<a>`, `<b>`, `<i>`, `<code>`, `<mark>`, `<s>`, `<u>` | Browser defaults work; style to taste | No |
| Tables | `<table><thead>…</tbody></table>` | Style borders / spacing to taste | No |
| Horizontal rule | `<hr>` (no wrapper, the editor's `.redactix-separator` is stripped on save) | Browser default works | No |
| **Images** | `<figure><img><figcaption>` | **Yes** — figure margins, image max-width, caption | No |
| **Code blocks** | `<pre><code>…</code></pre>` | Style as you wish; if you want syntax highlighting, plug in your own (Prism, highlight.js, …) | Optional (your highlighter) |
| **Quote cards** | `<figure class="quote-card">` (+ optional `.big`) | **Yes** — see below | No |
| **Callouts** | `<aside class="warning\|danger\|information\|success">` (+ optional `data-emoji`) | **Yes** — see below | No |
| **Embeds** | `<figure class="redactix-embed">` with **all layout inline** | **No, layout is self-contained**. CSS only for cosmetics | **Optional** — `embed-runtime.js` for live auto-resize of social embeds |
| **Photo galleries** | `<figure class="redactix-gallery"><div class="redactix-gallery-grid">…imgs…</div>` | **Yes** — grid layout, image sizing, caption | No |
| **Native videos** | `<figure class="redactix-video"><video controls preload="metadata">` with optional inline `aspect-ratio` | Optional — width/border/caption styling | No |
| **Spoilers** | `<span class="spoiler">…</span>` | Optional — only if you want the click-to-reveal effect | Optional — see below |

### 1. Embeds — the easy one

Every embed is emitted with **all critical layout (position / width / height / aspect-ratio) written inline**, so the iframe renders correctly even with no Redactix CSS on the page:

```html
<figure class="redactix-embed" data-provider="instagram" data-aspect="auto"
        data-source-url="https://www.instagram.com/p/...">
  <div class="redactix-embed-frame"
       style="width:100%;height:700px">
    <iframe src="https://www.instagram.com/p/.../embed/"
            style="display:block;width:100%;height:100%;border:0"
            sandbox="..." loading="lazy"></iframe>
  </div>
</figure>
```

What you might still want:

```css
/* Cosmetics for embeds — layout is already inline, this is just polish. */
figure.redactix-embed { margin: 1em 0; text-align: center; }
figure.redactix-embed .redactix-embed-frame { border-radius: 8px; overflow: hidden; }

/* Per-provider max-width: social posts read better in a narrower column. */
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

**Optional auto-resize script.** Instagram, X (Twitter), TikTok, Reddit and Bluesky iframes `postMessage` their actual content height. Without the runtime they stay at the editor's initial guess (700, 600, 750, 500, 500 px); with it the frame matches the real content as soon as the iframe loads:

```html
<script src="/redactix/embed-runtime.js" defer></script>
```

Tiny, no dependencies, no third-party requests — it only listens for `window.postMessage` events. **Skip it if your content has only video embeds** (YouTube / Vimeo / Twitch / Loom / Maps) — those use aspect-ratio and don't need the runtime.

### 2. Quote cards

The HTML is self-explanatory but **inert without CSS** — `<blockquote>` would otherwise inherit the browser's default 40px indent and the figcaption would lay out as block text:

```html
<!-- Default quote -->
<figure class="quote-card">
  <blockquote><p>The quote text — multiple paragraphs allowed.</p></blockquote>
  <figcaption>
    <img src="/uploads/photo.jpg" alt="">
    <span>— <a href="https://author.example" rel="author">Author</a></span>
  </figcaption>
</figure>

<!-- Big preset (centered, large italic) -->
<figure class="quote-card big">
  <blockquote><p>Pull-quote.</p></blockquote>
</figure>
```

Drop-in CSS:

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
  margin: 0; padding: 0; border: 0; background: transparent; color: inherit;
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
  width: 40px; height: 40px;
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
  justify-content: center; border-top: none;
  margin-top: 0.8em; padding-top: 0; font-size: 0.7em;
}
```

Customize colors and spacing to match your design — the structure (`figure > blockquote`, `figure > figcaption > img`, `figure > figcaption > span`) is fixed by the editor, the visuals are entirely yours.

### 3. Callouts (`<aside>`)

Without CSS, a browser renders `<aside>` as a plain block. Preset classes (`warning`, `danger`, `information`, `success`) and the `data-emoji` attribute are convention-only — you have to style them:

```html
<aside class="warning">Be careful here.</aside>
<aside data-emoji="💡" class="information">Tip with an emoji.</aside>
```

Drop-in CSS:

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

/* Emoji prefix — rendered from the data-emoji attribute via ::before. */
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

/* Inside-callout HR uses currentColor so it stays visible on tinted bg. */
aside hr { border: 0; border-top: 1px solid currentColor; opacity: 0.25; }
```

### 4. Images

Images are emitted as `<figure><img><figcaption>`:

```html
<figure>
  <img src="/uploads/photo.jpg" alt="Description" loading="lazy">
  <figcaption>Optional caption</figcaption>
</figure>
```

Drop-in CSS:

```css
/* Center the figure, give the caption a softer color. */
figure { margin: 1em 0; padding: 0; text-align: center; }
figure > img {
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

> **Note.** The same selector matches `figure.quote-card` and `figure.redactix-embed`. The CSS for those two **(above) overrides these defaults** because it's more specific (`figure.quote-card`, `figure.redactix-embed`). Order doesn't matter — keep this generic figure rule first if you prefer.

### 5. Spoilers (optional)

Spoilers are emitted as `<span class="spoiler">…</span>` with no inline behavior. If you want the click-to-reveal effect on your site:

```css
span.spoiler {
  background: #1f2937;
  color: #1f2937; /* hides the text */
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

### Summary

- **Always required on production:** nothing. Saved HTML is valid semantic markup and a browser will render it (ugly, but functional).
- **Recommended:** copy the four CSS blocks above into your site's stylesheet (or a single `redactix-content.css` you ship alongside your articles). Tweak colors and spacing to match your design.
- **Conditional:** include `embed-runtime.js` if you display Instagram / X / TikTok / Reddit / Bluesky embeds. Skip if you only have video embeds.
- **Don't ship `Redactix.css`** to your visitors — it's the editor's stylesheet, scoped to `.redactix-editor`, and would do nothing on saved content.

---

## 🛡️ Security

### Built-in XSS Protection

Redactix sanitizes all pasted content:
- Removes dangerous tags (`<script>`, `<iframe>`, etc.)
- Strips inline styles and event handlers
- Validates URLs (blocks `javascript:`)
- Filters CSS classes (whitelist only)
- Converts Google Docs artifacts
- Validates image content (MIME + actual format)

### Image Upload Security

The included PHP script provides:
- MIME type validation (server-side)
- File content validation with `getimagesize()`
- Random filename generation
- File size limits
- Extension whitelist
- Directory traversal protection

**Important:** Add authentication and CSRF tokens for production use.

---

## 📱 Mobile Support

### Touch Events
- Long press on block handle opens menu
- Drag blocks to reorder
- Pinch to zoom (native)
- Double tap to select word

### Responsive Design
- Adaptive toolbar (wraps on small screens)
- Touch-friendly 44x44px tap targets
- Optimized floating toolbar
- Mobile-friendly modal dialogs

### Mobile Optimizations
- Prevents zoom on input focus
- Handles virtual keyboard
- Smooth scrolling
- No hover states on touch devices

---

## 🎨 Theming & Customization

Redactix uses CSS custom properties (variables) for all colors, making theming simple without `!important`.

### Built-in Dark Theme

Add the `redactix-dark` class to enable dark mode:

```javascript
new Redactix({
    selector: '.redactix',
    theme: 'dark'  // Adds 'redactix-dark' class automatically
});
```

Or manually add the class:

```html
<div class="redactix-wrapper redactix-dark">...</div>
```

### Auto Dark Mode (System Preference)

Use `redactix-auto` class to follow system preference:

```javascript
new Redactix({
    selector: '.redactix',
    theme: 'auto'  // Follows prefers-color-scheme
});
```

### CSS Variables Reference

Override these variables to customize the editor. No `!important` needed.

#### Method 1: Override in your CSS (Recommended)

```css
/* Light theme customization */
.redactix-wrapper {
    --redactix-primary: #8b5cf6;        /* Purple accent */
    --redactix-primary-hover: #7c3aed;
    --redactix-bg: #fafafa;
    --redactix-text: #1a1a1a;
}

/* Dark theme customization - use the same selector specificity */
.redactix-wrapper.redactix-dark {
    --redactix-primary: #a855f7;        /* Brighter purple for dark */
    --redactix-primary-hover: #c084fc;
}

/* Scope to a specific editor */
.redactix-wrapper.my-theme {
    --redactix-primary: #10b981;        /* Green accent */
}
```

> **Note:** When using dark theme (`theme: 'dark'`), override variables with `.redactix-wrapper.redactix-dark` selector to ensure proper specificity.

#### Method 2: Override on wrapper element

```html
<style>
    #my-editor {
        --redactix-primary: #f59e0b;
        --redactix-border: #fcd34d;
    }
</style>
<textarea class="redactix" id="my-editor">...</textarea>
```

### Complete Variables List

```css
/* ===== Primary Colors ===== */
--redactix-primary: #2563eb;           /* Main accent color (buttons, links, focus) */
--redactix-primary-hover: #1d4ed8;     /* Hover state for primary */
--redactix-primary-light: #dbeafe;     /* Light version for backgrounds */
--redactix-primary-rgb: 37, 99, 235;   /* RGB values for rgba() usage */

/* ===== Danger Colors ===== */
--redactix-danger: #dc2626;            /* Delete buttons, errors */
--redactix-danger-hover: #b91c1c;      /* Hover state for danger */
--redactix-danger-light: #fef2f2;      /* Light danger background */

/* ===== Base Colors ===== */
--redactix-border: #e5e7eb;            /* All borders */
--redactix-bg: #ffffff;                /* Main background */
--redactix-bg-secondary: #f9fafb;      /* Toolbar, table headers */
--redactix-bg-hover: #f3f4f6;          /* Hover states */
--redactix-bg-active: #e5e7eb;         /* Active/pressed states */
--redactix-text: #374151;              /* Main text color */
--redactix-text-muted: #6b7280;        /* Secondary text */
--redactix-text-placeholder: #9ca3af;  /* Placeholders */

/* ===== UI Elements ===== */
--redactix-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);  /* Dropdowns, modals */
--redactix-radius: 6px;                /* Border radius */
--redactix-overlay: rgba(0, 0, 0, 0.4); /* Modal overlay */

/* ===== Content Styling ===== */
--redactix-blockquote-bg: #f8fafc;     /* Blockquote background */
--redactix-code-bg: #f3f4f6;           /* Inline code background */
--redactix-code-color: #e11d48;        /* Inline code text */
--redactix-mark-bg: #fef08a;           /* Highlight/mark background */
--redactix-spoiler-bg: #374151;        /* Spoiler hidden state */

/* ===== Pre/Code Blocks ===== */
--redactix-pre-bg: #1f2937;            /* Code block background */
--redactix-pre-text: #e5e7eb;          /* Code block text */

/* ===== Callouts (aside) ===== */
--redactix-callout-bg: #f3f4f6;        /* Default callout background */
--redactix-callout-border: #d1d5db;    /* Default callout border */
--redactix-callout-text: #374151;      /* Default callout text */

/* ===== Find & Replace ===== */
--redactix-find-highlight: #fef08a;    /* Found text highlight */
--redactix-find-current: #f97316;      /* Current match highlight */

/* ===== Drag & Drop ===== */
--redactix-drag-bg: #dbeafe;           /* Dragging element background */
--redactix-dragover-bg: #eff6ff;       /* Drop zone highlight */

/* ===== Code Editor (HTML mode) - Always dark ===== */
--redactix-code-editor-bg: #1e1e1e;
--redactix-code-editor-gutter: #252526;
--redactix-code-editor-text: #d4d4d4;
--redactix-code-editor-line: #858585;
--redactix-code-editor-selection: #264f78;

/* ===== Floating Toolbar - Always dark ===== */
--redactix-floating-bg: #1f2937;
--redactix-floating-text: #e5e7eb;
--redactix-floating-separator: rgba(255, 255, 255, 0.2);
```

### What's Themed

The theme system covers all UI elements:
- Editor area (background, text, borders)
- Toolbar and buttons
- **Modal dialogs** (backgrounds, inputs, buttons)
- Dropdown menus and context menus
- Find & Replace panel
- Slash commands menu
- Callouts and blockquotes
- Code blocks and inline code

### Dark Theme Values

When `.redactix-dark` is applied:

```css
.redactix-wrapper.redactix-dark {
    --redactix-primary: #3b82f6;
    --redactix-border: #374151;
    --redactix-bg: #1f2937;
    --redactix-bg-secondary: #111827;
    --redactix-bg-hover: #374151;
    --redactix-text: #f3f4f6;
    --redactix-text-muted: #9ca3af;
    /* ... and more */
}
```

### Example: Custom Brand Theme

```css
/* Company brand colors */
.redactix-wrapper.brand-theme {
    --redactix-primary: #6366f1;           /* Indigo */
    --redactix-primary-hover: #4f46e5;
    --redactix-primary-light: #e0e7ff;
    --redactix-primary-rgb: 99, 102, 241;
    --redactix-radius: 12px;               /* More rounded */
}
```

```javascript
// Apply the theme
const editor = new Redactix({ selector: '.redactix' });
document.querySelector('.redactix-wrapper').classList.add('brand-theme');
```

### Example: Dark Theme with Custom Accent

```css
/* Override the built-in dark theme */
.redactix-wrapper.redactix-dark {
    --redactix-primary: #a855f7;        /* Purple accent */
    --redactix-primary-hover: #9333ea;
    --redactix-primary-light: #3b1f5e;
}
```

```javascript
new Redactix({
    selector: '.redactix',
    theme: 'dark'  // Uses your customized dark theme
});
```

### Example: Fully Custom Dark Theme

```css
/* Create your own dark theme class */
.redactix-wrapper.my-dark {
    --redactix-border: #2d2d44;
    --redactix-bg: #1a1a2e;
    --redactix-bg-secondary: #16162a;
    --redactix-bg-hover: #2d2d44;
    --redactix-text: #e2e2e2;
    --redactix-text-muted: #a0a0a0;
    --redactix-primary: #818cf8;
    --redactix-primary-hover: #a5b4fc;
}
```

```javascript
// Initialize without theme, add class manually
new Redactix({ selector: '.redactix' });
document.querySelector('.redactix-wrapper').classList.add('my-dark');
```

### Custom Callout Styles

```css
.redactix-editor aside.my-custom {
    background: #f0f9ff;
    border-color: #0ea5e9;
    color: #075985;
}
```

```javascript
new Redactix({
    calloutPresets: [
        { name: 'custom', label: 'My Style', class: 'my-custom' }
    ]
});
```

---

## 🌍 Internationalization

Redactix comes with built-in support for multiple languages and Right-to-Left (RTL) text direction.

### Setting the Language

Specify the `locale` option during initialization:

```javascript
new Redactix({
    selector: '.redactix',
    locale: 'ru' // Set language to Russian
});
```

### Supported Languages

| Code | Language |
|------|----------|
| `en` | English |
| `ru` | Russian |

To add another language, drop a new file into [redactix/i18n/](redactix/i18n/) using `en.js` as a template and import it from [redactix/i18n/index.js](redactix/i18n/index.js). Add the locale code to the `rtlLocales` array if it's a Right-to-Left language.

### RTL Support

Redactix automatically detects RTL languages (codes listed in `rtlLocales` inside [i18n/index.js](redactix/i18n/index.js); `ar`, `he`, `fa`, `ur` by default) and adjusts the UI accordingly:
- Toolbar alignment
- Text direction
- UI elements positioning

No extra configuration is needed—just set the `locale`.

---

## 🔌 Backend Integration

### Laravel Example

```php
// Controller
public function store(Request $request)
{
    $validated = $request->validate([
        'content' => 'required|string'
    ]);
    
    // Redactix content is already HTML
    $article->content = $validated['content'];
    $article->save();
}

// Blade template
<textarea name="content" class="redactix">
    {!! old('content', $article->content) !!}
</textarea>
```

### WordPress Example

```php
// Add to functions.php
function enqueue_redactix() {
    wp_enqueue_style('redactix', get_template_directory_uri() . '/redactix/Redactix.css');
    wp_enqueue_script('redactix', get_template_directory_uri() . '/redactix/Redactix.js', [], false, true);
}
add_action('wp_enqueue_scripts', 'enqueue_redactix');

// Use in template
<textarea class="redactix" name="content">
    <?php echo esc_html(get_post_meta($post->ID, 'content', true)); ?>
</textarea>
```

### Express.js Example

```javascript
app.post('/articles', (req, res) => {
    const content = req.body.content;
    // Sanitize on server if needed
    const sanitized = DOMPurify.sanitize(content);
    // Save to database
    db.articles.insert({ content: sanitized });
});
```

---

## 🧪 Testing

### Demo Mode

Use `redactix_images_demo.php` for testing without cluttering your uploads folder:

```javascript
new Redactix({
    uploadUrl: '/redactix_images_demo.php',
    browseUrl: '/redactix_images_demo.php'
});
```

### Manual Testing Checklist

- [ ] Upload images via drag & drop
- [ ] Upload images via paste
- [ ] Upload images via file picker
- [ ] Browse uploaded images
- [ ] Edit existing images
- [ ] Delete images (if enabled)
- [ ] Paste from Google Docs (with images)
- [ ] Paste from Word
- [ ] Drag & drop blocks
- [ ] Touch drag on mobile
- [ ] Undo/redo operations
- [ ] Find & replace
- [ ] Fullscreen mode
- [ ] HTML mode
- [ ] Multiple editors on one page

---

## 🐛 Troubleshooting

### Images Not Uploading

1. Check `uploadUrl` is set correctly
2. Verify PHP script has write permissions to uploads folder
3. Check PHP `upload_max_filesize` and `post_max_size`
4. Open browser console for error messages

### Sticky Toolbar Not Working

- Toolbar is sticky only when no `maxHeight` is set
- In fullscreen mode, toolbar is static
- Check browser console for JavaScript errors

### Base64 Images Not Converting

1. Ensure `uploadUrl` is configured
2. Check browser console for upload errors
3. Verify server accepts POST requests
4. Check server response format (must be JSON)

### Drag & Drop Not Working on Mobile

- Long press (500ms) to open menu
- Drag immediately to reorder blocks
- Ensure no other touch handlers are interfering

---

## 📄 License

MIT License - feel free to use in personal and commercial projects.

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/fedorananin/redactix/issues)
- **Documentation**: See `index.html` for live examples
- **Questions**: Open a discussion on GitHub

---

**Made with vanilla JavaScript. No frameworks. No dependencies. Just clean code.**
