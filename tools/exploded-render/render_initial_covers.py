"""Render animation frame zero at high resolution with its exact camera frame.

The established renderer still stages every controller and calculates framing at
the delivered 640x427 resolution. Only its final render call is intercepted: first
render a 48-sample proof, then render an 1800x1200/192-sample master with the same
scene and camera. Pixel aspect compensates for the rounded animation dimensions.
This wrapper never writes an animation frame or changes the shared renderer.
"""
import argparse
import ast
import hashlib
import json
import sys
from pathlib import Path

import bpy
import numpy as np

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
RENDERER = HERE / 'render_exploded.py'
BASELINE = '9608b5d12fb059cac15083861bf17dd3eda3fcfb'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def serial(value):
    if value is None or isinstance(value, (str, bool, int, float)):
        return value
    if hasattr(value, 'name_full'):
        return value.name_full
    try:
        return list(value)
    except TypeError:
        return str(value)


def scene_digest(scene):
    """Hash visible scene transforms, evaluated meshes, materials and lights."""
    digest = hashlib.sha256()
    depsgraph = bpy.context.evaluated_depsgraph_get()
    for obj in sorted(scene.objects, key=lambda item: item.name):
        if obj.hide_render or obj.type == 'CAMERA':
            continue
        evaluated = obj.evaluated_get(depsgraph)
        digest.update(obj.name.encode())
        digest.update(np.asarray(evaluated.matrix_world, dtype=np.float64).tobytes())
        if evaluated.type == 'MESH':
            mesh = evaluated.data
            for collection, attribute, width, dtype in ((mesh.vertices, 'co', 3, np.float32),
                (mesh.loops, 'vertex_index', 1, np.int32),
                (mesh.polygons, 'material_index', 1, np.int32)):
                values = np.empty(len(collection) * width, dtype=dtype)
                collection.foreach_get(attribute, values)
                digest.update(values.tobytes())
            for material in mesh.materials:
                if material is None:
                    continue
                record = {'name': material.name, 'diffuse': list(material.diffuse_color), 'nodes': [], 'links': []}
                if material.use_nodes:
                    for node in material.node_tree.nodes:
                        record['nodes'].append([node.name, node.bl_idname,
                            [[socket.name, serial(socket.default_value)] for socket in node.inputs if hasattr(socket, 'default_value')],
                            getattr(node, 'operation', None)])
                    record['links'] = [[link.from_node.name, link.from_socket.name, link.to_node.name, link.to_socket.name]
                        for link in material.node_tree.links]
                digest.update(json.dumps(record, sort_keys=True).encode())
        elif evaluated.type == 'LIGHT':
            digest.update(json.dumps({'type': obj.data.type, 'energy': obj.data.energy,
                'color': list(obj.data.color), 'size': getattr(obj.data, 'size', None)}).encode())
    return digest.hexdigest()


def camera_state(scene):
    camera = scene.camera
    return {'location': list(camera.location), 'rotation': list(camera.rotation_euler),
        'matrixWorld': [list(row) for row in camera.matrix_world], 'type': camera.data.type,
        'orthoScale': float(camera.data.ortho_scale), 'sensorFit': camera.data.sensor_fit,
        'shiftX': float(camera.data.shift_x), 'shiftY': float(camera.data.shift_y)}


def camera_frame(scene):
    return np.array([list(point) for point in scene.camera.data.view_frame(scene=scene)])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--projects', nargs='+')
    parser.add_argument('--output', type=Path, required=True)
    options = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    manifest = json.loads((ROOT / 'assets/exploded/manifest.json').read_text())
    projects = options.projects or list(manifest['projects'])
    assert set(projects) <= set(manifest['projects'])
    tree = ast.parse(RENDERER.read_text(encoding='utf-8'))
    tree.body = [node for node in tree.body if not isinstance(node, ast.For)]
    render = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == 'render')

    class Intercept(ast.NodeTransformer):
        def visit_Call(self, node):
            if ast.unparse(node.func) == 'bpy.ops.render.render':
                return ast.copy_location(ast.parse('capture_initial_cover(key, motion, ground, scene, out)').body[0].value, node)
            return self.generic_visit(node)

    Intercept().visit(render)
    ast.fix_missing_locations(tree)
    namespace = {'__file__': str(RENDERER), '__name__': 'initial_cover_scene'}

    def capture(key, motion, ground, scene, out):
        source = manifest['projects'][key]
        source_provenance = json.loads((ROOT / source['provenance']).read_text())
        report_unchanged = motion.report == source_provenance['motion']
        documentary_differences = []
        if not report_unchanged and key == 'formlabs':
            # A previous documentation correction removed an unsupported mm
            # interpretation. All modeled pitch/lead, axes, groups and travel
            # values must remain exactly equal to the existing animation.
            current = json.loads(json.dumps(motion.report))
            previous = source_provenance['motion']
            old_text = previous['leadscrew']['calibration']
            new_text = current['leadscrew']['calibration']
            assert old_text == 'Four-start helical periodicity recovered from source screw surface; 8 mm lead at the source 530 mm overall width.'
            assert new_text == 'Four-start helical periodicity and axial pitch recovered from the staged source screw surface; normalized scene distances.'
            current['leadscrew']['calibration'] = old_text
            assert current == previous, (key, 'Animation kinematics changed')
            documentary_differences.append({'path': 'leadscrew.calibration', 'previous': old_text, 'current': new_text})
        else:
            assert report_unchanged, (key, 'Animation controller report changed')
        assert (scene.render.resolution_x, scene.render.resolution_y) == (source['width'], source['height'])
        assert scene.render.pixel_aspect_x == scene.render.pixel_aspect_y == 1
        first_frame = ROOT / source['frames'][0].split('?')[0]
        assert sha(first_frame) == source_provenance['encodedFrames'][0]['sha256']
        motion.apply(0.)
        bpy.context.view_layer.update()
        initial_camera = camera_state(scene)
        initial_frame = camera_frame(scene)
        initial_scene = scene_digest(scene)
        scene.cycles.samples = source_provenance['samples']
        scene.render.filepath = str(out / 'proof-00.png')
        bpy.ops.render.render(write_still=True)
        source_master = ROOT.parent / '.codex' / source_provenance['motionRevision'] / 'generated' / key / '00.png'
        assert source_master.is_file(), source_master
        scene.render.resolution_x, scene.render.resolution_y = 1800, 1200
        # Blender clamps pixel-aspect components to at least one. Express the
        # source ratio with a slightly taller pixel instead of X below one.
        scene.render.pixel_aspect_x = 1
        scene.render.pixel_aspect_y = (1800 / 1200) / (source['width'] / source['height'])
        scene.cycles.samples = 192
        scene.render.filepath = str(out / 'cover.png')
        bpy.context.view_layer.update()
        master_scene = scene_digest(scene)
        master_camera = camera_state(scene)
        projection_error = float(np.max(np.abs(initial_frame - camera_frame(scene))))
        assert initial_scene == master_scene and initial_camera == master_camera, (key, 'Scene changed between resolutions')
        assert projection_error < 2e-6, (key, projection_error)
        bpy.ops.render.render(write_still=True)
        namespace['args'].samples = 192
        record = {'project': key, 'baselineCommit': BASELINE, 'coverProgress': 0.,
            'sourceFrame': source['frames'][0], 'sourceFrameSha256': sha(first_frame),
            'sourceAnimationProvenance': source['provenance'], 'sourceAnimationProvenanceSha256': sha(ROOT / source['provenance']),
            'sourceAnimationRevision': source_provenance['motionRevision'], 'sourceFrameCount': len(source['frames']),
            'sourceDimensions': [source['width'], source['height']], 'sourceSamples': source_provenance['samples'],
            'sourcePNG': str(source_master), 'sourcePNGSha256': sha(source_master),
            'proofPNG': str(out / 'proof-00.png'), 'proofPNGSha256': sha(out / 'proof-00.png'),
            'masterPNG': str(out / 'cover.png'), 'masterSha256': sha(out / 'cover.png'),
            'dimensions': [1800, 1200], 'samples': 192, 'pixelAspect': [scene.render.pixel_aspect_x, scene.render.pixel_aspect_y],
            'camera': initial_camera, 'groundZ': float(ground.location.z),
            'sceneSha256BeforeResolutionChange': initial_scene, 'sceneSha256AfterResolutionChange': master_scene,
            'cameraFrameMaximumError': projection_error, 'motionReportUnchanged': report_unchanged,
            'motionKinematicsUnchanged': True, 'documentaryDifferences': documentary_differences,
            'renderer': 'tools/exploded-render/render_initial_covers.py', 'rendererSha256': sha(Path(__file__)),
            'animationRenderer': 'tools/exploded-render/render_exploded.py', 'animationRendererSha256': sha(RENDERER),
            'projectionPolicy': 'Stage at delivered animation resolution; preserve the exact frame-zero camera and compensate output pixel aspect for the rounded 640x427 source.'}
        (out / 'initial-cover-provenance.json').write_text(json.dumps(record, indent=2) + '\n')
        print('INITIAL_COVER_COMPLETE', key, projection_error, flush=True)

    namespace['capture_initial_cover'] = capture
    original_argv = sys.argv[:]
    sys.argv = ['blender', '--', '--projects', *projects, '--width', '640', '--samples', '48',
        '--cover-progress', '0', '--output', str(options.output.resolve())]
    try:
        exec(compile(tree, str(RENDERER), 'exec'), namespace)
        for key in projects:
            namespace['render'](key)
    finally:
        sys.argv = original_argv


if __name__ == '__main__':
    main()
