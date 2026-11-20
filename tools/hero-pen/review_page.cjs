#!/usr/bin/env node
// Review render of the hero pen art on the real homepage layout (headless Chrome, Playwright).
// Loads a test copy of the committed index.html (?draw=off, so today's drawing stays off) from a
// throwaway local server, maps the photo's object-fit/object-position exactly as the page lays it
// out, and paints out/strokes.json for the viewport's class on a canvas over the hero:
//   alone  the photo layers hidden: the drawing on white, at PEN_SPEC section 7 weights and colours
//          (w1 from the viewport width, device-pixel floor by mixing toward white, lighter tiers under
//          darker ones), no taper and no animation;
//   over   the same strokes over the photo;
//   lettering (class D cases only): the side plate and the lettering crop, alone at the page weights
//          and again with every glyph stroke at a flat 2.0 CSS px (the lettering gate).
// Screenshots are cropped to the car box (lettering: src box 1228-1512 x 640-790). It changes nothing in the repo.
// usage: node review_page.cjs <baseUrl> <strokes.json> <outDir> [playwrightPath]
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const [base, strokesPath, outDir, pwPath] = process.argv.slice(2);
const { chromium } = require(pwPath || 'playwright');

const FACTOR = { g: 0.36, c: 0.95, y: 1.05, a: 1.40, n: 0.80, f: 0.62, d: 0.42, h: 0.30 };
const COLOR = { g: '#a9b1ba', c: '#111316', y: '#111316', a: '#111316', n: '#111316', f: '#2a3036', d: '#505b66', h: '#7b848d' };
const RANK = { g: 0, h: 1, d: 2, f: 3, n: 4, c: 5, y: 5, a: 6 };
const CASES = [
  { name: '1440', w: 1440, h: 900, dpr: 2, cls: 'D' },
  { name: '1440r1', w: 1440, h: 900, dpr: 1, cls: 'D' },
  { name: '1280', w: 1280, h: 800, dpr: 1, cls: 'D' },
  { name: '768', w: 768, h: 1024, dpr: 2, cls: 'T' },
  { name: '390', w: 390, h: 844, dpr: 3, cls: 'P' },
];

(async () => {
  const doc = JSON.parse(fs.readFileSync(strokesPath, 'utf8'));
  // chromium.launch gives a fresh temporary profile; one context per case carries its real device scale
  // factor, so DPR 2 and 3 screenshots are captured at device resolution (2026-11-07 revision 1: the
  // earlier CDP override left the screenshots at CSS resolution).
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--use-angle=d3d11'] });
  const report = [];
  try {
    for (const c of CASES) {
      const ctx = await browser.newContext({ viewport: { width: c.w, height: c.h }, deviceScaleFactor: c.dpr, isMobile: c.w < 768, hasTouch: c.w < 768 });
      const page = await ctx.newPage();
      await page.goto(base + '/index.html?draw=off', { waitUntil: 'load' });
      await page.waitForTimeout(600);
      // revision 5: the P5 accents are left out (the engine's build drops them at every class by default);
      // HERO_PEN_ACCENTS=1 draws them as before
      const strokes = doc.strokes.filter((s) => s.classes.includes(c.cls) && (process.env.HERO_PEN_ACCENTS === '1' || s.kind !== 'accent'))
        .map((s) => ({ tier: s.tier, pts: s.pts, glyph: s.kind === 'glyph' }));
      for (const mode of c.cls === 'D' ? ['alone', 'over', 'letters', 'letters2px'] : ['alone', 'over']) {
        const info = await page.evaluate(({ strokes, FACTOR, COLOR, RANK, mode, dpr }) => {
          const img = document.querySelector('.hero-photo-background');
          const r = img.getBoundingClientRect();
          const cs = getComputedStyle(img);
          const [px, py] = cs.objectPosition.split(' ').map((v) => parseFloat(v) / 100);
          const s = Math.max(r.width / 2200, r.height / 1238);
          const ox = r.left + (r.width - 2200 * s) * px, oy = r.top + (r.height - 1238 * s) * py + scrollY;
          let cv = document.getElementById('pen-review');
          if (!cv) {
            cv = document.createElement('canvas'); cv.id = 'pen-review';
            Object.assign(cv.style, { position: 'absolute', left: '0px', top: '0px', zIndex: 50, pointerEvents: 'none' });
            document.body.appendChild(cv);
          }
          const W = document.documentElement.clientWidth, H = Math.ceil(r.bottom + scrollY);
          cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
          cv.style.width = W + 'px'; cv.style.height = H + 'px';
          const g = cv.getContext('2d');
          g.setTransform(dpr, 0, 0, dpr, 0, 0);
          g.clearRect(0, 0, W, H);
          if (mode !== 'over') { g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H); }
          const w1 = Math.min(2.1, Math.max(1.4, 1.4 + (W - 390) * 0.7 / 1050));
          const mix = (hex, a) => { const n = parseInt(hex.slice(1), 16); const ch = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (255 - v) * a)); return `rgb(${ch.join(',')})`; };
          g.lineCap = 'round'; g.lineJoin = 'round';
          const list = strokes.slice().sort((a, b) => RANK[a.tier] - RANK[b.tier]);
          for (const st of list) {
            let wcss = FACTOR[st.tier] * w1, col = COLOR[st.tier];
            const wd = wcss * dpr;
            if (wd < 1) { col = mix(col, 1 - wd); wcss = 1 / dpr; }
            if (mode === 'letters2px') { if (!st.glyph) continue; wcss = 2.0; col = '#111316'; }
            g.strokeStyle = col; g.lineWidth = wcss;
            g.beginPath();
            st.pts.forEach((p, i) => { const X = ox + p[0] * s, Y = oy + p[1] * s; if (i) g.lineTo(X, Y); else g.moveTo(X, Y); });
            g.stroke();
          }
          const car = [932, 430.7, 1758.5, 927.6];
          const lc = { x: ox + 1228 * s, y: oy + 640 * s, width: 284 * s, height: 150 * s };
          return { scale: s, carWidthCss: (car[2] - car[0]) * s, clip: mode.startsWith('letters') ? lc : { x: ox + 870 * s, y: oy + 395 * s, width: 920 * s, height: 565 * s }, w1 };
        }, { strokes, FACTOR, COLOR, RANK, mode, dpr: c.dpr });
        const clip = { x: Math.max(0, info.clip.x), y: Math.max(0, info.clip.y), width: Math.min(info.clip.width, c.w - Math.max(0, info.clip.x)), height: info.clip.height };
        const file = path.join(outDir, `page-${mode}-${c.name}-${c.cls}.png`);
        await page.screenshot({ path: file, clip, fullPage: true });
        report.push({ case: c.name, cls: c.cls, mode, dpr: c.dpr, strokes: strokes.length, cssPerSrc: +info.scale.toFixed(4), carWidthCss: +info.carWidthCss.toFixed(1), w1: +info.w1.toFixed(3), file });
      }
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
  fs.writeFileSync(path.join(outDir, 'page-renders.json'), JSON.stringify(report, null, 1));
  console.log(JSON.stringify(report, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
