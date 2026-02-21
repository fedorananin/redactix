# How to Integrate Redactix into Your CMS

Redactix is a modern, zero-dependency WYSIWYG editor that replaces a standard `<textarea>` with a rich Notion-like editing experience. It generates clean, semantic HTML and supports custom configurations out of the box.

This guide will walk you through integrating Redactix into your content management system (CMS).

---

## 1. Include the Required Files

You only need two files to run Redactix: the core CSS stylesheet and the main JavaScript module.

Place the `redactix` folder into your public assets directory (e.g., `public/assets/redactix`). Then, link them in the `<head>` or at the bottom of your `<body>` tag:

```html
<!-- Load the Redactix stylesheet -->
<link rel="stylesheet" href="/assets/redactix/Redactix.css">

<!-- Load the core script as an ES Module -->
<script type="module">
    import Redactix from '/assets/redactix/Redactix.js';
    
    // Initialize the editor
    document.addEventListener("DOMContentLoaded", () => {
        new Redactix({
            selector: '.redactix-editor', // Target all textareas with this class
            theme: 'dark' // 'dark', 'light' or 'auto'
        });
    });
</script>
```

> **Note:** Redactix is distributed as native ES Modules. Therefore, adding `type="module"` to the `<script>` tag is mandatory.

---

## 2. Setup the HTML

Simply add the defined CSS class (`.redactix-editor`) to whatever standard `<textarea>` you intend to convert.

```html
<form action="/admin/save-post" method="POST">
    <label for="post-content">Post Content:</label>
    
    <!-- Redactix binds to this element -->
    <textarea id="post-content" name="content" class="redactix-editor">
        <h1>Welcome to Redactix!</h1>
        <p>Edit this content to get started.</p>
    </textarea>
    
    <button type="submit">Publish</button>
</form>
```

**How it works seamlessly with your backend:**
When a `<textarea>` is converted, Redactix visually hides the original area. However, it will automatically synchronize all edits back to the `<textarea>`'s `.value` property. Wait until form submission—the CMS receives the data just as if an ordinary textarea had been used. 

---

## 3. Configure Media Uploads (Images)

To upload, browse, and delete images directly inside the editor, you must configure a backend endpoint script.

You can use the bundled `redactix_images.php` script, or develop your own logic (e.g., using Node.js, Laravel Controllers, or Python Django).

### Option A: Using the provided PHP Script

1. Copy `redactix_images.php` to an accessible location like `/admin/controllers/redactix_images.php`.
2. Open `redactix_images.php` and configure the constants at the top:

```php
// Where uploaded files will be physically stored
$uploadDir = __DIR__ . '/../../uploads/images/';

// The URL prefix so the browser knows where to load them
$uploadUrlPrefix = '/uploads/images/';

// Setting `true` will allow deleting images from the "Browse" Gallery
$allowDelete = true;
```

### Option B: Using a custom Backend Framework (e.g. Node/Express, Laravel)

Redactix makes `POST` requests to your endpoints and expects `JSON` back.

**Upload Action (`action=upload` or empty):**
- Method: `POST`
- Payload: `multipart/form-data` with the file under the key `image`.
- Expected Response: 
  ```json
  {
      "success": true, 
      "src": "/uploads/image.jpg",
      "srcset": "",
      "alt": "",
      "title": "",
      "caption": ""
  }
  ```

**Browse Action (`action=browse`):**
- Method: `POST` 
- Payload: `multipart/form-data` with `action=browse`.
- Expected Response:
  ```json
  {
      "success": true,
      "images": [
          { "src": "/uploads/image.jpg", "filename": "image.jpg", "size": "1.2 MB", "sizeBytes": 1258291, "modified": 1638360000 }
      ],
      "allowDelete": true
  }
  ```

**Delete Action (`action=delete`):**
- Method: `POST`
- Payload: `multipart/form-data` with `action=delete` and `file=image.jpg`.
- Expected Response: `{ "success": true, "message": "Success" }`


### Link Endpoints in Javascript

Finally, add the URLs to your Javascript initialization:

```javascript
new Redactix({
    selector: '.redactix-editor',
    theme: 'auto',
    
    // Set Endpoints
    uploadUrl: '/admin/controllers/redactix_images.php', 
    browseUrl: '/admin/controllers/redactix_images.php', 
    
    // Enable "Delete" feature visual buttons
    allowImageDelete: true 
});
```

---

## 4. Retrieving the Content Programmatically

If you are saving posts via AJAX/Fetch rather than standard HTML form submission, you might want to retrieve the editor's content programmatically.

Each initialized `<textarea>` DOM element receives a custom `.redactix` property holding the instance methods.

```javascript
const myTextarea = document.querySelector('#post-content');

// Get clean, un-wrapped HTML
const htmlContent = myTextarea.redactix.getContent();

// Sending via fetch
fetch('/admin/api/save', {
    method: 'POST',
    body: JSON.stringify({ content: htmlContent }),
    headers: { 'Content-Type': 'application/json' }
});

// Setting content programmatically
myTextarea.redactix.setContent('<h2>New replacement text</h2>');
```

---

## 5. Summary of Advanced Features

You can tailor Redactix further into your specific usage cases:

### Lite Mode (For Comments)
If you are deploying Redactix for User Comments rather than CMS Authoring, enable Lite Mode. It suppresses the formatting toolbar, removes internal HTML class attributes manipulation, forces `rel="nofollow"` to user links, and prevents uploading/browsing files.

```javascript
new Redactix({
    selector: '.comment-box',
    liteMode: true 
});
```

### Passing Authentication Tokens
If your CMS relies on REST APIs holding Bearer Tokens, adjust the URLs. Redactix currently does not have a `headers` injection object inside the configuration config block, so your URLs should handle cookie-based authentication by default or embed GET tokens securely:

```javascript
const secretToken = "my-auth-token";

new Redactix({
    selector: '.redactix-editor',
    uploadUrl: `/api/upload?token=${secretToken}`, // Add authorization GET param
    browseUrl: `/api/upload?token=${secretToken}` 
});
```

### Pre-Defined Attributes
You can present visual `classes` pre-sets via the UI modal when writers select and edit components (e.g., adding `.highlight` directly to a `<p>` via the editor).

```javascript
new Redactix({
    selector: '.redactix-editor',
    classes: ['is-highlighted', 'text-centered', 'responsive-table']
});
```
