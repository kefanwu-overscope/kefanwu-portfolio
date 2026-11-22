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
  return new Function(src.slice(a, b) + '\nreturn { decode: decodeLine, posAt, ptAt, pick, ang, dens, lop, ss };')();
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
// drafting hero (2026-11-21): the convention tiers. The car-mask gate and the 40 src px short-piece gate exempt a stroke
// BY ITS TIER (p pencil construction, k chain line, m drafting ink, r arrowhead), never by its id; conventions are
// checked by conventionGates() instead. Lettering (tier l) is traced glyph art and keeps the car-mask gate.
const CONV_TIERS = new Set(['p', 'k', 'm', 'r']);
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
// det (dense3 final solver): { ids, minLen } gives the detail strokes their own short-piece floor (pens.cjs DK.MIN_LEN)
function gates(N, minLen = 40, det = null) {
  const v = [], notRun = [];
  const lines = N.strokes.filter((s) => !ORDERED_KINDS.has(s.kind) && s.tier !== 'h');
  const linePts = lines.map((s) => [s, F.resample(s.pts, 1)]);
  for (const s of N.strokes) {
    const L = F.plen(s.pts), toks = s.id.toLowerCase().split(/[^a-z0-9]+/), ml = det && det.ids.has(s.id) ? det.minLen : minLen;
    if (!ORDERED_KINDS.has(s.kind) && s.tier !== 'h' && !CONV_TIERS.has(s.tier) && L < ml - 0.5) v.push({ id: s.id, gate: 'short', msg: `${L.toFixed(1)} src px < ${ml}` });
    if (DENY_IDS.has(s.id) || toks.some((t) => DENY_WORDS.includes(t))) v.push({ id: s.id, gate: 'deny-id', msg: 'id asserts a function or is dropped' });
    if (s.members && s.members.some((m) => DENY_FEATURES.includes(String(m).replace(/:.*$/, '')))) v.push({ id: s.id, gate: 'deny-feature', msg: 'member on the deny-list' });
    if (!PROV.has(s.prov)) v.push({ id: s.id, gate: 'provenance', msg: `provenance "${s.prov}" not one of traced/fitted/derived/convention` });
    if (N.carMask && !CONV_TIERS.has(s.tier)) {
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

// =====================================================================================================================
// THE DRAFTING HERO, merge build (2026-11-21), the final line (2026-11-22). The car art is the final line's art
// (out/final/strokes.json, the default set; its build options in out/final/build-options.json), every car stroke of a
// class drawn at that class, plus the drafting conventions (out/final/conventions.json), pens A-C and the detail lanes
// X Y Z, the develop and exits on the V
// line. Every timing, lane and density limit fails the build (engine/pens.cjs). The owner's words (2026-11-21): draw the
// denser set; every line must still fall on a real edge of the photo. All numbers here are agent decisions.
// =====================================================================================================================
const PN = require('./pens.cjs');
const LETTER_WORDS = ['olin', 'college', 'of', 'engineering'];
// The short-piece gate: v3's 40 src px floor drops to 20 src px for the denser tracing round's set (every line stroke of
// that round was >= 20 src px; panel-top 21.4, post-lower 24.1, tie-low 30.3, rod-thin 30.4, diag-tube-far 34.9). Detail
// strokes have their own floor (pens.cjs DK.MIN_LEN, 13 src px). An agent floor.
const MIN_LEN = 20;
// Size pins (agent decisions). The engine pin 6656 B br3 stays. The data-block pin (5800 B br3 since the merge build) is
// lifted deliberately by the dense3 final solver: the clean art's measured data block plus a margin for about 15 more
// strokes (README of dense3/final/solver).
// solver round 2 (agent, 2026-11-22): 7264 -> 7345 B br3 = the final art's measured data block with the round-2 schedule
// (runs/r2-final: 6945 B br3) + 400 B (about 16 strokes at 25 B br3). Before: 7264 = 6863 B (clean art) + 401 B.
const PINS = { engineBr3: 6656, engineCeiling: 7000, dataBr3: 7345 };
// Gate lifts: lifted for exactly this id and this gate, only when the art itself records the relaxation (its 'deny_lift');
// every lift is written to build.json. R1's deny entry column-mid is an agent convention, not an owner rule.
const GATE_LIFTS = {
  'column-seam': { gate: 'deny-feature', needs: /column-mid/ },
  // dense3 final solver: the three decal marks of dense passes 1 and 2, lifted exactly as dense2/art/work/build2.cjs and
  // every dense3 build lifted them in memory (each art stroke records its deny_lift; the lift is written to build.json)
  'decal-tesla-t': { gate: 'deny-feature', needs: /top-t-logo/ },
  'decal-bose': { gate: 'deny-feature', needs: /top-stripe-logo/ },
  'decal2-tesla-word': { gate: 'deny-feature', needs: /top-tesla-word/ },
};
// integration onto 5b20926f (2026-11-22, agent): the only shipped set is the final line's art. The earlier rounds' sets
// (round 0, fix round 1, RICH) do not ship. A set folder may hold build-options.json: the options its build needs (groups,
// the detail rule's fix1 ids, lanes, reorder, plan scale, car-with-lettering scope, class order, the T/P cabin block and
// its pace, the data pin); buildDrafting applies them when the set is built from its own file, and explicit options win.
const SETS = { final: 'out/final/strokes.json' };
const DEFAULT_SET = 'final';
function setOptions(set) {
  const rel = SETS[set];
  if (!rel) return {};
  const dir = path.join(PEN_DIR, path.dirname(rel)), f = path.join(dir, 'build-options.json');
  if (!fs.existsSync(f)) return {};
  const j = JSON.parse(fs.readFileSync(f, 'utf8')), o = {};
  if (j.conventions) o.conv = path.join(dir, j.conventions);
  if (j.groups) o.groups = path.join(dir, j.groups);
  for (const k of ['fix1Ids', 'ac', 'detailLanes', 'reorder', 'planScale', 'cwlScope', 'classOrder', 'cabinEarly', 'cabinPace', 'dataPin']) if (j[k] !== undefined) o[k] = j[k];
  return o;
}
// fix round 1 (truth-1): the rim arcs and the compass ellipses keep off the Hoosier sidewall letters (conventions.json
// tyreLetters: whole letter components; letterPixels also takes the rim's own highlights). A rim arc (car ink) has at
// most RIM_LETTER_MAX samples (1 src px) within 2 src px of a letter. A compass ellipse (pencil lay-in, a full lap of the
// rim fit) may graze letter ends where the rim fit runs in flat black next to them, but not run along them: at most
// COMPASS_LETTER_SHARE of its samples and COMPASS_LETTER_RUN in a row within 2 src px (round 0's compass-front: 36 % and
// 10 in a row, fails; compass-rear: 10 %, 6 in a row, recorded). Agent limits.
const RIM_ARCS = ['fw-rim-seen', 'fw-rim-fit', 'rw-rim-seen', 'rw-rim-fit'], COMPASSES = ['compass-front', 'compass-rear'];
const RIM_LETTER_MAX = 3, COMPASS_LETTER_SHARE = 0.12, COMPASS_LETTER_RUN = 8;
function rimLetterGate(strokes, cdoc) {
  const TL = cdoc.tyreLetters;
  if (!TL) throw Error('conventions.json has no tyreLetters (run conventions.py of fix round 1)');
  const px = TL.front.concat(TL.rear), v = [], rec = {};
  for (const s of strokes) {
    if (!RIM_ARCS.includes(s.id) && !COMPASSES.includes(s.id)) continue;
    const P = F.resample(s.pts, 1);
    let near = 0, min = Infinity, run = 0, cur = 0;
    for (const p of P) { const d = distPts(p, px); min = Math.min(min, d); if (d <= 2) { near++; cur++; run = Math.max(run, cur); } else cur = 0; }
    rec[s.id] = { samples: P.length, within2: near, longestRun: run, minDist: +min.toFixed(2) };
    if (RIM_ARCS.includes(s.id) && near > RIM_LETTER_MAX) v.push({ id: s.id, gate: 'rim-letters', msg: `${near} of ${P.length} samples within 2 src px of the Hoosier letters` });
    if (COMPASSES.includes(s.id) && (near / P.length > COMPASS_LETTER_SHARE || run > COMPASS_LETTER_RUN)) v.push({ id: s.id, gate: 'compass-letters', msg: `${near} of ${P.length} samples (${run} in a row) within 2 src px of the Hoosier letters` });
  }
  return { violations: v, records: rec };
}

function inPoly(q, poly) { return pointInPoly(q, poly); }
function distPts(p, list) { let m = Infinity; for (const q of list) { const d = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2; if (d < m) m = d; } return Math.sqrt(m); }
function ellipseInside(p, E, scale = 1) {
  const [cx, cy, rx, ry, deg] = E, c = Math.cos((deg * Math.PI) / 180), s = Math.sin((deg * Math.PI) / 180);
  const dx = p[0] - cx, dy = p[1] - cy, u = c * dx + s * dy, v = -s * dx + c * dy;
  return (u / (rx * scale)) ** 2 + (v / (ry * scale)) ** 2 <= 1;
}
// the convention gates (DRAFTING_SPEC content 'Convention gates')
function conventionGates(conv, cdoc, carMask, car) {
  const v = [], rec = {};
  const an = cdoc.anchors, LONG = an.long_line_end_x;
  const segDist = (q, pts) => F.distToPolyline(q, pts);
  const LP = cdoc.letterPixels || {};
  const bodyPx = Object.entries(LP).filter(([k]) => !/hoosier/.test(k)).flatMap(([, o]) => o.px), tyrePx = Object.entries(LP).filter(([k]) => /hoosier/.test(k)).flatMap(([, o]) => o.px);
  const carById = Object.fromEntries(car.map((s) => [s.id, s]));
  for (const s of conv) {
    const r = (rec[s.id] = {});
    const c = s.convention || {};
    if (!c.rule || !c.anchors) v.push({ id: s.id, gate: 'conv-record', msg: 'no rule or anchors' });
    const P = F.resample(s.pts, 1);
    r.maxX = +Math.max(...P.map((p) => p[0])).toFixed(1);
    if (r.maxX > LONG + 0.5) v.push({ id: s.id, gate: 'conv-long', msg: `ends at x ${r.maxX} > ${LONG.toFixed(1)} (one rear-rim diameter past the rear wheel)` });
    // lettering and names: nothing within 6 src px of the body's lettering, names and marks (the traced glyphs are car
    // art, not conventions). The Hoosier lettering runs round both tyre sidewalls, which every wheel lay-in mark must
    // cross: there drafting ink (m, r), which stays until density 0.98, may cross but never run along it (at most 3
    // samples within 2 src px); pencil lay-in (p, k), erased by density 0.31, is exempt by tier (its proximity recorded). This refines the spec's literal 6 src px for the tyre lettering; recorded per stroke.
    let near = Infinity, nearT = Infinity, alongT = 0;
    for (const p of P) {
      if (p[0] > 990 && p[0] < 1400 && p[1] > 620 && p[1] < 840) near = Math.min(near, distPts(p, bodyPx));
      if (p[0] > 1390 && p[0] < 1770 && p[1] > 680 && p[1] < 910) { const d = distPts(p, tyrePx); nearT = Math.min(nearT, d); if (d <= 2) alongT++; }
    }
    r.toBodyLettering = Number.isFinite(near) ? +near.toFixed(2) : null;
    r.toTyreLettering = Number.isFinite(nearT) ? +nearT.toFixed(2) : null;
    r.tyreLetteringWithin2 = alongT;
    if (near < 6) v.push({ id: s.id, gate: 'conv-lettering', msg: `${near.toFixed(1)} src px from the photo's lettering or names` });
    // pencil lay-in (p, k) is gone by density 0.31, before the photo's sidewall letters read: exempt by tier, recorded
    if ('mr'.includes(s.tier) && alongT > 3) v.push({ id: s.id, gate: 'conv-tyre-lettering', msg: `${alongT} of ${P.length} samples within 2 src px of the Hoosier lettering` });
    // inside the car mask: drafting ink (m, r) stays outside, except centre marks within the rims and extension lines
    // crossing the tyres; pencil and chain lines (p, k) serve the car and are exempt by tier (fraction recorded)
    let inside = 0, allowed = 0;
    for (const p of P) {
      const inMask = carMask && carMask.some((poly) => inPoly(p, poly)) && Math.min(...carMask.map((poly) => segDist(p, poly.concat([poly[0]])))) > 3;
      if (!inMask) continue;
      inside++;
      const inRim = ellipseInside(p, an.front_ellipse, 1.05) || ellipseInside(p, an.rear_ellipse, 1.05);
      const inTyre = ['front-tyre', 'rear-tyre'].some((t) => { const q = carById[t].pts; const xs = q.map((z) => z[0]), ys = q.map((z) => z[1]); return p[0] >= Math.min(...xs) && p[0] <= Math.max(...xs) && p[1] >= Math.min(...ys) && p[1] <= Math.max(...ys); });
      // the datum and the ground symbol lie on or under the ground line, which the car mask's shadow region covers
      const onGround = (s.kind === 'datum' || s.kind === 'ground-tick') && p[1] >= an.datum.slope * p[0] + an.datum.intercept - 1.5;
      if ((s.kind === 'centre-mark' && inRim) || (s.kind === 'extension' && inTyre) || onGround) allowed++;
    }
    r.insideCarMask = +(inside / P.length).toFixed(3);
    if ('mr'.includes(s.tier) && inside - allowed > 0) v.push({ id: s.id, gate: 'conv-car-mask', msg: `${inside - allowed} of ${P.length} samples inside the car mask` });
    // per kind
    const ends = [s.pts[0], s.pts[s.pts.length - 1]];
    if (s.kind === 'datum') {
      r.contacts = [an.front_contact, an.rear_contact].map((q) => +segDist(q, P).toFixed(3));
      if (r.contacts.some((d) => d > 1.5)) v.push({ id: s.id, gate: 'conv-datum', msg: `contacts ${r.contacts} src px from the datum (> 1.5)` });
    }
    if (s.kind === 'centre-mark' || s.kind === 'chain') {
      // solver round 2 (agent, 2026-11-22; ported from the dtrial's in-memory conv-centre patch, dense3/final/art/scripts/
      // pbuild.cjs patch 3): a convention that records anchors.lineThrough (an outer piece of a centre line split across the
      // wheel centre) is tested against the LINE through the piece's two ends (<= 0.5 src px), not its polyline; every other
      // centre mark and chain line is tested as before (stock sets build byte-identically)
      const lt = c.anchors && c.anchors.lineThrough;
      const cs = lt || (s.kind === 'chain' && s.id === 'centre-axle' ? [an.front_centre, an.rear_centre] : [c.anchors.centre]);
      const lineDist = (q, a, b) => Math.abs((b[0] - a[0]) * (a[1] - q[1]) - (a[0] - q[0]) * (b[1] - a[1])) / Math.hypot(b[0] - a[0], b[1] - a[1]);
      r.centres = cs.map((q) => +(lt ? lineDist(q, P[0], P[P.length - 1]) : segDist(q, P)).toFixed(3));
      if (lt) r.lineThrough = true;
      if (r.centres.some((d) => d > 0.5)) v.push({ id: s.id, gate: 'conv-centre', msg: `rim-fit centre ${r.centres} src px away (> 0.5)` });
    }
    if (s.kind === 'construction') {
      const a = c.anchors, n = [-a.fit_dir[1], a.fit_dir[0]];
      const off = (q) => Math.abs((q[0] - a.fit_centre[0]) * n[0] + (q[1] - a.fit_centre[1]) * n[1]);
      r.endsOffFit = ends.map((q) => +off(q).toFixed(3));
      const mem = carById[a.member];
      r.memberPointsWithin2 = mem ? mem.pts.filter((q) => off(q) <= 2).length : 0;
      if (r.endsOffFit.some((d) => d > 0.5)) v.push({ id: s.id, gate: 'conv-collinear', msg: `ends ${r.endsOffFit} src px off the member fit (> 0.5)` });
      if (r.memberPointsWithin2 < 25) v.push({ id: s.id, gate: 'conv-member', msg: `only ${r.memberPointsWithin2} points of ${a.member} within 2 src px of the fit` });
    }
    if (s.kind === 'compass') {
      const E = c.anchors.ellipse, [cx, cy, rx, ry, deg] = E, k = Math.PI / 180;
      let worst = 0;
      for (const p of P) {
        const cc = Math.cos(deg * k), sn = Math.sin(deg * k), dx = p[0] - cx, dy = p[1] - cy, u = cc * dx + sn * dy, w = -sn * dx + cc * dy;
        worst = Math.max(worst, Math.abs(Math.hypot(u / rx, w / ry) - 1) * Math.min(rx, ry));
      }
      r.offEllipse = +worst.toFixed(3);
      if (worst > 0.5) v.push({ id: s.id, gate: 'conv-compass', msg: `${worst.toFixed(2)} src px off the rim fit` });
    }
  }
  return { violations: v, records: rec };
}

function buildDrafting(o = {}) {
  o = { set: DEFAULT_SET, quiet: false, write: true, ...o };
  // integration: the set's own build options (out/final/build-options.json); an option given (not undefined) wins
  if (!o.in) o = { ...setOptions(o.set), ...Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) };
  const IN = path.resolve(o.in || path.join(PEN_DIR, SETS[o.set] || SETS[DEFAULT_SET]));
  // integration: the default conventions are the shipped set's (the earlier rounds' out/conventions.json does not ship)
  const CONV = path.resolve(o.conv || path.join(PEN_DIR, 'out', 'final', 'conventions.json'));
  const OUT = path.resolve(o.out || path.join(PEN_DIR, 'out', 'build-drafting'));
  log = o.quiet ? () => {} : console.log;
  const raw = JSON.parse(fs.readFileSync(IN, 'utf8')), cdoc = JSON.parse(fs.readFileSync(CONV, 'utf8'));
  const rawById = Object.fromEntries(raw.strokes.map((s) => [s.id, s]));
  // ---- the car art, ordered exactly as the R3 build orders it (input order, ending, near wheels, overlap joins)
  const N = normalize(raw, IN);
  const convN = normalize({ strokes: cdoc.strokes, car: N.car, ordered: true }, CONV).strokes;
  convN.forEach((s, k) => { const r = cdoc.strokes[k]; s.block = r.block; s.serves = r.serves || null; s.cut = r.cut || null; s.convention = r.convention; s.kind = r.kind; if (r.corners_pts) s.corners = r.corners_pts; });
  // ---- gates: one run over car art and conventions together; the car-mask and short gates exempt conventions by tier
  const all = { ...N, strokes: N.strokes.concat(convN) };
  // ---- dense3 final solver: the detail layer. With o.groups or o.fix1 a detail stroke is a car line (phase 1-3, not a
  // glyph) that carries clean metadata, or whose id the fix1 art (o.fix1) does not have (pass 2's extras). It runs on the
  // detail lanes (pens.cjs) and has its own short-piece floor (o.minLenDetail, default pens.cjs DK.MIN_LEN).
  // integration (2026-11-22): o.fix1Ids, the fix1 art's ids as a list, stands in for the file (the same rule)
  const fix1Ids = o.fix1Ids ? new Set(o.fix1Ids) : o.fix1 ? new Set(JSON.parse(fs.readFileSync(path.resolve(o.fix1), 'utf8')).strokes.map((s) => s.id)) : null;
  const GLYPH_BURST = new Set([...LETTER_WORDS, 'top-219', 'plate-219']);
  const detIds = o.groups || o.fix1 || o.fix1Ids ? new Set(raw.strokes.filter((s) => s.phase >= 1 && s.phase <= 3 && !GLYPH_BURST.has(s.burst) && (s.clean || (fix1Ids && !fix1Ids.has(s.id)))).map((s) => s.id)) : null;
  const minLenDetail = o.minLenDetail || PN.DK.MIN_LEN;
  const G = gates(all, MIN_LEN, detIds ? { ids: detIds, minLen: minLenDetail } : null);
  const lifted = [], hard = [], detailShort = [];
  for (const x of G.violations) {
    // dense3: o.recordDetailShort keeps a detail stroke under the detail floor as a recorded gate failure (build-final.cjs
    // fails on it after the records are written) instead of throwing here
    if (o.recordDetailShort && x.gate === 'short' && detIds && detIds.has(x.id)) { detailShort.push(x); continue; }
    const L = GATE_LIFTS[x.id], r = rawById[x.id];
    const recorded = r && L && L.gate === x.gate && L.needs.test(JSON.stringify(r.relaxes || []) + JSON.stringify(r.deny_lift || {}));
    if (recorded) lifted.push({ ...x, reason: (r.relaxes || []).concat(r.deny_lift ? Object.values(r.deny_lift) : []).join(' | '), set: r.set || null });
    else hard.push(x);
  }
  if (hard.length) { for (const x of hard.slice(0, 30)) log('  gate', x.gate, x.id, x.msg); throw Object.assign(Error('gates: ' + hard.length + ' violations'), { violations: hard }); }
  // the 20 src px floor, recorded per stroke it admits (each would fail v3's 40)
  const shortAdmitted = N.strokes.filter((s) => !ORDERED_KINDS.has(s.kind) && s.tier !== 'h' && !CONV_TIERS.has(s.tier) && F.plen(s.pts) < 39.5).map((s) => [s.id, +F.plen(s.pts).toFixed(1)]);
  const CG = conventionGates(convN, cdoc, N.carMask, N.strokes);
  const RG = rimLetterGate(N.strokes.concat(convN), cdoc);
  if (RG.violations.length) { for (const x of RG.violations) log('  rim gate', x.id, x.msg); throw Object.assign(Error('rim letter gate: ' + RG.violations.length + ' violations'), { violations: RG.violations }); }
  if (CG.violations.length) { for (const x of CG.violations.slice(0, 30)) log('  convention gate', x.gate, x.id, x.msg); throw Object.assign(Error('convention gates: ' + CG.violations.length + ' violations'), { violations: CG.violations }); }
  const car = order(N, 'input');
  const endRec = ending(car);
  const wheelRec = nearWheels(car);
  const overlapRec = overlapJoins(car);
  // ---- the car art for the drafting hero. The car SET of a class = its phase 1-3 strokes (contours, form and detail,
  // glyphs); the 3 phase-0 guides (two ghost rim loops, the nose gesture) are lay-in and the 5 phase-5 accents are never
  // drawn (as in every R3 build since revision 1). Every stroke of the set is drawn at its class: no car stroke is cut.
  // The ghost rim loops are replaced by the compass ellipses, the nose gesture becomes pencil (p, pen B), the lettering
  // (l) and the nose-top 219 (u) go to pen C on the PENCIL canvas: written early and erased before the photo's own white
  // letters read (pens.cjs); the side-plate 219 stays numeral ink (n, pen A).
  const retier = [];
  const carSeq = [];
  for (const s of car) {
    if (s.id === 'ghost-front-rim' || s.id === 'ghost-rear-rim') { retier.push([s.id, 'dropped: replaced by the compass ellipse']); continue; }
    if (s.phase === 5) { retier.push([s.id, 'not drawn: P5 accent (as every R3 build)']); continue; }
    const r = rawById[s.id];
    if (s.id === 'nose-gesture') { s.tier = 'p'; s.block = 'gesture'; s.serves = ['nose-loop']; s.prov = 'convention'; s.kind = 'gesture'; retier.push([s.id, 'g -> p (pencil lay-in, pen B; counted as a convention)']); }
    else if (o.text === 'side-219' && (LETTER_WORDS.includes(r.burst) || r.burst === 'top-219')) { retier.push([s.id, 'left to the photo (--text side-219, v3 comparison only)']); continue; }
    else if (LETTER_WORDS.includes(r.burst)) { s.tier = 'l'; s.block = 'lettering'; s.word = r.burst; retier.push([s.id, 'd -> l (lettering on PENCIL, pen C; same geometry and width as 0e561624)']); }
    else if (r.burst === 'top-219') { s.tier = 'u'; s.block = 'top-219'; s.number = 'top-219'; retier.push([s.id, 'n -> u (nose-top 219 on PENCIL, pen C; numeral width and motion as 0e561624)']); }
    else if (r.burst === 'plate-219') { s.block = 'side-219'; s.number = 'plate-219'; }
    else if (detIds && detIds.has(s.id)) s.block = 'detail';   // dense3: the detail lanes
    else if (s.phase === 1) s.block = 'silhouette';
    else if (s.phase === 2) s.block = PN.BLOCK_OF[s.id] || 'form';   // fix round 1: the wheel and cabin blocks (pens.cjs BLOCK_OF)
    else throw Error('drafting: no block for ' + s.id);
    s.cut = null;
    carSeq.push(s);
  }
  const seq = carSeq.concat(convN);
  for (const s of seq) { s.pen = s.block === 'detail' ? 'detail' : PN.PEN_OF_BLOCK[s.block] || PN.PEN_OF_TIER[s.tier]; if (!s.pen) throw Error('no pen for tier ' + s.tier + ' (' + s.id + ')'); }
  const enc = seq.map(encodeGeometry);
  const flags = joinFlags(seq, enc.map((e) => e.P)).map((f, i) => (CONV_TIERS.has(seq[i].tier) || 'lu'.includes(seq[i].tier) ? 0 : f));
  const geos = enc.map((e, i) => core.decode(seq[i].tier + '000 ' + e.toks));
  const prep = PN.prepare(core, seq, geos);
  const isCar = (i) => seq[i].prov !== 'convention';
  // ---- the car set per class, from the art file (the proof that nothing was dropped)
  const CLS = [['D', 4], ['T', 2], ['P', 1]];
  const carSet = Object.fromEntries(CLS.map(([c, bit]) => [c, raw.strokes.filter((s) => s.phase >= 1 && s.phase <= 3 && maskOf(s.classes) & bit).map((s) => s.id)]));
  // ---- solve each class; on a failed limit only conventions may be cut (the class's cut order, down to its floor)
  const masks = seq.map((s) => s.classes);
  // ---- dense3: the detail units per class. The groups file (o.groups, the format of dense3/clean/merge/groups.json) gives
  // the groups, their member order and one attach stroke per class; its entry for this art is the one whose members (all
  // classes) are exactly the art's detail strokes (or o.groupsKey). Anything inconsistent throws.
  // solver round 2 (agent, 2026-11-22): the nearest-line fallback is removed. Every detail stroke drawn at a class must be
  // a member of exactly one group of that class (pass 2's extras included: groups-final-full.json), or the build throws.
  // Hosts are matched by id only (no geometry is read for matching), so small geometry moves of any stroke cannot change
  // them. An attach cycle between units (a unit hanging, directly or through other units, on its own members) throws.
  const isDetail = (i) => seq[i].block === 'detail';
  const idOf = Object.fromEntries(seq.map((s, i) => [s.id, i]));
  const units = {}, detRec = { groupsFile: o.groups ? path.resolve(o.groups) : null, groupsEntry: null, membersNotDrawn: {} };
  if (detIds) {
    const GF = o.groups ? JSON.parse(fs.readFileSync(path.resolve(o.groups), 'utf8')) : { files: {} };
    const cleanIds = raw.strokes.filter((s) => s.clean && detIds.has(s.id)).map((s) => s.id).sort().join(',');
    const allDetIds = [...detIds].sort().join(',');
    const ents = Object.entries(GF.files || {});
    const memOf = (per) => [...new Set(['D', 'T', 'P'].flatMap((c) => (per[c] ? per[c].detailGroups.flatMap((g) => g.members.map((m) => m.stroke)) : [])))].sort().join(',');
    const ent = o.groupsKey ? ents.find(([k]) => k === o.groupsKey) : ents.find(([, per]) => memOf(per) === allDetIds);
    if (!ent && detIds.size) {
      const near = ents.map(([k, per]) => { const m = new Set(memOf(per).split(',')); return [k, [...detIds].filter((id) => !m.has(id))]; }).sort((a, b) => a[1].length - b[1].length)[0];
      throw Error('groups: no entry of ' + (o.groups || '(no groups file)') + ' has exactly the art\'s detail strokes as members' + (near ? `; the nearest entry ${near[0]} has no group for: ${near[1].join(', ')}` : '') + (cleanIds === allDetIds ? '' : ' (a groups file that lists only the clean strokes is not enough: every detail stroke needs a group)'));
    }
    detRec.groupsEntry = ent ? ent[0] : null;
    for (const [c, bit] of CLS) {
      const list = [], covered = new Set();
      for (const g of ent && ent[1][c] ? ent[1][c].detailGroups : []) {
        const mem = [];
        for (const m of g.members) {
          const i = idOf[m.stroke];
          if (i == null || !isDetail(i)) throw Error(`groups ${g.group} (${c}): ${m.stroke} is not a detail stroke of the art`);
          if (!(masks[i] & bit)) { (detRec.membersNotDrawn[c] = detRec.membersNotDrawn[c] || []).push(m.stroke); continue; }
          if (covered.has(m.stroke)) throw Error(`groups (${c}): ${m.stroke} is in two groups`);
          covered.add(m.stroke);
          mem.push(i);
        }
        if (!mem.length) continue;
        const ai = idOf[g.attachTo];
        if (ai == null || !(masks[ai] & bit) || !isCar(ai) || PN.GLYPH_BLOCKS.has(seq[ai].block)) throw Error(`groups ${g.group} (${c}): attach ${g.attachTo} is not a car line drawn at the class`);
        list.push({ key: g.group, attach: ai, members: mem, region: g.region || null });
      }
      const uncovered = seq.filter((s, i) => isDetail(i) && masks[i] & bit && !covered.has(s.id)).map((s) => s.id);
      if (uncovered.length) throw Error(`groups (${c}): detail strokes drawn at the class with no group in ${o.groups || '(no groups file)'}: ${uncovered.join(', ')}`);
      // attach cycles: unit u waits on the unit that holds its attach stroke
      const holder = new Map();
      list.forEach((u) => u.members.forEach((i) => holder.set(i, u)));
      for (const u of list) {
        const seen = new Set([u]);
        for (let w = holder.get(u.attach); w; w = holder.get(w.attach)) {
          if (seen.has(w)) throw Error(`groups (${c}): attach cycle through ${[...seen].map((x) => x.key).join(' -> ')} -> ${w.key}`);
          seen.add(w);
        }
      }
      units[c] = list;
    }
  }
  // o.planExtra { cls: { pen: [[block, t0, t1, after], ...] } } puts blocks first on a lane (the glyph-slot trial only)
  // solver round 3 (agent, 2026-11-22; OFF by default): o.cabinEarly { cls: id } moves pen C's 'cabin' block to the front of
  // pen C's lane at that class, waiting for the stroke id (an earlier-solved lane's stroke, e.g. pen A's 'helmet'); it is
  // placed at the pace it gets in the stock plan (pens.cjs opt.paceFix, computed per build from the art, below), so every
  // cabin stroke keeps its stock duration; side-219 and the rest of pen C follow it. Stock plan when unset.
  const planStock = (cls) => { const p = PN.PLAN[cls], x = (o.planExtra || {})[cls]; return x ? Object.fromEntries(Object.entries(p).map(([pen, bl]) => [pen, (x[pen] || []).concat(bl)])) : p; };
  const cabinEarlyOf = (cls) => (o.cabinEarly && o.cabinEarly[cls]) || null;
  const planFor = (cls) => {
    const ce = cabinEarlyOf(cls);
    if (!ce) return planStock(cls);
    if (!(PN.PLAN[cls].C || []).some((b) => b[0] === 'cabin')) throw Error('cabinEarly: no cabin block on pen C at ' + cls);
    if (idOf[ce] == null || !(masks[idOf[ce]] & { D: 4, T: 2, P: 1 }[cls]) || seq[idOf[ce]].pen === 'C' || seq[idOf[ce]].block === 'detail') throw Error('cabinEarly: ' + ce + ' is not a pen A or B stroke drawn at ' + cls);
    const p = { ...PN.PLAN[cls], C: [['cabin', 0, 0, ce]].concat(PN.PLAN[cls].C.filter((b) => b[0] !== 'cabin')) }, x = (o.planExtra || {})[cls];
    return x ? Object.fromEntries(Object.entries(p).map(([pen, bl]) => [pen, (x[pen] || []).concat(bl)])) : p;
  };
  // ---- solve each class (pens.cjs solveFit: o.ac 'keep', the default = the plan as it is; 'fit' = the what-if: the least
  // pull-in of the A-C plan that passes); on a failed limit only conventions may be cut (the class's cut
  // order, down to its floor). The detail lane count: o.detailLanes, else 2, and 3 only if a class fails with 2. Classes are
  // solved hardest first (the least passing scale in a free solve of each); every later class keeps the lane each detail
  // stroke got before, so a data line carries one lane for all classes.
  const AC = o.ac || 'keep';
  // solver round 2 (agent, 2026-11-22; the options are the main loop's levers, the defaults are the stock schedule):
  //  o.reorder 'none' (default) | 'form' | 'form+cabin': ORDER ONLY. Within pen A's form block (and with 'form+cabin' also
  //    pen C's cabin block, a what-if outside the brief) three sets in this order: the strokes that host cockpit or rear-bay
  //    detail units at the class, together with any stroke another lane's block waits for (the plan's 'after' links:
  //    side-plate, which pen C's side-219 and with it the cabin block wait for); then the strokes that host other detail
  //    units; then the strokes that host nothing. Within a set: 'form' keeps the stock relative order (a stable partition),
  //    'form-nn' takes the nearest start next, 'form-ll' the order with the least total hop lift (exact). The hosts are read
  //    from this class's units (the groups file) and its plan, never from a hand list. The block's pace stays the stock
  //    order's pace in the same window (o.pinPace, default true).
  //  o.planScale { T: s, P: s }: the A-C plan of that class pulled in by s (pens.cjs scalePlan, about DK.ANCHOR = 0 ms).
  //  o.cwlScope 'all' (default) | 'non-detail': the D car-with-lettering gate over every car stroke, or over pens A-C only
  //    (the detail lanes then answer to the detail deadline alone; an orchestrator decision when used, not the owner's).
  const regionsOf = (cls) => { const m = new Map(); for (const u of units[cls] || []) { if (!m.has(u.attach)) m.set(u.attach, new Set()); m.get(u.attach).add(u.region || 'other'); } return m; };
  const reorderFor = (cls) => {
    const mode = (o.reorder && typeof o.reorder === 'object' ? o.reorder[cls] : o.reorder) || 'none';   // one mode, or one per class
    if (mode === 'none' || !detIds) { if (o.formFirst && o.formFirst[cls]) throw Error('formFirst at ' + cls + ' needs a reorder mode'); return null; }
    const hosts = regionsOf(cls), waits = new Set(Object.values(planFor(cls)).flatMap((bl) => bl.filter((b) => b[3]).map((b) => b[3])));
    // solver round 3 (agent, 2026-11-22; OFF by default): o.formFirst { cls: [id, ...] } puts the listed strokes first, in
    // the listed order (each its own set, so no set order touches them), ahead of the three sets below; order only, pace pinned
    const ff = (o.formFirst && o.formFirst[cls]) || null;
    const rank0 = (i) => { const r = hosts.get(i); return waits.has(seq[i].id) || (r && (r.has('cockpit') || r.has('rear'))) ? 0 : r ? 1 : 2; };
    const rank = ff ? (i) => { const k = ff.indexOf(seq[i].id); return k >= 0 ? k - ff.length : rank0(i); } : rank0;
    // modes: 'form' (stable partition), 'form-nn' (the same partition, nearest start next within each set); a '+cabin'
    // suffix applies the same to pen C's cabin block (a what-if outside the brief's wording)
    const m = /^(form|form-nn|form-ll)(\+cabin)?$/.exec(mode);
    if (!m) throw Error('reorder: ' + mode);
    const order = { form: 'stable', 'form-nn': 'nn', 'form-ll': 'least-lift' }[m[1]];
    const ro = { form: { pen: 'A', rank, order } };
    if (m[2]) ro.cabin = { pen: 'C', rank, order };
    return ro;
  };
  const scaleOf = (cls) => (o.planScale && o.planScale[cls] != null ? +o.planScale[cls] : 1);
  // solver round 3: the cabin's stock pace at the class (the stock plan at the same plan scale and reorder), for o.cabinEarly
  // o.cabinPace { cls: pace } (OFF by default): that pace instead, e.g. the round-2 stock pace on the art before the r3 drops
  const paceFixOf = (cls, mk) => { if (!cabinEarlyOf(cls)) return undefined; if (o.cabinPace && o.cabinPace[cls] != null) return { cabin: +o.cabinPace[cls] }; const b = PN.solveClass(prep, cls, mk, { plan: PN.scalePlan(planStock(cls), scaleOf(cls)), reorder: reorderFor(cls), pinPace: o.pinPace }).blocks.cabin; return b ? { cabin: b.pace } : undefined; };
  const solveC = (cls, mk, forced, nl) => {
    const pf = paceFixOf(cls, mk);
    const r = PN.solveFit(core, prep, seq, cls, mk, { mode: AC, plan: PN.scalePlan(planFor(cls), scaleOf(cls)), sMin: o.sMin, sStep: o.sStep, reorder: reorderFor(cls), pinPace: o.pinPace, cwlScope: o.cwlScope, ...(pf ? { paceFix: pf } : {}), detail: detIds ? { units: units[cls], lanes: nl, forced } : null });
    const fit = { mode: AC, scale: r.scale, paceMax: r.paceMax == null ? null : +r.paceMax.toFixed(4), pace: r.sol.detail ? +r.sol.detail.pace.toFixed(4) : null, tried: r.tried, failed: !!r.failed, sMinTried: r.sMinTried || null, firstFail: r.firstFail || null };
    if (o.recordPace0 && detIds && AC === 'keep') {
      const s0 = PN.solveClass(prep, cls, mk, { plan: PN.scalePlan(planFor(cls), scaleOf(cls)), reorder: reorderFor(cls), pinPace: o.pinPace, cwlScope: o.cwlScope, ...(pf ? { paceFix: pf } : {}), detail: { units: units[cls], lanes: nl, forced, pace: 0 } }), c0 = PN.checkClass(core, prep, seq, s0, cls, mk);
      fit.pace0 = { ok: c0.ok, lastDetail: c0.detail ? c0.detail.lastDetail : null, detailSlack: c0.slack.detailDeadline, inkHold: c0.slack.inkHold, failing: [...new Set(c0.violations.map((v) => v.split(':')[0]))] };
    }
    return { sol: r.sol, chk: r.chk, fit };
  };
  let results = {}, cuts = { D: [], T: [], P: [] }, lanesN = 0, classOrder = CLS.map((c) => c[0]);
  const freeFit = {}, laneTry = !detIds ? [0] : o.detailLanes ? [o.detailLanes] : [2, 3], laneRuns = [];
  for (const nl of laneTry) {
    let order = CLS.slice();
    if (detIds && !o.classOrder) {
      freeFit[nl] = {};
      for (const [cls] of CLS) { const r = solveC(cls, masks, null, nl); freeFit[nl][cls] = { ok: r.chk.ok, scale: r.fit.scale }; }
      order = CLS.slice().sort((a, b) => (freeFit[nl][a[0]].ok ? freeFit[nl][a[0]].scale : 0) - (freeFit[nl][b[0]].ok ? freeFit[nl][b[0]].scale : 0));
    } else if (o.classOrder) order = o.classOrder.map((c) => CLS.find((x) => x[0] === c));
    results = {};
    cuts = { D: [], T: [], P: [] };
    const forced = new Map();
    for (const [cls, bit] of order) {
      const steps = PN.CUT_ORDER[cls].slice();
      for (;;) {
        const r = solveC(cls, masks, forced, nl), chk = r.chk;
        if (chk.ok || !steps.length || o.noCuts) { results[cls] = r; break; }
        const step = steps.shift();
        const hit = seq.map((s, i) => (!isCar(i) && s.cut === step && masks[i] & bit ? i : -1)).filter((i) => i >= 0);
        const left = seq.filter((s, i) => !isCar(i) && masks[i] & bit).length - hit.length;
        if (!hit.length || left < PN.CONV_FLOOR[cls]) continue;
        for (const i of hit) masks[i] &= ~bit;
        cuts[cls].push({ step, strokes: hit.map((i) => seq[i].id), because: chk.violations.slice(0, 4) });
        log(`class ${cls}: convention cut step ${step} (${hit.map((i) => seq[i].id).join(', ')}) because ${chk.violations.slice(0, 2).join(' ; ')}`);
      }
      // minimal cuts: give back each convention cut whenever the class still passes with it
      if (results[cls].chk.ok) {
        for (const c of cuts[cls].slice().reverse()) {
          const idx = c.strokes.map((id) => seq.findIndex((s) => s.id === id));
          for (const i of idx) masks[i] |= bit;
          const r = solveC(cls, masks, forced, nl);
          if (r.chk.ok) { c.restored = true; results[cls] = r; } else for (const i of idx) masks[i] &= ~bit;
        }
        cuts[cls] = cuts[cls].filter((c) => !c.restored);
      }
      const sl = results[cls].sol.lane;
      seq.forEach((s, i) => { if (isDetail(i) && sl[i] && !forced.has(i)) forced.set(i, PN.DETAIL_LANES.indexOf(sl[i])); });
    }
    lanesN = nl;
    classOrder = order.map((c) => c[0]);
    laneRuns.push({ lanes: nl, classOrder, ok: CLS.every(([c]) => results[c].chk.ok), scale: Object.fromEntries(CLS.map(([c]) => [c, results[c].fit.scale])) });
    if (CLS.every(([c]) => results[c].chk.ok)) break;
  }
  // every detail stroke keeps one lane across the classes that draw it (its home lane, carried by the phase digit)
  const homeOf = {};
  seq.forEach((s, i) => {
    if (!isDetail(i)) return;
    const ls = [...new Set(CLS.filter(([c, bit]) => masks[i] & bit && results[c].sol.lane[i]).map(([c]) => results[c].sol.lane[i]))];
    if (ls.length > 1) throw Error(`detail ${s.id}: lanes ${ls.join(',')} across classes`);
    homeOf[i] = ls[0] || null;
  });
  // ---- emit: one global line order (the D start order, then T-only and P-only strokes by start); absolute starts
  const firstStart = (i) => { for (const [c, k] of [['D', 0], ['T', 1], ['P', 2]]) if (results[c].sol.start[i] != null && masks[i] & { D: 4, T: 2, P: 1 }[c]) return [k, results[c].sol.start[i]]; return [9, 0]; };
  const order_ = seq.map((s, i) => i).filter((i) => masks[i]).sort((a, b) => { const ka = firstStart(a), kb = firstStart(b); return ka[0] - kb[0] || ka[1] - kb[1] || a - b; });
  // the phase digit carries the lane for the page (engine H.pen): 0 4 6 pen B (6 = car ink by B), 1 2 pen A, 3 pen C
  // dense3: 7 8 9 the detail lanes X Y Z (the stroke's home lane)
  const phaseOf = (s, i) => (s.block === 'detail' ? PN.DETAIL_DIGIT[homeOf[i]] : s.pen === 'C' ? 3 : s.pen === 'B' ? ('mr'.includes(s.tier) ? 4 : s.prov !== 'convention' ? 6 : 0) : s.block === 'silhouette' ? 1 : s.block === 'form' ? 2 : 3);
  const unplacedDetail = order_.filter((i) => isDetail(i) && !homeOf[i]).map((i) => seq[i].id);
  if (unplacedDetail.length && !o.allowFail) throw Error('detail strokes on no lane: ' + unplacedDetail.join(', '));
  const head = `HP1 2200 1238 ${N.car.join(' ')} ${N.seed}`;
  const lines = order_.map((i) => `${seq[i].tier}${isDetail(i) && !homeOf[i] ? 7 : phaseOf(seq[i], i)}${masks[i]}${flags[i]} ${enc[i].toks}`);
  const dataOrder = {};
  for (const [c, bit] of CLS) dataOrder[c] = order_.filter((i) => masks[i] & bit);
  const T = ['P', 'T', 'D'].map((c) => `T ${c} ` + dataOrder[c].map((i) => results[c].sol.start[i] + ' ' + results[c].sol.dur[i]).join(' '));
  const Vl = ['P', 'T', 'D'].map((c) => `V ${c} ` + PN.V[c].join(' '));
  const data = [head, ...lines, ...T, ...Vl].join('\n');
  const dataBlock = `<script type="text/plain" id="hero-pen-data">\n${data}\n</script>`;
  const engineMin = minifyAuto(ENGINE_SRC.replace('"use strict";', ''), ENGINE_PROPS).code;
  { const left = require('./minify.cjs').tokenize(engineMin).filter((t) => t.t === 'w' && Object.prototype.hasOwnProperty.call(ENGINE_PROPS, t.v)); if (left.length) throw Error('minified engine still names ' + left.map((t) => t.v).join(',')); }
  const block = `${dataBlock}\n    <script>${engineMin}</script>`;
  const hashes = {};
  for (const c of ['D', 'T', 'P']) {
    const pk = core.pick(data, c);
    hashes[c] = pk.hash;
    if (pk.L.length !== dataOrder[c].length || pk.T.length !== 2 * pk.L.length || pk.V.length !== 13) throw Error('pick ' + c);
  }
  // ---- the proof: every id of the class's car set is drawn at that class (a missing one fails the build)
  const drawnCar = Object.fromEntries(CLS.map(([c]) => [c, dataOrder[c].filter(isCar).map((i) => seq[i].id)]));
  const proof = Object.fromEntries(CLS.map(([c]) => {
    const set = carSet[c], drawn = drawnCar[c];
    return [c, { set: set.length, drawn: drawn.length, missing: set.filter((id) => !drawn.includes(id)), extra: drawn.filter((id) => !set.includes(id)) }];
  }));
  for (const [c] of CLS) if (proof[c].missing.length || proof[c].extra.length) throw Error(`class ${c}: car set ${proof[c].set} vs drawn ${proof[c].drawn}; missing ${proof[c].missing.join(',')} extra ${proof[c].extra.join(',')}`);
  const sizes = { dataBlock: { raw: Buffer.byteLength(dataBlock), br3: br3(dataBlock) }, engine: { raw: Buffer.byteLength(engineMin), br3: br3(engineMin) },
    engineSource: { raw: Buffer.byteLength(ENGINE_SRC), br3: br3(ENGINE_SRC) }, block: { raw: Buffer.byteLength(block), br3: br3(block) } };
  // agent pins: the engine near 7 KB br3 or less; the data block grows with the 40 glyph strokes v3 left out
  // dense3 final solver: the data pin is lifted deliberately (PINS, below the function); o.allowSize records an over-pin
  // build instead of throwing (build-final.cjs then fails on it after writing the records)
  // solver round 3 (agent, 2026-11-22; OFF by default): o.dataPin replaces PINS.dataBr3 for this build (build-final.cjs --data-pin)
  const dataPin = o.dataPin != null ? +o.dataPin : PINS.dataBr3;
  const budgets = { ...PINS, ...(o.dataPin != null ? { dataBr3: dataPin, dataPinFrom: 'o.dataPin' } : {}), engineOk: sizes.engine.br3 <= PINS.engineBr3, engineUnderCeiling: sizes.engine.br3 <= PINS.engineCeiling, dataOk: sizes.dataBlock.br3 <= dataPin };
  if ((!budgets.engineUnderCeiling || !budgets.dataOk) && !o.allowSize) throw Error(`size budget: engine ${sizes.engine.br3} B br3 (pin ${PINS.engineBr3}, ceiling ${PINS.engineCeiling}), data ${sizes.dataBlock.br3} (max ${dataPin})`);
  const failed = ['D', 'T', 'P'].filter((c) => !results[c].chk.ok);
  // ---- records
  const kindOf = (s) => (s.prov === 'convention' ? `convention:${s.tier}:${s.kind}` : `car:${s.kind}`);
  const counts = {};
  for (const [c] of CLS) {
    const by = {};
    for (const i of dataOrder[c]) { const k = kindOf(seq[i]); by[k] = (by[k] || 0) + 1; }
    const lanes = { A: 0, B: 0, C: 0 };
    for (const i of dataOrder[c]) { const l = results[c].sol.lane[i] || seq[i].pen; lanes[l] = (lanes[l] || 0) + 1; }
    counts[c] = { total: dataOrder[c].length, car: dataOrder[c].filter(isCar).length, convention: dataOrder[c].filter((i) => !isCar(i)).length,
      carLines: dataOrder[c].filter((i) => isCar(i) && !['side-219', 'top-219', 'lettering'].includes(seq[i].block)).length,
      glyphs: dataOrder[c].filter((i) => isCar(i) && ['side-219', 'top-219', 'lettering'].includes(seq[i].block)).length, lanes, byKind: by };
  }
  const index = order_.map((i) => {
    const s = seq[i], r = rawById[s.id], e = { id: s.id, tier: s.tier, pen: s.pen, block: s.block, kind: s.kind, prov: s.prov, mask: masks[i], flags: flags[i], lengthSrcPx: +geos[i].L.toFixed(1),
      fitErrSrcPx: +enc[i].err.toFixed(3), serves: s.serves || undefined, promoted: r && r.promoted ? r.promoted : undefined };
    for (const [c, bit] of CLS) if (masks[i] & bit) e[c] = [results[c].sol.start[i], results[c].sol.dur[i]];
    if (isDetail(i)) { e.pen = homeOf[i] || null; e.detail = true; }
    return e;
  });
  const out = {
    format: 'hero-pen-build/drafting-merge-1', set: o.set, text: o.text || 'all', seed: N.seed, car: N.car, builtFrom: IN, inputSha256: sha(fs.readFileSync(IN)), conventions: CONV, conventionsSha256: sha(fs.readFileSync(CONV)),
    engineSha256: sha(ENGINE_SRC), engineMinSha256: sha(engineMin), dataSha256: sha(data), hashes, sizes, budgets, counts, proof, carSet, drawnCar, failed,
    gates: { minLen: MIN_LEN, shortAdmitted, lifted, notRun: G.notRun, conventions: CG.records, rimLetters: RG.records, detailShort }, retier, cuts, ending: endRec, nearWheels: { moved: wheelRec.moved }, overlap: overlapRec,
    timeline: Object.fromEntries(['D', 'T', 'P'].map((c) => [c, { V: PN.V[c], limit: PN.LIMIT[c], plan: results[c].sol.plan, planScale: results[c].fit.scale * scaleOf(c), ...results[c].chk }])),
    schedule: { reorder: Object.fromEntries(CLS.map(([c]) => [c, (o.reorder && typeof o.reorder === 'object' ? o.reorder[c] : o.reorder) || 'none'])), pinPace: o.pinPace !== false, planScale: Object.fromEntries(CLS.map(([c]) => [c, scaleOf(c)])), cwlScope: o.cwlScope || 'all', ac: AC, ...(o.cabinEarly ? { cabinEarly: o.cabinEarly, cabinPace: Object.fromEntries(CLS.filter(([c]) => cabinEarlyOf(c)).map(([c]) => [c, results[c].sol.blocks.cabin ? results[c].sol.blocks.cabin.paceFixed : null])), cabinPaceFrom: o.cabinPace ? 'o.cabinPace' : 'the stock plan on this art' } : {}), ...(o.formFirst ? { formFirst: o.formFirst } : {}) },
    speeds: Object.fromEntries(CLS.map(([c]) => [c, PN.speeds(prep, results[c].sol, c, masks)])),
    // the T/P pen-speed cap against D's pen A at s = 1 in its stock order (pens.cjs speedCap); build-final.cjs gates it for a
    // class whose plan is pulled in (planScale < 1) and records it otherwise
    speedCap: (() => { const ref = PN.speeds(prep, PN.solveClass(prep, 'D', masks, { plan: planFor('D') }), 'D', masks); return Object.fromEntries(['T', 'P'].map((c) => [c, { planScale: scaleOf(c), ...PN.speedCap(ref, PN.speeds(prep, results[c].sol, c, masks), c) }])); })(),
    fit: { maxErrSrcPx: +Math.max(...enc.map((e) => e.err)).toFixed(3) }, index,
    // dense3 final solver
    detail: detIds ? { ids: [...detIds], minLenSrcPx: minLenDetail, shortDetail: [...detIds].map((id) => [id, +F.plen(rawById[id].pts).toFixed(1)]).filter((x) => x[1] < MIN_LEN - 0.5), ...detRec,
      units: Object.fromEntries(CLS.map(([c]) => [c, (units[c] || []).map((u) => ({ key: u.key, region: u.region, attach: seq[u.attach].id, attachBlock: seq[u.attach].block, attachPen: results[c].sol.lane[u.attach] || seq[u.attach].pen, attachEnd: results[c].sol.start[u.attach] == null ? null : results[c].sol.start[u.attach] + results[c].sol.dur[u.attach], members: u.members.map((i) => seq[i].id), at: u.members.map((i) => [results[c].sol.start[i], results[c].sol.dur[i]]) }))])),
      lanes: lanesN, classOrder, laneRuns, freeFit, unplaced: unplacedDetail } : null,
    acMode: AC, fitPerClass: Object.fromEntries(CLS.map(([c]) => [c, results[c].fit])),
  };
  if (o.write) {
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(path.join(OUT, 'data.txt'), data + '\n');
    fs.writeFileSync(path.join(OUT, 'engine.min.js'), engineMin + '\n');
    fs.writeFileSync(path.join(OUT, 'hero-pen-block.html'), block + '\n');
    fs.writeFileSync(path.join(OUT, 'build.json'), JSON.stringify(out, null, 1));
  }
  log(`set ${o.set}: D ${counts.D.total} (car ${counts.D.car}, conv ${counts.D.convention}) T ${counts.T.total} (${counts.T.car}, ${counts.T.convention}) P ${counts.P.total} (${counts.P.car}, ${counts.P.convention}); fit max ${out.fit.maxErrSrcPx}`);
  log(`sizes: data block ${sizes.dataBlock.raw} B (br3 ${sizes.dataBlock.br3}); engine ${sizes.engine.raw} B (br3 ${sizes.engine.br3}, pin ${PINS.engineBr3}${budgets.engineOk ? '' : ' OVER'})`);
  for (const c of ['D', 'T', 'P']) {
    const k = results[c].chk;
    log(`class ${c}: ${k.ok ? 'ok' : 'FAIL'} n ${k.n} first ${k.firstInk} lastA ${k.lastA} lastB ${k.lastB} lastC ${k.lastC} last ${k.lastInk} (limit ${PN.LIMIT[c]}) holds ${JSON.stringify(k.holds)} dens ${JSON.stringify(k.densAt)} ends ${JSON.stringify(k.ends)} peak ${JSON.stringify(k.peak)} done ${k.doneAt}`);
    log(`   blocks ${JSON.stringify(Object.fromEntries(Object.entries(k.blocks || {}).map(([n, b]) => [n, b.at.concat(b.over ? ['over ' + b.over] : [])])))}`);
    if (!k.ok) log('   violations', k.violations.slice(0, 8).join(' ; '));
  }
  if (failed.length && !o.allowFail) throw Object.assign(Error('timing limits fail in class ' + failed.join(', ')), { out });
  return { out, block, data, engineMin, geo: geos, seq, masks, results, prep, units, planFor };
}

// --page for the drafting hero: the base is index.html of 0e561624 (or later), which already holds the inline hero
// pen; only the data block and the inline engine after it are replaced. Everything outside is byte-identical.
const BLOCK_A = '<script type="text/plain" id="hero-pen-data">';
function blockSpan(html) {
  const a = html.indexOf(BLOCK_A);
  const e0 = html.indexOf('<script>', html.indexOf('</script>', a));
  const b = html.indexOf('</script>', e0) + '</script>'.length;
  if (a < 0 || e0 < 0 || b < e0) throw Error('page: hero pen block not found');
  if (html.split(BLOCK_A).length !== 2) throw Error('page: more than one data block');
  if (!/^<script>\(\(\)=>\{/.test(html.slice(e0, e0 + 16))) throw Error('page: the inline engine does not follow the data block');
  return [a, b];
}
function pageDrafting(dir, block, base) {
  const html0 = baseHtml(base).replace(/\r\n/g, '\n');
  const [a, b] = blockSpan(html0);
  const html = html0.slice(0, a) + block + html0.slice(b);
  if (dir) { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, 'index.html'), html); }
  return html;
}
function checkDrafting(html, block, base) {
  const html0 = baseHtml(base).replace(/\r\n/g, '\n');
  const [a0, b0] = blockSpan(html0), [a1, b1] = blockSpan(html);
  const f = {
    blockIdentical: html.slice(a1, b1) === block,
    outsideIdentical: html.slice(0, a1) === html0.slice(0, a0) && html.slice(b1) === html0.slice(b0),
    canvases: html.includes(CANVASES), oneGuard: html.split('\n').filter(isGuard).length === 1, kwScroll: html.includes('<script id="kw-scroll">'),
    noHeroScript: !/<script[^>]+src="hero-drawing-20261027\.js/.test(html),
  };
  f.ok = Object.values(f).every(Boolean);
  return f;
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
  const flag = (k) => argv.includes('--' + k);
  if (flag('r3')) {
    // the R3 one-pen build (0e561624), kept for comparison
    let r;
    try {
      r = build({ in: opt('in', DEFAULTS.in), out: opt('out', DEFAULTS.out), gate: opt('gate', 'fail'), order: opt('order', null), quiet: flag('quiet'), noCuts: flag('no-cuts'),
        ending: !flag('no-ending'), nearWheels: !flag('no-near-wheels'), accents: flag('accents') });
    } catch (e) { console.error(String(e.message || e)); process.exit(2); }
    if (opt('page')) page(path.resolve(opt('page')), r.block, opt('base'), opt('site'));
    process.exit(0);
  }
  // the drafting hero (default): --set final (the only shipped set), --text all|side-219, --in, --conv, --out, --page <dir>
  // --base <a committed index.html; default git show HEAD:index.html>,
  // --check <html> (with --base), --allow-fail (write the records even if a limit fails), --no-cuts, --quiet
  let r;
  try {
    r = buildDrafting({ set: opt('set', DEFAULT_SET), text: opt('text', 'all'), in: opt('in'), conv: opt('conv'), out: opt('out'), quiet: flag('quiet'), noCuts: flag('no-cuts'), allowFail: flag('allow-fail') });
  } catch (e) { console.error(String(e.message || e)); process.exit(2); }
  if (opt('page')) {
    let html;
    try { html = pageDrafting(path.resolve(opt('page')), r.block, opt('base')); } catch (e) { console.error(String(e.message || e)); process.exit(2); }
    const base = Buffer.from(baseHtml(opt('base')).replace(/\r\n/g, '\n'));
    log(`page ${path.resolve(opt('page'), 'index.html')} from ${opt('base') || 'HEAD'}: ${Buffer.byteLength(html)} B, br3 ${br3(html)} (base ${base.length} B, br3 ${br3(base)}; ${br3(html) - br3(base) >= 0 ? '+' : ''}${br3(html) - br3(base)} B br3)`);
  }
  if (opt('check')) {
    const html = fs.readFileSync(path.resolve(opt('check')), 'utf8').replace(/\r\n/g, '\n');
    const inv = checkDrafting(html, r.block, opt('base'));
    if (!inv.ok) { console.error('check: fails', JSON.stringify(inv)); process.exit(1); }
    log('check: block identical to a fresh build; everything outside it identical to the base;', JSON.stringify(inv));
  }
  if (r.out.failed.length) process.exit(3);
}
module.exports = { buildDrafting, pageDrafting, checkDrafting, conventionGates, blockSpan, CONV_TIERS, GATE_LIFTS, MIN_LEN, PINS, SETS, build, ending, overlapJoins, normalize, order, encodeGeometry, loadCore, page, pageInvariants, guardRules, baseHtml, nearWheels, p2Hops, NEXT_TO_WHEEL, gates, joinFlags, ENGINE_SRC, ENGINE_PROPS, core, DEFAULTS };
