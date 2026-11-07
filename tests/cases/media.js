// media suite — Image, Gallery, Video, Embed, the upload client, the
// browse panel and the production embed runtime.
import { test, assert, eq, includes, excludes, makeEditor, sleep, caret, textNode, paste } from '../lib.js';
import { cleanMediaRecord, browse, errorMessage } from '../../redactix/core/media-client.js';
import { parseResizeMessage, isResizeOrigin, withTwitchParent, RESIZE_ORIGINS } from '../../redactix/core/embed-protocol.js';
import { createBrowsePanel, createMediaBrowsePanel, createUploadPlaceholder, showPlaceholderError } from '../../redactix/ui/media-ui.js';

const PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const PNG = 'data:image/png;base64,' + PNG_B64;
const UPLOAD = '/redactix_images_demo.php';
const MISSING = '/redactix-no-such-endpoint.php';

const mod = (ed, name) => ed.getModule(name);
const history = (ed) => ed.getModule('History');
const t = (k) => k;

function pngFile(name = 'shot.png') {
    const bin = atob(PNG_B64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new File([bytes], name, { type: 'image/png' });
}

async function waitFor(fn, timeout = 5000, step = 25) {
    const start = performance.now();
    while (performance.now() - start < timeout) {
        const v = fn();
        if (v) return v;
        await sleep(step);
    }
    throw new Error('waitFor timed out: ' + fn);
}

/** Modal form control by the start of its label text. */
function field(ed, labelStart) {
    const label = Array.from(ed.modal.container.querySelectorAll('label'))
        .find(l => l.textContent.trim().startsWith(labelStart));
    if (!label) throw new Error('no field labelled ' + labelStart);
    return label.htmlFor ? document.getElementById(label.htmlFor) : label.querySelector('input, textarea, select');
}

function modalButton(ed, text) {
    const btn = Array.from(ed.modal.container.querySelectorAll('button')).find(b => b.textContent.trim() === text);
    if (!btn) throw new Error('no button ' + text);
    return btn;
}

function setFiles(input, files) {
    const dt = new DataTransfer();
    files.forEach(f => dt.items.add(f));
    input.files = dt.files;
    input.dispatchEvent(new Event('change'));
}

/** Count network requests (XHR + fetch) until restore(). */
function countRequests() {
    const send = XMLHttpRequest.prototype.send;
    const abort = XMLHttpRequest.prototype.abort;
    const origFetch = window.fetch;
    const c = { n: 0, aborts: 0 };
    XMLHttpRequest.prototype.send = function (...a) { c.n++; return send.apply(this, a); };
    XMLHttpRequest.prototype.abort = function (...a) { c.aborts++; return abort.apply(this, a); };
    window.fetch = function (...a) { c.n++; return origFetch.apply(this, a); };
    c.restore = () => {
        XMLHttpRequest.prototype.send = send;
        XMLHttpRequest.prototype.abort = abort;
        window.fetch = origFetch;
    };
    return c;
}

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src;
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
    });
}

export default async function () {
    // ------------------------------------------------------------------
    // Image modal
    // ------------------------------------------------------------------

    await test('media: image edit ignores a link inside the caption (B1)', async () => {
        const ed = makeEditor('<figure><img src="/uploads/cat.jpg" alt="c"><figcaption>See <a href="https://example.com/">here</a></figcaption></figure><p>x</p>');
        mod(ed, 'Image').openModal(ed.editorEl.querySelector('figure'));
        eq(field(ed, 'Link URL').value, '', 'link field is not the caption link');
        ed.modal.save();
        eq(ed.modal.isOpen, false);
        includes(ed.getContent(), '<figure><img src="/uploads/cat.jpg" alt="c"><figcaption>See <a href="https://example.com/">here</a></figcaption></figure>');
    });

    await test('media: clearing an image link keeps image and caption (B1)', async () => {
        const ed = makeEditor('<figure><a href="https://l.example/"><img src="/uploads/cat.jpg"></a><figcaption>c <a href="https://x.example/">x</a></figcaption></figure><p>x</p>');
        mod(ed, 'Image').openModal(ed.editorEl.querySelector('figure'));
        const link = field(ed, 'Link URL');
        eq(link.value, 'https://l.example/');
        link.value = '';
        ed.modal.save();
        includes(ed.getContent(), '<figure><img src="/uploads/cat.jpg"><figcaption>c <a href="https://x.example/">x</a></figcaption></figure>');
    });

    await test('media: standalone image becomes a figure next to its paragraph (B11)', async () => {
        const ed = makeEditor('<p>Hello <img src="/uploads/cat.jpg"> world</p><p>Tail</p>');
        mod(ed, 'Image').openModal(null, ed.editorEl.querySelector('img'));
        ed.modal.save();
        eq(ed.editorEl.querySelector('p figure'), null, 'no <figure> inside <p>');
        const out = ed.getContent();
        assert(/world<\/p><figure><img src="\/uploads\/cat\.jpg"><\/figure><p>Tail<\/p>/.test(out), out);

        const ed2 = makeEditor('<p><img src="/uploads/cat.jpg">text</p>');
        mod(ed2, 'Image').openModal(null, ed2.editorEl.querySelector('img'));
        ed2.modal.save();
        assert(ed2.getContent().startsWith('<figure><img src="/uploads/cat.jpg"></figure><p>text</p>'), ed2.getContent());
    });

    await test('media: removing an image inside a text link keeps the link text (B11)', async () => {
        const ed = makeEditor('<p><a href="https://x.example/">text <img src="/uploads/cat.jpg"></a> after</p>');
        mod(ed, 'Image').openModal(null, ed.editorEl.querySelector('img'));
        modalButton(ed, 'Remove Image').click();
        const out = ed.getContent();
        excludes(out, '<img');
        includes(out, '<a href="https://x.example/">text </a>');
    });

    await test('media: invalid input keeps modals open with an error (B6)', async () => {
        const ed = makeEditor('<p>a</p>');
        caret(textNode(ed.editorEl, 'a'), 1);

        mod(ed, 'Embed').openModal();
        field(ed, 'URL').value = 'https://example.com/not-a-provider';
        ed.modal.save();
        eq(ed.modal.isOpen, true, 'embed modal stays open');
        includes(ed.modal.container.querySelector('.redactix-form-status').textContent, 'not supported');
        ed.modal.close();

        mod(ed, 'Video').openModal();
        field(ed, 'Video URL').value = 'javascript:alert(1)';
        ed.modal.save();
        eq(ed.modal.isOpen, true, 'video modal stays open');
        ed.modal.close();

        mod(ed, 'Image').openModal();
        field(ed, 'Image URL').value = 'javascript:alert(1)';
        ed.modal.save();
        eq(ed.modal.isOpen, true, 'image modal stays open');
        ed.modal.close();
        excludes(ed.getContent(), 'javascript');

        // Editing a gallery whose every URL became invalid must not delete it.
        const ed2 = makeEditor('<figure class="redactix-gallery"><div class="redactix-gallery-grid"><img src="/uploads/cat.jpg"></div></figure><p>x</p>');
        mod(ed2, 'Gallery').openModal(ed2.editorEl.querySelector('figure'));
        const input = ed2.modal.container.querySelector('.redactix-gallery-input');
        input.value = 'javascript:alert(1)';
        input.dispatchEvent(new Event('input'));
        ed2.modal.save();
        eq(ed2.modal.isOpen, true, 'gallery modal stays open');
        assert(ed2.editorEl.querySelector('figure.redactix-gallery img[src="/uploads/cat.jpg"]'), 'gallery kept');
        ed2.modal.close();
    });

    await test('media: image modal blocks Save while uploading, closing aborts (B6, P2)', async () => {
        const c = countRequests();
        try {
            const ed = makeEditor('<p>a</p>', { uploadUrl: UPLOAD });
            caret(textNode(ed.editorEl, 'a'), 1);
            mod(ed, 'Image').openModal();
            setFiles(ed.modal.container.querySelector('input[type=file]'), [pngFile()]);
            ed.modal.save();
            eq(ed.modal.isOpen, true, 'open while pending');
            includes(ed.modal.container.textContent, 'Wait until the upload finishes');
            await waitFor(() => field(ed, 'Image URL').value === '/uploads/default.jpg');
            ed.modal.save();
            eq(ed.modal.isOpen, false);
            includes(ed.getContent(), '<img src="/uploads/default.jpg">');

            mod(ed, 'Image').openModal();
            setFiles(ed.modal.container.querySelector('input[type=file]'), [pngFile()]);
            ed.modal.close();
            eq(c.aborts, 1, 'upload aborted on close');
        } finally {
            c.restore();
        }
    });

    // ------------------------------------------------------------------
    // Uploads from the editor surface
    // ------------------------------------------------------------------

    await test('media: pasted data: image uploads once; undo / setContent never re-upload (B2)', async () => {
        const c = countRequests();
        try {
            const ed = makeEditor('<p>a</p>', { uploadUrl: UPLOAD });
            caret(textNode(ed.editorEl, 'a'), 1);
            paste(ed.editorEl, { html: `<p>t</p><img src="${PNG}">` });
            await waitFor(() => ed.editorEl.querySelector('img[src="/uploads/default.jpg"]'));
            eq(c.n, 1, 'one upload');
            excludes(ed.getContent(), 'data:');
            excludes(ed.getContent(), 'redactix-uploading');

            history(ed).undo();
            await sleep(400);
            eq(c.n, 1, 'undo does not upload');
            assert(ed.editorEl.querySelector('img'), 'image not deleted by undo');

            ed.setContent(`<figure><img src="${PNG}"></figure>`);
            await sleep(400);
            eq(c.n, 1, 'setContent does not upload');
            assert(ed.editorEl.querySelector('img[src^="data:"]'), 'loaded data: image is left alone');
        } finally {
            c.restore();
        }
    });

    await test('media: failed pasted upload removes only that image (B2)', async () => {
        const ed = makeEditor('<p>a</p>', { uploadUrl: MISSING });
        caret(textNode(ed.editorEl, 'a'), 1);
        paste(ed.editorEl, { html: `<figure class="redactix-gallery"><div class="redactix-gallery-grid"><img src="/uploads/cat.jpg"><img src="${PNG}"></div></figure>` });
        await waitFor(() => !ed.editorEl.querySelector('img[src^="data:"]'));
        const gallery = ed.editorEl.querySelector('figure.redactix-gallery');
        assert(gallery, 'gallery kept');
        eq(gallery.querySelectorAll('img').length, 1);

        const ed2 = makeEditor('<p>a</p>', { uploadUrl: MISSING });
        caret(textNode(ed2.editorEl, 'a'), 1);
        paste(ed2.editorEl, { html: `<p>t</p><img src="${PNG}">` });
        await waitFor(() => !ed2.editorEl.querySelector('img'));
        eq(ed2.editorEl.querySelector('figure'), null, 'empty plain figure removed');
        includes(ed2.getContent(), '<p>t</p>');
    });

    await test('media: drop upload: placeholder is UI-only, result is one undo step (B3, B7)', async () => {
        const ed = makeEditor('<p>a</p>', { uploadUrl: UPLOAD });
        caret(textNode(ed.editorEl, 'a'), 1);
        const done = mod(ed, 'Image').uploadFiles([pngFile()]);
        const ph = ed.editorEl.querySelector('.redactix-upload-placeholder');
        assert(ph && ph.hasAttribute('data-redactix-ui'), 'placeholder flagged as UI');
        const pending = ed.getContent();
        excludes(pending, 'placeholder');
        excludes(pending, 'Uploading');
        await done;
        includes(ed.getContent(), '<figure><img src="/uploads/default.jpg"></figure>');
        history(ed).undo();
        excludes(ed.getContent(), 'default.jpg');
    });

    await test('media: upload errors are shown as text, never HTML (S1)', async () => {
        const ph = createUploadPlaceholder('Uploading');
        showPlaceholderError(ph, '<img src=x onerror="window.__redactixXss=1">', 'Remove');
        eq(ph.querySelector('img'), null);
        includes(ph.textContent, '<img src=x');

        const ed = makeEditor('<p>a</p>', { uploadUrl: MISSING });
        caret(textNode(ed.editorEl, 'a'), 1);
        await mod(ed, 'Image').uploadFiles([pngFile()]);
        const box = ed.editorEl.querySelector('.redactix-upload-error');
        assert(box, 'error shown');
        // 404 page or the dev server's index.html fallback, depending on the server.
        assert(/Server error \(404\)|Invalid server response/.test(box.textContent), box.textContent);
        excludes(ed.getContent(), 'Server error');
    });

    await test('media: Excel-style paste (html + png) is not hijacked (B5)', async () => {
        const ed = makeEditor('<p>a</p>', { uploadUrl: UPLOAD });
        caret(textNode(ed.editorEl, 'a'), 1);
        const dt = new DataTransfer();
        dt.setData('text/html', '<table><tr><td>1</td><td>2</td></tr></table>');
        dt.setData('text/plain', '1\t2');
        dt.items.add(pngFile());
        ed.editorEl.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
        eq(ed.editorEl.querySelector('.redactix-upload-placeholder'), null, 'no upload');
        includes(ed.getContent(), '<td>1</td>');

        // "Copy image" from a browser: html is a single <img> → upload.
        const dt2 = new DataTransfer();
        dt2.setData('text/html', '<meta charset="utf-8"><img src="https://example.com/x.png">');
        dt2.items.add(pngFile());
        ed.editorEl.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt2, bubbles: true, cancelable: true }));
        assert(ed.editorEl.querySelector('.redactix-upload-placeholder'), 'image upload started');
        await waitFor(() => !ed.editorEl.querySelector('.redactix-upload-placeholder'));
    });

    await test('media: dropped files land at the drop point (B9)', async () => {
        const ed = makeEditor('<p>first</p><p>second</p><p>third</p>', { uploadUrl: UPLOAD });
        const paras = ed.editorEl.querySelectorAll('p');
        caret(textNode(paras[0], 'first'), 0);
        paras[1].scrollIntoView({ block: 'center' });
        const r = paras[1].getBoundingClientRect();
        const dt = new DataTransfer();
        dt.items.add(pngFile());
        ed.editorEl.dispatchEvent(new DragEvent('drop', {
            dataTransfer: dt, clientX: r.left + 5, clientY: r.top + r.height / 2, bubbles: true, cancelable: true
        }));
        const ph = ed.editorEl.querySelector('.redactix-upload-placeholder');
        assert(ph, 'placeholder inserted');
        eq(ph.previousElementSibling, paras[1], 'after the paragraph it was dropped on');
        await waitFor(() => !ed.editorEl.querySelector('.redactix-upload-placeholder'));
    });

    await test('media: data: URL parsing tolerates params and line breaks (B11)', async () => {
        const ed = makeEditor('<p>a</p>');
        const image = mod(ed, 'Image');
        const f = image.base64ToFile('data:image/png;name=shot.png;base64,iVBORw0K\nGgoAAAANSUhEUg');
        assert(f && f.type === 'image/png' && /\.png$/.test(f.name), 'parsed');
        eq(image.base64ToFile('data:image/svg+xml;base64,PHN2Zz4='), null, 'svg refused');
        eq(image.base64ToFile('nonsense'), null);
    });

    // ------------------------------------------------------------------
    // Upload client / browse panel
    // ------------------------------------------------------------------

    await test('media: server data is sanitised in one place (S2)', async () => {
        eq(cleanMediaRecord({ src: 'javascript:alert(1)' }), null);
        eq(cleanMediaRecord({ src: 'data:text/html,x' }, 'video'), null);
        const r = cleanMediaRecord({ src: '/a.jpg', srcset: 'javascript:x 1x', caption: '<img src=x onerror=alert(1)>Hi <b>b</b>', alt: 5 });
        eq(r.srcset, '');
        eq(r.caption, 'Hi <b>b</b>');
        eq(r.alt, '5');
        eq(errorMessage({ ok: false, code: 'server', error: 'Nope' }, t), 'Nope');
        eq(errorMessage({ ok: false, code: 'tooLarge', error: '' }, t), 'upload.tooLarge');
        eq(errorMessage({ ok: false, code: 'aborted' }, t), '');
    });

    await test('media: browse supports offset/limit and keeps the old shape (P1)', async () => {
        const all = await browse(UPLOAD, 'image');
        assert(all.ok, 'ok');
        assert(all.data.items.length >= 2, 'demo has images');
        eq(all.data.total, all.data.items.length);
        const page = await browse(UPLOAD, 'image', { offset: 1, limit: 1 });
        eq(page.data.items.length, 1);
        eq(page.data.items[0].src, all.data.items[1].src);
        eq(page.data.limit, 1);
    });

    await test('media: browse delete needs client AND server permission; paging works (B11, P1)', async () => {
        const items = [1, 2, 3].map(i => ({ src: `/uploads/${i}.jpg`, filename: `${i}.jpg`, size: '1 KB' }));
        const make = (clientAllow, serverAllow) => createBrowsePanel({
            labels: { button: 'b', loading: 'l', empty: 'e', close: 'c', loadMore: 'more', deleteTooltip: 'd' },
            pageSize: 2,
            fetchPage: async ({ offset, limit }) => ({ ok: true, data: { items: items.slice(offset, offset + limit), allowDelete: serverAllow, total: items.length } }),
            renderTile: () => document.createElement('span'),
            allowDelete: clientAllow,
            deleteItem: async () => ({ ok: true, data: {} }),
            selectedText: () => 's',
            errorText: () => 'err',
            onSelect: () => {}
        });
        for (const [a, b] of [[false, true], [true, false], [true, true]]) {
            const panel = make(a, b);
            document.body.appendChild(panel.element);
            await panel.open();
            eq(!!panel.element.querySelector('.redactix-browse-delete'), a && b, `client=${a} server=${b}`);
            panel.element.remove();
        }
        const panel = make(false, false);
        document.body.appendChild(panel.element);
        await panel.open();
        eq(panel.element.querySelectorAll('.redactix-browse-tile').length, 2);
        panel.element.querySelector('.redactix-browse-more').click();
        await waitFor(() => panel.element.querySelectorAll('.redactix-browse-tile').length === 3);
        eq(panel.element.querySelector('.redactix-browse-more'), null, 'no more pages');
        panel.element.remove();
    });

    await test('media: video browse tiles load lazily (P1)', async () => {
        const panel = createMediaBrowsePanel({ t, type: 'video', url: UPLOAD, onSelect: () => {} });
        document.body.appendChild(panel.element);
        try {
            await panel.open();
            const video = panel.element.querySelector('.redactix-browse-tile video');
            assert(video, 'tile rendered');
            eq(video.getAttribute('src'), null, 'no request before visible');
            await waitFor(() => video.getAttribute('src') === '/uploads/default.mp4');
            eq(video.preload, 'metadata');
        } finally {
            panel.destroy();
            panel.element.remove();
        }
    });

    // ------------------------------------------------------------------
    // Gallery
    // ------------------------------------------------------------------

    await test('media: gallery re-save keeps attributes, rel tokens, classes, <br> (B11)', async () => {
        const ed = makeEditor('<figure class="redactix-gallery my-class"><div class="redactix-gallery-grid"><a href="https://x.example/" rel="sponsored nofollow" target="_blank"><img src="/uploads/cat.jpg" alt="c" title="T" srcset="/uploads/cat.jpg 1x" loading="lazy"></a></div><figcaption>a<br>b</figcaption></figure><p>x</p>');
        mod(ed, 'Gallery').openModal(ed.editorEl.querySelector('figure'));
        ed.modal.save();
        eq(ed.modal.isOpen, false);
        const out = ed.getContent();
        includes(out, 'class="redactix-gallery my-class"');
        includes(out, 'title="T"');
        includes(out, 'srcset="/uploads/cat.jpg 1x"');
        includes(out, 'loading="lazy"');
        includes(out, 'sponsored');
        includes(out, '<figcaption>a<br>b</figcaption>');
    });

    await test('media: gallery Save waits for pending uploads (B6)', async () => {
        const ed = makeEditor('<figure class="redactix-gallery"><div class="redactix-gallery-grid"><img src="/uploads/cat.jpg"></div></figure><p>x</p>', { uploadUrl: UPLOAD });
        mod(ed, 'Gallery').openModal(ed.editorEl.querySelector('figure'));
        setFiles(ed.modal.container.querySelector('input[type=file]'), [pngFile('a.png'), pngFile('b.png')]);
        ed.modal.save();
        eq(ed.modal.isOpen, true, 'kept open while uploading');
        await waitFor(() => ed.modal.container.querySelectorAll('.redactix-gallery-thumb img').length === 3, 5000);
        ed.modal.save();
        eq(ed.modal.isOpen, false);
        eq(ed.editorEl.querySelectorAll('figure.redactix-gallery img').length, 3);
    });

    await test('media: gallery auto-scroll stops on close, idle and destroy (B10)', async () => {
        const ed = makeEditor('<figure class="redactix-gallery"><div class="redactix-gallery-grid"><img src="/uploads/cat.jpg"></div></figure><p>x</p>');
        const gallery = mod(ed, 'Gallery');
        gallery.openModal(ed.editorEl.querySelector('figure'));
        gallery.startAutoScroll(ed.modal.container.querySelector('.redactix-gallery-items'));
        assert(gallery._rafId, 'running');
        ed.modal.close();
        eq(gallery._rafId, null, 'stopped on close');
        eq(gallery._dragoverHandler, null);

        gallery.startAutoScroll(document.body);
        await sleep(1200);
        eq(gallery._rafId, null, 'stopped when no dragover arrives');

        gallery.startAutoScroll(document.body);
        ed.destroy();
        eq(gallery._rafId, null, 'stopped on destroy');
    });

    // ------------------------------------------------------------------
    // Video
    // ------------------------------------------------------------------

    await test('media: video insert is one undo step; captions keep <br> (B7, B11)', async () => {
        const ed = makeEditor('<p>a</p>');
        caret(textNode(ed.editorEl, 'a'), 1);
        const video = mod(ed, 'Video');
        video.openModal();
        field(ed, 'Video URL').value = '/uploads/default.mp4';
        field(ed, 'Caption').value = 'line1<br>line2';
        ed.modal.save();
        includes(ed.getContent(), '<figcaption>line1<br>line2</figcaption>');
        video.openModal(ed.editorEl.querySelector('figure.redactix-video'));
        eq(field(ed, 'Caption').value, 'line1<br>line2');
        ed.modal.close();
        history(ed).undo();
        excludes(ed.getContent(), '<video');
        eq(video.buildFigure({ url: 'javascript:alert(1)', aspect: 'auto', caption: '' }), null);
        eq(video.buildFigure({ url: 'data:video/mp4;base64,AAAA', aspect: 'auto', caption: '' }), null);
    });

    // ------------------------------------------------------------------
    // Embed
    // ------------------------------------------------------------------

    await test('media: provider URL forms (B8)', async () => {
        const ed = makeEditor('<p>a</p>');
        const embed = mod(ed, 'Embed');
        const src = (url) => {
            const spec = embed.buildEmbedSpec({ mode: 'url', url });
            return spec ? spec.iframeAttrs.src : null;
        };
        const aspect = (url) => embed.buildEmbedSpec({ mode: 'url', url }).aspect;
        const Y = 'https://www.youtube.com/embed/dQw4w9WgXcQ';
        eq(src('https://www.youtube.com/watch?feature=share&v=dQw4w9WgXcQ'), Y);
        eq(src('https://m.youtube.com/watch?app=desktop&v=dQw4w9WgXcQ&t=1m30s'), Y + '?start=90');
        eq(src('https://youtu.be/dQw4w9WgXcQ?si=abc&t=42'), Y + '?start=42');
        eq(src('https://www.youtube.com/live/dQw4w9WgXcQ'), Y);
        eq(src('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'), Y);
        eq(src('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLx_1-a'), Y + '?list=PLx_1-a');
        eq(src('https://www.youtube.com/playlist?list=PL123abc'), 'https://www.youtube.com/embed/videoseries?list=PL123abc');
        eq(aspect('https://www.youtube.com/shorts/dQw4w9WgXcQ'), '9:16');
        eq(aspect('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), '16:9');
        eq(src('https://vimeo.com/123456789/abcdef1234'), 'https://player.vimeo.com/video/123456789?h=abcdef1234');
        eq(src('https://player.vimeo.com/video/123456789?h=abcdef1234'), 'https://player.vimeo.com/video/123456789?h=abcdef1234');
        eq(src('https://vimeo.com/channels/staffpicks/123456789'), 'https://player.vimeo.com/video/123456789');
        eq(src('https://vimeo.com/groups/name/videos/123456789'), 'https://player.vimeo.com/video/123456789');
        includes(src('https://clips.twitch.tv/FunnySlug-abc'), 'https://clips.twitch.tv/embed?clip=FunnySlug-abc&parent=');
        includes(src('https://www.twitch.tv/somechannel/clip/OtherSlug'), 'clip=OtherSlug');
        includes(src('https://www.twitch.tv/somechannel'), 'channel=somechannel');
        eq(src('https://codepen.io/user/pen/abc123'), 'https://codepen.io/user/embed/abc123?default-tab=result');
        eq(src('https://music.apple.com/us/playlist/my-list/pl.u-abc123'), 'https://embed.music.apple.com/us/playlist/pl.u-abc123');
        eq(embed.buildEmbedSpec({ mode: 'url', url: 'https://music.apple.com/us/album/x/123?i=456' }).initialHeight, 175);
        eq(embed.buildEmbedSpec({ mode: 'url', url: 'https://music.apple.com/us/album/x/123' }).initialHeight, 450);
        eq(src('https://evil.example/?youtube.com/watch?v=dQw4w9WgXcQ'), null, 'host must lead');
        eq(src('https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ'), null, 'lookalike host');
        // Pasting the whole <iframe> snippet into the URL field works too.
        eq(src('<iframe src="https://www.google.com/maps/embed?pb=!1m18" width="600"></iframe>'), 'https://www.google.com/maps/embed?pb=!1m18');
    });

    await test('media: provider embed src forms survive pasting saved output (B8)', async () => {
        const ed = makeEditor('<p>a</p>');
        const embed = mod(ed, 'Embed');
        const srcs = {
            twitter: 'https://platform.twitter.com/embed/Tweet.html?id=1234567890',
            tiktok: 'https://www.tiktok.com/embed/v2/7234567890123456789',
            twitch: 'https://player.twitch.tv/?channel=somechannel&parent=example.com',
            'apple-music': 'https://embed.music.apple.com/us/album/123?i=456',
            bluesky: 'https://embed.bsky.app/embed/did:plc:abc123/app.bsky.feed.post/3kxyz',
            mixcloud: 'https://www.mixcloud.com/widget/iframe/?feed=%2Fuser%2Fmix-name%2F',
            soundcloud: 'https://w.soundcloud.com/player/?url=https%3A%2F%2Fapi.soundcloud.com%2Ftracks%2F123',
            spotify: 'https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC',
            youtube: 'https://www.youtube.com/embed/dQw4w9WgXcQ'
        };
        Object.entries(srcs).forEach(([name, s]) => {
            const found = embed.findProviderForIframeSrc(s);
            assert(found && found.provider.name === name, `${name}: ${found && found.provider.name}`);
            assert(found.provider.buildIframe(found.match, s), `${name} rebuilds`);
        });

        // Round trip: saved output pasted into another editor keeps every embed.
        caret(textNode(ed.editorEl, 'a'), 1);
        ['https://twitter.com/user/status/1234567890', 'https://open.spotify.com/album/4uLU6hMCjMI75M1A2tKUQC', 'https://vimeo.com/123456789/abcdef1234']
            .forEach(url => assert(embed.applyEmbed(null, { mode: 'url', url, caption: '' }), url));
        const out = ed.getContent();
        const target = makeEditor('<p>b</p>');
        caret(textNode(target.editorEl, 'b'), 1);
        paste(target.editorEl, { html: out });
        const before = Array.from(ed.editorEl.querySelectorAll('iframe')).map(i => i.getAttribute('src'));
        const after = Array.from(target.editorEl.querySelectorAll('iframe')).map(i => i.getAttribute('src'));
        eq(JSON.stringify(after), JSON.stringify(before));
        includes(target.getContent(), 'data-height="352"');
    });

    await test('media: embed heights persist through save and reload (B4)', async () => {
        const ed = makeEditor('<p>a</p>');
        caret(textNode(ed.editorEl, 'a'), 1);
        const embed = mod(ed, 'Embed');
        assert(embed.applyEmbed(null, { mode: 'url', url: 'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC?si=abc123', caption: '' }));
        const out = ed.getContent();
        includes(out, 'data-height="152"');
        includes(out, 'height: 152px');
        excludes(out, 'si=abc123');
        includes(out, 'data-source-url="https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC"');
        const reloaded = makeEditor(out);
        eq(reloaded.getContent(), out, 'stable after reload');

        assert(embed.applyEmbed(null, { mode: 'custom', html: '<iframe src="https://example.com/widget" height="300" onload="x()"></iframe>', caption: '' }));
        const out2 = ed.getContent();
        includes(out2, 'height: 300px');
        excludes(out2, 'onload');

        // Legacy Spotify track without data-height: computed with the match.
        const legacy = makeEditor('<figure class="redactix-embed" data-provider="spotify" data-aspect="auto" data-source-url="https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC"><div class="redactix-embed-frame"><iframe src="https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC"></iframe></div></figure>');
        includes(legacy.getContent(), 'height: 152px');
    });

    await test('media: embed save / remove are undoable steps; lite mode has no Edit button (B7, B11)', async () => {
        const ed = makeEditor('<p>a</p>');
        caret(textNode(ed.editorEl, 'a'), 1);
        const embed = mod(ed, 'Embed');
        embed.applyEmbed(null, { mode: 'url', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', caption: '' });
        includes(ed.getContent(), 'youtube.com/embed');
        embed.openModal(ed.editorEl.querySelector('figure.redactix-embed'));
        modalButton(ed, 'Remove Embed').click();
        excludes(ed.getContent(), 'youtube.com/embed');
        history(ed).undo();
        includes(ed.getContent(), 'youtube.com/embed');

        const lite = makeEditor('<figure class="redactix-embed" data-provider="youtube" data-aspect="16:9"><div class="redactix-embed-frame"><iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe></div></figure>', { liteMode: true });
        eq(lite.editorEl.querySelector('.redactix-embed-edit-btn'), null);
    });

    await test('media: user classes on an embed figure survive an edit (B11)', async () => {
        const ed = makeEditor('<figure class="redactix-embed wide" data-provider="youtube" data-aspect="16:9" data-source-url="https://youtu.be/dQw4w9WgXcQ"><div class="redactix-embed-frame"><iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe></div><figcaption>a<br>b</figcaption></figure><p>x</p>');
        mod(ed, 'Embed').openModal(ed.editorEl.querySelector('figure'));
        eq(field(ed, 'Caption').value, 'a<br>b');
        ed.modal.save();
        const out = ed.getContent();
        includes(out, 'class="redactix-embed wide"');
        includes(out, '<figcaption>a<br>b</figcaption>');
    });

    await test('media: custom iframe permissions are filtered, non-https refused (S5)', async () => {
        const ed = makeEditor('<p>a</p>');
        const embed = mod(ed, 'Embed');
        const iframe = embed.parseAndSanitizeCustomHtml('<iframe src="https://example.com/x" allow="camera; autoplay; microphone" sandbox="allow-scripts allow-top-navigation allow-popups-to-escape-sandbox" onload="alert(1)" style="x"></iframe>');
        eq(iframe.getAttribute('allow'), 'autoplay');
        // allow-top-navigation* is stripped; allow-popups-to-escape-sandbox only
        // affects the opened tab, so it may stay.
        eq(iframe.getAttribute('sandbox'), 'allow-scripts allow-popups-to-escape-sandbox');
        eq(iframe.hasAttribute('onload'), false);
        eq(iframe.hasAttribute('style'), false);
        eq(embed.parseAndSanitizeCustomHtml('<iframe src="http://example.com/x"></iframe>'), null);
        eq(embed.parseAndSanitizeCustomHtml('<iframe src="/uploads/x.svg"></iframe>'), null);
        eq(embed.parseAndSanitizeCustomHtml('<iframe src="javascript:alert(1)"></iframe>'), null);
    });

    await test('media: Twitch parent is the rendering host, not frozen (B8)', async () => {
        const fixed = withTwitchParent('https://player.twitch.tv/?channel=x&parent=admin.example', 'site.example');
        includes(fixed, 'parent=admin.example');
        includes(fixed, 'parent=site.example');
        eq(withTwitchParent(fixed, 'site.example'), fixed, 'idempotent');
        eq(withTwitchParent('https://www.youtube.com/embed/x', 'site.example'), null);

        const ed = makeEditor('<figure class="redactix-embed" data-provider="twitch" data-aspect="16:9"><div class="redactix-embed-frame"><iframe src="https://player.twitch.tv/?channel=x&amp;parent=admin.example"></iframe></div></figure>');
        includes(ed.editorEl.querySelector('iframe').getAttribute('src'), 'parent=' + location.hostname);
    });

    await test('media: postMessage resize is origin-checked and clamped (S6)', async () => {
        const ed = makeEditor('<figure class="redactix-embed" data-provider="instagram" data-aspect="auto" data-height="700"><div class="redactix-embed-frame"><iframe src="https://www.instagram.com/p/abc/embed/"></iframe></div></figure><p>x</p>');
        const iframe = ed.editorEl.querySelector('iframe');
        iframe.src = 'about:blank'; // no network; the WindowProxy stays the same
        const frame = iframe.parentElement;
        eq(frame.style.height, '700px');
        const send = (origin, data) => window.dispatchEvent(new MessageEvent('message', { origin, data, source: iframe.contentWindow }));
        send('https://evil.example', JSON.stringify({ type: 'MEASURE', details: { height: 812 } }));
        eq(frame.style.height, '700px', 'foreign origin ignored');
        send('https://www.instagram.com', JSON.stringify({ type: 'MEASURE', details: { height: 812 } }));
        eq(frame.style.height, '812px');
        send('https://www.instagram.com', { type: 'MEASURE', details: { height: 1e9 } });
        eq(frame.style.height, '5000px', 'clamped');
        send('https://www.instagram.com', { type: 'MEASURE', details: { height: 'NaN' } });
        eq(frame.style.height, '5000px', 'non-numeric ignored');
        includes(ed.getContent(), 'height: 700px', 'live height not saved');
    });

    await test('media: embed-runtime.js and the editor parser agree (S6)', async () => {
        if (!window.RedactixEmbedRuntime) await loadScript('/redactix/embed-runtime.js');
        const rt = window.RedactixEmbedRuntime;
        assert(rt, 'runtime loaded');
        const samples = [
            ['instagram', '{"type":"MEASURE","details":{"height":812}}'],
            ['instagram', { type: 'MEASURE', details: { height: 30 } }],
            ['instagram', { type: 'MEASURE', details: 5 }],
            ['twitter', { method: 'twttr.private.resize', params: [{ height: 640.4 }] }],
            ['twitter', { method: 'x', params: [{ height: 640 }] }],
            ['tiktok', { frameHeight: 720 }],
            ['tiktok', { height: 700, type: 'tiktok-embed' }],
            ['tiktok', { height: 700, type: 'other' }],
            ['reddit', { type: 'embed-resize', height: 99999 }],
            ['bluesky', { id: '1', height: '480' }],
            ['bluesky', { height: 480 }],
            ['youtube', { height: 500 }],
            ['instagram', 'not json'],
            ['instagram', null],
            ['twitter', 'x'.repeat(20000)],
            ['constructor', { height: 500 }]
        ];
        samples.forEach(([p, d]) => {
            eq(rt.parseResizeMessage(p, d), parseResizeMessage(p, d), JSON.stringify([p, d]).slice(0, 80));
        });
        const origins = [].concat(...Object.values(RESIZE_ORIGINS), 'https://evil.example', 'null', '');
        Object.keys(RESIZE_ORIGINS).concat('youtube', 'toString').forEach(p => {
            origins.forEach(o => eq(rt.isResizeOrigin(p, o), isResizeOrigin(p, o), p + ' ' + o));
        });
    });
}
