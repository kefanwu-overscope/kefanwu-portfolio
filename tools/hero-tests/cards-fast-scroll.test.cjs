// cards-20261109, "a fast scroll no longer loses a drawing", in Chrome (card-drawing-20261027.js):
// a card that has not drawn waits in pencil while the page moves fast and draws once it is on screen and
// the scroll is calm; a card that leaves the screen mid-draw goes back to pencil and draws again when it
// returns; scroll speed never settles a card; only input on that card does (or reduced motion, data saver,
// Back/Forward). Fast wheel, touch flings, keys, an instant jump and the #work link's smooth scroll.
//
//   node --test tools/hero-tests/cards-fast-scroll.test.cjs
//   (Playwright with Chrome: set PLAYWRIGHT_MODULE to its folder if it is not resolvable as "playwright";
//   CARDS_TEST_PORT chooses the local server's port (default: HERO_TEST_PORT + 2, otherwise any free port).
//   Without Playwright it is skipped. About 2 minutes.)
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const http = require("http");
const path = require("path");

const SITE = path.resolve(__dirname, "../..");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".woff2": "font/woff2", ".jpg": "image/jpeg", ".glb": "model/gltf-binary", ".gz": "application/gzip", ".pdf": "application/pdf" };
const ARGS = ["--ignore-gpu-blocklist", "--enable-gpu-rasterization", "--use-angle=d3d11"];
let chromium = null;
try { ({ chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright")); } catch (e) { /* skipped below */ }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DESKTOP = { viewport: { width: 1440, height: 900 } };
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true };
// CARDS_ONLY=<part of a name> runs only the matching checks (for debugging one).
const sub = (t, name, ...rest) => (process.env.CARDS_ONLY && !name.includes(process.env.CARDS_ONLY) ? Promise.resolve() : t.test(name, ...rest));

// Per frame, per card on screen: what it shows ("pencil": paper with the faint drawing; "blank": paper with
// no line at all; "cover": no overlay; "drawing": anything in between) and its phase then.
const PROBE = `(() => {
  const log = window.__cf = { cards: {} };
  const shows = (media) => {
    const veil = media.querySelector(".card-draw-veil"), lines = media.querySelector(".card-draw-lines");
    if (!veil && !lines) return "cover";
    const va = veil ? Number(getComputedStyle(veil).opacity) : 0;
    const ls = lines && lines.isConnected ? getComputedStyle(lines) : null;
    const la = ls ? Number(ls.opacity) : 0;
    if (va < 0.03 && la < 0.03) return "cover";
    if (va > 0.97 && (!ls || la < 0.03 || parseFloat(ls.maskPosition) >= 99)) {
      return ls && la >= 0.03 && !String(ls.maskImage).includes("rgba(0, 0, 0, 0)") ? "pencil" : "blank";
    }
    return "drawing";
  };
  const tick = () => {
    for (const card of document.querySelectorAll(".project-card[data-project]")) {
      const media = card.querySelector(".card-media");
      const r = media.getBoundingClientRect();
      if (!(r.height && r.bottom > 0 && r.top < innerHeight)) continue;
      const qa = window.__cardDraw && window.__cardDraw.cards && window.__cardDraw.cards[card.dataset.project];
      const c = log.cards[card.dataset.project] || (log.cards[card.dataset.project] = {});
      const k = (qa ? qa.phase : "none") + ">" + shows(media);
      c[k] = (c[k] || 0) + 1;
    }
    requestAnimationFrame(tick);
  };
  addEventListener("DOMContentLoaded", () => requestAnimationFrame(tick));
})();`;

function startServer() {
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, "http://x");
    let p = decodeURIComponent(u.pathname);
    if (p.endsWith("/")) p += "index.html";
    const file = path.join(SITE, p);
    if (!file.startsWith(SITE) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream", "cache-control": "no-cache" });
    fs.createReadStream(file).pipe(res);
  });
  const port = Number(process.env.CARDS_TEST_PORT || (process.env.HERO_TEST_PORT ? Number(process.env.HERO_TEST_PORT) + 2 : 0));
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve({
    base: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((r) => server.close(r)),
  })));
}

const state = (page) => page.evaluate(() => {
  const qa = window.__cardDraw || {};
  const out = { enabled: qa.enabled, reason: qa.reason, cards: {} };
  for (const card of document.querySelectorAll(".project-card[data-project]")) {
    const key = card.dataset.project, r = card.querySelector(".card-media").getBoundingClientRect();
    const vis = r.height ? Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0)) / r.height : 0;
    const q = (qa.cards || {})[key] || {};
    out.cards[key] = { vis: Math.round(vis * 100) / 100, phase: q.phase, why: q.why || "", settledBy: q.settledBy || "", plays: q.plays || 0, restarts: q.restarts || 0,
      overlays: card.querySelectorAll(".card-draw-veil, .card-draw-lines").length, frames: (window.__cf.cards || {})[key] || {} };
  }
  return out;
});
const drew = (c) => c.phase === "done" && c.why === "complete";
const line = (s) => Object.entries(s.cards).map(([k, c]) => `${k}:${c.phase}:${c.why}@${c.vis}`).join(" ");
// The hero has ended and every card's drawing is armed (waiting off screen), as for a visitor who looks
// at the hero first.
async function ready(page) {
  await page.waitForFunction(() => window.__heroDraw && window.__heroDraw.state === "done", null, { timeout: 15000 });
  await page.waitForFunction(() => {
    const qa = window.__cardDraw;
    return qa && qa.enabled && Object.values(qa.cards).filter((c) => c.phase === "primed").length === 15;
  }, null, { timeout: 15000 });
}
const stopKeyTop = (page, key, at = 0.3) => page.evaluate(([k, f]) => {
  const r = document.querySelector(`.project-card[data-project="${k}"] .card-media`).getBoundingClientRect();
  return Math.min(document.documentElement.scrollHeight - innerHeight, Math.round(r.top + scrollY - innerHeight * f));
}, [key, at]);
async function settleScroll(page, quietMs = 300, capMs = 8000) {
  const t0 = Date.now();
  let y = await page.evaluate(() => scrollY), quiet = Date.now();
  while (Date.now() - t0 < capMs) {
    await sleep(50);
    const n = await page.evaluate(() => scrollY);
    if (n !== y) { y = n; quiet = Date.now(); } else if (Date.now() - quiet >= quietMs) break;
  }
}
// Wheel ticks of 100 px timed for `v` px/s.
async function wheelTo(page, targetY, v) {
  await page.mouse.move(12, 450);   // the page margin, off every card
  let at = await page.evaluate(() => scrollY);
  const t0 = Date.now();
  let n = 0;
  while (targetY - at > 1) {
    const step = Math.min(100, targetY - at);
    await page.mouse.wheel(0, step);
    at += step; n += 1;
    const wait = t0 + (n * 100 * 1000) / v - Date.now();
    if (wait > 0) await sleep(wait);
  }
}
// A touch flick: the finger moves |dist| px at speed px/s (dist > 0: up, the page scrolls down) and lifts
// while moving (momentum). x 8 is the page gutter, never on a card's slider.
async function flick(cdp, dist, speed, x = 8, y = 640) {
  const pt = (py) => [{ x, y: Math.round(py), id: 1, radiusX: 4, radiusY: 4, force: 1 }];
  const dir = Math.sign(dist), total = Math.abs(dist);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: pt(y) });
  const t0 = Date.now();
  let moved = 0;
  while (moved < total) {
    await sleep(16);
    moved = Math.min(total, (speed * (Date.now() - t0)) / 1000);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: pt(y - dir * moved) });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}
// After the stop: every card at least 25 % on screen draws (complete), none was settled, none showed a
// blank paper or its cover while waiting on screen.
async function assertStopDraws(page, label) {
  const at = await state(page);
  const readable = Object.entries(at.cards).filter(([, c]) => c.vis >= 0.25 && c.phase !== "static").map(([k]) => k);
  assert.ok(readable.length >= 1, `${label}: cards on screen at the stop (${line(at)})`);
  await page.waitForFunction((keys) => keys.every((k) => {
    const c = window.__cardDraw.cards[k];
    return c.phase === "done" && c.why === "complete";
  }), readable, { timeout: 8000 }).catch(() => {});
  const s = await state(page);
  for (const k of readable) assert.ok(drew(s.cards[k]), `${label}: ${k} drew after the stop (${line(s)})`);
  for (const [k, c] of Object.entries(s.cards)) {
    assert.ok(!["fast-scroll", "offscreen", "seen-before-drawing", "near-viewport-before-drawing"].includes(c.why), `${label}: ${k} ${c.why}`);
    assert.equal(c.settledBy, "", `${label}: ${k} was settled (${c.settledBy})`);
    assert.equal(c.frames["primed>blank"] || 0, 0, `${label}: ${k} showed a blank paper`);
    assert.equal(c.frames["primed>cover"] || 0, 0, `${label}: ${k} showed its cover while waiting`);
    assert.equal(c.frames["idle>cover"] || 0, 0, `${label}: ${k} was on screen unarmed`);
  }
  return { readable, s };
}

test("a fast scroll no longer loses a card's drawing", { skip: !chromium && "Playwright not found (set PLAYWRIGHT_MODULE)" }, async (t) => {
  const server = await startServer();
  const { base } = server;
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || "chrome", headless: true, args: ARGS });
  const open = async (opts = DESKTOP, init) => {
    const ctx = await browser.newContext(opts);
    await ctx.addInitScript(PROBE);
    if (init) await ctx.addInitScript(init);
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(`${base}/index.html`, { waitUntil: "load" });
    return { ctx, page, errors };
  };
  try {
    await sub(t, "fast wheel (3000 px/s) then stop: the cards wait in pencil and every card on screen draws", async () => {
      const { ctx, page, errors } = await open();
      await ready(page);
      await wheelTo(page, await stopKeyTop(page, "pool"), 3000);
      const moving = await state(page);
      await settleScroll(page);
      const { readable, s } = await assertStopDraws(page, "wheel 3000");
      assert.ok(readable.length >= 3, `a row at the stop (${readable})`);
      // The rows the scroll went past waited in pencil: none of them drew while it was fast.
      const passed = ["steering", "vineRobot", "brakeSim", "scanner", "javelin", "materialTest"];
      for (const k of passed) {
        assert.ok(s.cards[k].frames["primed>pencil"] > 0, `${k} showed its pencil on the way (${JSON.stringify(s.cards[k].frames)})`);
        assert.equal(s.cards[k].phase, "primed", `${k} still waits for its turn (${s.cards[k].phase}:${s.cards[k].why})`);
      }
      assert.ok(moving.enabled);
      // Back up at reading pace: the rows passed draw now, once each.
      await page.evaluate(async () => {
        document.documentElement.style.scrollBehavior = "auto";
        let last = performance.now();
        await new Promise((resolve) => {
          const step = (now) => { scrollTo(0, scrollY - 450 * Math.min(now - last, 1000 / 30) / 1000); last = now; if (scrollY <= document.getElementById("project-cards").getBoundingClientRect().top + scrollY - 200) resolve(); else requestAnimationFrame(step); };
          requestAnimationFrame(step);
        });
      });
      await sleep(2500);
      const back = await state(page);
      for (const k of passed) assert.ok(drew(back.cards[k]), `${k} drew on the way back (${back.cards[k].phase}:${back.cards[k].why})`);
      assert.deepEqual(errors, []);
      await ctx.close();
    });

    await sub(t, "fast touch flings (3000 px/s) then stop on a phone: every card on screen draws", async () => {
      const { ctx, page, errors } = await open(PHONE);
      await ready(page);
      const cdp = await ctx.newCDPSession(page);
      const target = await stopKeyTop(page, "pool");
      // Flick after flick; a touch catches the momentum once it reaches the pool card (cancelled: never a tap).
      for (let i = 0; i < 40; i += 1) {
        if ((await page.evaluate(() => scrollY)) >= target - 200) break;
        await flick(cdp, 420, 3000);
        let past = false;
        for (let k = 0; k < 8 && !past; k += 1) { await sleep(25); past = (await page.evaluate(() => scrollY)) >= target - 200; }
        if (past) {
          await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 8, y: 400, id: 1 }] });
          await sleep(60);
          await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
          break;
        }
      }
      await settleScroll(page, 300, 10000);
      const { s } = await assertStopDraws(page, "fling 3000");
      const waited = Object.values(s.cards).filter((c) => c.frames["primed>pencil"] > 0).length;
      assert.ok(waited >= 4, `cards passed in pencil (${waited})`);
      await cdp.detach();
      assert.deepEqual(errors, []);
      await ctx.close();
    });

    await sub(t, "the #work link's smooth scroll, PageDown keys and an instant jump: the cards on screen draw at the stop", async () => {
      for (const how of ["anchor", "keys", "jump"]) {
        const { ctx, page, errors } = await open();
        await ready(page);
        if (how === "anchor") await page.click("a.hero-scroll[href='#work']");
        else if (how === "keys") {
          await page.mouse.move(12, 450);
          for (let i = 0; i < 4; i += 1) { await page.keyboard.press("PageDown"); await sleep(120); }
        } else await page.evaluate((y) => scrollTo({ top: y, behavior: "instant" }), await stopKeyTop(page, "pool"));
        await settleScroll(page);
        await assertStopDraws(page, how);
        assert.deepEqual(errors, []);
        await ctx.close();
      }
    });

    await sub(t, "a card that leaves the screen mid-draw goes back to pencil and draws again when it returns", async () => {
      const { ctx, page, errors } = await open();
      await ready(page);
      const y = await stopKeyTop(page, "scanner", 0.2);
      await page.evaluate((top) => scrollTo({ top, behavior: "instant" }), y);
      await page.waitForFunction(() => window.__cardDraw.cards.scanner.phase === "playing", null, { timeout: 5000 });
      await sleep(250);   // mid-draw
      await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
      await sleep(600);
      const away = await state(page);
      assert.equal(away.cards.scanner.phase, "primed", `back to waiting (${away.cards.scanner.phase}:${away.cards.scanner.why})`);
      assert.ok(away.cards.scanner.restarts >= 1);
      assert.equal(away.cards.scanner.overlays, 2, "the paper and the pencil drawing are up again");
      await page.evaluate((top) => scrollTo({ top, behavior: "instant" }), y);
      await page.waitForFunction(() => { const c = window.__cardDraw.cards.scanner; return c.phase === "done"; }, null, { timeout: 6000 });
      const back = await state(page);
      assert.ok(drew(back.cards.scanner), `drew on its return (${back.cards.scanner.why})`);
      assert.ok(back.cards.scanner.plays >= 2, `from the start again (${back.cards.scanner.plays} plays)`);
      // A finished card stays finished: away and back again, no replay.
      await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
      await sleep(400);
      await page.evaluate((top) => scrollTo({ top, behavior: "instant" }), y);
      await sleep(1500);
      const again = await state(page);
      assert.equal(again.cards.scanner.plays, back.cards.scanner.plays);
      assert.equal(again.cards.scanner.overlays, 0);
      assert.deepEqual(errors, []);
      await ctx.close();
    });

    await sub(t, "a slow reading-pace scroll (450 px/s) still draws every card once", async () => {
      const { ctx, page, errors } = await open();
      await ready(page);
      await page.evaluate(async () => {
        const end = document.getElementById("project-cards").getBoundingClientRect().bottom + scrollY;
        document.documentElement.style.scrollBehavior = "auto";
        let last = performance.now();
        await new Promise((resolve) => {
          const step = (now) => {
            scrollTo(0, scrollY + 450 * Math.min(now - last, 1000 / 30) / 1000); last = now;
            if (scrollY + innerHeight >= Math.min(end, document.documentElement.scrollHeight - 1)) resolve(); else requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        });
      });
      await sleep(2000);
      const s = await state(page);
      const done = Object.entries(s.cards).filter(([, c]) => drew(c));
      assert.equal(done.length, 15, line(s));
      for (const [k, c] of done) { assert.equal(c.plays, 1, `${k} drew once`); assert.equal(c.restarts, 0, `${k} never restarted`); }
      assert.deepEqual(errors, []);
      await ctx.close();
    });

    await sub(t, "pointer intent settles a waiting card; a press, key or scroll elsewhere does not", async () => {
      const { ctx, page, errors } = await open();
      await ready(page);
      // The scanner row 15 % on screen at the bottom edge: waiting in pencil (not enough to draw). The mouse
      // waits still where the card's strip will be: a card scrolling under a still cursor is not hover.
      const at = await page.evaluate(() => {
        const r = document.querySelector('.project-card[data-project="scanner"] .card-media').getBoundingClientRect();
        return { y: Math.round(r.top + scrollY - innerHeight + r.height * 0.15), x: Math.round(r.left + r.width / 2), py: Math.round(innerHeight - r.height * 0.07) };
      });
      await page.mouse.move(at.x, at.py);
      await page.evaluate((top) => scrollTo({ top, behavior: "instant" }), at.y);
      await sleep(800);
      const before = await state(page);
      assert.equal(before.cards.scanner.phase, "primed", line(before));
      assert.ok(before.cards.scanner.vis > 0 && before.cards.scanner.vis < 0.25);
      // A mouse press on the page itself (not on a card; dispatched, so the cursor stays put) and a key: nothing settles.
      await page.evaluate(() => {
        const o = { bubbles: true, cancelable: true, pointerType: "mouse", isPrimary: true, button: 0, buttons: 1, clientX: 12, clientY: 300 };
        document.body.dispatchEvent(new PointerEvent("pointerdown", o));
        document.body.dispatchEvent(new PointerEvent("pointerup", { ...o, buttons: 0 }));
      });
      await page.keyboard.press("Shift");
      await sleep(400);
      const still = await state(page);
      assert.equal(still.cards.scanner.phase, "primed", "a press and a key elsewhere are not intent for a card");
      assert.equal(still.cards.javelin.phase, "primed");
      assert.equal(still.cards.scanner.settledBy, "", "nor is the card scrolling under a still cursor");
      // A mouse press on the card's visible strip, under the still cursor, settles it to its cover (released off
      // the card: no click, so no navigation).
      await page.mouse.down();
      await sleep(500);
      const after = await state(page);
      await page.mouse.move(12, 300);
      await page.mouse.up();
      assert.equal(after.cards.scanner.why, "pointerdown", line(after));
      assert.equal(after.cards.scanner.overlays, 0, "the cover, and hover frame-scrubbing, are back");
      assert.equal(after.cards.javelin.phase, "primed", "its neighbour still waits");
      // Hover: a real pointer move over a waiting card settles it too (then frame-scrubbing works on the cover).
      const jav = await page.evaluate(() => { const r = document.querySelector('.project-card[data-project="javelin"] .card-media').getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(innerHeight - r.height * 0.07) }; });
      await page.mouse.move(jav.x - 30, jav.y);
      await page.mouse.move(jav.x, jav.y, { steps: 3 });
      await sleep(500);
      const hover = await state(page);
      assert.equal(hover.cards.javelin.why, "hover", line(hover));
      assert.equal(hover.cards.javelin.overlays, 0);
      assert.deepEqual(errors, []);
      await ctx.close();
    });

    await sub(t, "a phone flick that starts on a card's slider is not intent; a tap on the slider is", async () => {
      const { ctx, page, errors } = await open(PHONE);
      await ready(page);
      const cdp = await ctx.newCDPSession(page);
      const slider = (k) => page.evaluate((key) => {
        const r = document.querySelector(`.project-card[data-project="${key}"] [data-explode-control]`).getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
      }, k);
      // The scanner card drawing on screen; a fast vertical flick starts with the thumb on its slider
      // (touch-action: pan-y, so the page scrolls).
      await page.evaluate((top) => scrollTo({ top, behavior: "instant" }), await stopKeyTop(page, "scanner", 0.3));
      await page.waitForFunction(() => window.__cardDraw.cards.scanner.phase === "playing", null, { timeout: 6000 });
      const at = await slider("scanner");
      assert.ok(at.y > 60 && at.y < 784, `the slider is on screen (${at.y})`);
      const y0 = await page.evaluate(() => scrollY);
      await flick(cdp, 300, 3000, at.x, at.y);
      await settleScroll(page, 300, 8000);
      assert.ok((await page.evaluate(() => scrollY)) - y0 > 150, "the flick scrolled the page");
      // Back to it, calm: it draws (from the start if it left the screen), never settled by the touch.
      await page.evaluate((top) => scrollTo({ top, behavior: "instant" }), await stopKeyTop(page, "scanner", 0.3));
      await page.waitForFunction(() => window.__cardDraw.cards.scanner.phase === "done", null, { timeout: 8000 });
      const flicked = await state(page);
      assert.ok(drew(flicked.cards.scanner), `the scanner still drew (${flicked.cards.scanner.phase}:${flicked.cards.scanner.why}/${flicked.cards.scanner.settledBy})`);
      assert.equal(flicked.cards.scanner.settledBy, "");
      // A tap on the pool card's slider while it draws settles it to its cover (and the slider takes over).
      await page.evaluate((top) => scrollTo({ top, behavior: "instant" }), await stopKeyTop(page, "pool", 0.3));
      await page.waitForFunction(() => window.__cardDraw.cards.pool.phase === "playing", null, { timeout: 6000 });
      const tap = await slider("pool");
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: tap.x, y: tap.y, id: 1 }] });
      await sleep(60);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await sleep(500);
      const tapped = await state(page);
      assert.equal(tapped.cards.pool.settledBy, "touch-control", line(tapped));
      assert.equal(tapped.cards.pool.overlays, 0);
      await cdp.detach();
      assert.deepEqual(errors, []);
      await ctx.close();
    });

    await sub(t, "reduced motion and data saver keep the covers", async () => {
      for (const [opts, init, reason] of [[{ ...DESKTOP, reducedMotion: "reduce" }, null, "reduced-motion"],
        [DESKTOP, `Object.defineProperty(Navigator.prototype, "connection", { configurable: true, get: () => Object.assign(new EventTarget(), { saveData: true, effectiveType: "4g", downlink: 10, rtt: 50 }) });`, "save-data"]]) {
        const { ctx, page, errors } = await open(opts, init);
        await page.waitForFunction(() => window.__cardDraw && window.__cardDraw.reason, null, { timeout: 15000 });
        await wheelTo(page, await stopKeyTop(page, "pool"), 3000);
        await sleep(1500);
        const s = await state(page);
        assert.equal(s.reason, reason);
        assert.equal(Object.values(s.cards).reduce((n, c) => n + c.overlays, 0), 0, `${reason}: no overlay anywhere`);
        assert.deepEqual(errors, []);
        await ctx.close();
      }
    });

    await sub(t, "a reload still replays; Back still does not", async () => {
      const { ctx, page, errors } = await open();
      await ready(page);
      await page.evaluate((top) => scrollTo({ top, behavior: "instant" }), await stopKeyTop(page, "pool"));
      await settleScroll(page);
      await assertStopDraws(page, "first load");
      await page.reload({ waitUntil: "load" });
      await ready(page);
      assert.equal(await page.evaluate(() => Math.round(scrollY)), 0, "the reload lands at the top");
      await page.evaluate((top) => scrollTo({ top, behavior: "instant" }), await stopKeyTop(page, "pool"));
      await settleScroll(page);
      await assertStopDraws(page, "reload");
      await page.goto(`${base}/case-study.html?project=steering`, { waitUntil: "load" });
      await sleep(800);
      await page.goBack({ waitUntil: "load" });
      await sleep(1500);
      const back = await state(page);
      assert.deepEqual([back.enabled, back.reason], [false, "back-forward"]);
      assert.equal(Object.values(back.cards).reduce((n, c) => n + c.overlays, 0), 0);
      assert.deepEqual(errors, []);
      await ctx.close();
    });

    // ---- detail pages (project-motion-arrival.js) ----
    // Per frame: the arrival's phase and whether its stage is on screen.
    const DETAIL_PROBE = `(() => {
      const log = window.__da = { drawOn: 0, drawOff: 0 };
      const tick = () => {
        const s = window.__caseArrival && window.__caseArrival.getState ? window.__caseArrival.getState() : null;
        const m = document.querySelector(".case-animation-host > .card-media");
        if (s && m && s.phase === "drawing") { const r = m.getBoundingClientRect(); if (r.bottom > 0 && r.top < innerHeight) log.drawOn += 1; else log.drawOff += 1; }
        requestAnimationFrame(tick);
      };
      addEventListener("DOMContentLoaded", () => requestAnimationFrame(tick));
    })();`;
    // The page with its arrival waiting in pencil below the fold. On a loaded machine the live model can be
    // ready before the sheets have decoded, and the held print then gives the cover back ('late', R1 rule,
    // not this change): that load is not this test's subject, so it is retried (at most 3 loads).
    const openDetail = async (url, opts) => {
      const tried = [];
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const ctx = await browser.newContext(opts);
        await ctx.addInitScript(DETAIL_PROBE);
        const page = await ctx.newPage();
        const errors = [];
        page.on("pageerror", (e) => errors.push(String(e)));
        await page.goto(`${base}/${url}`, { waitUntil: "load" });
        await page.waitForFunction(() => window.__caseArrival && ["pencil", "off", "settled"].includes(window.__caseArrival.getState().phase), null, { timeout: 15000 }).catch(() => {});
        const s = await page.evaluate(() => window.__caseArrival && window.__caseArrival.getState());
        if (s && s.phase === "pencil") {
          const stage = await page.evaluate(() => { const r = document.querySelector(".case-animation-host > .card-media").getBoundingClientRect(); return { top: Math.round(r.top + scrollY), bottom: Math.round(r.bottom + scrollY), H: innerHeight }; });
          return { ctx, page, errors, stage, cdp: await ctx.newCDPSession(page) };
        }
        tried.push(s ? `${s.phase}:${s.reason}` : "no arrival");
        await ctx.close();
      }
      throw new Error(`${url}: no pencil arrival in 3 loads (${tried.join(", ")})`);
    };
    const arrivalState = (page) => page.evaluate(() => ({ ...window.__caseArrival.getState(), log: window.__da }));
    const settled = (page) => page.waitForFunction(() => ["settled", "off"].includes(window.__caseArrival.getState().phase), null, { timeout: 8000 });

    await sub(t, "detail pages: a flick past an unpinned stage leaves the drawing in pencil; it draws when the stage is back", async () => {
      // 844x390 (a phone held sideways): under 600 px tall the story is not pinned, so the stage scrolls away.
      const LANDSCAPE = { ...PHONE, viewport: { width: 844, height: 390 } };
      for (const url of ["case-study.html?project=scanner", "project-3d.html?project=steering"]) {
        const { ctx, page, errors, stage, cdp } = await openDetail(url, LANDSCAPE);
        for (let i = 0; i < 12 && (await page.evaluate(() => scrollY)) < stage.bottom + 60; i += 1) { await flick(cdp, 195, 3000, 8, 330); await sleep(100); }
        await settleScroll(page);
        const away = await arrivalState(page);
        assert.ok(await page.evaluate(() => scrollY) > stage.bottom, `${url}: the flick went past the stage`);
        assert.equal(away.phase, "pencil", `${url}: still waiting (${JSON.stringify(away)})`);
        // Between two flicks the momentum may calm long enough to start it; the next flick then took it off
        // screen and it went back to pencil (one frame passes before the observer reports the stage gone).
        assert.ok(away.log.drawOff <= 3, `${url}: nothing was drawn off screen (${away.log.drawOff} frames)`);
        await page.evaluate((y) => scrollTo({ top: y, behavior: "instant" }), Math.max(0, stage.top - Math.round(stage.H * 0.2)));
        await settled(page);
        const back = await arrivalState(page);
        assert.equal(back.phase, "settled", `${url}: drawn on return (${back.reason})`);
        assert.equal(back.rushed, false);
        assert.ok(back.log.drawOff <= 3, `${url}: drawn on screen (${back.log.drawOff} frames off)`);
        await cdp.detach();
        assert.deepEqual(errors, []);
        await ctx.close();
      }
    });

    await sub(t, "detail pages: a drawing left mid-way goes back to pencil and draws again; a scroll into the story still finishes it", async () => {
      for (const url of ["case-study.html?project=steering", "project-3d.html?project=scanner"]) {
        // Toward the stage at reading pace until it starts, then a fast flick back up, away from it.
        const { ctx, page, errors, stage, cdp } = await openDetail(url, PHONE);
        for (let i = 0; i < 400 && (await arrivalState(page)).phase === "pencil"; i += 1) { await page.evaluate(() => scrollBy({ top: 8, behavior: "instant" })); await sleep(16); }
        assert.equal((await arrivalState(page)).phase, "drawing");
        await sleep(150);
        const y = await page.evaluate(() => scrollY);
        await flick(cdp, -Math.min(600, Math.max(250, y + 100)), 3000, 8, 120);
        await settleScroll(page);
        const away = await arrivalState(page);
        assert.equal(away.phase, "pencil", `${url}: back to pencil (${JSON.stringify(away)})`);
        assert.ok(away.rewinds >= 1);
        await page.evaluate((top) => scrollTo({ top, behavior: "instant" }), Math.max(0, stage.top - Math.round(stage.H * 0.4)));
        await settled(page);
        const back = await arrivalState(page);
        assert.equal(back.phase, "settled", `${url}: drawn again (${back.reason})`);
        assert.ok(back.log.drawOff <= 3, `${url}: ${back.log.drawOff} frames drawn off screen`);
        await cdp.detach();
        assert.deepEqual(errors, []);
        await ctx.close();
        // A fast flick into the pinned story: the story needs its stage, so the drawing is rushed, not held.
        const story = await openDetail(url, PHONE);
        for (let i = 0; i < 4; i += 1) { await flick(story.cdp, 420, 3000, 8, 700); await sleep(100); }
        await settled(story.page);
        const rushed = await arrivalState(story.page);
        assert.equal(rushed.phase, "settled");
        assert.equal(rushed.rushed, true, `${url}: rushed by the story`);
        await story.cdp.detach();
        assert.deepEqual(story.errors, []);
        await story.ctx.close();
      }
    });
  } finally {
    await browser.close();
    await server.close();
  }
});
