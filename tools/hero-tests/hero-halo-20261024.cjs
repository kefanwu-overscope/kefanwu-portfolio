// Hero tagline halo regression check (aesthetic batch 1, #2 step 1 item 3).
//
// The white halo behind .hero-copy (white-home-20261011.css) must keep the tagline
// readable without washing out the car. For each viewport this check asserts:
//   1. Car lift (721px and wider): no dark photo pixel (luma < 110 in a no-halo capture)
//      is lifted by more than 20 levels by the halo box (.hero-copy::before). Phones are
//      reported only: there the tagline sits on the asphalt by design (10-22 layout).
//   2. Glyph contrast: for every word, the background in a 1-3 px ring around the
//      glyph strokes (text fill hidden, halo and text-shadow kept) is at least 4.5:1
//      against the text colour. Measured per glyph, not per line box, so a last glyph
//      on the halo's feather edge fails.
//   3. No horizontal page overflow and no console errors.
// refresh-20261120: .hero-copy is now the copy block that holds the imprint ("Leading 30
// mechanical engineers" / "Mechanical Lead · Olin Electric Motorsports") and the tagline, so each
// word is measured against its own text colour (ink, muted or body) and the glyphs are hidden on
// every descendant. The thresholds are unchanged.
//
// Usage (no npm install; uses the Playwright that ships with the local Codex runtime):
//   node tools/hero-tests/hero-halo-20261024.cjs [--base http://localhost:4173/] [--out <dir>] [--viewports '[[820,1180]]']
// Set PLAYWRIGHT_MODULE to point at another Playwright install. Exit code 1 on failure.
const path = require('path');
const fs = require('fs');

const PLAYWRIGHT = process.env.PLAYWRIGHT_MODULE
  || 'C:/Users/oc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright';
const { chromium } = require(PLAYWRIGHT);

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const BASE = arg('base', 'http://localhost:4173/');
const OUT = arg('out', '');
// Required: 721/768/820/834/912/950/1024x768/1024x1366/1100. The rest cover the
// phone layout, the 721-767 band, the 901-1000 band and laptops.
const VIEWPORTS = JSON.parse(arg('viewports', JSON.stringify([
  [320, 640], [390, 844], [430, 932],
  [721, 1000], [732, 1000], [740, 1000], [744, 1133], [768, 1024], [790, 1100], [819, 1000],
  [820, 900], [820, 1180], [834, 1194], [901, 1200], [912, 1368], [950, 1300], [960, 1200], [980, 1300],
  [1024, 768], [1024, 1366], [1100, 850], [940, 700], [1140, 900], [1180, 820], [1200, 1200], [1279, 900],
  [1280, 800], [1280, 1024], [1366, 1024], [1440, 900], [1440, 1200], [1920, 1080],
])));
const DARK_LUMA = 110;
const MAX_LIFT = 20;
const MIN_CONTRAST = 4.5;

(async () => {
  if (OUT) fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--use-angle=d3d11'] })
    .catch(() => chromium.launch({ headless: true, args: ['--use-angle=swiftshader'] }));
  const analyser = await (await browser.newContext()).newPage();
  const results = {};
  let failures = 0;
  for (const [w, h] of VIEWPORTS) {
    const tag = `${w}x${h}`;
    const mobile = w < 721;
    const errors = [];
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: mobile, isMobile: mobile });
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`${BASE}${BASE.includes('?') ? '&' : '?'}halo=${Date.now()}`, { waitUntil: 'load' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.evaluate(() => Promise.all([...document.querySelectorAll('.hero-media img')].map((i) => i.decode().catch(() => {}))));
    await page.waitForTimeout(2400);
    await page.addStyleTag({ content: '.hero-skill-track{animation:none!important}*{transition:none!important}' });
    await page.waitForTimeout(150);
    const info = await page.evaluate(() => {
      const copy = document.querySelector('.hero-copy');
      const words = [];
      const walker = document.createTreeWalker(copy, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        const re = /\S+/g; let m;
        while ((m = re.exec(node.data))) {
          const r = document.createRange(); r.setStart(node, m.index); r.setEnd(node, m.index + m[0].length);
          const q = r.getBoundingClientRect();
          words.push({ w: m[0], box: [q.left, q.top, q.right, q.bottom], color: getComputedStyle(node.parentElement).color });
        }
      }
      const lines = [];
      for (const wd of words) {
        const l = lines[lines.length - 1];
        if (l && Math.abs(l.top - wd.box[1]) < 4) { l.text += ` ${wd.w}`; l.right = Math.max(l.right, wd.box[2]); } else lines.push({ top: wd.box[1], text: wd.w, right: wd.box[2] });
      }
      const c = copy.getBoundingClientRect();
      return {
        words, lines: lines.map((l) => ({ text: l.text, right: Math.round(l.right) })),
        color: getComputedStyle(copy).color, copy: [c.left, c.top, c.right, c.bottom],
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    if (OUT) await page.screenshot({ path: path.join(OUT, `${tag}-fold.png`) });
    const shot = async () => (await page.screenshot()).toString('base64');
    const D = await shot();
    await page.addStyleTag({ content: '.white-home .hero-copy,.white-home .hero-copy *{color:transparent!important}' });
    await page.waitForTimeout(80);
    const A = await shot(); // background behind the glyphs: halo box + glyph text-shadow
    await page.addStyleTag({ content: '.white-home .hero-copy{text-shadow:none!important}' });
    await page.waitForTimeout(80);
    const B = await shot(); // halo box only
    await page.addStyleTag({ content: '.white-home .hero-copy::before{display:none!important}' });
    await page.waitForTimeout(80);
    const C = await shot(); // no halo
    const m = await analyser.evaluate(async ({ D, A, B, C, words, color, copy, DARK_LUMA, MAX_LIFT, MIN_CONTRAST }) => {
      const load = async (s) => {
        const im = new Image(); im.src = `data:image/png;base64,${s}`; await im.decode();
        const cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height;
        const g = cv.getContext('2d'); g.drawImage(im, 0, 0); return g.getImageData(0, 0, cv.width, cv.height);
      };
      const [d, a, b, c] = await Promise.all([load(D), load(A), load(B), load(C)]);
      const W = d.width, H = d.height;
      const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
      const L = (x, i) => 0.2126 * lin(x[i]) + 0.7152 * lin(x[i + 1]) + 0.0722 * lin(x[i + 2]);
      const luma = (x, i) => 0.2126 * x[i] + 0.7152 * x[i + 1] + 0.0722 * x[i + 2];
      const lum = (c) => { const [tr, tg, tb] = c.match(/\d+/g).map(Number); return 0.2126 * lin(tr) + 0.7152 * lin(tg) + 0.0722 * lin(tb); };
      const contrast = words.map((wd) => {
        const Lt = lum(wd.color || color);
        const ratio = (v) => (v + 0.05) / (Lt + 0.05);
        const x0 = Math.floor(wd.box[0]) - 3, y0 = Math.floor(wd.box[1]), x1 = Math.ceil(wd.box[2]) + 3, y1 = Math.ceil(wd.box[3]);
        const glyph = new Set();
        for (let y = Math.max(0, y0); y < Math.min(H, y1); y++) for (let x = Math.max(0, x0); x < Math.min(W, x1); x++) {
          const i = (y * W + x) * 4; if (L(a.data, i) - L(d.data, i) > 0.08) glyph.add(y * W + x);
        }
        const ring = new Set();
        for (const p of glyph) {
          const gx = p % W, gy = (p / W) | 0;
          for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
            const x = gx + dx, y = gy + dy, q = y * W + x;
            if (x >= 0 && x < W && y >= 0 && y < H && !glyph.has(q)) ring.add(q);
          }
        }
        const ls = [...ring].map((q) => L(a.data, q * 4)).sort((p, q) => p - q);
        const under = ls.filter((v) => ratio(v) < MIN_CONTRAST).length;
        return { w: wd.w, min: +ratio(ls[0] ?? 1).toFixed(2), p02: +ratio(ls[Math.floor(ls.length * 0.02)] ?? 1).toFixed(2), under45: under, ring: ls.length };
      });
      const lift = (top) => {
        let dark = 0, over = 0, max = 0;
        const X0 = Math.max(0, Math.floor(copy[0] - 80)), X1 = Math.min(W, Math.ceil(copy[2] + 80));
        const Y0 = Math.max(0, Math.floor(copy[1] - 60)), Y1 = Math.min(H, Math.ceil(copy[3] + 60));
        for (let y = Y0; y < Y1; y++) for (let x = X0; x < X1; x++) {
          const i = (y * W + x) * 4; const base = luma(c.data, i);
          if (base >= DARK_LUMA) continue;
          dark++; const up = luma(top.data, i) - base;
          if (up > MAX_LIFT) over++; if (up > max) max = up;
        }
        return { dark, over20: over, maxLift: Math.round(max) };
      };
      const worst = contrast.reduce((p, q) => (q.min < p.min ? q : p), contrast[0]);
      return { contrast, worst, liftBox: lift(b), liftAll: lift(a) };
    }, { D, A, B, C, words: info.words, color: info.color, copy: info.copy, DARK_LUMA, MAX_LIFT, MIN_CONTRAST });
    const problems = [];
    if (w >= 721 && m.liftBox.over20 > 0) problems.push(`halo lifts ${m.liftBox.over20} dark car pixels by >${MAX_LIFT} (max ${m.liftBox.maxLift})`);
    for (const c of m.contrast) if (c.min < MIN_CONTRAST) problems.push(`"${c.w}" glyph-ring contrast ${c.min} < ${MIN_CONTRAST} (${c.under45}/${c.ring} px)`);
    if (info.overflowX > 0) problems.push(`horizontal overflow ${info.overflowX}px`);
    if (errors.length) problems.push(`${errors.length} console errors`);
    failures += problems.length ? 1 : 0;
    results[tag] = { lines: info.lines, overflowX: info.overflowX, errors, ...m, problems };
    console.log(`${problems.length ? 'FAIL' : 'ok  '} ${tag.padEnd(10)} lines=${JSON.stringify(info.lines.map((l) => l.text))} lift>20=${m.liftBox.over20} (max ${m.liftBox.maxLift}; incl. text-shadow ${m.liftAll.over20}) worst="${m.worst.w}" ${m.worst.min}${problems.length ? `\n     ${problems.join('\n     ')}` : ''}`);
    await ctx.close();
  }
  if (OUT) fs.writeFileSync(path.join(OUT, 'hero-halo.json'), JSON.stringify(results, null, 1));
  await browser.close();
  console.log(failures ? `${failures}/${VIEWPORTS.length} viewports failed` : `all ${VIEWPORTS.length} viewports passed`);
  process.exit(failures ? 1 : 0);
})();
