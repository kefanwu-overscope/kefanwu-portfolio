// Unit tests for the hero pen engine and build (node --test tools/hero-pen/test/).
// Decoder round trip within 0.5 src px; sequential schedules (start[i] >= end[i-1]); the frame rules of PEN_SPEC 5.5
// and 16.1 #4-#5 on a synthetic stroke set; determinism; the minified engine; gates; the minifier.
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path'), vm = require('vm'), zlib = require('zlib');
const B = require('../engine/build.cjs'), F = require('../engine/fit.cjs'), SV = require('../engine/solve.cjs'), MZ = require('../engine/minify.cjs');
const { fixture, circle, poly, line } = require('./fixture.cjs');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hero-pen-test-'));
const FIX = path.join(tmp, 'strokes.json');
fs.writeFileSync(FIX, JSON.stringify(fixture()));
const run = (extra = {}) => B.build({ in: FIX, out: path.join(tmp, 'out'), gate: 'warn', quiet: true, write: false, ...extra });
const ART = path.resolve(__dirname, '../out/strokes.json');
const br3 = (s) => zlib.brotliCompressSync(Buffer.from(s), { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 3 } }).length;
const first = run();
test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));

test('decoder round trip: every stroke within 0.5 src px of its input polyline', () => {
  const sets = [fixture().strokes];
  if (fs.existsSync(ART)) sets.push(B.normalize(JSON.parse(fs.readFileSync(ART, 'utf8'))).strokes);
  let n = 0;
  for (const list of sets) for (const s of list) {
    const e = B.encodeGeometry({ ...s, pts: s.pts.map((p) => [p[0], p[1]]) });
    const g = B.core.decode('d000 ' + e.toks);
    const err = F.hausdorff(F.resample(s.pts, 1), g.x.map((x, i) => [x, g.y[i]]));
    assert.ok(err <= 0.5, `${s.id}: ${err.toFixed(3)} src px`);
    assert.ok(e.toks.split(' ').every((t) => t === '|' || /^-?\d+$/.test(t)), `${s.id}: integer tokens only`);
    n++;
  }
  assert.ok(n > 50);
});

test('corners become submovement breaks; the pen stops there', () => {
  const s = { id: 'square', phase: 2, tier: 'f', kind: 'form', pts: poly([0, 0], [100, 0], [100, 100], [0, 100]) };
  const e = B.encodeGeometry(s);
  assert.equal(e.toks.split(' ').filter((t) => t === '|').length, 2);
  const g = B.core.decode('f270 ' + e.toks);
  assert.equal(g.sub.length, 3);
  // speed at the corner: the pen is at rest at the end of each submovement
  const at = (tau) => B.core.ptAt(g, B.core.posAt(g, tau));
  const tc = g.sub[0][3], h = 1e-4;
  const v = Math.hypot(at(tc + h)[0] - at(tc - h)[0], at(tc + h)[1] - at(tc - h)[1]) / (2 * h);
  const vmid = Math.hypot(at(tc / 2 + h)[0] - at(tc / 2 - h)[0], at(tc / 2 + h)[1] - at(tc / 2 - h)[1]) / (2 * h);
  assert.ok(v < 0.02 * vmid, `corner speed ${v} vs mid ${vmid}`);
});

test('motion: posAt runs 0 -> end, monotonic; slower on tight curves than on straights', () => {
  const g = B.core.decode('c170 ' + B.encodeGeometry({ id: 'c', phase: 1, tier: 'c', kind: 'contour', pts: circle(500, 500, 60, 60, 0, 1) }).toks);
  let prev = -1;
  for (let k = 0; k <= 400; k++) { const f = B.core.posAt(g, k / 400); assert.ok(f >= prev - 1e-9); prev = f; }
  assert.equal(B.core.posAt(g, 0), 0);
  assert.equal(B.core.posAt(g, 1), g.n - 1);
  // two-thirds power law warp: a 13 px radius runs at about 0.58 of straight-line speed
  const r13 = Math.cbrt(1 + 52 / 13);
  assert.ok(Math.abs(1 / r13 - 0.58) < 0.01);
});

test('schedules are sequential for every class: start[i] >= end[i-1], no negative gap', () => {
  for (const c of ['D', 'T', 'P']) {
    const sch = first.out.schedules[c];
    assert.ok(sch.length > 10);
    let t = 0, prevEnd = 0;
    for (const [g, d] of sch) {
      assert.ok(Number.isInteger(g) && Number.isInteger(d) && g >= 0 && d >= 1);
      t += g;
      assert.ok(t >= prevEnd);
      t += d;
      prevEnd = t;
    }
    assert.equal(first.out.classes[c].sequential, true);
    assert.equal(first.out.classes[c].phaseOrder, true);
    assert.equal(first.out.classes[c].framesWithMoreThanOnePartial, 0);
  }
});

test('frame rules: floors, peak advance, window caps, ink cap, locality (exact engine motion)', () => {
  for (const c of ['D', 'T', 'P']) {
    const k = first.out.classes[c];
    assert.deepEqual(k.frameViolations, [], c);
    assert.equal(k.windows.overEndCap, 0, c);
    assert.equal(k.windows.overInk040, 0, c);
    assert.equal(k.windows.localityOver025, 0, c);
    for (const [p, v] of Object.entries(k.peakAdvanceCw)) assert.ok(v <= SV.K.A[p] + 1e-6, `P${p} ${v}`);
    assert.ok(k.p1Start <= 600 && k.p1Len >= 0);
    // ramp into the form phase: the first 100 ms of P2 lays ink no faster than 4x the last 300 ms of P1
    if (k.pace) assert.ok(k.pace.p2First100 <= 4 * Math.max(0.5, k.pace.p1Last300), JSON.stringify(k.pace));
  }
  // P1 strokes last at least 4 frames (revision 5: P1_FLOOR_MS; 5 frames until revision 4), P0 at least 3, and long
  // lines span frames by length
  for (const e of first.out.index) for (const c of ['D', 'T', 'P']) {
    if (!e[c]) continue;
    const d = e[c][1], l = e.lengthSrcPx / 827;
    if (e.phase === 1) assert.ok(d >= Math.ceil((l < 0.10 ? SV.K.P1_SHORT_MS : SV.K.P1_FLOOR_MS) - 1e-9), `${e.id} P1 ${d} ms`);
    if (e.phase === 0) assert.ok(d >= 50, `${e.id} P0 ${d} ms`);
    const need = l >= 0.5 ? 3 : l >= 0.25 ? 2 : l >= 0.12 ? 1 : 0;
    assert.ok(d >= need * (1000 / 60) - 1e-9, `${e.id} ${d} ms < ${need} frames`);
  }
});

test('beat: a stroke that starts more than 0.12 cw from the pen waits at least 17 ms (P2-P5)', () => {
  const idx = first.out.index;
  for (const c of ['D', 'T', 'P']) {
    const seq = idx.filter((e) => e[c]).sort((a, b) => a[c][0] - b[c][0]);
    for (let i = 1; i < seq.length; i++) {
      const a = seq[i - 1], b = seq[i];
      if (b.phase < 2) continue;
      const pa = first.geo[a.i], pb = first.geo[b.i];
      const J = Math.hypot(pb.x[0] - pa.x[pa.n - 1], pb.y[0] - pa.y[pa.n - 1]);
      const gap = b[c][0] - (a[c][0] + a[c][1]);
      if (J > 0.12 * 827 || a.area !== b.area) assert.ok(gap >= 17, `${c} ${a.id} -> ${b.id}: jump ${J.toFixed(0)} px, gap ${gap} ms`);
    }
  }
});

test('determinism: two builds give the same block, schedules and hashes; the engine hash matches', () => {
  const again = run();
  assert.equal(again.data, first.data);
  assert.equal(again.engineMin, first.engineMin);
  assert.deepEqual(again.out.hashes, first.out.hashes);
  // the engine's own pick() and an independent FNV-1a over the class lines + schedule line
  for (const c of ['D', 'T', 'P']) {
    const L = first.data.split('\n'), bit = { D: 4, T: 2, P: 1 }[c];
    const lines = L.slice(1).filter((l) => l[0] !== 'T' && +l[2] & bit), sc = L.find((l) => l.startsWith('T ' + c + ' '));
    let h = 0x811c9dc5;
    for (const ch of Buffer.from(lines.join('\n') + '\n' + sc)) { h ^= ch; h = Math.imul(h, 0x01000193) >>> 0; }
    assert.equal(first.out.hashes[c], h.toString(16));
  }
  const r = SV.mulberry32(20261107), xs = [r(), r(), r()];
  const r2 = SV.mulberry32(20261107);
  assert.deepEqual(xs, [r2(), r2(), r2()]);
  assert.ok(xs.every((x) => x >= 0 && x < 1));
});

test('data block format: header, stroke lines, one schedule line per class', () => {
  const L = first.data.split('\n');
  assert.match(L[0], /^HP1 2200 1238 932 430\.7 1758\.5 927\.6 20261107$/);
  const strokes = L.slice(1).filter((l) => l[0] !== 'T');
  for (const l of strokes) assert.match(l, /^[gcyanfdh][0-5][1-7][0-7] -?\d+ -?\d+( (\||-?\d+))+$/);
  for (const c of ['P', 'T', 'D']) assert.equal(L.filter((l) => l.startsWith(`T ${c} `)).length, 1);
  for (const c of ['P', 'T', 'D']) { const k = B.core.pick(first.data, c); assert.equal(k.T.length, 2 * k.L.length); }
  assert.ok(!first.data.includes('</'));
});

// revision 4: the main loop allows the engine 6.5 KB brotli q3 for the numeral motion (6656 B)
test('minified engine: parses, no internal property left unrenamed, within 6.5 KB brotli q3', () => {
  new vm.Script(first.engineMin);
  const left = MZ.tokenize(first.engineMin).filter((t) => t.t === 'w' && Object.prototype.hasOwnProperty.call(B.ENGINE_PROPS, t.v));
  assert.deepEqual(left, []);
  assert.ok(br3(first.engineMin) <= 6656, `engine br3 ${br3(first.engineMin)}`);
  assert.ok(!/sessionStorage|Math\.random|localStorage/.test(first.engineMin), 'no session state, no randomness');
});

test('gates: short pieces, functional ids and floating hatch are reported; fail mode throws', () => {
  const fx = fixture();
  fx.strokes.push({ id: 'tiny', phase: 3, area: 'x', tier: 'd', kind: 'detail', prov: 'traced', classes: 'D', pts: line(1000, 700, 1010, 700) });
  fx.strokes.push({ id: 'lamp-housing', phase: 3, area: 'x', tier: 'd', kind: 'detail', prov: 'traced', classes: 'D', pts: line(1000, 600, 1100, 600) });
  fx.strokes.push({ id: 'float', phase: 4, area: 'hatch-body', tier: 'h', kind: 'hatch', prov: 'convention', group: 'body', classes: 'D', pts: line(900, 300, 890, 320) });
  const G = B.gates(B.normalize(fx));
  const by = (g) => G.violations.filter((v) => v.gate === g).map((v) => v.id);
  assert.deepEqual(by('short'), ['tiny']);
  assert.deepEqual(by('deny-id'), ['lamp-housing']);
  assert.deepEqual(by('hatch-start'), ['float']);
  const f2 = path.join(tmp, 'bad.json');
  fs.writeFileSync(f2, JSON.stringify(fx));
  assert.throws(() => B.build({ in: f2, gate: 'fail', quiet: true, write: false }), /gates/);
});

// ---- revision 1 timing rules (critics of the R3 films) ----
const at = (r, c) => r.out.index.filter((e) => e[c]).sort((a, b) => a[c][0] - b[c][0]);
const builds = [['fixture', first]];
if (fs.existsSync(ART)) builds.push(['art', B.build({ in: ART, out: path.join(tmp, 'art'), gate: 'fail', quiet: true, write: false })]);

// rev1 P0 (70 ms guides, 20 ms lifts, 60 ms to P1), as fix r2 changed it: the guides share 70 ms each by length and
// their seeded jitter (never under a floor), a hop over 0.5 cw lifts max(20, 90 ms x hop / cw), P1 starts 30 ms later
test('rev1 / fix r2: P0 lay-in (70 ms a guide shared by length, 20 ms lifts or the hop rule), first contour 30 ms after it; no P5 accents', () => {
  for (const [name, r] of builds) for (const c of ['D', 'T', 'P']) {
    const seq = at(r, c), p0 = seq.filter((e) => e.phase === 0), p1 = seq.find((e) => e.phase === 1);
    const p0End = p0[p0.length - 1][c][0] + p0[p0.length - 1][c][1];
    let lifts = 0;
    for (let i = 1; i < p0.length; i++) {
      const ga = r.geo[p0[i - 1].i], gb = r.geo[p0[i].i], J = Math.hypot(gb.x[0] - ga.x[ga.n - 1], gb.y[0] - ga.y[ga.n - 1]);
      const need = Math.max(20, SV.hopLift(0, J)), g = p0[i][c][0] - p0[i - 1][c][0] - p0[i - 1][c][1];
      assert.equal(g, need, `${name} ${c} ${p0[i].id}: P0 lift ${g} ms for ${(J / SV.CW).toFixed(3)} cw`);
      lifts += g;
    }
    assert.equal(p0End, p0.reduce((a, e) => a + e[c][1], 0) + lifts, `${name} ${c}`);
    for (const e of p0) assert.ok(e[c][1] >= 50, `${name} ${c} ${e.id}: ${e[c][1]} ms`);
    // the old rule's total (70 ms a guide, more where a guide's length needs it) is shared, not grown
    assert.ok(p0.reduce((a, e) => a + e[c][1], 0) >= 70 * p0.length, `${name} ${c}`);
    assert.equal(p1[c][0] - p0End, 30, `${name} ${c}`);
    if (name === 'art') {
      assert.deepEqual(p0.map((e) => e[c][1]), [75, 61, 74], `art ${c}: by length (368, 234, 353 src px) and jitter`);
      assert.equal(p0End, 316, `art ${c}: P0 ${p0End} ms`);
      assert.equal(p0.reduce((a, e) => a + e[c][1], 0), 210, `art ${c}: no floor binds, 3 x 70 ms`);
    }
    assert.ok(!seq.some((e) => e.phase === 5), `${name} ${c}: an accent survived`);
  }
});

test('rev1: numerals >= 4 frames with >= 30 ms between digits; one letter ends per frame; i-dots after the word', () => {
  for (const [name, r] of builds) for (const c of ['D', 'T', 'P']) {
    const seq = at(r, c), k = r.out.classes[c];
    assert.deepEqual(k.frameViolations, [], `${name} ${c}`);
    const nums = seq.filter((e) => e.tier === 'n');
    assert.ok(nums.length >= 3, `${name} ${c}: numerals present`);
    for (const e of nums) assert.ok(e[c][1] >= 4 * SV.FR, `${name} ${c} ${e.id} ${e[c][1]} ms`);
    for (let i = 1; i < seq.length; i++) if (seq[i].tier === 'n' && seq[i - 1].tier === 'n') assert.ok(seq[i][c][0] - seq[i - 1][c][0] - seq[i - 1][c][1] >= 30);
    // letter units: each letter (or i-dot) ends at least one frame after the previous one
    const unit = (id) => id.replace(/-(\d)$/, '');
    const ends = [];
    seq.forEach((e, i) => { if (e.kind === 'glyph' && !(seq[i + 1] && seq[i + 1].kind === 'glyph' && unit(seq[i + 1].id) === unit(e.id))) ends.push(e[c][0] + e[c][1]); });
    for (let i = 1; i < ends.length; i++) assert.ok(ends[i] - ends[i - 1] >= SV.FR, `${name} ${c}: letter ends ${ends[i - 1]} -> ${ends[i]}`);
    assert.ok(k.glyphs.maxLetterEndsPerFrame <= 1, `${name} ${c}`);
    if (c === 'D') {
      for (const d of k.glyphs.dots) if (d[1] != null) assert.ok(d[1] >= 0);
      for (const e of seq.filter((e) => /-dot$/.test(e.id))) {
        const w = e.id.replace(/-\d\d-.*$/, ''), last = seq.filter((x) => x.id.startsWith(w + '-') && !/-dot$/.test(x.id)).pop();
        assert.ok(e[c][0] - (last[c][0] + last[c][1]) >= 17, `${name}: ${e.id} starts ${e[c][0] - (last[c][0] + last[c][1])} ms after its word`);
      }
    }
  }
});

test('rev1: class P detail strokes (non-hatch, >= 0.05 cw) last >= 2 frames; every class within its last-ink limit', () => {
  for (const [name, r] of builds) {
    for (const e of at(r, 'P')) if ((e.phase === 3 || e.area === 'driver' || e.area === 'rear-frame') && e.tier !== 'h' && e.lengthSrcPx / 827 >= 0.05) assert.ok(e.P[1] >= 2 * SV.FR, `${name} ${e.id} ${e.P[1]} ms`);
    for (const c of ['D', 'T', 'P']) assert.ok(r.out.classes[c].lastInk <= SV.K.LIMIT[c], `${name} ${c} ${r.out.classes[c].lastInk}`);
  }
});

test('rev1: the engine starts on G.share (start rule 3), and guides floor unmixed', () => {
  const src = B.ENGINE_SRC;
  assert.ok(!/G\.vis\b/.test(src), 'G.vis is never set');
  assert.match(src, /if \(G\.share < 0\.5\)/);
  assert.match(first.engineMin, /\.share<\.5/);
  assert.match(src, /g: \[0\.36, 0xa9b1ba, 0, 0, 1\]/);
});

test('minifier: strings, numbers, regex and arrows survive; renamed code behaves the same', () => {
  const src = 'const f = (abc) => { const longName = "a // b /* c */" + abc; return longName.length + 0.5 + /x\\/y/.test("x/y") * 2; }; globalThis.res = f("q");';
  const out = MZ.minifyAuto(src).code;
  const a = vm.runInNewContext(src + ';globalThis.res'), b = vm.runInNewContext(out + ';globalThis.res');
  assert.equal(a, b);
  assert.ok(out.length < src.length);
});

// ---- revision 2 (critics of the revision 1 films) ----
const geoOf = (r, e) => r.geo[e.i];
test('rev2/rev3: the payoff is the last ink; phases run P0 P1 P2 P4 (P5) P3; the develop starts 100 ms after last ink', () => {
  for (const [name, r] of builds) for (const c of ['D', 'T', 'P']) {
    const k = r.out.classes[c], seq = at(r, c);
    assert.equal(k.phaseOrder, true, `${name} ${c}`);
    const runs = k.phaseSequence;
    assert.equal(new Set(runs).size, runs.length, `${name} ${c}: each phase one run (${runs.join('')})`);
    assert.equal(runs[runs.length - 1], 3, `${name} ${c}: P3 last (${runs.join('')})`);
    const last = seq[seq.length - 1];
    assert.equal(last.kind, 'glyph', `${name} ${c}: last ink ${last.id}`);
    if (c === 'D') assert.ok(!/^plate-/.test(last.id), `${name} D ends on the lettering, not ${last.id}`);
    // P3 holds the glyphs only; revision 3: the develop starts 100 ms AFTER last ink (the finished drawing is seen
    // whole), so no stroke of any kind ends after it
    for (const e of seq) if (e.phase === 3) assert.equal(e.kind, 'glyph', `${name} ${c}: ${e.id} left in P3`);
    const dev = k.lastInk + 100;
    assert.equal(k.devStart, dev, `${name} ${c}`);
    assert.equal(SV.K.DEV_GAP, 100);
    for (const e of seq) assert.ok(e[c][0] + e[c][1] <= k.lastInk && e[c][0] + e[c][1] < dev, `${name} ${c}: ${e.id} ends ${e[c][0] + e[c][1]} after devStart ${dev}`);
    assert.deepEqual(k.inkAfterDevStart, []);
    assert.equal(k.photoInMs, dev + 1000);
  }
});

test('rev2 (art): stripe-far-band in P2 nose-top, rear-frame tubes right after box, shadows front then rear left to right', () => {
  const r = builds.find(([n]) => n === 'art');
  if (!r) return;
  const [, A] = r;
  for (const c of ['D', 'T', 'P']) {
    const seq = at(A, c), ids = seq.map((e) => e.id), by = (id) => seq.find((e) => e.id === id);
    const band = by('stripe-far-band');
    if (band) {
      assert.equal(band.phase, 2); assert.equal(band.area, 'nose-top');
      assert.equal(seq[ids.indexOf('stripe-far-band') - 1].area, 'nose-top', `${c}: band inside nose-top`);
    }
    const rf = seq.filter((e) => e.area === 'rear-frame');
    if (rf.length) {
      assert.ok(rf.every((e) => e.phase === 2));
      const i0 = ids.indexOf(rf[0].id);
      assert.equal(seq[i0 - 1].area, 'box', `${c}: rear frame follows box (after ${seq[i0 - 1].id})`);
    }
    const sh = seq.filter((e) => e.phase === 4);
    for (let i = 0; i < sh.length; i++) {
      const g = geoOf(A, sh[i]);
      assert.ok(g.x[0] < g.x[g.n - 1], `${c}: ${sh[i].id} drawn left to right`);
      if (i) assert.ok(g.x[0] > geoOf(A, sh[i - 1]).x[0], `${c}: ${sh[i].id} after ${sh[i - 1].id}, left to right`);
    }
    if (sh.length) assert.equal(ids.indexOf(sh[0].id) - 1, ids.lastIndexOf(seq.filter((e) => e.phase === 2).pop().id), `${c}: P4 right after P2`);
  }
});

test('rev2: shadow edges never whip: peak <= 0.12 cw per frame, >= 6 frames from 0.3 cw, else >= 4', () => {
  for (const [name, r] of builds) for (const c of ['D', 'T', 'P']) for (const e of at(r, c)) {
    if (e.tier !== 'h' || SV.HATCHY.has(e.kind)) continue;
    const g = geoOf(r, e), d = e[c][1], l = g.L / 827;
    assert.ok(d >= (l >= 0.3 ? 6 : 4) * SV.FR - 1e-9, `${name} ${c} ${e.id} ${d} ms`);
    const tb = SV.table(B.core, g), pk = SV.strokePeaks(tb, d).adv / 827;
    assert.ok(pk <= 0.12 + 1e-6, `${name} ${c} ${e.id} peak ${pk.toFixed(3)} cw/frame`);
  }
});

test('rev3 (E3): letters last clamp(25 sqrt(path/25), 20, 40) ms shared by length; glyph strokes >= 15 px >= 1 frame; 30 ms between words, LINE_LIFT at the line break (revision 7: 30, was 50)', () => {
  for (const [name, r] of builds) {
    const seq = at(r, 'D'), letters = {};
    for (const e of seq) {
      if (e.kind !== 'glyph' || e.tier === 'n') continue;
      const key = e.id.replace(/-(\d)$/, '');
      (letters[key] = letters[key] || []).push(e);
      if (e.lengthSrcPx >= 15) assert.ok(e.D[1] >= SV.FR, `${name} ${e.id} ${e.lengthSrcPx} px in ${e.D[1]} ms`);
    }
    assert.ok(Object.keys(letters).length >= 4, name);
    // revision 5: the build may shorten every letter alike (letterScale) when class D runs over its target
    const sc = r.out.letterScale || 1, sc0 = SV.K.LETTER_SCALE;
    assert.ok(sc <= 1 && sc >= SV.K.LETTER_SCALE_MIN, `${name} letter scale ${sc}`);
    SV.K.LETTER_SCALE = sc;
    for (const [k, es] of Object.entries(letters)) {
      const path = es.reduce((a, e) => a + geoOf(r, e).L, 0), want = SV.letterMs(path), ink = es.reduce((a, e) => a + e.D[1], 0);
      assert.ok(want >= 20 * sc - 1e-9 && want <= 40 * sc + 1e-9);
      assert.ok(ink >= want - 1e-6 && ink <= want + 1 + es.length * (SV.FR + 1), `${name} ${k}: ${ink} ms for ${path.toFixed(1)} px (rule ${want.toFixed(1)})`);
      // the longer stroke of a two-stroke letter never pops in faster than the shorter one draws
      if (es.length === 2) { const [a, b] = es; if (a.lengthSrcPx > 2 * b.lengthSrcPx) assert.ok(a.D[1] >= b.D[1], `${name} ${k}: ${a.D[1]} vs ${b.D[1]} ms`); }
    }
    SV.K.LETTER_SCALE = sc0;
    for (const [w, lift, need] of r.out.classes.D.glyphs.wordLifts) assert.ok(lift >= need && need >= 30, `${name} ${w}: ${lift} ms (needs ${need})`);
    if (name === 'art') {
      assert.deepEqual(r.out.classes.D.glyphs.wordLifts.map((x) => [x[0], x[2]]), [['college', 30], ['of', SV.K.LINE_LIFT], ['engineering', 30]]);
      assert.equal(SV.K.LINE_LIFT, 30, 'revision 7: the line lift before "of" is 30 ms');
      assert.ok(r.out.classes.D.glyphs.letteringMs[2] <= 850, `lettering ${r.out.classes.D.glyphs.letteringMs[2]} ms`);
    }
    assert.ok(r.out.classes.D.lastInk <= 4400);
  }
});

test('rev2: each ghost rim loop is paired (flag bit 4) with its rim stroke and retires before the develop', () => {
  const r = builds.find(([n]) => n === 'art');
  if (!r) return;
  const [, A] = r;
  for (const c of ['D', 'T', 'P']) {
    const g = A.out.ghosts[c];
    assert.deepEqual(g.map((x) => [x.guide, x.rimStroke]), [['ghost-front-rim', 'fw-rim-fit'], ['ghost-rear-rim', 'rw-rim-fit']], c);
    for (const x of g) { assert.ok(x.ok && x.retireEnd === x.rimEnd + 150 && x.retireEnd <= x.devStart && x.devStart === A.out.classes[c].lastInk + 100, JSON.stringify(x)); }
    // the engine's pairing rule (k-th flagged guide <-> k-th flagged line) over the class's own lines
    const k = B.core.pick(A.data, c), fl = k.L.map((l) => [l[0], +l[3]]), gq = [], pairs = [];
    fl.forEach(([t, f], i) => { if (f & 4) t === 'g' ? gq.push(i) : pairs.push([gq.shift(), i]); });
    assert.equal(pairs.length, 2, c);
    for (const [gi, ti] of pairs) { assert.equal(fl[gi][0], 'g'); assert.notEqual(fl[ti][0], 'g'); }
  }
});

// ---- revision 3 (critics of the revision 2 films; main-loop decisions) ----
test('rev3: long P2 form/detail lines (>= 0.15 cw) last >= 2 frames and no two end within 33.3 ms', () => {
  for (const [name, r] of builds) for (const c of ['D', 'T', 'P']) {
    const l2 = at(r, c).filter((e) => e.phase === 2 && 'fd'.includes(e.tier) && e.lengthSrcPx / 827 >= 0.15);
    // the art's own count (revision 4 art: 9 at D and T, 7 at P)
    if (name === 'art') assert.ok(l2.length >= (c === 'P' ? 6 : 8), `${c}: ${l2.length} long P2 lines`);
    let prevEnd = -Infinity;
    for (const e of l2) {
      assert.ok(e[c][1] >= 2 * SV.FR, `${name} ${c} ${e.id}: ${e.lengthSrcPx} px in ${e[c][1]} ms`);
      const end = e[c][0] + e[c][1];
      assert.ok(end - prevEnd > 2 * SV.FR, `${name} ${c} ${e.id}: ends ${end - prevEnd} ms after the previous long line`);
      // the WebP film's 33.3 ms frames: never two long-line ends in one
      prevEnd = end;
    }
    const bins = l2.map((e) => Math.floor((e[c][0] + e[c][1]) / (2 * SV.FR)));
    assert.equal(new Set(bins).size, bins.length, `${name} ${c}: two long P2 ends in one 33 ms frame`);
    assert.equal(r.out.classes[c].p2Long.n, l2.length);
  }
});

test('rev3: a new number waits >= 40 ms after the previous number; digits of one number >= 30 ms', () => {
  for (const [name, r] of builds) for (const c of ['D', 'T', 'P']) {
    const seq = at(r, c);
    for (let i = 1; i < seq.length; i++) {
      const a = seq[i - 1], b = seq[i];
      if (a.tier !== 'n' || b.tier !== 'n') continue;
      const same = a.id.replace(/-\d\d-.*$/, '') === b.id.replace(/-\d\d-.*$/, ''), gap = b[c][0] - a[c][0] - a[c][1];
      assert.ok(gap >= (same ? 30 : 40), `${name} ${c} ${a.id} -> ${b.id}: ${gap} ms`);
    }
  }
});

test('rev3: the engine starts the develop at last ink + 100 ms', () => {
  assert.match(B.ENGINE_SRC, /DEV_GAP = 100/);
  assert.match(B.ENGINE_SRC, /const want = last \+ DEV_GAP;/);
  assert.ok(!/DEV_LEAD/.test(B.ENGINE_SRC));
  assert.match(first.engineMin, /\+100[;,]/);
});

// The art's revision 3 drops P4 at D and T (critic items A2, A3). Until it lands, the same art without its P4 lines
// stands in for it: an empty P4 is no phase (no pause, no beat, no gap), and D meets its revision 3 targets.
test('rev3: an empty P4 is no phase; D last ink and photo-in within the class target (revision 5: 4.2 s, 5.3 s)', () => {
  if (!fs.existsSync(ART)) return;
  const raw = JSON.parse(fs.readFileSync(ART, 'utf8'));
  const hasP4 = raw.strokes.some((s) => s.phase === 4 && /[DT]/.test(String(s.classes)));
  raw.strokes = raw.strokes.filter((s) => s.phase !== 4);
  const f = path.join(tmp, 'art-noP4.json');
  fs.writeFileSync(f, JSON.stringify(raw));
  const variants = [['art without P4', B.build({ in: f, out: path.join(tmp, 'noP4'), gate: 'fail', quiet: true, write: false })]];
  if (!hasP4) variants.push(['art', builds.find(([n]) => n === 'art')[1]]);
  for (const [name, r] of variants) {
    for (const c of ['D', 'T', 'P']) {
      const k = r.out.classes[c];
      assert.ok(!k.phaseSequence.includes(4), `${name} ${c}: ${k.phaseSequence.join('')}`);
      const j = k.phaseJoins.find(([a, b]) => a === 2 && b === 3);
      assert.ok(j, `${name} ${c}: P2 flows into P3`);
      // the P3 phase pause plus at most its beat or the pen lift: no P4 pause, beat or gap
      assert.ok(j[2] <= SV.K.PAUSE[3] + Math.max(SV.K.BEAT[3], 45 + 0.12 * 827) , `${name} ${c}: P2 -> P3 gap ${j[2]} ms`);
      assert.ok(k.lastInk <= SV.K.LIMIT[c] && k.limitsOk, `${name} ${c}`);
    }
    const D = r.out.classes.D;
    assert.ok(D.lastInk <= SV.K.TARGET.D, `${name}: D last ink ${D.lastInk}`);
    assert.ok(D.photoInMs <= SV.K.DONE.D, `${name}: D photo in ${D.photoInMs}`);
    assert.ok(D.target.ok);
  }
});

test('minifier: numeric SCREAMING_CASE constants inline; true/false become !0/!1', () => {
  const src = 'const A_B = 150, C = 0.25;\nconst f = (x) => x + A_B * C;\nglobalThis.r = [f(2), true, false, { true: 1 }.true];';
  const out = MZ.minifyAuto(src).code;
  assert.ok(!/A_B|C\b/.test(out.replace(/globalThis/g, '')), out);
  assert.equal(JSON.stringify(vm.runInNewContext(out + ';globalThis.r')), JSON.stringify(vm.runInNewContext(src + ';globalThis.r')));
  assert.throws(() => MZ.inlineConsts('const A_B = 1;\nlet o = { A_B: 2 };'), /key/);
});

// ---- revision 4 (critics of the revision 3 films; main-loop decisions of 2026-11-07) ----
const artBuild = () => (builds.find(([n]) => n === 'art') || [])[1];
const numeral = (pts) => B.core.decode('n300 ' + B.encodeGeometry({ id: 'n', phase: 3, tier: 'n', kind: 'glyph', pts }).toks);
test('rev4: a numeral runs on arc length, flattened: <= 35 % of its length per frame at 67 ms, >= 3 growing frames, at rest at its ends', () => {
  // a "1": flag then a straight stem, the case the critic saw drawn in one frame
  const g = numeral([[0, 12], [6, 6], [12, 0], [12, 20], [12, 40], [12, 58]]);
  const tb = SV.table(B.core, g), m = SV.numMotion(tb, g.L, 67);
  assert.ok(m.adv <= SV.K.NUM_ADV, `peak ${m.adv}`);
  assert.ok(m.grow >= 3, `grows over ${m.grow} frames`);
  // the same stroke as a detail line (minimum jerk on the warped arc) takes far more in one frame
  const d = B.core.decode('d300 ' + B.encodeGeometry({ id: 'd', phase: 3, tier: 'd', kind: 'detail', pts: [[0, 12], [6, 6], [12, 0], [12, 20], [12, 40], [12, 58]] }).toks);
  assert.ok(SV.numMotion(SV.table(B.core, d), d.L, 67).adv > 0.4);
  // plain arc length: U equals s; submovement time shared by length
  assert.ok(g.U.every((u, i) => Math.abs(u - g.s[i]) < 1e-9));
  const at = (tau) => B.core.ptAt(g, B.core.posAt(g, tau)), h = 1e-4;
  const v0 = Math.hypot(at(h)[0] - at(0)[0], at(h)[1] - at(0)[1]) / h, vm = Math.hypot(at(0.5 + h)[0] - at(0.5 - h)[0], at(0.5 + h)[1] - at(0.5 - h)[1]) / (2 * h);
  assert.ok(v0 < 0.02 * vm, `start speed ${v0} vs mid ${vm}`);
  // the corner between flag and stem is a submovement break, the pen stops there
  assert.equal(g.sub.length, 2);
  // the plateau: from 20 % to 80 % of a submovement's time the speed is constant (1.25 x mean); one straight stem
  const st = numeral([[0, 0], [0, 30], [0, 60]]), as = (tau) => B.core.ptAt(st, B.core.posAt(st, tau));
  const sp = (tau) => (as(tau + h)[2] - as(tau - h)[2]) / (2 * h) / st.L;
  for (const tau of [0.25, 0.4, 0.6, 0.75]) assert.ok(Math.abs(sp(tau) - 1.25) < 0.01, `speed ${sp(tau)} at ${tau}`);
  // monotonic 0 -> end
  let prev = -1;
  for (let k = 0; k <= 400; k++) { const f = B.core.posAt(g, k / 400); assert.ok(f >= prev - 1e-9); prev = f; }
  assert.equal(B.core.posAt(g, 1), g.n - 1);
});
test('rev4: numerals: D and T 67 ms, class P 100 ms with every submovement >= 2 frames; all <= 35 % per frame, >= 3 frames', () => {
  const r = artBuild();
  if (!r) return;
  for (const c of ['D', 'T', 'P']) {
    const nums = r.out.classes[c].rev4.numerals;
    assert.ok(nums.length >= 3, c);
    for (const [id, d, adv, grow, subs] of nums) {
      assert.equal(d >= (c === 'P' ? 100 : 67), true, `${c} ${id}: ${d} ms`);
      if (c !== 'P') assert.equal(d, 67, `${c} ${id}: the 67 ms numeral budget`);
      assert.ok(adv <= 0.35 && grow >= 3, `${c} ${id}: ${adv} per frame, ${grow} frames`);
      if (c === 'P') assert.ok(subs.every((x) => x >= 2 * SV.FR - 1e-9), `${c} ${id}: submovements ${subs}`);
    }
  }
});
test('rev4 (E1): closed loops of 60 src px or more last >= 2 frames (amber-lens at every class)', () => {
  for (const [name, r] of builds) for (const c of ['D', 'T', 'P']) {
    const cl = r.out.classes[c].rev4.closed;
    for (const [id, L, d] of cl) assert.ok(L >= 60 && d >= 2 * SV.FR, `${name} ${c} ${id}: ${L} px in ${d} ms`);
    // the art's revision 5 opens amber-lens (a 12.5 % gap), so it is no longer a closed loop; the rule still holds for
    // any loop the art closes
  }
});
test('rev4 (E2): class P, phase P2: every non-hatch stroke of 50 src px or more lasts >= 1 frame', () => {
  for (const [name, r] of builds) {
    const seq = at(r, 'P').filter((e) => e.phase === 2 && e.tier !== 'h' && !['hatch', 'arc', 'streak', 'glyph', 'letter', 'numeral'].includes(e.kind) && e.lengthSrcPx >= 50);
    for (const e of seq) assert.ok(e.P[1] >= SV.FR, `${name} ${e.id}: ${e.lengthSrcPx} px in ${e.P[1]} ms`);
    assert.equal(r.out.classes.P.rev4.p2p.length, seq.length, name);
  }
});
test('rev4 (E3): a stroke that continues another keeps the tip speed across the join (rim-seen -> rim-fit)', () => {
  const r = artBuild();
  if (!r) return;
  for (const c of ['D', 'T', 'P']) {
    const j = r.out.classes[c].rev4.joins;
    for (const pair of [['fw-rim-seen', 'fw-rim-fit'], ['rw-rim-seen', 'rw-rim-fit']]) {
      const x = j.find((q) => q[0] === pair[0] && q[1] === pair[1]);
      assert.ok(x, `${c}: ${pair} is a continuation`);
      const a = r.out.index.find((e) => e.id === pair[0]), b = r.out.index.find((e) => e.id === pair[1]);
      // equal ms per src px within whole-ms rounding
      assert.ok(Math.abs(x[2] / a.lengthSrcPx - x[3] / b.lengthSrcPx) * Math.min(a.lengthSrcPx, b.lengthSrcPx) <= 1 + 1e-6, `${c} ${pair}: ${x}`);
    }
  }
});
test('rev4 (E5): in P2 at most 2 stroke ends inside one area per 16.67 ms window', () => {
  for (const [name, r] of builds) for (const c of ['D', 'T', 'P']) {
    const by = {};
    for (const e of at(r, c)) if (e.phase === 2 && !['glyph', 'letter', 'numeral'].includes(e.kind)) (by[e.area] = by[e.area] || []).push(e[c][0] + e[c][1]);
    for (const [ar, ends] of Object.entries(by)) { ends.sort((a, b) => a - b); for (let i = 2; i < ends.length; i++) assert.ok(ends[i] - ends[i - 2] >= SV.FR, `${name} ${c} ${ar}: 3 ends from ${ends[i - 2]} to ${ends[i]}`); }
    assert.ok(r.out.classes[c].rev4.areaEndsMax <= 2, `${name} ${c}`);
  }
});
test('rev5: targets: D last ink <= 4.2 s and the photo in by 5.3 s; T <= 4.0 s; P <= 3.5 s; develop at last ink + 100 ms', () => {
  assert.deepEqual(SV.K.TARGET, { D: 4200, T: 4000, P: 3500 });
  assert.deepEqual(SV.K.DONE, { D: 5300 });
  for (const [name, r] of builds) for (const c of ['D', 'T', 'P']) {
    const k = r.out.classes[c];
    assert.ok(k.lastInk <= SV.K.TARGET[c], `${name} ${c}: ${k.lastInk}`);
    assert.equal(k.devStart, k.lastInk + 100);
    if (c === 'D') assert.ok(k.photoInMs <= SV.K.DONE.D, `${name}: photo in ${k.photoInMs}`);
    assert.deepEqual(k.frameViolations, [], `${name} ${c}`);
    assert.ok(k.limitsOk, `${name} ${c}`);
  }
});

// ---------- revision 5 ----------
// The art's round 5 drops post-below-beam (class D) and draws top-219 at D only. Until it lands, the art with those two
// changes stands in for it (the same way the art without P4 stood in for revision 3). On the art's revision 5 (landed
// 2026-11-09) both changes are already there, so this variant equals the art.
const artFix = (() => {
  if (!fs.existsSync(ART)) return null;
  const raw = JSON.parse(fs.readFileSync(ART, 'utf8'));
  raw.strokes = raw.strokes.filter((s) => s.id !== 'post-below-beam');
  for (const s of raw.strokes) if (/^top-219-/.test(s.id)) { s.classes = 'D'; if (s.mask != null) s.mask = 4; }
  const f = path.join(tmp, 'art-fix.json');
  fs.writeFileSync(f, JSON.stringify(raw));
  return B.build({ in: f, out: path.join(tmp, 'artfix'), gate: 'fail', quiet: true, write: false });
})();
const builds5 = builds.concat(artFix ? [['art round-5 stand-in', artFix]] : []);
test('rev5: every P2 stroke lasts >= 1 frame at every class (no P2 stroke inside one 60 Hz frame)', () => {
  for (const [name, r] of builds5) for (const c of ['D', 'T', 'P']) {
    for (const e of at(r, c)) if (e.phase === 2) assert.ok(e[c][1] >= SV.FR, `${name} ${c} ${e.id}: ${e[c][1]} ms`);
    assert.equal(r.out.classes[c].rev5.p2Under1Frame, 0, `${name} ${c}`);
  }
});
test('rev5: in P2 a pen travel over 50 src px lifts >= 17 ms', () => {
  for (const [name, r] of builds5) for (const c of ['D', 'T', 'P']) {
    const seq = at(r, c);
    let n = 0;
    for (let i = 1; i < seq.length; i++) {
      const a = seq[i - 1], b = seq[i];
      if (b.phase !== 2) continue;
      const ga = geoOf(r, a), gb = geoOf(r, b), J = Math.hypot(gb.x[0] - ga.x[ga.n - 1], gb.y[0] - ga.y[ga.n - 1]);
      if (J <= 50) continue;
      n++;
      assert.ok(b[c][0] - a[c][0] - a[c][1] >= 17, `${name} ${c} ${a.id} -> ${b.id}: ${J.toFixed(0)} px in ${b[c][0] - a[c][0] - a[c][1]} ms`);
    }
    assert.equal(n, r.out.classes[c].rev5.lifts.length, `${name} ${c}`);
  }
});
test("rev5: P1 durations follow len^0.6 x (1 + 0.3 turning) above their floors, with the old rule's total (no metronome)", () => {
  // synthetic: two strokes of equal length, one straight, one curved, and a short straight one: the curved one takes
  // longest, the short one least; whole ms; the total kept; the gaps untouched
  const mk = (L, turn, floorA = 0) => ({ L, turn, floorA });
  const ph = [mk(300, 0), mk(300, 3), mk(150, 0)], tl = [[0, 100], [30, 100], [30, 100]];
  const out = SV.p1Spread(ph, tl);
  assert.equal(out.reduce((a, x) => a + x[1], 0), 300);
  assert.deepEqual(out.map((x) => x[0]), [0, 30, 30]);
  assert.ok(out[1][1] > out[0][1] && out[0][1] > out[2][1], JSON.stringify(out));
  assert.ok(out.every((x) => Number.isInteger(x[1]) && x[1] >= Math.ceil(SV.K.P1_FLOOR_MS)));
  for (const [name, r] of builds5) if (name !== 'fixture') for (const c of ['D', 'T', 'P']) {
    const p1 = r.out.classes[c].rev5.p1;
    assert.ok(p1.length >= 8, `${name} ${c}`);
    const ds = p1.map((x) => x[3]);
    // no metronome: the P1 stroke times spread over a factor of at least 1.5 (revision 4: 83-95 ms for 7 in a row)
    assert.ok(Math.max(...ds) >= 1.5 * Math.min(...ds), `${name} ${c}: ${ds}`);
    // a stroke above its own floor (peak advance 0.12 cw per frame, P1_FLOOR_MS): more weight never means less time;
    // no stroke under its floor
    const w = p1.map(([, L, t]) => Math.pow(L, 0.6) * (1 + 0.3 * t));
    for (let i = 0; i < p1.length; i++) {
      assert.ok(ds[i] >= p1[i][4], `${name} ${c}: ${p1[i]} under its floor`);
      for (let j = 0; j < p1.length; j++) if (ds[j] > p1[j][4] + 1 && w[i] > w[j] * 1.02) assert.ok(ds[i] >= ds[j] - 1, `${name} ${c}: ${p1[i]} vs ${p1[j]}`);
    }
  }
});
test('rev5: a join-flagged line end runs on 1 src px along its tangent (overlap); glyph ends do not', () => {
  const r = artBuild();
  if (!r) return;
  const N = B.normalize(JSON.parse(fs.readFileSync(ART, 'utf8')));
  const ov = r.out.overlap;
  assert.ok(Array.isArray(ov) && ov.length > 10);
  for (const [id, end] of ov) {
    const s = N.strokes.find((x) => x.id === id), e = r.out.index.find((x) => x.id === id), g = r.geo[e.i];
    assert.ok(!['glyph', 'letter', 'numeral'].includes(s.kind) && 'cyfda'.includes(s.tier), id);
    // the build may have flipped the stroke (drawing order): compare with whichever original end is nearer
    const ends = [s.pts[0], s.pts[s.pts.length - 1]], k = end === 'end' ? g.n - 1 : 0;
    const d = Math.min(...ends.map((a) => Math.hypot(g.x[k] - a[0], g.y[k] - a[1])));
    assert.ok(d >= 0.5 && d <= 1.6, `${id} ${end}: decoded end ${d.toFixed(2)} src px from the joint`);
    assert.ok(e.flags & (end === 'end' ? 2 : 1), `${id} ${end} is join-flagged (no taper in the engine)`);
  }
  for (const e of r.out.index) if (e.kind === 'glyph') assert.ok(!ov.some(([id]) => id === e.id), e.id);
  // the engine draws a join-flagged end at full width: taper() returns 1 there
  assert.match(B.ENGINE_SRC, /st\.f & 1 \? 1 :/);
  assert.match(B.ENGINE_SRC, /st\.f & 2 \? 1 :/);
});
test('rev5: the lettering is shortened (all letters alike, glyph strokes >= 15 src px keep 1 frame) only when D runs over', () => {
  for (const [name, r] of builds5) {
    const sc = r.out.letterScale;
    if (sc < 1) assert.ok(r.out.classes.D.target.ok, `${name}: scaled to ${sc} and still over`);
    for (const e of at(r, 'D')) if (e.kind === 'glyph' && e.tier !== 'n' && e.lengthSrcPx >= 15) assert.ok(e.D[1] >= SV.FR, `${name} ${e.id}`);
  }
  if (!fs.existsSync(ART)) return;
  const full = B.build({ in: ART, out: path.join(tmp, 'noscale'), gate: 'fail', quiet: true, write: false, noLetterScale: true });
  if (full.out.classes.D.target.ok) assert.equal(artBuild().out.letterScale, 1);
  else assert.ok(artBuild().out.letterScale < 1);
});

// ---------- revision 6 ----------
// The rear-bay tubes are drawn next to the wheels they connect (feel critic, round 6): lower-rail-top right after the
// front wheel, rear-tube-level and bar-below-brace right after the rear wheel (shadow-ground-rear). Checked on the art
// and on the art with the stand-in refits of diag-tube (66.0 src px) and bar-below-brace (52 src px).
const artRefit = (() => {
  if (!fs.existsSync(ART)) return null;
  const raw = JSON.parse(fs.readFileSync(ART, 'utf8'));
  const L = (p) => p.reduce((a, q, i) => (i ? a + Math.hypot(q[0] - p[i - 1][0], q[1] - p[i - 1][1]) : 0), 0);
  for (const s of raw.strokes) {
    if (s.id === 'diag-tube' && L(s.pts) < 65) {
      const p = s.pts, a = p[p.length - 1], b = p[p.length - 4], d = Math.hypot(a[0] - b[0], a[1] - b[1]), x = 66 - L(p);
      s.pts = p.concat([[a[0] + ((a[0] - b[0]) / d) * x, a[1] + ((a[1] - b[1]) / d) * x]]); delete s.segs; delete s.segCorners;
    }
    if (s.id === 'bar-below-brace' && L(s.pts) > 60) {
      let k = 1; while (L(s.pts.slice(k)) > 52) k++;
      s.pts = s.pts.slice(k - 1); delete s.segs; delete s.segCorners;
    }
  }
  const f = path.join(tmp, 'art-refit.json');
  fs.writeFileSync(f, JSON.stringify(raw));
  return B.build({ in: f, out: path.join(tmp, 'artrefit'), gate: 'fail', quiet: true, write: false });
})();
const builds6 = builds.filter(([n]) => n === 'art').concat(artRefit ? [['art + refit stand-in', artRefit]] : []);
test('rev6: rear-bay tubes next to their wheels; P2 hops fw-rib-2..neck <= 0.21 cw at D; D last ink <= 4.2 s', () => {
  for (const [name, r] of builds6) {
    for (const c of ['D', 'T']) {
      const p2 = at(r, c).filter((e) => e.phase === 2), ids = p2.map((e) => e.id), ix = (id) => ids.indexOf(id);
      const lastFw = ids.length - 1 - p2.slice().reverse().findIndex((e) => e.area === 'front-wheel');
      if (ix('lower-rail-top') >= 0) assert.equal(ix('lower-rail-top'), lastFw + 1, `${name} ${c}: lower-rail-top after the front wheel`);
      const lastRw = ix('lower-rail-top') >= 0 ? ids.length - 1 - p2.slice().reverse().findIndex((e) => e.area === 'rear-wheel') : -1;
      if (ix('rear-tube-level') >= 0) assert.equal(ix('rear-tube-level'), lastRw + 1, `${name} ${c}: rear-tube-level after the rear wheel`);
      if (ix('bar-below-brace') >= 0) assert.equal(ix('bar-below-brace'), ix('rear-tube-level') + 1, `${name} ${c}: bar-below-brace next`);
      assert.ok(!r.out.nearWheels.hops[c].after.over020.some((h) => /rear-bay|rail-top|tube-level|below-brace|rw-rim-seen/.test(h.join())), `${name} ${c}: ${JSON.stringify(r.out.nearWheels.hops[c].after.over020)}`);
    }
    const ids = at(r, 'D').filter((e) => e.phase === 2).map((e) => e.id), a = ids.indexOf('fw-rib-2'), z = ids.indexOf('neck');
    if (a >= 0 && z > a) {
      const hops = r.out.nearWheels.hops.D.after;
      const span = hops.over020.filter((h) => ids.indexOf(h[1]) > a && ids.indexOf(h[1]) <= z);
      assert.ok(span.every((h) => h[2] <= 0.21), `${name}: ${JSON.stringify(span)}`);
    }
    const k = r.out.classes.D;
    assert.ok(k.lastInk <= 4200 && k.photoInMs <= 5300, `${name}: D last ink ${k.lastInk}, photo in ${k.photoInMs}`);
    assert.ok(r.out.classes.T.lastInk <= 4000 && r.out.classes.P.lastInk <= 3500, name);
  }
});
test('rev6: nearWheels is idempotent and keeps orientation', () => {
  const mk = (id, area, x) => ({ id, area, phase: 2, pts: [[x, 0], [x + 50, 0]] });
  const seq = [mk('fw-a', 'front-wheel', 0), mk('rw-a', 'rear-wheel', 300), mk('shadow-ground-rear', 'rear-wheel', 360), mk('hoop-a', 'hoop', 500),
    mk('lower-rail-top', 'rear-bay', 60), mk('rear-tube-level', 'rear-bay', 420), mk('bar-below-brace', 'rear-bay', 440), mk('helmet-a', 'helmet', 700)];
  const r1 = B.nearWheels(seq), o1 = seq.map((s) => s.id);
  assert.deepEqual(o1, ['fw-a', 'lower-rail-top', 'rw-a', 'shadow-ground-rear', 'rear-tube-level', 'bar-below-brace', 'hoop-a', 'helmet-a']);
  assert.equal(r1.moved.length, 2);
  assert.equal(B.nearWheels(seq).moved.length, 0);
  assert.deepEqual(seq.map((s) => s.id), o1);
  assert.deepEqual(seq.find((s) => s.id === 'lower-rail-top').pts[0], [60, 0]);
});
test('rev6: --page builds on the R1 index.html of 9af034df (guard kept, canvases, block in place of the deferred script); the pre-R1 page is refused', () => {
  let base;
  try { base = B.baseHtml('9af034df'); } catch (e) { return; }   // no git here: nothing to check
  const html = B.page(null, first.block, '9af034df');
  const inv = B.pageInvariants(html, first.block);
  assert.ok(inv.ok, JSON.stringify(inv));
  assert.ok(base.includes('hero-drawing-20261027.js?v=refresh-20261107') && !html.includes('hero-drawing-20261027.js?v='));
  const g = (s) => s.split('\n').find((l) => l.trim().startsWith('<script>') && l.includes('hero=draw') && l.includes('data-hero-pen'));
  assert.equal(g(html), g(base), 'the R1 guard is kept as it is');
  assert.ok(html.includes('<script id="kw-scroll">'));
  assert.ok(!B.pageInvariants(base, first.block).ok);
  let old = null;
  try { old = B.baseHtml('27af3682'); } catch (e) { /* shallow clone */ }
  if (old) assert.throws(() => B.page(null, first.block, '27af3682'), /pre-R1/);
});

// ---------- revision 7 (polish round 2026-11-10; the main loop's decisions, agent decisions, not the owner's) ----------
// E1: inside P2 a hop over 0.25 cw lifts >= max(17, 90 ms x hop / cw); E2: inside P1 a hop of 0.195 cw or more lifts
// >= 45 ms; the line lift before 'of' is 30 ms and the P2 -> P3 join 50 ms (PAUSE[3] 33 + the 17 ms beat).
test('rev7 (E1, E2): hop lifts inside P1 and P2 follow hopLift; the phase joins keep their pauses', () => {
  assert.equal(SV.hopLift(2, 0.25 * SV.CW), 0, 'a P2 hop of exactly 0.25 cw keeps the revision 5 rule');
  // whole ms, rounded up: the schedule's whole-ms step floors a gap, so a fractional lift would lose up to 1 ms
  assert.equal(SV.hopLift(2, 0.37 * SV.CW), 34, '90 ms x 0.37 = 33.3 ms, rounded up');
  assert.equal(SV.hopLift(2, 0.26 * SV.CW), 24, '90 ms x 0.26 = 23.4 ms, rounded up');
  assert.equal(SV.hopLift(2, 0.251 * SV.CW), 23, '90 ms x 0.251 = 22.6 ms, rounded up');
  assert.equal(SV.hopLift(2, 0.4 * SV.CW), 36, '90 ms x 0.4 = 36 ms exactly');
  assert.equal(SV.hopLift(2, 0.15 * SV.CW), 0, 'shorter P2 hops keep the revision 5 rule (17 ms over 50 src px)');
  assert.equal(SV.hopLift(1, 0.195 * SV.CW), 45);
  assert.equal(SV.hopLift(1, 0.19 * SV.CW), 0);
  assert.equal(SV.hopLift(3, 0.5 * SV.CW), 0, 'no revision 7 lift outside P1 and P2');
  for (const [name, r] of builds) for (const c of ['D', 'T', 'P']) {
    const seq = at(r, c);
    let n = 0;
    for (let i = 1; i < seq.length; i++) {
      const a = seq[i - 1], b = seq[i];
      if (a.phase !== b.phase || (b.phase !== 1 && b.phase !== 2)) continue;
      const ga = geoOf(r, a), gb = geoOf(r, b), J = Math.hypot(gb.x[0] - ga.x[ga.n - 1], gb.y[0] - ga.y[ga.n - 1]);
      const need = SV.hopLift(b.phase, J);
      if (!need) continue;
      n++;
      const g = b[c][0] - a[c][0] - a[c][1];
      // the realised lift is at least the unrounded rule (P2: max(17, 90 ms x hop / cw); P1: 45 ms)
      const exact = b.phase === 2 ? Math.max(SV.K.P2_LIFT, (SV.K.P2_HOP_MS * J) / SV.CW) : SV.K.P1_HOP_MS;
      assert.ok(g >= need && g >= exact - 1e-9, `${name} ${c} ${a.id} -> ${b.id}: ${(J / SV.CW).toFixed(3)} cw lifts ${g} ms < ${exact.toFixed(2)}`);
    }
    assert.equal(n, r.out.classes[c].rev7.hops.length, `${name} ${c}`);
    const joins = r.out.classes[c].phaseJoins;
    const j01 = joins.find((j) => j[0] === 0 && j[1] === 1), j12 = joins.find((j) => j[0] === 1 && j[1] === 2);
    if (name === 'art') {
      // fix r2: the P0 -> P1 join 60 -> 30 ms and the P1 -> P2 join 98 -> 78 ms pay for the P0 hop lift
      assert.equal(j01[2], 30, `${c}: P0 -> P1 join`);
      assert.equal(j12[2], 78, `${c}: P1 -> P2 beat`);
      assert.deepEqual(joins.find((j) => j[0] === 2 && j[1] === 3), [2, 3, 50], `${c}: P2 -> P3 join 50 ms`);
    }
  }
});
test("rev7: the art: the critic's five P1 hops lift 45 ms; class P lifts its P2 hop into column-right by the rule; limits and targets hold", () => {
  const r = (builds.find(([n]) => n === 'art') || [])[1];
  if (!r) return;
  const into = (c) => r.out.classes[c].rev7.hops.filter((h) => h[0] === 1).map((h) => h[2]);
  assert.deepEqual(into('D'), ['hoop-leg-arch', 'brace', 'rear-tyre', 'front-tyre', 'helmet']);
  assert.deepEqual(into('T'), ['hoop-leg-arch', 'brace', 'rear-tyre', 'front-tyre', 'helmet']);
  assert.deepEqual(into('P'), ['hoop-leg-arch', 'brace-centre', 'rear-tyre', 'front-tyre', 'helmet']);
  for (const c of ['D', 'T', 'P']) for (const h of r.out.classes[c].rev7.hops) if (h[0] === 1) assert.ok(h[4] >= 45, `${c} ${h[1]} -> ${h[2]}: ${h[4]} ms`);
  const p2 = r.out.classes.P.rev7.hops.filter((h) => h[0] === 2);
  // fix r2: P draws rear-tube-level after shadow-ground-rear, so the hop into column-right starts at the tube's end
  // (0.265 cw; it was 0.395 cw from the shadow's end, lifting 36 ms)
  const big = p2.find((h) => h[2] === 'column-right');
  assert.ok(big && big[1] === 'rear-tube-level' && big[3] > 0.25 && big[4] >= 24 && big[4] >= 90 * big[3] - 0.05, JSON.stringify(p2));
  assert.ok(r.out.classes.D.rev7.hops.every((h) => h[0] === 1), 'class D has no P2 hop over 0.25 cw');
  // A1: class P draws shadow-ground-rear straight after rw-rim-fit
  const ids = at(r, 'P').map((e) => e.id);
  assert.equal(ids[ids.indexOf('shadow-ground-rear') - 1], 'rw-rim-fit');
  const k = r.out.classes;
  assert.ok(k.D.lastInk <= 4200 && k.D.photoInMs <= 5300 && k.T.lastInk <= 4000 && k.P.lastInk <= 3500, JSON.stringify([k.D.lastInk, k.D.photoInMs, k.T.lastInk, k.P.lastInk]));
  for (const c of ['D', 'T', 'P']) { assert.ok(k[c].limitsOk, c); assert.equal(k[c].frameViolations.length, 0, c); }
  assert.equal(r.out.letterScale || 1, 1, 'no lettering cut');
});
test("rev7 (art): hoop-column starts on the hoop leg's start and has one corner; rw-rim-seen ends at its lowest point; lens-housing-top starts past x 1449", () => {
  if (!fs.existsSync(ART)) return;
  const raw = JSON.parse(fs.readFileSync(ART, 'utf8')), by = Object.fromEntries(raw.strokes.map((s) => [s.id, s]));
  const hc = by['hoop-column'], hla = by['hoop-leg-arch'];
  assert.ok(Math.hypot(hc.pts[0][0] - hla.pts[0][0], hc.pts[0][1] - hla.pts[0][1]) <= 0.6, 'the column starts at the leg');
  assert.equal(hc.corners.length, 1);
  assert.ok(hc.joined & 1 && hla.joined & 1, 'both starts joined (no taper, overlap)');
  const rs = by['rw-rim-seen'], e = rs.pts[0];
  assert.ok(rs.pts.slice(0, 40).every((p) => p[1] <= e[1] + 0.1), 'the seen arc ends at its lowest point (no upturn)');
  assert.ok(rs.len >= 40);
  assert.equal(by['shadow-ground-rear'].classes, 'DTP');
  const lh = by['lens-housing-top'];
  assert.ok(Math.min(lh.pts[0][0], lh.pts[lh.pts.length - 1][0]) >= 1448.5 && lh.len >= 40);
});

// ---------- fix r2 (2026-11-10; the main loop's decisions on the verifiers' notes, agent decisions, not the owner's) ----------
// P0: a hop over 0.5 cw lifts >= max(20, 90 ms x hop / cw), rounded up; the guides' times vary a little by length and
// their seeded jitter (same total); the joins P0 -> P1 30 ms and P1 -> P2 78 ms pay for it; P1 (the seen hand) unchanged.
test('fix r2: the P0 hop rule and the length spread', () => {
  assert.equal(SV.hopLift(0, 0.5 * SV.CW), 0, 'a P0 hop of exactly 0.5 cw keeps the 20 ms lift');
  assert.equal(SV.hopLift(0, 0.357 * SV.CW), 0);
  assert.equal(SV.hopLift(0, 0.955 * SV.CW), 86, '90 ms x 0.955 = 85.95 ms, rounded up');
  assert.equal(SV.hopLift(0, 0.6 * SV.CW), 54);
  assert.equal(SV.hopLift(0, 0.501 * SV.CW), 46, '90 x 0.501 = 45.09, rounded up (over the 20 ms floor)');
  // spread: same total, proportional to the weights above the floors, whole ms
  const tl = [[0, 70], [20, 70], [20, 70]];
  assert.deepEqual(SV.spread(tl, [1, 1, 1], [50, 50, 50]), tl);
  const s = SV.spread(tl, [1.2, 0.8, 1.0], [50, 50, 50]);
  assert.equal(s.reduce((a, x) => a + x[1], 0), 210);
  assert.deepEqual(s.map((x) => x[0]), [0, 20, 20], 'gaps kept');
  assert.ok(s[0][1] > s[2][1] && s[2][1] > s[1][1]);
  assert.deepEqual(SV.spread(tl, [10, 0.1, 0.1], [50, 50, 50]).map((x) => x[1]), [110, 50, 50], 'never under a floor');
});
test('fix r2 (art): P1, the seen hand, keeps its revision 7 times; D last ink <= 4200 ms without a lettering cut', () => {
  const r = (builds.find(([n]) => n === 'art') || [])[1];
  if (!r) return;
  const p1 = (c) => { const q = at(r, c), k = q.findIndex((e) => e.phase === 1), o = []; for (let i = k; i < q.length && q[i].phase === 1; i++) o.push(i === k ? [q[i][c][1]] : [q[i][c][0] - q[i - 1][c][0] - q[i - 1][c][1], q[i][c][1]]); return o.flat(); };
  // [dur, (lift, dur) x 8], as in revision 7 and fix r1
  assert.deepEqual(p1('D'), [199, 23, 132, 30, 77, 45, 67, 22, 67, 45, 72, 45, 102, 45, 105, 45, 118]);
  assert.deepEqual(p1('T'), p1('D'));
  assert.deepEqual(p1('P'), [199, 23, 132, 30, 77, 45, 68, 22, 67, 45, 67, 45, 103, 45, 107, 45, 119]);
  const k = r.out.classes;
  for (const c of ['D', 'T', 'P']) {
    assert.deepEqual(k[c].fixR2.p0Lifts.map((x) => x[4]), [20, 86], c);
    assert.ok(k[c].fixR2.p0.every((x) => x[2] >= x[3]), `${c}: P0 floors`);
    assert.equal(k[c].p1Start, 346, c);
  }
  assert.ok(k.D.lastInk <= 4200 && k.D.photoInMs <= 5300, JSON.stringify([k.D.lastInk, k.D.photoInMs]));
  assert.equal(r.out.letterScale || 1, 1, 'no lettering cut');
});
test('fix r2 (art): class P draws rear-tube-level, at its D/T pen position, and nothing else of the rear bay', () => {
  const r = (builds.find(([n]) => n === 'art') || [])[1];
  if (!r) return;
  const raw = JSON.parse(fs.readFileSync(ART, 'utf8')), by = Object.fromEntries(raw.strokes.map((s) => [s.id, s]));
  assert.equal(by['rear-tube-level'].classes, 'DTP');
  assert.equal(by['bar-below-brace'].classes, 'DT');
  assert.equal(by['lower-rail-top'].classes, 'DT');
  assert.deepEqual(raw.strokes.filter((s) => s.area === 'rear-bay' && s.classes.includes('P')).map((s) => s.id), ['rear-tube-level']);
  for (const c of ['D', 'T', 'P']) {
    const ids = at(r, c).map((e) => e.id);
    assert.equal(ids[ids.indexOf('rear-tube-level') - 1], 'shadow-ground-rear', `${c}: after the rear wheel's shadow`);
  }
  assert.deepEqual(r.out.counts, { D: 87, T: 44, P: 36 });
  assert.ok(r.out.classes.P.lastInk <= 3500 && r.out.classes.P.limitsOk);
});
test('fix r2 (engine): place() keeps the canvas opacity; a devicePixelRatio change lays the canvases out again', () => {
  const src = fs.readFileSync(path.resolve(__dirname, '../engine/engine.js'), 'utf8');
  assert.doesNotMatch(src.replace(/\/\/[^\n]*/g, ''), /cssText/, 'no cssText: it wiped the opacity setOp() set');
  assert.match(src, /const place = \(el, l, t, w, h\) => \{ const s = el\.style; s\.left = l \+ "px"; s\.top = t \+ "px"; s\.width = w \+ "px"; s\.height = h \+ "px"; \};/);
  // read every frame after t0, before the settle and the drawing: re-lay out and replay up to the pen clock
  assert.match(src, /io\.observe\(cv\[2\]\);\s*\}\s*\}\s*(\/\/[^\n]*\n\s*)*if \(M\.min\(3, W\.devicePixelRatio \|\| 1\) !== dpr && layout\(\)\) replay\(clock\);\s*if \(sAt >= 0\) \{/);
  // the minified copy carries both
  assert.doesNotMatch(first.engineMin, /cssText/);
  assert.match(first.engineMin, /M\.min\(3,W\.devicePixelRatio\|\|1\)!==\w+&&\w+\(\)\)\w+\(\w+\);if\(\w+>=0\)\{/);
});
