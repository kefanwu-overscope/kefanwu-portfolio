"""Card line drawings from the inspector G-buffer (render.js) -> transparent WebP.

usage: python tools/card-lines/lines.py [key,key,...]

Line classes, found between 4-neighbour pixel pairs of the supersampled
G-buffer (ss x the 1200 w cover):
  silhouette  model against background                         #111316
  contour     depth step (occlusion), within or between parts   #111316
  seam        two parts meeting without a depth step            #505b66
  crease      fold of >= crease_deg on one part                 #505b66
A step is a depth jump whose second differences on both sides are larger
than step_px output pixels (in world units) with opposite signs; a fold
changes slope, not depth, so it never reads as a step.

Each class is a band of the two pixels around its boundary; coverage comes
from the Euclidean distance to the band, so the line is centred on the
boundary with the stated width in output pixels. The supersampled ink is
box-averaged (premultiplied) to each output width, which keeps the exact
pixel registration of the cover at that width.
"""
import hashlib
import json
import re
import sys
import time
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import REPO, EVIDENCE, OUT_DIR, OUT_DIR_REL, KEYS, COVER_1200, COVER_1800, SKIP, INK_OUTLINE, INK_CREASE, INK_GUIDE  # noqa: E402

HERE = Path(__file__).resolve().parent
SETTINGS = json.loads((HERE / 'settings.json').read_text(encoding='utf-8'))
RENDER = EVIDENCE / 'work' / 'render'

DEFAULTS = {
    'widths': [1200, 600],
    'crease_deg': 30.0,
    'step_px': 1.0,            # depth step threshold, output pixels at 1200 w (world units)
    'line_px': {'silhouette': 1.5, 'contour': 1.5, 'seam': 0.75, 'crease': 0.75, 'through': 0.75},
    'min_px': {'silhouette': 0, 'contour': 6, 'seam': 6, 'crease': 8, 'through': 8},   # drop components shorter than this (output px at 1200 w)
    'seam_as': 'seam',         # 'seam' (grey) or 'contour' (dark) for parts meeting without a step
    'line_px_small': {'silhouette': 1.25, 'contour': 1.0, 'seam': 0.6, 'crease': 0.6, 'through': 0.6},   # widths below 1200 w, in their own pixels
    'alpha_levels': 32,        # near-lossless: coverage stored in 32 steps (<= 4/255 error)
    'quiet': [],               # part-name patterns whose own depth steps are drawn as thin folds
    'plain': [],               # part-name patterns drawn by outline and seams only
}


def settings_for(key):
    merged = json.loads(json.dumps(DEFAULTS))
    for source in (SETTINGS.get('defaults', {}), SETTINGS.get('projects', {}).get(key, {})):
        for name, value in source.items():
            if isinstance(value, dict) and isinstance(merged.get(name), dict):
                merged[name].update(value)
            else:
                merged[name] = value
    return merged


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def load(key, layer=''):
    folder = RENDER / key
    meta = json.loads((folder / 'meta.json').read_text(encoding='utf-8'))
    if layer:
        meta = {**meta, **meta['glassLayer']}
    width, height = meta['width'], meta['height']
    prefix = f'gbuffer-{layer}-' if layer else 'gbuffer-'
    a = np.fromfile(folder / f'{prefix}normal.rgba', np.uint8).reshape(height, width, 4)[::-1]
    b = np.fromfile(folder / f'{prefix}id.rgba', np.uint8).reshape(height, width, 4)[::-1]
    ids = (b[..., 0].astype(np.int32) << 8) | b[..., 1]
    t = (b[..., 2].astype(np.int64) << 16) | (b[..., 3].astype(np.int64) << 8) | a[..., 3]
    lo, hi = meta['depthRange']
    z = (lo + t.astype(np.float64) / 16777215.0 * (hi - lo)).astype(np.float32)
    n = a[..., :3].astype(np.float32) / 255.0 * 2.0 - 1.0
    n /= np.maximum(np.linalg.norm(n, axis=-1, keepdims=True), 1e-6)
    return meta, ids, z, n


def classify(ids, z, n, step, cos_t, quiet_lut, plain_lut):
    """Boolean pair masks for horizontal (axis 1) and vertical (axis 0) neighbours.

    quiet parts: their own depth steps (dense ribs, threads, treads) are drawn as
    thin folds. plain parts: only their outline and seams with other parts.
    """
    out = {}
    for axis in (1, 0):
        I, Z, N = (ids, z, n) if axis == 1 else (ids.T, z.T, n.transpose(1, 0, 2))
        qi, ri = I[:, :-1], I[:, 1:]
        mq, mr = qi > 0, ri > 0
        both = mq & mr
        zq, zr = Z[:, :-1], Z[:, 1:]
        pi = np.zeros_like(qi); pi[:, 1:] = I[:, :-2]
        si = np.zeros_like(ri); si[:, :-1] = I[:, 2:]
        zp = np.zeros_like(zq); zp[:, 1:] = Z[:, :-2]
        zs = np.zeros_like(zr); zs[:, :-1] = Z[:, 2:]
        have_q, have_r = (pi == qi) & mq, (si == ri) & mr
        d2q = zr - 2 * zq + zp
        d2r = zs - 2 * zr + zq
        big_q, big_r = np.abs(d2q) > step, np.abs(d2r) > step
        step_mask = np.where(have_q & have_r, big_q & big_r & (np.sign(d2q) != np.sign(d2r)),
                             np.where(have_q, big_q, np.where(have_r, big_r, np.abs(zr - zq) > step)))
        step_mask &= both
        change = both & (qi != ri)
        dot = (N[:, :-1] * N[:, 1:]).sum(-1)
        same = both & ~change
        quiet, plain = same & quiet_lut[qi], same & plain_lut[qi]
        pairs = {
            'silhouette': mq != mr,
            'contour': step_mask & ~quiet & ~plain,
            'seam': change & ~step_mask,
            'crease': ((same & ~step_mask & (dot < cos_t)) | (step_mask & quiet)) & ~plain,
        }
        out[axis] = pairs
    return out


def bands(pairs, shape):
    """Mark both pixels of every boundary pair: a 2-pixel band centred on it."""
    result = {}
    for name in pairs[1]:
        band = np.zeros(shape, bool)
        h = pairs[1][name]
        band[:, :-1] |= h; band[:, 1:] |= h
        v = pairs[0][name].T
        band[:-1, :] |= v; band[1:, :] |= v
        result[name] = band
    return result


def drop_small(band, min_pixels):
    if min_pixels <= 0 or not band.any():
        return band, 0
    labels, count = ndi.label(band, structure=np.ones((3, 3), bool))
    sizes = np.bincount(labels.ravel())
    keep = sizes >= min_pixels
    keep[0] = False
    return keep[labels], int((~keep[1:]).sum())


def coverage(distance, width_hi):
    """Pixel coverage of a line of width_hi (hi-res px) centred on the band."""
    return np.clip(width_hi / 2.0 - distance, 0.0, 1.0).astype(np.float32)


def downsample(array, factor):
    h, w = array.shape[:2]
    return array.reshape(h // factor, factor, w // factor, factor, *array.shape[2:]).mean(axis=(1, 3))


def draw(key):
    started = time.time()
    cfg = settings_for(key)
    meta, ids, z, n = load(key)
    H, W = ids.shape
    ss = meta['ss']                       # hi-res pixels per 1200 w pixel
    unit = meta['unitsPerPixel']          # world units per hi-res pixel
    step = cfg['step_px'] * ss * unit
    luts = []
    for name in ('quiet', 'plain'):
        lut = np.zeros(max(int(ids.max()), len(meta['objects'])) + 1, bool)
        for obj in meta['objects']:
            if obj['id'] < lut.size and any(re.search(pattern, obj['name']) for pattern in cfg.get(name, [])):
                lut[obj['id']] = True
        luts.append(lut)
    pairs = classify(ids, z, n, step, np.cos(np.radians(cfg['crease_deg'])), *luts)
    raw = bands(pairs, ids.shape)
    if meta.get('glassLayer'):
        # Clear parts: the main layer was drawn without them (the cover shows
        # what is behind them); their own edges come from a layer of their own.
        # Every former silhouette is now an inner edge; the outline is that of
        # both layers together.
        _, g_ids, g_z, g_n = load(key, 'glass')
        g_raw = bands(classify(g_ids, g_z, g_n, step, np.cos(np.radians(cfg['crease_deg'])), *luts), ids.shape)
        # What the cover shows through a clear part is refracted and softened
        # there, so it is drawn as a light guide line (#c3c8ce), never as ink.
        behind = (g_ids > 0) & ((ids == 0) | (z > g_z))
        behind = ndi.binary_dilation(behind, iterations=1)
        raw['through'] = np.zeros_like(behind)
        for name in ('silhouette', 'contour', 'seam', 'crease'):
            raw['through'] |= raw[name] & behind
            raw[name] &= ~behind
        raw['contour'] |= raw['silhouette'] | g_raw['silhouette'] | g_raw['contour']
        raw['seam'] |= g_raw['seam']; raw['crease'] |= g_raw['crease']
        both = (ids > 0) | (g_ids > 0)
        edge_h, edge_v = both[:, :-1] != both[:, 1:], both[:-1, :] != both[1:, :]
        raw['silhouette'] = bands({1: {'s': edge_h}, 0: {'s': edge_v.T}}, ids.shape)['s']
        raw['contour'] &= ~raw['silhouette']
        ids = np.where(ids > 0, ids, g_ids)
    if cfg['seam_as'] == 'contour':
        raw['contour'] |= raw['seam']; raw['seam'][:] = False
    stats = {'pairs': {name: int(pairs[1][name].sum() + pairs[0][name].sum()) for name in pairs[1]}, 'droppedComponents': {},
             'quietParts': [o['name'] for o in meta['objects'] if luts[0][o['id']]], 'plainParts': [o['name'] for o in meta['objects'] if luts[1][o['id']]]}
    ink_d, ink_g, ink_l = (np.array(ink, np.float32) / 255 for ink in (INK_OUTLINE, INK_CREASE, INK_GUIDE))
    outputs, debug = {}, None
    cache = {}
    for width in cfg['widths']:
        factor = W // width
        assert factor * width == W and factor * (width * 2 // 3) == H, (width, W, H)
        line_px = cfg['line_px'] if width >= 1200 else {**cfg['line_px'], **cfg['line_px_small']}
        # A smaller file draws the same drawing coarser: its shortest kept
        # line scales with its pixels (component pixels ~ 2 x length in a band).
        scale = max(1.0, 1200 / width)
        distance, dropped = {}, {}
        for name in raw:
            limit = int(2 * cfg['min_px'][name] * scale * ss)
            if (name, limit) not in cache:
                kept, count = drop_small(raw[name], limit)
                cache[(name, limit)] = (ndi.distance_transform_edt(~kept) if kept.any() else np.full(ids.shape, 1e9), count)
            distance[name], dropped[name] = cache[(name, limit)]
        stats['droppedComponents'][width] = dropped
        cover = {name: coverage(distance[name], line_px[name] * factor) for name in raw}
        dark = np.maximum(cover['silhouette'], cover['contour'])
        grey = np.maximum(cover['seam'], cover['crease']) * (1 - dark)
        light = cover['through'] * (1 - dark - grey) if 'through' in cover else np.zeros_like(dark)
        a_out = downsample(dark + grey + light, factor)
        dark_out, grey_out, light_out = downsample(dark, factor), downsample(grey, factor), downsample(light, factor)
        # Each pixel takes the ink of its dominant line (exact inks only).
        rgb = np.where((dark_out >= np.maximum(grey_out, light_out))[..., None], ink_d,
                       np.where((grey_out >= light_out)[..., None], ink_g, ink_l))
        levels = cfg['alpha_levels']
        alpha = np.round(a_out * (levels - 1)) * (255 / (levels - 1))
        rgba = np.dstack([np.round(rgb * 255), np.clip(np.round(alpha), 0, 255)]).astype(np.uint8)
        rgba[rgba[..., 3] == 0, :3] = 0
        outputs[width] = rgba
        if width == 1200:
            # QA only: class map (silhouette black, contour orange, seam green, crease steel blue).
            colours = {'silhouette': (0, 0, 0), 'contour': (230, 120, 0), 'seam': (0, 150, 70), 'crease': (60, 120, 200), 'through': (195, 200, 206)}
            debug = np.full((H // factor, W // factor, 3), 255.0)
            for name in ('through', 'crease', 'seam', 'contour', 'silhouette'):
                if name not in cover: continue
                a = downsample(cover[name], factor)[..., None]
                debug = debug * (1 - a) + np.array(colours[name]) * a
    mask = ids > 0
    stats['seconds'] = round(time.time() - started, 2)
    return cfg, meta, outputs, downsample(mask.astype(np.float32), W // 1200), stats, debug


def encode(rgba, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(rgba, 'RGBA').save(path, 'WEBP', lossless=True, quality=100, method=6, exact=False)
    back = np.asarray(Image.open(path).convert('RGBA'))
    visible = rgba[..., 3] > 0
    assert np.array_equal(back[..., 3], rgba[..., 3]) and np.array_equal(back[visible], rgba[visible]), f'lossless round trip failed {path}'
    return path.stat().st_size


def luminance(rgb):
    rgb = rgb.astype(np.float32)
    return 0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]


def registration(key, rgba, coverage_mask):
    """Lines at 1200 w against the cover's own pixels at 1200 w."""
    cover = np.asarray(Image.open(REPO / COVER_1200[key]).convert('RGB'))
    lum = luminance(cover)
    smooth = ndi.gaussian_filter(lum, 0.6)
    grad = np.hypot(ndi.sobel(smooth, 1), ndi.sobel(smooth, 0)) / 8.0
    edges = grad > 6.0                                     # >= ~6 levels per pixel of local contrast
    cover_fg = lum < 250                                   # non-white cover pixels (lossy background noise stays >= 252)
    cover_sil = cover_fg ^ ndi.binary_erosion(cover_fg)
    line = rgba[..., 3] >= 128
    d_edge = ndi.distance_transform_edt(~edges)
    d_sil = ndi.distance_transform_edt(~cover_sil)
    mask = coverage_mask >= .5
    inter, union = (mask & cover_fg).sum(), (mask | cover_fg).sum()
    # silhouette line pixels: line pixels within 2 px of the G-buffer model boundary
    g_sil = mask ^ ndi.binary_erosion(mask)
    near_g_sil = ndi.distance_transform_edt(~g_sil) <= 1.5
    sil_line = line & near_g_sil
    values = d_edge[line]
    sil_values = d_sil[sil_line]
    pct = lambda v, q: float(np.percentile(v, q)) if v.size else None
    return {
        'linePixels': int(line.sum()),
        'meanDistanceToCoverEdgePx': round(float(values.mean()), 3) if values.size else None,
        'medianDistanceToCoverEdgePx': pct(values, 50),
        'p90DistanceToCoverEdgePx': pct(values, 90),
        'shareWithin1PxOfCoverEdge': round(float((values <= 1).mean()), 4) if values.size else None,
        'shareWithin2PxOfCoverEdge': round(float((values <= 2).mean()), 4) if values.size else None,
        'silhouetteLinePixels': int(sil_line.sum()),
        'meanSilhouetteDistanceToCoverOutlinePx': round(float(sil_values.mean()), 3) if sil_values.size else None,
        'maskIoUWithCoverNonWhite': round(float(inter / max(union, 1)), 4),
        'coverEdgeThreshold': 'gaussian 0.6 px, Sobel magnitude > 6 levels/px; cover silhouette = luminance < 250',
    }, edges


def cover_check(key):
    """The harness's own cover frame against the published 1800 w cover."""
    folder = EVIDENCE / 'work' / 'render' / key
    published = REPO / COVER_1800[key]
    mine = np.asarray(Image.open(folder / 'beauty-1800.png').convert('L')).astype(np.float64)
    theirs = np.asarray(Image.open(published).convert('L')).astype(np.float64)
    diff = np.abs(mine - theirs)
    spectrum = np.fft.fft2(mine - mine.mean()) * np.conj(np.fft.fft2(theirs - theirs.mean()))
    peak = np.fft.ifft2(spectrum / np.maximum(np.abs(spectrum), 1e-9)).real
    y, x = np.unravel_index(np.argmax(peak), peak.shape)
    shift = [int(y if y < peak.shape[0] // 2 else y - peak.shape[0]), int(x if x < peak.shape[1] // 2 else x - peak.shape[1])]
    return {'webpBytesIdentical': sha256(folder / 'beauty-1800.webp') == sha256(published),
            'pngMeanAbsDiff': round(float(diff.mean()), 4), 'pngMaxAbsDiff': int(diff.max()), 'phaseCorrelationShiftPx': shift}


def main(argv):
    keys = argv[0].split(',') if argv else KEYS
    lines_json_path = OUT_DIR / 'lines.json'
    provenance_path = OUT_DIR / 'provenance.json'
    lines_json = json.loads(lines_json_path.read_text(encoding='utf-8')) if lines_json_path.exists() else {}
    provenance = json.loads(provenance_path.read_text(encoding='utf-8')).get('projects', {}) if provenance_path.exists() else {}
    report_path = EVIDENCE / 'registration.json'
    report = json.loads(report_path.read_text(encoding='utf-8')) if report_path.exists() else {}
    for key in keys:
        if key in SKIP:
            print(key, 'skipped:', SKIP[key]); continue
        cfg, meta, outputs, cov_mask, stats, debug = draw(key)
        Image.fromarray(np.clip(np.round(debug), 0, 255).astype(np.uint8)).save(EVIDENCE / 'work' / 'render' / key / 'classes-1200.png')
        files = {}
        for width, rgba in outputs.items():
            name = f'{key}.webp' if width == 1200 else f'{key}-{width}.webp'
            size = encode(rgba, OUT_DIR / name)
            files[width] = {'src': f'{OUT_DIR_REL}/{name}', 'w': width, 'h': width * 2 // 3, 'bytes': size, 'sha256': sha256(OUT_DIR / name)}
            Image.fromarray(rgba, 'RGBA').save(EVIDENCE / 'work' / 'render' / key / f'lines-{width}.png')
        reg, _ = registration(key, outputs[1200], cov_mask)
        check = cover_check(key)
        reg['harnessCover'] = check
        report[key] = {'registration': reg, 'stats': stats, 'files': files}
        # Same convention as the cover srcsets in index.html: ?v=<sha256[:12]>.
        lines_json[key] = {'src': files[1200]['src'], 'w': 1200, 'h': 800, 'cover': COVER_1200[key],
                           'srcset': ', '.join(f"{f['src']}?v={f['sha256'][:12]} {w}w" for w, f in sorted(files.items())),
                           'sha256': files[1200]['sha256']}
        if 600 in files:
            lines_json[key]['src600'] = files[600]['src']
        overrides = {k: v for k, v in SETTINGS.get('projects', {}).get(key, {}).items() if not k.startswith('_')}
        provenance[key] = {
            'sourceCover': COVER_1200[key], 'sourceCover1800': COVER_1800[key], 'sourceCover1800Sha256': sha256(REPO / COVER_1800[key]),
            'harnessCover': check,
            'settings': overrides, **({'note': SETTINGS['projects'][key]['_why']} if SETTINGS.get('projects', {}).get(key, {}).get('_why') else {}),
            'files': {str(w): {k: f[k] for k in ('src', 'w', 'h', 'bytes', 'sha256')} for w, f in files.items()},
        }
        print(key, json.dumps({'bytes': {w: f['bytes'] for w, f in files.items()}, **{k: reg[k] for k in (
            'meanDistanceToCoverEdgePx', 'shareWithin1PxOfCoverEdge', 'meanSilhouetteDistanceToCoverOutlinePx', 'maskIoUWithCoverNonWhite')},
            'cover': check, 's': stats['seconds']}))
    ordered = lambda d: {k: d[k] for k in KEYS if k in d}
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    write = lambda path, data, indent=2: path.write_text(json.dumps(data, indent=indent) + chr(10), encoding='utf-8')
    write(lines_json_path, ordered(lines_json))
    identical = [k for k in KEYS if k in provenance and provenance[k]['harnessCover']['webpBytesIdentical']]
    other = [k for k in KEYS if k in provenance and not provenance[k]['harnessCover']['webpBytesIdentical']]
    header = {
        'date': '2026-10-27',
        'purpose': 'Line drawings that register on each homepage card cover (frame 0), for the "Drawn, then built" card arrival.',
        'renderer': 'Three.js r185 project inspector (studio-inspector.js and its modules) from commit '
                    + json.loads((EVIDENCE / 'work' / 'inspector' / 'snapshot.json').read_text(encoding='utf-8'))['commit']
                    + ', loaded as tools/white-studio/export.js loads a cover: 900x600 selection canvas, source camera reset, progress 0; '
                      'AURA with its aura-reframe-20261022 framing. Tool: tools/card-lines/.',
        'method': 'Two geometry passes at 4800x3200 (4x the 1200 w cover) store view normals, part ids and 24-bit view depth. Lines between '
                  'neighbouring pixels: model outline and depth steps #111316; seams between parts and folds of at least crease_deg #505b66. '
                  'Each line is centred on its boundary at line_px output pixels (line_px_small below 1200 w), box-averaged to each width. '
                  'No cover pixel is read to draw the lines. Transparent background; lossless WebP of coverage stored in alpha_levels steps (near-lossless).',
        'registration': 'The harness also re-encodes its own frame-0 render with the exporter settings (WebP q.94, 1800x1200). Byte-identical to the '
                        'published cover: ' + (', '.join(identical) or 'none') + '.'
                        + (' Not byte-identical, same geometry and camera (zero phase-correlation shift; transmission or carbon-weave shading differs by at most '
                           + str(max(provenance[k]['harnessCover']['pngMaxAbsDiff'] for k in other)) + ' levels): ' + ', '.join(other) + '.' if other else ''),
        'defaults': {k: DEFAULTS[k] for k in DEFAULTS if k not in ('quiet', 'plain')},
        'skipped': SKIP,
    }
    write(provenance_path, {**header, 'projects': ordered(provenance)})
    write(report_path, ordered(report), 1)


if __name__ == '__main__':
    main(sys.argv[1:])
