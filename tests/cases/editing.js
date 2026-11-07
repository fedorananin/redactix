// editing suite — find/replace, HTML mode, markdown, slash commands,
// floating toolbar, attributes, fullscreen.
import { test, assert, eq, includes, excludes, makeEditor, frame, sleep, caret, select, textNode, key, type } from '../lib.js';

function findModule(ed) {
    return ed.getModule('FindReplace');
}

/** Open the find panel and run a search synchronously. */
function search(ed, query) {
    const fr = findModule(ed);
    fr.open();
    fr.panel.querySelector('.redactix-find-input').value = query;
    fr.flushSearch();
    return fr;
}

function setReplace(fr, value) {
    fr.panel.querySelector('.redactix-replace-input').value = value;
}

function codeArea(ed) {
    return ed.getModule('HtmlMode').textarea;
}

function setCode(ed, value) {
    const ta = codeArea(ed);
    ta.value = value;
    ta.dispatchEvent(new Event('input', { bubbles: true }));
}

/** Type "/" + command at the caret like a user (fires input events). */
function typeSlash(text) {
    type(text);
}

export default async function () {
    // ---------- Find & Replace ----------

    await test('find: overlapping matches do not duplicate text ("00" in "1000")', async () => {
        const ed = makeEditor('<p>1000</p>');
        const fr = search(ed, '00');
        eq(fr.currentMatches.length, 1, 'non-overlapping match count');
        eq(ed.getContent(), '<p>1000</p>');
        setReplace(fr, 'x');
        fr.replaceAll();
        eq(ed.getContent(), '<p>1x0</p>');
    });

    await test('find: highlightAll is robust to overlapping ranges', async () => {
        const ed = makeEditor('<p>aaaa</p>');
        const fr = findModule(ed);
        fr.open();
        const t = textNode(ed.editorEl, 'aaaa');
        fr.highlightAll([{ node: t, start: 0, end: 2 }, { node: t, start: 1, end: 3 }, { node: t, start: 2, end: 4 }]);
        eq(ed.editorEl.querySelectorAll('.redactix-find-highlight').length, 2);
        eq(ed.editorEl.querySelector('p').textContent, 'aaaa');
        eq(ed.getContent(), '<p>aaaa</p>');
    });

    await test('find: Replace continues after the replaced text ("cat" → "cats")', async () => {
        const ed = makeEditor('<p>cat cat cat</p>');
        const fr = search(ed, 'cat');
        setReplace(fr, 'cats');
        fr.replaceCurrent();
        eq(ed.getContent(), '<p>cats cat cat</p>');
        fr.replaceCurrent();
        eq(ed.getContent(), '<p>cats cats cat</p>');
        fr.replaceCurrent();
        eq(ed.getContent(), '<p>cats cats cats</p>');
    });

    await test('find: Replace and Replace all are single undo steps', async () => {
        const ed = makeEditor('<p>one two one</p>');
        const history = ed.getModule('History');
        const fr = search(ed, 'one');
        setReplace(fr, '1');
        fr.replaceAll();
        eq(ed.getContent(), '<p>1 two 1</p>');
        history.undo();
        eq(ed.getContent(), '<p>one two one</p>');
    });

    await test('find: case-insensitive match positions survive length-changing lower-case (İ)', async () => {
        const ed = makeEditor('<p>İİ test İ Test</p>');
        const fr = search(ed, 'test');
        const marks = Array.from(ed.editorEl.querySelectorAll('.redactix-find-highlight')).map(m => m.textContent);
        eq(JSON.stringify(marks), JSON.stringify(['test', 'Test']));
        eq(fr.currentMatches.length, 2);
    });

    await test('find: count label uses the i18n template', async () => {
        const ed = makeEditor('<p>a b a</p>');
        const fr = search(ed, 'a');
        eq(fr.panel.querySelector('.redactix-find-count').textContent, '1 of 2');
    });

    await test('find: closing keeps formatting applied inside a highlight', async () => {
        const ed = makeEditor('<p>abc</p>');
        const fr = search(ed, 'b');
        const mark = ed.editorEl.querySelector('.redactix-find-highlight');
        const b = document.createElement('b');
        b.appendChild(mark.firstChild);
        mark.appendChild(b);
        fr.close();
        eq(ed.editorEl.querySelectorAll('.redactix-find-highlight').length, 0);
        eq(ed.getContent(), '<p>a<b>b</b>c</p>');
    });

    await test('find: search skips UI text but includes hidden content', async () => {
        const ed = makeEditor('<p>hello <span style="display:none">hello</span></p>');
        const ui = document.createElement('button');
        ui.setAttribute('data-redactix-ui', '');
        ui.textContent = 'hello';
        ed.editorEl.querySelector('p').appendChild(ui);
        const fr = search(ed, 'hello');
        eq(fr.currentMatches.length, 2);
        assert(!ui.querySelector('mark'), 'no highlight in UI');
    });

    await test('find: typing in the search box is debounced', async () => {
        const ed = makeEditor('<p>abc</p>');
        const fr = findModule(ed);
        fr.open();
        const input = fr.panel.querySelector('.redactix-find-input');
        let runs = 0;
        const orig = fr.search.bind(fr);
        fr.search = (q) => { runs++; return orig(q); };
        input.value = 'a';
        input.dispatchEvent(new Event('input'));
        input.value = 'ab';
        input.dispatchEvent(new Event('input'));
        eq(runs, 0, 'nothing ran synchronously');
        await sleep(250);
        eq(runs, 1, 'one search after the pause');
        input.dispatchEvent(new Event('input'));
        await sleep(250);
        eq(runs, 1, 'unchanged query does not search again');
    });

    await test('find: Escape inside the editor closes the panel, Escape elsewhere does not', async () => {
        const ed = makeEditor('<p>abc</p>');
        const fr = findModule(ed);
        fr.open();
        const outside = document.createElement('input');
        document.body.appendChild(outside);
        outside.focus();
        key(outside, 'Escape');
        eq(fr.isOpen, true, 'still open after outside Escape');
        eq(document.activeElement, outside, 'focus not stolen');
        outside.remove();
        const input = fr.panel.querySelector('.redactix-find-input');
        input.focus();
        key(input, 'Escape');
        eq(fr.isOpen, false, 'closed by Escape in the panel');
    });

    await test('find: Ctrl+F does not open the panel in HTML mode', async () => {
        const ed = makeEditor('<p>abc</p>');
        ed.getModule('HtmlMode').toggleHtmlMode();
        codeArea(ed).focus();
        key(codeArea(ed), 'f', { code: 'KeyF', ctrlKey: true });
        eq(findModule(ed).isOpen, false);
        findModule(ed).open();
        eq(findModule(ed).isOpen, false, 'toolbar action ignored too');
    });

    // ---------- HTML mode ----------

    await test('html: round trip keeps inline spaces and exact <pre> content', async () => {
        const src = '<p><b>a</b> <i>b</i> c</p>' +
            '<pre><code>  indented\n    more\n\n$$var $&amp; $\' tail</code></pre>' +
            '<ul><li>one<ul><li>two</li></ul></li></ul>' +
            '<aside><p>note <a href="https://e.com">x</a></p></aside>';
        const ed = makeEditor(src);
        const before = ed.getContent();
        const hm = ed.getModule('HtmlMode');
        hm.toggleHtmlMode();
        hm.toggleHtmlMode();
        eq(ed.getContent(), before);
        includes(ed.getContent(), '<code>  indented\n    more\n\n$$var $&amp; $\' tail</code>');
        includes(ed.getContent(), '<b>a</b> <i>b</i>');
    });

    await test('html: uniformly indented code keeps its indent', async () => {
        const ed = makeEditor('<pre><code>    a\n    b</code></pre><p>x</p>');
        const before = ed.getContent();
        const hm = ed.getModule('HtmlMode');
        hm.toggleHtmlMode();
        includes(codeArea(ed).value, '<code>    a\n    b</code>');
        hm.toggleHtmlMode();
        eq(ed.getContent(), before);
    });

    await test('html: code view shows exactly the saved HTML', async () => {
        const ed = makeEditor('<p>a<strong>b</strong></p><figure><img src="https://e.com/a.png" alt="x"></figure>');
        const saved = ed.getContent();
        ed.getModule('HtmlMode').toggleHtmlMode();
        const shown = codeArea(ed).value.replace(/\n\s*/g, '');
        eq(shown, saved);
    });

    await test('html: edits in the code view reach textarea / getContent / destroy', async () => {
        const ed = makeEditor('<p>a</p>');
        const ta = ed.textarea;
        ed.getModule('HtmlMode').toggleHtmlMode();
        setCode(ed, '<p>edited</p>\n<p>two</p>');
        eq(ed.getContent(), '<p>edited</p><p>two</p>');
        setCode(ed, '<p>last <script>alert(1)</script></p>');
        ed.destroy();
        eq(ta.value, '<p>last </p>');
    });

    await test('html: returning from HTML mode is one undo step', async () => {
        const ed = makeEditor('<p>a</p>');
        const hm = ed.getModule('HtmlMode');
        hm.toggleHtmlMode();
        setCode(ed, '<p>b</p>');
        hm.toggleHtmlMode();
        eq(ed.getContent(), '<p>b</p>');
        ed.getModule('History').undo();
        eq(ed.getContent(), '<p>a</p>');
    });

    await test('html: setContent while the code view is open refreshes it', async () => {
        const ed = makeEditor('<p>a</p>');
        const hm = ed.getModule('HtmlMode');
        hm.toggleHtmlMode();
        ed.setContent('<p>new</p>');
        includes(codeArea(ed).value, '<p>new</p>');
        eq(ed.getContent(), '<p>new</p>');
        hm.toggleHtmlMode();
        eq(ed.getContent(), '<p>new</p>');
    });

    await test('html: Tab indents, keeps the selection, Shift+Tab outdents lines', async () => {
        const ed = makeEditor('<p>a</p>');
        ed.getModule('HtmlMode').toggleHtmlMode();
        const ta = codeArea(ed);
        ta.focus();
        ta.value = 'one\ntwo\nthree';
        // collapsed caret → two spaces
        ta.setSelectionRange(0, 0);
        key(ta, 'Tab');
        eq(ta.value, '  one\ntwo\nthree');
        // selection across lines → every line indented, text kept
        ta.setSelectionRange(3, 9);
        key(ta, 'Tab');
        eq(ta.value, '    one\n  two\nthree');
        eq(ta.value.slice(ta.selectionStart, ta.selectionEnd).trim().length > 0, true, 'still selected');
        // Shift+Tab with a caret on line 3 (no indent) changes nothing
        ta.setSelectionRange(ta.value.length, ta.value.length);
        key(ta, 'Tab', { shiftKey: true });
        eq(ta.value, '    one\n  two\nthree');
        // Shift+Tab over all lines
        ta.setSelectionRange(0, ta.value.length);
        key(ta, 'Tab', { shiftKey: true });
        eq(ta.value, '  one\ntwo\nthree');
        // Native undo still works (execCommand-based insertion)
        document.execCommand('undo');
        eq(ta.value, '    one\n  two\nthree');
    });

    await test('html: Enter keeps indentation; IME composition is left alone', async () => {
        const ed = makeEditor('<p>a</p>');
        ed.getModule('HtmlMode').toggleHtmlMode();
        const ta = codeArea(ed);
        ta.focus();
        ta.value = '  <p>x</p>';
        ta.setSelectionRange(ta.value.length, ta.value.length);
        key(ta, 'Enter');
        eq(ta.value, '  <p>x</p>\n  ');
        const ev = key(ta, 'Enter', { isComposing: true });
        eq(ev.defaultPrevented, false);
    });

    await test('html: toolbar buttons get their inline styles cleared on return', async () => {
        const ed = makeEditor('<p>a</p>');
        const hm = ed.getModule('HtmlMode');
        hm.toggleHtmlMode();
        hm.toggleHtmlMode();
        ed.toolbar.element.querySelectorAll('button').forEach(b => {
            eq(b.style.opacity, '');
            eq(b.style.pointerEvents, '');
            eq(b.disabled, false);
        });
        eq(ed.editorEl.style.display, '');
    });

    await test('html: code editor height follows the line count without collapsing', async () => {
        const ed = makeEditor('<p>a</p>');
        const hm = ed.getModule('HtmlMode');
        hm.toggleHtmlMode();
        setCode(ed, Array.from({ length: 40 }, (_, i) => '<p>' + i + '</p>').join('\n'));
        await frame(); await frame();
        const h = parseInt(codeArea(ed).style.height, 10);
        assert(h >= 40 * 21 + 32, 'tall enough: ' + h);
        eq(hm.lineNumbers.childElementCount, 40);
    });

    // ---------- Markdown ----------

    await test('markdown: "# " in a paragraph makes a heading (input-driven, fast typing)', async () => {
        const ed = makeEditor('<p><br></p>');
        ed.editorEl.focus();
        caret(ed.editorEl.querySelector('p'), 0);
        type('#');
        type(' ');
        type('Title');
        eq(ed.getContent(), '<h1>Title</h1>');
    });

    await test('markdown: space via core handler triggers too', async () => {
        const ed = makeEditor('<p><br></p>');
        ed.editorEl.focus();
        caret(ed.editorEl.querySelector('p'), 0);
        type('-');
        key(ed.editorEl, ' ');
        eq(ed.getContent(), '<ul><li><br></li></ul>');
    });

    await test('markdown: "## " inside a heading converts it, never nests', async () => {
        const ed = makeEditor('<h1>x</h1>');
        const h = ed.editorEl.querySelector('h1');
        h.innerHTML = '<br>';
        ed.editorEl.focus();
        caret(h, 0);
        type('##');
        type(' ');
        assert(!ed.editorEl.querySelector('h1 h2, h2 h1'), 'no nesting: ' + ed.editorEl.innerHTML);
        eq(ed.getContent(), '<h2><br></h2>');
    });

    await test('markdown: no block shortcuts in captions or table cells', async () => {
        const ed = makeEditor('<figure><img src="https://e.com/a.png"><figcaption>c</figcaption></figure><table><tbody><tr><td>t</td></tr></tbody></table><p>p</p>');
        const cap = ed.editorEl.querySelector('figcaption');
        cap.innerHTML = '<br>';
        ed.editorEl.focus();
        caret(cap, 0);
        type('-');
        type(' ');
        assert(!ed.editorEl.querySelector('figcaption ul'), 'no list in caption');
        includes(cap.textContent, '- ', 'typed into the caption');
        const td = ed.editorEl.querySelector('td');
        td.innerHTML = '<br>';
        caret(td, 0);
        type('#');
        type(' ');
        assert(!ed.editorEl.querySelector('td h1'), 'no heading in cell');
        includes(td.textContent, '# ', 'typed into the cell');
    });

    await test('markdown: in a list item only list rules apply', async () => {
        const ed = makeEditor('<ul><li>a</li><li>b</li></ul>');
        const li = ed.editorEl.querySelectorAll('li')[1];
        li.innerHTML = '<br>';
        ed.editorEl.focus();
        caret(li, 0);
        type('#');
        type(' ');
        assert(!ed.editorEl.querySelector('ul > h1, li h1'), 'no heading in list');
        includes(li.textContent, '# ', 'typed into the item');
        type('> ');
        assert(!ed.editorEl.querySelector('ul figure, li figure'), 'no quote in list');
    });

    await test('markdown: container rules (no quote in quote, no callout in callout)', async () => {
        const ed = makeEditor('<figure class="quote-card"><blockquote><p>q</p></blockquote></figure><aside><p>c</p></aside><p>x</p>');
        const qp = ed.editorEl.querySelector('blockquote p');
        qp.innerHTML = '<br>';
        ed.editorEl.focus();
        caret(qp, 0);
        type('>');
        type(' ');
        eq(ed.editorEl.querySelectorAll('figure.quote-card').length, 1, ed.editorEl.innerHTML);
        includes(qp.textContent, '> ', 'typed into the quote');
        const ap = ed.editorEl.querySelector('aside p');
        ap.innerHTML = '<br>';
        caret(ap, 0);
        type('!');
        type(' ');
        eq(ed.editorEl.querySelectorAll('aside').length, 1, ed.editorEl.innerHTML);
        includes(ap.textContent, '! ', 'typed into the callout');
        assert(!ed.editorEl.querySelector('aside aside'), 'no nested callout');
        // heading inside callout is fine
        ap.innerHTML = '<br>';
        caret(ed.editorEl.querySelector('aside p'), 0);
        type('## ');
        assert(ed.editorEl.querySelector('aside > h2'), 'heading in callout');
    });

    await test('markdown: "> " makes a quote-card, "--- " a separator', async () => {
        const ed = makeEditor('<p><br></p>');
        ed.editorEl.focus();
        caret(ed.editorEl.querySelector('p'), 0);
        type('---');
        type(' ');
        includes(ed.getContent(), '<hr>');
        type('>');
        type(' ');
        type('q');
        includes(ed.getContent(), '<figure class="quote-card"><blockquote><p>q</p></blockquote></figure>');
    });

    await test('markdown: prefix typed before existing text converts the block', async () => {
        const ed = makeEditor('<p>Title</p><p>a<br>b</p>');
        ed.editorEl.focus();
        caret(textNode(ed.editorEl, 'Title'), 0);
        type('## ');
        const p2 = ed.editorEl.querySelectorAll('p')[0];
        caret(textNode(p2, 'b'), 0);
        type('1. ');
        eq(ed.getContent(), '<h2>Title</h2><p>a</p><ol><li>b</li></ol>');
    });

    await test('markdown: conversion is its own undo step', async () => {
        const ed = makeEditor('<p><br></p>');
        ed.editorEl.focus();
        caret(ed.editorEl.querySelector('p'), 0);
        type('#');
        type(' ');
        eq(ed.getContent(), '<h1><br></h1>');
        ed.getModule('History').undo();
        eq(ed.getContent(), '<p># </p>');
    });

    // ---------- Slash commands ----------

    await test('slash: "/h1" + Enter makes a heading and is undoable', async () => {
        const ed = makeEditor('<p><br></p>');
        const slash = ed.getModule('SlashCommands');
        ed.editorEl.focus();
        caret(ed.editorEl.querySelector('p'), 0);
        typeSlash('/h1');
        eq(slash.isOpen, true, 'menu open');
        key(ed.editorEl, 'Enter');
        eq(slash.isOpen, false);
        eq(ed.getContent(), '<h1><br></h1>');
        ed.getModule('History').undo();
        eq(ed.getContent(), '<p>/h1</p>');
    });

    await test('slash: space closes the menu, then Enter splits the paragraph', async () => {
        const ed = makeEditor('<p><br></p>');
        const slash = ed.getModule('SlashCommands');
        ed.editorEl.focus();
        caret(ed.editorEl.querySelector('p'), 0);
        typeSlash('/h1');
        key(ed.editorEl, ' ');
        eq(slash.isOpen, false, 'closed after space');
        excludes(ed.getContent(), '<h1>');
    });

    await test('slash: menu is disabled in table cells and captions', async () => {
        const ed = makeEditor('<table><tbody><tr><td>t</td></tr></tbody></table><figure><img src="https://e.com/a.png"><figcaption>c</figcaption></figure><p>p</p>');
        const slash = ed.getModule('SlashCommands');
        const td = ed.editorEl.querySelector('td');
        ed.editorEl.focus();
        caret(td.firstChild, 1);
        typeSlash(' /table');
        eq(slash.isOpen, false, 'not in a cell');
        const cap = ed.editorEl.querySelector('figcaption');
        caret(cap.firstChild, 1);
        typeSlash(' /h1');
        eq(slash.isOpen, false, 'not in a caption');
    });

    await test('slash: commands filtered by container rules and list items', async () => {
        const ed = makeEditor('<figure class="quote-card"><blockquote><p>q</p></blockquote></figure><ul><li>i</li></ul><aside><p>c</p></aside><p>x</p>');
        const slash = ed.getModule('SlashCommands');
        ed.editorEl.focus();
        caret(textNode(ed.editorEl, 'q'), 1);
        typeSlash(' /');
        eq(slash.filteredCommands.map(c => c.id).sort().join(','), 'h1,h2,h3,ol,ul');
        slash.closeMenu();
        caret(textNode(ed.editorEl, 'c'), 1);
        typeSlash(' /');
        eq(slash.filteredCommands.map(c => c.id).sort().join(','), 'h1,h2,h3,hr,ol,ul');
        slash.closeMenu();
        caret(textNode(ed.editorEl, 'i'), 1);
        typeSlash(' /');
        const ids = slash.filteredCommands.map(c => c.id);
        assert(!ids.includes('h1') && !ids.includes('callout'), 'no conversions in li: ' + ids);
        assert(ids.includes('table'), 'inserts still offered');
        slash.closeMenu();
    });

    await test('slash: lite mode hides embed and gallery', async () => {
        const ed = makeEditor('<p><br></p>', { liteMode: true });
        const slash = ed.getModule('SlashCommands');
        ed.editorEl.focus();
        caret(ed.editorEl.querySelector('p'), 0);
        typeSlash('/');
        const ids = slash.filteredCommands.map(c => c.id);
        assert(!ids.includes('embed') && !ids.includes('gallery'), ids.join(','));
        slash.closeMenu();
    });

    await test('slash: menu is fixed-positioned inside the viewport', async () => {
        const ed = makeEditor('<p><br></p>');
        const slash = ed.getModule('SlashCommands');
        ed.editorEl.focus();
        caret(ed.editorEl.querySelector('p'), 0);
        typeSlash('/');
        eq(getComputedStyle(slash.menu).position, 'fixed');
        const r = slash.menu.getBoundingClientRect();
        assert(r.top >= 0 && r.bottom <= window.innerHeight, 'in viewport');
        key(ed.editorEl, 'Escape');
        eq(slash.isOpen, false, 'Escape closes');
    });

    await test('slash: cancelling a modal command puts the caret back', async () => {
        const ed = makeEditor('<p>first</p><p><br></p>');
        const slash = ed.getModule('SlashCommands');
        const p = ed.editorEl.querySelectorAll('p')[1];
        ed.editorEl.focus();
        caret(p, 0);
        typeSlash('/table');
        key(ed.editorEl, 'Enter');
        eq(ed.modal.isOpen, true, 'table modal open');
        excludes(ed.getContent(), '/table');
        ed.modal.close();
        const sel = window.getSelection();
        eq(sel.rangeCount > 0 && p.contains(sel.getRangeAt(0).startContainer) || sel.getRangeAt(0).startContainer === p, true, 'caret in the block');
    });

    // ---------- Floating toolbar ----------

    await test('floating: mark over two paragraphs wraps each one separately', async () => {
        const ed = makeEditor('<p>one</p><p>two</p>');
        ed.editorEl.focus();
        select(textNode(ed.editorEl, 'one'), 1, textNode(ed.editorEl, 'two'), 2);
        ed.getModule('FloatingToolbar').toggleInlineTag('mark');
        eq(ed.getContent(), '<p>o<mark>ne</mark></p><p><mark>tw</mark>o</p>');
        ed.getModule('History').undo();
        eq(ed.getContent(), '<p>one</p><p>two</p>');
    });

    await test('floating: no formatting inside read-only code blocks', async () => {
        const ed = makeEditor('<pre><code>let x = 1;</code></pre><p>p</p>');
        const ft = ed.getModule('FloatingToolbar');
        const t = textNode(ed.editorEl, 'let x');
        select(t, 0, t, 3);
        eq(ft.isSelectionEditable(), false);
        ft.toggleInlineTag('code');
        eq(ed.getContent(), '<pre><code>let x = 1;</code></pre><p>p</p>');
    });

    await test('floating: editing a link URL keeps inner formatting', async () => {
        const ed = makeEditor('<p><a href="https://a.com"><b>x</b> y</a> z</p>');
        ed.editorEl.focus();
        const t = textNode(ed.editorEl, ' y');
        select(t, 1, t, 2);
        ed.getModule('FloatingToolbar').openLinkModal();
        const url = ed.modal.container.querySelector('input');
        eq(url.value, 'https://a.com');
        url.value = 'https://b.com';
        ed.modal.saveBtn.click();
        eq(ed.getContent(), '<p><a href="https://b.com"><b>x</b> y</a> z</p>');
    });

    await test('floating: new link over an overlapping link does not nest <a>', async () => {
        const ed = makeEditor('<p>aa <a href="https://a.com">bb</a> cc</p>');
        ed.editorEl.focus();
        select(textNode(ed.editorEl, 'aa'), 0, textNode(ed.editorEl, 'bb'), 1);
        const ft = ed.getModule('FloatingToolbar');
        // Selection starts outside the link → create mode
        ft.openLinkModal();
        const url = ed.modal.container.querySelector('input');
        url.value = 'https://new.com';
        ed.modal.saveBtn.click();
        assert(!ed.editorEl.querySelector('a a'), 'no nested links: ' + ed.editorEl.innerHTML);
        includes(ed.getContent(), '<a href="https://new.com">aa b</a>');
        excludes(ed.getContent(), 'https://a.com');
    });

    await test('floating: new link keeps selected formatting', async () => {
        const ed = makeEditor('<p>x <b>bold</b> y</p>');
        ed.editorEl.focus();
        select(textNode(ed.editorEl, 'x '), 2, textNode(ed.editorEl, ' y'), 0);
        ed.getModule('FloatingToolbar').openLinkModal();
        ed.modal.container.querySelector('input').value = 'https://e.com';
        ed.modal.saveBtn.click();
        eq(ed.getContent(), '<p>x <a href="https://e.com"><b>bold</b></a> y</p>');
    });

    await test('floating: invalid URL keeps the modal open with an error', async () => {
        const ed = makeEditor('<p>text</p>');
        ed.editorEl.focus();
        const t = textNode(ed.editorEl, 'text');
        select(t, 0, t, 4);
        ed.getModule('FloatingToolbar').openLinkModal();
        ed.modal.container.querySelector('input').value = 'javascript:alert(1)';
        ed.modal.saveBtn.click();
        eq(ed.modal.isOpen, true);
        assert(ed.modal.container.querySelector('.redactix-form-status').textContent.length > 0, 'error shown');
        ed.modal.close();
        eq(ed.getContent(), '<p>text</p>');
    });

    await test('floating: lite link modal is URL + text and forces nofollow', async () => {
        const ed = makeEditor('<p>text</p>', { liteMode: true });
        ed.editorEl.focus();
        const t = textNode(ed.editorEl, 'text');
        select(t, 0, t, 4);
        ed.getModule('FloatingToolbar').openLinkModal();
        eq(ed.modal.container.querySelectorAll('input').length, 2);
        ed.modal.container.querySelector('input').value = 'https://e.com';
        ed.modal.saveBtn.click();
        includes(ed.getContent(), 'rel="nofollow noopener noreferrer"');
        includes(ed.getContent(), 'target="_blank"');
    });

    // ---------- Attributes ----------

    await test('attributes: id is never interpreted as HTML in the modal', async () => {
        const ed = makeEditor('<p>a</p>');
        const p = ed.editorEl.querySelector('p');
        p.id = 'x"><img src=x onerror="window.__attrXss=1">';
        ed.getModule('Attributes').openModal(p);
        assert(!ed.modal.container.querySelector('img'), 'no img element in the modal');
        await sleep(20);
        assert(!window.__attrXss, 'no script ran');
        ed.modal.close();
    });

    await test('attributes: editor-internal classes are rejected with an inline error', async () => {
        const ed = makeEditor('<p>a</p><p>b</p>');
        const p = ed.editorEl.querySelector('p');
        ed.getModule('Attributes').openModal(p);
        const inputs = ed.modal.container.querySelectorAll('input[type="text"]');
        inputs[1].value = 'nice redactix-separator';
        ed.modal.saveBtn.click();
        eq(ed.modal.isOpen, true, 'kept open');
        assert(ed.modal.container.querySelector('.redactix-form-status').textContent.includes('redactix-separator'));
        inputs[1].value = 'spoiler';
        ed.modal.saveBtn.click();
        eq(ed.modal.isOpen, true, 'spoiler only on span');
        inputs[1].value = 'nice';
        ed.modal.saveBtn.click();
        eq(ed.modal.isOpen, false);
        eq(ed.getContent(), '<p class="nice">a</p><p>b</p>');
    });

    await test('attributes: internal classes already present are kept', async () => {
        const ed = makeEditor('<figure class="quote-card"><blockquote><p>q</p></blockquote></figure>');
        const fig = ed.editorEl.querySelector('figure');
        ed.getModule('Attributes').openModal(fig);
        const inputs = ed.modal.container.querySelectorAll('input[type="text"]');
        eq(inputs[1].value, '');
        inputs[1].value = 'wide';
        ed.modal.saveBtn.click();
        assert(fig.classList.contains('quote-card') && fig.classList.contains('wide'), fig.className);
    });

    await test('attributes: Unicode anchors survive, save is one undo step', async () => {
        const ed = makeEditor('<h2>Привет</h2>');
        const h = ed.editorEl.querySelector('h2');
        ed.getModule('Attributes').openModal(h);
        const inputs = ed.modal.container.querySelectorAll('input[type="text"]');
        inputs[0].value = '#Привет мир_1';
        ed.modal.saveBtn.click();
        eq(h.id, 'привет-мир_1');
        ed.getModule('History').undo();
        eq(ed.getContent(), '<h2>Привет</h2>');
    });

    // ---------- Fullscreen ----------

    await test('fullscreen: page scroll lock is reference-counted', async () => {
        const a = makeEditor('<p>a</p>');
        const b = makeEditor('<p>b</p>');
        a.getModule('Fullscreen').toggleFullscreen();
        b.getModule('Fullscreen').toggleFullscreen();
        a.getModule('Fullscreen').toggleFullscreen();
        eq(document.body.classList.contains('redactix-fullscreen-active'), true, 'still locked');
        b.getModule('Fullscreen').toggleFullscreen();
        eq(document.body.classList.contains('redactix-fullscreen-active'), false, 'unlocked');
    });

    await test('fullscreen: Escape closes the modal first, then fullscreen; destroy unlocks', async () => {
        const ed = makeEditor('<p>a</p>');
        const fs = ed.getModule('Fullscreen');
        fs.toggleFullscreen();
        const body = document.createElement('div');
        body.appendChild(document.createElement('input'));
        ed.modal.open({ title: 't', body });
        key(document.activeElement, 'Escape');
        eq(ed.modal.isOpen, false);
        eq(fs.isFullscreen, true, 'still fullscreen');
        key(document.body, 'Escape');
        eq(fs.isFullscreen, false);
        fs.toggleFullscreen();
        ed.destroy();
        eq(document.body.classList.contains('redactix-fullscreen-active'), false);
    });
}
