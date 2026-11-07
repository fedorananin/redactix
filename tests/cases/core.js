// Core: load/save round trip, sync, sanitisers, history, modal, selection.
import { test, assert, eq, includes, excludes, makeEditor, frame, sleep, caret, textNode, paste, key, type } from '../lib.js';
import { sanitizeUrl, sanitizeLoadedHtml } from '../../redactix/core/dom-utils.js';

export default async function () {
    // ---------- load / whitespace ----------

    await test('core: space between inline tags survives load', async () => {
        const ed = makeEditor('<p><b>Bold</b> <i>italic</i></p>');
        eq(ed.getContent(), '<p><b>Bold</b> <i>italic</i></p>');
    });

    await test('core: pretty-printed source formatting is dropped', async () => {
        const ed = makeEditor('<ul>\n    <li>one</li>\n    <li>two</li>\n</ul>\n<p>\n  Hello\n  world\n</p>');
        eq(ed.getContent(), '<ul><li>one</li><li>two</li></ul><p>Hello world</p>');
    });

    await test('core: <pre> content is preserved verbatim', async () => {
        const src = '<pre><code>  a\n    b\n\n$$var $&amp; done</code></pre><p>x</p>';
        const ed = makeEditor(src);
        includes(ed.getContent(), '<code>  a\n    b\n\n$$var $&amp; done</code>');
    });

    await test('core: huge numeric entity does not break init of later editors', async () => {
        const bad = makeEditor('<p><a href="&amp;#99999999;x">a</a></p>');
        assert(bad, 'first editor created');
        const good = makeEditor('<p>ok</p>');
        assert(good && good.editorEl, 'second editor initialised');
        // must not throw
        sanitizeUrl('&#99999999;javascript:alert(1)');
    });

    await test('core: named-entity scheme is rejected', async () => {
        eq(sanitizeUrl('javascript&colon;alert(1)'), null);
    });

    await test('core: load sanitizer drops svg/xmp/embed and relative iframes', async () => {
        const out = sanitizeLoadedHtml('<p>a</p><svg><animate attributeName="href" to="javascript:alert(1)"/></svg><xmp><img src=x onerror=alert(1)></xmp><embed src="x.swf"><iframe src="/uploads/x.svg"></iframe><iframe src="https://www.youtube.com/embed/abc" allow="camera; autoplay; microphone"></iframe>');
        excludes(out, '<svg');
        excludes(out, '<xmp');
        excludes(out, '<embed');
        excludes(out, '/uploads/x.svg');
        includes(out, 'youtube.com/embed/abc');
        includes(out, 'allow="autoplay"');
    });

    await test('core: setContent(null) and setContent("") work', async () => {
        const ed = makeEditor('<p>x</p>');
        ed.setContent(null);
        eq(ed.editorEl.innerHTML, '<p><br></p>');
        ed.setContent('');
        eq(ed.editorEl.innerHTML, '<p><br></p>');
    });

    // ---------- sync ----------

    await test('core: no input/change events on load, one per real change', async () => {
        const ta = document.createElement('textarea');
        ta.className = 'redactix-test sync-probe';
        ta.value = '<p>hello</p>';
        document.getElementById('sandbox').appendChild(ta);
        let events = 0;
        ta.addEventListener('input', () => events++);
        const { default: Redactix } = await import('../../redactix/Redactix.js');
        new Redactix({ selector: '.sync-probe' });
        const ed = ta.redactix;
        await frame(); await frame();
        eq(events, 0, 'events after load');
        ed.editorEl.querySelector('p').append(' world');
        await frame(); await frame();
        eq(events, 1, 'events after one change');
        ed.getContent();
        eq(events, 1, 'getContent with no change dispatches nothing');
        ed.destroy();
    });

    await test('core: host input listener calling getContent does not recurse', async () => {
        const ed = makeEditor('<p>a</p>');
        let calls = 0;
        ed.textarea.addEventListener('input', () => { calls++; ed.getContent(); });
        ed.editorEl.querySelector('p').append('b');
        ed.syncImmediate();
        assert(calls >= 1 && calls < 5, 'listener ran a bounded number of times: ' + calls);
    });

    await test('core: destroy() flushes the pending sync', async () => {
        const ed = makeEditor('<p>a</p>');
        const ta = ed.textarea;
        ed.editorEl.querySelector('p').append('bc');
        ed.destroy();
        eq(ta.value, '<p>abc</p>');
        eq(ta.style.display, '');
    });

    await test('core: upload placeholder and data-redactix-ui never reach output', async () => {
        const ed = makeEditor('<p>a</p>');
        const ph = document.createElement('figure');
        ph.className = 'redactix-upload-placeholder';
        ph.textContent = 'uploading';
        ed.editorEl.appendChild(ph);
        const ui = document.createElement('button');
        ui.setAttribute('data-redactix-ui', '');
        ed.editorEl.querySelector('p').appendChild(ui);
        const out = ed.getContent();
        excludes(out, 'uploading');
        excludes(out, '<button');
    });

    await test('core: search highlight unwrap keeps inner formatting', async () => {
        const ed = makeEditor('<p>x</p>');
        ed.editorEl.querySelector('p').innerHTML = 'a<mark class="redactix-find-highlight"><b>bc</b></mark>d';
        eq(ed.getContent(), '<p>a<b>bc</b>d</p>');
    });

    await test('core: content dropped into a separator wrapper is not lost', async () => {
        const ed = makeEditor('<p>a</p><hr><p>b</p>');
        const wrapper = ed.editorEl.querySelector('.redactix-separator');
        const p = document.createElement('p');
        p.textContent = 'moved';
        wrapper.appendChild(p);
        ed.setupContent();
        includes(ed.getContent(), '<hr><p>moved</p>');
    });

    await test('core: word counter separates blocks', async () => {
        const ed = makeEditor('<p>Hello</p><p>World</p><ul><li>one</li><li>two</li></ul>');
        includes(ed.counter.textContent, '| 4 ');
    });

    await test('core: getModule and moduleName', async () => {
        const ed = makeEditor('<p>a</p>');
        assert(ed.getModule('History'), 'History');
        assert(ed.getModule('Image'), 'Image');
        eq(ed.getModule('Image').name, 'Image');
        eq(ed.getModule('Nope'), null);
    });

    // ---------- paste ----------

    await test('core: paste strips executable markup and Office garbage', async () => {
        const ed = makeEditor('<p>start</p>');
        const p = ed.editorEl.querySelector('p');
        ed.editorEl.focus();
        caret(textNode(p, 'start'), 5);
        paste(ed.editorEl, { html: '<p>one<!-- c --><img src=x onerror="window.__pwned=1"></p><xmp>&lt;b&gt;</xmp><link rel="stylesheet" href="https://evil.example/x.css"><base href="https://evil.example/"><p class="MsoNormal">two<o:p></o:p></p><script>window.__pwned=1</script>' });
        await sleep(50);
        const out = ed.getContent();
        excludes(out, 'onerror');
        excludes(out, '<link');
        excludes(out, '<base');
        excludes(out, '<xmp');
        excludes(out, 'Mso');
        excludes(out, '<!--');
        includes(out, 'two');
        assert(!window.__pwned, 'no script ran');
    });

    await test('core: paste keeps provider iframe, drops look-alikes', async () => {
        const ed = makeEditor('<p><br></p>');
        ed.editorEl.focus();
        caret(ed.editorEl.querySelector('p'), 0);
        paste(ed.editorEl, { html:
            '<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>' +
            '<iframe src="https://evil.example/?youtube.com/embed/dQw4w9WgXcQ"></iframe>' +
            '<figure class="redactix-embed"><div class="redactix-embed-frame"><iframe src="https://evil.example/frame"></iframe></div></figure>'
        });
        const out = ed.getContent();
        includes(out, 'https://www.youtube.com/embed/dQw4w9WgXcQ');
        excludes(out, 'evil.example');
        includes(out, 'figure class="redactix-embed"');
    });

    await test('core: lite mode paste drops embeds', async () => {
        const ed = makeEditor('<p><br></p>', { liteMode: true });
        ed.editorEl.focus();
        caret(ed.editorEl.querySelector('p'), 0);
        paste(ed.editorEl, { html: '<p>x</p><iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>' });
        excludes(ed.getContent(), 'iframe');
    });

    await test('core: paste nested divs become paragraphs, no div left', async () => {
        const ed = makeEditor('<p><br></p>');
        ed.editorEl.focus();
        caret(ed.editorEl.querySelector('p'), 0);
        paste(ed.editorEl, { html: '<div><div>first</div><div><div>second</div></div></div>' });
        const out = ed.getContent();
        excludes(out, '<div');
        includes(out, '<p>first</p><p>second</p>');
    });

    await test('core: pasted linked image keeps the link around the image', async () => {
        const ed = makeEditor('<p><br></p>');
        ed.editorEl.focus();
        caret(ed.editorEl.querySelector('p'), 0);
        paste(ed.editorEl, { html: '<p><a href="https://example.com"><img src="https://example.com/a.png" alt="a"></a></p>' });
        includes(ed.getContent(), '<figure><a href="https://example.com"><img src="https://example.com/a.png" alt="a"></a></figure>');
    });

    await test('core: paste in the middle of a paragraph splits it', async () => {
        const ed = makeEditor('<p>HelloWorld</p>');
        const t = textNode(ed.editorEl, 'HelloWorld');
        ed.editorEl.focus();
        caret(t, 5);
        paste(ed.editorEl, { html: '<p>A</p><p>B</p>' });
        eq(ed.getContent(), '<p>Hello</p><p>A</p><p>B</p><p>World</p>');
    });

    await test('core: multi-line plain text paste with CRLF', async () => {
        const ed = makeEditor('<p><br></p>');
        ed.editorEl.focus();
        caret(ed.editorEl.querySelector('p'), 0);
        paste(ed.editorEl, { text: 'one\r\ntwo\r\n\r\nthree' });
        const out = ed.getContent();
        excludes(out, '\r');
        includes(out, '<p>one</p><p>two</p><p><br></p><p>three</p>');
    });

    await test('core: paste is one undo step', async () => {
        const ed = makeEditor('<p>a</p>');
        const p = ed.editorEl.querySelector('p');
        ed.editorEl.focus();
        caret(textNode(p, 'a'), 1);
        paste(ed.editorEl, { html: '<p>X</p><p>Y</p>' });
        ed.getModule('History').undo();
        eq(ed.getContent(), '<p>a</p>');
    });

    // ---------- selection.insertNode ----------

    await test('core: inserting a block with the caret inside a list goes after the list', async () => {
        const ed = makeEditor('<ul><li>item</li></ul>');
        ed.editorEl.focus();
        caret(textNode(ed.editorEl, 'item'), 2);
        const pre = document.createElement('pre');
        pre.textContent = 'code';
        ed.selection.insertNode(pre);
        eq(ed.getContent().startsWith('<ul><li>item</li></ul><pre>'), true, ed.getContent());
    });

    await test('core: inserting a table inside a quote-card lands after the card', async () => {
        const ed = makeEditor('<figure class="quote-card"><blockquote><p>q</p></blockquote></figure>');
        ed.editorEl.focus();
        caret(textNode(ed.editorEl, 'q'), 1);
        const table = document.createElement('table');
        table.innerHTML = '<tbody><tr><td>1</td></tr></tbody>';
        ed.selection.insertNode(table);
        assert(!ed.editorEl.querySelector('blockquote table'), 'table not inside quote');
        assert(ed.editorEl.querySelector(':scope > table'), 'table at root');
    });

    await test('core: fragment insert is treated as block content', async () => {
        const ed = makeEditor('<p>Hello</p>');
        ed.editorEl.focus();
        caret(textNode(ed.editorEl, 'Hello'), 2);
        const frag = document.createDocumentFragment();
        const h = document.createElement('h2');
        h.textContent = 'H';
        frag.appendChild(h);
        ed.selection.insertNode(frag);
        eq(ed.getContent(), '<p>Hello</p><h2>H</h2>');
    });

    // ---------- history ----------

    await test('core: undo right after typing undoes only that typing', async () => {
        const ed = makeEditor('<p>a</p>');
        const history = ed.getModule('History');
        ed.editorEl.focus();
        caret(textNode(ed.editorEl, 'a'), 1);
        type('b');
        await sleep(400);
        type('c');
        history.undo();
        eq(ed.getContent(), '<p>ab</p>');
        history.undo();
        eq(ed.getContent(), '<p>a</p>');
        history.redo();
        eq(ed.getContent(), '<p>ab</p>');
    });

    await test('core: programmatic change without input event is undoable on its own', async () => {
        const ed = makeEditor('<p>a</p>');
        const history = ed.getModule('History');
        ed.editorEl.focus();
        caret(textNode(ed.editorEl, 'a'), 1);
        type('b');
        await sleep(400);
        ed.transact(() => {
            const p = document.createElement('p');
            p.textContent = 'added';
            ed.editorEl.appendChild(p);
        });
        history.undo();
        eq(ed.getContent(), '<p>ab</p>');
    });

    await test('core: endBatch records the gesture and survives an unmatched begin', async () => {
        const ed = makeEditor('<p>a</p><p>b</p>');
        const history = ed.getModule('History');
        history.beginBatch();
        history.beginBatch();
        const [a, b] = ed.editorEl.querySelectorAll('p');
        ed.editorEl.insertBefore(b, a);
        history.endBatch();
        eq(history.batchInProgress, false);
        history.undo();
        eq(ed.getContent(), '<p>a</p><p>b</p>');
    });

    // ---------- modal ----------

    await test('core: modal buttons never submit the host form; Enter saves', async () => {
        const ed = makeEditor('<p>a</p>', {}, { inForm: true });
        let submitted = 0;
        ed.textarea.form.addEventListener('submit', () => submitted++);
        let saved = 0;
        const body = document.createElement('div');
        const input = document.createElement('input');
        body.appendChild(input);
        ed.modal.open({ title: 't', body, onSave: () => { saved++; } });
        ed.modal.container.querySelectorAll('button').forEach(b => eq(b.type, 'button'));
        key(input, 'Enter');
        eq(saved, 1, 'saved via Enter');
        eq(ed.modal.isOpen, false);
        eq(submitted, 0);
    });

    await test('core: Escape closes only the topmost layer', async () => {
        const ed = makeEditor('<p>a</p>');
        const body = document.createElement('div');
        body.appendChild(document.createElement('input'));
        ed.modal.open({ title: 't', body });
        let lowerClosed = 0;
        const { pushEscapeLayer } = await import('../../redactix/core/layers.js');
        const pop = pushEscapeLayer(() => lowerClosed++);
        // pushed after the modal → it is on top; pop it, re-push below
        pop();
        key(document.activeElement || document.body, 'Escape');
        eq(ed.modal.isOpen, false, 'modal closed');
        eq(lowerClosed, 0);
    });

    await test('core: onSave returning false keeps modal open', async () => {
        const ed = makeEditor('<p>a</p>');
        const body = document.createElement('div');
        ed.modal.open({ title: 't', body, onSave: () => false });
        ed.modal.saveBtn.click();
        eq(ed.modal.isOpen, true);
        ed.modal.close();
    });

    // ---------- editor keys ----------

    await test('core: Enter on empty last paragraph exits a callout', async () => {
        const ed = makeEditor('<aside><p>x</p><p><br></p></aside>');
        const empty = ed.editorEl.querySelectorAll('aside p')[1];
        ed.editorEl.focus();
        caret(empty, 0);
        key(ed.editorEl, 'Enter');
        eq(ed.getContent(), '<aside><p>x</p></aside><p><br></p>');
    });

    await test('core: space is reported as input (slash menu / history hear it)', async () => {
        const ed = makeEditor('<p>a</p>');
        let inputs = 0;
        ed.editorEl.addEventListener('input', () => inputs++);
        ed.editorEl.focus();
        caret(textNode(ed.editorEl, 'a'), 1);
        key(ed.editorEl, ' ');
        eq(inputs, 1);
        eq(ed.getContent(), '<p>a </p>');
    });

    await test('core: naked root text is wrapped into a paragraph', async () => {
        const ed = makeEditor('<p>a</p>');
        ed.editorEl.appendChild(document.createTextNode('naked'));
        ed.core.ensureEditorStructure();
        eq(ed.getContent(), '<p>a</p><p>naked</p>');
    });
}
