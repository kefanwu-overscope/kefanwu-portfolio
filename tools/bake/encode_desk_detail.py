"""Pack the native desktop irradiance bakes as straight-alpha linear RGBM16."""
import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image

p = argparse.ArgumentParser()
p.add_argument('--source', type=Path, required=True)
p.add_argument('--output', type=Path, required=True)
cfg = p.parse_args()
cfg.output.mkdir(parents=True, exist_ok=True)
manifest_path = cfg.source / 'desk-manifest.json'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
manifest.update({'encoding': 'RGBM8', 'range': 16, 'decode': 'rgb * alpha * 16', 'premultiplyAlpha': False})
for state in ['off', 'on']:
    raw = np.load(cfg.source / f'desk-{state}.npy')[:, :, :3]
    if not np.isfinite(raw).all() or np.any(raw > 16):
        raise ValueError('Non-finite or clipped desktop bake.')
    clean = np.maximum(0, raw)
    multiplier = np.maximum(1, np.ceil(clean.max(axis=2) / 16 * 255)).astype(np.uint8)
    rgb = np.rint(clean / (multiplier[:, :, None] / 255 * 16) * 255).clip(0, 255).astype(np.uint8)
    rgba = np.concatenate([rgb, multiplier[:, :, None]], axis=2)
    path = cfg.output / f'desk-{state}.rgbm.png'
    Image.fromarray(np.flipud(rgba), 'RGBA').save(path, optimize=True, compress_level=9)
    assert np.array_equal(np.flipud(np.asarray(Image.open(path))), rgba)
    decoded = rgb / 255 * (multiplier[:, :, None] / 255 * 16)
    manifest['states'][state].update({
        'file': path.name, 'bytes': path.stat().st_size,
        'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
        'meanAbsoluteError': float(np.abs(decoded-clean).mean()),
        'maxAbsoluteError': float(np.abs(decoded-clean).max()),
        'clippedChannels': 0, 'diskRoundtripExact': True,
    })
    # Evidence-only display transform for reading contact-shadow placement.
    preview = np.clip(clean / (1 + clean), 0, 1) ** (1 / 2.2)
    Image.fromarray(np.rint(np.flipud(preview)*255).astype(np.uint8), 'RGB').save(cfg.source / f'desk-{state}-preview.png')
manifest_path.write_text(json.dumps(manifest, indent=2), encoding='utf-8')
runtime = {k: v for k, v in manifest.items() if k != 'states'}
runtime['states'] = {state: {k: v for k, v in record.items() if k not in ['sourceBlend', 'sourceBlendSha256', 'percentilesRgb']} for state, record in manifest['states'].items()}
(cfg.output / 'desk-lighting.json').write_text(json.dumps(runtime, indent=2), encoding='utf-8')
print(json.dumps(manifest, indent=2))
