// Hero line drawing: the inline copy, the public SVG and provenance.json agree, and the geometry
// precomputed by tools/hero-drawing/inline_hero_svg.cjs matches Chrome's own measurements.
//
//   node --test tools/hero-tests/hero-drawing.test.cjs
//   (Playwright with Chrome; set PLAYWRIGHT_MODULE to its folder if it is not resolvable as
//   "playwright". Without it the Chrome test is skipped and the static checks still run.)
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFileSync } = require("child_process");

const SITE = path.resolve(__dirname, "../..");
// A checkout may hold LF or CRLF (core.autocrlf): the generator writes LF, and hashes are of that.
const read = (file) => fs.readFileSync(path.join(SITE, file), "utf8").replace(/\r\n/g, "\n");
const sha256 = (text) => crypto.createHash("sha256").update(text).digest("hex");
const html = read("index.html");
const inline = /<div class="hero-draw-lines" aria-hidden="true" hidden>(<svg[\s\S]*?<\/svg>)<\/div>/.exec(html)[1];
const publicSvg = read("assets/hero-drawing-20261027/hero-lines.svg");
const prov = JSON.parse(read("assets/hero-drawing-20261027/provenance.json"));
const paths = (svg) => {
  const out = [];
  let group = "";
  for (const m of svg.matchAll(/<g data-group="(\w+)"|<path d="([^"]+)"[^>]*data-o="([\d.]+)"/g)) {
    if (m[1]) group = m[1];
    else out.push({ group, d: m[2], o: m[3] });
  }
  return out;
};

test("inline_hero_svg.cjs --check: index.html, hero-lines.svg and provenance.json are current", () => {
  execFileSync(process.execPath, [path.join(SITE, "tools/hero-drawing/inline_hero_svg.cjs"), "--check"], { stdio: "pipe" });
});

test("the public SVG has the inline drawing's paths and groups; provenance describes that file", () => {
  const a = paths(inline), b = paths(publicSvg);
  assert.equal(a.length, 30);
  assert.deepEqual(b, a);
  const groups = {};
  for (const p of a) groups[p.group] = (groups[p.group] || 0) + 1;
  assert.deepEqual(groups, { guide: 2, silhouette: 7, structure: 14, detail: 4, ground: 3 });
  assert.deepEqual(prov.svg.groups, groups);
  assert.equal(prov.svg.paths, 30);
  assert.equal(prov.svg.sha256, sha256(publicSvg));
  assert.equal(prov.homepage_inline.inline_sha256, sha256(`<div class="hero-draw-lines" aria-hidden="true" hidden>${inline}</div>`));
  assert.equal(publicSvg.trim(), inline.replace(' viewBox="0 0 2200 1238"', ' viewBox="0 0 2200 1238" width="2200" height="1238"'));
});

let chromium = null;
try { ({ chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright")); } catch (e) { /* skipped below */ }

test("precomputed lengths, points and car box match Chrome", { skip: !chromium && "Playwright not found (set PLAYWRIGHT_MODULE)" }, async () => {
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || "chrome" });
  try {
    const page = await browser.newPage();
    await page.setContent(`<!doctype html><body style="margin:0"><div style="width:2200px;height:1238px">${inline.replace("<svg ", '<svg style="width:2200px;height:1238px;display:block" ')}</div></body>`);
    const r = await page.evaluate(() => {
      const svg = document.querySelector("svg");
      let len = 0, pt = 0;
      for (const p of svg.querySelectorAll("path")) {
        const L = p.getTotalLength();
        len = Math.max(len, Math.abs(L - parseFloat(p.dataset.len)));
        const f = p.dataset.pts.split(" ").map(Number);
        if (f.length !== 42) return { bad: p.dataset.o };
        for (let i = 0; i <= 20; i += 1) { const q = p.getPointAtLength((L * i) / 20); pt = Math.max(pt, Math.hypot(q.x - f[2 * i], q.y - f[2 * i + 1])); }
      }
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const g of svg.querySelectorAll('[data-group="silhouette"], [data-group="structure"]')) {
        const b = g.getBBox(); x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.width); y1 = Math.max(y1, b.y + b.height);
      }
      const car = svg.dataset.car.split(" ").map(Number);
      return { len, pt, box: Math.max(...car.map((v, i) => Math.abs(v - [x0, y0, x1, y1][i]))) };
    });
    assert.equal(r.bad, undefined, `path ${r.bad} lacks 21 points`);
    assert.ok(r.len <= 0.1, `length off by ${r.len} px`);
    assert.ok(r.pt <= 0.75, `point off by ${r.pt} px (data-pts are rounded to 1 px)`);
    assert.ok(r.box <= 0.1, `car box off by ${r.box} px`);
  } finally {
    await browser.close();
  }
});
