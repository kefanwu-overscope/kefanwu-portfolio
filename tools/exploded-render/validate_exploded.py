"""Validate the mixed animation revision and current/preserved cover assets."""
if __name__ == '__main__':
    import subprocess as _subprocess
    import sys as _sys
    import json as _json
    from pathlib import Path as _Path
    _site = _Path(__file__).resolve().parents[2]
    _detail = _site / 'assets/exploded/manifest-detail.json'
    if _detail.is_file() and _json.loads(_detail.read_text(encoding='utf-8')).get('revision') == 'detail-resolution-20260914':
        raise SystemExit(_subprocess.call([_sys.executable, '-X', 'utf8', str(_site / 'tools/exploded-render/validate_detail.py'), *_sys.argv[1:]]))
    if (_site / 'assets/editorial/animation-covers.json').is_file():
        raise SystemExit(_subprocess.call([_sys.executable, '-X', 'utf8', str(_site / 'tools/exploded-render/validate_initial_covers.py')]))

import hashlib
import json
import math
from pathlib import Path
from urllib.parse import urlsplit, parse_qs
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
REVISION = ROOT.parent / '.codex/motion-refinement-20260913'
CURRENT = ROOT.parent / '.codex/motion-loading-20260913'
PREVIOUS = ROOT.parent / '.codex/functional-motion-20260913'
CHANGED = {'javelin', 'telecaster'}
CHANGED_COVERS = {'vineRobot', 'education'}
EXPECTED_MODES = {
    'steering': 'steering', 'vineRobot': 'extension', 'javelin': 'flight', 'telecaster': 'turntable',
    'brakeSim': 'heat', 'aura': 'assembly', 'scanner': 'gantry',
    'carbonSeat': 'layup', 'seat': 'unfold', 'materialTest': 'tensile',
    'ansysCfd': 'flow', 'pool': 'retract_release', 'lineFollower': 'drive_sway',
    'formlabs': 'gantry', 'education': 'assembling', 'ftc': 'reconstruction',
}
LONG_SEQUENCES = {'vineRobot', 'materialTest', 'aura', 'pool'}
PERIODIC = {'steering', 'scanner', 'formlabs', 'ansysCfd', 'pool', 'lineFollower', 'telecaster'}


def read_json(path):
    return json.loads(path.read_text(encoding='utf-8'))


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def near(actual, expected):
    return math.isclose(actual, expected, rel_tol=1e-6, abs_tol=1e-8)


def checked_stages(key, motion):
    for stage in motion['stages']:
        checks = stage['verification']
        assert checks['newContinuousTriangleContacts'] == 0, (key, stage['group'])
        assert checks['floorCrossings'] == 0, (key, stage['group'])
        assert checks['continuousTriangleTests'] >= 0


def refined_mechanism(key, motion, frame_count):
    folder = REVISION / 'kinematics'
    audit = read_json(folder / f'mechanism-{key}-validation.json')
    invariants = read_json(folder / f'{key}-invariants.json')
    assert not audit['newContactPairs'] and audit['exactResetMaxMatrixError'] == 0
    assert audit['preservedTriangles'] == motion['preservedTriangles']
    assert audit['sourcePartCount'] == motion['sourcePartCount']
    assert audit['sampledPoses'] >= frame_count and audit['minVertexZ'] >= 0
    assert invariants['meshesAndMaterialsPreserved'] is True
    assert invariants['geometryAndMaterialHashBefore'] == invariants['geometryAndMaterialHashAfter']
    assert invariants['outputPoseCount'] == frame_count
    assert invariants['forwardReverseRandomAndArbitraryChecks'] >= 3 * frame_count
    assert invariants['seekMaxMatrixError'] == invariants['sourceEndpointMaxMatrixError'] == 0
    assert invariants['maxAxisOrGuideDrift'] < 1e-6 and invariants['minVertexZ'] >= 0
    assert motion['periodic'] is True
    if key == 'steering':
        assert motion['wheelRangeDegrees'] == audit['wheelRangeDegrees'] == [-90, 0]
        assert motion['rackRange'] == audit['rackRange'] == [-.1, 0]
    elif key == 'pool':
        assert motion['mode'] == 'retract_release' and near(motion['stroke'], .14)
        assert motion['pinionTeeth'] == 20 and near(motion['rackPitch'], .037968)
        assert near(motion['pinionPitchRadius'], motion['rackPitch'] * 20 / (2 * math.pi))
        assert motion['sprocketTeeth'] == {'motor': 14, 'driven': 28}
        assert [(p['start'], p['end']) for p in motion['phases']] == [
            (0, .64), (.64, .72), (.72, .84), (.84, 1)]
        clearance = motion['strokeClearance']
        assert clearance['firstNewSolidContactTravel'] > motion['stroke']
        assert near(clearance['margin'], clearance['firstNewSolidContactTravel'] - motion['stroke'])
        # Source tooth interference is recorded separately from new pairs.
        fits = motion['sourceFitLimitations']
        for component in ('rackPinion', 'motorCoupling', 'rackSupport'):
            assert 0 < fits[component + 'SourceSampledOverlap'] <= fits[component + 'MaximumSampledOverlap']
        assert fits['interpretation'] and audit['baselineSampledPenetrationDepth']
    else:
        assert motion['mode'] == 'drive_sway' and motion['yawRangeDegrees'] == [-10, 10]
        assert motion['nominalWheelRevolutions'] == 2 and len(motion['wheelAxes']) == 2
        assert all(axis['direction'] == [1, 0, 0] for axis in motion['wheelAxes'])


def validate_motion(key, project, provenance, frame_count):
    motion = provenance['motion']
    if key in ('steering', 'pool', 'lineFollower'):
        refined_mechanism(key, motion, frame_count)
    elif key == 'aura':
        audit = read_json(REVISION / 'aura/verification.json')
        assert motion['mode'] == 'assembly' and motion['frameCount'] == frame_count == 145
        assert motion['movingStageCount'] == len(motion['stages']) == audit['stages'] == 11
        assert motion['sourceComponentCount'] == audit['sourceComponentCount'] == 37
        assert motion['geometryTriangles'] == 106314 and motion['sourceGeometryChanges'] == []
        assert len(motion['sourceSurfaceContacts']) == 35
        assert motion['geometryDigest'] == audit['geometryDigest']
        assert audit['passed'] is True and audit['seekChecks'] >= 435
        assert audit['maximumMatrixDrift'] == audit['assembledPoseMatrixDrift'] == 0
        assert audit['newContinuousTriangleContacts'] == audit['floorCrossings'] == 0
        assert audit['positivePathSamples'] == sum(s['verification']['positiveSamples'] for s in motion['stages']) >= 1100
        assert audit['continuousTriangleTests'] == sum(s['verification']['continuousTriangleTests'] for s in motion['stages']) > 0
        assert motion['floorMinimum'] == audit['floorMinimum'] >= 0
        checked_stages(key, motion)
    elif key in ('brakeSim', 'carbonSeat', 'seat'):
        assert project['mode'] == {'brakeSim': 'heat', 'carbonSeat': 'layup', 'seat': 'unfold'}[key]
        assert not provenance.get('sectionPolicy')
        if key == 'carbonSeat':
            audit = read_json(REVISION / 'materials/material-consistency-verification.json')['carbon']
            assert motion['layerCount'] == audit['visiblePlyCountAtEnd'] == 10
            assert audit['sampleCount'] >= 363
            for field in ('geometryMatchesPreviousAtEverySeek', 'sourceMeshPositionsUnchanged',
                          'sameMaterialDatablockOnShellAndTenPlies', 'allOriginalShaderNodesAndInputsUnchanged',
                          'sourceCoordinatesExactlyEqualOnAllPliesAtAllSeeks',
                          'phaseFrequencyRotationAndColorMatchAtCorrespondingPoints'):
                assert audit[field] is True, (key, field)
            appearance = motion['appearance']
            assert appearance == audit['motion']['appearance']
            assert appearance['coordinateAttribute'] == 'Carbon cover source Generated coordinates'
            assert appearance['additionalWeaveRotation'] == 0 and appearance['checkerScale'] == 240
            assert len(appearance['sourceTextureSpaces']) == 1
            assert appearance['sourceTextureSpaces'][0]['object'] == 'mat_carbon'
            for field, value in {'roughness': .5, 'metallic': 0, 'specular': .25, 'coat': .12,
                                 'bumpStrength': .05, 'bumpDistance': .0002}.items():
                assert near(appearance[field], value), (key, field)
    elif key == 'ftc':
        assert motion['version'] >= 13 and motion['stages'], (key, 'missing checked motion')
        checked_stages(key, motion)
    elif key == 'education':
        assert motion['passed'] is True and len(motion['stages']) == 23
        for stage in motion['stages']:
            checks = stage['verification']
            if 'newContinuousTriangleContacts' in checks:
                assert checks['newContinuousTriangleContacts'] == checks['floorCrossings'] == 0
                assert not checks.get('initialSeamExtensionUsed', False)
            else:
                assert checks['passed'] is True
    elif key in ('javelin', 'telecaster'):
        audit = read_json(CURRENT / 'poses' / f'{key}-motion-verification.json')
        assert audit['controllerSha256'] == sha256(ROOT / 'tools/exploded-render/display_motion.py')
        assert motion == audit['controller'], (key, 'rendered controller differs from audited controller')
        assert audit['geometryAndMaterialsUnchanged'] and audit['sourcePoseMatrixError'] == 0
        assert audit['poseCount'] == frame_count == 121 and audit['seekEvaluations'] >= 363
        assert audit['forwardReverseRandomMatrixDrift'] == 0
        assert audit['fixedRelativePlacementMaximumError'] < 1e-6
        assert near(provenance['cameraMaximumScale'], audit['recommendedFixedScale'])
        assert provenance['groundZ'] <= audit['sampledMotionBounds'][0][2]
        if key == 'javelin':
            assert motion['rotorCount'] == 4 and motion['sourceMotorBasesFixedInAirframe']
            assert motion['periodicAirframe'] and motion['mode'] == 'flight'
            assert audit['rotorRelativeAxisMaximumError'] < 1e-6
            assert audit['rotorRelativeHubCenterMaximumError'] < 1e-6
            assert provenance['groundZ'] <= motion['presentation']['groundZMaximum'] + 1e-6
        else:
            assert motion['mode'] == 'turntable' and motion['axis'] == [0, 0, 1]
            assert motion['assembledRigidBody'] and motion['partRelativeTransformsPreserved']
            assert motion['turns'] == 1 and audit['angleDegrees'] == 360
            assert audit['endpointSourceMatrixError'] == 0
    elif key == 'vineRobot':
        assert motion['sourceHardwareFixed'] and motion['thinWallThickness'] > 0
    elif key == 'materialTest':
        audit = read_json(REVISION / 'materials/material-consistency-verification.json')['tensile']
        assert motion['fixedLowerFixture'] and near(motion['fractureProgress'], .74)
        assert motion['retainedHalves'] == 2 and motion['specimenColorSRGB'] == 'F27A2A'
        assert audit['sampleCount'] >= 435 and audit['motion']['specimenColorSRGB'] == motion['specimenColorSRGB']
        for field in ('geometryMatchesPreviousAtEverySeek', 'forwardReverseRandomSeek',
                      'onlyBaseColorChanged', 'staticSourceAndRetainedHalvesShareMaterial'):
            assert audit[field] is True, (key, field)
    elif key in ('scanner', 'formlabs'):
        audit = read_json(PREVIOUS / f'mechanism-{key}-validation.json')
        assert not audit['newContactPairs'] and audit['exactResetMaxMatrixError'] == 0
        assert audit['preservedTriangles'] == motion['preservedTriangles']
    elif key == 'ansysCfd':
        cfd = PREVIOUS / 'cfd'
        solve = read_json(cfd / 'solution-audit.json')
        fields = read_json(cfd / 'flow-provenance.json')
        assert sha256(cfd / 'flow-data.npz') == fields['dataSha256'] == motion['dataSha256'] == solve['flowDataSha256']
        assert solve['iterations'] == 400 and solve['sourceHashVerified']
        assert motion['pressureRangePa'] == solve['pressureRangePa']
        assert motion['surfaceTriangles'] == 47450 and motion['sourcePaths'] == 49
        assert motion['displayedPaths'] > 0 and motion['displayedPolylineSegmentWallCrossings'] == 0
        assert motion['pressureClipping'] is False and motion['originalMonitorHidden']
        assert motion['pathTimeMethods'] == ['particle-time']
    else:
        raise AssertionError((key, 'missing validation policy'))


def cover_asset(variant):
    path = ROOT / variant['src']
    assert path.resolve().is_relative_to((ROOT / 'assets/editorial').resolve()), path
    assert sha256(path) == variant['sha256'], str(path)
    assert path.stat().st_size == variant['bytes'], str(path)
    with Image.open(path) as image:
        image.load()
        assert image.size == (variant['width'], variant['height']), str(path)
        assert image.format == 'WEBP' and not getattr(image, 'is_animated', False)


def validate_covers():
    current = read_json(ROOT / 'tools/editorial-render/catalog-manifest.json')
    baseline = read_json(CURRENT / 'baseline-catalog.json')
    old = {p['project']: p for p in baseline}
    assert len(current) == len(baseline) == 16
    assert {p['project'] for p in current} == set(old) == set(EXPECTED_MODES) | {'telecaster'}
    baseline_paths = {v['src'] for p in baseline for v in p['variants']}
    assert len(baseline_paths) == 48
    for project in baseline:
        for variant in project['variants']:
            cover_asset(variant)
    mappings = []
    unchanged = replaced = current_count = 0
    current_paths = set()
    for project in current:
        key = project['project']
        prior = {(v['width'], v['height']): v for v in old[key]['variants']}
        assert len(project['variants']) == len(prior) == 3, key
        assert {(v['width'], v['height']) for v in project['variants']} == set(prior), key
        for variant in project['variants']:
            cover_asset(variant)
            current_count += 1
            current_paths.add(variant['src'])
            previous = prior[(variant['width'], variant['height'])]
            if key in CHANGED_COVERS:
                assert variant['src'] not in baseline_paths and variant['sha256'] != previous['sha256'], key
                replaced += 1
            else:
                assert variant == previous, (key, 'unrelated cover changed')
                unchanged += 1
            mappings.append({'project': key, 'width': variant['width'], 'height': variant['height'],
                             'previous': previous['src'], 'current': variant['src'],
                             'status': 'replaced_reference_original_preserved' if key in CHANGED_COVERS else 'unchanged_reference'})
    assert current_count == len(current_paths) == 48 and unchanged == 42 and replaced == 6
    return {'currentCoverFilesVerified': 48, 'baselineCoverFilesPreserved': 48,
            'currentCoverReferencesUnchanged': 42, 'currentCoverReferencesReplaced': 6,
            'changedCoverProjects': sorted(CHANGED_COVERS), 'coverMappings': mappings}


def main():
    manifest = read_json(ROOT / 'assets/exploded/manifest.json')
    baseline = read_json(CURRENT / 'baseline-animation-manifest.json')
    assert manifest['version'] == 1 and set(manifest['projects']) == set(EXPECTED_MODES)
    from pack_frame_chunks import TRANSPORT_FIELDS, verify_project, transport_metadata
    records = []
    for key, project in manifest['projects'].items():
        frame_count = 145 if key in LONG_SEQUENCES else 121
        changed = key in CHANGED
        asset_revision = 'flight-20260913' if changed else Path(baseline['projects'][key]['provenance']).parts[-3]
        motion_revision = 'motion-loading-20260913' if changed else 'motion-refinement-20260913' if asset_revision == 'refined-20260913' else 'functional-motion-20260913'
        assert len(project['frames']) == frame_count, (key, len(project['frames']))
        assert project['mode'] == EXPECTED_MODES[key], (key, 'wrong functional mode')
        assert project['poster'] == project['frames'][0], key
        assert project['width'] * project['height'] * 4 * frame_count <= 160 * 1024 * 1024, (key, 'decoded memory budget')
        if not changed:
            assert {k: v for k, v in project.items() if k not in TRANSPORT_FIELDS} == baseline['projects'][key], (key, 'previous animation metadata changed')
        asset_root = ROOT / 'assets/exploded' / asset_revision / key
        assert project['provenance'] == (asset_root / 'provenance.json').relative_to(ROOT).as_posix()
        provenance = read_json(asset_root / 'provenance.json')
        assert provenance['project'] == key and provenance['frameCount'] == frame_count
        assert provenance['mode'] == project['mode']
        assert (provenance['width'], provenance['height']) == (project['width'], project['height'])
        assert len(provenance['encodedFrames']) == frame_count
        hashes = set()
        size = 0
        for index, frame in enumerate(project['frames']):
            url = urlsplit(frame)
            assert not url.scheme and not url.netloc and not url.fragment, (key, index, 'nonlocal frame URL')
            path = ROOT / url.path
            assert path.resolve().is_relative_to(asset_root.resolve()), (key, index, path)
            raw = path.read_bytes()
            digest = hashlib.sha256(raw).hexdigest()
            hashes.add(digest)
            size += len(raw)
            encoded = provenance['encodedFrames'][index]
            assert path.name == encoded['file'] == f'{index:02d}.webp', (key, index, 'frame order')
            assert len(raw) == encoded['bytes'] and digest == encoded['sha256'], (key, index, 'hash/bytes')
            assert parse_qs(url.query).get('v') == [digest[:12]], (key, index, 'cache revision')
            with Image.open(path) as image:
                image.load()
                assert image.size == (project['width'], project['height']), (key, index, image.size)
                assert image.format == 'WEBP' and not getattr(image, 'is_animated', False)
        assert len(hashes) >= frame_count * .42, (key, 'too few distinct states for a reversible cycle')
        encoded = provenance['encodedFrames']
        if key not in PERIODIC:
            assert encoded[0]['sha256'] != encoded[-1]['sha256'], key
        if key == 'pool':
            # The cue returns to its exact source pose. Check its charged
            # middle state rather than requiring different endpoint images.
            assert encoded[round(.68 * (frame_count - 1))]['sha256'] != encoded[0]['sha256'], 'pool charged state is unchanged'
        assert size == project['bytes'] and size < 5 * 1024 * 1024, (key, size)
        assert provenance['samples'] == 48 and provenance['motionRevision'] == motion_revision
        assert not any(field in provenance for field in ('parts', 'groups', 'geometryComponents')), (key, 'obsolete heuristic offsets')
        validate_motion(key, project, provenance, frame_count)
        chunk_check = verify_project(key, project, project, ROOT, ROOT / 'assets/exploded/manifest.json', ROOT)
        assert chunk_check['allSlicesEqualOriginalBytes'] and chunk_check['contentByteOverhead'] == 0
        records.append({'project': key, 'frames': frame_count, 'bytes': size, 'mode': project['mode'],
                        'chunks': chunk_check['chunkCount'], 'maxChunkBytes': chunk_check['maxChunkBytes'],
                        'distinctStates': len(hashes), 'assetRevision': asset_revision, 'motionRevision': motion_revision})
    assert manifest['chunkTransport'] == transport_metadata(manifest)
    covers = validate_covers()
    result = {'projects': records, 'totalFrames': sum(p['frames'] for p in records),
              'totalFrameBytes': sum(p['bytes'] for p in records), 'newAnimationProjects': sorted(CHANGED),
              'totalChunks': sum(p['chunks'] for p in records), 'chunkImageBytesUnchanged': True,
              'previousAnimationEntriesPreserved': len(EXPECTED_MODES) - len(CHANGED), **covers, 'result': 'pass'}
    CURRENT.mkdir(parents=True, exist_ok=True)
    (CURRENT / 'asset-validation.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
