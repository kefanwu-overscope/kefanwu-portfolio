"""Revision 6: registration of a drawn line on ITS OWN member's edge (the critics' measure).

The generic check (trace.registration) takes the nearest edge response of any kind within +-4
src px, so a line drawn across a cluttered patch (the red block by the diagonal tube, the X
bracing behind the bar below the brace) can pass while it follows the wrong thing. This measure
asks a stricter question for one straight member: along the drawn line, every `spacing` src px,
read the luminance profile across the line (+-reach src px), and find the member's own edge: the
strongest luminance step of the member's polarity (dark on one named side). The offset of that
step from the drawn line is the registration. Polarity is given (+1: darker on the normal's
negative side, brighter on its positive side; the normal is the drawn direction turned +90 deg
on the y-down image, i.e. (−dy, dx)/L) or taken from the median sign of the strongest steps.

Pixel convention as everywhere in this pipeline: pixel (i, j) is centred on x = j, y = i.

`exclude` lists stretches (arc length in src px from the drawn start, [a, b]) where the member is
hidden behind something else in the photo (an occluder): they are reported apart and left out of
the score, never silently dropped.
"""
import math

import numpy as np
from scipy.ndimage import gaussian_filter, map_coordinates

import common as C

_LUM = None


def luminance(rgb=None):
    global _LUM
    if _LUM is None:
        if rgb is None:
            rgb, _ = C.channels()
        Y = (0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]).astype(np.float64)
        _LUM = gaussian_filter(Y, 0.7)
    return _LUM


def member_registration(pts, polarity=None, reach=4.0, spacing=1.0, step=0.125, min_step=12.0, exclude=(), rgb=None, pick="strongest"):
    """Returns (summary, per-sample records). Offsets are signed (src px along the normal)."""
    Y = luminance(rgb)
    P = C.resample(np.asarray(pts, float), spacing)
    n = len(P)
    T = np.gradient(P, axis=0)
    T /= np.hypot(*T.T)[:, None] + 1e-12
    N = np.column_stack([-T[:, 1], T[:, 0]])
    offs = np.arange(-reach, reach + 1e-9, step)
    xs = P[:, 0:1] + N[:, 0:1] * offs[None, :]
    ys = P[:, 1:2] + N[:, 1:2] * offs[None, :]
    v = map_coordinates(Y, [ys.ravel(), xs.ravel()], order=1, mode="nearest").reshape(xs.shape)
    d = np.gradient(v, step, axis=1)                         # luminance change per src px across the line
    s_arc = np.concatenate([[0], np.cumsum(np.hypot(*np.diff(P, axis=0).T))])
    if polarity is None:
        k = np.argmax(np.abs(d), axis=1)
        polarity = 1 if np.median(np.sign(d[np.arange(n), k])) >= 0 else -1
    dd = d * polarity
    recs = []
    for i in range(n):
        e = dd[i]
        pk = [j for j in range(1, len(e) - 1) if e[j] >= e[j - 1] and e[j] >= e[j + 1] and e[j] >= min_step]
        hid = any(a <= s_arc[i] <= b for a, b in exclude)
        if pk:
            # the member's edge: the strongest step of its polarity ("strongest"), or the nearest one ("nearest")
            j = max(pk, key=lambda j: e[j]) if pick == "strongest" else min(pk, key=lambda j: abs(offs[j]))
            recs.append(dict(s=round(float(s_arc[i]), 1), off=round(float(offs[j]), 3), strength=round(float(e[j]), 1), hidden=hid))
        else:
            recs.append(dict(s=round(float(s_arc[i]), 1), off=None, strength=0.0, hidden=hid))
    def summ(rs):
        o = np.array([abs(r["off"]) if r["off"] is not None else np.inf for r in rs])
        if not len(o):
            return dict(n=0)
        fin = np.isfinite(o)
        return dict(n=int(len(o)), within1=round(float(np.mean(o <= 1.0)), 3), within2=round(float(np.mean(o <= 2.0)), 3),
                    median=round(float(np.median(o[fin])), 3) if fin.any() else None, noedge=round(float(np.mean(~fin)), 3))
    vis = [r for r in recs if not r["hidden"]]
    hidden = [r for r in recs if r["hidden"]]
    out = dict(pick=pick, polarity=int(polarity), reach=reach, spacing=spacing, min_step=min_step, all=summ(recs), visible=summ(vis),
               hidden=summ(hidden) if hidden else None, exclude=[list(map(float, e)) for e in exclude])
    return out, recs


def fit_edge_line(a, b, polarity, reach=4.0, exclude=(), rgb=None):
    """Least-squares straight line through the member's measured edge points near the line a-b
    (one refit pass after dropping offsets over 1.5 src px from the first fit). Returns the line
    end points (projected from a and b), the residual max and the sample count."""
    pts = np.array([a, b], float)
    _, recs = member_registration(pts, polarity, reach=reach, exclude=exclude, rgb=rgb)
    P = C.resample(pts, 1.0)
    t = (pts[1] - pts[0]) / np.hypot(*(pts[1] - pts[0]))
    nrm = np.array([-t[1], t[0]])
    E = np.array([P[i] + nrm * r["off"] for i, r in enumerate(recs) if r["off"] is not None and not r["hidden"]])
    def fit(E):
        c = E.mean(0)
        u, s, vt = np.linalg.svd(E - c)
        dvec = vt[0]
        res = (E - c) @ vt[1]
        return c, dvec, res
    c, dvec, res = fit(E)
    keep = np.abs(res) <= 1.5
    c, dvec, res2 = fit(E[keep])
    def proj(p):
        return c + dvec * float(np.dot(np.asarray(p, float) - c, dvec))
    return dict(a=proj(a).round(2).tolist(), b=proj(b).round(2).tolist(), resid_max=round(float(np.abs(res2).max()), 2),
                resid_rms=round(float(np.sqrt(np.mean(res2 ** 2))), 2), n=int(keep.sum()), dropped=int((~keep).sum()),
                angle_deg=round(math.degrees(math.atan2(dvec[1], dvec[0])) % 180.0, 2))
