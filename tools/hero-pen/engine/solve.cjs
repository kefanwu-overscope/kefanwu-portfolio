// Schedule solver for the hero pen (PEN_SPEC section 5), ported from the pilot's gen.py with the critic's timing
// fixes (releases/hand-drawn-20261106/pilot-review): the speed ramps into the form phase over 300 ms with a 0.18
// cw/frame cap there for strokes of 0.4 cw or more; a beat of at least 17 ms whenever the next stroke starts more
// than 0.12 cw from the pen; locality (0.25 cw) is part of the window caps; no TEMPO option.
// Motion is the engine's own (posAt/ptAt from engine.js, passed in as `core`), so the checks see what the page draws.
'use strict';

// Revision 1 (critics of the R3 films):
//  - P0 lay-in in 250 ms: 70 ms per guide, 20 ms lifts, 60 ms pause before P1 (was 479 ms to the first contour);
//    A[0] rises 0.15 -> 0.25 so a 0.46 cw ghost fits 70 ms. The guides also draw unmixed at 1 device px (engine.js).
//  - numerals (tier n): at least 4 frames each (67 ms), 30 ms lift between the digits of one number.
//  - lettering: at most one letter ends in any 16.67 ms window (letter ends >= 17.5 ms apart while solving, >= 16.67
//    checked); the first word (Olin) takes >= 2 frames per letter; an i-dot starts >= 17 ms after its word.
//  - class P: every non-hatch stroke of 0.05 cw or more lasts >= 2 frames (34 ms).
//  - the P5 accents are dropped at every class (build.cjs), so no accent lands on a drawing that is already fading.
// Revision 2 (critics of the revision 1 films):
//  - the payoff is the last ink: the build moves the detail phase's lines into P2 and draws P4 (and the P5 accents it
//    keeps) right after P2, so the phases run in the order K.PHASE_RANK (0 1 2 4 5 3) and P3 holds only the numerals
//    and the lettering. The solver walks runs of one phase in data order, each with its own constants.
//  - SHADE edges (tier h, kind shade): peak advance <= 0.12 cw per frame, >= 6 frames from 0.3 cw, else >= 4.
//  - lettering: each letter lasts clamp(34 ms x sqrt(path / 25 src px), 25, 50) ms, shared by its strokes by length,
//    >= 1 frame for a glyph stroke of 15 src px or more (build.cjs sets the per-stroke time `lx`); 40 ms lift between
//    words, 70 ms at the line break (`wl`).
//  - P1 strokes under 0.10 cw take 4 frames (67 ms) instead of 5.
//  - the ghost rim loops retire 150 ms after their rim's last stroke (engine.js; GHOST_MS is the build's check).
// Revision 3 (critics of the revision 2 films, main-loop decisions of 2026-11-07):
//  - the finished drawing is seen whole: the develop starts DEV_GAP = 100 ms AFTER last ink in every class (was last
//    ink - 150 ms, which put the last numerals under the develop).
//  - an empty phase is no phase: runs() only sees phases that have strokes, so a class without P4 has no P4 pause, no
//    P4 beat and no P4 gap; P2 flows straight into P3.
//  - P2 FORM and DETAIL strokes (tier f or d, not glyphs) of 0.15 cw or more last >= 2 frames, and no two of them end
//    within 2 frames (33.3 ms) of each other (the later one is drawn longer; solved >= L2_GAP ms apart).
//  - a numeral that starts a new number after another number's digit waits >= NUM_WORD_LIFT (was the 17 ms beat).
//  - lettering (E3, because D ran over 4.1 s): letters clamp(25 ms x sqrt(path / 25 src px), 20, 40) (was 34, 25-50;
//    the clamp alone gave 1016 ms of lettering, the scale 25 gives 844 <= 850), word lift 30 ms, line lift 50 (was 40,
//    70); a glyph stroke of 15 src px or more still gets >= 1 frame, one letter still ends per frame.
// Revision 4 (critics of the revision 3 films, main-loop decisions of 2026-11-07):
//  - numerals (tier n): the engine flattens each submovement (smoothstep ramps, plateau) on plain arc length with the
//    time shared by length; here: peak advance <= NUM_ADV = 35 % of the stroke per 16.67 ms window and >= 3 frames each
//    advancing >= 5 % of it, at every frame phase. D and T keep 67 ms; class P gets NUM_DUR_P = 100 ms and every
//    submovement >= 2 frames.
//  - E1: a closed loop (ends within max(3, 5 % L) src px) of 60 src px or more lasts >= 2 frames.
//  - E2: class P, phase P2: every non-hatch stroke of 50 src px or more lasts >= 1 frame.
//  - E3: a stroke that continues another (join flags end -> start, ends within 3 src px) keeps the tip's mean speed
//    across the join: both strokes' durations are scaled to the slower of the two (dur / length equal within 1 ms).
//  - E5: in P2, at most 2 stroke ends inside one area per 16.67 ms window (the third end waits, solved >= 18 ms
//    after the end two before it in that area).
// Revision 5 (critics of the revision 4 films, main-loop decisions of 2026-11-09):
//  - P2 floor: every P2 stroke lasts >= 1 frame at every class (P2_MS; revision 4 had this at class P only), so no P2
//    stroke finishes inside one 60 Hz frame and short lines no longer outrun long ones.
//  - P2 lift: whenever the next P2 stroke starts more than P2_LIFT_D = 50 src px from the pen, the lift is >= P2_LIFT
//    = 17 ms, so two strokes far apart never ink in the same frame.
//  - P1 without a metronome: each P1 duration is proportional to len^P1_POW x (1 + P1_TURN x total turning in
//    radians), normalised to the same P1 total of stroke time (lifts unchanged), never under the stroke's peak-advance
//    floor (A[1] = 0.12 cw per frame) or P1_FLOOR_MS (see K).
//  - targets: D last ink <= 4200 ms, photo fully in <= 5300 ms from t0.
// Revision 7 (polish round 2026-11-10: the main loop's decisions on the round 6 feel critic's optional E1 and E2; agent
// decisions, not the owner's):
//  - E1: inside P2, a pen hop of more than P2_HOP_L = 0.25 cw lifts >= max(P2_LIFT, P2_HOP_MS x hop / cw) ms (90 ms per
//    car width: 0.37 cw -> 33.3 ms), rounded UP to whole ms (34), because the schedule's whole-ms step floors a gap and
//    a floored lift would fall under the rule by up to 1 ms; so a jump across the car is not crossed in about one frame
//    (class P's rw-rim-fit -> column-right, 0.37 cw with a 17-18 ms lift in revision 6). Not the P1 -> P2 join, whose
//    98 ms beat stays.
//  - E2: inside P1 (the seen hand), a hop of P1_HOP_L = 0.195 cw or more lifts >= P1_HOP_MS = 45 ms (was the 30 ms beat),
//    so the hand's travel between silhouette strokes shows. The critic's "hops of 0.20-0.26 cw" are the five hops into
//    hoop-leg-arch, the brace, rear-tyre, front-tyre and helmet; on the solver's geometry (1 src px run-ons included)
//    the hop into rear-tyre measures 0.199 cw at D and T and the one into brace-centre 0.198 at P (the critic rounded to
//    two decimals), so the threshold is 0.195: those five hops at every class, and the next shorter P1 hop is 0.115 cw.
//    Not the P0 -> P1 join (60 ms, kept).
//  - paid for by the line lift before 'of' (LINE_LIFT 50 -> 30 ms, the same as a word lift) and the P2 -> P3 phase pause
//    (PAUSE[3] 50 -> 33 ms: the join 67 -> 50 ms with the 17 ms beat).
// Fix r2 (2026-11-10: the main loop's decisions on the feel verifier's notes; agent decisions, not the owner's):
//  - P0 hop: inside P0 a pen hop of more than P0_HOP_L = 0.5 cw lifts >= max(P0_LIFT 20, P0_HOP_MS 90 x hop / cw) ms,
//    rounded up (the third lay-in mark jumped 0.95 cw, rear rim to nose, in 20 ms: the only teleport in the hand-speed
//    opening; it now lifts 86 ms). Shorter P0 hops keep the 20 ms lift.
//  - P0 durations vary a little by length: proportional to L^P0_POW x (1 + u1) (u1: the stroke's seeded jitter, as in
//    every other phase), normalised to the phase's old total (70 ms a guide when no floor binds), never under a
//    stroke's floor (3 frames, MINFR, the 0.25 cw per frame peak advance); whole ms by largest remainder (p0Spread).
//  - paid for by beats, never the P1 seen hand: see PAUSE[1] and PAUSE[2] below (D last ink stays <= 4200 ms).
const FR = 1000 / 60, CW = 827;
const K = {
  S_HAND: 3.4,
  FLOOR: [50, 83, 0, 0, 0, 25],
  A: [0.25, 0.12, 0.25, 0.30, 0.35, 0.25],
  BEAT: [30, 30, 18, 17, 22, 17],
  // revision 7: PAUSE[3] 50 -> 33 (the P2 -> P3 join 67 -> 50 ms). Fix r2 (pays for the P0 hop lift, 20 -> 86 ms): PAUSE[1]
  // 30 -> 0 (the P0 -> P1 join 60 -> 30 ms, the beat alone; the nose gesture ends 0.14 cw from the nose loop's start) and
  // PAUSE[2] 80 -> 60 (the P1 -> P2 join 98 -> 78 ms, still the longest pause after P0's hop)
  PAUSE: [0, 0, 60, 33, 50, 40],
  P0_DUR: 70, P0_LIFT: 20, S_MIN: 16,
  NUM_DUR: 67, NUM_LIFT: 30, LE_GAP: 19, DOT_GAP: 17, P_FLOOR_L: 0.05, P_FLOOR_MS: 2 * (1000 / 60), P_FLOOR_SCOPE: 'named', P_FLOOR_AREAS: ['driver', 'rear-frame'],
  PHASE_RANK: [0, 1, 2, 5, 3, 4],          // rank of phase p: P0 P1 P2 P4 P5 P3
  P1_SHORT_L: 0.10, P1_SHORT_MS: 4 * (1000 / 60),
  SHADE_A: 0.12, SHADE_LONG_L: 0.3, SHADE_LONG_MS: 6 * (1000 / 60), SHADE_MS: 4 * (1000 / 60),
  LETTER_MS: 25, LETTER_REF: 25, LETTER_MIN: 20, LETTER_MAX: 40, GLYPH_FRAME_L: 15, WORD_LIFT: 30, LINE_LIFT: 30,
  ACCENT_MS: 4 * (1000 / 60), GHOST_MS: 150, DEV_GAP: 100,
  L2_L: 0.15, L2_MS: 2 * (1000 / 60), L2_GAP: 34.5, L2_TIERS: 'fd', NUM_WORD_LIFT: 40,
  TARGET: { D: 4200, T: 4000, P: 3500 }, DONE: { D: 5300 }, DEV_MS: 1000,
  ENDS: [9, 9, 4, 4, 6, 4],
  // revision 4: P2 830 ms at D and T (E5 spaces the ends, so the window caps no longer hold S near 39; 830 keeps it there)
  BUDGET: { D: [0, 0, 830, 560, 560, 160], T: [0, 0, 830, 340, 500, 160], P: [0, 0, 560, 200, 440, 120] },
  LIMIT: { D: 4400, T: 4000, P: 3500 },
  INK: 0.40, LOC: 0.25, JUMP: 0.12,
  RAMP_MS: 300, RAMP_A: 0.18, RAMP_MIN_L: 0.4,
  P1_MIN_LEN: 1000, P1_MAX_START: 600,
  NUM_ADV: 0.35, NUM_GROW: 3, NUM_GROW_F: 0.05, NUM_DUR_P: 100, NUM_SUB_P: 2 * (1000 / 60),
  CLOSED_L: 60, CLOSED_MS: 2 * (1000 / 60), P2P_L: 50, P2P_MS: 1000 / 60, JOIN_D: 3, AREA_ENDS: 2, AREA_GAP: 18,
  // revision 5
  P2_MS: 1000 / 60, P2_LIFT: 17, P2_LIFT_D: 50, P1_POW: 0.6, P1_TURN: 0.3, P1_TURN_STEP: 6, P1_FLOOR_MS: 4 * (1000 / 60), LETTER_SCALE: 1, LETTER_SCALE_MIN: 0.7,
  // revision 7 (LINE_LIFT 50 -> 30 above)
  P2_HOP_L: 0.25, P2_HOP_MS: 90, P1_HOP_L: 0.195, P1_HOP_MS: 45,
  // fix r2
  P0_HOP_L: 0.5, P0_HOP_MS: 90, P0_POW: 0.35,
};
const HATCHY = new Set(['hatch', 'arc', 'streak']);
const GLYPH = new Set(['glyph', 'letter', 'numeral']);
const isShade = (s) => s.tier === 'h' && !HATCHY.has(s.kind);
// contiguous runs of one phase, in data order
function runs(seq) {
  const out = [];
  for (const s of seq) { const r = out[out.length - 1]; if (r && r.p === s.phase) r.ph.push(s); else out.push({ p: s.phase, ph: [s] }); }
  return out;
}
// revision 5: LETTER_SCALE (set by build.cjs, 1 unless class D runs over its target) shortens every letter alike
const letterMs = (path) => (K.LETTER_SCALE || 1) * Math.min(K.LETTER_MAX, Math.max(K.LETTER_MIN, K.LETTER_MS * Math.sqrt(path / K.LETTER_REF)));

function mulberry32(a) {
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const minfr = (l) => (l >= 0.5 ? 3 : l >= 0.25 ? 2 : l >= 0.12 ? 1 : 0);
const ss = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

// Motion table of one stroke: [x, y, arc] at tau = k / N (exact engine motion), for fast window checks.
const NT = 600;
function table(core, geo) {
  const x = new Float64Array(NT + 1), y = new Float64Array(NT + 1), s = new Float64Array(NT + 1);
  for (let k = 0; k <= NT; k++) { const p = core.ptAt(geo, core.posAt(geo, k / NT)); x[k] = p[0]; y[k] = p[1]; s[k] = p[2]; }
  return { x, y, s };
}
function samp(tb, tau) {
  if (tau <= 0) return [tb.x[0], tb.y[0], 0];
  if (tau >= 1) return [tb.x[NT], tb.y[NT], tb.s[NT]];
  const f = tau * NT, i = Math.floor(f), u = f - i;
  return [tb.x[i] + (tb.x[i + 1] - tb.x[i]) * u, tb.y[i] + (tb.y[i + 1] - tb.y[i]) * u, tb.s[i] + (tb.s[i + 1] - tb.s[i]) * u];
}
// Exact sample through the engine (used by the final check).
const exactSamp = (core) => (st, tau) => core.ptAt(st.geo, core.posAt(st.geo, Math.max(0, Math.min(1, tau))));

// Peak tip advance and largest chord from the window's first point, over every 16.67 ms window, for duration d.
function strokePeaks(tb, d) {
  let adv = 0, chord = 0;
  const step = Math.max(0.25, Math.min(1, d / 60));
  for (let w = -FR; w <= d; w += step) {
    const a = Math.max(0, w), b = Math.min(d, w + FR);
    if (b <= a) continue;
    const p0 = samp(tb, a / d), p1 = samp(tb, b / d);
    adv = Math.max(adv, p1[2] - p0[2]);
    for (let k = 1; k <= 8; k++) { const q = samp(tb, (a + ((b - a) * k) / 8) / d); chord = Math.max(chord, Math.hypot(q[0] - p0[0], q[1] - p0[1])); }
  }
  return { adv, chord };
}
// Shortest duration with peak advance <= A cw (strokes of 0.12 cw or more) and chord <= LOC cw.
function minDur(st, A) {
  const l = st.L / CW, needA = l >= 0.12 && A > 0, needC = l > K.LOC;
  if (!needA && !needC) return 0;
  const ok = (d) => { const p = strokePeaks(st.tb, d); return (!needA || p.adv <= 0.99 * A * CW) && (!needC || p.chord <= 0.97 * K.LOC * CW); };
  let lo = 1, hi = 8000;
  if (ok(lo)) return lo;
  for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (ok(m)) hi = m; else lo = m; }
  return hi;
}

// revision 5: total turning of a stroke in radians, measured on points P1_TURN_STEP src px apart along the arc (the
// flattened path's 1.5 px steps would count trace noise as turning); a corner's turn counts in full
function turning(geo) {
  const pts = [[geo.x[0], geo.y[0]]];
  let next = K.P1_TURN_STEP;
  for (let j = 1; j < geo.n; j++) if (geo.s[j] >= next || j === geo.n - 1) { pts.push([geo.x[j], geo.y[j]]); next = geo.s[j] + K.P1_TURN_STEP; }
  let t = 0;
  for (let j = 1; j < pts.length - 1; j++) {
    const ax = pts[j][0] - pts[j - 1][0], ay = pts[j][1] - pts[j - 1][1], bx = pts[j + 1][0] - pts[j][0], by = pts[j + 1][1] - pts[j][1];
    t += Math.abs(Math.atan2(ax * by - ay * bx, ax * bx + ay * by));
  }
  return t;
}
// revision 5: P1 stroke times proportional to len^P1_POW (1 + P1_TURN turning), normalised to the P1 total the
// floors-and-hand-time rule gave (tl: that phase's [gap, dur] list; gaps are kept), never under a stroke's floor
const p1Floor = (s) => Math.ceil(Math.max(s.floorA, s.L / CW < K.P1_SHORT_L ? K.P1_SHORT_MS : K.P1_FLOOR_MS, minfr(s.L / CW) * FR) - 1e-9);
// Whole ms: the total is the old rule's durations as the schedule would round them (each up), shared out by largest
// remainder, so P1 does not grow by rounding.
function p1Spread(ph, tl) {
  return spread(tl, ph.map((s) => Math.pow(s.L, K.P1_POW) * (1 + K.P1_TURN * s.turn)), ph.map(p1Floor));
}
// fix r2: the P0 lay-in's stroke times by length and the stroke's seeded jitter (same total, floors kept)
const p0Floor = (s) => Math.ceil(Math.max(K.FLOOR[0], minfr(s.L / CW) * FR, s.floorA) - 1e-9);
function p0Spread(ph, tl) {
  return spread(tl, ph.map((s) => Math.pow(s.L, K.P0_POW) * (1 + s.u1)), ph.map(p0Floor));
}
// tl's total stroke time (each duration rounded up) shared in proportion to w, never under fl; whole ms by largest remainder
function spread(tl, w, fl) {
  const tot = tl.reduce((a, x) => a + Math.ceil(x[1] - 1e-9), 0);
  const sum = (c) => w.reduce((a, x, i) => a + Math.max(fl[i], c * x), 0);
  let lo = 0, hi = 1e3;
  if (sum(0) >= tot) return tl.map(([g], i) => [g, fl[i]]);
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (sum(m) > tot) hi = m; else lo = m; }
  const v = w.map((x, i) => Math.max(fl[i], lo * x)), d = v.map(Math.floor);
  let left = tot - d.reduce((a, x) => a + x, 0);
  for (const i of v.map((x, i) => i).sort((a, b) => (v[b] - d[b]) - (v[a] - d[a]))) { if (left <= 0) break; d[i]++; left--; }
  return tl.map(([g], i) => [g, d[i]]);
}
// Prepare solver strokes: jitter by global index, floors that do not depend on S.
function prepare(core, strokes) {
  return strokes.map((s, gi) => {
    const r = mulberry32(20261107 + gi);
    const u1 = (r() * 2 - 1) * 0.10, u2 = (r() * 2 - 1) * 0.20;
    const st = { ...s, gi, u1, u2, L: s.geo.L, tb: table(core, s.geo) };
    st.p0 = [s.geo.x[0], s.geo.y[0]];
    st.p1 = [s.geo.x[s.geo.n - 1], s.geo.y[s.geo.n - 1]];
    st.floorA = minDur(st, K.A[s.phase]);
    st.floorRamp = st.L / CW >= K.RAMP_MIN_L ? minDur(st, K.RAMP_A) : 0;
    // revision 2: a SHADE edge sweeps, it never whips (peak <= 0.12 cw per frame; 6 frames from 0.3 cw, else 4)
    st.shade = isShade(s);
    st.floorShade = st.shade ? Math.max(minDur(st, K.SHADE_A), st.L / CW >= K.SHADE_LONG_L ? K.SHADE_LONG_MS : K.SHADE_MS) : 0;
    // revision 3: a long P2 form or detail line (>= 0.15 cw): >= 2 frames, its end >= 2 frames from the last one's
    st.l2 = s.phase === 2 && K.L2_TIERS.includes(s.tier) && !GLYPH.has(s.kind) && !HATCHY.has(s.kind) && st.L / CW >= K.L2_L;
    st.hand = (30 + 6.8 * Math.pow(st.L, 0.65)) * (GLYPH.has(s.kind) ? 0.8 : HATCHY.has(s.kind) ? 0.6 : 1);
    // revision 4
    const line = !HATCHY.has(s.kind) && s.tier !== 'h';
    st.closed = line && !GLYPH.has(s.kind) && st.L >= K.CLOSED_L && Math.hypot(st.p0[0] - st.p1[0], st.p0[1] - st.p1[1]) <= Math.max(3, 0.05 * st.L);
    st.p2p = s.phase === 2 && line && st.L >= K.P2P_L;
    if (s.phase === 1) st.turn = turning(s.geo);
    if (s.tier === 'n') {
      st.numSubMin = Math.min(...s.geo.sub.map((r) => r[3] - r[2]));
      st.floorNum = numFloor(st);
    }
    return st;
  });
}
// numeral motion: peak advance per 16.67 ms window (fraction of L) and the fewest frames advancing >= NUM_GROW_F of L
// over every frame phase (1 ms steps), for duration d
function numMotion(tb, L, d) {
  let adv = 0, grow = Infinity;
  for (let w = -FR; w <= d; w += 0.25) { const a = Math.max(0, w), b = Math.min(d, w + FR); if (b > a) adv = Math.max(adv, samp(tb, b / d)[2] - samp(tb, a / d)[2]); }
  for (let ph = 0; ph < FR; ph += 1) {
    let n = 0;
    for (let t = -ph; t < d; t += FR) { const a = Math.max(0, t), b = Math.min(d, t + FR); if (b > a && samp(tb, b / d)[2] - samp(tb, a / d)[2] >= K.NUM_GROW_F * L) n++; }
    grow = Math.min(grow, n);
  }
  return { adv: adv / L, grow };
}
// shortest numeral duration meeting NUM_ADV and NUM_GROW (whole ms)
function numFloor(st) {
  for (let d = 34; d < 400; d++) { const m = numMotion(st.tb, st.L, d); if (m.adv <= K.NUM_ADV - 0.005 && m.grow >= K.NUM_GROW) return d; }
  return 400;
}
// revision 4 (E3): stroke i continues stroke i - 1 (join flags end -> start and the ends within JOIN_D src px)
const continues = (a, b) => !!(a && b && a.phase === b.phase && a.flags & 2 && b.flags & 1 && !HATCHY.has(a.kind) && !HATCHY.has(b.kind) && !GLYPH.has(a.kind) && !GLYPH.has(b.kind)
  && Math.hypot(a.p1[0] - b.p0[0], a.p1[1] - b.p0[1]) <= K.JOIN_D);

// class P: 2 frames for non-hatch strokes of 0.05 cw or more, in the scope K.P_FLOOR_SCOPE: 'all' (the critic's literal
// rule: P last ink 3991 ms, over the 3500 limit) or 'named' (default: the detail phase P3, where the rear frame and the
// numerals are, and the P2 areas in K.P_FLOOR_AREAS, the driver)
const pFloor = (cls, s) => cls === 'P' && s.tier !== 'h' && s.L / CW >= K.P_FLOOR_L && (K.P_FLOOR_SCOPE === 'all' || s.phase === 3 || K.P_FLOOR_AREAS.includes(s.area));
const rampS = (S, t) => (S <= K.S_HAND ? S : K.S_HAND * Math.pow(S / K.S_HAND, ss(0, K.RAMP_MS, t)));

// Relative timeline of one phase: [[gap, dur], ...]; the first gap includes the phase pause.
// Glyph fields set by build.cjs: num (a numeral digit), word, letter (one key per letter unit; an i-dot is its own
// unit), dot, lf (first-word floor of this stroke, ms).
// revision 4 (E3): the continuation pairs are solved by iterating: each pass raises the faster stroke of a pair to the
// slower one's ms per src px (mins), until nothing changes
function phaseTimes(ph, p, S, pen, prev, first, cls) {
  const mins = new Array(ph.length).fill(0);
  let tl = phaseTimes1(ph, p, S, pen, prev, first, cls, mins);
  for (let it = 0; it < 6; it++) {
    let ch = 0;
    for (let i = 1; i < ph.length; i++) {
      if (!continues(ph[i - 1], ph[i])) continue;
      const a = tl[i - 1][1] / ph[i - 1].L, b = tl[i][1] / ph[i].L, v = Math.max(a, b);
      if (a < v - 1e-9 && mins[i - 1] < v * ph[i - 1].L - 1e-9) { mins[i - 1] = v * ph[i - 1].L; ch = 1; }
      if (b < v - 1e-9 && mins[i] < v * ph[i].L - 1e-9) { mins[i] = v * ph[i].L; ch = 1; }
    }
    if (!ch) break;
    tl = phaseTimes1(ph, p, S, pen, prev, first, cls, mins);
  }
  return tl;
}
function phaseTimes1(ph, p, S, pen, prev, first, cls, mins) {
  const out = [], areaEnds = {};
  let tEnd = 0, lastLE = -Infinity, lastL2 = -Infinity;
  for (let i = 0; i < ph.length; i++) {
    const s = ph[i], J = pen ? Math.hypot(s.p0[0] - pen[0], s.p0[1] - pen[1]) : 0;
    let gap = 0;
    if (!(first && i === 0)) {
      if (p === 0) gap = K.P0_LIFT;
      else {
        const same = prev && s.group && s.group === prev.group;
        const lift = same && HATCHY.has(s.kind) && HATCHY.has(prev.kind) ? 25 : same && GLYPH.has(s.kind) && GLYPH.has(prev.kind) ? 30 : 45 + 0.12 * J;
        const changed = !prev || s.area !== prev.area || (HATCHY.has(s.kind) && s.group !== prev.group) || J > K.JUMP * CW;
        const Sg = p === 2 && i > 0 ? rampS(S, tEnd) : S;
        gap = Math.max((lift * (1 + s.u2)) / Sg, changed ? K.BEAT[p] : p <= 1 ? 0.75 * K.BEAT[p] : 0);
      }
      if (prev && s.word && prev.word === s.word) {
        if (s.num && prev.num) gap = Math.max(gap, K.NUM_LIFT);
        if (s.dot && !prev.dot) gap = Math.max(gap, K.DOT_GAP);
      }
      // revision 3: a new number after another number's last digit (side 219 -> nose-top 219 at T)
      if (prev && s.num && prev.num && s.word !== prev.word) gap = Math.max(gap, K.NUM_WORD_LIFT);
      // revision 2: the lift before a new lettering word (70 ms at a line break)
      if (prev && s.wl && GLYPH.has(prev.kind)) gap = Math.max(gap, s.wl);
      // revision 5: a P2 pen travel of more than 50 src px takes >= 17 ms (two far strokes never ink in one frame)
      if (p === 2 && J > K.P2_LIFT_D) gap = Math.max(gap, K.P2_LIFT);
      // revision 7: E1, a P2 hop over 0.25 cw lifts >= max(17, 90 ms x hop / cw); E2, a P1 hop of 0.20 cw or more lifts
      // >= 45 ms (0.195: see the revision 7 note); inside the phase only (the phase joins keep their pauses)
      if (i > 0) gap = Math.max(gap, hopLift(p, J));
      if (i === 0) gap += K.PAUSE[p];
    }
    const start = i === 0 ? 0 : tEnd + gap;
    const Sd = p === 2 ? rampS(S, start) : S, l = s.L / CW;
    let dur = p === 0 ? Math.max(K.P0_DUR, K.FLOOR[0], minfr(l) * FR, s.floorA)
      : Math.max((s.hand * (1 + s.u1)) / Sd, p === 1 && l < K.P1_SHORT_L ? K.P1_SHORT_MS : K.FLOOR[p], minfr(l) * FR, s.floorA, p === 2 && start < K.RAMP_MS ? s.floorRamp : 0, s.floorShade || 0);
    if (s.num) dur = Math.max(dur, K.NUM_DUR, s.floorNum || 0, cls === 'P' ? Math.max(K.NUM_DUR_P, K.NUM_SUB_P / s.numSubMin + 0.5) : 0);
    if (p === 5) dur = Math.max(dur, K.ACCENT_MS);
    // revision 2: a letter stroke's time is set by its letter (writing, not type-on), independent of S
    if (s.lx != null) dur = s.lx;
    if (pFloor(cls, s)) dur = Math.max(dur, K.P_FLOOR_MS);
    // revision 4: closed loops (E1), class P P2 strokes of 50 src px (E2), continuation pairs (E3)
    if (s.closed) dur = Math.max(dur, K.CLOSED_MS);
    if (cls === 'P' && s.p2p) dur = Math.max(dur, K.P2P_MS);
    // revision 5: every P2 stroke >= 1 frame at every class
    if (p === 2) dur = Math.max(dur, K.P2_MS);
    dur = Math.max(dur, mins[i]);
    // revision 4 (E5): in P2 at most AREA_ENDS ends in one area per frame window
    if (p === 2 && !GLYPH.has(s.kind)) {
      const h = (areaEnds[s.area] = areaEnds[s.area] || []);
      if (h.length >= K.AREA_ENDS) dur = Math.max(dur, h[h.length - K.AREA_ENDS] + K.AREA_GAP - start);
    }
    if (s.l2) {
      dur = Math.max(dur, K.L2_MS, lastL2 + K.L2_GAP - start);
      lastL2 = start + dur;
    }
    // one letter ends per frame: the last stroke of a letter unit ends >= LE_GAP after the previous unit's end
    if (s.letter && !(ph[i + 1] && ph[i + 1].letter === s.letter)) {
      dur = Math.max(dur, lastLE + K.LE_GAP - start);
      lastLE = start + dur;
    }
    out.push([gap, dur]);
    if (p === 2 && !GLYPH.has(s.kind)) areaEnds[s.area].push(start + dur);
    tEnd = start + dur;
    pen = s.p1;
    prev = s;
  }
  return out;
}
// revision 7: the lift a hop of J src px needs inside phase p (0 when no revision 7 rule applies); whole ms, the P2
// rule rounded up (the schedule's whole-ms step floors a gap, so 25.7 ms would have become 25)
function hopLift(p, J) {
  if (p === 2 && J > K.P2_HOP_L * CW) return Math.max(K.P2_LIFT, Math.ceil((K.P2_HOP_MS * J) / CW - 1e-9));
  if (p === 1 && J >= K.P1_HOP_L * CW) return K.P1_HOP_MS;
  // fix r2: a P0 hop over 0.5 cw (rounded up, as P2)
  if (p === 0 && J > K.P0_HOP_L * CW) return Math.max(K.P0_LIFT, Math.ceil((K.P0_HOP_MS * J) / CW - 1e-9));
  return 0;
}
const phaseLen = (tl) => tl.reduce((a, [g, d]) => a + g + d, 0) - tl[0][0];

// Sliding 16.67 ms windows over strokes with absolute start/end: ends per window, ink (cw), locality (cw, from the
// window's first inked point). `sample(st, tau)` gives [x, y, arc]. Returns worst values and counts over limits.
// m: margins used while solving (a longer window for the end count, lower ink and locality limits) so that the
// rounding to whole ms cannot tip the exact check.
function windows(sts, sample, step, capOf, m = { win: 0, ink: 0, loc: 0 }) {
  let j0 = 0, worstEnds = 0, worstInk = 0, worstLoc = 0, overEnds = 0, overInk = 0, overLoc = 0, n = 0, maxActive = 0;
  const locAt = [], badAt = [];
  if (!sts.length) return { worstEnds, worstInk, worstLoc, overEnds, overInk, overLoc, n, maxActive, locAt, badAt };
  const t0 = sts[0].start - FR - m.win, t1 = sts[sts.length - 1].end;
  for (let w = t0; w <= t1; w += step) {
    const e = w + FR, eE = e + m.win;
    while (j0 < sts.length && sts[j0].end <= w) j0++;
    let ink = 0, ends = 0, first = null, loc = 0, act = 0;
    for (let j = j0; j < sts.length && sts[j].start < eE; j++) {
      const st = sts[j];
      if (st.end > w && st.end <= eE) ends++;
      if (st.start >= e) continue;
      const a = Math.max(w, st.start), b = Math.min(e, st.end);
      if (b <= a) continue;
      act++;
      const d = st.end - st.start, k = 8;
      const pa = sample(st, (a - st.start) / d), pb = sample(st, (b - st.start) / d);
      if (pb[2] - pa[2] <= 1e-9) continue;
      ink += (pb[2] - pa[2]) / CW;
      if (!first) first = pa;
      for (let q = 0; q <= k; q++) {
        const pt = q === 0 ? pa : q === k ? pb : sample(st, (a + ((b - a) * q) / k - st.start) / d);
        loc = Math.max(loc, Math.hypot(pt[0] - first[0], pt[1] - first[1]) / CW);
      }
    }
    if (!act) continue;
    n++;
    maxActive = Math.max(maxActive, act);
    const cap = capOf(w);
    const bad = [ends > cap, ink > K.INK - m.ink + 1e-9, loc > K.LOC - m.loc + 1e-9];
    if (bad[0]) overEnds++;
    if (bad[1]) overInk++;
    if (bad[2]) { overLoc++; if (locAt.length < 20) locAt.push(Math.round(w)); }
    if ((bad[0] || bad[1] || bad[2]) && badAt.length < 20) badAt.push(Math.round(w));
    worstEnds = Math.max(worstEnds, ends); worstInk = Math.max(worstInk, ink); worstLoc = Math.max(worstLoc, loc);
  }
  return { worstEnds, worstInk, worstLoc, overEnds, overInk, overLoc, n, maxActive, locAt, badAt };
}
function absolute(ph, tl, t) {
  return ph.map((s, i) => { t += tl[i][0]; const o = { st: s, tb: s.tb, geo: s.geo, start: t, end: t + tl[i][1] }; t += tl[i][1]; return o; });
}
const tableSamp = (o, tau) => samp(o.tb, tau);
function capsOk(ph, tl, p) {
  const sts = absolute(ph, tl, 0);
  const r = windows(sts, tableSamp, 1, () => K.ENDS[p], { win: 2, ink: 0.01, loc: 0.005 });
  return r.overEnds === 0 && r.overInk === 0 && r.overLoc === 0;
}

// Solve one class: seq = the class's strokes in data order (prepared). scale[p] slows a phase after a failed check.
function solveClass(seq, cls, scale = {}) {
  const sched = [], info = {};
  let pen = null, prev = null, first = true;
  // revision 2: runs of one phase in data order (the build draws P4 and P5 before P3)
  for (const { p, ph } of runs(seq)) {
    let S;
    if (p <= 1) S = K.S_HAND;
    else {
      const f = (S) => phaseTimes(ph, p, S, pen, prev, first, cls);
      const budget = K.BUDGET[cls][p];
      let lo = 0.3, hi = 400, Sb;
      if (phaseLen(f(hi)) > budget) Sb = hi;
      else { for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; if (phaseLen(f(m)) <= budget) hi = m; else lo = m; } Sb = hi; }
      lo = 0.3; hi = 400;
      let Sc = lo;
      if (capsOk(ph, f(hi), p)) Sc = hi;
      else if (capsOk(ph, f(lo), p)) { for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (capsOk(ph, f(m), p)) lo = m; else hi = m; } Sc = lo; }
      // the time-lapse never runs slower than S_MIN (a phase with few strokes is not stretched to fill its budget)
      S = Math.min(Sc, Math.max(Sb, K.S_MIN)) * (scale[p] || 1);
      info[p] = { Sbudget: +Sb.toFixed(2), Scap: +Sc.toFixed(2) };
    }
    let tl = phaseTimes(ph, p, S, pen, prev, first, cls);
    // revision 5: P1 without a metronome (same total stroke time); fix r2: P0 by length (same total)
    if (p === 1) tl = p1Spread(ph, tl);
    if (p === 0) tl = p0Spread(ph, tl);
    info[p] = { ...(info[p] || {}), n: ph.length, S: +S.toFixed(2), len: Math.round(phaseLen(tl)) };
    sched.push(...tl);
    pen = ph[ph.length - 1].p1;
    prev = ph[ph.length - 1];
    first = false;
  }
  // whole ms, ends rounded up, one pen: start[i] >= end[i-1] survives rounding
  const out = [];
  let t = 0, prevEnd = 0;
  for (const [g, d] of sched) {
    const st = t + g, en = st + d;
    t = en;
    // a gap never loses a whole ms to rounding (a 17 ms beat stays >= 17), a duration never shrinks
    const sr = Math.max(prevEnd + Math.floor(g + 1e-6), Math.round(st)), er = Math.max(sr + 1, Math.ceil(en), sr + Math.ceil(d - 1e-9));
    out.push([sr - prevEnd, er - sr]);
    prevEnd = er;
  }
  return { sched: out, info };
}

// Exact checks of one class schedule (PEN_SPEC 5.5 and 16.1 #1, #4, #5) with the engine's motion.
function checkClass(core, seq, sched, cls) {
  const sample = exactSamp(core);
  let t = 0;
  const sts = seq.map((s, i) => { t += sched[i][0]; const o = { st: s, geo: s.geo, start: t, end: t + sched[i][1], phase: s.phase }; t += sched[i][1]; return o; });
  const lastInk = sts.length ? sts[sts.length - 1].end : 0;
  const p1 = sts.filter((o) => o.phase === 1);
  const res = { cls, n: sts.length, lastInk, limit: K.LIMIT[cls], p1Start: p1.length ? p1[0].start : null, p1Len: p1.length ? p1[p1.length - 1].end - p1[0].start : 0 };
  res.sequential = sts.every((o, i) => i === 0 || o.start >= sts[i - 1].end);
  // revision 2: phases in the order K.PHASE_RANK (P0 P1 P2 P4 P5 P3), each phase one contiguous run
  res.phaseOrder = sts.every((o, i) => i === 0 || K.PHASE_RANK[o.phase] >= K.PHASE_RANK[sts[i - 1].phase]);
  res.phaseSequence = runs(sts).map((r) => r.p);
  // revision 3: the gap at each phase change (pause + beat + lift), ms
  res.phaseJoins = [];
  for (let i = 1; i < sts.length; i++) if (sts[i].phase !== sts[i - 1].phase) res.phaseJoins.push([sts[i - 1].phase, sts[i].phase, sts[i].start - sts[i - 1].end]);
  res.phases = {};
  for (let p = 0; p < 6; p++) { const q = sts.filter((o) => o.phase === p); if (q.length) res.phases[p] = [q[0].start, q[q.length - 1].end, q.length]; }
  // 16.1 #4: long lines seen growing; floors; exact peak advance per frame
  const viol = [], peaks = {};
  const hist = { lt1: 0, '1-3': 0, ge3: 0 };
  for (const o of sts) {
    const l = o.st.L / CW, d = o.end - o.start, fr = d / FR, p = o.phase, need = minfr(l);
    hist[fr < 1 ? 'lt1' : fr < 3 ? '1-3' : 'ge3']++;
    if (fr + 1e-9 < need) viol.push(`${o.st.id}: ${l.toFixed(3)} cw over ${fr.toFixed(2)} frames < ${need}`);
    if (p === 0 && d < 50) viol.push(`${o.st.id}: P0 ${d} ms < 3 frames`);
    { const f1 = l < K.P1_SHORT_L ? K.P1_SHORT_MS : K.P1_FLOOR_MS; if (p === 1 && d < f1 - 1e-9) viol.push(`${o.st.id}: P1 ${d} ms < ${(f1 / FR).toFixed(0)} frames`); }
    if (o.st.shade && d < (l >= K.SHADE_LONG_L ? K.SHADE_LONG_MS : K.SHADE_MS) - 1e-9) viol.push(`${o.st.id}: shade ${d} ms < ${l >= K.SHADE_LONG_L ? 6 : 4} frames`);
    if (p === 5 && d < K.ACCENT_MS - 1e-9) viol.push(`${o.st.id}: accent ${d} ms < 4 frames`);
    if (l >= 0.12 || o.st.shade) {
      const pk = strokePeaks(o.st.tb, d);
      const adv = pk.adv / CW;
      peaks[p] = Math.max(peaks[p] || 0, adv);
      if (adv > K.A[p] + 1e-6) viol.push(`${o.st.id}: P${p} peak ${adv.toFixed(3)} cw/frame > ${K.A[p]}`);
      if (o.st.shade && adv > K.SHADE_A + 1e-6) viol.push(`${o.st.id}: shade peak ${adv.toFixed(3)} cw/frame > ${K.SHADE_A}`);
      const p2 = res.phases[2];
      if (p === 2 && l >= K.RAMP_MIN_L && p2 && o.start - p2[0] < K.RAMP_MS && adv > K.RAMP_A + 1e-6) viol.push(`${o.st.id}: ramp peak ${adv.toFixed(3)} > ${K.RAMP_A}`);
    }
  }
  // revision 1: numerals, lettering, i-dots, class P floor, P0 length
  {
    const g = { numerals: [], letterUnits: 0, minLetterEndGapMs: null, maxLetterEndsPerFrame: 0, words: {}, dots: [], pFloorMinMs: null };
    const units = [];
    sts.forEach((o, i) => {
      const s = o.st, nx = sts[i + 1];
      if (s.num) {
        g.numerals.push([s.id, o.end - o.start]);
        if (o.end - o.start < 4 * FR - 1e-9) viol.push(`${s.id}: numeral ${o.end - o.start} ms < 4 frames`);
        const pv = sts[i - 1];
        if (pv && pv.st.num && pv.st.word === s.word && o.start - pv.end < K.NUM_LIFT) viol.push(`${s.id}: lift ${o.start - pv.end} ms after the previous digit < ${K.NUM_LIFT}`);
      }
      if (s.letter && !(nx && nx.st.letter === s.letter)) units.push(o);
      if (s.word && !s.num) {
        const w = (g.words[s.word] = g.words[s.word] || { start: o.start, end: o.end, letters: {} });
        w.end = o.end;
        if (!s.dot) { const L = (w.letters[s.letter] = w.letters[s.letter] || [o.start, o.end]); L[1] = o.end; }
      }
      if (s.dot) {
        const pv = sts[i - 1], gap = pv ? o.start - pv.end : null;
        g.dots.push([s.id, gap]);
        if (pv && pv.st.word === s.word && !pv.st.dot && gap < K.DOT_GAP) viol.push(`${s.id}: i-dot ${gap} ms after its word < ${K.DOT_GAP}`);
      }
      if (pFloor(cls, s)) {
        const d = o.end - o.start;
        g.pFloorMinMs = g.pFloorMinMs == null ? d : Math.min(g.pFloorMinMs, d);
        if (d < K.P_FLOOR_MS - 1e-9) viol.push(`${s.id}: P ${d} ms < 2 frames (non-hatch >= 0.05 cw)`);
      }
    });
    g.letterUnits = units.length;
    for (let i = 1; i < units.length; i++) {
      const d = units[i].end - units[i - 1].end;
      g.minLetterEndGapMs = g.minLetterEndGapMs == null ? d : Math.min(g.minLetterEndGapMs, d);
      if (d < FR - 1e-9) viol.push(`${units[i].st.id}: letter ends ${d} ms after the previous letter (< 1 frame)`);
    }
    for (let w = (units[0] ? units[0].end - FR : 0); units.length && w <= units[units.length - 1].end; w += 1) {
      let n = 0;
      for (const u of units) if (u.end > w && u.end <= w + FR) n++;
      g.maxLetterEndsPerFrame = Math.max(g.maxLetterEndsPerFrame, n);
    }
    // revision 2 lettering: each letter's ink time = clamp(34 sqrt(path / 25), 25, 50) ms shared by length, a glyph
    // stroke of 15 src px or more >= 1 frame; 40 ms between words, 70 at the line break
    const LU = {};
    sts.forEach((o) => {
      const s = o.st;
      if (!s.letter || s.num) return;
      const u = (LU[s.letter] = LU[s.letter] || { path: 0, ink: 0, n: 0, word: s.word, strokes: [] });
      u.path += s.L; u.ink += o.end - o.start; u.n++; u.strokes.push([s.L, o.end - o.start]);
      if (s.L >= K.GLYPH_FRAME_L && o.end - o.start < FR - 1e-9) viol.push(`${s.id}: glyph stroke ${s.L.toFixed(0)} src px in ${o.end - o.start} ms < 1 frame`);
    });
    g.letters = [];
    for (const [k, u] of Object.entries(LU)) {
      const want = letterMs(u.path), floor = u.strokes.reduce((a, [L]) => a + (L >= K.GLYPH_FRAME_L ? Math.max(FR, (want * L) / u.path) : (want * L) / u.path), 0);
      g.letters.push([k, +u.path.toFixed(1), +want.toFixed(1), u.ink]);
      if (u.ink < floor - 1e-6 || u.ink > floor + u.n + 1e-6) viol.push(`${k}: letter ${u.ink} ms, the rule gives ${floor.toFixed(1)}`);
    }
    g.wordLifts = [];
    const wl = Object.entries(g.words);
    for (let i = 1; i < wl.length; i++) {
      const [, a] = wl[i - 1], [k, b] = wl[i], o = sts.find((x) => x.st.word === k && !x.st.num);
      const lift = b.start - a.end, need = o && o.st.wl ? o.st.wl : 0;
      g.wordLifts.push([k, lift, need]);
      if (need && lift < need) viol.push(`${k}: word lift ${lift} ms < ${need}`);
    }
    const lw = Object.values(g.words);
    if (lw.length) g.letteringMs = [lw[0].start, lw[lw.length - 1].end, lw[lw.length - 1].end - lw[0].start];
    for (const w of Object.values(g.words)) delete w.letters;
    res.glyphs = g;
    // revision 2: the payoff is the last ink (lettering at D, the side 219 at T and P)
    // revision 3: the develop starts DEV_GAP = 100 ms after last ink: the finished drawing is seen whole, so no ink of
    // any kind ends after the develop start
    const devStart = lastInk + K.DEV_GAP, lastSt = sts[sts.length - 1];
    res.devStart = devStart;
    res.photoInMs = devStart + K.DEV_MS;
    res.target = { lastInk: K.TARGET[cls], photoIn: K.DONE[cls] || null, ok: lastInk <= K.TARGET[cls] && (!K.DONE[cls] || res.photoInMs <= K.DONE[cls]) };
    res.lastStroke = lastSt ? lastSt.st.id : null;
    res.payoffLast = !!(lastSt && GLYPH.has(lastSt.st.kind));
    res.inkAfterDevStart = sts.filter((o) => o.end > devStart).map((o) => o.st.id);
    res.otherInkAfterDevStart = res.inkAfterDevStart;
    if (!res.payoffLast) viol.push(`last ink is ${res.lastStroke}, not the lettering or the numerals`);
    if (res.inkAfterDevStart.length) viol.push(`ink after the develop start: ${res.inkAfterDevStart.join(',')}`);
    // revision 3: long P2 form/detail lines >= 2 frames, no two of them ending within 2 frames
    const l2 = sts.filter((o) => o.st.l2);
    res.p2Long = { n: l2.length, minMs: l2.length ? Math.min(...l2.map((o) => o.end - o.start)) : null, minEndGapMs: null, strokes: l2.map((o) => [o.st.id, Math.round(o.st.L), o.start, o.end - o.start]) };
    for (let i = 0; i < l2.length; i++) {
      const o = l2[i], d = o.end - o.start;
      if (d < K.L2_MS - 1e-9) viol.push(`${o.st.id}: P2 ${Math.round(o.st.L)} src px in ${d} ms < 2 frames`);
      if (i) {
        const g = o.end - l2[i - 1].end;
        res.p2Long.minEndGapMs = res.p2Long.minEndGapMs == null ? g : Math.min(res.p2Long.minEndGapMs, g);
        if (g <= 2 * FR + 1e-9) viol.push(`${o.st.id}: ends ${g} ms after ${l2[i - 1].st.id} (two long P2 lines in one 33 ms window)`);
      }
    }
    // revision 3: every numeral after a numeral waits >= NUM_LIFT (digits of one number) or NUM_WORD_LIFT (a new number)
    sts.forEach((o, i) => {
      const pv = sts[i - 1];
      if (!i || !o.st.num || !pv.st.num) return;
      const need = pv.st.word === o.st.word ? K.NUM_LIFT : K.NUM_WORD_LIFT;
      if (o.start - pv.end < need) viol.push(`${o.st.id}: ${o.start - pv.end} ms after the previous numeral < ${need}`);
    });
    const p0 = res.phases[0];
    if (p0) res.p0Ms = p0[1] - p0[0];
    // revision 4 checks (exact engine motion through a fresh table of each stroke)
    const r4 = (res.rev4 = { numerals: [], closed: [], p2p: [], joins: [], areaEndsMax: 0, areaEndsAt: [] });
    for (const o of sts) {
      const s = o.st, d = o.end - o.start;
      if (s.tier === 'n') {
        const m = numMotion(s.tb, s.L, d), subs = s.geo.sub.map((r) => +((r[3] - r[2]) * d).toFixed(1));
        r4.numerals.push([s.id, d, +m.adv.toFixed(3), m.grow, subs]);
        if (m.adv > K.NUM_ADV + 1e-9) viol.push(`${s.id}: numeral peak ${(100 * m.adv).toFixed(1)} % of its length per frame > ${100 * K.NUM_ADV} %`);
        if (m.grow < K.NUM_GROW) viol.push(`${s.id}: numeral grows over ${m.grow} frames < ${K.NUM_GROW}`);
        if (cls === 'P' && d < K.NUM_DUR_P) viol.push(`${s.id}: P numeral ${d} ms < ${K.NUM_DUR_P}`);
        if (cls === 'P' && subs.some((x) => x < K.NUM_SUB_P - 1e-9)) viol.push(`${s.id}: P numeral submovement ${Math.min(...subs)} ms < 2 frames`);
      }
      if (s.closed) { r4.closed.push([s.id, Math.round(s.L), d]); if (d < K.CLOSED_MS - 1e-9) viol.push(`${s.id}: closed loop ${Math.round(s.L)} src px in ${d} ms < 2 frames`); }
      if (cls === 'P' && s.p2p) { r4.p2p.push([s.id, Math.round(s.L), d]); if (d < K.P2P_MS - 1e-9) viol.push(`${s.id}: P P2 ${Math.round(s.L)} src px in ${d} ms < 1 frame`); }
    }
    sts.forEach((o, i) => {
      if (!i || !continues(sts[i - 1].st, o.st)) return;
      const a = sts[i - 1], va = (a.end - a.start) / a.st.L, vb = (o.end - o.start) / o.st.L;
      r4.joins.push([a.st.id, o.st.id, a.end - a.start, o.end - o.start, +(va / vb).toFixed(3)]);
      // whole-ms rounding: the faster one is at most 1 ms short of the slower one's ms per src px
      if (Math.abs(va - vb) * Math.min(a.st.L, o.st.L) > 1 + 1e-9) viol.push(`${o.st.id}: tip speed changes across the join with ${a.st.id} (${(a.end - a.start)} ms / ${Math.round(a.st.L)} px vs ${o.end - o.start} ms / ${Math.round(o.st.L)} px)`);
    });
    // E5: ends per area per 16.67 ms window in P2
    const p2e = sts.filter((o) => o.phase === 2 && !GLYPH.has(o.st.kind));
    const byArea = {};
    for (const o of p2e) (byArea[o.st.area] = byArea[o.st.area] || []).push(o.end);
    for (const [ar, ends] of Object.entries(byArea)) for (let i = 0; i < ends.length; i++) {
      let n = 0;
      for (let j = i; j < ends.length && ends[j] < ends[i] + FR - 1e-9; j++) n++;
      if (n > r4.areaEndsMax) r4.areaEndsMax = n;
      if (n > K.AREA_ENDS) { viol.push(`${ar}: ${n} ends in one frame from ${ends[i]} ms`); if (r4.areaEndsAt.length < 10) r4.areaEndsAt.push([ar, ends[i], n]); }
    }
  }
  // revision 5: P2 >= 1 frame at every class; a P2 pen travel over 50 src px lifts >= 17 ms; P1 durations by length
  // and turning (reported: [id, src px, turning rad, ms]); P2 tip speeds (src px / ms) for the record
  {
    const r5 = (res.rev5 = { p2MinMs: null, p2Under1Frame: 0, lifts: [], p1: [], p2Speed: null });
    const p2 = sts.filter((o) => o.phase === 2);
    for (let i = 0; i < p2.length; i++) {
      const o = p2[i], d = o.end - o.start;
      r5.p2MinMs = r5.p2MinMs == null ? d : Math.min(r5.p2MinMs, d);
      if (d < K.P2_MS - 1e-9) { r5.p2Under1Frame++; viol.push(`${o.st.id}: P2 ${d} ms < 1 frame`); }
    }
    sts.forEach((o, i) => {
      const pv = sts[i - 1];
      if (!i || o.phase !== 2) return;
      const J = Math.hypot(o.st.p0[0] - pv.st.p1[0], o.st.p0[1] - pv.st.p1[1]), g = o.start - pv.end;
      if (J > K.P2_LIFT_D) { r5.lifts.push([pv.st.id, o.st.id, Math.round(J), g]); if (g < K.P2_LIFT) viol.push(`${o.st.id}: P2 lift ${g} ms over ${Math.round(J)} src px < ${K.P2_LIFT}`); }
    });
    // revision 7: E1 (P2 hops over 0.25 cw) and E2 (P1 hops of 0.20 cw or more), inside the phase
    const r7 = (res.rev7 = { hops: [] });
    sts.forEach((o, i) => {
      const pv = sts[i - 1];
      if (!i || pv.phase !== o.phase || (o.phase !== 1 && o.phase !== 2)) return;
      const J = Math.hypot(o.st.p0[0] - pv.st.p1[0], o.st.p0[1] - pv.st.p1[1]), need = hopLift(o.phase, J), g = o.start - pv.end;
      if (!need) return;
      r7.hops.push([o.phase, pv.st.id, o.st.id, +(J / CW).toFixed(3), g, Math.floor(need + 1e-6)]);
      if (g < Math.floor(need + 1e-6)) viol.push(`${o.st.id}: P${o.phase} lift ${g} ms over ${(J / CW).toFixed(3)} cw < ${Math.floor(need + 1e-6)}`);
    });
    // fix r2: P0 durations ([id, src px, ms, floor ms]) and P0 lifts ([from, to, hop cw, lift ms, needed ms])
    const f2 = (res.fixR2 = { p0: [], p0Lifts: [] });
    sts.forEach((o, i) => {
      if (o.phase !== 0) return;
      const d = o.end - o.start, fl = p0Floor(o.st);
      f2.p0.push([o.st.id, Math.round(o.st.L), d, fl]);
      if (d < fl) viol.push(`${o.st.id}: P0 ${d} ms < its floor ${fl}`);
      const pv = sts[i - 1];
      if (!i || pv.phase !== 0) return;
      const J = Math.hypot(o.st.p0[0] - pv.st.p1[0], o.st.p0[1] - pv.st.p1[1]), need = Math.max(K.P0_LIFT, hopLift(0, J)), g = o.start - pv.end;
      f2.p0Lifts.push([pv.st.id, o.st.id, +(J / CW).toFixed(3), g, need]);
      if (g < need) viol.push(`${o.st.id}: P0 lift ${g} ms over ${(J / CW).toFixed(3)} cw < ${need}`);
    });
    r5.p1 = sts.filter((o) => o.phase === 1).map((o) => [o.st.id, Math.round(o.st.L), +(o.st.turn || 0).toFixed(2), o.end - o.start, p1Floor(o.st)]);
    const sp = p2.filter((o) => !HATCHY.has(o.st.kind)).map((o) => o.st.L / (o.end - o.start)).sort((a, b) => a - b);
    if (sp.length) r5.p2Speed = { min: +sp[0].toFixed(2), median: +sp[sp.length >> 1].toFixed(2), max: +sp[sp.length - 1].toFixed(2) };
  }
  res.frameViolations = viol;
  res.peakAdvanceCw = Object.fromEntries(Object.entries(peaks).map(([k, v]) => [k, +v.toFixed(3)]));
  res.framesHist = hist;
  // 16.1 #5: windows on the global clock, 1 ms step, exact motion
  // the phase whose run started last before the window's end (phases run in the order K.PHASE_RANK)
  const phaseAt = (w) => { let b = 0, t = -Infinity; for (const [p, r] of Object.entries(res.phases)) if (w + FR > r[0] && r[0] > t) { t = r[0]; b = +p; } return b; };
  const win = windows(sts, (o, tau) => sample(o, tau), 1, (w) => K.ENDS[phaseAt(w)]);
  res.windows = { count: win.n, worstEnds: win.worstEnds, worstInkCw: +win.worstInk.toFixed(3), worstLocalityCw: +win.worstLoc.toFixed(3),
    overEndCap: win.overEnds, overInk040: win.overInk, localityOver025: win.overLoc, localityAt: win.locAt, violationAt: win.badAt, maxStrokesTouched: win.maxActive };
  // at most one partial stroke at any frame end (structural)
  let multi = 0;
  for (let k = 0; k * FR <= lastInk + FR; k++) { const tt = k * FR; let c = 0; for (const o of sts) if (o.start < tt && o.end > tt) c++; if (c > 1) multi++; }
  res.framesWithMoreThanOnePartial = multi;
  // pace across the silhouette -> form boundary: ink rate cw/s
  const rate = (a, b) => { let ink = 0; for (const o of sts) { const x = Math.max(a, o.start), y = Math.min(b, o.end); if (y > x) ink += (sample(o, (y - o.start) / (o.end - o.start))[2] - sample(o, (x - o.start) / (o.end - o.start))[2]) / CW; } return +(ink / ((b - a) / 1000)).toFixed(2); };
  if (res.phases[1] && res.phases[2]) {
    const e1 = res.phases[1][1], s2 = res.phases[2][0];
    res.pace = { p1Last300: rate(e1 - 300, e1), p2First100: rate(s2, s2 + 100), p2First300: rate(s2, s2 + 300), p2Next300: rate(s2 + 300, s2 + 600), p2All: rate(s2, res.phases[2][1]) };
  }
  res.limitsOk = res.sequential && res.phaseOrder && lastInk <= K.LIMIT[cls] && (!p1.length || (res.p1Len >= K.P1_MIN_LEN && res.p1Start <= K.P1_MAX_START))
    && !viol.length && !win.overEnds && !win.overInk && !win.overLoc && !multi;
  return res;
}

module.exports = { hopLift, K, FR, CW, mulberry32, prepare, solveClass, checkClass, phaseTimes, strokePeaks, minDur, windows, table, samp, runs, letterMs, isShade, HATCHY, GLYPH, numMotion, continues, p1Spread, p0Spread, p0Floor, spread, turning };
