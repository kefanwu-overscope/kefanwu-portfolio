const clamp = (value, low, high) => Math.max(low, Math.min(Math.max(low, high), value));
const overlap = (a, b) => Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
  Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
const expand = (r, pad) => ({ x: r.x - pad, y: r.y - pad, width: r.width + pad * 2, height: r.height + pad * 2 });

// Coarse source-pose occupancy is baked once, never read back from the GPU in
// the production animation loop. Merge adjacent cells into economical spans.
export function maskRegions(mask, { x = 0, y = 0, width, height }, columns = 32, rows = 24) {
  if (!mask?.length) return [];
  const regions = [];
  for (let row = 0; row < Math.min(rows, mask.length); row++) {
    let start = -1;
    for (let col = 0; col <= columns; col++) {
      const set = col < columns && ((mask[row] >>> col) & 1);
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

export function leaderPath(label, anchor) {
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
  const point = p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  return { path: `M${point(start)} L${point(before)} Q${point(elbow)} ${point(after)} L${point(tip)}`,
    length: Math.hypot(elbow.x - start.x, elbow.y - start.y) + distance - 4, tip };
}

export function layoutAnnotation({ anchor, width, height, labelWidth, labelHeight, regions = [], reserved = [], previous = null, reset = false }) {
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
