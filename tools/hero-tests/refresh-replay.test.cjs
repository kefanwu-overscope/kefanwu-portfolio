// Drafting merge build copy (2026-11-21): every played hero is also checked against the merge build (assertMergeBuild).
// refresh-20261107, "every refresh plays", in Chrome: the homepage hero and cards and the detail-page
// arrival play on every load and reload; Back/Forward stays quiet (with and without the back/forward
// cache) and the homepage keeps its place; a restored scroll position is not intent; a tab opened in the
// background arms when first shown; forced colors keep the detail cover; data saver keeps the cards; a
// slow first byte no longer costs the detail arrival; the studio's drawing has 20 s to start.
//
//   node --test tools/hero-tests/refresh-replay.test.cjs
//   (Playwright with Chrome: set PLAYWRIGHT_MODULE to its folder if it is not resolvable as "playwright",
//   REFRESH_TEST_PORT to choose the local server's port (default: HERO_TEST_PORT + 1, since node --test runs
//   hero-first-paint.test.cjs alongside on HERO_TEST_PORT; otherwise any free port), CHROME_PATH for the
//   raw background-tab checks.
//   Without Playwright it is skipped. About 2 minutes.)
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const http = require("http");
const path = require("path");
const { spawn } = require("child_process");

const SITE = path.resolve(__dirname, "../..");

// drafting merge build (2026-11-21): a played hero is this build's class (count, last ink, hash, three sequential lanes)
const MERGE = require(path.join(SITE, "tools/hero-pen/engine/build.cjs")).buildDrafting({ quiet: true, write: false }).out;   // the shipped set: the final line (out/final, its build options)
function assertMergeBuild(h, label) {
  assert.ok(h && ["D", "T", "P"].includes(h.cls), `${label}: a class`);
  assert.equal(h.n, MERGE.counts[h.cls].total, `${label}: ${h.cls} draws the merge build's ${MERGE.counts[h.cls].total} strokes`);
  assert.equal(h.lastInk, MERGE.timeline[h.cls].lastInk, `${label}: last ink`);
  assert.equal(h.hash, MERGE.hashes[h.cls], `${label}: hash`);
  assert.equal(h.pen.length, h.n);
  for (const pen of ["A", "B", "C", "X", "Y", "Z"]) {   // pens A-C and the final line's detail lanes
    const q = h.schedule.filter((_, i) => h.pen[i] === pen);
    for (let k = 1; k < q.length; k++) assert.ok(q[k][0] >= q[k - 1][0] + q[k - 1][1], `${label}: lane ${pen} sequential`);
  }
  assert.equal(h.pen.filter((p) => p === "C").length, MERGE.index.filter((e) => e[h.cls] && e.pen === "C").length, `${label}: lane C (lettering, numerals, cabin)`);
  assert.equal(h.pen.filter((p, i) => p === "C" && "lun".includes(h.tier[i])).length, h.cls === "D" ? 43 : 3, `${label}: the glyphs`);
}
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".woff2": "font/woff2", ".jpg": "image/jpeg", ".glb": "model/gltf-binary", ".gz": "application/gzip", ".pdf": "application/pdf" };
const ARGS = ["--ignore-gpu-blocklist", "--enable-gpu-rasterization", "--use-angle=d3d11"];
const CHROME = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
let chromium = null;
try { ({ chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright")); } catch (e) { /* skipped below */ }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DESKTOP = { viewport: { width: 1440, height: 900 } };
// REFRESH_ONLY=<part of a name> runs only the matching checks (for debugging one).
const sub = (t, name, ...rest) => (process.env.REFRESH_ONLY && !name.includes(process.env.REFRESH_ONLY) ? Promise.resolve() : t.test(name, ...rest));

// Per document: navigation type, pageshow, when html.hero-draw first appeared, data-hero-pen values.
const PROBE = `(() => {
  const log = window.__rr = { nav: (performance.getEntriesByType("navigation")[0] || {}).type, heroClassAt: null, pen: [], shows: [] };
  const seen = () => {
    const root = document.documentElement;
    if (!root) return;
    if (root.classList.contains("hero-draw") && log.heroClassAt === null) log.heroClassAt = Math.round(performance.now());
    const pen = root.getAttribute("data-hero-pen");
    if (pen !== null && log.pen[log.pen.length - 1] !== pen) log.pen.push(pen);
  };
  new MutationObserver(seen).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "data-hero-pen"] });
  addEventListener("pageshow", (e) => log.shows.push({ persisted: e.persisted, y: Math.round(scrollY) }));
})();`;

function startServer() {
  let htmlDelay = 0;
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, "http://x");
    let p = decodeURIComponent(u.pathname);
    if (p.endsWith("/")) p += "index.html";
    const file = path.join(SITE, p);
    const send = () => {
      if (!file.startsWith(SITE) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
      // no-cache, not no-store: a no-store document never enters the back/forward cache.
      res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream", "cache-control": "no-cache" });
      fs.createReadStream(file).pipe(res);
    };
    if (htmlDelay && /\.html$/.test(p)) setTimeout(send, htmlDelay); else send();
  });
  return new Promise((resolve) => server.listen(Number(process.env.REFRESH_TEST_PORT || (process.env.HERO_TEST_PORT ? Number(process.env.HERO_TEST_PORT) + 1 : 0)), "127.0.0.1", () => resolve({
    base: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((r) => server.close(r)), delay: (ms) => { htmlDelay = ms; },
  })));
}

const hero = (page) => page.evaluate(() => ({
  rr: window.__rr, state: window.__heroDraw && (({ geo, carSrc, ...r }) => r)(window.__heroDraw),
  cls: document.documentElement.className, pen: document.documentElement.getAttribute("data-hero-pen"),
  nodes: document.querySelectorAll(".hero-draw-veil, .hero-draw-lines").length, y: Math.round(scrollY),
}));
const heroDone = (page) => page.waitForFunction(() => window.__heroDraw && window.__heroDraw.state === "done", null, { timeout: 15000 });
function assertPlayed(r, label) {
  assert.ok(r.state && r.state.linesAt > 0, `${label}: the lines were shown (${JSON.stringify(r.state)})`);
  assert.ok(r.state.devStart >= 299, `${label}: the photo developed on the clock (from V[0] = 300 ms)`);
  assert.equal(r.state.settledBy, undefined, `${label}: nothing settled it`);
  assert.equal(r.state.quick, undefined, `${label}: not the quick reveal`);
  assertMergeBuild(r.state, label);
  assert.equal(r.nodes, 0); assert.equal(r.cls, "js"); assert.equal(r.pen, null, `${label}: nothing is left on <html>`);
}
// Scrolls at reading pace (600 px/s, script-driven, not wheel) to the end of the project grid.
// fix-r1: it starts once the card drawing is enabled, and each frame moves at most 1/30 s of travel, so
// a stalled frame (a busy machine) is never read as a fast scroll.
async function readGrid(page) {
  await page.waitForFunction(() => window.__cardDraw && (window.__cardDraw.enabled || window.__cardDraw.reason), null, { timeout: 10000 });
  await page.evaluate(async () => {
    const grid = document.getElementById("project-cards");
    const end = grid.getBoundingClientRect().bottom + scrollY;
    document.documentElement.style.scrollBehavior = "auto";
    let last = performance.now();
    await new Promise((resolve) => {
      const step = (now) => {
        scrollTo(0, scrollY + 600 * Math.min(now - last, 1000 / 30) / 1000); last = now;
        if (scrollY + innerHeight >= Math.min(end, document.documentElement.scrollHeight - 1)) resolve(); else requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    document.documentElement.style.removeProperty("scroll-behavior");
  });
  await sleep(1800);
  return page.evaluate(() => {
    const qa = window.__cardDraw || {};
    const cards = Object.values(qa.cards || {});
    return { enabled: qa.enabled, reason: qa.reason, drawn: cards.filter((c) => c.phase === "done" && c.why === "complete").length, phases: cards.map((c) => `${c.phase}:${c.why || ""}`) };
  });
}
const cardState = (page) => page.evaluate(() => ({ enabled: window.__cardDraw && window.__cardDraw.enabled, reason: window.__cardDraw && window.__cardDraw.reason }));
const arrival = (page) => page.evaluate(() => (window.__caseArrival ? window.__caseArrival.getState() : null));
const arrivalSettled = (page, ms = 15000) => page.waitForFunction(() => {
  const s = window.__caseArrival && window.__caseArrival.getState();
  return s && (s.phase === "settled" || s.phase === "off");
}, null, { timeout: ms });

// ---- raw CDP (Playwright's focus emulation makes every page visible, so a background tab needs this) ----
function cdp(url) {
  const ws = new WebSocket(url);
  let id = 0; const wait = new Map();
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && wait.has(d.id)) { const { resolve, reject } = wait.get(d.id); wait.delete(d.id); if (d.error) reject(new Error(d.error.message)); else resolve(d.result); } };
  return { open: new Promise((r) => { ws.onopen = r; }), close: () => ws.close(),
    send: (method, params = {}, sessionId) => new Promise((resolve, reject) => { const i = ++id; wait.set(i, { resolve, reject }); ws.send(JSON.stringify({ id: i, method, params, sessionId })); }) };
}
async function backgroundTab(url, { hiddenMs = 3000, afterMs = 5000, probe } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kw-bg-"));
  const chrome = spawn(CHROME, ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${dir}`, "--no-first-run", "--no-default-browser-check", "--window-size=1440,900", ...ARGS, "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
  try {
    const wsUrl = await new Promise((resolve, reject) => {
      let buf = ""; chrome.stderr.on("data", (d) => { buf += d; const m = /DevTools listening on (ws:[^\s]+)/.exec(buf); if (m) resolve(m[1]); });
      setTimeout(() => reject(new Error("chrome did not start")), 15000);
    });
    const b = cdp(wsUrl); await b.open;
    const run = async (expression) => {
      const r = await b.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, sid);
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
      return r.result.value;
    };
    const { targetId } = await b.send("Target.createTarget", { url: "about:blank", background: true });
    const { sessionId: sid } = await b.send("Target.attachToTarget", { targetId, flatten: true });
    await b.send("Page.enable", {}, sid); await b.send("Runtime.enable", {}, sid);
    await b.send("Page.addScriptToEvaluateOnNewDocument", { source: PROBE }, sid);
    await b.send("Page.navigate", { url }, sid);
    await sleep(hiddenMs);
    const hidden = await run(probe);
    await b.send("Target.activateTarget", { targetId });
    await b.send("Page.bringToFront", {}, sid);
    await sleep(afterMs);
    const shown = await run(probe);
    try { await b.send("Browser.close"); } catch (e) { /* exits below */ }
    b.close();
    return { hidden, shown };
  } finally {
    await sleep(500);
    try { chrome.kill(); } catch (e) { /* already gone */ }
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* Chrome may still hold it */ }
  }
}

test("every refresh plays", { skip: !chromium && "Playwright not found (set PLAYWRIGHT_MODULE)" }, async (t) => {
  const server = await startServer();
  const { base } = server;
  const launch = (bfcache) => chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || "chrome", headless: true, args: ARGS,
    ...(bfcache ? { ignoreDefaultArgs: ["--disable-back-forward-cache"] } : {}) });
  const browser = await launch(false);
  const open = async (opts = DESKTOP, init) => {
    const ctx = await browser.newContext(opts);
    await ctx.addInitScript(PROBE);
    if (init) await ctx.addInitScript(init);
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    return { ctx, page, errors };
  };
  try {
    await sub(t, "the hero and the cards play on a load and on two consecutive reloads, each landing at the top", async () => {
      const { ctx, page, errors } = await open();
      await page.goto(`${base}/index.html`, { waitUntil: "load" });
      for (const step of ["load", "reload 1", "reload 2"]) {
        if (step !== "load") await page.reload({ waitUntil: "load" });   // from the bottom of the grid
        await heroDone(page);
        const r = await hero(page);
        assert.equal(r.rr.nav, step === "load" ? "navigate" : "reload");
        assert.equal(r.y, 0, `${step}: lands at the top`);
        assertPlayed(r, step);
        assert.equal(r.state.arm, "now");
        const cards = await readGrid(page);
        assert.equal(cards.reason, "", `${step}: ${cards.reason}`);
        assert.equal(cards.drawn, 15, `${step}: ${cards.phases.join(" ")}`);
      }
      assert.deepEqual(errors, []);
      await ctx.close();
    });

    await sub(t, "a restored scroll position is not intent", async () => {
      // As Chrome restores a position: an instant scroll, with its scroll event, before the hero starts.
      const { ctx, page, errors } = await open(DESKTOP, `addEventListener("DOMContentLoaded", () => { document.documentElement.style.scrollBehavior = "auto"; scrollTo(0, 200); window.__restoredY = scrollY; });`);
      await page.goto(`${base}/index.html`, { waitUntil: "load" });
      await heroDone(page);
      const r = await hero(page);
      assert.equal(await page.evaluate(() => window.__restoredY), 200);
      assertPlayed(r, "y=200");
      assert.deepEqual(errors, []);
      await ctx.close();
    });

    await sub(t, "Back does not replay without the back/forward cache, and the homepage keeps its place", async () => {
      const { ctx, page, errors } = await open();
      await page.goto(`${base}/index.html`, { waitUntil: "load" });
      await heroDone(page);
      await page.evaluate(() => scrollTo({ top: 1500, behavior: "instant" }));
      await sleep(300);
      await page.goto(`${base}/case-study.html?project=steering`, { waitUntil: "load" });
      await sleep(800);
      await page.goBack({ waitUntil: "load" });
      await sleep(2500);
      const r = await hero(page);
      assert.equal(r.rr.nav, "back_forward");
      assert.equal(r.rr.shows[0].persisted, false);
      assert.equal(r.rr.heroClassAt, null, "the guard never armed");
      assert.ok(!r.state || !r.state.linesAt, "no lines");
      assert.equal(r.nodes, 0); assert.equal(r.cls, "js");
      assert.ok(Math.abs(r.y - 1500) <= 2, `restored to ${r.y}`);
      assert.deepEqual(await cardState(page), { enabled: false, reason: "back-forward" });
      // Forward to the detail page: no restore there, it lands at the top.
      await page.goForward({ waitUntil: "load" });
      await sleep(500);
      assert.equal(await page.evaluate(() => Math.round(scrollY)), 0);
      assert.deepEqual(errors, []);
      await ctx.close();
    });

    await sub(t, "Back from the back/forward cache does not replay either and keeps the place", async () => {
      const bf = await launch(true);
      try {
        const ctx = await bf.newContext(DESKTOP);
        await ctx.addInitScript(PROBE);
        const page = await ctx.newPage();
        await page.goto(`${base}/index.html`, { waitUntil: "load" });
        await heroDone(page);
        const before = await hero(page);
        await page.evaluate(() => scrollTo({ top: 1500, behavior: "instant" }));
        await sleep(300);
        await page.goto(`${base}/case-study.html?project=steering`, { waitUntil: "load" });
        await sleep(800);
        await page.goBack({ waitUntil: "commit" });
        await sleep(2500);
        const r = await hero(page);
        assert.equal(r.rr.shows.at(-1).persisted, true, "restored from the back/forward cache");
        assert.equal(r.state.doneAt, before.state.doneAt, "the same settled hero, not a new run");
        assert.equal(r.cls, "js"); assert.equal(r.nodes, 0);
        assert.ok(Math.abs(r.y - 1500) <= 2, `kept at ${r.y}`);
        await ctx.close();
      } finally { await bf.close(); }
    });

    await sub(t, "#links: a deep link lands on its target; its reload plays at the top; same-page Back and Forward keep the browser's positions", async () => {
      const { ctx, page, errors } = await open();
      const at = (id) => page.evaluate((i) => ({ y: Math.round(scrollY), top: Math.round(document.getElementById(i).getBoundingClientRect().top) }), id);
      for (const id of ["contact", "work", "project-scanner"]) {
        await page.goto("about:blank");
        await page.goto(`${base}/index.html#${id}`, { waitUntil: "load" });
        await sleep(1500);
        const first = await at(id);
        assert.ok(first.top >= 0 && first.top < 300, `#${id}: on its target (${JSON.stringify(first)})`);
        assert.equal((await hero(page)).rr.heroClassAt, null, `#${id}: no hero on a deep link`);
        // fix-r1: a reload of a #link URL is a refresh like any other: the fragment is dropped and it plays at the top.
        await page.reload({ waitUntil: "load" });
        await heroDone(page);
        const r = await hero(page);
        assert.equal(r.rr.nav, "reload");
        assert.equal(r.y, 0, `#${id}: the reload lands at the top`);
        assert.equal(new URL(page.url()).hash, "", `#${id}: the fragment is dropped on the reload`);
        assertPlayed(r, `#${id} reload`);
      }
      // A detail page's "Back to projects" (index.html#project-<key>), then a reload.
      await page.goto(`${base}/case-study.html?project=steering`, { waitUntil: "load" });
      await sleep(800);
      await page.click(".site-header .nav-back");
      await page.waitForURL(/index\.html#project-steering$/, { timeout: 10000 });
      await sleep(1200);
      assert.ok((await at("project-steering")).top < 900, "Back to projects lands on its card");
      assert.equal((await hero(page)).rr.heroClassAt, null, "no hero on that arrival");
      await page.reload({ waitUntil: "load" });
      await heroDone(page);
      const back = await hero(page);
      assert.equal(back.y, 0, "its reload lands at the top");
      assertPlayed(back, "Back to projects, reload");
      await page.goto(`${base}/index.html`, { waitUntil: "load" });
      await heroDone(page);
      await page.evaluate(() => scrollTo({ top: 300, behavior: "instant" }));
      await sleep(300);
      await page.click('a[href="#contact"]');
      await sleep(2000);
      const target = await at("contact");
      await page.goBack();
      await sleep(1000);
      assert.equal(await page.evaluate(() => Math.round(scrollY)), 300, "Back returns to where the link was clicked");
      await page.goForward();
      await sleep(1000);
      assert.equal(await page.evaluate(() => Math.round(scrollY)), target.y, "Forward returns to the target");
      assert.deepEqual(errors, []);
      await ctx.close();
    });

    // fix-r3 (agent decision): the wordmark from a detail page whose stage is on screen makes a held
    // view-transition arrival (window.__vtBoot.hold "parsed", no morph: the card is off screen); it lands
    // at the top and the hero plays, as at HEAD 27af3682.
    await sub(t, "the wordmark from a detail page: the held arrival plays at the top", async () => {
      for (const from of ["case-study.html?project=steering", "project-3d.html?project=scanner"]) {
        const { ctx, page, errors } = await open();
        await page.goto(`${base}/${from}`, { waitUntil: "load" });
        await sleep(1500);
        const share = await page.evaluate(() => {
          const r = document.querySelector(".case-animation-host > .card-media").getBoundingClientRect();
          return Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0)) / r.height;
        });
        assert.ok(share > 0.1, `${from}: the stage is on screen (${share})`);
        await page.click(".wordmark");
        await page.waitForURL(/\/index\.html$/, { timeout: 10000 });
        await heroDone(page);
        const r = await hero(page);
        const boot = await page.evaluate(() => ({ hold: window.__vtBoot.hold, vtHold: window.__vt && window.__vt.hold && window.__vt.hold.why }));
        assert.equal(boot.hold, "parsed", `${from}: a held arrival`);
        assert.equal(r.rr.nav, "navigate");
        assert.equal(r.y, 0, `${from}: lands at the top`);
        assertPlayed(r, `${from} -> wordmark`);
        assert.equal(r.state.arm, "now");
        assert.deepEqual(errors, []);
        await ctx.close();
      }
    });

    // fix-r3 (agent decision): a browser without the Navigation API (older Safari and Firefox), as Chrome with
    // window.navigation hidden: a reload still lands at the top and plays; same-page Back/Forward after a #link
    // and a homepage Back are put back from URL keys (click, popstate, pagehide).
    await sub(t, "without the Navigation API: reloads land at the top; same-page and homepage Back/Forward keep their places", async () => {
      const { ctx, page, errors } = await open(DESKTOP, `Object.defineProperty(window, "navigation", { configurable: true, get: () => undefined });`);
      const y = () => page.evaluate(() => Math.round(scrollY));
      const go = (v) => page.evaluate((top) => scrollTo({ top, behavior: "instant" }), v);
      await page.goto(`${base}/index.html`, { waitUntil: "load" });
      assert.equal(await page.evaluate(() => typeof window.navigation + typeof navigation), "undefinedundefined");
      await heroDone(page);
      await go(3000); await sleep(400);
      await page.reload({ waitUntil: "load" });
      await heroDone(page);
      await sleep(1500);
      const r = await hero(page);
      assert.equal(r.rr.nav, "reload");
      assert.equal(r.y, 0, "a reload from y 3000 lands at the top");
      assertPlayed(r, "API-less reload");
      await go(300); await sleep(300);
      await page.click('a[href="#contact"]');
      await sleep(2000);
      const target = await y();
      assert.ok(target > 1000, `the #link reached its target (${target})`);
      await page.goBack(); await sleep(1000);
      assert.equal(await y(), 300, "Back returns to where the link was clicked");
      await page.goForward(); await sleep(1000);
      assert.equal(await y(), target, "Forward returns to the target");
      await page.reload({ waitUntil: "load" });
      await heroDone(page);
      const h = await hero(page);
      assert.equal(new URL(page.url()).hash, "", "a #contact reload drops the fragment");
      assert.equal(h.y, 0); assertPlayed(h, "API-less #contact reload");
      await go(1500); await sleep(300);
      await page.goto(`${base}/case-study.html?project=steering`, { waitUntil: "load" });
      await sleep(800);
      await page.goBack({ waitUntil: "load" });
      await sleep(1500);
      const b = await hero(page);
      assert.equal(b.rr.nav, "back_forward");
      assert.equal(b.rr.heroClassAt, null, "no hero on Back");
      assert.ok(Math.abs(b.y - 1500) <= 2, `the homepage keeps its place (${b.y})`);
      // A detail page's chapter link, then Back.
      await page.goto(`${base}/case-study.html?project=steering`, { waitUntil: "load" });
      await arrivalSettled(page);
      await page.evaluate(() => document.querySelector(".case-reading-actions a.reading-primary").click());
      await sleep(1200);
      assert.equal(new URL(page.url()).hash, "#brief");
      const brief = await y();
      await page.goBack(); await sleep(1000);
      assert.equal(await y(), 0, "Back from #brief returns to the top of the detail page");
      await page.goForward(); await sleep(1000);
      assert.ok(Math.abs((await y()) - brief) <= 2, `Forward returns to the chapter (${brief})`);
      assert.deepEqual(errors, []);
      await ctx.close();
    });

    await sub(t, "data saver keeps the cards; a 3g effective type no longer does", async () => {
      const connection = (c) => `Object.defineProperty(Navigator.prototype, "connection", { configurable: true, get: () => Object.assign(new EventTarget(), ${JSON.stringify(c)}) });`;
      for (const [c, reason] of [[{ saveData: true, effectiveType: "4g", downlink: 10, rtt: 50 }, "save-data"], [{ saveData: false, effectiveType: "3g", downlink: 1.5, rtt: 300 }, ""]]) {
        const { ctx, page, errors } = await open(DESKTOP, connection(c));
        await page.goto(`${base}/index.html`, { waitUntil: "load" });
        await heroDone(page);
        await page.waitForFunction(() => window.__cardDraw, null, { timeout: 8000 });
        assert.equal((await cardState(page)).reason, reason, JSON.stringify(c));
        if (!reason) assert.equal((await readGrid(page)).drawn, 15, "Fast 3G reading: every card draws");
        assert.deepEqual(errors, []);
        await ctx.close();
      }
    });

    await sub(t, "detail pages: a reload plays, forced colors keep the cover, an 1100 ms first byte still plays", async () => {
      for (const file of ["case-study.html", "project-3d.html"]) {
        const url = `${base}/${file}?project=steering`;
        const { ctx, page, errors } = await open();
        await page.goto(url, { waitUntil: "load" });
        await arrivalSettled(page);
        assert.equal((await arrival(page)).phase, "settled", `${file}: first load`);
        await page.evaluate(() => scrollTo({ top: 700, behavior: "instant" }));
        await sleep(300);
        await page.reload({ waitUntil: "load" });
        await arrivalSettled(page);
        const reload = await arrival(page);
        assert.equal(reload.phase, "settled", `${file}: a reload from inside the story plays (${reload.reason})`);
        assert.equal(await page.evaluate(() => Math.round(scrollY)), 0);
        // fix-r2: 'Read case study' (#brief) puts a chapter in the URL; a reload drops it, lands at the top
        // and plays (it used to restore the chapter and end off/'interrupted').
        await page.evaluate(() => document.querySelector('.case-reading-actions a.reading-primary').click());
        await sleep(1200);
        assert.equal(new URL(page.url()).hash, "#brief");
        assert.ok(await page.evaluate(() => scrollY) > 900, `${file}: the button reaches its chapter`);
        await page.reload({ waitUntil: "load" });
        await arrivalSettled(page);
        const chapter = await arrival(page);
        assert.equal(new URL(page.url()).hash, "", `${file}: the chapter fragment is dropped on the reload`);
        assert.equal(new URL(page.url()).search, "?project=steering", `${file}: the query is kept`);
        assert.equal(await page.evaluate(() => Math.round(scrollY)), 0, `${file}: a #brief reload lands at the top`);
        assert.equal(chapter.phase, "settled", `${file}: a #brief reload plays (${chapter.reason})`);
        server.delay(1100);
        try {
          await page.goto(`${url}&slow=1`, { waitUntil: "load" });
          await arrivalSettled(page);
          const slow = await arrival(page);
          const first = await page.evaluate(() => Math.round(performance.getEntriesByType("navigation")[0].responseStart));
          assert.ok(first >= 1050, `first byte at ${first} ms`);
          assert.equal(slow.phase, "settled", `${file}: first byte at ${first} ms (${slow.reason})`);
        } finally { server.delay(0); }
        assert.deepEqual(errors, []);
        await ctx.close();
        const forced = await open({ ...DESKTOP, forcedColors: "active" });
        await forced.page.goto(url, { waitUntil: "load" });
        await sleep(2500);
        const f = await forced.page.evaluate(() => ({ forced: matchMedia("(forced-colors: active)").matches, arrival: document.querySelector(".case-animation-host .card-media[data-arrival]") !== null, drawing: document.querySelectorAll(".case-drawing").length, state: window.__caseArrival ? window.__caseArrival.getState() : null }));
        assert.equal(f.forced, true);
        assert.equal(f.arrival, false, `${file}: no held print under forced colors`);
        assert.equal(f.drawing, 0, `${file}: no drawing under forced colors`);
        assert.ok(!f.state || f.state.phase === "off", JSON.stringify(f.state));
        assert.deepEqual(forced.errors, []);
        await forced.ctx.close();
      }
    });

    await sub(t, "a homepage opened in a background tab waits, and plays when first shown", { skip: !fs.existsSync(CHROME) && `no Chrome at ${CHROME}` }, async () => {
      const probe = `(() => ({ cls: document.documentElement.className, pen: document.documentElement.getAttribute("data-hero-pen"), vis: document.visibilityState,
        state: window.__heroDraw && (({ geo, carSrc, ...r }) => r)(window.__heroDraw), rr: window.__rr, nodes: document.querySelectorAll(".hero-draw-veil, .hero-draw-lines").length }))()`;
      // pen-20261110: the hero pen ends about 5.3 s after its first ink at 1440 (last ink 4.18 s, develop 1 s);
      // 7.5 s after the tab is shown leaves it room to finish.
      const { hidden, shown } = await backgroundTab(`${base}/index.html`, { probe, afterMs: 7500 });
      assert.equal(hidden.vis, "hidden");
      assert.equal(hidden.pen, "wait");
      assert.ok(!hidden.cls.includes("hero-draw"), "the photo is untouched while hidden");
      assert.equal(hidden.state && hidden.state.state, "wait-visible");
      assert.equal(shown.vis, "visible");
      assert.deepEqual(shown.rr.pen, ["wait", "late"]);
      assert.equal(shown.state.arm, "late");
      // pen-20261110: armed only once shown (the tab was hidden for 3 s); the pen's linesAt (its t0) is the timestamp of the
      // first animation frame after the arm, which is that frame's start and can precede the visibilitychange handler that
      // armed it by up to one frame.
      assert.ok(shown.state.armedAt >= 2500, `armed at ${shown.state.armedAt}, before the tab was shown`);
      assert.ok(shown.state.linesAt >= shown.state.armedAt - 17, `lines at ${shown.state.linesAt}, armed at ${shown.state.armedAt}`);
      assert.ok(shown.state.devStart >= 299);
      assert.equal(shown.state.settledBy, undefined);
      assert.equal(shown.state.state, "done");
      assert.equal(shown.cls, "js"); assert.equal(shown.nodes, 0); assert.equal(shown.pen, null);
    });

    await sub(t, "a detail page opened in a background tab keeps its arrival for when it is shown", { skip: !fs.existsSync(CHROME) && `no Chrome at ${CHROME}` }, async () => {
      const probe = `(() => ({ vis: document.visibilityState, state: window.__caseArrival ? window.__caseArrival.getState() : null }))()`;
      // steering on case-study.html has a live model too: its ready event lands just after the tab is shown.
      for (const url of [`${base}/case-study.html?project=steering`, `${base}/project-3d.html?project=scanner`]) {
        const { hidden, shown } = await backgroundTab(url, { probe });
        assert.equal(hidden.vis, "hidden");
        assert.equal(hidden.state.phase, "held", `${url}: ${JSON.stringify(hidden.state)}`);
        assert.ok(hidden.state.layerWidth > 0, `${url}: the sheets were requested while hidden`);
        assert.equal(shown.state.phase, "settled", `${url}: ${JSON.stringify(shown.state)}`);
        assert.equal(shown.state.reason, "");
      }
    });

    await sub(t, "the studio's line drawing has 20 s to start before the classic card", async () => {
      const { ctx, page } = await open();
      // The room's modules never arrive (as on a link too slow for them): the drawing cannot go live,
      // so only the inline deadline in experience.html decides.
      await page.route(/\/experience(-entry|-loader-drawing)?\.js/, () => {});
      await page.goto(`${base}/experience.html`, { waitUntil: "commit" });
      const draw = () => page.evaluate(() => ({ loader: document.documentElement.getAttribute("data-loader"), draw: (document.getElementById("exp-loader") || {}).dataset?.draw || null, t: Math.round(performance.now()) }));
      await sleep(6000);
      const early = await draw();
      assert.equal(early.loader, "drawing");
      assert.notEqual(early.draw, "off", `still waiting at ${early.t} ms (the deadline was 4 s)`);
      await page.waitForFunction(() => (document.getElementById("exp-loader") || {}).dataset?.draw === "off", null, { timeout: 25000 });
      const late = await draw();
      assert.ok(late.t >= 19900 && late.t < 22000, `the classic card at ${late.t} ms`);
      await ctx.close();
    });
  } finally {
    await browser.close();
    await server.close();
  }
});
