"""Authoring aid: detect edge chains in the hero photo and print/label them.

The SVG is NOT made from these chains directly. They are a measuring tool: an
author looks at the labelled overlay, picks the chain IDs that lie on a feature,
and `--guide` prints those chains as one ordered, sparse polyline that can be
pasted into guides.json. trace.py then snaps every guide onto the photo again.

usage:
  python chains.py --overlay OUTDIR x0 y0 x1 y1 scale     # labelled crop
  python chains.py --guide ID ID ID ... [--step 14]       # merged guide polyline

Detecting the chains needs OpenCV and scikit-image. Once they are cached (system temp
folder), author_guides.py also runs without them (cv2 then comes from trace_lines.py's
fallback and only the cache is read).
"""
import argparse, json, sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from trace_lines import load_channels, H, W, cv2  # noqa: E402

import tempfile
CACHE = Path(tempfile.gettempdir()) / "hero-drawing-chains-cache.npz"


def detect(ch, lo=4, hi=10, sigma=1.0):
    gxx = np.zeros((H, W), np.float32); gyy = np.zeros_like(gxx); gxy = np.zeros_like(gxx)
    for c in ch:
        c = cv2.GaussianBlur(c, (0, 0), sigma)
        gx = cv2.Sobel(c, cv2.CV_32F, 1, 0, ksize=3) / 8
        gy = cv2.Sobel(c, cv2.CV_32F, 0, 1, ksize=3) / 8
        gxx += gx * gx; gyy += gy * gy; gxy += gx * gy
    lam = 0.5 * (gxx + gyy + np.sqrt((gxx - gyy) ** 2 + 4 * gxy ** 2))
    th = 0.5 * np.arctan2(2 * gxy, gxx - gyy)
    mag = np.sqrt(lam)
    dx = np.clip(mag * np.cos(th) * 40, -32000, 32000).astype(np.int16)
    dy = np.clip(mag * np.sin(th) * 40, -32000, 32000).astype(np.int16)
    e = cv2.Canny(dx, dy, lo * 40, hi * 40, L2gradient=True)
    return e > 0, mag


def link(edge, minlen=12):
    from skimage.morphology import skeletonize
    sk = skeletonize(edge)
    k = np.ones((3, 3), np.uint8)
    nb = cv2.filter2D(sk.astype(np.uint8), -1, k) - sk.astype(np.uint8)
    junction = sk & (nb >= 3)
    jd = cv2.dilate(junction.astype(np.uint8), k) > 0
    branches = sk & ~jd
    n, lab = cv2.connectedComponents(branches.astype(np.uint8), connectivity=8)
    chains = []
    ys, xs = np.nonzero(lab)
    order = np.argsort(lab[ys, xs])
    ys, xs = ys[order], xs[order]
    labs = lab[ys, xs]
    bounds = np.searchsorted(labs, np.arange(1, n + 1))
    for i in range(1, n):
        a, b = bounds[i - 1], bounds[i]
        pts = list(zip(xs[a:b].tolist(), ys[a:b].tolist()))
        if len(pts) < minlen:
            continue
        chains.append(walk(pts))
    return chains


def walk(pts):
    s = set(pts)
    def nbrs(p):
        x, y = p
        return [(x + dx, y + dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1) if (dx or dy) and (x + dx, y + dy) in s]
    ends = [p for p in pts if len(nbrs(p)) <= 1]
    start = ends[0] if ends else pts[0]
    out = [start]; seen = {start}
    cur = start
    while True:
        nx = [q for q in nbrs(cur) if q not in seen]
        if not nx:
            break
        nx.sort(key=lambda q: abs(q[0] - cur[0]) + abs(q[1] - cur[1]))
        cur = nx[0]; out.append(cur); seen.add(cur)
    return np.array(out, float)


def get_chains():
    if CACHE.exists():
        z = np.load(CACHE, allow_pickle=True)
        return list(z["chains"])
    _, ch = load_channels()
    edge, _ = detect(ch)
    chains = link(edge)
    np.savez_compressed(CACHE, chains=np.array(chains, dtype=object))
    return chains


def overlay(outdir, x0, y0, x1, y1, sc):
    from PIL import Image
    from trace_lines import SRC
    rgb = np.array(Image.open(SRC).convert("RGB"))
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)
    lab[:, :, 0] = cv2.createCLAHE(4.0, (32, 18)).apply(lab[:, :, 0])
    base = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)[y0:y1, x0:x1]
    im = cv2.resize(base, None, fx=sc, fy=sc, interpolation=cv2.INTER_CUBIC)
    im = (im * 0.45 + 255 * 0.25).astype(np.uint8)
    rng = np.random.default_rng(3)
    chains = get_chains()
    for i, c in enumerate(chains):
        inside = (c[:, 0] >= x0) & (c[:, 0] < x1) & (c[:, 1] >= y0) & (c[:, 1] < y1)
        if inside.sum() < 6:
            continue
        col = tuple(int(v) for v in rng.integers(40, 255, 3))
        P = np.round((c - [x0, y0]) * sc * 4).astype(np.int32)
        cv2.polylines(im, [P], False, col, 2, cv2.LINE_AA, shift=2)
        m = c[np.nonzero(inside)[0][inside.sum() // 2]]
        cv2.putText(im, str(i), (int((m[0] - x0) * sc) + 3, int((m[1] - y0) * sc) - 3),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.36, (0, 0, 0), 2, cv2.LINE_AA)
        cv2.putText(im, str(i), (int((m[0] - x0) * sc) + 3, int((m[1] - y0) * sc) - 3),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.36, col, 1, cv2.LINE_AA)
    Path(outdir).mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(Path(outdir) / f"chains_{x0}_{y0}.png"), im)


def guide(ids, step):
    chains = get_chains()
    parts = [chains[i] for i in ids]
    out = parts[0]
    if len(parts) > 1 and np.linalg.norm(parts[1] - out[0], axis=1).min() < np.linalg.norm(parts[1] - out[-1], axis=1).min():
        out = out[::-1]
    for p in parts[1:]:
        if np.linalg.norm(p[-1] - out[-1]) < np.linalg.norm(p[0] - out[-1]):
            p = p[::-1]
        out = np.vstack([out, p])
    seg = np.linalg.norm(np.diff(out, axis=0), axis=1)
    s = np.concatenate([[0], np.cumsum(seg)])
    t = np.linspace(0, s[-1], max(2, int(s[-1] / step) + 1))
    P = np.column_stack([np.interp(t, s, out[:, 0]), np.interp(t, s, out[:, 1])])
    print(json.dumps([[round(x, 1), round(y, 1)] for x, y in P]))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--overlay", nargs=6)
    ap.add_argument("--guide", nargs="+", type=int)
    ap.add_argument("--step", type=float, default=14)
    a = ap.parse_args()
    if a.overlay:
        o = a.overlay
        overlay(o[0], int(o[1]), int(o[2]), int(o[3]), int(o[4]), float(o[5]))
    if a.guide:
        guide(a.guide, a.step)
