"""ESTIMATE ONLY: PEN_SPEC section 5's clock run over out/strokes.json, to check that the art
fits the timing limits before the engine exists. The engine's build owns the real schedules;
this is a port of the R2 pilot's solver (releases/hand-drawn-20261106/pilot/_tools/gen.py) with
two of the pilot critic's timing fixes: a beat (>= 17 ms) whenever the next stroke starts more
than 0.12 cw from the pen, and TEMPO fixed at 1.0. It does not model the P2 speed ramp or the
in-stroke curvature warp, so frame-level numbers are approximate.

usage: python clock_estimate.py [--strokes out/strokes.json] [--json OUT]
"""
import argparse, json, math

import numpy as np

CW = 827.0
FR = 1000.0 / 60
SPEC = dict(FLOOR={0: 50, 1: 83, 2: 0, 3: 0, 4: 0, 5: 25}, A={0: .15, 1: .12, 2: .25, 3: .30, 4: .35, 5: .25},
            BEAT={0: 30, 1: 30, 2: 18, 3: 17, 4: 22, 5: 17}, PAUSE={1: 100, 2: 80, 3: 50, 4: 50, 5: 40},
            ENDS={2: 4, 3: 4, 4: 6, 5: 4},
            BUDGET={"D": {2: 760, 3: 560, 4: 560, 5: 160}, "T": {2: 700, 3: 340, 4: 500, 5: 160}, "P": {2: 560, 3: 200, 4: 440, 5: 120}})
LIMIT = {"D": 4400, "T": 4000, "P": 3500}


def mulberry32(a):
    st = [a & 0xFFFFFFFF]

    def nxt():
        st[0] = (st[0] + 0x6D2B79F5) & 0xFFFFFFFF
        t = st[0]
        t = ((t ^ (t >> 15)) * (t | 1)) & 0xFFFFFFFF
        t = (t ^ ((t + (((t ^ (t >> 7)) * (t | 61)) & 0xFFFFFFFF)) & 0xFFFFFFFF)) & 0xFFFFFFFF
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296
    return nxt


def minfr(l):
    return 3 if l >= .5 else 2 if l >= .25 else 1 if l >= .12 else 0


def mj(t):
    return 10 * t ** 3 - 15 * t ** 4 + 6 * t ** 5


def phase_times(ph, S, p, pen, area, first):
    out = []
    for i, s in enumerate(ph):
        L = s["len"]; l = L / CW
        kind = {"glyph": 0.8, "hatch": 0.6}.get(s["kind"], 1.0)
        hand = (30 + 6.8 * L ** 0.65) * kind
        dur = max(hand * (1 + s["u1"]) / S, SPEC["FLOOR"][p], minfr(l) * FR, 2.0625 * l / SPEC["A"][p] * FR if l >= .12 else 0)
        if first and i == 0:
            gap = 0.0
        else:
            J = float(np.hypot(*(s["P"][0] - pen))) if pen is not None else 0.0
            same_burst = i > 0 and s.get("burst") and s.get("burst") == ph[i - 1].get("burst")
            if same_burst and s["kind"] == "hatch":
                lift = 25.0
            elif same_burst and s["kind"] == "glyph":
                lift = 30.0
            else:
                lift = 45 + 0.12 * J
            changed = s["area"] != area or J > 0.12 * CW
            gap = max(lift * (1 + s["u2"]) / S, SPEC["BEAT"][p] if changed else (0.75 * SPEC["BEAT"][p] if p <= 1 else 0))
            if i == 0:
                gap += SPEC["PAUSE"][p]
        out.append([gap, dur])
        pen, area = s["P"][-1], s["area"]
    return out


def timeline(tl):
    st, en, t = [], [], 0.0
    for g, d in tl:
        t += g; st.append(t); t += d; en.append(t)
    return st, en


def caps_ok(ph, tl, p):
    st, en = timeline(tl)
    ends = np.array(en)
    j = worst = 0
    for i in range(len(ends)):
        while ends[i] - ends[j] >= FR:
            j += 1
        worst = max(worst, i - j + 1)
    grid = np.arange(st[0], en[-1] + FR + 1, 0.5)
    cum = np.zeros_like(grid)
    for s, a, b in zip(ph, st, en):
        cum += (s["len"] / CW) * mj(np.clip((grid - a) / max(b - a, 1e-6), 0, 1))
    k = int(round(FR / 0.5))
    ink = float(np.max(cum[k:] - cum[:-k])) if len(cum) > k else float(cum[-1])
    return worst <= SPEC["ENDS"][p] and ink <= 0.40 + 1e-9, worst, ink


def length_of(tl):
    return sum(g + d for g, d in tl) - tl[0][0]


def solve(seq, cls):
    for s in seq:
        r = mulberry32(20261107 + s["i"])
        s["u1"] = (r() * 2 - 1) * 0.10
        s["u2"] = (r() * 2 - 1) * 0.20
    sched, info, pen, area, first = [], {}, None, None, True
    for p in range(6):
        ph = [s for s in seq if s["phase"] == p]
        if not ph:
            continue
        if p <= 1:
            S = 3.4
        else:
            f = lambda S_: phase_times(ph, S_, p, pen, area, first)
            lo, hi = 0.3, 400.0
            if length_of(f(hi)) > SPEC["BUDGET"][cls][p]:
                Sb = hi
            else:
                for _ in range(60):
                    mid = (lo + hi) / 2
                    if length_of(f(mid)) <= SPEC["BUDGET"][cls][p]:
                        hi = mid
                    else:
                        lo = mid
                Sb = hi
            lo, hi = 0.3, 400.0
            if caps_ok(ph, f(lo), p)[0]:
                for _ in range(60):
                    mid = (lo + hi) / 2
                    if caps_ok(ph, f(mid), p)[0]:
                        lo = mid
                    else:
                        hi = mid
            S = min(Sb, lo)
        tl = phase_times(ph, S, p, pen, area, first)
        ok, worst, ink = caps_ok(ph, tl, p) if p >= 2 else (True, 0, 0)
        info[p] = dict(n=len(ph), S=round(S, 2), len_ms=round(length_of(tl)), ends_per_frame=worst, ink_cw_per_frame=round(ink, 3))
        sched += tl
        pen, area, first = ph[-1]["P"][-1], ph[-1]["area"], False
    out, t, prev_end = [], 0.0, 0
    for g, d in sched:
        st_ = t + g; en_ = st_ + d; t = en_
        sr = max(prev_end, int(round(st_))); er = max(sr + 1, int(math.ceil(en_)))
        out.append([sr - prev_end, er - sr]); prev_end = er
    return out, info


def locality(seq, sch):
    """Windows of 16.67 ms (starting at each stroke start, split at a beat) whose ink lies more
    than 0.25 cw from the window's first stroke start."""
    st, en = timeline(sch)
    bad = 0
    worst = 0.0
    for i in range(len(seq)):
        a = st[i]; b = a + FR
        ref = seq[i]["P"][0]
        w = 0.0
        for j in range(i, len(seq)):
            if st[j] >= b:
                break
            if j > i and (seq[j]["area"] != seq[j - 1]["area"] or float(np.hypot(*(seq[j]["P"][0] - seq[j - 1]["P"][-1]))) > 0.12 * CW):
                break
            lo = (max(a, st[j]) - st[j]) / max(en[j] - st[j], 1)
            hi = (min(b, en[j]) - st[j]) / max(en[j] - st[j], 1)
            if hi <= 0:
                continue
            q = seq[j]["P"]; n = len(q) - 1
            seg = q[int(mj(max(0, lo)) * n): int(mj(min(1, hi)) * n) + 1]
            if len(seg):
                w = max(w, float(np.max(np.hypot(*(seg - ref).T))) / CW)
        worst = max(worst, w)
        bad += w > 0.25
    return bad, worst


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--strokes", default="out/strokes.json")
    ap.add_argument("--json")
    a = ap.parse_args()
    d = json.load(open(a.strokes, encoding="utf-8"))
    S = d["strokes"]
    for s in S:
        s["P"] = np.asarray(s["pts"], float)
    res = {}
    for cls in "DTP":
        seq = [s for s in S if cls in s["classes"]]
        sch, info = solve(seq, cls)
        st, en = timeline(sch)
        p1 = [k for k, s in enumerate(seq) if s["phase"] == 1]
        bad, worst = locality(seq, sch)
        res[cls] = dict(n=len(seq), last_ink_ms=round(en[-1]), limit_ms=LIMIT[cls], within_limit=en[-1] <= LIMIT[cls],
                        p1_start_ms=round(st[p1[0]]), p1_length_ms=round(en[p1[-1]] - st[p1[0]]), phases=info,
                        locality_windows_over_025cw=bad, locality_worst_cw=round(worst, 3),
                        one_pen=all(st[k] >= en[k - 1] for k in range(1, len(st))))
    print(json.dumps(res, indent=1))
    if a.json:
        json.dump(res, open(a.json, "w"), indent=1)


if __name__ == "__main__":
    main()
