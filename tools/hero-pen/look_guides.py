"""Authoring aid: inventory guides (inputs/inventory-guides.json) drawn over a zoomed crop,
labelled with their ids. usage: python look_guides.py X0 Y0 X1 Y1 SCALE OUT.png [--ids a,b] [--gamma G]"""
import argparse, json, math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

from common import SRC, INP

PAL = [(255, 40, 40), (40, 220, 40), (40, 120, 255), (255, 200, 0), (255, 0, 255), (0, 230, 230), (255, 128, 0), (160, 80, 255)]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("box", nargs=4, type=float)
    ap.add_argument("scale", type=float)
    ap.add_argument("out")
    ap.add_argument("--ids")
    ap.add_argument("--gamma", type=float, default=1.0)
    ap.add_argument("--fade", type=float, default=0.0)
    a = ap.parse_args()
    x0, y0, x1, y1 = a.box
    sc = a.scale
    g = json.loads((INP / "inventory-guides.json").read_text())["features"]
    im = Image.open(SRC).convert("RGB").crop((int(x0), int(y0), int(x1), int(y1)))
    arr = np.asarray(im).astype(float) / 255
    if a.gamma != 1.0:
        arr = arr ** a.gamma
    if a.fade:
        arr = arr * (1 - a.fade) + a.fade
    im = Image.fromarray((255 * arr).astype(np.uint8)).resize((int((x1 - x0) * sc), int((y1 - y0) * sc)), Image.BICUBIC)
    d = ImageDraw.Draw(im)
    try:
        f = ImageFont.truetype("arial.ttf", 12)
    except OSError:
        f = ImageFont.load_default()
    ids = set(a.ids.split(",")) if a.ids else None
    k = 0
    for fid, ft in g.items():
        if ids and fid not in ids:
            continue
        polys = ft.get("guides") or []
        hit = any(x0 <= x <= x1 and y0 <= y <= y1 for p in polys for x, y in p)
        if not hit:
            continue
        col = PAL[k % len(PAL)]
        k += 1
        for p in polys:
            pts = [((x - x0) * sc, (y - y0) * sc) for x, y in p]
            if len(pts) > 1:
                d.line(pts, fill=col, width=2)
            for q in pts:
                d.ellipse([q[0] - 2, q[1] - 2, q[0] + 2, q[1] + 2], outline=col)
        p = polys[0]
        q = ((p[0][0] - x0) * sc, (p[0][1] - y0) * sc)
        d.text((q[0] + 3, q[1] - 13), fid, fill=col, font=f)
    im.save(a.out)


if __name__ == "__main__":
    main()
