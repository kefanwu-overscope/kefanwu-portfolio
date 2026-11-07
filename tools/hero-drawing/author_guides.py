"""Author guides.json: the curated stroke list for the hero line drawing.

Each stroke is assembled from measured edge chains (chains.py) and/or a few
hand-placed points (read off luminance probes of the photo), then written as a
sparse guide polyline or ellipse. Nothing here is final geometry: trace_lines.py
snaps every guide back onto the photo and fits the final curves.

Stroke fields: id, group (silhouette|structure|detail|ground), phase (draw-order
bucket: body, wheels, structure, driver, detail, ground; strokes are drawn in the
order they appear below), plus snapping options:
  r      search radius in px either side of the guide
  pol    +1/-1: the side to the left of travel must be brighter/darker
  mode   edge | valley (thin dark tube) | ridge (thin highlight)
  tol    RMS tolerance of the final smoothing spline (px)

usage: python author_guides.py   (rewrites guides.json next to this file)
"""
import hashlib, json
from pathlib import Path

import numpy as np

from chains import get_chains
from trace_lines import SRC

HERE = Path(__file__).resolve().parent
C = get_chains()
OUT = []


def nearest(cid, xy):
    c = C[cid]
    return int(np.argmin(np.hypot(c[:, 0] - xy[0], c[:, 1] - xy[1])))


def seg(cid, a, b):
    """Run of chain `cid` between the points nearest to a and b (in that order)."""
    i, j = nearest(cid, a), nearest(cid, b)
    c = C[cid]
    return c[i: j + 1] if i <= j else c[j: i + 1][::-1]


def pts(*p):
    return np.array(p, float)


def sparse(P, step):
    P = np.asarray(P, float)
    keep = [P[0]]
    for q in P[1:]:
        if np.hypot(*(q - keep[-1])) > 0.5:
            keep.append(q)
    P = np.array(keep)
    s = np.concatenate([[0], np.cumsum(np.hypot(*np.diff(P, axis=0).T))])
    n = max(2, int(round(s[-1] / step)) + 1)
    t = np.linspace(0, s[-1], n)
    Q = np.column_stack([np.interp(t, s, P[:, 0]), np.interp(t, s, P[:, 1])])
    return [[round(float(x) * 2) / 2, round(float(y) * 2) / 2] for x, y in Q]


def S(id, group, phase, *parts, step=8, **opt):
    P = np.vstack([np.asarray(p, float) for p in parts])
    if opt.get("corners"):
        g = [[float(x), float(y)] for x, y in P]
    else:
        g = sparse(P, step)
    OUT.append(dict(id=id, group=group, phase=phase, pts=g, **opt))


def E(id, group, phase, ellipse, **opt):
    OUT.append(dict(id=id, group=group, phase=phase, ellipse=list(ellipse), **opt))


def cubic(*ctrl, n=8):
    """Points on cubic Bezier segments given as p0, c1, c2, p1, c1, c2, p2, ... (a measured
    edge read off a zoomed crop of the photo)."""
    P = np.asarray(ctrl, float)
    t = np.linspace(0, 1, n)[:, None]
    out = []
    for k in range(0, len(P) - 1, 3):
        p0, p1, p2, p3 = P[k: k + 4]
        out.append((1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t ** 2 * p2 + t ** 3 * p3)
    return np.vstack([o if i == 0 else o[1:] for i, o in enumerate(out)])


def rounded_rect(x0, y0, x1, y1, r, n=6):
    """Closed outline of a rounded rectangle (clockwise from the top edge), n points per corner."""
    out = []
    for cx, cy, a0 in ((x1 - r, y0 + r, -90), (x1 - r, y1 - r, 0), (x0 + r, y1 - r, 90), (x0 + r, y0 + r, 180)):
        for k in range(n + 1):
            a = np.radians(a0 + 90 * k / n)
            out.append((cx + r * np.cos(a), cy + r * np.sin(a)))
    return np.array(out)


# =============================================================== BODY (silhouette)
# Car faces left: the nose is at the lower left, the rear wheel at the right.
TIP = (933, 795)
# 1 nose silhouette, drawn front to back: from where the nose meets its shadow, up the
#   nose face, round the tip, along the far blue-stripe edge, over the far front tyre's
#   stripe, then along the body top edge to the cockpit front
S("nose-outline", "silhouette", "body",
  seg(526, (955, 850), (931, 800)), seg(376, TIP, (1114, 671)), seg(384, (1126, 667), (1164, 656)),
  pts((1182, 648), (1220, 643), (1260, 640), (1300, 638), (1334, 636)),
  r=4, tol=0.8, lam=1.4, w=1.0)
# 2 crease: lower edge of the near blue stripe, tip -> rear of the nose
S("nose-crease", "silhouette", "body",
  seg(376, (943, 809), (1217, 715)), seg(425, (1222, 714), (1288, 689)), seg(394, (1296, 680), (1350, 665)),
  r=3, tol=0.9, lam=1.4, w=0.85)
# 3 rear edge of the nose bodywork (lit side panel against the dark cockpit)
S("nose-rear", "silhouette", "body", pts((1366, 700), (1369, 722), (1371, 744), (1367, 764)),
  r=3, pol=1, tol=0.6, step=6, w=0.75)
# 4 cockpit side top edge, nose to main hoop
S("cockpit-top", "silhouette", "body", pts((1371, 702), (1398, 697)), seg(430, (1408, 696), (1424, 694)),
  seg(389, (1426, 692), (1520, 666)), r=3, tol=0.8, lam=1.4, w=0.9)

# =============================================================== WHEELS (structure)
# near front wheel: outer silhouette (ground, right side, top, far side), the inner
# half of the sidewall face ellipse, and the rim
S("fw-outline", "structure", "wheels",
  pts((1448, 921), (1462, 906), (1472, 893), (1480, 880), (1487, 868), (1493, 857), (1497, 844),
      (1498, 828), (1497, 812), (1493, 798), (1486, 786),
      (1474, 775), (1459, 765), (1440, 756), (1413, 752), (1390, 756), (1368, 765), (1355, 772),
      (1351, 790), (1351, 820), (1354, 845), (1358, 864)),
  r=3, tol=0.75, lam=1.6, step=10, w=0.8)
E("fw-face", "structure", "wheels", (1445, 844, 50, 78, 5), r=5, minstrength=0.25, prior_w=0.25,
  fit=[90, 270], arc_pts=[(1480, 787), (1446, 921)], arc_dir=-1, w=0.6)
E("fw-rim", "structure", "wheels", (1447, 849, 39, 48, 3), r=5, minstrength=0.3, prior_w=0.15, w=0.6)
# near rear wheel
S("rw-outline", "structure", "wheels",
  pts((1729, 793), (1738, 781), (1745, 763), (1753, 748), (1757, 735), (1759, 720), (1757, 704),
      (1750, 694), (1738, 686), (1720, 679), (1700, 677), (1683, 678), (1670, 682), (1660, 690),
      (1652, 700), (1647, 710), (1643, 722), (1641, 735), (1641, 750), (1643, 764)),
  r=4, tol=0.9, lam=1.6, step=10, w=0.8)
E("rw-rim", "structure", "wheels", (1731, 744, 19, 44, 3), r=4, minstrength=0.3, prior_w=0.2, w=0.6)

# =============================================================== STRUCTURE (tubes as single lines)
# main roll hoop: far leg (from behind the helmet), arch, near leg / post down to the frame
S("hoop", "structure", "structure",
  pts((1410, 527), (1420, 503), (1431, 480), (1440, 455), (1454, 436), (1472, 429), (1489, 436),
      (1499, 454), (1504, 478), (1508, 510), (1510, 560), (1511, 620), (1513, 676)),
  r=6, mode="valley", lsig=3.5, lam=1.6, tol=1.0, step=12, w=0.75)
# second tube under the hoop arch (inverted V with the far leg)
S("hoop-diag", "structure", "structure", pts((1441, 489), (1460, 512), (1479, 536)),
  r=4, mode="valley", lsig=2.5, lam=2.0, tol=0.6, step=8, w=0.6)
# main hoop brace, diagonal back to the rear frame node
S("hoop-brace", "structure", "structure", pts((1514, 476), (1540, 527), (1566, 579), (1590, 630), (1607, 664)),
  r=5, mode="valley", lsig=2.5, lam=1.6, tol=0.8, step=12, w=0.65)
# rear frame: top rail and lower rail
S("rear-rail-top", "structure", "structure", pts((1526, 681), (1560, 680), (1595, 676), (1621, 672)),
  r=4, mode="valley", lsig=3.0, lam=2.0, tol=1.0, step=12, w=0.6)
S("rear-rail-low", "structure", "structure", pts((1494, 792), (1530, 781), (1567, 770), (1606, 767)),
  r=4, mode="valley", lsig=2.5, lam=2.0, tol=1.0, step=12, w=0.6)
# rear suspension (thin dark tubes, each ends where the tyre hides it): the diagonal from the
# top-rail node and the upper leg converge on the hidden upright like an A-arm; lower leg below
S("rear-toe", "structure", "structure", pts((1623, 672), (1638, 685), (1653, 698)),
  r=3, mode="valley", lsig=1.5, lam=2.0, tol=0.6, step=8, w=0.55)
S("rear-wb-upper", "structure", "structure", pts((1582, 705), (1615, 706), (1647, 708)),
  r=3, mode="valley", lsig=1.5, lam=2.0, tol=0.6, step=8, w=0.55)
S("rear-wb-lower", "structure", "structure", pts((1590, 731), (1616, 735), (1644, 739)),
  r=3, mode="valley", lsig=1.5, lam=2.0, tol=0.6, step=8, w=0.55)
# =============================================================== DRIVER
S("helmet", "silhouette", "driver",
  C[299], pts((1420, 530), (1408, 534), (1398, 540), (1390, 552), (1386, 566), (1384, 580),
              (1385, 596), (1389, 610)),
  r=3, tol=0.6, closed=True, step=7, w=1.0)
S("visor", "detail", "driver",
  pts((1387, 574), (1397, 576), (1415, 577), (1433, 577), (1439, 579), (1440, 585), (1436, 591),
      (1427, 596), (1409, 600), (1395, 599), (1387, 595)),
  r=3, tol=0.5, step=6)
S("shoulder-near", "silhouette", "driver", seg(347, (1361, 670), (1392, 623)), r=3, step=6, tol=0.7, w=0.8)
S("shoulder-far", "silhouette", "driver", seg(337, (1452, 617), (1503, 634)), r=3, step=6, tol=0.7, w=0.8)

# =============================================================== DETAIL
S("stripe-inner", "detail", "detail", seg(392, (1211, 700), (1146, 667)),
  r=3, step=10, tol=0.9, lam=1.4, w=0.45)

# =============================================================== GROUND
# ground contact: only the far (lower) boundary of each cast shadow, no closed shadow outlines
S("shadow-nose", "ground", "ground", seg(526, (918, 915), (1280, 866)), r=4, step=12, tol=1.2, lam=1.6)
S("shadow-front", "ground", "ground", seg(556, (1322, 922), (1436, 928)), r=4, step=12, tol=1.0, lam=1.6)
S("shadow-rear", "ground", "ground", seg(515, (1610, 792), (1733, 782)), r=4, step=12, tol=1.0, lam=1.6)
S("grass-left", "ground", "ground",
  pts((1000, 590), (1150, 583), (1300, 576), (1376, 573)),
  r=7, lam=3.0, step=40, tol=1.5, w=0.35)
S("grass-right", "ground", "ground",
  pts((1562, 549), (1650, 547), (1750, 543), (1850, 540), (1950, 534), (2060, 527)),
  r=7, lam=3.0, step=40, tol=1.5, w=0.35)

# =============================================================== ADDED 2026-10-29
# Three more real, high-contrast edges, read off zoomed crops of the 2200 px photo by the
# release verifier and checked by eye. Each has a given draw order "o" that slots it between
# the strokes above without renumbering them (trace_lines.py --only splices them in; the 27
# strokes above keep their bytes). Not added: the lower body contour (black on black shadow)
# and the front wishbones (2-3 px glints): not reliably visible.
# 219 side number plate: the white panel on the black side pod, including its lower-left edge
#   where the near front tyre occludes it (a polygon: corners kept)
S("plate-219", "detail", "driver",
  pts((1410.3, 707.0), (1496.2, 684.2), (1500.3, 748.3), (1454.2, 762.5), (1416.3, 751.7), (1410.3, 707.0)),
  corners=True, r=3, tol=0.5, lam=1.4, w=0.5, o=0.62, added="2026-10-29")
# far-side front tyre: its crown, dark against the grey asphalt above the nose stripe
S("fw-far-crown", "structure", "wheels",
  cubic((1124, 667), (1134, 655), (1147, 649), (1160, 648.5), (1168, 648.5), (1175, 650), (1180, 653)),
  step=6, r=3, tol=0.6, lam=1.4, w=0.8, o=0.36, added="2026-10-29")
# TSAL lamp on the main hoop: the orange lens in its black housing (a 36 x 15 px stadium)
S("tsal-lamp", "detail", "structure", rounded_rect(1448, 454, 1484, 469, 7),
  step=2, closed=True, r=1.5, tol=0.3, lam=2.0, gsmooth=0.1, spacing=1.0, prior=0.3, w=0.45, o=0.41,
  added="2026-10-29")

spec = {
    "source": "assets/hero-fsae-track-2200.webp",
    "source_sha256": hashlib.sha256(SRC.read_bytes()).hexdigest(),
    "debug_crops": {
        "car": [880, 380, 1820, 960, 1.5],
        "nose": [900, 600, 1240, 880, 2.8],
        "mid": [1200, 600, 1520, 900, 2.8],
        "driver": [1330, 400, 1640, 700, 2.8],
        "rear": [1480, 600, 1790, 830, 3.0],
        "front-wheel": [1320, 730, 1520, 950, 3.4],
    },
    "strokes": OUT,
}
(HERE / "guides.json").write_text(json.dumps(spec, indent=1), encoding="utf-8")
print(len(OUT), "strokes")
