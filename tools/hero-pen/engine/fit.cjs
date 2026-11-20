// Polyline helpers and cubic Bezier fitting (Schneider, "An algorithm for automatically fitting digitized curves",
// Graphics Gems 1990) for the hero pen build. Everything is in src px of the 2200x1238 photo.
'use strict';

const hyp = Math.hypot;
const plen = (p) => { let s = 0; for (let i = 1; i < p.length; i++) s += hyp(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return s; };

// Resample a polyline at a fixed arc step (keeps both ends).
function resample(p, step) {
  if (p.length < 2) return p.map((q) => [q[0], q[1]]);
  const s = [0];
  for (let i = 1; i < p.length; i++) s.push(s[i - 1] + hyp(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]));
  const L = s[s.length - 1];
  if (L < 1e-9) return [[p[0][0], p[0][1]]];
  const n = Math.max(1, Math.ceil(L / step)), out = [];
  let j = 0;
  for (let k = 0; k <= n; k++) {
    const t = (L * k) / n;
    while (j < s.length - 2 && s[j + 1] < t) j++;
    const d = s[j + 1] - s[j], u = d > 0 ? (t - s[j]) / d : 0;
    out.push([p[j][0] + (p[j + 1][0] - p[j][0]) * u, p[j][1] + (p[j + 1][1] - p[j][1]) * u]);
  }
  return out;
}

// Corner indices: turn over `ang` degrees measured across +-k points (gen.py corners()).
function corners(p, k = 3, ang = 60) {
  const found = [];
  for (let i = k; i < p.length - k; i++) {
    const ax = p[i][0] - p[i - k][0], ay = p[i][1] - p[i - k][1], bx = p[i + k][0] - p[i][0], by = p[i + k][1] - p[i][1];
    const na = hyp(ax, ay), nb = hyp(bx, by);
    if (na < 1e-6 || nb < 1e-6) continue;
    const a = (Math.acos(Math.max(-1, Math.min(1, (ax * bx + ay * by) / na / nb))) * 180) / Math.PI;
    if (a > ang) found.push([a, i]);
  }
  found.sort((u, v) => v[0] - u[0]);
  const keep = [];
  for (const [, i] of found) if (keep.every((j) => Math.abs(i - j) > Math.max(4, k + 1))) keep.push(i);
  return keep.sort((a, b) => a - b);
}

// Distance from point q to polyline p.
function distToPolyline(q, p) {
  let best = Infinity;
  for (let i = 1; i < p.length; i++) {
    const ax = p[i - 1][0], ay = p[i - 1][1], bx = p[i][0] - ax, by = p[i][1] - ay, L2 = bx * bx + by * by;
    let t = L2 > 0 ? ((q[0] - ax) * bx + (q[1] - ay) * by) / L2 : 0;
    t = Math.max(0, Math.min(1, t));
    const d = hyp(q[0] - ax - bx * t, q[1] - ay - by * t);
    if (d < best) best = d;
  }
  if (p.length === 1) best = hyp(q[0] - p[0][0], q[1] - p[0][1]);
  return best;
}
// Two-sided (Hausdorff) distance between polylines a and b.
function hausdorff(a, b) {
  let m = 0;
  for (const q of a) m = Math.max(m, distToPolyline(q, b));
  for (const q of b) m = Math.max(m, distToPolyline(q, a));
  return m;
}

// ---- Schneider fitting ----
const B = (c, t) => { const u = 1 - t; return [u * u * u * c[0][0] + 3 * u * u * t * c[1][0] + 3 * u * t * t * c[2][0] + t * t * t * c[3][0], u * u * u * c[0][1] + 3 * u * u * t * c[1][1] + 3 * u * t * t * c[2][1] + t * t * t * c[3][1]]; };
const B1 = (c, t) => { const u = 1 - t; return [3 * (u * u * (c[1][0] - c[0][0]) + 2 * u * t * (c[2][0] - c[1][0]) + t * t * (c[3][0] - c[2][0])), 3 * (u * u * (c[1][1] - c[0][1]) + 2 * u * t * (c[2][1] - c[1][1]) + t * t * (c[3][1] - c[2][1]))]; };
const B2 = (c, t) => [6 * ((1 - t) * (c[2][0] - 2 * c[1][0] + c[0][0]) + t * (c[3][0] - 2 * c[2][0] + c[1][0])), 6 * ((1 - t) * (c[2][1] - 2 * c[1][1] + c[0][1]) + t * (c[3][1] - 2 * c[2][1] + c[1][1]))];
const norm = (v) => { const l = hyp(v[0], v[1]); return l > 1e-12 ? [v[0] / l, v[1] / l] : [1, 0]; };

function chordParam(P, a, b) {
  const u = [0];
  for (let i = a + 1; i <= b; i++) u.push(u[u.length - 1] + hyp(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const L = u[u.length - 1] || 1;
  return u.map((v) => v / L);
}
function generate(P, a, b, u, t1, t2) {
  const p0 = P[a], p3 = P[b];
  let c00 = 0, c01 = 0, c11 = 0, x0 = 0, x1 = 0;
  for (let i = 0; i < u.length; i++) {
    const t = u[i], s = 1 - t, b0 = s * s * s, b1 = 3 * s * s * t, b2 = 3 * s * t * t, b3 = t * t * t;
    const A0 = [t1[0] * b1, t1[1] * b1], A1 = [t2[0] * b2, t2[1] * b2];
    c00 += A0[0] * A0[0] + A0[1] * A0[1]; c01 += A0[0] * A1[0] + A0[1] * A1[1]; c11 += A1[0] * A1[0] + A1[1] * A1[1];
    const q = P[a + i], tx = q[0] - (p0[0] * (b0 + b1) + p3[0] * (b2 + b3)), ty = q[1] - (p0[1] * (b0 + b1) + p3[1] * (b2 + b3));
    x0 += A0[0] * tx + A0[1] * ty; x1 += A1[0] * tx + A1[1] * ty;
  }
  const det = c00 * c11 - c01 * c01, seg = hyp(p3[0] - p0[0], p3[1] - p0[1]);
  let al = det !== 0 ? (x0 * c11 - x1 * c01) / det : 0, ar = det !== 0 ? (c00 * x1 - c01 * x0) / det : 0;
  if (!(al > 1e-6 * seg) || !(ar > 1e-6 * seg) || !isFinite(al) || !isFinite(ar)) al = ar = seg / 3;
  return [p0, [p0[0] + t1[0] * al, p0[1] + t1[1] * al], [p3[0] + t2[0] * ar, p3[1] + t2[1] * ar], p3];
}
// Squared error at the data points, and between them (the curve at the mid parameter against the chord), so a
// loop or overshoot between two samples is seen too.
function maxErr(P, a, b, c, u) {
  let m = 0, at = Math.floor((a + b) / 2);
  for (let i = a + 1; i < b; i++) {
    const q = B(c, u[i - a]), d = (q[0] - P[i][0]) ** 2 + (q[1] - P[i][1]) ** 2;
    if (d >= m) { m = d; at = i; }
  }
  for (let i = a; i < b; i++) {
    const q = B(c, (u[i - a] + u[i - a + 1]) / 2), d = distToPolyline(q, [P[i], P[i + 1]]) ** 2;
    if (d > m) { m = d; at = Math.min(b - 1, Math.max(a + 1, i + (i === a ? 1 : 0))); }
  }
  return [m, at];
}
function reparam(P, a, b, u, c) {
  return u.map((t, i) => {
    const q = B(c, t), d1 = B1(c, t), d2 = B2(c, t), p = P[a + i];
    const num = (q[0] - p[0]) * d1[0] + (q[1] - p[1]) * d1[1], den = d1[0] * d1[0] + d1[1] * d1[1] + (q[0] - p[0]) * d2[0] + (q[1] - p[1]) * d2[1];
    const v = den !== 0 ? t - num / den : t;
    return Math.max(0, Math.min(1, v));
  });
}
function fitRec(P, a, b, t1, t2, tol, out) {
  if (b - a === 1) {
    const d = hyp(P[b][0] - P[a][0], P[b][1] - P[a][1]) / 3;
    out.push([P[a], [P[a][0] + t1[0] * d, P[a][1] + t1[1] * d], [P[b][0] + t2[0] * d, P[b][1] + t2[1] * d], P[b]]);
    return;
  }
  let u = chordParam(P, a, b), c = generate(P, a, b, u, t1, t2), [e, sp] = maxErr(P, a, b, c, u);
  if (e < tol * tol) { out.push(c); return; }
  if (e < 16 * tol * tol) {
    for (let k = 0; k < 20; k++) {
      const u2 = reparam(P, a, b, u, c);
      c = generate(P, a, b, u2, t1, t2);
      [e, sp] = maxErr(P, a, b, c, u2);
      if (e < tol * tol) { out.push(c); return; }
      u = u2;
    }
  }
  if (sp <= a) sp = a + 1;
  if (sp >= b) sp = b - 1;
  const tc = norm([P[sp - 1][0] - P[sp + 1][0], P[sp - 1][1] - P[sp + 1][1]]);
  fitRec(P, a, sp, t1, tc, tol, out);
  fitRec(P, sp, b, [-tc[0], -tc[1]], t2, tol, out);
}
// Fit cubics to one smooth run of points (no corners inside). Returns [[p0, p1, p2, p3], ...].
function fitRun(P, tol) {
  if (P.length < 2) return [];
  const n = P.length - 1, k = Math.min(3, n);
  const t1 = norm([P[k][0] - P[0][0], P[k][1] - P[0][1]]), t2 = norm([P[n - k][0] - P[n][0], P[n - k][1] - P[n][1]]);
  const out = [];
  fitRec(P, 0, n, t1, t2, tol, out);
  return out;
}

module.exports = { plen, resample, corners, distToPolyline, hausdorff, fitRun, bez: B };
