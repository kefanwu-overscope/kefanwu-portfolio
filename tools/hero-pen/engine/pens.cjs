// Three-lane schedule solver and build checks for the drafting hero (merge build, 2026-11-21). Started from the v3
// production solver (prod/build: two pens, DRAFTING_SPEC limits). Changes, all agent decisions:
//  - the owner's 2026-11-21 instruction (draw the denser set; every line on a real edge) wins over the v3 caps: no car
//    stroke may be cut for pacing; only conventions can be cut, and never below their floors;
//  - three lanes (pilot-sheet v8 drew over three as well): pen A inks the car (c y n f d), pen B lays out and dimensions
//    (p k m r), pen C letters the white livery text at D ("Olin College of Engineering", tier l, and the nose-top 219,
//    tier u) on the PENCIL canvas. Within a lane one stroke at a time; a stroke starts only after the lane's previous one
//    ended;
//  - the photo's white letters read from about density 0.09 (work/letter/sim-*.png): the lettering is written early and
//    the PENCIL canvas at D leaves before the photo reaches density 0.085, so the ink letters hand over to the photo's
//    own letters instead of doubling them;
//  - the 2-ends-per-frame cap and the 0.35 density cap for pen A are replaced by: at most one stroke end per frame for
//    each line lane, two for the lettering lane, four in total; ink and drafting each hold at full strength for at least
//    INK_HOLD / DRAFT_HOLD ms after their lane's last stroke before their layer starts to leave.
// The motion and the develop are the engine's own (engine.js core: posAt, ptAt, dens, lop), so the checks see what the
// page draws.
// Fix round 1 (2026-11-21, agent decisions after two critics; none of it is the owner's):
//  - eye-1: at D the lettering and the nose-top 219 were erased (0.86-1.08 s) before the car ink was complete (1.61 s), so
//    they never stood with the finished car. Now the whole car (lines and glyphs) is complete before the PENCIL layer
//    starts to leave, and stands with the lettering for at least COEXIST_HOLD ms (a build failure otherwise). To get there:
//    pen B, idle between the wheel lay-in and the dimensions, inks the wheels it has just laid in (block 'wheels': the rim
//    arcs and tread edges); pen C, after its numerals, inks the cockpit and lamp details (block 'cabin'); pen A starts
//    right after the nose gesture (B now draws the gesture first, then the datum). At D the develop holds a faint ghost
//    longer and its main rise starts later (V[11], V[12]: main start and linear share; engine dens), so the PENCIL layer
//    (construction, chain lines, lettering) leaves while the photo is still under LETTER_GONE_DENS.
//  - the side numerals (tier n) are drawn at width 1.0 (engine TIER), as the eye critic suggested against the doubling.
// Dense pass 3, final solver (2026-11-22, agent work on the main loop's design; none of it is the owner's): detail lanes
//    X Y (Z) beside pens A-C (DETAIL_LANES, DK, solveDetail), the A-C plan's fit search (solveFit: one scale on the block
//    windows, the least pull-in that passes), and the checks over every lane (checkClass). With no detail strokes and
//    s = 1 the solver gives exactly the merge fix1 schedules.
'use strict';

const FR = 1000 / 60, CW = 827;
// develop and exits (the V line): start 300, length 2200 (pen ms from the first mark); exit windows in develop progress
// x 1000 for PENCIL, DRAFT and INK; gamma, ghost share, ghost end; main start and linear share (fix round 1; 0 0 = the
// merge curve). T and P keep the merge curve (gamma 3.0, ghost 0.06 by 0.40: 0.027 at 700 ms, 0.085 at 1105, steepest
// 0.102 per 100 ms). D (fix round 1): ghost 0.05 by 0.47, then a main rise from 0.47 (1334 ms) that is half linear, half
// smoothstep, gamma 1: the photo stays a faint ghost while the sheet is drawn and rises evenly from 1.33 s.
const DEV = [300, 2200], CURVE = [3.0, 0.06, 0.4, 0, 0], CURVE_D = [1.0, 0.05, 0.47, 0.47, 0.5];
const EXIT = { pencilD: [465, 502], pencil: [477, 614], draft: [740, 930], ink: [645, 845], draftD: [745, 930], inkD: [700, 840] };   // draftD ends at 0.93: the lines are not all gone before density 0.90 (late path too)
const V = {
  D: [...DEV, ...EXIT.pencilD, ...EXIT.draftD, ...EXIT.inkD, ...CURVE_D],
  T: [...DEV, ...EXIT.pencil, ...EXIT.draft, ...EXIT.ink, ...CURVE],
  P: [...DEV, ...EXIT.pencil, ...EXIT.draft, ...EXIT.ink, ...CURVE],
};
const LIMIT = { D: 1850, T: 1800, P: 1750 };           // last ink (pen ms)
const K = {
  FIRST_INK: 300, SIL_MIN: 50.01, LAST_DENS_MAX: 0.55, PENCIL_ZERO_DENS: 0.4, LAYERS_ZERO: 2450, PHOTO_IN: 2500, DONE: 2550,
  STEP_PER_100: 0.11, ENDS_PER_WINDOW: 3, ENDS_C_OTHER: 3, NUDGE_MAX: 16, ENDS_PER_PEN: { A: 1, B: 1, C: 2 }, ADV_CAR: 0.25, ADV_DRAFT: 0.35, INK_AT_06: 0.6, INK_AT_08: 0.1, DRAFT_AT_09: 0.25,   // fix round 1: ends per window 4 -> 3, pen C waits up to NUDGE_MAX ms
  // holds at full strength before a layer leaves (ms after the lane's last stroke)
  INK_HOLD: 100, DRAFT_HOLD: 100, LETTER_HOLD: 30,
  // the lettering layer (PENCIL at D) is at 0 by this photo density (the photo's white letters read from about 0.09)
  LETTER_GONE_DENS: 0.09,
  // fix round 1 (eye-1): where the lettering is on PENCIL (D), the whole car is complete at least this long before PENCIL
  // starts to leave, so the lettering, the nose-top 219 and the finished car stand together
  COEXIST_HOLD: 100,
  // glyph pacing: a letter stroke lasts clamp(LETTER_MIN, LETTER_MAX, LETTER_BASE + LETTER_PER_PX x length) ms; lifts
  // between strokes of a letter or word, between words, at the line break; numerals per class lane
  LETTER_MIN: 7, LETTER_MAX: 14, LETTER_BASE: 2, LETTER_PER_PX: 0.3, LETTER_LIFT: 2, WORD_LIFT: 18, LINE_LIFT: 26,
  NUM_MS: 45, TOP_NUM_MS: 36, DIGIT_LIFT: 5, NUMBER_LIFT: 30,
  LIFT: { A: [1, 12, 20], B: [2, 16, 25], C: [2, 16, 25] },          // [min, max, ms per car width of pen travel]
  BLOCK_NUMBER_LIFT: 17,                             // the lift into a numeral block from the lane's previous stroke
};
// ---------------------------------------------------------------- detail lanes (dense3 final solver, 2026-11-22)
// The main loop's design, with this step's agent choices (none of it is the owner's): the detail layer (the strokes that
// carry clean metadata, plus pass 2's extras over fix1) runs on its own lanes X and Y (Z only if a class cannot meet its
// gates with two) beside pens A-C, which keep every rule above. Per detail lane one stroke at a time. A group is one unit:
// it starts after its attach stroke has ended and its members run back to back, with pen A's hop lift between them. A
// member lasts max(its own floors, DK.FLOOR, pace x L^0.65) ms; the pace is never above pen A's form pace at the class, so
// a detail line never moves slower than pen A's own law at the same length. Every detail stroke ends DK.LEAD ms before the
// photo density reaches DK.DENS at its class (the deadline is read off the class's V line).
const DETAIL_LANES = ['X', 'Y', 'Z'];
const DETAIL_DIGIT = { X: 7, Y: 8, Z: 9 };            // the phase digit that carries the lane to the page (engine H.pen)
const DK = {
  FLOOR: 2 * FR,          // member floor: 2 frames (main loop)
  ENDS_PER_LANE_WINDOW: 1, // detail ends per 16.67 ms window: one per detail lane in use (agent cap; README), so 2 with two
                          // lanes, 3 with three; ends of all lanes together are recorded, not gated
  NUDGE_MAX: 16,          // a member may wait up to this long for an end slot (as pen C's crowded())
  DENS: 0.25, LEAD: 300,  // the detail deadline: LEAD ms before the photo density DENS (main loop)
  MIN_LEN: 13,            // src px: the short-piece rule for detail strokes (build.cjs keeps MIN_LEN 20 for the rest)
  ANCHOR: 0,              // ms: the fit what-if pulls the A-C plan in about this time (scalePlan; 0 = a uniform scale)
};
for (const l of DETAIL_LANES) { K.LIFT[l] = K.LIFT.A; K.ENDS_PER_PEN[l] = 1; }   // pen A's hop law; one end per window each

// ---------------------------------------------------------------- per-class plan: each lane's blocks in order, windows
// [name, t0, t1, after]: a block starts at t0 (or when its lane is free, or when the stroke 'after' of an earlier-solved
// lane has ended: a glyph waits for the outline it sits in) and line blocks are stretched to end at t1; glyph blocks keep
// their own pacing (t1 0)
// fix round 1: B draws the nose gesture first (pen A's first outline waits for it), then the datum; B's 'wheels' block
// inks the wheels after both tyre outlines are inked; C's 'cabin' block follows its numerals
const PLAN = {
  D: {
    B: [['gesture', 0, 45], ['construction', 48, 170], ['datum', 175, 230], ['tangent', 235, 270], ['wheel-rear', 275, 390], ['wheel-front', 395, 520], ['axle', 525, 570],
      ['wheels', 580, 760, 'front-tyre'], ['centre-marks', 770, 840], ['wheelbase', 845, 1000], ['height', 1005, 1150], ['ground', 1155, 1380], ['tyre-height', 1385, 1460]],
    A: [['silhouette', 95, 640], ['form', 645, 1190]],
    C: [['top-219', 0, 0, 'nose-loop'], ['lettering', 0, 0, 'nose-underside'], ['side-219', 0, 0, 'side-plate'], ['cabin', 0, 1190]],
  },
  T: {
    B: [['gesture', 0, 60], ['datum', 65, 135], ['construction', 135, 250], ['tangent', 250, 290], ['wheel-rear', 290, 450], ['wheel-front', 450, 600], ['axle', 600, 640],
      ['wheels', 650, 800, 'front-tyre'], ['centre-marks', 1050, 1130], ['wheelbase', 1130, 1320], ['ground', 1320, 1470], ['height', 1470, 1650]],
    A: [['silhouette', 65, 860], ['form', 870, 1500]],
    C: [['side-219', 880, 0, 'side-plate'], ['cabin', 0, 1500]],
  },
  P: {
    B: [['gesture', 0, 70], ['datum', 75, 150], ['construction', 150, 220], ['wheel-rear', 220, 410], ['wheel-front', 410, 580], ['axle', 580, 620],
      ['wheels', 630, 780, 'front-tyre'], ['centre-marks', 1000, 1100], ['wheelbase', 1100, 1310], ['ground', 1310, 1480], ['height', 1480, 1650]],
    A: [['silhouette', 75, 900], ['form', 910, 1500]],
    C: [['side-219', 920, 0, 'side-plate'], ['cabin', 0, 1500]],
  },
};
const PENS = ['A', 'B', 'C'];
const GLYPH_BLOCKS = new Set(['lettering', 'top-219', 'side-219']);
const PEN_OF_TIER = { c: 'A', y: 'A', n: 'C', f: 'A', d: 'A', p: 'B', k: 'B', m: 'B', r: 'B', l: 'C', u: 'C' };
// fix round 1: car strokes inked by pen B (the wheels it laid in) and by pen C (cockpit and lamp details); a stroke not
// listed keeps its tier's pen. The id lists are the art's own ids; a missing id is skipped.
const BLOCK_OF = {
  'fw-rim-seen': 'wheels', 'fw-rim-fit': 'wheels', 'fw-tread-edge': 'wheels', 'fw-rib-2': 'wheels', 'rw-rim-seen': 'wheels', 'rw-rim-fit': 'wheels', 'rw-tread-edge': 'wheels', 'rw-sidewall-rib': 'wheels',
  'visor-brow': 'cabin', 'collar': 'cabin', 'neck': 'cabin', 'sleeve-torso': 'cabin', 'amber-lens': 'cabin', 'lens-housing-b': 'cabin', 'lens-housing-top': 'cabin',
  'block-crease': 'cabin', 'box-corner': 'cabin',   // two strokes of an earlier round's full set (not in the final art)
};
const PEN_OF_BLOCK = { wheels: 'B', cabin: 'C' };
// fix round 1: pen A inks the tyre outlines last in its silhouette (rear, then front), after the helmet, so pen B has laid
// in both wheels (compass, square, centre line) before their ink starts
const ORDER_LAST = { silhouette: ['rear-tyre', 'front-tyre'] };
// canvases: 0 PENCIL (construction, chain centre lines, lettering), 1 DRAFT (drafting ink, arrowheads), 2 INK (the car)
const CANVAS_OF_TIER = { p: 0, k: 0, l: 0, u: 0, m: 1, r: 1, c: 2, y: 2, n: 2, f: 2, d: 2 };
// conventions only: the cut order per class (a step clears that class's bit on the conventions with s.cut === step);
// the floors keep at least v3's convention counts
const CUT_ORDER = { D: [1, 2, 5], T: [2, 5], P: [2, 5] };
const CONV_FLOOR = { D: 50, T: 42, P: 37 };

// ---------------------------------------------------------------- motion tables (exact engine motion)
const NT = 2000;
function table(core, geo) {
  const s = new Float64Array(NT + 1);
  for (let j = 0; j <= NT; j++) s[j] = core.ptAt(geo, core.posAt(geo, j / NT))[2];
  return s;
}
// peak arc advance (src px) in any window of w (fraction of the stroke's time)
function peak(tb, w) {
  if (w >= 1) return tb[NT];
  const k = Math.max(1, Math.round(w * NT));
  let m = 0;
  for (let j = 0; j + k <= NT; j++) m = Math.max(m, tb[j + k] - tb[j]);
  return m;
}
function minDurForAdvance(tb, A) {
  let lo = 1, hi = 4000;
  if (peak(tb, FR / hi) > A * CW) return hi;
  while (hi - lo > 0.25) { const mid = (lo + hi) / 2; if (peak(tb, FR / mid) <= A * CW) hi = mid; else lo = mid; }
  return hi;
}
const framesFloor = (L) => (L >= 0.5 * CW ? 3 : L >= 0.25 * CW ? 2 : 1) * FR;
const letterMs = (L) => Math.min(K.LETTER_MAX, Math.max(K.LETTER_MIN, K.LETTER_BASE + K.LETTER_PER_PX * L));

// ---------------------------------------------------------------- the solver
// seq: strokes {id, tier, block, pen, ...}; geos: engine-decoded geometry; core: engine core
function prepare(core, seq, geos) {
  return seq.map((s, i) => {
    const g = geos[i], glyph = GLYPH_BLOCKS.has(s.block);
    const tb = table(core, g);
    // fix round 1: the speed limit follows the stroke (car ink or drafting), not the lane; the lane is the stroke's own
    const A = s.prov !== 'convention' ? K.ADV_CAR : K.ADV_DRAFT;
    // fix round 1 (the feel critic's note on v3): a long dimension or extension line (300 src px or more) takes 3 frames
    const dimFloor = (s.kind === 'dimension' || s.kind === 'extension') && g.L >= 300 ? 3 * FR : 0;
    const floor = glyph ? 0 : Math.max(framesFloor(g.L), s.block === 'silhouette' ? K.SIL_MIN : 0, dimFloor, minDurForAdvance(tb, A));
    return { i, id: s.id, tier: s.tier, block: s.block, pen: s.pen || PEN_OF_BLOCK[s.block] || PEN_OF_TIER[s.tier], glyph, L: g.L, tb, floor: Math.ceil(floor - 1e-9), A, car: s.prov !== 'convention',
      p0: [g.x[0], g.y[0]], p1: [g.x[g.n - 1], g.y[g.n - 1]], word: s.word || null, number: s.number || null, serves: s.serves || null };
  });
}
const hopLift = (pen, a, b) => {
  if (!a) return 0;
  const [mn, mx, per] = K.LIFT[pen], hop = Math.hypot(b[0] - a[0], b[1] - a[1]) / CW;
  return Math.min(mx, Math.max(mn, Math.ceil(per * hop)));
};
// solver round 2 (agent, 2026-11-22): the order of a set of strokes (prep indices) with the least total hop lift on lane
// 'pen' (hopLift: integer ms, clamped), the pen starting at point 'from' (null: no lift into the first). Exact (Held-Karp over
// subsets), so a set holds at most 18 strokes; ties keep the earlier stock position. Memoised on the set and its end points.
const LL_MEMO = new Map();
function leastLift(prep, pen, set, from) {
  const n = set.length;
  if (n <= 1) return set.slice();
  if (n > 18) throw Error('leastLift: ' + n + ' strokes in one set (max 18)');
  // the key holds every stroke's end points, so a moved stroke never reuses another geometry's order
  const key = pen + '|' + (from ? from.join(',') : '-') + '|' + set.map((i) => i + ':' + prep[i].p0.join(',') + ':' + prep[i].p1.join(',')).join(';');
  if (LL_MEMO.has(key)) return LL_MEMO.get(key).slice();
  const N = 1 << n, INF = 1e9, dp = new Float64Array(N * n).fill(INF), par = new Int8Array(N * n).fill(-1);
  const w = set.map((a) => set.map((b) => hopLift(pen, prep[a].p1, prep[b].p0)));
  for (let j = 0; j < n; j++) dp[(1 << j) * n + j] = from ? hopLift(pen, from, prep[set[j]].p0) : 0;
  for (let m = 1; m < N; m++) for (let j = 0; j < n; j++) {
    const v = dp[m * n + j];
    if (v >= INF || !(m & (1 << j))) continue;
    for (let k = 0; k < n; k++) { if (m & (1 << k)) continue; const m2 = m | (1 << k), x = v + w[j][k]; if (x < dp[m2 * n + k] - 1e-9) { dp[m2 * n + k] = x; par[m2 * n + k] = j; } }
  }
  let bj = 0;
  for (let j = 1; j < n; j++) if (dp[(N - 1) * n + j] < dp[(N - 1) * n + bj] - 1e-9) bj = j;
  const ord = [];
  for (let m = N - 1, j = bj; j >= 0;) { ord.push(set[j]); const pj = par[m * n + j]; m ^= 1 << j; j = pj; }
  ord.reverse();
  LL_MEMO.set(key, ord);
  return ord.slice();
}
// opt.plan: the class's plan (default PLAN[cls]; the fit search passes a scaled copy); opt.detail: the detail lanes'
// config (units, lanes, pace, forced) or null
function solveClass(prep, cls, mask, opt = {}) {
  const bit = { D: 4, T: 2, P: 1 }[cls];
  const plan = opt.plan || PLAN[cls];
  const start = new Array(prep.length).fill(null), dur = new Array(prep.length).fill(null), blocks = {};
  // fix round 1: every stroke end placed so far in this class. Pen C is solved last; each of its strokes is held back
  // (1 ms steps, at most NUDGE_MAX) until no 16.67 ms window holds more than ENDS_PER_WINDOW ends in total
  const allEnds = [];
  // (3 in the lettering window, where the feel critic of v3 found 3 fine; 2 for pen C's other blocks)
  const crowded = (x, local, cap) => {
    const E = allEnds.concat(local, [x]);
    for (const e of E) if (e > x - FR && e <= x && E.filter((f) => f >= e && f < e + FR).length > cap) return true;
    return false;
  };
  for (const pen of PENS) {
    let free = 0, at = null;            // the lane's end time and its last point
    for (const [name, t0p, t1, after] of plan[pen] || []) {
      const ai = after ? prep.findIndex((q) => q.id === after && mask[q.i] & bit) : -1;
      const t0 = ai >= 0 && start[ai] != null ? Math.max(t0p, start[ai] + dur[ai]) : t0p;
      const idx0 = prep.filter((p) => p.block === name && p.pen === pen && mask[p.i] & bit).map((p) => p.i);
      // fix round 1: strokes moved to the end of their block (ORDER_LAST), in the listed order
      const lastIds = ORDER_LAST[name] || [], idx = idx0.filter((i) => !lastIds.includes(prep[i].id)).concat(lastIds.map((id) => idx0.find((i) => prep[i].id === id)).filter((i) => i != null));
      if (!idx.length) continue;
      // solver round 2 (agent, 2026-11-22): opt.reorder[name] = { pen, rank(prep index) } places the block's strokes in a
      // stable partition by rank (ORDER ONLY: same strokes, same floors, same speed law, same window). With opt.pinPace (the
      // default when a block is reordered) the block keeps the pace the stock order gets in the same window, so a reorder
      // never speeds a pen up; the block's end may move by the change in hop lifts (recorded)
      const ro = opt.reorder && opt.reorder[name] && opt.reorder[name].pen === pen ? opt.reorder[name] : null;
      // ro.order within each rank set: 'stable' (the stock relative order), 'nn' (the nearest start next, from where the
      // lane's previous stroke left the pen) or 'least-lift' (the order with the least total hop lift over the set, exact;
      // so the reorder adds no pen time over the best path; ties: the stock order). All are ORDER ONLY.
      let idxR = ro ? idx.map((i, k) => [i, k, ro.rank(i)]).sort((a, b) => a[2] - b[2] || a[1] - b[1]).map((x) => x[0]) : idx;
      if (ro && ro.order === 'least-lift') {
        const out = [];
        let pt = at;
        for (const rk of [...new Set(idxR.map((i) => ro.rank(i)))]) {
          const set = idxR.filter((i) => ro.rank(i) === rk), o2 = leastLift(prep, pen, set, pt);
          out.push(...o2);
          pt = prep[o2[o2.length - 1]].p1;
        }
        idxR = out;
      }
      if (ro && ro.order === 'nn') {
        const out = [];
        let pt = at;
        for (const rk of [...new Set(idxR.map((i) => ro.rank(i)))]) {
          const left = idxR.filter((i) => ro.rank(i) === rk);
          while (left.length) {
            let bi = 0, bd = Infinity;
            left.forEach((i, k) => { const d = pt ? Math.hypot(prep[i].p0[0] - pt[0], prep[i].p0[1] - pt[1]) : k; if (d < bd - 1e-9) { bd = d; bi = k; } });
            const i = left.splice(bi, 1)[0];
            out.push(i);
            pt = prep[i].p1;
          }
        }
        idxR = out;
      }
      const place = (c, order = idxR) => {
        let t = null, end = 0, pt = at, last = null;
        const st = [], du = [];
        for (const i of order) {
          const p = prep[i];
          let d, lift;
          if (p.glyph) {
            const numeral = name !== 'lettering';
            d = numeral ? (name === 'top-219' ? K.TOP_NUM_MS : K.NUM_MS) : Math.round(letterMs(p.L));
            if (last == null) lift = free > 0 ? (numeral ? K.BLOCK_NUMBER_LIFT : K.WORD_LIFT) : 0;
            else if (numeral) lift = prep[last].number === p.number ? K.DIGIT_LIFT : K.NUMBER_LIFT;
            else if (prep[last].word === p.word) lift = K.LETTER_LIFT;
            else lift = p.p0[0] < prep[last].p1[0] - 40 ? K.LINE_LIFT : K.WORD_LIFT;   // a new word left of the last one starts a new line
          } else {
            d = Math.max(p.floor, Math.ceil(c * Math.pow(p.L, 0.65)));
            lift = hopLift(pen, pt, p.p0);
          }
          if (t == null) t = Math.max(t0, free + (free > 0 ? lift : 0));
          else t = end + lift;
          if (pen === 'C') {
            const cap = name === 'lettering' || name === 'top-219' ? K.ENDS_PER_WINDOW : K.ENDS_C_OTHER, loc = st.map((s, j) => s + du[j]);
            let k = 0;
            while (k <= K.NUDGE_MAX && crowded(t + k + d, loc, cap)) k++;
            if (k <= K.NUDGE_MAX) t += k;        // otherwise no wait clears it: the stroke keeps its place
          }
          st.push(t); du.push(d);
          end = t + d;
          pt = p.p1;
          last = i;
        }
        return { st, du, end, pt };
      };
      const pinned = !!ro && opt.pinPace !== false, fitOrder = pinned ? idx : idxR;
      // solver round 3 (agent, 2026-11-22; OFF unless opt.paceFix names the block): opt.paceFix[name] = c places the line
      // block at the fixed pace c (each stroke max(its floor, c x L^0.65) ms) with no stretch to t1; build.cjs passes the
      // pace the block gets in the stock plan, so a block moved to an earlier window keeps every stroke's stock duration
      const fixed = opt.paceFix && opt.paceFix[name] != null && !GLYPH_BLOCKS.has(name) ? +opt.paceFix[name] : null;
      let best = place(fixed == null ? 0 : fixed, fitOrder), pace = fixed == null ? 0 : fixed;
      if (fixed == null && !GLYPH_BLOCKS.has(name) && best.end < t1) {
        let lo = 0, hi = 20;
        for (let k = 0; k < 40; k++) { const mid = (lo + hi) / 2; if (place(mid, fitOrder).end <= t1) lo = mid; else hi = mid; }
        best = place(lo, fitOrder);
        pace = lo;
      }
      const stock = ro ? best : null;
      if (ro) best = place(pace, idxR);
      idxR.forEach((i, k) => { start[i] = best.st[k]; dur[i] = best.du[k]; allEnds.push(best.st[k] + best.du[k]); });
      blocks[name] = { pen, window: [t0, t1], at: [best.st[0], best.end], n: idx.length, over: Math.max(0, best.end - (t1 || best.end)), pace };
      if (fixed != null) blocks[name].paceFixed = fixed;
      if (ro) blocks[name].reorder = { pacePinned: pinned, stockAt: [stock.st[0], stock.end], stockOrder: idx.map((i) => prep[i].id), order: idxR.map((i) => prep[i].id), moved: idxR.filter((i, k) => idx[k] !== i).length };
      free = best.end;
      at = best.pt;
    }
  }
  const sol = { start, dur, blocks, plan, lane: new Array(prep.length).fill(null), detail: null, cwlScope: opt.cwlScope || 'all' };
  if (opt.detail) solveDetail(prep, cls, mask, sol, allEnds, opt.detail);
  return sol;
}

// The detail lanes: greedy list scheduling of the class's units (cfg.units: [{ key, attach: prep index, members: [prep
// index] }] in the groups file's order). The next unit placed is the one that can start first on some lane (ties: the
// earlier unit, then the lower lane); its members follow back to back. cfg.forced (prep index -> lane index) keeps a stroke
// on the lane an earlier class gave it (the page reads one lane per data line); a unit whose members were given different
// lanes is split there (recorded). A member that would put more detail ends in one 16.67 ms window than the detail cap
// (DK.ENDS_PER_LANE_WINDOW per lane in use) waits up to DK.NUDGE_MAX ms (at the 2-frame floor this never binds).
function solveDetail(prep, cls, mask, sol, acEnds, cfg) {
  const n = cfg.lanes, lanes = DETAIL_LANES.slice(0, n);
  const free = new Array(n).fill(0), at = new Array(n).fill(null), detEnds = [];
  const rec = { lanes: lanes.slice(), pace: cfg.pace, units: [], unplaced: [], split: [], nudged: 0, unnudgeable: 0 };
  const endOf = (i) => (i == null || sol.start[i] == null ? null : sol.start[i] + sol.dur[i]);
  const over = (E, x, cap) => { for (const e of E) if (e > x - FR && e <= x) { let c = 0; for (const f of E) if (f >= e && f < e + FR) c++; if (c > cap) return true; } return false; };
  const crowded = (x) => over(detEnds.concat([x]), x, DK.ENDS_PER_LANE_WINDOW * n);
  const durOf = (p) => Math.max(p.floor, Math.ceil(DK.FLOOR - 1e-9), Math.ceil(cfg.pace * Math.pow(p.L, 0.65)));
  const units = [];
  for (const u of cfg.units) {
    const segs = [];
    for (const i of u.members) {
      const f = cfg.forced ? cfg.forced.get(i) : undefined, last = segs[segs.length - 1];
      if (!last || (f !== undefined && last.lane !== undefined && f !== last.lane)) segs.push({ lane: f, members: [i] });
      else { last.members.push(i); if (last.lane === undefined) last.lane = f; }
    }
    if (segs.length > 1) rec.split.push({ key: u.key, parts: segs.map((s) => s.members.map((i) => prep[i].id)) });
    segs.forEach((s, k) => units.push({ key: segs.length > 1 ? u.key + '/' + k : u.key, attach: u.attach, members: s.members, lane: s.lane }));
  }
  // the critical path first (list scheduling by level): a unit's level is its own floor time plus the longest level of the
  // units attached to its members. Each step takes the lane that frees first; of the units ready by then the highest level
  // goes (ties: the earlier unit); if none is ready by then, the unit ready first (ties: the higher level). cfg.order
  // 'start' keeps the plain earliest-start rule (a comparison only).
  const ownMs = (u) => u.members.reduce((a, i) => a + Math.max(prep[i].floor, Math.ceil(DK.FLOOR - 1e-9)) + 1, 0);
  const byMember = new Map();
  units.forEach((u) => u.members.forEach((i) => byMember.set(i, u)));
  const kids = new Map(units.map((u) => [u, []]));
  for (const u of units) { const p = byMember.get(u.attach); if (p && p !== u) kids.get(p).push(u); }
  const level = new Map(), lv = (u, seen = new Set()) => {
    if (level.has(u)) return level.get(u);
    if (seen.has(u)) return 0;   // a cycle: left to the unplaced check
    seen.add(u);
    const v = ownMs(u) + Math.max(0, ...kids.get(u).map((k) => lv(k, seen)));
    level.set(u, v);
    return v;
  };
  units.forEach((u) => lv(u));
  const left = units.slice();
  while (left.length) {
    let best = null;
    const opts = [];
    for (const u of left) {
      const ready = endOf(u.attach);
      if (ready == null) continue;
      const p0 = prep[u.members[0]].p0;
      for (let l = 0; l < n; l++) {
        if (u.lane !== undefined && u.lane !== l) continue;
        opts.push({ u, l, ready, st: Math.max(ready, free[l] + hopLift(lanes[l], at[l], p0)) });
      }
    }
    if (!opts.length) break;
    if (cfg.order === 'start') { for (const o of opts) if (!best || o.st < best.st) best = o; }
    else {
      const tFree = Math.min(...opts.map((o) => free[o.l]));
      const now = opts.filter((o) => o.ready <= tFree + 1e-9);
      const pool = now.length ? now : opts.filter((o) => o.ready <= Math.min(...opts.map((q) => q.ready)) + 1e-9);
      for (const o of pool) if (!best || level.get(o.u) > level.get(best.u) + 1e-9 || (Math.abs(level.get(o.u) - level.get(best.u)) <= 1e-9 && (left.indexOf(o.u) < left.indexOf(best.u) || (o.u === best.u && o.st < best.st)))) best = o;
      // the chosen unit goes to the lane where it starts first
      for (const o of opts) if (o.u === best.u && o.st < best.st) best = o;
    }
    left.splice(left.indexOf(best.u), 1);
    const { u, l } = best;
    let t = best.st, pt = at[l];
    u.members.forEach((i, k) => {
      const p = prep[i], d = durOf(p);
      if (k > 0) t += hopLift(lanes[l], pt, p.p0);
      let w = 0;
      while (w <= DK.NUDGE_MAX && crowded(t + w + d)) w++;
      if (w <= DK.NUDGE_MAX) { if (w) rec.nudged++; t += w; } else rec.unnudgeable++;   // no wait clears it: the check fails
      sol.start[i] = t; sol.dur[i] = d; sol.lane[i] = lanes[l];
      detEnds.push(t + d);
      t += d;
      pt = p.p1;
    });
    rec.units.push({ key: u.key, lane: lanes[l], attach: prep[u.attach].id, ready: endOf(u.attach), at: [sol.start[u.members[0]], t], members: u.members.map((i) => prep[i].id) });
    free[l] = t;
    at[l] = pt;
  }
  rec.unplaced = left.map((u) => u.key + ' (attach ' + (u.attach == null ? 'none' : prep[u.attach].id) + ')');
  sol.detail = rec;
  return sol;
}

// The A-C plan pulled in by s about the anchor DK.ANCHOR ms: a block time t > ANCHOR becomes ANCHOR + (t - ANCHOR) x s,
// earlier times stay (so the gesture, the first construction and the first ink keep their places and every lay-in mark
// still lands before the ink it serves); rounded to 1 ms; 'after' links kept. A time of 0 stays 0. s = 1 is the plan.
function scalePlan(plan, s, anchor = DK.ANCHOR) {
  if (s === 1) return plan;
  const f = (t) => (t > anchor ? Math.round(anchor + (t - anchor) * s) : t);
  return Object.fromEntries(Object.entries(plan).map(([pen, bl]) => [pen, bl.map((b) => [b[0], f(b[1]), f(b[2])].concat(b.length > 3 ? [b[3]] : []))]));
}
// One class, solved and checked. opt.mode 'keep': the plan as it is (s = 1). 'fit': the least pull-in of the A-C plan,
// s from 1 down in steps of opt.sStep to opt.sMin, at which the whole class passes checkClass with the detail lanes (the
// first passing s is kept). Per s the detail pace is pen A's form pace at that s if that passes, else the largest pace in
// [0, that] that passes (bisection, 12 steps). Pen order, floors, speed law and the ends caps never change; only the block
// windows move. Returns the passing result, or the s = 1 result marked failed (with the smallest s tried).
function solveFit(core, prep, seq, cls, mask, opt = {}) {
  const base = opt.plan || PLAN[cls], sMin = opt.sMin == null ? 0.6 : opt.sMin, sStep = opt.sStep || 0.005;
  const scales = [1];
  if (opt.mode === 'fit') for (let k = 1; 1 - k * sStep >= sMin - 1e-9; k++) scales.push(Math.round((1 - k * sStep) * 1e4) / 1e4);
  let first = null, tried = 0;
  for (const s of scales) {
    const plan = scalePlan(base, s);
    const trial = (pace) => { tried++; const sol = solveClass(prep, cls, mask, { plan, reorder: opt.reorder, pinPace: opt.pinPace, cwlScope: opt.cwlScope, ...(opt.paceFix ? { paceFix: opt.paceFix } : {}), detail: opt.detail ? { ...opt.detail, pace } : null }); return { sol, chk: checkClass(core, prep, seq, sol, cls, mask) }; };
    let r;
    if (!opt.detail) r = trial(0);
    else {
      const a = solveClass(prep, cls, mask, { plan }).blocks.form, paceMax = a ? a.pace : 0;
      r = trial(paceMax);
      if (!r.chk.ok && paceMax > 0) {
        const z = trial(0);
        if (z.chk.ok) {
          let lo = 0, hi = paceMax;
          r = z;
          for (let k = 0; k < 12; k++) { const mid = (lo + hi) / 2, q = trial(mid); if (q.chk.ok) { lo = mid; r = q; } else hi = mid; }
        }
      }
      r.paceMax = paceMax;
    }
    r.scale = s;
    if (r.chk.ok) return { ...r, tried, firstFail: first ? { scale: 1, violations: first.chk.violations.slice(0, 6) } : null };
    if (!first) first = r;
  }
  return { ...first, failed: true, tried, sMinTried: scales[scales.length - 1] };
}

// ---------------------------------------------------------------- pen speeds (solver round 2, agent)
// Device px per src px at the three pen-check views (dense3/final/art final-record.json ink.views: D 1440x900 DPR 1,
// T 768x1024 DPR 2, P 390x844 DPR 3). A stroke's speed is its mean speed, length / duration (src px per ms; x the view's
// scale for device px per ms). Per class, per lane group (A, B, C, detail) and tier: the stroke count, the fastest stroke
// (max) and the aggregate (sum of lengths / sum of durations). Glyphs (fixed ms per glyph) are left out.
const VIEW_SCALE = { D: 0.70439, T: 0.92121, P: 0.94447 };
function speeds(prep, sol, cls, mask) {
  const bit = { D: 4, T: 2, P: 1 }[cls], k = VIEW_SCALE[cls], groups = {}, strokes = {};
  for (const p of prep) {
    if (!(mask[p.i] & bit) || p.glyph || sol.start[p.i] == null) continue;
    const lane = (sol.lane && sol.lane[p.i]) || p.pen, g = DETAIL_LANES.includes(lane) ? 'detail' : lane, v = p.L / sol.dur[p.i];
    strokes[p.id] = { lane, tier: p.tier, car: p.car, L: +p.L.toFixed(1), dur: sol.dur[p.i], src: +v.toFixed(4), dev: +(v * k).toFixed(4) };
    const key = g + ':' + (p.car ? '' : 'conv:') + p.tier, x = (groups[key] = groups[key] || { n: 0, L: 0, T: 0, max: 0, maxId: null });
    x.n++; x.L += p.L; x.T += sol.dur[p.i];
    if (v > x.max) { x.max = v; x.maxId = p.id; }
  }
  const out = {};
  for (const [key, x] of Object.entries(groups)) out[key] = { n: x.n, maxSrc: +x.max.toFixed(4), maxDev: +(x.max * k).toFixed(4), maxId: x.maxId, aggSrc: +(x.L / x.T).toFixed(4), aggDev: +((x.L / x.T) * k).toFixed(4) };
  return { scale: k, groups: out, strokes };
}

// The pen-speed cap of the T/P pull-in (main loop, solver round 2): T/P speed per tier must not exceed D's pen-A speed
// for the same tier at plan scale 1. ref: speeds() of D's stock schedule at s = 1; sp: speeds() of the class. Per car tier
// that D's pen A draws (c y f d): T/P's car strokes on pens A-C (glyphs and detail lanes left out) against D's pen-A car
// strokes, fastest stroke and aggregate, in device px per ms (each class at its pen-check view) and in src px per ms. ok:
// every ratio <= 1.
function speedCap(ref, sp, cls) {
  const KD = VIEW_SCALE.D, k = VIEW_SCALE[cls], out = {}, agg = (list) => { let L = 0, T = 0, mx = 0, id = null; for (const [i, s] of list) { L += s.L; T += s.dur; if (s.src > mx) { mx = s.src; id = i; } } return list.length ? { n: list.length, maxSrc: mx, maxId: id, aggSrc: L / T } : null; };
  let worstDev = 0, worstSrc = 0, worstAt = null;
  for (const t of ['c', 'y', 'f', 'd']) {
    const r = agg(Object.entries(ref.strokes).filter(([, s]) => s.lane === 'A' && s.car && s.tier === t)), a = agg(Object.entries(sp.strokes).filter(([, s]) => ['A', 'B', 'C'].includes(s.lane) && s.car && s.tier === t));
    if (!r || !a) { out[t] = { n: a ? a.n : 0, ref: r ? r.n : 0, note: 'no comparison' }; continue; }
    const q = { maxDev: (a.maxSrc * k) / (r.maxSrc * KD), aggDev: (a.aggSrc * k) / (r.aggSrc * KD), maxSrc: a.maxSrc / r.maxSrc, aggSrc: a.aggSrc / r.aggSrc };
    out[t] = { n: a.n, maxId: a.maxId, maxSrc: +a.maxSrc.toFixed(3), aggSrc: +a.aggSrc.toFixed(3), maxDev: +(a.maxSrc * k).toFixed(3), aggDev: +(a.aggSrc * k).toFixed(3),
      ref: { n: r.n, maxId: r.maxId, maxSrc: +r.maxSrc.toFixed(3), aggSrc: +r.aggSrc.toFixed(3), maxDev: +(r.maxSrc * KD).toFixed(3), aggDev: +(r.aggSrc * KD).toFixed(3) }, ratio: Object.fromEntries(Object.entries(q).map(([m, v]) => [m, +v.toFixed(3)])) };
    for (const [m, v] of Object.entries(q)) { if (m.endsWith('Dev') && v > worstDev) { worstDev = v; worstAt = t + ' ' + m; } if (m.endsWith('Src')) worstSrc = Math.max(worstSrc, v); }
  }
  return { cls, viewScale: k, refViewScale: KD, tiers: out, worstDev: +worstDev.toFixed(3), worstSrc: +worstSrc.toFixed(3), worstAt, ok: worstDev <= 1 + 1e-9 && worstSrc <= 1 + 1e-9 };
}

// ---------------------------------------------------------------- the develop as the engine computes it
function devCurve(core, Vl) {
  const at = (t) => core.dens(Vl, Math.min(1, Math.max(0, (t - Vl[0]) / Vl[1])));
  const devOfDens = (x) => { let lo = 0, hi = 1; for (let k = 0; k < 60; k++) { const m = (lo + hi) / 2; if (core.dens(Vl, m) < x) lo = m; else hi = m; } return hi; };
  return { at, devOfDens, tOf: (dev) => Vl[0] + dev * Vl[1] };
}

// ---------------------------------------------------------------- checks (each a build failure)
function checkClass(core, prep, seq, sol, cls, mask) {
  const bit = { D: 4, T: 2, P: 1 }[cls], Vl = V[cls], dc = devCurve(core, Vl);
  const idx = prep.filter((p) => mask[p.i] & bit).map((p) => p.i).sort((a, b) => sol.start[a] - sol.start[b] || a - b);
  const end = (i) => sol.start[i] + sol.dur[i];
  const v = [];
  const fail = (rule, msg) => v.push(rule + ': ' + msg);
  const missing = idx.filter((i) => sol.start[i] == null).map((i) => prep[i].id);
  if (missing.length) { fail('scheduled', 'not scheduled: ' + missing.join(', ')); return { ok: false, violations: v }; }
  const firstInk = Math.min(...idx.map((i) => sol.start[i]));
  const lastInk = Math.max(...idx.map(end));
  // dense3: a detail stroke's lane is the one the solver gave it at this class (sol.lane); A-C strokes keep their pen
  const penOf = (i) => (sol.lane && sol.lane[i]) || prep[i].pen;
  const lane = (pen) => idx.filter((i) => penOf(i) === pen);
  const dLanes = sol.detail ? sol.detail.lanes : [], LANES = PENS.concat(dLanes), isDet = (i) => dLanes.includes(penOf(i));
  const lastOf = (q) => (q.length ? Math.max(...q.map(end)) : null);
  const A = lane('A'), B = lane('B'), C = lane('C');
  const lastA = lastOf(A), lastB = lastOf(B), lastC = lastOf(C);
  // fix round 1: the car's structure is every car line, whichever lane inks it
  const struct = idx.filter((i) => prep[i].car && !prep[i].glyph);
  const lastStruct = lastOf(struct);
  const carAll = idx.filter((i) => prep[i].car), lastCar = lastOf(carAll);
  const cwlScope = sol.cwlScope || 'all', lastCarAC = lastOf(carAll.filter((i) => !isDet(i))), lastCarCwl = cwlScope === 'non-detail' ? lastCarAC : lastCar;
  const layerEnd = [0, 1, 2].map((c) => dc.tOf(Vl[3 + 2 * c] / 1e3)), layerStart = [0, 1, 2].map((c) => dc.tOf(Vl[2 + 2 * c] / 1e3));
  const onCanvas = (c) => idx.filter((i) => CANVAS_OF_TIER[prep[i].tier] === c);
  const lastOn = [0, 1, 2].map((c) => lastOf(onCanvas(c)));
  if (firstInk > K.FIRST_INK) fail('first-ink', `${firstInk} > ${K.FIRST_INK}`);
  for (const i of A.filter((i) => prep[i].block === 'silhouette')) if (sol.dur[i] < K.SIL_MIN) fail('silhouette-3-frames', `${prep[i].id} ${sol.dur[i]} ms`);
  const dStruct = dc.at(lastStruct), dLast = dc.at(lastInk);
  // holds: the car ink and the drafting each stay at full strength for a while before their layer leaves
  const inkHold = layerStart[2] - lastOn[2], draftHold = layerStart[1] - lastOn[1];
  if (inkHold < K.INK_HOLD - 1e-9) fail('ink-hold', `ink layer leaves ${inkHold.toFixed(0)} ms after its last stroke (< ${K.INK_HOLD})`);
  if (draftHold < K.DRAFT_HOLD - 1e-9) fail('draft-hold', `drafting layer leaves ${draftHold.toFixed(0)} ms after its last stroke (< ${K.DRAFT_HOLD})`);
  // the lettering lane: done before the PENCIL layer leaves (with a hold), and that layer gone by LETTER_GONE_DENS
  let letterHold = null, pencilGoneDens = null;
  const Cp = C.filter((i) => CANVAS_OF_TIER[prep[i].tier] === 0);
  if (Cp.length) {
    letterHold = layerStart[0] - lastOf(Cp);
    pencilGoneDens = dc.at(layerEnd[0]);
    if (letterHold < K.LETTER_HOLD - 1e-9) fail('letter-hold', `pencil layer leaves ${letterHold.toFixed(0)} ms after the last letter (< ${K.LETTER_HOLD})`);
    if (pencilGoneDens > K.LETTER_GONE_DENS + 1e-9) fail('letter-gone', `pencil layer at 0 only at density ${pencilGoneDens.toFixed(3)} > ${K.LETTER_GONE_DENS}`);
    // fix round 1 (eye-1): the whole car (lines and glyphs) is complete before PENCIL leaves, with a hold.
    // solver round 2 (orchestrator decision, not the owner's): with sol.cwlScope 'non-detail' the gate covers the car
    // strokes of pens A-C (lines and glyphs, the lettering included) and the detail lanes are held to the detail deadline
    // instead (checked below); the unscoped figure is still recorded (carWithLetteringAll)
    if (layerStart[0] - lastCarCwl < K.COEXIST_HOLD - 1e-9) fail('car-with-lettering', `the car${cwlScope === 'non-detail' ? ' (pens A-C)' : ''} is complete at ${lastCarCwl.toFixed(0)} ms, ${(layerStart[0] - lastCarCwl).toFixed(0)} ms before the lettering starts to leave (< ${K.COEXIST_HOLD})`);
  }
  if (lastInk > LIMIT[cls]) fail('last-ink', `${lastInk} > ${LIMIT[cls]}`);
  if (dLast > K.LAST_DENS_MAX + 1e-9) fail('last-ink-density', `${dLast.toFixed(3)} > ${K.LAST_DENS_MAX}`);
  const pencilZero = core.dens(Vl, Vl[3] / 1e3);
  if (pencilZero > K.PENCIL_ZERO_DENS) fail('pencil-zero', `pencil at 0 only at density ${pencilZero.toFixed(3)}`);
  if (Math.max(...layerEnd) > K.LAYERS_ZERO) fail('layers-zero', `${Math.max(...layerEnd)} > ${K.LAYERS_ZERO}`);
  // fix round 1 (the late-photo check of v3, now a build failure): the last line layer is not gone before photo density 0.90
  const goneDens = dc.at(Math.max(...layerEnd));
  if (goneDens < 0.9 - 1e-9) fail('lines-gone-density', `every line layer is gone at density ${goneDens.toFixed(3)} < 0.90`);
  if (Vl[0] + Vl[1] > K.PHOTO_IN) fail('photo-in', `${Vl[0] + Vl[1]} > ${K.PHOTO_IN}`);
  const doneAt = Math.max(Vl[0] + Vl[1], ...layerEnd, lastInk) + FR;
  if (doneAt > K.DONE) fail('done', `${doneAt.toFixed(0)} > ${K.DONE}`);
  let step = 0, stepAt = 0;
  for (let t = 0; t <= 2600; t++) { const d = dc.at(t + 100) - dc.at(t); if (d > step) { step = d; stepAt = t; } }
  if (step > K.STEP_PER_100 + 1e-9) fail('density-step', `${step.toFixed(3)} per 100 ms at ${stepAt}`);
  // lanes: one stroke each in flight (pens A-C and every detail lane in use; a stroke on no known lane fails)
  for (const i of idx) if (!LANES.includes(penOf(i))) fail('lane', `${prep[i].id} on unknown lane ${penOf(i)}`);
  for (const pen of LANES) {
    const q = lane(pen);
    for (let k = 1; k < q.length; k++) if (sol.start[q[k]] < end(q[k - 1])) fail('one-stroke-per-lane', `${pen}: ${prep[q[k]].id} starts ${sol.start[q[k]]} before ${prep[q[k - 1]].id} ends ${end(q[k - 1])}`);
  }
  // in flight: pens A-C at most 3 among them, detail strokes at most one per detail lane, all at most the lane count
  let inFlightMax = 0, inFlightAC = 0, inFlightDetail = 0;
  for (const i of idx) {
    const f = idx.filter((j) => sol.start[j] <= sol.start[i] && end(j) > sol.start[i]), d = f.filter(isDet).length;
    inFlightMax = Math.max(inFlightMax, f.length);
    inFlightAC = Math.max(inFlightAC, f.length - d);
    inFlightDetail = Math.max(inFlightDetail, d);
  }
  if (inFlightAC > PENS.length) fail('in-flight', `${inFlightAC} strokes of pens A-C in flight`);
  if (inFlightDetail > dLanes.length) fail('in-flight-detail', `${inFlightDetail} detail strokes in flight on ${dLanes.length} lanes`);
  if (inFlightMax > LANES.length) fail('in-flight-all', `${inFlightMax} strokes in flight on ${LANES.length} lanes`);
  // stroke ends per 16.67 ms window: pens A-C among themselves (K.ENDS_PER_WINDOW), the detail lanes together (one per
  // detail lane in use, DK.ENDS_PER_LANE_WINDOW), and per lane (K.ENDS_PER_PEN; a lane without a cap fails); every lane
  // together is recorded (worstAll), not gated
  const ends = idx.map((i) => [end(i), penOf(i)]).sort((a, b) => a[0] - b[0]);
  const isDetPen = (p) => dLanes.includes(p);
  let worst = 0, worstAt = 0, worstDetail = 0, worstDetailAt = 0, worstAll = 0, worstAllAt = 0;
  const worstPen = Object.fromEntries(LANES.map((p) => [p, 0])), hist = {}, histDetail = {}, histAll = {};
  for (let k = 0; k < ends.length; k++) {
    const e = ends[k][0], win = ends.filter(([f]) => f >= e && f < e + FR), d = win.filter(([, p]) => isDetPen(p)).length;
    if (!isDetPen(ends[k][1]) && win.length - d > worst) { worst = win.length - d; worstAt = e; }
    if (isDetPen(ends[k][1]) && d > worstDetail) { worstDetail = d; worstDetailAt = e; }
    if (win.length > worstAll) { worstAll = win.length; worstAllAt = e; }
    for (const pen of LANES) worstPen[pen] = Math.max(worstPen[pen], win.filter(([, p]) => p === pen).length);
  }
  // frames (60 Hz from the first mark) by the number of stroke ends inside them, for the record (A-C, detail, all)
  for (let f = 0; f * FR < lastInk + FR; f++) {
    const inF = ends.filter(([e]) => e > f * FR && e <= (f + 1) * FR), d = inF.filter(([, p]) => isDetPen(p)).length;
    hist[inF.length - d] = (hist[inF.length - d] || 0) + 1;
    histDetail[d] = (histDetail[d] || 0) + 1;
    histAll[inF.length] = (histAll[inF.length] || 0) + 1;
  }
  if (worst > K.ENDS_PER_WINDOW) fail('ends-per-window', `${worst} ends in the window from ${worstAt} ms`);
  if (worstDetail > DK.ENDS_PER_LANE_WINDOW * dLanes.length) fail('detail-ends-per-window', `${worstDetail} detail ends in the window from ${worstDetailAt} ms`);
  for (const pen of LANES) {
    if (K.ENDS_PER_PEN[pen] == null) fail('ends-per-lane', `${pen}: no cap`);
    else if (worstPen[pen] > K.ENDS_PER_PEN[pen]) fail('ends-per-lane', `${pen}: ${worstPen[pen]}`);
  }
  // speed and frames by length (non-glyph strokes)
  let peakCar = 0, peakCarId = '', peakDraft = 0, peakDraftId = '';
  for (const i of idx) {
    const p = prep[i];
    if (p.glyph) continue;
    const a = peak(p.tb, FR / sol.dur[i]) / CW;
    if (p.car && a > peakCar) { peakCar = a; peakCarId = p.id; }
    if (!p.car && a > peakDraft) { peakDraft = a; peakDraftId = p.id; }
    if (a > p.A + 1e-6) fail('peak-advance', `${p.id} ${a.toFixed(3)} cw per frame > ${p.A}`);
    if (sol.dur[i] < framesFloor(p.L) - 1e-6) fail('frames-by-length', `${p.id} ${p.L.toFixed(0)} src px in ${sol.dur[i]} ms`);
  }
  // order: each construction or lay-in mark lands before the ink of the member it serves
  const startOf = Object.fromEntries(idx.map((i) => [prep[i].id, sol.start[i]]));
  const order = [];
  for (const i of idx) if (prep[i].serves) for (const m of prep[i].serves) if (startOf[m] != null) {
    order.push([prep[i].id, m, end(i), startOf[m]]);
    if (end(i) > startOf[m]) fail('construction-first', `${prep[i].id} ends ${end(i)} after ${m} starts ${startOf[m]}`);
  }
  // every stroke is finished before its own layer starts to leave
  for (const i of idx) { const c = CANVAS_OF_TIER[prep[i].tier]; if (end(i) > layerStart[c] + 1e-9) fail('drawn-before-exit', `${prep[i].id} ends ${end(i)} after its layer starts leaving at ${layerStart[c].toFixed(0)}`); }
  // per-lane order is the plan's block order (the record keeps each lane's block spans)
  for (const pen of PENS) {
    const names = ((sol.plan || PLAN[cls])[pen] || []).map((b) => b[0]).filter((n) => sol.blocks[n]);
    for (let k = 1; k < names.length; k++) if (sol.blocks[names[k]].at[0] < sol.blocks[names[k - 1]].at[1]) fail('lane-order', `${pen}: ${names[k]} starts before ${names[k - 1]} ends`);
  }
  // dense3, the detail lanes: every unit starts after its attach stroke has ended; its members run back to back on one
  // lane in the unit's order; each member lasts at least DK.FLOOR and is at least DK.MIN_LEN src px; every detail stroke is
  // done by the deadline, DK.LEAD ms before the photo density reaches DK.DENS on this class's V line
  let detail = null;
  const deadline = dc.tOf(dc.devOfDens(DK.DENS)) - DK.LEAD;
  if (sol.detail) {
    const Dr = sol.detail, dIdx = idx.filter(isDet), lastDetail = lastOf(dIdx);
    const byId = Object.fromEntries(idx.map((i) => [prep[i].id, i]));
    if (Dr.unplaced.length) fail('detail-unplaced', Dr.unplaced.join(', '));
    if (Dr.unnudgeable) fail('detail-ends-nudge', `${Dr.unnudgeable} members found no end slot within ${DK.NUDGE_MAX} ms`);
    if (lastDetail != null && lastDetail > deadline + 1e-9) fail('detail-deadline', `last detail stroke ends ${lastDetail} > ${deadline.toFixed(0)} (photo density ${DK.DENS} at ${(deadline + DK.LEAD).toFixed(0)} ms, less ${DK.LEAD})`);
    for (const u of Dr.units) {
      const ai = byId[u.attach], m = u.members.map((id) => byId[id]);
      if (ai == null || m.some((i) => i == null)) { fail('detail-unit', `${u.key}: attach or member not drawn at ${cls}`); continue; }
      if (sol.start[m[0]] < end(ai) - 1e-9) fail('detail-attach', `${u.key} starts ${sol.start[m[0]]} before its attach ${u.attach} ends ${end(ai)}`);
      const L = lane(u.lane), pos = m.map((i) => L.indexOf(i));
      if (pos.some((p) => p < 0) || pos.some((p, k) => k > 0 && p !== pos[k - 1] + 1)) fail('detail-unit', `${u.key}: members not back to back on lane ${u.lane}`);
    }
    for (const i of dIdx) {
      if (sol.dur[i] < DK.FLOOR - 1e-6) fail('detail-floor', `${prep[i].id} ${sol.dur[i]} ms < 2 frames`);
      if (prep[i].L < DK.MIN_LEN - 0.5) fail('detail-min-len', `${prep[i].id} ${prep[i].L.toFixed(1)} src px < ${DK.MIN_LEN}`);
    }
    detail = { lanes: dLanes, n: dIdx.length, units: Dr.units.length, pace: Dr.pace, deadline: Math.round(deadline), lastDetail, slack: lastDetail == null ? null : Math.round(deadline - lastDetail), nudged: Dr.nudged, split: Dr.split,
      firstDetail: dIdx.length ? Math.min(...dIdx.map((i) => sol.start[i])) : null };
  }
  // exits against density (engine lop at the develop progress where the density is x)
  const opAt = (c, x) => core.lop(Vl, c, dc.devOfDens(x));
  const ink06 = opAt(2, 0.6), ink08 = opAt(2, 0.8), dr09 = opAt(1, 0.9);
  if (ink06 > K.INK_AT_06 + 1e-9) fail('ink-at-0.6', ink06.toFixed(3));
  if (ink08 > K.INK_AT_08 + 1e-9) fail('ink-at-0.8', ink08.toFixed(3));
  if (dr09 > K.DRAFT_AT_09 + 1e-9) fail('draft-at-0.9', dr09.toFixed(3));
  const r1 = (x) => Math.round(x * 1000) / 1000;
  // dense3: per lane first start, last end and stroke count; strokes in flight at each 60 Hz frame time; slack per gate
  const spans = Object.fromEntries(LANES.map((p) => { const q = lane(p); return [p, q.length ? { first: Math.min(...q.map((i) => sol.start[i])), last: lastOf(q), n: q.length } : null]; }));
  const flightHist = {};
  for (let f = 0; f * FR < lastInk; f++) { const t = f * FR, n = idx.filter((i) => sol.start[i] <= t && end(i) > t).length; flightHist[n] = (flightHist[n] || 0) + 1; }
  const slack = { lastInk: Math.round(LIMIT[cls] - lastInk), inkHold: Math.round(inkHold - K.INK_HOLD), draftHold: Math.round(draftHold - K.DRAFT_HOLD),
    carWithLettering: Cp.length ? Math.round(layerStart[0] - lastCarCwl - K.COEXIST_HOLD) : null, carWithLetteringAll: Cp.length ? Math.round(layerStart[0] - lastCar - K.COEXIST_HOLD) : null, letterHold: letterHold == null ? null : Math.round(letterHold - K.LETTER_HOLD),
    detailDeadline: detail ? detail.slack : null, detailDeadlineAt: Math.round(deadline) };
  return {
    ok: !v.length, violations: v, n: idx.length, firstInk, lastInk, lastA, lastB, lastC, lastStruct, lastCar, lastCarAC, cwlScope, carWithLettering: Cp.length ? Math.round(layerStart[0] - lastCarCwl) : null, carWithLetteringAll: Cp.length ? Math.round(layerStart[0] - lastCar) : null, lastOnLayer: lastOn,
    holds: { ink: Math.round(inkHold), draft: Math.round(draftHold), letters: letterHold == null ? null : Math.round(letterHold) },
    pencilGoneDens: pencilGoneDens == null ? null : r1(pencilGoneDens),
    densAt: { lastStruct: r1(dStruct), lastCar: r1(dc.at(lastCar)), lastInk: r1(dLast), lastA: r1(dc.at(lastA)) }, pencilZeroDens: r1(pencilZero), layerStart: layerStart.map(Math.round), layerEnd: layerEnd.map(Math.round),
    photoIn: Vl[0] + Vl[1], doneAt: Math.round(doneAt), steepestPer100: { v: r1(step), at: stepAt },
    ends: { worst, worstAt, perPen: worstPen, framesByEnds: hist, worstDetail, worstDetailAt, worstAll, worstAllAt, framesByDetailEnds: histDetail, framesByAllEnds: histAll }, inFlightMax, inFlightAC, inFlightDetail,
    spans, flightHist, slack, detail,
    peak: { car: [r1(peakCar), peakCarId], draft: [r1(peakDraft), peakDraftId] }, exitsVsDensity: { inkAt06: r1(ink06), inkAt08: r1(ink08), draftAt09: r1(dr09) },
    order, blocks: sol.blocks,
    densCheckpoints: Object.fromEntries([300, 700, 1000, 1100, 1400, 1600, 1800, 2000, 2200, 2400, 2500].map((t) => [t, r1(dc.at(t))])),
  };
}

module.exports = { FR, CW, V, LIMIT, K, PLAN, PENS, BLOCK_OF, PEN_OF_BLOCK, CUT_ORDER, CONV_FLOOR, PEN_OF_TIER, CANVAS_OF_TIER, GLYPH_BLOCKS, prepare, solveClass, checkClass, table, peak, minDurForAdvance, devCurve, hopLift, letterMs,
  DETAIL_LANES, DETAIL_DIGIT, DK, solveDetail, solveFit, scalePlan, VIEW_SCALE, speeds, speedCap, leastLift };
