"""Validate all shared initial covers without depending on homepage markup."""
import json
import importlib.util
from pathlib import Path

from PIL import Image

from pack_initial_covers import ROOT, EVIDENCE, CATALOG, RUNTIME, DESCRIPTIONS, read_json, sha, proof_audit, preserved_files, url, verify_renderer_source


def main():
    baseline = read_json(EVIDENCE / 'covers-baseline.json')
    manifest = read_json(ROOT / 'assets/exploded/manifest.json')
    assert manifest == baseline['animationManifest']
    preserved = preserved_files(baseline)
    runtime = read_json(RUNTIME)
    catalog = {record['project']: record for record in read_json(CATALOG)}
    assert runtime['version'] == 1 and runtime['revision'] == 'case-pages-20260913'
    assert set(runtime['projects']) == set(catalog) == set(manifest['projects']) == set(DESCRIPTIONS)
    records = []
    for key, card in runtime['projects'].items():
        assert card['coverProgress'] == 0 and card['width'] == 1800 and card['height'] == 1200
        assert card['sourceFrame'] == manifest['projects'][key]['frames'][0]
        assert card['sourceFrameSha256'] == sha(ROOT / card['sourceFrame'].split('?')[0])
        variants = card['variants']
        assert variants == catalog[key]['variants']
        assert [(variant['width'], variant['height']) for variant in variants] == [(480, 320), (960, 640), (1800, 1200)]
        assert card['src'] == url(variants[-1])
        assert card['srcset'] == ', '.join(f'{url(variant)} {variant["width"]}w' for variant in variants)
        for variant in variants:
            path = ROOT / variant['src']
            assert path.stat().st_size == variant['bytes'] and sha(path) == variant['sha256']
            with Image.open(path) as image:
                assert image.mode == 'RGB' and image.size == (variant['width'], variant['height'])
        public_path = ROOT / card['provenance'].split('?')[0]
        assert card['provenance'].endswith('?v=' + sha(public_path)[:12])
        public = read_json(public_path)
        evidence = read_json(EVIDENCE / 'covers' / key / 'initial-cover-provenance.json')
        assert public['masterSha256'] == evidence['masterSha256'] == sha(Path(evidence['masterPNG']))
        assert evidence['sceneSha256BeforeResolutionChange'] == evidence['sceneSha256AfterResolutionChange']
        assert evidence['cameraFrameMaximumError'] < 2e-6
        assert public['sourceFrameSha256'] == card['sourceFrameSha256']
        audit = proof_audit(evidence)
        assert public['proofPixelAudit'] == catalog[key]['renderProvenance']['proofPixelAudit'] == audit
        assert catalog[key]['renderProvenance']['coverProgress'] == 0
        assert public['offlineRendererSource'] == verify_renderer_source(public)
        assert public['animationRendererSha256'] == sha(ROOT / public['animationRenderer'])
        records.append({'project': key, 'sourceFrame': card['sourceFrame'], 'proofPixelAudit': audit,
            'cameraFrameMaximumError': evidence['cameraFrameMaximumError'], 'coverSamples': public['samples']})
    # Retain the prior exact CAD and original-gallery protection, with the
    # currently published release as the comparison baseline.
    legacy_path = ROOT / 'tools/editorial-render/validate_catalog.py'
    specification = importlib.util.spec_from_file_location('initial_cover_source_protection', legacy_path)
    legacy = importlib.util.module_from_spec(specification)
    specification.loader.exec_module(legacy)
    legacy.BASELINE_COMMIT = baseline['commit']
    protection = legacy.check_original_models_and_galleries()
    report = {'passed': True, 'result': 'pass', 'projectCount': len(records), 'responsiveAssets': len(records) * 3,
        'allCoversUseInitialPose': True, 'allProjectionAndSceneChecksPassed': True,
        'preservedFiles': preserved, 'animationManifestUnchanged': True,
        'preservedAnimationFrames': sum(len(project['frames']) for project in manifest['projects'].values()),
        'preservedChunks': sum(len(project['chunks']) for project in manifest['projects'].values()),
        'sourceFrameBytes': sum(project['bytes'] for project in manifest['projects'].values()),
        'samples': 192, 'originalModelsAndPhotosUnchanged': True, 'originalPreservation': protection,
        'runtimeCatalogSha256': sha(RUNTIME), 'projects': records}
    (EVIDENCE / 'initial-cover-validation.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({key: value for key, value in report.items() if key != 'projects'}))


if __name__ == '__main__':
    main()
