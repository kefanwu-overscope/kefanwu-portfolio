"""Encode one native neutral master into SD/HD/cover candidates, never integrate."""
import argparse
import copy
import hashlib
import json
import re
import time
from pathlib import Path

import numpy as np
from PIL import Image
import pack_frame_chunks as chunks

ROOT = Path(__file__).resolve().parents[2]
EVIDENCE = ROOT.parent / '.codex/neutral-studio-20260915'
REVISION = 'neutral-20260915'


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def read(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def save(path, value):
    chunks.atomic_write(path, chunks.json_bytes(value))


def relative(path):
    return Path(path).relative_to(ROOT).as_posix()


def corner_check(image):
    rgb = np.asarray(image.convert('RGB'))
    # Every model is fitted with >=6% margins; these small patches stay clear
    # of geometry, short-range contact shadows and resampling filter support.
    patches = [rgb[:4, :4], rgb[:4, -4:], rgb[-4:, :4], rgb[-4:, -4:]]
    return {'cornersRGB': [patch[0, 0].tolist() for patch in patches],
            'maximumCornerDeviation': int(max(np.max(np.abs(p.astype(np.int16) - 25)) for p in patches))}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--projects', nargs='+', required=True)
    parser.add_argument('--evidence', type=Path, default=EVIDENCE)
    parser.add_argument('--input', type=Path)
    parser.add_argument('--carbon-verification', type=Path)
    parser.add_argument('--asset-revision', default=REVISION,
                        help='Use a new directory name when reproducing an already integrated release.')
    opts = parser.parse_args()
    evidence = opts.evidence.resolve()
    generated = (opts.input or evidence / 'generated').resolve()
    home_path, hd_path = [ROOT / f'assets/exploded/{name}' for name in ('manifest.json', 'manifest-detail.json')]
    covers_path = ROOT / 'assets/editorial/animation-covers.json'
    protected = {path: path.read_bytes() for path in (home_path, hd_path, covers_path)}
    original_home, original_covers = read(home_path), read(covers_path)
    asset_revision = opts.asset_revision
    assert re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', asset_revision)
    active_hd = read(hd_path)
    for key in opts.projects:
        prefixes = (f'assets/exploded/{asset_revision}/', f'assets/editorial/{asset_revision}/')
        active_urls = [original_home['projects'][key]['provenance'], active_hd['projects'][key]['provenance'],
                       original_covers['projects'][key]['provenance']]
        assert not any(url.startswith(prefixes) for url in active_urls), (
            key, 'Destination is an active public release; choose a new --asset-revision candidate directory')
    candidates = {}
    for kind in ('home', 'detail', 'covers'):
        path = evidence / f'assets/candidate-{kind}.json'
        candidates[kind] = read(path) if path.exists() else {'version': 1, 'revision': REVISION, 'projects': {}}
    for key in opts.projects:
        started = time.monotonic()
        folder = generated / key
        source = read(folder / 'provenance.json')
        cover = read(folder / 'cover-provenance.json')
        count = len(original_home['projects'][key]['frames'])
        assert source['complete'] and source['frameCount'] == count
        assert (source['width'], source['height'], source['samples']) == (1280, 854, 48)
        assert source['motionRevision'] == REVISION
        assert source['sourcePreservation']['status'] == 'passed'
        assert source['sourcePreservation']['studio']['backgroundDisplayRGB'] == [25, 25, 25]
        assert cover['coverProgress'] == 0 and cover['samples'] == 192
        assert cover['cameraFrameMaximumError'] < 2e-6
        if key == 'carbonSeat':
            verification = opts.carbon_verification or evidence / 'carbon/geometry-verification.json'
            assert verification.is_file(), 'Carbon geometry verification is required for delivery'
            source['carbonGeometryVerification'] = read(verification)
            check = source['carbonGeometryVerification']
            assert check['status'] == 'passed' and check['finalDimensionsGrowth'] == [0., 0., 0.]
            assert check['maximumSimultaneousClothSurfaces'] == 1
            assert check['originalShaderNodesAndInputsUnchanged'] is True
            assert check['controllerSha256'] == source['sourcePreservation']['sourceFiles']['tools/exploded-render/material_processes.py']
        master_records, encoded, backgrounds = [], {'sd': [], 'hd': []}, []
        for tier in encoded:
            (ROOT / 'assets/exploded' / asset_revision / tier / key).mkdir(parents=True, exist_ok=True)
        for index in range(count):
            png = folder / f'{index:02d}.png'
            digest = sha(png)
            assert digest == source['timings'][index]['sha256']
            master_records.append({'index': index, 'file': png.name, 'sha256': digest, 'bytes': png.stat().st_size})
            with Image.open(png) as im:
                assert im.size == (1280, 854) and im.mode == 'RGB'
                check = corner_check(im)
                assert check['maximumCornerDeviation'] == 0, (key, index, check)
                if index in (0, (count - 1) // 2, count - 1):
                    backgrounds.append({'index': index, **check})
                for tier, dimensions, quality in (('sd', (640, 427), 85), ('hd', (1280, 854), 88)):
                    rendered = im if tier == 'hd' else im.resize(dimensions, Image.Resampling.LANCZOS)
                    output = ROOT / 'assets/exploded' / asset_revision / tier / key / f'{index:02d}.webp'
                    rendered.save(output, format='WEBP', quality=quality, method=6, exact=True)
                    record = {'file': output.name, 'sha256': sha(output), 'bytes': output.stat().st_size}
                    if index in (0, (count - 1) // 2, count - 1):
                        with Image.open(output) as decoded:
                            check = corner_check(decoded)
                            assert check['maximumCornerDeviation'] <= 1, (key, tier, index, check)
                            mse = float(np.mean((np.asarray(rendered, dtype=np.float32) - np.asarray(decoded, dtype=np.float32)) ** 2))
                            record['rgbPsnrDb'] = None if mse == 0 else float(10 * np.log10(255 ** 2 / mse))
                            record['backgroundVerification'] = check
                    encoded[tier].append(record)
        per_project = {'project': key, 'revision': REVISION, 'sourcePNGFrames': master_records}
        transport_checks = {}
        for tier, candidate_kind, dimensions, quality, chunk_limit in (
                ('sd', 'home', (640, 427), 85, 16), ('hd', 'detail', (1280, 854), 88, 8)):
            destination = ROOT / 'assets/exploded' / asset_revision / tier / key
            public = copy.deepcopy(source)
            public.update(width=dimensions[0], height=dimensions[1], encodedFrames=encoded[tier],
                          sourcePNGFrames=master_records, sourceMasterDimensions=[1280, 854],
                          backgroundVerification=backgrounds,
                          encoding={'format': 'WebP static images', 'quality': quality, 'method': 6,
                                    'nativeResolution': tier == 'hd', 'rasterRetouching': False,
                                    'resize': 'none' if tier == 'hd' else 'Lanczos downsample from shared native 1280x854 PNG'})
            if tier == 'sd':
                public['sourceMasterPNGs'] = master_records
            save(destination / 'provenance.json', public)
            config = copy.deepcopy(original_home['projects'][key])
            for field in ('chunks', 'chunkBytes', 'chunkVersion', 'detail', 'streaming'):
                config.pop(field, None)
            urls = [f'{relative(destination)}/{row["file"]}?v={row["sha256"][:12]}' for row in encoded[tier]]
            config.update(width=dimensions[0], height=dimensions[1], frames=urls, poster=urls[0],
                          provenance=relative(destination / 'provenance.json'),
                          bytes=sum(row['bytes'] for row in encoded[tier]))
            if tier == 'hd':
                config['streaming'] = True
            before = copy.deepcopy(config)
            chunks.CHUNK_DIRECTORY = f'assets/exploded/{asset_revision}/{tier}/chunks'
            chunks.pack_project(key, config, ROOT, home_path, ROOT, chunk_limit, 256 * 1024, 4)
            transport_checks[tier] = chunks.verify_project(key, before, config, ROOT, home_path, ROOT)
            candidates[candidate_kind]['projects'][key] = config
            per_project[candidate_kind] = config

        destination = ROOT / 'assets/editorial' / asset_revision
        destination.mkdir(parents=True, exist_ok=True)
        master = folder / 'cover.png'
        assert sha(master) == cover['masterSha256']
        assert cover['sourceHDFramePNGSha256'] == master_records[0]['sha256']
        variants = []
        with Image.open(master) as im:
            assert im.mode == 'RGB' and im.size == (1800, 1200)
            assert corner_check(im)['maximumCornerDeviation'] == 0
            for width in (480, 960, 1800):
                image = im if width == 1800 else im.resize((width, width * 2 // 3), Image.Resampling.LANCZOS)
                output = destination / f'{key}-wide-{width}.webp'
                image.save(output, format='WEBP', quality=91 if width == 1800 else 87, method=6, exact=True)
                variants.append({'src': relative(output), 'width': width, 'height': width * 2 // 3,
                                 'sha256': sha(output), 'bytes': output.stat().st_size})
        sd = per_project['home']
        public_cover = {field: value for field, value in cover.items() if field not in ('masterPNG', 'sourceHDFramePNG')}
        public_cover.update(variants=variants, sourceFrame=sd['frames'][0], sourceFrameSha256=encoded['sd'][0]['sha256'],
                            sourceAnimationProvenance=sd['provenance'], sourceAnimationProvenanceSha256=sha(ROOT / sd['provenance']),
                            sourceAnimationRevision=REVISION, sourceFrameCount=count, sourceDimensions=[640, 427],
                            sourceMasterDimensions=[1280, 854], studio=source['sourcePreservation']['studio'],
                            geometryAndMaterialsSha256=source['sourcePreservation']['sourceGeometryAndMaterials']['sha256'],
                            encoding={'qualityMaster': 91, 'qualityResponsive': 87, 'method': 6, 'rasterRetouching': False})
        if key == 'carbonSeat':
            public_cover['carbonGeometryVerification'] = source['carbonGeometryVerification']
        public_path = destination / f'{key}-provenance.json'
        save(public_path, public_cover)
        url = lambda item: item['src'] + '?v=' + item['sha256'][:12]
        card = {'src': url(variants[-1]), 'srcset': ', '.join(url(v) + f' {v["width"]}w' for v in variants),
                'alt': original_covers['projects'][key]['alt'], 'width': 1800, 'height': 1200,
                'variants': variants, 'coverProgress': 0., 'sourceFrame': sd['frames'][0],
                'sourceFrameSha256': encoded['sd'][0]['sha256'],
                'provenance': relative(public_path) + '?v=' + sha(public_path)[:12]}
        candidates['covers']['projects'][key] = card
        per_project['cover'] = card
        per_project['catalog'] = {'variants': variants, 'renderProvenance': {
            'firstAnimationFrame': card['sourceFrame'], 'firstAnimationFrameSha256': card['sourceFrameSha256'],
            'provenance': card['provenance'], 'coverProgress': 0.,
            'cameraLocation': cover['camera']['location'], 'cameraRotation': cover['camera']['rotation'],
            'cameraOrthoScale': cover['camera']['orthoScale']}}
        for kind, candidate in candidates.items():
            if kind != 'covers':
                candidate['chunkTransport'] = chunks.transport_metadata(candidate)
            save(evidence / f'assets/candidate-{kind}.json', candidate)
        save(evidence / f'assets/candidates/{key}.json', per_project)
        report = {'passed': True, 'project': key, 'framesPerTier': count, 'sharedNativeMasterCount': count,
                  'backgroundVerification': backgrounds, 'transportVerification': transport_checks,
                  'homeBytes': per_project['home']['bytes'], 'detailBytes': per_project['detail']['bytes'],
                  'coverVariants': 3, 'seconds': round(time.monotonic() - started, 3),
                  'publicManifestsUnchanged': all(path.read_bytes() == data for path, data in protected.items())}
        assert report['publicManifestsUnchanged']
        save(evidence / f'assets/pack-{key}.json', report)
        print('NEUTRAL_PACK_COMPLETE', key, count, report['homeBytes'], report['detailBytes'], report['seconds'], flush=True)


if __name__ == '__main__':
    main()
