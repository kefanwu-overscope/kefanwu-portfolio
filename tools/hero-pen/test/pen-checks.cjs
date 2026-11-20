#!/usr/bin/env node
// Objective pen checks (PEN_SPEC 16.1, plus the refresh, determinism and input parts of 16.2) on any page that
// runs the hero pen engine. Headless Chrome through Playwright, fresh temporary profile per browser.
//   #1 schedule sequential (window.__heroDraw.schedule)
//   #2 runtime trace: penT never decreases, each frame's drawn range starts where the previous ended, at most one
//      partial stroke per frame (structural), no ink after lastInk
//   #3 pixels: about 10 samples per load; the inked-pixel count never decreases before the develop; every inked
//      pixel lies within 2 device px of a stroke (its own width included) whose scheduled start <= penT
//   #4 long lines seen growing (frames by length, P0 >= 3 frames, P1 >= 5) and peak tip advance <= A[p]
//   #5 bursts: any 16.67 ms window has <= 4 strokes ending (6 in P4), <= 0.40 cw ink, all ink within 0.25 cw of
//      the window's first inked point (exact engine motion through __heroDraw.at)
//   #6 input stops the pen: pointerdown (tap on phones) at penT >= 1000; ink never rises after it; done in 250 ms
//   refresh: every load and reload draws; same hash on every load
//   Back with and without the back/forward cache: 0 replays, scroll position kept
//   revision 1: numerals (tier n) >= 4 frames with >= 30 ms between digits; class P detail (P3) non-hatch strokes of
//      0.05 cw or more >= 2 frames; --fold 1: the car box under half on screen at t0 gives the 300 ms quick reveal
//      (no lines, no pen frames), once scrolled past the car before t0 and once in a short viewport
//   revision 2: phases run P0 P1 P2 P4 P5 P3 (the payoff last); P1 strokes under 0.10 cw >= 4 frames; SHADE edges
//      (tier h, 0.1 cw or more) peak <= 0.12 cw per frame and >= 6 frames from 0.3 cw, else >= 4; the INK + SHADE pixel
//      count never decreases before the develop (GUIDE is separate: its ghost rim loops retire 150 ms after their rim
//      line, __heroDraw.gr); once a ghost has retired, any of its pixels left on the GUIDE canvas counts as outside
//   revision 3: the develop starts >= 100 ms (pen clock) after last ink (devAfterLastInkOk); the determinism samples are
//      taken where no stroke moves: the finished drawing in that 100 ms hold (devPixelDiff, finalSampled) and the
//      longest lift between two P3 strokes (liftPixelDiff; at D the College -> of line break); P2 form/detail lines of
//      0.15 cw or more last >= 2 frames and no two end within 33.3 ms (p2LongOk)
//   revision 4: numerals <= 35 % of their length per frame and >= 3 growing frames, class P numerals >= 100 ms, closed
//      loops >= 60 src px >= 2 frames, class P P2 strokes >= 50 src px >= 1 frame (rev4Ok); the wall-clock pixel samples
//      are compared exactly (frac) and dilated by 1 device px (frac1), on record only since revision 6
//   revision 5: P1 strokes >= 4 frames (P1_FLOOR_MS); every P2 stroke >= 1 frame at every class; a P2 pen travel over
//      50 src px lifts >= 17 ms (rev5Ok). Determinism (E6) is judged on a VIRTUAL CLOCK pass (--vloads, default 5):
//      requestAnimationFrame is wrapped so every frame advances the timestamp by exactly 1000/60 ms once the page runs,
//      so every load cuts the strokes into the same frame chunks and the samples land on identical pen times; the
//      three layers are hashed at every sample and must be identical (vclockOk). The wall-clock samples stay on record
//      (devPixelDiff, liftPixelDiff) without a verdict: their differences are frame-chunk effects (see the README).
//      --vstep2 <ms> adds a virtual pass with another frame step (an experiment: same pen times, other chunks).
//   revision 6: the wall-clock pixel-repeat verdicts (devPixelDiffOk, liftPixelDiffOk and their Exact forms) are gone
//      (anti-aliasing at frame cut points, not visible); vclockOk is the determinism verdict. --nav 1 checks the R1
//      arrival rules on the R1 page: #contact does not draw, its reload drops the fragment and draws at the top, #top
//      draws, the wordmark from a detail page (a held view-transition arrival) draws (navOk). verdict.failed / pass
//      summarise the verdicts that count.
// usage: node pen-checks.cjs --url http://127.0.0.1:4822/index.html --w 1440 --h 900 --dpr 1 [--mobile] [--cpu 4]
//          [--loads 10] [--input 1] [--back 1] [--resize 1] [--fold 1] [--nav 1] [--vloads 5] [--vstep2 15] [--shots] --out <dir> --tag <name>
// Timing numbers are from one machine; other headless Chrome work running at the same time makes them noisy.
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');
const PW = process.env.PLAYWRIGHT || 'C:/Users/oc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright';
const { chromium } = require(PW);
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const flag = (k) => argv.includes('--' + k);
const URL_ = opt('url', 'http://127.0.0.1:4822/index.html'), W = +opt('w', 1440), H = +opt('h', 900), DPR = +opt('dpr', 1), MOBILE = flag('mobile');
const VLOADS = +opt('vloads', 5), VSTEP2 = +opt('vstep2', 0);
const CPU = +opt('cpu', 1), LOADS = +opt('loads', 10), INPUTS = +opt('input', 1), BACK = +opt('back', 1), OUT = path.resolve(opt('out', '.')), TAG = opt('tag', `${W}x${H}-dpr${DPR}-x${CPU}`);
// A[0] 0.25 since revision 1 (P0 in 250 ms; tools/hero-pen/engine/solve.cjs)
const FR = 1000 / 60, CW = 827, A = [0.25, 0.12, 0.25, 0.30, 0.35, 0.25], ENDS = [9, 9, 4, 4, 6, 4], RANK = [0, 1, 2, 5, 3, 4];
const GH_MS = 150;

// Playwright launches Chromium with --disable-back-forward-cache; the bfcache Back test removes that default.
async function launch(extraArgs = [], ignoreDefaultArgs = []) {
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'hero-pen-checks-'));
  const ctx = await chromium.launchPersistentContext(prof, {
    channel: 'chrome', headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--use-angle=d3d11', '--hide-scrollbars', ...extraArgs],
    ignoreDefaultArgs, viewport: { width: W, height: H }, deviceScaleFactor: DPR, isMobile: MOBILE, hasTouch: MOBILE,
    userAgent: MOBILE ? 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36' : undefined,
  });
  return { ctx, close: async () => { await ctx.close(); fs.rmSync(prof, { recursive: true, force: true }); } };
}
// revision 5: a virtual frame clock. Every requestAnimationFrame callback of one real frame gets the same timestamp;
// the first real frame keeps its own, each later real frame adds exactly `step` ms. The engine's pen clock reads
// only these timestamps after t0, so the frame chunks (and the pixels) depend on pen time alone.
function VCLOCK(step) {
  const raf = window.requestAnimationFrame.bind(window);
  let lastReal = null, v = 0;
  window.__vclock = step;
  window.requestAnimationFrame = (cb) => raf((ts) => {
    if (ts !== lastReal) { v = lastReal === null ? ts : v + step; lastReal = ts; }
    cb(v);
  });
}
async function newPage(ctx, pre) {
  const page = ctx.pages()[0] || (await ctx.newPage());
  if (CPU > 1) { const s = await ctx.newCDPSession(page); await s.send('Emulation.setCPUThrottlingRate', { rate: CPU }); }
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  if (pre) await page.addInitScript(pre[0], pre[1]);
  await page.addInitScript(INIT);
  return { page, errors };
}

// ---- in-page instrumentation (init script) ----
function INIT() {
  let hd;
  const log = (window.__penLog = []), pix = (window.__pix = []);
  window.__pd = -1;
  addEventListener('pointerdown', () => { if (window.__pd < 0) window.__pd = performance.now(); }, { capture: true });
  addEventListener('pageshow', (e) => { window.__persisted = e.persisted; });
  Object.defineProperty(window, '__heroDraw', {
    configurable: true, get() { return hd; },
    set(v) {
      hd = v;
      let fr;
      Object.defineProperty(v, 'frame', { configurable: true, enumerable: true, get() { return fr; }, set(x) { fr = x; log.push([performance.now(), x.penT, x.from, x.to, x.partial ? 1 : 0]); } });
    },
  });
  // pixel sampler: one rAF loop; ~10 samples during the drawing plus one at the first developing frame
  const alphaCount = (c, th) => { if (!c || !c.width || !c.height) return 0; const a = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let j = 3; j < a.length; j += 4) if (a[j] >= th) n++; return n; };
  // allowed region per layer, kept across samples (strokes are added in schedule order as they start): every stroke
  // of the layer with scheduled start <= penT, stroked 4 device px wider than its widest point
  const AL = [];
  window.__allowed = (c, layer, penT, s) => {
    const [G, box, dpr] = s.geo;
    let A = AL[layer];
    if (!A || A.o.width !== c.width || A.o.height !== c.height || layer === 0) { A = AL[layer] = { o: new OffscreenCanvas(c.width, c.height), next: 0 }; }
    const x = A.o.getContext('2d');
    x.lineCap = x.lineJoin = 'round';
    x.strokeStyle = '#000';
    const b = box[layer];
    for (let i = A.next; i < s.n; i++) {
      if (s.schedule[i][0] > penT) break;
      A.next = i + 1;
      const cv = s.tier[i] === 'g' ? 0 : s.tier[i] === 'h' ? 1 : 2;
      if (cv !== layer) continue;
      // revision 2: a ghost loop that has retired (one frame of slack) may leave no pixel
      if (layer === 0 && s.gr && s.gr[i] >= 0 && penT >= s.gr[i] + 150 + 17) continue;
      const f = { g: 0.36, c: 0.95, y: 1.05, a: 1.40, n: 0.8, f: 0.62, d: 0.42, h: 0.3 }[s.tier[i]];
      x.lineWidth = Math.max(1, f * G.w1 * dpr) + 4;
      x.beginPath();
      const k = Math.max(16, Math.ceil(s.len[i] / 1.5));
      for (let q = 0; q <= k; q++) { const p = s.at(i, q / k), X = (G.ox + p[0] * G.kx - b[0]) * dpr, Y = (G.oy + p[1] * G.ky - b[1]) * dpr; q ? x.lineTo(X, Y) : x.moveTo(X, Y); }
      x.stroke();
    }
    return x.getImageData(0, 0, A.o.width, A.o.height).data;
  };
  let targets = null, devDone = false, lift = null, liftDone = false, finDone = false;
  const alpha64 = (c) => { const a = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, al = new Uint8Array(a.length / 4); for (let j = 0; j < al.length; j++) al[j] = a[4 * j + 3]; let bin = ''; for (let j = 0; j < al.length; j += 8192) bin += String.fromCharCode.apply(null, al.subarray(j, j + 8192)); return { w: c.width, h: c.height, b64: btoa(bin) }; };
  const tick = () => {
    const s = window.__heroDraw;
    if (s && s.state === 'done') return;
    requestAnimationFrame(tick);
    if (!s || !s.schedule || !s.frame) return;
    if (!targets) targets = Array.from({ length: 10 }, (_, k) => (s.lastInk * (k + 0.5)) / 10).concat((s.gr || []).filter((t) => t >= 0).flatMap((t) => [t + 60, t + 190])).sort((a, b) => a - b);
    const st = s.state, penT = s.frame.penT;
    // revision 3 (E6): a determinism sample at a fixed pen time inside a pen lift (no stroke moving): the longest gap
    // between two P3 strokes (at D the lift at the line break, College -> of), sampled on the first frame inside it.
    // Pen-time jitter between loads cannot change the ink there.
    if (!lift) { lift = [0, 0]; const sc = s.schedule; for (let i = 1; i < sc.length; i++) { const a = sc[i - 1][0] + sc[i - 1][1], b = sc[i][0]; if (s.ph[i] === 3 && s.ph[i - 1] === 3 && b - a >= 25 && b - a > lift[1] - lift[0]) lift = [a, b]; } }
    if (st === 'drawing' && !liftDone && lift[1] > lift[0] && penT > lift[0] + 0.5 && penT < lift[1] - 0.5) { liftDone = true; const c = document.querySelectorAll('.hero-draw-lines canvas')[2]; pix.push({ penT, state: 'lift', lift, inkAlpha: alpha64(c), inked: 0, outside: 0, perLayer: [], h: [...document.querySelectorAll('.hero-draw-lines canvas')].map((x) => { if (!x.width) return '0'; const a = x.getContext('2d').getImageData(0, 0, x.width, x.height).data; let hh = 2166136261; for (let j = 3; j < a.length; j += 4) hh = Math.imul(hh ^ a[j], 16777619); return (hh >>> 0).toString(16) + ':' + x.width + 'x' + x.height; }) }); }
    // revision 3: the finished drawing, in the 100 ms between last ink and the develop start (pen lifted, all ink down)
    const fin = st === 'drawing' && !finDone && penT > s.lastInk + 0.5;
    const sampleNow = (st === 'drawing' && targets.length && penT >= targets[0]) || fin || (st === 'developing' && !devDone);
    if (!sampleNow) return;
    if (st === 'drawing') while (targets.length && penT >= targets[0]) targets.shift();
    const cvs = [...document.querySelectorAll('.hero-draw-lines canvas')];
    const w0 = performance.now(), rec = { penT, state: st, inked: 0, outside: 0, perLayer: [], outsideByLayer: [] };
    rec.h = [];
    cvs.forEach((c, layer) => {
      if (!c.width || !c.height) { rec.perLayer.push(0); rec.h.push('0'); return; }
      const a = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, m = window.__allowed(c, layer, penT, s);
      // revision 5: FNV-1a over the layer's alpha bytes (the virtual-clock pass compares these)
      let hh = 2166136261;
      for (let j = 3; j < a.length; j += 4) hh = Math.imul(hh ^ a[j], 16777619);
      rec.h.push((hh >>> 0).toString(16) + ':' + c.width + 'x' + c.height);
      let n = 0, out = 0;
      for (let j = 3; j < a.length; j += 4) if (a[j] >= 24) { n++; if (m[j] < 8) out++; }
      if (layer) rec.inked += n;
      rec.outside += out; rec.perLayer.push(n); rec.outsideByLayer.push(out);
    });
    if (fin) { finDone = true; rec.final = true; rec.inkAlpha = alpha64(cvs[2]); }
    if (st === 'developing') {
      devDone = true;
      // only when the hold sample was missed (a frame jumped the whole 100 ms)
      if (!finDone) rec.inkAlpha = alpha64(cvs[2]);
    }
    rec.ms = +(performance.now() - w0).toFixed(1);
    pix.push(rec);
  };
  requestAnimationFrame(tick);
}

// ---- schedule-based checks, evaluated in the page with the engine's own motion (__heroDraw.at) ----
function scheduleChecks([FR, CW, A, ENDS, RANK]) {
  const s = window.__heroDraw, sch = s.schedule, n = s.n, res = { sequential: true, floorViolations: [], peak: {}, peakViolations: [], windows: {} };
  for (let i = 1; i < n; i++) if (sch[i][0] < sch[i - 1][0] + sch[i - 1][1]) res.sequential = false;
  for (let i = 1; i < n; i++) if (RANK[s.ph[i]] < RANK[s.ph[i - 1]]) res.phaseOrder = false;
  res.phaseRuns = s.ph.filter((p, i) => !i || p !== s.ph[i - 1]);
  res.lastTier = s.tier[n - 1];
  if (res.phaseOrder !== false) res.phaseOrder = true;
  const arc = (i, t) => s.at(i, Math.max(0, Math.min(1, (t - sch[i][0]) / sch[i][1])))[2];
  for (let i = 0; i < n; i++) {
    const l = s.len[i] / CW, d = sch[i][1], fr = d / FR, p = s.ph[i], need = l >= 0.5 ? 3 : l >= 0.25 ? 2 : l >= 0.12 ? 1 : 0;
    if (fr + 1e-9 < need) res.floorViolations.push(`#${i} ${l.toFixed(3)} cw over ${fr.toFixed(2)} frames`);
    if (p === 0 && d < 50) res.floorViolations.push(`#${i} P0 ${d} ms`);
    // revision 5: every P1 stroke >= 4 frames (P1_FLOOR_MS; the peak-advance cap below is the seen-speed rule)
    if (p === 1 && d < 4 * FR - 1e-9) res.floorViolations.push(`#${i} P1 ${d} ms`);
    const shade = s.tier[i] === 'h' && l >= 0.1;
    if (shade && d < (l >= 0.3 ? 6 : 4) * FR - 1e-9) res.floorViolations.push(`#${i} shade ${d} ms`);
    if (l >= 0.12 || shade) {
      let pk = 0;
      for (let t = sch[i][0] - FR; t <= sch[i][0] + d; t += 0.5) pk = Math.max(pk, arc(i, t + FR) - arc(i, t));
      pk /= CW;
      res.peak[p] = Math.max(res.peak[p] || 0, +pk.toFixed(4));
      if (pk > A[p] + 1e-6) res.peakViolations.push(`#${i} P${p} ${pk.toFixed(3)} cw/frame`);
      if (shade) { res.peak.shade = Math.max(res.peak.shade || 0, +pk.toFixed(4)); if (pk > 0.12 + 1e-6) res.peakViolations.push(`#${i} shade ${pk.toFixed(3)} cw/frame`); }
    }
  }
  // sliding windows, 1 ms step
  let worst = { ends: 0, ink: 0, loc: 0 }, over = { ends: 0, ink: 0, loc: 0 }, j0 = 0, count = 0;
  const last = sch[n - 1][0] + sch[n - 1][1];
  for (let w = -FR; w <= last; w += 1) {
    const e = w + FR;
    while (j0 < n && sch[j0][0] + sch[j0][1] <= w) j0++;
    let ends = 0, ink = 0, first = null, loc = 0, act = 0, ph = 0;
    for (let j = j0; j < n && sch[j][0] < e; j++) {
      const a = Math.max(w, sch[j][0]), b = Math.min(e, sch[j][0] + sch[j][1]), end = sch[j][0] + sch[j][1];
      if (end > w && end <= e) ends++;
      if (b <= a) continue;
      act++;
      ph = Math.max(ph, s.ph[j]);
      const pa = s.at(j, (a - sch[j][0]) / sch[j][1]), pb = s.at(j, (b - sch[j][0]) / sch[j][1]);
      if (pb[2] - pa[2] <= 1e-9) continue;
      ink += (pb[2] - pa[2]) / CW;
      if (!first) first = pa;
      for (let q = 0; q <= 8; q++) { const pt = s.at(j, (a + ((b - a) * q) / 8 - sch[j][0]) / sch[j][1]); loc = Math.max(loc, Math.hypot(pt[0] - first[0], pt[1] - first[1]) / CW); }
    }
    if (!act) continue;
    count++;
    if (ends > ENDS[ph]) over.ends++;
    if (ink > 0.40 + 1e-9) over.ink++;
    if (loc > 0.25 + 1e-9) over.loc++;
    worst = { ends: Math.max(worst.ends, ends), ink: Math.max(worst.ink, ink), loc: Math.max(worst.loc, loc) };
  }
  res.windows = { count, worstEnds: worst.ends, worstInkCw: +worst.ink.toFixed(3), worstLocalityCw: +worst.loc.toFixed(3), overEndCap: over.ends, overInk040: over.ink, localityOver025: over.loc };
  // revision 1 floors (runtime data has tiers, phases and lengths, not ids: lettering rules are checked by the build)
  res.glyphRules = { numerals: [], numeralLifts: [], pDetailMinMs: null, violations: [] };
  for (let i = 0; i < n; i++) {
    const d = sch[i][1];
    if (s.tier[i] === 'n') {
      res.glyphRules.numerals.push(d);
      if (d < 4 * FR - 1e-9) res.glyphRules.violations.push(`#${i} numeral ${d} ms`);
      if (i && s.tier[i - 1] === 'n') { const g = sch[i][0] - sch[i - 1][0] - sch[i - 1][1]; res.glyphRules.numeralLifts.push(g); if (g < 30) res.glyphRules.violations.push(`#${i} digit lift ${g} ms`); }
    }
    if (s.cls === 'P' && s.ph[i] === 3 && s.tier[i] !== 'h' && s.len[i] / CW >= 0.05) {
      res.glyphRules.pDetailMinMs = res.glyphRules.pDetailMinMs == null ? d : Math.min(res.glyphRules.pDetailMinMs, d);
      if (d < 2 * FR - 1e-9) res.glyphRules.violations.push(`#${i} P detail ${d} ms`);
    }
  }
  // revision 3: P2 form/detail lines (tier f or d) of 0.15 cw or more: >= 2 frames, no two ends within 33.3 ms
  res.p2Long = { n: 0, minMs: null, minEndGapMs: null, violations: [] };
  let pe = null;
  for (let i = 0; i < n; i++) {
    if (s.ph[i] !== 2 || !'fd'.includes(s.tier[i]) || s.len[i] / CW < 0.15) continue;
    const d = sch[i][1], end = sch[i][0] + d;
    res.p2Long.n++;
    res.p2Long.minMs = res.p2Long.minMs == null ? d : Math.min(res.p2Long.minMs, d);
    if (d < 2 * FR - 1e-9) res.p2Long.violations.push(`#${i} ${s.len[i]} src px in ${d} ms`);
    if (pe != null) { res.p2Long.minEndGapMs = res.p2Long.minEndGapMs == null ? end - pe : Math.min(res.p2Long.minEndGapMs, end - pe); if (end - pe <= 2 * FR) res.p2Long.violations.push(`#${i} ends ${end - pe} ms after the previous long line`); }
    pe = end;
  }
  // revision 4, with the engine's own motion: numerals advance <= 35 % of their length per 16.67 ms window and grow
  // over >= 3 frames (each >= 5 % of the length) at every frame phase; class P numerals >= 100 ms; closed loops of
  // 60 src px or more >= 2 frames; class P P2 non-hatch strokes of 50 src px or more >= 1 frame. Areas and join flags
  // are not in the runtime data: the per-area end cap (E5) and the join speed (E3) are checked by the build, and the
  // geometric continuations seen here are reported (rev4.joins: [i, ms / src px before, after]) without a verdict.
  res.rev4 = { numerals: [], closed: [], p2p: [], joins: [], violations: [] };
  const arcF = (i, u) => s.at(i, Math.max(0, Math.min(1, u)))[2];
  for (let i = 0; i < n; i++) {
    const d = sch[i][1], L = s.len[i], t = s.tier[i], p0 = s.at(i, 0), p1 = s.at(i, 1);
    if (t === 'n') {
      let adv = 0, grow = 1e9;
      for (let w = -FR; w <= d; w += 0.25) adv = Math.max(adv, arcF(i, (w + FR) / d) - arcF(i, w / d));
      for (let ph = 0; ph < FR; ph += 1) { let k = 0; for (let w = -ph; w < d; w += FR) if (arcF(i, (w + FR) / d) - arcF(i, w / d) >= 0.05 * L) k++; grow = Math.min(grow, k); }
      res.rev4.numerals.push([i, d, +(adv / L).toFixed(3), grow]);
      if (adv / L > 0.35 + 1e-6) res.rev4.violations.push(`#${i} numeral ${(100 * adv / L).toFixed(1)} % per frame`);
      if (grow < 3) res.rev4.violations.push(`#${i} numeral grows over ${grow} frames`);
      if (s.cls === 'P' && d < 100) res.rev4.violations.push(`#${i} P numeral ${d} ms < 100`);
    }
    const line = t !== 'h' && t !== 'n' && t !== 'g';
    if (line && L >= 60 && Math.hypot(p0[0] - p1[0], p0[1] - p1[1]) <= Math.max(3, 0.05 * L)) { res.rev4.closed.push([i, L, d]); if (d < 2 * FR - 1e-9) res.rev4.violations.push(`#${i} closed loop ${L} src px in ${d} ms`); }
    if (s.cls === 'P' && s.ph[i] === 2 && line && L >= 50) { res.rev4.p2p.push([i, L, d]); if (d < FR - 1e-9) res.rev4.violations.push(`#${i} P P2 ${L} src px in ${d} ms`); }
    if (i && line && s.ph[i] === s.ph[i - 1] && !'hng'.includes(s.tier[i - 1])) {
      const q = s.at(i - 1, 1);
      if (Math.hypot(q[0] - p0[0], q[1] - p0[1]) <= 3) res.rev4.joins.push([i, +(sch[i - 1][1] / s.len[i - 1]).toFixed(3), +(d / L).toFixed(3)]);
    }
  }
  // revision 5: every P2 stroke >= 1 frame; a P2 pen travel over 50 src px lifts >= 17 ms
  res.rev5 = { p2MinMs: null, lifts: 0, minLiftOver50: null, violations: [] };
  for (let i = 0; i < n; i++) {
    if (s.ph[i] !== 2) continue;
    const d = sch[i][1];
    res.rev5.p2MinMs = res.rev5.p2MinMs == null ? d : Math.min(res.rev5.p2MinMs, d);
    if (d < FR - 1e-9) res.rev5.violations.push(`#${i} P2 ${d} ms < 1 frame`);
    if (!i) continue;
    const q = s.at(i - 1, 1), p0 = s.at(i, 0), J = Math.hypot(q[0] - p0[0], q[1] - p0[1]), g = sch[i][0] - sch[i - 1][0] - sch[i - 1][1];
    if (J > 50) {
      res.rev5.lifts++;
      res.rev5.minLiftOver50 = res.rev5.minLiftOver50 == null ? g : Math.min(res.rev5.minLiftOver50, g);
      if (g < 17) res.rev5.violations.push(`#${i} P2 lift ${g} ms over ${J.toFixed(0)} src px`);
    }
  }
  res.p0Ms = (() => { const k = s.ph.lastIndexOf(0); return k < 0 ? null : sch[k][0] + sch[k][1]; })();
  res.p1 = (() => { const i = s.ph.indexOf(1), k = s.ph.lastIndexOf(1); return i < 0 ? null : { start: sch[i][0], end: sch[k][0] + sch[k][1] }; })();
  return res;
}

function traceCheck(log, lastInk, t0) {
  let penBack = 0, notContiguous = 0, inkAfterLastInk = 0, maxRaf = 0, maxRafP01 = 0, gapsOver50P01 = 0, firstInkMs = null;
  for (let i = 0; i < log.length; i++) {
    const [now, penT, from, to, partial] = log[i];
    if (firstInkMs == null && (to > from || partial)) firstInkMs = +(now - t0).toFixed(1);
    if (!i) continue;
    const p = log[i - 1];
    if (penT < p[1]) penBack++;
    if (from !== p[3]) notContiguous++;
    if (p[1] >= lastInk && (to > from || partial)) inkAfterLastInk++;
    const gap = now - p[0];
    maxRaf = Math.max(maxRaf, gap);
    if (penT <= 1700) { maxRafP01 = Math.max(maxRafP01, gap); if (gap > 50) gapsOver50P01++; }
  }
  return { frames: log.length, penBack, notContiguous, inkAfterLastInk, firstInkAfterT0Ms: firstInkMs, maxRafGapMs: +maxRaf.toFixed(1), maxRafGapP0P1Ms: +maxRafP01.toFixed(1), rafGapsOver50P0P1: gapsOver50P01 };
}

const summary = (page) => page.evaluate(() => {
  const s = window.__heroDraw || {};
  return {
    state: s.state, cls: s.cls, n: s.n, t0: s.t0, fcp: s.fcp, loadAt: s.loadAt, linesAt: s.linesAt, lastInk: s.lastInk, devStart: s.devStart, decodedAt: s.decodedAt, doneAt: s.doneAt,
    settledBy: s.settledBy || null, gr: s.gr || null, skipped: s.skipped || 0, quick: s.quick == null ? null : s.quick, hash: s.hash, error: s.error || null,
    htmlClass: document.documentElement.className, penAttr: document.documentElement.getAttribute('data-hero-pen'),
    nodes: document.querySelectorAll('.hero-draw-lines, .hero-draw-veil, #hero-pen-data').length, scrollY, overflowX: document.documentElement.scrollWidth > innerWidth,
    nav: (performance.getEntriesByType('navigation')[0] || {}).type, log: window.__penLog || [], pix: window.__pix || [],
  };
});

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const report = { tag: TAG, url: URL_, viewport: { W, H, DPR, mobile: MOBILE }, cpu: CPU, loads: [], input: [], back: [], note: 'one machine, headless Chrome; other headless work ran concurrently, so timings are noisy' };
  const t00 = Date.now();
  // ---- loads: one cold load + reloads in one profile ----
  {
    const B = await launch();
    try {
      const { page, errors } = await newPage(B.ctx);
      let sched = null;
      for (let k = 0; k < LOADS; k++) {
        if (k === 0) await page.goto(URL_, { waitUntil: 'load' }); else await page.reload({ waitUntil: 'load' });
        if (k === 1 && flag('shots')) {
          for (const t of [600, 1200, 2200, 3000]) {
            await page.waitForFunction((t) => window.__heroDraw && (window.__heroDraw.penT >= t || window.__heroDraw.state === 'done'), t, { timeout: 15000, polling: 'raf' }).catch(() => {});
            await page.screenshot({ path: path.join(OUT, `${TAG}-pen${t}.png`) });
          }
        }
        await page.waitForFunction(() => window.__heroDraw && window.__heroDraw.state === 'done', null, { timeout: 20000, polling: 100 }).catch(() => {});
        const r = await summary(page);
        if (!sched && r.state === 'done' && r.n) sched = await page.evaluate(() => null);
        r.errors = errors.splice(0);
        r.trace = traceCheck(r.log, r.lastInk, r.t0);
        // pixels
        const drawn = r.pix.filter((x) => x.state === 'drawing');
        let dec = 0;
        for (let i = 1; i < drawn.length; i++) if (drawn[i].inked < drawn[i - 1].inked) dec++;
        const gsm = r.pix.filter((x) => x.state === 'drawing').map((x) => [x.penT, x.perLayer[0] || 0, x.outsideByLayer ? x.outsideByLayer[0] || 0 : 0]);
        r.ghost = { gr: r.gr, guideSamples: gsm, guideOutsideAfterRetire: gsm.reduce((a, x) => a + x[2], 0),
          guideDropped: (r.gr || []).filter((t) => t >= 0).map((t) => { const b = gsm.filter((x) => x[0] < t).pop(), a = gsm.find((x) => x[0] >= t + 150 + 17); return b && a ? [b[1], a[1]] : null; }) };
        r.pixels = { sampleMsMax: Math.max(0, ...r.pix.map((x) => x.ms || 0)), samples: r.pix.length, drawingSamples: drawn.length, inkedDecreases: dec, outsideMax: Math.max(0, ...r.pix.map((x) => x.outside)), outsideTotal: r.pix.reduce((a, x) => a + x.outside, 0), inkedMax: Math.max(0, ...r.pix.map((x) => x.inked)), perSample: r.pix.map((x) => [x.penT, x.state, x.inked, x.outside]) };
        const devPix = r.pix.find((x) => x.inkAlpha && x.final) || r.pix.find((x) => x.inkAlpha && x.state === 'developing'), liftPix = r.pix.find((x) => x.state === 'lift');
        r.finalSampled = !!(devPix && devPix.final);
        // revision 3: the develop starts >= 100 ms (pen clock) after last ink
        r.devAfterLastInk = r.devStart != null && r.lastInk != null ? +(r.devStart - r.lastInk).toFixed(2) : null;
        r.liftAlpha = liftPix ? liftPix.inkAlpha : null;
        r.liftAt = liftPix ? [liftPix.penT, liftPix.lift] : null;
        r.pix = r.pix.filter((x) => x.state !== 'lift');
        r.devAlpha = devPix ? devPix.inkAlpha : null;
        r.devAlphaPenT = devPix ? devPix.penT : null;
        delete r.pix;
        r.drew = r.linesAt != null && r.state === 'done' && !r.settledBy && !r.skipped && !r.error;
        r.endStateOk = r.nodes === 0 && r.htmlClass === 'js' && r.penAttr == null;
        report.loads.push(r);
        console.log(TAG, 'load', k, r.nav, r.state, 'cls', r.cls, 'n', r.n, 'drew', r.drew, 'settledBy', r.settledBy, 'skipped', r.skipped, 'hash', r.hash, 't0', r.t0 && r.t0.toFixed(0), 'fcp', r.fcp && r.fcp.toFixed(0), 'load', r.loadAt && r.loadAt.toFixed(0),
          'trace', JSON.stringify(r.trace), 'pix', `${r.pixels.samples} dec ${r.pixels.inkedDecreases} outside ${r.pixels.outsideTotal}`, 'end', r.endStateOk, 'err', r.errors.length);
        if (k === 0) {
          // schedule checks (exact engine motion) once per page: identical on every load (same hash)
          await page.reload({ waitUntil: 'load' });
          await page.waitForFunction(() => window.__heroDraw && window.__heroDraw.schedule && window.__heroDraw.geo, null, { timeout: 15000 });
          report.schedule = await page.evaluate(scheduleChecks, [FR, CW, A, ENDS, RANK]);
          await page.waitForFunction(() => window.__heroDraw && window.__heroDraw.state === 'done', null, { timeout: 20000, polling: 100 }).catch(() => {});
          errors.splice(0);
          console.log(TAG, 'schedule', JSON.stringify({ ...report.schedule, floorViolations: report.schedule.floorViolations.length, peakViolations: report.schedule.peakViolations.length }));
        }
      }
    } finally { await B.close(); }
  }
  // determinism of pixels just before the develop: compare each load's INK alpha with the first
  // the base is the load whose sample landed at the median pen time: the pen may still be inking when the develop
  // starts, so a load sampled 1-2 ms of pen time later (a slow cold frame) differs by that ink, not by chance
  // revision 4 (E6): 1 device px tolerance as the critic proposed: both alpha images are dilated by 1 px (3 x 3 max)
  // before the diff (frame-chunk joins change the anti-aliased edge of a line, not where the ink is)
  const dil = (a, w, h) => {
    const o = new Uint8Array(a.length);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let m = 0;
      for (let dy = -1; dy <= 1; dy++) { const Y = y + dy; if (Y < 0 || Y >= h) continue; for (let dx = -1; dx <= 1; dx++) { const X = x + dx; if (X >= 0 && X < w && a[Y * w + X] > m) m = a[Y * w + X]; } }
      o[y * w + x] = m;
    }
    return o;
  };
  const diff1 = (a, b, w, h) => { const A = dil(a, w, h), B = dil(b, w, h); let d = 0; for (let i = 0; i < A.length; i++) if (Math.abs(A[i] - B[i]) > 32) d++; return d; };
  const withA = report.loads.filter((r) => r.devAlpha).sort((a, b) => a.devAlphaPenT - b.devAlphaPenT);
  const base = withA[Math.floor((withA.length - 1) / 2)];
  const diffs = [];
  if (base) {
    const a0 = Buffer.from(base.devAlpha.b64, 'base64');
    let inked0 = 0;
    for (const v of a0) if (v >= 24) inked0++;
    for (const r of report.loads) {
      if (!r.devAlpha || r === base) continue;
      if (r.devAlpha.w !== base.devAlpha.w || r.devAlpha.h !== base.devAlpha.h) { diffs.push({ size: 'differs' }); continue; }
      const a = Buffer.from(r.devAlpha.b64, 'base64');
      let d = 0;
      for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - a0[i]) > 32) d++;
      const d1 = diff1(a, a0, base.devAlpha.w, base.devAlpha.h);
      diffs.push({ penT: r.devAlphaPenT, basePenT: base.devAlphaPenT, diffPx: d, frac: +(d / Math.max(1, inked0)).toFixed(4), diffPx1: d1, frac1: +(d1 / Math.max(1, inked0)).toFixed(4) });
    }
  }
  // the same inside a pen lift (identical pen state on every load): what is left is frame-chunk anti-aliasing
  const liftDiffs = [];
  const lb = report.loads.find((r) => r.liftAlpha);
  if (lb) {
    const a0 = Buffer.from(lb.liftAlpha.b64, 'base64');
    let inked0 = 0;
    for (const v of a0) if (v >= 24) inked0++;
    for (const r of report.loads) {
      if (!r.liftAlpha || r === lb) continue;
      const a = Buffer.from(r.liftAlpha.b64, 'base64');
      if (a.length !== a0.length) { liftDiffs.push({ size: 'differs' }); continue; }
      let d = 0;
      for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - a0[i]) > 32) d++;
      const d1 = diff1(a, a0, lb.liftAlpha.w, lb.liftAlpha.h);
      liftDiffs.push({ penT: r.liftAt[0], basePenT: lb.liftAt[0], lift: r.liftAt[1], diffPx: d, frac: +(d / Math.max(1, inked0)).toFixed(4), diffPx1: d1, frac1: +(d1 / Math.max(1, inked0)).toFixed(4) });
    }
  }
  for (const r of report.loads) { delete r.devAlpha; delete r.liftAlpha; }
  // ---- revision 5 (E6): determinism on a virtual frame clock: identical pen times, identical frame chunks ----
  const vpass = async (step, loads) => {
    const out = { step: +step.toFixed(4), loads: [] };
    const B = await launch();
    try {
      const { page, errors } = await newPage(B.ctx, [VCLOCK, step]);
      for (let k = 0; k < loads; k++) {
        if (k === 0) await page.goto(URL_, { waitUntil: 'load' }); else await page.reload({ waitUntil: 'load' });
        await page.waitForFunction(() => window.__heroDraw && window.__heroDraw.state === 'done', null, { timeout: 30000, polling: 100 }).catch(() => {});
        const r = await summary(page);
        const lift = r.pix.find((x) => x.state === 'lift'), fin = r.pix.find((x) => x.final);
        out.loads.push({ state: r.state, settledBy: r.settledBy, skipped: r.skipped, hash: r.hash, drew: r.linesAt != null && r.state === 'done' && !r.settledBy && !r.skipped && !r.error,
          samples: r.pix.map((x) => [x.penT, x.state === 'lift' ? 'lift' : x.final ? 'final' : x.state, (x.h || []).join(' ')]),
          liftAlpha: lift ? lift.inkAlpha : null, finAlpha: fin ? fin.inkAlpha : null, errors: errors.splice(0), trace: traceCheck(r.log, r.lastInk, r.t0) });
      }
    } finally { await B.close(); }
    return out;
  };
  const cmpAlpha = (x, y) => {
    if (!x || !y) return null;
    if (x.w !== y.w || x.h !== y.h) return { size: 'differs' };
    const a = Buffer.from(x.b64, 'base64'), b = Buffer.from(y.b64, 'base64');
    let d = 0, inked = 0;
    for (let i = 0; i < a.length; i++) { if (b[i] >= 24) inked++; if (Math.abs(a[i] - b[i]) > 32) d++; }
    return { diffPx: d, frac: +(d / Math.max(1, inked)).toFixed(4), diffPx1: diff1(a, b, x.w, x.h), inked };
  };
  report.vclock = null;
  if (VLOADS > 0) {
    const V = await vpass(1000 / 60, VLOADS), b0 = V.loads[0];
    V.compare = V.loads.slice(1).map((r) => {
      // the first developing frame is not a pen sample: the develop waits for the photo's decode (real time, by
      // design), so its pen time may differ by a frame; its hashes are still compared
      const n = Math.min(r.samples.length, b0.samples.length);
      let samePenT = r.samples.length === b0.samples.length, sameHash = samePenT, firstDiff = null;
      for (let i = 0; i < n; i++) {
        if (r.samples[i][1] === 'developing' && b0.samples[i][1] === 'developing') { if (r.samples[i][2] !== b0.samples[i][2]) sameHash = false; continue; }
        if (r.samples[i][0] !== b0.samples[i][0]) samePenT = false;
        if (r.samples[i][2] !== b0.samples[i][2]) { sameHash = false; if (!firstDiff) firstDiff = [r.samples[i], b0.samples[i]]; }
      }
      return { samples: r.samples.length, samePenT, sameHash, firstDiff, lift: cmpAlpha(r.liftAlpha, b0.liftAlpha), final: cmpAlpha(r.finAlpha, b0.finAlpha) };
    });
    V.penTs = b0.samples.map((x) => [x[0], x[1]]);
    if (VSTEP2 > 0) {
      // the experiment: the same strokes cut into other frame chunks, compared at pen times where no stroke moves
      const V2 = await vpass(VSTEP2, 2);
      V.otherStep = { step: VSTEP2, lift: cmpAlpha(V2.loads[0].liftAlpha, b0.liftAlpha), final: cmpAlpha(V2.loads[0].finAlpha, b0.finAlpha),
        liftPenT: [V2.loads[0].samples.find((x) => x[1] === 'lift'), b0.samples.find((x) => x[1] === 'lift')].map((x) => x && x[0]),
        repeat: cmpAlpha(V2.loads[1].finAlpha, V2.loads[0].finAlpha) };
    }
    for (const r of V.loads) { delete r.liftAlpha; delete r.finAlpha; }
    report.vclock = V;
    console.log(TAG, 'vclock', JSON.stringify({ loads: V.loads.map((r) => [r.drew, r.hash, r.samples.length]), compare: V.compare.map((c) => [c.samePenT, c.sameHash, c.lift && c.lift.frac, c.final && c.final.frac]), otherStep: V.otherStep || null }));
  }
  // ---- #6 input stops the pen ----
  for (let k = 0; k < INPUTS; k++) {
    const B = await launch();
    try {
      const { page, errors } = await newPage(B.ctx);
      await page.addInitScript(() => {
        window.__ink = [];
        const f = () => {
          const s = window.__heroDraw, c = document.querySelector('.hero-draw-lines canvas[data-layer="ink"]') || document.querySelectorAll('.hero-draw-lines canvas')[2];
          if (s && s.state === 'done') { window.__ink.push([performance.now(), 'done', s.penT, -1]); return; }
          requestAnimationFrame(f);
          if (!c || !c.width || !s || !s.frame) return;
          const a = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
          let n = 0;
          for (let j = 3; j < a.length; j += 4) if (a[j] >= 64) n++;
          window.__ink.push([performance.now(), s.state, s.penT, n]);
        };
        requestAnimationFrame(f);
      });
      await page.goto(URL_, { waitUntil: 'load' });
      await page.waitForFunction(() => window.__heroDraw && window.__heroDraw.penT >= 1000, null, { timeout: 15000, polling: 'raf' });
      const pt = MOBILE ? [Math.round(W * 0.75), Math.round(H * 0.72)] : [Math.round(W * 0.86), Math.round(H * 0.7)];
      const hit = await page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? (e.closest('a,button') ? 'LINK' : e.tagName + '.' + e.className) : null; }, pt);
      if (MOBILE) await page.touchscreen.tap(pt[0], pt[1]); else { await page.mouse.move(pt[0], pt[1]); await page.mouse.down(); }
      await page.waitForFunction(() => window.__heroDraw.state === 'done', null, { timeout: 3000, polling: 50 }).catch(() => {});
      if (!MOBILE) await page.mouse.up();
      const r = await page.evaluate(() => ({ pd: window.__pd, ink: window.__ink, frames: window.__penLog, s: { state: window.__heroDraw.state, settledBy: window.__heroDraw.settledBy, doneAt: window.__heroDraw.doneAt, penT: window.__heroDraw.penT } }));
      // the sampler runs before the engine in each frame, so the first sample after the input still shows the ink of
      // the engine frame before it: that sample is the baseline; any later rise is ink drawn after the input
      const before = r.ink.filter((x) => x[0] < r.pd && x[3] >= 0), after = r.ink.filter((x) => x[0] >= r.pd && x[3] >= 0);
      let rises = 0, prev = after.length ? after[0][3] : null;
      for (const x of after.slice(1)) { if (prev != null && x[3] > prev) rises++; prev = x[3]; }
      const res = { hit, penTAtInput: before.length ? before[before.length - 1][2] : null, settledBy: r.s.settledBy, state: r.s.state, doneMsAfterInput: r.s.doneAt != null ? +(r.s.doneAt - r.pd).toFixed(1) : null,
        inkRisesAfter: rises, inkSamplesAfter: after.length, engineDrawFramesAfterInput: r.frames.filter((x) => x[0] > r.pd).length, errors };
      res.ok = res.state === 'done' && res.inkRisesAfter === 0 && res.engineDrawFramesAfterInput === 0 && res.doneMsAfterInput != null && res.doneMsAfterInput <= 250 && hit !== 'LINK';
      report.input.push(res);
      console.log(TAG, 'input', k, JSON.stringify(res));
    } finally { await B.close(); }
  }
  // ---- Back with and without the back/forward cache: no replay, position kept ----
  for (const mode of BACK ? ['bfcache', 'no-bfcache'] : []) {
    const B = mode === 'no-bfcache' ? await launch(['--disable-back-forward-cache']) : await launch([], ['--disable-back-forward-cache']);
    try {
      const { page, errors } = await newPage(B.ctx);
      await page.goto(URL_, { waitUntil: 'load' });
      await page.waitForFunction(() => window.__heroDraw && window.__heroDraw.state === 'done', null, { timeout: 20000, polling: 100 }).catch(() => {});
      const first = await page.evaluate(() => ({ linesAt: window.__heroDraw && window.__heroDraw.linesAt, t: performance.timeOrigin }));
      await page.evaluate(() => scrollTo({ top: 700, behavior: 'instant' }));
      await page.waitForTimeout(300);
      await page.goto(new URL('case-study.html?project=steering', URL_).href, { waitUntil: 'load' });
      await page.waitForTimeout(600);
      await page.goBack({ waitUntil: 'commit' });   // a bfcache restore fires pageshow, not load
      await page.waitForTimeout(1500);
      const r = await page.evaluate((f) => {
        const s = window.__heroDraw;
        return { persisted: !!window.__persisted, sameDocument: performance.timeOrigin === f.t, nav: (performance.getEntriesByType('navigation')[0] || {}).type, heroDraw: s ? { state: s.state, linesAt: s.linesAt } : null,
          replayed: !!(s && s.linesAt != null && (performance.timeOrigin !== f.t || s.linesAt !== f.linesAt)), nodes: document.querySelectorAll('.hero-draw-lines, .hero-draw-veil, #hero-pen-data').length,
          canvases: document.querySelectorAll('.hero-draw-lines canvas').length, htmlClass: document.documentElement.className, scrollY };
      }, first);
      r.mode = mode;
      r.errors = errors;
      r.ok = !r.replayed && r.nodes === 0 && Math.abs(r.scrollY - 700) <= 2 && (mode === 'bfcache' ? r.persisted : !r.persisted);
      report.back.push(r);
      console.log(TAG, 'back', JSON.stringify(r));
    } finally { await B.close(); }
  }
  // ---- revision 6 (--nav 1): the R1 arrival rules on the R1 page (HEAD 9af034df guard and kw-scroll) ----
  // a #link other than #top does not draw; its reload drops the fragment, lands at the top and draws; #top draws; the
  // wordmark from a detail page is a held view-transition arrival (__vtBoot.hold) and draws
  report.nav = [];
  if (+opt('nav', 0)) {
    const B = await launch();
    try {
      const { page, errors } = await newPage(B.ctx);
      const state = () => page.evaluate(() => {
        const s = window.__heroDraw;
        return { nav: (performance.getEntriesByType('navigation')[0] || {}).type, hash: location.hash, y: Math.round(scrollY), hold: window.__vtBoot ? window.__vtBoot.hold : null,
          hd: s ? { state: s.state, linesAt: s.linesAt, settledBy: s.settledBy || null, skipped: s.skipped || null, error: s.error || null } : null };
      });
      const done = () => page.waitForFunction(() => !window.__heroDraw || window.__heroDraw.state === 'done', null, { timeout: 20000, polling: 100 }).catch(() => {});
      const drew = (r) => !!(r.hd && r.hd.linesAt != null && r.hd.state === 'done' && !r.hd.settledBy && !r.hd.skipped && !r.hd.error);
      const step = async (name, want, go) => {
        await go();
        await page.waitForTimeout(400);
        await done();
        const r = await state();
        r.name = name; r.drew = drew(r); r.want = want;
        // the wordmark makes a held arrival only where page-transitions holds one (at 390 it did not: hold ""); the step
        // passes when it draws either way, and verdict.navHeld says whether a held arrival was seen
        r.ok = r.drew === want && (name !== '#contact reload' || (r.hash === '' && r.y === 0 && r.nav === 'reload'));
        report.nav.push(r);
        console.log(TAG, 'nav', JSON.stringify(r));
      };
      await step('#contact', false, async () => { await page.goto('about:blank'); await page.goto(URL_.replace(/#.*$/, '') + '#contact', { waitUntil: 'load' }); });
      await step('#contact reload', true, () => page.reload({ waitUntil: 'load' }));
      await step('#top', true, async () => { await page.goto('about:blank'); await page.goto(URL_.replace(/#.*$/, '') + '#top', { waitUntil: 'load' }); });
      await step('wordmark (held arrival)', true, async () => {
        await page.goto(new URL('case-study.html?project=steering', URL_).href, { waitUntil: 'load' });
        await page.waitForTimeout(1500);
        await page.click('.wordmark');
        await page.waitForURL(/\/index\.html$/, { timeout: 10000 });
      });
      report.navErrors = errors.slice();
    } finally { await B.close(); }
  }
  // ---- resize while drawing: same class re-lays out and keeps drawing; a class change settles ----
  report.resize = [];
  for (const mode of +opt('resize', 0) ? ['same-class', 'class-change'] : []) {
    const B = await launch();
    try {
      const { page, errors } = await newPage(B.ctx);
      await page.goto(URL_, { waitUntil: 'load' });
      await page.waitForFunction(() => window.__heroDraw && window.__heroDraw.penT >= 1500, null, { timeout: 15000, polling: 'raf' });
      const w2 = mode === 'same-class' ? (W >= 1280 ? Math.max(1280, W - 60) : W >= 768 ? W - 30 : W - 20) : (W >= 1280 ? 1000 : W >= 768 ? 700 : 800);
      const at = await page.evaluate(() => [performance.now(), window.__heroDraw.penT, window.__heroDraw.cls]);
      await page.setViewportSize({ width: w2, height: H });
      await page.waitForFunction(() => window.__heroDraw.state === 'done', null, { timeout: 15000, polling: 100 }).catch(() => {});
      const r = await summary(page);
      const after = r.log.filter((x) => x[0] > at[0]);
      const res = { mode, from: W, to: w2, clsBefore: at[2], penTAtResize: at[1], state: r.state, settledBy: r.settledBy, framesAfter: after.length, skipped: r.skipped, error: r.error, errors, endStateOk: r.nodes === 0 && r.htmlClass === 'js',
        traceAfter: traceCheck(after, r.lastInk, at[0]) };
      res.ok = res.state === 'done' && res.endStateOk && !res.error && !errors.length && (mode === 'same-class' ? !res.settledBy && res.framesAfter > 10 && !res.traceAfter.penBack : res.settledBy === 'class-change');
      report.resize.push(res);
      console.log(TAG, 'resize', JSON.stringify(res));
    } finally { await B.close(); }
  }
  // ---- start rule 3: the car box under half on screen at t0 -> 300 ms quick reveal, no lines ----
  report.fold = [];
  for (const mode of +opt('fold', 0) ? ['scrolled', 'short'] : []) {
    const H2 = mode === 'short' ? +opt('fold-h', MOBILE ? 300 : 360) : H;
    const B = await launch();
    try {
      const { page, errors } = await newPage(B.ctx);
      if (mode === 'short') await page.setViewportSize({ width: W, height: H2 });
      else await page.addInitScript(() => addEventListener('DOMContentLoaded', () => {
        // scroll (not a wheel or key: scroll is not intent) so the hero photo's lower part is above the viewport
        // the car box mapped as the engine maps it (object-fit: cover, object-position), its lower quarter at the top edge
        const bg = document.querySelector('.white-home .cinematic-hero .hero-photo-background');
        if (bg) {
          const r = bg.getBoundingClientRect(), sc = Math.max(r.width / 2200, r.height / 1238), ih = 1238 * sc;
          const op = getComputedStyle(bg).objectPosition.split(' ')[1] || '50%', oy = op.slice(-1) === '%' ? ((r.height - ih) * parseFloat(op)) / 100 : parseFloat(op) || 0;
          const y0 = r.top + scrollY + oy + 430.7 * sc, y1 = r.top + scrollY + oy + 927.6 * sc;
          scrollTo({ top: Math.max(0, y0 + 0.75 * (y1 - y0)), behavior: 'instant' });
        }
        window.__foldY = scrollY;
      }, { once: true }));
      await page.goto(URL_, { waitUntil: 'load' });
      await page.waitForFunction(() => window.__heroDraw && window.__heroDraw.state === 'done', null, { timeout: 15000, polling: 50 }).catch(() => {});
      const r = await summary(page);
      const res = { mode, viewport: [W, H2], scrollY: r.scrollY, state: r.state, quick: r.quick, settledBy: r.settledBy, linesAt: r.linesAt, penFrames: r.log.length,
        doneMsAfterT0: r.t0 != null && r.doneAt != null ? +(r.doneAt - r.t0).toFixed(1) : null, endStateOk: r.nodes === 0 && r.htmlClass === 'js' && r.penAttr == null, errors: r.errors || errors };
      res.ok = res.state === 'done' && res.quick != null && res.quick < 0.5 && res.settledBy === 'quick' && res.linesAt == null && res.penFrames === 0 && res.doneMsAfterT0 != null && res.doneMsAfterT0 <= 450 && res.endStateOk && !errors.length;
      report.fold.push(res);
      console.log(TAG, 'fold', JSON.stringify(res));
    } finally { await B.close(); }
  }
  // ---- verdict ----
  const L = report.loads, hashes = [...new Set(L.map((r) => r.hash))];
  report.verdict = {
    loads: L.length,
    drew: L.filter((r) => r.drew).length,
    endStateOk: L.filter((r) => r.endStateOk).length,
    sameHash: hashes.length === 1, hashes,
    scheduleSequential: !!(report.schedule && report.schedule.sequential && report.schedule.phaseOrder),
    floorsOk: !!(report.schedule && !report.schedule.floorViolations.length && !report.schedule.peakViolations.length),
    windowsOk: !!(report.schedule && !report.schedule.windows.overEndCap && !report.schedule.windows.overInk040 && !report.schedule.windows.localityOver025),
    traceOk: L.every((r) => !r.trace.penBack && !r.trace.notContiguous && !r.trace.inkAfterLastInk),
    pixelsMonotonic: L.every((r) => r.pixels.inkedDecreases === 0),
    ghostRetired: L.every((r) => r.ghost && r.ghost.guideOutsideAfterRetire === 0 && r.ghost.guideDropped.length === (r.gr || []).filter((t) => t >= 0).length && r.ghost.guideDropped.every((x) => x && x[1] < x[0])),
    payoffLast: !!(report.schedule && (report.schedule.lastTier === 'n' || report.schedule.lastTier === 'd')), phaseRuns: report.schedule ? report.schedule.phaseRuns.join('') : null,
    pixelsOutside: L.reduce((a, r) => a + r.pixels.outsideTotal, 0),
    pixelSamplesPerLoad: L.map((r) => r.pixels.samples),
    // revision 3: the "dev" sample is the finished drawing in the 100 ms hold after last ink (finalSampled), not the
    // develop start; the develop start is >= 100 ms after last ink on every load that drew
    // revision 4 (E6): the verdicts compare with 1 device px tolerance (frac1); the exact comparison stays on record
    // wall-clock samples: on record only since revision 5 (frame-chunk effects); the verdict is vclockOk
    // revision 6 (main loop): the wall-clock pixel-repeat verdicts are dropped; the samples stay on record (frac, frac1)
    devPixelDiff: diffs,
    rev4Ok: !!(report.schedule && report.schedule.rev4 && !report.schedule.rev4.violations.length),
    rev5Ok: !!(report.schedule && report.schedule.rev5 && !report.schedule.rev5.violations.length),
    // revision 5 (E6): determinism is judged at identical pen times on the virtual frame clock: every load draws, the
    // same schedule hash, the same sample pen times, and every sample's three layer hashes identical
    vclockOk: !!(report.vclock && report.vclock.loads.length === VLOADS && report.vclock.loads.every((r) => r.drew && r.hash === report.vclock.loads[0].hash && !r.errors.length)
      && report.vclock.compare.every((c) => c.samePenT && c.sameHash)),
    vclockLoads: report.vclock ? report.vclock.loads.length : 0,
    finalSampled: L.filter((r) => r.finalSampled).length,
    devAfterLastInkMs: L.map((r) => r.devAfterLastInk), devAfterLastInkOk: L.filter((r) => r.drew).every((r) => r.devAfterLastInk != null && r.devAfterLastInk >= 100 - 1e-6),
    p2LongOk: !!(report.schedule && report.schedule.p2Long && !report.schedule.p2Long.violations.length),
    liftPixelDiff: liftDiffs,
    firstInkAfterT0Ms: L.map((r) => r.trace.firstInkAfterT0Ms),
    t0AfterFcpMs: L.map((r) => (r.t0 != null && r.fcp != null ? +(r.t0 - r.fcp).toFixed(0) : null)),
    rafGapsOver50InP0P1: L.map((r) => r.trace.rafGapsOver50P0P1), maxRafGapP0P1Ms: L.map((r) => r.trace.maxRafGapP0P1Ms),
    errors: L.reduce((a, r) => a + r.errors.length, 0), overflowX: L.some((r) => r.overflowX),
    inputOk: report.input.every((r) => r.ok) && report.input.length === INPUTS,
    backOk: report.back.every((r) => r.ok),
    resizeOk: report.resize.every((r) => r.ok),
    glyphRulesOk: !!(report.schedule && report.schedule.glyphRules && !report.schedule.glyphRules.violations.length),
    p0Ms: report.schedule ? report.schedule.p0Ms : null,
    foldOk: report.fold.every((r) => r.ok), foldRuns: report.fold.length,
    navOk: report.nav.every((r) => r.ok) && !(report.navErrors || []).length, navRuns: report.nav.length,
    navHeld: report.nav.length ? report.nav.some((r) => r.name === 'wordmark (held arrival)' && r.hold === 'parsed' && r.drew) : null,
    wallSeconds: Math.round((Date.now() - t00) / 1000),
  };
  { const v = report.verdict, need = ['scheduleSequential', 'floorsOk', 'windowsOk', 'traceOk', 'pixelsMonotonic', 'ghostRetired', 'payoffLast', 'rev4Ok', 'rev5Ok', 'vclockOk', 'devAfterLastInkOk', 'p2LongOk', 'glyphRulesOk', 'inputOk', 'backOk', 'resizeOk', 'foldOk', 'navOk', 'sameHash'];
    v.failed = need.filter((k) => !v[k]).concat(v.drew === v.loads ? [] : ['drew']).concat(v.endStateOk === v.loads ? [] : ['endStateOk']).concat(v.pixelsOutside ? ['pixelsOutside'] : []).concat(v.errors ? ['errors'] : []).concat(v.overflowX ? ['overflowX'] : []);
    v.pass = !v.failed.length; }
  fs.writeFileSync(path.join(OUT, `checks-${TAG}.json`), JSON.stringify(report, null, 1));
  console.log(TAG, 'VERDICT', JSON.stringify(report.verdict));
})().catch((e) => { console.error(e); process.exit(1); });
