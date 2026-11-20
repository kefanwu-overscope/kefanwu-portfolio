"""Authoring aid: a zoomed crop of the hero photo with source-px rulers, optionally with
polylines drawn over it, so guide coordinates can be read off and checked by eye.

usage: python look.py X0 Y0 X1 Y1 SCALE OUT.png [--gamma G] [--strokes strokes.json] [--ids a,b]
"""
import argparse, json, math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

from common import SRC


def ruler(im, x0, y0, sc, step=10, label=50):
    d = ImageDraw.Draw(im)
    w, h = im.size
    try:
        f = ImageFont.truetype("arial.ttf", 11)
    except OSError:
        f = ImageFont.load_default()
    for X in range(int(math.ceil(x0 / step) * step), int(x0 + w / sc) + 1, step):
        px = (X - x0) * sc
        big = X % label == 0
        d.line([(px, 0), (px, 10 if big else 5)], fill=(255, 0, 0), width=1)
        d.line([(px, h - (10 if big else 5)), (px, h)], fill=(255, 0, 0), width=1)
        if big:
            d.text((px + 2, 10), str(X), fill=(255, 0, 0), font=f)
    for Y in range(int(math.ceil(y0 / step) * step), int(y0 + h / sc) + 1, step):
        py = (Y - y0) * sc
        big = Y % label == 0
        d.line([(0, py), (10 if big else 5, py)], fill=(255, 0, 0), width=1)
        d.line([(w - (10 if big else 5), py), (w, py)], fill=(255, 0, 0), width=1)
        if big:
            d.text((12, py + 1), str(Y), fill=(255, 0, 0), font=f)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("box", nargs=4, type=float)
    ap.add_argument("scale", type=float)
    ap.add_argument("out")
    ap.add_argument("--gamma", type=float, default=1.0)
    ap.add_argument("--polys", help="json file: list of {pts:[[x,y]..], color:[r,g,b]}")
    ap.add_argument("--grid", type=int, default=0)
    a = ap.parse_args()
    x0, y0, x1, y1 = a.box
    sc = a.scale
    im = Image.open(SRC).convert("RGB").crop((int(x0), int(y0), int(x1), int(y1)))
    if a.gamma != 1.0:
        arr = np.asarray(im).astype(float) / 255
        im = Image.fromarray((255 * arr ** a.gamma).astype(np.uint8))
    im = im.resize((int((x1 - x0) * sc), int((y1 - y0) * sc)), Image.LANCZOS if sc < 1 else Image.BICUBIC)
    d = ImageDraw.Draw(im)
    if a.grid:
        for X in range(int(math.ceil(x0 / a.grid) * a.grid), int(x1) + 1, a.grid):
            d.line([((X - x0) * sc, 0), ((X - x0) * sc, im.size[1])], fill=(255, 0, 0) if X % 50 == 0 else (255, 160, 160), width=1)
        for Y in range(int(math.ceil(y0 / a.grid) * a.grid), int(y1) + 1, a.grid):
            d.line([(0, (Y - y0) * sc), (im.size[0], (Y - y0) * sc)], fill=(255, 0, 0) if Y % 50 == 0 else (255, 160, 160), width=1)
    if a.polys:
        for p in json.loads(Path(a.polys).read_text()):
            pts = [((x - x0) * sc, (y - y0) * sc) for x, y in p["pts"]]
            if len(pts) > 1:
                d.line(pts, fill=tuple(p.get("color", (0, 255, 0))), width=p.get("w", 1))
    ruler(im, x0, y0, sc)
    im.save(a.out)


if __name__ == "__main__":
    main()
