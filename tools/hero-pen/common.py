"""Shared helpers for the hero pen art pipeline (tools/hero-pen).

The snapping, curve fitting and channel preparation are imported from
tools/hero-drawing/trace_lines.py (read only, never modified); np_cv2.py stands in for
OpenCV there. Everything this pipeline reads is under tools/hero-pen/inputs/ or the public
photo assets/hero-fsae-track-2200.webp, so a build never reads releases/.
"""
import hashlib, json, math, os, sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]                       # portfolio-site
HD = ROOT / "tools" / "hero-drawing"
sys.path.insert(0, str(HD))
import trace_lines as TL                     # noqa: E402  (snap, fit_path, smooth_spline, fit_ellipse_prior, ...)

SRC = ROOT / "assets" / "hero-fsae-track-2200.webp"
INP = HERE / "inputs"
OUT = HERE / "out"
W, H = 2200, 1238
CW = 827.0                                    # one car width in src px (PEN_SPEC "cw")
MASK_ORIGIN = (880, 380)                      # dark mask origin (inputs/dark-mask-origin-880-380.png)

# Channel cache: the bilateral passes take minutes in NumPy, so the prepared channels are cached
# outside the repo. HERO_PEN_CACHE overrides the folder; the cache is keyed by the photo's SHA256.
CACHE = Path(os.environ.get("HERO_PEN_CACHE", Path(os.environ.get("TEMP", "/tmp")) / "hero-pen-cache"))


def sha256(p):
    return hashlib.sha256(Path(p).read_bytes()).hexdigest()


def photo_sha():
    return sha256(SRC)


def channels():
    """(rgb uint8 HxWx3, ch float32 4xHxW) exactly as trace_lines.load_channels() makes them."""
    CACHE.mkdir(parents=True, exist_ok=True)
    f = CACHE / ("channels-%s.npz" % photo_sha()[:16])
    if f.exists():
        z = np.load(f)
        return z["rgb"], z["ch"]
    rgb, ch = TL.load_channels()
    np.savez(f, rgb=rgb, ch=ch.astype(np.float32))
    return rgb, ch.astype(np.float32)


# ---------------------------------------------------------------- polyline helpers
def plen(p):
    p = np.asarray(p, float)
    return float(np.sum(np.hypot(*np.diff(p, axis=0).T))) if len(p) > 1 else 0.0


def resample(p, step=1.0):
    p = np.asarray(p, float)
    d = np.hypot(*np.diff(p, axis=0).T)
    s = np.concatenate([[0], np.cumsum(d)])
    if s[-1] < 1e-6:
        return p[:1].copy()
    n = max(1, int(math.ceil(s[-1] / step)))
    t = np.linspace(0, s[-1], n + 1)
    return np.stack([np.interp(t, s, p[:, 0]), np.interp(t, s, p[:, 1])], 1)


def sub(p, a, b):
    """Sub-range of a polyline by arc-length fraction a..b (same points, resampled at 0.5 px)."""
    q = resample(p, 0.5)
    n = len(q) - 1
    return q[int(round(a * n)): int(round(b * n)) + 1]


def signed_area(p):
    x, y = p[:, 0], p[:, 1]
    return 0.5 * float(np.sum(x * np.roll(y, -1) - np.roll(x, -1) * y))


def ccw(p):
    """Visually counter-clockwise on a y-down screen = negative shoelace area."""
    p = np.asarray(p, float)
    return p if signed_area(p) < 0 else p[::-1].copy()


def bez_dense(segs, step=0.5):
    out = []
    for c in segs:
        c = np.asarray(c, float)
        L = np.linalg.norm(np.diff(TL.bez(c, np.linspace(0, 1, 9)), axis=0), axis=1).sum()
        n = max(4, int(math.ceil(L / step)))
        q = TL.bez(c, np.linspace(0, 1, n + 1))
        out.append(q if not out else q[1:])
    return np.vstack(out)


def turn_corners(p, ang=60.0, k=None, reach=3.0):
    """Indices of turns sharper than `ang` degrees, measured over +-reach src px."""
    p = resample(p, 0.5)
    k = k or max(2, int(round(reach / 0.5)))
    out = []
    for i in range(k, len(p) - k):
        a = p[i] - p[i - k]
        b = p[i + k] - p[i]
        na, nb = np.hypot(*a), np.hypot(*b)
        if na < 1e-6 or nb < 1e-6:
            continue
        c = float(np.clip(np.dot(a, b) / na / nb, -1, 1))
        d = math.degrees(math.acos(c))
        if d > ang:
            out.append((d, i))
    keep = []
    for d, i in sorted(out, reverse=True):
        if all(abs(i - j) > 2 * k for j in keep):
            keep.append(i)
    return p, sorted(keep)


def load_json(p):
    return json.loads(Path(p).read_text(encoding="utf-8"))


def dump_json(p, obj, indent=1):
    Path(p).parent.mkdir(parents=True, exist_ok=True)
    def np_default(o):
        if hasattr(o, "item"):
            return o.item()
        if hasattr(o, "tolist"):
            return o.tolist()
        raise TypeError(type(o).__name__)
    Path(p).write_text(json.dumps(obj, indent=indent, default=np_default) + "\n", encoding="utf-8")
