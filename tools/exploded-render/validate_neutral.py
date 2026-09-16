"""Validate the complete neutral-studio SD/HD/cover publication contract.

Requires Python 3.10+ and Node.js, the current checkout, and no Blender, Git or
private masters. Binary hashes are exact. Only parsed JSON provenance permits
LF/CRLF-equivalent hashes. Public preservation evidence is checked for internal
consistency; source-scene geometry and pixel proofs are separate release checks.
Nothing is written unless --report is supplied.
"""
import argparse
import copy
import json
import math
import re
import shutil
import subprocess
from pathlib import Path
from urllib.parse import urlsplit

import validate_detail as previous

ROOT = Path(__file__).resolve().parents[2]
REVISION = 'neutral-20260915'
require = previous.require
close_values = previous.close_values
MODES = previous.MODES
COVER_SIZES = previous.COVER_SIZES


def sha256_value(value, label):
    require(isinstance(value, str) and re.fullmatch(r'[0-9a-f]{64}', value),
            label + ': malformed SHA-256')


def zero(value, label):
    require(type(value) in (int, float) and math.isfinite(value) and value == 0,
            label + ': expected zero error')


def studio_recipe(studio):
    """Compare the common recipe, retaining camera-relative placement freedom."""
    require(studio['revision'] == REVISION, 'Studio revision differs')
    require(studio['variant'] in ('flat', 'contact'), 'Unknown neutral studio variant')
    for field in ('backgroundLinearRGB', 'worldLightingLinearRGB', 'backgroundDisplayRGB'):
        values = studio[field]
        require(isinstance(values, list) and len(values) == 3
                and all(type(v) in (int, float) and math.isfinite(v) for v in values)
                and min(values) == max(values), 'Studio is not achromatic: ' + field)
    require(studio['backgroundDisplayRGB'] == [25, 25, 25], 'Studio background is not #191919')
    require(studio['worldStrength'] > 0, 'Studio ambient lighting is disabled')
    recipe = copy.deepcopy(studio)
    recipe.pop('lightingTarget')
    require(len(recipe['lights']) == 4, 'Expected four neutral studio area lights')
    for light in recipe['lights']:
        require(light['color'] == [1, 1, 1], 'A studio lamp has colored illumination')
        require(light['energy'] > 0 and light['size'] > 0 and light['sizeY'] > 0,
                'Invalid neutral lamp dimensions/energy')
        for field in ('location', 'rotation'):
            values = light.pop(field)
            require(len(values) == 3 and all(math.isfinite(v) for v in values),
                    'Invalid neutral lamp placement')
    return recipe


def previous_camera(key, current, old_timings, index):
    """Check known stale historical matrix metadata without relaxing cameras.

The previous wrapper recorded camera.location after assigning it but read
matrix_world before dependency evaluation. Only AURA and Seat animate that
translation. Their recorded matrices therefore contain the preceding frame's
translation although Blender renders the current camera.location. Verify that
exact pattern before substituting the original current location into the
historical matrix; every other matrix term and camera field remains exact.
"""
    prior = old_timings[index]['camera']
    if key not in ('aura', 'seat'):
        close_values(current, prior, key + f' prior camera {index}')
        return
    expected = copy.deepcopy(prior)
    previous_location = old_timings[max(0, index - 1)]['camera']['location']
    close_values([prior['matrixWorld'][axis][3] for axis in range(3)], previous_location,
                 key + f' proven historical matrix lag {index}', tolerance=0)
    for axis in range(3):
        expected['matrixWorld'][axis][3] = prior['location'][axis]
    close_values(current, expected, key + f' exact original camera {index}', tolerance=0)


class Validator(previous.Validator):
    def linked_json(self, record, field, label):
        data = self.asset(record[field])
        self.verify_hash(data, record[field + 'Sha256'], label + ' ' + field, json_text=True)
        return json.loads(data)

    def sequence(self, key, record, dimensions, detail=False):
        # The inherited check supplies complete WebP/cache/chunk/SHA validation;
        # its historical HD-only lighting contract does not apply to this release.
        source, checked = super().sequence(key, record, dimensions, detail=False)
        if detail:
            require(record.get('streaming') is True, key + ': HD streaming is disabled')
        else:
            require(record.get('streaming') is not True, key + ': homepage unexpectedly enables HD streaming')
        require(source['motionRevision'] == REVISION and source['samples'] == 48,
                key + ': wrong neutral render revision/samples')
        require(source['complete'] is True and source['renderedFrameCount'] == checked['frames'],
                key + ': incomplete native source sequence')
        require(source['sourceDimensions'] == [640, 427], key + ': source projection dimensions differ')
        require(source['nativeRerender'] is True and source['imageUpscaling'] is False
                and source['sourceMasterDimensions'] == [1280, 854], key + ': native master contract differs')
        require(source['encoding']['nativeResolution'] is detail
                and source['encoding']['rasterRetouching'] is False, key + ': encoding policy differs')
        count = checked['frames']
        require(len(source['sourcePNGFrames']) == len(source['timings']) == count,
                key + ': missing native PNG/camera records')
        for index, (png, pose) in enumerate(zip(source['sourcePNGFrames'], source['timings'])):
            require(png['index'] == pose['index'] == index, key + ': noncanonical source order')
            require(png['file'] == pose['file'] == f'{index:02d}.png'
                    and png['bytes'] == pose['bytes'] and png['bytes'] > 0,
                    key + ': native source PNG file/bytes differ')
            sha256_value(png['sha256'], key + ' source PNG')
            require(pose['sha256'] == png['sha256'], key + ': camera record refers to different PNG')
            require(abs(pose['progress'] - index / (count - 1)) <= 1e-12,
                    key + ': native progress differs from frame index')
            zero(pose['cameraProjectionMaximumError'], key + ' native projection')
            close_values(pose['camera'], pose['camera'], key + ' finite camera', tolerance=0)
        selected = [0, (count - 1) // 2, count - 1]
        require([row['index'] for row in source['backgroundVerification']] == selected,
                key + ': missing native background sample evidence')
        for check in source['backgroundVerification']:
            require(check['cornersRGB'] == [[25, 25, 25]] * 4 and check['maximumCornerDeviation'] == 0,
                    key + ': source master background differs from #191919')
        for index in selected:
            check = source['encodedFrames'][index]['backgroundVerification']
            require(check['maximumCornerDeviation'] <= 1 and len(check['cornersRGB']) == 4
                    and all(len(rgb) == 3 and min(rgb) == max(rgb)
                            and max(abs(v - 25) for v in rgb) <= 1 for rgb in check['cornersRGB']),
                    key + ': encoded frame background differs beyond WebP rounding')
        return source, checked

    def preservation(self, key, source):
        evidence = source['sourcePreservation']
        require(evidence['status'] == 'passed' and evidence['project'] == key,
                key + ': failed/mismatched studio source-preservation evidence')
        require(evidence['modelGeometryMaterialsUnchangedByStudio'] is True,
                key + ': studio altered model geometry/materials')
        zero(evidence['modelPoseMaximumMatrixError'], key + ' studio model pose')
        sha256_value(evidence['sourceGeometryAndMaterials']['sha256'], key + ' geometry/materials')
        old = self.linked_json(evidence, 'sourceAnimationProvenance', key)
        old_hd = self.linked_json(evidence, 'previousHDAnimationProvenance', key)
        old_cover = self.linked_json(evidence, 'previousCoverProvenance', key)
        require(old['project'] == old_hd['project'] == old_cover['project'] == key,
                key + ': linked prior sources identify another project')
        require(old['mode'] == old_hd['mode'] == source['mode'], key + ': source mode changed')
        require(old['frameCount'] == old_hd['frameCount'] == source['frameCount'],
                key + ': source frame count changed')
        changed = key == 'carbonSeat'
        require(evidence['sourceMotionReportUnchanged'] is (not changed)
                and evidence['carbonMotionRevisionAuthorized'] is changed,
                key + ': unexpected motion-change authorization')
        if not changed:
            prior_motion = copy.deepcopy(old['motion'])
            if key == 'formlabs' and prior_motion != source['motion']:
                require(prior_motion['leadscrew']['calibration'] != source['motion']['leadscrew']['calibration'],
                        key + ': unexplained source motion difference')
                prior_motion['leadscrew']['calibration'] = source['motion']['leadscrew']['calibration']
            require(prior_motion == source['motion'] == old_hd['motion'], key + ': preserved source motion differs')
            require(source['sourceComponentNames'] == old_hd['sourceComponentNames'],
                    key + ': source components differ from prior HD render')
            if 'sourceComponentNames' in old:
                require(source['sourceComponentNames'] == old['sourceComponentNames'],
                        key + ': source components differ from prior SD render')
            else:
                # These two earliest material-process SD reports predate this
                # metadata field. Their committed HD reports explicitly carry
                # the empty source-name list; geometry/motion/cameras remain
                # independently checked against both original render records.
                require(key in ('brakeSim', 'seat') and source['sourceComponentNames'] == [],
                        key + ': unexplained missing prior SD component-name record')
            require(evidence['p0PreviousCoverCameraMaximumError'] < 2e-6,
                    key + ': camera differs from previous cover')
            close_values(source['timings'][0]['camera'], old_cover['camera'], key + ' previous p0')
            for pose in source['timings']:
                index = pose['index']
                if key == 'education':
                    for field, camera_field in (('cameraLocation', 'location'), ('cameraRotation', 'rotation'),
                                                ('cameraOrthoScale', 'orthoScale')):
                        close_values(pose['camera'][camera_field], old_hd[field], key + ' static camera ' + field)
                else:
                    previous_camera(key, pose['camera'], old_hd['timings'], index)
        return studio_recipe(evidence['studio'])

    def carbon(self, source):
        audit, motion = source['carbonGeometryVerification'], source['motion']
        require(audit['status'] == 'passed' and audit['motion'] == motion,
                'Carbon: geometry proof does not describe the rendered motion')
        for field in ('sourceMeshPositionsTopologyTransformsUnchanged', 'completedStageVisibleGeometryIdentical',
                      'originalShaderNodesAndInputsUnchanged', 'sourceMaterialOpaque',
                      'carbonSourceCoordinateMappingUnchangedAcrossAllSeeks', 'cameraTransformScaleUnchangedByController',
                      'sourceMaterialNodeValuesMatchBaseline', 'sourceShellRoughnessUnchanged',
                      'sourceSkinTrianglesRetainedWithoutHoles'):
            require(audit[field] is True, 'Carbon: failed preservation invariant ' + field)
        close_values(audit['sourceShellBounds'], audit['completedStageBounds'], 'Carbon completed bounds', tolerance=0)
        require(audit['finalDimensionsGrowth'] == [0, 0, 0] and audit['completedStageChecks'] == 11
                and audit['completedStageVisibleClothSurfaces'] == 0
                and audit['maximumSimultaneousClothSurfaces'] == 1
                and audit['offsetDependsOnStageIndex'] is False and audit['clothSolidifyModifiers'] == 0,
                'Carbon: completed shell accumulates visible thickness')
        require(motion['finishedShellGeometryInvariant'] is True and motion['illustrativePlySpacing'] == 0
                and motion['maximumSimultaneousClothSurfaces'] == 1 and motion['layerCount'] == 10,
                'Carbon: motion contract does not preserve the finished shell')
        require(audit['forwardReverseRandomSeekChecks'] >= 726
                and audit['independentCollisionLocalPoseSamples'] >= 401
                and audit['collisionTrianglePairs'] == audit['opaqueSeatedVertexErrors'] == 0
                and audit['minimumPositiveSourceOffset'] > 0,
                'Carbon: source contact/seek proof failed or is incomplete')
        self.verify_hash(self.asset('models/real/seat.glb'), audit['sourceFileSha256'], 'Carbon original source GLB')
        source_check = audit['baselineSourceFileChecks']['models/real/seat.glb']
        require(source_check['matchesBaseline'] is True
                and source_check['baselineBlobSha256'] == source_check['checkoutSha256'] == audit['sourceFileSha256'],
                'Carbon: original source model does not match the committed baseline')
        require(motion['appearance']['roughness'] == .5
                and motion['appearance']['clothRoughnessTransition']['sourceShell'] == .5
                and motion['appearance']['clothRoughnessTransition']['liftedCloth'] == audit['liftedClothRoughnessOnly'],
                'Carbon: original source-shell roughness or authorized moving-cloth roughness differs')
        require(audit['controllerSha256'] == source['sourcePreservation']['sourceFiles']['tools/exploded-render/material_processes.py'],
                'Carbon: geometry proof and rendered controller hashes differ')
        endpoints = [pose for pose in audit['selectedPoses'] if pose['progress'] in (0, .5, 1)]
        require([pose['progress'] for pose in endpoints] == [0, .5, 1]
                and len({pose['visibleDigest'] for pose in endpoints}) == 1,
                'Carbon: selected completed-stage silhouettes/geometry differ')
        for pose in endpoints:
            close_values(pose['visiblePresentationBounds'], audit['sourceShellBounds'], 'Carbon selected bounds', tolerance=0)
            require(pose['visibleClothSurfaces'] == 0, 'Carbon: completed overlay remains visible')

    def cover(self, key, card, catalog, home, source, hd_source):
        label = key + ' cover'
        require(card['coverProgress'] == 0 and (card['width'], card['height']) == (1800, 1200),
                label + ': expected native initial-pose cover')
        require(card['sourceFrame'] == home['frames'][0], label + ': wrong source frame')
        self.verify_hash(self.asset(card['sourceFrame'], hashed=True), card['sourceFrameSha256'], label)
        variants = card['variants']
        require([(v['width'], v['height']) for v in variants] == COVER_SIZES and variants == catalog['variants'],
                label + ': responsive variants differ')
        require(card['src'] == self.variant_url(variants[-1])
                and card['srcset'] == ', '.join(f'{self.variant_url(v)} {v["width"]}w' for v in variants),
                label + ': incorrect responsive URLs')
        require(isinstance(card['alt'], str) and card['alt'].strip(), label + ': missing alt text')
        for variant in variants:
            data = self.asset(self.variant_url(variant), hashed=True)
            self.verify_hash(data, variant['sha256'], variant['src'])
            require(len(data) == variant['bytes'] and previous.chunks.webp_size(data) == (variant['width'], variant['height']),
                    label + ': variant dimensions/bytes differ')
        public = self.read(card['provenance'], hashed=True)
        require(public['project'] == key and public['variants'] == variants, label + ': provenance differs')
        for field in ('sourceFrame', 'sourceFrameSha256', 'coverProgress'):
            require(public[field] == card[field], label + ': provenance differs: ' + field)
        require(public['dimensions'] == [1800, 1200] and public['samples'] == 192
                and public['sourceFrameCount'] == len(home['frames'])
                and public['sourceDimensions'] == [640, 427] and public['sourceMasterDimensions'] == [1280, 854]
                and public['sourceAnimationRevision'] == REVISION,
                label + ': native master/source contract differs')
        sha256_value(public['masterSha256'], label + ' native master')
        require(public['sourceAnimationProvenance'] == home['provenance'], label + ': wrong source animation')
        self.verify_hash(self.asset(home['provenance']), public['sourceAnimationProvenanceSha256'],
                         label + ' source provenance', json_text=True)
        require(type(public['cameraFrameMaximumError']) in (int, float)
                and 0 <= public['cameraFrameMaximumError'] < 2e-6,
                label + ': native master projection differs')
        close_values(public['camera'], hd_source['timings'][0]['camera'], label + ' actual p0')
        require(public['sourceHDFramePNGSha256'] == source['sourcePNGFrames'][0]['sha256']
                == hd_source['sourcePNGFrames'][0]['sha256'], label + ': source p0 PNG differs')
        require(public['sourcePreservation'] == source['sourcePreservation'] == hd_source['sourcePreservation'],
                label + ': studio/model/source-preservation records differ')
        require(public['studio'] == source['sourcePreservation']['studio']
                and public['geometryAndMaterialsSha256'] == source['sourcePreservation']['sourceGeometryAndMaterials']['sha256'],
                label + ': model geometry/materials or studio differ')
        require(public['studioHelperSha256'] == source['studioHelperSha256']
                and public['renderWrapperSha256'] == source['rendererSha256'],
                label + ': source render programs differ')
        if key == 'carbonSeat':
            require(public['carbonGeometryVerification'] == source['carbonGeometryVerification'],
                    label + ': Carbon source geometry proof differs')
        render = catalog['renderProvenance']
        for field, expected in (('firstAnimationFrame', card['sourceFrame']),
                                ('firstAnimationFrameSha256', card['sourceFrameSha256']),
                                ('provenance', card['provenance']), ('coverProgress', 0)):
            require(render[field] == expected, label + ': catalog differs: ' + field)
        for field, camera_field in (('cameraLocation', 'location'), ('cameraRotation', 'rotation'),
                                    ('cameraOrthoScale', 'orthoScale')):
            if field in render:
                close_values(render[field], public['camera'][camera_field], label + ' catalog ' + field)
        return public

    def pages(self, covers, node):
        home = previous.PageReferences((self.root / 'index.html').read_text(encoding='utf-8'))
        detail = previous.PageReferences((self.root / 'case-study.html').read_text(encoding='utf-8'))
        require(home.cards.keys() == covers.keys(), 'Homepage project-card keys differ')
        for key, card in covers.items():
            require(len(home.cards[key]) == 1, key + ': expected one homepage cover image')
            image = home.cards[key][0]
            require(image['src'] == self.variant_url(card['variants'][1]) and image['srcset'] == card['srcset'],
                    key + ': homepage cover URLs differ')
            require((image['width'], image['height']) == ('1800', '1200') and image['alt'] == card['alt'],
                    key + ': homepage cover dimensions/alt differ')
        for page, manifest, scripts in ((home, 'manifest.json', ['exploded.js']),
                                       (detail, 'manifest-detail.json', ['exploded.js', 'case-study-data.js', 'case-study.js'])):
            for script in scripts:
                matching = [s for s in page.scripts if urlsplit(s['src']).path == script]
                require(len(matching) == 1 and matching[0]['src'] == f'{script}?v={REVISION}',
                        script + ': missing/duplicate/stale page script URL')
                if script == 'exploded.js':
                    require(matching[0].get('data-manifest') == f'assets/exploded/{manifest}?v={REVISION}',
                            script + ': wrong animation manifest/cache version')
        case_js = (self.root / 'case-study.js').read_text(encoding='utf-8')
        urls = re.findall(r'assets/editorial/animation-covers[^\s\x22\x27`]*', case_js)
        require(urls == [f'assets/editorial/animation-covers.json?v={REVISION}'],
                'Detail page: wrong runtime cover catalog/cache version')
        script = ("const fs=require('fs'),vm=require('vm');const c={window:{}};"
                  "vm.runInNewContext(fs.readFileSync(process.argv[1],'utf8'),c,{timeout:5000});"
                  "process.stdout.write(JSON.stringify(c.window.caseStudyData));")
        fallback = json.loads(subprocess.check_output([node, '-e', script, str(self.root / 'case-study-data.js')],
                                                     text=True, encoding='utf-8'))
        require(fallback.keys() == covers.keys(), 'Case-study fallback keys differ')
        for key, card in covers.items():
            for field in ('src', 'srcset', 'alt', 'width', 'height'):
                require(fallback[key]['cover'][field] == card[field], key + ': fallback cover differs: ' + field)
        for name in ('exploded.js', 'case-study.js', 'case-study-data.js'):
            subprocess.run([node, '--check', str(self.root / name)], check=True, capture_output=True)

    def run(self, node):
        home = self.read('assets/exploded/manifest.json')
        detail = self.read('assets/exploded/manifest-detail.json')
        covers = self.read('assets/editorial/animation-covers.json')
        rows = self.read('tools/editorial-render/catalog-manifest.json')
        catalog = {row['project']: row for row in rows}
        require(len(rows) == len(catalog) and catalog.keys() == MODES.keys(), 'Editorial catalog keys differ')
        for label, manifest in (('home', home), ('detail', detail), ('covers', covers)):
            require(manifest['version'] == 1 and manifest['revision'] == REVISION
                    and manifest['projects'].keys() == MODES.keys(), label + ': wrong schema/revision/project keys')
        records, common_studio, encoded_backgrounds = {}, None, set()
        for key in MODES:
            sd, sd_check = self.sequence(key, home['projects'][key], (640, 427))
            hd, hd_check = self.sequence(key, detail['projects'][key], (1280, 854), detail=True)
            require(sd['motion'] == hd['motion'] and sd['timings'] == hd['timings']
                    and sd['sourcePNGFrames'] == hd['sourcePNGFrames'] == sd['sourceMasterPNGs'],
                    key + ': SD/HD do not share the complete native source sequence')
            for source in (sd, hd):
                for index in (0, (source['frameCount'] - 1) // 2, source['frameCount'] - 1):
                    encoded_backgrounds.update(tuple(rgb) for rgb in source['encodedFrames'][index]['backgroundVerification']['cornersRGB'])
            recipe = self.preservation(key, hd)
            if common_studio is None:
                common_studio = recipe
            require(recipe == common_studio, key + ': common neutral studio recipe differs')
            self.cover(key, covers['projects'][key], catalog[key], home['projects'][key], sd, hd)
            if key == 'carbonSeat':
                require(sd['carbonGeometryVerification'] == hd['carbonGeometryVerification'],
                        'Carbon: SD/HD proofs differ')
                self.carbon(hd)
            records[key] = {'home': sd_check, 'detail': hd_check, 'coverVariants': 3,
                            'sharedNativePNGs': len(sd['sourcePNGFrames']),
                            'previousMotionAndCamerasPreserved': key != 'carbonSeat'}
        home_transport = self.transport(home, 'home')
        detail_transport = self.transport(detail, 'detail')
        require(len(encoded_backgrounds) == 1, 'Encoded background samples differ across projects or resolutions')
        self.pages(covers['projects'], node)
        return {'status': 'passed', 'passed': True, 'revision': REVISION,
                'projectCount': 16, 'homeFrames': home_transport['frameCount'],
                'detailFrames': detail_transport['frameCount'], 'coverVariants': 48,
                'homeChunks': home_transport['chunkCount'], 'homeBytes': home_transport['bytes'],
                'detailChunks': detail_transport['chunkCount'], 'detailBytes': detail_transport['bytes'],
                'homeTransport': home_transport, 'detailTransport': detail_transport,
                'sharedNativeSourcePNGs': 2032, 'backgroundDisplayRGB': [25, 25, 25],
                'encodedBackgroundSampleRGB': list(next(iter(encoded_backgrounds))),
                'allProjectsShareNeutralStudioRecipe': True, 'preservedMotionAndCameraProjects': 15,
                'legacySDComponentNamesVerifiedAgainstPriorHD': ['brakeSim', 'seat'],
                'historicalCameraMatrixTranslationLagVerified': ['aura', 'seat'],
                'carbonCompletedGeometryAndDimensionsUnchanged': True,
                'allBinaryCacheHashesAndChunkSlicesMatch': True,
                'allCoverPoseCameraAndPageReferencesMatch': True,
                'jsonLineEndingEquivalentHashes': sorted(self.line_ending_equivalents),
                'scope': 'Current checkout assets and consistency of public provenance. Native pixel/scene audits and historical media preservation remain separate release checks.',
                'projects': records}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--site-root', type=Path, default=ROOT)
    parser.add_argument('--node', default=shutil.which('node'), help='Node.js executable (default: PATH)')
    parser.add_argument('--report', type=Path, help='Optional JSON report; default is stdout only')
    args = parser.parse_args(argv)
    try:
        require(args.node, 'Node.js was not found; install it or pass --node PATH')
        report = Validator(args.site_root).run(args.node)
    except (OSError, ValueError, KeyError, TypeError, IndexError, subprocess.SubprocessError) as error:
        report = {'status': 'failed', 'passed': False, 'error': str(error)}
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    print(json.dumps(report, indent=2, ensure_ascii=False))
    return 0 if report['passed'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
