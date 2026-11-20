// Hero line drawing: the drawing must stay out of the page's paint until the first contentful
// paint has been reported (found 2026-11-04 with the SVG drawing of hero-drawing-20261027.js, whose
// first GPU raster in a browser with an empty shader cache took about 100-150 ms and delayed the first
// paint). pen-20261110: the inline hero pen (index.html, script#hero-pen-data and the engine after it;
// PEN_SPEC 10.2) keeps the hold: its first ink waits for the paint report (1.5 s at most) and the load
// event + 140 ms (300 ms at most after that).
//
//   node --test tools/hero-tests/hero-first-paint.test.cjs
//   (Playwright with Chrome; set PLAYWRIGHT_MODULE to its folder if it is not resolvable as
//   "playwright", HERO_TEST_PORT to choose the local server's port. Without Playwright it is skipped.)
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const http = require("http");
const path = require("path");

const SITE = path.resolve(__dirname, "../..");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".woff2": "font/woff2", ".jpg": "image/jpeg" };
let chromium = null;
try { ({ chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright")); } catch (e) { /* skipped below */ }

// Logs when the drawing loses its hidden attribute, and whether the paint report existed by then.
const WATCH = `(() => {
  const log = window.__lines = { unhiddenAt: -1, fcpKnown: null };
  new MutationObserver(() => {
    const el = document.querySelector(".hero-draw-lines");
    if (el && !el.hidden && log.unhiddenAt < 0) {
      log.unhiddenAt = Math.round(performance.now());
      log.fcpKnown = performance.getEntriesByName("first-contentful-paint").length > 0;
    }
  }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ["hidden"] });
})();`;

async function visit(browser, base, opts, init) {
  const ctx = await browser.newContext(opts);
  await ctx.addInitScript(WATCH);
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${base}/index.html?hero=draw`, { waitUntil: "load" });
  await page.waitForFunction(() => window.__heroDraw && window.__heroDraw.state === "done", null, { timeout: 15000 });
  const r = await page.evaluate(() => ({
    lines: window.__lines,
    hero: (({ geo, carSrc, ...rest }) => rest)(window.__heroDraw),
    fcp: (performance.getEntriesByName("first-contentful-paint")[0] || {}).startTime,
    nodes: document.querySelectorAll(".hero-draw-veil, .hero-draw-lines").length,
    cls: document.documentElement.className,
  }));
  await ctx.close();
  return { ...r, errors };
}

test("first-paint hold", { skip: !chromium && "Playwright not found (set PLAYWRIGHT_MODULE)" }, async (t) => {
  const server = http.createServer((req, res) => {
    const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    const file = path.join(SITE, p);
    if (!file.startsWith(SITE) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream", "cache-control": "no-store" });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((resolve) => server.listen(Number(process.env.HERO_TEST_PORT || 0), "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || "chrome" });
  const desktop = { viewport: { width: 1440, height: 900 } };
  const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true };
  try {
    for (const [name, opts] of [["1440", desktop], ["390", phone]]) {
      await t.test(`${name}: the lines join the page only after the paint report, then play to the end state`, async () => {
        const r = await visit(browser, base, opts);
        assert.deepEqual(r.errors, []);
        assert.ok(r.lines.unhiddenAt > 0, "the lines were never shown");
        assert.equal(r.lines.fcpKnown, true, `unhidden at ${r.lines.unhiddenAt} ms, before the paint report (FCP ${r.fcp})`);
        assert.ok(r.hero.t0 >= r.fcp - 1, `timeline t0 ${r.hero.t0} is before FCP ${r.fcp}`);
        // Development (pen clock, PEN_SPEC 8 and 13): 100 ms after the class's last ink, at the latest after the
        // 1.8 s decode hold: [lastInk - 170, lastInk + 1850].
        assert.ok(r.hero.lastInk > 0, `lastInk ${r.hero.lastInk}`);
        assert.ok(r.hero.devStart >= r.hero.lastInk - 170 && r.hero.devStart <= r.hero.lastInk + 1850, `devStart ${r.hero.devStart}, lastInk ${r.hero.lastInk} (${r.hero.cls})`);
        assert.equal(r.nodes, 0);
        assert.equal(r.cls, "js");
      });
    }
    await t.test("a paint report that never arrives: the hold expires and the sequence still ends", async () => {
      const r = await visit(browser, base, desktop, `(() => { const o = PerformanceObserver.prototype.observe; PerformanceObserver.prototype.observe = function (a) { if (a && a.type === "paint") return; return o.call(this, a); }; })();`);
      assert.deepEqual(r.errors, []);
      assert.ok(r.hero.linesAt >= 1000 && r.hero.linesAt < 4000, `lines at ${r.hero.linesAt}`);
      assert.equal(r.nodes, 0);
    });
    await t.test("no paint timing at all: no hold", async () => {
      const r = await visit(browser, base, desktop, `Object.defineProperty(PerformanceObserver, "supportedEntryTypes", { value: ["longtask"] });`);
      assert.deepEqual(r.errors, []);
      assert.ok(r.lines.unhiddenAt > 0);
      assert.equal(r.nodes, 0);
    });
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
});
