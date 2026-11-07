// blocks suite — BlockControl, BlockGap, QuoteCard, Callout, Table, Code,
// Separator, List.
import { test, assert, eq, includes, excludes, makeEditor, frame, caret, textNode, key } from '../lib.js';

const mod = (ed, name) => ed.getModule(name);
const history = (ed) => ed.getModule('History');
const undo = (ed) => history(ed).undo();
const steps = (ed) => history(ed).undoStack.length;

function pointer(type, target, x, y) {
    target.dispatchEvent(new PointerEvent(type, {
        bubbles: true, cancelable: true, pointerId: 7, pointerType: 'mouse',
        button: 0, isPrimary: true, clientX: x, clientY: y
    }));
}

/**
 * Drag `block` with the main handle (or the handle of `kind`) and drop it
 * at the upper ('before') or lower ('after') edge of `toEl`.
 */
function drag(ed, block, toEl, where = 'after', kind = 'block') {
    const ctrl = mod(ed, 'BlockControl');
    if (kind === 'list') ctrl.currentList = block;
    else if (kind === 'container') ctrl.currentContainer = block;
    else ctrl.currentBlock = block;
    const handle = ctrl.handles.el(kind);
    const r = toEl.getBoundingClientRect();
    const x = r.left + Math.min(12, r.width / 2);
    const y = where === 'before' ? r.top + 3 : r.bottom - 3;
    pointer('pointerdown', handle, 1, 1);
    pointer('pointermove', document, x, y);
    pointer('pointerup', document, x, y);
}

export default async function () {
    // ---------- Table insert (B1, B15) ----------

    await test('blocks: insertTable puts a table at block level, one undo step', async () => {
        const ed = makeEditor('<p>hello</p>');
        const p = ed.editorEl.querySelector('p');
        caret(p.firstChild, 5);
        const before = steps(ed);
        mod(ed, 'Table').insertTable(2, 2, true);
        const table = ed.editorEl.querySelector('table');
        assert(table && table.parentElement === ed.editorEl, 'table is a direct child of the editor');
        assert(!ed.editorEl.querySelector('p table'), 'no table inside a paragraph');
        eq(steps(ed), before + 1, 'exactly one undo step');
        undo(ed);
        assert(!ed.editorEl.querySelector('table'), 'undo removes the table');
    });

    await test('blocks: table modal save inserts one table and closes', async () => {
        const ed = makeEditor('<p>x</p>');
        caret(ed.editorEl.querySelector('p').firstChild, 1);
        mod(ed, 'Table').openModal();
        const overlay = ed.wrapper.querySelector('.redactix-modal-overlay');
        assert(overlay.classList.contains('is-open'), 'modal open');
        overlay.querySelector('.redactix-modal-btn-primary').click();
        assert(!overlay.classList.contains('is-open'), 'modal closed after save');
        eq(ed.editorEl.querySelectorAll('table').length, 1, 'one table');
        excludes(ed.getContent(), '<p><table');
    });

    await test('blocks: table inserted in a callout lands after the callout', async () => {
        const ed = makeEditor('<aside><p>note</p></aside><p>after</p>');
        caret(textNode(ed.editorEl, 'note'), 2);
        mod(ed, 'Table').insertTable(1, 1, false);
        const table = ed.editorEl.querySelector('table');
        eq(table.parentElement, ed.editorEl, 'table at top level');
        eq(table.previousElementSibling.tagName, 'ASIDE');
    });

    // ---------- Code / Separator (B3, B15, B20) ----------

    await test('blocks: code insert / update / separator are single undo steps', async () => {
        const ed = makeEditor('<p>a</p>');
        caret(ed.editorEl.querySelector('p').firstChild, 1);
        const code = mod(ed, 'Code');
        let n = steps(ed);
        const pre = code.insertCodeBlock('let x;', 'javascript');
        eq(steps(ed), n + 1, 'insert = one step');
        eq(pre.parentElement, ed.editorEl);
        n = steps(ed);
        code.updateCodeBlock(pre, 'let y;', 'php');
        eq(steps(ed), n + 1, 'update = one step');
        includes(ed.getContent(), '<code class="language-php">let y;</code>');
        caret(ed.editorEl.querySelector('p').firstChild, 1);
        n = steps(ed);
        mod(ed, 'Separator').insertSeparator();
        eq(steps(ed), n + 1, 'separator = one step');
        includes(ed.getContent(), '<hr>');
        undo(ed);
        excludes(ed.getContent(), '<hr>');
    });

    await test('blocks: separator inserted in a quote card lands after the card', async () => {
        const ed = makeEditor('<blockquote><p>quote</p></blockquote>');
        caret(textNode(ed.editorEl, 'quote'), 2);
        mod(ed, 'Separator').insertSeparator();
        const sep = ed.editorEl.querySelector('.redactix-separator');
        eq(sep.parentElement, ed.editorEl);
        excludes(ed.editorEl.querySelector('figure.quote-card').innerHTML, '<hr');
    });

    await test('blocks: code modal keeps an unknown language and other classes', async () => {
        const ed = makeEditor('<pre><code class="language-diff hljs">- a</code></pre><p>x</p>');
        const pre = ed.editorEl.querySelector('pre');
        mod(ed, 'Code').openModal(pre);
        const overlay = ed.wrapper.querySelector('.redactix-modal-overlay');
        const select = overlay.querySelector('select');
        eq(select.value, 'diff', 'unknown language preselected');
        const labels = Array.from(overlay.querySelectorAll('label')).map(l => l.textContent);
        assert(labels.includes(ed.t('code.code')), 'textarea has its own label');
        overlay.querySelector('.redactix-modal-btn-primary').click();
        const cls = ed.editorEl.querySelector('pre code').className;
        includes(cls, 'language-diff');
        includes(cls, 'hljs');
        mod(ed, 'Code').updateCodeBlock(pre, 'x', '');
        eq(ed.editorEl.querySelector('pre code').getAttribute('class'), 'hljs', 'language removed, other class kept');
        mod(ed, 'Code').updateCodeBlock(ed.editorEl.querySelector('pre'), 'x', '');
        const code = ed.editorEl.querySelector('pre code');
        code.className = 'language-js';
        mod(ed, 'Code').updateCodeBlock(ed.editorEl.querySelector('pre'), 'x', '');
        assert(!code.hasAttribute('class'), 'no empty class attribute');
    });

    // ---------- BlockControl transforms (B2) ----------

    await test('blocks: callout → paragraph lifts its blocks out, no preset class leak', async () => {
        const ed = makeEditor('<aside class="warning" id="c1"><p>a</p><ul><li>b</li></ul></aside><p>z</p>');
        const ctrl = mod(ed, 'BlockControl');
        ctrl.currentBlock = ed.editorEl.querySelector('aside');
        ctrl.transformBlock('P');
        eq(ed.getContent(), '<p id="c1">a</p><ul><li>b</li></ul><p>z</p>');
    });

    await test('blocks: callout → heading re-tags only the first block', async () => {
        const ed = makeEditor('<aside><p>title</p><p>body</p></aside>');
        const ctrl = mod(ed, 'BlockControl');
        ctrl.currentBlock = ed.editorEl.querySelector('aside');
        ctrl.transformBlock('H2');
        includes(ed.getContent(), '<h2>title</h2><p>body</p>');
        excludes(ed.getContent(), '<aside');
    });

    await test('blocks: paragraph → callout wraps content in <p>, keeps only safe attrs', async () => {
        const ed = makeEditor('<p class="lead" id="x" dir="ltr">hi <b>there</b></p>');
        const ctrl = mod(ed, 'BlockControl');
        ctrl.currentBlock = ed.editorEl.querySelector('p');
        const n = steps(ed);
        ctrl.transformBlock('ASIDE');
        eq(ed.getContent(), '<aside id="x" dir="ltr"><p>hi <b>there</b></p></aside>');
        eq(steps(ed), n + 1, 'one undo step');
        ctrl.currentBlock = ed.editorEl.querySelector('aside');
        ctrl.transformBlock('H1');
        eq(ed.getContent(), '<h1 id="x" dir="ltr">hi <b>there</b></h1>');
    });

    await test('blocks: heading ↔ paragraph keeps attributes; inner block cannot become callout', async () => {
        const ed = makeEditor('<h2 class="k">t</h2><aside><p>in</p></aside>');
        const ctrl = mod(ed, 'BlockControl');
        ctrl.currentBlock = ed.editorEl.querySelector('h2');
        ctrl.transformBlock('P');
        includes(ed.getContent(), '<p class="k">t</p>');
        ctrl.currentBlock = ed.editorEl.querySelector('aside p');
        ctrl.transformBlock('ASIDE');
        eq(ed.editorEl.querySelectorAll('aside').length, 1, 'no nested callout');
    });

    // ---------- BlockControl commands: undo, stale refs, empty hosts (B3, B12, B13) ----------

    await test('blocks: delete / duplicate / insert below / preset are single undo steps', async () => {
        const ed = makeEditor('<p>one</p><p>two</p><aside><p>c</p></aside>');
        const ctrl = mod(ed, 'BlockControl');
        let n = steps(ed);
        ctrl.currentBlock = ed.editorEl.querySelector('p');
        ctrl.duplicateBlock();
        eq(steps(ed), n + 1, 'duplicate');
        eq(ed.editorEl.querySelectorAll('p').length, 4);
        n = steps(ed);
        ctrl.currentBlock = ed.editorEl.querySelector('p');
        ctrl.deleteBlock();
        eq(steps(ed), n + 1, 'delete');
        n = steps(ed);
        ctrl.currentBlock = ed.editorEl.querySelector('aside');
        ctrl.setPresetClass('warning', ctrl.calloutPresets);
        eq(steps(ed), n + 1, 'preset');
        includes(ed.getContent(), '<aside class="warning">');
        n = steps(ed);
        ctrl.currentBlock = ed.editorEl.querySelector('p');
        ctrl.insertElementAfter();
        eq(steps(ed), n + 1, 'insert below');
        undo(ed);
        undo(ed);
        excludes(ed.getContent(), 'warning');
    });

    await test('blocks: deleting a block clears handles; stale target is ignored', async () => {
        const ed = makeEditor('<ul><li>a</li><li>b</li></ul><p>p</p>');
        const ctrl = mod(ed, 'BlockControl');
        const list = ed.editorEl.querySelector('ul');
        ctrl.currentBlock = list;
        ctrl.deleteBlock();
        eq(ctrl.currentBlock, null, 'currentBlock cleared');
        eq(ctrl.handle.style.display, 'none', 'handle hidden');
        // A stale reference (e.g. after undo) must not resurrect the list.
        ctrl.currentBlock = list;
        ctrl.deleteBlock();
        ctrl.duplicateBlock();
        drag(ed, list, ed.editorEl.querySelector('p'));
        excludes(ed.getContent(), '<ul>');
        ctrl.currentBlock = list;
        ctrl.openMenu('block');
        assert(!ctrl.menu.isOpen, 'no menu for a detached block');
    });

    await test('blocks: undo / setContent drop handle targets', async () => {
        const ed = makeEditor('<p>a</p><p>b</p>');
        const ctrl = mod(ed, 'BlockControl');
        ctrl.currentBlock = ed.editorEl.querySelector('p');
        ctrl.deleteBlock();
        ctrl.currentBlock = ed.editorEl.querySelector('p');
        undo(ed);
        eq(ctrl.currentBlock, null);
    });

    await test('blocks: deleting the last block of a callout / editor leaves a paragraph', async () => {
        const ed = makeEditor('<aside><p>only</p></aside><p>x</p>');
        const ctrl = mod(ed, 'BlockControl');
        ctrl.currentBlock = ed.editorEl.querySelector('aside p');
        ctrl.deleteBlock();
        const aside = ed.editorEl.querySelector('aside');
        assert(aside && aside.querySelector(':scope > p'), 'callout keeps a paragraph');

        const ed2 = makeEditor('<p>solo</p>');
        const ctrl2 = mod(ed2, 'BlockControl');
        ctrl2.currentBlock = ed2.editorEl.querySelector('p');
        ctrl2.deleteBlock();
        assert(ed2.editorEl.querySelector(':scope > p'), 'editor keeps a paragraph');

        const ed3 = makeEditor('<blockquote><ul><li>x</li></ul></blockquote>');
        const ctrl3 = mod(ed3, 'BlockControl');
        ctrl3.currentBlock = ed3.editorEl.querySelector('li');
        ctrl3.deleteBlock();
        const bq = ed3.editorEl.querySelector('figure.quote-card > blockquote');
        assert(bq && bq.querySelector(':scope > p'), 'quote body keeps a paragraph');
        assert(!bq.querySelector('ul'), 'empty list removed');
    });

    await test('blocks: convert list type; a menu-click only (no drag) adds no undo step', async () => {
        const ed = makeEditor('<ul class="x"><li>a</li></ul>');
        const ctrl = mod(ed, 'BlockControl');
        ctrl.currentBlock = ed.editorEl.querySelector('li');
        let n = steps(ed);
        ctrl.convertListType('OL');
        eq(ed.getContent(), '<ol class="x"><li>a</li></ol>');
        eq(steps(ed), n + 1);
        n = steps(ed);
        ctrl.currentBlock = ed.editorEl.querySelector('li');
        pointer('pointerdown', ctrl.handle, 5, 5);
        pointer('pointerup', document, 5, 5);
        assert(!history(ed).batchInProgress, 'no batch left open');
        eq(steps(ed), n, 'no dead step');
    });

    // ---------- Drag & drop (B4, B8, B9, B10, B11, P2) ----------

    await test('blocks: drag never drops into a table cell / figure', async () => {
        const ed = makeEditor('<p>one</p><table><tbody><tr><td><p>cell</p></td></tr></tbody></table><p>three</p>');
        const one = ed.editorEl.querySelector('p');
        const cellP = ed.editorEl.querySelector('td p');
        drag(ed, one, cellP, 'after');
        eq(one.parentElement, ed.editorEl, 'still a top-level block');
        eq(one.previousElementSibling && one.previousElementSibling.tagName, 'TABLE', 'dropped after the table');
        eq(ed.editorEl.querySelector('td').textContent, 'cell');
        assert(!history(ed).batchInProgress, 'batch closed');
    });

    await test('blocks: dropping onto a separator keeps the block', async () => {
        const ed = makeEditor('<p>a</p><hr><p>b</p>');
        const b = Array.from(ed.editorEl.querySelectorAll('p')).find(p => p.textContent === 'b');
        const sep = ed.editorEl.querySelector('.redactix-separator');
        drag(ed, b, sep, 'before');
        eq(ed.getContent(), '<p>a</p><p>b</p><hr>');
    });

    await test('blocks: drag is one undo step and the drop class is cleaned', async () => {
        const ed = makeEditor('<p>a</p><p>b</p><p>c</p>');
        const [a, , c] = ed.editorEl.querySelectorAll('p');
        const n = steps(ed);
        drag(ed, a, c, 'after');
        eq(ed.getContent(), '<p>b</p><p>c</p><p>a</p>');
        eq(steps(ed), n + 1);
        assert(!a.hasAttribute('class'), 'no leftover class attribute');
        assert(!ed.wrapper.classList.contains('redactix-dragging'));
        undo(ed);
        eq(ed.getContent(), '<p>a</p><p>b</p><p>c</p>');
    });

    await test('blocks: top-level block dragged over a callout lands next to it, not inside', async () => {
        const ed = makeEditor('<p>top</p><aside><p>in1</p><p>in2</p></aside><p>end</p>');
        const top = ed.editorEl.querySelector('p');
        drag(ed, top, textNode(ed.editorEl, 'in2').parentElement, 'after');
        eq(top.parentElement, ed.editorEl);
        eq(ed.editorEl.querySelectorAll('aside p').length, 2);
    });

    await test('blocks: inner callout block moves inside its callout only', async () => {
        const ed = makeEditor('<aside><p>in1</p><p>in2</p></aside><p>out</p>');
        const in1 = textNode(ed.editorEl, 'in1').parentElement;
        drag(ed, in1, textNode(ed.editorEl, 'in2').parentElement, 'after');
        eq(ed.editorEl.querySelector('aside').innerHTML.replace(/ class="[^"]*"/g, ''), '<p>in2</p><p>in1</p>');
        drag(ed, in1, textNode(ed.editorEl, 'out').parentElement, 'after');
        eq(in1.parentElement.tagName, 'ASIDE', 'cannot escape the callout');
    });

    await test('blocks: list item dropped onto its own sub-list does not throw', async () => {
        const ed = makeEditor('<ul><li>a<ul><li>c</li></ul></li><li>d</li></ul>');
        const a = ed.editorEl.querySelector('li');
        const errors = [];
        const onErr = (e) => errors.push(e);
        window.addEventListener('error', onErr);
        drag(ed, a, textNode(ed.editorEl, 'c').parentElement, 'after');
        window.removeEventListener('error', onErr);
        eq(errors.length, 0, 'no errors');
        eq(ed.getContent(), '<ul><li>a<ul><li>c</li></ul></li><li>d</li></ul>');
    });

    await test('blocks: dragging the last item out of a list removes the empty list', async () => {
        const ed = makeEditor('<ul><li>a</li></ul><p>mid</p><ul><li>b</li></ul>');
        const a = ed.editorEl.querySelector('li');
        drag(ed, a, textNode(ed.editorEl, 'b').parentElement, 'after');
        eq(ed.getContent(), '<p>mid</p><ul><li>b</li><li>a</li></ul>');
    });

    await test('blocks: whole list moves with the list handle', async () => {
        const ed = makeEditor('<ul><li>a</li><li>b</li></ul><p>p</p>');
        const ul = ed.editorEl.querySelector('ul');
        drag(ed, ul, ed.editorEl.querySelector('p'), 'after', 'list');
        eq(ed.getContent(), '<p>p</p><ul><li>a</li><li>b</li></ul>');
    });

    await test('blocks: gap handle and table handles are hidden during a drag', async () => {
        const ed = makeEditor('<p>a</p><p>b</p>');
        const ctrl = mod(ed, 'BlockControl');
        ctrl.currentBlock = ed.editorEl.querySelector('p');
        pointer('pointerdown', ctrl.handle, 1, 1);
        const r = ed.editorEl.querySelectorAll('p')[1].getBoundingClientRect();
        pointer('pointermove', document, r.left + 5, r.top + 3);
        assert(ctrl.isDragging, 'drag started');
        assert(ed.isDraggingBlock, 'instance flag set');
        const gap = mod(ed, 'BlockGap');
        gap.onMouseMove({ target: ed.editorEl, x: r.left + 5, y: r.top - 2 });
        eq(gap.handle.style.display, 'none', 'gap handle stays hidden');
        eq(getComputedStyle(mod(ed, 'Table').cellHandle).display, 'none');
        const ghost = document.querySelector('.redactix-drag-ghost');
        assert(ghost, 'ghost shown');
        pointer('pointerup', document, r.left + 5, r.top + 3);
        assert(!document.querySelector('.redactix-drag-ghost'), 'ghost removed');
        assert(!ed.isDraggingBlock);
    });

    await test('blocks: destroy during a drag ends the batch and removes the ghost', async () => {
        const ed = makeEditor('<p>a</p><p>b</p>', { theme: 'dark' });
        const ctrl = mod(ed, 'BlockControl');
        ctrl.currentBlock = ed.editorEl.querySelector('p');
        pointer('pointerdown', ctrl.handle, 1, 1);
        pointer('pointermove', document, 200, 300);
        const ghost = document.querySelector('.redactix-drag-ghost');
        assert(ghost && ghost.classList.contains('redactix-dark'), 'ghost mirrors the theme');
        ed.destroy();
        assert(!document.querySelector('.redactix-drag-ghost'), 'ghost removed on destroy');
    });

    // ---------- Menu (B5, A5, labels) ----------

    await test('blocks: block menu sits above fullscreen, closes on Escape, labels are text', async () => {
        const ed = makeEditor('<aside><p>c</p></aside>', {
            calloutPresets: [{ name: 'evil', label: '<img src=x onerror="window.__pwn=1">', class: 'evil' }]
        });
        const ctrl = mod(ed, 'BlockControl');
        ctrl.currentBlock = ed.editorEl.querySelector('aside');
        ctrl.openMenu('block');
        const menu = ctrl.menu.el;
        assert(ctrl.menu.isOpen, 'menu open');
        assert(Number(getComputedStyle(menu).zIndex) > 9999, 'z-index above fullscreen');
        assert(!menu.querySelector('img'), 'preset label rendered as text');
        includes(menu.textContent, '<img');
        includes(menu.textContent, ed.t('blockControl.addEmoji'), 'callout contributes emoji item');
        key(document.body, 'Escape');
        assert(!ctrl.menu.isOpen, 'Escape closes the menu');
    });

    await test('blocks: quote-card menu offers caption items from QuoteCard', async () => {
        const ed = makeEditor('<blockquote><p>q</p></blockquote>');
        const ctrl = mod(ed, 'BlockControl');
        ctrl.currentBlock = ed.editorEl.querySelector('figure.quote-card');
        ctrl.openMenu('block');
        includes(ctrl.menu.el.textContent, ed.t('quoteCard.addCaption'));
        includes(ctrl.menu.el.textContent, ed.t('blockControl.quoteStyle'));
        ctrl.hideMenu();
    });

    // ---------- Emoji (Callout) ----------

    await test('blocks: callout emoji validation rejects plain ASCII', async () => {
        const c = mod(makeEditor('<p>x</p>'), 'Callout');
        ['1', '#', '*', 'a', '12', ':)'].forEach(v => eq(c.isValidEmoji(v), false, v));
        ['😀', '👍🏽', '🇺🇸', '1️⃣', '👩‍💻', '❤️'].forEach(v => eq(c.isValidEmoji(v), true, v));
    });

    await test('blocks: emoji editor saves as one undo step', async () => {
        const ed = makeEditor('<aside><p>c</p></aside>');
        const callout = mod(ed, 'Callout');
        const aside = ed.editorEl.querySelector('aside');
        const n = steps(ed);
        callout.openEmojiEditor(aside);
        const input = ed.wrapper.querySelector('.redactix-emoji-input input');
        input.value = '🔥';
        key(input, 'Enter');
        eq(aside.getAttribute('data-emoji'), '🔥');
        eq(steps(ed), n + 1);
        assert(!ed.wrapper.querySelector('.redactix-emoji-input'), 'editor closed');
        callout.removeEmoji(aside);
        assert(!aside.hasAttribute('data-emoji'));
    });

    // ---------- QuoteCard / Callout structure (B6, B7, B14, cite) ----------

    await test('blocks: nested blockquotes are flattened into one card', async () => {
        const ed = makeEditor('<blockquote><p>a</p><blockquote><p>b</p></blockquote></blockquote>');
        eq(ed.editorEl.querySelectorAll('figure.quote-card').length, 1);
        // (the trailing empty paragraph after a final atomic block is core behaviour)
        eq(ed.getContent(), '<figure class="quote-card"><blockquote><p>a</p><p>b</p></blockquote></figure><p><br></p>');
    });

    await test('blocks: disallowed blocks are moved out of quotes / callouts, not wrapped in <p>', async () => {
        const ed = makeEditor('<blockquote><p>a</p><pre><code>x</code></pre><table><tbody><tr><td>t</td></tr></tbody></table></blockquote>');
        const out = ed.getContent();
        eq(out, '<figure class="quote-card"><blockquote><p>a</p></blockquote></figure><pre><code>x</code></pre><table><tbody><tr><td>t</td></tr></tbody></table><p><br></p>');
        const ed2 = makeEditor('<aside>text<pre><code>y</code></pre><div>legacy</div></aside>');
        eq(ed2.getContent(), '<aside><p>text</p><p>legacy</p></aside><pre><code>y</code></pre><p><br></p>');
    });

    await test('blocks: content added to an existing card is normalised on setup', async () => {
        const ed = makeEditor('<figure class="quote-card"><blockquote><p>a</p></blockquote></figure>');
        const bq = ed.editorEl.querySelector('figure.quote-card > blockquote');
        const pre = document.createElement('pre');
        pre.textContent = 'code';
        bq.appendChild(pre);
        bq.appendChild(document.createTextNode('loose'));
        ed.setupContent();
        eq(pre.parentElement, ed.editorEl, 'pre moved after the card');
        includes(bq.innerHTML, '<p>loose</p>');
    });

    await test('blocks: bare text in a quote caption becomes the author span', async () => {
        const ed = makeEditor('<figure class="quote-card"><blockquote><p>q</p></blockquote><figcaption>John <a href="https://e.com">Doe</a></figcaption></figure>');
        includes(ed.getContent(), '<figcaption><span>John <a href="https://e.com">Doe</a></span></figcaption>');
        const span = ed.editorEl.querySelector('figcaption > span');
        eq(span.getAttribute('contenteditable'), 'true', 'author text is editable');
    });

    await test('blocks: semantic <figure><blockquote><figcaption> is upgraded in place', async () => {
        const ed = makeEditor('<figure><blockquote><p>q</p></blockquote><figcaption>Ann</figcaption></figure>');
        eq(ed.editorEl.querySelectorAll('figure').length, 1, 'no nested figure');
        eq(ed.getContent(), '<figure class="quote-card"><blockquote><p>q</p></blockquote><figcaption><span>Ann</span></figcaption></figure><p><br></p>');
    });

    await test('blocks: cite attribution keeps links; inline cite in text stays', async () => {
        const ed = makeEditor('<blockquote><p>See <cite>The Book</cite> here</p><footer>— <cite><a href="https://x.com/">X</a></cite></footer></blockquote>');
        const out = ed.getContent();
        includes(out, '<p>See <cite>The Book</cite> here</p>');
        includes(out, '<figcaption><span><a href="https://x.com/">X</a></span></figcaption>');
        excludes(out, '<footer');
    });

    await test('blocks: foreign caption children are moved out in order', async () => {
        const ed = makeEditor('<figure class="quote-card"><blockquote><p>q</p></blockquote><figcaption><span>A</span><p>one</p><p>two</p></figcaption></figure>');
        eq(ed.getContent(), '<figure class="quote-card"><blockquote><p>q</p></blockquote><figcaption><span>A</span></figcaption></figure><p>one</p><p>two</p>');
    });

    await test('blocks: quote card insert and author change are single undo steps', async () => {
        const ed = makeEditor('<p>x</p><p><br></p>');
        caret(ed.editorEl.querySelectorAll('p')[1], 0);
        const qc = mod(ed, 'QuoteCard');
        let n = steps(ed);
        qc.insertEmpty();
        const card = ed.editorEl.querySelector('figure.quote-card');
        assert(card && card.parentElement === ed.editorEl, 'card inserted at top level');
        eq(steps(ed), n + 1);
        // (an empty caption isn't saved, so adding one is not a content change)
        qc.addCaption(card);
        assert(card.querySelector('figcaption > span'), 'caption span added');
        n = steps(ed);
        ed.transact(() => qc.applyAuthor(card, { photoUrl: '', photoAlt: '', authorText: 'Me' }));
        eq(steps(ed), n + 1);
        includes(ed.getContent(), '<span>Me</span>');
    });

    // ---------- Table operations (B16, B17, B18, B19) ----------

    const cellByText = (ed, text) => Array.from(ed.editorEl.querySelectorAll('td, th')).find(c => c.textContent === text);
    const rowWidth = (tr) => Array.from(tr.cells).reduce((w, c) => w + (parseInt(c.getAttribute('colspan'), 10) || 1), 0);

    await test('blocks: column insert respects colspan', async () => {
        const ed = makeEditor('<table><tbody><tr><td colspan="2">a</td><td>b</td></tr><tr><td>c</td><td>d</td><td>e</td></tr></tbody></table>');
        const table = mod(ed, 'Table');
        table.currentCell = cellByText(ed, 'd');
        const n = steps(ed);
        table.insertColumn('before');
        eq(steps(ed), n + 1, 'one undo step');
        const rows = ed.editorEl.querySelector('table').rows;
        eq(rowWidth(rows[0]), 4);
        eq(rowWidth(rows[1]), 4);
        eq(rows[0].cells[0].getAttribute('colspan'), '3', 'spanning cell widened');
        eq(rows[1].cells[2].textContent, 'd', 'new cell before d');
    });

    await test('blocks: row insert / delete respect rowspan', async () => {
        const ed = makeEditor('<table><tbody><tr><td rowspan="2">a</td><td>b</td></tr><tr><td>c</td></tr><tr><td>x</td><td>y</td></tr></tbody></table>');
        const table = mod(ed, 'Table');
        table.currentCell = cellByText(ed, 'b');
        table.insertRow('after');
        const t = ed.editorEl.querySelector('table');
        eq(cellByText(ed, 'a').getAttribute('rowspan'), '3', 'rowspan grew');
        eq(t.rows[1].cells.length, 1, 'new row has one cell (other column is spanned)');
        // Delete the first row: "a" moves down with a smaller span.
        table.currentCell = cellByText(ed, 'b');
        table.deleteRow();
        eq(t.rows.length, 3);
        eq(cellByText(ed, 'a').getAttribute('rowspan'), '2');
        eq(cellByText(ed, 'a').parentElement, t.rows[0]);
    });

    await test('blocks: column delete with colspan; nested table rows untouched', async () => {
        const ed = makeEditor('<table><tbody><tr><td colspan="2">a</td></tr><tr><td>b</td><td>c<table><tbody><tr><td>n1</td><td>n2</td></tr></tbody></table></td></tr></tbody></table>');
        const table = mod(ed, 'Table');
        table.currentCell = cellByText(ed, 'b');
        table.deleteColumn();
        const outer = ed.editorEl.querySelector('table');
        assert(!outer.rows[0].cells[0].hasAttribute('colspan'), 'colspan shrank');
        eq(outer.rows[1].cells.length, 1);
        eq(ed.editorEl.querySelectorAll('table table td').length, 2, 'nested table intact');
    });

    await test('blocks: insert row below the header row creates a body row', async () => {
        const ed = makeEditor('<table><thead><tr><th>h</th></tr></thead><tbody><tr><td>d</td></tr></tbody></table>');
        const table = mod(ed, 'Table');
        table.currentCell = cellByText(ed, 'h');
        table.insertRow('after');
        const t = ed.editorEl.querySelector('table');
        eq(t.tHead.rows.length, 1, 'still one header row');
        eq(t.tBodies[0].rows.length, 2);
        eq(t.tBodies[0].rows[0].cells[0].tagName, 'TD');
    });

    await test('blocks: header row toggle keeps position and attributes; label reflects state', async () => {
        const ed = makeEditor('<table><tbody><tr><td class="k" colspan="2">r1</td></tr><tr><td>a</td><td>b</td></tr></tbody></table>');
        const table = mod(ed, 'Table');
        table.currentCell = cellByText(ed, 'a');
        table.buildContextMenu('row');
        includes(table.contextMenu.textContent, ed.t('table.makeRowHeader'));
        table.toggleHeaderRow();
        const t = ed.editorEl.querySelector('table');
        eq(t.rows[1].cells[0].tagName, 'TH', 'second row cells are th');
        eq(t.rows[1].cells[0].textContent, 'a', 'row did not move');
        assert(!t.tHead, 'a middle row does not go to thead');
        table.currentCell = t.rows[1].cells[0];
        table.buildContextMenu('row');
        includes(table.contextMenu.textContent, ed.t('table.makeRowRegular'));
        // First row → thead, attributes kept.
        table.currentCell = cellByText(ed, 'r1');
        table.toggleHeaderRow();
        assert(t.tHead && t.tHead.rows.length === 1, 'first row moved to thead');
        const th = t.tHead.rows[0].cells[0];
        eq(th.tagName, 'TH');
        eq(th.getAttribute('colspan'), '2');
        eq(th.className, 'k');
        table.currentCell = th;
        table.toggleHeaderRow();
        assert(!t.tHead, 'thead removed when made regular');
        eq(t.rows[0].cells[0].textContent, 'r1', 'order unchanged');
        eq(t.rows[0].cells[0].tagName, 'TD');
    });

    await test('blocks: table menu hides attributes in lite mode and is position:fixed', async () => {
        const ed = makeEditor('<table><tbody><tr><td>a</td></tr></tbody></table>', { liteMode: true });
        const table = mod(ed, 'Table');
        table.currentCell = cellByText(ed, 'a');
        table.buildContextMenu('full');
        excludes(table.contextMenu.textContent, ed.t('table.cellAttributes'));
        excludes(table.contextMenu.textContent, ed.t('table.rowAttributes'));
        eq(getComputedStyle(table.contextMenu).position, 'fixed');
        table.showContextMenuAtHandle(table.cellHandle, 'cell');
        assert(table.isMenuOpen());
        key(document.body, 'Escape');
        assert(!table.isMenuOpen(), 'Escape closes the table menu');
    });

    await test('blocks: table ops on a stale cell do nothing', async () => {
        const ed = makeEditor('<table><tbody><tr><td>a</td><td>b</td></tr></tbody></table><p>x</p>');
        const table = mod(ed, 'Table');
        const cell = cellByText(ed, 'a');
        table.currentCell = cell;
        ed.setContent('<p>replaced</p>');
        table.currentCell = cell;
        table.insertColumn('after');
        table.deleteRow();
        eq(ed.getContent(), '<p>replaced</p>');
    });

    // ---------- List indent / outdent (B21) ----------

    await test('blocks: Tab indents into a nested list, Shift+Tab outdents back', async () => {
        const ed = makeEditor('<ul><li>a</li><li>b</li><li>c</li></ul>');
        caret(textNode(ed.editorEl, 'b'), 1);
        const n = steps(ed);
        key(ed.editorEl, 'Tab');
        eq(ed.getContent(), '<ul><li>a<ul><li>b</li></ul></li><li>c</li></ul>');
        eq(steps(ed), n + 1, 'one undo step');
        caret(textNode(ed.editorEl, 'c'), 0);
        key(ed.editorEl, 'Tab');
        eq(ed.getContent(), '<ul><li>a<ul><li>b</li><li>c</li></ul></li></ul>', 'reuses the existing sub-list');
        caret(textNode(ed.editorEl, 'b'), 0);
        key(ed.editorEl, 'Tab', { shiftKey: true });
        eq(ed.getContent(), '<ul><li>a</li><li>b<ul><li>c</li></ul></li></ul>', 'following siblings become its sub-list');
        const sel = window.getSelection();
        eq(sel.anchorNode, textNode(ed.editorEl, 'b'), 'caret kept');
    });

    await test('blocks: Shift+Tab on a top-level item splits the list in its host', async () => {
        const ed = makeEditor('<aside><ul><li>a</li><li>b</li><li>c</li></ul></aside>');
        caret(textNode(ed.editorEl, 'b'), 1);
        key(ed.editorEl, 'Tab', { shiftKey: true });
        eq(ed.getContent(), '<aside><ul><li>a</li></ul><p>b</p><ul><li>c</li></ul></aside>');
        const ed2 = makeEditor('<ol><li><br></li></ol><p>x</p>');
        caret(ed2.editorEl.querySelector('li'), 0);
        key(ed2.editorEl, 'Tab', { shiftKey: true });
        eq(ed2.getContent(), '<p><br></p><p>x</p>');
        const sel = window.getSelection();
        assert(ed2.editorEl.querySelector('p').contains(sel.anchorNode) || sel.anchorNode === ed2.editorEl.querySelector('p'), 'caret in the new paragraph');
    });

    await test('blocks: Tab on the first item does nothing harmful', async () => {
        const ed = makeEditor('<ul><li>a</li></ul>');
        caret(textNode(ed.editorEl, 'a'), 0);
        key(ed.editorEl, 'Tab');
        eq(ed.getContent(), '<ul><li>a</li></ul>');
    });

    // ---------- BlockGap (P1, X check, transact) ----------

    await test('blocks: gap insert is one undo step; inner gap needs pointer X inside the container', async () => {
        const ed = makeEditor('<figure class="quote-card"><blockquote><p>one</p><p>two</p></blockquote></figure><p>after</p>');
        const gap = mod(ed, 'BlockGap');
        const card = ed.editorEl.querySelector('figure.quote-card');
        card.style.width = '200px';
        await frame();
        const [p1, p2] = card.querySelectorAll('blockquote p');
        const y = (p1.getBoundingClientRect().bottom + p2.getBoundingClientRect().top) / 2;
        const inside = gap.findGap(card.querySelector('blockquote'), p1.getBoundingClientRect().left + 5, y);
        assert(inside && inside.container.tagName === 'BLOCKQUOTE', 'inner gap found when hovering inside');
        const beside = gap.findGap(ed.editorEl, card.getBoundingClientRect().right + 100, y);
        assert(!beside || beside.container === ed.editorEl, 'no inner gap when hovering beside the card');

        gap.currentGap = inside;
        history(ed).flush();
        const n = steps(ed);
        gap.insertAtCurrentGap();
        eq(card.querySelectorAll('blockquote p').length, 3);
        eq(steps(ed), n + 1);
        // Stale gap after content replacement is ignored.
        gap.currentGap = inside;
        ed.setContent('<p>new</p>');
        gap.currentGap = inside;
        gap.insertAtCurrentGap();
        eq(ed.getContent(), '<p>new</p>');
    });

    // ---------- Handles / hover ----------

    await test('blocks: hover resolves list item, list and container handles', async () => {
        const ed = makeEditor('<aside><ul><li>a</li><li>b</li></ul></aside><table><tbody><tr><td><p>c</p></td></tr></tbody></table>');
        const ctrl = mod(ed, 'BlockControl');
        const b = textNode(ed.editorEl, 'b').parentElement;
        const r = b.getBoundingClientRect();
        ctrl.processHover(b, r.top + r.height / 2);
        eq(ctrl.currentBlock, b);
        eq(ctrl.currentList, b.parentElement);
        eq(ctrl.currentContainer, ed.editorEl.querySelector('aside'));
        eq(ctrl.handle.style.display, 'flex');
        const cellP = ed.editorEl.querySelector('td p');
        ctrl.processHover(cellP, cellP.getBoundingClientRect().top + 2);
        eq(ctrl.currentBlock, ed.editorEl.querySelector('table'), 'paragraph in a cell → the table');
    });

    await test('blocks: real mousemove shows handles and the gap "+" (rAF-coalesced)', async () => {
        const ed = makeEditor('<p>first</p><p>second</p>');
        const ctrl = mod(ed, 'BlockControl');
        const [p1, p2] = ed.editorEl.querySelectorAll('p');
        const r = p2.getBoundingClientRect();
        for (let i = 0; i < 5; i++) {
            p2.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: r.left + 5, clientY: r.top + 2 + i }));
        }
        await frame();
        await frame();
        eq(ctrl.currentBlock, p2);
        eq(ctrl.handle.style.display, 'flex');
        const gapY = (p1.getBoundingClientRect().bottom + r.top) / 2;
        ed.editorEl.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: r.left + 5, clientY: gapY }));
        await frame();
        await frame();
        eq(mod(ed, 'BlockGap').handle.style.display, 'flex', 'gap handle shown between blocks');
    });

    await test('blocks: RTL handles sit on the right of the block', async () => {
        const ed = makeEditor('<p>שלום</p>');
        ed.wrapper.classList.add('redactix-rtl');
        ed.wrapper.setAttribute('dir', 'rtl');
        const ctrl = mod(ed, 'BlockControl');
        const p = ed.editorEl.querySelector('p');
        ctrl.processHover(p, p.getBoundingClientRect().top + 2);
        const h = ctrl.handle.getBoundingClientRect();
        assert(h.left >= p.getBoundingClientRect().right - 2, 'handle right of the block');
    });
}
