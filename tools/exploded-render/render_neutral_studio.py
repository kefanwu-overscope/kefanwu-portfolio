"""Native neutral studio sequences and p0 covers, without manifest mutation."""
import argparse
import ast
import copy
import hashlib
import json
import os
import subprocess
import sys
import time
from pathlib import Path

import bpy
import numpy as np

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))
from neutral_studio import apply_studio, REVISION
from render_initial_covers import camera_state, camera_frame, scene_digest
from render_education_studio import geometry_material_digest, matrices
from render_detail import numeric_error

RENDERER = HERE / 'render_exploded.py'
EVIDENCE = ROOT.parent / '.codex/neutral-studio-20260915'


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def read(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def save(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2) + '\n', encoding='utf-8')


def baseline_reference(path, link_field):
    """Follow preserved references after neutral candidates become canonical."""
    path = path.split('?')[0]
    seen = set()
    while True:
        assert path not in seen, ('Cyclic baseline provenance', path)
        seen.add(path)
        record = read(ROOT / path)
        previous = record.get('sourcePreservation', {}).get(link_field)
        if not previous:
            return path, record
        path = previous.split('?')[0]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--projects', nargs='+')
    parser.add_argument('--only', nargs='+', type=int)
    parser.add_argument('--evidence', type=Path, default=EVIDENCE)
    parser.add_argument('--output', type=Path)
    parser.add_argument('--variant', choices=('flat', 'contact'), default='flat')
    parser.add_argument('--cover', action='store_true')
    parser.add_argument('--resume', action='store_true')
    parser.add_argument('--cpu-oidn', action='store_true')
    parser.add_argument('--allow-carbon-motion-change', action='store_true')
    parser.add_argument('--pack', action='store_true')
    parser.add_argument('--python-executable', default=os.environ.get('DETAIL_PYTHON', 'python'))
    opts = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    evidence = opts.evidence.resolve()
    generated = (opts.output or evidence / 'generated').resolve()
    manifest_path = ROOT / 'assets/exploded/manifest.json'
    manifest = read(manifest_path)
    previous_hd = read(ROOT / 'assets/exploded/manifest-detail.json')
    covers = read(ROOT / 'assets/editorial/animation-covers.json')
    keys = opts.projects or list(manifest['projects'])
    assert len(keys) == len(set(keys)) and set(keys) <= set(manifest['projects'])
    baselines = {}
    for key in keys:
        baselines[key] = {
            'home': baseline_reference(manifest['projects'][key]['provenance'], 'sourceAnimationProvenance'),
            'hd': baseline_reference(previous_hd['projects'][key]['provenance'], 'previousHDAnimationProvenance'),
            'cover': baseline_reference(covers['projects'][key]['provenance'], 'previousCoverProvenance')}
    # Carbon and brake share one module. Load it before capturing source hashes
    # so a separate Carbon editor cannot change the code loaded mid-batch.
    import material_processes
    source_files = {str(p.relative_to(ROOT)).replace('\\', '/'): sha(p)
                    for directory in ('tools/exploded-render', 'tools/editorial-render')
                    for p in (ROOT / directory).glob('*.py')}
    for relative, digest in source_files.items():
        archive = evidence / 'source-archive' / (digest + '.py')
        archive.parent.mkdir(parents=True, exist_ok=True)
        if not archive.exists():
            archive.write_bytes((ROOT / relative).read_bytes())
    wrapper_sha, helper_sha = sha(__file__), sha(HERE / 'neutral_studio.py')
    source_contract = hashlib.sha256(json.dumps(source_files, sort_keys=True).encode()).hexdigest()
    project_audits, rows_by_project = {}, {}

    def capture(key, motion, scene, index, progress, ground):
        assert (scene.render.resolution_x, scene.render.resolution_y) == (640, 427)
        assert scene.cycles.samples == 48
        bpy.context.view_layer.update()
        before_camera, before_frame = camera_state(scene), camera_frame(scene)
        folder = generated / key
        record_path = folder / 'neutral-frame-records.json'
        if key not in project_audits:
            old = baselines[key]['home'][1]
            old_motion, current_motion = copy.deepcopy(old['motion']), copy.deepcopy(motion.report)
            documentary = []
            if key == 'formlabs' and old_motion != current_motion:
                old_motion['leadscrew']['calibration'] = current_motion['leadscrew']['calibration']
                documentary.append('leadscrew.calibration: previously documented wording correction')
            changed = old_motion != current_motion
            assert not changed or (key == 'carbonSeat' and opts.allow_carbon_motion_change), (key, 'Unexpected motion change')
            old_cover = baselines[key]['cover'][1]
            p0_error = numeric_error(before_camera, old_cover['camera']) if index == 0 else None
            assert p0_error is None or p0_error < 2e-6 or (key == 'carbonSeat' and changed), (key, p0_error)
            if index == 0 and key not in ('education', 'carbonSeat'):
                assert scene_digest(scene) == old_cover['sceneSha256BeforeResolutionChange'], (key, 'Original scene mismatch')
            before_geometry, before_pose = geometry_material_digest(motion.objects), matrices(motion.objects)
            studio = apply_studio(scene, ground, motion.objects, opts.variant)
            bpy.context.view_layer.update()
            assert before_geometry == geometry_material_digest(motion.objects), (key, 'Model geometry/material changed')
            assert np.array_equal(before_pose, matrices(motion.objects)), (key, 'Model pose changed')
            assert before_camera == camera_state(scene)
            audit = {'status': 'passed', 'project': key, 'studio': studio,
                     'modelGeometryMaterialsUnchangedByStudio': True, 'modelPoseMaximumMatrixError': 0.,
                     'sourceGeometryAndMaterials': before_geometry,
                     'sourceMotionReportUnchanged': not changed,
                     'carbonMotionRevisionAuthorized': changed,
                     'documentaryDifferences': documentary,
                     'p0PreviousCoverCameraMaximumError': p0_error,
                     'sourceAnimationProvenance': baselines[key]['home'][0],
                     'sourceAnimationProvenanceSha256': sha(ROOT / baselines[key]['home'][0]),
                     'previousHDAnimationProvenance': baselines[key]['hd'][0],
                     'previousHDAnimationProvenanceSha256': sha(ROOT / baselines[key]['hd'][0]),
                     'previousCoverProvenance': baselines[key]['cover'][0],
                     'previousCoverProvenanceSha256': sha(ROOT / baselines[key]['cover'][0]),
                     'sourceFiles': source_files, 'studioHelperSha256': helper_sha,
                     'renderWrapperSha256': wrapper_sha}
            project_audits[key] = audit
            audit['sourceContractSha256'] = hashlib.sha256(json.dumps({
                'pipeline': source_contract, 'geometryAndMaterials': before_geometry,
                'motion': current_motion, 'initialCamera': before_camera,
                'originalSD': audit['sourceAnimationProvenanceSha256'],
                'originalHD': audit['previousHDAnimationProvenanceSha256'],
                'originalCover': audit['previousCoverProvenanceSha256'],
            }, sort_keys=True).encode()).hexdigest()
            save(folder / 'neutral-source.json', audit)
            rows_by_project[key] = read(record_path) if opts.resume and record_path.exists() else {}
        rows = rows_by_project[key]
        output = Path(scene.render.filepath)
        scene.render.resolution_x, scene.render.resolution_y = 1280, 854
        scene.render.threads_mode = 'AUTO'
        assert scene.cycles.denoiser == 'OPENIMAGEDENOISE'
        scene.cycles.denoising_use_gpu = not opts.cpu_oidn
        bpy.context.view_layer.update()
        error = float(np.max(np.abs(camera_frame(scene) - before_frame)))
        assert error == 0. and before_camera == camera_state(scene)
        previous = rows.get(str(index))
        if opts.resume and previous and output.exists():
            assert sha(output) == previous['sha256'] and previous['camera'] == before_camera
            assert previous['studioHelperSha256'] == helper_sha
            assert previous['renderWrapperSha256'] == wrapper_sha
            assert previous['sourceContractSha256'] == project_audits[key]['sourceContractSha256']
            print('NEUTRAL_RESUME', key, index, flush=True)
        else:
            started = time.monotonic()
            bpy.ops.render.render(write_still=True)
            rows[str(index)] = {'index': index, 'progress': progress, 'file': output.name,
                                'sha256': sha(output), 'bytes': output.stat().st_size,
                                'seconds': round(time.monotonic() - started, 3),
                                'camera': before_camera, 'cameraProjectionMaximumError': error,
                                'studioHelperSha256': helper_sha, 'renderWrapperSha256': wrapper_sha,
                                'sourceContractSha256': project_audits[key]['sourceContractSha256'],
                                'denoiserAlgorithm': scene.cycles.denoiser,
                                'denoisingUseGPU': scene.cycles.denoising_use_gpu}
            save(record_path, rows)
            print('NEUTRAL_FRAME', key, index, rows[str(index)]['seconds'], flush=True)
        if index == 0 and opts.cover:
            cover_path = folder / 'cover.png'
            cover_record_path = folder / 'cover-provenance.json'
            cover_before_pose = matrices(motion.objects)
            scene.render.resolution_x, scene.render.resolution_y = 1800, 1200
            scene.render.pixel_aspect_x = 1.
            scene.render.pixel_aspect_y = (1800 / 1200) / (640 / 427)
            scene.cycles.samples, scene.cycles.adaptive_threshold = 192, .008
            scene.render.filepath = str(cover_path)
            bpy.context.view_layer.update()
            cover_error = float(np.max(np.abs(camera_frame(scene) - before_frame)))
            assert cover_error < 2e-6 and before_camera == camera_state(scene)
            assert np.array_equal(cover_before_pose, matrices(motion.objects))
            old_cover = read(cover_record_path) if opts.resume and cover_record_path.exists() else None
            if old_cover and cover_path.exists():
                assert old_cover['masterSha256'] == sha(cover_path)
                assert old_cover['studioHelperSha256'] == helper_sha and old_cover['renderWrapperSha256'] == wrapper_sha
                assert old_cover['sourceContractSha256'] == project_audits[key]['sourceContractSha256']
            else:
                started = time.monotonic()
                bpy.ops.render.render(write_still=True)
                save(cover_record_path, {'project': key, 'coverProgress': 0., 'dimensions': [1800, 1200],
                     'samples': 192, 'pixelAspect': [scene.render.pixel_aspect_x, scene.render.pixel_aspect_y],
                     'camera': before_camera, 'cameraFrameMaximumError': cover_error,
                     'masterPNG': str(cover_path), 'masterSha256': sha(cover_path),
                     'sourceHDFramePNG': str(output), 'sourceHDFramePNGSha256': sha(output),
                     'studioHelperSha256': helper_sha, 'renderWrapperSha256': wrapper_sha,
                     'sourceContractSha256': project_audits[key]['sourceContractSha256'],
                     'sourcePreservation': project_audits[key], 'renderSeconds': time.monotonic() - started})
            scene.render.filepath = str(output)
            scene.render.pixel_aspect_x = scene.render.pixel_aspect_y = 1.
            scene.cycles.samples, scene.cycles.adaptive_threshold = 48, .03
        scene.render.resolution_x, scene.render.resolution_y = 640, 427

    tree = ast.parse(RENDERER.read_text(encoding='utf-8'))
    tree.body = [n for n in tree.body if not isinstance(n, ast.For)]
    render = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == 'render')
    class Intercept(ast.NodeTransformer):
        count = 0
        def visit_Call(self, node):
            if ast.unparse(node.func) == 'bpy.ops.render.render':
                self.count += 1
                return ast.copy_location(ast.parse('capture(key, motion, scene, index, progress, ground)').body[0].value, node)
            return self.generic_visit(node)
    interception = Intercept()
    interception.visit(render)
    assert interception.count == 1
    ast.fix_missing_locations(tree)
    namespace = {'__file__': str(RENDERER), '__name__': 'neutral_scene', 'capture': capture}
    original_argv = sys.argv[:]
    try:
        sys.argv = ['blender', '--', '--width', '640', '--samples', '48', '--output', str(generated)]
        exec(compile(tree, str(RENDERER), 'exec'), namespace)
        for key in keys:
            # A separate geometry owner can reserve the renderer between
            # projects for a short proof, without discarding completed frames.
            pause = evidence / 'PAUSE_GPU'
            if pause.exists():
                print('NEUTRAL_GPU_PAUSED_BEFORE', key, flush=True)
                while pause.exists():
                    time.sleep(1.)
            namespace['args'].frames = len(manifest['projects'][key]['frames'])
            namespace['args'].only = opts.only
            namespace['render'](key)
            path = generated / key / 'provenance.json'
            report = read(path)
            rows = rows_by_project[key]
            report.update(width=1280, height=854, motionRevision=REVISION,
                          sourceDimensions=[640, 427], nativeRerender=True, imageUpscaling=False,
                          sourcePreservation=project_audits[key], renderer='tools/exploded-render/render_neutral_studio.py',
                          rendererSha256=wrapper_sha, studioHelperSha256=helper_sha,
                          renderedFrameCount=len(rows), complete=set(rows) == {str(i) for i in range(report['frameCount'])},
                          timings=[rows[str(i)] for i in range(report['frameCount']) if str(i) in rows],
                          nativeRenderSeconds=round(sum(row['seconds'] for row in rows.values()), 3))
            save(path, report)
            print('NEUTRAL_PROJECT_COMPLETE', key, report['complete'], report['nativeRenderSeconds'], flush=True)
            if opts.pack:
                assert report['complete'] and opts.cover
                subprocess.run([opts.python_executable, '-X', 'utf8', str(HERE / 'pack_neutral_studio.py'),
                                '--projects', key, '--input', str(generated), '--evidence', str(evidence)], check=True)
    finally:
        sys.argv = original_argv


if __name__ == '__main__':
    main()
