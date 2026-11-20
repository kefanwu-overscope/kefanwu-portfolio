#!/usr/bin/env node
// Hero pen build (PEN_SPEC sections 4, 5, 11, 12.6). Reads the art's named strokes (tools/hero-pen/out/strokes.json,
// shape in tools/hero-pen/README.md), gates them, orders them, fits integer cubics at 0.5 src px with corner markers,
// solves one schedule per class with the engine's own motion, checks the build limits, and writes:
//   <out>/hero-pen-block.html   the inline data block + the minified engine, ready to replace the deferred script
//   <out>/data.txt, <out>/engine.min.js, <out>/build.json (index, schedules, per-class checks, sizes)
// Options:
//   --in <strokes.json>   input (default tools/hero-pen/out/strokes.json; the pilot's pen-data.json is accepted too)
//   --out <dir>           output folder (default tools/hero-pen/out/build)
//   --gate fail|warn|drop content gates (default fail)
//   --page <dir>          also write <dir>/index.html: the R1 index.html (`git show <base>:index.html`; --base <rev|file>,
//                         default HEAD; 9af034df or later) with its guard kept, three canvases for the inline SVG and
//                         the block for the deferred hero script (a test page; never the working-tree index.html)
//   --site <label>        with --page: the page as shipped (integration, 2026-11-10): no test STYLE (its rules live in
//                         white-home-20261011.css) and the ?v= of white-home-20261011.css and card-drawing-20261027.js
//                         set to <label>. The site's index.html is a copy of that output; --check verifies it.
//   --check <html>        exit 1 unless <html> contains exactly this build's block and the page invariants hold
//   --no-near-wheels      keep the art's P2 order (revision 6 moves the rear-bay tubes next to their wheels)
//   --quiet
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib'), crypto = require('crypto'), cp = require('child_process');
const F = require('./fit.cjs'), SV = require('./solve.cjs'), { minifyAuto } = require('./minify.cjs');

const ENGINE_DIR = __dirname, PEN_DIR = path.resolve(__dirname, '..'), SITE = path.resolve(PEN_DIR, '../..');
const DEFAULTS = { in: path.join(PEN_DIR, 'out/strokes.json'), out: path.join(PEN_DIR, 'out/build'), gate: 'fail', order: null, quiet: false, noCuts: false, write: true };
let log = console.log;
const CW = SV.CW;
const br3 = (s) => zlib.brotliCompressSync(Buffer.from(s), { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 3 } }).length;
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');

// ---------- engine core (the page's own math) ----------
// LF always: a Windows checkout (core.autocrlf) may hold CRLF, and the inline copy must not depend on it
const ENGINE_SRC = fs.readFileSync(path.join(ENGINE_DIR, 'engine.js'), 'utf8').replace(/\r\n/g, '\n');
// internal stroke properties shortened in the inline copy (none of them is a DOM, Promise or __heroDraw property)
const ENGINE_PROPS = { start: 'b', dur: 'd', end: 'e', upto: 'o', cap: 'c', sub: 'q' };
function loadCore(src = ENGINE_SRC) {
  const a = src.indexOf('//@core-start'), b = src.indexOf('//@core-end');
  if (a < 0 || b < a) throw Error('engine.js: core markers missing');
  return new Function(src.slice(a, b) + '\nreturn { decode: decodeLine, posAt, ptAt, pick, ang };')();
}
const core = loadCore();

// ---------- input normalisation ----------
const TIER_OF_KIND = { guide: 'g', contour: 'c', tyre: 'y', form: 'f', detail: 'd', glyph: 'd', letter: 'd', numeral: 'n', hatch: 'h', arc: 'h', streak: 'h', accent: 'a' };
const KIND_OF_TIER = { g: 'guide', c: 'contour', y: 'contour', f: 'form', d: 'detail', n: 'numeral', h: 'hatch', a: 'accent' };
const ORDERED_KINDS = new Set(['hatch', 'arc', 'streak', 'glyph', 'letter', 'numeral']);
function maskOf(v) {
  if (typeof v === 'number') return v & 7;
  if (typeof v === 'string') return (v.includes('P') ? 1 : 0) | (v.includes('T') ? 2 : 0) | (v.includes('D') ? 4 : 0);
  if (Array.isArray(v)) return maskOf(v.join(''));
  if (v && typeof v === 'object') return (v.P ? 1 : 0) | (v.T ? 2 : 0) | (v.D ? 4 : 0);
  return 7;
}
function normalize(raw, IN = 'input') {
  // The pilot's pen-data.json: polylines at 0.5 src px, one order per set; take the "spec" set's order.
  if (raw.sets && raw.strokes && raw.strokes[0] && raw.strokes[0].xy) {
    const order = raw.sets.spec ? raw.sets.spec.order : raw.strokes.map((_, i) => i);
    const strokes = order.map((i) => {
      const d = raw.strokes[i], pts = [];
      for (let k = 0; k < d.xy.length; k += 2) pts.push([d.xy[k] / 2, d.xy[k + 1] / 2]);
      const patch = d.a.startsWith('hatch-') ? d.a.slice(6) : null;
      const kind = d.t === 'h' ? (patch === 'fw' || patch === 'rw' ? 'arc' : patch === 'ground' ? 'streak' : 'hatch') : KIND_OF_TIER[d.t];
      const cut = patch === 'panel' || patch === 'box' ? 1 : d.t === 'h' && (patch === 'body' || patch === 'ground') ? 5 : d.p === 5 ? 4 : undefined;
      return { id: d.nm || `pilot-${i}`, pts, phase: d.p, area: d.a, tier: d.t, kind, classes: d.m, prov: d.src, group: patch || undefined, corners: d.c,
        pinned: ['traced', 'fitted', 'derived', 'convention'].includes(d.src), join: [!!(d.f & 1), !!(d.f & 2)], cut };
    });
    return { source: 'pilot pen-data.json (rough, never shipped)', car: raw.header.car, seed: raw.header.seed, strokes, pilot: true };
  }
  const list = Array.isArray(raw) ? raw : raw.strokes;
  if (!Array.isArray(list)) throw Error('strokes.json: no strokes list');
  const strokes = list.map((s, i) => {
    let pts = s.pts || s.polyline || s.points || s.poly;
    if (!pts && s.xy) { pts = []; for (let k = 0; k < s.xy.length; k += 2) pts.push([s.xy[k] / 2, s.xy[k + 1] / 2]); }
    // cubic segments from the art ([[p0, p1, p2, p3], ...] src px); 'corners' then index segments (a corner before segs[k])
    const segs = Array.isArray(s.segs) && s.segs.length && Array.isArray(s.segs[0]) && s.segs[0].length === 4 ? s.segs : null;
    if (!pts && segs) { pts = [segs[0][0]]; for (const c of segs) for (let k = 1; k <= 8; k++) pts.push(F.bez(c, k / 8)); }
    if (!Array.isArray(pts) || pts.length < 2) throw Error(`stroke ${s.id || i}: no polyline`);
    if (typeof pts[0] === 'number') { const q = []; for (let k = 0; k < pts.length; k += 2) q.push([pts[k], pts[k + 1]]); pts = q; }
    if (Array.isArray(pts[0]) === false && pts[0].x != null) pts = pts.map((p) => [p.x, p.y]);
    const phase = s.phase != null ? +s.phase : +s.p;
    const tier = s.tier || s.t || TIER_OF_KIND[s.kind || s.k] || 'd';
    const kind = s.kind || s.k || KIND_OF_TIER[tier];
    const m = s.classes != null ? maskOf(s.classes) : s.mask != null ? maskOf(s.mask) : s.m != null ? maskOf(s.m) : 7;
    return { id: String(s.id || s.name || s.nm || `s${i}`), pts: pts.map((p) => [+p[0], +p[1]]), phase, area: String(s.area || s.a || s.cluster || 'misc'), tier, kind, classes: m,
      prov: s.prov || s.provenance || s.src || null, members: s.members || s.inventory || null,
      segs, segCorners: segs ? (s.corners || []).filter((k) => k > 0 && k < segs.length) : null, corners: segs ? null : s.corners || s.c || null,
      group: s.group || s.patch || s.word || s.burst || undefined, pinned: s.pinned != null && s.pinned !== false ? true : s.pinned === false ? false : null,
      join: s.join || (typeof s.joined === 'number' ? [!!(s.joined & 1), !!(s.joined & 2)] : null), cut: s.cut, len: s.len,
      word: s.word || null, letter: s.letter || null };
  });
  // a list that declares itself the drawing order keeps it (the art ordered and flipped the strokes); otherwise the build orders
  const ordered = raw.ordered === true || /drawing order/i.test(String(raw.order_note || ''));
  return { source: raw.source || raw.format || IN, car: raw.car || raw.car_box || [932, 430.7, 1758.5, 927.6], seed: raw.seed || 20261107, areaOrder: raw.areaOrder || null, split: raw.split,
    carMask: raw.carMask || null, ordered, strokes };
}

// ---------- gates (PEN_SPEC 12.6 deny-lists; critic's build gate). Lengths are measured on pts (0.1 px precision), so
// the 40 src px rule allows 0.5 px of measurement slack. ----------
const DENY_WORDS = ['wishbone', 'toe', 'tsal', 'spoke', 'rotor', 'upright', 'hub', 'damper', 'pushrod', 'lamp', 'brake', 'suspension', 'harness'];
const DENY_IDS = new Set(['fw-lit-arm']);
const DENY_FEATURES = ['side-names-front', 'side-names-rear', 'top-names', 'top-t-logo', 'top-tesla-word', 'top-stripe-logo', 'side-mark', 'arch-stalk', 'arch-top-object',
  'green-patch', 'fw-hoosier-upper', 'fw-hoosier-lower', 'rw-hoosier-upper', 'rw-hoosier-lower', 'front-glint-long', 'front-glint-curved', 'front-glint-small', 'front-cluster',
  'front-parallel-lines', 'front-wishbones', 'fw-spoke-right', 'lower-body-contour', 'column-mid', 'rail-top-left-half'];
const PROV = new Set(['traced', 'fitted', 'derived', 'convention']);
function pointInPoly(q, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > q[1] !== yj > q[1] && q[0] < ((xj - xi) * (q[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
function midpoint(p) {
  const L = F.plen(p);
  let s = 0;
  for (let i = 1; i < p.length; i++) { const d = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); if (s + d >= L / 2) { const u = d ? (L / 2 - s) / d : 0; return [p[i - 1][0] + (p[i][0] - p[i - 1][0]) * u, p[i - 1][1] + (p[i][1] - p[i - 1][1]) * u]; } s += d; }
  return p[p.length - 1];
}
function gates(N) {
  const v = [], notRun = [];
  const lines = N.strokes.filter((s) => !ORDERED_KINDS.has(s.kind) && s.tier !== 'h');
  const linePts = lines.map((s) => [s, F.resample(s.pts, 1)]);
  for (const s of N.strokes) {
    const L = F.plen(s.pts), toks = s.id.toLowerCase().split(/[^a-z0-9]+/);
    if (!ORDERED_KINDS.has(s.kind) && s.tier !== 'h' && L < 39.5) v.push({ id: s.id, gate: 'short', msg: `${L.toFixed(1)} src px < 40` });
    if (DENY_IDS.has(s.id) || toks.some((t) => DENY_WORDS.includes(t))) v.push({ id: s.id, gate: 'deny-id', msg: 'id asserts a function or is dropped' });
    if (s.members && s.members.some((m) => DENY_FEATURES.includes(String(m).replace(/:.*$/, '')))) v.push({ id: s.id, gate: 'deny-feature', msg: 'member on the deny-list' });
    if (!PROV.has(s.prov)) v.push({ id: s.id, gate: 'provenance', msg: `provenance "${s.prov}" not one of traced/fitted/derived/convention` });
    if (N.carMask) {
      const m = midpoint(s.pts);
      if (!N.carMask.some((poly) => pointInPoly(m, poly))) {
        const d = Math.min(...N.carMask.map((poly) => F.distToPolyline(m, poly.concat([poly[0]]))));
        if (d > 10) v.push({ id: s.id, gate: 'car-mask', msg: `midpoint ${d.toFixed(1)} src px outside the car mask` });
      }
    }
    if (s.kind === 'hatch' && !/tyre|tire|wheel|(^|-)(fw|rw)(-|$)/.test(String(s.group || '') + ' ' + s.area)) {
      let best = Infinity;
      for (const [o, q] of linePts) if (o.classes & s.classes) best = Math.min(best, F.distToPolyline(s.pts[0], q));
      if (best > 6) v.push({ id: s.id, gate: 'hatch-start', msg: `flick starts ${best.toFixed(1)} src px from the nearest drawn line (> 6)` });
    }
  }
  const streaks = N.strokes.filter((s) => s.kind === 'streak');
  if (streaks.length > 2) v.push({ id: streaks.map((s) => s.id).join(','), gate: 'streaks', msg: `${streaks.length} ground streaks (> 2)` });
  if (!N.carMask) notRun.push('car-mask: no carMask polygons in the input');
  return { violations: v, notRun };
}

// ---------- order (PEN_SPEC section 4) ----------
function order(N, mode) {
  if ((mode || (N.ordered ? 'input' : 'build')) === 'input') {
    // keep the list; only relabel a long detail-phase 'nose' area into rear and front halves (beats at the crossing)
    for (const s of N.strokes) if (s.phase === 3 && s.area === 'nose') s.area = midpoint(s.pts)[0] >= 1150 ? 'nose-rear' : 'nose-front';
    return N.strokes.slice().sort((a, b) => a.phase - b.phase);
  }
  const out = [];
  let pen = null;
  const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  for (let p = 0; p < 6; p++) {
    let ph = N.strokes.filter((s) => s.phase === p);
    if (!ph.length) continue;
    if (p <= 1 || p === 5) { out.push(...ph); pen = ph[ph.length - 1].pts[ph[ph.length - 1].pts.length - 1]; continue; }
    // split areas (critic: the nose area of the detail phase into rear and front halves)
    const split = (N.split && N.split[p]) || (p === 3 ? { nose: 'x' } : null);
    if (split) for (const [area] of Object.entries(split)) {
      const g = ph.filter((s) => s.area === area);
      if (g.length < 2) continue;
      const xs = g.map((s) => midpoint(s.pts)[0]), mid = (Math.min(...xs) + Math.max(...xs)) / 2;
      if (Math.max(...xs) - Math.min(...xs) < 0.12 * CW) continue;
      for (const s of g) s.area = midpoint(s.pts)[0] >= mid ? area + '-rear' : area + '-front';
    }
    const seen = [];
    for (const s of ph) if (!seen.includes(s.area)) seen.push(s.area);
    let areas = seen;
    const ao = N.areaOrder && (N.areaOrder[p] || N.areaOrder[String(p)]);
    if (ao) { const exp = []; for (const a of ao) for (const x of [a, a + '-rear', a + '-front']) if (seen.includes(x) && !exp.includes(x)) exp.push(x); areas = exp.concat(seen.filter((a) => !exp.includes(a))); }
    else if (p === 3) areas = seen.flatMap((a) => (a.endsWith('-front') ? [] : a.endsWith('-rear') ? [a, a.replace(/-rear$/, '-front')].filter((x) => seen.includes(x)) : [a]));
    for (const ar of areas) {
      const grp = ph.filter((s) => s.area === ar);
      const fixed = grp.filter((s) => ORDERED_KINDS.has(s.kind));
      const free = grp.filter((s) => !ORDERED_KINDS.has(s.kind)).sort((a, b) => F.plen(b.pts) - F.plen(a.pts));
      // big to small, then the nearest end to the next start, flipping unpinned strokes to start near the pen
      while (free.length) {
        let best = Infinity, bi = 0, flip = false;
        free.forEach((s, i) => {
          const L = F.plen(s.pts), a = s.pts[0], b = s.pts[s.pts.length - 1];
          const s0 = pen ? d(a, pen) - 0.35 * L : -L, s1 = pen ? d(b, pen) - 0.35 * L : -L;
          if (s0 < best) { best = s0; bi = i; flip = false; }
          if (s.pinned !== true && s1 < best) { best = s1; bi = i; flip = true; }
        });
        const s = free.splice(bi, 1)[0];
        if (flip) { s.pts = s.pts.slice().reverse(); if (s.corners) s.corners = null; s.flipped = true; s.flippedByBuild = true; }
        out.push(s);
        pen = s.pts[s.pts.length - 1];
      }
      for (const s of fixed) { out.push(s); pen = s.pts[s.pts.length - 1]; }
    }
  }
  return out;
}

// ---------- fit + encode (PEN_SPEC 11: integer cubic deltas at 0.5 src px, '|' at corners) ----------
const TOL = 0.5;
function encodeFromSegs(s, P) {
  const q = (v) => Math.round(v * 2), toks = [];
  let X = q(s.segs[0][0][0]), Y = q(s.segs[0][0][1]);
  toks.push(X, Y);
  s.segs.forEach((c, k) => {
    if (s.segCorners.includes(k)) toks.push('|');
    const e = [q(c[3][0]), q(c[3][1])];
    toks.push(q(c[1][0]) - X, q(c[1][1]) - Y, q(c[2][0]) - X, q(c[2][1]) - Y, e[0] - X, e[1] - Y);
    X = e[0]; Y = e[1];
  });
  const geo = core.decode('d000 ' + toks.join(' '));
  const err = F.hausdorff(P, geo.x.map((x, i) => [x, geo.y[i]]));
  return { toks: toks.join(' '), err, segs: s.segs.length, corners: s.segCorners.length, P, fromArt: true };
}
function encodeGeometry(s) {
  const P = F.resample(s.pts, 1.0);
  if (s.segs && !s.flippedByBuild) { const r = encodeFromSegs(s, P); if (r.err <= 0.5) return r; }
  let cut = [];
  if (s.tier !== 'h') {
    if (Array.isArray(s.corners) && s.corners.length && !s.flipped) {
      // map input indices to the resampled path by arc position
      const arcs = [0];
      for (let i = 1; i < s.pts.length; i++) arcs.push(arcs[i - 1] + Math.hypot(s.pts[i][0] - s.pts[i - 1][0], s.pts[i][1] - s.pts[i - 1][1]));
      const L = arcs[arcs.length - 1];
      cut = s.corners.filter((i) => i > 0 && i < s.pts.length - 1).map((i) => Math.round((arcs[i] / L) * (P.length - 1)));
    } else cut = F.corners(P, 4, 60);
    cut = [...new Set(cut)].filter((i) => i > 1 && i < P.length - 2).sort((a, b) => a - b);
  }
  const runs = [];
  let a = 0;
  for (const c of cut.concat([P.length - 1])) { if (c - a >= 1) runs.push(P.slice(a, c + 1)); a = c; }
  for (const tol of [0.42, 0.3, 0.18, 0.1, 0.05, 0.02]) {
    const q = (v) => Math.round(v * 2);
    const toks = [];
    let X = q(P[0][0]), Y = q(P[0][1]);
    toks.push(X, Y);
    runs.forEach((run, ri) => {
      if (ri) toks.push('|');
      for (const c of F.fitRun(run, tol)) {
        const e = [q(c[3][0]), q(c[3][1])];
        toks.push(q(c[1][0]) - X, q(c[1][1]) - Y, q(c[2][0]) - X, q(c[2][1]) - Y, e[0] - X, e[1] - Y);
        X = e[0]; Y = e[1];
      }
    });
    const geo = core.decode('d000 ' + toks.join(' '));
    const pts = geo.x.map((x, i) => [x, geo.y[i]]);
    const err = F.hausdorff(P, pts);
    if (err <= TOL) return { toks: toks.join(' '), err, segs: toks.filter((t) => t !== '|').length / 6 - 1 / 3, corners: cut.length, P };
  }
  // last resort: every 1 px step of the resampled path as a straight cubic (exact, larger)
  {
    const q = (v) => Math.round(v * 2), toks = [];
    let X = q(P[0][0]), Y = q(P[0][1]);
    toks.push(X, Y);
    for (let i = 1; i < P.length; i++) {
      const e = [q(P[i][0]), q(P[i][1])];
      if (cut.includes(i - 1) && i > 1) toks.push('|');
      toks.push(Math.round((e[0] - X) / 3), Math.round((e[1] - Y) / 3), Math.round((2 * (e[0] - X)) / 3), Math.round((2 * (e[1] - Y)) / 3), e[0] - X, e[1] - Y);
      X = e[0]; Y = e[1];
    }
    const geo = core.decode('d000 ' + toks.join(' '));
    const err = F.hausdorff(P, geo.x.map((x, i) => [x, geo.y[i]]));
    if (err <= TOL) return { toks: toks.join(' '), err, segs: P.length - 1, corners: cut.length, P, fallback: 'polyline' };
  }
  throw Error(`stroke ${s.id}: cubic fit over ${TOL} src px at every tolerance`);
}
function joinFlags(seq, P) {
  const lineTiers = 'cynfda';
  const trees = seq.map((s, i) => (lineTiers.includes(s.tier) ? P[i] : null));
  return seq.map((s, i) => {
    if (Array.isArray(s.join)) return (s.join[0] ? 1 : 0) | (s.join[1] ? 2 : 0);
    if (!'cynfd'.includes(s.tier)) return 0;
    const near = (q) => trees.some((t, j) => t && j !== i && F.distToPolyline(q, t) < 3);
    return (near(s.pts[0]) ? 1 : 0) | (near(s.pts[s.pts.length - 1]) ? 2 : 0);
  });
}

// ---------- revision 5: joins overlap ----------
// A line (not a glyph, guide or shade) whose end is join-flagged (it continues or lands on another stroke within 3 src
// px) is drawn at full width through the joint (engine.js taper(): no taper on a flagged end) and runs on OVERLAP src px
// past the joint along its own end tangent, so the two round caps overlap instead of meeting edge to edge.
const OVERLAP = 1;
function overlapJoins(seq) {
  const rec = [];
  const tan = (pts, end) => {
    const q = end ? pts.slice().reverse() : pts, a = q[0];
    for (let k = 1; k < q.length; k++) { const d = dist(a, q[k]); if (d >= 2 || k === q.length - 1) return [(a[0] - q[k][0]) / d, (a[1] - q[k][1]) / d]; }
    return [0, 0];
  };
  for (const s of seq) {
    if (!Array.isArray(s.join) || !'cyfda'.includes(s.tier) || ORDERED_KINDS.has(s.kind)) continue;
    for (const end of [0, 1]) {
      if (!s.join[end]) continue;
      const pts = s.pts, a = end ? pts[pts.length - 1] : pts[0], t = tan(pts, end), b = [a[0] + OVERLAP * t[0], a[1] + OVERLAP * t[1]];
      const lin = (u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
      if (end) {
        s.pts = pts.concat([b]);
        if (s.segs) s.segs = s.segs.concat([[a, lin(1 / 3), lin(2 / 3), b]]);
      } else {
        s.pts = [b].concat(pts);
        if (s.segs) { s.segs = [[b, lin(2 / 3), lin(1 / 3), a]].concat(s.segs); if (s.segCorners) s.segCorners = s.segCorners.map((k) => k + 1); }
        if (s.corners) s.corners = s.corners.map((k) => k + 1);
      }
      rec.push([s.id, end ? 'end' : 'start']);
    }
  }
  return rec;
}

// ---------- glyph units (revision 1 timing rules) ----------
// A glyph stroke id is <word>-<NN>-<char>[-2|-3|-dot] (tools/hero-pen/README.md); explicit 'word' and 'letter'
// fields win. Numerals are tier n. Each letter (or i-dot) is one unit: at most one unit ends per frame. The first
// lettering word gets a floor of 34 ms per letter, shared by its strokes in proportion to length.
const GLYPH_ID = /^(.*?)-(\d{2})-([a-z0-9])(?:-(\d|dot))?$/i;
function glyphKeys(seq, geos) {
  const out = seq.map((s) => {
    if (!SV.GLYPH.has(s.kind) && s.tier !== 'n') return {};
    const m = GLYPH_ID.exec(s.id), dot = !!(m && m[4] && m[4].toLowerCase() === 'dot');
    const word = s.word || (m ? m[1] : s.group || s.area), letter = s.letter ? s.letter + (dot ? '-dot' : '') : m ? m[1] + '-' + m[2] + (dot ? '-dot' : '') : s.id;
    return { word, letter, dot, num: s.tier === 'n' };
  });
  // revision 2: every letter (and i-dot) lasts clamp(34 ms x sqrt(path / 25 src px), 25, 50) ms, shared by its strokes
  // by length, with at least one frame for a glyph stroke of 15 src px or more (the old first-word floor is gone)
  const len = {};
  out.forEach((g, i) => { if (g.word && !g.num) len[g.letter] = (len[g.letter] || 0) + geos[i].L; });
  letterTimes(out, geos, len);
  // the lift before a new word: 40 ms, 70 ms at the line break (the new word starts left of the previous word)
  let pw = null, pwX = 0;
  out.forEach((g, i) => {
    if (!g.word || g.num || g.dot) return;
    if (g.word !== (pw && pw.word)) {
      const x = seq[i].pts[0][0];
      if (pw) g.wl = x < pwX ? SV.K.LINE_LIFT : SV.K.WORD_LIFT;
      pw = g; pwX = x;
    }
  });
  return out;
}

// each letter stroke's time (lx) from its letter's path; revision 5: SV.K.LETTER_SCALE shortens all letters alike
function letterTimes(out, geos, len) {
  if (!len) { len = {}; out.forEach((g, i) => { if (g.word && !g.num) len[g.letter] = (len[g.letter] || 0) + geos[i].L; }); }
  out.forEach((g, i) => {
    if (!g.word || g.num) return;
    const share = (SV.letterMs(len[g.letter]) * geos[i].L) / Math.max(1e-6, len[g.letter]);
    g.lx = geos[i].L >= SV.K.GLYPH_FRAME_L ? Math.max(SV.FR + 0.01, share) : share;
  });
}

// ---------- revision 2: the ending (critics of the revision 1 films) ----------
// The payoff is the last ink: lettering at D, the side 219 at T and P, then the develop. So the detail phase keeps only
// the glyphs: its nose lines join the P2 nose-top area (each where it adds the least pen travel), its rear-frame tubes
// follow the P2 box area, any other P3 line ends P2. The P4 shadows come right after P2 as one left-to-right sweep (areas
// by their leftmost point, every shadow edge drawn left to right), then the P5 accents the build keeps, then P3.
const endOf = (s) => s.pts[s.pts.length - 1];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
function flipStroke(s) {
  s.pts = s.pts.slice().reverse();
  if (s.segs) {
    const n = s.segs.length;
    s.segs = s.segs.slice().reverse().map((c) => [c[3], c[2], c[1], c[0]]);
    if (s.segCorners) s.segCorners = s.segCorners.map((k) => n - k).filter((k) => k > 0 && k < n).sort((a, b) => a - b);
  }
  if (Array.isArray(s.corners)) s.corners = s.corners.map((k) => s.pts.length - 1 - k).sort((a, b) => a - b);
  if (Array.isArray(s.join)) s.join = [s.join[1], s.join[0]];
  s.flipped = !s.flipped;
  s.flippedByEnding = true;
}
function ending(seq) {
  const rec = { moved: [], flipped: [], order: null };
  const isGlyph = (s) => SV.GLYPH.has(s.kind) || s.tier === 'n';
  const p3lines = seq.filter((s) => s.phase === 3 && !isGlyph(s));
  if (!p3lines.length && !seq.some((s) => s.phase === 4 || s.phase === 5)) return rec;
  let out = seq.filter((s) => !(s.phase === 3 && !isGlyph(s)));
  const p2idx = () => out.map((s, i) => (s.phase === 2 ? i : -1)).filter((i) => i >= 0);
  const insertBest = (s, lo, hi) => {
    // insert s between out[lo..hi] (positions lo..hi+1), or flipped, where it adds the least pen travel
    let best = Infinity, at = hi + 1, flip = false;
    for (let k = lo; k <= hi + 1; k++) {
      const a = k > 0 ? endOf(out[k - 1]) : null, b = k < out.length ? out[k].pts[0] : null;
      for (const f of s.pinned === true ? [false] : [false, true]) {
        const p0 = f ? endOf(s) : s.pts[0], p1 = f ? s.pts[0] : endOf(s);
        const c = (a ? dist(a, p0) : 0) + (b ? dist(p1, b) : 0) - (a && b ? dist(a, b) : 0);
        if (c < best - 1e-9) { best = c; at = k; flip = f; }
      }
    }
    if (flip) { flipStroke(s); rec.flipped.push(s.id); }
    out.splice(at, 0, s);
  };
  for (const s of p3lines) {
    const from = s.area;
    const nose = /^nose/.test(s.area), rear = s.area === 'rear-frame';
    const P2 = p2idx();
    s.phase = 2;
    if (nose) {
      const nt = P2.filter((i) => out[i].area === 'nose-top');
      s.area = 'nose-top';
      // never before the area's first (largest) stroke, which opens the form phase
      if (nt.length) insertBest(s, nt[0] + 1, nt[nt.length - 1]); else out.splice(P2.length ? P2[P2.length - 1] + 1 : out.length, 0, s);
    } else {
      // after the box area (rear frame) or at the end of P2; strokes moved together keep their order
      const box = P2.filter((i) => out[i].area === 'box'), moved = P2.filter((i) => out[i].movedFrom === from);
      const at = moved.length ? moved[moved.length - 1] + 1 : rear && box.length ? box[box.length - 1] + 1 : P2.length ? P2[P2.length - 1] + 1 : out.length;
      out.splice(at, 0, s);
    }
    s.movedFrom = from;
    rec.moved.push([s.id, 'P3 ' + from, 'P2 ' + s.area]);
  }
  // P4 then P5 straight after P2, P4 areas by their leftmost point, shadow edges drawn left to right
  const p4 = out.filter((s) => s.phase === 4), p5 = out.filter((s) => s.phase === 5);
  out = out.filter((s) => s.phase !== 4 && s.phase !== 5);
  const areas = [];
  for (const s of p4) if (!areas.includes(s.area)) areas.push(s.area);
  const minX = (a) => Math.min(...p4.filter((s) => s.area === a).flatMap((s) => s.pts.map((p) => p[0])));
  areas.sort((a, b) => minX(a) - minX(b));
  const sweep = [];
  for (const a of areas) for (const s of p4) if (s.area === a) {
    if (SV.isShade(s) && s.pts[0][0] > endOf(s)[0]) { flipStroke(s); rec.flipped.push(s.id); }
    sweep.push(s);
  }
  const last2 = out.map((s) => s.phase).lastIndexOf(2);
  out.splice(last2 + 1, 0, ...sweep, ...p5);
  rec.order = SV.runs(out).map((r) => r.p);
  seq.length = 0;
  seq.push(...out);
  return rec;
}
// revision 6 (feel critic, round 6; main loop round 6): the rear-bay tubes are drawn next to the wheels they connect:
// lower-rail-top right after the front wheel's last P2 stroke (it starts at the front tyre), rear-tube-level and
// bar-below-brace right after the rear wheel's (shadow-ground-rear). Orientation stays as authored. Idempotent: a stroke
// already in place does not move; a missing id or area is skipped. build.json `nearWheels` records it with the P2 hops.
const NEXT_TO_WHEEL = [[['lower-rail-top'], 'front-wheel'], [['rear-tube-level', 'bar-below-brace'], 'rear-wheel']];
function nearWheels(seq) {
  const rec = { moved: [] };
  for (const [ids, area] of NEXT_TO_WHEEL) {
    const ms = ids.map((id) => seq.find((s) => s.id === id && s.phase === 2)).filter(Boolean);
    if (!ms.length) continue;
    const rest = seq.filter((s) => !ms.includes(s));
    const k = rest.map((s) => s.phase === 2 && s.area === area).lastIndexOf(true);
    if (k < 0) continue;
    const was = ms.map((s) => seq.indexOf(s)).join();
    seq.length = 0;
    seq.push(...rest.slice(0, k + 1), ...ms, ...rest.slice(k + 1));
    if (ms.map((s) => seq.indexOf(s)).join() !== was) rec.moved.push([ms.map((s) => s.id), 'after ' + rest[k].id]);
  }
  return rec;
}
// pen hops between consecutive P2 strokes of one class (src px from one end to the next start), for the record
function p2Hops(seq, bit) {
  const p2 = seq.filter((s) => s.phase === 2 && s.classes & bit), hops = [];
  for (let i = 1; i < p2.length; i++) hops.push([p2[i - 1].id, p2[i].id, +(dist(endOf(p2[i - 1]), p2[i].pts[0]) / CW).toFixed(3)]);
  const max = hops.reduce((a, h) => (h[2] > a[2] ? h : a), ['', '', 0]);
  return { n: hops.length, maxCw: max[2], max: max.slice(0, 2), travelCw: +hops.reduce((a, h) => a + h[2], 0).toFixed(3), over020: hops.filter((h) => h[2] > 0.2) };
}
// revision 2: the P5 accents kept (D and T): a designer's return pass over the tyres, only while D stays under its limit
const KEEP_ACCENTS = ['acc-front-tyre-lower-right', 'acc-rear-tyre-lower'];
// revision 2: each ghost rim loop retires 150 ms after its rim's last stroke has inked (flag bit 4 on both lines; the
// k-th flagged guide pairs with the k-th flagged line of the class)
const GHOSTS = [['ghost-front-rim', 'fw-rim-fit'], ['ghost-rear-rim', 'rw-rim-fit']];

// ---------- main ----------
function build(o = {}) {
  o = { ...DEFAULTS, ...o };
  const IN = path.resolve(o.in), OUT = path.resolve(o.out), GATE = o.gate;
  log = o.quiet ? () => {} : console.log;
  const raw = JSON.parse(fs.readFileSync(IN, 'utf8'));
  SV.K.LETTER_SCALE = 1;
  const N = normalize(raw, IN);
  const G = gates(N);
  if (G.violations.length) {
    log(`gates: ${G.violations.length} violations (${GATE})`);
    const byGate = {};
    for (const x of G.violations) byGate[x.gate] = (byGate[x.gate] || 0) + 1;
    log('  ', JSON.stringify(byGate));
    if (GATE === 'fail') { for (const x of G.violations.slice(0, 40)) log('  ', x.gate, x.id, x.msg); const e = Error('gates: ' + G.violations.length + ' violations'); e.violations = G.violations; throw e; }
    if (GATE === 'drop') {
      const bad = new Set(G.violations.filter((x) => x.gate !== 'provenance' && x.gate !== 'streaks').map((x) => x.id));
      N.strokes = N.strokes.filter((s) => !bad.has(s.id));
    }
  }
  const seq = order(N, o.order);
  const endRec = o.ending === false ? { off: true } : ending(seq);
  const hopsBefore = Object.fromEntries([['D', 4], ['T', 2], ['P', 1]].map(([c, b]) => [c, p2Hops(seq, b)]));
  const wheelRec = o.nearWheels === false ? { off: true } : nearWheels(seq);
  wheelRec.hops = Object.fromEntries([['D', 4], ['T', 2], ['P', 1]].map(([c, b]) => [c, { before: hopsBefore[c], after: p2Hops(seq, b) }]));
  const overlapRec = o.overlap === false ? { off: true } : overlapJoins(seq);
  const enc = seq.map(encodeGeometry);
  const flags = joinFlags(seq, enc.map((e) => e.P));
  // revision 4: decoded with the stroke's own tier (a numeral's motion differs), exactly as the page decodes it
  const geos = enc.map((e, i) => core.decode(seq[i].tier + '000 ' + e.toks));
  // classes: the P5 accents are dropped (critic, revision 1: at D and T they cost 292 ms and half of them started after
  // the develop; at P they were cut so last ink stays under 3.5 s), except KEEP_ACCENTS at D and T (revision 2, drawn
  // before the payoff, so finished before the develop); a class over its last-ink limit drops them first
  // default off: with them D's last ink is 4463 ms (> 4400), and the critic's condition was to skip them then
  const keepAcc = o.accents === true;
  const masks = seq.map((s) => (s.phase === 5 ? (keepAcc && KEEP_ACCENTS.includes(s.id) ? s.classes & 6 : 0) : s.classes));
  const cutsApplied = { D: [], T: [], P: [] };
  const nAcc = seq.filter((s) => s.phase === 5).length;
  for (const c of ['D', 'T', 'P']) {
    const kept = seq.filter((s, i) => s.phase === 5 && masks[i] & { D: 4, T: 2, P: 1 }[c]).map((s) => s.id);
    cutsApplied[c].push(`P5 accents: ${nAcc - kept.length} of ${nAcc} dropped` + (kept.length ? `; kept ${kept.join(', ')}` : ''));
  }
  // ghost rim loops: flag bit 4 on the guide and on its rim's last stroke (paired in order)
  const ghostPairs = [];
  for (const [g, t] of GHOSTS) {
    const gi = seq.findIndex((s) => s.id === g), ti = seq.findIndex((s) => s.id === t);
    if (gi < 0 || ti < 0) continue;
    if (masks[gi] & ~masks[ti]) throw Error(`ghost ${g}: its rim stroke ${t} is missing in a class`);
    if (ghostPairs.length && (gi < ghostPairs[ghostPairs.length - 1][0] || ti < ghostPairs[ghostPairs.length - 1][1])) throw Error(`ghost ${g}: pairs out of order`);
    flags[gi] |= 4;
    flags[ti] |= 4;
    ghostPairs.push([gi, ti, g, t]);
  }
  const glyph = glyphKeys(seq, geos);
  const solverStrokes = seq.map((s, i) => ({ id: s.id, phase: s.phase, area: s.area, kind: s.kind, tier: s.tier, group: s.group, geo: geos[i], flags: flags[i], ...glyph[i] }));
  const prepared = SV.prepare(core, solverStrokes);
  const CUT_ORDER = { D: [1, 2, 3, 4, 5], T: [1, 2, 3, 4, 5], P: [1, 2, 3, 5] };
  const results = {};
  for (const [cls, bit] of [['D', 4], ['T', 2], ['P', 1]]) {
    let steps = CUT_ORDER[cls].slice();
    for (;;) {
      const idx = prepared.map((_, i) => i).filter((i) => masks[i] & bit);
      const cs = idx.map((i) => prepared[i]);
      const scale = {};
      let sol, chk;
      for (let tries = 0; tries < 40; tries++) {
        sol = SV.solveClass(cs, cls, scale);
        chk = SV.checkClass(core, cs, sol.sched, cls);
        if (!chk.windows.localityOver025 && !chk.windows.overInk040 && !chk.windows.overEndCap) break;
        // slow the offending phase a little and solve again (rounding and the table sampling can tip a window)
        const at = chk.windows.violationAt[0];
        let ph = 2, t0 = -Infinity;
        for (const [p, r] of Object.entries(chk.phases)) if (+p >= 2 && at + SV.FR > r[0] && r[0] > t0) { t0 = r[0]; ph = +p; }
        scale[ph] = (scale[ph] || 1) * 0.96;
      }
      // revision 5: class D over its target (last ink or photo-in): shorten the lettering (all letters alike, a glyph
      // stroke of 15 src px or more keeps >= 1 frame) in 1 % steps down to LETTER_SCALE_MIN; never P1
      if (cls === 'D' && !chk.target.ok && cs.some((s) => s.lx != null) && SV.K.LETTER_SCALE > SV.K.LETTER_SCALE_MIN + 1e-9 && !o.noLetterScale) {
        SV.K.LETTER_SCALE = +(SV.K.LETTER_SCALE - 0.01).toFixed(2);
        letterTimes(glyph, geos);
        prepared.forEach((s, i) => { if (glyph[i].lx != null) s.lx = glyph[i].lx; });
        continue;
      }
      // revision 2: over the limit, the kept accents go first (before any cut-order step)
      const acc = idx.filter((i) => seq[i].phase === 5);
      if (chk.lastInk > SV.K.LIMIT[cls] && acc.length && !o.noCuts) {
        for (const i of acc) masks[i] &= ~bit;
        cutsApplied[cls].push(`kept accents dropped: last ink ${chk.lastInk} > ${SV.K.LIMIT[cls]}`);
        continue;
      }
      if (chk.lastInk <= SV.K.LIMIT[cls] || !steps.length || o.noCuts) { results[cls] = { idx, sol, chk, scale }; break; }
      const step = steps.shift();
      let n = 0;
      seq.forEach((s, i) => { if (s.cut === step && masks[i] & bit) { masks[i] &= ~bit; n++; } });
      cutsApplied[cls].push(`cut order step ${step} (${n} strokes)`);
      log(`class ${cls}: last ink ${chk.lastInk} > ${SV.K.LIMIT[cls]}: cut step ${step} (${n} strokes)`);
    }
  }
  // revision 2: each ghost loop retires (150 ms) after its rim's last stroke and before the develop starts
  const ghosts = {};
  for (const c of ['D', 'T', 'P']) {
    const R = results[c], ends = [];
    let t = 0;
    for (const [g, d] of R.sol.sched) { t += g + d; ends.push(t); }
    ghosts[c] = ghostPairs.filter(([gi]) => R.idx.includes(gi)).map(([gi, ti, g, tn]) => {
      const k = R.idx.indexOf(ti), retireEnd = ends[k] + SV.K.GHOST_MS, devStart = R.chk.devStart;
      return { guide: g, rimStroke: tn, rimEnd: ends[k], retireEnd, devStart, ok: retireEnd <= devStart };
    });
    if (ghosts[c].some((x) => !x.ok)) { R.chk.frameViolations.push(`ghost retire ends after the develop start`); R.chk.limitsOk = false; }
  }
  // ---------- emit the block ----------
  const head = `HP1 2200 1238 ${N.car.join(' ')} ${N.seed}`;
  const lines = seq.map((s, i) => `${s.tier}${s.phase}${masks[i]}${flags[i]} ${enc[i].toks}`);
  const live = lines.map((l, i) => (masks[i] ? l : null));
  const keep = live.map((l, i) => (l ? i : -1)).filter((i) => i >= 0);
  const T = ['P', 'T', 'D'].map((c) => `T ${c} ` + results[c].sol.sched.map(([g, d]) => g + ' ' + d).join(' '));
  const data = [head, ...keep.map((i) => lines[i]), ...T].join('\n');
  const dataBlock = `<script type="text/plain" id="hero-pen-data">\n${data}\n</script>`;
  const engineMin = minifyAuto(ENGINE_SRC.replace('"use strict";', ''), ENGINE_PROPS).code;
  // every internal property must have been renamed (a shorthand key or a missed access would break the page)
  { const left = require('./minify.cjs').tokenize(engineMin).filter((t) => t.t === 'w' && Object.prototype.hasOwnProperty.call(ENGINE_PROPS, t.v)); if (left.length) throw Error('minified engine still names ' + left.map((t) => t.v).join(',')); }
  const engineBlock = `<script>${engineMin}</script>`;
  const block = `${dataBlock}\n    ${engineBlock}`;
  // hashes the engine computes (FNV-1a of the class lines + schedule line)
  const hashes = {};
  for (const c of ['D', 'T', 'P']) {
    const pk = core.pick(data, c);
    hashes[c] = pk.hash;
    if (pk.L.length !== results[c].idx.length) throw Error(`class ${c}: ${pk.L.length} lines vs ${results[c].idx.length} scheduled`);
  }
  const dataD = [head, ...keep.filter((i) => masks[i] & 4).map((i) => lines[i]), T[2]].join('\n');
  const sizes = {
    dataBlock: { raw: Buffer.byteLength(dataBlock), br3: br3(dataBlock) },
    dataClassDOnly: { raw: Buffer.byteLength(dataD), br3: br3(dataD) },
    engine: { raw: Buffer.byteLength(engineMin), br3: br3(engineMin) },
    engineSource: { raw: Buffer.byteLength(ENGINE_SRC), br3: br3(ENGINE_SRC) },
    block: { raw: Buffer.byteLength(block), br3: br3(block) },
  };
  // ---------- records ----------
  const index = seq.map((s, i) => {
    const e = { i, id: s.id, phase: s.phase, area: s.area, tier: s.tier, kind: s.kind, group: s.group || null, prov: s.prov, members: s.members || null,
      mask: masks[i], flags: flags[i], lengthSrcPx: +geos[i].L.toFixed(1), fitErrSrcPx: +enc[i].err.toFixed(3), cubics: Math.round(enc[i].segs), corners: enc[i].corners, flipped: !!s.flipped, fitFrom: enc[i].fromArt ? 'art segs' : 'build fit' };
    for (const c of ['D', 'T', 'P']) {
      const k = results[c].idx.indexOf(i);
      if (k >= 0) { let t = 0; for (let j = 0; j <= k; j++) { t += results[c].sol.sched[j][0]; if (j < k) t += results[c].sol.sched[j][1]; } e[c] = [t, results[c].sol.sched[k][1]]; }
    }
    return e;
  });
  const out = {
    format: 'hero-pen-build/1', builtFrom: IN, inputSha256: sha(fs.readFileSync(IN)), source: N.source, engineSha256: sha(ENGINE_SRC), engineMinSha256: sha(engineMin), dataSha256: sha(data),
    seed: N.seed, car: N.car, order: o.order || (N.ordered ? 'input' : 'build'), counts: Object.fromEntries(['D', 'T', 'P'].map((c) => [c, results[c].idx.length])), hashes, sizes,
    budgets: { dataBr3Max: 9216, engineBr3Max: 6144, dataOk: sizes.dataBlock.br3 <= 9216, engineOk: sizes.engine.br3 <= 6144 },
    gates: { mode: GATE, violations: G.violations, notRun: G.notRun }, cutsApplied, letterScale: SV.K.LETTER_SCALE, overlap: overlapRec, ending: endRec, nearWheels: wheelRec, ghosts,
    classes: Object.fromEntries(['D', 'T', 'P'].map((c) => [c, { ...results[c].chk, solver: results[c].sol.info, phaseScale: results[c].scale }])),
    fit: { maxErrSrcPx: +Math.max(...enc.map((e) => e.err)).toFixed(3), cubics: enc.reduce((a, e) => a + Math.round(e.segs), 0), corners: enc.reduce((a, e) => a + e.corners, 0) },
    schedules: Object.fromEntries(['D', 'T', 'P'].map((c) => [c, results[c].sol.sched])),
    index,
  };
  if (o.write) {
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(path.join(OUT, 'data.txt'), data + '\n');
    fs.writeFileSync(path.join(OUT, 'engine.min.js'), engineMin + '\n');
    fs.writeFileSync(path.join(OUT, 'hero-pen-block.html'), block + '\n');
    fs.writeFileSync(path.join(OUT, 'build.json'), JSON.stringify(out, null, 1));
  }
  log(`strokes ${seq.length}; classes D ${out.counts.D} T ${out.counts.T} P ${out.counts.P}; fit max ${out.fit.maxErrSrcPx} src px, ${out.fit.cubics} cubics`);
  log(`sizes: data block ${sizes.dataBlock.raw} B (br3 ${sizes.dataBlock.br3}); class D only br3 ${sizes.dataClassDOnly.br3}; engine ${sizes.engine.raw} B (br3 ${sizes.engine.br3})`);
  for (const c of ['D', 'T', 'P']) {
    const k = out.classes[c];
    log(`class ${c}: n ${k.n} lastInk ${k.lastInk} (limit ${k.limit}) p1 ${k.p1Start}+${k.p1Len} ok ${k.limitsOk} | viol ${k.frameViolations.length} | win ends ${k.windows.worstEnds} ink ${k.windows.worstInkCw} loc ${k.windows.worstLocalityCw} (>0.25: ${k.windows.localityOver025}) | pace ${JSON.stringify(k.pace)} | S ${JSON.stringify(Object.fromEntries(Object.entries(k.solver).map(([p, v]) => [p, v.S])))}`);
    log(`    target ${JSON.stringify(k.target)} photoIn ${k.photoInMs} joins ${JSON.stringify(k.phaseJoins)} p2Long n ${k.p2Long.n} min ${k.p2Long.minMs} ms, end gap ${k.p2Long.minEndGapMs} ms`);
    log(`    order ${k.phaseSequence.join('')} last ${k.lastStroke} devStart ${k.devStart} lettering ${JSON.stringify(k.glyphs.letteringMs || null)} ghosts ${JSON.stringify(out.ghosts[c].map((g) => [g.rimEnd, g.retireEnd]))} cuts ${JSON.stringify(cutsApplied[c])}`);
    if (k.frameViolations.length) log('   ', k.frameViolations.slice(0, 6).join(' ; '));
  }
  return { out, block, data, engineMin, geo: geos };
}

// ---------- test page from a committed index.html (revision 6: the R1 page of HEAD 9af034df) ----------
// The base is `git show <rev>:index.html` (default HEAD) or a file holding such a copy, never the working tree. It
// must be the R1 page (9af034df, ?v=refresh-20261107): the R1 guard with no session key, script#kw-scroll, the inline
// SVG and the deferred hero script. The page keeps the R1 guard as it is: it arms html.hero-draw before first paint on
// every load and reload with no session memory; it excludes back_forward and a #link other than #top except on a
// reload (kw-scroll drops the fragment there); a held view-transition arrival (__vtBoot.hold) plays; a hidden or
// prerendered tab is marked data-hero-pen="wait" and arms on its first visible; until the engine exists
// (window.__heroDraw) intent or pagehide drops the drawing, and 4 s without it drops it (a failed script). The pen
// engine replaces the rest: the inline SVG (three canvases instead), the deferred hero-drawing script (the data block
// and the inline engine in its place), and the guard's later duties (the engine settles on input in 160 ms, scroll is
// not intent, hidden/pagehide/bfcache teardown). The STYLE below is the test page's: canvas placement and the CSS
// backstop moved from 3.3 s to 12 s once the engine owns the drawing (html.hero-draw-js); index.html integration owns
// the final CSS.
const STYLE = '<style id="hero-pen-test-style">.hero-draw-lines canvas{position:absolute;display:block;pointer-events:none}html.hero-draw.hero-draw-js .white-home .hero-draw-veil{animation:hero-draw-backstop 1ms linear 12s forwards}html.hero-draw.hero-draw-js .white-home .hero-draw-lines:not([hidden]){animation:hero-draw-backstop 1ms linear 12s forwards}</style>';
const CANVASES = '<div class="hero-draw-lines" aria-hidden="true" hidden><canvas data-layer="guide"></canvas><canvas data-layer="shade"></canvas><canvas data-layer="ink"></canvas></div>';
const HERO_TAG = /<script defer src="hero-drawing-20261027\.js\?v=[^"]*"><\/script>/g;
const isGuard = (l) => l.trim().startsWith('<script>') && l.includes('hero=draw') && l.includes('data-hero-pen');
// the R1 rules the engine relies on, read from the guard's own text
function guardRules(g) {
  return {
    noSessionMemory: !/sessionStorage|localStorage|kw-hero-drawn/.test(g),
    reloadKeepsHash: /h!=="#top"&&n!=="reload"/.test(g),
    excludesBackForward: /n==="back_forward"/.test(g),
    heldArrivalsPlay: !/__vtBoot|\.hold\b/.test(g),
    waitsForVisible: /"wait"/.test(g) && /"late"/.test(g) && /prerenderingchange/.test(g),
    dropsUntilEngine: /!window\.__heroDraw/.test(g) && /setTimeout\(\w+,4000\)/.test(g),
    intentEvents: ['pointerdown', 'touchstart', 'wheel', 'keydown', 'pagehide'].every((e) => g.includes('"' + e + '"')) && !/"scroll"/.test(g),
  };
}
function baseHtml(base) {
  if (base && fs.existsSync(base)) return fs.readFileSync(base, 'utf8');
  return cp.execFileSync('git', ['-C', SITE, 'show', `${base || 'HEAD'}:index.html`], { encoding: 'utf8', maxBuffer: 1 << 26 });
}
function page(dir, block, base, site) {
  const must = (c, w) => { if (!c) throw Error('page: ' + w); };
  must(!site || /^[a-z0-9-]+$/.test(site), 'site label: lower-case letters, digits and hyphens only');
  let html = baseHtml(base);
  must(!html.includes('kw-hero-drawn'), 'the base is the pre-R1 page (session key kw-hero-drawn); use the index.html of 9af034df or later');
  must(html.includes('<script id="kw-scroll">'), 'script#kw-scroll missing (R1 page expected)');
  const lines = html.split('\n');
  const gs = lines.map((l, i) => (isGuard(l) ? i : -1)).filter((i) => i >= 0);
  must(gs.length === 1, `exactly one R1 guard (found ${gs.length})`);
  const rules = guardRules(lines[gs[0]]);
  for (const [k, v] of Object.entries(rules)) must(v, 'R1 guard rule not found: ' + k);
  must(lines.findIndex((l) => l.includes('id="kw-scroll"')) < gs[0], 'kw-scroll after the guard');
  const ci = gs[0] - 1;
  if (lines[ci] && lines[ci].includes('<!-- Hero line drawing (hero-drawing-20261027.js)')) {
    lines[ci] = lines[ci].replace('(hero-drawing-20261027.js)', '(the inline hero pen: script#hero-pen-data and the engine after it)').replace('that file has started', 'the engine has started');
  }
  html = lines.join('\n');
  const a = html.indexOf('<div class="hero-draw-lines" aria-hidden="true" hidden>'), b = html.indexOf('</svg></div>', a);
  must(a > 0 && b > a, 'svg block');
  html = html.slice(0, a) + CANVASES + html.slice(b + '</svg></div>'.length);
  const tags = html.match(HERO_TAG) || [];
  must(tags.length === 1, `exactly one deferred hero script (found ${tags.length})`);
  html = html.replace(HERO_TAG, () => block);
  if (site) {
    // The page as shipped: the canvas rule and the 12 s backstops live in white-home-20261011.css, and the card gate
    // follows the pen (html.hero-draw-inked) in card-drawing-20261027.js; both get the release's cache label.
    for (const f of ['white-home-20261011.css', 'card-drawing-20261027.js']) {
      const re = new RegExp(f.replace(/\./g, '\\.') + '\\?v=[a-z0-9-]+', 'g');
      must((html.match(re) || []).length === 1, `exactly one ${f}?v= reference`);
      html = html.replace(re, () => `${f}?v=${site}`);
    }
  } else html = html.replace('</head>', () => '    ' + STYLE + '\n  </head>');
  if (dir) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), html);
  }
  return html;
}
// what --check verifies on a page besides the block itself
function pageInvariants(html, block) {
  const lines = html.split('\n'), gs = lines.filter(isGuard);
  const f = {
    blockOnce: html.split(block).length === 2,
    oneGuard: gs.length === 1,
    guardRules: gs.length === 1 ? guardRules(gs[0]) : null,
    kwScroll: html.includes('<script id="kw-scroll">'),
    noSessionKey: !html.includes('kw-hero-drawn'),
    noHeroScript: !/<script[^>]+src="hero-drawing-20261027\.js/.test(html),
    noHeroSvg: !/<div class="hero-draw-lines"[^>]*>\s*<svg/.test(html),
    canvases: html.includes(CANVASES),
    dataBeforeEngine: /<script type="text\/plain" id="hero-pen-data">[\s\S]*?<\/script>\s*<script>/.test(html),
  };
  f.ok = Object.entries(f).every(([k, v]) => (k === 'guardRules' ? !!v && Object.values(v).every(Boolean) : v));
  return f;
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
  const flag = (k) => argv.includes('--' + k);
  let r;
  try {
    r = build({ in: opt('in', DEFAULTS.in), out: opt('out', DEFAULTS.out), gate: opt('gate', 'fail'), order: opt('order', null), quiet: flag('quiet'), noCuts: flag('no-cuts'),
      ending: !flag('no-ending'), nearWheels: !flag('no-near-wheels'), accents: flag('accents') });
  } catch (e) { console.error(String(e.message || e)); process.exit(2); }
  if (opt('page')) {
    let html;
    try { html = page(path.resolve(opt('page')), r.block, opt('base'), opt('site')); } catch (e) { console.error(String(e.message || e)); process.exit(2); }
    const head = Buffer.from(baseHtml(opt('base')));
    log(`page ${path.resolve(opt('page'), 'index.html')} from ${opt('base') || 'HEAD'}: ${Buffer.byteLength(html)} B, br3 ${br3(html)} (base index.html ${head.length} B, br3 ${br3(head)}; +${br3(html) - br3(head)} B br3)`);
  }
  if (opt('check')) {
    const html = fs.readFileSync(path.resolve(opt('check')), 'utf8').replace(/\r\n/g, '\n');   // a CRLF checkout counts as LF
    if (!html.includes(r.block)) { console.error('check: the block in', opt('check'), 'differs from a fresh build'); process.exit(1); }
    const inv = pageInvariants(html, r.block);
    if (!inv.ok) { console.error('check: page invariants fail', JSON.stringify(inv)); process.exit(1); }
    log('check: block identical; page invariants', JSON.stringify(inv));
  }
}
module.exports = { build, normalize, order, encodeGeometry, loadCore, page, pageInvariants, guardRules, baseHtml, nearWheels, p2Hops, NEXT_TO_WHEEL, gates, joinFlags, ENGINE_SRC, ENGINE_PROPS, core, DEFAULTS };
