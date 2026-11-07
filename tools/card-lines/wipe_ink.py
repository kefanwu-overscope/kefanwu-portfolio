"""Wipe pacing data for the homepage card drawings (card-drawing-20261027.js, LINES table).

The card wipe reveals a drawing through a soft-edged linear-gradient mask (100deg, white-home-20261011.css):
a line pixel at card position (x, y) (in card widths; y down, the 640:427 box) is half revealed once the
edge's centre on the middle row has passed

    q = x + tan(10deg) * (y - BOX_H / 2)

For each drawing this prints, as card-width shares:
  left, right   the drawing's horizontal extent (alpha > 12 in either file, the 600 w or the 1200 w);
                the wipe's edge reaches `left` at 10 % and `right` at 90 % of the wipe
  q10, q90      the 10 % and 90 % quantiles of q over the ink (pixels darker than 40/255 when the 1200 w
                drawing is composited on white); the edge passes them at 18 % and 82 % of the wipe, so
                the ink appears at an even pace (10 % of it per 48 ms of a 600 ms wipe) whatever the
                drawing's shape, instead of bunching where most of its lines are

usage (repository root, Python with numpy and Pillow):
    python tools/card-lines/wipe_ink.py            -> the LINES rows' last four values
    python tools/card-lines/wipe_ink.py --json     -> the same as JSON
"""
import json
import math
import sys

import numpy as np
from PIL import Image

from common import KEYS, OUT_DIR, SKIP

BOX_H = 427 / 640
TAN = math.tan(math.radians(10))


def rgba(path):
    return np.asarray(Image.open(path).convert('RGBA')).astype(float)


def extent(key):
    """Horizontal extent (alpha > 12) of the drawing in either file, as a share of the width."""
    lo, hi = 1.0, 0.0
    for name in (f'{key}.webp', f'{key}-600.webp'):
        a = rgba(OUT_DIR / name)
        cols = np.nonzero((a[..., 3] > 12).any(axis=0))[0]
        w = a.shape[1]
        lo, hi = min(lo, cols[0] / w), max(hi, (cols[-1] + 1) / w)
    return lo, hi


def ink_quantiles(key):
    a = rgba(OUT_DIR / f'{key}.webp')
    h, w = a.shape[:2]
    dark = a[..., 3] / 255 * (255 - a[..., :3].mean(axis=2))   # darkness over white
    ys, xs = np.nonzero(dark > 40)
    s = 1.0 / w                                                    # object-fit: contain, full width
    oy = (BOX_H - h * s) / 2
    q = (xs + 0.5) * s + TAN * ((ys + 0.5) * s + oy - BOX_H / 2)
    return float(np.quantile(q, 0.10)), float(np.quantile(q, 0.90))


def main():
    rows = {}
    for key in KEYS:
        if key in SKIP:
            continue
        left, right = extent(key)
        q10, q90 = ink_quantiles(key)
        rows[key] = [round(left, 3), round(right, 3), round(q10, 3), round(q90, 3)]
    if '--json' in sys.argv:
        print(json.dumps(rows, indent=1))
    else:
        for key, r in rows.items():
            print(f'    {key}: [..., {r[0]}, {r[1]}, {r[2]}, {r[3]}],')


if __name__ == '__main__':
    main()
