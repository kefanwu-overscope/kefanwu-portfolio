"""Verify current covers, preserved originals and exact project-gallery inputs."""
if __name__ == '__main__':
    import subprocess as _subprocess
    import sys as _sys
    import json as _json
    from pathlib import Path as _Path
    _site = _Path(__file__).resolve().parents[2]
    _detail = _site / 'assets/exploded/manifest-detail.json'
    if _detail.is_file() and _json.loads(_detail.read_text(encoding='utf-8')).get('revision') == 'neutral-20260915':
        raise SystemExit(_subprocess.call([_sys.executable, '-X', 'utf8', str(_site / 'tools/exploded-render/validate_neutral.py'), *_sys.argv[1:]]))
    if _detail.is_file() and _json.loads(_detail.read_text(encoding='utf-8')).get('revision') == 'detail-resolution-20260914':
        raise SystemExit(_subprocess.call([_sys.executable, '-X', 'utf8', str(_site / 'tools/exploded-render/validate_detail.py'), *_sys.argv[1:]]))
    if (_site / 'assets/editorial/animation-covers.json').is_file():
        raise SystemExit(_subprocess.call([_sys.executable, '-X', 'utf8', str(_site / 'tools/exploded-render/validate_initial_covers.py')]))

import hashlib
import json
import re
import subprocess
from pathlib import Path

from PIL import Image


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
EVIDENCE = ROOT.parent / '.codex/motion-loading-20260913'
BASELINE_COMMIT = 'bca21757c49da6eb5b9d78226d1811f5435343fd'
ANIMATION_PROGRESS = {'vineRobot': 0., 'education': 0.}
ANIMATION_RENDERER = 'tools/exploded-render/render_exploded.py'
DIMENSIONS = [(480, 320), (960, 640), (1800, 1200)]


def hashof(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_json(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))


def git_bytes(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT)


def check_variant(variant):
    path = ROOT / variant['src']
    assert path.stat().st_size == variant['bytes'], str(path)
    assert hashof(path) == variant['sha256'], str(path)
    with Image.open(path) as image:
        assert image.size == (variant['width'], variant['height']), str(path)
        assert image.mode == 'RGB', str(path)


def check_original_provenance(key, provenance, catalog):
    """Retain the existing source, catalogue-renderer and builder checks."""
    assert provenance['samples'] == 192, key
    assert provenance['dimensions'] == [1800, 1200], key
    if provenance.get('source'):
        assert hashof(ROOT / provenance['source'].replace('\\', '/')) == provenance['sourceSha256'], key
    if key in catalog:
        assert hashof(HERE / 'render_catalog.py') == provenance['rendererSha256'], key
        if catalog[key].get('builder'):
            assert hashof(ROOT / catalog[key]['builder']) == provenance['builderSha256'], key


def gallery_blocks(text):
    """Read each project's literal gallery array without executing JavaScript."""
    headers = list(re.finditer(r'^  ([A-Za-z_$][\w$]*):\s*\{', text, re.M))
    result = {}
    for match in re.finditer(r'\bgallery\s*:\s*\[', text):
        key = next(header.group(1) for header in reversed(headers) if header.start() < match.start())
        start = match.end() - 1
        depth, quote, escaped = 0, None, False
        for index in range(start, len(text)):
            char = text[index]
            if quote:
                if escaped:
                    escaped = False
                elif char == '\\':
                    escaped = True
                elif char == quote:
                    quote = None
            elif char in ('"', "'", '`'):
                quote = char
            elif char == '[':
                depth += 1
            elif char == ']':
                depth -= 1
                if depth == 0:
                    assert key not in result, 'Duplicate gallery: ' + key
                    result[key] = text[start:index + 1]
                    break
        else:
            raise AssertionError('Unclosed gallery: ' + key)
    return result


def check_original_models_and_galleries():
    original_text = git_bytes('show', BASELINE_COMMIT + ':project-data.js').decode('utf-8').replace('\r\n', '\n')
    current_text = (ROOT / 'project-data.js').read_text(encoding='utf-8')
    original = gallery_blocks(original_text)
    assert len(original) == 16, 'Expected sixteen source galleries in the baseline'
    assert gallery_blocks(current_text) == original, 'Original project gallery definitions changed'
    gallery_paths = {match.group(2) for block in original.values()
                     for match in re.finditer(r'\bsrc\s*:\s*([\"\'])(.*?)\1', block)}
    assert gallery_paths and all(path.startswith('assets/') for path in gallery_paths)
    # Restrict preservation to original CAD and the exact original gallery
    # resources. New animation frames and replacement editorial covers are
    # intentionally outside this list; unrelated LOD work is also excluded.
    tree = git_bytes('ls-tree', '-r', '-z', BASELINE_COMMIT, '--', 'models/real', *sorted(gallery_paths))
    checked = {}
    for entry in tree.split(b'\0'):
        if not entry:
            continue
        metadata, path_bytes = entry.split(b'\t', 1)
        _, kind, expected = metadata.decode('ascii').split()
        path = path_bytes.decode('utf-8')
        assert kind == 'blob', path
        content = (ROOT / path).read_bytes()
        actual = hashlib.sha1(b'blob ' + str(len(content)).encode('ascii') + b'\0' + content).hexdigest()
        assert actual == expected, 'Original model/gallery bytes changed: ' + path
        checked[path] = expected
    assert gallery_paths <= set(checked), 'Gallery resources missing from the baseline Git tree'
    models = [path for path in checked if path.startswith('models/real/')]
    assert models, 'No baseline source models checked'
    return {'baselineCommit': BASELINE_COMMIT, 'modelCount': len(models),
            'galleryCount': len(original), 'galleryAssetCount': len(gallery_paths),
            'checkedGitBlobs': checked}


def validate():
    manifest = read_json(HERE / 'catalog-manifest.json')
    catalog = read_json(HERE / 'catalog.json')
    baseline_records = read_json(EVIDENCE / 'baseline-catalog.json')
    committed_baseline = json.loads(git_bytes('show', BASELINE_COMMIT + ':tools/editorial-render/catalog-manifest.json'))
    assert baseline_records == committed_baseline, 'Saved baseline catalogue does not match the baseline commit'
    baseline = {record['project']: record for record in baseline_records}
    home = (ROOT / 'index.html').read_text(encoding='utf-8')
    cards = re.findall(r'<article class="project-card".*?</article>', home, re.S)
    assert len(cards) == len(manifest) == len(baseline) == 16
    assert {record['project'] for record in manifest} == set(baseline)
    animated = {record['project'] for record in manifest if record['renderProvenance'].get('coverFromAnimation')}
    assert animated == {'vineRobot', 'education', 'ansysCfd', 'materialTest'}, repr(sorted(animated))

    older = json.loads(git_bytes('show', 'ce30134754a3e8871bd79dfe6ddd3f2b7e2c9a54:tools/editorial-render/catalog-manifest.json'))
    original_assets = {variant['src']: variant for record in older + baseline_records for variant in record['variants']}
    assert len(original_assets) == 60
    for variant in original_assets.values():
        check_variant(variant)

    animation_checks = []
    unchanged = 0
    for record in manifest:
        key = record['project']
        provenance = record['renderProvenance']
        if key in ANIMATION_PROGRESS:
            assert provenance['coverFromAnimation'] is True, key
            assert provenance['renderer'] == ANIMATION_RENDERER, key
            assert provenance['rendererSha256'] == hashof(ROOT / ANIMATION_RENDERER), key
            assert provenance['samples'] == 192 and provenance['dimensions'] == [1800, 1200], key
            assert provenance['sourceAnimationKey'] == key, key
            assert provenance['coverProgress'] == ANIMATION_PROGRESS[key], key
            assert provenance['motionRevision'] == 'motion-loading-20260913', key
            assert provenance['originalCoverProvenance'] == baseline[key]['renderProvenance']['originalCoverProvenance'], key
            check_original_provenance(key, provenance['originalCoverProvenance'], catalog)
            master = EVIDENCE / 'covers' / key / 'cover.png'
            assert hashof(master) == provenance['masterSha256'], key
            with Image.open(master) as image:
                assert image.size == (1800, 1200) and image.mode == 'RGB', key
            source_record = read_json(master.with_name('cover-provenance.json'))
            assert source_record['project'] == key and source_record['frameCount'] == 1, key
            assert [source_record['width'], source_record['height']] == [1800, 1200], key
            for field in ('rendererSha256', 'samples', 'coverProgress', 'motionRevision', 'motion',
                          'cameraLocation', 'cameraRotation', 'cameraOrthoScale'):
                assert source_record[field] == provenance[field], (key, field)
            assert source_record['sourceAnimationFrameCount'] == (145 if key in ('vineRobot', 'materialTest') else 121), key
            animation = read_json(ROOT / 'assets/exploded/manifest.json')['projects'][key]
            animation_source = read_json(ROOT / animation['provenance'])
            assert provenance['firstAnimationFrame'] == animation['frames'][0], key
            first_frame = ROOT / animation['frames'][0].split('?')[0]
            assert hashof(first_frame) == provenance['firstAnimationFrameSha256'] == animation_source['encodedFrames'][0]['sha256'], key
            assert provenance['motion'] == animation_source['motion'], (key, 'cover/controller mismatch')
            expected_folder = 'assets/editorial/start-20260913/'
            assert all(variant['src'].startswith(expected_folder + key + '-wide-') for variant in record['variants']), key
            assert not {v['src'] for v in record['variants']} & {v['src'] for v in baseline[key]['variants']}, key
            animation_checks.append({'project': key, 'progress': provenance['coverProgress'],
                                     'masterSha256': provenance['masterSha256'], 'rendererSha256': provenance['rendererSha256']})
        else:
            assert record == baseline[key], 'Unexpected change to an original cover: ' + key
            if key in animated:
                check_original_provenance(key, provenance['originalCoverProvenance'], catalog)
                assert provenance['rendererSha256'] == hashlib.sha256(git_bytes('show', BASELINE_COMMIT + ':' + ANIMATION_RENDERER)).hexdigest(), key
                old_master = ROOT.parent / '.codex/motion-refinement-20260913/covers' / key / 'cover.png'
                assert hashof(old_master) == provenance['masterSha256'], key
            else:
                check_original_provenance(key, provenance, catalog)
            unchanged += len(record['variants'])

        matching_cards = [card for card in cards if f'data-project="{key}"' in card]
        assert len(matching_cards) == 1, key
        card = matching_cards[0]
        assert 'loading="lazy"' in card and 'decoding="async"' in card, key
        assert 'width="1800" height="1200"' in card and 'cover-kind' not in card, key
        assert [(v['width'], v['height']) for v in record['variants']] == DIMENSIONS, key
        for variant in record['variants']:
            check_variant(variant)
            assert variant['src'] in card, (key, variant['src'])
        assert record['variants'][1]['bytes'] < 100000, key

    assert unchanged == 42 and len(animation_checks) * 3 == 6
    protection = check_original_models_and_galleries()
    return {'passed': True, 'projects': 16, 'responsiveAssets': 48, 'samples': 192,
            'unchangedCurrentResponsiveAssets': unchanged, 'updatedCurrentResponsiveAssets': 6,
            'preservedOriginalCoverFiles': 60, 'allOriginalCoverHashesMatch': True,
            'allSourceAndOutputHashesMatch': True, 'originalModelsAndPhotosUnchanged': True,
            'animationCovers': animation_checks, 'originalPreservation': protection,
            'photoBasedModels': ['materialTest', 'ftc'],
            'total480Bytes': sum(record['variants'][0]['bytes'] for record in manifest),
            'total960Bytes': sum(record['variants'][1]['bytes'] for record in manifest)}


if __name__ == '__main__':
    result = validate()
    output = EVIDENCE / 'catalog-validation.json'
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(result, indent=2))
