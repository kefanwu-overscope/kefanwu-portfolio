// Hero pen (pen-20261110, PEN_SPEC sections 11, 13 and 5.5): index.html's inline data block and engine are
// exactly what tools/hero-pen/engine/build.cjs makes from the traced art (tools/hero-pen/out/strokes.json) and
// the readable engine (tools/hero-pen/engine/engine.js); the art's provenance hashes hold; every class's schedule
// is one pen (sequential) and inside the build limits. In Chrome (when Playwright is found), each class runs on
// the real page with the generator's own hash and schedule and ends on today's DOM.
//
//   node --test tools/hero-tests/hero-pen.test.cjs
//   (Playwright with Chrome: set PLAYWRIGHT_MODULE to its folder if it is not resolvable as "playwright";
//   PEN_TEST_PORT chooses the local server's port (default: HERO_TEST_PORT + 3, otherwise any free port).
//   Without Playwright the Chrome test is skipped and the static checks still run.)
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const http = require("http");
const path = require("path");
const crypto = require("crypto");
const vm = require("vm");
const zlib = require("zlib");

const SITE = path.resolve(__dirname, "../..");
const PEN = path.join(SITE, "tools/hero-pen");
const B = require(path.join(PEN, "engine/build.cjs"));
const SV = require(path.join(PEN, "engine/solve.cjs"));
// A checkout may hold LF or CRLF (core.autocrlf), so text is read with CRLF folded to LF. out/provenance.json records
// the SHA256 of each file's bytes as they lie on disk, and some tools/hero-pen files are CRLF there: the JSON that
// common.py's dump_json and features.py write with Path.write_text (CRLF on Windows: strokes.json, features.json) and
// sources saved with CRLF (build_art.py, trace.py, glyph-order.json, inventory-guides.json and others).
// .gitattributes ("tools/hero-pen/** -text") commits and checks out tools/hero-pen byte for byte, so those hashes hold.
const read = (file) => fs.readFileSync(path.join(SITE, file), "utf8").replace(/\r\n/g, "\n");
const sha256 = (buf) => crypto.createHash("sha256").update(buf).digest("hex");
// a recorded hash holds for the file's bytes, or for its LF form (a CRLF checkout of a text file outside tools/hero-pen,
// such as tools/hero-drawing/trace_lines.py, whose recorded hash is of its LF bytes)
const hashOk = (file, want) => {
  const raw = fs.readFileSync(path.join(SITE, file));
  return sha256(raw) === want || sha256(Buffer.from(raw.toString("utf8").replace(/\r\n/g, "\n"))) === want;
};
const br3 = (s) => zlib.brotliCompressSync(Buffer.from(s), { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 3 } }).length;

const html = read("index.html");
const art = JSON.parse(read("tools/hero-pen/out/strokes.json"));
const prov = JSON.parse(read("tools/hero-pen/out/provenance.json"));
const built = B.build({ in: path.join(PEN, "out/strokes.json"), gate: "fail", quiet: true, write: false });
const CLASSES = ["D", "T", "P"];
const dataMatch = /<script type="text\/plain" id="hero-pen-data">\n([\s\S]*?)\n<\/script>\n\s*<script>([\s\S]*?)<\/script>/.exec(html);
const data = dataMatch ? dataMatch[1] : "";
const engine = dataMatch ? dataMatch[2] : "";

test("index.html carries exactly this build's block (data + minified engine) in place of the old hero", () => {
  assert.ok(dataMatch, "script#hero-pen-data followed by the inline engine");
  assert.ok(html.includes(built.block), "the block differs from a fresh build of out/strokes.json and engine.js (run engine/build.cjs --page ... --site <label>)");
  assert.equal(data, built.data);
  assert.equal(engine, built.engineMin);
  const inv = B.pageInvariants(html, built.block);
  assert.ok(inv.ok, JSON.stringify(inv));
  assert.doesNotMatch(html, /hero-drawing-20261027\.js|hero-lines\.svg|<svg[^>]*data-car=/, "no reference to the old drawing is left");
  assert.doesNotMatch(html, /hero-pen-test-style/, "the test page's style is not shipped (its rules are in white-home-20261011.css)");
  assert.match(html, /<div class="hero-draw-lines" aria-hidden="true" hidden><canvas data-layer="guide"><\/canvas><canvas data-layer="shade"><\/canvas><canvas data-layer="ink"><\/canvas><\/div>/);
  assert.ok(html.indexOf('id="hero-pen-data"') > html.indexOf('class="hero-draw-lines"'), "the block comes after the canvases (end of body)");
  new vm.Script(engine, { filename: "inline-engine.js" });   // parses
  assert.doesNotMatch(engine, /sessionStorage|localStorage|Math\.random/, "no session memory, no per-load randomness");
});

test("the block parses: header, stroke lines, one schedule per class", () => {
  const L = data.split("\n");
  assert.equal(L[0], `HP1 2200 1238 ${art.car_box.join(" ")} ${art.seed}`);
  const strokes = L.slice(1).filter((l) => l[0] !== "T"), T = L.filter((l) => l[0] === "T");
  assert.deepEqual(T.map((l) => l.slice(0, 3)), ["T P", "T T", "T D"]);
  for (const l of strokes) {
    assert.match(l, /^[gcyafdnh][0-5][1-7][0-7] -?\d+ -?\d+( (\||-?\d+))+$/, l.slice(0, 40));
    const s = B.core.decode(l);
    assert.ok(s.n >= 2 && s.L > 0, l.slice(0, 40));
  }
  for (const l of T) assert.match(l, /^T [PTD]( \d+)+$/);
  assert.equal(L.length, 1 + strokes.length + 3);
});

test("class counts equal the generator's (D 87, T 44, P 36: the art's strokes without its P5 accents)", () => {
  for (const c of CLASSES) {
    const pk = B.core.pick(data, c);
    assert.equal(pk.L.length, built.out.counts[c], c);
    assert.equal(pk.T.length, 2 * pk.L.length, `${c}: one [gap, duration] per stroke`);
    assert.equal(built.out.counts[c], art.counts[c].total - (art.counts[c].by_phase["5"] || 0), `${c}: the build drops only the P5 accents`);
  }
  assert.deepEqual(built.out.counts, { D: 87, T: 44, P: 36 });   // fix r2: P also draws rear-tube-level
});

test("one pen: every schedule is sequential (no negative gap, every stroke lasts) and hash-equal to the generator's", () => {
  for (const c of CLASSES) {
    const pk = B.core.pick(data, c);
    const pairs = [];
    for (let i = 0; i < pk.T.length; i += 2) pairs.push([pk.T[i], pk.T[i + 1]]);
    assert.deepEqual(pairs, built.out.schedules[c], c);
    assert.ok(pairs.every(([g, d]) => g >= 0 && d > 0), `${c}: start[i] >= end[i-1] and every duration > 0`);
    assert.equal(pk.hash, built.out.hashes[c], c);
    assert.ok(built.out.classes[c].sequential, c);
    assert.ok(built.out.classes[c].phaseOrder, `${c}: the phase never steps back`);
  }
});

test("provenance: the photo, the inputs, the tools and strokes.json are the files recorded", () => {
  assert.equal(prov.photo.file, "assets/hero-fsae-track-2200.webp");
  assert.ok(hashOk(prov.photo.file, prov.photo.sha256), "photo");
  assert.equal(art.photo_sha256, prov.photo.sha256);
  for (const [f, h] of Object.entries(prov.inputs)) assert.ok(hashOk(`tools/hero-pen/inputs/${f}`, h), `input ${f}`);
  for (const [f, h] of Object.entries(prov.tools)) assert.ok(hashOk(`tools/hero-pen/${f}`, h), `tool ${f}`);
  for (const [f, h] of Object.entries(prov.imported)) assert.ok(hashOk(f, h), `imported ${f}`);
  assert.ok(hashOk("tools/hero-pen/out/strokes.json", prov.strokes_json_sha256), "strokes.json (the art the inline block is built from)");
  assert.deepEqual(prov.counts, art.counts);
  assert.equal(built.out.seed, prov.seed);
  for (const s of art.strokes) assert.ok(["traced", "fitted", "derived", "convention"].includes(s.prov), `${s.id}: a provenance kind`);
  assert.deepEqual(built.out.gates.violations, [], "no content gate fails");
});

test("PEN_SPEC 5.5 build limits hold for every class", () => {
  for (const c of CLASSES) {
    const k = built.out.classes[c];
    assert.ok(k.lastInk <= SV.K.LIMIT[c], `${c}: last ink ${k.lastInk} > ${SV.K.LIMIT[c]}`);
    assert.ok(k.p1Len >= 1000, `${c}: P1 length ${k.p1Len}`);
    assert.ok(k.p1Start <= 600, `${c}: first P1 start ${k.p1Start}`);
    assert.deepEqual(k.frameViolations, [], c);
    assert.equal(k.windows.overEndCap, 0, `${c}: window end cap`);
    assert.equal(k.windows.overInk040, 0, `${c}: ink cap 0.40 cw per frame`);
    assert.equal(k.windows.localityOver025, 0, `${c}: locality 0.25 cw`);
    assert.equal(k.framesWithMoreThanOnePartial, 0, `${c}: at most one partial stroke per frame`);
    assert.ok(k.limitsOk, c);
  }
  // the owner's request through the main loop's targets (revision 5): D last ink <= 4.2 s, photo in by 5.3 s
  assert.ok(built.out.classes.D.lastInk <= 4200 && built.out.classes.D.photoInMs <= 5300);
  assert.ok(br3(`<script type="text/plain" id="hero-pen-data">\n${data}\n</script>`) <= 9216, "data block <= 9 KB brotli q3");
  // PEN_SPEC 5.5 says 6 KB for the engine; the main loop allowed 6.5 KB (6656 B) from revision 4 (the numeral
  // motion). An agent decision, recorded in tools/hero-pen/README.md.
  assert.ok(br3(engine) <= 6656, `engine br3 ${br3(engine)} > 6656`);
});

let chromium = null;
try { ({ chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright")); } catch (e) { /* skipped below */ }
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".woff2": "font/woff2", ".jpg": "image/jpeg", ".pdf": "application/pdf" };

test("in Chrome, each class draws with the generator's hash and schedule, and ends on today's DOM", { skip: !chromium && "Playwright not found (set PLAYWRIGHT_MODULE)" }, async (t) => {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p.endsWith("/")) p += "index.html";
    const file = path.join(SITE, p);
    if (!file.startsWith(SITE) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream", "cache-control": "no-store" });
    fs.createReadStream(file).pipe(res);
  });
  const port = Number(process.env.PEN_TEST_PORT || (process.env.HERO_TEST_PORT ? Number(process.env.HERO_TEST_PORT) + 3 : 0));
  await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || "chrome" });
  const sizes = {
    D: { viewport: { width: 1440, height: 900 } },
    T: { viewport: { width: 768, height: 1024 }, deviceScaleFactor: 2 },
    P: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  };
  try {
    for (const c of CLASSES) {
      await t.test(`class ${c} at ${sizes[c].viewport.width}x${sizes[c].viewport.height}`, async () => {
        const ctx = await browser.newContext(sizes[c]);
        const page = await ctx.newPage();
        const errors = [];
        page.on("pageerror", (e) => errors.push(String(e)));
        page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
        await page.goto(`${base}/index.html`, { waitUntil: "load" });
        await page.waitForFunction(() => window.__heroDraw && window.__heroDraw.state === "done", null, { timeout: 15000 });
        const r = await page.evaluate(() => {
          const h = window.__heroDraw;
          return { cls: h.cls, n: h.n, hash: h.hash, schedule: h.schedule, lastInk: h.lastInk, devStart: h.devStart, linesAt: h.linesAt, inkedAt: h.inkedAt, doneAt: h.doneAt,
            settledBy: h.settledBy, error: h.error, arm: h.arm, armedAt: h.armedAt,
            nodes: document.querySelectorAll(".hero-draw-veil, .hero-draw-lines, #hero-pen-data, .hero-draw-lines canvas").length,
            htmlClass: document.documentElement.className, pen: document.documentElement.getAttribute("data-hero-pen") };
        });
        await ctx.close();
        assert.deepEqual(errors, []);
        assert.equal(r.error, undefined);
        assert.equal(r.cls, c);
        assert.equal(r.n, built.out.counts[c]);
        assert.equal(r.hash, built.out.hashes[c]);
        let at = 0;
        assert.deepEqual(r.schedule, built.out.schedules[c].map(([g, d]) => { at += g; const s = [at, d]; at += d; return s; }));
        assert.equal(r.lastInk, built.out.classes[c].lastInk);
        assert.equal(r.settledBy, undefined, "nothing settled it");
        assert.ok(r.linesAt > 0, "the lines were shown");
        assert.ok(r.devStart >= r.lastInk + 100 - 1, `the develop starts after the last ink (${r.devStart}, last ink ${r.lastInk})`);
        assert.ok(r.inkedAt > r.linesAt && r.inkedAt <= r.doneAt, "html.hero-draw-inked came between the first and the last frame");
        assert.equal(r.arm, "now");
        assert.equal(r.armedAt, 0);
        assert.equal(r.nodes, 0, "no drawing node is left");
        assert.equal(r.htmlClass, "js");
        assert.equal(r.pen, null);
      });
    }
    // fix-r1: the inline engine still runs after the parser-blocking scripts before it. With script.js held back,
    // it starts just before (3000 ms), while (3200 ms) or after (3850 ms) the CSS failsafe reveals the photo: the CSS keeps the reveal, the
    // veil is never opaque white again once the photo began to show, and no line is drawn. With intent during
    // that fade (wheel), the rest of the fade plays at 3x and the engine finishes within about 190 ms.
    for (const [delay, intent] of [[3850, false], [3200, false], [3000, true]]) {
      await t.test(`late engine (script.js held ${delay} ms${intent ? ", then a wheel" : ""}) leaves the reveal to the CSS`, async () => {
        const ctx = await browser.newContext(sizes.D);
        const page = await ctx.newPage();
        const errors = [];
        page.on("pageerror", (e) => errors.push(String(e)));
        page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
        await page.route(/\/script\.js(\?|$)/, async (route) => { await new Promise((r) => setTimeout(r, delay)); await route.continue(); });
        await page.addInitScript(() => {
          const S = (window.__veil = []);
          let last = "";
          const rec = () => {
            const v = document.querySelector(".hero-draw-veil");
            let a = -1;                 // -1: no veil painting (gone, display none or hidden)
            if (v) {
              const cs = getComputedStyle(v);
              if (cs.display !== "none" && cs.visibility !== "hidden") {
                // the engine's own paint counts as opaque; the failsafe's fade ends at rgba(0, 0, 0, 0)
                const m = /rgba?\([\d.]+, [\d.]+, [\d.]+(?:, ([\d.]+))?\)/.exec(cs.backgroundColor);
                a = v.style.background ? 1 : m ? (m[1] != null ? +m[1] : 1) : 1;
              }
            }
            const k = String(a);
            if (k !== last) { S.push([Math.round(performance.now()), a]); last = k; }
          };
          const tick = () => { rec(); requestAnimationFrame(tick); };
          requestAnimationFrame(tick);
          const iv = setInterval(rec, 4);
          setTimeout(() => clearInterval(iv), 15000);
        });
        await page.goto(`${base}/index.html`, { waitUntil: "commit" });
        let wheelAt = -1;
        if (intent) {
          await page.waitForFunction(() => window.__heroDraw && window.__heroDraw.state === "late", null, { timeout: 15000, polling: 10 });
          await page.mouse.move(700, 450);
          await page.mouse.wheel(0, 1);
          wheelAt = await page.evaluate(() => performance.now());
        }
        await page.waitForFunction(() => window.__heroDraw && window.__heroDraw.state === "done", null, { timeout: 15000 });
        const r = await page.evaluate(() => {
          const h = window.__heroDraw;
          return { failsafeAt: h.failsafeAt, linesAt: h.linesAt, t0: h.t0, inkedAt: h.inkedAt, doneAt: h.doneAt, settledBy: h.settledBy, error: h.error, veil: window.__veil,
            nodes: document.querySelectorAll(".hero-draw-veil, .hero-draw-lines, #hero-pen-data").length, htmlClass: document.documentElement.className,
            pen: document.documentElement.getAttribute("data-hero-pen") };
        });
        await ctx.close();
        assert.deepEqual(errors, []);
        assert.equal(r.error, undefined);
        assert.ok(r.failsafeAt > 2400, `the engine took the late path (failsafe at ${r.failsafeAt} ms)`);
        assert.equal(r.linesAt, undefined, "no line was shown");
        assert.equal(r.t0, undefined, "the pen never started");
        assert.ok(r.inkedAt >= 0, "html.hero-draw-inked: no ink will come");
        let opaque = 0, shown = -1;
        for (const [at, a] of r.veil) {
          if (a >= 0.99) opaque = 1;
          if (opaque && a < 0.9 && shown < 0) shown = at;
          assert.ok(!(shown >= 0 && a >= 0.99), `the veil went back to opaque white at ${at} ms after the photo began to show at ${shown} ms: ${JSON.stringify(r.veil)}`);
        }
        assert.ok(shown > 0, "the photo was revealed by the CSS failsafe");
        if (intent) {
          assert.equal(r.settledBy, "wheel");
          assert.ok(r.doneAt - wheelAt < 400, `intent finished the late reveal in ${Math.round(r.doneAt - wheelAt)} ms`);
        } else {
          assert.equal(r.settledBy, undefined);
          assert.ok(r.doneAt > shown, "the engine cleaned up after the CSS reveal");
        }
        assert.equal(r.nodes, 0, "no drawing node is left");
        assert.equal(r.htmlClass, "js");
        assert.equal(r.pen, null);
      });
    }
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
});
