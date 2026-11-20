// A synthetic, deterministic stroke set in the strokes.json shape (tools/hero-pen/README.md) for the unit tests:
// every phase, tier and kind, closed loops, corners, a glyph word and a hatch patch. Not a drawing of anything.
'use strict';
const circle = (cx, cy, rx, ry, a0, laps, n = 200) => Array.from({ length: n + 1 }, (_, i) => { const t = a0 - (i / n) * laps * 2 * Math.PI; return [cx + rx * Math.cos(t), cy + ry * Math.sin(t)]; });
const line = (x0, y0, x1, y1, n = 20) => Array.from({ length: n + 1 }, (_, i) => [x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n]);
const poly = (...p) => p.flatMap((q, i) => (i ? line(p[i - 1][0], p[i - 1][1], q[0], q[1]).slice(1) : [q]));
const wave = (x0, y0, len, amp, n = 60) => Array.from({ length: n + 1 }, (_, i) => [x0 + (len * i) / n, y0 + amp * Math.sin((i / n) * Math.PI * 2)]);

function fixture() {
  const S = [];
  const add = (o) => S.push({ prov: 'traced', classes: 'DTP', pinned: false, ...o });
  // P0 lay-in
  add({ id: 'ghost-a', phase: 0, area: 'lay-in', tier: 'g', kind: 'guide', prov: 'convention', pinned: true, pts: circle(1420, 840, 60, 70, 3.7, 1.4) });
  add({ id: 'ghost-b', phase: 0, area: 'lay-in', tier: 'g', kind: 'guide', prov: 'convention', pinned: true, pts: circle(1700, 735, 58, 62, 3.7, 1.3) });
  add({ id: 'gesture', phase: 0, area: 'lay-in', tier: 'g', kind: 'guide', prov: 'convention', pinned: true, pts: line(960, 800, 1330, 660) });
  // P1 silhouette, 8 gestures
  add({ id: 'nose', phase: 1, area: 'g1', tier: 'c', kind: 'contour', pinned: true, pts: poly([1350, 665], [1290, 640], [940, 800], [935, 830], [1350, 700]) });
  add({ id: 'rail', phase: 1, area: 'g2', tier: 'c', kind: 'contour', pinned: true, pts: poly([1367, 758], [1366, 700], [1526, 664]) });
  add({ id: 'helmet', phase: 1, area: 'g3', tier: 'c', kind: 'contour', pinned: true, pts: circle(1425, 570, 32, 38, 2, 1.05) });
  add({ id: 'hoop', phase: 1, area: 'g4', tier: 'c', kind: 'contour', pinned: true, pts: poly([1480, 650], [1470, 470], [1500, 440], [1540, 470], [1545, 650]) });
  add({ id: 'brace', phase: 1, area: 'g5', tier: 'c', kind: 'contour', pinned: true, pts: line(1540, 470, 1610, 640) });
  add({ id: 'rear-tyre', phase: 1, area: 'g6', tier: 'y', kind: 'contour', pinned: true, pts: circle(1700, 735, 62, 66, 3.2, 1) });
  add({ id: 'front-tyre', phase: 1, area: 'g7', tier: 'y', kind: 'contour', pinned: true, pts: circle(1425, 838, 78, 92, 3.2, 0.92) });
  add({ id: 'crown', phase: 1, area: 'g8', tier: 'c', kind: 'contour', pinned: true, pts: wave(1250, 720, 70, 4) });
  // P2 form, three areas
  for (let i = 0; i < 8; i++) add({ id: `form-nose-${i}`, phase: 2, area: 'nose-top', tier: 'f', kind: 'form', pts: wave(980 + i * 40, 760 - i * 12, 60 + 10 * (i % 3), 3) });
  for (let i = 0; i < 6; i++) add({ id: `form-plate-${i}`, phase: 2, area: 'side-plate', tier: 'f', kind: 'form', classes: i % 2 ? 'DT' : 'DTP', pts: poly([1410 + i * 6, 705], [1495, 685 + i * 4], [1500, 750], [1415 + i * 6, 760]) });
  for (let i = 0; i < 6; i++) add({ id: `form-wheel-${i}`, phase: 2, area: 'front-wheel', tier: 'f', kind: 'form', classes: i < 4 ? 'DTP' : 'D', pts: circle(1425, 838, 55 - i * 4, 66 - i * 4, 2.5, 0.45) });
  // P3 detail, a glyph word and a long nose area
  // numerals (tier n) and two lettering words in the art's id scheme <word>-<NN>-<char>[-2|-dot]
  for (let i = 0; i < 3; i++) add({ id: `plate-219-0${i + 1}-${'219'[i]}`, phase: 3, area: 'side-plate', tier: 'n', kind: 'glyph', pinned: true, pts: poly([1420 + i * 22, 735], [1428 + i * 22, 712], [1436 + i * 22, 735]) });
  for (let i = 0; i < 4; i++) add({ id: `olin-0${i + 1}-${'olin'[i]}`, phase: 3, area: 'lettering', tier: 'd', kind: 'glyph', classes: 'D', pinned: true, pts: poly([1300 + i * 14, 700], [1306 + i * 14, 680], [1312 + i * 14, 700]) });
  add({ id: 'olin-04-n-2', phase: 3, area: 'lettering', tier: 'd', kind: 'glyph', classes: 'D', pinned: true, pts: line(1348, 690, 1354, 700, 4) });
  add({ id: 'olin-03-i-dot', phase: 3, area: 'lettering', tier: 'd', kind: 'glyph', classes: 'D', pinned: true, pts: line(1334, 675, 1334.6, 676, 2) });
  for (let i = 0; i < 3; i++) add({ id: `of-0${i + 1}-${'ofx'[i]}`, phase: 3, area: 'lettering', tier: 'd', kind: 'glyph', classes: 'D', pinned: true, pts: poly([1370 + i * 14, 700], [1376 + i * 14, 680], [1382 + i * 14, 700]) });
  for (let i = 0; i < 10; i++) add({ id: `detail-nose-${i}`, phase: 3, area: 'nose', tier: 'd', kind: 'detail', classes: i % 3 ? 'DT' : 'DTP', pts: wave(960 + i * 38, 790 - i * 9, 48, 2) });
  for (let i = 0; i < 6; i++) add({ id: `detail-rear-${i}`, phase: 3, area: 'rear-frame', tier: 'd', kind: 'detail', classes: i < 3 ? 'DTP' : 'DT', pts: line(1560 + i * 12, 560 + i * 8, 1640 + i * 6, 640 + i * 10) });
  // P4 shadow edge and a hatch patch starting at it
  add({ id: 'shadow-edge', phase: 4, area: 'shadow', tier: 'd', kind: 'detail', pts: line(980, 880, 1330, 880, 60) });
  for (let i = 0; i < 12; i++) add({ id: `flick-${i}`, phase: 4, area: 'hatch-body', tier: 'h', kind: 'hatch', prov: 'convention', group: 'body', pinned: true, classes: i % 2 ? 'D' : 'DTP', pts: line(1000 + i * 10, 880, 1000 + i * 10 - 14, 906) });
  // P5 accents
  add({ id: 'acc-a', phase: 5, area: 'accent', tier: 'a', kind: 'accent', prov: 'derived', pinned: true, pts: line(960, 800, 1100, 750) });
  add({ id: 'acc-b', phase: 5, area: 'accent', tier: 'a', kind: 'accent', prov: 'derived', pinned: true, pts: circle(1425, 838, 78, 92, 1.0, 0.18) });
  return { format: 'hero-pen-strokes/1', source: 'unit-test fixture', car: [932, 430.7, 1758.5, 927.6], seed: 20261107, strokes: S };
}
module.exports = { fixture, circle, line, poly, wave };
