# Redactix

Modern WYSIWYG editor with Notion-like experience. Clean HTML output. Zero dependencies. Vanilla JS.

![Redactix Editor](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Vanilla JS](https://img.shields.io/badge/vanilla-js-yellow.svg)

**Compatible with everything that can work with a plain `<textarea>`.**

---

## ✨ Features

### Core Features
- 🎨 **Notion-like UI** — Floating toolbar for text selection, block handles for drag & drop
- 📝 **Rich Text Formatting** — Bold, italic, underline, strikethrough, inline code, highlights, spoilers
- 🔗 **Advanced Links** — Full control over href, title, target, rel attributes (nofollow, sponsored, ugc)
- 📋 **Lists** — Ordered and unordered lists with drag & drop reordering and nesting
- 🎯 **Block Controls** — Drag handle on hover, context menu for transformations
- 🖼️ **Images** — Upload, browse gallery, drag & drop, paste from clipboard, auto-upload base64
- 📊 **Tables** — Full-featured tables with row/column manipulation
- 💬 **Quotes & Callouts** — Blockquotes with styles, aside blocks with presets (info, warning, danger, success)
- 🎬 **YouTube Embeds** — Automatic responsive video wrapper
- 📱 **Touch Support** — Full mobile support with touch events for drag & drop
- ⌨️ **Markdown Shortcuts** — `#`, `##`, `###`, `*`, `-`, `1.`, `>`, `!`, `---` for quick formatting
- 🔍 **Find & Replace** — Built-in search with navigation and replace functionality
- 🕐 **History** — Unlimited undo/redo with smart batching
- 🌐 **HTML Mode** — Switch to raw HTML editing with syntax highlighting
- 🔄 **Auto-sync** — Automatic synchronization with original textarea
- 🎯 **Element Attributes** — Edit ID (anchors) and CSS classes for any element
- 📏 **Word/Character Counter** — Real-time statistics in the bottom right
- 🖥️ **Fullscreen Mode** — Distraction-free editing experience
- 📐 **Configurable Height** — Set maximum height for the editor area

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
GET /redactix_images.php?action=browse

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
Content-Type: application/x-www-form-urlencoded
Body: action=delete&file=image.jpg

Response:
{
    "success": true,
    "message": "File deleted successfully"
}
```

---

## ⚙️ Configuration

### Basic Options

```javascript
new Redactix({
    selector: '.redactix',              // CSS selector for textareas
    uploadUrl: '/upload.php',           // Image upload endpoint
    browseUrl: '/browse.php',           // Image gallery endpoint
    allowImageDelete: true,             // Show delete buttons in gallery
    maxHeight: '500px',                 // Maximum editor height
    classes: ['highlight', 'centered'], // Quick-select classes in Attributes
});
```

### Custom Presets

```javascript
new Redactix({
    selector: '.redactix',
    
    // Custom callout (aside) styles
    calloutPresets: [
        { name: 'note', label: 'Note', class: 'my-note' },
        { name: 'tip', label: 'Pro Tip', class: 'my-tip' }
    ],
    
    // Custom blockquote styles
    quotePresets: [
        { name: 'pull', label: 'Pull Quote', class: 'pull-quote' },
        { name: 'testimonial', label: 'Testimonial', class: 'testimonial' }
    ]
});
```

---

## ⌨️ Keyboard Shortcuts

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

### Context Menu

Right-click or click the handle to:
- Transform block type (H1, H2, H3, P, Quote, Callout)
- Change callout/quote style
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
│   ├── BlockStyles.js    # Headings, paragraphs
│   ├── Code.js           # Code blocks
│   ├── FindReplace.js    # Search functionality
│   ├── FloatingToolbar.js # Text selection toolbar
│   ├── Fullscreen.js     # Fullscreen mode
│   ├── History.js        # Undo/redo
│   ├── HtmlMode.js       # Raw HTML editor
│   ├── Image.js          # Image upload and management
│   ├── Link.js           # Link insertion
│   ├── List.js           # Lists (UL/OL)
│   ├── Markdown.js       # Markdown shortcuts
│   ├── Separator.js      # Horizontal rules
│   ├── Table.js          # Table management
│   └── Youtube.js        # Video embeds
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

<blockquote>Standard quote</blockquote>
<blockquote class="big">Large quote</blockquote>

<aside class="warning">Warning callout</aside>

<figure>
    <img src="/uploads/image.jpg" alt="Description">
    <figcaption>Image caption</figcaption>
</figure>

<table>
    <thead>
        <tr><th>Header</th></tr>
    </thead>
    <tbody>
        <tr><td>Cell</td></tr>
    </tbody>
</table>

<div class="redactix-video-wrapper">
    <iframe src="https://www.youtube.com/embed/VIDEO_ID"></iframe>
</div>

<div class="redactix-separator"><hr></div>

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

## 🎨 Customization

### CSS Variables

```css
:root {
    --redactix-primary: #2563eb;
    --redactix-primary-hover: #1d4ed8;
    --redactix-danger: #dc2626;
    --redactix-border: #e5e7eb;
    --redactix-bg: #ffffff;
    --redactix-bg-hover: #f3f4f6;
    --redactix-text: #374151;
    --redactix-text-muted: #6b7280;
    --redactix-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    --redactix-radius: 6px;
}
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

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Development Setup

```bash
git clone https://github.com/yourusername/redactix.git
cd redactix
# No build step required - pure vanilla JS!
# Just open index.html in your browser
```

### Code Style

- Use ES6 modules
- Follow existing code structure
- Comment complex logic
- Keep modules focused and single-purpose

---

## 🌟 Credits

Created with ❤️ for content creators who need a powerful, lightweight editor without the bloat of heavy frameworks.

Inspired by:
- Notion's elegant UI
- Medium's focused writing experience
- WordPress Gutenberg's block concept

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/redactix/issues)
- **Documentation**: See `index.html` for live examples
- **Questions**: Open a discussion on GitHub

---

**Made with vanilla JavaScript. No frameworks. No dependencies. Just clean code.**
