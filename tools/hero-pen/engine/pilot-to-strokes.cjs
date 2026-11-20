#!/usr/bin/env node
// Converts the R2 pilot's data/pen-data.json (rough strokes, never shipped) into the strokes.json shape the build
// reads (tools/hero-pen/README.md), so the engine and its tests can run before the traced art exists.
// usage: node pilot-to-strokes.cjs <pen-data.json> <out strokes.json>
'use strict';
const fs = require('fs');
const { normalize } = require('./build.cjs');
const [src, dst] = process.argv.slice(2);
if (!src || !dst) { console.error('usage: node pilot-to-strokes.cjs <pen-data.json> <out strokes.json>'); process.exit(2); }
const N = normalize(JSON.parse(fs.readFileSync(src, 'utf8')), src);
const cls = (m) => (m & 4 ? 'D' : '') + (m & 2 ? 'T' : '') + (m & 1 ? 'P' : '');
const out = {
  format: 'hero-pen-strokes/1',
  source: 'converted from the R2 pilot pen-data.json (rough strokes: Catmull-Rom guides, edge chains; never shipped)',
  car: N.car,
  seed: N.seed,
  strokes: N.strokes.map((s) => {
    const o = { id: s.id, phase: s.phase, area: s.area, tier: s.tier, kind: s.kind, classes: cls(s.classes), prov: s.prov, pinned: s.pinned };
    if (s.group) o.group = s.group;
    if (s.cut) o.cut = s.cut;
    if (s.corners && s.corners.length) o.corners = s.corners;
    if (s.join) o.join = s.join;
    o.pts = s.pts.map((p) => [+p[0].toFixed(2), +p[1].toFixed(2)]);
    return o;
  }),
};
fs.writeFileSync(dst, JSON.stringify(out));
console.log(`${out.strokes.length} strokes -> ${dst}`);
