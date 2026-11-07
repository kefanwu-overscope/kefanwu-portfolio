// Evidence renders for the hero line drawing (assets/hero-drawing-20261027/hero-lines.svg).
//
// Renders in real Chrome so pathLength/dash/vector-effect behave as they will on the site:
//   lines-2200.png            strokes alone on white, photo pixel scale
//   overlay-2200.png          strokes over the photo at 50 % (registration check)
//   overlay-zoom-<part>.png   3x crops: front wheel, rear wheel, helmet, nose tip
//   viewport-<w>x<h>-lines.png / -photo.png
//                              the live homepage at 390x844 and 1440x900 with the strokes
//                              placed exactly like the hero photo (same object-fit / position);
//                              "-lines" hides the photo layers (the drawn state)
//   frames/<set>/*.png        frames of the draw-in animation (by data-o), for assemble_webp.py
//
// The page and its CSS are read from this repo through a throwaway local static server; nothing
// in the site is modified.
//
// Usage (no npm install; point PLAYWRIGHT_MODULE at any Playwright install):
//   node tools/hero-drawing/render_evidence.cjs --out <dir> [--svg <file>] [--no-viewports] [--no-frames]
const fs = require('fs');
const path = require('path');
const http = require('http');

const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const ROOT = path.resolve(__dirname, '..', '..');
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : fallback;
};
const flag = (name) => process.argv.includes(`--${name}`);
const OUT = path.resolve(arg('out', 'hero-drawing-evidence'));
const SVG_FILE = path.resolve(arg('svg', path.join(ROOT, 'assets/hero-drawing-20261027/hero-lines.svg')));
const PHOTO = 'assets/hero-fsae-track-2200.webp';
// Recommended stroke width (px) of a data-w = 1.0 path; others scale by data-w.
const BASE_W = { 2200: 2.6, 1440: 1.75, 390: 1.25 };

const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json',
  '.woff2': 'font/woff2', '.pdf': 'application/pdf', '.ico': 'image/x-icon', '.gz': 'application/gzip', '.glb': 'model/gltf-binary' };

function serve() {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    if (url === '/favicon.ico') { res.writeHead(204); return res.end(); }
    if (url === '/__blank') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end('<!doctype html><title>blank</title>'); }
    const file = url === '/__lines.svg' ? SVG_FILE : path.join(ROOT, url === '/' ? 'index.html' : url);
    if (!file.startsWith(ROOT) && file !== SVG_FILE) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      res.end(buf);
    });
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server)));
}

// Inline the drawing into a page; set per-path widths from data-w; optional draw progress.
const SETUP = `(async ({ base, colour }) => {
  const txt = await (await fetch('/__lines.svg')).text();
  const host = document.createElement('div');
  host.innerHTML = txt;
  const svg = host.querySelector('svg');
  svg.style.color = colour;
  svg.querySelectorAll('path').forEach((p) => { p.style.strokeWidth = (base * parseFloat(p.dataset.w)) + 'px'; });
  return svg;
})`;

let PORT = 0;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const server = await serve();
  PORT = server.address().port;
  const origin = `http://127.0.0.1:${PORT}`;
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
    .catch(() => chromium.launch({ headless: true }));
  const report = { svg: path.relative(ROOT, SVG_FILE).split(path.sep).join('/'), errors: [] };

  // 1-2: full-frame renders at photo scale
  for (const [name, photo, colour] of [['lines-2200', false, '#16181b'], ['overlay-2200', true, '#e0006f']]) {
    const ctx = await browser.newContext({ viewport: { width: 2200, height: 1238 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error') report.errors.push(`${name}: ${m.text()}`); });
    await page.goto(`${origin}/__blank`);
    await page.setContent(stageHtml(photo, 1), { waitUntil: 'load' });
    await injectDrawing(page, BASE_W[2200] * (photo ? 0.8 : 1), colour, '#stage');
    await page.screenshot({ path: path.join(OUT, `${name}.png`) });
    await ctx.close();
  }
  // zoomed registration crops (3x)
  const zooms = { 'front-wheel': [1320, 730, 200, 220], 'rear-wheel': [1600, 640, 190, 190],
    helmet: [1360, 500, 150, 150], 'nose-tip': [900, 690, 170, 190] };
  {
    const ctx = await browser.newContext({ viewport: { width: 2200, height: 1238 }, deviceScaleFactor: 3 });
    const page = await ctx.newPage();
    await page.goto(`${origin}/__blank`);
    await page.setContent(stageHtml(true, 1), { waitUntil: 'load' });
    await injectDrawing(page, 1.6, '#e0006f', '#stage');
    for (const [name, [x, y, w, h]] of Object.entries(zooms)) {
      await page.screenshot({ path: path.join(OUT, `overlay-zoom-${name}.png`), clip: { x, y, width: w, height: h } });
    }
    await ctx.close();
  }

  // 3: the live homepage hero at phone and desktop sizes
  if (!flag('no-viewports')) {
    for (const [w, h] of [[390, 844], [1440, 900]]) {
      const mobile = w < 721;
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile });
      const page = await ctx.newPage();
      page.on('console', (m) => { if (m.type() === 'error') report.errors.push(`${w}x${h}: ${m.text()}`); });
      await page.goto(`${origin}/index.html`, { waitUntil: 'load' });
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.evaluate(() => Promise.all([...document.querySelectorAll('.hero-media img')].map((i) => i.decode().catch(() => {}))));
      const geom = await page.evaluate(async ([setup, base]) => {
        const img = document.querySelector('.hero-media .hero-photo-background');
        const media = img.parentElement;
        const cs = getComputedStyle(img);
        const box = img.getBoundingClientRect();
        const s = Math.max(box.width / 2200, box.height / 1238);
        const rw = 2200 * s, rh = 1238 * s;
        const [px, py] = cs.objectPosition.split(' ').map((v) => parseFloat(v) / 100);
        const ox = (box.width - rw) * px, oy = (box.height - rh) * py;
        const svg = await eval(setup)({ base, colour: '#16181b' });
        const clip = document.createElement('div');
        clip.id = 'lines-clip';
        clip.style.cssText = `position:absolute;left:${img.offsetLeft}px;top:${img.offsetTop}px;width:${box.width}px;height:${box.height}px;overflow:hidden;z-index:3;pointer-events:none`;
        svg.style.cssText += `;position:absolute;left:${ox}px;top:${oy}px;width:${rw}px;height:${rh}px`;
        clip.appendChild(svg);
        media.appendChild(clip);
        const r = (v) => Math.round(v * 10) / 10;
        return { box: [r(box.left), r(box.top + scrollY), r(box.width), r(box.height)], scale: r(s * 1000) / 1000,
          objectPosition: cs.objectPosition, imageRect: [r(ox), r(oy), r(rw), r(rh)],
          visibleSourceX: [r(-ox / s), r((box.width - ox) / s)], visibleSourceY: [r(-oy / s), r((box.height - oy) / s)] };
      }, [SETUP, BASE_W[w]]);
      report[`viewport-${w}x${h}`] = geom;
      await page.screenshot({ path: path.join(OUT, `viewport-${w}x${h}-photo.png`) });
      await page.addStyleTag({ content: '.hero-media img{visibility:hidden!important}.hero-media::after{opacity:0!important}' });
      await page.screenshot({ path: path.join(OUT, `viewport-${w}x${h}-lines.png`) });
      await ctx.close();
    }
  }

  // 4: animation frames (strokes draw in by data-o), assembled by assemble_webp.py
  if (!flag('no-frames')) {
    const sets = { car: { clip: [860, 380, 1000, 580], scale: 1, base: 2.4 }, full: { clip: [0, 0, 2200, 1238], scale: 0.5, base: 1.5 } };
    const FPS = 25, DRAW_MS = 2000, HOLD_MS = 600;
    for (const [name, set] of Object.entries(sets)) {
      const dir = path.join(OUT, 'frames', name);
      fs.rmSync(dir, { recursive: true, force: true });
      fs.mkdirSync(dir, { recursive: true });
      const ctx = await browser.newContext({ viewport: { width: 2200, height: 1238 }, deviceScaleFactor: set.scale });
      const page = await ctx.newPage();
      await page.goto(`${origin}/__blank`);
      await page.setContent(stageHtml(false, 1), { waitUntil: 'load' });
      await injectDrawing(page, set.base / set.scale, '#16181b', '#stage');
      // per path: start = data-o * (DRAW - longest), duration grows with sqrt(length)
      await page.evaluate((DRAW_MS) => {
        const paths = [...document.querySelectorAll('#stage svg path')];
        const lens = paths.map((p) => p.getTotalLength());
        const maxL = Math.max(...lens);
        paths.forEach((p, i) => {
          const dur = 220 + 480 * Math.sqrt(lens[i] / maxL);
          p.dataset.t0 = String(parseFloat(p.dataset.o) * (DRAW_MS - 700));
          p.dataset.dur = String(dur);
          p.style.strokeDasharray = '1 1';
        });
        window.__setTime = (t) => paths.forEach((p) => {
          const k = Math.min(1, Math.max(0, (t - p.dataset.t0) / p.dataset.dur));
          const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
          p.style.strokeDashoffset = String(1 - e);
        });
      }, DRAW_MS);
      const n = Math.round(DRAW_MS / 1000 * FPS);
      for (let f = 0; f <= n; f++) {
        await page.evaluate((t) => window.__setTime(t), (f / n) * DRAW_MS);
        const [x, y, w, h] = set.clip;
        await page.screenshot({ path: path.join(dir, `${String(f).padStart(3, '0')}.png`), clip: { x, y, width: w, height: h } });
      }
      fs.writeFileSync(path.join(dir, 'timing.json'), JSON.stringify({ fps: FPS, hold_ms: HOLD_MS, frames: n + 1 }));
      await ctx.close();
    }
  }

  fs.writeFileSync(path.join(OUT, 'render-report.json'), JSON.stringify(report, null, 1));
  await browser.close();
  server.close();
  console.log(JSON.stringify(report, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });

function stageHtml(photo, scale) {
  return `<!doctype html><html><head><style>
    html,body{margin:0;background:#fff;overflow:hidden}
    #stage{position:relative;width:2200px;height:1238px;transform-origin:0 0;transform:scale(${scale})}
    #stage img,#stage svg{position:absolute;left:0;top:0;width:2200px;height:1238px;display:block}
    #stage img{opacity:${photo ? 0.5 : 0}}
  </style></head><body><div id="stage"><img src="/${PHOTO}" alt=""></div></body></html>`;
}

async function injectDrawing(page, base, colour, host) {
  await page.evaluate(async ([setup, base, colour, host]) => {
    const svg = await eval(setup)({ base, colour });
    document.querySelector(host).appendChild(svg);
    await document.querySelector(`${host} img`).decode().catch(() => {});
  }, [SETUP, base, colour, host]);
}
