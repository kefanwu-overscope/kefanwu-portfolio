"""Hero pen art: inventory guides -> snapped strokes -> named, ordered, class-tagged strokes
-> gates -> out/strokes.json + out/provenance.json (PEN_SPEC sections 3, 4, 11, 12, 16.2).

usage: python build_art.py [--hatch body|tyre] [--out DIR]
The engine's build (a separate step) turns out/strokes.json into the inline data block and
the per-class schedules. README.md documents the shape of strokes.json.
"""
import argparse, hashlib, json, math, random, sys, time
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ni
from scipy.spatial import cKDTree

import common as C
from common import TL, resample, plen, sub, ccw, bez_dense
import trace as TR
import glyphs as GL
import features as FEAT
import member_edge as ME

SEED = 20261107
BITS = {"P": 1, "T": 2, "D": 4}
LINE_TIERS = "cynfda"
DENY_WORDS = ["wishbone", "toe", "tsal", "spoke", "rotor", "upright", "hub", "damper", "pushrod", "lamp", "brake", "suspension", "harness"]
DENY_FEATURES = ["top-names", "side-names-front", "side-names-rear", "top-t-logo", "top-tesla-word", "top-stripe-logo", "side-mark", "sae-mark",
                 "fw-hoosier-upper", "fw-hoosier-lower", "rw-hoosier-upper", "rw-hoosier-lower", "front-glint-long", "front-glint-curved",
                 "front-glint-small", "front-cluster", "front-parallel-lines", "front-lens-lit", "front-wishbones", "line-b", "line-d",
                 "white-junction", "rod-white-front", "ribbed-lens-ribs", "lower-rail-under", "beam-hole", "wires-orange", "blue-part-a", "blue-part-b",
                 "yellow-part", "white-lump", "comb-bits", "rod-lit-low", "shadow-streaks-rear", "rw-rim-inner-arc-b",
                 "rear-clutter", "nose-slot", "helmet-top-vent", "helmet-side-pod", "helmet-forehead-mark", "helmet-side-decal", "sleeve-inner-loop",
                 "dark-pack-right", "column-bands", "brace-tab", "top-flag-decal", "side-plate-crease", "column-mid", "rail-top-left-half",
                 "arch-stalk", "arch-top-object", "green-patch", "lower-body-contour", "lower-panel-terminator", "panel-seam-1165",
                 "fw-spoke-right", "fw-lit-mass", "fw-hub-hole", "fw-grain", "rw-grain", "rw-glints", "fw-contact", "rw-contact",
                 "steering-wheel", "front-hoop", "uprights", "far-rear-tyre"]
# Revision 4: "strut-short" left this list. The illustrator's spec put it among the rear clutter; the
# main loop's rear-bay decision lists the post below the bar (post-below-beam, which contains it) as a
# candidate member, and the rear-bay rule (straight, >= 55 src px, >= 0.90 registered, connected) gates it.
MIN_LEN = 40.0          # build gate: non-hatch, non-glyph strokes shorter than this are rejected (src px)
MASK_OUT = 10.0         # build gate: stroke midpoint more than this outside the car mask is rejected (src px)
SNAP_DEFAULTS = dict(lam=0.7, tol=0.45, prior=0.05)   # tighter than trace_lines defaults: measured registration (2026-11-07)
SPLIT_FLOOR_P1 = 0.3    # silhouette: split only where the edge really disappears (soft tyre and nose edges stay whole)
SPLIT_FLOOR = 0.5       # split where the absolute response stays under this x the registration floor for > 6 src px
REG_MIN_W2 = 0.80       # build gate: share of 2-px samples within 2 src px of a measured edge ("most of its length")


def log(*a):
    print(*a, flush=True)


# ================================================================== tracing features
class Tracer:
    def __init__(self, ch):
        self.ch = ch
        self.ch_a = np.stack([ch[2]])          # Lab a* (red-green) for red strap centre lines
        self.inv = C.load_json(C.INP / "inventory-guides.json")["features"]

    def chan(self, f):
        return self.ch_a if f.get("chan") == "a" else self.ch

    def guide(self, m):
        if "pts" in m:
            return np.asarray(m["pts"], float)
        g = np.asarray(self.inv[m["inv"]]["guides"][m.get("gi", 0)], float)
        return g[::-1].copy() if m.get("rev") else g

    def member(self, f, m):
        """Snap one member. Returns list of pieces: dict(F dense, kind, info)."""
        if m.get("tube_edge"):
            return [tube_member(m["tube_edge"])]
        if m.get("iso"):                                     # revision 6: amber-lens on its own R-B boundary
            F, info = iso_member(m["iso"])
            return [dict(F=F, info=info)]
        g = self.guide(m)
        opt = {k: m.get(k, f.get(k)) for k in ("lam", "tol", "pol", "lsig", "gsmooth", "prior", "spacing")}
        opt = {k: v for k, v in opt.items() if v is not None}
        for k, v in SNAP_DEFAULTS.items():
            opt.setdefault(k, v)
        mode = m.get("mode", f["mode"])
        r = m.get("r", f["r"])
        ch = self.chan(f)
        if m.get("nosnap"):
            return [dict(F=resample(g, 1.0), info={"nosnap": True})]
        if m.get("corners"):
            closed = f.get("closed", False) and np.hypot(*(g[0] - g[-1])) < 1.0
            runs = [[g[i], g[i + 1]] for i in range(len(g) - 1)]
            dense = []
            for run in runs:
                P = resample(np.asarray(run, float), 2.0)
                Q, d, st = TL.snap(P, ch, r, spacing=2.0, mode=mode, lam=opt.get("lam", 0.9))
                a, b, dev, dev95 = TR.fit_line(Q, np.clip(st, 0.2, 1.0))
                dense.append((a, b))
            # corners = intersections of consecutive fitted sides
            n = len(dense)
            pts = []
            for i in range(n):
                a1, b1 = dense[i - 1] if (closed or i > 0) else (None, None)
                a2, b2 = dense[i]
                if a1 is None:
                    pts.append(a2)
                    continue
                pts.append(line_x(a1, b1, a2, b2))
            if not closed:
                pts.append(dense[-1][1])
            else:
                pts.append(pts[0])
            return [dict(F=np.array(pts), info={"polygon": True, "corner_all": True})]
        if m.get("straight"):
            F0, Q, st = TR.snap_open(g, ch, mode=mode, r=r, **opt)
            a, b, dev, dev95 = TR.fit_line(Q, np.clip(st, 0.2, 1.0))
            return [dict(F=resample(np.array([a, b]), 1.0), info={"straight": True, "dev_max": round(dev, 2), "dev95": round(dev95, 2)})]
        # the smoothing spline pulls a free end inward by a few px: snap a guide extended 6 px
        # along its end tangents, then cut the result back at the original guide ends
        if not f.get("closed") and len(g) >= 2 and plen(g) > 12:
            t0 = g[0] - g[1]; t0 /= np.linalg.norm(t0) + 1e-9
            t1 = g[-1] - g[-2]; t1 /= np.linalg.norm(t1) + 1e-9
            gx = np.vstack([g[0] + 6 * t0, g, g[-1] + 6 * t1])
            F, Q, st = TR.snap_open(gx, ch, mode=mode, r=r, closed=False, **opt)
            Fr = resample(F, 0.5)
            i0 = int(np.argmin(np.hypot(*(Fr - g[0]).T)))
            i1 = int(np.argmin(np.hypot(*(Fr - g[-1]).T)))
            if i1 - i0 >= 4:
                F = Fr[i0: i1 + 1]
        else:
            F, Q, st = TR.snap_open(g, ch, mode=mode, r=r, closed=False, **opt)
        if m.get("nosplit") or f.get("nosplit"):
            return [dict(F=F, info={})]
        # "lines stop where an edge disappears": absolute edge response on the fitted line,
        # split where it stays under the floor for more than 6 src px; drop leftovers under 12 px
        Fd = resample(F, 1.0)
        resp = TR.line_response(Fd, ch, mode, lsig=opt.get("lsig", 2.0))
        floor = SPLIT_FLOOR_P1 if f.get("phase") == 1 else SPLIT_FLOOR
        keep = TR.weak_runs(resp >= TR.ABS_MIN[mode] * floor, 1.0, 0.5, 6.0)
        if keep.all():
            return [dict(F=F, info={})]
        pieces, cur = [], []
        for i, k in enumerate(keep):
            if k:
                cur.append(Fd[i])
            else:
                if len(cur) > 1 and plen(np.array(cur)) >= 12:
                    pieces.append(dict(F=np.array(cur), info={"split_weak": True}))
                cur = []
        if len(cur) > 1 and plen(np.array(cur)) >= 12:
            pieces.append(dict(F=np.array(cur), info={"split_weak": True}))
        return pieces


def line_x(a1, b1, a2, b2):
    d1 = b1 - a1; d2 = b2 - a2
    den = d1[0] * d2[1] - d1[1] * d2[0]
    if abs(den) < 1e-9:
        return (b1 + a2) / 2
    t = ((a2[0] - a1[0]) * d2[1] - (a2[1] - a1[1]) * d2[0]) / den
    p = a1 + t * d1
    if np.hypot(*(p - (b1 + a2) / 2)) > 6:          # near-parallel sides: do not shoot off
        return (b1 + a2) / 2
    return p


def assemble(f, pieces_per_member, members):
    """Join member pieces into strokes: bridge gaps <= 6 src px with ink, lift otherwise."""
    strokes, cur, corners = [], None, []
    for m, pieces in zip(members, pieces_per_member):
        for k, pc in enumerate(pieces):
            F = np.asarray(pc["F"], float)
            if cur is None:
                cur, corners = F.copy(), []
                if pc["info"].get("corner_all"):
                    corners += list(range(1, len(F) - 1))
                continue
            gap = float(np.hypot(*(F[0] - cur[-1])))
            prev_info = pieces_per_member[members.index(m) - 1][-1]["info"] if members.index(m) > 0 else {}
            # revision 7 (polish): 'corner_x' on a straight member after a member that is not straight (a set
            # polyline): the corner is where this member's line meets the previous member's last 3 src px chord, so
            # the stroke turns once, at the true corner (hoop-column: the column's top edge into its left edge),
            # instead of a short link to the straight fit's start and a second pen stop beside the first
            if k == 0 and m.get("corner") and m.get("corner_x") and pc["info"].get("straight") and len(cur) >= 2:
                R_ = resample(cur, 0.5)
                X = line_x(R_[max(0, len(R_) - 7)], R_[-1], F[0], F[-1])
                if np.hypot(*(X - cur[-1])) <= 3 and np.hypot(*(X - F[0])) <= 3:
                    if np.hypot(*(X - cur[-1])) > 0.05:
                        cur = np.vstack([cur, X])
                    corners.append(len(cur) - 1)
                    cur = np.vstack([cur, resample(np.array([X, F[-1]]), 1.0)[1:]])
                    continue
            if k == 0 and m.get("corner") and pc["info"].get("straight") and prev_info.get("straight") and len(cur) >= 2:
                st0 = corners[-1] if corners else 0
                X = line_x(np.asarray(cur[st0], float), np.asarray(cur[-1], float), F[0], F[-1])
                if np.hypot(*(X - cur[-1])) <= 10 and np.hypot(*(X - F[0])) <= 10:
                    run = resample(np.array([cur[st0], X]), 1.0)
                    cur = np.vstack([cur[:st0], run]) if st0 > 0 else run
                    corners.append(len(cur) - 1)
                    cur = np.vstack([cur, resample(np.array([X, F[-1]]), 1.0)[1:]])
                    continue
            if gap <= 6.0 and not (m.get("corner") and k == 0) and len(cur) > 8 and len(F) > 8:
                # tangent join (no corner): blend the two members over +-12 src px so a small
                # offset between their snapped ends does not show as a notch
                A_ = resample(cur, 1.0); B_ = resample(F, 1.0)
                A_ = A_[: max(2, len(A_) - 4)]; B_ = B_[min(4, len(B_) - 2):]
                J = np.vstack([A_, B_])
                j0 = len(A_)
                w = np.zeros(len(J)); w[max(0, j0 - 12): j0 + 12] = 1.0
                Js = np.column_stack([ni.gaussian_filter1d(J[:, 0], 3.0, mode="nearest"), ni.gaussian_filter1d(J[:, 1], 3.0, mode="nearest")])
                ww = ni.gaussian_filter1d(w, 3.0)[:, None]
                cur = J * (1 - ww) + Js * ww
                corners = [c for c in corners if c < len(A_)]
                continue
            if gap <= 6.0:
                base = len(cur) - 1
                if m.get("corner") and k == 0:
                    corners.append(base + (1 if gap > 0.5 else 0))
                cur = np.vstack([cur, F if gap > 0.5 else F[1:]])
                if pc["info"].get("corner_all"):
                    corners += [base + 1 + j for j in range(1, len(F) - 1)]
            else:
                strokes.append((cur, corners))
                cur, corners = F.copy(), []
    if cur is not None:
        strokes.append((cur, corners))
    return strokes


def finish_stroke(P, corner_idx, closed=False, err=0.5):
    """Fit cubic Beziers, keeping the authored corners (and turns over 60 deg) as corners."""
    P = np.asarray(P, float)
    if closed and np.hypot(*(P[0] - P[-1])) > 0.5:
        P = np.vstack([P, P[:1]])
    cut = sorted(set([0] + [int(i) for i in corner_idx if 0 < i < len(P) - 1] + [len(P) - 1]))
    segs, cflags = [], []
    for a, b in zip(cut[:-1], cut[1:]):
        Q = P[a:b + 1]
        if len(Q) < 2 or plen(Q) < 1e-6:
            continue
        Qd = resample(Q, 1.0) if len(Q) > 2 or plen(Q) > 2 else Q
        if len(Qd) < 2:
            continue
        part = TL.fit_path(Qd, err, 60)
        if segs:
            cflags.append(len(segs))
        segs += part
    # extra corners from the fit itself (turns over 60 deg between consecutive segments)
    allc = set(cflags)
    for k in range(1, len(segs)):
        t1 = segs[k - 1][3] - segs[k - 1][2]
        t2 = segs[k][1] - segs[k][0]
        n1, n2 = np.hypot(*t1), np.hypot(*t2)
        if n1 > 1e-6 and n2 > 1e-6:
            ang = math.degrees(math.acos(np.clip(np.dot(t1, t2) / n1 / n2, -1, 1)))
            if ang > 60:
                allc.add(k)
    D = bez_dense(segs, 0.5)
    return D, segs, sorted(allc)


# ================================================================== ellipses: rim arcs and ghosts
def lip_samples(rgb, box, step=1):
    """Revision 2: the lit rim-lip highlight, one sample per src px column in box (x0, x1, y0, y1):
    the brightest row (mean RGB, Gaussian 0.8), refined by a parabola."""
    x0, x1, y0, y1 = box
    Lm = ni.gaussian_filter(rgb[y0 - 3: y1 + 4, x0 - 3: x1 + 4].astype(np.float32).mean(2), 0.8)
    out = []
    for x in range(x0, x1 + 1, step):
        col = Lm[3: 3 + (y1 - y0) + 1, x - x0 + 3]
        k = int(np.argmax(col))
        dk = 0.0
        if 0 < k < len(col) - 1:
            a, b, c = col[k - 1], col[k], col[k + 1]
            den = a - 2 * b + c
            dk = float(np.clip(0.5 * (a - c) / den, -0.5, 0.5)) if abs(den) > 1e-6 else 0.0
        out.append([float(x), y0 + k + dk])
    return np.array(out)


def rim_arcs(tracer, inv_id, name, seen_thr=0.35, lip=None, lip_w=4, rgb=None):
    g = np.asarray(tracer.inv[inv_id]["guides"][0], float)
    ex, ex0, ang, st, rms = TR.snap_ellipse(g, tracer.ch, r=5, minstrength=0.3, prior_w=0.2)
    lip_rec = None
    if lip is not None:
        # revision 2 (critic): the least-squares fit put the top of the front rim 4-8 src px above
        # the visible lit lip (x 1446-1470, y 802-806). Refit with those lip samples weighted in.
        P = TL.ellipse_points(*ex0, 0, 360, 2.0)
        Q, d, st0 = TL.snap(P, tracer.ch, 5, spacing=2.0)
        keep = st0 > 0.3
        S = lip_samples(rgb, lip)
        Qa = np.vstack([Q[keep]] + [S] * lip_w)
        ex_old = ex
        ex = TL.fit_ellipse_prior(Qa, ex0, 0.2)
        rms = float(np.sqrt(np.mean(TL.ellipse_residual(Q[keep], *ex) ** 2)))
        ang = np.array([TL.param_angle(ex, q) for q in Q])
        st = st0
        res_lip = TL.ellipse_residual(S, *ex)
        res_lip_old = TL.ellipse_residual(S, *ex_old)
        lip_rec = dict(box=list(lip), samples=len(S), weight=lip_w, lip_offset_before_max=round(float(res_lip_old.max()), 2),
                       lip_offset_after_max=round(float(res_lip.max()), 2), lip_offset_after_median=round(float(np.median(res_lip)), 2),
                       ellipse_before=[round(v, 3) for v in ex_old])
    # strength per degree (circular), smoothed; seen arc = longest run over seen_thr
    deg = np.mod(np.round(ang).astype(int), 360)
    prof = np.zeros(360); cnt = np.zeros(360)
    for d_, s_ in zip(deg, st):
        prof[d_] += s_; cnt[d_] += 1
    prof = np.where(cnt > 0, prof / np.maximum(cnt, 1), np.nan)
    idx = np.arange(360)
    good = ~np.isnan(prof)
    prof = np.interp(idx, idx[good], prof[good], period=360)
    prof = ni.uniform_filter1d(prof, 21, mode="wrap")
    ok = prof > seen_thr
    best, bs = (0, 0), None
    if ok.all():
        best = (0, 360)
    else:
        start = int(np.argmin(ok))           # a False position
        run = 0
        for k in range(1, 361):
            i = (start + k) % 360
            if ok[i]:
                if run == 0:
                    bs = i
                run += 1
                if run > best[1] - best[0]:
                    best = (bs, bs + run)
            else:
                run = 0
    a0, a1 = best
    return dict(ellipse=ex, guide_ellipse=ex0, rms=rms, seen=(a0, a1), prof=prof, lip=lip_rec)


# Revision 3 (truth critic): the rim fits in deep black (fw-rim-fit, rw-rim-fit) touched the inner
# edge of the white sidewall lettering by 2-4 src px. The lettering is never traced; the fit must stay
# at least LETTER_CLEAR src px inside it. Letter pixels: luminance (mean RGB, Gaussian 0.5) over
# LETTER_THR in a 4x bicubic crop, in components whose centroid lies outside the rim ellipse (rim
# highlights lie inside). Where a fit sample is closer than LETTER_CLEAR, it moves inward along the
# ellipse normal; the shift is widened (max filter), smoothed and kept at or above the need, and is
# zero at both ends of the arc (where it meets the seen arc).
LETTER_THR = 70.0
LETTER_CLEAR = 1.0
LETTER_UP = 4
_LETTERS = {}
# Revision 5 (critic, main loop): every rise and fall of the inward shift spans at least BLEND src px.
# The envelope's half-width is BLEND_W = 2 x BLEND: at 12 src px the full 1.35 src px fall at the rim's
# bottom kept a peak slope of 0.21 src px per src px (0.27 before), so the drop the critic measured
# (0.64 src px) still took about 4.5 src px; at 24 src px the peak slope is about 0.1.
# fw-rim-fit's shift dropped from 0.98 to 0.34 src px over about 4 src px at the rim's bottom (between
# (1452.4, 891.1) and (1444.6, 892.6)), where the last letter contact ends: a 1-device-px step at 1440
# DPR 2. The shift is now the upper envelope of the old shift under a raised-cosine taper of half-width
# BLEND (so it can neither rise nor fall in less than BLEND src px), and the end zones (where the fit
# meets its seen arc) ramp in with a smoothstep over BLEND src px instead of a straight 8 src px ramp.
BLEND = 12.0
BLEND_W = 24.0      # half-width of the raised-cosine envelope (src px)
END_ZONE = 13.0     # the smoothstep ramp at a junction with the seen arc (>= BLEND once multiplied with a falling shift)


def taper_envelope(v, w):
    """max_j v[j] * c(|i - j| / w), c(t) = (1 + cos(pi t)) / 2 for t < 1: the shift can change by its
    full height only over w samples (a raised-cosine dilation)."""
    v = np.asarray(v, float)
    out = v.copy()
    n = len(v)
    w = int(round(w))
    for d in range(1, w + 1):
        c = 0.5 * (1 + math.cos(math.pi * d / w))
        out[d:] = np.maximum(out[d:], v[:n - d] * c)
        out[:n - d] = np.maximum(out[:n - d], v[d:] * c)
    return out


def blend_runs(sh, step=0.5, amp=0.2):
    """Monotone runs of the shift profile whose height change is at least amp src px: [kind, from s,
    to s, length, height, max slope] (src px), for the record and the blend gate."""
    sh = np.asarray(sh, float)
    d = np.diff(sh)
    out = []
    i, n = 0, len(d)
    while i < n:
        if abs(d[i]) < 1e-9:
            i += 1
            continue
        sg = np.sign(d[i])
        j = i
        while j + 1 < n and (np.sign(d[j + 1]) == sg or abs(d[j + 1]) < 1e-9):
            j += 1
        h = abs(sh[j + 1] - sh[i])
        if h >= amp:
            out.append(["rise" if sg > 0 else "fall", round(i * step, 1), round((j + 1) * step, 1), round((j + 1 - i) * step, 1), round(float(h), 2),
                        round(float(np.abs(d[i:j + 1]).max() / step), 3)])
        i = j + 1
    return out


def ellipse_rho(ex, P):
    cx, cy, rx, ry, ang = ex
    c, s_ = math.cos(math.radians(ang)), math.sin(math.radians(ang))
    dx, dy = P[:, 0] - cx, P[:, 1] - cy
    u = (c * dx + s_ * dy) / rx; v = (-s_ * dx + c * dy) / ry
    return np.hypot(u, v)


def letter_field(rgb, ex, key, tyre_ex=None):
    """Distance field (src px) to the sidewall letter pixels around rim ellipse ex: bright pixels
    outside the rim ellipse and at least 2 src px inside the tyre's silhouette (an ellipse fit of the
    traced tyre outline), so the asphalt beyond the tyre never joins a letter."""
    if key in _LETTERS:
        return _LETTERS[key]
    cx, cy, rx, ry, ang = ex
    R = max(rx, ry) * 1.4 + 6
    x0, y0, x1, y1 = int(cx - R), int(cy - R), int(cx + R) + 1, int(cy + R) + 1
    L = ni.gaussian_filter(rgb[y0:y1, x0:x1].astype(np.float32).mean(2), 0.5)
    big = np.asarray(Image.fromarray(np.clip(L, 0, 255).astype(np.uint8)).resize(((x1 - x0) * LETTER_UP, (y1 - y0) * LETTER_UP), Image.BICUBIC)).astype(np.float32)
    m = big > LETTER_THR
    if tyre_ex is not None:
        jy, jx = np.mgrid[0:big.shape[0], 0:big.shape[1]]
        G_ = np.column_stack([x0 + (jx.ravel() + 0.5) / LETTER_UP - 0.5, y0 + (jy.ravel() + 0.5) / LETTER_UP - 0.5])
        inside = (ellipse_rho(tyre_ex, G_) <= 1.0 - 2.0 / max(tyre_ex[2], tyre_ex[3])) & (ellipse_rho(ex, G_) > 1.0)
        m &= inside.reshape(big.shape)
    lab, n = ni.label(m)
    ys, xs = np.nonzero(m)
    keep = np.zeros(n + 1, bool)
    if n:
        cnt = np.bincount(lab[ys, xs], minlength=n + 1).astype(float)
        mx = np.bincount(lab[ys, xs], weights=xs, minlength=n + 1) / np.maximum(cnt, 1)
        my = np.bincount(lab[ys, xs], weights=ys, minlength=n + 1) / np.maximum(cnt, 1)
        C_ = np.column_stack([x0 + (mx + 0.5) / LETTER_UP - 0.5, y0 + (my + 0.5) / LETTER_UP - 0.5])
        rho = ellipse_rho(ex, C_)
        keep = (rho > 1.0) & (cnt >= 1 * LETTER_UP * LETTER_UP)
        keep[0] = False
    letters = keep[lab] & m
    dist = ni.distance_transform_edt(~letters) / LETTER_UP
    F = dict(origin=(x0, y0), dist=dist, letters=letters, n_components=int(keep.sum()))
    _LETTERS[key] = F
    return F


def dist_to_letters(F, P):
    from scipy.ndimage import map_coordinates
    x0, y0 = F["origin"]
    # pixel-centre convention of the traced lines (pixel i centred on i): 4x pixel j centred on x0 + (j + 0.5) / 4 - 0.5
    jx = (P[:, 0] - x0 + 0.5) * LETTER_UP - 0.5
    jy = (P[:, 1] - y0 + 0.5) * LETTER_UP - 0.5
    return map_coordinates(F["dist"], [jy, jx], order=1, mode="nearest")


def letter_clearance(s, rgb, ex, key, tyre_ex=None, end_zone=END_ZONE, end_zone_e=None):
    # revision 4: end_zone_e is the zone at the end (default: end_zone); a free end (a cut fit arc) has none
    end_zone_e = end_zone if end_zone_e is None else end_zone_e
    P = resample(s["pts"], 0.5)
    F = letter_field(rgb, ex, key, tyre_ex)
    cx, cy = ex[0], ex[1]
    rho = ellipse_rho(ex, P)
    # inward normal: toward the centre along the gradient of rho
    eps = 0.05
    gx = (ellipse_rho(ex, P + [eps, 0]) - ellipse_rho(ex, P - [eps, 0])) / (2 * eps)
    gy = (ellipse_rho(ex, P + [0, eps]) - ellipse_rho(ex, P - [0, eps])) / (2 * eps)
    Nin = -np.column_stack([gx, gy]); Nin /= np.linalg.norm(Nin, axis=1)[:, None]
    d0 = dist_to_letters(F, P)
    need = np.zeros(len(P))
    for i in np.nonzero(d0 < LETTER_CLEAR + 0.3)[0]:
        for dd in np.arange(0.05, 6.0, 0.05):
            if dist_to_letters(F, (P[i] + dd * Nin[i])[None, :])[0] >= LETTER_CLEAR + 0.3:
                need[i] = dd
                break
        else:
            need[i] = 6.0
    rec = dict(samples=len(P), close_before=int((d0 < LETTER_CLEAR).sum()), min_dist_before=round(float(d0.min()), 2), letter_components=F["n_components"],
               threshold=LETTER_THR, clear=LETTER_CLEAR)
    cl_idx = np.nonzero(d0 < LETTER_CLEAR)[0]
    rec["contacts_before"] = [[round(float(P[i, 0]), 1), round(float(P[i, 1]), 1), round(float(d0[i]), 2), round(float(i * 0.5), 1)] for i in cl_idx[:: max(1, len(cl_idx) // 12)]]
    nz = int(round(end_zone / 0.5))
    nze = int(round(end_zone_e / 0.5))
    rec["need_in_end_zones"] = [round(float(need[:nz].max()), 2), round(float(need[-nze:].max()), 2) if nze else 0.0]
    rec["need_max"] = round(float(need.max()), 2)
    if need.max() > 0:
        sh = ni.maximum_filter1d(need, 15, mode="nearest")
        for _ in range(6):
            sh = np.maximum(ni.gaussian_filter1d(sh, 8.0, mode="nearest"), need)
        sh = ni.gaussian_filter1d(sh, 2.0, mode="nearest")
        sh = np.maximum(sh, need)
        # revision 5: no rise or fall shorter than BLEND src px (raised-cosine envelope), smoothstep end zones
        sh = taper_envelope(sh, BLEND_W / 0.5)
        n = len(sh)
        def _ss(x):
            x = np.clip(x, 0, 1)
            return x * x * (3 - 2 * x)
        ramp = np.minimum(_ss(np.arange(n) / float(nz)), _ss(np.arange(n)[::-1] / float(nze)) if nze else 1.0)
        sh = sh * ramp
        rec["blend_src_px"] = BLEND
        rec["envelope_half_width_src_px"] = BLEND_W
        rec["shift_max_slope"] = round(float(np.abs(np.diff(sh)).max() / 0.5), 3)
        rec["shift_runs"] = blend_runs(sh)
        Q = P + Nin * sh[:, None]
        D, segs, corners = finish_stroke(resample(Q, 0.5), [], closed=False, err=0.15)
        s.update(pts=D, segs=segs, corners=corners, L=plen(D))
        rec.update(shift_max=round(float(sh.max()), 2), shifted_samples=int((sh > 0.05).sum()),
                   shifted_x=[round(float(Q[sh > 0.05, 0].min()), 1), round(float(Q[sh > 0.05, 0].max()), 1)],
                   shifted_y=[round(float(Q[sh > 0.05, 1].min()), 1), round(float(Q[sh > 0.05, 1].max()), 1)])
    P1 = resample(s["pts"], 0.5)
    d1 = dist_to_letters(F, P1)
    c1 = np.nonzero(d1 < LETTER_CLEAR)[0]
    mid = np.zeros(len(P1), bool); mid[nz:len(P1) - nze] = True
    rec.update(end_zone_src_px=[end_zone, end_zone_e], min_dist_after_outside_end_zones=round(float(d1[mid].min()), 2),
               min_dist_after_in_end_zones=[round(float(d1[:nz].min()), 2), round(float(d1[-nze:].min()), 2) if nze else None])
    rec.update(min_dist_after=round(float(d1.min()), 2), close_after=int(len(c1)),
               contacts_after=[[round(float(P1[i, 0]), 1), round(float(P1[i, 1]), 1), round(float(d1[i]), 2), round(float(i * 0.5), 1)] for i in c1[:: max(1, len(c1) // 12)]])
    s["letter_clearance"] = rec
    return rec


JUNCTION = {}


def ellipse_tangent(ex, P):
    """Unit tangent of ellipse ex at the point of it nearest P (parametric angle from P)."""
    cx, cy, rx, ry, ang = ex
    c, s_ = math.cos(math.radians(ang)), math.sin(math.radians(ang))
    dx, dy = P[0] - cx, P[1] - cy
    u = (c * dx + s_ * dy) / rx; v = (-s_ * dx + c * dy) / ry
    t = math.atan2(v, u)
    tx, ty = -rx * math.sin(t), ry * math.cos(t)
    T = np.array([c * tx - s_ * ty, s_ * tx + c * ty])
    return T / np.linalg.norm(T)


def _heading(v):
    return math.degrees(math.atan2(v[1], v[0]))


def match_junctions(seen, fit, ex, tol=0.05):
    """Revision 5: where a rim's seen arc and fit arc meet end to start, both take the ellipse's own
    tangent there (their Bezier handles are turned onto it, lengths kept), so the joint has no kink:
    the fit's first cubic (fitted to the lettering shift) left at -46.5 deg against the seen arc's
    -53.8 deg at the front rim's top junction (the ellipse: -52.3)."""
    rec = []
    for a_, b_ in ((seen, fit), (fit, seen)):
        A = np.asarray(a_["segs"][-1], float); Bq = np.asarray(b_["segs"][0], float)
        if np.hypot(*(A[3] - Bq[0])) > tol:
            continue
        J = A[3]
        T = ellipse_tangent(ex, J)
        if np.dot(T, A[3] - A[2]) < 0:
            T = -T
        before = [round(_heading(A[3] - A[2]), 1), round(_heading(Bq[1] - Bq[0]), 1)]
        A[2] = A[3] - T * np.hypot(*(A[3] - A[2]))
        Bq[1] = Bq[0] + T * np.hypot(*(Bq[1] - Bq[0]))
        a_["segs"][-1] = A; b_["segs"][0] = Bq
        rec.append(dict(at=[round(float(J[0]), 2), round(float(J[1]), 2)], strokes=[a_["id"], b_["id"]], ellipse_tangent_deg=round(_heading(T), 1),
                        headings_before=before, turn_before=round((before[1] - before[0] + 180) % 360 - 180, 1)))
    for s in (seen, fit):
        s["pts"] = bez_dense([np.asarray(c, float) for c in s["segs"]], 0.5)
        s["L"] = plen(s["pts"])
    return rec


def ellipse_arc(ex, a0, a1, step=1.0):
    cx, cy, rx, ry, ang = ex
    n = max(8, int(abs(a1 - a0) / 360 * 2 * math.pi * max(rx, ry) / step))
    t = np.radians(np.linspace(a0, a1, n + 1))
    c, s = math.cos(math.radians(ang)), math.sin(math.radians(ang))
    x = rx * np.cos(t); y = ry * np.sin(t)
    return np.column_stack([cx + c * x - s * y, cy + s * x + c * y])


def ghost(ex, laps, seed):
    """Construction loop on the rim fit: `laps` laps, counter-clockwise on screen from 10 o'clock,
    each lap offset up to +-1.5 src px (seeded)."""
    cx, cy, rx, ry, ang = ex
    rnd = random.Random(seed)
    s1 = rnd.choice([1, -1]); s2 = rnd.uniform(0.8, 1.0)
    c, s = math.cos(math.radians(ang)), math.sin(math.radians(ang))
    # 10 o'clock on screen: direction (-cos30, -sin30) in y-down coords; find its parametric angle
    tgt = np.array([-math.cos(math.radians(30)), -math.sin(math.radians(30))])
    best, th0 = 1e9, 0.0
    for th in np.radians(np.arange(0, 360, 0.5)):
        x, y = rx * math.cos(th), ry * math.sin(th)
        v = np.array([c * x - s * y, s * x + c * y]); v /= np.linalg.norm(v)
        dd = np.hypot(*(v - tgt))
        if dd < best:
            best, th0 = dd, th
    # direction: decreasing or increasing parameter = counter-clockwise on screen? test
    pts = []
    n = int(400 * laps)
    for sign in (-1, 1):
        pts = []
        for i in range(n + 1):
            fr = i / n
            th = th0 + sign * fr * laps * 2 * math.pi
            d = 1.5 * s1 * s2 * math.cos(math.pi * fr * laps)
            x, y = (rx + d) * math.cos(th), (ry + d) * math.sin(th)
            pts.append([cx + c * x - s * y, cy + s * x + c * y])
        P = np.array(pts)
        if C.signed_area(P[: n // int(math.ceil(laps)) + 1]) < 0:
            return P
    return P


# ================================================================== hatching (convention)
def polymask(poly, shape, origin):
    im = Image.new("1", (shape[1], shape[0]), 0)
    ImageDraw.Draw(im).polygon([(x - origin[0], y - origin[1]) for x, y in poly], fill=1)
    return np.asarray(im).astype(bool)


class Hatch:
    def __init__(self):
        self.dark = np.asarray(Image.open(C.INP / "dark-mask-origin-880-380.png")) > 127
        self.O = C.MASK_ORIGIN
        inv = C.load_json(C.INP / "inventory-guides.json")["features"]
        clear = np.zeros_like(self.dark)
        for k in ("side-names-rear", "side-names-front", "side-mark", "olin-college", "of-engineering", "top-names", "top-label"):
            b = inv[k]["bbox"]
            clear[max(0, b[1] - 8 - self.O[1]): b[3] + 8 - self.O[1], max(0, b[0] - 8 - self.O[0]): b[2] + 8 - self.O[0]] = True
        plate = polymask(inv["side-plate"]["guides"][0], self.dark.shape, self.O)
        clear |= ni.binary_dilation(plate, iterations=8)
        stripe = np.zeros_like(self.dark)
        g = resample(np.asarray(inv["stripe-outer-lower"]["guides"][0], float), 1.0)
        ix = np.round(g[:, 0] - self.O[0]).astype(int); iy = np.round(g[:, 1] - self.O[1]).astype(int)
        ok = (ix >= 0) & (iy >= 0) & (ix < stripe.shape[1]) & (iy < stripe.shape[0])
        stripe[iy[ok], ix[ok]] = True
        # the stripe itself is not dark (blue): the dark mask already keeps flicks off it
        self.clear = clear

    def inside(self, P, er=0):
        m = ni.binary_erosion(self.dark, iterations=er) if er else self.dark
        ix = np.round(np.asarray(P)[:, 0] - self.O[0]).astype(int)
        iy = np.round(np.asarray(P)[:, 1] - self.O[1]).astype(int)
        ok = (ix >= 0) & (iy >= 0) & (ix < m.shape[1]) & (iy < m.shape[0])
        out = np.zeros(len(ix), bool)
        out[ok] = m[iy[ok], ix[ok]]
        return out

    def flicks(self, anchors, poly, pitch, seed, lmin=25.0, lmax=60.0, grade=None, er=1, angle=62.0, maxn=None, gap_max=None):
        """'/' flicks at `angle` deg on parallel family lines spaced `pitch` +-15 % apart. On each
        family line the flick starts where the line crosses a drawn stroke (anchors: polylines
        of strokes drawn in this class), 1.5 src px into the dark side, and runs down-left while
        it stays inside the patch (polygon & dark mask, eroded `er` px, minus the clearance round
        names, lettering, stripe and plate). Length: graded from lmin to lmax across the patch
        (grade(f), f in 0..1 nose to tail), capped at 55-75 % of the local dark run when the run
        allows lmin, else the run itself; flicks shorter than lmin are not drawn."""
        rnd = random.Random(seed)
        a = math.radians(angle)
        d = np.array([-math.cos(a), math.sin(a)])                # down-left, y down
        nrm = np.array([d[1], -d[0]])
        region = polymask(poly, self.dark.shape, self.O) & ni.binary_erosion(self.dark, iterations=er) & ~self.clear
        A = np.vstack([resample(np.asarray(p, float), 0.5) for p in anchors]) if anchors else None
        tree = cKDTree(A) if anchors else None
        P = np.asarray(poly, float)
        c = P.mean(0)
        R = float(np.max(np.hypot(*(P - c).T))) + 10
        tlo, thi = float((P @ nrm).min()), float((P @ nrm).max())
        out = []
        t = tlo + 0.5 * pitch
        while t < thi:
            tt = t + rnd.uniform(-0.15, 0.15) * pitch
            base = c + nrm * (tt - c @ nrm)
            s_vals = np.arange(-R, R, 0.5)
            line = base[None, :] + s_vals[:, None] * d[None, :]
            if tree is not None:
                dist = tree.query(line)[0]
                cross = [k for k in range(1, len(line) - 1) if dist[k] < 1.0 and dist[k] <= dist[k - 1] and dist[k] <= dist[k + 1]]
            else:
                # no anchor (comparison variant only): start where the family line first enters the patch
                ins = np.array([0 <= int(round(q[0] - self.O[0])) < region.shape[1] and 0 <= int(round(q[1] - self.O[1])) < region.shape[0]
                                and region[int(round(q[1] - self.O[1])), int(round(q[0] - self.O[0]))] for q in line])
                cross = [k - 2 for k in range(2, len(line)) if ins[k] and not ins[k - 1]][:1]
            made = None
            for k in cross:
                p0 = line[k] + d * 1.5
                run = []
                for sdist in np.arange(0, 2 * R, 0.5):
                    q = p0 + d * sdist
                    ix, iy = int(round(q[0] - self.O[0])), int(round(q[1] - self.O[1]))
                    inside = 0 <= ix < region.shape[1] and 0 <= iy < region.shape[0] and region[iy, ix]
                    if inside:
                        run.append(q)
                    elif run:
                        break
                    elif sdist > 4.5:
                        break
                if not run:
                    continue
                L_run = plen(np.array(run))
                if L_run < lmin:
                    continue
                f = (tt - tlo) / max(thi - tlo, 1e-6)
                g = grade(f) if grade else f
                target = lmin + (lmax - lmin) * g
                L = min(target, max(lmin, L_run * rnd.uniform(0.55, 0.75)), L_run)
                q0 = run[0]
                made = np.array([q0, q0 + d * L * 0.5, q0 + d * L])
                break
            if made is not None:
                out.append(made)
            t += pitch
        if maxn and len(out) > maxn:
            idx = np.round(np.linspace(0, len(out) - 1, maxn)).astype(int)
            out = [out[k] for k in idx]
        return out

    def tyre_flicks(self, sil, ex, rim, pitch, seed, angle=62.0, lmin=25.0, lmax=40.0, nmin=4, nmax=6, min_angle=30.0,
                    jitter=0.06, er=1, inset=1.0):
        """Straight '/' flicks for a tyre (revision 1, replacing the concentric arcs that read as
        motion marks): family lines at `angle` deg spaced `pitch` +-jitter apart; each flick starts
        1.5 src px inside the DRAWN silhouette `sil` where its family line crosses it, at least
        `min_angle` deg off the silhouette's tangent there, and runs into the dark tread face (dark
        mask eroded `er` px, inside the tyre ellipse fit scaled by `inset`, outside the rim fit x 1.12)
        for 25-40 src px. Keeps the longest run of consecutive family lines that carry a flick; fewer
        than `nmin` -> no flicks (the patch is dropped)."""
        rnd = random.Random(seed)
        a = math.radians(angle)
        d = np.array([-math.cos(a), math.sin(a)])
        nrm = np.array([d[1], -d[0]])
        cx, cy, rx, ry, ang = ex
        cs, sn = math.cos(math.radians(ang)), math.sin(math.radians(ang))
        rcx, rcy, rrx, rry, rang = rim
        rc, rs = math.cos(math.radians(rang)), math.sin(math.radians(rang))

        dark_er = ni.binary_erosion(self.dark, iterations=er) if er else self.dark

        def ok(q):
            ix, iy = int(round(q[0] - self.O[0])), int(round(q[1] - self.O[1]))
            if not (0 <= ix < dark_er.shape[1] and 0 <= iy < dark_er.shape[0]) or not dark_er[iy, ix]:
                return False
            u = (q[0] - cx) * cs + (q[1] - cy) * sn
            v = -(q[0] - cx) * sn + (q[1] - cy) * cs
            if (u / (rx * inset)) ** 2 + (v / (ry * inset)) ** 2 > 1:
                return False
            u2 = (q[0] - rcx) * rc + (q[1] - rcy) * rs
            v2 = -(q[0] - rcx) * rs + (q[1] - rcy) * rc
            return (u2 / (rrx * 1.12)) ** 2 + (v2 / (rry * 1.12)) ** 2 > 1

        S = resample(np.asarray(sil, float), 0.5)
        tree = cKDTree(S)
        c = np.array([cx, cy])
        R = max(rx, ry) + 12
        tlo = float(c @ nrm) - R
        n_lines = int(2 * R / pitch) + 1
        cand = {}
        for j in range(n_lines):
            tt = tlo + j * pitch + rnd.uniform(-jitter, jitter) * pitch
            base = c + nrm * (tt - c @ nrm)
            line = base[None, :] + np.arange(-R, R, 0.5)[:, None] * d[None, :]
            dist, idx = tree.query(line)
            cross = [k for k in range(1, len(line) - 1) if dist[k] < 1.0 and dist[k] <= dist[k - 1] and dist[k] <= dist[k + 1]]
            best = None
            for k in cross:
                i = int(idx[k])
                tg = _unit(S[min(len(S) - 1, i + 4)] - S[max(0, i - 4)])
                off = math.degrees(math.acos(min(1.0, abs(float(tg @ d)))))
                if off < min_angle:
                    continue
                for sg in (1.0, -1.0):
                    p0 = line[k] + sg * d * 1.5
                    run = []
                    for s_ in np.arange(0, 3 * lmax, 0.5):
                        q = p0 + sg * d * s_
                        if ok(q):
                            run.append(q)
                        elif run or s_ > 3.0:
                            break
                    if len(run) < 2 or plen(np.array(run)) < lmin or np.hypot(*(run[0] - line[k])) > 4.5:
                        continue
                    p0 = run[0]
                    Lr = plen(np.array(run))
                    L = min(lmax, max(lmin, Lr * rnd.uniform(0.6, 0.8)), Lr)
                    fl = np.array([p0, p0 + sg * d * L * 0.5, p0 + sg * d * L])
                    if best is None or L > best[1]:
                        best = (fl, L, off, float(tt))
            if best is not None:
                cand[j] = best
        js = sorted(cand)
        runs, cur = [], []
        for j in js:
            if cur and j != cur[-1] + 1:
                runs.append(cur); cur = []
            cur.append(j)
        if cur:
            runs.append(cur)
        runs.sort(key=len, reverse=True)
        info = dict(candidates=len(js), longest_run=len(runs[0]) if runs else 0)
        if not runs or len(runs[0]) < nmin:
            return [], info
        r_ = runs[0]
        if len(r_) > nmax:
            k0 = (len(r_) - nmax) // 2
            r_ = r_[k0: k0 + nmax]
        info["kept"] = len(r_)
        info["angle_off_tangent_min"] = round(min(cand[j][2] for j in r_), 1)
        return [cand[j][0] for j in r_], info

    def tyre_arcs(self, ex, rim, sa0, sa1, factors, seed, er=1, minlen=30.0):
        """Arcs concentric with a tyre silhouette ellipse fit, on its shadow side: screen angles
        sa0..sa1 (deg, y down: 90 = below, 180 = left), inside the dark mask, outside the rim
        ellipse (never in the rim interior), drawn along the tread from top to bottom."""
        rnd = random.Random(seed)
        cx, cy, rx, ry, ang = ex
        cs, sn = math.cos(math.radians(ang)), math.sin(math.radians(ang))
        rcx, rcy, rrx, rry, rang = rim
        rc, rs = math.cos(math.radians(rang)), math.sin(math.radians(rang))
        res = []
        for fct in factors:
            th = np.radians(np.linspace(0, 360, 1441))
            x, y = rx * fct * np.cos(th), ry * fct * np.sin(th)
            P = np.column_stack([cx + cs * x - sn * y, cy + sn * x + cs * y])
            scr = np.degrees(np.arctan2(P[:, 1] - cy, P[:, 0] - cx)) % 360
            A0 = sa0 + rnd.uniform(-4, 4); A1 = sa1 + rnd.uniform(-6, 6)
            inr = (scr >= A0) & (scr <= A1)
            u = (P[:, 0] - rcx) * rc + (P[:, 1] - rcy) * rs
            v = -(P[:, 0] - rcx) * rs + (P[:, 1] - rcy) * rc
            outside_rim = (u / (rrx * 1.12)) ** 2 + (v / (rry * 1.12)) ** 2 > 1
            ok = self.inside(P, er) & inr & outside_rim
            # the arc runs through 0 deg only if sa0 < 0; ranges here stay within 0..360
            best = longest_true_run(ok)
            if len(best) > 2:
                Q = P[best[0]: best[-1] + 1]
                if plen(Q) >= minlen:
                    if Q[0][1] > Q[-1][1]:
                        Q = Q[::-1]
                    res.append(Q)
        return res


# ================================================================== stroke records
POOL = []
POOL_BY_ID = {}


def add(id, pts, phase, tier, kind, area, classes, prov, members=(), pin=None, segs=None, corners=None, closed=False, **extra):
    pts = np.asarray(pts, float)
    if segs is None:
        D, segs, corners = finish_stroke(pts, corners or [], closed=closed, err=0.5 if kind != "hatch" else 0.8)
    else:
        D = pts
    s = dict(id=id, pts=D, segs=[np.asarray(c, float) for c in segs], corners=list(corners or []), phase=phase, tier=tier, kind=kind,
             area=area, classes="".join(c for c in "DTP" if c in classes), prov=prov, members=list(members), pin=pin, closed=closed,
             L=plen(D))
    s.update(extra)
    POOL.append(s)
    POOL_BY_ID[id] = s
    return s


# Neutral member ids (revision 1): the art-stage inventory's working labels for the amber lens and
# its housing name a function nothing in the photo proves (PLAN risk 5). strokes.json carries the
# neutral ids; provenance.json maps them back to the inventory guides.
ALIAS = {"lamp-lens": "amber-lens", "lamp-housing": "lens-housing", "arm-upper": "rear-tube-level"}   # revision 3: arm-upper


def members_of(f):
    out = [ALIAS.get(m["inv"], m["inv"]) for m in f["members"] if "inv" in m]
    if f.get("src_inv"):
        out += [ALIAS.get(x, x) for x in f["src_inv"].split(",") if ALIAS.get(x, x) not in out]
    return out


# ================================================================== far nose silhouette (revision 2)
# The nose's far edge between x 1205 and 1300 is the boundary between grey asphalt and the far
# blue stripe (the plate's top corner sits on the edge at x 1205). The general snap (all channels) locked onto the stronger edge 7-12 src px lower:
# the top of the white / navy SAE decal on the stripe. Here the line is re-snapped on a chroma
# channel (blue minus red, Gaussian sigma 1), searching only outward from the traced line (up,
# toward the asphalt): from the asphalt side inward past the first place b-r rises above 12, to the
# half-way level between the asphalt and the stripe. Offsets are median-filtered and smoothed along the
# line, and blended in over 3 src px at the plate corner (the real edge kinks there) and 8 src px at
# the right end of the span.
FAR_SPAN = (1204.0, 1306.0)
BR_THR = 12.0
LEV_FRAC = 0.33     # the edge level: a third of the way from the asphalt to the stripe peak (about the critic's b-r 12)
_BR = {}


def br_channel(rgb):
    if "br" not in _BR:
        f = rgb.astype(np.float32)
        _BR["br"] = ni.gaussian_filter(f[:, :, 2] - f[:, :, 0], 1.0)
    return _BR["br"]


def chroma_boundary(rgb, P, N, reach=16.0, back=3.0):
    """Per point: offset along the unit normal N (pointing toward the asphalt) of the
    asphalt-to-stripe boundary, or nan when the profile never rises above BR_THR."""
    from scipy.ndimage import map_coordinates
    br = br_channel(rgb)
    step = 0.25
    s = np.arange(-back, reach + 1e-6, step)
    xs = P[:, 0:1] + N[:, 0:1] * s[None, :]
    ys = P[:, 1:2] + N[:, 1:2] * s[None, :]
    v = map_coordinates(br, [ys.ravel(), xs.ravel()], order=1, mode="nearest").reshape(xs.shape)
    g = -np.gradient(v, step, axis=1)                    # b-r rises inward (toward smaller s)
    out = np.full(len(P), np.nan)
    for i in range(len(P)):
        j = len(s) - 1
        while j >= 0 and v[i, j] <= BR_THR:              # walk in from the asphalt side
            j -= 1
        if j < 0 or j == len(s) - 1:
            continue
        # the edge is the half-way level between the asphalt (outer 4 src px of the profile beyond
        # the crossing) and the stripe (the peak within 6 src px inward of the crossing)
        outer = v[i, j + 1: min(len(s), j + 1 + int(4 / step))]
        inner = v[i, max(0, j - int(6 / step)): j + 1]
        lev = float(np.median(outer)) + LEV_FRAC * (float(inner.max()) - float(np.median(outer)))
        k = j
        while k > 0 and v[i, k] < lev:
            k -= 1
        if v[i, k] < lev or k == j and v[i, k] < lev:
            out[i] = s[j]
            continue
        # sub-sample crossing of `lev` between k (>= lev) and k + 1 (< lev)
        a_, b_ = v[i, k], v[i, min(k + 1, len(s) - 1)]
        f = (a_ - lev) / max(a_ - b_, 1e-6)
        out[i] = s[k] + float(np.clip(f, 0, 1)) * step
    return out


def resnap_far_span(s, rgb, span=FAR_SPAN, blend=(3.0, 8.0)):
    """Move the part of stroke s that lies in x span (upper branch: the nose's far edge) onto the
    asphalt-to-stripe chroma boundary. Corners are kept. Returns a record for provenance."""
    P = resample(s["pts"], 1.0)
    N = TL.normals(P)
    N = np.where((N[:, 1] < 0)[:, None], N, -N)          # outward = up (toward the asphalt)
    inside = (P[:, 0] >= span[0]) & (P[:, 0] <= span[1]) & (P[:, 1] < 700)
    if not inside.any():
        return None
    idx = np.nonzero(inside)[0]
    i0, i1 = int(idx.min()), int(idx.max())
    off = np.zeros(len(P))
    o = chroma_boundary(rgb, P[i0: i1 + 1], N[i0: i1 + 1])
    good = np.isfinite(o)
    if good.sum() < 0.8 * len(o):
        raise SystemExit("resnap %s: chroma boundary found on only %d of %d samples" % (s["id"], good.sum(), len(o)))
    o = np.interp(np.arange(len(o)), np.nonzero(good)[0], o[good])
    from scipy.ndimage import median_filter
    o = ni.gaussian_filter1d(median_filter(o, size=5, mode="nearest"), 3.0, mode="nearest")
    nb = blend
    xs_ = P[i0: i1 + 1, 0]
    w = np.ones(len(o))
    if P[:, 0].min() < span[0]:                          # ramp only where the stroke runs on past the span
        w *= np.clip((xs_ - span[0]) / nb[0], 0, 1)
    if P[:, 0].max() > span[1]:
        w *= np.clip((span[1] - xs_) / nb[1], 0, 1)
    off[i0: i1 + 1] = o * w
    Q = P + N * off[:, None]
    cps = corner_points(s)
    Q = resample(Q, 0.5)
    cidx = sorted(set(int(np.argmin(np.hypot(*(Q - c).T))) for c in cps))
    D, segs, corners = finish_stroke(Q, cidx, closed=False)
    s.update(pts=D, segs=segs, corners=corners, L=plen(D))
    rec = dict(span=list(span), samples=int(len(o)), offset_max=round(float(np.max(np.abs(o))), 2), offset_median=round(float(np.median(o)), 2),
               method="b-r (sigma 1) boundary: from the asphalt side, past the first b-r > %.0f to the half-way level between the asphalt and the stripe peak (sub-sample); median 5, Gaussian 3; blended in over %g src px (left, at the plate corner) and %g src px (right)" % (BR_THR, nb[0], nb[1]))
    s["resnap"] = rec
    return rec


# Revision 3 (drawing convention, recorded in provenance): the far silhouette is drawn as one
# confident curve. The traced line follows every lump of the chroma edge (a 7 src px step over 8 src
# px at the plate corner, x 1204-1212; shoulders at x 1222-1226 and 1282-1290). Over x SMOOTH_SPAN it
# is replaced by the curve of least bending (sum of squared second differences, per src px column)
# that stays within a band of the measured line: SMOOTH_TOL_B of the gate's b-r boundary (x 1207-1300),
# SMOOTH_TOL_C of the traced line at the plate corner (x 1186-1206), SMOOTH_TOL_T of the traced line
# elsewhere, pinned to the traced line over 5 src px at both ends (scipy.optimize.lsq_linear, bounded).
# Least bending inside a band spreads the corner step as wide as the band allows and leaves no
# curvature reversal the band does not force.
SMOOTH_SPAN = (1150.0, 1345.0)
SMOOTH_TOL_B, SMOOTH_TOL_C, SMOOTH_TOL_T = 1.6, 2.0, 1.0
CURV_FLOOR = 0.004         # 1/src px: weaker curvature counts as straight in the reversal check
REVERSAL_SPAN = (1190.0, 1305.0)


def boundary_column(br, x, yd):
    """The far-silhouette gate's boundary at column x for a drawn y yd (nan where no stripe)."""
    y0 = int(yd) - 14
    col = br[y0: int(yd) + 6, x]
    if not (col > BR_THR).any():
        return float("nan")
    j = int(np.argmax(col > BR_THR))
    if j == 0:
        return float("nan")
    return y0 + j - 1 + (BR_THR - col[j - 1]) / max(col[j] - col[j - 1], 1e-6)


def curvature_lobes(xs, z, floor=CURV_FLOOR):
    """Signed curvature lobes of y = z(x): runs where |kappa| > floor, merged by sign. Returns the
    lobes [(sign, x_start, x_end, peak)] and the inflections (midway between consecutive opposite lobes)."""
    dz = np.gradient(z, xs); d2 = np.gradient(dz, xs)
    k = d2 / (1 + dz ** 2) ** 1.5
    lobes = []
    for x, kv in zip(xs, k):
        if abs(kv) <= floor:
            continue
        sg = 1 if kv > 0 else -1
        if lobes and lobes[-1][0] == sg:
            lobes[-1][2] = x
            lobes[-1][3] = max(lobes[-1][3], abs(kv))
        else:
            lobes.append([sg, x, x, abs(kv)])
    infl = [round(float((lobes[i][2] + lobes[i + 1][1]) / 2), 1) for i in range(len(lobes) - 1)]
    return [[l[0], float(l[1]), float(l[2]), round(float(l[3]), 4)] for l in lobes], infl


def step_spread(xs, z):
    """Width (src px) of the plate-corner step: the run around the steepest point in x 1180-1240
    where the slope exceeds the nose edge's own slope (median over x 1170-1190) by more than 0.05."""
    sl = np.abs(np.gradient(z, xs))
    b = float(np.median(sl[(xs >= 1170) & (xs <= 1190)]))
    m = (xs >= 1180) & (xs <= 1240)
    xx, ex = xs[m], sl[m] - b
    k = int(np.argmax(ex)); i = j = k
    while i > 0 and ex[i - 1] > 0.05:
        i -= 1
    while j < len(ex) - 1 and ex[j + 1] > 0.05:
        j += 1
    return dict(x0=float(xx[i]), x1=float(xx[j]), width=float(xx[j] - xx[i]), edge_slope=round(b, 3), peak_slope=round(float(ex[k] + b), 3))


def smooth_far_silhouette(s, rgb, ref=None):
    """Replace the upper branch of stroke s over SMOOTH_SPAN by the smooth curve. `ref` (x -> y) is
    the curve to reuse (the nose gesture takes nose-loop's). Returns (record, curve)."""
    from scipy.optimize import lsq_linear
    br = br_channel(rgb)
    P = resample(s["pts"], 0.5)
    up = (P[:, 1] < 700) & (P[:, 0] >= SMOOTH_SPAN[0] - 0.01) & (P[:, 0] <= SMOOTH_SPAN[1] + 0.01)
    run = longest_true_run(up)
    i0, i1 = run[0], run[-1]
    Q = P[i0: i1 + 1]
    order = np.argsort(Q[:, 0])
    qx, qy = Q[order, 0], Q[order, 1]
    if np.any(np.diff(qx) <= 0):
        qx, uniq = np.unique(qx, return_index=True)
        qy = qy[uniq]
    xa, xb = math.ceil(qx.min()), math.floor(qx.max())
    xs = np.arange(xa, xb + 1, dtype=float)
    yd = np.interp(xs, qx, qy)
    rec = None
    if ref is None:
        yb = np.array([boundary_column(br, int(x), y) if 1207 <= x <= 1300 else np.nan for x, y in zip(xs, yd)])
        t = np.where(np.isfinite(yb), yb, yd)
        tol = np.full(len(xs), SMOOTH_TOL_T)
        tol[(xs >= 1186) & (xs < 1207)] = SMOOTH_TOL_C
        tol[np.isfinite(yb)] = SMOOTH_TOL_B
        tol[:5] = 0.01; tol[-5:] = 0.01                    # pinned: the stroke runs on past both ends
        n = len(xs)
        D2 = np.diff(np.eye(n), 2, axis=0)
        A = np.vstack([D2, 1e-3 * np.eye(n)])
        bb = np.concatenate([np.zeros(len(D2)), 1e-3 * t])
        res = lsq_linear(A, bb, bounds=(t - tol, t + tol), method="bvls", max_iter=5000)
        z = res.x
        lobes, infl = curvature_lobes(xs, z)
        inside = [x for x in infl if REVERSAL_SPAN[0] <= x <= REVERSAL_SPAN[1]]
        dev_b = np.where(np.isfinite(yb), z - yb, np.nan)
        dev_t = z - yd
        corner = (xs >= 1186) & (xs < 1207)
        rec = dict(span=[float(xs[0]), float(xs[-1])], method="least bending (squared second differences) within the band; scipy lsq_linear bvls, status %d" % res.status,
                   tol_boundary=SMOOTH_TOL_B, tol_corner=SMOOTH_TOL_C, tol_traced=SMOOTH_TOL_T,
                   boundary_dev_max=round(float(np.nanmax(np.abs(dev_b))), 2), boundary_dev_median=round(float(np.nanmedian(np.abs(dev_b))), 2),
                   corner_traced_dev_max=round(float(np.abs(dev_t[corner]).max()), 2),
                   other_traced_dev_max=round(float(np.abs(dev_t[~corner & ~np.isfinite(yb)]).max()), 2),
                   plate_step=step_spread(xs, z), plate_step_traced=step_spread(xs, yd),
                   curvature_floor=CURV_FLOOR, lobes=lobes, inflections=infl,
                   inflection_spacing_min=(round(float(np.diff(inside).min()), 1) if len(inside) > 1 else None),
                   inflections_traced=curvature_lobes(xs, ni.gaussian_filter1d(yd, 1.0))[1])
        curve = (xs.copy(), z.copy())
    else:
        rx, rz = ref
        z = np.interp(xs, rx, rz)
        # blend in over 6 src px at the stroke's left end (it runs on past the span there)
        wl = np.clip((xs - xs[0]) / 6.0, 0, 1)
        z = yd * (1 - wl) + z * wl if xs[0] > SMOOTH_SPAN[0] - 0.5 else z
        curve = ref
        rec = dict(span=[float(xs[0]), float(xs[-1])], from_curve="nose-loop", dev_from_traced_max=round(float(np.abs(z - yd).max()), 2))
    # write back: each point of the run takes the curve's y at its x
    Qn = Q.copy()
    Qn[:, 1] = np.interp(Q[:, 0], xs, z)
    P2 = np.vstack([P[:i0], Qn, P[i1 + 1:]])
    cps = corner_points(s)
    P2 = resample(P2, 0.5)
    cidx = sorted(set(int(np.argmin(np.hypot(*(P2 - c).T))) for c in cps))
    D, segs, corners = finish_stroke(P2, cidx, closed=False, err=0.15)   # tight: the band leaves no room for a 0.5 px fit error
    s.update(pts=D, segs=segs, corners=corners, L=plen(D))
    s["smoothed"] = rec
    return rec, curve


def far_silhouette_gate(s, rgb, span=(1205, 1295)):
    """Independent check of the far nose edge, per src px column in the span: the critic's
    boundary (the first row from the asphalt where b-r, sigma 1, exceeds 12, interpolated) against
    the drawn upper branch; and the decal top (the largest luminance step 3-14 src px below the
    boundary) must stay at least 2.5 src px below the drawn line."""
    br = br_channel(rgb)
    lum = ni.gaussian_filter(rgb.astype(np.float32).mean(2), 1.0)
    P = resample(s["pts"], 0.25)
    rows = []
    for x in range(int(span[0]), int(span[1]) + 1):
        m = (np.abs(P[:, 0] - x) < 0.13) & (P[:, 1] < 700)
        if not m.any():
            continue
        yd = float(P[m, 1].min())
        y0 = int(yd) - 14
        col = br[y0: int(yd) + 6, x]
        if not (col > BR_THR).any():
            continue                                     # no stripe here (the plate corner, x < 1207)
        j = int(np.argmax(col > BR_THR))
        if j == 0:
            continue
        yb = y0 + j - 1 + (BR_THR - col[j - 1]) / max(col[j] - col[j - 1], 1e-6)
        lc = lum[int(yb) + 2: int(yb) + 15, x]
        dl = np.abs(np.diff(lc))
        ydec = int(yb) + 2 + int(np.argmax(dl)) + 0.5
        rows.append((x, yd, round(float(yb), 2), round(ydec, 1)))
    A = np.array(rows, float)
    d = A[:, 1] - A[:, 2]
    closer = np.abs(A[:, 1] - A[:, 2]) < np.abs(A[:, 3] - A[:, 1])
    return dict(columns=len(A), x_first=int(A[0, 0]), drawn_minus_boundary_median=round(float(np.median(d)), 2),
                drawn_minus_boundary_max=round(float(np.max(np.abs(d))), 2), within1=round(float(np.mean(np.abs(d) <= 1.0)), 3),
                within2=round(float(np.mean(np.abs(d) <= 2.0)), 3), decal_minus_drawn_min=round(float((A[:, 3] - A[:, 1]).min()), 2),
                on_decal=int(np.sum(~closer)), ok=bool(np.max(np.abs(d)) <= 2.0 and closer.all()),
                note="per src px column: drawn y minus the critic's boundary (first b-r > 12 from the asphalt, sigma 1, interpolated; + is below it, "
                     "inside the stripe); on_decal counts columns where the line is nearer the decal top (largest luminance step 2-15 src px below "
                     "the boundary) than the boundary")


# ================================================================== coaming tube (revision 3)
# The cockpit's coaming tube (rail, rail-lower) is a straight lit tube about 4-5 src px thick. The
# revision 2 snap followed its top edge only where the area above it is dark; over x 1404-1452 (the
# white suit above is brighter than the tube) it slid onto the tube's lower half and pinched the tube.
# Both edges are now measured per src px column and fitted as straight lines:
#   bottom: the truth critic's measure (railfit.py): the last row >= 90 (luminance, Gaussian 0.7)
#           that has near-black (< 30) 3-5 rows below it; the edge is where the column falls to half
#           that row's level. Least squares, refit without residuals >= 2.5 src px.
#   top:    where the area above the tube is darker than the tube (the tube's peak, 0.5-5.5 src px
#           above the bottom fit, under 160; the darkest of the 5 rows above it at least 40 levels
#           lower): the half level between them, going up. Columns where the suit above is brighter
#           are not measured: the line runs across them as the straight fit. Refit without
#           residuals >= 1.5 src px.
TUBE_SPAN = (1372, 1524)
TUBE_WINDOW = ((1372.0, 700.1), (1524.0, 662.8))     # places the search window only (the critic's top line)
TUBE_ENDS = {"top": (1372.0, 1525.7), "bottom": (1372.0, 1526.3)}   # x range drawn (the column at the right; the corner / meet at the left)
_TUBE = {}


def _robust_line(xs, ys, cut, iters=4):
    xs = np.asarray(xs, float); ys = np.asarray(ys, float)
    keep = np.ones(len(xs), bool)
    for _ in range(iters):
        p = np.polyfit(xs[keep], ys[keep], 1)
        r = ys - np.polyval(p, xs)
        keep = np.abs(r) < cut
    p = np.polyfit(xs[keep], ys[keep], 1)
    r = ys - np.polyval(p, xs)
    return p, r, keep


def tube_edges(rgb=None):
    if _TUBE:
        return _TUBE
    rgb = RGB[0] if rgb is None else rgb
    im = rgb.astype(np.float64)
    Y = ni.gaussian_filter(0.299 * im[..., 0] + 0.587 * im[..., 1] + 0.114 * im[..., 2], 0.7)
    (xa, ya), (xb, yb_) = TUBE_WINDOW
    mw = (yb_ - ya) / (xb - xa)
    bx, by = [], []
    for x in range(TUBE_SPAN[0], TUBE_SPAN[1] + 1):
        y0 = int(ya + mw * (x - xa)) - 8
        col = Y[y0: y0 + 22, x]
        best = None
        for i in range(len(col) - 5):
            if col[i] >= 90 and col[i + 3: i + 6].min() < 30:
                best = i
        if best is None:
            continue
        pk = col[best]; j = best
        while j < len(col) - 1 and col[j] > pk / 2:
            j += 1
        yb = y0 + j - 1 + (col[j - 1] - pk / 2) / (col[j - 1] - col[j]) if col[j - 1] != col[j] else y0 + j
        bx.append(x); by.append(float(yb))
    pb, rb, kb = _robust_line(bx, by, 2.5)
    tx, ty = [], []
    for x in range(TUBE_SPAN[0], TUBE_SPAN[1] + 1):
        fb = float(np.polyval(pb, x))
        y0 = int(round(fb)) - 12
        col = Y[y0: y0 + 16, x]
        lo, hi = int(round(fb - 5.5)) - y0, int(round(fb - 0.5)) - y0
        k = lo + int(np.argmax(col[lo: hi + 1])); pk = float(col[k])
        if pk > 160:
            continue                                     # the suit above, not the tube
        above = col[max(0, k - 5): k + 1][::-1]          # above[0] = peak, above[i] = i rows up
        amin = float(above.min())
        if amin > pk - 40:
            continue                                     # nothing darker above: not measurable here
        lev = (pk + amin) / 2
        i = 0
        while i < len(above) - 1 and above[i] > lev:
            i += 1
        if i == 0 or above[i] > lev:
            continue
        yt = y0 + k - (i - 1) - (above[i - 1] - lev) / max(above[i - 1] - above[i], 1e-6)
        if above[i:].max() > lev + 10 and i < len(above) - 1:
            continue                                     # brighter again right above: a seam, not the tube's top edge
        tx.append(x); ty.append(float(yt))
    pt, rt, kt = _robust_line(tx, ty, 1.5)
    _TUBE.update(top=pt, bottom=pb, top_pts=(np.array(tx), np.array(ty), rt, kt), bottom_pts=(np.array(bx), np.array(by), rb, kb))
    rec = {}
    for nm, p, xs_, r, k in (("top", pt, tx, rt, kt), ("bottom", pb, bx, rb, kb)):
        rec[nm] = dict(slope=round(float(p[0]), 4), deg=round(math.degrees(math.atan(p[0])), 2), y_at_1372=round(float(np.polyval(p, 1372)), 2),
                       y_at_1524=round(float(np.polyval(p, 1524)), 2), columns=len(xs_), kept=int(k.sum()),
                       resid_kept_median=round(float(np.median(np.abs(r[k]))), 2), resid_kept_max=round(float(np.abs(r[k]).max()), 2),
                       resid_kept_p90=round(float(np.percentile(np.abs(r[k]), 90)), 2),
                       measured_x=[int(min(xs_)), int(max(xs_))])
    gaps = [int(x) for x in range(TUBE_SPAN[0], TUBE_SPAN[1] + 1) if x not in set(tx)]
    rec["top"]["unmeasured_columns"] = len(gaps)
    rec["top"]["unmeasured_runs"] = _runs(gaps)
    _TUBE["rec"] = rec
    return _TUBE


def _runs(xs):
    out = []
    for x in xs:
        if out and x == out[-1][1] + 1:
            out[-1][1] = x
        else:
            out.append([x, x])
    return [r for r in out if r[1] - r[0] >= 2]


def tube_member(which):
    T = tube_edges()
    p = T[which]
    x0, x1 = TUBE_ENDS[which]
    a = np.array([x0, np.polyval(p, x0)]); b = np.array([x1, np.polyval(p, x1)])
    xs, ys, r, k = T[which + "_pts"]
    return dict(F=resample(np.array([a, b]), 1.0), info={"straight": True, "tube_edge": which, "dev_max": round(float(np.abs(r[k]).max()), 2),
                                                          "dev95": round(float(np.percentile(np.abs(r[k]), 95)), 2)})


def y_on(P, x):
    """y of polyline P at x (first crossing), or nan."""
    P = np.asarray(P, float)
    for (x0, y0), (x1, y1) in zip(P[:-1], P[1:]):
        if (x0 - x) * (x1 - x) <= 0 and x0 != x1:
            return y0 + (y1 - y0) * (x - x0) / (x1 - x0)
    return float("nan")


def tube_gate(rail, lower):
    """Rail (its top-edge part) and rail-lower against the measured edges, and their spacing."""
    T = tube_edges()
    out = {"fits": T["rec"]}
    for nm, s, key in (("rail", rail, "top"), ("rail-lower", lower, "bottom")):
        xs, ys, r, k = T[key + "_pts"]
        P = resample(s["pts"], 0.25)
        d = np.array([y_on(P, x) - y for x, y in zip(xs, ys)])
        ok = np.isfinite(d) & k                          # the columns the fit kept (outliers listed in fits)
        seg = P[(P[:, 0] >= TUBE_SPAN[0]) & (P[:, 0] <= TUBE_SPAN[1])]
        pp = np.polyfit(seg[:, 0], seg[:, 1], 1)
        own = np.abs(seg[:, 1] - np.polyval(pp, seg[:, 0]))
        out[nm] = dict(columns=int(ok.sum()), drawn_minus_measured_median=round(float(np.median(np.abs(d[ok]))), 2),
                       drawn_minus_measured_max=round(float(np.abs(d[ok]).max()), 2), within1=round(float(np.mean(np.abs(d[ok]) <= 1.0)), 3),
                       own_straight_dev_max=round(float(own.max()), 2), slope=round(float(pp[0]), 4))
    sp = []
    Pr, Pl = resample(rail["pts"], 0.25), resample(lower["pts"], 0.25)
    for x in range(TUBE_SPAN[0], TUBE_SPAN[1] + 1):
        a_, b_ = y_on(Pr, x), y_on(Pl, x)
        if np.isfinite(a_) and np.isfinite(b_):
            sp.append(b_ - a_)
    sp = np.array(sp)
    out["spacing"] = dict(columns=len(sp), min=round(float(sp.min()), 2), max=round(float(sp.max()), 2), at_1372=round(float(sp[0]), 2), at_1524=round(float(sp[-1]), 2))
    out["ok"] = bool(sp.min() >= 4.0 and sp.max() <= 5.5
                     and out["rail"]["within1"] >= 0.95 and out["rail"]["drawn_minus_measured_max"] <= 1.5
                     and out["rail-lower"]["within1"] >= 0.95 and out["rail-lower"]["drawn_minus_measured_max"] <= 1.5
                     and out["rail"]["own_straight_dev_max"] <= 0.5 and out["rail-lower"]["own_straight_dev_max"] <= 0.5)
    out["note"] = ("rail: drawn y minus the measured top edge on the columns where it is measured (dark above the tube) and the fit kept; rail-lower: "
                   "drawn y minus the measured bottom edge (the critic's measure; its kept residuals max %.2f). Gate: spacing 4-5.5 src px over x %d-%d; "
                   "each line within 1 src px of at least 95 %% of its measured columns and within 1.5 of all; both straight within 0.5 (the single "
                   "measured columns over 1 src px are measurement noise of the edge, not the line: the fits' own kept residuals reach them)."
                   % (T["rec"]["bottom"]["resid_kept_max"], TUBE_SPAN[0], TUBE_SPAN[1]))
    return out


# ================================================================== revision 6 (2026-11-09)
_ISO = {}


def iso_field(sigma):
    """R - B of the photo, smoothed (the amber lens's own boundary: R - B > 25 inside the amber)."""
    if sigma not in _ISO:
        rgb = RGB[0] if RGB else C.channels()[0]
        _ISO[sigma] = ni.gaussian_filter(rgb[..., 0].astype(np.float64) - rgb[..., 2].astype(np.float64), sigma)
    return _ISO[sigma]


def iso_member(spec):
    """A closed loop on the iso-line `level` of iso_field(): on rays from `centre` every `step_deg`, the
    first exit crossing (linear interpolation, 0.05 src px steps), smoothed circularly over `smooth`
    samples (Gaussian sigma). Pixel convention: pixel i centred on i."""
    V = iso_field(spec["sigma"])
    cx, cy = spec["centre"]
    lev = spec["level"]
    th = np.radians(np.arange(0.0, 360.0, spec["step_deg"]))
    rs = np.arange(0.0, spec["rmax"], 0.05)
    R = []
    for t in th:
        v = ni.map_coordinates(V, [cy + rs * math.sin(t), cx + rs * math.cos(t)], order=1, mode="nearest")
        ins = v >= lev
        if not ins[0]:
            raise SystemExit("iso_member: the centre %s is not inside the level %s" % (spec["centre"], lev))
        k = int(np.argmax(~ins))
        R.append(rs[k - 1] + (v[k - 1] - lev) / (v[k - 1] - v[k]) * (rs[k] - rs[k - 1]))
    R = np.array(R)
    Rs = ni.gaussian_filter1d(R, spec["smooth"], mode="wrap")
    P = np.column_stack([cx + Rs * np.cos(th), cy + Rs * np.sin(th)])
    P = np.vstack([P, P[:1]])
    return resample(P, 1.0), {"iso": dict(spec), "raw_vs_smoothed_max": round(float(np.abs(R - Rs).max()), 3), "rays": int(len(th))}


def iso_distance(P, spec):
    """Distance (src px) from each point of P to the unsmoothed iso-line of `spec` (dense rays)."""
    V = iso_field(spec["sigma"])
    cx, cy = spec["centre"]
    lev = spec["level"]
    th = np.radians(np.arange(0.0, 360.0, 0.25))
    rs = np.arange(0.0, spec["rmax"], 0.02)
    Q = []
    for t in th:
        v = ni.map_coordinates(V, [cy + rs * math.sin(t), cx + rs * math.cos(t)], order=1, mode="nearest")
        k = int(np.argmax(v < lev))
        r = rs[k - 1] + (v[k - 1] - lev) / (v[k - 1] - v[k]) * (rs[k] - rs[k - 1])
        Q.append([cx + r * math.cos(t), cy + r * math.sin(t)])
    return cKDTree(np.array(Q)).query(np.asarray(P, float))[0]


BLUNT_PRE = 1.0     # = the engine build's OVERLAP (engine/build.cjs, revision 5): a join-flagged end runs on 1 src px


def apply_blunt(feats):
    """Revision 6: a free tube end drawn blunt (full width, no taper). The engine draws an end at full
    width when its join bit is set (joined bit 1 start, bit 2 end) and then runs it on BLUNT_PRE src px
    along its own tangent (engine/build.cjs overlapJoins). So the art cuts BLUNT_PRE src px off a blunt
    end here and sets the bit in joined_flags(): the drawn end lands on the measured end."""
    out = {}
    for f in feats:
        if not f.get("blunt") or f["id"] not in POOL_BY_ID:
            continue
        s = POOL_BY_ID[f["id"]]
        if f.get("pin") != "as-authored":
            raise SystemExit("blunt needs a pinned (as-authored) stroke: %s" % f["id"])
        P = resample(s["pts"], 0.25)
        L = plen(P)
        a = BLUNT_PRE / L if "s" in f["blunt"] else 0.0
        b = 1.0 - BLUNT_PRE / L if "e" in f["blunt"] else 1.0
        rec = {}
        for w in f["blunt"]:
            rec[w] = dict(end_measured=r2(P[0] if w == "s" else P[-1], 2), pre_trim_src_px=BLUNT_PRE)
        Q = sub(P, a, b)
        D, segs, corners = finish_stroke(Q, [], closed=False)
        s.update(pts=D, segs=segs, corners=corners, L=plen(D))
        for w in f["blunt"]:
            rec[w]["end_in_art"] = r2(D[0] if w == "s" else D[-1], 2)
        s["blunt"] = rec
        out[f["id"]] = dict(rec, len_before=round(L, 1), len_after=round(s["L"], 1))
    return out


BLUNT = {}


def occluded_arcs(s):
    """Occluded spans of a straight stroke as arc-length ranges [a, b] (src px from its drawn start)."""
    P = np.asarray(s["pts"], float)
    A, B = P[0], P[-1]
    L = float(np.hypot(*(B - A)))
    u = (B - A) / L
    out = []
    for o in s.get("occluded") or []:
        if "y" in o:
            ya, yb = o["y"]
            ta, tb = (ya - A[1]) / u[1], (yb - A[1]) / u[1]
        else:
            xa, xb = o["x"]
            ta, tb = (xa - A[0]) / u[0], (xb - A[0]) / u[0]
        out.append((min(ta, tb), max(ta, tb)))
    return out


def r6_gates(order, G, rgb, ch):
    """Revision 6 gates (main loop round 6). Appends to G['r6'] (any entry fails the build)."""
    G["r6"] = []
    ids = [s["id"] for s in order]
    by = {s["id"]: s for s in order}
    R6 = G.setdefault("r6_records", {})
    # --- diag-tube: one straight line on the tube's right edge, (1448.3, 474.0) to (1478.0, 533.0)
    dt = by.get("diag-tube")
    if dt is None or dt["classes"] != "DTP":
        G["r6"].append("diag-tube missing or not D, T, P")
    else:
        P = np.asarray(dt["pts"], float)
        ends = sorted([r2(P[0], 2), r2(P[-1], 2)], key=lambda p: p[1])
        ok_ends = np.hypot(ends[0][0] - 1448.3, ends[0][1] - 474.0) <= 0.3 and np.hypot(ends[1][0] - 1478.0, ends[1][1] - 533.0) <= 0.3
        chord = P[-1] - P[0]
        dev = float(np.abs((P - P[0]) @ np.array([-chord[1], chord[0]]) / np.hypot(*chord)).max())
        ang = math.degrees(math.atan2(abs(chord[1]), abs(chord[0])))
        exc = occluded_arcs(dt)
        me_n, _ = ME.member_registration(dt["pts"], dt["member_edge"]["polarity"] * (1 if P[-1][1] > P[0][1] else -1), exclude=exc, rgb=rgb, pick="nearest")
        me_s, _ = ME.member_registration(dt["pts"], dt["member_edge"]["polarity"] * (1 if P[-1][1] > P[0][1] else -1), exclude=exc, rgb=rgb, pick="strongest")
        gen, _ = TR.registration(dt["pts"], ch, "edge")
        R6["diag_tube"] = dict(ends=ends, len=round(dt["L"], 2), angle_from_horizontal_deg=round(ang, 2), straight_dev_max=round(dev, 3),
                               occluded_arc_src_px=[[round(a, 1), round(b, 1)] for a, b in exc], occluded=dt.get("occluded"),
                               member_edge_nearest=me_n, member_edge_strongest=me_s, generic=gen)
        if not ok_ends or dev > 0.05 or me_n["visible"]["within2"] < 0.90 or me_s["visible"]["within2"] < 0.90:
            G["r6"].append("diag-tube: %s" % {k: R6["diag_tube"][k] for k in ("ends", "straight_dev_max")})
    # --- bar-below-brace: one straight line on the beam's top edge, y = -0.2263 x + 1036.16, x 1580-1630.5
    bb = by.get("bar-below-brace")
    br = by.get("brace")
    if bb is None or bb["classes"] != "DT":
        G["r6"].append("bar-below-brace missing or not D, T")
    else:
        ln = bb["line"]
        P = np.asarray(bb["pts"], float)
        off = np.abs(P[:, 1] - (ln["slope"] * P[:, 0] + ln["icept"])) / math.sqrt(1 + ln["slope"] ** 2)
        exc = occluded_arcs(bb)
        pol = bb["member_edge"]["polarity"] * (1 if P[-1][0] > P[0][0] else -1)
        me_n, _ = ME.member_registration(bb["pts"], pol, exclude=exc, rgb=rgb, pick="nearest")
        me_s, _ = ME.member_registration(bb["pts"], pol, exclude=exc, rgb=rgb, pick="strongest")
        gen, _ = TR.registration(bb["pts"], ch, "edge")
        rec = dict(start=r2(P[0], 2), end=r2(P[-1], 2), len=round(bb["L"], 2), line_offset_max=round(float(off.max()), 3),
                   angle_deg=round(math.degrees(math.atan(-ln["slope"])), 2), blunt=bb.get("blunt"), occluded=bb.get("occluded"),
                   occluded_arc_src_px=[[round(a, 1), round(b, 1)] for a, b in exc], member_edge_nearest=me_n, member_edge_strongest=me_s, generic=gen)
        if br is not None and "D" in br["classes"]:
            e = np.asarray(br["pts"][-1], float)
            rec["brace_end"] = r2(e, 2)
            rec["brace_end_to_bar_line"] = round(abs(e[1] - (ln["slope"] * e[0] + ln["icept"])) / math.sqrt(1 + ln["slope"] ** 2), 3)
            rec["brace_end_to_bar_stroke"] = round(float(cKDTree(resample(P, 0.25)).query(e)[0]), 3)
            if rec["brace_end_to_bar_stroke"] > 1.0:
                G["r6"].append("the brace's end is %.2f src px from bar-below-brace" % rec["brace_end_to_bar_stroke"])
        R6["bar_below_brace"] = rec
        if off.max() > 0.1 or bb["L"] < MIN_LEN or gen["within2"] < 0.90 or me_n["visible"]["within2"] < 0.90:
            G["r6"].append("bar-below-brace: %s" % {k: rec[k] for k in ("start", "end", "len", "line_offset_max")})
    # --- class T: no top-plate, no far-front-crown; D keeps both
    for sid in ("top-plate", "far-front-crown"):
        s = by.get(sid)
        if s is None or s["classes"] != "D":
            G["r6"].append("%s: %s (want class D only)" % (sid, s["classes"] if s else "missing"))
    # --- amber-lens: on the amber's own boundary (R - B = 25), its bottom span raised off the bezel
    al = by.get("amber-lens")
    if al is not None:
        spec = FEAT_BY_ID["amber-lens"]["members"][0]["iso"]
        d = iso_distance(al["pts"], spec)
        P = np.asarray(al["pts"], float)
        bot = (P[:, 0] >= 1452) & (P[:, 0] <= 1476) & (P[:, 1] > 461)
        lef = P[:, 0] <= 1452
        old = np.asarray(R5_AMBER, float)
        ob = (old[:, 0] >= 1452) & (old[:, 0] <= 1476) & (old[:, 1] > 461)
        yb = lambda Q, x: float(np.interp(x, *zip(*sorted((q[0], q[1]) for q in Q))))
        R6["amber_lens"] = dict(iso=spec, dist_to_iso_max=round(float(d.max()), 3), dist_to_iso_median=round(float(np.median(d)), 3),
                                bottom_span_y=[round(float(P[bot][:, 1].min()), 2), round(float(P[bot][:, 1].max()), 2)],
                                bottom_span_y_revision_5=[round(float(old[ob][:, 1].min()), 2), round(float(old[ob][:, 1].max()), 2)],
                                bottom_raised_at_x={str(x): round(yb(old[ob], x) - yb(P[bot], x), 2) for x in (1456, 1464, 1472)},
                                left_x_min=round(float(P[lef][:, 0].min()), 2) if lef.any() else None,
                                left_dist_to_iso_max=round(float(d[lef].max()), 3) if lef.any() else None,
                                start=r2(P[0], 2), end=r2(P[-1], 2), len=round(al["L"], 1), open_gap=al.get("open_gap"),
                                registration_generic=al.get("registration"))
        if d.max() > 0.75:
            G["r6"].append("amber-lens strays %.2f src px from the R-B = 25 boundary" % d.max())
    # --- sleeve-torso: about 10 src px cut off its right-end downturn, registration holds
    st = by.get("sleeve-torso")
    if st is not None:
        gen, _ = TR.registration(st["pts"], ch, "edge")
        R6["sleeve_torso"] = dict(start=r2(st["pts"][0], 2), end=r2(st["pts"][-1], 2), len=round(st["L"], 1), trimmed_start_px=st.get("trimmed_start_px"), registration=gen)
        if gen["within2"] < 0.90:
            G["r6"].append("sleeve-torso registration %.3f within 2 src px after the trim" % gen["within2"])
    # --- the hoop leg: hoop-leg-arch starts at the column's top on the pink sleeve's right edge and runs into the arch
    hla = by.get("hoop-leg-arch")
    if hla is not None and hla.get("leg_edge"):
        le = hla["leg_edge"]
        P = np.asarray(hla["pts"], float)
        Lc = np.concatenate([[0], np.cumsum(np.hypot(*np.diff(P, axis=0).T))])
        leg = P[Lc <= 22.0]                          # the leg part, before the blend into the arch
        me_n, _ = ME.member_registration(leg, le["polarity"], rgb=rgb, pick="nearest")
        me_s, _ = ME.member_registration(leg, le["polarity"], rgb=rgb, pick="strongest")
        tr = cKDTree(resample(P, 0.25))
        near = {}
        for o in order:
            if o is hla or "D" not in o["classes"] or o["tier"] not in LINE_TIERS or o["kind"] == "glyph":
                continue
            near[o["id"]] = round(float(cKDTree(resample(o["pts"], 0.5)).query(P[0])[0]), 2)
        nb = sorted(near.items(), key=lambda kv: kv[1])[:3]
        rec = dict(start=r2(P[0], 2), start_target=le["from"], leg_member_edge_nearest=me_n, leg_member_edge_strongest=me_s,
                   old_start_to_path=round(float(tr.query([1511.3, 467.3])[0]), 2),
                   brace_start_to_path=round(float(tr.query(by["brace"]["pts"][0])[0]), 2) if "brace" in by else None,
                   start_nearest_drawn_D=nb, len=round(hla["L"], 1), jogs=jogs(P))
        R6["hoop_leg"] = rec
        if np.hypot(*(P[0] - np.asarray(le["from"]))) > 0.6 or me_n["visible"]["within2"] < 0.90 or rec["brace_start_to_path"] is None or rec["brace_start_to_path"] > 3.0 or rec["jogs"]:
            G["r6"].append("hoop leg: %s" % {k: rec[k] for k in ("start", "old_start_to_path", "brace_start_to_path", "jogs")})
    # --- no line under the 40 src px gate (no short-stroke exception was needed)
    short = [s["id"] for s in order if s["kind"] not in ("glyph", "hatch") and s["L"] < MIN_LEN - 0.5]
    R6["short_lines"] = short
    if short:
        G["r6"].append("lines under %g src px: %s" % (MIN_LEN, short))
    R6["blunt"] = BLUNT



# Revision 7 (polish round, 2026-11-10): the rear-bay candidates measured for the feel critic's A3 (one more real
# straight tube between the side box and the rear tyre, only if it passes every existing gate). Measured by
# releases/hero-pen-20261110/polish/tools/baycand.py on the revision 6 art (records in .../polish/measure/baycand.json):
# generic = this build's registration measure (within 2 src px), own = member_edge.py nearest pick (within 2 src px).
REAR_BAY_CANDIDATES_R7 = {
    "column-below-rail (edge r 2)": "87.4 src px, 84 deg, straight dev 0.77; generic 0.889, own 0.663 (< 0.90): fails registration",
    "diag-to-tyre top edge, inventory guide (edge r 2)": "39.1 src px (< 40), dev 1.16 (> 1); generic 0.857, own 0.732: fails length, straightness and registration",
    "diag-to-tyre top edge, visible part (1631, 674) -> (1656, 695)": "32.7 src px (< 40); generic 0.833, own 0.824. Run on along its own line through the bar's dark body to the bar's top edge it would reach about 41 src px, with about 8 src px on no edge: not drawn (that part would be invented)",
    "diag-to-tyre bottom edge (1627, 683) -> (1653, 698)": "30.0 src px (< 40)",
    "rod-lit (edge r 2)": "39.8 src px (< 40), 11 deg (near-horizontal: a 4th, over the limit of 3); ends 26 and 10 src px from a drawn line (none within 6): fails length, the near-horizontal limit and connection",
    "rail-behind-hoop (edge r 2)": "61.7 src px, straight dev 1.51 (> 1); own 0.698; near-horizontal (a 4th): fails",
    "post below rear-tube-level (valley r 2)": "38.1 src px (< 40); generic 0.81: fails",
    "post above rear-tube-level (valley r 2)": "35.1 src px (< 40); generic 0.79: fails",
    "lower-rail-under (edge r 2)": "62.3 src px, generic 0.909, own 0.922, but near-horizontal (a 4th) and the same rail's underside, within 8 deg of parallel to lower-rail-top about 5 src px away (the rule wants >= 20): fails",
    "line-b, line-c, tube-e": "21-25 src px (< 40)",
}
# page cases for the rim gap (CSS px per src px, w1, device pixel ratio): 1440 DPR 1 and 2, 1280, 768 DPR 2, 390 DPR 3
GAP_CASES = (("1440 DPR 1", 0.7044, 2.1, 1), ("1440 DPR 2", 0.7044, 2.1, 2), ("1280 DPR 1", 0.6236, 1.993, 1), ("768 DPR 2", 0.4604, 1.652, 2), ("390 DPR 3", 0.3144, 1.4, 3))
RIM_WHITE_MIN = 1.5         # src px of white between the rim's ink and the tyre's at 1440 DPR 1 and 2 (main loop)


def r7_gates(order, G, rgb, ch):
    """Revision 7 gates (polish round, the main loop's decisions of 2026-11-10). Appends to G['r7'] (any entry fails)."""
    G["r7"] = []
    by = {s["id"]: s for s in order}
    R7 = G.setdefault("r7_records", {})
    # --- A1: class P draws shadow-ground-rear (the rear tyre closed below at 390)
    sh = by.get("shadow-ground-rear")
    R7["shadow_p"] = dict(classes=sh["classes"] if sh else None, len=round(sh["L"], 1) if sh else None)
    if sh is None or sh["classes"] != "DTP":
        G["r7"].append("shadow-ground-rear: %s (want D, T, P)" % (sh["classes"] if sh else "missing"))
    # --- the rear rim's low end: rw-rim-seen stops at its lowest point; white between rim and tyre at 1x and 2x
    se, rt = by.get("rw-rim-seen"), by.get("rear-tyre")
    if se is None or rt is None or not se.get("rim_low_end"):
        G["r7"].append("rw-rim-seen: no low-end record")
    else:
        rec = dict(se["rim_low_end"])
        P = np.asarray(se["pts"], float)
        drawn_start = bool(np.hypot(*(P[0] - np.asarray(rec["end_after"]))) < np.hypot(*(P[-1] - np.asarray(rec["end_after"]))))
        E = P[0] if drawn_start else P[-1]
        S_ = resample(P, 0.25)
        k = int(np.argmin(np.hypot(*(S_ - E).T)))
        rec["end_as_drawn"] = r2(E, 2)
        rec["drawn_from_this_end"] = drawn_start
        rec["end_is_lowest"] = bool(float(S_[max(0, k - 60): k + 61, 1].max()) - float(E[1]) <= 0.1)
        # the tyre's ink near the rim's end, with the engine's 1 src px run-on at a joined start (engine/build.cjs OVERLAP)
        joined_flags(order)                      # (write_out sets the same bits again)
        T = np.asarray(rt["pts"], float)
        u = T[0] - T[min(3, len(T) - 1)]
        u = u / (np.hypot(*u) + 1e-12)
        Tr = np.vstack([T[0] + u * BLUNT_PRE, T]) if rt.get("joined", 0) & 1 else T
        d_c = float(cKDTree(resample(Tr, 0.1)).query(E)[0])
        others = {o["id"]: round(float(cKDTree(resample(o["pts"], 0.25)).query(E)[0]), 2) for o in order if o["id"] in ("shadow-ground-rear", "rear-tube-level")}
        cases = {}
        for name, k_, w1, dpr in GAP_CASES:
            # half widths in src px: the tyre (TYRE tier, full width at its joined start) and the rim's free end (FORM
            # tier, landing taper 0.5 at a free start, lift-off 0.15 at a free end); antialiasing takes about half a
            # device px off each side
            wy = FACTOR["y"] * w1 / 2 / k_
            wf = FACTOR["f"] * w1 * (0.5 if drawn_start else 0.15) / 2 / k_
            aa = 1.0 / (dpr * k_)
            cases[name] = dict(white_src_px=round(d_c - wy - wf - aa, 2), white_css_px=round((d_c - wy - wf - aa) * k_, 2))
        rec.update(centre_to_tyre_ink=round(d_c, 2), to_other_lines=others, white=cases, registration_after=TR.registration(se["pts"], ch, "edge")[0])
        R7["rim_low_end"] = rec
        if not rec["end_is_lowest"] or se["L"] < MIN_LEN or min(cases[c]["white_src_px"] for c in ("1440 DPR 1", "1440 DPR 2")) < RIM_WHITE_MIN:
            G["r7"].append("rw-rim-seen low end: %s" % {k_: rec[k_] for k_ in ("end_after", "len_after", "end_is_lowest", "centre_to_tyre_ink")})
    # --- hoop-column: starts at the leg's end and runs along the column's measured top edge into one corner
    hc, hla = by.get("hoop-column"), by.get("hoop-leg-arch")
    if hc is None or not hc.get("top_edge"):
        G["r7"].append("hoop-column: no top edge")
    else:
        te = hc["top_edge"]
        P = np.asarray(hc["pts"], float)
        Lc = np.concatenate([[0], np.cumsum(np.hypot(*np.diff(P, axis=0).T))])
        tp = np.asarray(te["pts"], float)
        top_len = plen(tp)
        top = P[Lc <= top_len + 0.5]
        me_n, _ = ME.member_registration(top, te["polarity"], rgb=rgb, pick="nearest")
        me_s, _ = ME.member_registration(top, te["polarity"], rgb=rgb, pick="strongest")
        gen_all, _ = TR.registration(P, ch, "edge")
        rec = dict(start=r2(P[0], 2), end=r2(P[-1], 2), len=round(hc["L"], 1), top_edge_len=round(top_len, 1),
                   corner=r2(np.asarray(hc["segs"][hc["corners"][0]][0], float), 2) if hc["corners"] else None,
                   leg_start=r2(hla["pts"][0], 2) if hla else None,
                   start_to_leg_start=round(float(np.hypot(*(P[0] - np.asarray(hla["pts"][0], float)))), 3) if hla else None,
                   seg_corners=len(hc["corners"]), turns_over_60=turns(P), jogs=jogs(P),
                   top_member_edge_nearest=me_n, top_member_edge_strongest=me_s, registration_whole=gen_all,
                   jog_before="18.3 src px horizontal, 3.6 vertical between the leg's end (1512.6, 495.6) and the old start (1494.3, 499.2)")
        R7["hoop_column"] = rec
        if rec["start_to_leg_start"] is None or rec["start_to_leg_start"] > 0.6 or me_n["all"]["within2"] < 0.90 or rec["jogs"] or len(hc["corners"]) != 1:
            G["r7"].append("hoop-column: %s" % {k_: rec[k_] for k_ in ("start", "start_to_leg_start", "seg_corners", "jogs")})
    # --- lens-housing-top: its first 6 src px (in the black, no edge) cut
    lh = by.get("lens-housing-top")
    if lh is not None:
        P = np.asarray(lh["pts"], float)
        gen, _ = TR.registration(P, ch, "edge")
        rec = dict(start=r2(P[0], 2), end=r2(P[-1], 2), len=round(lh["L"], 2), trimmed_start_px=lh.get("trimmed_start_px"), registration=gen,
                   before="revision 6: from (1443.2, 447.5), 46.7 src px, registration 0.88 within 2 src px")
        R7["lens_housing_top"] = rec
        if min(P[0][0], P[-1][0]) < 1448.5 or lh["L"] < MIN_LEN or gen["within2"] < 0.90:
            G["r7"].append("lens-housing-top: %s" % {k_: rec[k_] for k_ in ("start", "len")})
    # --- A3: the rear bay keeps its three members (no candidate passes every gate; REAR_BAY_CANDIDATES_R7)
    R7["rear_bay_a3"] = dict(added=None, members={cl: [s["id"] for s in order if s["area"] == "rear-bay" and cl in s["classes"]] for cl in "DTP"},
                             candidates=REAR_BAY_CANDIDATES_R7)


# Fix r2 (2026-11-10; the main loop's decision on the feel verifier's note, an agent decision, not the owner's): class P's
# rear tyre floated free (its nearest drawn line outside the rear wheel was brace-centre, 59 src px away; 18.6 CSS px at
# 390), while at D and T rear-tube-level touches it (0.69 src px). P now also draws the smallest set of the EXISTING D/T
# rear-bay members that ties the tyre in: rear-tube-level alone (same geometry, no new tracing, at its D/T pen position
# after shadow-ground-rear). bar-below-brace would fail the rear-bay connection rule at P (P's brace-centre ends 9.1 src
# px from it, > RB_END); lower-rail-top ends 73 src px from the rear tyre, so it ties nothing to it.
FIX_R2_P_BAY = ("rear-tube-level",)
WHEEL_AREAS = ("rear-wheel", "g6-rear-tyre")


def fix_r2_gates(order, G, ch):
    """Fix r2 gates and records (G['fix_r2']: any entry fails; records in G['fix_r2_records'])."""
    G["fix_r2"] = []
    R = G.setdefault("fix_r2_records", {})
    by = {s["id"]: s for s in order}
    rt = by.get("rear-tyre")
    if rt is None:
        G["fix_r2"].append("no rear-tyre")
        return
    T = cKDTree(resample(rt["pts"], 0.5))

    def nearest(cl, skip=()):
        # the nearest shipped line of class cl to the rear tyre's drawn line, outside the rear wheel's own strokes
        best = [1e9, None]
        for o in order:
            if o is rt or cl not in o["classes"] or o["area"] in WHEEL_AREAS or o["id"] in skip or o["tier"] not in "cynfd" or o["kind"] in ("accent", "glyph"):
                continue
            d = float(T.query(resample(o["pts"], 0.5))[0].min())
            if d < best[0]:
                best = [round(d, 2), o["id"]]
        return best
    k390 = dict((c[0], c[1]) for c in GAP_CASES)["390 DPR 3"]
    pb = [s["id"] for s in order if s["area"] == "rear-bay" and "P" in s["classes"]]
    near = {cl: dict(with_fix=nearest(cl), without_fix=nearest(cl, FIX_R2_P_BAY) if cl == "P" else None) for cl in "DTP"}
    for v in near["P"].values():
        v.append(round(v[0] * k390, 2))                       # CSS px at 390 (the page's CSS px per src px there)
    rtl = by.get("rear-tube-level")
    m_rtl = rear_bay_measure(rtl, "P", order, ch, None) if rtl is not None else None
    bar, lrt = by.get("bar-below-brace"), by.get("lower-rail-top")
    not_added = {}
    if bar is not None:
        not_added["bar-below-brace"] = dict(measured_at_P=rear_bay_measure(bar, "P", order, ch, None),
                                            why="fails the rear-bay connection rule at P: neither end within %g src px of a drawn P line or the rear tyre, and no P line ends on it (brace-centre ends %.2f src px from it; at D and T the brace lands on it)"
                                                % (RB_END, float(cKDTree(resample(bar["pts"], 0.5)).query(by["brace-centre"]["pts"][-1])[0]) if "brace-centre" in by else -1))
    if lrt is not None:
        not_added["lower-rail-top"] = dict(to_rear_tyre=round(float(T.query(resample(lrt["pts"], 0.5))[0].min()), 2),
                                           why="it runs from the front tyre and ends far from the rear tyre: it ties nothing to it")
    R.update(p_rear_bay=pb, allowed=list(FIX_R2_P_BAY), rear_tyre_nearest_line=near, rear_tube_level_at_P=m_rtl, not_added=not_added,
             note="nearest_line: [src px, stroke, CSS px at 390 for P]; the rear wheel's own strokes (areas %s), accents and glyphs left out" % list(WHEEL_AREAS))
    if tuple(pb) != FIX_R2_P_BAY:
        G["fix_r2"].append("P rear bay %s (want %s)" % (pb, list(FIX_R2_P_BAY)))
    if m_rtl is None or not m_rtl["ok"] or min(m_rtl["ends_to_rear_tyre"]) > RB_END:
        G["fix_r2"].append("rear-tube-level at P: %s" % m_rtl)
    if near["P"]["with_fix"][0] > RB_END:
        G["fix_r2"].append("P rear tyre still free: nearest line %s" % near["P"]["with_fix"])


FEAT_BY_ID = {}
# the revision 5 amber-lens bottom span (its points every 4 src px, from revision 5's out/strokes.json): the record of how far it moved
R5_AMBER = [[1450.7, 467.0], [1454.1, 469.1], [1457.9, 470.3], [1461.8, 470.9], [1465.8, 471.1], [1469.8, 470.8], [1473.7, 470.0], [1477.4, 468.6], [1480.8, 466.4]]


# ================================================================== nodes: ends that meet another drawn line (revision 1)
def _unit(v):
    return v / (np.linalg.norm(v) + 1e-12)


def ray_hits(E, t, Q, umin, umax):
    """Parameters u of the intersections of E + u t with the polyline Q, within [umin, umax]."""
    hits = []
    for a, b in zip(Q[:-1], Q[1:]):
        d = b - a
        den = t[0] * d[1] - t[1] * d[0]
        if abs(den) < 1e-12:
            continue
        w = a - E
        u = (w[0] * d[1] - w[1] * d[0]) / den
        v = (w[0] * t[1] - w[1] * t[0]) / den
        if -1e-9 <= v <= 1 + 1e-9 and umin <= u <= umax:
            hits.append(float(u))
    return hits


def corner_points(s):
    return [np.asarray(s["segs"][k][0], float) for k in s["corners"] if 0 < k < len(s["segs"])]


def refit(s, P, err=0.5):
    """Re-fit a stroke's Beziers after its ends moved, keeping its corners where they were."""
    cps = corner_points(s)
    P = resample(np.asarray(P, float), 0.5)
    idx = sorted(set(int(np.argmin(np.hypot(*(P - c).T))) for c in cps))
    D, segs, corners = finish_stroke(P, idx, closed=False, err=err)
    s.update(pts=D, segs=segs, corners=corners, L=plen(D))


def meet(s, which, spec):
    """Move the start ('s') or end ('e') of stroke s along its end tangent (extend or trim) to the
    nearest crossing with the target stroke: its polyline (padded by `pad` src px at both ends) or,
    with line=True, the infinite straight line fitted through it. Returns the move in src px."""
    tgt = POOL_BY_ID.get(spec["to"])
    if tgt is None:
        return None
    T = resample(tgt["pts"], 0.5)
    if spec.get("line"):
        a, b, _, _ = TR.fit_line(T)
        u_ = _unit(b - a)
        c_ = (a + b) / 2
        Q = np.array([c_ - 600 * u_, c_ + 600 * u_])
    else:
        pad = float(spec.get("pad", 0))
        Q = np.vstack([T[0] + pad * _unit(T[0] - T[min(6, len(T) - 1)]), T, T[-1] + pad * _unit(T[-1] - T[max(0, len(T) - 7)])]) if pad else T
    P = resample(s["pts"], 0.5)
    k = min(len(P) - 1, 6)
    E = P[-1] if which == "e" else P[0]
    t = _unit(P[-1] - P[-1 - k]) if which == "e" else _unit(P[0] - P[k])
    mx = float(spec.get("max", 10))
    hits = ray_hits(E, t, Q, -mx, mx)
    if not hits:
        return None
    u = min(hits, key=abs)
    X = E + u * t
    if u >= 0:
        ext = resample(np.array([E, X]), 0.5)[1:]
        P2 = np.vstack([P, ext]) if which == "e" else np.vstack([ext[::-1], P])
    else:
        dd = np.hypot(*(P - X).T)
        i = int(np.argmin(dd))
        P2 = np.vstack([P[:i], X]) if which == "e" else np.vstack([X, P[i + 1:]])
    refit(s, P2)
    s.setdefault("meet", {})[which] = dict(to=spec["to"], line=bool(spec.get("line")), moved=round(u, 2))
    return u


MEET_ORDER = [("visor-brow", "s"), ("rail-lower", "s"), ("lower-rail-top", "s"),
              ("brace", "e"), ("post-below-beam", "s"),           # revision 4: the brace and the post land on the bar
              ("hoop-leg-arch", "e")]                             # revision 4: the hoop leg ends on the block's top line
CLEAR = {}
RIM_CUT = {}
TYRE_CLEAR = 4.5            # revision 4 (critic A5): no rim arc within this many src px of its tyre's drawn outline
RIM_SUPPORT_GAP = 6.0       # revision 4: rw-rim-fit ends where its edge support stops for more than this (src px)


def clear_ends(s, spec):
    """Revision 4: trim a stroke's ends until each lies at least spec['gap'] src px from the line
    spec['from'] (far-front-crown stops short of the nose line, so it reads as behind the body)."""
    tgt = POOL_BY_ID.get(spec["from"])
    if tgt is None:
        return None
    gap = float(spec["gap"])
    T = cKDTree(resample(tgt["pts"], 0.25))
    P = resample(s["pts"], 0.25)
    d = T.query(P)[0]
    i0, i1 = 0, len(P) - 1
    while i0 < i1 and d[i0] < gap:
        i0 += 1
    while i1 > i0 and d[i1] < gap:
        i1 -= 1
    rec = dict(to=spec["from"], gap=gap, before=[round(float(d[0]), 2), round(float(d[-1]), 2)], trimmed=[round(i0 * 0.25, 2), round((len(P) - 1 - i1) * 0.25, 2)],
               after=[round(float(d[i0]), 2), round(float(d[i1]), 2)], len_before=round(plen(P), 1))
    refit(s, P[i0:i1 + 1])
    rec["len_after"] = round(s["L"], 1)
    s["clear_ends"] = rec
    return rec


def rim_cut(fit, seen, tyre, ch, support=False):
    """Revision 4. (a) support=True: the fit arc ends where its edge support stops (the first run of
    samples with no measured edge within 2 src px longer than RIM_SUPPORT_GAP, after the first
    supported sample), so the seen arc carries the rest of the rim (rw-rim-fit: critic, 'end the arc
    where its edge support ends, near (1752, 712)'). (b) Every rim arc keeps TYRE_CLEAR src px from its
    tyre's drawn outline: a fit keeps the run from its start (the junction with its seen arc) up to its
    first sample inside the clearance; a seen arc loses the samples inside it at either end."""
    rec = dict(stroke=fit["id"])
    P = resample(fit["pts"], 1.0)
    L0 = plen(P)
    keep_to = len(P) - 1
    if support:
        _, off = TR.registration(P, ch, "edge", spacing=1.0)
        okk = off <= 2.0
        first = int(np.argmax(okk)) if okk.any() else 0
        run, cut = 0, None
        for i in range(first, len(okk)):
            if okk[i]:
                run = 0
                continue
            run += 1
            if run > RIM_SUPPORT_GAP:
                cut = i - run          # last supported sample
                break
        if cut is not None:
            keep_to = cut
        rec.update(support_first=[round(float(P[first][0]), 1), round(float(P[first][1]), 1)],
                   support_end=[round(float(P[keep_to][0]), 1), round(float(P[keep_to][1]), 1)],
                   support_share_kept=round(float(okk[first:keep_to + 1].mean()), 3) if keep_to > first else None)
    if tyre is not None:
        tt = cKDTree(resample(tyre["pts"], 0.5))
        d = tt.query(P)[0]
        inside = np.nonzero(d[: keep_to + 1] < TYRE_CLEAR)[0]
        if len(inside):
            keep_to = min(keep_to, int(inside[0]) - 1)
            rec["tyre_cut_at"] = [round(float(P[inside[0]][0]), 1), round(float(P[inside[0]][1]), 1)]
    if keep_to < len(P) - 1:
        Q = P[: keep_to + 1]
        D, segs, corners = finish_stroke(resample(Q, 0.5), [], closed=False, err=0.15)
        fit.update(pts=D, segs=segs, corners=corners, L=plen(D))
        fit["rim_cut"] = True
    rec.update(len_before=round(L0, 1), len_after=round(fit["L"], 1), end=[round(float(fit["pts"][-1][0]), 1), round(float(fit["pts"][-1][1]), 1)])
    # seen arc: trim the ends that come inside the clearance
    if tyre is not None and seen is not None:
        S_ = resample(seen["pts"], 0.5)
        d = cKDTree(resample(tyre["pts"], 0.5)).query(S_)[0]
        i0, i1 = 0, len(S_) - 1
        while i0 < i1 and d[i0] < TYRE_CLEAR:
            i0 += 1
        while i1 > i0 and d[i1] < TYRE_CLEAR:
            i1 -= 1
        if i0 > 0 or i1 < len(S_) - 1:
            D, segs, corners = finish_stroke(S_[i0:i1 + 1], [], closed=False, err=0.15)
            seen.update(pts=D, segs=segs, corners=corners, L=plen(D))
            rec["seen_trimmed"] = [round(i0 * 0.5, 1), round((len(S_) - 1 - i1) * 0.5, 1)]
    return rec



RIM_LOW_END = ("rw",)       # revision 7 (polish): the rims whose seen arc stops at its lowest point
RIM_LOW = {}
RIM_LOW_SEARCH = 15.0       # src px from the free end in which the lowest point is looked for


def rim_low_end(seen, fit, tyre):
    """Revision 7 (polish round 2026-11-10; the main loop's decision on the truth and feel critics' polish, an
    agent decision): the rear rim's seen arc ended 4.6 src px from rear-tyre's outline after curling up toward
    its start (the lit lip continues round the rim's bottom), so at 1x and 2x the rim read as a hook into the tyre
    line. The seen arc's free end (the end that is not its junction with the fit arc) is cut back to the arc's
    lowest point (largest y within RIM_LOW_SEARCH src px of that end), where its tangent is level: no upturn is
    left. The cut part is a true edge; nothing is added."""
    P = resample(seen["pts"], 0.25)
    J = np.asarray(fit["pts"][0], float)
    free_start = np.hypot(*(P[0] - J)) > np.hypot(*(P[-1] - J))
    Q = P if free_start else P[::-1]
    s_ = np.concatenate([[0], np.cumsum(np.hypot(*np.diff(Q, axis=0).T))])
    w = s_ <= RIM_LOW_SEARCH
    i = int(np.argmax(np.where(w, Q[:, 1], -np.inf)))
    tt = cKDTree(resample(tyre["pts"], 0.25)) if tyre is not None else None
    t0 = np.asarray(tyre["pts"][0], float) if tyre is not None else None
    rec = dict(stroke=seen["id"], free_end="start" if free_start else "end", end_before=r2(Q[0], 2), len_before=round(float(s_[-1]), 2),
               to_tyre_before=round(float(tt.query(Q[0])[0]), 2) if tt is not None else None,
               to_tyre_start_before=round(float(np.hypot(*(Q[0] - t0))), 2) if tyre is not None else None)
    if i > 0:
        R = Q[i:] if free_start else Q[i:][::-1]
        D, segs, corners = finish_stroke(R, [], closed=False, err=0.15)
        seen.update(pts=D, segs=segs, corners=corners, L=plen(D))
    E = np.asarray(seen["pts"][0] if free_start else seen["pts"][-1], float)
    rec.update(cut_src_px=round(float(s_[i]), 2), lowest_point=r2(Q[i], 2), end_after=r2(E, 2), len_after=round(seen["L"], 2),
               to_tyre_after=round(float(tt.query(E)[0]), 2) if tt is not None else None,
               to_tyre_start_after=round(float(np.hypot(*(E - t0))), 2) if tyre is not None else None)
    seen["rim_low_end"] = rec
    return rec


def crossings(P, Q):
    """Proper crossings of polylines P and Q: list of (X, sP, sQ, angle_deg) with the arc lengths of X
    along each and the angle between them (0-90)."""
    P = np.asarray(P, float); Q = np.asarray(Q, float)
    if len(P) < 2 or len(Q) < 2:
        return []
    if (P.max(0) < Q.min(0) - 1).any() or (Q.max(0) < P.min(0) - 1).any():
        return []
    sP = np.concatenate([[0], np.cumsum(np.hypot(*np.diff(P, axis=0).T))])
    sQ = np.concatenate([[0], np.cumsum(np.hypot(*np.diff(Q, axis=0).T))])
    A = P[:-1][:, None, :]; dA = (P[1:] - P[:-1])[:, None, :]
    B = Q[:-1][None, :, :]; dB = (Q[1:] - Q[:-1])[None, :, :]
    den = dA[..., 0] * dB[..., 1] - dA[..., 1] * dB[..., 0]
    w = B - A
    with np.errstate(divide="ignore", invalid="ignore"):
        tt = (w[..., 0] * dB[..., 1] - w[..., 1] * dB[..., 0]) / den
        uu = (w[..., 0] * dA[..., 1] - w[..., 1] * dA[..., 0]) / den
    ok = (np.abs(den) > 1e-12) & (tt >= 0) & (tt < 1) & (uu >= 0) & (uu < 1)
    out = []
    for i, j in zip(*np.nonzero(ok)):
        X = P[i] + tt[i, j] * (P[i + 1] - P[i])
        a = P[i + 1] - P[i]; b = Q[j + 1] - Q[j]
        c = abs(float(np.dot(a, b))) / (np.hypot(*a) * np.hypot(*b) + 1e-12)
        out.append((X, float(sP[i] + tt[i, j] * np.hypot(*a)), float(sQ[j] + uu[i, j] * np.hypot(*b)), math.degrees(math.acos(min(1.0, c)))))
    return out


TRIMS = {}


def trim_at(s, spec):
    """Revision 5 (cross gate): an end of s that runs past the drawn line spec['to'] by at most
    spec['max'] src px (an overshoot that reads as a small X) is trimmed back to the crossing (a T)."""
    tgt = POOL_BY_ID.get(spec["to"])
    if tgt is None:
        return None
    P = resample(s["pts"], 0.25)
    L = plen(P)
    hx = crossings(P, resample(tgt["pts"], 0.25))
    mx = float(spec.get("max", 8.0))
    rec = dict(to=spec["to"], max=mx, len_before=round(L, 1), crossings=[[round(float(X[0]), 1), round(float(X[1]), 1), round(sp, 2), round(ang, 1)] for X, sp, _, ang in hx])
    a, b = 0.0, L
    st = [h for h in hx if h[1] <= mx]
    en = [h for h in hx if L - h[1] <= mx]
    if st:
        h = max(st, key=lambda h: h[1])
        a = h[1]
        rec["trimmed_start"] = round(a, 2)
        rec["start_at"] = [round(float(h[0][0]), 2), round(float(h[0][1]), 2)]
    if en:
        h = min(en, key=lambda h: h[1])
        b = h[1]
        rec["trimmed_end"] = round(L - b, 2)
        rec["end_at"] = [round(float(h[0][0]), 2), round(float(h[0][1]), 2)]
    if st or en:
        s_ = np.concatenate([[0], np.cumsum(np.hypot(*np.diff(P, axis=0).T))])
        parts = []
        if st:
            parts.append(max(st, key=lambda h: h[1])[0][None, :])
        parts.append(P[(s_ > a) & (s_ < b)])
        if en:
            parts.append(min(en, key=lambda h: h[1])[0][None, :])
        refit(s, np.vstack(parts))
    rec["len_after"] = round(s["L"], 1)
    s.setdefault("trim_at", []).append(rec)
    return rec


END_TRIM = {}


def trim_end_below(s, spec):
    """Revision 5: end stroke s where it first comes down to spec['dy'] src px below the start of
    stroke spec['of'] (walking from its end backwards), so nose-loop stops about 10 src px below
    nose-underside's start."""
    ref = POOL_BY_ID[spec["of"]]
    y_cut = float(ref["pts"][0][1]) + float(spec["dy"])
    P = resample(s["pts"], 0.25)
    i = len(P) - 1
    while i > 0 and P[i][1] > y_cut:
        i -= 1
    if i >= len(P) - 1:
        return None
    a, b = P[i], P[i + 1]
    tt = (y_cut - a[1]) / (b[1] - a[1]) if abs(b[1] - a[1]) > 1e-9 else 0.0
    X = a + tt * (b - a)
    L0 = plen(P)
    refit(s, np.vstack([P[:i + 1], X]), err=0.15)       # 0.15: the smoothed far span stays as fitted
    rec = dict(of=spec["of"], of_start=[round(float(ref["pts"][0][0]), 2), round(float(ref["pts"][0][1]), 2)], dy=spec["dy"], y_cut=round(y_cut, 2),
               end_before=[round(float(P[-1][0]), 2), round(float(P[-1][1]), 2)], end_after=[round(float(s["pts"][-1][0]), 2), round(float(s["pts"][-1][1]), 2)],
               len_before=round(L0, 1), len_after=round(s["L"], 1), trimmed=round(L0 - s["L"], 1))
    s["end_trim"] = rec
    return rec


RESNAP = {}
SMOOTH = {}
LETTER_REC = {}
HELD = []
SHIP_HELD = False
CROWN = "detail"            # revision 5: DETAIL tier (main loop); --crown form|drop for comparison builds only
FW_LIP = (1446, 1470, 799, 809)      # x0, x1, y0, y1 of the front rim's lit top lip (critic, revision 2)


def apply_meets(feats):
    spec = {f["id"]: f.get("meet") or {} for f in feats}
    for sid, which in MEET_ORDER:
        if sid not in POOL_BY_ID or which not in spec.get(sid, {}):
            continue
        u = meet(POOL_BY_ID[sid], which, spec[sid][which])
        if u is None:
            raise SystemExit("meet: %s %s found no crossing with %s" % (sid, which, spec[sid][which]["to"]))
        log("meet %-16s %s -> %-12s moved %+.2f src px" % (sid, which, spec[sid][which]["to"], u))


def longest_true_run(keep):
    best, cur = [], []
    for i, k in enumerate(keep):
        if k:
            cur.append(i)
        else:
            if len(cur) > len(best):
                best = cur
            cur = []
    if len(cur) > len(best):
        best = cur
    return best


SK_REGIONS = {}


def trace_skeleton_feature(tracer, f, rgb):
    """A band drawn as its centre line: the skeleton of a colour mask (glyphs.py machinery),
    routed through waypoints; checked against the medial axis like the glyphs."""
    sk = f["skeleton"]
    key = (tuple(sk["box"]), sk["ink"])
    if key not in SK_REGIONS:
        SK_REGIONS[key] = GL.Region(tuple(sk["box"]), sk["ink"], rgb, minarea=sk.get("minarea", 6))
    reg = SK_REGIONS[key]
    D, rep = GL.trace_glyph_stroke(reg, sk["wp"], closed=False)
    if D is None:
        raise SystemExit("skeleton feature %s: %s" % (f["id"], rep))
    add(f["id"], D, f["phase"], f["tier"], f["kind"], f["area"], f["classes"], f["prov"], members_of(f), pin=f.get("pin"),
        segs=[np.asarray(c) for c in rep["segs"]], corners=[], feature=f["id"], mode="skeleton",
        skeleton_check={k: (round(v, 3) if isinstance(v, float) else v) for k, v in rep.items() if k != "segs"}, member_info=[])


DROPPED_PIECES = []


def trace_features(tracer, feats, rgb=None):
    for f in feats:
        if f.get("skeleton"):
            trace_skeleton_feature(tracer, f, rgb)
            continue
        mem = f["members"]
        variants = [[f["classes"], list(range(len(mem))), f["id"]]]
        for cl, idxs in (f.get("classes_members") or {}).items():
            variants[0][0] = "".join(c for c in variants[0][0] if c != cl)
            variants.append([cl, idxs, f["id"] + "-" + cl.lower()])
        for classes, idxs, vid in variants:
            ms = [dict(mem[i]) for i in idxs]
            for j, m in enumerate(ms):
                m["corner"] = bool(m.get("corner")) and j > 0
            pieces = [tracer.member(f, m) for m in ms]
            infos = [dict(member=(m.get("inv") or "authored"), **pc["info"]) for m, pl in zip(ms, pieces) for pc in pl]
            strokes = assemble(f, pieces, ms)
            if f.get("cut_below_y"):
                xl, yl = f["cut_below_y"]
                cut = []
                for P, cr in strokes:
                    best = longest_true_run(~((P[:, 0] < xl) & (P[:, 1] > yl)))
                    if best:
                        cut.append((P[best[0]: best[-1] + 1], [c - best[0] for c in cr if best[0] < c < best[-1]]))
                strokes = cut
            if f.get("keep_x"):
                xl, xr = f["keep_x"]
                cut = []
                for P, cr in strokes:
                    best = longest_true_run((P[:, 0] >= xl) & (P[:, 0] <= xr))
                    if best:
                        cut.append((P[best[0]: best[-1] + 1], [c - best[0] for c in cr if best[0] < c < best[-1]]))
                strokes = cut
            if f.get("keep_tail"):
                cut = []
                for P, cr in strokes:
                    L_ = plen(P)
                    cut.append((sub(P, 1 - f["keep_tail"] / L_, 1.0), []) if L_ > f["keep_tail"] else (P, cr))
                strokes = cut
            for k, (P, cr) in enumerate(strokes):
                sid = vid if len(strokes) == 1 else "%s-%s" % (vid, "abcdef"[k])
                closed = bool(f.get("closed")) and np.hypot(*(P[0] - P[-1])) < 6.0
                if f.get("pin") == "ccw":
                    Q = P if closed else np.vstack([P, P[:1]])
                    if C.signed_area(Q) > 0:
                        P = P[::-1].copy()
                        cr = [len(P) - 1 - c for c in cr]
                # revision 2: drop a piece that is re-traced by another feature
                if ("abcdef"[k] if len(strokes) > 1 else "") in (f.get("piece_drop") or []):
                    DROPPED_PIECES.append(dict(id=sid, why="re-traced by another feature (see features.py)"))
                    continue
                # revision 2: cut a piece's end where it runs into the black (x beyond piece_xmax)
                pxm = (f.get("piece_xmax") or {}).get("abcdef"[k] if len(strokes) > 1 else "")
                if pxm is not None and not closed:
                    R = resample(P, 0.5)
                    keep = longest_true_run(R[:, 0] <= pxm)
                    P = R[keep[0]: keep[-1] + 1]
                    cr = []
                # revision 2: extend a straight stroke's start along its own line up to a given y
                if f.get("extend_start_to_y") is not None and not closed:
                    u_ = _unit(P[0] - P[-1])
                    if abs(u_[1]) > 1e-6 and (f["extend_start_to_y"] - P[0][1]) / u_[1] > 0:
                        X_ = P[0] + u_ * (f["extend_start_to_y"] - P[0][1]) / u_[1]
                        P = np.vstack([resample(np.array([X_, P[0]]), 1.0)[:-1], P])
                        cr = [c + 0 for c in cr]
                # revision 2: cut the first trim_start src px (after the direction is fixed)
                if f.get("trim_start") and not closed:
                    L_ = plen(P)
                    P = sub(P, f["trim_start"] / L_, 1.0)
                    cr = []
                if f.get("overrun") and closed:
                    R = resample(P, 0.5)
                    P = np.vstack([R, R[1: int(f["overrun"] / 0.5) + 1]])
                    cr = []
                    closed = False
                extra = {}
                # revision 5: a closed loop drawn open, with a gap of `frac` of its length centred at
                # the loop point nearest `at` (amber-lens)
                if f.get("open_gap") and closed:
                    og = f["open_gap"]
                    Q = np.asarray(P, float)
                    if np.hypot(*(Q[0] - Q[-1])) > 1e-6:
                        Q = np.vstack([Q, Q[:1]])
                    R = resample(Q, 0.25)[:-1]
                    k0 = int(np.argmin(np.hypot(*(R - np.asarray(og["at"], float)).T)))
                    R = np.vstack([R[k0:], R[:k0], R[k0:k0 + 1]])
                    Lc = plen(R)
                    half = og["frac"] * Lc / 2
                    P = sub(R, half / Lc, 1 - half / Lc)
                    cr = []
                    closed = False
                    extra["open_gap"] = dict(frac=og["frac"], at=og["at"], centre=[round(float(R[0][0]), 2), round(float(R[0][1]), 2)], loop_len=round(Lc, 1),
                                             gap_arc=round(2 * half, 2), gap_chord=round(float(np.hypot(*(P[0] - P[-1]))), 2), len_after=round(plen(P), 1))
                if pxm is not None and not closed:
                    extra["trimmed_xmax"] = pxm
                if f.get("trim_start") and not closed:
                    extra["trimmed_start_px"] = f["trim_start"]
                if f.get("extend_start_to_y") is not None and not closed:
                    extra["extended_start_to_y"] = f["extend_start_to_y"]
                for k_ in ("hold", "after", "convention",          # revision 3, 5
                           "occluded", "member_edge", "leg_edge", "line", "rb_min_len",   # revision 6
                           "top_edge"):                                                  # revision 7
                    if f.get(k_):
                        extra[k_] = f[k_]
                if f.get("blunt"):
                    extra["blunt_spec"] = list(f["blunt"])
                add(sid, P, f["phase"], f["tier"], f["kind"], f["area"], classes, f["prov"], members_of(f), pin=f.get("pin"),
                    corners=cr, closed=closed, feature=f["id"], mode=f["mode"], chan=f.get("chan"), gesture=f.get("gesture"),
                    member_info=infos, straight=all(m.get("straight") for m in ms), **extra)


def accent_len(src, start_px, length_px, sid, classes, why, from_end=False):
    """Accent over an absolute stretch of a traced stroke (src px), in its direction."""
    if src not in POOL_BY_ID:
        REJECTED.append(dict(id=sid, why="source stroke %s was rejected" % src))
        return None
    L = POOL_BY_ID[src]["L"]
    a = (L - start_px - length_px) / L if from_end else start_px / L
    return accent(src, max(0.0, a), min(1.0, a + length_px / L), sid, classes, why)


def accent(src, a, b, sid, classes, why):
    if src not in POOL_BY_ID:
        REJECTED.append(dict(id=sid, why="source stroke %s was rejected" % src))
        return None
    s = POOL_BY_ID[src]
    P = sub(s["pts"], a, b)
    return add(sid, P, 5, "a", "accent", "accent", classes, "derived", s["members"], pin="as-authored", derived_from=src,
               derived_range=[a, b], note=why)


# ================================================================== ordering (PEN_SPEC section 4)
AREA_ORDER = {
    2: ["nose-top", "cockpit", "side-plate", "front-wheel", "rear-wheel", "hoop", "box", "rear-bay", "helmet", "driver"],
    3: ["side-plate", "lettering", "nose-rear", "nose-front", "driver", "front-wheel", "rear-wheel", "rear-frame"],
    # revision 2: P3 ends on the nose top (its 219), so P4 starts under the nose and sweeps left to
    # right, ending under the rear tyre (no P5 ships)
    4: ["hatch-front-tyre", "shadow-nose", "hatch-body", "hatch-box", "hatch-rear-tyre", "shadow-rear"],
}
FIXED_AREAS = ("lettering", "shadow-nose", "shadow-rear")
HATCH_INFO = {}


def flip(s):
    s["pts"] = s["pts"][::-1].copy()
    n = len(s["segs"])
    s["segs"] = [c[::-1].copy() for c in s["segs"][::-1]]
    s["corners"] = sorted(n - k for k in s["corners"])
    s["flipped"] = not s.get("flipped", False)


def order_all():
    out, pen = [], None
    for ph in range(6):
        ss = [s for s in POOL if s["phase"] == ph]
        if ph in (0, 1, 5):
            ss.sort(key=lambda s: s.get("seq", 0))
            out += ss
            if ss:
                pen = ss[-1]["pts"][-1]
            continue
        left = [s for s in ss if s["area"] not in AREA_ORDER[ph]]
        if left:
            raise SystemExit("strokes in unknown areas: %s" % [(s["id"], s["area"]) for s in left])
        for ar in AREA_ORDER[ph]:
            grp = [s for s in ss if s["area"] == ar]
            if not grp:
                continue
            fixed = [s for s in grp if s["kind"] in ("glyph", "hatch") or ar in FIXED_AREAS]
            free = [s for s in grp if s not in fixed]
            fixed.sort(key=lambda s: s.get("seq", 0))
            if free:
                free = sorted(free, key=lambda s: -s["L"])
                first = free.pop(0)
                if pen is not None and not first.get("pin") and not first["closed"]:
                    if np.hypot(*(first["pts"][-1] - pen)) < np.hypot(*(first["pts"][0] - pen)):
                        flip(first)
                seq_free = [first]
                p = first["pts"][-1]
                while free:
                    best, bi, fl = 1e18, 0, False
                    for i, s in enumerate(free):
                        d0 = np.hypot(*(s["pts"][0] - p)); d1 = np.hypot(*(s["pts"][-1] - p))
                        sc0 = d0 - 0.35 * s["L"]; sc1 = d1 - 0.35 * s["L"]
                        if sc0 < best:
                            best, bi, fl = sc0, i, False
                        if not s.get("pin") and not s["closed"] and sc1 < best:
                            best, bi, fl = sc1, i, True
                    s = free.pop(bi)
                    if fl:
                        flip(s)
                    seq_free.append(s)
                    p = s["pts"][-1]
                grp_out = fixed + seq_free if (ph == 3 and ar in ("side-plate", "nose-rear")) else seq_free + fixed
            else:
                grp_out = fixed
            # a rim's fit arc (in the black) follows its seen arc and continues from its end
            for fit in [s for s in grp_out if s["id"].endswith("-rim-fit")]:
                seen = next((s for s in grp_out if s["id"] == fit["id"].replace("-fit", "-seen")), None)
                if seen is None:
                    continue
                grp_out.remove(fit)
                k = grp_out.index(seen)
                if np.hypot(*(fit["pts"][0] - seen["pts"][-1])) > np.hypot(*(fit["pts"][-1] - seen["pts"][-1])):
                    flip(fit)
                grp_out.insert(k + 1, fit)
            # revision 3: a stroke with 'after' follows that stroke directly, starting at its end nearer the pen
            for s in [s for s in grp_out if s.get("after")]:
                prev = next((o for o in grp_out if o["id"] == s["after"]), None)
                if prev is None:
                    continue
                grp_out.remove(s)
                k = grp_out.index(prev)
                if not s.get("pin") and np.hypot(*(s["pts"][0] - prev["pts"][-1])) > np.hypot(*(s["pts"][-1] - prev["pts"][-1])):
                    flip(s)
                grp_out.insert(k + 1, s)
            out += grp_out
            pen = grp_out[-1]["pts"][-1]
    return out


# ================================================================== rejection gates (PEN_SPEC 16.2 + pilot critic)
REJECTED = []


def reg_of(s, ch, tracer):
    src = POOL_BY_ID[s["derived_from"]] if s.get("derived_from") else s
    mode = src.get("mode") or "edge"
    chx = tracer.ch_a if src.get("chan") == "a" else ch
    return TR.registration(s["pts"], chx, mode if mode in ("edge", "valley", "ridge") else "edge")


def registration_pass(ch, tracer):
    """Traced line strokes must lie within 2 src px of a measured edge along most (80 %) of
    their length. A stroke that fails keeps its longest well-registered run (offsets <= 2 px,
    gaps of one sample tolerated) when that run is >= 40 src px and itself >= 90 % within 2 px;
    otherwise it is rejected. P1 silhouette strokes are never trimmed here: they are reported."""
    for s in list(POOL):
        if s["prov"] != "traced" or s["kind"] in ("glyph", "hatch") or s.get("mode") == "skeleton":
            continue
        summ, off = reg_of(s, ch, tracer)
        if summ["within2"] >= REG_MIN_W2 or s["phase"] == 1:
            continue
        ok = off <= 2.0
        # tolerate single-sample gaps
        okk = ok.copy()
        for i in range(1, len(ok) - 1):
            if not ok[i] and ok[i - 1] and ok[i + 1]:
                okk[i] = True
        best = longest_true_run(okk)
        P2 = resample(s["pts"], 2.0)
        if best and len(best) >= 2:
            seg = P2[best[0]: best[-1] + 1]
            if plen(seg) >= MIN_LEN:
                Lp = plen(s["pts"])
                a, b_ = best[0] * 2.0 / max(Lp, 1e-6), min(1.0, best[-1] * 2.0 / max(Lp, 1e-6))
                sub_pts = sub(s["pts"], a, b_)
                D, segs, corners = finish_stroke(sub_pts, [], closed=False)
                old_id = s["id"]
                s.update(pts=D, segs=segs, corners=corners, L=plen(D), closed=False, trimmed_by_registration=[round(a, 3), round(b_, 3)])
                summ2, _ = reg_of(s, ch, tracer)
                if summ2["within2"] >= REG_MIN_W2:
                    continue
                s["trimmed_by_registration"] = None
        REJECTED.append(dict(id=s["id"], why="registration: %.0f %% of samples within 2 src px of a measured edge, and no run of >= 40 src px that is" % (100 * summ["within2"])))
        POOL.remove(s)
        POOL_BY_ID.pop(s["id"], None)


def length_mask_pass():
    car = C.load_json(C.INP / "car-mask.json")["polygon"]
    for s in list(POOL):
        why = None
        if s["kind"] not in ("hatch", "glyph") and s["L"] < MIN_LEN:
            why = "length %.1f src px, under the %d src px gate" % (s["L"], MIN_LEN)
        else:
            mid = sub(s["pts"], 0.5, 0.5)[0]
            if not point_in_poly(mid, car):
                dd = dist_to_poly(mid, car)
                if dd > MASK_OUT:
                    why = "midpoint %.1f src px outside the car mask" % dd
        if why:
            REJECTED.append(dict(id=s["id"], why=why))
            POOL.remove(s)
            POOL_BY_ID.pop(s["id"], None)


# ================================================================== gates
def point_in_poly(p, poly):
    x, y = p
    inside = False
    n = len(poly)
    for i in range(n):
        x1, y1 = poly[i]; x2, y2 = poly[(i + 1) % n]
        if (y1 > y) != (y2 > y):
            xin = x1 + (y - y1) * (x2 - x1) / (y2 - y1)
            if x < xin:
                inside = not inside
    return inside


def dist_to_poly(p, poly):
    P = np.asarray(poly, float)
    best = 1e18
    for i in range(len(P)):
        a, b = P[i], P[(i + 1) % len(P)]
        ab = b - a
        t = np.clip(np.dot(p - a, ab) / max(np.dot(ab, ab), 1e-9), 0, 1)
        best = min(best, float(np.hypot(*(a + t * ab - p))))
    return best


def gates(order, ch, tracer, H, gregs):
    car = C.load_json(C.INP / "car-mask.json")["polygon"]
    G = {"length": [], "car_mask": [], "deny_id": [], "deny_feature": [], "registration": [], "straight": [], "hatch_mask": [],
         "hatch_rules": [], "glyph": [], "driver_count": None, "provenance": []}
    reg_stats = {}
    for s in order:
        sid = s["id"]
        # length
        if s["kind"] not in ("hatch", "glyph") and s["L"] < MIN_LEN:
            G["length"].append([sid, round(s["L"], 1)])
        # car mask: midpoint by arc length
        mid = sub(s["pts"], 0.5, 0.5)[0]
        if not point_in_poly(mid, car):
            d = dist_to_poly(mid, car)
            if d > MASK_OUT:
                G["car_mask"].append([sid, round(d, 1)])
        # deny lists
        if any(w in sid for w in DENY_WORDS):
            G["deny_id"].append(sid)
        if any(m in DENY_FEATURES for m in s["members"]):
            G["deny_feature"].append([sid, [m for m in s["members"] if m in DENY_FEATURES]])
        if s["prov"] not in ("traced", "fitted", "derived", "convention"):
            G["provenance"].append(sid)
        # registration: traced, non-glyph line strokes (accents are sub-ranges of traced strokes: measured too)
        if s.get("mode") == "skeleton":
            sc = s["skeleton_check"]
            if sc["medial_max"] > 1.0:
                G["registration"].append([sid, "medial max %.2f" % sc["medial_max"]])
        elif s["prov"] in ("traced", "derived") and s["kind"] not in ("glyph", "hatch"):
            src = POOL_BY_ID[s["derived_from"]] if s.get("derived_from") else s
            mode = src.get("mode") or "edge"
            chx = tracer.ch_a if src.get("chan") == "a" else ch
            summ, off = TR.registration(s["pts"], chx, mode if mode in ("edge", "valley", "ridge") else "edge")
            reg_stats[sid] = summ
            s["registration"] = {k: (round(v, 3) if isinstance(v, float) else v) for k, v in summ.items()}
            if summ["within2"] < REG_MIN_W2:
                G["registration"].append([sid, round(summ["within2"], 2)])
        if s.get("straight") and s["area"] == "rear-frame":
            devs = [mi.get("dev_max") for mi in s.get("member_info", []) if "dev_max" in mi]
            if devs and max(devs) > 1.0:
                G["straight"].append([sid, max(devs)])
        if s["kind"] == "hatch":
            ins = H.inside(resample(s["pts"], 0.5))
            if not ins.all():
                G["hatch_mask"].append([sid, round(float(ins.mean()), 3)])
        if s["kind"] == "glyph":
            gc = s["glyph_check"]
            if gc.get("dot"):
                if not gc.get("in_letter_mask"):
                    G["glyph"].append([sid, "dot below the letter threshold"])
            elif gc["medial_max"] > 1.0:
                G["glyph"].append([sid, "medial max %.2f" % gc["medial_max"]])
    # letters: at most 2 strokes per letter
    per = {}
    for s in order:
        if s["kind"] == "glyph" and s["glyph"]["ch"] != "i-dot":
            k = (s["glyph"]["word"], s["glyph"]["letter"])
            per[k] = per.get(k, 0) + 1
    for k, n in per.items():
        if n > 2:
            G["glyph"].append(["%s letter %d" % k, "%d strokes" % n])
    # glyph free ends (revision 1): each free end within 1 src px of the ink end minus half the stroke width
    G["glyph_ends"] = []
    G["glyph_end_worst"] = 0.0
    for s in order:
        e = (s.get("glyph_check") or {}).get("ends")
        if not e:
            continue
        for which, g in e["gap"].items():
            G["glyph_end_worst"] = max(G["glyph_end_worst"], abs(g))
            if abs(g) > GL.END_TOL:
                G["glyph"].append([sid_of(s), "%s end %+.2f src px from the ink end minus half width" % ({"s": "start", "e": "end"}[which], g)])
            G["glyph_ends"].append([s["id"], which, g])
    # driver (revision 1): D, T at most 4 named strokes (collar, neck, torso-edge, sleeve-band); P at most 2; nothing closed
    G["driver_count"] = {cl: sum(1 for s in order if s["area"] == "driver" and cl in s["classes"]) for cl in "DTP"}
    G["driver"] = [s["id"] for s in order if s["area"] == "driver" and s["closed"]]
    for cl, lim in (("D", 4), ("T", 4), ("P", 2)):
        if G["driver_count"][cl] > lim:
            G["driver"].append("%s: %d driver strokes > %d" % (cl, G["driver_count"][cl], lim))
    # helmet (revision 1): no visor-lower; the brow starts on the helmet outline (<= 2 src px)
    G["helmet"] = []
    hel = POOL_BY_ID.get("helmet")
    vb = POOL_BY_ID.get("visor-brow")
    if any(s["id"].startswith("visor-lower") for s in order):
        G["helmet"].append("visor-lower drawn")
    if vb is not None and hel is not None:
        dvb = float(cKDTree(resample(hel["pts"], 0.25)).query(vb["pts"][0])[0])
        G["helmet_brow_start_to_outline"] = round(dvb, 2)
        if dvb > 2.0:
            G["helmet"].append("visor-brow starts %.2f src px from the helmet outline" % dvb)
    # P1 order (revision 1): the helmet after the hoop arch, column and brace
    ids = [s["id"] for s in order]
    G["p1_order"] = []
    if "helmet" in ids:
        for o in ("hoop-leg-arch", "hoop-column", "brace", "brace-centre"):
            if o in ids and ids.index(o) > ids.index("helmet"):
                G["p1_order"].append("%s after helmet" % o)
    # rear frame (revision 1): ends on nodes (<= 4 src px), at most 2 near-horizontal tubes, counts D/T <= 4, P <= 3
    G["rear_frame_count"] = {cl: sum(1 for s in order if s["area"] == "rear-frame" and cl in s["classes"]) for cl in "DTP"}
    G["rear_frame"] = []
    G["rear_frame_nodes"] = []
    G["rear_frame_horizontal"] = {}
    for cl in "DTP":
        rf = [s for s in order if s["area"] == "rear-frame" and cl in s["classes"]]
        lim = 3 if cl == "P" else 4
        if len(rf) > lim:
            G["rear_frame"].append("%s: %d rear-frame strokes > %d" % (cl, len(rf), lim))
        nh = []
        for s in rf:
            others = [resample(o["pts"], 0.5) for o in order if o is not s and cl in o["classes"] and o["tier"] in "cynfda" and o["kind"] != "glyph"]
            tree = cKDTree(np.vstack(others))
            if s["closed"]:
                dmin = float(tree.query(resample(s["pts"], 0.5))[0].min())
                G["rear_frame_nodes"].append([cl, s["id"], "closed", round(dmin, 2)])
                if dmin > 4.0:
                    G["rear_frame"].append("%s: %s (closed) is %.1f src px from any other line" % (cl, s["id"], dmin))
            else:
                for which, p in (("s", s["pts"][0]), ("e", s["pts"][-1])):
                    dd = float(tree.query(p)[0])
                    G["rear_frame_nodes"].append([cl, s["id"], which, round(dd, 2)])
                    if dd > 4.0:
                        G["rear_frame"].append("%s: %s %s end is %.1f src px from any other line" % (cl, s["id"], which, dd))
            if horizontal_share(s) >= 0.5:
                nh.append(s["id"])
        G["rear_frame_horizontal"][cl] = nh
        if len(nh) > 2:
            G["rear_frame"].append("%s: %d near-horizontal tubes > 2" % (cl, len(nh)))
    # shadows (revision 1): open SHADE strokes only; at most one nose and one rear; rear <= 60 % of the old 192 px loop;
    # the nose shadow keeps >= 12 src px from the nose contour
    # revision 3: no nose shadow in any class; the rear shadow edge is one open stroke in P2 'rear-wheel'
    # straight after rw-rim-fit (DETAIL or FORM weight), at most 60 % of the old 192.3 src px loop; P4 is empty
    G["shadow"] = []
    sh = [s for s in order if s["id"].startswith("shadow-")]
    for s in sh:
        if s["closed"] or np.hypot(*(s["pts"][0] - s["pts"][-1])) < 6:
            G["shadow"].append("%s is closed" % s["id"])
        if s["id"].startswith("shadow-ground-front") or s["area"] == "shadow-nose":
            G["shadow"].append("%s: a nose shadow is drawn" % s["id"])
        if s["id"] == "shadow-ground-rear":
            ids_ = [o["id"] for o in order]
            k = ids_.index(s["id"])
            if s["phase"] != 2 or s["area"] != "rear-wheel" or s["tier"] not in "fd" or k == 0 or ids_[k - 1] != "rw-rim-fit":
                G["shadow"].append("shadow-ground-rear not in P2 rear-wheel at FORM/DETAIL weight straight after rw-rim-fit (after %s)" % ids_[k - 1])
            if s["L"] > 0.6 * 192.3 + 0.5:
                G["shadow"].append("%s %.1f src px > 60 %% of 192.3" % (s["id"], s["L"]))
            rt_ = POOL_BY_ID.get("rear-tyre")
            if rt_ is not None:
                G["shadow_rear_to_tyre"] = round(float(min(cKDTree(resample(rt_["pts"], 0.5)).query(p)[0] for p in (s["pts"][0], s["pts"][-1]))), 2)
    G["p4_strokes"] = [s["id"] for s in order if s["phase"] == 4]
    if G["p4_strokes"]:
        G["shadow"].append("P4 is not empty: %s" % G["p4_strokes"])
    # ---------------- revision 2 gates
    # far nose silhouette on the asphalt-to-stripe boundary, never on the decal edge
    G["far_silhouette"] = {}
    for sid in ("nose-loop", "nose-gesture"):
        if sid in POOL_BY_ID:
            G["far_silhouette"][sid] = far_silhouette_gate(POOL_BY_ID[sid], RGB[0])
    G["r2"] = []
    fs = G["far_silhouette"].get("nose-loop")
    if not fs or not fs["ok"]:
        G["r2"].append("nose-loop far span: %s" % fs)
    # ---------------- revision 4 gates
    G["r4"] = []
    # the main hoop (revision 4 replaces revision 2's one-stroke rule): the P1 contour is the arch
    # alone, ending where the leg meets the block (within 3 src px of (1427.8, 483.9)) ON the block's
    # drawn top line (within 1 src px), nothing of it left of x 1426 (no step); the block is its own
    # P2 FORM stroke (leg-block) in every class, its corner near (1417.9, 484.1), its top line running
    # past the leg's foot on both sides (>= 5 src px), so the leg reads as entering it
    hla = POOL_BY_ID.get("hoop-leg-arch")
    lb = POOL_BY_ID.get("leg-block")
    hoop = {}
    if hla is None or hla["classes"] != "DTP" or hla["phase"] != 1:
        G["r4"].append("hoop-leg-arch missing, not P1 or not in every class")
    if lb is None or lb["classes"] != "DTP" or lb["phase"] != 2 or lb["tier"] != "f":
        G["r4"].append("leg-block missing or not P2 FORM in every class")
    if hla is not None and lb is not None:
        e_ = hla["pts"][-1]
        cps = corner_points(lb)
        hoop.update(arch_end=[round(float(e_[0]), 2), round(float(e_[1]), 2)], arch_end_offset=round(float(np.hypot(e_[0] - 1427.8, e_[1] - 483.9)), 2),
                    arch_xmin=round(float(hla["pts"][:, 0].min()), 2), arch_corners=len(corner_points(hla)),
                    arch_end_to_block=round(float(cKDTree(resample(lb["pts"], 0.25)).query(e_)[0]), 2),
                    block_start=[round(float(lb["pts"][0][0]), 2), round(float(lb["pts"][0][1]), 2)],
                    block_end=[round(float(lb["pts"][-1][0]), 2), round(float(lb["pts"][-1][1]), 2)],
                    block_corners=[[round(float(c[0]), 1), round(float(c[1]), 1)] for c in cps], block_len=round(lb["L"], 1),
                    block_registration=lb.get("registration"))
        near = min((float(np.hypot(c[0] - 1417.9, c[1] - 484.1)) for c in cps), default=99.0)
        hoop["block_corner_offset"] = round(near, 2)
        hoop["block_top_past_leg"] = [round(float(lb["pts"][0][0] - e_[0]), 2), round(float(e_[0] - cps[0][0]), 2) if cps else None]
        if hoop["arch_end_offset"] > 3.0 or hoop["arch_xmin"] < 1426.0 or hoop["arch_end_to_block"] > 1.0 or near > 2.5                 or not cps or min(hoop["block_top_past_leg"]) < 5.0:
            G["r4"].append("hoop: %s" % hoop)
    G["hoop"] = hoop
    # jog gate: two opposite turns of >= 60 deg less than 12 src px apart
    G["jog"] = []
    G["jog_glyphs"] = []
    for s in order:
        j = jogs(s["pts"])
        if j:
            (G["jog_glyphs"] if s["kind"] == "glyph" else G["jog"]).append([s["id"], j[:3]])
    # rim arcs keep TYRE_CLEAR src px from their tyre's drawn outline (every class where both are drawn)
    G["rim_tyre"] = {}
    for key, tid in (("fw", "front-tyre"), ("rw", "rear-tyre")):
        ty = POOL_BY_ID.get(tid)
        if ty is None:
            continue
        tt = cKDTree(resample(ty["pts"], 0.5))
        for part in ("seen", "fit"):
            r_ = POOL_BY_ID.get("%s-rim-%s" % (key, part))
            if r_ is None:
                continue
            dmin = float(tt.query(resample(r_["pts"], 0.5))[0].min())
            G["rim_tyre"]["%s-rim-%s" % (key, part)] = round(dmin, 2)
            if dmin < TYRE_CLEAR - 1e-6:
                G["r4"].append("%s-rim-%s comes %.2f src px from %s (< %.1f)" % (key, part, dmin, tid, TYRE_CLEAR))
    G["rim_cut"] = RIM_CUT
    G["clear_ends"] = CLEAR
    for sid_, rec_ in CLEAR.items():
        if rec_ and min(rec_["after"]) < rec_["gap"] - 1e-6:
            G["r4"].append("%s ends %s src px from %s (< %.1f)" % (sid_, rec_["after"], rec_["to"], rec_["gap"]))
    for gone in ("hoop-leg", "hoop-arch", "stripe-far-band", "pale-strip-upper", "pale-strip-lower", "rear-box", "beam-strut", "beam-lower-post",
                 "pink-sleeve", "shadow-ground-front-short"):
        if any(s["id"] == gone or s["id"].startswith(gone + "-") and s.get("feature") == gone for s in order):
            G["r2"].append("%s is still drawn" % gone)
    for sid, cls in (("top-plate", "P"), ("far-front-crown", "P")):
        if sid in POOL_BY_ID and cls in POOL_BY_ID[sid]["classes"]:
            G["r2"].append("%s is drawn at %s" % (sid, cls))
    lh = POOL_BY_ID.get("lens-housing-a")
    if lh is not None:
        G["lens_housing_a_xmax"] = round(float(lh["pts"][:, 0].max()), 2)
        if lh["pts"][:, 0].max() > 1478.05:
            G["r2"].append("lens-housing-a reaches x %.1f > 1478" % lh["pts"][:, 0].max())
    # the nose-top 219 (D, T): three numerals, every sample on the medial axis (glyph gate), corners as written
    t219 = [s for s in order if s.get("burst") == "top-219"]
    G["top_219"] = [[s["id"], s["classes"], round(s["L"], 1), len(s["corners"]), s["glyph_check"]["medial_max"]] for s in t219]
    if [s["glyph"]["ch"] for s in t219] != ["2", "1", "9"] or any(s["classes"] != "D" for s in t219):     # revision 5: D only
        G["r2"].append("top-219: %s" % G["top_219"])
    # rear bay (revision 3, the main loop's rule; it replaces revision 2's 'both ends within 4 src px'):
    # each tube straight (snapped edge within 1 src px of the line), >= 55 src px, >= 0.90 of its samples
    # within 2 src px of a measured edge, and at least one end within 6 src px of a drawn line of its
    # class or of the rear tyre; at most 2 near-horizontal tubes, no two within 8 deg of parallel, none
    # at P. The counts (D 3-5, T 2-3) are reported against the target; see provenance rear_bay.
    # Fix r2 (2026-11-10, the main loop's decision, an agent decision): P draws exactly FIX_R2_P_BAY (rear-tube-level).
    G["rear_bay"] = {}
    G["r3"] = []
    G["r5"] = []
    for cl in "DTP":
        rb = [s for s in order if s["area"] == "rear-bay" and cl in s["classes"]]
        rec = dict(n=len(rb), tubes=[])
        if cl == "P" and tuple(s["id"] for s in rb) != FIX_R2_P_BAY:
            G["r3"].append("rear-bay tubes at P: %s (fix r2: exactly %s)" % ([s["id"] for s in rb], list(FIX_R2_P_BAY)))
        angs = []
        for s in rb:
            m = rear_bay_measure(s, cl, order, ch, tracer)
            angs.append(m["angle_deg"])
            rec["tubes"].append(m)
            if not m["ok"]:
                G["r3"].append("%s rear-bay %s fails: %s" % (cl, s["id"], m))
        # revision 4: at most 3 near-horizontal members (was 2: the main loop's target of 3-5 members in a
        # bay whose real members are mostly near-horizontal), every one of them connected; two members
        # within 8 deg of parallel only when at least 20 src px apart over their common x span (they read
        # as separate members, not as a hatch or speed lines)
        nh_ = [tb for tb in rec["tubes"] if tb["near_horizontal"]]
        if len(nh_) > 3 or any(not tb["connected"] for tb in nh_):
            G["r3"].append("%s: near-horizontal rear-bay tubes %s (at most 3, each connected)" % (cl, [tb["id"] for tb in nh_]))
        rec["parallel_pairs"] = []
        for i in range(len(angs)):
            for j in range(i + 1, len(angs)):
                dd = abs(angs[i] - angs[j]) % 180.0
                if min(dd, 180 - dd) < 8.0:
                    A_, B_ = resample(rb[i]["pts"], 1.0), resample(rb[j]["pts"], 1.0)
                    xa, xb = max(A_[:, 0].min(), B_[:, 0].min()), min(A_[:, 0].max(), B_[:, 0].max())
                    if xb > xa:
                        Aa = A_[(A_[:, 0] >= xa) & (A_[:, 0] <= xb)]
                        sep = float(cKDTree(B_).query(Aa)[0].min()) if len(Aa) else float(cKDTree(B_).query(A_)[0].min())
                    else:
                        sep = float(cKDTree(B_).query(A_)[0].min())
                    rec["parallel_pairs"].append([rb[i]["id"], rb[j]["id"], round(min(dd, 180 - dd), 1), round(sep, 1)])
                    if sep < 20.0:
                        G["r3"].append("%s: rear-bay tubes %s and %s within 8 deg of parallel and %.1f src px apart" % (cl, rb[i]["id"], rb[j]["id"], sep))
        rec["target"] = {"D": "3-5", "T": "2-3", "P": "rear-tube-level only (fix r2; was 0)"}[cl]
        rec["meets_target"] = {"D": 3 <= len(rb) <= 5, "T": 2 <= len(rb) <= 3, "P": tuple(s["id"] for s in rb) == FIX_R2_P_BAY}[cl]
        G["rear_bay"][cl] = rec
    G["rear_bay"]["held"] = HELD
    # member names (revision 1): no member asserts a function either
    G["deny_member"] = [[s["id"], m] for s in order for m in s["members"] if any(w in m for w in DENY_WORDS)]
    # hatch rules: patches of flicks (box, body): 0 or >= 5 flicks, D only; each starts within 6 src px of a drawn line;
    # gaps <= 1.5 pitch; lengths 25-60. Tyre flicks: 0 or 4-6, gaps 10 +- 1.5, lengths 25-40, start within 6 src px of the
    # drawn tyre silhouette, >= 30 deg off its tangent, inside the dark mask.
    a = math.radians(62.0)
    nrm = np.array([math.sin(a), math.cos(a)])
    dvec = np.array([-math.cos(a), math.sin(a)])
    for cl in "DTP":
        lines = [resample(s["pts"], 1.0) for s in order if cl in s["classes"] and s["tier"] in LINE_TIERS]
        tree = cKDTree(np.vstack(lines))
        for patch in sorted(set(s.get("patch") for s in order if s.get("patch"))):
            fl = [s for s in order if s.get("patch") == patch and cl in s["classes"]]
            if not fl:
                continue
            Ls = [s["L"] for s in fl]
            pos = sorted(float(s["pts"][0] @ nrm) for s in fl)
            gaps = np.diff(pos) if len(pos) > 1 else np.array([])
            if "tyre" in patch:
                sil = POOL_BY_ID.get("rear-tyre" if "rear" in patch else "front-tyre")
                St = resample(sil["pts"], 0.5)
                tt = cKDTree(St)
                d0, offs = [], []
                for s in fl:
                    dd, ii = tt.query(s["pts"][0])
                    d0.append(float(dd))
                    tg = _unit(St[min(len(St) - 1, ii + 4)] - St[max(0, ii - 4)])
                    offs.append(math.degrees(math.acos(min(1.0, abs(float(tg @ dvec))))))
                ins = all(H.inside(resample(s["pts"], 0.5)).all() for s in fl)
                rec = dict(cls=cl, patch=patch, n=len(fl), start_max=round(max(d0), 2), len_min=round(min(Ls), 1), len_max=round(max(Ls), 1),
                           gap_min=round(float(gaps.min()), 2) if len(gaps) else None, gap_max=round(float(gaps.max()), 2) if len(gaps) else None,
                           pitch=10.0, angle_off_tangent_min=round(min(offs), 1), in_dark=bool(ins))
                rec["ok"] = bool(cl != "P" and 4 <= len(fl) <= 6 and max(d0) <= 6.0 and min(Ls) >= 24.9 and max(Ls) <= 40.1 and len(gaps)
                                 and gaps.min() >= 8.5 and gaps.max() <= 11.5 and min(offs) >= 30.0 and ins)
            else:
                d0 = [float(tree.query(s["pts"][0])[0]) for s in fl]
                pitch = 10.0
                rec = dict(cls=cl, patch=patch, n=len(fl), start_max=round(max(d0), 2), len_min=round(min(Ls), 1), len_max=round(max(Ls), 1),
                           gap_min=round(float(gaps.min()), 1) if len(gaps) else None, gap_max=round(float(gaps.max()), 1) if len(gaps) else None,
                           pitch=pitch)
                rec["ok"] = bool(cl == "D" and len(fl) >= 5 and max(d0) <= 6.0 and min(Ls) >= 24.9 and max(Ls) <= 60.1 and gaps.max() <= 1.5 * pitch)
            G["hatch_rules"].append(rec)
    return G, reg_stats


def sid_of(s):
    return s["id"]


# ================================================================== glyph skeleton coverage (revision 3)
# The medial-axis check shows that drawn points lie on a letter's skeleton, not that the whole
# skeleton is drawn (the side-plate 9 shipped with 11.6 src px of its bowl undrawn). Coverage: per
# glyph group, the letter mask at 1x (luminance, Gaussian 0.6; threshold half-way between the 5th and
# 95th percentile inside the group's clip polygon, or its stroke box +-6 src px), the components the
# strokes touch; the ridge of its distance transform (local 3x3 maximum, half width >= 1 src px). Every
# ridge pixel (centre at i + 0.5, the glyph convention) must lie within COVER_R src px of the group's
# strokes, except where the photo hides the glyph: inside the front tyre's silhouette (the side-plate
# 2's base), with HIDDEN_PAD src px margin. Same method as the truth critic's glyphcover.py, plus the
# clip polygons and the occlusion exemption.
COVER_R = 2.5
HIDDEN_PAD = 2.0


def glyph_coverage(order, rgb, gspec, tyre_ex):
    L = ni.gaussian_filter(rgb.astype(np.float64) @ np.array([0.299, 0.587, 0.114]), 0.6)
    groups = {"plate-219": ("plate219", True), "top-219": ("top219", True), "lettering": ("lettering", False)}
    out = {"r": COVER_R, "method": "ridge (local 3x3 maximum, half width >= 1 src px) of the touched letter components; every ridge pixel within r src px of the group's strokes, except inside the front tyre's silhouette (+%g src px)" % HIDDEN_PAD}
    for g, (regk, dark) in groups.items():
        ss = [s for s in order if s["kind"] == "glyph" and (s.get("burst") == g if g != "lettering" else s["area"] == "lettering")]
        if not ss:
            continue
        pts = np.vstack([resample(s["pts"], 0.25) if len(s["pts"]) > 1 else s["pts"] for s in ss])
        x0, x1 = int(pts[:, 0].min()) - 6, int(pts[:, 0].max()) + 7
        y0, y1 = int(pts[:, 1].min()) - 6, int(pts[:, 1].max()) + 7
        box = L[y0:y1, x0:x1]
        clip = gspec["regions"][regk].get("clip")
        cm = np.ones(box.shape, bool)
        if clip:
            ci = Image.new("1", (box.shape[1], box.shape[0]), 0)
            ImageDraw.Draw(ci).polygon([(x - x0, y - y0) for x, y in clip], fill=1)
            cm = np.asarray(ci).astype(bool)
        thr = (np.percentile(box[cm], 95) + np.percentile(box[cm], 5)) / 2
        M = ((box < thr) if dark else (box > thr)) & cm
        lab, n = ni.label(M)
        touched = set()
        for x, y in pts:
            i, j = int(math.floor(y)) - y0, int(math.floor(x)) - x0
            if 0 <= i < M.shape[0] and 0 <= j < M.shape[1] and lab[i, j] > 0:
                touched.add(int(lab[i, j]))
        K = np.isin(lab, list(touched))
        dt = ni.distance_transform_edt(K)
        ridge = K & (dt >= ni.maximum_filter(dt, 3) - 1e-6) & (dt >= 1.0)
        ry, rx = np.nonzero(ridge)
        Cc = np.column_stack([rx + x0 + 0.5, ry + y0 + 0.5])
        dd = cKDTree(pts).query(Cc)[0]
        hidden = np.zeros(len(Cc), bool)
        if g == "plate-219" and tyre_ex is not None:
            # inside the front tyre's silhouette (traced-line convention: pixel centre at i, so -0.5)
            rho = ellipse_rho(tyre_ex, Cc - 0.5)
            hidden = rho <= 1.0 + HIDDEN_PAD / min(tyre_ex[2], tyre_ex[3])
        far = (dd > COVER_R) & ~hidden
        F = np.zeros_like(K)
        F[ry[far], rx[far]] = True
        fl, fn = ni.label(F, structure=np.ones((3, 3)))
        fi = np.nonzero(far)[0]
        flab = fl[ry[fi], rx[fi]]
        cl = []
        for k in range(1, fn + 1):
            yy, xx = np.nonzero(fl == k)
            cl.append(dict(n=int(len(yy)), x=[int(xx.min() + x0), int(xx.max() + x0)], y=[int(yy.min() + y0), int(yy.max() + y0)],
                           centre=[round(float(xx.mean() + x0 + .5), 1), round(float(yy.mean() + y0 + .5), 1)],
                           max_dist=round(float(dd[fi[flab == k]].max()), 2)))
        cl.sort(key=lambda c: -c["n"])
        out[g] = dict(ridge_px=int(len(Cc)), hidden_px=int(hidden.sum()), uncovered_px=int(far.sum()),
                      covered_share=round(float(1 - far.sum() / max(1, (~hidden).sum())), 4), uncovered_clusters=cl[:12],
                      threshold=round(float(thr), 1), clip=bool(clip))
    return out


# ================================================================== jog gate (revision 4)
# A stroke must not turn by 60 deg or more one way and then 60 deg or more the other way within 12
# src px (the revision 3 hoop's 9.3 src px step at y 484 read as a kinked hoop). The turn at a sample
# is the heading change between the chords JOG_K src px behind and ahead of it (resampled at 0.5 src
# px); turns are the local extremes of |turn| at or over JOG_DEG; two turns of opposite sign closer
# than JOG_SPAN src px along the stroke are a jog. Enforced on every non-glyph stroke; letters and
# numerals are measured and reported (their tight turns are the letter shapes).
JOG_DEG, JOG_SPAN, JOG_K = 60.0, 12.0, 4.0


def turns(P, k=JOG_K, step=0.5, thr=JOG_DEG):
    P = resample(np.asarray(P, float), step)
    n = len(P)
    kk = max(1, int(round(k / step)))
    if n < 2 * kk + 1:
        return []
    a = P[kk:n - kk] - P[:n - 2 * kk]
    b = P[2 * kk:] - P[kk:n - kk]
    ha = np.arctan2(a[:, 1], a[:, 0]); hb = np.arctan2(b[:, 1], b[:, 0])
    t = np.degrees((hb - ha + np.pi) % (2 * np.pi) - np.pi)
    out = []
    i = 0
    m = len(t)
    while i < m:
        if abs(t[i]) >= thr:
            j = i
            while j + 1 < m and abs(t[j + 1]) >= thr and np.sign(t[j + 1]) == np.sign(t[i]):
                j += 1
            k_ = i + int(np.argmax(np.abs(t[i:j + 1])))
            out.append(dict(s=round((k_ + kk) * step, 2), deg=round(float(t[k_]), 1), at=[round(float(P[k_ + kk][0]), 1), round(float(P[k_ + kk][1]), 1)]))
            i = j + 1
        else:
            i += 1
    return out


def jogs(P):
    tt = turns(P)
    out = []
    for i in range(len(tt)):
        for j in range(i + 1, len(tt)):
            if tt[j]["s"] - tt[i]["s"] >= JOG_SPAN:
                break
            if np.sign(tt[i]["deg"]) != np.sign(tt[j]["deg"]):
                out.append(dict(a=tt[i], b=tt[j], span=round(tt[j]["s"] - tt[i]["s"], 2)))
    return out


RB_MIN_LEN, RB_DEV, RB_REG, RB_END = 55.0, 1.0, 0.90, 6.0


def rear_bay_measure(s, cl, pool, ch, tracer):
    """The main loop's rear-bay rule, measured for stroke s in class cl against the drawn lines of
    `pool` (s itself and held strokes excluded)."""
    dev = max([mi.get("dev_max", 0.0) for mi in s.get("member_info", [])] or [0.0])
    a_, b_ = s["pts"][0], s["pts"][-1]
    ang = math.degrees(math.atan2(b_[1] - a_[1], b_[0] - a_[0])) % 180.0
    others = [(o["id"], resample(o["pts"], 0.5)) for o in pool if o is not s and not o.get("hold") and cl in o["classes"]
              and o["tier"] in "cynfda" and o["kind"] != "glyph"]
    ends = []
    for p in (a_, b_):
        best = (1e9, None)
        for oid, Q in others:
            d = float(cKDTree(Q).query(p)[0])
            if d < best[0]:
                best = (d, oid)
        ends.append([round(best[0], 2), best[1]])
    rt = next((o for o in pool if o["id"] in ("rear-tyre", "rear-tyre-a")), None)
    tyre = [round(float(cKDTree(resample(rt["pts"], 0.5)).query(p)[0]), 2) for p in (a_, b_)] if rt is not None else [None, None]
    mode = s.get("mode") or "edge"
    summ, _ = TR.registration(s["pts"], ch, mode if mode in ("edge", "valley", "ridge") else "edge")
    by_end = min(e[0] for e in ends) <= RB_END or min(t for t in tyre if t is not None) <= RB_END
    # revision 4: also a T: another drawn line's end lies on this member (within RB_END src px of it),
    # e.g. the brace's end on the bar below it. Reported apart from the end rule.
    me = cKDTree(resample(s["pts"], 0.5))
    tees = []
    for o in pool:
        if o is s or o.get("hold") or cl not in o["classes"] or o["tier"] not in "cynfda" or o["kind"] == "glyph" or o.get("closed"):
            continue
        for w_, p in (("s", o["pts"][0]), ("e", o["pts"][-1])):
            dd = float(me.query(p)[0])
            if dd <= RB_END:
                tees.append([o["id"], w_, round(dd, 2)])
    connected = by_end or bool(tees)
    min_len = s.get("rb_min_len") or RB_MIN_LEN          # revision 6: bar-below-brace, about 52 src px (main loop: >= 40)
    ok = s["L"] >= min_len and dev <= RB_DEV and summ["within2"] >= RB_REG and connected
    return dict(id=s["id"], len=round(s["L"], 1), min_len=min_len, straight_dev_max=round(dev, 2), registration_within2=round(summ["within2"], 3),
                registration_within1=round(summ["within1"], 3), angle_deg=round(ang, 1), ends_to_drawn=ends, ends_to_rear_tyre=tyre,
                connected=bool(connected), connected_by_own_end=bool(by_end), tees=tees, near_horizontal=horizontal_share(s) >= 0.5, ok=bool(ok),
                start=[round(float(a_[0]), 1), round(float(a_[1]), 1)], end=[round(float(b_[0]), 1), round(float(b_[1]), 1)])


def horizontal_share(s):
    """Share of a stroke's length in pieces (between corners, 4 src px chords) within 25 deg of horizontal."""
    P = resample(s["pts"], 2.0)
    if len(P) < 2:
        return 0.0
    v = np.diff(P, axis=0)
    ang = np.degrees(np.abs(np.arctan2(v[:, 1], v[:, 0])))
    ang = np.minimum(ang, 180 - ang)
    w = np.hypot(*v.T)
    return float(w[ang <= 25].sum() / max(w.sum(), 1e-9))


# ================================================================== revision 5 gates
# Cross gate (main loop): no two non-glyph line strokes of a class may cross to form a '+' or an 'X'
# unless the photo shows a real crossing there. A crossing counts when the two lines meet at
# CROSS_ANGLE degrees or more and each runs on at least CROSS_ARM src px past it on both sides (an end
# that stops on a line, or overshoots it by less, is a T). Lines that weave across each other at a
# shallow angle (a plate edge along the tyre or the stripe it borders) are overlaps, not crosses; they
# are reported. Guides (P0, retired before the develop), accents (re-traces), glyphs and hatching are
# not lines here. REAL_CROSSINGS lists crossings the photo shows (none today).
CROSS_ANGLE, CROSS_ARM = 25.0, 3.0
CROSS_REACH, CROSS_SEP = 5.0, 1.5
REAL_CROSSINGS = {}


def _at(P, sP, s):
    return np.array([np.interp(s, sP, P[:, 0]), np.interp(s, sP, P[:, 1])])
# CSS px per src px and w1 per review width (review_page.cjs, revision 4 page renders)
VIEW = {"1440": (0.7044, 2.1, "D"), "1280": (0.6236, 1.993, "D"), "768": (0.4604, 1.652, "T")}
FACTOR = dict(g=0.36, c=0.95, y=1.05, a=1.40, n=0.80, f=0.62, d=0.42, h=0.30)


def cross_pairs(order, cl):
    L = [s for s in order if cl in s["classes"] and s["tier"] in "cyfd" and s["kind"] not in ("glyph", "hatch")]
    R = [resample(s["pts"], 0.5) for s in L]
    SS = [np.concatenate([[0], np.cumsum(np.hypot(*np.diff(r, axis=0).T))]) for r in R]
    TT = [cKDTree(resample(r, 0.25)) for r in R]
    out = []
    for i in range(len(L)):
        for j in range(i + 1, len(L)):
            la, lb = SS[i][-1], SS[j][-1]
            for X, sa, sb, ang in crossings(R[i], R[j]):
                arms = [sa, la - sa, sb, lb - sb]
                # chord angle over +-3 src px, and how far each arm's point CROSS_REACH out lies from the other line
                da = _at(R[i], SS[i], min(la, sa + 3)) - _at(R[i], SS[i], max(0, sa - 3))
                db = _at(R[j], SS[j], min(lb, sb + 3)) - _at(R[j], SS[j], max(0, sb - 3))
                ang_c = math.degrees(math.acos(min(1.0, abs(float(np.dot(da, db))) / (np.hypot(*da) * np.hypot(*db) + 1e-12))))
                sep = [float(TT[j].query(_at(R[i], SS[i], max(0, sa - CROSS_REACH)))[0]), float(TT[j].query(_at(R[i], SS[i], min(la, sa + CROSS_REACH)))[0]),
                       float(TT[i].query(_at(R[j], SS[j], max(0, sb - CROSS_REACH)))[0]), float(TT[i].query(_at(R[j], SS[j], min(lb, sb + CROSS_REACH)))[0])]
                cross = bool(ang_c >= CROSS_ANGLE and min(arms) >= CROSS_ARM and min(sep) >= CROSS_SEP)
                out.append(dict(a=L[i]["id"], b=L[j]["id"], at=[round(float(X[0]), 1), round(float(X[1]), 1)], angle=round(ang_c, 1),
                                arms=[round(v, 1) for v in arms], arm_sep=[round(v, 2) for v in sep], cross=cross))
    return out


def r5_gates(order, G, rgb):
    ids = [s["id"] for s in order]
    # cross gate
    G["cross"] = {}
    for cl in "DTP":
        pr = cross_pairs(order, cl)
        X = [c for c in pr if c["cross"]]
        bad = [c for c in X if (c["a"], c["b"]) not in REAL_CROSSINGS and (c["b"], c["a"]) not in REAL_CROSSINGS]
        G["cross"][cl] = dict(crosses=X, overlaps_or_tees=[c for c in pr if not c["cross"]],
                              rule="a cross: chord angle (+-3 src px) >= %g deg, every arm >= %g src px past the crossing, and every arm's point %g src px out lies >= %g src px from the other line" % (CROSS_ANGLE, CROSS_ARM, CROSS_REACH, CROSS_SEP))
        for c in bad:
            G["r5"].append("%s: %s and %s cross at %s (%.1f deg, arms %s)" % (cl, c["a"], c["b"], c["at"], c["angle"], c["arms"]))
    # rear bay at D: post-below-beam not drawn, 3-5 members
    if "post-below-beam" in ids:
        G["r5"].append("post-below-beam is drawn")
    nD = G["rear_bay"]["D"]["n"]
    if not (3 <= nD <= 5):
        G["r5"].append("rear bay D: %d members (want 3-5)" % nD)
    # driver: one stroke for the sleeve band and the torso edge, D and T; P draws collar only
    G["driver_r5"] = {}
    for gone in ("torso-edge", "sleeve-band"):
        if gone in ids:
            G["r5"].append("%s is drawn as its own stroke" % gone)
    st = POOL_BY_ID.get("sleeve-torso")
    if st is None or st["classes"] != "DT":
        G["r5"].append("sleeve-torso missing or not D, T")
    else:
        P = resample(st["pts"], 0.5)
        k = int(np.argmin(np.hypot(*(P - np.array([1440.0, 651.0])).T)))
        tt = []
        for i in range(max(8, k - 24), min(len(P) - 8, k + 25)):
            a = P[i] - P[i - 8]; b = P[i + 8] - P[i]
            tt.append(abs(math.degrees(math.atan2(a[0] * b[1] - a[1] * b[0], float(np.dot(a, b))))))
        G["driver_r5"]["sleeve_torso"] = dict(len=round(st["L"], 1), start=r2(st["pts"][0], 1), end=r2(st["pts"][-1], 1), corners=len(st["corners"]),
                                              join_near=r2(P[k], 1), join_turn_max_deg_4px_chords_within_12px=round(max(tt), 1) if tt else None,
                                              registration=st.get("registration"))
        if st["corners"]:
            G["r5"].append("sleeve-torso has a pen stop (corner)")
    G["driver_r5"]["P"] = [s["id"] for s in order if s["area"] == "driver" and "P" in s["classes"]]
    if G["driver_r5"]["P"] != ["collar"]:
        G["r5"].append("driver at P: %s (want collar only)" % G["driver_r5"]["P"])
    # pale-panel ends on brace-inner (a T)
    pp, bi = POOL_BY_ID.get("pale-panel"), POOL_BY_ID.get("brace-inner")
    if pp is not None and bi is not None:
        tb = cKDTree(resample(bi["pts"], 0.25))
        de = [round(float(tb.query(pp["pts"][0])[0]), 2), round(float(tb.query(pp["pts"][-1])[0]), 2)]
        G["pale_panel"] = dict(len=round(pp["L"], 1), start=r2(pp["pts"][0], 1), end=r2(pp["pts"][-1], 1), ends_to_brace_inner=de, trim=pp.get("trim_at"))
        if min(de) > 1.0:
            G["r5"].append("pale-panel does not end on brace-inner: %s" % de)
    # amber-lens: open, gap 10-15 % of the loop
    al = POOL_BY_ID.get("amber-lens")
    if al is not None:
        og = al.get("open_gap") or {}
        G["amber_lens"] = dict(closed=bool(al["closed"]), open_gap=og)
        if al["closed"] or not og or not (0.10 <= og["gap_arc"] / og["loop_len"] <= 0.15):
            G["r5"].append("amber-lens not an open loop with a 10-15 %% gap: %s" % og)
    # nose-loop ends about 10 src px below nose-underside's start
    nl = POOL_BY_ID.get("nose-loop"); nu = POOL_BY_ID.get("nose-underside")
    if nl is not None and nu is not None:
        dy = float(nl["pts"][-1][1] - nu["pts"][0][1])
        G["nose_loop_end"] = dict(end=r2(nl["pts"][-1], 2), underside_start=r2(nu["pts"][0], 2), dy=round(dy, 2), record=nl.get("end_trim"))
        if not (8.0 <= dy <= 12.0):
            G["r5"].append("nose-loop ends %.2f src px below nose-underside's start (want about 10)" % dy)
    # far-front-crown: end gaps to nose-loop visible (>= 1 CSS px of white between the inks, untapered)
    cr = POOL_BY_ID.get("far-front-crown")
    if cr is not None and nl is not None:
        tn = cKDTree(resample(nl["pts"], 0.25))
        dd = [float(tn.query(cr["pts"][0])[0]), float(tn.query(cr["pts"][-1])[0])]
        gaps = {}
        for v, (sc, w1, cl) in VIEW.items():
            if cl in cr["classes"]:
                gaps[v] = [round(d * sc - (FACTOR["c"] + FACTOR[cr["tier"]]) * w1 / 2, 2) for d in dd]
        G["crown_gap"] = dict(ends_to_nose_loop_src_px=[round(d, 2) for d in dd], white_css_px=gaps, tier=cr["tier"], len=round(cr["L"], 1))
        if any(min(g) < 1.0 for g in gaps.values()):
            G["r5"].append("far-front-crown end gaps not visible: %s" % gaps)
    # fw-rim-fit (and rw): every rise or fall of the lettering shift spans >= BLEND src px
    G["rim_blend"] = {}
    for k_, r_ in LETTER_REC.items():
        runs = r_.get("shift_runs") or []
        G["rim_blend"][k_] = runs
        # every rise or fall of 0.5 src px or more spans >= BLEND src px (the old step: 0.64 src px over
        # about 4 src px); smaller changes are reported (0.5 src px is 0.7 device px at 1440 DPR 2)
        short = [rn for rn in runs if rn[4] >= 0.5 and rn[3] < BLEND - 0.25]
        if short:
            G["r5"].append("%s-rim-fit shift changes over less than %g src px: %s" % (k_, BLEND, short))
    # the revision 3 rule keeps its old coverage although the end zones are now END_ZONE long: the final
    # fit (after match_junctions) lies >= LETTER_CLEAR src px from the letters everywhere farther than
    # 8 src px from a junction with its seen arc (by 1 src px band from the junction)
    G["rim_letters_by_band"] = {}
    for k_ in LETTER_REC:
        fi_, se_ = POOL_BY_ID.get(k_ + "-rim-fit"), POOL_BY_ID.get(k_ + "-rim-seen")
        if fi_ is None or k_ not in _LETTERS:
            continue
        P_ = resample(fi_["pts"], 0.5)
        d_ = dist_to_letters(_LETTERS[k_], P_)
        sq = np.arange(len(P_)) * 0.5
        Ls = sq[-1]
        S_ = np.asarray(se_["pts"], float)
        j0 = min(np.hypot(*(P_[0] - S_[0])), np.hypot(*(P_[0] - S_[-1]))) < 0.2
        j1 = min(np.hypot(*(P_[-1] - S_[0])), np.hypot(*(P_[-1] - S_[-1]))) < 0.2
        dj = np.minimum(sq if j0 else np.inf, (Ls - sq) if j1 else np.inf)
        bands = {"%d-%d" % (a, a + 1): round(float(d_[(dj >= a) & (dj < a + 1)].min()), 3) for a in range(0, int(END_ZONE) + 1) if ((dj >= a) & (dj < a + 1)).any()}
        far = round(float(d_[dj >= 8.0].min()), 3)
        G["rim_letters_by_band"][k_] = dict(junction_at_start=bool(j0), junction_at_end=bool(j1), by_band_from_junction=bands, min_beyond_8=far)
        if far < LETTER_CLEAR - 1e-6:
            G["r5"].append("%s-rim-fit comes %.3f src px from the letters farther than 8 src px from a junction" % (k_, far))
    # rim junctions: the seen and fit arcs meet with the ellipse's tangent (no kink)
    G["rim_junctions"] = {}
    for k_, recs in JUNCTION.items():
        se_, fi_ = POOL_BY_ID.get(k_ + "-rim-seen"), POOL_BY_ID.get(k_ + "-rim-fit")
        out_ = []
        for r_ in recs:
            pa = next(s for s in order if s["id"] == r_["strokes"][0]); pb = next(s for s in order if s["id"] == r_["strokes"][1])
            # in drawing order the pair may be flipped: measure the turn where the two strokes touch
            ends = [(np.asarray(pa["segs"][-1], float), True), (np.asarray(pa["segs"][0], float), False)]
            best = None
            for A, at_end in ends:
                for Bq, b_end in ((np.asarray(pb["segs"][0], float), False), (np.asarray(pb["segs"][-1], float), True)):
                    pA = A[3] if at_end else A[0]; pB = Bq[3] if b_end else Bq[0]
                    if np.hypot(*(pA - pB)) < 0.05:
                        tA = (A[3] - A[2]) if at_end else (A[0] - A[1])
                        tB = (Bq[1] - Bq[0]) if not b_end else (Bq[2] - Bq[3])
                        best = round(math.degrees(math.acos(min(1.0, abs(float(np.dot(tA, tB))) / np.hypot(*tA) / np.hypot(*tB)))), 2)
            out_.append(dict(r_, turn_after=best))
            if best is None or best > 1.0:
                G["r5"].append("%s rim junction at %s turns %s deg" % (k_, r_["at"], best))
        G["rim_junctions"][k_] = out_
    # top-219 at D only
    if any(s.get("burst") == "top-219" and s["classes"] != "D" for s in order):
        G["r5"].append("top-219 drawn outside class D")
    # bar-below-brace ends where the bar's top edge ends (measured: the bar's dark body ends at x 1631-1632)
    bb = POOL_BY_ID.get("bar-below-brace")
    if bb is not None:
        # revision 6: drawn left to right, so the right end is the stroke's end; a blunt end is drawn BLUNT_PRE src px on
        ri = 0 if bb["pts"][0][0] > bb["pts"][-1][0] else -1
        xr = float(bb["pts"][ri][0]) + (BLUNT_PRE if (bb.get("blunt") or {}).get("s" if ri == 0 else "e") else 0.0)
        G["bar_end"] = dict(start=r2(bb["pts"][0], 2), end=r2(bb["pts"][-1], 2), right_end_drawn_x=round(xr, 2), edge_end_x=BAR_EDGE_END_X)
        if abs(xr - BAR_EDGE_END_X) > 1.5:
            G["r5"].append("bar-below-brace's right end x %.1f is not where the bar's top edge ends (x %.1f)" % (xr, BAR_EDGE_END_X))


BAR_EDGE_END_X = 1631.5     # revision 5: measured (releases/.../r3/art/r5/_diag/bar_end.py): the last column with the bar's dark body under the edge


# ================================================================== main
FRONT_ARC = (115.0, 235.0)      # screen-angle range of the shadow side of each tyre (deg, y down; checked on the overlays)
REAR_ARC = (95.0, 200.0)
PITCH = {"D": 10.0, "T": 13.0, "P": 18.0}


RGB = []

# Revision 2: every candidate rear-bay tube measured (snap on the inventory guide, straight fit on the
# snapped samples, the registration measure, end distances to the drawn D lines), by the measurement
# script releases/hand-drawn-20261106/r3/art/rev2/_diag/baycand.py on the revision 2 art.
REAR_BAY_CANDIDATES = {
    "rail-behind-hoop (edge, r 2)": "61.7 src px, -11.8 deg, straight dev 1.51 (> 1), registration 0.91 (in the inventory's ridge mode: 0.72, dev 1.32); ends 4.6 and 9.8 src px from drawn lines",
    "beam (edge, x 1557-1632)": "75.2 src px, -6.4 deg, dev 0.93-1.07, registration 0.97; ends 31.7 and 23.5 src px from drawn lines (both free); over x 1582-1628 alone its top edge runs at -14.7 deg, so it is not one straight member",
    "beam-top only (x 1582-1628)": "47.6 src px (< 60)",
    "arm-upper (ridge, r 3)": "62.2 src px, 1.1 deg, dev 0.50, registration 1.00; right end on the rear tyre (1.4 src px), left end 46 src px from any drawn line",
    "column-below-rail (edge, r 2)": "87.4 src px, 84 deg, dev 0.77, registration 0.89; top end 4.1 src px from rail-lower's end, bottom end 36 src px from any drawn line",
    "lower-rail-top (ridge, r 2)": "72.6 src px, -17.6 deg, dev 1.04, registration 0.97; ends 8.9 and 71 src px from drawn lines",
    "post below the beam (valley, authored x 1624-1618, y 680-742)": "62.2 src px, 95.6 deg, dev 0.47, registration 0.97; ends 22 src px from drawn lines (both free)",
    "rod-lit": "39.8 src px (< 60)",
    "diag-to-tyre": "39.1 src px (< 60); right end on the rear tyre",
}


def build(hatch="tyre", ground=0):
    t0 = time.time()
    rgb, ch = C.channels()
    RGB[:] = [rgb]
    tracer = Tracer(ch)
    fe = C.load_json(C.INP / "features.json")
    # comparison builds only (--crown form|drop): the alternatives for far-front-crown (revision 5 ships DETAIL)
    if CROWN != "detail":
        for f in list(fe["features"]):
            if f["id"] == "far-front-crown":
                if CROWN == "drop":
                    fe["features"].remove(f)
                else:
                    f["tier"] = "f"
    FEAT_BY_ID.clear()
    FEAT_BY_ID.update({f["id"]: f for f in fe["features"]})
    trace_features(tracer, fe["features"], rgb)
    log("traced %d strokes in %.1f s" % (len(POOL), time.time() - t0))

    # ---------------- rims: the seen arc (FORM) and the fit arc in the black (DETAIL), both P2
    rims = {}
    for inv_id, key, area in (("fw-rim-lip", "fw", "front-wheel"), ("rw-rim-ellipse", "rw", "rear-wheel")):
        # revision 2: the front rim's fit is refit with the lit top lip (x 1446-1470) weighted in
        R = rim_arcs(tracer, inv_id, key, lip=FW_LIP if key == "fw" else None, rgb=rgb)
        rims[key] = R
        a0, a1 = R["seen"]
        ex = R["ellipse"]
        add(key + "-rim-seen", ellipse_arc(ex, a0, a1), 2, "f", "form", area, "DTP", "fitted", [inv_id], ellipse=[round(v, 3) for v in ex],
            arc_deg=[int(a0), int(a1)], mode="edge", note="rim-lip ellipse fit (least squares to snapped edge points, guide as prior): the arc where its snapped edge is measured")
        add(key + "-rim-fit", ellipse_arc(ex, a1, a0 + 360), 2, "d", "form", area, "DTP", "fitted", [inv_id], ellipse=[round(v, 3) for v in ex],
            arc_deg=[int(a1), int(a0 + 360)], fit_in_black=True, note="completes the rim ellipse fit where it lies in deep black: a fit, not a seen edge")
        # revision 3: at least LETTER_CLEAR src px inside the sidewall lettering
        tyre = POOL_BY_ID.get("front-tyre" if key == "fw" else "rear-tyre") or POOL_BY_ID.get("front-tyre-a" if key == "fw" else "rear-tyre-a")
        tex = TR.ellipse_direct(resample(tyre["pts"], 2.0)) if tyre is not None else None
        # revision 4: rw-rim-fit ends where its edge support ends (the rest of it ran through pure
        # black and 2.7-4.7 src px inside the tyre outline: a doubled line); no rim arc within
        # TYRE_CLEAR src px of its tyre's outline
        RIM_CUT[key] = rim_cut(POOL_BY_ID[key + "-rim-fit"], POOL_BY_ID[key + "-rim-seen"], tyre, ch, support=(key == "rw"))
        log("rim cut %s %s" % (key, json.dumps(RIM_CUT[key])))
        if key in RIM_LOW_END:                   # revision 7: the seen arc stops at its lowest point (no upturn into the tyre)
            RIM_LOW[key] = rim_low_end(POOL_BY_ID[key + "-rim-seen"], POOL_BY_ID[key + "-rim-fit"], tyre)
            log("rim low end %s %s" % (key, json.dumps(RIM_LOW[key])))
        LETTER_REC[key] = letter_clearance(POOL_BY_ID[key + "-rim-fit"], rgb, ex, key, tex,
                                           end_zone_e=0.0 if POOL_BY_ID[key + "-rim-fit"].get("rim_cut") else None)
        log("letter clearance %s-rim-fit %s" % (key, json.dumps(LETTER_REC[key])))
        JUNCTION[key] = match_junctions(POOL_BY_ID[key + "-rim-seen"], POOL_BY_ID[key + "-rim-fit"], ex)
        log("rim junctions %s %s" % (key, json.dumps(JUNCTION[key])))

    # ---------------- P0 lay-in
    add("ghost-front-rim", ghost(rims["fw"]["ellipse"], 1.4, SEED + 1), 0, "g", "guide", "lay-in", "DTP", "convention", ["fw-rim-lip"],
        pin="ccw", seq=0, note="construction loop on the rim ellipse fit, 1.4 laps from 10 o'clock, +-1.5 src px per lap")
    add("ghost-rear-rim", ghost(rims["rw"]["ellipse"], 1.3, SEED + 2), 0, "g", "guide", "lay-in", "DTP", "convention", ["rw-rim-ellipse"],
        pin="ccw", seq=1, note="construction loop on the rim ellipse fit, 1.3 laps")
    top = tracer.member({"mode": "edge", "r": 5, "lam": 1.4, "tol": 0.8}, {"inv": "nose-top-edge"})[0]["F"]
    add("nose-gesture", sub(top, 0.04, 0.92), 0, "g", "guide", "lay-in", "DTP", "convention", ["nose-top-edge"], pin="as-authored", seq=2,
        note="lay-in gesture on the traced nose top edge, 4-92 % of its length, tip to cockpit; revision 2: its far span (x >= 1204) re-snapped with nose-loop onto the asphalt-to-stripe boundary")
    # revision 2: the far nose edge (x 1204-1306) on the asphalt-to-stripe chroma boundary, for the
    # silhouette and for the lay-in gesture that runs along it
    RESNAP.clear()
    for sid in ("nose-loop", "nose-gesture"):
        RESNAP[sid] = resnap_far_span(POOL_BY_ID[sid], rgb)
        log("resnap %-12s %s" % (sid, json.dumps(RESNAP[sid])))
    # revision 3: one confident curve over the far span (drawing convention: smoothed within 2 src px)
    SMOOTH.clear()
    SMOOTH["nose-loop"], curve = smooth_far_silhouette(POOL_BY_ID["nose-loop"], rgb)
    SMOOTH["nose-gesture"] = smooth_far_silhouette(POOL_BY_ID["nose-gesture"], rgb, ref=curve)[0]
    log("smooth nose-loop %s" % json.dumps(SMOOTH["nose-loop"]))
    log("smooth nose-gesture %s" % json.dumps(SMOOTH["nose-gesture"]))
    # revision 5: nose-loop ends 10 src px below nose-underside's start (the nose tip closes)
    END_TRIM.clear()
    for f in fe["features"]:
        if f.get("end_below") and f["id"] in POOL_BY_ID:
            END_TRIM[f["id"]] = trim_end_below(POOL_BY_ID[f["id"]], f["end_below"])
            log("end below %s %s" % (f["id"], json.dumps(END_TRIM[f["id"]])))
    # P1 gesture order (revision 1): the helmet comes after the hoop, brace and both tyres, so the
    # helmet circle never stands alone under the hoop (it read as a '6' beside the heading 'WU.' at
    # 390). Revision 2: the hoop leg and arch are one stroke (hoop-leg-arch).
    g_order = ["nose-loop", "nose-underside", "rail", "hoop-leg-arch", "hoop-column", "brace", "brace-centre",
               "rear-tyre", "front-tyre", "helmet"]          # revision 3: far-front-crown moved to P2
    for s in POOL:
        if s["phase"] == 1:
            base = s["feature"]
            suf = s["id"][len(base):]
            s["seq"] = g_order.index(base) * 10 + ("abcdef".index(suf[1]) if suf.startswith("-") and len(suf) == 2 else 0)

    apply_meets(fe["features"])
    # revision 5 (cross gate): overshooting ends trimmed back to the line they cross
    TRIMS.clear()
    for f in fe["features"]:
        for spec in f.get("trim_at") or []:
            if f["id"] in POOL_BY_ID:
                r_ = trim_at(POOL_BY_ID[f["id"]], spec)
                TRIMS.setdefault(f["id"], []).append(r_)
                log("trim at %s %s" % (f["id"], json.dumps(r_)))
    CLEAR.clear()
    for f in fe["features"]:                     # revision 4: ends kept clear of a line (far-front-crown)
        if f.get("clear_ends") and f["id"] in POOL_BY_ID:
            CLEAR[f["id"]] = clear_ends(POOL_BY_ID[f["id"]], f["clear_ends"])
            log("clear ends %s %s" % (f["id"], json.dumps(CLEAR[f["id"]])))
    BLUNT.clear()                                # revision 6: blunt free ends (rear bay)
    BLUNT.update(apply_blunt(fe["features"]))
    log("blunt %s" % json.dumps(BLUNT))
    registration_pass(ch, tracer)
    log("after registration pass: %d strokes, %d rejected" % (len(POOL), len(REJECTED)))

    # ---------------- glyphs (P3)
    gspec = C.load_json(C.INP / "glyph-order.json")
    Gs, gprob, gregs = GL.build_glyphs(rgb, gspec)
    if gprob:
        raise SystemExit("glyph problems: %s" % gprob)
    srcmap = {"olin": "olin-college", "college": "olin-college", "of": "of-engineering", "engineering": "of-engineering", "top-219": "top-plate-numerals"}
    for i, g in enumerate(Gs):
        area = {"plate-219": "side-plate", "top-219": "nose-rear"}.get(g["word"], "lettering")
        mem = ["side-plate-" + g["ch"]] if g["word"] == "plate-219" else [srcmap[g["word"]]]
        add(g["id"], g["pts"], 3, "n" if g["numeral"] else "d", "glyph", area, g["classes"], "traced", mem, pin="as-authored",
            segs=[np.asarray(c) for c in g["check"]["segs"]], corners=list(g.get("corners") or []), seq=1000 + i, burst=g["word"],
            glyph=dict(word=g["word"], letter=g["letter"], ch=g["ch"], stroke=g["stroke"]),
            glyph_check={k: (round(v, 3) if isinstance(v, float) else v) for k, v in g["check"].items() if k != "segs"})

    # ---------------- P4 hatching (drawing convention)
    H = Hatch()
    seq = [2000]
    patches = {}

    def put(patch, items, what):
        seen = {}
        for cl, lst in items.items():
            for P in lst:
                key = tuple(np.round(P[0], 1)) + tuple(np.round(P[-1], 1))
                if key in seen:
                    seen[key][1] += cl
                else:
                    seen[key] = [P, cl]
        lst = list(seen.values())
        if "tyre" not in patch:
            lst.sort(key=lambda v: (v[0][0][0], v[0][0][1]))       # nose to tail
        for j, (P, cl) in enumerate(lst):
            add("%s-%02d" % (patch, j + 1), P, 4, "h", "hatch", patch, cl, "convention", [], pin="as-authored", seq=seq[0], patch=patch,
                burst=patch, note=what)
            seq[0] += 1
        patches[patch] = {c: len(v) for c, v in items.items()}

    ft = POOL_BY_ID.get("front-tyre") or POOL_BY_ID.get("front-tyre-a")
    rt = POOL_BY_ID.get("rear-tyre") or POOL_BY_ID.get("rear-tyre-a")
    ex_f = TR.ellipse_direct(resample(ft["pts"], 2.0))
    ex_r = TR.ellipse_direct(resample(rt["pts"], 2.0))

    def anchors(cl, near):
        x0_, y0_, x1_, y1_ = near
        out = []
        for s in POOL:
            if cl in s["classes"] and s["tier"] in LINE_TIERS and s["phase"] <= 3 and s["kind"] != "glyph":
                P = s["pts"]
                if ((P[:, 0] > x0_) & (P[:, 0] < x1_) & (P[:, 1] > y0_) & (P[:, 1] < y1_)).any():
                    out.append(P)
        return out

    # Revision 1: a hatch patch is 0 or >= 5 evenly spaced flicks, and none at T and P (sparse
    # patches read as glass glare or scratches). Tyres: 4-6 straight '/' flicks from the drawn
    # silhouette into the dark tread face, or none (the concentric arcs read as motion marks).
    HATCH_INFO.clear()
    for key, sil, ex_, rim_ in (("hatch-rear-tyre", rt, ex_r, rims["rw"]["ellipse"]), ("hatch-front-tyre", ft, ex_f, rims["fw"]["ellipse"])):
        fl, info = H.tyre_flicks(sil["pts"], ex_, rim_, 10.0, SEED + (12 if "rear" in key else 11))
        HATCH_INFO[key] = info
        put(key, {"D": fl, "T": fl}, "tyre flick ('/' family, from the drawn silhouette into the dark tread face)")
    box_poly = [(1446, 536), (1494, 544), (1494, 624), (1452, 624), (1440, 590)]
    fb = H.flicks(anchors("D", (1430, 520, 1510, 640)), box_poly, 10.0, SEED + 21, lmin=25, lmax=45, er=1, maxn=8)
    HATCH_INFO["hatch-box"] = dict(candidates=len(fb))
    put("hatch-box", {"D": fb if len(fb) >= 5 else []}, "hatch flick")
    if hatch == "body":
        body_poly = [(946, 812), (1362, 660), (1368, 765), (1290, 862), (1150, 896), (1000, 906), (948, 872)]
        put("hatch-body", {cl: H.flicks(None, body_poly, PITCH[cl], SEED + 41, lmin=25, lmax=60, er=2,
                                        maxn={"D": 25, "T": 20, "P": 15}[cl]) for cl in "D"}, "hatch flick")

    # ---------------- P5 accents (derived from traced strokes): D and T only (critic: cut at P).
    # Revision 1: one left-to-right sweep over five places (nose, front tyre twice, hoop column, rear tyre).
    fts, rts = ft["id"], rt["id"]
    accent("nose-underside", 0.0, 0.40, "acc-nose-underside", "DT", "nose underside, from the tip back 40 %")
    accent_len(fts, 45, 75, "acc-front-tyre-upper-left", "DT", "front tyre, upper-left arc where it overlaps the body", from_end=True)
    accent_len(fts, 0, 80, "acc-front-tyre-lower-right", "DT", "front tyre, lower-right arc (start of its counter-clockwise silhouette)")
    accent("column-right", 0.10, 0.90, "acc-column-right", "DT", "hoop column, right (shadow) edge")
    accent_len(rts, 0, 60, "acc-rear-tyre-lower", "DT", "rear tyre, lower arc (start of its counter-clockwise silhouette)")
    for k, s in enumerate([s for s in POOL if s["phase"] == 5]):
        s["seq"] = k

    length_mask_pass()
    # revision 3: held rear-bay candidates are traced, measured and gated, then set aside (not drawn)
    HELD.clear()
    for s in [s for s in POOL if s.get("hold")]:
        meas = {cl: rear_bay_measure(s, cl, POOL, ch, tracer) for cl in s["classes"]}
        HELD.append(dict(id=s["id"], why=s["hold"], classes=s["classes"], members=s["members"], measured=meas,
                         pts=[r2(p, 1) for p in resample(s["pts"], 2.0)]))
        if SHIP_HELD:                                   # comparison builds only (--ship-held): drawn, and the gate fails
            s.pop("hold")
            continue
        POOL.remove(s)
        POOL_BY_ID.pop(s["id"], None)
    order = order_all()
    G, reg = gates(order, ch, tracer, H, gregs)
    G["rejected"] = REJECTED
    # ---------------- revision 3 gates
    G["glyph_cover"] = glyph_coverage(order, rgb, gspec, ex_f)
    for g in ("plate-219", "top-219", "lettering"):
        r_ = G["glyph_cover"].get(g)
        if r_ and r_["uncovered_px"] > 0:
            G["r3"].append("glyph coverage %s: %d ridge px farther than %.1f src px from its strokes: %s" % (g, r_["uncovered_px"], COVER_R, r_["uncovered_clusters"][:3]))
    G["tube"] = tube_gate(POOL_BY_ID["rail"], POOL_BY_ID["rail-lower"])
    if not G["tube"]["ok"]:
        G["r3"].append("coaming tube: %s" % {k: v for k, v in G["tube"].items() if k != "fits"})
    G["rim_letters"] = LETTER_REC
    for k_, r_ in LETTER_REC.items():
        if r_["min_dist_after_outside_end_zones"] < LETTER_CLEAR - 1e-6:
            G["r3"].append("%s-rim-fit comes %.2f src px from the sidewall letters (< %.1f)" % (k_, r_["min_dist_after_outside_end_zones"], LETTER_CLEAR))
    cr = POOL_BY_ID.get("far-front-crown")
    if CROWN == "detail" and (cr is None or cr["phase"] != 2 or cr["tier"] != "d" or cr["classes"] != "D"):       # revision 5: DETAIL; revision 6: D only
        G["r5"].append("far-front-crown: %s (want P2, DETAIL, D)" % ((cr["phase"], cr["tier"], cr["classes"]) if cr else "missing"))
    G["far_silhouette_smooth"] = SMOOTH
    sm = SMOOTH.get("nose-loop") or {}
    if not sm or sm["boundary_dev_max"] > 2.0 or sm["corner_traced_dev_max"] > 2.0 + 1e-6 or sm["other_traced_dev_max"] > 2.0 \
            or (sm["inflection_spacing_min"] is not None and sm["inflection_spacing_min"] < 20.0) or not (sm["plate_step"]["width"] >= 24.0):
        G["r3"].append("nose-loop far span smoothing: %s" % {k: sm.get(k) for k in ("boundary_dev_max", "corner_traced_dev_max", "other_traced_dev_max",
                                                                                     "inflection_spacing_min", "plate_step")})
    if any(s["id"] == "fw-lit-arm" for s in order):
        G["r3"].append("fw-lit-arm is drawn")
    r5_gates(order, G, rgb)
    r6_gates(order, G, rgb, ch)
    r7_gates(order, G, rgb, ch)
    fix_r2_gates(order, G, ch)
    return order, G, rims, patches, gregs, (ex_f, ex_r)


def joined_flags(order):
    """bit 1: start within 3 src px of another stroke's path (no landing taper); bit 2: same for the end."""
    for s in order:
        fl = 0
        if s["tier"] in "cynfd":
            others = [resample(o["pts"], 1.0) for o in order if o is not s and o["tier"] in LINE_TIERS
                      and set(o["classes"]) & set(s["classes"])]
            tree = cKDTree(np.vstack(others))
            if tree.query(s["pts"][0])[0] < 3 or (s["closed"]):
                fl |= 1
            if tree.query(s["pts"][-1])[0] < 3 or (s["closed"]):
                fl |= 2
        for w in (s.get("blunt") or {}):          # revision 6: a blunt free end rides on the join bit (apply_blunt)
            fl |= 1 if w == "s" else 2
        s["joined"] = fl


def r2(v, n=2):
    return [round(float(x), n) for x in v]


def write_out(order, G, rims, patches, gregs, tyre_ex, outdir, hatch, ground):
    outdir = Path(outdir)
    joined_flags(order)
    strokes = []
    for i, s in enumerate(order):
        P = resample(s["pts"], 1.0) if s["L"] > 2 else s["pts"]
        rec = dict(i=i, id=s["id"], phase=s["phase"], area=s["area"], tier=s["tier"], kind=s["kind"], classes=s["classes"],
                   mask=sum(BITS[c] for c in s["classes"]), prov=s["prov"], members=s["members"], len=round(s["L"], 1),
                   closed=bool(s["closed"]), pinned=s.get("pin") or None, joined=s["joined"],
                   pts=[r2(p, 1) for p in P], segs=[[r2(q, 2) for q in c] for c in s["segs"]], corners=s["corners"])
        for k in ("burst", "patch", "gesture", "glyph", "glyph_check", "skeleton_check", "registration", "derived_from", "derived_range", "fit_in_black",
                  "ellipse", "arc_deg", "note", "feature", "mode", "chan", "straight", "flipped", "meet",
                  "open_gap", "trim_at", "end_trim",                          # revision 5
                  "blunt", "occluded", "leg_edge", "line", "rb_min_len",      # revision 6
                  "top_edge", "rim_low_end",                                 # revision 7
                  "resnap", "smoothed", "letter_clearance", "clear_ends", "rim_cut", "after", "convention", "trimmed_start_px", "extended_start_to_y"):
            if s.get(k) is not None and s.get(k) is not False:
                rec[k] = s[k]
        # PEN_SPEC 5.4 cut order step a stroke belongs to (the engine applies a step per class only when last ink is over the limit)
        cut = None
        if s.get("patch") == "hatch-box":
            cut = 1
        elif s["id"] == "rear-box":
            cut = 2
        elif s["kind"] == "glyph" and s.get("burst") in ("olin", "college", "of", "engineering"):
            cut = 3
        elif s["phase"] == 5:
            cut = 4
        elif s.get("patch") in ("hatch-body", "hatch-front-tyre", "hatch-rear-tyre"):
            cut = 5
        if cut:
            rec["cut"] = cut
        dev = [mi.get("dev_max") for mi in s.get("member_info", []) if "dev_max" in mi]
        if dev:
            rec["straight_dev_max"] = max(dev)
        if any(mi.get("split_weak") for mi in s.get("member_info", [])):
            rec["split_weak"] = True
        strokes.append(rec)
    counts = {}
    for cl in "DTP":
        cs = [s for s in strokes if cl in s["classes"]]
        counts[cl] = dict(total=len(cs), by_phase={str(p): sum(1 for s in cs if s["phase"] == p) for p in range(6)},
                          by_kind={k: sum(1 for s in cs if s["kind"] == k) for k in sorted(set(s["kind"] for s in cs))})
    doc = dict(format="hero-pen strokes v1", photo="assets/hero-fsae-track-2200.webp", photo_size=[C.W, C.H],
               photo_sha256=C.photo_sha(), units="source px of the photo (y down)", car_box=[932, 430.7, 1758.5, 927.6], seed=SEED,
               cw_src_px=C.CW, hatch_set=(hatch if any(s["kind"] == "hatch" for s in strokes) else "none"), ground_strokes=ground, counts=counts,
               classes={"D": ">= 1280 px", "T": "768-1279 px", "P": "< 768 px"},
               order_note="Global drawing order (one pen). Each class draws its own subsequence: the strokes whose 'classes' contain it.",
               ordered=True, carMask=[C.load_json(C.INP / "car-mask.json")["polygon"]],
               cut_order={"1": "box hatch", "2": "rear-box (the optional rear-frame part; none ships since revision 2)", "3": "lettering", "4": "P5 accents", "5": "body hatch and tyre flicks"},
               revision="2026-11-10 fix r2 on revision 7 (the main loop's decision on the feel verifier's note, an agent decision, not the owner's: class P also draws rear-tube-level, the one D/T rear-bay member that touches the rear tyre, at its D/T pen position after shadow-ground-rear; same geometry, no new tracing; P: 36 strokes). Revision 7, 2026-11-10 (polish round, the main loop's decisions on the round 6 critics' optional polish; agent decisions, not the owner's: class P draws shadow-ground-rear; rw-rim-seen stops at its lowest point (7.2 src px cut, no upturn into the rear tyre); hoop-column starts at the leg's end and runs along the column's measured top edge into one corner; lens-housing-top loses its first 6 src px (in the black); no fourth rear-bay member passes the gates, none is added). Revision 6, 2026-11-09 (the final art round: critics of the revision 5 films and the main loop's round 6 decisions: diag-tube is one straight line on the tube's right edge, (1448.3, 474.0) to (1478.0, 533.0), drawn through the red block; bar-below-brace is one straight line on the beam's top edge, y = -0.2263 x + 1036.16, from the V joint (1580, 678.6) to the corner (1630.5, 667.2), drawn left to right, and the brace lands on it; amber-lens on the amber's own boundary (R - B = 25), its bottom span 2-3.5 src px higher; class T drops top-plate and far-front-crown; the rear bay's free ends are blunt; sleeve-torso loses its first 10 src px; hoop-leg-arch starts at the column's top on the pink sleeve's right edge, so the column meets the arch. Revision 5: critics of the revision 4 films and the main loop's round 5 decisions, the last art round before index.html: post-below-beam held, so the rear bay at D is lower-rail-top, rear-tube-level and bar-below-brace (its right end is where the bar's top edge ends, measured); a cross gate (no '+' or 'X' between non-glyph lines); torso-edge and sleeve-band merged into one stroke, sleeve-torso (D, T), and P's driver is collar only; the nose-top 219 at D only; pale-panel ends on brace-inner (a T); fw-rim-fit's lettering offset blends over >= 12 src px; far-front-crown at DETAIL with end gaps of 4.7 src px; nose-loop ends 10 src px below nose-underside's start; amber-lens an open loop with a 12.5 % gap; box-top-right and stripe-upper-rear trimmed to the line they overshot)",
               strokes=strokes)
    C.dump_json(outdir / "strokes.json", doc, indent=None)
    return doc, counts


def revision_5(G, S):
    """Revision 5 (2026-11-09): the critics of the revision 4 films and the main loop's round 5 decisions."""
    by = {s["id"]: s for s in S}
    rb = G.get("rear_bay", {})
    held = {h["id"]: h for h in rb.get("held", [])}
    return dict(
        date="2026-11-09",
        source="the critics of the revision 4 films (feel, truth) and the main loop's round 5 decisions; the main loop's decisions override the critics where they conflict",
        rear_bay=dict(
            shipped="D (3): lower-rail-top, rear-tube-level, bar-below-brace. T (3): the same. P: none (the main loop's rule).",
            post_below_beam=dict(decision="held, not drawn (main loop, BLOCKING): it crossed rear-tube-level at about x 1621 and its top sat under bar-below-brace's start, so the three read as a '+' and a double cross beside the rear tyre at 1440 DPR 1 and 2 and at 1280; the critic's independent registration is 0.865 within 2 src px (3 of its 5 off samples in the 10.9 src px run-on through the bar's dark body)",
                                 measured_by_this_build=held.get("post-below-beam", {}).get("measured")),
            bar_below_brace=dict(record=G.get("bar_end"), note="'End bar-below-brace where the beam's edge ends': measured along the bar's fitted top line (releases/hand-drawn-20261106/r3/art/r5/_diag/bar_end.py): the edge is within 1.25 src px of the line to x 1632.0, and from x 1632 the column under the line is bright asphalt (luminance 104-154; at x 1630 it is 23-30), so the bar's dark body and its top edge end between x 1631 and 1632. The bar already started there (1630.9, 668.5), so its geometry is unchanged; its right end is now free (no post), and the brace's end lands on it 19.4 src px from that end (the overshoot the critic accepted). The bar's left end is unchanged (the edge runs on past it, into the frame behind)."),
            gate=dict(D=rb.get("D"), T=rb.get("T"))),
        cross_gate=dict(rule="no two non-glyph line strokes of a class (tiers c, y, f, d) cross to form a '+' or an 'X' unless the photo shows a real crossing there: a cross is a crossing at a chord angle (+-3 src px) of 25 deg or more, where every one of the four arms runs on 3 src px or more past it and every arm's point 5 src px out lies 1.5 src px or more from the other line. A line that runs on along the other (the top plate's corners on the stripe edge they share, the side plate's lower edge along the front tyre) is a shared-edge junction, not a cross; those are reported as overlaps_or_tees.",
                        real_crossings_allowed=REAL_CROSSINGS, record=G.get("cross"),
                        fixed=["post-below-beam x rear-tube-level (held, see rear_bay)", "pale-panel x brace-inner (clipped, see pale_panel)",
                               "box-top-right x helmet: its start lay 5.69 src px inside the helmet outline (an X at (1455.2, 539.8)); trimmed to the helmet (a T): the helmet hides the box there",
                               "stripe-upper-rear x nose-loop: one end ran about 4 src px past the nose line (an X at (1345.2, 653.4)); trimmed to it (a T): the stripe's edge ends at the silhouette"]),
        driver=dict(record=G.get("driver_r5"),
                    note="torso-edge (1439.8, 649.9) -> (1402.2, 679.8) and sleeve-band (1440.1, 651.5) -> (1474.7, 665.5) were two strokes starting 1.63 src px apart and both tapered there: a V-notch in the arm at 1440 DPR 2. They are one stroke now, sleeve-torso: the sleeve band reversed from (1474.7, 665.5) round to (1440, 651), then on down the torso edge, joined with ink and blended over +-12 src px (no corner, no pen stop); its heading turns at most the join_turn value above over 4 src px chords near the old join (17 deg before). D and T. At P only collar is drawn: the lone torso-edge read as '/' (main loop: drop torso-edge at P)."),
        top_219=dict(classes="D", record=G.get("top_219"), note="drawn at class D only (PEN_SPEC 3, P3 nose row): at 768 its digits were 9.0, 7.4 and 7.6 CSS px tall (19.6, 16.0 and 16.6 src px x 0.4604) and read as curls. T draws the side-plate 219 only."),
        pale_panel=dict(record=G.get("pale_panel"),
                        note="its top-right corner (1551.6, 556.9) and 13 src px round it lay up to 6.1 src px inside the brace's black body, past brace-inner: a small X. Clipped at brace-inner: the stroke is the panel's right edge from (1528.9, 627.1) up to where it meets brace-inner, about (1549.4, 564.2), a T. The top edge clipped at brace-inner runs 22.9 src px from column-right to brace-inner, under the 40 src px gate as a stroke of its own, so it is not drawn (the critic's second option: one stroke ending at the brace-inner crossing). At P, where brace-inner is not drawn, the stroke ends the same place, about 4.5 src px short of brace-centre."),
        rim_junctions=dict(record=G.get("rim_junctions"),
                           note="where a rim's seen arc (FORM) and fit arc (DETAIL) meet, both now leave with the fitted ellipse's own tangent there (their Bezier handles turned onto it, lengths kept; the curves move by a fraction of a src px near the joint): the front rim's top joint turned 7.3 deg (segment tangents -53.8 / -46.5 deg; 12 deg over 3 src px chords, 16 deg in revision 4) and its bottom joint 7.7 deg. The engine's revision 5 notes found these kinks (the overlap of round caps cannot remove a kink). turn_after is the angle between the two strokes' tangents at the joint, in drawing order."),
        fw_rim_fit=dict(record=G.get("rim_blend"), letters_by_band=G.get("rim_letters_by_band"), blend_src_px=BLEND, envelope_half_width_src_px=BLEND_W, end_zone_src_px=END_ZONE,
                        note="the inward shift that keeps fw-rim-fit 1 src px off the sidewall lettering dropped from 0.98 to 0.34 src px over about 4 src px at the rim's bottom ((1452.4, 891.1) to (1444.6, 892.6)), where the last letter contact ends: a 1-device-px step at 1440 DPR 2. The shift is now the upper envelope of the old shift under a raised-cosine taper of half-width 24 src px (BLEND_W; at 12 the peak slope stayed 0.21 src px per src px), so every rise or fall of 0.5 src px or more spans at least 12 src px and the peak slope is about 0.1 (0.27 in revision 4) (shift_runs: [rise|fall, from s, to s, length, height, max slope], src px); the end zones (the junction with the seen arc) ramp in by smoothstep over 13 src px instead of a straight 8 src px ramp (zero slope at the joint). The revision 3 rule keeps its coverage: farther than 8 src px from a junction the final fit lies at least 1 src px from the letters (letters_by_band, min_beyond_8); inside 4 src px of the top junction it lies 0.1-0.4 src px from them, where the seen arc it continues runs on the letters' inner edge (0.14-0.74 in revision 3). Same for rw-rim-fit. The clearance gate (>= 1 src px off the letters outside the end zones) still holds: rim_fits_and_lettering in revision_3 and gates.rim_letters."),
        far_front_crown=dict(record=G.get("crown_gap"), clear_ends=G.get("clear_ends", {}).get("far-front-crown"),
                             note="DETAIL tier (d, #505b66, factor 0.42) instead of FORM (main loop): at FORM it read as a hump on the nose at 1440, 1280 and 768. Its end gaps to nose-loop stay visible: each end now stops 4.7 src px or more from the nose line (2.0 in revision 4, where the inks touched and the ends, being within 3 src px of a line, had no taper). white_css_px is the white between the two inks at each review width, untapered (contour 0.95 and detail 0.42 x w1, at the page's CSS px per src px): at least 1 CSS px at 768. The stroke is 45 src px now (56.9). Drawing convention (statement)."),
        nose_loop_end=dict(record=G.get("nose_loop_end"),
                           note="nose-loop ran about 39 src px down the black lower body's real front edge to the shadow at (957.4, 850.6), 39.6 src px below nose-underside's start: true, but with the body's bottom lost in shadow it read as an overshoot (27 CSS px at 1440). It now ends 10 src px below nose-underside's start, at about (934.0, 821.0), so the tip closes; the rest of that edge is left undrawn (an omission, not an invention). The far-silhouette gates are unchanged (the trimmed stroke is re-fitted within 0.15 src px)."),
        amber_lens=dict(record=G.get("amber_lens"),
                        note="an open loop with a 12.5 % gap (11.4 of 90.8 src px; chord 9.2 src px) centred on the loop's upper left, where the traced loop closed with a small curl (the curl is inside the gap): closed, inside arch-inner and the lens housing, it could read as the visor of a second helmet at DPR 2. Drawing convention (statement); the lens outline is the same traced line."),
        not_applied=[
            "brace-centre (P) ends in mid-air and the rear tyre floats at P (critic, minor): the main loop's rule ships no rear-bay member at P, and round 5 says keep everything else. Not changed.",
            "The P2 pen speed against stroke length, P numerals and pixel determinism (critics): engine items, not art. Not changed here.",
            "The critic's first pale-panel option (two strokes T-ing into the brace): the top edge alone is 22.9 src px, under the 40 src px gate, so the second option (one stroke ending at the brace-inner crossing) is used.",
            "post-below-beam kept with its end and the bar's end trimmed (the critic's alternative): the main loop dropped it.",
        ],
        not_checked="No browser film or engine pen-check run by the art stage in round 5 beyond the engine build's schedule check (r3/art/r5/engine-check: D last ink 4151 ms, T 2995, P 2781, every class ok). No real devices, no Safari or Firefox.",
    )


def revision_6(G, S):
    """Revision 6 (2026-11-09, the final art round): critics of the revision 5 films and the main loop's round 6 decisions."""
    R = G.get("r6_records") or {}
    by = {s["id"]: s for s in S}
    cnt = {cl: sum(1 for s in S if cl in s["classes"] and s["kind"] != "accent") for cl in "DTP"}
    return dict(
        date="2026-11-09",
        source="the truth and feel critics of the revision 5 films and the main loop's round 6 decisions (they supersede earlier decisions where they conflict)",
        diag_tube=dict(record=R.get("diag_tube"),
                       note="Truth critic (BLOCKING): the revision 5 line copied the inventory guide [[1441, 489], [1460, 512], [1481, 536]], 15 deg off the tube (41.3 deg from vertical against the tube's 26.4), its top end 8.4 src px left of the tube on leg-block's corner, and for y 489-506 it followed the red block's left side; only 0.49 of its samples lay within 2 src px of a tube edge (the generic measure passed it because the red block's edges are near). Now one straight line on the tube's right edge from (1448.3, 474.0) to (1478.0, 533.0): 66.0 src px at 63.3 deg from horizontal, parallel to the brace (63.4). This build's own least-squares fit of that edge gives (1448.07, 474.12) -> (1478.02, 532.99) (residual max 1.48 src px, 3 of 55 samples dropped), within 0.25 src px of the line. Own-edge registration (member_edge.py, polarity tube-dark / grass-bright): nearest 0.98 within 2 src px and 0.91 within 1 over the visible span; strongest 0.96 / 0.87; the generic measure 1.00 / 0.97. Drawn through an occluder for y 491-503 (arc 33.6-47.0 src px; the red block is not drawn); the hidden span's scores are in 'hidden'. The left-edge alternative (1441.2, 474.0) -> (1470.5, 533.0) scores lower (critic: 0.85; here 0.89 within 2 src px over the visible span, strongest pick) and is not used."),
        bar_below_brace=dict(record=R.get("bar_below_brace"),
                             note="Truth critic (BLOCKING): the revision 4-5 line ran at 6.0 deg, a chord over a bent pair of members (left of the V joint at x 1575-1581 a different bar slopes down to a bolt); 0.50 of it lay within 2 src px of its member pair and 0.39 of the beam's top. Now one straight line on the beam's top edge, y = -0.2263 x + 1036.16 (12.7 deg), from the V joint (1580, 678.61) to the measured corner (1630.5, 667.18): 51.8 src px as drawn by the engine (49.8 in the art: 1 src px is cut at each blunt end, which the engine runs on again; blunt_ends). Drawn left to right: the engine draws it straight after rear-tube-level, which ends at (1585, 705). Not drawn from the V to the bolt (about 21 src px, under the gate). The brace's end now lands on it at about (1612.0, 671.4) (record: brace_end), 0.9 src px lower than in revision 5. Own-edge registration (polarity asphalt-bright above / beam-dark below): nearest 0.93 within 2 src px over the visible span (0.81 over the whole line), strongest 0.88 (0.74); generic 0.96. The visible span leaves out x 1602-1612, where the brace's end covers the bar's top edge (the brace lands on it there); the rest of the misses lie at x 1597-1602, where the X bracing behind the bar puts the strongest step 2-3 src px above the line. A least-squares fit of the clean stretches (x 1580-1596 and 1613-1627) runs at 14.7 deg (the revision 2 measurement said the same, -14.7 deg over x 1582-1628), 1.25 src px lower at x 1580 and 0.55 higher at x 1630; it scores no better on its own edge (0.89 nearest), so the main loop's 12.7 deg line is kept. Under the rear-bay rule its length is accepted at >= 40 src px (the main loop's round 6 decision) instead of 55; straight (a two-point line), connected by the brace's end (a T). Provenance statement 8 ('drawn as the straight members the photo shows') now holds for it."),
        amber_lens=dict(record=R.get("amber_lens"),
                        note="Critic (polish): the snapped loop's bottom span (x 1452-1476) ran at y 470.5-471.1 on the housing's bezel, 2-3 src px below the amber's lower edge, and opening the loop dropped its registration from 0.91 (revision 4) to 0.82 within 2 src px. The loop is now the amber's own boundary, the R - B = 25 iso-line (R - B smoothed by a 0.7 src px Gaussian; rays from (1465.5, 461.0) every 1.5 deg, smoothed over 2 samples): within 0.73 src px of the unsmoothed iso-line everywhere, its bottom span at y 466.8-468.4 (2.1-3.5 src px higher, bottom_raised_at_x), its left side at x 1447.1-1448. The critic's left-end offset (2.5-4 src px at (1447.4-1448.2, 456-460)) was not reproduced here: by R - B and by luminance the amber's left boundary there is at x 1446.8-1447.3, within about 1 src px of the old line; the new line follows the iso-line on that side too. Same 12.5 % open gap at the upper left (revision 5). The generic registration is 1.00 within 2 src px."),
        class_t=dict(dropped=["top-plate", "far-front-crown"], counts_without_accents=cnt,
                     note="Class T draws neither top-plate (drawn blank at 768, DPR 1 and 2, it read as a band or window across the nose; true, but it says nothing without its numerals, which are drawn at D only) nor far-front-crown (a pale arc of about 30 CSS px floating above the nose at 768, read as a bump). D keeps both. T: 44 strokes without the P5 accents (46 in revision 5)."),
        blunt_ends=dict(record=R.get("blunt"),
                        note="Critic (polish; main loop: apply): bar-below-brace's left end, rear-tube-level's left end and lower-rail-top's right end were tapered free ends in white space, which read as streak tails. They are blunt now: the end's join bit is set (joined bit 1 start, bit 2 end), so the engine draws it at full width with a round cap (engine.js taper()), and because the engine then runs a join-flagged end on 1 src px along its own tangent (engine/build.cjs overlapJoins, OVERLAP), the art cuts 1 src px off each blunt end (end_in_art) so the drawn end lands on the measured end (end_measured). bar-below-brace is new geometry (see bar_below_brace): both its ends are free, and both are blunt (its right end at the measured corner is a tube end too). Joined ends are unchanged. A width convention only: no end moves."),
        sleeve_torso=dict(record=R.get("sleeve_torso"),
                          note="Critic (polish; main loop: apply if registration holds): the first 10 src px (the downturn at the right end, from about (1482.5, 653) down to (1474.4, 665.3)) are cut; the stroke now starts at about (1481.0, 657.9). Registration holds (generic 1.00 within 2 src px, 0.87 within 1). The arm's rise and crest remain."),
        pink_sleeve=dict(record=R.get("hoop_leg"),
                         decision="the main loop allowed one short joining stroke on the sleeve's LEFT edge, about (1503, 468) to (1505, 496), so hoop-column meets the arch, under an exception to the 40 src px gate only for a stroke that joins two drawn members, lies on a measured edge and has >= 0.90 of its samples within 2 src px.",
                         left_edge="measured and rejected: this build's fit of the left edge (dark-red sleeve against the black strip beside it) is (1504.54, 468.29) -> (1501.33, 495.92) (residual max 1.5 src px; the critic's line scores 0.73 within 2 src px on that edge's own polarity, the fit 1.00 nearest, 0.69 strongest: a stronger step of the same polarity, the sleeve's dark-to-bright shading, lies 3-4 src px to its right). Neither end joins a drawn member: the top lies 6.3 src px from the brace, 6.8 from the arch and 8.3 from lens-housing-b, the bottom 7.8 from hoop-column. At page scale (1440 DPR 1 and 2, r3/art/r6/_diag/sleeve-compare2.png) it read as a dash floating between the arch's end and the column. It is also 28 src px: the engine build (engine/build.cjs gates) rejects any line under 40 src px, with no exception.",
                         shipped="the sleeve's RIGHT edge (bright sleeve against the brace's black body), as the start of hoop-leg-arch (P1, every class) instead of a separate short stroke: the hoop gesture now starts at the column's top, (1512.64, 495.60), runs up the edge (a straight line through per-row measurements (1510.0, 470), (1509.8, 472), (1510.5, 476), (1511.0, 482), (1511.7, 488), (1512.8, 494); fit residual max 1.24 src px) into the arch's right end (the old start (1511.3, 467.3) lies 0.8 src px from the new path; the two members are joined with ink and blended over +-12 src px, no corner) and on over the arch as before. Own-edge registration of the leg part: 1.00 within 1 src px (nearest), 0.96 (strongest). The brace's start lies 0.23 src px from the leg (a fork where the arch, the sleeve and the brace meet in the photo); brace-centre (P) starts 1.1 src px from it. No length-gate exception is used.",
                         limits="the leg reaches the column's top (y 495.6) between the column's two drawn edges (column-right's start is 8.3 src px to its right, hoop-column's 18.7 to its left): the column's top edge is not drawn (black on black at x 1499-1500), so hoop-column itself still starts below the leg, not on it. The pink sleeve's left edge and bottom are not drawn (revision 2: both edges and the bottom read as a 'J' hook)."),
        engine_check=dict(note="The engine's build run read-only on the revision 6 art (engine/build.cjs as found on 2026-11-09 at about 23:30, --out under releases/.../r3/art/r6/; the engine agent was editing engine/build.cjs at the same time): every class ok, 0 gate violations, 0 locality windows over 0.25 cw; D last ink 4134 ms (target 4200), photo in 5234 (5300); T 2895; P 2764. These are the engine's numbers on this machine, not a browser film."),
        rejected=[
            "The short joining stroke on the pink sleeve's left edge: it joins no drawn member (ends 6.3-8.3 src px off) and the engine build has no length-gate exception; the right edge is drawn as the start of hoop-leg-arch instead (pink_sleeve).",
            "The 14.7 deg clean-stretch fit of the beam's top edge (bar_below_brace): no better on its own edge; the main loop's 12.7 deg line is kept.",
            "Moving amber-lens's left end by 2.5-4 src px: not reproduced by measurement; the left side follows the measured iso-line (amber_lens).",
        ],
        not_checked="No browser film, no 60 Hz viewing, no real devices, no Safari or Firefox, no 120 Hz. The page renders (review_page.cjs: 1440 DPR 2 and 1, 1280, 768 DPR 2, 390 DPR 3, no animation, no taper) and the 2x photo overlays were looked at; T at 1024 was not rendered. Another workflow ran headless Chrome on this machine at the same time.",
    )



def revision_7(G, S):
    """Revision 7 (2026-11-10, polish round): the main loop's decisions on the round 6 critics' optional polish."""
    R = G.get("r7_records") or {}
    cnt = {cl: sum(1 for s in S if cl in s["classes"] and s["kind"] != "accent") for cl in "DTP"}
    return dict(
        date="2026-11-10",
        source="the truth and feel critics of the revision 6 films (both passed) and the main loop's polish-round decisions. Every choice here is an agent decision (critics, main loop, this build), not the owner's: the owner has not seen any R3 output.",
        counts_without_accents=cnt,
        shadow_p=dict(record=R.get("shadow_p"),
                      note="Feel critic A1 (main loop: apply): class P draws shadow-ground-rear (the same line as D and T: the cast shadow's outer edge, 109.7 src px, drawing convention), straight after rw-rim-fit, so the phone's rear tyre is no longer an open arch with no ground line. P: 35 strokes without the P5 accents (34 in revision 6)."),
        rim_low_end=dict(record=R.get("rim_low_end"),
                         decision="Both critics flagged the rear rim's lower end (polish): rw-rim-seen ended at (1730.1, 779.7) after curling up toward rear-tyre's start (1732.6, 784.4), 4.6 src px from the tyre's outline, so at 1x and 2x the rim read as a hook into the tyre line. The feel critic proposed ending the rim about 3-4 src px earlier (it named rw-rim-fit as well, but the fit arc ends at the rim's upper right, (1745.8, 706.9), nowhere near the tyre's start); the truth critic proposed cutting the seen arc's first 6 src px so it starts at the rim's lowest point. Both were measured on the photo (releases/hero-pen-20261110/polish/tools/rimhook.py, rimhook2.py; renders measure/rimhook-sheet.png): the cut part is a true edge (the lit rim lip over the dark groove: 1.00 of it within 2 src px on its own polarity, 0.87 within 1; generic 1.00), so either version keeps only real edges, and both keep the stroke over 40 src px (50.9 and 47.1). White between the rim's ink and the tyre's, in a supersampled render at the page weights with the rim's landing taper and the tyre's 1 src px run-on (rimhook2.py): about 3.2 src px at 1440 DPR 1 and 2 for the 3.5 src px cut, 5.9 / 6.6 for the cut to the lowest point (revision 6: none at DPR 1, the inks touched); this build's analytic estimate is in the record (white). Chosen: the cut to the arc's lowest point (7.2 src px, the truth critic's 'about 6' measured: the arc's lowest point is (1723.4, 782.2), the critic estimated (1724.7, 782.1)), because the 3.5 src px cut leaves an upturn of about 3.5 src px still aimed at the tyre's start (a smaller hook), while the cut to the lowest point leaves the arc level at its end. This removes true line (7 src px of the lip); nothing is added. The white figures in the record are this build's analytic estimate (centre distance minus half widths minus half a device px of antialiasing per side)."),
        hoop_column=dict(record=R.get("hoop_column"),
                         note="Truth critic (polish; main loop: apply, measured points given): hoop-column started 18.3 src px left of and 3.6 below the leg's end, so the arch and the post met with a jog of about 13 CSS px at 1440, and the column's top edge between them, visible in the photo, was not drawn (revision_6.pink_sleeve 'limits'). The stroke now starts at the leg's end (1512.64, 495.6) and runs left along the column's measured top edge (y 495.6 / 494.1 / 496.2 / 497.4 at x 1512 / 1509 / 1502 / 1495; bright sleeve or background above, black column below; black on black only at x 1499-1500, 2 src px), then turns once at the column's top-left, where the top edge's last chord meets the column's left edge (about (1494.2, 497.5); the main loop's 'corner into the left edge at (1494.3, 499.2)': the straight left edge is extended 1.7 src px up to the corner instead of a 1.7 src px link, which would have given two pen stops 1.7 src px apart), and on down the left edge as before. Set from the measured points (not snapped), like diag-tube; measured on its own edge (member_edge.py, polarity bright above / dark below). P1 contour, every class."),
        lens_housing_top=dict(record=R.get("lens_housing_top"),
                              note="Truth critic (polish; main loop: apply): its first 6 src px (x 1443.2-1449 at y 446-448) ran inside the black where the housing meets the hoop's left leg, with no edge (the only run of the line over 2 src px from an edge; generic 0.88 within 2 src px). Cut with trim_start 6 along the authored (and drawn) direction; about 40.7 src px remain, over the 40 src px gate."),
        rear_bay_a3=dict(record=R.get("rear_bay_a3"),
                         note="Feel critic A3 (main loop: add one more straight tube only if a real one passes every existing gate: >= 0.90 of its samples within 2 src px of its own edge, one end within 6 src px of a drawn line or the rear tyre, >= 40 src px, straight within 1 src px; plus the rear-bay rules already in force: at most 3 near-horizontal members, no two within 8 deg of parallel closer than 20 src px, no cross). None passes (candidates); nothing is added and nothing is invented. The bay stays lower-rail-top, rear-tube-level and bar-below-brace at D and T, none at P."),
        kept=["far-front-crown at D (DETAIL tier), top-219 at D only, the lettering at D only, the round 6 geometry everywhere else: both critics called these good or accepted them; unchanged."],
        engine="Engine polish of this round (engine/solve.cjs; not art): E1 a P2 hop over 0.25 cw lifts max(17, 90 x hop / cw) ms; E2 a P1 hop of 0.20 cw or more lifts 45 ms (was the 30 ms beat); the line lift before 'of' 50 -> 30 ms and the P2-to-P3 phase pause 50 -> 33 ms (the join 67 -> 50 ms) pay for E2.",
        not_checked="No browser viewing at 60 Hz, no real devices, no Safari or Firefox. The page renders and the film sheets of this round (releases/hero-pen-20261110/polish/) were looked at; T at 1024 was not rendered.",
    )


def fix_r2(G, S):
    """Fix r2 (2026-11-10): the main loop's decisions on the verifiers' notes after the integration (agent decisions)."""
    R = G.get("fix_r2_records") or {}
    cnt = {cl: sum(1 for s in S if cl in s["classes"] and s["kind"] != "accent") for cl in "DTP"}
    return dict(
        date="2026-11-10",
        source="the feel verifier of the integrated page (verify-feel, non-blocking note: 'its rear wheel floats free') and the main loop's fix-r2 decision. An agent decision, not the owner's: the owner has not seen any R3 output.",
        decision="Class P adds the smallest set of the EXISTING D/T rear-bay members that ties the rear tyre in: rear-tube-level alone. It is the one member that touches the rear tyre at D and T (0.69 src px). Same geometry and the same stroke as at D and T (no new tracing, nothing invented); the engine's build draws it at its D/T pen position, straight after shadow-ground-rear. Its left end stays free, as at D and T.",
        counts_without_accents=cnt,
        record=R,
        supersedes="revision_5.rear_bay ('P: none'), revision_7.rear_bay_a3 ('none at P') and the dropped-feature notes 'rear-tube-level at P (revision 4 / revision 7)' say P draws no rear-bay member; since fix r2 P draws rear-tube-level. Those records are kept as history.",
        limits="P's last ink and every PEN_SPEC 5.5 limit are checked by the engine build (engine/build.cjs), not here.",
    )


def provenance(doc, G, rims, patches, outdir, hatch, ground):
    tools = ["common.py", "trace.py", "glyphs.py", "features.py", "build_art.py", "member_edge.py", "review.py", "review_page.cjs", "clock_estimate.py", "look.py", "look_guides.py"]
    ins = ["inventory-guides.json", "features.json", "glyph-order.json", "car-mask.json", "dark-mask-origin-880-380.png"]
    S = doc["strokes"]
    conv = [s["id"] for s in S if s["prov"] == "convention"]
    reg = [s for s in S if "registration" in s]
    w1 = [s["registration"]["within1"] for s in reg]
    w2 = [s["registration"]["within2"] for s in reg]
    md = [s["registration"]["median"] for s in reg]
    prov = dict(
        made="2026-11-10 (fix r2 on revision 7, polish; first made 2026-11-07)", generator="tools/hero-pen/build_art.py (python, numpy, scipy, pillow); snapping and fitting imported from tools/hero-drawing/trace_lines.py, unmodified",
        photo=dict(file="assets/hero-fsae-track-2200.webp", sha256=C.photo_sha(), pixels=[C.W, C.H],
                   note="The public 2200 px hero photo. Read only: its pixels are never changed. No raw or private photo was used."),
        inputs={k: C.sha256(C.INP / k) for k in ins},
        tools={k: C.sha256(C.HERE / k) for k in tools},
        imported={"tools/hero-drawing/trace_lines.py": C.sha256(C.HD / "trace_lines.py"), "tools/hero-drawing/np_cv2.py": C.sha256(C.HD / "np_cv2.py")},
        strokes_json_sha256=C.sha256(Path(outdir) / "strokes.json"),
        seed=SEED, counts=doc["counts"], hatch_set=doc["hatch_set"], ground_strokes=ground,
        statement=[
            "Every line stroke is a named feature of the photo: an inventory guide (about 4 px accurate) or an authored guide read off a zoomed crop, snapped onto the photo's measured edge, valley or ridge, then fitted with cubic Beziers (max error 0.5 src px; 0.15 on the smoothed nose span and the rim fits moved off the lettering). Lines stop where the edge disappears for more than 6 src px.",
            "The coaming tube (rail's top line, rail-lower) is drawn as two straight lines fitted to per-column measurements of its top and bottom edges (build_art.tube_edges; revision_3.coaming_tube). Over x 1395-1452 the suit above the tube is brighter than the tube, its top edge is not measured there, and the top line runs across as the straight fit.",
            "Lettering and numerals are single-line strokes on the skeletons of the real letters (Otsu threshold, Zhang-Suen thinning), routed through hand-read waypoints in writing order; every sample is checked against the medial axis, and (revision 3) every ridge pixel of every letter and numeral lies within 2.5 src px of its strokes, except the side-plate 2's base, which the front tyre hides (gates.glyph_cover).",
            "Drawing convention, not hardware: the two ghost loops and the nose gesture line (P0); the rear shadow edge (shadow-ground-rear: a line traced on the outer edge of the photo's cast shadow under the rear tyre, drawn in P2 straight after the rear rim at DETAIL weight; drawing a shadow is a convention, it is not part of the car); and the far nose silhouette's smoothing (nose-loop and the nose gesture over x 1151-1344: smoothed within 2 src px, see revision_3.far_silhouette_smoothing). Revision 5 adds three drawing conventions, none of which adds an edge the photo does not show: far-front-crown stops 4.7 src px short of the nose line at both ends (a far line kept off the near one, so it reads as behind the body; the real crown runs on behind the nose); amber-lens is drawn as an open loop with a 12.5 % gap at its upper left (the real lens outline is closed); nose-loop stops 10 src px below nose-underside's start (the real front edge of the black lower body runs on about 39 src px further, down to the shadow: an omission, see revision_5.nose_loop_end). Revision 6 adds one: the free ends of three rear-bay members are drawn blunt (full width, no taper: bar-below-brace's two ends, rear-tube-level's left end, lower-rail-top's right end), so they read as tube ends; this changes the stroke's width only, not where it ends (revision_6.blunt_ends). No hatching ships (hatch_decision).",
            "Drawn through an occluder (revision 6): diag-tube is one straight line on the diagonal tube's right edge from (1448.3, 474.0) to (1478.0, 533.0) (63.3 deg from horizontal, parallel to the brace); for y 491-503 (about 13 src px of its 66) the red block, which is not drawn, hides that edge, and the line runs across the block where the tube passes behind it. bar-below-brace runs under the brace's end over x 1602-1612, where the brace covers the bar's top edge (the brace lands on it there). Both spans are in each stroke's 'occluded' record and are left out of its own-edge score (revision_6).",
            "Set from measurements, not snapped (revision 6): diag-tube and bar-below-brace are straight lines placed on the main loop's coordinates, which come from the truth critic's per-row and per-column edge fits; this build measures each again on its own member's edge (member_edge.py: the luminance step of the member's polarity, nearest and strongest, within 4 src px) and reports both scores beside the generic one (revision_6). The first 26 src px of hoop-leg-arch (the pink sleeve's right edge, from the column's top to the arch's end) are a straight line through per-row measurements of that edge (residual max 1.24 src px). amber-lens is the amber's own colour boundary (the R - B = 25 iso-line of the photo, smoothed 0.7 src px), not a luminance snap. Revision 7: the first 19 src px of hoop-column (the column's top edge, from the leg's end to the column's top-left corner) are a line through the main loop's measured edge points, not snapped, measured on its own edge (revision_7.hoop_column).",
            "Fitted, not seen: the rim ellipse arcs in deep black (ids ending -rim-fit) complete the least-squares rim fits. Revision 3 moves each inward where it came closer than 1 src px to the white sidewall lettering (revision_3.rim_fits_and_lettering). Revision 4: rw-rim-fit ends where its edge support ends at the rim's upper right; the rest of the fit (the right side and lower right, pure black and 2.7-4.7 src px inside the tyre outline) is not drawn, and no rim arc comes within 4.5 src px of its tyre's drawn outline (revision_4.rims).",
            "Derived: the P5 accents re-trace sub-ranges of traced strokes with the same points (the engine's build leaves them out by default).",
            "Nodes (the strokes drawn now; revision 4 and 5): " + "; ".join("%s's %s runs on %.2f src px along its own line to %s" % (k, {"s": "start", "e": "end"}[w], v["moved"], v["to"])
                                                                      for k, m in sorted(((s_["id"], s_["meet"]) for s_ in S if s_.get("meet"))) for w, v in sorted(m.items()))
            + ". These are the 'meet' records (src px, + extended, - trimmed); each result is measured by the registration gate like every traced line (the brace and lower-rail-top run through no gap: the brace's black continues to the bar's top edge, and the edge stays measured over lower-rail-top's extension). rail's top line meets its vertical at their intersection (a corner). Without a move: rear-tube-level's right end lies 0.7 src px from the rear tyre's silhouette; the brace runs up its own fitted line to the arch (y 469). Revision 5 trims (each overshoot ended where the stroke crosses the other line, so the two meet in a T): " + "; ".join(
                "%s by %.2f src px at %s (the end that ran past it)" % (s_["id"], r_.get("trimmed_start", r_.get("trimmed_end", 0.0)), r_["to"])
                for s_ in S if s_.get("trim_at") for r_ in s_["trim_at"]) + ". post-below-beam (with its run-on to the bar) is held, not drawn (revision_5.rear_bay).",
            "Lettering ends (revision 1): every free end of a letter or numeral stroke was moved along its end tangent to the ink end minus half the stroke width (Zhang-Suen thinning had shortened several: the l of 'Olin' stopped at the i's height). The before and after gaps are in each glyph's glyph_check.ends.",
            "Not drawn: people's names, sponsor and third-party marks (Tesla, SAE logo form), 'Hoosier', the stalk and dark shape on top of the hoop (open owner question), the nose's cast shadow, and the inventory features the art stage found no visible edge for (its ids lower-body-contour, steering-wheel, uprights, fw-contact, rw-contact, far-rear-tyre). The drawing claims no function for any member it draws: the rear-bay lines (rear-tube-level, which is the inventory's working label 'arm-upper'; lower-rail-top; bar-below-brace) are drawn as the straight members the photo shows, and nothing here says what they are or are not. TSAL is never claimed and no stroke or member id names a lamp or a suspension part: the lens and its housing are amber-lens and lens-housing (inventory_aliases).",
            "The drawing is an overlay for the opening animation; the hero still ends on the original photo pixels, which are never changed.",
            "Stroke ids are neutral working names, not claims. 'collar' (member collar-near, the inventory's 'near shoulder silhouette against asphalt') is the left edge of a dark strap at the driver's near shoulder, not a collar. 'leg-block' is the dark block the hoop's left leg enters (inventory: the 'wide black leg'); nothing claims what it is. 'sleeve-torso' (revision 5, the main loop's 'arm') is one line over the driver's sleeve band (inventory sleeve-band, reversed) and on down the edge of the torso (inventory torso-edge).",
        ],
        inventory_aliases={v: "inventory guide '%s' of the art stage (a working label; PLAN risk 5: nothing in the photo proves the part's function)" % k for k, v in ALIAS.items()},
        shadow_strokes_convention=[s["id"] for s in S if s["id"].startswith("shadow-") or s["kind"] == "shade"],
        meets={s["id"]: s["meet"] for s in S if s.get("meet")},
        hatch_decision=dict(
            shipped="none (revision 1)",
            tyre_flicks="4-6 straight '/' flicks per tyre from the drawn silhouette into the dark tread face (pitch 10 +- 1.5, 25-40 src px, >= 30 deg off the silhouette): the rear tyre's drawn silhouette borders the dark face for only about 50 src px (y 715-765) and the front tyre's drawn contour stops at y 830, so at most %s rear and %s front flicks fit (also tried 45 deg and 10-20 deg tangent limits: 2 and 0). Dropped, as the critic allowed." % (HATCH_INFO.get("hatch-rear-tyre", {}).get("longest_run"), HATCH_INFO.get("hatch-front-tyre", {}).get("longest_run")),
            box="at the 10 src px pitch only %s flicks start on a drawn line inside the box's dark area (the critic's minimum is 5): dropped" % HATCH_INFO.get("hatch-box", {}).get("candidates"),
            panels="dropped (2-3 flicks in a drawn rectangle read as glass glare; single flicks as scratches)",
            body="rejected earlier: the dark mask starts 20-65 src px below the stripe, so no flick can start within 6 src px of a drawn line",
            info=HATCH_INFO),
        revision_2=dict(
            far_silhouette=dict(resnap=RESNAP, gate=G.get("far_silhouette"),
                                note="nose-loop and the nose gesture, x 1204-1306: re-snapped from the top of the white / navy SAE decal (7-12 src px low) onto the asphalt-to-stripe boundary. The generic registration measure below counts the new span less well (its absolute edge floor of 4.0 is above the b* gradient of this chroma edge, about 3 per src px after the channel preparation); the far_silhouette gate measures it on the chroma channel instead."),
            hoop=dict(stroke="hoop-leg-arch", superseded="revision 4: see revision_4.hoop (the one-stroke hoop and its two corners are gone)",
                      note="leg bottom-up (traced), corner, shroud top (traced, y 484-485, about 9 src px), corner, up the arch tube's left edge to (1429, 476), over the arch to its right end, then 4.5 src px on down to (1512.6, 467.5). No ink across a gap: every part is a measured edge (registration of the whole stroke in its record)."),
            brace="the brace (D, T) is extended along its own fitted line from the guide's start (1530, 507.5) up to y 469, where the arch ends (1.5 src px apart). The dark-to-grass edge it follows was measured at (1514.5, 474), (1517, 480), (1519.5, 486), (1521.5, 490), (1524, 494), within about 1 src px of the line. The brace's lower end no longer meets a drawn line (the beam is not drawn).",
            front_rim=rims["fw"].get("lip"),
            front_rim_note="the rim ellipse refit with 25 samples of the lit top lip (x 1446-1470, the brightest row in y 799-809) weighted 4x beside the snapped edge samples. fw-rim-seen and fw-rim-fit are complementary arcs of this one ellipse (0.0 src px apart where they meet): there is no second rim line in the art. The second line the critic saw beside the left of the rim at DPR 2 is most likely the P0 ghost loop (GUIDE tier, 1.4 laps, each lap offset up to 1.5 src px from the same fit), which is drawing convention by PEN_SPEC 1.7 and is not changed here.",
            front_tyre="front-tyre: the counter-clockwise silhouette's first 25 src px (bottom right, curling inward under the rim) are cut; it now starts at about (1466, 903.6).",
            lens_housing="lens-housing-a (its right end ran 4-5 src px inside the black housing) is replaced by lens-housing-top, an authored guide on the housing's top edge snapped with r 2; trimmed at x 1478 the old piece was 35 src px, under the 40 src px gate.",
            top_219=dict(strokes=G.get("top_219"), note="the nose-top 219 (D, T): one stroke per numeral, parts joined by corners (see glyph-order.json). The 2: bowl and diagonal on the skeleton from the top-left hook, corner at the bottom-left, the base straight. The 1: the flag straight from its free end to the apex, corner, the stem straight. The 9: from the stem junction counter-clockwise round the bowl back to the junction, corner, then the tail (the revision 1 trace closed the bowl at its left end and doubled back twice)."),
            i_dot="olin-03-i-dot: at the ink centre of the dot (intensity-weighted, glyph-mask component) instead of its brightest pixel: about (1260.5, 722.1) in this pipeline's glyph convention, where a photo pixel i spans [i, i+1) as the canvas draws it; in the pixel-centre convention (pixel i centred on i) that is about (1260.0, 721.6).",
            rear_bay="superseded by revision_3.rear_bay (revision 2 shipped none under a both-ends rule)",
            p4_order="superseded by revision 3: no nose shadow; the rear shadow edge is drawn in P2 and P4 is empty",
            note="History of revision 2. Where revision_3 says otherwise, revision_3 holds.",
        ),
        revision_3=dict(
            note="History of revision 3. Where revision_4 or revision_5 says otherwise, the later revision holds (far-front-crown is DETAIL since revision 5; the rear bay is in revision_5.rear_bay).",
            coaming_tube=dict(gate=G.get("tube"),
                              note="rail (P1) and rail-lower (P2) drew the straight coaming tube bent and pinched: over x 1404-1452 rail's snapped top line slid 3.4-4.4 src px down onto the tube's lower half (the white suit above the tube is brighter than the tube there, so the snap took the stronger lower edge), and rail-lower was tilted 1.3 deg against the tube's bottom edge. Now each is one straight line fitted to per-column measurements: the bottom edge by the truth critic's measure (railfit.py), the top edge where the area above the tube is darker than the tube (x 1372-1394 and 1453-1524). rail keeps its short vertical at the left end (the side panel's rear edge, x about 1366-1370, y 702-758) and meets the top line there at a corner."),
            side_plate_9="plate-219-03-9 (D, T, P; the last ink at T and P) is one stroke of two parts like the nose-top 9: from the stem junction (about 1492.3, 720.4) up the bowl's right side, over the top, down the left side, round the bottom back to the junction, a corner, then the tail to its free end (about 1479, 749). Revision 2 started on the bowl's right side at y 709 and left 11.6 src px of the bowl undrawn (open).",
            side_plate_1="plate-219-02-1: the flag's tip hooks down; the skeleton (thinned and spur-pruned) stopped about 2.5 src px short of it, so the stroke now starts with a short straight lead-in on the flag's tip, joined without a pen stop (a 'smooth' part), checked on the medial axis like the rest.",
            glyph_cover=G.get("glyph_cover"),
            glyph_cover_note="The truth critic's glyphcover.py (no clip, components touched by the strokes) also counts, for the side plate, a dark strip at x 1413 (y 730-745) on the plate's left border, outside the plate's clip polygon, and the black tyre at (1424-1426, 760); neither is numeral ink. This gate clips the plate and exempts the tyre.",
            far_silhouette_smoothing=dict(record=SMOOTH, gate=G.get("far_silhouette"),
                                          note="Drawing convention: smoothed within 2 src px. nose-loop's far edge over x 1151-1344 is the curve of least bending within 1.6 src px of the measured asphalt-to-stripe boundary (x 1207-1300), 2.0 src px of the traced line at the plate corner (x 1186-1206) and 1.0 src px of the traced line elsewhere. The plate-corner step (traced: y 647 to 640 over x 1204-1212, peak slope 1.6) is spread over the width in plate_step; between the step and the rear corner the curvature does not reverse (inflections in the record). The nose gesture (P0) takes the same curve over its span (x 1151-1244). The line follows a real edge everywhere within the band; the lumps it no longer follows are real edge shape (the truth critic: the step about 4 src px and a shoulder at x 1282-1290 of 3-4 src px)."),
            rim_fits_and_lettering=dict(record=G.get("rim_letters"),
                                        note="Each -rim-fit (fitted in deep black) moved inward along the ellipse normal where it lay closer than 1 src px to the white sidewall lettering (letter pixels: luminance over 70 in a 4x crop, inside the tyre's silhouette and outside the rim ellipse). The shift is smooth (widened, Gaussian), never less than needed, and zero over the 8 src px next to each end, where the arc meets its seen arc. Not fixed: fw-rim-fit's first 3 src px, where it continues fw-rim-seen (a measured edge that itself runs on the inner edge of the upper 'Hoosier' letters), lie 0.14-0.74 src px from a letter pixel (min_dist_after_in_end_zones)."),
            far_front_crown="far-front-crown (D, T): moved from P1 (CONTOUR weight, gesture 8) to P2 'nose-top' at FORM weight, same geometry: drawn alone at contour weight on top of the nose line it read as a blister in the bodywork. Not drawn at P (revision 2).",
            shadows="shadow-ground-front-right (D, T) is not drawn: its nearest point lay 109.5 src px from any drawn line (77-105 CSS px at 1440), so with no underside line it read as a horizon or speed stroke, and at T as a stray dash. No other lone ground line replaces it. shadow-ground-rear (D, T) stays (it ends %s src px from the rear tyre's silhouette and works as the tyre's lower edge): moved from P4 to P2 'rear-wheel' straight after rw-rim-fit, at DETAIL weight, drawn from its end nearer the pen (right to left). P4 is empty." % G.get("shadow_rear_to_tyre"),
            rear_bay=dict(gate=G.get("rear_bay"), candidates_revision_2=REAR_BAY_CANDIDATES,
                          rule="the main loop's rule (it replaces revision 2's 'both ends within 4 src px'): each member straight (snapped edge within 1 src px of the line), >= 55 src px, >= 0.90 of its samples within 2 src px of a measured edge, at least one end within 6 src px of a drawn line or of the rear tyre; named as tubes without a function. Kept from revision 2: at most 2 near-horizontal members, no two within 8 deg of parallel, none at P.",
                          shipped="D and T: rear-tube-level (the long straight member at y 705-708 that runs into the rear tyre, inventory 'arm-upper', its top edge; right end on the rear tyre) and lower-rail-top (the lower side rail's lit top edge, its left end run on to the front tyre's silhouette).",
                          held="post-below-beam (no end within 6 src px of a drawn line or the rear tyre; rear-tube-level crosses its middle at about (1621.5, 706.6)) and column-below-rail (registration 0.889 < 0.90) are traced, measured and set aside: gate.held has their measurements and points. Also measured in revision 3 and not drawn: the beam (authored guide, edge r 2: 75.2 src px, dev 0.93, registration 0.97, but its ends lie 31.7 and 23.5 src px from drawn lines, and the inventory's beam-top edge runs at -14.6 deg against the fit's -6.4 deg); rod-lit and diag-to-tyre (39-40 src px, under 55); rail-behind-hoop (dev 1.3-1.5 src px); lower-rail-under (deny-listed in an earlier round, and within 8 deg of parallel to lower-rail-top). The target was 3-5 members at D: D ships 2.",
                          superseded="revision 4: see revision_4.rear_bay (the gate record above is the current one)"),
        ),
        revision_4=dict(
            note="History of revision 4. Where revision_5 says otherwise, revision_5 holds: post-below-beam is held (not drawn), far-front-crown is DETAIL with 4.7 src px end gaps, top-219 is D only. The 'gate' records inside this block are computed by this build (current).",
            hoop=dict(record=G.get("hoop"),
                      note="Critics (BLOCKING): revision 3's hoop-leg-arch held a 9.3 src px horizontal step at y 484 (from (1417.9, 484.1) to (1427.2, 484.6)) between the dark block's left edge and the hoop leg; every point lay on a real edge, but it read as a kinked main hoop, most of all in P1. Now: hoop-leg-arch (P1, every class) is the arch alone, drawn from its right end over the top and down the leg's left edge to where the leg meets the block, run on 1.98 src px to the block's drawn top line (a T). leg-block (P2 FORM, every class) is the block, after a pen lift: its top edge as one straight line from beside the leg's right edge (1436.7, 488.3) across the leg's foot to its top-left corner (about 1418, 483.5), then down its outer edge to (1403.5, 533.2). The top line is measured: left of the leg the lit top face's light-to-dark drop (y 483.5-485.5, x 1418-1426, 31-62 levels); across the leg's foot the lower side of a faint light line (y 486-488, x 1430-1438, 39-76 levels against 0-13). The whole stroke: registration in record.block_registration. Not drawn (measured): the 8 src px edge right of the leg at y 481.5 (x 1436-1444, the bottom of the background triangle between the leg and the lens support: it lies about 6.5 src px above the drawn top line, so it is not the same edge) and the block's inner edge, which registers only over y 502-530 (28 src px, under the 40 src px gate; above y 502 the block joins the black diagonal member and the red sleeve). The critics' first plan (top edge right of the leg at y 481.5 plus the right edge) is therefore replaced by the measured top line across the leg's foot; the truth critic has not yet confirmed it."),
            jog_gate=dict(rule="no non-glyph stroke has two opposite turns of 60 deg or more less than 12 src px apart (turn = heading change between the chords 4 src px behind and ahead of a sample, resampled at 0.5 src px; turns are the local extremes of |turn| >= 60 deg)",
                          failing=G.get("jog"), glyph_strokes_with_jogs_reported_not_enforced=G.get("jog_glyphs"),
                          note="revision 3's hoop-leg-arch fails it (turns +74.1 deg at (1417.8, 484.4) and -69.5 deg at (1427.1, 484.6), 9.5 src px apart); no stroke of revision 4 does, glyphs included"),
            rims=dict(cut=G.get("rim_cut"), rim_to_tyre_min=G.get("rim_tyre"), clearance=TYRE_CLEAR,
                      note="rw-rim-fit ran about 40 src px through pure black (luminance 0-3) on the rear rim's right side, 2.7-4.7 src px inside the tyre outline at y 712-778: a doubled outline at 1440. It now ends where its edge support ends (the first stretch of more than 6 src px with no measured edge within 2 src px, after its first supported sample): at about (1746, 707), 6 src px short of the critic's estimate (1752, 712); its kept part is 0.95 supported. The seen arc carries the lower left; the right side and lower right of the rim are not drawn (the rim tucks behind the sidewall). No rim arc comes within 4.5 src px of its tyre's drawn outline: rw-rim-seen lost its first 3 src px. The front rim is unchanged (its fit stays 6.9 src px or more from the front tyre's outline). The fit's new free end has no letter-clearance end zone: it is kept 1 src px inside the lettering to its end."),
            tyres="front-tyre: 12 src px more cut from its counter-clockwise start (37 in all): it starts at about (1472.8, 893.7), at the rim's lowest point, not 11 src px below it heading up-right (a hook at 1440). Trimmed rather than reversed: reversing would draw it clockwise and lengthen the P1 pen travel by about 160 src px. rear-tyre: its first 9.5 src px are cut, so it starts at about (1732.6, 784.4), 3.4 src px from the rear shadow line's start (1736.0, 784.1), instead of passing it as a tick.",
            far_front_crown=dict(record=G.get("clear_ends", {}).get("far-front-crown"),
                                 note="The critics asked to drop it at D and T (a blister on the nose at 1440, 1280 and 768) or, if kept, to draw it at DETAIL weight with each end 2 src px or more short of the nose line. The main loop's decision for this round (P2, FORM weight, D and T) overrides the drop and the weight; the non-conflicting part is applied: each end now stops 2.05-2.07 src px from nose-loop (3.25 and 2.75 src px trimmed; 63.2 -> 56.9 src px)."),
            rear_bay=dict(gate=G.get("rear_bay"),
                          rule="the main loop's rule: each member straight (snapped edge within 1 src px of the line), >= 55 src px, >= 0.90 of its samples within 2 src px of a measured edge, connected: at least one end within 6 src px of a drawn line or of the rear tyre (connected_by_own_end), or (revision 4, reported apart as 'tees') another drawn line's end within 6 src px of it; named as tubes without a function; none at P. Revision 4 relaxes the art's own earlier limits: at most 3 near-horizontal members (was 2), each connected; two members within 8 deg of parallel only when at least 20 src px apart over their common x span (bar-below-brace and rear-tube-level: 7.9 deg, 32.1 src px apart).",
                          shipped="D (4): lower-rail-top, rear-tube-level, post-below-beam, bar-below-brace. T (3): lower-rail-top, rear-tube-level, bar-below-brace. P: none (the main loop's rule; the critic's request to add rear-tube-level at P is not applied).",
                          bar="bar-below-brace: the top edge of the thick dark bar directly under the brace's end (asphalt above on its right half; inventory 'beam-top', a working label), one straight line from (1630.9, 668.5) to (1559.7, 676.0), 71.6 src px, -6.0 deg, straight within 0.73 src px (edge snap r 2), registration 0.973. The brace runs on 7.02 src px along its own line to it (the brace's black continues to the bar). At D the post's top lands on it and its right end lies 5.8 src px from the post; at T it is connected only by the brace's end (a T). Its left end is free: drawn right to left, it lifts off there.",
                          post="post-below-beam (D): the dark post under the bar (valley), its top run on 10.93 src px up through the bar's dark body to the bar's drawn top edge: 73.1 src px, straight within 0.47 src px, registration 0.921 over the whole line (0.97 before the run-on). Its lower end (1618, 742) is free and lifts off. It contains the inventory's 'strut-short', which the illustrator's spec listed as rear clutter; the main loop's candidate list overrides that.",
                          free_ends="lower-rail-top now starts on the front tyre and lifts off at its right end; rear-tube-level starts on the rear tyre and lifts off at its left end (critic A3; no geometry change)."),
            rejected=[
                "far-front-crown dropped at D and T, or drawn at DETAIL weight: the main loop's decision (P2, FORM weight) overrides; ends kept 2 src px short of the nose line.",
                "rear-tube-level added at P (critic A2): the main loop's rule ships 0 rear-bay members at P.",
                "the critic's second rear-bay candidate (the tube from the bar's right end into the rear tyre, about (1632, 686) to (1654, 697)): about 25 src px, under the 55 src px member rule and the 40 src px gate.",
                "the block's top edge at y 481.5 right of the leg and its right edge (critic 1, A1): measured and not drawn (see hoop); the top line across the leg's foot is drawn instead.",
                "front-tyre reversed (A4 option): trimmed instead (keeps counter-clockwise, no extra pen travel).",
            ],
            not_changed="Engine items (P2 popping, class P numerals near stamped, determinism) belong to the engine and are not changed by the art.",
        ),
        revision_5=revision_5(G, S),
        revision_6=revision_6(G, S),
        revision_7=revision_7(G, S),
        fix_r2=fix_r2(G, S),
        convention_strokes=conv,
        fitted_strokes=[s["id"] for s in S if s["prov"] == "fitted"],
        derived_strokes=[s["id"] for s in S if s["prov"] == "derived"],
        authored_guides={f["id"]: ("line set from measured edge coordinates (inventory: %s), not snapped; measured on its own edge (revision_6, revision_7)" if all(m.get("nosnap") for m in f["members"] if "pts" in m)
                                   else "authored guide read off a zoomed crop (inventory: %s), then snapped and measured like the rest" + ("; revision 6: its first member is a straight line set from measured edge coordinates, not snapped" if any(m.get("nosnap") for m in f["members"]) else "")) % (f.get("src_inv") or "none")
                         for f in C.load_json(C.INP / "features.json")["features"] if any("pts" in m for m in f["members"]) or f.get("skeleton")},
        rejected_by_gates=G.get("rejected", []),
        rims={k: dict(ellipse=[round(v, 3) for v in r["ellipse"]], guide_fit=[round(v, 3) for v in r["guide_ellipse"]], rms_px=round(r["rms"], 3),
                      seen_arc_deg=[int(r["seen"][0]), int(r["seen"][1])]) for k, r in rims.items()},
        hatch_patches=patches,
        registration=dict(method="per 2 src px sample of the drawn line: the nearest local maximum of the photo's edge (or valley / ridge) response within +-4 src px along the normal, with an absolute floor (edge 4.0, valley/ridge 2.0, about the 10th percentile of on-edge responses); 'no edge' when none",
                          strokes=len(reg), within1_median=round(float(np.median(w1)), 3), within2_median=round(float(np.median(w2)), 3),
                          offset_median_of_medians=round(float(np.median(md)), 3),
                          spec_16_2_pass=sum(1 for s in reg if s["registration"]["within1"] >= 0.95 and s["registration"]["median"] <= 0.5),
                          task_gate_pass=sum(1 for v in w2 if v >= REG_MIN_W2)),
        dropped=C.load_json(C.INP / "features.json")["dropped"],
        gates=G,
    )
    C.dump_json(Path(outdir) / "provenance.json", prov)
    return prov


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--hatch", choices=["body", "tyre"], default="tyre")
    ap.add_argument("--out", default=str(C.OUT))
    ap.add_argument("--ship-held", action="store_true", help="comparison only: also draw the held rear-bay candidates (fails the rear-bay gate)")
    ap.add_argument("--crown", choices=["form", "detail", "drop"], default="detail",
                    help="far-front-crown at DETAIL weight (revision 5, the main loop's decision, default); form or drop write comparison builds only")
    a = ap.parse_args()
    global SHIP_HELD, CROWN
    SHIP_HELD = a.ship_held
    CROWN = a.crown
    if CROWN != "detail" and Path(a.out).resolve() == C.OUT.resolve():
        raise SystemExit("--crown form|drop writes comparison builds only: pass --out DIR")
    if SHIP_HELD and Path(a.out).resolve() == C.OUT.resolve():
        raise SystemExit("--ship-held writes comparison builds only: pass --out DIR")
    order, G, rims, patches, gregs, tex = build(a.hatch, 0)
    doc, counts = write_out(order, G, rims, patches, gregs, tex, a.out, a.hatch, 0)
    prov = provenance(doc, G, rims, patches, a.out, a.hatch, 0)
    log(json.dumps(counts))
    INFO = ("driver_count", "rear_frame_count", "hatch_rules", "rejected", "length", "car_mask", "registration", "glyph_ends", "glyph_end_worst",
            "rear_frame_nodes", "rear_frame_horizontal", "helmet_brow_start_to_outline", "shadow_nose_to_nose_loop", "hatch_info",
            "far_silhouette", "hoop_corners", "hoop_corner_offsets", "lens_housing_a_xmax", "top_219", "rear_bay",
            "glyph_cover", "tube", "rim_letters", "far_silhouette_smooth", "shadow_rear_to_tyre", "p4_strokes",
            "hoop", "jog_glyphs", "rim_tyre", "rim_cut", "clear_ends",                   # revision 4 records
            "cross", "driver_r5", "pale_panel", "amber_lens", "nose_loop_end", "crown_gap", "rim_blend", "bar_end", "rim_junctions", "rim_letters_by_band",   # revision 5 records
            "r6_records",   # revision 6 records
            "r7_records",   # revision 7 records
            "fix_r2_records")   # fix r2 records
    bad = {k: v for k, v in G.items() if v and k not in INFO}
    bad_h = [h for h in G["hatch_rules"] if not h["ok"]]
    log("gates:", json.dumps({k: v for k, v in G.items() if k not in ("hatch_rules", "glyph_ends", "rear_frame_nodes")}))
    log("rear-frame nodes:", json.dumps(G["rear_frame_nodes"]))
    log("glyph ends worst |gap|:", G["glyph_end_worst"])
    log("hatch rules:", json.dumps(G["hatch_rules"]))
    log("hatch info:", json.dumps(HATCH_INFO))
    log("registration:", json.dumps(prov["registration"]))
    log("far silhouette:", json.dumps(G["far_silhouette"]))
    log("hoop:", json.dumps(G.get("hoop")))
    log("jog:", json.dumps(G.get("jog")), "glyph turns (reported):", json.dumps(G.get("jog_glyphs")))
    log("rim to tyre:", json.dumps(G.get("rim_tyre")))
    log("top 219:", json.dumps(G["top_219"]))
    log("rear bay:", json.dumps(G["rear_bay"]))
    for k_ in ("cross", "driver_r5", "pale_panel", "amber_lens", "nose_loop_end", "crown_gap", "rim_blend", "bar_end", "rim_junctions", "rim_letters_by_band", "r5"):     # revision 5
        log("r5 %s:" % k_, json.dumps(G.get(k_)))
    log("rims:", json.dumps({k: v.get("lip") for k, v in rims.items()}))
    for k_, v_ in (G.get("r6_records") or {}).items():                          # revision 6
        log("r6 %s:" % k_, json.dumps(v_))
    log("r6:", json.dumps(G.get("r6")))
    for k_, v_ in (G.get("r7_records") or {}).items():                          # revision 7
        if k_ != "rear_bay_a3":
            log("r7 %s:" % k_, json.dumps(v_))
    log("r7:", json.dumps(G.get("r7")))
    log("fix r2 records:", json.dumps(G.get("fix_r2_records")))
    log("fix r2:", json.dumps(G.get("fix_r2")))
    if bad:
        log("FAILING:", json.dumps(bad))
    fail = bool(bad) or bool(bad_h)
    log("GATES", "FAIL" if fail else "PASS")
    return 1 if fail else 0


if __name__ == "__main__":
    sys.exit(main())
