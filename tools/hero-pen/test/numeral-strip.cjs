#!/usr/bin/env node
// Frame strip of the numerals (tier n) as the page draws them: one tile per animation frame from each numeral's
// start to its end + 1 frame, cut from the INK canvas around that numeral (device pixels, nearest-neighbour x2),
// labelled with the pen time and the share of the stroke drawn; one tile per 60 Hz frame of pen time. Revision 4 evidence for the numeral motion.
// usage: node numeral-strip.cjs --url <page> --w 390 --h 844 --dpr 3 [--mobile] [--cpu 1] --out <dir> --tag <name>
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');
const PW = process.env.PLAYWRIGHT || 'C:/Users/oc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright';
const { chromium } = require(PW);
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const URL_ = opt('url'), W = +opt('w', 390), H = +opt('h', 844), DPR = +opt('dpr', 3), MOBILE = argv.includes('--mobile'), CPU = +opt('cpu', 1);
const OUT = path.resolve(opt('out', '.')), TAG = opt('tag', `${W}-dpr${DPR}`);

const INIT = () => {
  window.__strip = { tiles: [], done: false };
  const grab = () => {
    const s = window.__heroDraw;
    if (!s || s.state === 'done') { if (s && s.state === 'done') window.__strip.done = true; return; }
    if (!s.schedule || !s.frame || !s.geo) return;
    const [G, box, dpr] = s.geo, c = document.querySelectorAll('.hero-draw-lines canvas')[2], t = s.frame.penT;
    for (let i = 0; i < s.n; i++) {
      if (s.tier[i] !== 'n') continue;
      const [st, d] = s.schedule[i];
      if (t < st - 1 || t > st + d + 17) continue;
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (let k = 0; k <= 64; k++) { const p = s.at(i, k / 64), X = (G.ox + p[0] * G.kx - box[2][0]) * dpr, Y = (G.oy + p[1] * G.ky - box[2][1]) * dpr; x0 = Math.min(x0, X); y0 = Math.min(y0, Y); x1 = Math.max(x1, X); y1 = Math.max(y1, Y); }
      const pad = 6 * dpr, L = Math.max(0, Math.floor(x0 - pad)), T = Math.max(0, Math.floor(y0 - pad)), w = Math.min(c.width, Math.ceil(x1 + pad)) - L, h = Math.min(c.height, Math.ceil(y1 + pad)) - T;
      const tile = document.createElement('canvas');
      tile.width = w; tile.height = h;
      tile.getContext('2d').drawImage(c, L, T, w, h, 0, 0, w, h);
      window.__strip.tiles.push({ i, penT: t, frac: Math.max(0, Math.min(1, (t - st) / d)), start: st, dur: d, tile });
    }
  };
  const tick = () => { requestAnimationFrame(tick); setTimeout(grab, 0); };
  requestAnimationFrame(tick);
  window.__compose = () => {
    const T = window.__strip.tiles, by = {};
    for (const x of T) (by[x.i] = by[x.i] || []).push(x);
    // headless Chrome runs rAF faster than 60 Hz: keep, for each 60 Hz frame k after the numeral's start (pen time
    // start + k x 16.67 ms), the captured frame nearest that pen time
    const rows = Object.values(by).map((r) => { const o = []; for (let k = 0; r[0].start + k * 16.667 <= r[0].start + r[0].dur + 16.667; k++) { const want = r[0].start + k * 16.667; let b = r[0]; for (const x of r) if (Math.abs(x.penT - want) < Math.abs(b.penT - want)) b = x; o.push(b); } return o; }), Z = 2;
    const tw = Math.max(...T.map((x) => x.tile.width)) * Z, th = Math.max(...T.map((x) => x.tile.height)) * Z + 28;
    const cols = Math.max(...rows.map((r) => r.length));
    const out = document.createElement('canvas');
    out.width = cols * (tw + 6) + 6; out.height = rows.length * (th + 6) + 6;
    const g = out.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, out.width, out.height);
    g.imageSmoothingEnabled = false;
    rows.forEach((r, ri) => r.forEach((x, ci) => {
      const X = 6 + ci * (tw + 6), Y = 6 + ri * (th + 6);
      g.fillStyle = '#eef0f2'; g.fillRect(X, Y, tw, th - 28);
      g.drawImage(x.tile, X, Y, x.tile.width * Z, x.tile.height * Z);
      g.fillStyle = '#111'; g.font = '12px monospace';
      g.fillText(`#${x.i} f${ci} ${x.penT.toFixed(1)}`, X + 2, Y + th - 16);
      g.fillText(`${Math.round(100 * x.frac)}% of ${x.dur} ms`, X + 2, Y + th - 3);
    }));
    return { png: out.toDataURL('image/png'), rows: rows.map((r) => r.map((x) => [x.i, +x.penT.toFixed(2), +x.frac.toFixed(3)])) };
  };
};

(async () => {
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'hero-pen-strip-'));
  const ctx = await chromium.launchPersistentContext(prof, { channel: 'chrome', headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--use-angle=d3d11', '--hide-scrollbars'],
    viewport: { width: W, height: H }, deviceScaleFactor: DPR, isMobile: MOBILE, hasTouch: MOBILE });
  try {
    const page = ctx.pages()[0] || (await ctx.newPage());
    if (CPU > 1) { const s = await ctx.newCDPSession(page); await s.send('Emulation.setCPUThrottlingRate', { rate: CPU }); }
    await page.addInitScript(INIT);
    await page.goto(URL_, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__strip.done, null, { timeout: 20000 });
    const r = await page.evaluate(() => window.__compose());
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(path.join(OUT, `numerals-${TAG}.png`), Buffer.from(r.png.split(',')[1], 'base64'));
    fs.writeFileSync(path.join(OUT, `numerals-${TAG}.json`), JSON.stringify(r.rows));
    console.log(TAG, JSON.stringify(r.rows));
  } finally { await ctx.close(); fs.rmSync(prof, { recursive: true, force: true }); }
})().catch((e) => { console.error(e); process.exit(1); });
