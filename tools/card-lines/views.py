"""Evidence views for the card line drawings (evidence folder only, never the repo).

usage: python tools/card-lines/views.py [key,key,...]   per-project views + 16-up sheets
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage as ndi

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import REPO, EVIDENCE, OUT_DIR, KEYS, COVER_1200, SKIP  # noqa: E402

VIEWS = EVIDENCE / 'registration'
QA_RED = np.array([226, 38, 43], np.float32)   # QA only: lines recoloured so they read on dark parts


def font(size):
    for name in ('arial.ttf', 'segoeui.ttf', 'DejaVuSans.ttf'):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def cover(key):
    return np.asarray(Image.open(REPO / COVER_1200[key]).convert('RGB')).astype(np.float32)


def lines(key, width=1200):
    name = f'{key}.webp' if width == 1200 else f'{key}-{width}.webp'
    return np.asarray(Image.open(OUT_DIR / name).convert('RGBA')).astype(np.float32)


def over(base, rgba, colour=None, strength=1.0):
    a = rgba[..., 3:4] / 255 * strength
    ink = rgba[..., :3] if colour is None else colour
    return base * (1 - a) + ink * a


def to_img(array):
    return Image.fromarray(np.clip(np.round(array), 0, 255).astype(np.uint8))


def densest(rgba, w=150, h=100):
    a = rgba[..., 3] / 255
    window = ndi.uniform_filter(a, (h, w))
    y, x = np.unravel_index(np.argmax(window), window.shape)
    y0 = int(np.clip(y - h // 2, 0, a.shape[0] - h)); x0 = int(np.clip(x - w // 2, 0, a.shape[1] - w))
    return x0, y0, w, h


def per_project(key):
    out = VIEWS / key
    out.mkdir(parents=True, exist_ok=True)
    c, l = cover(key), lines(key)
    white = np.full_like(c, 255)
    to_img(over(white, l)).save(out / 'lines-on-white-1200.png')
    to_img(over(c, l)).save(out / 'lines-over-cover-1200.png')
    to_img(over(c, l, QA_RED)).save(out / 'qa-red-over-cover-1200.png')
    x0, y0, w, h = densest(l)
    crops = [c, over(c, l, QA_RED), over(white, l)]
    tiles = [to_img(arr[y0:y0 + h, x0:x0 + w]).resize((w * 4, h * 4), Image.NEAREST) for arr in crops]
    sheet = Image.new('RGB', (w * 4 * 3 + 16, h * 4 + 30), 'white')
    d = ImageDraw.Draw(sheet)
    for i, (tile, label) in enumerate(zip(tiles, ['cover 1200 w', 'cover + lines (QA red)', 'lines alone'])):
        sheet.paste(tile, (i * (w * 4 + 8), 30))
        d.text((i * (w * 4 + 8) + 4, 6), f'{label}  x{x0}-{x0 + w} y{y0}-{y0 + h}  (4x nearest)', fill=(0, 0, 0), font=font(15))
    sheet.save(out / 'zoom-4x.png')
    # QA: each line pixel coloured by its distance to the nearest cover edge
    # (same edge map as lines.py registration): <=1 px green, <=3 px amber, >3 px red.
    lum = 0.299 * c[..., 0] + 0.587 * c[..., 1] + 0.114 * c[..., 2]
    smooth = ndi.gaussian_filter(lum, 0.6)
    edges = np.hypot(ndi.sobel(smooth, 1), ndi.sobel(smooth, 0)) / 8.0 > 6.0
    dist = ndi.distance_transform_edt(~edges)
    grey = np.repeat((lum * .35 + 255 * .65)[..., None], 3, -1)
    on = l[..., 3] >= 128
    colour = np.where((dist <= 1)[..., None], [0, 160, 80], np.where((dist <= 3)[..., None], [240, 160, 0], [220, 30, 30]))
    grey[on] = colour[on]
    to_img(grey).save(out / 'qa-distance-1200.png')
    l600 = lines(key, 600)
    to_img(over(np.full((400, 600, 3), 255, np.float32), l600)).save(out / 'lines-on-white-600.png')


def sixteen(kind):
    W, H, pad, cols = 600, 400, 26, 4
    sheet = Image.new('RGB', (cols * W, 4 * (H + pad)), 'white')
    d = ImageDraw.Draw(sheet)
    f = font(16)
    for i, key in enumerate(KEYS):
        x, y = (i % cols) * W, (i // cols) * (H + pad)
        if key in SKIP:
            tile = Image.open(REPO / COVER_1200[key]).convert('RGB').resize((W, H), Image.LANCZOS)
            tile = Image.blend(tile, Image.new('RGB', (W, H), 'white'), .7)
            sheet.paste(tile, (x, y + pad))
            d.text((x + 20, y + pad + H // 2 - 10), 'Not traced: scientific CFD image', fill=(80, 91, 102), font=f)
        else:
            c = cover(key)
            l = lines(key)
            arr = over(np.full_like(c, 255), l) if kind == 'lines' else over(c, l)
            sheet.paste(to_img(arr).resize((W, H), Image.LANCZOS), (x, y + pad))
        d.text((x + 6, y + 5), f'{i + 1:02d} {key}', fill=(17, 19, 22), font=f)
    for i in range(1, cols):
        d.line([(i * W, 0), (i * W, sheet.height)], fill=(225, 228, 232))
    for j in range(1, 4):
        d.line([(0, j * (H + pad)), (sheet.width, j * (H + pad))], fill=(225, 228, 232))
    sheet.save(EVIDENCE / f'sheet-16-{kind}.png')


if __name__ == '__main__':
    keys = sys.argv[1].split(',') if len(sys.argv) > 1 else [k for k in KEYS if k not in SKIP]
    for key in keys:
        per_project(key)
    if len(sys.argv) <= 1:
        sixteen('lines'); sixteen('over-cover')
