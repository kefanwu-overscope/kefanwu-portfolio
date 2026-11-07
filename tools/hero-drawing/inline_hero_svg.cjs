// Build the homepage hero line drawing ("Drawn, then built") from the traced master.
//
//   node tools/hero-drawing/inline_hero_svg.cjs            write the three outputs below
//   node tools/hero-drawing/inline_hero_svg.cjs --check    exit 1 if any output is out of date or a
//                                                         wheel-centre mark is off its rim centre
//   node tools/hero-drawing/inline_hero_svg.cjs --print    print the inline markup only
//
// Line endings never count (a git checkout may hold LF or CRLF, core.autocrlf): sources and outputs
// are compared with CRLF folded to LF, and the master's recorded hash may be of either form.
//
// Source: tools/hero-drawing/traced-lines.svg and its record traced-lines.json (trace_lines.py).
// One run writes, from the same derived markup:
//   1. index.html, .hero-draw-lines: the inline drawing read by hero-drawing-20261027.js;
//   2. assets/hero-drawing-20261027/hero-lines.svg: the same <svg> as a standalone file (only
//      width="2200" height="1238" added to its root), so the public file is what ships inline;
//   3. assets/hero-drawing-20261027/provenance.json: sha256, size and group counts of that file,
//      the sha256 of the inline markup, the trace record and every derivation step below.
//
// Derivation (never edited by hand):
//   - the two grass/track-edge strokes (data-o 0.952 and 0.976) are left out: over the white
//     page they read as a horizon line, not as an edge of the car;
//   - a "guide" group is added first (painted under the car lines): two CAD-style centre marks,
//     one on the centre of each traced rim ellipse (data-o 0.272 front, 0.344 rear). They are
//     construction marks derived from the tracing itself and add no hardware. --check recomputes
//     each rim ellipse's centre from its arc data and fails if a mark is more than 0.5 source px
//     off it;
//   - the ground (tyre-contact) strokes are weighted data-w .5 (traced at .4);
//   - the TSAL lamp outline (data-o 0.410) carries data-min-vw="768": it is not drawn on windows
//     narrower than 768 px, where it is only a few pixels tall (white-home-20261011.css);
//   - stroke geometry is precomputed so the page never measures SVG geometry at runtime: each
//     path gets data-len (total length, source px, 0.1 px) and data-pts (21 points at 0, 5, ...
//     100 % of its length, source px rounded to 1 px), and the root gets data-car (the tight
//     bounding box x0 y0 x1 y1 of the silhouette and structure strokes, 0.1 px). The values match
//     Chrome's getTotalLength / getPointAtLength / getBBox (checked by tools/hero-tests);
//   - each group's id becomes data-group (no ids in the page), width/height are dropped and the
//     root gets preserveAspectRatio="none" focusable="false" aria-hidden="true" (the script
//     sets a viewBox that reproduces the photo's object-fit: cover at its object-position).
// Every path keeps pathLength="1", data-o, data-w and vector-effect="non-scaling-stroke"; traced
// path data is copied byte for byte.
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const SITE = path.resolve(__dirname, "../..");
const TRACED = path.join(__dirname, "traced-lines.svg");
const RECORD = path.join(__dirname, "traced-lines.json");
const PUBLIC_DIR = path.join(SITE, "assets/hero-drawing-20261027");
const PUBLIC = path.join(PUBLIC_DIR, "hero-lines.svg");
const PROVENANCE = path.join(PUBLIC_DIR, "provenance.json");
const INDEX = path.join(SITE, "index.html");
const DROP = new Set(["0.952", "0.976"]);
const GROUND_W = ".5";
const MIN_VW = { "0.410": 768 };
const SAMPLES = 20;   // 21 points: 0, 1/20 ... 20/20 of the length
const OPEN = '<div class="hero-draw-lines" aria-hidden="true" hidden>';
const BLOCK = /<div class="hero-draw-lines" aria-hidden="true" hidden>[\s\S]*?<\/svg><\/div>/;
const sha = (buf) => crypto.createHash("sha256").update(buf).digest("hex");
const lf = (text) => text.replace(/\r\n/g, "\n");
const round1 = (v) => String(+v.toFixed(1));

// Wheel-centre marks (source px): a 36 px cross on the centre of each traced rim ellipse.
const ARM = 18;
const MARKS = [
  { id: "front-wheel-centre", rim: "0.272", centre: [1448.8, 847.2], o: "0.000" },
  { id: "rear-wheel-centre", rim: "0.344", centre: [1731.1, 744.7], o: "0.030" },
];
const crossD = ([x, y]) => `M${round1(x - ARM)} ${round1(y)}H${round1(x + ARM)}M${round1(x)} ${round1(y - ARM)}V${round1(y + ARM)}`;

// ---- SVG path geometry (M L H V C A Z, absolute and relative) ----
// Centre parameterisation of an SVG elliptical arc (SVG 2, appendix B.2.4).
function arcParams(x1, y1, rx, ry, phiDeg, large, sweep, x2, y2) {
  const phi = (phiDeg * Math.PI) / 180, c = Math.cos(phi), s = Math.sin(phi);
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
  const xp = c * dx + s * dy, yp = -s * dx + c * dy;
  rx = Math.abs(rx); ry = Math.abs(ry);
  const lambda = (xp * xp) / (rx * rx) + (yp * yp) / (ry * ry);
  if (lambda > 1) { rx *= Math.sqrt(lambda); ry *= Math.sqrt(lambda); }
  const num = rx * rx * ry * ry - rx * rx * yp * yp - ry * ry * xp * xp;
  const den = rx * rx * yp * yp + ry * ry * xp * xp;
  let k = Math.sqrt(Math.max(0, num / den));
  if (Boolean(large) === Boolean(sweep)) k = -k;
  const cxp = (k * rx * yp) / ry, cyp = (-k * ry * xp) / rx;
  const cx = c * cxp - s * cyp + (x1 + x2) / 2, cy = s * cxp + c * cyp + (y1 + y2) / 2;
  const ang = (ux, uy, vx, vy) => {
    const a = Math.acos(Math.max(-1, Math.min(1, (ux * vx + uy * vy) / (Math.hypot(ux, uy) * Math.hypot(vx, vy)))));
    return ux * vy - uy * vx < 0 ? -a : a;
  };
  const t1 = ang(1, 0, (xp - cxp) / rx, (yp - cyp) / ry);
  let dt = ang((xp - cxp) / rx, (yp - cyp) / ry, (-xp - cxp) / rx, (-yp - cyp) / ry);
  if (!sweep && dt > 0) dt -= 2 * Math.PI;
  if (sweep && dt < 0) dt += 2 * Math.PI;
  return { cx, cy, rx, ry, c, s, t1, dt };
}
// Flatten a path into polylines (one per subpath) with fine steps; returns [[x, y], ...] lists.
function flatten(d, steps = 256) {
  const toks = d.match(/[MmLlHhVvCcAaZz]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g);
  const subs = [];
  let i = 0, cmd = "", x = 0, y = 0, sx = 0, sy = 0, cur = null;
  const num = () => Number(toks[i++]);
  const lineTo = (nx, ny) => { cur.push([nx, ny]); x = nx; y = ny; };
  while (i < toks.length) {
    if (/[A-Za-z]/.test(toks[i])) cmd = toks[i++];
    const rel = cmd === cmd.toLowerCase();
    switch (cmd.toUpperCase()) {
      case "M": {
        const nx = num() + (rel ? x : 0), ny = num() + (rel ? y : 0);
        cur = [[nx, ny]]; subs.push(cur); x = sx = nx; y = sy = ny;
        cmd = rel ? "l" : "L";
        break;
      }
      case "L": lineTo(num() + (rel ? x : 0), num() + (rel ? y : 0)); break;
      case "H": lineTo(num() + (rel ? x : 0), y); break;
      case "V": lineTo(x, num() + (rel ? y : 0)); break;
      case "C": {
        const v = [num(), num(), num(), num(), num(), num()];
        if (rel) for (let k = 0; k < 6; k += 1) v[k] += k % 2 ? y : x;
        const [x0, y0] = [x, y];
        for (let k = 1; k <= steps; k += 1) {
          const t = k / steps, m = 1 - t;
          cur.push([m * m * m * x0 + 3 * m * m * t * v[0] + 3 * m * t * t * v[2] + t * t * t * v[4],
            m * m * m * y0 + 3 * m * m * t * v[1] + 3 * m * t * t * v[3] + t * t * t * v[5]]);
        }
        x = v[4]; y = v[5];
        break;
      }
      case "A": {
        const rx = num(), ry = num(), phi = num(), large = num(), sweep = num();
        const nx = num() + (rel ? x : 0), ny = num() + (rel ? y : 0);
        const p = arcParams(x, y, rx, ry, phi, large, sweep, nx, ny);
        for (let k = 1; k <= steps; k += 1) {
          const t = p.t1 + (p.dt * k) / steps, ex = p.rx * Math.cos(t), ey = p.ry * Math.sin(t);
          cur.push([p.cx + p.c * ex - p.s * ey, p.cy + p.s * ex + p.c * ey]);
        }
        x = nx; y = ny;
        break;
      }
      case "Z": lineTo(sx, sy); cmd = ""; break;
      default: throw new Error(`unsupported path command ${cmd} in ${d.slice(0, 40)}`);
    }
  }
  return subs;
}
// Total length and the points at i/SAMPLES of it (like getTotalLength / getPointAtLength).
function measure(d) {
  const subs = flatten(d);
  const segs = [];
  for (const sub of subs) for (let k = 1; k < sub.length; k += 1) segs.push([sub[k - 1], sub[k], Math.hypot(sub[k][0] - sub[k - 1][0], sub[k][1] - sub[k - 1][1])]);
  const L = segs.reduce((a, s) => a + s[2], 0);
  const pts = [];
  let k = 0, acc = 0;
  for (let i = 0; i <= SAMPLES; i += 1) {
    const want = (L * i) / SAMPLES;
    while (k < segs.length - 1 && acc + segs[k][2] < want) { acc += segs[k][2]; k += 1; }
    const [a, b, len] = segs[k];
    const f = len ? Math.max(0, Math.min(1, (want - acc) / len)) : 0;
    pts.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
  }
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const sub of subs) for (const [px, py] of sub) { x0 = Math.min(x0, px); y0 = Math.min(y0, py); x1 = Math.max(x1, px); y1 = Math.max(y1, py); }
  return { L, pts, box: [x0, y0, x1, y1] };
}
// The centre of a traced rim ellipse (M + A segments): the mean of its arcs' centres.
function rimCentre(d) {
  const toks = d.match(/[MA]|-?(?:\d+\.?\d*|\.\d+)/g);
  let i = 1, x = Number(toks[i++]), y = Number(toks[i++]);
  const centres = [];
  while (i < toks.length) {
    if (toks[i] !== "A") throw new Error(`rim path is not M + A segments: ${d.slice(0, 40)}`);
    const [rx, ry, phi, large, sweep, x2, y2] = toks.slice(i + 1, i + 8).map(Number);
    const p = arcParams(x, y, rx, ry, phi, large, sweep, x2, y2);
    centres.push([p.cx, p.cy]);
    x = x2; y = y2; i += 8;
  }
  return [centres.reduce((a, q) => a + q[0], 0) / centres.length, centres.reduce((a, q) => a + q[1], 0) / centres.length];
}

function build() {
  const master = lf(fs.readFileSync(TRACED, "utf8"));
  const raw = master.trim();
  const record = JSON.parse(fs.readFileSync(RECORD, "utf8"));
  // trace_lines.py records the hash of the bytes it wrote, so with its platform's line endings.
  if (![master, master.replace(/\n/g, "\r\n")].some((form) => sha(form) === record.svg.sha256)) throw new Error("traced-lines.svg does not match traced-lines.json (run trace_lines.py)");
  const kept = [], dropped = [], rims = {}, shipped = [];
  let group = "";
  const carBox = [Infinity, Infinity, -Infinity, -Infinity];
  const geometry = (d, isCar) => {
    const m = measure(d);
    if (isCar) {
      carBox[0] = Math.min(carBox[0], m.box[0]); carBox[1] = Math.min(carBox[1], m.box[1]);
      carBox[2] = Math.max(carBox[2], m.box[2]); carBox[3] = Math.max(carBox[3], m.box[3]);
    }
    return ` data-len="${round1(m.L)}" data-pts="${m.pts.map(([px, py]) => `${Math.round(px)} ${Math.round(py)}`).join(" ")}"`;
  };
  const lines = [];
  for (const line of raw.split("\n")) {
    const g = /^<g id="(\w+)" data-w="([^"]*)">$/.exec(line);
    if (g) {
      group = g[1];
      lines.push(`<g data-group="${group}" data-w="${group === "ground" ? GROUND_W : g[2]}">`);
      continue;
    }
    if (!line.startsWith("<path")) { lines.push(line); continue; }
    const o = /data-o="([\d.]+)"/.exec(line);
    if (!o) throw new Error(`path without data-o: ${line.slice(0, 60)}`);
    if (DROP.has(o[1])) { dropped.push(o[1]); continue; }
    for (const need of ['pathLength="1"', 'vector-effect="non-scaling-stroke"', "data-w="]) {
      if (!line.includes(need)) throw new Error(`path data-o=${o[1]} lacks ${need}`);
    }
    const d = /\sd="([^"]+)"/.exec(line)[1];
    if (MARKS.some((mk) => mk.rim === o[1])) rims[o[1]] = d;
    let tag = line;
    if (group === "ground") tag = tag.replace(/data-w="[^"]*"/, `data-w="${GROUND_W}"`);
    const extra = (MIN_VW[o[1]] ? ` data-min-vw="${MIN_VW[o[1]]}"` : "") + geometry(d, group === "silhouette" || group === "structure");
    tag = tag.replace(/\s*\/>$/, `${extra}/>`);
    kept.push(o[1]);
    shipped.push({ group, o: o[1], w: /data-w="([^"]*)"/.exec(tag)[1] });
    lines.push(tag);
  }
  if (dropped.length !== DROP.size) throw new Error(`expected to drop ${[...DROP]}, dropped ${dropped}`);
  // Wheel-centre marks: on the rim-ellipse centres (checked here, within 0.5 source px).
  const marks = MARKS.map((mk) => {
    if (!rims[mk.rim]) throw new Error(`rim stroke data-o=${mk.rim} not found`);
    const c = rimCentre(rims[mk.rim]);
    const off = Math.hypot(c[0] - mk.centre[0], c[1] - mk.centre[1]);
    if (off > 0.5) throw new Error(`${mk.id} is ${off.toFixed(2)} source px off the rim centre (${c.map((v) => v.toFixed(2))})`);
    return { ...mk, d: crossD(mk.centre), rimCentre: c.map((v) => +v.toFixed(2)), offPx: +off.toFixed(3) };
  });
  const guide = `<g data-group="guide" data-w=".4">\n${marks.map((mk) => `<path d="${mk.d}" pathLength="1" data-o="${mk.o}" data-w=".4" vector-effect="non-scaling-stroke"${geometry(mk.d, false)}/>`).join("\n")}\n</g>`;
  let svg = lines.join("\n");
  if (/\sid="/.test(svg)) throw new Error("an id survived");
  const car = carBox.map(round1).join(" ");
  svg = svg.replace(/<svg\b([^>]*)>\n?/, (m, attrs) => {
    const a = attrs.replace(/\s(width|height)="[^"]*"/g, "");
    if (!/viewBox="0 0 2200 1238"/.test(a)) throw new Error("unexpected viewBox");
    return `<svg${a.replace(/\sviewBox="[^"]*"/, ' viewBox="0 0 2200 1238" preserveAspectRatio="none" focusable="false" aria-hidden="true"')} data-car="${car}">\n${guide}\n`;
  });
  const standalone = `${svg.replace(' viewBox="0 0 2200 1238"', ' viewBox="0 0 2200 1238" width="2200" height="1238"')}\n`;
  const groups = {};
  for (const s of [{ group: "guide" }, { group: "guide" }, ...shipped]) groups[s.group] = (groups[s.group] || 0) + 1;
  return { markup: `${OPEN}${svg}</div>`, standalone, record, kept, dropped, marks, groups, car };
}

function provenance({ markup, standalone, record, kept, dropped, marks, groups, car }) {
  const byO = new Map(record.strokes.map((s) => [s["data-o"].toFixed(3), s]));
  const strokes = [
    ...marks.map((mk) => ({ id: mk.id, group: "guide", "data-o": Number(mk.o), "data-w": 0.4,
      derived_from: `centre of the traced rim ellipse data-o ${mk.rim} (${byO.get(mk.rim) ? byO.get(mk.rim).id : "?"})`,
      rim_centre_src_px: mk.rimCentre, mark_offset_src_px: mk.offPx })),
    ...kept.map((o) => {
      const s = { ...byO.get(o) };
      if (s.group === "ground") { s["data-w"] = Number(GROUND_W); s.traced_data_w = 0.4; }
      if (MIN_VW[o]) s.min_viewport_px = MIN_VW[o];
      return s;
    }),
  ];
  return {
    asset: "assets/hero-drawing-20261027/hero-lines.svg",
    date: "2026-10-27",
    updated: "2026-10-29",
    kind: "Stroke-only line drawing (pen-sketch tracing) for the homepage hero opening animation. This file is the drawing the homepage inlines (index.html .hero-draw-lines), byte for byte except width=\"2200\" height=\"1238\" on its root.",
    source: record.source,
    svg: {
      sha256: sha(Buffer.from(standalone)), bytes: Buffer.byteLength(standalone), paths: kept.length + marks.length, groups,
      coordinates: "viewBox 0 0 2200 1238 = source photo pixels (no transform); path data rounded to 0.1 px",
      car_box_src_px: car.split(" ").map(Number),
    },
    statement: [
      ...record.statement,
      "Two CAD-style wheel-centre marks (the guide group) are construction marks derived from the tracing itself, not edges of the photo; they add no hardware.",
    ],
    method: record.method,
    parameters: record.parameters,
    strokes,
    trace: {
      master: "tools/hero-drawing/traced-lines.svg (record: traced-lines.json)",
      master_sha256: record.svg.sha256,
      master_paths: record.svg.paths,
      runs: record.runs,
      added_2026_10_29: "plate-219, fw-far-crown and tsal-lamp: three more real, high-contrast edges read off zoomed crops of the 2200 px photo, snapped with trace_lines.py --only (the other 27 traced strokes keep their 2026-10-27 bytes). Not added: the lower body contour (black on black shadow) and the front wishbones (2-3 px glints), which are not reliably visible.",
    },
    derivation: {
      generator: "tools/hero-drawing/inline_hero_svg.cjs (one run writes index.html's inline drawing, this file and this record)",
      dropped: dropped.map((o) => ({ "data-o": Number(o), id: byO.get(o) ? byO.get(o).id : null })),
      why_dropped: "The grass/track-edge strokes read as a horizon line over the white page, not as an edge of the car.",
      why_guides: "Two CAD-style centre marks (36 source px crosses) make the opening read as an engineering drawing. Each sits on the centre of a traced rim ellipse (recomputed from the ellipse's arc data on every --check; tolerance 0.5 source px), drawn in the light guide colour.",
      ground_weight: "The ground (tyre-contact) strokes are weighted data-w .5 on the homepage (traced at .4).",
      min_viewport: "The TSAL lamp outline carries data-min-vw=\"768\": it is not drawn on windows narrower than 768 px.",
      geometry: "data-len = total length (source px, 0.1 px); data-pts = 21 points at 0, 5, ... 100 % of the length (source px, rounded to 1 px); root data-car = tight bounding box x0 y0 x1 y1 of the silhouette and structure strokes (0.1 px). Precomputed so the page never measures SVG geometry; they match Chrome's getTotalLength / getPointAtLength / getBBox (tools/hero-tests).",
      changes: "group id -> data-group; width/height removed and preserveAspectRatio=\"none\" focusable=\"false\" aria-hidden=\"true\" added on the inline root (the script computes a viewBox reproducing the photo's object-fit: cover at its live object-position). Traced path data unchanged.",
    },
    homepage_inline: {
      page: "index.html (.hero-draw-lines, read by hero-drawing-20261027.js)",
      inline_sha256: sha(Buffer.from(markup)),
      paths: kept.length + marks.length,
    },
  };
}

const built = build();
const mode = process.argv[2] || "";
if (mode === "--print") { process.stdout.write(`${built.markup}\n`); process.exit(0); }

const html = fs.readFileSync(INDEX, "utf8");
if (!BLOCK.test(html)) { console.error("index.html has no .hero-draw-lines block to replace"); process.exit(2); }
const nextHtml = html.replace(BLOCK, () => built.markup);
const prov = `${JSON.stringify(provenance(built), null, 1)}\n`;
const total = built.kept.length + built.marks.length;
const markNote = built.marks.map((mk) => `${mk.id} ${mk.offPx} px off the rim centre`).join(", ");
const outputs = [[INDEX, nextHtml, html], [PUBLIC, built.standalone], [PROVENANCE, prov]];
const onDisk = (file, cur) => (cur !== undefined ? cur : (fs.existsSync(file) ? fs.readFileSync(file, "utf8") : ""));
if (mode === "--check") {
  const stale = outputs.filter(([file, next, cur]) => lf(onDisk(file, cur)) !== lf(next));
  if (stale.length) { console.error(`out of date: ${stale.map(([f]) => path.relative(SITE, f)).join(", ")} (run inline_hero_svg.cjs)`); process.exit(1); }
  console.log(`index.html, hero-lines.svg and provenance.json are current (${built.kept.length} traced paths + ${built.marks.length} wheel-centre marks = ${total}; groups ${JSON.stringify(built.groups)}; ${markNote})`);
  process.exit(0);
}
for (const [file, next, cur] of outputs) {
  const changed = lf(onDisk(file, cur)) !== lf(next);
  if (changed) fs.writeFileSync(file, next);
  console.log(`${changed ? "updated" : "unchanged"} ${path.relative(SITE, file)}`);
}
console.log(`${total} paths (${built.kept.length} traced + ${built.marks.length} marks), groups ${JSON.stringify(built.groups)}, car box ${built.car}, dropped ${built.dropped.join(", ")}; ${markNote}`);
