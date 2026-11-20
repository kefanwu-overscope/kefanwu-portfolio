#!/usr/bin/env node
// Background tab, shown later (PEN_SPEC 10.1, 16.2): the page must wait while hidden and draw on the first visible.
// Raw CDP on a headless Chrome started here (Playwright's focus emulation makes every tab report visible).
// usage: node bgtab-check.cjs <url> [forwardAfterMs=3000] [out.json]
'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), { spawn } = require('child_process');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const [url, fwdArg, outFile] = process.argv.slice(2);
const forwardAfter = +(fwdArg || 3000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function client(u) {
  const ws = new WebSocket(u);
  let id = 0;
  const wait = new Map();
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && wait.has(d.id)) { const w = wait.get(d.id); wait.delete(d.id); if (d.error) w.reject(new Error(d.error.message)); else w.resolve(d.result); } };
  const open = new Promise((r) => { ws.onopen = r; });
  return { open, send: (method, params = {}, sessionId) => new Promise((resolve, reject) => { const i = ++id; wait.set(i, { resolve, reject }); ws.send(JSON.stringify({ id: i, method, params, sessionId })); }), close: () => ws.close() };
}
(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hero-pen-bgtab-'));
  const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${dir}`, '--no-first-run', '--no-default-browser-check', '--window-size=1440,900',
    '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--use-angle=d3d11', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  const result = { url, forwardAfter, chromePid: chrome.pid };
  try {
    const wsUrl = await new Promise((resolve, reject) => {
      let buf = '';
      chrome.stderr.on('data', (d) => { buf += d; const m = /DevTools listening on (ws:[^\s]+)/.exec(buf); if (m) resolve(m[1]); });
      setTimeout(() => reject(new Error('chrome start timeout')), 15000);
    });
    const b = client(wsUrl);
    await b.open;
    const ev = async (sid, expression) => { const r = await b.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sid); return r.result.value; };
    const { targetId } = await b.send('Target.createTarget', { url: 'about:blank', background: true });
    const { sessionId: sid } = await b.send('Target.attachToTarget', { targetId, flatten: true });
    await b.send('Page.enable', {}, sid);
    await b.send('Runtime.enable', {}, sid);
    await b.send('Page.navigate', { url }, sid);
    await sleep(forwardAfter);
    const S = `(() => { const s = window.__heroDraw || {}; return { vis: document.visibilityState, state: s.state || null, attr: document.documentElement.getAttribute('data-hero-pen'), cls: document.documentElement.className, linesAt: s.linesAt == null ? null : s.linesAt, t0: s.t0 == null ? null : s.t0, settledBy: s.settledBy || null, skipped: s.skipped || 0, nodes: document.querySelectorAll('.hero-draw-lines, .hero-draw-veil, #hero-pen-data').length, now: performance.now() }; })()`;
    result.whileHidden = await ev(sid, S);
    await b.send('Target.activateTarget', { targetId });
    await b.send('Page.bringToFront', {}, sid);
    await sleep(300);
    result.afterShow = await ev(sid, S);
    for (let k = 0; k < 120; k++) { const r = await ev(sid, S); if (r.state === 'done') { result.final = r; break; } await sleep(100); }
    result.ok = result.whileHidden.vis === 'hidden' && result.whileHidden.state === 'wait-visible' && result.whileHidden.attr === 'wait' && result.whileHidden.linesAt == null
      && !!result.final && result.final.linesAt != null && result.final.t0 > result.whileHidden.now && !result.final.settledBy && result.final.nodes === 0 && result.final.cls === 'js';
    try { await b.send('Browser.close'); } catch (e) { /* exits below */ }
    b.close();
  } catch (e) { result.error = String(e); }
  await sleep(600);
  try { process.kill(chrome.pid); } catch (e) { /* already gone */ }
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* temp */ }
  console.log(JSON.stringify(result));
  if (outFile) fs.writeFileSync(outFile, JSON.stringify(result, null, 1));
})();
