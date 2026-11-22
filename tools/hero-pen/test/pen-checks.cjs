#!/usr/bin/env node
// Objective pen checks for the drafting hero, merge build (2026-11-21): three lanes (A car ink, B lay-in and drafting, C
// lettering), the merge caps (<= 1 end per frame per line lane, <= 2 for the lettering lane, <= 3 in total: fix round 1) and the merge
// develop curve. Started from the two-pen checks (v3), which replaced the R3 one-pen checks (pen-checks.r3.cjs.txt).
// Headless Chrome through Playwright on a VIRTUAL CLOCK (the page's requestAnimationFrame, performance.now and timers
// advance only when this script steps them, 60 Hz), so every load cuts the strokes into the same frame chunks.
//   #1 per pen sequential: within pen A (car ink) and pen B (layout, dimensions) a stroke starts only after the previous
//      one ended (window.__heroDraw.schedule and .pen)
//   #2 runtime: penT never decreases; at most one partial stroke per pen in every frame (at most 2 live strokes)
//   #3 pixels: each canvas's inked-pixel count never decreases before that canvas starts to leave
//   #5 stroke ends: at most 2 in any 16.67 ms window in total and per pen (schedule), and at most 2 strokes finishing in
//      any one runtime frame
//   #6 input: pointerdown (tap on phones) at pen 900, 1600 and 2200 ms settles to the photo in <= 190 ms of page time
//      with no new ink after it and a clean end (class "js", no drawing nodes)
//   develop: the density the engine reports at the 10 timeline checkpoints within 0.02 of the spec table; it never falls
//   dense3 final solver (2026-11-22, agent): #1, #2 and #5 run over every lane the page reports (A B C and the detail
//      lanes X Y Z, caps A B X Y Z 1 and C 2 per window; A-C <= 3 among them; the detail lanes <= one each); runtime live
//      strokes <= the lane count; finishes per frame A-C <= 3 and detail <= one per detail lane; R.frames logs every frame;
//   #7 a photo that never decodes develops at the engine's DECODE_CAP (--decode-cap none: the stock 11 s ceiling);
//      --only-nophoto runs #7 alone
//   restored from the R3 checks (pen-checks at 0e561624; integration onto 5b20926f, 2026-11-21, an agent decision):
//   #3b no stray ink: every 100 ms each canvas's inked pixels (alpha >= 24) lie within 2 device px of a stroke (its own
//      width included; arrowheads filled) that belongs to that canvas and has started by the pen time (__heroDraw.at)
//   determinism: two virtual-clock loads give identical alpha hashes on all three canvases at six pen times
//   fix1 (2026-11-22, agent): restored from 5b20926f's --resize and --fold checks (R3's one-pen checks) and adapted to the
//   drafting engine: its classes (D >= 1280, T 768-1279, P < 768 px of documentElement.clientWidth, engine.js pickCls),
//   its ResizeObserver on the photo box, SETTLE 160 ms, QUICK 300 ms and the V line's canvas exit windows; on the
//   virtual clock like the rest (the ResizeObserver runs in the page's own rendering step, so the script waits for it in
//   real time before the next step):
//   resizeSameClass: in the middle of the first canvas exit window (PENCIL at every class, so its opacity is strictly
//      between 0 and 1), and at least 100 ms before the last ink, the viewport width changes within the class (at least
//      40 px from a class edge). The
//      engine must lay the canvases out again on the new photo box (the cover scale and the lines box match it), replay
//      the ink up to the pen time (no inked pixel outside the strokes started by then, and at least half the ink there was,
//      scaled), keep every canvas at or below the opacity it had (no flash back to full-strength lines, in the frame
//      after the resize or later), then draw on to its own end: no settle, nothing skipped, every stroke finished, pen
//      time never back, a clean end.
//   resizeClassChange: the same moment, a width in another class: settledBy "class-change", done within SETTLE + 2
//      frames, no new ink after the resize, opacities never rise, a clean end.
//   quickScrolled / quickShort: part of the car box, under half, on screen at t0 (the page scrolled so the car's top three
//      quarters are above the viewport before t0, by a scroll, not intent; or a short viewport, --quick-h, default 360 px,
//      400 px with --mobile): 0 < H.quick < 0.5, settledBy "quick", no lines shown (linesAt unset, the lines box hidden,
//      no pen frame, no inked pixel), done within QUICK + 2 frames of t0, a clean end.
//   --only <groups> runs some of: sequence, input, nophoto, determinism, resize, quick (default all; --only-nophoto is
//   --only nophoto). tools/hero-tests/hero-pen.test.cjs runs --only resize,quick at each class in the suite.
// usage: node pen-checks.cjs --url http://127.0.0.1:5171/index.html --w 1440 --h 900 --dpr 1 [--mobile]
//          [--only sequence,input,nophoto,determinism,resize,quick] [--quick-h <px>] --out <file.json>
'use strict';
const fs = require('fs'), path = require('path');
const PW = process.env.PLAYWRIGHT_MODULE || process.env.PLAYWRIGHT || 'C:/Users/oc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright';
const { chromium } = require(PW);
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const URL_ = opt('url', 'http://127.0.0.1:5171/index.html'), W = +opt('w', 1440), H = +opt('h', 900), DPR = +opt('dpr', 1), MOBILE = argv.includes('--mobile');
const OUT = opt('out', null), FR = 1000 / 60;
// dense3 final solver: the lanes and their per-window end caps (pens.cjs K.ENDS_PER_PEN), the detail lanes, the decode cap
// the engine is expected to have (engine.js DECODE_CAP; --decode-cap none expects the stock engine's 11 s ceiling instead)
const CAP = { A: 1, B: 1, C: 2, X: 1, Y: 1, Z: 1 }, DETAIL = ['X', 'Y', 'Z'];
const DECODE_CAP = opt('decode-cap', '4500'), ONLY_NOPHOTO = argv.includes('--only-nophoto');
// fix1: check groups (default all)
const GROUPS = ['sequence', 'input', 'nophoto', 'determinism', 'resize', 'quick'];
const ONLY = opt('only', null) ? new Set(opt('only').split(',')) : ONLY_NOPHOTO ? new Set(['nophoto']) : null;
if (ONLY) for (const g of ONLY) if (!GROUPS.includes(g)) { console.error('unknown group ' + g + ' (' + GROUPS.join(', ') + ')'); process.exit(2); }
const want = (g) => !ONLY || ONLY.has(g);
const QUICK_H = +opt('quick-h', MOBILE ? 400 : 360);
const VT = fs.readFileSync(path.join(__dirname, 'vclock.js'), 'utf8');

async function load(browser, o = {}) {
  const ctx = await browser.newContext({ viewport: { width: W, height: o.h || H }, deviceScaleFactor: DPR, isMobile: MOBILE, hasTouch: MOBILE });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  if (o.pre) await page.addInitScript(o.pre);
  await page.addInitScript(VT);
  await page.goto(URL_, { waitUntil: 'load' });
  await page.evaluate(async () => { await Promise.all([...document.querySelectorAll('.hero-media img')].map((i) => i.decode().catch(() => 0))); });
  const step = () => page.evaluate((d) => window.__film.step(d), FR);
  let s = null;
  for (let g = 0; g < 3000; g++) { s = await step(); if (s.t0 != null) break; }
  await page.evaluate(MASK);
  return { ctx, page, errors, step };
}
// #3b (restored): inked pixels outside the strokes started by penT on that canvas; and an FNV-1a hash of each canvas's alpha
const MASK = () => {
  const W1 = { c: 1.08, y: 1.16, n: 1.12, f: 0.62, d: 0.44, p: 0.32, k: 0.34, l: 0.44, u: 0.8, m: 0.4, r: 0.4 };
  const CAN = { c: 2, y: 2, n: 2, f: 2, d: 2, p: 0, k: 0, l: 0, u: 0, m: 1, r: 1 };
  window.__outside = (penT) => {
    const h = window.__heroDraw, [G, box, dpr] = h.geo, cvs = [...document.querySelectorAll('.hero-draw-lines canvas')];
    return cvs.map((c, ci) => {
      if (!c.width || !c.height || !box[ci]) return 0;
      const o = new OffscreenCanvas(c.width, c.height), x = o.getContext('2d');
      x.lineCap = x.lineJoin = 'round'; x.strokeStyle = x.fillStyle = '#000';
      for (let i = 0; i < h.n; i++) {
        const t = h.tier[i];
        if (h.schedule[i][0] > penT || CAN[t] !== ci) continue;
        x.lineWidth = Math.max(1, W1[t] * G.w1 * dpr) + 4;
        x.beginPath();
        const k = Math.max(16, Math.ceil(h.len[i] / 1.5));
        for (let q = 0; q <= k; q++) { const p = h.at(i, q / k), X = (G.ox + p[0] * G.kx - box[ci][0]) * dpr, Y = (G.oy + p[1] * G.ky - box[ci][1]) * dpr; if (q) x.lineTo(X, Y); else x.moveTo(X, Y); }
        x.stroke();
        if (t === 'r') { x.closePath(); x.fill(); }
      }
      const m = x.getImageData(0, 0, c.width, c.height).data, a = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let out = 0;
      for (let j = 3; j < a.length; j += 4) if (a[j] >= 24 && m[j] < 8) out++;
      return out;
    });
  };
  window.__alphaHash = () => [...document.querySelectorAll('.hero-draw-lines canvas')].map((c) => {
    if (!c.width || !c.height) return '0';
    const a = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let hh = 2166136261;
    for (let j = 3; j < a.length; j += 4) hh = Math.imul(hh ^ a[j], 16777619);
    return (hh >>> 0).toString(16) + ':' + c.width + 'x' + c.height;
  });
};

// ---- fix1: resize while drawing, and the quick reveal (see the header)
const CLS_OF = (w) => (w >= 1280 ? 'D' : w >= 768 ? 'T' : 'P');
// a width in the same class at least 40 px from its edges, and one in another class (client widths)
const sameClassW = (w) => { const c = CLS_OF(w); if (c === 'D') return w - 80 >= 1320 ? w - 80 : w + 80; if (c === 'T') return w - 60 >= 808 ? w - 60 : w + 60; return w - 40 >= 320 ? w - 40 : w + 40; };
const otherClassW = (w) => ({ D: 1000, T: 640, P: 900 })[CLS_OF(w)];
// the page state the resize checks read: canvas opacities (style.opacity, '' = 1), inked pixels (alpha > 24) per canvas,
// the engine's layout scale against the photo box's cover scale (engine.js layout()), and the lines box
const SNAP = () => {
  const h = window.__heroDraw || {}, R = document.documentElement, wrap = document.querySelector('.hero-draw-lines'), bg = document.querySelector('.white-home .cinematic-hero .hero-photo-background');
  const cv = [...document.querySelectorAll('.hero-draw-lines canvas')];
  const px = cv.map((c) => { if (!c.width || !c.height) return 0; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 24) n++; return n; });
  let reg = null;
  if (bg && h.geo) {
    // engine.js layout(): cover scale, object-position offsets (+ half a photo pixel: the art is in pixel centres)
    const br = bg.getBoundingClientRect(), nw = bg.naturalWidth || 2200, nh = bg.naturalHeight || 1238, sc = Math.max(br.width / nw, br.height / nh), iw = nw * sc, ih = nh * sc;
    const pos = (v, free) => (v.slice(-1) === '%' ? (free * parseFloat(v)) / 100 : parseFloat(v) || 0), op = getComputedStyle(bg).objectPosition.split(' ');
    const G = h.geo[0];
    reg = { kx: G.kx, kxWant: iw / 2200, ky: G.ky, kyWant: ih / 1238, ox: G.ox, oxWant: pos(op[0], br.width - iw) + iw / 4400, oy: G.oy, oyWant: pos(op[1] || '50%', br.height - ih) + ih / 2476,
      wrapW: wrap ? parseFloat(wrap.style.width) : null, wrapH: wrap ? parseFloat(wrap.style.height) : null, bgW: br.width, bgH: br.height };
  }
  return { vt: window.__film ? window.__film.now() : performance.now(), state: h.state || null, penT: h.frame ? h.frame.penT : null, frameTo: h.frame ? h.frame.to : null, n: h.n, cls: h.cls, settledBy: h.settledBy || null,
    skipped: h.skipped || 0, linesAt: h.linesAt == null ? null : h.linesAt, quick: h.quick == null ? null : h.quick, t0: h.t0 == null ? null : h.t0, doneAt: h.doneAt == null ? null : h.doneAt,
    op: cv.map((c) => (c.style.opacity === '' ? 1 : +c.style.opacity)), px, reg, hidden: wrap ? wrap.hidden : null, cw: R.clientWidth, scrollY: Math.round(scrollY),
    html: R.className, nodes: document.querySelectorAll('.hero-draw-lines, .hero-draw-veil, #hero-pen-data').length, frameSeen: !!h.frame };
};
async function resizeCase(browser, mode) {
  const { ctx, page, errors, step } = await load(browser);
  const info = await page.evaluate(() => { const h = window.__heroDraw; return { cls: h.cls, n: h.n, lastInk: h.lastInk, tl: h.tl, cw: document.documentElement.clientWidth }; });
  // the first canvas exit window on the pen clock (V line: start, length, then per canvas the window in progress x 1000)
  const win = [0, 1, 2].map((c) => [info.tl[0] + (info.tl[2 + 2 * c] / 1e3) * info.tl[1], info.tl[0] + (info.tl[3 + 2 * c] / 1e3) * info.tl[1]]).sort((a, b) => a[0] - b[0])[0];
  const at = Math.min((win[0] + win[1]) / 2, info.lastInk - 100);
  let s = null;
  for (let g = 0; g < 400; g++) { s = await step(); if (s.state === 'done' || (s.penT != null && s.penT >= at)) break; }
  const before = await page.evaluate(SNAP);
  await page.evaluate(() => { window.__geoRef = window.__heroDraw.geo; });
  const cw2 = mode === 'same-class' ? sameClassW(info.cw) : otherClassW(info.cw), w2 = cw2 + (W - info.cw);
  await page.setViewportSize({ width: w2, height: H });
  // the engine's ResizeObserver runs in the page's rendering step, not on the virtual clock: wait for it in real time
  let reacted = false, waitedMs = 0;
  for (let g = 0; g < 80 && !reacted; g++) {
    await page.waitForTimeout(25);
    waitedMs += 25;
    reacted = await page.evaluate((m) => { const h = window.__heroDraw; return m === 'same-class' ? h.geo !== window.__geoRef : !!h.settledBy; }, mode);
  }
  const after = await page.evaluate(SNAP);   // before the next step: what the next paint shows
  const out0 = after.state !== 'done' ? await page.evaluate((p) => window.__outside(p), after.penT) : [0, 0, 0];
  const res = { mode, from: W, to: w2, clientWidth: [info.cw, after.cw], cls: info.cls, clsOfNewWidth: CLS_OF(after.cw), lastInk: info.lastInk, exitWindow: win.map((x) => +x.toFixed(1)), resizeAtPen: +at.toFixed(1), penTAtResize: before.penT, reacted, waitedMs,
    opBefore: before.op, opAfterResize: after.op, pxBefore: before.px, pxAfterResize: after.px, regBefore: before.reg, regAfter: after.reg, outsideAfterResize: out0 };
  // then every frame to the end: opacities never rise, pen time never back, new ink, stray ink every 6th frame
  let prev = after, opRise = [], penBack = 0, inkFrames = 0, pxRise = 0, outMax = Math.max(...out0), outSamples = 1, frames = 0, last = after;
  for (let g = 0; g < 600; g++) {
    s = await step();
    const f = await page.evaluate(SNAP);
    frames++;
    for (let c = 0; c < 3; c++) if (f.op[c] > prev.op[c] + 1e-3 && opRise.length < 5) opRise.push([f.penT, c, prev.op[c], f.op[c]]);
    if (f.penT != null && prev.penT != null && f.penT < prev.penT) penBack++;
    if (f.px.some((v, c) => v > prev.px[c])) { inkFrames++; pxRise++; }
    if (f.state !== 'done' && f.penT != null && g % 6 === 0) { const o = await page.evaluate((p) => window.__outside(p), f.penT); outSamples++; outMax = Math.max(outMax, ...o); }
    last = f;
    if (f.state === 'done') break;
    prev = f;
  }
  const end = last, endH = await page.evaluate(() => { const h = window.__heroDraw || {}; return { state: h.state, settledBy: h.settledBy || null, skipped: h.skipped || 0, frameTo: h.frame ? h.frame.to : null, n: h.n, cls: h.cls, doneAt: h.doneAt }; });
  Object.assign(res, { framesAfter: frames, opRise, penBack, inkFramesAfter: inkFrames, outsideMax: outMax, outsideSamples: outSamples, end: { ...endH, html: end.html, nodes: end.nodes }, errors: errors.slice() });
  const clean = end.html === 'js' && end.nodes === 0 && endH.state === 'done' && !errors.length;
  const partFaded = before.op.some((v) => v > 0.001 && v < 0.999);
  if (mode === 'same-class') {
    // registration: the layout matches the new photo box (scale, offsets, lines box), and that box did change
    const a = after.reg, b = before.reg;
    const regOk = !!(a && b && Math.abs(a.kx - a.kxWant) < 1e-6 && Math.abs(a.ky - a.kyWant) < 1e-6 && Math.abs(a.ox - a.oxWant) < 1e-3 && Math.abs(a.oy - a.oyWant) < 1e-3
      && Math.abs(a.wrapW - a.bgW) < 0.01 && Math.abs(a.wrapH - a.bgH) < 0.01 && Math.abs(a.bgW - b.bgW) + Math.abs(a.bgH - b.bgH) > 0.5);
    const scale = after.reg && before.reg ? Math.min(1, after.reg.kx / before.reg.kx) : 0;
    const replayed = before.px.every((v, c) => !v || after.px[c] >= 0.5 * v * scale);
    const noFlash = after.op.every((v, c) => v <= before.op[c] + 1.5e-3) && !opRise.length;
    Object.assign(res, { partFadedAtResize: partFaded, registration: regOk, replayed, noFlash });
    res.ok = reacted && res.clsOfNewWidth === info.cls && before.penT != null && before.penT < info.lastInk && partFaded && regOk && replayed && noFlash && outMax === 0 && !penBack && inkFrames >= 1
      && !endH.settledBy && !endH.skipped && endH.frameTo === endH.n && endH.cls === info.cls && clean;
  } else {
    const noInk = !pxRise && after.px.every((v, c) => v <= before.px[c]);
    const msToDone = endH.doneAt != null ? +(endH.doneAt - after.vt).toFixed(1) : null;
    Object.assign(res, { noNewInk: noInk, msToDone, noFlash: !opRise.length });
    res.ok = reacted && res.clsOfNewWidth !== info.cls && before.penT != null && before.penT < info.lastInk && endH.settledBy === 'class-change' && msToDone != null && msToDone <= 160 + 2 * FR + 1e-6 && noInk && !opRise.length && endH.cls === info.cls && clean;
  }
  await ctx.close();
  return res;
}
// scrolled: at DOMContentLoaded, scroll (not intent) so the car's top three quarters are above the viewport; the car box
// mapped as the engine maps it (object-fit: cover, object-position; the box from the data block's header)
const SCROLL_PAST_CAR = () => addEventListener('DOMContentLoaded', () => {
  const bg = document.querySelector('.white-home .cinematic-hero .hero-photo-background'), d = document.getElementById('hero-pen-data');
  if (!bg || !d) return;
  const hd = d.textContent.trim().split('\n')[0].split(' ').map(Number);   // HP1 2200 1238 x0 y0 x1 y1 seed
  const r = bg.getBoundingClientRect(), nw = bg.naturalWidth || 2200, nh = bg.naturalHeight || 1238, sc = Math.max(r.width / nw, r.height / nh), ih = nh * sc;
  const op = getComputedStyle(bg).objectPosition.split(' ')[1] || '50%', oy = op.slice(-1) === '%' ? ((r.height - ih) * parseFloat(op)) / 100 : parseFloat(op) || 0;
  const ky = ih / 1238, y0 = r.top + scrollY + oy + hd[4] * ky, y1 = r.top + scrollY + oy + hd[6] * ky;
  scrollTo({ top: Math.max(0, y0 + 0.75 * (y1 - y0)), behavior: 'instant' });
  window.__quickScroll = scrollY;
}, { once: true });
async function quickCase(browser, mode) {
  const { ctx, page, errors, step } = await load(browser, mode === 'short' ? { h: QUICK_H } : { pre: SCROLL_PAST_CAR });
  let f = await page.evaluate(SNAP), maxPx = Math.max(...f.px), everShown = f.hidden === false, frameSeen = f.frameSeen, frames = 0;
  const atT0 = f;
  for (let g = 0; g < 120 && f.state !== 'done'; g++) {
    await step();
    f = await page.evaluate(SNAP);
    frames++;
    maxPx = Math.max(maxPx, ...f.px);
    if (f.hidden === false) everShown = true;
    if (f.frameSeen) frameSeen = true;
  }
  const h = await page.evaluate(() => { const x = window.__heroDraw || {}; return { state: x.state, quick: x.quick == null ? null : x.quick, settledBy: x.settledBy || null, linesAt: x.linesAt == null ? null : x.linesAt, t0: x.t0 == null ? null : x.t0, doneAt: x.doneAt == null ? null : x.doneAt, scrollAtDcl: window.__quickScroll == null ? null : window.__quickScroll }; });
  const doneMs = h.doneAt != null && h.t0 != null ? +(h.doneAt - h.t0).toFixed(1) : null;
  const res = { mode, viewport: [W, mode === 'short' ? QUICK_H : H], scrollYAtT0: atT0.scrollY, ...h, doneMsAfterT0: doneMs, maxInkedPx: maxPx, linesBoxShown: everShown, penFrameSeen: frameSeen, framesToDone: frames,
    end: { html: f.html, nodes: f.nodes }, errors: errors.slice() };
  res.ok = h.quick != null && h.quick > 0 && h.quick < 0.5 && h.settledBy === 'quick' && h.linesAt == null && !frameSeen && !everShown && maxPx === 0 && h.state === 'done' && doneMs != null && doneMs <= 300 + 2 * FR + 1e-6
    && f.html === 'js' && f.nodes === 0 && !errors.length && (mode === 'short' || atT0.scrollY > 0);
  await ctx.close();
  return res;
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--use-angle=d3d11'] });
  const R = { url: URL_, w: W, h: H, dpr: DPR, mobile: MOBILE, groups: GROUPS.filter(want), checks: {}, errors: [] };
  // ---- pass 1: the whole sequence, every frame
  if (want('sequence')) {
    const { ctx, page, errors, step } = await load(browser);
    const info = await page.evaluate(() => { const h = window.__heroDraw; return { cls: h.cls, n: h.n, schedule: h.schedule, pen: h.pen, tier: h.tier, tl: h.tl, lastInk: h.lastInk }; });
    R.cls = info.cls; R.n = info.n; R.lastInk = info.lastInk;
    // #1 (dense3: every lane the page reports, pens A-C and the detail lanes X Y Z; a lane letter the checks do not know fails)
    const LANES = [...new Set(info.pen)].sort(), DET = LANES.filter((p) => DETAIL.includes(p)), isDet = (p) => DETAIL.includes(p);
    const bad1 = LANES.filter((p) => !(p in CAP)).map((p) => ['unknown lane', p]);
    for (const pen of LANES) {
      const q = info.schedule.map((s, i) => [s[0], s[0] + s[1], i]).filter((x) => info.pen[x[2]] === pen).sort((a, b) => a[0] - b[0]);
      for (let k = 1; k < q.length; k++) if (q[k][0] < q[k - 1][1]) bad1.push([pen, q[k][2]]);
    }
    R.lanes = LANES;
    R.checks.perPenSequential = { ok: !bad1.length, bad: bad1, lanes: LANES };
    // #5 schedule windows: pens A-C <= 3 among them, each lane <= its cap (A B 1, C 2, X Y Z 1), the detail lanes together
    // <= one per detail lane in use; every lane together recorded
    const ends = info.schedule.map((s, i) => [s[0] + s[1], info.pen[i]]).sort((a, b) => a[0] - b[0]);
    let worst = 0, worstDetail = 0, worstAll = 0;
    const worstPen = Object.fromEntries(LANES.map((p) => [p, 0]));
    for (const [e, p0] of ends) {
      const w = ends.filter(([f]) => f >= e && f < e + FR), d = w.filter(([, q]) => isDet(q)).length;
      if (!isDet(p0)) worst = Math.max(worst, w.length - d);
      else worstDetail = Math.max(worstDetail, d);
      worstAll = Math.max(worstAll, w.length);
      for (const p of LANES) worstPen[p] = Math.max(worstPen[p], w.filter(([, q]) => q === p).length);
    }
    R.checks.endsPerWindow = { ok: worst <= 3 && LANES.every((p) => worstPen[p] <= CAP[p]) && worstDetail <= DET.length, worst, worstDetail, worstAll, perPen: worstPen };
    // runtime frames: #2, #3, #5 (runtime), develop
    const exitT = [0, 1, 2].map((c) => info.tl[0] + (info.tl[2 + 2 * c] / 1e3) * info.tl[1]);
    let prevPen = -1, bad2 = [], maxLive = 0, prevPx = null, bad3 = [], maxFinish = 0, densLog = {}, prevDens = -1, densDrop = 0, frames = 0, maxFinishAC = 0, maxFinishDet = 0;
    const frameLog = [];
    let outSamples = 0, outMax = 0;
    const outside = [0, 0, 0], outAt = [];
    for (let k = 0; k < 400; k++) {
      const f = await page.evaluate(() => {
        const h = window.__heroDraw, cv = [...document.querySelectorAll('.hero-draw-lines canvas')];
        const px = cv.map((c) => { if (!c.width || !c.height) return 0; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 24) n++; return n; });
        return { state: h.state, penT: h.frame ? h.frame.penT : null, from: h.frame ? h.frame.from : null, to: h.frame ? h.frame.to : null, live: h.frame ? h.frame.live : 0, dens: h.dens, px };
      });
      frames++;
      if (f.state === 'done') break;
      if (f.penT != null) {
        if (f.penT < prevPen) bad2.push(['penT decreased', k]);
        // strokes partial at this pen time, per lane (every lane the page reports)
        const part = Object.fromEntries(LANES.map((p) => [p, 0]));
        info.schedule.forEach((s, i) => { if (s[0] < f.penT && s[0] + s[1] > f.penT) part[info.pen[i]]++; });
        if (LANES.some((p) => part[p] > 1)) bad2.push(['two partial strokes in one lane', k, part]);
        maxLive = Math.max(maxLive, f.live);
        // strokes finishing within this frame: pens A-C and the detail lanes apart (dense3), and the frame log
        const finIdx = info.schedule.map((s, i) => i).filter((i) => info.schedule[i][0] + info.schedule[i][1] > prevPen && info.schedule[i][0] + info.schedule[i][1] <= f.penT);
        const fin = finIdx.length, finDet = finIdx.filter((i) => isDet(info.pen[i])).length;
        maxFinish = Math.max(maxFinish, fin);
        maxFinishAC = Math.max(maxFinishAC, fin - finDet);
        maxFinishDet = Math.max(maxFinishDet, finDet);
        const liveDet = info.schedule.filter((s, i) => isDet(info.pen[i]) && s[0] < f.penT && s[0] + s[1] > f.penT).length;
        frameLog.push([+f.penT.toFixed(2), f.live, liveDet, fin - finDet, finDet]);
        if (prevPx) for (let c = 0; c < 3; c++) if (f.px[c] < prevPx[c] && f.penT < exitT[c]) bad3.push([c, k, prevPx[c], f.px[c]]);
        prevPx = f.px;
        prevPen = f.penT;
        if (f.dens != null) { if (f.dens < prevDens - 1e-9) densDrop++; prevDens = f.dens; }
        for (const t of [300, 700, 1000, 1400, 1600, 1800, 2000, 2200, 2400]) if (densLog[t] == null && f.penT >= t - 1e-6 && f.penT < t + FR) densLog[t] = +f.dens.toFixed(3);
        // #3b (restored): no stray ink, every 6th frame (100 ms) while any layer is still drawn
        if (k % 6 === 0) {
          const o = await page.evaluate((p) => window.__outside(p), f.penT);
          outSamples++;
          for (let c = 0; c < 3; c++) if (o[c]) { outside[c] += o[c]; outMax = Math.max(outMax, o[c]); if (outAt.length < 5) outAt.push([Math.round(f.penT), c, o[c]]); }
        }
      }
      await step();
    }
    R.checks.noStrayInk = { ok: outSamples >= 10 && outMax === 0, samples: outSamples, outsideByCanvas: outside, outMax, firstAt: outAt };
    // the develop as engine/build.cjs records it: T and P the merge curve (gamma 3.0, ghost 0.06 to 0.40); D fix round 1
    // (ghost 0.05 to 0.47, then a main rise from 0.47, half linear, half smoothstep; engine/pens.cjs)
    const want = R.cls === 'D' ? { 300: 0, 700: 0.017, 1000: 0.038, 1400: 0.081, 1600: 0.221, 1800: 0.407, 2000: 0.609, 2200: 0.8, 2400: 0.949 }
      : { 300: 0, 700: 0.027, 1000: 0.066, 1400: 0.178, 1600: 0.301, 1800: 0.474, 2000: 0.676, 2200: 0.864, 2400: 0.983 };
    const densBad = Object.entries(want).filter(([t, d]) => densLog[t] == null || Math.abs(densLog[t] - d) > 0.02);
    R.checks.runtime = { ok: !bad2.length && maxLive <= LANES.length, bad: bad2.slice(0, 5), maxLive, maxLiveAllowed: LANES.length, frames };
    R.checks.pixelsNeverDecrease = { ok: !bad3.length, bad: bad3.slice(0, 5), exitStart: exitT.map(Math.round) };
    R.checks.finishesPerFrame = { ok: maxFinishAC <= 3 && maxFinishDet <= DET.length, maxFinish, maxFinishAC, maxFinishDetail: maxFinishDet, detailAllowed: DET.length };
    // frame log: [pen ms, strokes live (engine), detail live, A-C finishes, detail finishes] per runtime frame (dense3)
    R.frames = frameLog;
    R.checks.develop = { ok: !densBad.length && !densDrop, densAt: densLog, densDrop };
    R.errors.push(...errors);
    await ctx.close();
  }
  // ---- #6 input settles at three times
  if (want('input')) R.checks.input = {};
  for (const at of want('input') ? [900, 1600, 2200] : []) {
    const { ctx, page, errors, step } = await load(browser);
    let s;
    for (let g = 0; g < 400; g++) { s = await step(); if (s.penT >= at) break; }
    const pxBefore = await page.evaluate(() => [...document.querySelectorAll('.hero-draw-lines canvas')].map((c) => { if (!c.width) return 0; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 24) n++; return n; }));
    const vt0 = s.vt;
    if (MOBILE) await page.touchscreen.tap(Math.round(W / 2), Math.round(H * 0.3)); else { await page.mouse.move(Math.round(W * 0.9), 120); await page.mouse.down(); await page.mouse.up(); }
    let more = false, end = null;
    for (let g = 0; g < 60; g++) {
      s = await step();
      const px = await page.evaluate(() => [...document.querySelectorAll('.hero-draw-lines canvas')].map((c) => { if (!c.width) return 0; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 24) n++; return n; }));
      if (px.some((v, c) => v > pxBefore[c])) more = true;
      if (s.state === 'done') { end = s; break; }
    }
    const dom = await page.evaluate(() => ({ cls: document.documentElement.className, nodes: document.querySelectorAll('.hero-draw-lines, .hero-draw-veil, #hero-pen-data').length, by: (window.__heroDraw || {}).settledBy }));
    const ms = end ? end.vt - vt0 : null;
    R.checks.input[at] = { ok: !!end && ms <= 190 && !more && dom.cls === 'js' && dom.nodes === 0, msToDone: ms == null ? null : +ms.toFixed(1), newInk: more, ...dom };
    R.errors.push(...errors);
    await ctx.close();
  }
  // ---- #7 (dense3) a photo that never decodes: every hero-photo request is held open (never answered), so neither the
  // decode nor the load event comes. The engine must still develop at DECODE_CAP on the pen clock (H.devStart), hand the
  // hero back to the CSS (hero-draw-own off), and end cleanly without the 11 s ceiling. With --decode-cap none (the stock
  // engine, negative control) the expectation is the old one: lines on white until the ceiling settles at about 11 s.
  if (want('nophoto')) {
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR, isMobile: MOBILE, hasTouch: MOBILE });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    let held = 0;
    await page.route(/hero-fsae-/, () => { held++; });   // never continued: the request stays pending
    await page.addInitScript(VT);
    await page.goto(URL_, { waitUntil: 'domcontentloaded' });
    const step = () => page.evaluate((d) => window.__film.step(d), FR);
    let s = null, own = null, ownAfter = null;
    for (let g = 0; g < 1200; g++) {
      s = await step();
      if (s.devStart != null && own == null) own = await page.evaluate(() => document.documentElement.classList.contains('hero-draw-own'));
      if (s.state === 'done') break;
    }
    const h = await page.evaluate(() => { const x = window.__heroDraw || {}; return { devStart: x.devStart == null ? null : x.devStart, decodedAt: x.decodedAt == null ? null : x.decodedAt, settledBy: x.settledBy || null, t0: x.t0 == null ? null : x.t0, doneAt: x.doneAt == null ? null : x.doneAt, state: x.state, cls: x.cls }; });
    ownAfter = own;
    const dom = await page.evaluate(() => ({ cls: document.documentElement.className, nodes: document.querySelectorAll('.hero-draw-lines, .hero-draw-veil, #hero-pen-data').length }));
    const wall = h.doneAt != null && h.t0 != null ? +(h.doneAt - h.t0).toFixed(0) : null;
    const ok = DECODE_CAP === 'none'
      ? h.settledBy === 'ceiling' && h.devStart == null
      : h.devStart != null && h.devStart >= +DECODE_CAP - 1e-6 && h.devStart < +DECODE_CAP + FR + 1e-6 && h.decodedAt === -1 && ownAfter === false && h.state === 'done' && !h.settledBy && dom.cls === 'js' && dom.nodes === 0;
    R.checks.photoNeverDecodes = { ok, expect: DECODE_CAP === 'none' ? 'stock: ceiling at 11 s' : `develop at ${DECODE_CAP} ms pen clock`, heldRequests: held, ...h, heroDrawOwnAtDevelop: ownAfter, endWallMsFromT0: wall, ...dom };
    R.errors.push(...errors.filter((e) => !/hero-fsae-/.test(e)));
    await ctx.close();
  }
  // ---- determinism (restored): two virtual-clock loads, identical alpha hashes on every canvas at six pen times
  // (integration onto 5b20926f: skipped with --only-nophoto, like every check but #7)
  if (want('determinism')) {
    const AT = [300, 700, 1100, 1500, 1900, 2300], runs = [];
    for (let r = 0; r < 2; r++) {
      const { ctx, page, errors, step } = await load(browser);
      const got = {};
      let s, i = 0;
      for (let g = 0; g < 400 && i < AT.length; g++) { s = await step(); if (s.state === 'done') break; if (s.penT != null && s.penT >= AT[i]) { got[AT[i]] = { penT: +s.penT.toFixed(2), h: await page.evaluate(() => window.__alphaHash()) }; i++; } }
      runs.push(got);
      R.errors.push(...errors);
      await ctx.close();
    }
    const same = AT.every((t) => runs[0][t] && runs[1][t] && JSON.stringify(runs[0][t]) === JSON.stringify(runs[1][t]));
    R.checks.determinism = { ok: same, at: AT, load1: runs[0], load2: runs[1] };
  }
  // ---- fix1: resize while drawing (same class, class change) and the quick reveal (scrolled, short viewport)
  if (want('resize')) {
    R.checks.resizeSameClass = await resizeCase(browser, 'same-class');
    R.checks.resizeClassChange = await resizeCase(browser, 'class-change');
  }
  if (want('quick')) {
    R.checks.quickScrolled = await quickCase(browser, 'scrolled');
    R.checks.quickShort = await quickCase(browser, 'short');
  }
  await browser.close();
  const KEYS = { sequence: ['perPenSequential', 'endsPerWindow', 'runtime', 'pixelsNeverDecrease', 'finishesPerFrame', 'develop', 'noStrayInk'], input: ['input'], nophoto: ['photoNeverDecodes'], determinism: ['determinism'],
    resize: ['resizeSameClass', 'resizeClassChange'], quick: ['quickScrolled', 'quickShort'] };
  R.missing = R.groups.flatMap((g) => KEYS[g].filter((k) => !(k in R.checks)));
  R.pass = !R.missing.length && Object.values(R.checks).every((c) => (c.ok !== undefined ? c.ok : Object.values(c).every((x) => x.ok))) && !R.errors.length;
  if (OUT) fs.writeFileSync(OUT, JSON.stringify(R, null, 1));
  for (const [k, v] of Object.entries(R.checks)) console.log(k, JSON.stringify(v).slice(0, 240));
  console.log('errors', R.errors.length, 'pass', R.pass);
  process.exit(R.pass ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(2); });
