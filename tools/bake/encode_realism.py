"""Losslessly pack native Cycles float lightmaps as linear straight-alpha RGBM.

Run with Python+numpy+Pillow after realism_bake.py. PNG rows are written top
down from Blender's bottom-up pixel arrays, as required by a glTF texture
loaded with flipY=false. No display color transform or gamma is applied.
"""
import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image

p = argparse.ArgumentParser()
p.add_argument('--evidence', type=Path, required=True)
p.add_argument('--output', type=Path, required=True)
p.add_argument('--resolution', type=int, default=2048)
p.add_argument('--source-resolution', type=int)
p.add_argument('--range', type=float, default=16)
cfg = p.parse_args()
source_resolution = cfg.source_resolution or cfg.resolution
cfg.output.mkdir(parents=True, exist_ok=True)
manifest = json.loads((cfg.evidence / 'bake-manifest.json').read_text(encoding='utf-8'))
if cfg.range <= 0 or cfg.resolution <= 0 or source_resolution != manifest['nativeResolution']:
    raise ValueError('Invalid encoding range, resolution, or source provenance.')
encoding = {
    'encoding': 'RGBM8', 'range': cfg.range, 'decode': 'rgb * alpha * range',
    'colorSpace': 'NoColorSpace', 'flipY': False, 'uvChannel': 1,
    'premultiplyAlpha': False, 'imageBitmapOptions': {'premultiplyAlpha': 'none', 'colorSpaceConversion': 'none'},
    'units': 'irradiance/pi', 'sourceNativeResolution': source_resolution,
    'resolution': cfg.resolution, 'linearDownsample': source_resolution != cfg.resolution,
    'mipmaps': False, 'format': 'lossless PNG RGBA8', 'states': {},
}
for state in ['off', 'on']:
    source = cfg.evidence / f'lightmap-{state}-{source_resolution}.npy'
    if not source.exists():
        continue
    raw = np.load(source)[:, :, :3]
    if raw.shape != (source_resolution, source_resolution, 3) or not np.isfinite(raw).all():
        raise ValueError('Lightmap shape is wrong or contains non-finite values.')
    if np.any(raw > cfg.range):
        raise ValueError('RGBM range clips native lightmap values; choose a larger range and rerun.')
    if source_resolution != cfg.resolution:
        if source_resolution % cfg.resolution:
            raise ValueError('Only exact integer area downsampling is supported.')
        factor = source_resolution // cfg.resolution
        raw = raw.reshape(cfg.resolution, factor, cfg.resolution, factor, 3).mean(axis=(1, 3))
    clean = raw.clip(0, cfg.range)
    multiplier = np.maximum(1, np.ceil(clean.max(axis=2) / cfg.range * 255)).astype(np.uint8)
    rgb = np.rint(clean / (multiplier[:, :, None].astype(np.float32) / 255 * cfg.range) * 255).clip(0, 255).astype(np.uint8)
    rgba = np.concatenate([rgb, multiplier[:, :, None]], axis=2)
    decoded = rgb.astype(np.float32) / 255 * (multiplier[:, :, None].astype(np.float32) / 255) * cfg.range
    name = f'lightmap-{state}-{cfg.resolution // 1024}k.rgbm.png' if cfg.resolution >= 1024 else f'lightmap-{state}-{cfg.resolution}.rgbm.png'
    target = cfg.output / name
    Image.fromarray(np.flipud(rgba), 'RGBA').save(target, optimize=True, compress_level=9)
    # Decode the actual disk PNG to ensure the packer did not involve gamma,
    # premultiplication or a lossy image format.
    check = np.flipud(np.asarray(Image.open(target)))
    assert np.array_equal(check, rgba)
    encoding['states'][state] = {
        'file': name, 'bytes': target.stat().st_size,
        'sha256': hashlib.sha256(target.read_bytes()).hexdigest(),
        'sourceMaximum': float(raw.max()), 'clippedChannels': int(np.count_nonzero(raw > cfg.range)),
        'meanAbsoluteError': float(np.abs(decoded-clean).mean()),
        'maxAbsoluteError': float(np.abs(decoded-clean).max()),
        'diskRoundtripExact': True,
    }
    if encoding['states'][state]['clippedChannels']:
        raise ValueError('RGBM range clips lightmap values; choose a larger range and rerun.')
manifest['encoding'] = encoding
manifest.setdefault('encodedQualities', {})[str(cfg.resolution)] = encoding
manifest['deployedFiles'] = [
    {'file': f.name, 'bytes': f.stat().st_size, 'sha256': hashlib.sha256(f.read_bytes()).hexdigest()}
    for f in cfg.output.iterdir() if f.suffix in ['.glb', '.hdr', '.png']
]
(cfg.evidence / 'bake-manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
runtime_manifest = {
    'version': manifest['version'], 'encoding': 'RGBM8', 'range': cfg.range,
    'units': 'irradiance/pi', 'geometry': 'room-baked.glb',
    'probes': {'off': 'probe-off.hdr', 'on': 'probe-on.hdr'},
    'qualities': {f'{int(size) // 1024}k': record for size, record in manifest['encodedQualities'].items()},
}
(cfg.output / 'lighting.json').write_text(json.dumps(runtime_manifest, indent=2), encoding='utf-8')
print(json.dumps(encoding, indent=2))
