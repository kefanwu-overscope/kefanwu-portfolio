// refresh-20261120, homepage filters and search in Chrome (script.js applyProjectFilter, the FLIP).
// The label is not enough: a card the filter or the search leaves out must really leave the grid
// (computed display none once its fade ends) and the grid must shrink. Found in fix round 1: a
// card rule in home-20261120.css (0,3,0) beat styles.css's `.project-card.is-hidden` (0,2,0), so
// the label said "Showing 4 of 16" while all 16 cards stayed on screen.
// Also: a leaving card fades where it stood (its words do not move while it fades), entering cards
// fade in, and under reduced motion the change is instant.
// Found in round r2: a card still gliding when the next filter or search change landed, and left out
// by it, lost its subgrid rows (they were matched from a rect that included the running glide), so
// its title rode up over its image while it faded. The mid-glide case below covers it.
//
//   node --test tools/hero-tests/home-filter.test.cjs
//   (Playwright with Chrome: set PLAYWRIGHT_MODULE to its folder if it is not resolvable as "playwright";
//   FILTER_TEST_PORT chooses the local server's port (default: HERO_TEST_PORT + 4, otherwise any free port).
//   Without Playwright it is skipped. About 40 seconds.)
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
const SIZES = [
  ["1440x900", { viewport: { width: 1440, height: 900 } }],
  ["390x844 touch", { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }],
  ["1440x900 reduced motion", { viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" }],
];

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
  const port = Number(process.env.FILTER_TEST_PORT || (process.env.HERO_TEST_PORT ? Number(process.env.HERO_TEST_PORT) + 4 : 0));
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve({
    base: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((r) => server.close(r)),
  })));
}

const grid = (page) => page.evaluate(() => {
  const cards = [...document.querySelectorAll("#project-cards .project-card[data-project]")];
  const shown = (c) => getComputedStyle(c).display !== "none" && c.getBoundingClientRect().height > 0;
  const empty = document.querySelector(".search-empty");
  return {
    label: document.getElementById("filter-status").textContent,
    hidden: cards.filter((c) => c.classList.contains("is-hidden")).map((c) => [c.dataset.project, getComputedStyle(c).display]),
    shown: cards.filter(shown).map((c) => c.dataset.project),
    height: Math.round(document.getElementById("project-cards").getBoundingClientRect().height),
    empty: Boolean(empty && !empty.hidden && getComputedStyle(empty).display !== "none"),
    leftovers: cards.filter((c) => c.style.position || c.style.display || c.inert).map((c) => c.dataset.project),
    animating: cards.filter((c) => c.getAnimations().length).length,
  };
});
// Every card the filter leaves out computes display none, the rest are on screen.
function assertHidden(g, count, label) {
  assert.equal(g.label, `Showing ${count} of 16 projects`, label);
  assert.equal(g.hidden.length, 16 - count, `${label}: cards flagged hidden`);
  assert.deepEqual(g.hidden.filter(([, d]) => d !== "none"), [], `${label}: flagged hidden but still displayed`);
  assert.equal(g.shown.length, count, `${label}: cards on screen ${g.shown.join(",")}`);
  assert.deepEqual(g.leftovers, [], `${label}: inline leave styles left behind`);
  assert.equal(g.animating, 0, `${label}: animations still running`);
}

test("homepage filters and search hide the cards they leave out", { skip: !chromium && "Playwright not found (set PLAYWRIGHT_MODULE)" }, async (t) => {
  const server = await startServer();
  const browser = await chromium.launch({ channel: process.env.HERO_TEST_CHANNEL || "chrome", headless: true, args: ARGS })
    .catch(() => chromium.launch({ headless: true, args: ARGS }));
  try {
    for (const [name, opts] of SIZES) {
      await t.test(name, async () => {
        const ctx = await browser.newContext(opts);
        const page = await ctx.newPage();
        const errors = [];
        page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
        page.on("pageerror", (e) => errors.push(String(e)));
        await page.goto(`${server.base}/index.html?hero=photo`, { waitUntil: "load" });
        await sleep(800);
        const reduced = Boolean(opts.reducedMotion);
        const all = await grid(page);
        assert.equal(all.shown.length, 16, "all 16 cards at first");
        await page.evaluate(() => document.getElementById("project-cards").scrollIntoView({ block: "start" }));
        await sleep(1000);   // the smooth scroll ends (page positions are compared in any case)
        // Motorsport: vineRobot leaves. Its fade (160 ms) keeps it where it stood and its words do not
        // move; once the fade ends it is gone.
        const leave = await page.evaluate(async () => {
          const card = document.getElementById("project-vineRobot");
          const parts = [".card-media", ".card-no", ".project-body h3", ".project-meta", "p.project-sub"].map((s) => card.querySelector(s));
          const rel = () => {
            const b = card.getBoundingClientRect();
            return [b.left + scrollX, b.top + scrollY, b.width, b.height, ...parts.flatMap((el) => {
              const q = el.getBoundingClientRect();
              return [q.left - b.left, q.top - b.top, q.width, q.height];
            })];
          };
          const before = rel();
          document.querySelector("button.filter[data-filter=motorsport]").click();
          let shift = 0, frames = 0, minOpacity = 1;
          for (let i = 0; i < 6; i += 1) {
            await new Promise((r) => requestAnimationFrame(r));
            if (getComputedStyle(card).display === "none") break;
            frames += 1;
            minOpacity = Math.min(minOpacity, Number(getComputedStyle(card).opacity));
            rel().forEach((v, k) => { shift = Math.max(shift, Math.abs(v - before[k])); });
          }
          return { shift, frames };
        });
        if (reduced) assert.equal(leave.frames, 0, "reduced motion: the card leaves at once");
        else {
          assert.ok(leave.frames >= 3, `the leaving card fades where it stood (${leave.frames} frames)`);
          assert.ok(leave.shift <= 1, `the leaving card's words move ${leave.shift.toFixed(1)} px while it fades`);
        }
        await sleep(700);
        const motorsport = await grid(page);
        assertHidden(motorsport, 4, `${name} Motorsport`);
        assert.ok(motorsport.height < all.height * 0.5, `the grid shrinks (${all.height} -> ${motorsport.height} px)`);
        // Back to All: the 12 cards come back, fading in (not under reduced motion).
        await page.locator("button.filter[data-filter=all]").click();
        const entering = await page.evaluate(() => [...document.querySelectorAll("#project-cards .project-card[data-project]")]
          .filter((c) => c.getAnimations().some((a) => a.effect.getKeyframes().some((k) => "opacity" in k))).length);
        if (reduced) assert.equal(entering, 0, "reduced motion: no fade");
        else assert.ok(entering >= 12, `entering cards fade in (${entering})`);
        await sleep(700);
        assertHidden(await grid(page), 16, `${name} All`);
        await page.locator("button.filter[data-filter=robotics]").click();
        await sleep(700);
        assertHidden(await grid(page), 8, `${name} Robotics`);
        await page.locator("button.filter[data-filter=all]").click();
        await sleep(700);
        await page.locator("#project-search").fill("brake");
        await sleep(700);
        const brake = await grid(page);
        assertHidden(brake, 1, `${name} search "brake"`);
        assert.deepEqual(brake.shown, ["brakeSim"]);
        await page.locator("#project-search").fill("zzzq");
        await sleep(700);
        const none = await grid(page);
        assertHidden(none, 0, `${name} search "zzzq"`);
        assert.equal(none.empty, true, "the no-match message shows");
        assert.equal(none.height, 0, "no card is left in the grid");
        await page.locator("#project-search").fill("");
        await sleep(700);
        const cleared = await grid(page);
        assertHidden(cleared, 16, `${name} search cleared`);
        assert.equal(cleared.empty, false);
        assert.equal(cleared.height, all.height, "the grid is back to its full height");
        // A second change while cards still glide: Fabrication, then Motorsport 120 ms later. A card that
        // is gliding (vertically) when Motorsport lands and is left out by it keeps its subgrid rows, so
        // its words stay where they were while it fades.
        if (!reduced) {
          const mid = await page.evaluate(async () => {
            const cards = [...document.querySelectorAll("#project-cards .project-card[data-project]")];
            const parts = [".card-media", ".card-no", ".project-body h3", ".project-meta", "p.project-sub"];
            const rel = (c) => {
              const b = c.getBoundingClientRect();
              return parts.flatMap((s) => {
                const q = c.querySelector(s).getBoundingClientRect();
                return [q.left - b.left, q.top - b.top];
              });
            };
            const glideY = (c) => {
              const t = getComputedStyle(c).translate;
              return t === "none" ? 0 : parseFloat(t.split(/\s+/)[1] || "0") || 0;
            };
            document.querySelector("button.filter[data-filter=fabrication]").click();
            await new Promise((r) => setTimeout(r, 120));
            const glide = new Map(cards.map((c) => [c, glideY(c)]));
            const before = new Map(cards.map((c) => [c, rel(c)]));
            document.querySelector("button.filter[data-filter=motorsport]").click();
            const leaving = cards.filter((c) => c.style.position === "absolute");
            const result = {
              leaving: leaving.length,
              glidingLeavers: leaving.filter((c) => Math.abs(glide.get(c)) > 1).map((c) => c.dataset.project),
              noRows: leaving.filter((c) => !c.style.gridTemplateRows).map((c) => c.dataset.project),
              shift: 0, titleOverMedia: 0, frames: 0,
            };
            for (let i = 0; i < 30; i += 1) {
              const live = leaving.filter((c) => c.style.position === "absolute");
              if (!live.length) break;
              result.frames += 1;
              live.forEach((c) => {
                rel(c).forEach((v, k) => { result.shift = Math.max(result.shift, Math.abs(v - before.get(c)[k])); });
                const title = c.querySelector(".project-body h3").getBoundingClientRect();
                if (title.top < c.querySelector(".card-media").getBoundingClientRect().bottom - 1) result.titleOverMedia += 1;
              });
              await new Promise((r) => requestAnimationFrame(r));
            }
            return result;
          });
          const info = JSON.stringify(mid);
          assert.ok(mid.glidingLeavers.length >= 1, `a card still gliding vertically leaves on the second change ${info}`);
          assert.ok(mid.frames >= 3, `the leaving cards fade where they stood ${info}`);
          assert.deepEqual(mid.noRows, [], `every leaving card keeps its subgrid rows ${info}`);
          assert.ok(mid.shift <= 1, `the leaving cards' words move ${mid.shift.toFixed(1)} px while they fade ${info}`);
          assert.equal(mid.titleOverMedia, 0, `no leaving card's title rides up over its image ${info}`);
          await sleep(700);
          assertHidden(await grid(page), 4, `${name} Fabrication, then Motorsport mid-glide`);
          await page.locator("button.filter[data-filter=all]").click();
          await sleep(700);
          assertHidden(await grid(page), 16, `${name} back to All`);
        }
        assert.deepEqual(errors, []);
        await ctx.close();
      });
    }
  } finally {
    await browser.close();
    await server.close();
  }
});
