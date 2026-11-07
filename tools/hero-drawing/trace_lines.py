"""Trace the homepage hero photo into a pen-sketch SVG.

Every stroke starts as a hand-placed guide in guides.json (a rough polyline or an
ellipse, a few pixels off the real edge). The guide is then snapped onto the photo:
for each sample along the guide we read an intensity profile along the normal
(+-r px), measure the edge strength there, and choose one offset per sample with
dynamic programming (strong edge, smooth offset). The snapped points are smoothed,
simplified and fitted with cubic Beziers (or, for wheels, a fitted ellipse), so
every line lies on a real edge of the source photo.

usage (from the repo root or anywhere):
  python tools/hero-drawing/trace_lines.py [--debug DIR]        trace every guide
  python tools/hero-drawing/trace_lines.py --only ID,ID,...     trace only these guides and
      splice them into the existing traced-lines.svg (every other stroke keeps its bytes)

Requires numpy, scipy and pillow; opencv-python-headless when installed (otherwise the
channel preparation uses np_cv2.py, which reproduces it; --debug overlays need OpenCV).
Output: tools/hero-drawing/traced-lines.svg (photo pixel coordinates) and its record
traced-lines.json. The public drawing (assets/hero-drawing-20261027/hero-lines.svg, the
same drawing the homepage inlines) is derived from it by inline_hero_svg.cjs.
"""
import argparse, hashlib, json, math, re, sys
from datetime import date
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
try:
    import cv2
    CV = f"OpenCV {cv2.__version__}"
except ImportError:  # no OpenCV: NumPy/SciPy stand-ins for the channel preparation
    import np_cv2 as cv2
    CV = "np_cv2 (NumPy/SciPy stand-in for OpenCV's bilateralFilter, cvtColor BGR2LAB and GaussianBlur)"
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter1d, map_coordinates, median_filter

ROOT = HERE.parents[1]
SRC = ROOT / "assets" / "hero-fsae-track-2200.webp"
OUT = HERE / "traced-lines.svg"
GUIDES = HERE / "guides.json"
W, H = 2200, 1238

# ---------------------------------------------------------------- image channels

def load_channels():
    rgb = np.array(Image.open(SRC).convert("RGB"))
    assert rgb.shape[:2] == (H, W), rgb.shape
    bgr = np.ascontiguousarray(rgb[:, :, ::-1])
    sm = cv2.bilateralFilter(bgr, 7, 22, 4)
    sm = cv2.bilateralFilter(sm, 7, 22, 4)
    f = sm.astype(np.float32) / 255.0
    lin = np.where(f <= 0.04045, f / 12.92, ((f + 0.055) / 1.055) ** 2.4)
    Y = 0.0722 * lin[:, :, 0] + 0.7152 * lin[:, :, 1] + 0.2126 * lin[:, :, 2]
    logY = np.log(Y + 0.003)
    lab = cv2.cvtColor(f, cv2.COLOR_BGR2LAB)  # L 0..100, a/b roughly -100..100
    ch = np.stack([logY * 12.0, lab[:, :, 0], lab[:, :, 1] * 1.4, lab[:, :, 2] * 1.4])
    ch = np.stack([cv2.GaussianBlur(c, (0, 0), 0.9) for c in ch])
    return rgb, ch


# ---------------------------------------------------------------- geometry helpers

def catmull_rom(pts, spacing, closed=False):
    """Centripetal Catmull-Rom through the guide points, resampled every `spacing` px."""
    P = np.asarray(pts, float)
    if closed:
        P = np.vstack([P[-1], P, P[0], P[1]])
    else:
        P = np.vstack([2 * P[0] - P[1], P, 2 * P[-1] - P[-2]])
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        def tj(ti, a, b):
            return ti + max(np.linalg.norm(b - a), 1e-6) ** 0.5
        t0 = 0.0; t1 = tj(t0, p0, p1); t2 = tj(t1, p1, p2); t3 = tj(t2, p2, p3)
        n = max(2, int(np.linalg.norm(p2 - p1) / (spacing / 4)) + 1)
        for t in np.linspace(t1, t2, n, endpoint=False):
            a1 = (t1 - t) / (t1 - t0) * p0 + (t - t0) / (t1 - t0) * p1
            a2 = (t2 - t) / (t2 - t1) * p1 + (t - t1) / (t2 - t1) * p2
            a3 = (t3 - t) / (t3 - t2) * p2 + (t - t2) / (t3 - t2) * p3
            b1 = (t2 - t) / (t2 - t0) * a1 + (t - t0) / (t2 - t0) * a2
            b2 = (t3 - t) / (t3 - t1) * a2 + (t - t1) / (t3 - t1) * a3
            out.append((t2 - t) / (t2 - t1) * b1 + (t - t1) / (t2 - t1) * b2)
    out.append(P[-2] if not closed else P[1])
    return resample(np.array(out), spacing)


def polyline(pts, spacing):
    return resample(np.asarray(pts, float), spacing)


def resample(P, spacing):
    seg = np.linalg.norm(np.diff(P, axis=0), axis=1)
    s = np.concatenate([[0], np.cumsum(seg)])
    if s[-1] < 1e-6:
        return P[:1]
    n = max(2, int(round(s[-1] / spacing)) + 1)
    t = np.linspace(0, s[-1], n)
    return np.column_stack([np.interp(t, s, P[:, 0]), np.interp(t, s, P[:, 1])])


def normals(P):
    T = np.gradient(P, axis=0)
    T /= np.linalg.norm(T, axis=1, keepdims=True) + 1e-9
    return np.column_stack([-T[:, 1], T[:, 0]])


def ellipse_points(cx, cy, rx, ry, ang, a0, a1, spacing):
    """Points on an ellipse between parametric angles a0..a1 (degrees)."""
    n = max(8, int(abs(a1 - a0) / 360 * 2 * math.pi * max(rx, ry) / spacing))
    t = np.radians(np.linspace(a0, a1, n))
    c, s = math.cos(math.radians(ang)), math.sin(math.radians(ang))
    x = rx * np.cos(t); y = ry * np.sin(t)
    return np.column_stack([cx + c * x - s * y, cy + s * x + c * y])


# ---------------------------------------------------------------- snapping

def snap(P, ch, r, pol=0, lam=0.9, step=0.5, maxslope=0.6, prior=0.15, spacing=2.0,
         chw=(1.0, 1.0, 1.0, 1.0), mode="edge", lsig=2.0):
    """Move each sample of P along its normal onto the strongest coherent edge
    (mode "edge"), dark thin line ("valley", e.g. a black tube on asphalt) or
    bright thin line ("ridge", e.g. a tube highlight)."""
    N = normals(P)
    offs = np.arange(-r, r + 1e-6, step)
    K = len(offs)
    xs = P[:, 0:1] + N[:, 0:1] * offs[None, :]
    ys = P[:, 1:2] + N[:, 1:2] * offs[None, :]
    if mode in ("valley", "ridge"):
        v = map_coordinates(ch[0], [ys.ravel(), xs.ravel()], order=1, mode="nearest").reshape(xs.shape)
        v = gaussian_filter1d(v, lsig / step, axis=1, mode="nearest")
        d2 = np.gradient(np.gradient(v, step, axis=1), step, axis=1)
        E = np.maximum(0, d2 if mode == "valley" else -d2) * lsig ** 2
    else:
        E2 = np.zeros((len(P), K), np.float32)
        dlog = None
        for ci, c in enumerate(ch):
            v = map_coordinates(c, [ys.ravel(), xs.ravel()], order=1, mode="nearest").reshape(xs.shape)
            d = np.gradient(v, step, axis=1)
            if ci == 0:
                dlog = d
            E2 += chw[ci] * d ** 2
        E = np.sqrt(E2)
        if pol:
            E = np.where(np.sign(dlog) == np.sign(pol), E, E * 0.15)
    scale = np.percentile(E.max(axis=1), 70) + 1e-6
    S = E / scale - prior * np.abs(offs)[None, :] / max(r, 1)
    # Viterbi: maximise sum(S) - lam * |delta offset|
    maxd = max(1, int(round(maxslope * spacing / step)))
    acc = S[0].copy(); back = np.zeros((len(P), K), np.int32)
    idx = np.arange(K)
    for i in range(1, len(P)):
        best = np.full(K, -1e9); arg = np.zeros(K, np.int32)
        for dk in range(-maxd, maxd + 1):
            src = idx - dk
            ok = (src >= 0) & (src < K)
            cand = np.full(K, -1e9)
            cand[ok] = acc[src[ok]] - lam * abs(dk) * step
            better = cand > best
            best[better] = cand[better]; arg[better] = src[better]
        acc = best + S[i]; back[i] = arg
    k = np.zeros(len(P), np.int32); k[-1] = int(np.argmax(acc))
    for i in range(len(P) - 1, 0, -1):
        k[i - 1] = back[i, k[i]]
    # sub-pixel parabola refinement
    d = offs[k].astype(float)
    for i in range(len(P)):
        j = k[i]
        if 0 < j < K - 1:
            a, b, c = E[i, j - 1], E[i, j], E[i, j + 1]
            den = a - 2 * b + c
            if den < -1e-6:
                d[i] += float(np.clip(0.5 * (a - c) / den, -0.5, 0.5)) * step
    strength = E[np.arange(len(P)), k] / scale
    return P + N * d[:, None], d, strength


# ---------------------------------------------------------------- curve fitting

def rdp(P, eps):
    if len(P) < 3:
        return P
    a, b = P[0], P[-1]
    ab = b - a; L = np.linalg.norm(ab)
    if L < 1e-9:
        dist = np.linalg.norm(P - a, axis=1)
    else:
        dist = np.abs(ab[0] * (P[:, 1] - a[1]) - ab[1] * (P[:, 0] - a[0])) / L
    i = int(np.argmax(dist))
    if dist[i] > eps:
        return np.vstack([rdp(P[: i + 1], eps)[:-1], rdp(P[i:], eps)])
    return np.vstack([a, b])


def bez(ctrl, t):
    t = np.asarray(t)[:, None]
    p0, p1, p2, p3 = ctrl
    mt = 1 - t
    return mt ** 3 * p0 + 3 * mt ** 2 * t * p1 + 3 * mt * t ** 2 * p2 + t ** 3 * p3


def fit_cubic(P, t1, t2, err, depth=0):
    """Schneider's algorithm (Graphics Gems I)."""
    if len(P) == 2:
        d = np.linalg.norm(P[1] - P[0]) / 3
        return [np.array([P[0], P[0] + t1 * d, P[1] + t2 * d, P[1]])]
    u = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(P, axis=0), axis=1))])
    u /= u[-1]
    ctrl = gen_bezier(P, u, t1, t2)
    e, split = max_err(P, ctrl, u)
    if e < err:
        return [ctrl]
    if e < err * 4:
        for _ in range(12):
            u = reparam(P, ctrl, u)
            ctrl = gen_bezier(P, u, t1, t2)
            e, split = max_err(P, ctrl, u)
            if e < err:
                return [ctrl]
    if depth > 30:
        return [ctrl]
    split = min(max(split, 1), len(P) - 2)
    tc = P[split - 1] - P[split + 1]
    tc /= np.linalg.norm(tc) + 1e-9
    return fit_cubic(P[: split + 1], t1, tc, err, depth + 1) + fit_cubic(P[split:], -tc, t2, err, depth + 1)


def gen_bezier(P, u, t1, t2):
    a1 = np.outer(3 * (1 - u) ** 2 * u, t1)
    a2 = np.outer(3 * (1 - u) * u ** 2, t2)
    C = np.array([[np.sum(a1 * a1), np.sum(a1 * a2)], [np.sum(a1 * a2), np.sum(a2 * a2)]])
    p0, p3 = P[0], P[-1]
    base = bez(np.array([p0, p0, p3, p3]), u)
    tmp = P - base
    X = np.array([np.sum(a1 * tmp), np.sum(a2 * tmp)])
    det = C[0, 0] * C[1, 1] - C[0, 1] * C[1, 0]
    seg = np.linalg.norm(p3 - p0)
    if abs(det) > 1e-12:
        al = (X[0] * C[1, 1] - C[0, 1] * X[1]) / det
        ar = (C[0, 0] * X[1] - C[1, 0] * X[0]) / det
    else:
        al = ar = seg / 3
    eps = 1e-6 * seg
    if al < eps or ar < eps or al > seg * 1.5 or ar > seg * 1.5:
        al = ar = seg / 3
    return np.array([p0, p0 + t1 * al, p3 + t2 * ar, p3])


def max_err(P, ctrl, u):
    d = np.linalg.norm(bez(ctrl, u) - P, axis=1)
    i = int(np.argmax(d[1:-1])) + 1 if len(P) > 2 else 0
    return d[i], i


def reparam(P, ctrl, u):
    p0, p1, p2, p3 = ctrl
    q1 = np.array([3 * (p1 - p0), 3 * (p2 - p1), 3 * (p3 - p2)])
    q2 = np.array([2 * (q1[1] - q1[0]), 2 * (q1[2] - q1[1])])
    t = u[:, None]
    q = bez(ctrl, u)
    d1 = (1 - t) ** 2 * q1[0] + 2 * (1 - t) * t * q1[1] + t ** 2 * q1[2]
    d2 = (1 - t) * q2[0] + t * q2[1]
    num = np.sum((q - P) * d1, axis=1)
    den = np.sum(d1 * d1, axis=1) + np.sum((q - P) * d2, axis=1)
    nu = u - np.where(np.abs(den) > 1e-12, num / den, 0)
    return np.clip(nu, 0, 1)


def fit_path(P, err, corner_deg=55):
    """Split at sharp corners, then Schneider-fit each run."""
    S = rdp(P, 0.35)
    cuts = [0]
    for i in range(1, len(S) - 1):
        a = S[i] - S[i - 1]; b = S[i + 1] - S[i]
        ang = math.degrees(math.acos(np.clip(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-9), -1, 1)))
        if ang > corner_deg:
            cuts.append(int(np.argmin(np.linalg.norm(P - S[i], axis=1))))
    cuts.append(len(P) - 1)
    cuts = sorted(set(cuts))
    segs = []
    for a, b in zip(cuts[:-1], cuts[1:]):
        Q = P[a: b + 1]
        if len(Q) < 2:
            continue
        k = min(3, len(Q) - 1)
        t1 = Q[k] - Q[0]; t1 /= np.linalg.norm(t1) + 1e-9
        t2 = Q[-1 - k] - Q[-1]; t2 /= np.linalg.norm(t2) + 1e-9
        segs += fit_cubic(Q, t1, t2, err)
    return segs


def fit_ellipse(P, iters=3):
    """Least-squares ellipse (cv2) with outlier rejection; returns cx,cy,rx,ry,deg."""
    Q = P.astype(np.float32)
    for _ in range(iters):
        (cx, cy), (w, h), ang = cv2.fitEllipse(Q)
        res = ellipse_residual(P, cx, cy, w / 2, h / 2, ang)
        keep = res < max(1.2, np.percentile(res, 80))
        if keep.sum() < 6:
            break
        Q = P[keep].astype(np.float32)
    (cx, cy), (w, h), ang = cv2.fitEllipse(Q)
    return cx, cy, w / 2, h / 2, ang


def fit_ellipse_prior(P, ex0, prior_w=0.15):
    """Ellipse fit to snapped edge points, regularised towards the guide ellipse so a
    partly hidden wheel (lower half in shadow) cannot drift. Robust (soft L1) loss."""
    from scipy.optimize import least_squares
    cx0, cy0, rx0, ry0, a0 = ex0

    def res(p):
        cx, cy, rx, ry, a = p
        r = ellipse_residual(P, cx, cy, abs(rx) + 1e-3, abs(ry) + 1e-3, a)
        pr = prior_w * np.sqrt(len(P)) * np.array([(cx - cx0) / 4, (cy - cy0) / 4, (rx - rx0) / 4,
                                                   (ry - ry0) / 4, (a - a0) / 8])
        return np.concatenate([r, pr])
    sol = least_squares(res, [cx0, cy0, rx0, ry0, a0], loss="soft_l1", f_scale=1.0)
    cx, cy, rx, ry, a = sol.x
    return float(cx), float(cy), float(abs(rx)), float(abs(ry)), float(a)


def smooth_guide(pts, spacing, tol, closed=False):
    """Remove the pixel jitter of measured guide points with a smoothing spline."""
    P = np.asarray(pts, float)
    if len(P) < 4:
        return resample(P, spacing)
    return resample(smooth_spline(P, None, tol, closed), spacing)


def smooth_spline(Q, w, tol, closed=False):
    """Smoothest cubic spline within an RMS tolerance `tol` (px) of Q; dense output."""
    from scipy.interpolate import splprep, splev
    Q = np.asarray(Q, float)
    keep = np.concatenate([[True], np.hypot(*np.diff(Q, axis=0).T) > 1e-3])
    Q = Q[keep]
    if w is not None:
        w = np.asarray(w, float)[keep]
    if len(Q) < 5:
        return resample(Q, 1.0)
    if closed and np.hypot(*(Q[0] - Q[-1])) > 1e-3:
        Q = np.vstack([Q, Q[:1]])
        if w is not None:
            w = np.concatenate([w, w[:1]])
    wn = None if w is None else w / np.sqrt(np.mean(w ** 2))
    tck, u = splprep([Q[:, 0], Q[:, 1]], w=wn, s=len(Q) * tol ** 2, k=3, per=1 if closed else 0)
    L = np.hypot(*np.diff(Q, axis=0).T).sum()
    x, y = splev(np.linspace(0, 1, max(8, int(L / 1.5))), tck)
    F = np.column_stack([x, y])
    return F


def split_corners(pts):
    P = [list(p) for p in pts]
    return [[P[i], P[i + 1]] for i in range(len(P) - 1)]


def param_angle(ex, pt):
    cx, cy, rx, ry, ang = ex
    c, s = math.cos(math.radians(ang)), math.sin(math.radians(ang))
    x = (pt[0] - cx) * c + (pt[1] - cy) * s
    y = -(pt[0] - cx) * s + (pt[1] - cy) * c
    return math.degrees(math.atan2(y / ry, x / rx))


def ellipse_residual(P, cx, cy, rx, ry, ang):
    c, s = math.cos(math.radians(ang)), math.sin(math.radians(ang))
    x = (P[:, 0] - cx) * c + (P[:, 1] - cy) * s
    y = -(P[:, 0] - cx) * s + (P[:, 1] - cy) * c
    rho = np.sqrt((x / rx) ** 2 + (y / ry) ** 2)
    return np.abs(rho - 1) * min(rx, ry)


# ---------------------------------------------------------------- svg output

def fmt(v):
    s = f"{v:.1f}"
    if s.endswith(".0"):
        s = s[:-2]
    if s.startswith("0."):
        s = s[1:]
    elif s.startswith("-0."):
        s = "-" + s[2:]
    return s


def wfmt(w):
    s = f"{round(w, 2):g}"
    return s[1:] if s.startswith("0.") else s


def path_d(segs):
    """Relative cubic path; deltas computed from rounded absolute points (no drift)."""
    r = lambda p: np.round(np.asarray(p) * 10).astype(int)
    start = r(segs[0][0])
    d = "M" + fmt(start[0] / 10) + " " + fmt(start[1] / 10)
    cur = start
    for c in segs:
        p1, p2, p3 = r(c[1]), r(c[2]), r(c[3])
        nums = [(p1 - cur), (p2 - cur), (p3 - cur)]
        d += "c" + " ".join(fmt(v / 10) for n in nums for v in n)
        cur = p3
    return d.replace(" -", "-")


def ellipse_d(cx, cy, rx, ry, ang, a0, a1):
    """Elliptical arc between parametric angles a0..a1 (deg), split into <=180 deg arcs."""
    c, s = math.cos(math.radians(ang)), math.sin(math.radians(ang))
    def pt(a):
        t = math.radians(a)
        x, y = rx * math.cos(t), ry * math.sin(t)
        return cx + c * x - s * y, cy + s * x + c * y
    n = max(1, int(math.ceil(abs(a1 - a0) / 179.0)))
    angles = np.linspace(a0, a1, n + 1)
    x0, y0 = pt(angles[0])
    d = f"M{fmt(x0)} {fmt(y0)}"
    sweep = 1 if a1 > a0 else 0
    for a in angles[1:]:
        x, y = pt(a)
        d += f"A{fmt(rx)} {fmt(ry)} {fmt(ang)} 0 {sweep} {fmt(x)} {fmt(y)}"
    return d.replace(" -", "-")


def sample_segs(segs, n=12):
    return np.vstack([bez(c, np.linspace(0, 1, n)) for c in segs])


def dense_segs(segs, step=0.5):
    out = []
    for c in segs:
        L = np.linalg.norm(np.diff(bez(c, np.linspace(0, 1, 9)), axis=0), axis=1).sum()
        out.append(bez(c, np.linspace(0, 1, max(4, int(L / step)))))
    return np.vstack(out)


def curve_dev(Q, segs):
    """95th percentile distance (px) from the snapped edge points to the final curve."""
    from scipy.spatial import cKDTree
    D = dense_segs(segs)
    return float(np.percentile(cKDTree(D).query(Q)[0], 95))


# ---------------------------------------------------------------- main

PHASES = ["body", "wheels", "structure", "driver", "detail", "ground"]
WINDOWS = {"body": (0.0, 0.2), "wheels": (0.2, 0.38), "structure": (0.38, 0.6),
           "driver": (0.6, 0.74), "detail": (0.74, 0.88), "ground": (0.88, 1.0)}
GROUP_W = {"silhouette": 1.0, "structure": 0.7, "detail": 0.5, "ground": 0.4}


def process(guides, ch, debug=None):
    out = []
    for g in guides:
        if g.get("skip"):
            continue
        spacing = g.get("spacing", 2.0)
        r = g.get("r", 6)
        kw = dict(pol=g.get("pol", 0), lam=g.get("lam", 0.9), prior=g.get("prior", 0.15),
                  spacing=spacing, maxslope=g.get("slope", 0.6), mode=g.get("mode", "edge"),
                  lsig=g.get("lsig", 2.0))
        if "chw" in g:
            kw["chw"] = tuple(g["chw"])
        rec = {"id": g["id"], "group": g["group"], "phase": g["phase"]}
        if "ellipse" in g:
            ex0 = g["ellipse"]
            a0, a1 = g.get("fit", [0, 360])
            P = ellipse_points(*ex0, a0, a1, spacing)
            Q, d, st = snap(P, ch, r, **kw)
            keep = st > g.get("minstrength", 0.25)
            ex = fit_ellipse_prior(Q[keep], ex0, g.get("prior_w", 0.15)) if keep.sum() >= 8 else tuple(ex0)
            rec["fit_rms"] = float(np.sqrt(np.mean(ellipse_residual(Q[keep], *ex) ** 2))) if keep.sum() else 0.0
            e0, e1 = g.get("arc", [0, 360])
            if "arc_pts" in g:  # visible arc given by two image points and a direction
                e0 = param_angle(ex, g["arc_pts"][0])
                e1 = param_angle(ex, g["arc_pts"][1])
                if g.get("arc_dir", 1) > 0:
                    while e1 <= e0:
                        e1 += 360
                else:
                    while e1 >= e0:
                        e1 -= 360
            # cv2's angle convention: width along the rotated x axis
            rec["d"] = ellipse_d(ex[0], ex[1], ex[2], ex[3], ex[4], e0, e1)
            rec["ellipse"] = [round(float(v), 2) for v in ex]
            rec["pts"] = ellipse_points(*ex, e0, e1, 2.0)
            rec["guide"] = P; rec["snapped"] = Q; rec["strength"] = float(np.median(st))
            rec["off"] = float(np.abs(d).mean())
        else:
            closed = bool(g.get("closed"))
            runs = split_corners(g["pts"]) if g.get("corners") else [g["pts"]]
            allP, allQ, allst, alld, dense = [], [], [], [], []
            for run in runs:
                P = smooth_guide(run, spacing, g.get("gsmooth", 1.5), closed)
                if g.get("nosnap"):
                    Q, d, st = P, np.zeros(len(P)), np.ones(len(P))
                else:
                    Q, d, st = snap(P, ch, r, **kw)
                    # robust offsets: replace isolated jumps by the local median
                    dm = median_filter(d, size=min(len(d) // 2 * 2 + 1, 11), mode="mirror")
                    bad = np.abs(d - dm) > g.get("jump", 1.5)
                    d = np.where(bad, dm, d)
                    Q = P + normals(P) * d[:, None]
                F = smooth_spline(Q, np.clip(st, 0.25, 1.0), g.get("tol", 0.7), closed)
                if dense:
                    F[0] = dense[-1][-1]  # corner runs share their vertex
                dense.append(F); allP.append(P); allQ.append(Q); allst.append(st); alld.append(d)
            segs = []
            for F in dense:
                segs += fit_path(F, g.get("err", 0.5), g.get("corner", 70))
            rec["d"] = path_d(segs)
            rec["pts"] = dense_segs(segs, 1.5)
            P, Q, st, d = np.vstack(allP), np.vstack(allQ), np.concatenate(allst), np.concatenate(alld)
            rec["guide"] = P; rec["snapped"] = Q; rec["strength"] = float(np.median(st))
            rec["off"] = float(np.abs(d).mean())
            rec["dev"] = curve_dev(Q, segs)
        rec["w"] = g.get("w", GROUP_W[g["group"]])
        if "o" in g:  # an added stroke slotted between existing ones: its order is given
            rec["o"] = float(g["o"]); rec["fixed_o"] = True
        out.append(rec)
    # draw order: fixed phase windows; guide order within a phase (strokes with a given "o"
    # keep it and do not shift the others)
    for ph in PHASES:
        items = [o for o in out if o["phase"] == ph and not o.get("fixed_o")]
        a, b = WINDOWS[ph]
        for i, o in enumerate(items):
            o["o"] = a + (b - a) * (i / max(1, len(items)))
    return out


GROUPS = ["silhouette", "structure", "detail", "ground"]


def group_line(gname):
    return f'<g id="{gname}" data-w="{wfmt(GROUP_W[gname])}">'


def path_line(r):
    return (f'<path d="{r["d"]}" pathLength="1" data-o="{r["o"]:.3f}" data-w="{wfmt(r["w"])}" '
            f'vector-effect="non-scaling-stroke"/>')


def write_svg(recs, path):
    lines = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2200 1238" width="2200" height="1238" '
             'fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">']
    for gname in GROUPS:
        items = sorted([r for r in recs if r["group"] == gname], key=lambda r: r["o"])
        lines.append(group_line(gname))
        for r in items:
            lines.append(path_line(r))
        lines.append("</g>")
    lines.append("</svg>")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def preview(recs, path, crop=(0, 0, W, H), scale=1.0, width=2.4, bg=None):
    """Quick raster preview (4x supersampled) - evidence renders use a real browser."""
    x0, y0, x1, y1 = crop
    ss = 4
    w, h = int((x1 - x0) * scale), int((y1 - y0) * scale)
    im = np.full((h * ss, w * ss, 3), 255, np.uint8) if bg is None else cv2.resize(bg[y0:y1, x0:x1], (w * ss, h * ss))
    for r in recs:
        P = np.round((r["pts"] - [x0, y0]) * scale * ss).astype(np.int32)
        t = max(1, int(round(width * r["w"] * ss)))
        cv2.polylines(im, [P], False, (20, 22, 26), t, cv2.LINE_AA)
    im = cv2.resize(im, (w, h), interpolation=cv2.INTER_AREA)
    cv2.imwrite(str(path), im)


def debug_overlay(rgb, recs, outdir, crops):
    outdir.mkdir(parents=True, exist_ok=True)
    preview(recs, outdir / "lines_full.png", scale=0.65)
    preview(recs, outdir / "lines_car.png", crop=(860, 380, 1840, 960), scale=1.0, width=2.0)
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)
    lab[:, :, 0] = cv2.createCLAHE(4.0, (32, 18)).apply(lab[:, :, 0])
    base = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
    for name, (x0, y0, x1, y1, sc) in crops.items():
        im = cv2.resize(base[y0:y1, x0:x1], None, fx=sc, fy=sc, interpolation=cv2.INTER_CUBIC)
        im = (im * 0.55 + 255 * 0.15).astype(np.uint8)
        for r in recs:
            def tr(P):
                return np.round((P - [x0, y0]) * sc * 4).astype(np.int32)
            cv2.polylines(im, [tr(r["guide"])], False, (60, 60, 255), 1, cv2.LINE_AA, shift=2)
            cv2.polylines(im, [tr(r["pts"])], False, (40, 255, 40), 2, cv2.LINE_AA, shift=2)
            m = r["pts"][len(r["pts"]) // 2]
            if x0 <= m[0] < x1 and y0 <= m[1] < y1:
                cv2.putText(im, r["id"], (int((m[0] - x0) * sc) + 4, int((m[1] - y0) * sc) - 4),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.38, (0, 255, 255), 1, cv2.LINE_AA)
        cv2.imwrite(str(outdir / f"dbg_{name}.png"), im)


def svg_stats(svg_path):
    """sha256, bytes and per-group path counts of a traced SVG written by this file."""
    raw = svg_path.read_bytes()
    groups, cur = {}, None
    for line in raw.decode("utf-8").split("\n"):
        m = re.match(r'<g id="(\w+)"', line)
        if m:
            cur = m.group(1); groups[cur] = 0
        elif line.startswith("<path"):
            groups[cur] += 1
    return {"sha256": hashlib.sha256(raw).hexdigest(), "bytes": len(raw), "paths": sum(groups.values()), "groups": groups,
            "coordinates": "viewBox 0 0 2200 1238 = source photo pixels (no transform); coordinates rounded to 0.1 px"}


def stroke_entry(r):
    return {"id": r["id"], "group": r["group"], "phase": r["phase"], "data-o": round(r["o"], 3), "data-w": r["w"],
            "median_edge_strength": round(r["strength"], 2),
            **({"dev95_px": round(r["dev"], 2)} if "dev" in r else {}),
            **({"ellipse_fit_rms_px": round(r["fit_rms"], 2)} if "fit_rms" in r else {}),
            **({"added": r["added"]} if r.get("added") else {})}


def write_record(svg_path, strokes, src_sha, spec, runs):
    """The trace record (traced-lines.json next to the SVG). inline_hero_svg.cjs copies its source,
    statement, method, parameters and strokes into the public provenance.json."""
    prov = {
        "asset": "tools/hero-drawing/traced-lines.svg",
        "kind": "Traced master of the homepage hero line drawing (pen-sketch tracing). The public drawing, "
                "assets/hero-drawing-20261027/hero-lines.svg, is derived from it by inline_hero_svg.cjs.",
        "source": {"file": spec.get("source", "assets/hero-fsae-track-2200.webp"), "sha256": src_sha,
                   "pixels": [W, H], "note": "The public 2200 px hero photo already in the repo. No raw or private photo was used."},
        "svg": svg_stats(svg_path),
        "statement": [
            "This is a tracing derived from the public hero photo (hero-fsae-track-2200.webp) of Kefan Wu in the Olin Electric Motorsports FSAE car.",
            "Every stroke was snapped onto a measured edge (or, for thin tubes, the dark centre line) of that photo; nothing was drawn freehand.",
            "It adds no hardware that is not in the photo. Lines stop where an edge disappears into shadow instead of being completed by guesswork; no hatching, no texture.",
            "Wheel rims are fitted ellipses (least squares to the snapped edge points); the rest are smoothing-spline / cubic Bezier fits within about 1 px RMS of the edge points.",
            "Decals (numbers, sponsor text, logos), asphalt and grass texture and the sky were deliberately not traced; the 219 number plate is drawn only as its panel outline.",
            "The live hero still ends on the original photo pixels: the drawing is an overlay for the opening animation and the hero-fsae-track-*.webp files are unchanged.",
        ],
        "method": [
            "Edge-preserving smoothing (two bilateral passes), then channels: log luminance (lifts edges inside the black body and tyres), CIE L, a and b (chroma separates the blue stripes, grass and asphalt).",
            "Authoring aid (chains.py): Di Zenzo colour gradient + Canny hysteresis, thinned and linked into labelled edge chains; used only to measure where real edges are.",
            "Curation (author_guides.py): each stroke is a guide built from measured chain runs and luminance probes; strokes are grouped (silhouette, structure, detail, ground) and ordered like a designer sketching.",
            "Snapping (trace_lines.py): intensity profiles along the guide normals; per sample the strongest edge / tube centre is chosen by dynamic programming (edge strength minus a smoothness penalty), optional polarity, sub-pixel peak refinement and median outlier rejection.",
            "Fitting: smoothing cubic spline within a stroke-specific RMS tolerance (0.3-1.5 px), then Schneider cubic Bezier fit (max error 0.5 px) written as relative path data; ellipses for rims and the visible tyre-face arc.",
        ],
        "parameters": {"bilateral": "2 x (d=7, sigmaColor=22, sigmaSpace=4)", "channel_weights": "logY x12, L x1, a x1.4, b x1.4",
                       "profile_step_px": 0.5, "sample_spacing_px": 2.0, "bezier_max_error_px": 0.5,
                       "draw_order_windows": WINDOWS, "group_weights": GROUP_W},
        "strokes": strokes,
        "runs": runs,
        "generator": "tools/hero-drawing/ (author_guides.py -> guides.json -> trace_lines.py); see README.md",
    }
    svg_path.with_suffix(".json").write_text(json.dumps(prov, indent=1) + "\n", encoding="utf-8")


def splice_svg(recs, svg_path):
    """Insert (or replace) the given strokes in an existing traced SVG, each in its group at its
    data-o; every other line keeps its bytes."""
    lines = svg_path.read_text(encoding="utf-8").split("\n")
    for r in recs:
        tag = path_line(r)
        j = lines.index(group_line(r["group"])) + 1
        same = None
        while not lines[j].startswith("</g>"):
            o = float(re.search(r'data-o="([\d.]+)"', lines[j]).group(1))
            if abs(o - r["o"]) < 5e-4:
                same = j
                break
            if o > r["o"]:
                break
            j += 1
        if same is not None:
            lines[same] = tag
        else:
            lines.insert(j, tag)
    svg_path.write_text("\n".join(lines), encoding="utf-8")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--debug", type=Path)
    ap.add_argument("--out", type=Path, default=OUT)
    ap.add_argument("--report", type=Path)
    ap.add_argument("--only", help="comma-separated guide ids: trace only these and splice them into --out")
    a = ap.parse_args()
    spec = json.loads(GUIDES.read_text(encoding="utf-8"))
    sha = hashlib.sha256(SRC.read_bytes()).hexdigest()
    if spec.get("source_sha256") and spec["source_sha256"] != sha:
        sys.exit(f"source photo changed: {sha}")
    guides = spec["strokes"]
    only = [s for s in (a.only or "").split(",") if s]
    if only:
        missing = [s for s in only if s not in {g["id"] for g in guides}]
        if missing:
            sys.exit(f"no guide with id {missing}")
        bad = [g["id"] for g in guides if g["id"] in only and "o" not in g]
        if bad:
            sys.exit(f"--only needs a given data-o (\"o\") in each guide, so the other strokes keep theirs: {bad}")
        if not a.out.exists() or not a.out.with_suffix(".json").exists():
            sys.exit(f"--only splices into an existing {a.out.name} and its record; run a full trace first")
        guides = [g for g in guides if g["id"] in only]
    rgb, ch = load_channels()
    recs = process(guides, ch)
    for r, g in zip(recs, [g for g in guides if not g.get("skip")]):
        r["added"] = g.get("added")
    today = date.today().isoformat()
    if only:
        splice_svg(recs, a.out)
        old = json.loads(a.out.with_suffix(".json").read_text(encoding="utf-8"))
        prev = {s["id"]: s for s in old["strokes"]}
        new = {r["id"]: stroke_entry(r) for r in recs}
        strokes = [new.get(g["id"]) or prev[g["id"]] for g in spec["strokes"] if g["id"] in new or g["id"] in prev]
        runs = old.get("runs", []) + [{"date": today, "strokes": only, "channels": CV}]
    else:
        write_svg(recs, a.out)
        strokes = [stroke_entry(r) for r in recs]
        runs = [{"date": today, "strokes": "all", "channels": CV}]
    rep = [{k: (round(v, 3) if isinstance(v, float) else v) for k, v in r.items()
            if k in ("id", "group", "phase", "o", "w", "strength", "off", "dev", "fit_rms", "ellipse")} for r in recs]
    if a.report:
        a.report.parent.mkdir(parents=True, exist_ok=True)
        a.report.write_text(json.dumps(rep, indent=1), encoding="utf-8")
    if a.debug:
        debug_overlay(rgb, recs, a.debug, spec.get("debug_crops", {}))
        np.save(a.debug / "recs_pts.npy", np.array([r["pts"] for r in recs], dtype=object), allow_pickle=True)
    write_record(a.out, strokes, sha, spec, runs)
    st = svg_stats(a.out)
    print(f"{len(recs)} {'spliced' if only else 'traced'} ({CV}); {a.out.name}: {st['paths']} paths, {st['bytes']} bytes")
    for r in recs:
        print(f"  {r['id']}: data-o {r['o']:.3f}, median strength {r['strength']:.2f}"
              + (f", dev95 {r['dev']:.2f} px" if "dev" in r else ""))


if __name__ == "__main__":
    main()
