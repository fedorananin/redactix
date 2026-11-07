#!/usr/bin/env node
// Zero-dependency headless runner for the Redactix regression page.
//
// Usage:
//   php -S 127.0.0.1:8765 -t .            (or any static server on the repo root)
//   node tests/run-headless.mjs [url] [--timeout=ms] [--smoke]
//
// Default url: http://127.0.0.1:8765/tests/regression.html
// --smoke: don't wait for test results — load the page, wait a moment and
//          report uncaught exceptions / console errors (useful for index.html).
//
// Talks to Chrome through the DevTools protocol using Node's built-in
// WebSocket (Node 22+). Set CHROME_PATH if Chrome isn't in a default place.

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
const url = args.find(a => !a.startsWith('--')) || 'http://127.0.0.1:8765/tests/regression.html';
const timeout = Number((args.find(a => a.startsWith('--timeout=')) || '').split('=')[1]) || 60000;
const smoke = args.includes('--smoke');

const candidates = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
].filter(Boolean);
const chromePath = candidates.find(p => existsSync(p));
if (!chromePath) {
    console.error('Chrome not found. Set CHROME_PATH.');
    process.exit(2);
}

const profile = mkdtempSync(join(tmpdir(), 'redactix-test-'));
const chrome = spawn(chromePath, [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu',
    '--window-size=1280,900', 'about:blank'
], { stdio: ['ignore', 'ignore', 'pipe'] });

const cleanup = () => {
    try { chrome.kill(); } catch (e) { /* ignore */ }
    try { rmSync(profile, { recursive: true, force: true }); } catch (e) { /* ignore */ }
};

const wsUrl = await new Promise((resolve, reject) => {
    let buf = '';
    const timer = setTimeout(() => reject(new Error('Chrome did not start')), 15000);
    chrome.stderr.on('data', chunk => {
        buf += chunk.toString();
        const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
        if (m) { clearTimeout(timer); resolve(m[1]); }
    });
});

const ws = new WebSocket(wsUrl);
await new Promise(r => ws.addEventListener('open', r, { once: true }));
let nextId = 1;
const pending = new Map();
const listeners = [];
ws.addEventListener('message', ev => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    } else {
        listeners.forEach(l => l(msg));
    }
});
const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params, sessionId }));
});

const errors = [];
const logs = [];
listeners.push(msg => {
    if (msg.method === 'Runtime.exceptionThrown') {
        const d = msg.params.exceptionDetails;
        errors.push((d.exception && d.exception.description) || d.text);
    } else if (msg.method === 'Runtime.consoleAPICalled') {
        const text = msg.params.args.map(a => a.value !== undefined ? a.value : (a.description || '')).join(' ');
        if (msg.params.type === 'error') errors.push('console.error: ' + text);
        else logs.push(text);
    }
});

let exitCode = 0;
try {
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    await send('Runtime.enable', {}, sessionId);
    await send('Page.enable', {}, sessionId);
    await send('Page.navigate', { url }, sessionId);

    const evaluate = async (expression) => {
        const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId);
        return r.result.value;
    };

    const started = Date.now();
    if (smoke) {
        await new Promise(r => setTimeout(r, 2500));
        const count = await evaluate('document.querySelectorAll(".redactix-wrapper").length');
        console.log(`Editors initialised: ${count}`);
        if (!count) exitCode = 1;
    } else {
        let done = false;
        while (!done && Date.now() - started < timeout) {
            await new Promise(r => setTimeout(r, 250));
            done = await evaluate('window.__testsDone === true').catch(() => false);
        }
        if (!done) {
            console.error('Timed out waiting for tests');
            exitCode = 1;
        }
        const results = JSON.parse(await evaluate('JSON.stringify(window.__testResults || [])') || '[]');
        let failed = 0;
        results.forEach(r => {
            const mark = r.ok ? 'ok  ' : 'FAIL';
            if (!r.ok) failed++;
            console.log(`${mark} ${r.name}${r.ok ? '' : '\n       ' + r.detail}`);
        });
        console.log(`\n${results.length - failed}/${results.length} passed`);
        if (failed) exitCode = 1;
    }

    if (logs.length && process.env.VERBOSE) console.log('\nconsole:\n' + logs.join('\n'));
    if (errors.length) {
        console.log('\nErrors on page:\n' + errors.map(e => '  ' + e).join('\n'));
        exitCode = 1;
    }
} catch (err) {
    console.error(err);
    exitCode = 1;
} finally {
    ws.close();
    cleanup();
}
process.exit(exitCode);
