"""Review renders of the hero pen art (PEN_SPEC 12.7, art half): the strokes over the photo
per region, coloured by tier, and the drawing alone. Supersampled raster in Python (PIL);
the browser render of the drawing alone at 1440 and 390 is review_page.cjs.

usage: python review.py [--strokes out/strokes.json] [--outdir DIR]
"""
import argparse, json, math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

from common import SRC, OUT

# review colours by tier (not the page colours): c contour, y tyre, a accent, n numeral,
# f form, d detail, h shade, g guide
TIER_COL = dict(c=(225, 25, 25), y=(225, 25, 25), a=(130, 0, 0), n=(210, 0, 140), f=(20, 95, 235), d=(0, 155, 85), h=(235, 135, 0), g=(120, 130, 150))
# page factors (PEN_SPEC section 7) for the "alone" renders
FACTOR = dict(g=0.36, c=0.95, y=1.05, a=1.40, n=0.80, f=0.62, d=0.42, h=0.30)
PAGE_COL = dict(g=(0xa9, 0xb1, 0xba), c=(0x11, 0x13, 0x16), y=(0x11, 0x13, 0x16), a=(0x11, 0x13, 0x16), n=(0x11, 0x13, 0x16),
                f=(0x2a, 0x30, 0x36), d=(0x50, 0x5b, 0x66), h=(0x7b, 0x84, 0x8d))

REGIONS = {
    "nose": (895, 625, 1370, 935, 2),
    "cockpit-driver": (1345, 590, 1540, 715, 4),
    "hoop-lens": (1390, 400, 1620, 560, 3),
    "sideplate-lettering": (1230, 640, 1515, 800, 3),
    "rear-frame": (1490, 560, 1680, 810, 3),
    "wheels-front": (1335, 735, 1515, 945, 3),
    "wheels-rear": (1620, 655, 1775, 820, 3),
    "shadow": (880, 760, 1760, 960, 2),
    "box-helmet": (1370, 520, 1560, 640, 4),
    "whole-car": (880, 395, 1790, 960, 2),
}


def load(p):
    d = json.loads(Path(p).read_text(encoding="utf-8"))
    return d["strokes"] if isinstance(d, dict) else d


def draw_overlay(strokes, box, sc, out, labels=True, fade=0.55, ss=3, cls="D", only=None):
    x0, y0, x1, y1 = box
    W, H = int((x1 - x0) * sc), int((y1 - y0) * sc)
    im = Image.open(SRC).convert("RGB").crop((x0, y0, x1, y1)).resize((W * ss, H * ss), Image.BICUBIC)
    im = Image.blend(im, Image.new("RGB", im.size, (255, 255, 255)), fade)
    d = ImageDraw.Draw(im)
    try:
        f = ImageFont.truetype("arial.ttf", 10 * ss)
    except OSError:
        f = ImageFont.load_default()
    lab = []
    for s in strokes:
        if cls not in s["classes"]:
            continue
        if only and not only(s):
            continue
        P = np.asarray(s["pts"], float)
        if len(P) < 2:
            continue
        if not ((P[:, 0] >= x0 - 5) & (P[:, 0] <= x1 + 5) & (P[:, 1] >= y0 - 5) & (P[:, 1] <= y1 + 5)).any():
            continue
        q = [((x - x0) * sc * ss, (y - y0) * sc * ss) for x, y in P]
        w = max(1, int(round((1.6 if s["tier"] in "cya" else 1.1 if s["tier"] in "nf" else 0.9) * ss)))
        d.line(q, fill=TIER_COL[s["tier"]], width=w, joint="curve")
        # start dot
        d.ellipse([q[0][0] - 1.6 * ss, q[0][1] - 1.6 * ss, q[0][0] + 1.6 * ss, q[0][1] + 1.6 * ss], fill=TIER_COL[s["tier"]])
        if labels:
            m = q[len(q) // 2]
            lab.append((m, s.get("order", ""), TIER_COL[s["tier"]]))
    for m, t, col in lab:
        d.text((m[0] + 2 * ss, m[1] - 11 * ss), str(t), fill=col, font=f)
    im = im.resize((W, H), Image.LANCZOS)
    im.save(out)


def draw_alone(strokes, cls, css_per_src, dpr, out, car_box=(880, 400, 1790, 960), ss=3):
    """The drawing alone on white, at the page's CSS scale for a viewport class, with the
    spec weights (w1 from the viewport width), the device-pixel floor (mix to white), and
    FORM/DETAIL under darker ink (drawn first here; same result as destination-over)."""
    x0, y0, x1, y1 = car_box
    k = css_per_src * dpr * ss
    W, H = int((x1 - x0) * k), int((y1 - y0) * k)
    vw = {"D": 1440, "T": 768, "P": 390}[cls]
    w1 = min(2.1, max(1.4, 1.4 + (vw - 390) * 0.7 / 1050))
    im = Image.new("RGB", (W, H), (255, 255, 255))
    d = ImageDraw.Draw(im)
    rank = {"g": 0, "h": 1, "d": 2, "f": 3, "n": 4, "c": 5, "y": 5, "a": 6}
    for s in sorted([s for s in strokes if cls in s["classes"]], key=lambda s: rank[s["tier"]]):
        P = np.asarray(s["pts"], float)
        wd = FACTOR[s["tier"]] * w1 * dpr
        col = PAGE_COL[s["tier"]]
        if wd < 1:
            a = 1 - wd
            col = tuple(int(round(c + (255 - c) * a)) for c in col)
            wd = 1.0
        q = [((x - x0) * k, (y - y0) * k) for x, y in P]
        d.line(q, fill=col, width=max(1, int(round(wd * ss))), joint="curve")
    im = im.resize((W // ss, H // ss), Image.LANCZOS)
    im.save(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--strokes", default=str(OUT / "strokes.json"))
    ap.add_argument("--outdir", required=True)
    ap.add_argument("--cls", default="D")
    ap.add_argument("--regions", default="")
    ap.add_argument("--scale", type=float, default=0, help="override every region's scale (e.g. 2 for the 2x review set)")
    ap.add_argument("--accents", action="store_true", help="also draw the P5 accents (revision 5: left out by default, as the engine's build drops them)")
    a = ap.parse_args()
    S = load(a.strokes)
    if not a.accents:
        S = [s for s in S if s.get("kind") != "accent"]
    od = Path(a.outdir)
    od.mkdir(parents=True, exist_ok=True)
    regs = [r for r in a.regions.split(",") if r] or list(REGIONS)
    for r in regs:
        x0, y0, x1, y1, sc = REGIONS[r]
        draw_overlay(S, (x0, y0, x1, y1), a.scale or sc, od / ("over-%s-%s.png" % (r, a.cls)), cls=a.cls, labels=False)


if __name__ == "__main__":
    main()
