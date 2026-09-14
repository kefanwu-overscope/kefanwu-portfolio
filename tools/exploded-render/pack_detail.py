"""Encode completed native detail frames and publish reviewable candidates only."""
import argparse
import copy
import hashlib
import importlib.util
import json
import math
import time
from pathlib import Path
from PIL import Image
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
EVIDENCE = ROOT.parent / '.codex/detail-resolution-20260914'
ASSET_BASE = 'assets/exploded/detail-20260914'
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
spec = importlib.util.spec_from_file_location('exact_frame_chunks', ROOT / 'tools/exploded-render/pack_frame_chunks.py')
chunks = importlib.util.module_from_spec(spec)
spec.loader.exec_module(chunks)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--projects', nargs='+', required=True)
    parser.add_argument('--quality', type=int, default=88)
    parser.add_argument('--evidence', type=Path, default=EVIDENCE, help='Evidence and candidate-manifest directory.')
    parser.add_argument('--input', type=Path, help='Native PNG directory; defaults to EVIDENCE/generated.')
    parser.add_argument('--asset-base', default=ASSET_BASE, help='Relative public directory beneath assets/exploded/.')
    args = parser.parse_args()
    assert 85 <= args.quality <= 95
    evidence = args.evidence.resolve()
    generated = (args.input or evidence / 'generated').resolve()
    asset_base = args.asset_base.replace('\\', '/').rstrip('/')
    assert asset_base.startswith('assets/exploded/') and not any(part in ('', '.', '..') for part in asset_base.split('/'))
    assert (ROOT / asset_base).resolve().is_relative_to((ROOT / 'assets/exploded').resolve())
    chunks.CHUNK_DIRECTORY = asset_base + '/chunks'
    public_manifest = ROOT / 'assets/exploded/manifest.json'
    baseline_bytes = public_manifest.read_bytes()
    old = json.loads(baseline_bytes)
    candidate_path = evidence / 'assets/candidate-manifest.json'
    candidates = json.loads(candidate_path.read_text()) if candidate_path.exists() else {'version': 1, 'projects': {}}
    for key in args.projects:
        assert key in old['projects']
        started = time.monotonic()
        folder = generated / key
        source = json.loads((folder / 'provenance.json').read_text())
        assert (source['width'], source['height'], source['samples']) == (1280, 854, 48)
        count = source['frameCount']
        assert count == len(old['projects'][key]['frames'])
        assert source.get('complete', True), (key, 'incomplete source')
        pngs = [folder / f'{i:02d}.png' for i in range(count)]
        assert all(p.exists() for p in pngs)
        destination = ROOT / asset_base / key
        destination.mkdir(parents=True, exist_ok=True)
        records, urls, sample_quality = [], [], []
        source_hashes = []
        for index, png in enumerate(pngs):
            source_hashes.append({'index': index, 'sha256': sha(png)})
            frame = destination / f'{index:02d}.webp'
            with Image.open(png) as image:
                assert image.size == (1280, 854) and image.format == 'PNG'
                rgb = image.convert('RGB')
                rgb.save(frame, format='WEBP', quality=args.quality, method=6)
                if index in (0, (count - 1) // 2, count - 1):
                    with Image.open(frame) as encoded:
                        assert encoded.size == image.size
                        mse = float(np.mean((np.asarray(rgb, dtype=np.float32) - np.asarray(encoded.convert('RGB'), dtype=np.float32)) ** 2))
                        sample_quality.append({'index': index, 'rgbPsnrDb': None if mse == 0 else 10 * math.log10(255 * 255 / mse)})
            digest = sha(frame)
            records.append({'file': frame.name, 'bytes': frame.stat().st_size, 'sha256': digest})
            urls.append(f'{asset_base}/{key}/{frame.name}?v={digest[:12]}')
        output_provenance = copy.deepcopy(source)
        output_provenance.update(encodedFrames=records, sourcePNGFrames=source_hashes,
            encoding={'format': 'WebP static images', 'quality': args.quality, 'method': 6, 'nativeResolution': True, 'rasterRetouching': False},
            sampleEncodingQuality=sample_quality)
        chunks.atomic_write(destination / 'provenance.json', chunks.json_bytes(output_provenance))
        config = copy.deepcopy(old['projects'][key])
        for field in ('chunks', 'chunkBytes', 'chunkVersion', 'detail'):
            config.pop(field, None)
        config.update(width=1280, height=854, frames=urls, poster=urls[0],
                      provenance=f'{asset_base}/{key}/provenance.json',
                      bytes=sum(r['bytes'] for r in records), streaming=True)
        before_chunks = copy.deepcopy(config)
        chunks.pack_project(key, config, ROOT, public_manifest, ROOT, 8, 256 * 1024, 4)
        verification = chunks.verify_project(key, before_chunks, config, ROOT, public_manifest, ROOT)
        assert config['chunkBytes'] == config['bytes']
        candidates['projects'][key] = config
        candidates['chunkTransport'] = chunks.transport_metadata(candidates)
        individual = {'version': 1, 'projects': {key: config}}
        individual['chunkTransport'] = chunks.transport_metadata(individual)
        report = {'passed': True, 'project': key, 'nativeResolution': [1280, 854],
                  'frames': count, 'imageBytes': config['bytes'], 'chunks': len(config['chunks']),
                  'chunkBytes': config['chunkBytes'], 'compressedByteOverhead': 0,
                  'quality': args.quality, 'method': 6, 'sampleQuality': sample_quality,
                  'bootstrapFrameLimit': 4, 'subsequentFrameLimit': 8,
                  'maxChunkBytes': 256 * 1024, 'sourcePNGsRetained': True,
                  'publicManifestUnchanged': public_manifest.read_bytes() == baseline_bytes,
                  'transportVerification': verification, 'seconds': round(time.monotonic() - started, 3)}
        assert report['publicManifestUnchanged']
        chunks.atomic_write(evidence / f'assets/candidates/{key}.json', chunks.json_bytes(individual))
        chunks.atomic_write(evidence / f'assets/pack-{key}.json', chunks.json_bytes(report))
        chunks.atomic_write(candidate_path, chunks.json_bytes(candidates))
        print('DETAIL_PACK_COMPLETE', key, count, config['bytes'], len(config['chunks']), report['seconds'], flush=True)


if __name__ == '__main__':
    main()
