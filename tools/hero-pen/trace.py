"""Trace kinds of the hero pen art (PEN_SPEC 12.2): guides snapped onto measured edges,
valleys and ridges of the photo, using tools/hero-drawing/trace_lines.py's snapping
(normal profiles + dynamic programming) and fitting (smoothing spline, Schneider cubics,
prior-regularised ellipse fit). Also the independent registration measurement (16.2).
"""
import math

import numpy as np
from scipy.ndimage import gaussian_filter1d, map_coordinates, median_filter

from common import TL, resample, plen, bez_dense


# ---------------------------------------------------------------- open strokes
def snap_open(guide, ch, mode="edge", r=6, spacing=2.0, lam=0.9, prior=0.15, pol=0, lsig=2.0,
              tol=0.7, gsmooth=1.5, jump=1.5, closed=False, slope=0.6):
    """Snap one guide polyline. Returns dense fitted points F, snapped points Q and the
    per-sample relative strength (as trace_lines.process does for non-ellipse guides)."""
    P = TL.smooth_guide(guide, spacing, gsmooth, closed)
    if len(P) < 3:
        P = resample(np.asarray(guide, float), spacing)
    Q, d, st = TL.snap(P, ch, r, pol=pol, lam=lam, prior=prior, spacing=spacing, maxslope=slope, mode=mode, lsig=lsig)
    if len(d) >= 5:
        dm = median_filter(d, size=min(len(d) // 2 * 2 + 1, 11), mode="mirror")
        bad = np.abs(d - dm) > jump
        d = np.where(bad, dm, d)
        Q = P + TL.normals(P) * d[:, None]
    F = TL.smooth_spline(Q, np.clip(st, 0.25, 1.0), tol, closed) if len(Q) >= 5 else resample(Q, 1.0)
    return F, Q, st


def weak_runs(st, spacing, thr, min_px=6.0):
    """Boolean keep-mask: False on runs where strength stays under thr for more than min_px."""
    st = np.asarray(st, float)
    keep = np.ones(len(st), bool)
    i = 0
    while i < len(st):
        if st[i] < thr:
            j = i
            while j < len(st) and st[j] < thr:
                j += 1
            if (j - i) * spacing > min_px:
                keep[i:j] = False
            i = j
        else:
            i += 1
    return keep


def fit_segments(F, err=0.5, corner=60):
    """Cubic Beziers within err src px; turns over `corner` degrees stay corners."""
    return TL.fit_path(np.asarray(F, float), err, corner)


def fit_line(Q, w=None):
    """Least-squares straight line through Q (weights w); returns the end points projected
    onto the line and the max / 95th-percentile deviation of Q from it."""
    Q = np.asarray(Q, float)
    w = np.ones(len(Q)) if w is None else np.asarray(w, float)
    c = (Q * w[:, None]).sum(0) / w.sum()
    U, S, Vt = np.linalg.svd((Q - c) * np.sqrt(w)[:, None], full_matrices=False)
    u = Vt[0]
    t = (Q - c) @ u
    a, b = c + u * t.min(), c + u * t.max()
    if np.dot(b - a, Q[-1] - Q[0]) < 0:
        a, b = b, a
    dev = np.abs((Q - c) @ np.array([-u[1], u[0]]))
    return a, b, float(dev.max()), float(np.percentile(dev, 95))


# ---------------------------------------------------------------- ellipses
def ellipse_direct(P):
    """Fitzgibbon direct least-squares ellipse; returns cx, cy, rx, ry, angle_deg
    in trace_lines' convention (rx along the rotated x axis)."""
    P = np.asarray(P, float)
    x, y = P[:, 0], P[:, 1]
    mx, my = x.mean(), y.mean()
    sx = max(np.abs(x - mx).max(), 1e-6)
    sy = max(np.abs(y - my).max(), 1e-6)
    xn, yn = (x - mx) / sx, (y - my) / sy
    D = np.column_stack([xn * xn, xn * yn, yn * yn, xn, yn, np.ones_like(xn)])
    S = D.T @ D
    C = np.zeros((6, 6)); C[0, 2] = C[2, 0] = 2; C[1, 1] = -1
    import scipy.linalg as sl
    ev, evec = sl.eig(S, C)
    ev = np.real(ev)
    i = [k for k in range(6) if np.isfinite(ev[k]) and ev[k] > 0]
    a = np.real(evec[:, i[0]])
    A, B, Cc, Dd, E, F = a
    # un-normalise
    A2 = A / sx ** 2; B2 = B / (sx * sy); C2 = Cc / sy ** 2
    D2 = Dd / sx - 2 * A * mx / sx ** 2 - B * my / (sx * sy)
    E2 = E / sy - 2 * Cc * my / sy ** 2 - B * mx / (sx * sy)
    F2 = F + A * mx ** 2 / sx ** 2 + B * mx * my / (sx * sy) + Cc * my ** 2 / sy ** 2 - Dd * mx / sx - E * my / sy
    M0 = np.array([[F2, D2 / 2, E2 / 2], [D2 / 2, A2, B2 / 2], [E2 / 2, B2 / 2, C2]])
    M = np.array([[A2, B2 / 2], [B2 / 2, C2]])
    cx, cy = np.linalg.solve(M, [-D2 / 2, -E2 / 2])
    lam, V = np.linalg.eigh(M)
    det0 = np.linalg.det(M0)
    detM = np.linalg.det(M)
    r = [math.sqrt(abs(-det0 / (detM * l))) for l in lam]
    # major/minor along eigenvectors; express as rx along angle of first eigenvector
    ang = math.degrees(math.atan2(V[1, 0], V[0, 0]))
    return float(cx), float(cy), float(r[0]), float(r[1]), float(ang)


def ellipse_pts(ex, a0, a1, step=1.0):
    cx, cy, rx, ry, ang = ex
    n = max(8, int(abs(a1 - a0) / 360 * 2 * math.pi * max(rx, ry) / step))
    return TL.ellipse_points(cx, cy, rx, ry, ang, a0, a1, step) if n else None


def snap_ellipse(guide, ch, r=5, minstrength=0.3, prior_w=0.15, spacing=2.0):
    """Fit an ellipse to the guide, snap its samples, refit with the guide as prior.
    Returns the ellipse, the parametric angles, per-angle snapped strength."""
    ex0 = ellipse_direct(guide)
    P = TL.ellipse_points(*ex0, 0, 360, spacing)
    Q, d, st = TL.snap(P, ch, r, spacing=spacing)
    keep = st > minstrength
    ex = TL.fit_ellipse_prior(Q[keep], ex0, prior_w) if keep.sum() >= 8 else ex0
    rms = float(np.sqrt(np.mean(TL.ellipse_residual(Q[keep], *ex) ** 2))) if keep.sum() else 0.0
    ang = np.array([TL.param_angle(ex, q) for q in Q])
    return ex, ex0, ang, st, rms


# ---------------------------------------------------------------- registration (PEN_SPEC 16.2)
def response(ch, xs, ys, mode, step, lsig=2.0, chw=(1.0, 1.0, 1.0, 1.0)):
    if mode in ("valley", "ridge"):
        v = map_coordinates(ch[0], [ys.ravel(), xs.ravel()], order=1, mode="nearest").reshape(xs.shape)
        v = gaussian_filter1d(v, lsig / step, axis=1, mode="nearest")
        d2 = np.gradient(np.gradient(v, step, axis=1), step, axis=1)
        return np.maximum(0, d2 if mode == "valley" else -d2) * lsig ** 2
    E2 = np.zeros(xs.shape, np.float64)
    for ci, c in enumerate(ch):
        v = map_coordinates(c, [ys.ravel(), xs.ravel()], order=1, mode="nearest").reshape(xs.shape)
        d = np.gradient(v, step, axis=1)
        E2 += chw[ci] * d ** 2
    return np.sqrt(E2)


def line_response(P, ch, mode, lsig=2.0, reach=1.0):
    """Absolute edge / valley / ridge response on the line itself (max within +-reach px)."""
    P = np.asarray(P, float)
    N = TL.normals(P)
    step = 0.25
    offs = np.arange(-reach, reach + 1e-6, step)
    xs = P[:, 0:1] + N[:, 0:1] * offs[None, :]
    ys = P[:, 1:2] + N[:, 1:2] * offs[None, :]
    return response(ch, xs, ys, mode, step, lsig=lsig).max(1)


ABS_MIN = {"edge": 4.0, "valley": 2.0, "ridge": 2.0}   # about the 10th percentile of on-edge responses (calibrated 2026-11-07)


def registration(pts, ch, mode="edge", reach=4.0, spacing=2.0, lsig=2.0):
    """Independent check that a drawn polyline lies on a real edge / valley / ridge.

    For each sample every `spacing` src px along the drawn line, read the photo's edge
    response along the normal within +-reach px and take the nearest local maximum whose
    absolute strength is at least ABS_MIN[mode]. Returns per-sample offsets (inf when no
    such maximum exists) and the summary used by the gates."""
    P = resample(np.asarray(pts, float), spacing)
    if len(P) < 3:
        return dict(n=len(P), within1=0.0, within2=0.0, median=float("inf")), np.full(len(P), np.inf)
    N = TL.normals(P)
    step = 0.25
    offs = np.arange(-reach, reach + 1e-6, step)
    xs = P[:, 0:1] + N[:, 0:1] * offs[None, :]
    ys = P[:, 1:2] + N[:, 1:2] * offs[None, :]
    E = response(ch, xs, ys, mode, step, lsig=lsig)
    out = np.full(len(P), np.inf)
    thr = ABS_MIN[mode]
    for i in range(len(P)):
        e = E[i]
        pk = [j for j in range(1, len(e) - 1) if e[j] >= e[j - 1] and e[j] >= e[j + 1] and e[j] >= thr]
        if pk:
            out[i] = min(abs(offs[j]) for j in pk)
    fin = np.isfinite(out)
    summ = dict(n=int(len(P)), within1=float(np.mean(out <= 1.0)), within2=float(np.mean(out <= 2.0)),
                median=float(np.median(out)) if fin.any() else float("inf"),
                noedge=float(np.mean(~fin)))
    return summ, out
