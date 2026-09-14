"""Pack all initial-animation covers and publish their shared runtime catalog.

Writes only new editorial cover assets and tools/editorial-render/catalog-manifest.json.
The homepage, case pages, animation manifest, frames and chunks are untouched.
"""
import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
EVIDENCE = ROOT.parent / '.codex/case-pages-20260913'
DESTINATION = ROOT / 'assets/editorial/animation-start-20260913'
CATALOG = ROOT / 'tools/editorial-render/catalog-manifest.json'
RUNTIME = ROOT / 'assets/editorial/animation-covers.json'
DESCRIPTIONS = {
    'steering': 'Steering wheel, column, universal joints and rack in their neutral position.',
    'vineRobot': 'Vine robot pressure vessel with its translucent tube retracted.',
    'javelin': 'Javelin airframe suspended above the studio floor with four propellers.',
    'brakeSim': 'Perforated cast-iron brake rotor before heating.',
    'aura': 'Assembled AURA swerve module with its wheel, motors and metal structure.',
    'scanner': 'LiDAR scanner with blue printed mounts, guide rods and a plywood base.',
    'carbonSeat': 'Carbon-fiber seat layup at the beginning of the fabrication sequence.',
    'seat': 'Folded and perforated aluminum driver seat.',
    'materialTest': 'Orange tensile specimen held between silver grips before stretching.',
    'ansysCfd': 'Javelin pressure field and numerical flow paths at the beginning of the flow sequence.',
    'pool': 'Pool Sniper launcher with its cue extended before retraction.',
    'lineFollower': 'Line-following robot with orange wheels and a teal circuit board.',
    'formlabs': 'Smelly perfume mixer with its white structure and steel guide rods.',
    'education': 'Separated guitar education kit before assembly.',
    'ftc': 'Assembled FTC robot with an aluminum lift, red panels and mecanum wheels.',
    'telecaster': 'Finished Telecaster-style guitar at the start of its full rotation.',
}


def read_json(path):
    return json.loads(path.read_text(encoding='utf-8'))


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def proof_audit(provenance):
    source = Path(provenance['sourcePNG'])
    proof = Path(provenance['proofPNG'])
    assert sha(source) == provenance['sourcePNGSha256']
    assert sha(proof) == provenance['proofPNGSha256']
    with Image.open(source) as image:
        original = np.array(image.convert('RGB'), dtype=np.int16)
    with Image.open(proof) as image:
        rendered = np.array(image.convert('RGB'), dtype=np.int16)
    assert original.shape == rendered.shape == (427, 640, 3)
    difference = np.abs(original - rendered)
    record = {'maximumChannelDifference': int(difference.max()),
        'meanChannelDifference': float(difference.mean()),
        'changedPixelCount': int(np.count_nonzero(np.any(difference, axis=2))),
        'totalPixels': 640 * 427, 'sourcePixelsSha256': hashlib.sha256(original.astype('uint8').tobytes()).hexdigest(),
        'proofPixelsSha256': hashlib.sha256(rendered.astype('uint8').tobytes()).hexdigest()}
    # Very small GPU/denoising roundoff is allowed, but the original pose must be
    # reproduced at the original size/samples before the high-resolution render.
    assert record['maximumChannelDifference'] <= 4 and record['meanChannelDifference'] <= .002, record
    return record


def preserved_files(baseline):
    for item in baseline['preservedFiles']:
        path = ROOT / item['path']
        assert path.stat().st_size == item['bytes'] and sha(path) == item['sha256'], item['path']
    return len(baseline['preservedFiles'])


def url(variant):
    return variant['src'] + '?v=' + variant['sha256'][:12]


def verify_renderer_source(provenance):
    """Keep each master's actual wrapper version, including a metadata-only fix."""
    source = EVIDENCE / 'cover-renderer-sources' / (provenance['rendererSha256'] + '.py')
    assert source.is_file() and sha(source) == provenance['rendererSha256']
    return source.relative_to(EVIDENCE.parent).as_posix()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=Path, default=EVIDENCE / 'covers')
    args = parser.parse_args()
    baseline = read_json(EVIDENCE / 'covers-baseline.json')
    manifest = read_json(ROOT / 'assets/exploded/manifest.json')
    assert manifest == baseline['animationManifest']
    count_preserved = preserved_files(baseline)
    old_catalog = {record['project']: record for record in baseline['catalog']}
    assert set(old_catalog) == set(manifest['projects']) == set(DESCRIPTIONS)
    catalog, runtime, checks = [], {}, []
    DESTINATION.mkdir(parents=True, exist_ok=True)
    for key, animation in manifest['projects'].items():
        folder = args.input.resolve() / key
        provenance = read_json(folder / 'initial-cover-provenance.json')
        assert provenance['project'] == key and provenance['coverProgress'] == 0
        assert provenance['samples'] == 192 and provenance['dimensions'] == [1800, 1200]
        assert provenance['sourceFrame'] == animation['frames'][0]
        assert provenance['sourceFrameSha256'] == sha(ROOT / animation['frames'][0].split('?')[0])
        assert provenance['sceneSha256BeforeResolutionChange'] == provenance['sceneSha256AfterResolutionChange']
        assert provenance['cameraFrameMaximumError'] < 2e-6
        assert provenance['motionReportUnchanged'] or provenance.get('motionKinematicsUnchanged')
        renderer_source = verify_renderer_source(provenance)
        assert provenance['animationRendererSha256'] == sha(ROOT / provenance['animationRenderer'])
        audit = proof_audit(provenance)
        master = folder / 'cover.png'
        assert sha(master) == provenance['masterSha256']
        variants = []
        with Image.open(master) as image:
            assert image.mode == 'RGB' and image.size == (1800, 1200)
            for width in (480, 960, 1800):
                output = image if width == 1800 else image.resize((width, width * 2 // 3), Image.Resampling.LANCZOS)
                path = DESTINATION / f'{key}-wide-{width}.webp'
                output.save(path, 'WEBP', quality=91 if width == 1800 else 87, method=6, exact=True)
                variants.append({'src': path.relative_to(ROOT).as_posix(), 'width': width, 'height': width * 2 // 3,
                    'bytes': path.stat().st_size, 'sha256': sha(path)})
        public = {field: value for field, value in provenance.items() if field not in ('sourcePNG', 'proofPNG', 'masterPNG')}
        public['proofPixelAudit'] = audit
        public['offlineRendererSource'] = renderer_source
        public['variants'] = variants
        public_path = DESTINATION / f'{key}-provenance.json'
        public_path.write_text(json.dumps(public, indent=2) + '\n')
        public_url = public_path.relative_to(ROOT).as_posix() + '?v=' + sha(public_path)[:12]
        source_provenance = read_json(ROOT / animation['provenance'])
        previous = old_catalog[key]['renderProvenance']
        record = {'project': key, 'variants': variants, 'renderProvenance': {
            'coverFromAnimation': True, 'renderer': provenance['renderer'], 'rendererSha256': provenance['rendererSha256'],
            'animationRenderer': provenance['animationRenderer'], 'animationRendererSha256': provenance['animationRendererSha256'],
            'samples': 192, 'dimensions': [1800, 1200], 'sourceAnimationKey': key, 'coverProgress': 0.,
            'offlineRendererSource': renderer_source,
            'motion': source_provenance['motion'], 'motionRevision': source_provenance['motionRevision'],
            'coverRevision': 'case-pages-20260913', 'cameraLocation': provenance['camera']['location'],
            'cameraRotation': provenance['camera']['rotation'], 'cameraOrthoScale': provenance['camera']['orthoScale'],
            'pixelAspect': provenance['pixelAspect'], 'groundZ': provenance['groundZ'],
            'firstAnimationFrame': animation['frames'][0], 'firstAnimationFrameSha256': provenance['sourceFrameSha256'],
            'masterSha256': provenance['masterSha256'], 'proofPixelAudit': audit, 'provenance': public_url,
            'originalCoverProvenance': previous.get('originalCoverProvenance', previous)}}
        catalog.append(record)
        runtime[key] = {'src': url(variants[-1]), 'srcset': ', '.join(f'{url(variant)} {variant["width"]}w' for variant in variants),
            'alt': DESCRIPTIONS[key], 'width': 1800, 'height': 1200, 'variants': variants,
            'coverProgress': 0., 'sourceFrame': animation['frames'][0], 'sourceFrameSha256': provenance['sourceFrameSha256'],
            'provenance': public_url}
        checks.append({'project': key, 'sourceFrameSha256': provenance['sourceFrameSha256'],
            'camera': provenance['camera'], 'groundZ': provenance['groundZ'], 'pixelAspect': provenance['pixelAspect'],
            'cameraFrameMaximumError': provenance['cameraFrameMaximumError'], 'proofPixelAudit': audit,
            'variants': variants, 'masterSha256': provenance['masterSha256']})
    # Publish the catalogs only once every master and every original frame proof passes.
    CATALOG.write_text(json.dumps(catalog, indent=2) + '\n')
    RUNTIME.write_text(json.dumps({'version': 1, 'revision': 'case-pages-20260913', 'projects': runtime}, indent=2) + '\n')
    report = {'passed': True, 'baselineCommit': baseline['commit'], 'projectCount': len(checks),
        'responsiveAssets': sum(len(check['variants']) for check in checks), 'preservedFileCount': count_preserved,
        'preservedAnimationFrames': sum(len(project['frames']) for project in manifest['projects'].values()),
        'preservedChunks': sum(len(project['chunks']) for project in manifest['projects'].values()),
        'runtimeCatalog': RUNTIME.relative_to(ROOT).as_posix(), 'runtimeCatalogSha256': sha(RUNTIME),
        'masterPolicy': 'Native 1800x1200 Cycles renders at 192 samples; no upscaled 640px substitutes.',
        'projects': checks}
    (EVIDENCE / 'initial-cover-pack.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({key: value for key, value in report.items() if key != 'projects'}))


if __name__ == '__main__':
    main()
