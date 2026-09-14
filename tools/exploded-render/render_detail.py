"""Render native 1280x854 detail frames after the approved 640x427 staging.

Run with Blender. Does not encode or modify the public animation manifest.
Education is deliberately excluded: its scene correction has a separate owner.
"""
import argparse
import ast
import copy
import hashlib
import json
import os
import sys
import time
import subprocess
from pathlib import Path
import bpy
import numpy as np

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[2]
EVIDENCE = ROOT.parent / '.codex/detail-resolution-20260914'
RENDERER = ROOT / 'tools/exploded-render/render_exploded.py'
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()


def camera_state(scene):
    camera = scene.camera
    return {'location': list(camera.location), 'rotation': list(camera.rotation_euler),
            'matrixWorld': [list(row) for row in camera.matrix_world],
            'type': camera.data.type, 'orthoScale': float(camera.data.ortho_scale),
            'sensorFit': camera.data.sensor_fit, 'shiftX': float(camera.data.shift_x),
            'shiftY': float(camera.data.shift_y)}


def numeric_error(a, b):
    if isinstance(a, dict):
        assert set(a) == set(b), (set(a), set(b))
        return max((numeric_error(a[k], b[k]) for k in a), default=0.)
    if isinstance(a, list):
        assert len(a) == len(b)
        return max((numeric_error(x, y) for x, y in zip(a, b)), default=0.)
    if isinstance(a, (float, int)):
        return abs(a - b)
    assert a == b, (a, b)
    return 0.


def write_json(path, record):
    path.write_text(json.dumps(record, indent=2) + '\n', encoding='utf-8')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--projects', nargs='+')
    parser.add_argument('--only', nargs='+', type=int)
    parser.add_argument('--evidence', type=Path, default=EVIDENCE, help='Evidence and candidate-manifest directory.')
    parser.add_argument('--output', type=Path, help='Native PNG directory; defaults to EVIDENCE/generated.')
    parser.add_argument('--python-executable', default=os.environ.get('DETAIL_PYTHON', 'python'), help='Python with Pillow and NumPy for --pack.')
    parser.add_argument('--asset-base', default='assets/exploded/detail-20260914', help='Relative public asset directory passed to --pack.')
    parser.add_argument('--threads', type=int, default=0, help='0 restores original AUTO threading; otherwise fixed CPU threads.')
    parser.add_argument('--resume', action='store_true')
    parser.add_argument('--pack', action='store_true')
    parser.add_argument('--gpu-oidn', action='store_true', help='Keep OpenImageDenoise algorithm and execute it on GPU after parity validation.')
    options = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    assert 0 <= options.threads <= 64
    evidence = options.evidence.resolve()
    options.output = (options.output or evidence / 'generated').resolve()
    executed_wrapper_sha = sha(Path(__file__))
    archive = evidence / 'assets/source-archive'
    archive.mkdir(parents=True, exist_ok=True)
    (archive / (executed_wrapper_sha + '.py')).write_bytes(Path(__file__).read_bytes())
    manifest_path = ROOT / 'assets/exploded/manifest.json'
    manifest = json.loads(manifest_path.read_text())
    keys = options.projects or [key for key in manifest['projects'] if key != 'education']
    assert keys and 'education' not in keys and len(set(keys)) == len(keys)
    assert set(keys) <= set(manifest['projects'])
    tree = ast.parse(RENDERER.read_text(encoding='utf-8'))
    tree.body = [node for node in tree.body if not isinstance(node, ast.For)]
    render = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == 'render')
    replacements = 0

    class Intercept(ast.NodeTransformer):
        def visit_Call(self, node):
            nonlocal replacements
            if ast.unparse(node.func) == 'bpy.ops.render.render':
                replacements += 1
                return ast.copy_location(ast.parse('capture(key, motion, scene, index, progress, ground)').body[0].value, node)
            return self.generic_visit(node)

    Intercept().visit(render)
    assert replacements == 1
    ast.fix_missing_locations(tree)
    namespace = {'__file__': str(RENDERER), '__name__': 'detail_scene'}
    project_records = {}
    scene_checks = {}
    cover_renderer = ROOT / 'tools/exploded-render/render_initial_covers.py'
    cover_tree = ast.parse(cover_renderer.read_text(encoding='utf-8'))
    digest_tree = ast.Module(body=[node for node in cover_tree.body
        if isinstance(node, ast.FunctionDef) and node.name in ('serial', 'scene_digest')], type_ignores=[])
    digest_namespace = {'bpy': bpy, 'np': np, 'json': json, 'hashlib': hashlib}
    exec(compile(digest_tree, str(cover_renderer), 'exec'), digest_namespace)
    scene_digest = digest_namespace['scene_digest']
    pipeline = {str(path.relative_to(ROOT)): sha(path)
                for directory in ('tools/exploded-render', 'tools/editorial-render')
                for path in (ROOT / directory).glob('*.py')}

    def capture(key, motion, scene, index, progress, ground):
        config = manifest['projects'][key]
        source = json.loads((ROOT / config['provenance']).read_text())
        assert (config['width'], config['height']) == (640, 427)
        assert (scene.render.resolution_x, scene.render.resolution_y) == (640, 427)
        assert (scene.render.pixel_aspect_x, scene.render.pixel_aspect_y) == (1., 1.)
        assert scene.cycles.samples == source['samples'] == 48
        assert index is not None and 0 <= index < len(config['frames'])
        old_motion, current_motion = copy.deepcopy(source['motion']), copy.deepcopy(motion.report)
        documentary = []
        if old_motion != current_motion and key == 'formlabs':
            old = old_motion['leadscrew']['calibration']
            new = current_motion['leadscrew']['calibration']
            old_motion['leadscrew']['calibration'] = new
            documentary.append({'field': 'leadscrew.calibration', 'source': old, 'current': new})
        assert old_motion == current_motion, (key, 'Source controller changed')
        folder = options.output.resolve() / key
        folder.mkdir(parents=True, exist_ok=True)
        record_path = folder / 'detail-frame-records.json'
        if key not in project_records:
            previous = json.loads(record_path.read_text()) if options.resume and record_path.exists() else {}
            project_records[key] = previous
        rows = project_records[key]
        before_camera = camera_state(scene)
        before_frame = np.array([list(p) for p in scene.camera.data.view_frame(scene=scene)])
        p0_error = None
        if index == 0:
            cover_record = ROOT / 'assets/editorial/animation-start-20260913' / f'{key}-provenance.json'
            cover = json.loads(cover_record.read_text())
            p0_error = numeric_error(before_camera, cover['camera'])
            assert p0_error < 2e-6, (key, 'P0 cover camera mismatch', p0_error)
            current_scene = scene_digest(scene)
            expected_scene = cover['sceneSha256BeforeResolutionChange']
            assert current_scene == expected_scene, (key, 'P0 geometry/material/light digest mismatch', current_scene, expected_scene)
            scene_checks[key] = {'currentP0SceneSha256': current_scene, 'approvedP0SceneSha256': expected_scene,
                                 'geometryMaterialsLightsMatchApprovedCover': True}
        output = Path(scene.render.filepath)
        scene.render.resolution_x, scene.render.resolution_y = 1280, 854
        scene.render.threads_mode = 'FIXED' if options.threads else 'AUTO'
        if options.threads:
            scene.render.threads = options.threads
        if options.gpu_oidn:
            assert scene.cycles.denoiser == 'OPENIMAGEDENOISE'
            assert hasattr(scene.cycles, 'denoising_use_gpu')
            scene.cycles.denoising_use_gpu = True
        after_camera = camera_state(scene)
        after_frame = np.array([list(p) for p in scene.camera.data.view_frame(scene=scene)])
        error = float(np.max(np.abs(before_frame - after_frame)))
        assert before_camera == after_camera and error == 0., (key, index, error)
        started = time.monotonic()
        previous = rows.get(str(index))
        if options.resume and previous and output.exists():
            assert sha(output) == previous['sha256'], (key, index, 'Existing PNG changed')
            assert previous['camera'] == after_camera and previous['progress'] == progress
            print('DETAIL_RESUME', key, index, flush=True)
            record = previous
            record.setdefault('denoiserAlgorithm', 'OPENIMAGEDENOISE')
            record.setdefault('denoisingUseGPU', False)
        else:
            bpy.ops.render.render(write_still=True)
            record = {'index': index, 'progress': progress, 'seconds': round(time.monotonic() - started, 3),
                'file': output.name, 'sha256': sha(output), 'bytes': output.stat().st_size,
                'camera': after_camera, 'cameraProjectionMaximumError': error,
                'p0CoverCameraMaximumError': p0_error,
                'denoiserAlgorithm': scene.cycles.denoiser,
                'denoisingUseGPU': bool(scene.cycles.denoising_use_gpu),
                'executedWrapperSha256': executed_wrapper_sha}
            rows[str(index)] = record
            write_json(record_path, rows)
            print('DETAIL_FRAME', key, index, record['seconds'], flush=True)
        if index == 0:
            record.update(scene_checks[key])
            write_json(record_path, rows)
        scene.render.resolution_x, scene.render.resolution_y = 640, 427
        write_json(folder / 'detail-source.json', {
            'project': key, 'sourceManifestSha256': sha(manifest_path),
            'sourceAnimationProvenance': config['provenance'],
            'sourceAnimationProvenanceSha256': sha(ROOT / config['provenance']),
            'sourceFrameCount': len(config['frames']), 'sourceDimensions': [640, 427],
            'outputDimensions': [1280, 854], 'sourceSamples': 48, 'outputSamples': 48,
            'nativeRerender': True, 'upscaledSourceImages': False, 'controllerUnchanged': True,
            'documentaryDifferences': documentary,
            'projectionPolicy': 'Stage and fit every pose at 640x427; change only raster dimensions to exact 2x at the render call, then restore stage dimensions.',
            'engine': scene.render.engine, 'device': scene.cycles.device, 'threads': options.threads,
            'adaptiveThreshold': scene.cycles.adaptive_threshold, 'denoising': scene.cycles.use_denoising,
            'denoiserAlgorithm': scene.cycles.denoiser, 'denoisingUseGPU': bool(scene.cycles.denoising_use_gpu),
            'resumeSamplingNote': 'Earlier retained CPU OIDN frames and later GPU OIDN frames share the original algorithm and 48 samples; backend parity probe max error was 1/255 per channel.',
            'p0SceneValidation': scene_checks.get(key),
            'renderWrapperSha256': executed_wrapper_sha, 'sourceFiles': pipeline})

    namespace['capture'] = capture
    original_argv = sys.argv[:]
    sys.argv = ['blender', '--', '--width', '640', '--samples', '48', '--output', str(options.output.resolve())]
    try:
        exec(compile(tree, str(RENDERER), 'exec'), namespace)
        for key in keys:
            namespace['args'].frames = len(manifest['projects'][key]['frames'])
            namespace['args'].only = options.only
            namespace['render'](key)
            folder = options.output.resolve() / key
            record_path = folder / 'provenance.json'
            report = json.loads(record_path.read_text())
            report.update(width=1280, height=854, motionRevision='detail-resolution-20260914',
                          sourceAnimationProvenance=manifest['projects'][key]['provenance'],
                          sourceDimensions=[640, 427], nativeRerender=True, imageUpscaling=False,
                          renderWrapper=Path(__file__).resolve().relative_to(ROOT).as_posix(), renderWrapperSha256=executed_wrapper_sha,
                          projectionValidation='detail-frame-records.json', sourceValidation='detail-source.json')
            rows = project_records[key]
            report['renderedFrameCount'] = len(rows)
            report['complete'] = set(rows) == {str(i) for i in range(report['frameCount'])}
            report['timings'] = [rows[str(i)] for i in range(report['frameCount']) if str(i) in rows]
            report['nativeRenderSeconds'] = round(sum(row['seconds'] for row in rows.values()), 3)
            write_json(record_path, report)
            print('DETAIL_PROJECT_COMPLETE', key, report['complete'], report['nativeRenderSeconds'], flush=True)
            if options.pack:
                assert report['complete'], (key, 'Cannot pack incomplete native sequence')
                subprocess.run([
                    options.python_executable, '-X', 'utf8', str(Path(__file__).with_name('pack_detail.py')),
                    '--projects', key, '--input', str(options.output), '--evidence', str(evidence),
                    '--asset-base', options.asset_base], check=True)
    finally:
        sys.argv = original_argv


if __name__ == '__main__':
    main()
