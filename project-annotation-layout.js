const clamp = (value, low, high) => Math.max(low, Math.min(Math.max(low, high), value));
const overlap = (a, b) => Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
  Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
const expand = (r, pad) => ({ x: r.x - pad, y: r.y - pad, width: r.width + pad * 2, height: r.height + pad * 2 });

// A mask row is a 32-bit integer (bit n = column n), or a hex string read
// left to right (most significant bit first) for grids wider than 32 columns.
const cell = (row, col) => typeof row === 'string' ? (parseInt(row[col >> 2], 16) >> (3 - (col & 3))) & 1 : (row >>> col) & 1;

// Coarse source-pose occupancy is baked once, never read back from the GPU in
// the production animation loop. Merge adjacent cells into economical spans.
export function maskRegions(mask, { x = 0, y = 0, width, height }, columns = 32, rows = 24) {
  if (!mask?.length) return [];
  const regions = [];
  for (let row = 0; row < Math.min(rows, mask.length); row++) {
    let start = -1;
    for (let col = 0; col <= columns; col++) {
      const set = col < columns && cell(mask[row], col);
      if (set && start < 0) start = col;
      if (!set && start >= 0) {
        regions.push({ x: x + start * width / columns, y: y + row * height / rows,
          width: (col - start) * width / columns, height: height / rows });
        start = -1;
      }
    }
  }
  return regions;
}

// The leader's points only: the drawn layout weighs hundreds of these and
// writes an SVG path for the one it keeps.
function leaderGeometry(label, anchor) {
  const { x, y, width, height } = label;
  const center = { x: x + width / 2, y: y + height / 2 };
  const horizontal = Math.abs(anchor.x - center.x) / width > Math.abs(anchor.y - center.y) / height;
  const direction = horizontal ? Math.sign(anchor.x - center.x) || 1 : Math.sign(anchor.y - center.y) || 1;
  const start = horizontal
    ? { x: direction > 0 ? x + width + 7 : x - 7, y: clamp(anchor.y, y + 14, y + height - 14) }
    : { x: clamp(anchor.x, x + 14, x + width - 14), y: direction > 0 ? y + height + 7 : y - 7 };
  const elbow = { x: start.x + (horizontal ? direction * 14 : 0), y: start.y + (horizontal ? 0 : direction * 14) };
  const dx = anchor.x - elbow.x, dy = anchor.y - elbow.y, distance = Math.hypot(dx, dy) || 1;
  const tip = { x: anchor.x - dx / distance * 4, y: anchor.y - dy / distance * 4 };
  const radius = Math.min(5, distance / 3);
  const before = { x: elbow.x - (horizontal ? direction * radius : 0), y: elbow.y - (horizontal ? 0 : direction * radius) };
  const after = { x: elbow.x + dx / distance * radius, y: elbow.y + dy / distance * radius };
  return { start, before, elbow, after, tip, length: Math.hypot(elbow.x - start.x, elbow.y - start.y) + distance - 4 };
}
const point = p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
const drawnLine = g => ({ path: `M${point(g.start)} L${point(g.before)} Q${point(g.elbow)} ${point(g.after)} L${point(g.tip)}`,
  length: g.length, tip: g.tip, start: g.start, elbow: g.elbow });
export function leaderPath(label, anchor) { return drawnLine(leaderGeometry(label, anchor)); }

// "Drawn" callouts read occupancy from a cell grid: per-phase pixels of the
// rendered frames (assets/detail-callouts-20261028) or the coarse anchor masks.
// A summed-area table answers "how much hardware under this label" in O(1);
// a leader's run over hardware is sampled along its straight segment.
const grids = new WeakMap();
function occupancyGrid(occupancy) {
  const { mask, columns, rows, box } = occupancy || {};
  if (!mask?.length || !box?.width || !box?.height) return null;
  const key = `${columns}:${rows}:${[box.x, box.y, box.width, box.height].map(v => v.toFixed(2)).join(':')}`;
  const cached = grids.get(mask);
  if (cached?.key === key) return cached.grid;
  const sat = new Int32Array((columns + 1) * (rows + 1)), cells = new Uint8Array(columns * rows);
  for (let r = 0; r < rows; r++) for (let c = 0, line = 0; c < columns; c++) {
    const set = r < mask.length ? cell(mask[r], c) : 0;
    cells[r * columns + c] = set; line += set;
    sat[(r + 1) * (columns + 1) + c + 1] = sat[r * (columns + 1) + c + 1] + line;
  }
  const grid = { columns, rows, x: box.x, y: box.y, cw: box.width / columns, ch: box.height / rows, cells, sat };
  grids.set(mask, { key, grid });
  return grid;
}
// Occupied area (px²) under a rectangle, by whole and partial cells.
function gridArea(grid, rect) {
  const c0 = Math.max(0, Math.floor((rect.x - grid.x) / grid.cw)), c1 = Math.min(grid.columns, Math.ceil((rect.x + rect.width - grid.x) / grid.cw));
  const r0 = Math.max(0, Math.floor((rect.y - grid.y) / grid.ch)), r1 = Math.min(grid.rows, Math.ceil((rect.y + rect.height - grid.y) / grid.ch));
  if (c1 <= c0 || r1 <= r0) return 0;
  const w = grid.columns + 1, s = grid.sat;
  const count = s[r1 * w + c1] - s[r0 * w + c1] - s[r1 * w + c0] + s[r0 * w + c0];
  // Scale whole-cell counts by the rectangle's share of the cells it touches.
  const share = (rect.width * rect.height) / ((c1 - c0) * grid.cw * (r1 - r0) * grid.ch);
  return count * grid.cw * grid.ch * Math.min(1, share);
}
const occupiedAt = (grid, x, y) => {
  const c = Math.floor((x - grid.x) / grid.cw), r = Math.floor((y - grid.y) / grid.ch);
  return c >= 0 && r >= 0 && c < grid.columns && r < grid.rows && grid.cells[r * grid.columns + c] === 1;
};
// Length of a segment over hardware, ignoring its last `skip` px (the target).
function gridRun(grid, a, b, skip) {
  const length = Math.hypot(b.x - a.x, b.y - a.y), run = length - skip;
  if (!grid || run <= 0) return 0;
  const step = Math.max(2, Math.min(grid.cw, grid.ch) / 3), count = Math.ceil(run / step);
  let inside = 0;
  for (let i = 0; i < count; i++) {
    const t = (i + .5) / count * run / length;
    if (occupiedAt(grid, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)) inside++;
  }
  return inside * run / count;
}
// Liang–Barsky: the length of segment ab inside rectangle r.
function clipLength(a, b, r) {
  let t0 = 0, t1 = 1;
  const dx = b.x - a.x, dy = b.y - a.y;
  for (const [p, q] of [[-dx, a.x - r.x], [dx, r.x + r.width - a.x], [-dy, a.y - r.y], [dy, r.y + r.height - a.y]]) {
    if (p === 0) { if (q < 0) return 0; continue; }
    const t = q / p;
    if (p < 0) { if (t > t1) return 0; if (t > t0) t0 = t; } else { if (t < t0) return 0; if (t < t1) t1 = t; }
  }
  return Math.max(0, t1 - t0) * Math.hypot(dx, dy);
}
const inside = (p, r) => p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;

// Drawn callouts: labels sit on the page's gutter grid, a leader is held under
// `cap` (about 24% of the stage diagonal) for the whole phase, and its run over
// other hardware costs three times its length. A label may not cover its own
// part at any point of the phase, nor the heading, controls or a figure key.
function layoutDrawn({ anchor, width, height, labelWidth, labelHeight, reserved = [], previous = null, reset = false,
  occupancy = null, trajectory = [], gutter = width < 700 ? 22 : 56, cap = .24 * Math.hypot(width, height), minimum = width < 700 ? 34 : 46, bound = Infinity }) {
  const size = { width: Math.min(labelWidth, width - gutter * 2), height: labelHeight };
  const top = 66, bottom = height - 88 - size.height;
  const constrain = (x, y) => ({ x: Math.round(clamp(x, gutter, width - gutter - size.width)), y: Math.round(clamp(y, top, bottom)), ...size });
  const grid = occupancyGrid(occupancy);
  const skip = grid ? Math.max(12, Math.min(grid.cw, grid.ch) * 1.25) : 12;
  const path = [anchor, ...trajectory.filter(p => p && Number.isFinite(p.x) && Number.isFinite(p.y))];
  const forbidden = rect => reserved.reduce((sum, region) => sum + overlap(expand(rect, 8), region), 0);
  // Every term but the run over hardware is cheap; it is a lower bound on the
  // score, so candidates are weighed in its order and the runs (the costly part)
  // are sampled only while a candidate can still win.
  const prepare = rect => {
    const line = leaderGeometry(rect, anchor), lines = [line];
    let longest = line.length, covers = 0, crossesReserved = 0;
    for (const point of path) {
      if (inside(point, expand(rect, 14))) covers++;
      if (point === anchor) continue;
      const other = leaderGeometry(rect, point);
      longest = Math.max(longest, other.length);
      lines.push(other);
    }
    // A leader never runs back through its own label or over the heading and controls.
    const crossesSelf = clipLength(line.elbow, line.tip, expand(rect, 3));
    for (const region of reserved) crossesReserved += clipLength(line.elbow, line.tip, region);
    const occupied = grid ? gridArea(grid, expand(rect, 4)) : 0, blocked = forbidden(rect);
    // Too short a leader reads as a tick, not a callout.
    const over = Math.max(0, longest - cap), short = Math.max(0, minimum - line.length);
    const moved = previous ? Math.hypot(rect.x - previous.x, rect.y - previous.y) * .02 : 0;
    const rest = occupied * .35 + blocked * 100 + covers * 1e5 + crossesSelf * 1e3 + crossesReserved * 8 + over * over * .5 + over * 20 + short * 6 + moved;
    return { rect, line, lines, longest, occupied, blocked, rest, low: longest + rest };
  };
  const finish = (item, limit) => {
    let run = 0;
    for (const line of item.lines) {
      run = Math.max(run, gridRun(grid, line.elbow, line.tip, skip));
      if (item.low + run * 3 >= limit) return null;
    }
    return { ...item.rect, line: item.line, score: item.longest + run * 3 + item.rest, longest: item.longest, run, overlap: item.occupied, reservedOverlap: item.blocked };
  };
  // The cap is a hard limit on the leader itself, applied after the note has
  // snapped to the grid: a note further than the cap from its part slides
  // toward it along the leader (never into the heading or controls) until the
  // leader fits.
  const leash = rect => {
    let placed = rect;
    for (let i = 0; i < 6; i++) {
      const line = leaderGeometry(placed, anchor), over = line.length - (cap - 1);
      if (over <= 0) break;
      const dx = anchor.x - line.elbow.x, dy = anchor.y - line.elbow.y, distance = Math.hypot(dx, dy) || 1;
      const moved = constrain(placed.x + dx / distance * (over + .5), placed.y + dy / distance * (over + .5));
      if ((moved.x === placed.x && moved.y === placed.y) || forbidden(moved) > forbidden(placed) + 1 ||
        leaderGeometry(moved, anchor).length >= line.length) break;
      placed = { ...placed, x: moved.x, y: moved.y };
    }
    return placed;
  };
  // The note holds still while its part travels within a phase; only the
  // leader follows, as in the classic layout, up to the cap.
  if (previous && !reset) {
    const rect = constrain(previous.x, previous.y);
    if (forbidden(rect) < 1) {
      const held = leash(rect);
      return { ...previous, ...held, ...leaderPath(held, anchor), side: previous.side };
    }
  }
  const seen = new Set(), candidates = [];
  const add = (x, y, side) => {
    const rect = constrain(x, y), key = `${rect.x},${rect.y}`;
    if (!seen.has(key)) { seen.add(key); candidates.push({ ...rect, side }); }
  };
  for (const gap of [24, 36, 50, 66, 92, 124, 164, 214, 274]) {
    for (let offset = -1.5; offset <= 1.5; offset += .375) {
      add(anchor.x - gap - size.width, anchor.y - size.height / 2 + offset * size.height, 'left');
      add(anchor.x + gap, anchor.y - size.height / 2 + offset * size.height, 'right');
    }
    for (let offset = -.875; offset <= .875; offset += .25) {
      add(anchor.x - size.width / 2 + offset * size.width, anchor.y - gap - size.height, 'above');
      add(anchor.x - size.width / 2 + offset * size.width, anchor.y + gap, 'below');
    }
  }
  // The gutter columns: a label aligned with the heading's edge.
  for (let y = top; y <= bottom + 1; y += 18) { add(gutter, y, 'left'); add(width - gutter - size.width, y, 'right'); }
  // `bound`: the caller's best so far (another note width); nothing at or
  // above it is worth finishing, and then the result has an infinite score.
  const ranked = candidates.map(prepare).sort((a, b) => a.low - b.low);
  let best = null;
  for (const item of ranked) {
    const limit = Math.min(bound, best ? best.score : Infinity);
    if (item.low >= limit) break;
    const result = finish(item, limit);
    if (result && (!best || result.score < best.score)) best = result;
  }
  if (!best) {
    // Unchanged unless the cap had to pull the note in.
    const fallback = leash(ranked[0].rect);
    const line = fallback === ranked[0].rect ? drawnLine(ranked[0].line) : leaderPath(fallback, anchor);
    return { ...fallback, ...line, score: Infinity, longest: ranked[0].longest, run: NaN, overlap: ranked[0].occupied, reservedOverlap: ranked[0].blocked };
  }
  const { line, ...kept } = best;
  const placed = leash(kept);
  return placed === kept ? { ...kept, ...drawnLine(line) } : { ...placed, ...leaderPath(placed, anchor) };
}

export function layoutAnnotation(options) {
  return options.mode === 'drawn' ? layoutDrawn(options) : layoutClassic(options);
}

function layoutClassic({ anchor, width, height, labelWidth, labelHeight, regions = [], reserved = [], previous = null, reset = false }) {
  const margin = width < 700 ? 18 : 28;
  const size = { width: Math.min(labelWidth, width - margin * 2), height: labelHeight };
  const constrain = (x, y) => ({ x: clamp(x, margin, width - margin - size.width), y: clamp(y, 66, height - 88 - size.height), ...size });
  const collision = rect => regions.reduce((sum, region) => sum + overlap(expand(rect, 10), region), 0);
  const forbidden = rect => reserved.reduce((sum, region) => sum + overlap(expand(rect, 8), region), 0);
  // A component may travel while a note is being read. Keep the label still;
  // only its short leader follows the part until the next reading or resize.
  if (previous && !reset) {
    const rect = constrain(previous.x, previous.y);
    if (forbidden(rect) < 1) return { ...rect, ...leaderPath(rect, anchor), side: previous.side,
      overlap: rect.x === previous.x && rect.y === previous.y && Number.isFinite(previous.overlap) ? previous.overlap : collision(rect) };
  }
  const candidates = [];
  for (const gap of [32, 58, 92, 140, 210]) {
    for (const offset of [0, -.65, .65, -1.25, 1.25]) {
      candidates.push({ ...constrain(anchor.x - gap - size.width, anchor.y - size.height / 2 + offset * size.height), side: 'left' });
      candidates.push({ ...constrain(anchor.x + gap, anchor.y - size.height / 2 + offset * size.height), side: 'right' });
    }
    candidates.push({ ...constrain(anchor.x - size.width / 2, anchor.y - gap - size.height), side: 'above' });
    candidates.push({ ...constrain(anchor.x - size.width / 2, anchor.y + gap), side: 'below' });
  }
  // Edge positions find a free band when an enlarged model fills the stage
  // around its part; the longer leader is weighed against any overlap. The top
  // band starts below the heading's reserved strip and its 8px clearance.
  for (const y of [anchor.y - size.height / 2, 70, height - 88 - size.height]) {
    candidates.push({ ...constrain(margin, y), side: 'left' }, { ...constrain(width - margin - size.width, y), side: 'right' });
  }
  candidates.push({ ...constrain(anchor.x - size.width / 2, 70), side: 'above' }, { ...constrain(anchor.x - size.width / 2, height - 88 - size.height), side: 'below' });
  let best;
  for (const rect of candidates) {
    const line = leaderPath(rect, anchor), occupied = collision(rect), blocked = forbidden(rect);
    const coversTarget = overlap(expand(rect, 16), { x: anchor.x - 2, y: anchor.y - 2, width: 4, height: 4 });
    const score = occupied * 2 + blocked * 100 + coversTarget * 10000 + line.length +
      (rect.side === 'below' ? 8 : 0) + (previous ? Math.hypot(rect.x - previous.x, rect.y - previous.y) * .015 : 0);
    if (!best || score < best.score) best = { ...rect, ...line, score, side: rect.side, overlap: occupied, reservedOverlap: blocked };
  }
  return best;
}
