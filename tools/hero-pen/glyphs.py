"""Glyph strokes (PEN_SPEC 12.3): the side-plate 219, the nose-top 219 and the lettering
"Olin College of Engineering", as single-line strokes on the skeletons of the real letters.

Method, per glyph region (inputs/glyph-order.json):
  1. Crop the photo, take the ink channel (white letters: the smallest of R, G, B; black
     numerals on the white plate: 255 - the largest of R, G, B), upsample it UP x (bicubic).
  2. Local Otsu threshold inside the region box; drop specks; fill pin holes.
  3. Thin with Zhang-Suen (NumPy, below), prune spurs shorter than 3 src px.
  4. Each stroke in glyph-order.json is a list of waypoints in pen order (read off a zoomed
     crop, a few px accurate). Between consecutive waypoints the stroke follows the skeleton:
     a shortest path over skeleton pixels whose cost grows with the distance from the
     waypoint-to-waypoint chord, so the pen takes the route the letter has, not a shortcut.
  5. Light smoothing (Gaussian, sigma 1 skeleton px), cubic Bezier fit within 0.3 src px.
  6. Check: every sample within 1 src px of the medial axis (distance-transform ridge),
     at most 2 strokes per letter.
"""
import heapq, json, math
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ni

from common import SRC, INP, TL, resample, plen, bez_dense

UP = 4


def otsu(v):
    h, e = np.histogram(v, bins=256, range=(0, 255))
    p = h / max(h.sum(), 1)
    w = np.cumsum(p)
    mu = np.cumsum(p * np.arange(256))
    mt = mu[-1]
    sb = (mt * w - mu) ** 2 / (w * (1 - w) + 1e-12)
    return float(np.argmax(sb))


def zhang_suen(img):
    """Zhang-Suen thinning of a boolean image (NumPy, vectorised per sub-iteration)."""
    I = img.astype(np.uint8).copy()
    I = np.pad(I, 1)
    changed = True
    while changed:
        changed = False
        for step in (0, 1):
            P2 = I[:-2, 1:-1]; P3 = I[:-2, 2:]; P4 = I[1:-1, 2:]; P5 = I[2:, 2:]
            P6 = I[2:, 1:-1]; P7 = I[2:, :-2]; P8 = I[1:-1, :-2]; P9 = I[:-2, :-2]
            C = I[1:-1, 1:-1]
            nb = [P2, P3, P4, P5, P6, P7, P8, P9]
            B = sum(n.astype(np.int32) for n in nb)
            seq = nb + [P2]
            A = sum(((seq[k] == 0) & (seq[k + 1] == 1)).astype(np.int32) for k in range(8))
            if step == 0:
                m = (C == 1) & (B >= 2) & (B <= 6) & (A == 1) & ((P2 * P4 * P6) == 0) & ((P4 * P6 * P8) == 0)
            else:
                m = (C == 1) & (B >= 2) & (B <= 6) & (A == 1) & ((P2 * P4 * P8) == 0) & ((P2 * P6 * P8) == 0)
            if m.any():
                C[m] = 0
                changed = True
    return I[1:-1, 1:-1].astype(bool)


N8 = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]


def neighbours(sk, y, x):
    h, w = sk.shape
    for dy, dx in N8:
        yy, xx = y + dy, x + dx
        if 0 <= yy < h and 0 <= xx < w and sk[yy, xx]:
            yield yy, xx


def degree(sk):
    k = np.ones((3, 3), int); k[1, 1] = 0
    return ni.convolve(sk.astype(int), k, mode="constant") * sk


def prune(sk, min_len):
    """Remove end branches (endpoint to junction) shorter than min_len skeleton px."""
    sk = sk.copy()
    for _ in range(6):
        removed = False
        deg = degree(sk)
        for y, x in zip(*np.nonzero(deg == 1)):
            if not sk[y, x]:
                continue
            path, prev, cur = [(y, x)], None, (y, x)
            junction = False
            while True:
                nb = [n for n in neighbours(sk, *cur) if n != prev]
                if len(nb) == 0:
                    break
                if len(nb) > 1:
                    junction = True
                    break
                prev, cur = cur, nb[0]
                if sum(1 for _ in neighbours(sk, *cur)) > 2:
                    junction = True
                    break
                path.append(cur)
                if len(path) > min_len:
                    break
            if junction and len(path) <= min_len:
                for p in path:
                    sk[p] = False
                removed = True
        if not removed:
            break
    return sk


class Region:
    """One glyph region: binary letters, skeleton and medial axis at UP x."""

    def __init__(self, box, ink, rgb, close=0, minarea=6, thr_bias=0.0, clip=None):
        x0, y0, x1, y1 = box
        self.box = box
        crop = rgb[y0:y1, x0:x1].astype(float)
        if ink == "white":
            v = crop.min(2)
        elif ink == "red":                       # red / pink straps: how much red exceeds green and blue
            v = 2.0 * (crop[:, :, 0] - 0.5 * (crop[:, :, 1] + crop[:, :, 2]))
        else:
            v = 255 - crop.max(2)
        img = Image.fromarray(np.clip(v, 0, 255).astype(np.uint8))
        big = np.asarray(img.resize(((x1 - x0) * UP, (y1 - y0) * UP), Image.BICUBIC)).astype(float)
        self.v = big
        cm = np.ones(big.shape, bool)
        if clip:
            from PIL import ImageDraw
            ci = Image.new("1", (big.shape[1], big.shape[0]), 0)
            ImageDraw.Draw(ci).polygon([((x - x0) * UP, (y - y0) * UP) for x, y in clip], fill=1)
            cm = np.asarray(ci).astype(bool)
        self.clipmask = cm
        t = otsu(big[cm]) + thr_bias
        b = (big > t) & cm
        b = ni.binary_opening(b, iterations=1)
        if close:
            b = ni.binary_closing(b, iterations=close)
        lab, n = ni.label(b)
        sizes = ni.sum(b, lab, range(1, n + 1))
        keep = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s >= minarea * UP * UP])
        # keep real holes (O, o, e, g, 9): fill only holes smaller than 2 src px^2
        holes = ni.binary_fill_holes(keep) & ~keep
        hl, hn = ni.label(holes)
        hs = ni.sum(holes, hl, range(1, hn + 1))
        small = np.isin(hl, [i + 1 for i, s in enumerate(hs) if s < 2 * UP * UP])
        self.bin = keep | small
        self.thr = t
        self.sk = prune(zhang_suen(self.bin), 3 * UP)
        dt = ni.distance_transform_edt(self.bin)
        self.dt = dt
        # medial axis = distance-transform ridge: a local maximum of the DT along at least
        # one of the four line directions through the pixel
        r = np.zeros_like(self.bin)
        for dy, dx in ((0, 1), (1, 0), (1, 1), (1, -1)):
            a = np.roll(dt, (dy, dx), (0, 1)); c = np.roll(dt, (-dy, -dx), (0, 1))
            r |= (dt >= a) & (dt >= c) & (dt > 0.9)
        self.ridge = r
        self.ridge_tree = None

    def to_px(self, yx):
        """skeleton pixel (y, x) at UP x -> source px (x, y), pixel centres."""
        x0, y0 = self.box[0], self.box[1]
        return np.array([x0 + (yx[1] + 0.5) / UP, y0 + (yx[0] + 0.5) / UP])

    def to_sk(self, p):
        x0, y0 = self.box[0], self.box[1]
        return ((p[1] - y0) * UP - 0.5, (p[0] - x0) * UP - 0.5)

    def nearest_sk(self, p, reach=4.0):
        ys, xs = np.nonzero(self.sk)
        sy, sx = self.to_sk(p)
        d = np.hypot(ys - sy, xs - sx)
        i = int(np.argmin(d))
        if d[i] > reach * UP:
            return None, d[i] / UP
        return (int(ys[i]), int(xs[i])), d[i] / UP

    def path(self, a, b, pa, pb, k=0.6):
        """Shortest skeleton path from pixel a to b; cost = step * (1 + k * dist_to_chord^2)."""
        sk = self.sk
        A = np.array(self.to_sk(pa)); B = np.array(self.to_sk(pb))
        ab = B - A; L2 = max(float(ab @ ab), 1e-9)

        def chord_d(y, x):
            q = np.array([y, x], float)
            t = np.clip(((q - A) @ ab) / L2, 0, 1)
            return float(np.hypot(*(q - (A + t * ab)))) / UP

        dist = {a: 0.0}
        prev = {}
        pq = [(0.0, a)]
        while pq:
            d, u = heapq.heappop(pq)
            if u == b:
                break
            if d > dist.get(u, 1e18):
                continue
            for v in neighbours(sk, *u):
                step = math.hypot(v[0] - u[0], v[1] - u[1])
                c = d + step * (1 + k * chord_d(*v) ** 2)
                if c < dist.get(v, 1e18):
                    dist[v] = c
                    prev[v] = u
                    heapq.heappush(pq, (c, v))
        if b not in dist:
            return None
        out = [b]
        while out[-1] != a:
            out.append(prev[out[-1]])
        return out[::-1]

    def medial_distance(self, pts):
        """Distance (src px) from each point to the nearest medial-axis (DT ridge) pixel."""
        if self.ridge_tree is None:
            from scipy.spatial import cKDTree
            ys, xs = np.nonzero(self.ridge)
            self.ridge_pts = np.column_stack([xs, ys]).astype(float)
            self.ridge_tree = cKDTree(self.ridge_pts)
        q = np.array([[(p[0] - self.box[0]) * UP - 0.5, (p[1] - self.box[1]) * UP - 0.5] for p in pts])
        return self.ridge_tree.query(q)[0] / UP


def trace_glyph_stroke(reg, waypoints, closed=False, smooth=1.0, err=0.3):
    """Follow the skeleton through the waypoints; returns (points src px, report)."""
    nodes = []
    for p in waypoints:
        n, d = reg.nearest_sk(p)
        if n is None:
            return None, {"error": "waypoint %s is %.1f src px from the skeleton" % (p, d)}
        nodes.append(n)
    chain = []
    for i in range(len(nodes) - 1):
        seg = reg.path(nodes[i], nodes[i + 1], waypoints[i], waypoints[i + 1])
        if seg is None:
            return None, {"error": "no skeleton path between waypoints %d and %d" % (i, i + 1)}
        chain += seg if not chain else seg[1:]
    P = np.array([reg.to_px(c) for c in chain])
    if len(P) < 3:
        return None, {"error": "too short"}
    if smooth:
        s = smooth
        P = np.column_stack([ni.gaussian_filter1d(P[:, 0], s * 1.0, mode="nearest" if not closed else "wrap"),
                             ni.gaussian_filter1d(P[:, 1], s * 1.0, mode="nearest" if not closed else "wrap")])
    P = resample(P, 0.5)
    segs = TL.fit_path(P, err, 70)
    D = bez_dense(segs, 0.5)
    md = reg.medial_distance(resample(D, 0.5))
    return D, {"segs": [np.round(c, 3).tolist() for c in segs], "medial_max": float(md.max()), "medial_p95": float(np.percentile(md, 95)),
               "medial_med": float(np.median(md)), "len": plen(D)}


# ---------------------------------------------------------------- free ends (2026-11-07 critic, revision 1)
# Zhang-Suen thinning and spur pruning shorten a skeleton at a rounded or slanted end, so a
# traced letter can stop several px short of its ink ('Olin' read 'Oiin': the l stopped at the
# i's height). Every FREE end (not a junction with another stroke of the letter; listed per
# stroke in glyph-order.json as "free") is moved to the ink end minus half the stroke width,
# measured along the end tangent; |gap| <= 1 src px is a build gate.
END_TOL = 1.0


def _inside(reg, q):
    y, x = reg.to_sk(q)
    iy, ix = int(round(y)), int(round(x))
    return 0 <= iy < reg.bin.shape[0] and 0 <= ix < reg.bin.shape[1] and bool(reg.bin[iy, ix])


def ink_run(reg, E, t, reach=14.0, step=0.125):
    """How far (src px) the letter's ink continues from E along the unit direction t."""
    s = 0.0
    while s <= reach:
        if not _inside(reg, E + s * t):
            return s
        s += step
    return reach


def half_width(reg, P):
    """Median distance-transform value (src px) along the stroke: half the stroke width."""
    v = []
    for p in resample(np.asarray(P, float), 0.5):
        y, x = reg.to_sk(p)
        iy, ix = int(round(y)), int(round(x))
        if 0 <= iy < reg.dt.shape[0] and 0 <= ix < reg.dt.shape[1] and reg.dt[iy, ix] > 0:
            v.append(reg.dt[iy, ix] / UP)
    return float(np.median(v)) if v else 0.0


def end_tangent(P, which, reach=2.0):
    """Outward unit tangent at an end of a polyline, over `reach` src px."""
    Q = resample(np.asarray(P, float), 0.25)
    k = max(1, min(len(Q) - 1, int(round(reach / 0.25))))
    v = Q[-1] - Q[-1 - k] if which == "e" else Q[0] - Q[k]
    return v / (np.linalg.norm(v) + 1e-9)


def end_gaps(reg, P, free):
    """{'s'|'e': gap} for each free end: ink continuation along the end tangent minus half width
    (positive: the stroke stops short of the ink; negative: it overshoots)."""
    P = np.asarray(P, float)
    hw = half_width(reg, P)
    out = {}
    for which in free:
        E = P[-1] if which == "e" else P[0]
        t = end_tangent(P, which)
        out[which] = round(ink_run(reg, E, t) - hw, 3)
    return out, hw


def fit_ends(reg, P, free, iters=3):
    """Move each free end to the ink end minus half the stroke width (straight along the end
    tangent; trimmed back when the stroke overshoots). Returns the new dense polyline."""
    P = resample(np.asarray(P, float), 0.25)
    for _ in range(iters):
        gaps, hw = end_gaps(reg, P, free)
        moved = False
        for which, g in gaps.items():
            if abs(g) <= 0.25:
                continue
            moved = True
            t = end_tangent(P, which)
            if g > 0:
                ext = np.array([(P[-1] if which == "e" else P[0]) + u * t for u in np.arange(0.25, g + 1e-6, 0.25)])
                P = np.vstack([P, ext]) if which == "e" else np.vstack([ext[::-1], P])
            else:
                n = int(round(-g / 0.25))
                P = P[: len(P) - n] if which == "e" else P[n:]
        if not moved:
            break
    return P


def dot_ink_centre(reg, py, px, fallback):
    """Intensity-weighted centre (src px) of the letter-mask component that holds pixel (py, px)."""
    lab, n = ni.label(reg.bin)
    k = lab[py, px]
    if k == 0:
        return fallback
    ys, xs = np.nonzero(lab == k)
    w = np.maximum(reg.v[ys, xs] - reg.thr, 1e-3)
    x0, y0 = reg.box[0], reg.box[1]
    return np.array([x0 + (float((xs * w).sum() / w.sum()) + 0.5) / UP, y0 + (float((ys * w).sum() / w.sum()) + 0.5) / UP])


def trace_parts(reg, parts, free):
    """Revision 2: one glyph stroke made of parts joined at corners (a pen stop, no lift): the 2
    of the nose top (bowl and diagonal on the skeleton, corner, base straight), its 1 (flag,
    corner, stem) and its 9 (bowl, corner at the stem junction, tail). Each part follows the
    skeleton through its waypoints, or runs straight ('line') from the previous part's end to
    its last waypoint, so no part retraces the thinning spur at an acute corner. Free ends are
    fitted on the first part's start and the last part's end. Returns (points, report with
    segs and corners, gaps before the end fit)."""
    polys = []
    for k, pt in enumerate(parts):
        wp = [list(p) for p in pt["wp"]]
        if pt.get("line"):
            a = polys[-1][-1] if polys else np.array(wp[0], float)
            P = resample(np.array([a, wp[-1]], float), 0.5)
        else:
            P, rep = trace_glyph_stroke(reg, wp, closed=False)
            if P is None:
                return None, {"error": "part %d: %s" % (k, rep.get("error"))}, {}
            if polys:                                   # start exactly where the previous part ended
                P = np.vstack([polys[-1][-1], P[1:]]) if np.hypot(*(P[0] - polys[-1][-1])) < 1.5 else None
                if P is None:
                    return None, {"error": "part %d starts away from part %d's end" % (k, k - 1)}, {}
        polys.append(np.asarray(P, float))
    whole = np.vstack([polys[0]] + [p[1:] for p in polys[1:]])
    gap0 = end_gaps(reg, whole, free)[0] if free else {}
    if "s" in free:
        polys[0] = resample(fit_ends(reg, polys[0], "s"), 0.5)
    if "e" in free:
        polys[-1] = resample(fit_ends(reg, polys[-1], "e"), 0.5)
    for k in range(1, len(polys)):                      # keep the joins exact after the end fits
        polys[k][0] = polys[k - 1][-1]
    segs, corners = [], []
    for k, P in enumerate(polys):
        part = [np.array([P[0], P[0] + (P[-1] - P[0]) / 3, P[0] + 2 * (P[-1] - P[0]) / 3, P[-1]])] if parts[k].get("line") else TL.fit_path(resample(P, 0.5), 0.3, 70)
        if segs and not parts[k].get("smooth"):        # revision 3: 'smooth' joins without a pen stop
            corners.append(len(segs))
        segs += [np.asarray(c, float) for c in part]
    D = bez_dense(segs, 0.5)
    md = reg.medial_distance(resample(D, 0.5))
    rep = {"segs": [np.round(c, 3).tolist() for c in segs], "corners": corners, "medial_max": float(md.max()),
           "medial_p95": float(np.percentile(md, 95)), "medial_med": float(np.median(md)), "len": plen(D), "parts": len(parts)}
    return D, rep, gap0


def build_glyphs(rgb, spec):
    """All glyph strokes of glyph-order.json, in writing order (each word's i-dots after the word)."""
    regs = {k: Region(tuple(v["box"]), v["ink"], rgb, clip=v.get("clip"), thr_bias=v.get("thr_bias", 0.0)) for k, v in spec["regions"].items()}
    out, problems = [], []
    for w in spec["words"]:
        reg = regs[w["region"]]
        dots = []
        for li, L in enumerate(w["letters"]):
            reg = regs[L.get("region", w["region"])]
            for si, s in enumerate(L["strokes"]):
                sid = "%s-%02d-%s%s" % (w["id"], li + 1, L["ch"].lower(), "" if si == 0 else "-%d" % (si + 1))
                wp = s.get("wp")
                free = s.get("free", "" if s.get("closed") else "se")
                if s.get("parts"):
                    D, rep, gap0 = trace_parts(reg, s["parts"], free)
                    if D is None:
                        problems.append({"id": sid, **rep})
                        continue
                    g1, hw = end_gaps(reg, D, free) if free else ({}, 0.0)
                    if free:
                        rep["ends"] = {"free": free, "half_width": round(hw, 2), "gap_before": gap0, "gap": g1}
                    out.append(dict(id=sid, word=w["id"], letter=li, ch=L["ch"], stroke=si, pts=D, classes=w["classes"],
                                    numeral=bool(w.get("numeral")), check=rep, closed=False, corners=rep["corners"]))
                    continue
                if s.get("line"):
                    D = resample(np.array(wp, float), 0.5)
                    gap0 = end_gaps(reg, D, free)[0] if free else {}
                    if free:
                        D = resample(fit_ends(reg, D, free), 0.5)
                    a_, b_ = D[0], D[-1]
                    segs = [np.array([a_, a_ + (b_ - a_) / 3, a_ + 2 * (b_ - a_) / 3, b_], float)]
                    md = reg.medial_distance(D)
                    rep = {"segs": [np.round(c, 3).tolist() for c in segs], "medial_max": float(md.max()), "medial_p95": float(np.percentile(md, 95)),
                           "medial_med": float(np.median(md)), "len": plen(D), "line": True}
                else:
                    D, rep = trace_glyph_stroke(reg, wp, closed=s.get("closed", False))
                    gap0 = {}
                    if D is not None and free:
                        gap0 = end_gaps(reg, D, free)[0]
                        P2 = resample(fit_ends(reg, D, free), 0.5)
                        segs = TL.fit_path(P2, 0.3, 70)
                        D = bez_dense(segs, 0.5)
                        md = reg.medial_distance(resample(D, 0.5))
                        rep = {"segs": [np.round(c, 3).tolist() for c in segs], "medial_max": float(md.max()), "medial_p95": float(np.percentile(md, 95)),
                               "medial_med": float(np.median(md)), "len": plen(D)}
                if D is None:
                    problems.append({"id": sid, **rep})
                    continue
                if free:
                    g1, hw = end_gaps(reg, D, free)
                    rep["ends"] = {"free": free, "half_width": round(hw, 2), "gap_before": gap0, "gap": g1}
                out.append(dict(id=sid, word=w["id"], letter=li, ch=L["ch"], stroke=si, pts=D, classes=w["classes"],
                                numeral=bool(w.get("numeral")), check=rep, closed=bool(s.get("closed"))))
            if "dot" in L:
                dots.append((li, L))
        for li, L in dots:
            reg = regs[L.get("region", w["region"])]
            p = np.array(L["dot"], float)
            x0, y0 = reg.box[0], reg.box[1]
            cy, cx = (p[1] - y0) * UP, (p[0] - x0) * UP
            r = 2 * UP
            win = reg.v[int(cy - r):int(cy + r) + 1, int(cx - r):int(cx + r) + 1]
            iy, ix = np.unravel_index(int(np.argmax(win)), win.shape)
            c = np.array([x0 + (int(cx - r) + ix + 0.5) / UP, y0 + (int(cy - r) + iy + 0.5) / UP])
            peak = float(win.max())
            if L.get("dot_centre") == "ink":
                # revision 2: the ink centre of the dot (the letter mask's component under the
                # brightest pixel, intensity-weighted) instead of the brightest pixel itself
                c = dot_ink_centre(reg, int(cy - r) + iy, int(cx - r) + ix, c)
            u = np.array([0.22, 0.975]); u /= np.linalg.norm(u)
            D = np.array([c - 0.7 * u, c + 0.7 * u])
            sid = "%s-%02d-i-dot" % (w["id"], li + 1)
            out.append(dict(id=sid, word=w["id"], letter=li, ch="i-dot", stroke=9, pts=resample(D, 0.35), classes=w["classes"], numeral=False,
                            check={"dot": True, "peak": peak, "threshold": reg.thr, "in_letter_mask": bool(peak > reg.thr), "len": 1.4,
                                   "segs": [[c.tolist(), (c - 0.23 * u).tolist(), (c + 0.23 * u).tolist(), (c + 0.7 * u).tolist()]]},
                            closed=False))
            out[-1]["check"]["segs"] = [[(c - 0.7 * u).tolist(), (c - 0.23 * u).tolist(), (c + 0.23 * u).tolist(), (c + 0.7 * u).tolist()]]
    return out, problems, regs


def authoring_view(reg, out, scale=8, rgb=None):
    """Photo crop at `scale` x, letter boundary in yellow, skeleton in red, source-px ruler."""
    from PIL import ImageDraw
    from look import ruler
    x0, y0, x1, y1 = reg.box
    im = Image.open(SRC).convert("RGB").crop((x0, y0, x1, y1)).resize(((x1 - x0) * scale, (y1 - y0) * scale), Image.BICUBIC)
    arr = np.asarray(im).astype(float) * 0.6
    f = scale / UP
    edge = reg.bin & ~ni.binary_erosion(reg.bin)
    for (m, col) in ((edge, (255, 220, 0)), (reg.sk, (255, 30, 30))):
        ys, xs = np.nonzero(m)
        for y, x in zip(ys, xs):
            yy, xx = int((y + 0.5) * f), int((x + 0.5) * f)
            arr[max(0, yy - 1):yy + 1, max(0, xx - 1):xx + 1] = col
    im = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
    d = ImageDraw.Draw(im)
    for X in range(int(math.ceil(x0 / 5) * 5), x1 + 1, 5):
        d.line([((X - x0) * scale, 0), ((X - x0) * scale, im.size[1])], fill=(90, 90, 160) if X % 10 else (120, 120, 255), width=1)
    for Y in range(int(math.ceil(y0 / 5) * 5), y1 + 1, 5):
        d.line([(0, (Y - y0) * scale), (im.size[0], (Y - y0) * scale)], fill=(90, 90, 160) if Y % 10 else (120, 120, 255), width=1)
    ruler(im, x0, y0, scale)
    im.save(out)


if __name__ == "__main__":
    import sys
    from common import channels
    rgb, _ = channels()
    x0, y0, x1, y1 = map(int, sys.argv[1:5])
    ink = sys.argv[5]
    reg = Region((x0, y0, x1, y1), ink, rgb, thr_bias=float(sys.argv[7]) if len(sys.argv) > 7 else 0.0)
    print("otsu", reg.thr, "skeleton px", int(reg.sk.sum()))
    authoring_view(reg, sys.argv[6])
